/** Basic product events. Written to Supabase when configured; otherwise local only. No fake stats. */
import { supabase } from './supabase'
import { useApp } from '../store/app'
import { deviceId } from './referral'

export type AnalyticsEvent =
  | 'install'
  | 'signup'
  | 'first_workout'
  | 'first_purchase'
  | 'pass_sale'
  | 'membership_sale'

const LOCAL = 'd31-analytics'
const ONCE = 'd31-analytics-once'

function onceKey(ev: string) { return `${ONCE}:${ev}` }

function readLocal(): { ev: string; at: number; props?: Record<string, unknown> }[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL) || '[]')
    return Array.isArray(raw) ? raw.slice(-200) : []
  } catch { return [] }
}
function writeLocal(rows: { ev: string; at: number; props?: Record<string, unknown> }[]) {
  try { localStorage.setItem(LOCAL, JSON.stringify(rows.slice(-200))) } catch { /* quota */ }
}

export async function track(event: AnalyticsEvent, props: Record<string, unknown> = {}, opts?: { once?: boolean }) {
  if (opts?.once) {
    try { if (localStorage.getItem(onceKey(event))) return; localStorage.setItem(onceKey(event), '1') } catch { /* ignore */ }
  }
  const row = { ev: event, at: Date.now(), props }
  writeLocal([...readLocal(), row])
  const uid = useApp.getState().user?.provider === 'supabase' ? useApp.getState().user?.id : null
  if (!supabase || !uid) return
  try {
    await supabase.from('analytics_events').insert({
      user_id: uid,
      event,
      props,
      device_hash: deviceId(),
    })
  } catch { /* stay local */ }
}

export function trackInstall() { void track('install', {}, { once: true }) }
export function trackSignup() { void track('signup', {}, { once: true }) }
export function localEvents() { return readLocal() }
