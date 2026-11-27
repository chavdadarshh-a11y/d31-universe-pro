/** Product events + privacy-friendly page views. Written to Supabase when configured; otherwise local only. No fake stats. */
import { supabase } from './supabase'
import { useApp } from '../store/app'
import { deviceId } from './referral'
import { GOATCOUNTER } from '../config/access'
import { isLive } from './env'

export type AnalyticsEvent =
  | 'install'
  | 'signup'
  | 'first_workout'
  | 'first_purchase'
  | 'pass_sale'
  | 'membership_sale'
  | 'page_view'
  | 'waitlist'

const LOCAL = 'd31-analytics'
const ONCE = 'd31-analytics-once'
const VID = 'd31-visitor-id'

function onceKey(ev: string) { return `${ONCE}:${ev}` }

function readLocal(): { ev: string; at: number; props?: Record<string, unknown> }[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL) || '[]')
    return Array.isArray(raw) ? raw.slice(-400) : []
  } catch { return [] }
}
function writeLocal(rows: { ev: string; at: number; props?: Record<string, unknown> }[]) {
  try { localStorage.setItem(LOCAL, JSON.stringify(rows.slice(-400))) } catch { /* quota */ }
}

/** Random id that stays on this phone/browser. It is not a name or an email. */
export function visitorId(): string {
  try {
    let id = localStorage.getItem(VID)
    if (id && id.length >= 8) return id
    id = (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
    localStorage.setItem(VID, id)
    return id
  } catch {
    return 'anon'
  }
}

export function deviceType(): 'phone' | 'tablet' | 'computer' {
  if (typeof navigator === 'undefined') return 'computer'
  const ua = navigator.userAgent || ''
  if (/iPad|Tablet|PlayBook/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))) return 'tablet'
  if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) return 'phone'
  try {
    if (window.matchMedia?.('(pointer: coarse) and (max-width: 900px)').matches) return 'phone'
  } catch { /* ignore */ }
  return 'computer'
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

export type PageView = {
  visitor_id: string
  path: string
  referrer: string
  device: 'phone' | 'tablet' | 'computer'
  language: string
  user_id?: string | null
  email?: string | null
  at: number
}

function currentPath() {
  const h = typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '')
  const path = (h.split('?')[0] || '/').trim() || '/'
  return path.startsWith('/') ? path : `/${path}`
}

/** One row per route change. Anonymous visitors are never given a name — only a random id. */
export async function trackPageView(path?: string) {
  if (typeof window === 'undefined') return
  const user = useApp.getState().user
  const signed = user?.provider === 'supabase' ? user : (user?.email ? user : null)
  const row: PageView = {
    visitor_id: visitorId(),
    path: path || currentPath(),
    referrer: document.referrer || '',
    device: deviceType(),
    language: useApp.getState().lang || document.documentElement.lang || 'en',
    user_id: signed?.provider === 'supabase' ? signed.id : null,
    email: signed?.email?.trim().toLowerCase() || null,
    at: Date.now(),
  }
  writeLocal([...readLocal(), { ev: 'page_view', at: row.at, props: { path: row.path, device: row.device, language: row.language } }])

  if (supabase && isLive) {
    try {
      const payload: Record<string, unknown> = {
        visitor_id: row.visitor_id,
        path: row.path,
        referrer: row.referrer.slice(0, 500),
        device: row.device,
        language: row.language,
      }
      if (row.user_id) {
        payload.user_id = row.user_id
        if (row.email) payload.email = row.email
      }
      await supabase.from('page_views').insert(payload)
    } catch { /* stay local */ }
  }

  if (GOATCOUNTER && typeof window !== 'undefined') {
    try {
      const w = window as unknown as { goatcounter?: { count?: (o: { path?: string }) => void } }
      w.goatcounter?.count?.({ path: row.path })
    } catch { /* ignore */ }
  }
}

export function mountGoatCounter() {
  if (!GOATCOUNTER || typeof document === 'undefined') return
  if (document.getElementById('d31-goatcounter')) return
  const s = document.createElement('script')
  s.id = 'd31-goatcounter'
  s.async = true
  s.src = 'https://gc.zgo.at/count.js'
  s.setAttribute('data-goatcounter', GOATCOUNTER)
  document.head.appendChild(s)
}

export type OwnerStats = {
  ok: boolean
  reason?: string
  totals: { pageViews: number; uniqueVisitors: number; signedUp: number; waitlist: number }
  daily: { day: string; visitors: number; views: number }[]
  topPages: { path: string; views: number }[]
  users: { id: string; email: string; name: string; createdAt: string; lastSeen?: string }[]
  source: 'supabase' | 'local'
}

export function localOwnerStats(): OwnerStats {
  const ev = readLocal().filter((r) => r.ev === 'page_view')
  const days = new Map<string, { visitors: Set<string>; views: number }>()
  const pages = new Map<string, number>()
  const vid = visitorId()
  for (const r of ev) {
    const day = new Date(r.at).toISOString().slice(0, 10)
    const slot = days.get(day) ?? { visitors: new Set<string>(), views: 0 }
    slot.visitors.add(vid)
    slot.views++
    days.set(day, slot)
    const path = String(r.props?.path || '/')
    pages.set(path, (pages.get(path) || 0) + 1)
  }
  const daily = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([day, s]) => ({
    day, visitors: s.visitors.size, views: s.views,
  }))
  const topPages = [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([path, views]) => ({ path, views }))
  let wait: { plan?: string }[] = []
  try { const raw = JSON.parse(localStorage.getItem('d31-waitlist') || '[]'); if (Array.isArray(raw)) wait = raw } catch { /* ignore */ }
  return {
    ok: true,
    totals: { pageViews: ev.length, uniqueVisitors: ev.length ? 1 : 0, signedUp: 0, waitlist: Array.isArray(wait) ? wait.length : 0 },
    daily,
    topPages,
    users: [],
    source: 'local',
  }
}

export async function fetchOwnerStats(): Promise<OwnerStats> {
  if (!supabase || !isLive) return localOwnerStats()
  try {
    const { data, error } = await supabase.rpc('owner_site_stats')
    if (error || !data) return { ...localOwnerStats(), ok: false, reason: error?.message || 'no-data' }
    const d = data as Record<string, unknown>
    if (d.ok === false) return { ...localOwnerStats(), ok: false, reason: String(d.reason || 'forbidden') }
    return {
      ok: true,
      totals: {
        pageViews: Number(d.page_views || 0),
        uniqueVisitors: Number(d.unique_visitors || 0),
        signedUp: Number(d.signed_up || 0),
        waitlist: Number(d.waitlist || 0),
      },
      daily: Array.isArray(d.daily) ? d.daily as OwnerStats['daily'] : [],
      topPages: Array.isArray(d.top_pages) ? d.top_pages as OwnerStats['topPages'] : [],
      users: Array.isArray(d.users) ? d.users as OwnerStats['users'] : [],
      source: 'supabase',
    }
  } catch (e) {
    return { ...localOwnerStats(), ok: false, reason: e instanceof Error ? e.message : 'error' }
  }
}
