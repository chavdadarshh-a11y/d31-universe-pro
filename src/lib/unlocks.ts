/**
 * À-la-carte unlocks: a single Knowledge video (₹19), a single PDF (₹9) or a mini pack
 * (3 videos + 3 PDFs, ₹49 — the buyer picks the items). Prices live in pricing.json.
 *
 * An unlock key names ONE item in every language: `<post>:<video|pdf>:<n>` where n is the item's
 * position in the post (the Hindi / Gujarati versions sit at the same position as the English one).
 * Unlocked forever for that account. Live: the server writes `user_unlocks` after a verified payment
 * (users can only read their own rows — RLS). Demo: kept in localStorage per account.
 */
import { create } from 'zustand'
import { useApp } from '../store/app'
import { supabase } from './supabase'
import { isLive } from './env'
import { UNLOCKS, type UnlockSku } from '../config/plans'
import { IN_APP } from './appMode'

export type UnlockKind = 'video' | 'pdf'
export const unlockKey = (post: number, kind: UnlockKind, n: number) => `${post}:${kind}:${n}`
export const kindOf = (key: string): UnlockKind => (key.split(':')[1] === 'pdf' ? 'pdf' : 'video')
export const UNLOCK_KEY_RE = /^\d{1,6}:(video|pdf):\d{1,3}$/

const accountKey = () => useApp.getState().user?.id ?? 'guest'
const storeKey = (acc = accountKey()) => `d31-unlocks:${acc}`
const readLocal = (): string[] => { try { return JSON.parse(localStorage.getItem(storeKey()) || '[]') } catch { return [] } }
const writeLocal = (k: string[]) => { try { localStorage.setItem(storeKey(), JSON.stringify(k)) } catch { /* quota */ } }

type UnlockState = {
  keys: Record<string, true>
  /** items picked for a mini pack (not bought yet) */
  pack: string[]
  loaded: string | null
  refresh: () => Promise<void>
  /** DEMO / after server confirmation: record unlocked keys for this account */
  grant: (keys: string[]) => void
  togglePick: (key: string) => 'added' | 'removed' | 'full'
  clearPack: () => void
}

export const useUnlocks = create<UnlockState>((set, get) => ({
  keys: {},
  pack: [],
  loaded: null,
  refresh: async () => {
    const acc = accountKey()
    let keys = readLocal()
    const uid = useApp.getState().user?.provider === 'supabase' ? useApp.getState().user?.id : null
    if (supabase && uid) {
      const { data, error } = await supabase.from('user_unlocks').select('item_key').eq('user_id', uid)
      if (!error && data) { keys = Array.from(new Set([...keys, ...data.map((r) => r.item_key as string)])); writeLocal(keys) }
    }
    set({ keys: Object.fromEntries(keys.map((k) => [k, true as const])), loaded: acc, pack: acc === get().loaded ? get().pack : [] })
  },
  grant: (add) => {
    const keys = Array.from(new Set([...readLocal(), ...add.filter((k) => UNLOCK_KEY_RE.test(k))]))
    writeLocal(keys)
    set({ keys: Object.fromEntries(keys.map((k) => [k, true as const])), pack: get().pack.filter((k) => !add.includes(k)) })
  },
  togglePick: (key) => {
    const pack = get().pack
    if (pack.includes(key)) { set({ pack: pack.filter((k) => k !== key) }); return 'removed' }
    const kind = kindOf(key)
    const max = kind === 'video' ? UNLOCKS.pack.videos : UNLOCKS.pack.pdfs
    if (pack.filter((k) => kindOf(k) === kind).length >= max) return 'full'
    set({ pack: [...pack, key] })
    return 'added'
  },
  clearPack: () => set({ pack: [] }),
}))

export const useUnlocked = (key: string | undefined) => useUnlocks((s) => (key ? !!s.keys[key] : false))
export const isUnlocked = (key: string | undefined) => (key ? !!useUnlocks.getState().keys[key] : false)

/** Validate what a purchase would unlock (the server repeats this check). */
export function validItems(sku: UnlockSku, items: string[]): boolean {
  if (!items.length || items.some((k) => !UNLOCK_KEY_RE.test(k)) || new Set(items).size !== items.length) return false
  if (sku === 'video') return items.length === 1 && kindOf(items[0]) === 'video'
  if (sku === 'pdf') return items.length === 1 && kindOf(items[0]) === 'pdf'
  return items.filter((k) => kindOf(k) === 'video').length <= UNLOCKS.pack.videos && items.filter((k) => kindOf(k) === 'pdf').length <= UNLOCKS.pack.pdfs
}

/** Buy an unlock. Live → Razorpay (server decides the amount, verifies, writes user_unlocks). Demo → payments are off. */
export async function buyUnlock(sku: UnlockSku, items: string[]): Promise<'paid' | 'dismissed' | 'demo'> {
  if (IN_APP) throw new Error('Not available in the app')
  if (!validItems(sku, items)) throw new Error('invalid')
  if (!isLive) return 'demo'
  const { payWithRazorpay } = await import('./payments')
  const r = await payWithRazorpay({ sku, items }, { email: useApp.getState().user?.email, name: useApp.getState().profile.name })
  if (r === 'paid') await useUnlocks.getState().refresh()
  return r
}
