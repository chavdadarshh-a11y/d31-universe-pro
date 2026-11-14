/** THE FIRST 131 — real claimed count from Supabase only. null = no backend (hide the counter). */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useApp } from '../store/app'
import { FOUNDING, foundingPrice } from '../config/plans'
import { passStatus } from './plans'

export { FOUNDING, foundingPrice }

export async function foundingClaimedCount(): Promise<number | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('founding_claimed_count')
  if (error || typeof data !== 'number') return null
  return data
}

export function useFoundingCount(): number | null {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    foundingClaimedCount().then((v) => { if (alive) setN(v) })
    return () => { alive = false }
  }, [])
  return n
}

export async function isFoundingMember(): Promise<boolean> {
  const uid = useApp.getState().user?.provider === 'supabase' ? useApp.getState().user?.id : null
  if (!supabase || !uid) return false
  const { data } = await supabase.rpc('is_founding_member')
  return data === true
}

export function useIsFounding(): boolean {
  const [v, setV] = useState(false)
  const uid = useApp((s) => s.user?.id)
  useEffect(() => {
    let alive = true
    isFoundingMember().then((x) => { if (alive) setV(x) })
    return () => { alive = false }
  }, [uid])
  return v
}

/** Discount applies on a new or renewing membership while the founding member's subscription has not lapsed past grace. */
export function foundingDiscountActive(isMember: boolean, membership: { plan: string; until?: string; source?: string }): boolean {
  if (!isMember) return false
  const st = passStatus(membership)
  return st.state === 'active' || st.state === 'grace'
}

export function spotsLeft(claimed: number | null): number | null {
  if (claimed === null) return null
  return Math.max(0, FOUNDING.cap - claimed)
}
