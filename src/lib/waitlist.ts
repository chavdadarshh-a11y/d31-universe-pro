/** Join-waitlist for a paid tier while prices / buying are hidden. */
import { supabase } from './supabase'
import { isLive } from './env'
import { useApp } from '../store/app'
import { visitorId } from './analytics'
import type { PlanId } from '../types'

const KEY = 'd31-waitlist'
export type WaitPlan = Exclude<PlanId, 'free'>

export type WaitEntry = { plan: WaitPlan; email?: string; at: number }

function read(): WaitEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}
function write(rows: WaitEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rows.slice(-50))) } catch { /* quota */ }
}

export function isOnWaitlist(plan: WaitPlan): boolean {
  return read().some((r) => r.plan === plan)
}

export async function joinWaitlist(plan: WaitPlan): Promise<{ ok: boolean; already?: boolean }> {
  const existing = read()
  if (existing.some((r) => r.plan === plan)) return { ok: true, already: true }
  const user = useApp.getState().user
  const email = user?.email?.trim().toLowerCase() || undefined
  const row: WaitEntry = { plan, email, at: Date.now() }
  write([...existing, row])
  if (supabase && isLive) {
    try {
      await supabase.from('plan_waitlist').insert({
        plan,
        email: email ?? null,
        user_id: user?.provider === 'supabase' ? user.id : null,
        visitor_id: visitorId(),
      })
    } catch { /* keep local */ }
  }
  return { ok: true }
}
