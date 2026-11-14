import { Gift, BadgeCheck } from 'lucide-react'
import { useT } from '../i18n'
import { useApp } from '../store/app'
import { navigate } from '../lib/router'
import { FOUNDING, spotsLeft, useFoundingCount, useIsFounding } from '../lib/founding'
import { IN_APP } from '../lib/appMode'

/** Real claimed count from Supabase, or null when there is no backend (never invent a number). */
export function useLaunchSpots(): number | null {
  return spotsLeft(useFoundingCount())
}

export function FoundingCard({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const claimed = useFoundingCount()
  const left = spotsLeft(claimed)
  const isMember = useIsFounding()
  const open = left === null || left > 0
  if (isMember && compact) return null
  return (
    <div
      className={`relative scroll-mt-[5.5rem] rounded-[20px] border border-gold/30 bg-gold/[0.06] p-4 ${compact ? 'mt-4' : 'mt-3'}`}
      data-testid="first131-card"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold"><Gift size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="pt-0.5 font-mono text-[11px] font-bold uppercase leading-5 tracking-[0.12em] text-gold">{t('first131')}</span>
            {claimed !== null && (
              <span data-testid="first131-count" className="font-mono text-[11px] font-bold text-gold">
                {t('first131Count', { n: claimed, c: FOUNDING.cap })}
              </span>
            )}
          </div>
          {IN_APP ? (
            <p className="mt-1 text-[14px] leading-snug">{t('first131Badge')} · {t('cmp_early')}</p>
          ) : (
            <p className="mt-1 text-[14px] leading-snug">{t('first131Body')}</p>
          )}
          {isMember && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[11px] font-bold text-gold" data-testid="founding-badge">
              <BadgeCheck size={13} /> {t('first131Badge')}
            </div>
          )}
          {claimed !== null && open && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, Math.max(0, (claimed / FOUNDING.cap) * 100))}%` }} />
            </div>
          )}
          {left !== null && left > 0 && !IN_APP && (
            <div className="mt-1.5 font-mono text-[11px] font-bold text-gold">{t('first131Left', { n: left })}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function OfferBanner() {
  const claimed = useFoundingCount()
  const left = spotsLeft(claimed)
  const plan = useApp((s) => s.membership.plan)
  if (IN_APP) return null
  if (left === 0) return null
  return (
    <button type="button" onClick={() => navigate('/membership')} className="block w-full text-left">
      <FoundingCard compact={plan !== 'free'} />
    </button>
  )
}
