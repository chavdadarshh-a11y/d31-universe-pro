import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
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

/** Small banner when the browser offers "install" (Android/desktop Chrome). iOS users get the hint in Settings → About. */
export function InstallPrompt() {
  const t = useT()
  const ok = useInstallable()
  const dismissed = useSettings((s) => s.installDismissed)
  const set = useSettings((s) => s.set)
  if (!ok || dismissed) return null
  return (
    <div className="neon-border fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-[55] mx-auto flex max-w-[480px] items-center gap-3 rounded-2xl bg-[#0b1420]/95 px-3 py-2.5 backdrop-blur-xl">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="h-9 w-9 rounded-xl" />
      <div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold">{t('installTitle')}</div><div className="text-[11.5px] text-muted">{t('installSub')}</div></div>
      <button onClick={() => void promptInstall()} className="flex h-9 items-center gap-1.5 rounded-xl bg-cyan px-3 text-[13px] font-bold text-[#041016]"><Download size={14} /> {t('install')}</button>
      <button aria-label="Dismiss" onClick={() => set({ installDismissed: true })} className="grid h-8 w-8 place-items-center text-muted"><X size={16} /></button>
    </div>
  )
}
