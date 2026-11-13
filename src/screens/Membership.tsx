import { useState } from 'react'
import { Check, Gift, ShieldCheck, Crown, Minus, FlaskConical, Lock } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Header } from '../components/ui'
import { PLANS, PLAN_RANK, LAUNCH_SPOTS, PLAN_BY_ID } from '../lib/plans'
import { TRIAL_DAYS } from '../config/plans'
import { useLaunchSpots } from '../components/OfferBanner'
import { isLive } from '../lib/env'
import { navigate } from '../lib/router'
import { claimOffer } from '../lib/cloud'
import { payWithRazorpay } from '../lib/payments'
import { fmtDate } from '../lib/util'
import { PROGRAMS } from '../data/programs'
import type { PlanId } from '../types'
import type { StringKey } from '../i18n/strings'

const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString()
const progCount = (p: PlanId) => PROGRAMS.filter((x) => x.plan === p).length

type Cell = boolean | string
/** Feature comparison — every row is something the app actually does and gates (see lib/entitlements.ts). */
function rows(t: (k: StringKey, v?: Record<string, string | number>) => string): { label: string; cells: [Cell, Cell, Cell] }[] {
  const nFree = progCount('free'), nPro = progCount('pro'), nPlat = progCount('platinum')
  return [
    { label: t('cmp_library'), cells: [true, true, true] },
    { label: t('cmp_logging'), cells: [true, true, true] },
    { label: t('cmp_tracking'), cells: [true, true, true] },
    { label: t('cmp_counter'), cells: [true, true, true] },
    { label: t('cmp_programs'), cells: [String(nFree), String(nFree + nPro), String(nFree + nPro + nPlat)] },
    { label: t('cmp_ai'), cells: [String(PLAN_BY_ID.free.analyses), String(PLAN_BY_ID.pro.analyses), String(PLAN_BY_ID.platinum.analyses)] },
    { label: t('cmp_photos'), cells: [false, true, true] },
    { label: t('cmp_platinumPaths'), cells: [false, false, true] },
    { label: t('cmp_pdf'), cells: [false, false, true] },
    { label: t('cmp_history'), cells: [false, false, true] },
    { label: t('cmp_offline'), cells: [false, false, true] },
    { label: t('cmp_knowledgeDl'), cells: [false, false, true] },
    { label: t('cmp_backup'), cells: [true, true, true] },
  ]
}

export function Membership() {
  const t = useT()
  const s = useApp()
  const plan = effectivePlan(s.membership)
  const spots = useLaunchSpots()
  const [busy, setBusy] = useState<string | null>(null)
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
        : { membership: { plan: 'pro', until: plusDays(TRIAL_DAYS), source: 'trial' }, trialUsed: true })
      s.showToast(`${t('demo')} · ${kind === 'launch' ? t('offerClaimed') : t('offerTrial')}`)
      return
    }
    if (!requireUser()) return
    setBusy(kind)
    const r = await claimOffer(kind)
    setBusy(null)
    if (r.ok) s.showToast(kind === 'launch' ? t('offerClaimed') : `✓ Pro · ${TRIAL_DAYS} days`)
    else setErr(r.reason === 'sold_out' ? t('offerGone') : r.reason ?? 'Error')
  }

  const choose = async (id: PlanId) => {
    setErr(null)
    if (id === 'free' || !isLive) return
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

  /** DEMO only: preview what each tier unlocks. Clearly labelled; not a purchase. */
  const preview = (id: PlanId) => {
    s.set({ membership: id === 'free' ? { plan: 'free', source: 'none' } : { plan: id, until: plusDays(30), source: 'demo' } })
    s.showToast(`${t('demo')} · ${t(`plan_${id}`)}`)
  }

  const offerUsed = s.launchClaimed || s.trialUsed || plan !== 'free'
  const launchOpen = spots === null || spots > 0
  const table = rows(t)

  return (
    <div>
      <Header title={t('membership')} back />
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold/12 text-gold"><Crown size={26} /></span>
        <h1 className="mt-3 text-[24px] font-extrabold tracking-tight">{t('plansTitle')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('plansSub')}</p>
      </div>

      {!isLive && (
        <div className="mt-4 rounded-2xl border border-violet/30 bg-violet/[0.06] p-3" data-testid="demo-tiers">
          <div className="flex items-center gap-2 text-[12px] font-bold text-violet"><FlaskConical size={14} /> {t('demoPreview')}</div>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-white/10 p-1">
            {PLANS.map((p) => (
              <button key={p.id} data-testid={`demo-${p.id}`} onClick={() => preview(p.id)} className={`h-9 rounded-lg text-[12.5px] font-bold ${plan === p.id ? 'bg-neon-static text-[#05080f]' : 'text-muted'}`}>{t(`plan_${p.id}`)}</button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted">{t('demoPreviewNote')}</p>
        </div>
      )}

      {/* launch offer */}
      <div className="mt-4 rounded-[20px] border border-gold/30 bg-gold/[0.05] p-4">
        <div className="flex items-center gap-2"><Gift size={17} className="text-gold" /><span className="label !text-gold">{t('offerTitle')}</span>{spots !== null && spots > 0 && <span data-testid="offer-spots" className="ml-auto font-mono text-[11px] font-bold text-gold">{t('offerSpots', { n: spots })}</span>}</div>
        <p className="mt-2 text-[14px] leading-snug">{launchOpen ? t('offerBody') : t('offerGone')}</p>
        {spots !== null && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, Math.max(0, (1 - spots / LAUNCH_SPOTS) * 100))}%` }} /></div>}
        {s.membership.source === 'launch_offer' && plan !== 'free' ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-ok"><Check size={16} /> {t('offerClaimed')}</div>
        ) : !offerUsed ? (
          <Button variant="gold" className="mt-3 w-full" disabled={!!busy} onClick={() => claim(launchOpen ? 'launch' : 'trial')}>
            {launchOpen ? t('offerClaim') : t('offerTrial')}
          </Button>
        ) : null}
      </div>

      {err && <p className="mt-3 rounded-xl border border-bad/30 bg-bad/[0.08] px-3 py-2 text-[13px] text-bad">{err}</p>}

      {/* tier cards */}
      <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {PLANS.map((p) => {
          const current = plan === p.id
          return (
            <div key={p.id} data-testid={`tier-${p.id}`} className={`card relative w-[74%] shrink-0 snap-center overflow-hidden p-4 ${p.id === 'platinum' ? 'platinum-card' : ''} ${p.highlight ? 'border-cyan/40' : ''}`}>
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: p.accent }} />
              <div className="flex items-center gap-2">
                <h3 className={`text-[19px] font-extrabold ${p.id === 'platinum' ? 'text-platinum' : ''}`} style={p.id === 'platinum' ? undefined : { color: p.accent }}>{t(`plan_${p.id}`)}</h3>
                {p.highlight && <Badge tone="cyan">{t('popular')}</Badge>}
                {current && <Badge tone="ok">{t('current')}</Badge>}
              </div>
              <div className="mt-2">
                <span className="text-[28px] font-extrabold tabular-nums">₹{p.priceInr.toLocaleString('en-IN')}</span>
                <span className="ml-1 text-[12px] text-muted">{p.id === 'free' ? t('forever') : t('per30')}</span>
              </div>
              <div className="mt-2 text-[12px] text-muted">{t('aiChecksN', { n: p.analyses })}</div>
              {current && p.id !== 'free' && s.membership.until && <div className="mt-1 text-[11.5px] text-muted">{t('validUntil', { d: fmtDate(s.membership.until, s.lang) })}</div>}
            </div>
          )
        })}
      </div>

      {/* comparison */}
      <h2 className="label mt-5">{t('features')}</h2>
      <div className="card mt-2 overflow-hidden p-0" data-testid="compare-table">
        <div className="grid grid-cols-[1fr_52px_52px_60px] items-center gap-1 border-b border-white/[0.07] px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-wider text-muted">
          <span />
          {PLANS.map((p) => <span key={p.id} className={`text-center ${p.id === 'platinum' ? 'text-platinum' : ''}`} style={p.id === 'platinum' ? undefined : { color: p.accent }}>{t(`plan_${p.id}`)}</span>)}
        </div>
        {table.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_52px_52px_60px] items-center gap-1 border-b border-white/[0.04] px-3 py-2.5 last:border-0">
            <span className="text-[12.5px] leading-snug">{r.label}</span>
            {r.cells.map((c, i) => (
              <span key={i} className="grid place-items-center">
      {c === true ? <Check size={16} className={i === 2 ? 'text-violet' : 'text-cyan'} /> : c === false ? <Minus size={14} className="text-dim" /> : <span className="font-mono text-[12px] font-bold">{c}</span>}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-dim">{t('aiNote')}</p>

      {/* buy buttons */}
      <div className="mt-4 space-y-2">
        {PLANS.filter((p) => p.id !== 'free').map((p) => {
          const current = plan === p.id
          const lower = PLAN_RANK[p.id] < PLAN_RANK[plan]
          if (lower) return null
          return (
            <Button key={p.id} className="w-full" variant={p.id === 'platinum' ? 'outline' : 'primary'} disabled={!!busy || !isLive} onClick={() => choose(p.id)} data-testid={`buy-${p.id}`}>
              {!isLive ? <Lock size={15} /> : <Crown size={15} />}
              {current ? `${t('renew')} ${t(`plan_${p.id}`)} · ₹${p.priceInr}` : busy === p.id ? t('paying') : `${t('choosePlan', { p: t(`plan_${p.id}`) })} · ₹${p.priceInr}`}
            </Button>
          )
        })}
        {!isLive && <p className="text-center text-[12px] text-gold">{t('paymentsAtLaunch')}</p>}
        {plan !== 'free' && s.membership.until && <p className="text-center text-[12px] text-muted">{t('validUntil', { d: fmtDate(s.membership.until, s.lang) })}{s.membership.source === 'demo' ? ` · ${t('demo')}` : ''}</p>}
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-dim"><ShieldCheck size={14} /> {t('payWith')}</p>
      <p className="mt-2 text-center text-[11px] text-dim">
        <a className="underline" href="#/legal/terms">{t('terms')}</a> · <a className="underline" href="#/legal/refunds">{t('refunds')}</a>
      </p>
    </div>
  )
}
