/**
 * Daily workout reminder — at most once a day, at the time the user picked, skipped when they already
 * trained or tapped "Workout done". No push server. Honest limits of a website:
 *  1. While the app (tab or installed PWA) is open / in the background it checks every minute, and once
 *     on every open (so a missed time still reminds when you come back the same day).
 *  2. Installed PWA on Chrome Android: Periodic Background Sync lets the service worker check about
 *     twice a day even when the app is closed (the browser decides exactly when).
 *  3. Where Notification Triggers exist, the next reminder is scheduled ahead of time.
 *  iPhone: notifications work only for a Home-Screen web app on iOS 16.4+. Elsewhere we show a clear note.
 * The service worker and the page share the "last shown" day through a small Cache Storage entry,
 * so the two can never both notify on the same day.
 */
import { useEffect } from 'react'
import { useSettings, type Reminder } from '../store/settings'
import { useApp } from '../store/app'
import { dayKey } from './util'
import { translate } from '../i18n'
import { isDoneOn, nextFire } from './habits'
export { nextFire }

const LAST = 'd31-reminder-last'
const BASE = import.meta.env.BASE_URL
const CACHE = BASE.endsWith('/beta/') ? 'd31-beta-reminder' : BASE.endsWith('/preview/') ? 'd31-preview-reminder' : 'd31-reminder'
const CFG_URL = () => `${location.origin}${BASE}__d31_reminder.json`
const ICON = `${BASE}icons/icon-192.png`

export type ReminderSupport = 'ok' | 'ios-browser' | 'unsupported' | 'denied'
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function reminderSupport(): ReminderSupport {
  if (isIOS() && !isStandalone()) return 'ios-browser'
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'ok'
}

export async function askNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export async function notify(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  const opts: NotificationOptions = { body, icon: ICON, badge: ICON, tag: 'd31-reminder', data: { url: `${BASE}#/home` } }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, opts)
    else new Notification(title, opts)
    return true
  } catch {
    try { new Notification(title, opts); return true } catch { return false }
  }
}

type Cfg = Reminder & { last?: string; done?: string; title: string; body: string; icon: string; url: string }
async function readCfg(): Promise<Partial<Cfg> | null> {
  try { const r = await (await caches.open(CACHE)).match(CFG_URL()); return r ? ((await r.json()) as Partial<Cfg>) : null } catch { return null }
}
async function writeCfg(c: Cfg) {
  try { await (await caches.open(CACHE)).put(CFG_URL(), new Response(JSON.stringify(c), { headers: { 'content-type': 'application/json' } })) } catch { /* no Cache Storage */ }
}

const doneToday = () => { const s = useApp.getState(); return isDoneOn(dayKey(), s.sessions, s.doneDays ?? []) }

/** Hand the reminder to the service worker (periodic sync + scheduled trigger where the browser supports them). */
export async function syncReminderToSW(r: Reminder) {
  const lang = useApp.getState().lang
  const prev = await readCfg()
  const last = [prev?.last, localStorage.getItem(LAST) ?? undefined].filter(Boolean).sort().pop()
  await writeCfg({ ...r, last, done: doneToday() ? dayKey() : prev?.done, title: 'D31.UNIVERSE', body: translate(lang, 'reminderBody'), icon: ICON, url: `${BASE}#/home` })
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
  if (!reg) return
  type PS = { register: (tag: string, o: { minInterval: number }) => Promise<void>; unregister: (tag: string) => Promise<void> }
  const ps = (reg as ServiceWorkerRegistration & { periodicSync?: PS }).periodicSync
  if (ps) {
    try {
      if (!r.enabled) await ps.unregister('d31-reminder')
      else {
        const st = await navigator.permissions?.query({ name: 'periodic-background-sync' as PermissionName }).catch(() => null)
        if (!st || st.state === 'granted') await ps.register('d31-reminder', { minInterval: 6 * 3600 * 1000 })
      }
    } catch { /* not installed / not allowed */ }
  }
  // Notification Triggers (scheduled ahead) where available
  const TT = (window as unknown as { TimestampTrigger?: new (t: number) => unknown }).TimestampTrigger
  if (TT && 'showTrigger' in Notification.prototype && Notification.permission === 'granted') {
    try {
      const old = await reg.getNotifications({ tag: 'd31-reminder-next', includeTriggered: true } as GetNotificationOptions)
      old.forEach((n) => n.close())
      if (r.enabled) {
        const next = nextFire(r, new Date(), doneToday())
        if (next) await reg.showNotification('D31.UNIVERSE', { body: translate(lang, 'reminderBody'), icon: ICON, badge: ICON, tag: 'd31-reminder-next', data: { url: `${BASE}#/home` }, showTrigger: new TT(next.getTime()) } as NotificationOptions)
      }
    } catch { /* ignore */ }
  }
}

export function useReminders() {
  const r = useSettings((s) => s.reminder)
  const doneDays = useApp((s) => s.doneDays)
  useEffect(() => { void syncReminderToSW(r) }, [r, doneDays])
  useEffect(() => {
    if (!r.enabled) return
    const tick = async () => {
      const now = new Date()
      if (!r.days.includes(now.getDay())) return
      const [h, m] = r.time.split(':').map(Number)
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return
      const today = dayKey(now)
      if (localStorage.getItem(LAST) === today) return
      const cfg = await readCfg()
      if (cfg?.last === today) { localStorage.setItem(LAST, today); return }
      localStorage.setItem(LAST, today)
      if (cfg) await writeCfg({ ...(cfg as Cfg), last: today })
      if (doneToday()) return
      const lang = useApp.getState().lang
      void notify('D31.UNIVERSE', translate(lang, 'reminderBody'))
    }
    void tick()
    const id = setInterval(() => void tick(), 60_000)
    return () => clearInterval(id)
  }, [r])
}
