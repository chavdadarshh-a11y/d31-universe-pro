import { useState } from 'react'
import { Check, Gift, ShieldCheck, Crown, Star } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Header, Sheet } from '../components/ui'
import { PLANS, PLAN_RANK, LAUNCH_SPOTS } from '../lib/plans'
import { useLaunchSpots } from '../components/OfferBanner'
import { isLive } from '../lib/env'
import { navigate } from '../lib/router'
import { claimOffer } from '../lib/cloud'
import { payWithRazorpay } from '../lib/payments'
import { fmtDate } from '../lib/util'
import type { PlanId } from '../types'

const ACCENT: Record<PlanId, string> = { free: '#8b93a3', pro: '#22d3ee', premium: '#f5b942', coaching: '#a78bfa' }
const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString()

export function Membership() {
  const t = useT()
  const s = useApp()
  const plan = effectivePlan(s.membership)
  const spots = useLaunchSpots()
  const [busy, setBusy] = useState<string | null>(null)
  const [demoPlan, setDemoPlan] = useState<PlanId | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const requireUser = () => {
    if (isLive && !s.user) {
      s.showToast(t('signInToBuy'))
      navigate('/auth?next=/membership')
      return false
    }
    return true
  }

  const claim = async (kind: 'launch' | 'trial') => {
    setErr(null)
    if (!isLive) {
      s.set(kind === 'launch'
        ? { membership: { plan: 'pro', until: plusDays(30), source: 'launch_offer' }, launchClaimed: true }
        : { membership: { plan: 'pro', until: plusDays(7), source: 'trial' }, trialUsed: true })
      s.showToast(`${t('demo')} · ${kind === 'launch' ? t('offerClaimed') : t('offerTrial')}`)
      return
    }
    if (!requireUser()) return
    setBusy(kind)
    const r = await claimOffer(kind)
    setBusy(null)
    if (r.ok) s.showToast(kind === 'launch' ? t('offerClaimed') : '✓ Pro · 7 days')
    else setErr(r.reason === 'sold_out' ? t('offerGone') : r.reason ?? 'Error')
  }

  const choose = async (id: PlanId) => {
    setErr(null)
    if (id === 'free') return
    if (!isLive) return setDemoPlan(id)
    if (!requireUser()) return
    setBusy(id)
    try {
      const r = await payWithRazorpay(id as Exclude<PlanId, 'free'>, { email: s.user?.email, name: s.profile.name })
      if (r === 'paid') s.showToast(t('paySuccess', { p: t(`plan_${id}`) }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('payFailed'))
    } finally {
      setBusy(null)
    }
  }

  const offerUsed = s.launchClaimed || s.trialUsed || plan !== 'free'
  const launchOpen = spots > 0

  return (
    <div>
      <Header title={t('membership')} back />
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold/12 text-gold"><Crown size={26} /></span>
        <h1 className="mt-3 text-[24px] font-extrabold tracking-tight">{t('plansTitle')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('plansSub')}</p>
      </div>

      {/* launch offer (single source of copy) */}
      <div className="mt-5 rounded-[20px] border border-gold/30 bg-[#15110a] p-4">
        <div className="flex items-center gap-2"><Gift size={17} className="text-gold" /><span className="label !text-gold">{t('offerTitle')}</span><span className="ml-auto font-mono text-[11px] font-bold text-gold">{launchOpen ? t('offerSpots', { n: spots }) : ''}</span></div>
        <p className="mt-2 text-[14px] leading-snug">{launchOpen ? t('offerBody') : t('offerGone')}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gold" style={{ width: `${(1 - spots / LAUNCH_SPOTS) * 100}%` }} /></div>
        {s.membership.source === 'launch_offer' && plan !== 'free' ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-ok"><Check size={16} /> {t('offerClaimed')}</div>
        ) : !offerUsed ? (
          <Button variant="gold" className="mt-3 w-full" disabled={!!busy} onClick={() => claim(launchOpen ? 'launch' : 'trial')}>
            {launchOpen ? t('offerClaim') : t('offerTrial')}
          </Button>
        ) : null}
      </div>

      {err && <p className="mt-3 rounded-xl border border-bad/30 bg-bad/[0.08] px-3 py-2 text-[13px] text-bad">{err}</p>}

      <div className="mt-4 space-y-3">
        {PLANS.map((p) => {
          const current = plan === p.id
          const lower = PLAN_RANK[p.id] < PLAN_RANK[plan]
          return (
            <div key={p.id} className={`card relative overflow-hidden p-4 ${p.highlight ? 'border-cyan/35' : ''}`}>
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: ACCENT[p.id] }} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[18px] font-extrabold" style={{ color: ACCENT[p.id] }}>{t(`plan_${p.id}`)}</h3>
                    {p.highlight && <Star size={14} className="fill-cyan text-cyan" />}
                    {current && <Badge tone="ok">{t('current')}</Badge>}
                  </div>
                  {current && p.id !== 'free' && s.membership.until && <div className="text-[12px] text-muted">{t('validUntil', { d: fmtDate(s.membership.until, s.lang) })}</div>}
                </div>
                <div className="text-right">
                  <span className="text-[24px] font-extrabold tabular-nums">₹{p.priceInr.toLocaleString('en-IN')}</span>
                  <span className="text-[12px] text-muted">{t('perMonth')}</span>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-[13.5px]"><Check size={15} className="mt-0.5 shrink-0" style={{ color: ACCENT[p.id] }} /> {t(f)}</li>
                ))}
              </ul>
              {p.id !== 'free' && !current && !lower && (
                <Button className="mt-4 w-full" variant={p.highlight ? 'primary' : 'outline'} disabled={!!busy} onClick={() => choose(p.id)}>
                  {busy === p.id ? t('paying') : t('choosePlan', { p: t(`plan_${p.id}`) })}
                </Button>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-dim"><ShieldCheck size={14} /> {t('payWith')}</p>
      <p className="mt-2 text-center text-[11px] text-dim">
        <a className="underline" href="#/legal/terms">{t('terms')}</a> · <a className="underline" href="#/legal/refunds">{t('refunds')}</a>
      </p>

      <Sheet open={!!demoPlan} onClose={() => setDemoPlan(null)} title={demoPlan ? t(`plan_${demoPlan}`) : ''}>
        <p className="rounded-xl border border-gold/25 bg-gold/[0.07] p-3 text-[13.5px] text-gold">{t('demoPay')}</p>
        <Button className="mt-4 w-full" onClick={() => {
          if (!demoPlan) return
          s.set({ membership: { plan: demoPlan, until: plusDays(30), source: 'demo' } })
          s.showToast(t('paySuccess', { p: t(`plan_${demoPlan}`) }))
          setDemoPlan(null)
        }}>{demoPlan ? t('demoPayConfirm', { p: t(`plan_${demoPlan}`) }) : ''}</Button>
      </Sheet>
    </div>
  )
}
