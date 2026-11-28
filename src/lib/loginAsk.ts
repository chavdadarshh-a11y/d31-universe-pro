/**
 * Soft login: nothing in the app needs an account. When a guest saves something worth keeping
 * (a streak, a finished workout, their plan) we show ONE dismissible bottom sheet — at most once
 * every 3 days and never more than 4 times in total. Signed-in users never see it.
 */
import { create } from 'zustand'
import { useApp } from '../store/app'

export type AskReason = 'streak' | 'progress' | 'plan'
const KEY = 'd31-login-ask'
const GAP_MS = 3 * 24 * 3600 * 1000
const MAX = 4

type Seen = { last: number; n: number }
const read = (): Seen => { try { return { last: 0, n: 0, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Seen>) } } catch { return { last: 0, n: 0 } } }

export const useLoginAsk = create<{ reason: AskReason | null; open: (r: AskReason) => void; close: () => void }>()((set) => ({
  reason: null,
  open: (reason) => set({ reason }),
  close: () => set({ reason: null }),
}))

/** Ask softly (respects the cooldown). force = user tapped a "save / sync" control themselves. */
export function askLogin(reason: AskReason, force = false) {
  if (useApp.getState().user) return false
  const s = read()
  if (!force && (s.n >= MAX || Date.now() - s.last < GAP_MS)) return false
  try { localStorage.setItem(KEY, JSON.stringify({ last: Date.now(), n: s.n + 1 })) } catch { /* ignore */ }
  useLoginAsk.getState().open(reason)
  return true
}
