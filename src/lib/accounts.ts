/**
 * Accounts.
 *  • LIVE (Supabase keys set): email+password and Google via Supabase Auth. Data syncs to the cloud.
 *  • DEMO (no keys): a real local account created on this device. The password is salted + SHA-256
 *    hashed and never leaves the phone. Each account's data is stored separately on the device.
 * The guest (no account) keeps the original storage key so earlier data is never lost.
 */
import { useApp, blankPersisted, type AccountUser } from '../store/app'
import { ACCOUNTS_KEY, GUEST_KEY, SESSION_KEY, currentAccountId, dataKeyFor } from './accountKeys'
import { supabase } from './supabase'
import { isLive } from './env'
import { uid } from './util'

export type StoredAccount = AccountUser & { provider: 'local' | 'supabase'; salt?: string; hash?: string; createdAt: string }

export function listAccounts(): StoredAccount[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') as StoredAccount[] } catch { return [] }
}
function saveAccounts(a: StoredAccount[]) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a)) }
const norm = (e: string) => e.trim().toLowerCase()
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

async function hashPw(pw: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pw}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const publicUser = (a: StoredAccount): AccountUser => ({ id: a.id, email: a.email, name: a.name, avatar: a.avatar, provider: a.provider })

/**
 * Make `id` (or the guest when null) the active account and load its data.
 * carryGuest: the first account created on this phone takes over the guest's existing data.
 */
export async function switchTo(id: string | null, opts: { carryGuest?: boolean; extra?: Record<string, unknown> } = {}) {
  const key = dataKeyFor(id)
  if (!localStorage.getItem(key)) {
    const guest = opts.carryGuest ? localStorage.getItem(GUEST_KEY) : null
    if (guest) {
      try {
        const g = JSON.parse(guest) as { state: Record<string, unknown>; version: number }
        g.state = { ...g.state, ...(opts.extra ?? {}) }
        localStorage.setItem(key, JSON.stringify(g))
      } catch { localStorage.setItem(key, JSON.stringify(blankPersisted(opts.extra as never))) }
    } else localStorage.setItem(key, JSON.stringify(blankPersisted({ lang: useApp.getState().lang, ...(opts.extra ?? {}) } as never)))
  }
  if (id) localStorage.setItem(SESSION_KEY, id)
  else localStorage.removeItem(SESSION_KEY)
  await useApp.persist.rehydrate()
}

export type AuthError = 'name' | 'email' | 'password' | 'exists' | 'login'

/** DEMO: create an account on this device. */
export async function signUpLocal(name: string, email: string, password: string): Promise<{ ok: true } | { ok: false; error: AuthError }> {
  if (!name.trim()) return { ok: false, error: 'name' }
  if (!validEmail(email)) return { ok: false, error: 'email' }
  if (password.length < 6) return { ok: false, error: 'password' }
  const all = listAccounts()
  if (all.some((a) => a.email === norm(email))) return { ok: false, error: 'exists' }
  const salt = uid() + uid()
  const acc: StoredAccount = { id: `local-${uid()}`, email: norm(email), name: name.trim(), provider: 'local', salt, hash: await hashPw(password, salt), createdAt: new Date().toISOString() }
  saveAccounts([...all, acc])
  // the very first account on this phone keeps whatever the guest already logged
  const carryGuest = !all.length && !currentAccountId()
  const prof = useApp.getState().profile
  await switchTo(acc.id, { carryGuest })
  useApp.setState({ user: publicUser(acc), profile: { ...(carryGuest ? useApp.getState().profile : prof), name: name.trim() } })
  return { ok: true }
}

/** DEMO: log in to an account created on this device. */
export async function logInLocal(email: string, password: string): Promise<{ ok: true } | { ok: false; error: AuthError }> {
  if (!validEmail(email)) return { ok: false, error: 'email' }
  const acc = listAccounts().find((a) => a.email === norm(email) && a.provider === 'local')
  if (!acc || !acc.salt || (await hashPw(password, acc.salt)) !== acc.hash) return { ok: false, error: 'login' }
  await switchTo(acc.id)
  useApp.setState({ user: publicUser(acc) })
  return { ok: true }
}

/** LIVE: mirror the Supabase session into the local account list and load that account's data. */
export async function adoptSupabaseUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) {
  if (!u) {
    const cur = useApp.getState().user
    if (cur?.provider === 'supabase') { await switchTo(null); useApp.setState({ user: null }) }
    return
  }
  const all = listAccounts()
  let acc = all.find((a) => a.id === u.id)
  if (!acc) {
    const md = u.user_metadata ?? {}
    acc = { id: u.id, email: norm(u.email ?? ''), name: String(md.full_name ?? md.name ?? ''), avatar: typeof md.avatar_url === 'string' ? md.avatar_url : undefined, provider: 'supabase', createdAt: new Date().toISOString() }
    saveAccounts([...all, acc])
  }
  if (currentAccountId() !== acc.id) await switchTo(acc.id, { carryGuest: !all.length })
  useApp.setState({ user: publicUser(acc) })
}

/** Change name / email (local only) / avatar. */
export function updateAccount(p: Partial<Pick<AccountUser, 'name' | 'email' | 'avatar'>>): { ok: boolean; error?: AuthError } {
  const cur = useApp.getState().user
  if (!cur) return { ok: false }
  const all = listAccounts()
  if (p.email !== undefined) {
    if (!validEmail(p.email)) return { ok: false, error: 'email' }
    if (all.some((a) => a.id !== cur.id && a.email === norm(p.email!))) return { ok: false, error: 'exists' }
    p.email = norm(p.email)
  }
  saveAccounts(all.map((a) => (a.id === cur.id ? { ...a, ...p } : a)))
  const next = { ...cur, ...p }
  useApp.setState({ user: next, ...(p.name !== undefined ? { profile: { ...useApp.getState().profile, name: p.name } } : {}) })
  return { ok: true }
}

/** Log out → back to the guest on this phone. The account's data stays saved for the next login. */
export async function logOut() {
  if (isLive && supabase) await supabase.auth.signOut().catch(() => undefined)
  await switchTo(null)
  useApp.setState({ user: null })
}

/** Delete the account and every piece of its data on this phone (and in the cloud when live). */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const cur = useApp.getState().user
  if (!cur) {
    // guest: wipe the guest data
    localStorage.removeItem(GUEST_KEY)
    useApp.setState(blankPersisted({ lang: useApp.getState().lang }).state as never)
    return { ok: true }
  }
  if (cur.provider === 'supabase' && supabase) {
    const { error } = await supabase.functions.invoke('delete-account', { body: {} })
    if (error) return { ok: false, error: error.message }
    await supabase.auth.signOut().catch(() => undefined)
  }
  localStorage.removeItem(dataKeyFor(cur.id))
  saveAccounts(listAccounts().filter((a) => a.id !== cur.id))
  localStorage.removeItem(SESSION_KEY)
  if (!localStorage.getItem(GUEST_KEY)) localStorage.setItem(GUEST_KEY, JSON.stringify(blankPersisted({ lang: useApp.getState().lang })))
  await useApp.persist.rehydrate()
  useApp.setState({ user: null })
  return { ok: true }
}

/** Shrink a picked photo to a 256px square JPEG data URL for the avatar. */
export function avatarFromFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const s = 256
      const c = document.createElement('canvas')
      c.width = s; c.height = s
      const ctx = c.getContext('2d')!
      const m = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s)
      URL.revokeObjectURL(img.src)
      res(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => rej(new Error('Could not read that image'))
    img.src = URL.createObjectURL(file)
  })
}
