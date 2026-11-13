/**
 * Local workout reminders. No server, no push service: while the app (or installed PWA) is open or
 * in the background, it checks once a minute and shows a notification at the chosen time on the
 * chosen days — skipped if you already trained today. Fully scheduled reminders while the app is
 * closed need the Play Store build (Capacitor Local Notifications).
 */
import { useEffect } from 'react'
import { useSettings } from '../store/settings'
import { useApp } from '../store/app'
import { dayKey } from './util'
import { translate } from '../i18n'

const LAST = 'd31-reminder-last'

export async function askNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export async function notify(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  const opts = { body, icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, badge: `${import.meta.env.BASE_URL}icons/icon-192.png`, tag: 'd31-reminder' }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, opts)
    else new Notification(title, opts)
    return true
  } catch {
    try { new Notification(title, opts); return true } catch { return false }
  }
}

export function useReminders() {
  const r = useSettings((s) => s.reminder)
  useEffect(() => {
    if (!r.enabled) return
    const tick = () => {
      const now = new Date()
      if (!r.days.includes(now.getDay())) return
      const [h, m] = r.time.split(':').map(Number)
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return
      const today = dayKey(now)
      if (localStorage.getItem(LAST) === today) return
      const trained = useApp.getState().sessions.some((s) => dayKey(new Date(s.startedAt)) === today)
      localStorage.setItem(LAST, today)
      if (trained) return
      const lang = useApp.getState().lang
      void notify('D31.UNIVERSE', translate(lang, 'reminderBody'))
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [r])
}
