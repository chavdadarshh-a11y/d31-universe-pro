/** Referral link (?ref=CODE), attach on signup, stats. Wallet rewards are granted server-side on first paid purchase. */
import { create } from 'zustand'
import { supabase } from './supabase'
import { APP_URL } from '../config/site'
import { useApp } from '../store/app'
import { REFERRAL } from '../config/plans'

const REF_HOLD = 'd31-ref-code'
const DEVICE = 'd31-device-id'

export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE)
    if (!id) { id = globalThis.crypto?.randomUUID?.() ?? `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem(DEVICE, id) }
    return id
  } catch { return 'unknown' }
}

export function captureReferralFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search)
    const h = window.location.hash
    const hq = h.includes('?') ? new URLSearchParams(h.slice(h.indexOf('?') + 1)) : new URLSearchParams()
    const code = (q.get('ref') || hq.get('ref') || '').trim().toUpperCase()
    if (code) localStorage.setItem(REF_HOLD, code)
  } catch { /* ignore */ }
}

export function pendingReferral(): string | null {
  try { return (localStorage.getItem(REF_HOLD) || '').trim().toUpperCase() || null } catch { return null }
}

export function referralUrl(code: string) {
  const base = APP_URL.startsWith('http') ? APP_URL : `${window.location.origin}${window.location.pathname || '/'}` // config/site.ts
  return `${base.replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}`
}

type Stats = { code: string | null; attached: number; rewarded: number; max: number; rewardInr: number }

type State = {
  stats: Stats
  loaded: boolean
  refresh: () => Promise<void>
  attachPending: () => Promise<void>
}

const empty = (): Stats => ({ code: null, attached: 0, rewarded: 0, max: REFERRAL.maxPerMember, rewardInr: REFERRAL.rewardInr })

export const useReferral = create<State>((set, get) => ({
  stats: empty(),
  loaded: false,
  refresh: async () => {
    const uid = useApp.getState().user?.provider === 'supabase' ? useApp.getState().user?.id : null
    if (supabase && uid) {
      await supabase.rpc('register_device', { p_device: deviceId() })
      const { data } = await supabase.rpc('my_referral_stats')
      const r = data as Partial<Stats> | null
      let code = (r?.code as string) || null
      if (!code) {
        const { data: c } = await supabase.rpc('my_referral_code')
        if (typeof c === 'string') code = c
      }
      set({
        stats: {
          code,
          attached: Number(r?.attached ?? 0),
          rewarded: Number(r?.rewarded ?? 0),
          max: Number(r?.max ?? REFERRAL.maxPerMember),
          rewardInr: Number((r as { reward_inr?: number } | null)?.reward_inr ?? r?.rewardInr ?? REFERRAL.rewardInr),
        },
        loaded: true,
      })
      return
    }
    // demo: a stable local code for this account, no fake reward counts
    const acc = useApp.getState().user?.id ?? 'guest'
    let code: string | null = null
    try {
      const k = `d31-ref-code:${acc}`
      code = localStorage.getItem(k)
      if (!code) {
        code = `D31${acc.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()}${(Math.abs(hash(acc)) % 9000 + 1000)}`.slice(0, 10)
        localStorage.setItem(k, code)
      }
    } catch { /* ignore */ }
    set({ stats: { ...empty(), code }, loaded: true })
  },
  attachPending: async () => {
    const code = pendingReferral()
    if (!code) return
    const uid = useApp.getState().user?.provider === 'supabase' ? useApp.getState().user?.id : null
    if (supabase && uid) {
      await supabase.rpc('attach_referral', { p_code: code, p_device: deviceId() })
      try { localStorage.removeItem(REF_HOLD) } catch { /* ignore */ }
      await get().refresh()
    }
  },
}))

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
