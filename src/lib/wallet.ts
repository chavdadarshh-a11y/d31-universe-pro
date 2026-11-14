/** Website-only wallet (referral credits). Hidden in the Android app. */
import { create } from 'zustand'
import { useApp } from '../store/app'
import { supabase } from './supabase'
import { IN_APP } from './appMode'

const accountKey = () => useApp.getState().user?.id ?? 'guest'
const storeKey = (acc = accountKey()) => `d31-wallet:${acc}`

function readLocal(): number {
  try { return Math.max(0, Math.floor(Number(localStorage.getItem(storeKey()) || 0))) } catch { return 0 }
}
const writeLocal = (n: number) => { try { localStorage.setItem(storeKey(), String(Math.max(0, Math.floor(n)))) } catch { /* quota */ } }

type State = { balance: number; loaded: string | null; refresh: () => Promise<void>; credit: (inr: number, reason: string) => void; debit: (inr: number, reason: string) => boolean }

export const useWallet = create<State>((set, get) => ({
  balance: 0,
  loaded: null,
  refresh: async () => {
    const acc = accountKey()
    let bal = readLocal()
    const uid = useApp.getState().user?.provider === 'supabase' ? useApp.getState().user?.id : null
    if (supabase && uid) {
      const { data, error } = await supabase.rpc('wallet_balance')
      if (!error && typeof data === 'number') { bal = data; writeLocal(bal) }
    }
    set({ balance: bal, loaded: acc })
  },
  credit: (inr, _reason) => {
    if (inr <= 0) return
    const bal = get().balance + Math.floor(inr)
    writeLocal(bal)
    set({ balance: bal })
  },
  debit: (inr, _reason) => {
    const n = Math.floor(inr)
    if (n <= 0 || get().balance < n) return false
    const bal = get().balance - n
    writeLocal(bal)
    set({ balance: bal })
    return true
  },
}))

export const walletUsable = () => !IN_APP && useWallet.getState().balance > 0
