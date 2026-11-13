/**
 * 7-day free Platinum trial (length & tier in pricing.json): every NEW account gets it once.
 * Live: the `start_trial` RPC records user_trials.started_at server-side (once per user) and writes the
 * subscription. Demo: recorded per account in localStorage (`d31-trial:<account>`) and in the account's data.
 */
import { useApp } from '../store/app'
import { supabase } from './supabase'
import { TRIAL } from '../config/plans'
import { trustedNow } from './plans'

const trialKey = (acc: string) => `d31-trial:${acc}`

export function trialStartedAt(): string | undefined {
  const st = useApp.getState()
  if (st.trialStartedAt) return st.trialStartedAt
  try { return localStorage.getItem(trialKey(st.user?.id ?? 'guest')) ?? undefined } catch { return undefined }
}

/** Start this account's trial if it never had one and has no paid plan. Returns true when it started. */
export async function startTrialIfNew(): Promise<boolean> {
  const st = useApp.getState()
  if (trialStartedAt()) return false
  if (st.membership.plan !== 'free' && st.membership.source !== 'none') return false
  if (supabase && st.user?.provider === 'supabase') {
    const { data, error } = await supabase.rpc('start_trial')
    const r = data as { ok?: boolean; started_at?: string } | null
    if (error || !r?.ok) return false
    const { refreshMembership } = await import('./cloud')
    await refreshMembership()
    useApp.setState({ trialStartedAt: r.started_at ?? new Date().toISOString(), trialUsed: true })
    return true
  }
  const start = new Date(trustedNow()).toISOString()
  try { localStorage.setItem(trialKey(st.user?.id ?? 'guest'), start) } catch { /* ignore */ }
  useApp.setState({
    trialStartedAt: start,
    trialUsed: true,
    membership: { plan: TRIAL.plan, until: new Date(trustedNow() + TRIAL.days * 86400000).toISOString(), source: 'trial' },
  })
  return true
}

/** Day n of the trial (1-based) or null when not on the trial. */
export function trialDay(now = trustedNow()): number | null {
  const st = useApp.getState()
  if (st.membership.source !== 'trial' || !st.membership.until) return null
  const end = new Date(st.membership.until).getTime()
  if (now >= end) return null
  return Math.min(TRIAL.days, Math.floor((now - (end - TRIAL.days * 86400000)) / 86400000) + 1)
}

/** DEMO only: jump to a trial day (1..days) or past the end (0) to test what happens. */
export function demoTrialDay(day: number) {
  const now = trustedNow()
  const start = day > 0 ? now - (day - 1) * 86400000 - 60_000 : now - TRIAL.days * 86400000 - 60_000
  useApp.setState({
    trialStartedAt: new Date(start).toISOString(),
    trialUsed: true,
    membership: { plan: TRIAL.plan, until: new Date(start + TRIAL.days * 86400000).toISOString(), source: 'trial' },
  })
}
