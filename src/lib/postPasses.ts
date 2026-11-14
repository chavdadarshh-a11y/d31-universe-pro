/**
 * Time-limited Knowledge post passes (1 / 3 / 30 posts).
 * Prices & durations live in pricing.json. A pass opens the chosen posts in every
 * language (videos + PDFs) for viewing / streaming only — downloads stay Platinum-only.
 *
 * Live: the server writes `user_post_passes` after a verified Razorpay payment;
 * remaining slots are claimed through the `claim_post_pass_slot` RPC (users cannot
 * insert or edit rows directly). Demo: kept in localStorage per account.
 */
import { create } from 'zustand'
import { useApp } from '../store/app'
import { supabase } from './supabase'
import { isLive } from './env'
import { IN_APP } from './appMode'
import { trustedNow } from './plans'
import { POST_PASS_BY_ID, POST_PASSES, type PostPassId } from '../config/plans'

export type UserPostPass = {
  id: string
  type: PostPassId
  postIds: number[]
  purchasedAt: number
  expiresAt: number
}

export const POST_ID_RE = /^\d{1,6}$/
export const capacityOf = (type: PostPassId) => POST_PASS_BY_ID[type].posts
export const isActivePass = (p: UserPostPass, now = trustedNow()) => now < p.expiresAt

/** Remaining time as a compact "2d 4h" / "18h 22m" / "22m" label, or null if expired. */
export function formatRemain(until: number, now = trustedNow()): string | null {
  const ms = until - now
  if (ms <= 0) return null
  const m = Math.ceil(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), rm = m % 60
  if (h < 48) return rm ? `${h}h ${rm}m` : `${h}h`
  const d = Math.floor(h / 24), rh = h % 24
  return rh ? `${d}d ${rh}h` : `${d}d`
}

export function validPostIds(sku: PostPassId, posts: number[]): boolean {
  const cfg = POST_PASS_BY_ID[sku]
  if (!cfg) return false
  if (!Array.isArray(posts)) return false
  if (posts.some((n) => !Number.isInteger(n) || n < 1 || n > 999999) || new Set(posts).size !== posts.length) return false
  if (posts.length > cfg.posts) return false
  if (sku === 'post_1' && posts.length !== 1) return false
  return true
}

const accountKey = () => useApp.getState().user?.id ?? 'guest'
const storeKey = (acc = accountKey()) => `d31-post-passes:${acc}`

function readLocal(): UserPostPass[] {
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey()) || '[]') as UserPostPass[]
    return Array.isArray(raw) ? raw.filter((p) => p && POST_PASS_BY_ID[p.type] && Array.isArray(p.postIds)) : []
  } catch { return [] }
}
const writeLocal = (rows: UserPostPass[]) => { try { localStorage.setItem(storeKey(), JSON.stringify(rows)) } catch { /* quota */ } }

function fromRow(r: { id: string; pass_type: string; post_ids: number[] | null; purchased_at: string; expires_at: string }): UserPostPass | null {
  if (!POST_PASS_BY_ID[r.pass_type as PostPassId]) return null
  return {
    id: r.id,
    type: r.pass_type as PostPassId,
    postIds: Array.isArray(r.post_ids) ? r.post_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [],
    purchasedAt: new Date(r.purchased_at).getTime(),
    expiresAt: new Date(r.expires_at).getTime(),
  }
}

type State = {
  passes: UserPostPass[]
  loaded: string | null
  refresh: () => Promise<void>
  /** DEMO / after server confirmation */
  grant: (pass: UserPostPass) => void
  /** Use one remaining slot on an active multi-post pass. */
  claim: (postNumber: number) => Promise<'claimed' | 'already' | 'none'>
}

export const usePostPasses = create<State>((set, get) => ({
  passes: [],
  loaded: null,
  refresh: async () => {
    const acc = accountKey()
    let rows = readLocal()
    const uid = useApp.getState().user?.provider === 'supabase' ? useApp.getState().user?.id : null
    if (supabase && uid) {
      const { data, error } = await supabase.from('user_post_passes').select('id, pass_type, post_ids, purchased_at, expires_at').eq('user_id', uid)
      if (!error && data) {
        const remote = data.map(fromRow).filter((x): x is UserPostPass => !!x)
        const byId = new Map(remote.map((p) => [p.id, p]))
        for (const p of rows) if (!byId.has(p.id)) byId.set(p.id, p)
        rows = [...byId.values()]
        writeLocal(rows)
      }
    }
    set({ passes: rows, loaded: acc })
  },
  grant: (pass) => {
    const rows = readLocal()
    const next = [...rows.filter((p) => p.id !== pass.id), pass]
    writeLocal(next)
    set({ passes: next })
  },
  claim: async (postNumber) => {
    if (!Number.isInteger(postNumber) || postNumber < 1) return 'none'
    const now = trustedNow()
    const cur = get().passes
    if (cur.some((p) => isActivePass(p, now) && p.postIds.includes(postNumber))) return 'already'
    const uid = useApp.getState().user?.provider === 'supabase' ? useApp.getState().user?.id : null
    if (supabase && uid) {
      const { data, error } = await supabase.rpc('claim_post_pass_slot', { post_number: postNumber })
      const r = data as { ok?: boolean; reason?: string } | null
      if (error || !r?.ok) return r?.reason === 'already' ? 'already' : 'none'
      await get().refresh()
      return r.reason === 'already' ? 'already' : 'claimed'
    }
    const slot = cur.filter((p) => isActivePass(p, now) && p.postIds.length < capacityOf(p.type)).sort((a, b) => a.expiresAt - b.expiresAt)[0]
    if (!slot) return 'none'
    const next = cur.map((p) => p.id === slot.id ? { ...p, postIds: [...p.postIds, postNumber] } : p)
    writeLocal(next)
    set({ passes: next })
    return 'claimed'
  },
}))

export const activePasses = (now = trustedNow(), list?: UserPostPass[]) =>
  (list ?? usePostPasses.getState().passes).filter((p) => isActivePass(p, now))

export function postAccess(postNumber: number, now = trustedNow()): { open: boolean; until?: number } {
  const hits = activePasses(now).filter((p) => p.postIds.includes(postNumber))
  if (!hits.length) return { open: false }
  return { open: true, until: Math.max(...hits.map((p) => p.expiresAt)) }
}

export const isPostOpen = (postNumber: number, now = trustedNow()) => postAccess(postNumber, now).open

export function openSlots(now = trustedNow()) {
  return activePasses(now)
    .map((p) => ({ pass: p, left: Math.max(0, capacityOf(p.type) - p.postIds.length) }))
    .filter((x) => x.left > 0)
}

export const totalOpenSlots = (now = trustedNow()) => openSlots(now).reduce((n, x) => n + x.left, 0)

/** Buy a post pass. Live → Razorpay (server decides the amount, verifies, writes the row). Demo → granted locally. */
export async function buyPostPass(sku: PostPassId, posts: number[]): Promise<'paid' | 'dismissed' | 'demo'> {
  if (IN_APP) throw new Error('Not available in the app')
  if (!validPostIds(sku, posts)) throw new Error('invalid')
  if (!isLive) {
    const cfg = POST_PASS_BY_ID[sku]
    const now = trustedNow()
    usePostPasses.getState().grant({
      id: (globalThis.crypto?.randomUUID?.() ?? `pp-${now}`),
      type: sku,
      postIds: [...posts],
      purchasedAt: now,
      expiresAt: now + cfg.hours * 3600_000,
    })
    return 'demo'
  }
  const { payWithRazorpay } = await import('./payments')
  const r = await payWithRazorpay({ sku, posts }, { email: useApp.getState().user?.email, name: useApp.getState().profile.name })
  if (r === 'paid') await usePostPasses.getState().refresh()
  return r
}

export { POST_PASSES, POST_PASS_BY_ID, type PostPassId }
