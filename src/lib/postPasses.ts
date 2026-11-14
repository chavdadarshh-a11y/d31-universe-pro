/**
 * Portal Pass CREDIT model.
 * Buying Single/Triple/Universe adds unused credits that never expire. The member
 * then chooses posts; each unlock spends 1 credit and starts its OWN timer
 * (24h for Single/Triple, 7 days for Universe). Access includes all 3 languages,
 * videos, PDFs, photos, download and offline play until that post expires.
 *
 * Live: service role writes `portal_credit_lots` after Razorpay verify;
 * spending goes through `unlock_portal_post()` (users cannot edit rows).
 * Demo: kept in localStorage per account.
 */
import { create } from 'zustand'
import { useApp } from '../store/app'
import { supabase } from './supabase'
import { isLive } from './env'
import { IN_APP } from './appMode'
import { trustedNow } from './plans'
import { POST_PASS_BY_ID, POST_PASSES, type PostPassId } from '../config/plans'

export type CreditLot = {
  id: string
  type: PostPassId
  hours: number
  credits: number
  remaining: number
  purchasedAt: number
  orderId?: string
}

export type PortalUnlock = {
  id: string
  postNumber: number
  lotId?: string
  unlockedAt: number
  expiresAt: number
}

/** @deprecated shape kept so older localStorage rows can be migrated */
export type UserPostPass = {
  id: string
  type: PostPassId
  postIds: number[]
  purchasedAt: number
  expiresAt: number
}

export const POST_ID_RE = /^\d{1,6}$/
export const capacityOf = (type: PostPassId) => POST_PASS_BY_ID[type].posts
export const isActiveUnlock = (u: PortalUnlock, now = trustedNow()) => now < u.expiresAt

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

const accountKey = () => useApp.getState().user?.id ?? 'guest'
const lotsKey = (acc = accountKey()) => `d31-portal-lots:${acc}`
const unlocksKey = (acc = accountKey()) => `d31-portal-unlocks:${acc}`
const legacyKey = (acc = accountKey()) => `d31-post-passes:${acc}`

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null')
    return raw ?? fallback
  } catch { return fallback }
}
const writeJson = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* quota */ } }

function migrateLegacy(acc: string): { lots: CreditLot[]; unlocks: PortalUnlock[] } {
  let lots = readJson<CreditLot[]>(lotsKey(acc), [])
  let unlocks = readJson<PortalUnlock[]>(unlocksKey(acc), [])
  const legacy = readJson<UserPostPass[]>(legacyKey(acc), [])
  if (!legacy.length) return { lots, unlocks }
  const seenLot = new Set(lots.map((l) => l.id))
  const seenUn = new Set(unlocks.map((u) => u.id))
  for (const p of legacy) {
    if (!POST_PASS_BY_ID[p.type]) continue
    const cfg = POST_PASS_BY_ID[p.type]
    const used = Array.isArray(p.postIds) ? p.postIds : []
    if (!seenLot.has(p.id)) {
      lots = [...lots, {
        id: p.id,
        type: p.type,
        hours: cfg.hours,
        credits: cfg.posts,
        remaining: Math.max(0, cfg.posts - used.length),
        purchasedAt: p.purchasedAt,
      }]
      seenLot.add(p.id)
    }
    for (const n of used) {
      const uid = `${p.id}:${n}`
      if (seenUn.has(uid)) continue
      unlocks = [...unlocks, { id: uid, postNumber: n, lotId: p.id, unlockedAt: p.purchasedAt, expiresAt: p.expiresAt }]
      seenUn.add(uid)
    }
  }
  writeJson(lotsKey(acc), lots)
  writeJson(unlocksKey(acc), unlocks)
  try { localStorage.removeItem(legacyKey(acc)) } catch { /* ignore */ }
  return { lots, unlocks }
}

function fromLotRow(r: { id: string; pass_type: string; hours: number; credits: number; remaining: number; purchased_at: string; order_id?: string | null }): CreditLot | null {
  if (!POST_PASS_BY_ID[r.pass_type as PostPassId]) return null
  return {
    id: r.id,
    type: r.pass_type as PostPassId,
    hours: r.hours,
    credits: r.credits,
    remaining: r.remaining,
    purchasedAt: new Date(r.purchased_at).getTime(),
    orderId: r.order_id ?? undefined,
  }
}
function fromUnlockRow(r: { id: string; post_number: number; lot_id?: string | null; unlocked_at: string; expires_at: string }): PortalUnlock {
  return {
    id: r.id,
    postNumber: Number(r.post_number),
    lotId: r.lot_id ?? undefined,
    unlockedAt: new Date(r.unlocked_at).getTime(),
    expiresAt: new Date(r.expires_at).getTime(),
  }
}

type State = {
  lots: CreditLot[]
  unlocks: PortalUnlock[]
  loaded: string | null
  refresh: () => Promise<void>
  grantLot: (lot: CreditLot) => void
  grantUnlock: (u: PortalUnlock) => void
  /** Spend one credit to open a post (starts that post's timer). */
  claim: (postNumber: number, type?: PostPassId) => Promise<'claimed' | 'already' | 'none'>
}

export const usePostPasses = create<State>((set, get) => ({
  lots: [],
  unlocks: [],
  loaded: null,
  refresh: async () => {
    const acc = accountKey()
    let { lots, unlocks } = migrateLegacy(acc)
    const uid = useApp.getState().user?.provider === 'supabase' ? useApp.getState().user?.id : null
    if (supabase && uid) {
      const [lr, ur] = await Promise.all([
        supabase.from('portal_credit_lots').select('id, pass_type, hours, credits, remaining, purchased_at, order_id').eq('user_id', uid),
        supabase.from('portal_unlocks').select('id, post_number, lot_id, unlocked_at, expires_at').eq('user_id', uid),
      ])
      if (!lr.error && lr.data) {
        const remote = lr.data.map(fromLotRow).filter((x): x is CreditLot => !!x)
        const byId = new Map(remote.map((p) => [p.id, p]))
        for (const p of lots) if (!byId.has(p.id)) byId.set(p.id, p)
        lots = [...byId.values()]
        writeJson(lotsKey(acc), lots)
      }
      if (!ur.error && ur.data) {
        const remote = ur.data.map(fromUnlockRow)
        const byId = new Map(remote.map((p) => [p.id, p]))
        for (const p of unlocks) if (!byId.has(p.id)) byId.set(p.id, p)
        unlocks = [...byId.values()]
        writeJson(unlocksKey(acc), unlocks)
      }
    }
    set({ lots, unlocks, loaded: acc })
  },
  grantLot: (lot) => {
    const acc = accountKey()
    const { lots } = migrateLegacy(acc)
    const next = [...lots.filter((p) => p.id !== lot.id), lot]
    writeJson(lotsKey(acc), next)
    set({ lots: next })
  },
  grantUnlock: (u) => {
    const acc = accountKey()
    const { unlocks } = migrateLegacy(acc)
    const next = [...unlocks.filter((p) => p.id !== u.id), u]
    writeJson(unlocksKey(acc), next)
    set({ unlocks: next })
  },
  claim: async (postNumber, type) => {
    if (!Number.isInteger(postNumber) || postNumber < 1) return 'none'
    const now = trustedNow()
    const cur = get()
    if (cur.unlocks.some((u) => isActiveUnlock(u, now) && u.postNumber === postNumber)) return 'already'
    const uid = useApp.getState().user?.provider === 'supabase' ? useApp.getState().user?.id : null
    if (supabase && uid) {
      const { data, error } = await supabase.rpc('unlock_portal_post', { p_post: postNumber, p_type: type ?? null })
      const r = data as { ok?: boolean; reason?: string } | null
      if (error || !r?.ok) return r?.reason === 'already' ? 'already' : 'none'
      await get().refresh()
      return r.reason === 'already' ? 'already' : 'claimed'
    }
    const lot = cur.lots
      .filter((l) => l.remaining > 0 && (!type || l.type === type))
      .sort((a, b) => a.hours - b.hours || a.purchasedAt - b.purchasedAt)[0]
    if (!lot) return 'none'
    const cfg = POST_PASS_BY_ID[lot.type]
    const unlock: PortalUnlock = {
      id: (globalThis.crypto?.randomUUID?.() ?? `u-${now}`),
      postNumber,
      lotId: lot.id,
      unlockedAt: now,
      expiresAt: now + cfg.hours * 3600_000,
    }
    const lots = cur.lots.map((l) => l.id === lot.id ? { ...l, remaining: l.remaining - 1 } : l)
    const unlocks = [...cur.unlocks, unlock]
    writeJson(lotsKey(), lots)
    writeJson(unlocksKey(), unlocks)
    set({ lots, unlocks })
    return 'claimed'
  },
}))

export const creditsLeft = (type?: PostPassId, list?: CreditLot[]) =>
  (list ?? usePostPasses.getState().lots).filter((l) => !type || l.type === type).reduce((n, l) => n + Math.max(0, l.remaining), 0)

export const creditsByType = (list?: CreditLot[]) => {
  const src = list ?? usePostPasses.getState().lots
  return POST_PASSES.map((p) => ({ type: p.id, hours: p.hours, left: creditsLeft(p.id, src) }))
}

export const activeUnlocks = (now = trustedNow(), list?: PortalUnlock[]) =>
  (list ?? usePostPasses.getState().unlocks).filter((u) => isActiveUnlock(u, now))

export function postAccess(postNumber: number, now = trustedNow()): { open: boolean; until?: number } {
  const hits = activeUnlocks(now).filter((u) => u.postNumber === postNumber)
  if (!hits.length) return { open: false }
  return { open: true, until: Math.max(...hits.map((u) => u.expiresAt)) }
}

export const isPostOpen = (postNumber: number, now = trustedNow()) => postAccess(postNumber, now).open

/** @deprecated use creditsLeft — leftover open slots from the old pack model equal remaining credits */
export const openSlots = (now = trustedNow()) => {
  void now
  return usePostPasses.getState().lots
    .map((l) => ({ pass: { id: l.id, type: l.type, postIds: [] as number[], purchasedAt: l.purchasedAt, expiresAt: Number.MAX_SAFE_INTEGER } satisfies UserPostPass, left: Math.max(0, l.remaining) }))
    .filter((x) => x.left > 0)
}
export const totalOpenSlots = () => creditsLeft()

export const activePasses = (now = trustedNow()): UserPostPass[] => {
  // compatibility: one synthetic "pass" per lot that still has leftover credits, plus active unlocks grouped
  const lots = usePostPasses.getState().lots
  const unlocks = activeUnlocks(now)
  return lots.filter((l) => l.remaining > 0 || unlocks.some((u) => u.lotId === l.id)).map((l) => ({
    id: l.id,
    type: l.type,
    postIds: unlocks.filter((u) => u.lotId === l.id).map((u) => u.postNumber),
    purchasedAt: l.purchasedAt,
    expiresAt: Math.max(now + 1, ...unlocks.filter((u) => u.lotId === l.id).map((u) => u.expiresAt)),
  }))
}

/** Buy a Portal Pass pack (adds unused credits). Live → Razorpay. Demo → granted locally. Posts are chosen later. */
export async function buyPostPass(sku: PostPassId, posts: number[] = [], opts?: { wallet?: boolean }): Promise<'paid' | 'dismissed' | 'demo'> {
  if (IN_APP) throw new Error('Not available in the app')
  if (!POST_PASS_BY_ID[sku]) throw new Error('invalid')
  if (!isLive) {
    const cfg = POST_PASS_BY_ID[sku]
    const now = trustedNow()
    const id = (globalThis.crypto?.randomUUID?.() ?? `pp-${now}`)
    const lot: CreditLot = { id, type: sku, hours: cfg.hours, credits: cfg.posts, remaining: cfg.posts, purchasedAt: now }
    usePostPasses.getState().grantLot(lot)
    // If the buyer already picked posts (e.g. "open this post"), spend immediately.
    for (const n of posts.slice(0, cfg.posts)) await usePostPasses.getState().claim(n, sku)
    return 'demo'
  }
  const { payWithRazorpay } = await import('./payments')
  const r = await payWithRazorpay({ sku, posts, wallet: !!opts?.wallet }, { email: useApp.getState().user?.email, name: useApp.getState().profile.name })
  if (r === 'paid') {
    await usePostPasses.getState().refresh()
    for (const n of posts.slice(0, POST_PASS_BY_ID[sku].posts)) await usePostPasses.getState().claim(n, sku)
  }
  return r
}

export { POST_PASSES, POST_PASS_BY_ID, type PostPassId }
