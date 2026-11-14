import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import { useT } from '../i18n'
import { useApp, effectivePlan } from '../store/app'
import { launchSpotsLeft } from '../lib/cloud'
import { navigate } from '../lib/router'
import { LAUNCH_SPOTS } from '../lib/plans'
import { IN_APP } from '../lib/appMode'

/** Real spots left from the server (Supabase RPC), or null when there is no real count.
 *  null means: never show a counter (no fake stats). */
export function useLaunchSpots(): number | null {
  const [spots, setSpots] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    launchSpotsLeft().then((n) => alive && n !== null && setSpots(n))
    return () => {
      alive = false
    }
  }, [])
  return spots
}

export function OfferBanner() {
  const t = useT()
  const membership = useApp((s) => s.membership)
  const spots = useLaunchSpots()
  if (IN_APP || effectivePlan(membership) !== 'free') return null
  return (
    <button onClick={() => navigate('/membership')} className="relative mt-4 block w-full overflow-hidden rounded-[20px] border border-gold/30 bg-[#15110a] p-4 text-left">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold"><Gift size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="label !text-gold">{t('offerTitle')}</span>
            {spots !== null && spots > 0 && <span data-testid="offer-spots" className="font-mono text-[11px] font-bold text-gold">{t('offerSpots', { n: spots })}</span>}
          </div>
          <p className="mt-1 text-[14px] leading-snug text-frost">{t('offerBody')}</p>
          {spots !== null && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, Math.max(0, (1 - spots / LAUNCH_SPOTS) * 100))}%` }} />
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
