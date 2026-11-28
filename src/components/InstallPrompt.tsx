import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Sheet, Button } from './ui'
import { IN_TWA } from '../lib/appMode'
import { useT } from '../i18n'
import { useSettings } from '../store/settings'

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: BIPEvent | null = null
const subs = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; subs.forEach((f) => f()) })
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach((f) => f()) })
}

export async function promptInstall() {
  if (!deferred) return false
  await deferred.prompt()
  const r = await deferred.userChoice
  deferred = null
  subs.forEach((f) => f())
  return r.outcome === 'accepted'
}

export function useInstallable() {
  const [ok, setOk] = useState(!!deferred)
  useEffect(() => {
    const f = () => setOk(!!deferred)
    subs.add(f)
    return () => { subs.delete(f) }
  }, [])
  return ok
}

/* Visits: counted once per browser session. The banner appears from the 3rd visit (after 2 earlier ones),
 * "Not now" hides it for 14 days, and after 3 dismissals it never comes back. Hidden when already installed
 * (standalone) and inside the Play Store app. */
const VISITS = 'd31-visits'
const SNOOZE = 'd31-install-snooze'
const MIN_VISITS = 3
const SNOOZE_MS = 14 * 24 * 3600 * 1000
export function countVisit() {
  try {
    if (sessionStorage.getItem('d31-visit-counted')) return
    sessionStorage.setItem('d31-visit-counted', '1')
    localStorage.setItem(VISITS, String((Number(localStorage.getItem(VISITS)) || 0) + 1))
  } catch { /* storage blocked */ }
}
if (typeof window !== 'undefined') countVisit()
const visits = () => { try { return Number(localStorage.getItem(VISITS)) || 0 } catch { return 0 } }
type Snooze = { until: number; n: number }
const readSnooze = (): Snooze => { try { return { until: 0, n: 0, ...(JSON.parse(localStorage.getItem(SNOOZE) || '{}') as Partial<Snooze>) } } catch { return { until: 0, n: 0 } } }
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** "Home screen pe add karo" — Android/desktop Chrome: real install prompt. iPhone Safari: step-by-step sheet. */
export function InstallPrompt() {
  const t = useT()
  const ok = useInstallable()
  const dismissed = useSettings((s) => s.installDismissed)
  const [snooze, setSnooze] = useState(readSnooze)
  const [how, setHow] = useState(false)
  const ios = isIOS()
  if (IN_TWA || standalone() || dismissed || visits() < MIN_VISITS) return null
  if (snooze.n >= 3 || Date.now() < snooze.until) return null
  if (!ok && !ios) return null
  const later = () => { const s = { until: Date.now() + SNOOZE_MS, n: snooze.n + 1 }; try { localStorage.setItem(SNOOZE, JSON.stringify(s)) } catch { /* ignore */ } setSnooze(s) }
  return (
    <>
      <div data-testid={ios ? 'install-ios' : 'install-banner'} className="neon-border relative z-[5] mt-2 flex items-center gap-3 rounded-2xl bg-[#0b1420]/95 px-3 py-2.5 backdrop-blur-xl">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="h-9 w-9 rounded-xl" />
        <div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold">{t('inTitle')}</div><div className="text-[11.5px] text-muted">{t('inSub')}</div></div>
        {ios
          ? <button data-testid="install-how" onClick={() => setHow(true)} className="flex h-9 items-center gap-1.5 rounded-xl bg-gold px-3 text-[13px] font-bold text-[#1a1203]"><Share size={14} /> {t('inHow')}</button>
          : <button data-testid="install-go" onClick={() => void promptInstall()} className="flex h-9 items-center gap-1.5 rounded-xl bg-cyan px-3 text-[13px] font-bold text-[#041016]"><Download size={14} /> {t('install')}</button>}
        <button aria-label={t('lsLater')} data-testid="install-later" onClick={later} className="grid h-8 w-8 place-items-center text-muted"><X size={16} /></button>
      </div>
      <Sheet open={how} onClose={() => setHow(false)} title={t('inTitle')}>
        <ol data-testid="install-ios-steps" className="space-y-3 text-[14px]">
          {[t('inIos1'), t('inIos2'), t('inIos3')].map((x, i) => (
            <li key={i} className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold/50 bg-gold/10 font-mono text-[13px] font-bold text-gold">{i + 1}</span><span className="pt-0.5">{x}</span></li>
          ))}
        </ol>
        <Button className="mt-5 w-full" onClick={() => setHow(false)}>{t('inGotIt')}</Button>
      </Sheet>
    </>
  )
}
