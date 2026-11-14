import { useState } from 'react'
import { Beam } from '../components/Beam'
import { Check, Gift, ShieldCheck, Crown, Minus, FlaskConical, Lock } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Header } from '../components/ui'
import { PLANS, PLAN_RANK, LAUNCH_SPOTS, PLAN_BY_ID, passStatus, trustedNow } from '../lib/plans'
import { PLAN_IDS, KNOWLEDGE_LANGS, POPULAR_PASS, TRIAL, UNLOCKS, passesFor, perDay, perMonth, type PassId } from '../config/plans'
import { demoTrialDay, startTrialIfNew, trialDay, trialStartedAt } from '../lib/trial'
import { can, type Feature } from '../lib/entitlements'
import { useLaunchSpots } from '../components/OfferBanner'
import { isLive } from '../lib/env'
import { navigate } from '../lib/router'
import { claimOffer } from '../lib/cloud'
import { payWithRazorpay } from '../lib/payments'
import { fmtDate } from '../lib/util'
import { PROGRAMS } from '../data/programs'
import type { PlanId } from '../types'
import type { StringKey } from '../i18n/strings'
import { IN_APP } from '../lib/appMode'
import { ActivePassList, PostPassButtons, showsPostPasses } from '../components/PostPasses'

const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString()
const progCount = (p: PlanId) => PROGRAMS.filter((x) => x.plan === p).length

type Cell = boolean | string
type Row4 = { label: string; cells: [Cell, Cell, Cell, Cell] }
/** Feature comparison — every row is something the app actually does and gates (see lib/entitlements.ts). */
function rows(t: (k: StringKey, v?: Record<string, string | number>) => string): Row4[] {
  const nFree = progCount('free'), nPro = progCount('pro'), nAll = PROGRAMS.length
  const a = (id: PlanId) => String(PLAN_BY_ID[id].analyses)
  const by = (f: Feature): [Cell, Cell, Cell, Cell] => PLAN_IDS.map((p) => can(f, p)) as [Cell, Cell, Cell, Cell]
  return [
    { label: t('cmp_library'), cells: [true, true, true, true] },
    { label: t('cmp_logging'), cells: [true, true, true, true] },
    { label: t('cmp_tracking'), cells: [true, true, true, true] },
    { label: t('cmp_counter'), cells: [true, true, true, true] },
    { label: t('cmp_player'), cells: [true, true, true, true] },
    { label: t('cmp_programs'), cells: [String(nFree), String(nFree + nPro), String(nAll), String(nAll)] },
    { label: t('cmp_ai'), cells: [a('free'), a('pro'), a('gold'), a('platinum')] },
    { label: t('cmp_photos'), cells: by('photos.compare') },
    { label: t('cmp_platinumPaths'), cells: by('programs.platinum') },
    { label: t('cmp_pdf'), cells: by('download.programPdf') },
    { label: t('cmp_history'), cells: by('download.history') },
    { label: t('cmp_offline'), cells: by('download.clips') },
    { label: t('cmp_knowledgeDl'), cells: by('downloads.inApp') },
    { label: t('cmp_langs'), cells: PLAN_IDS.map((p) => (KNOWLEDGE_LANGS[p].length >= 3 ? '3' : KNOWLEDGE_LANGS[p].join('+').toUpperCase())) as [Cell, Cell, Cell, Cell] },
    { label: t('cmp_alacarte'), cells: [true, true, true, true] },
    { label: t('cmp_backup'), cells: by('download.backup') },
  ]
}

export function Membership() {
  const t = useT()
  const s = useApp()
  const plan = effectivePlan(s.membership)
  const status = passStatus(s.membership)
  const spots = useLaunchSpots()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [platPass, setPlatPass] = useState<PassId>(POPULAR_PASS && POPULAR_PASS.startsWith('platinum') ? POPULAR_PASS : 'platinum_30')
  const locale = s.lang === 'en' ? 'en-IN' : `${s.lang}-IN`
  const inr = (x: number, d = 0) => x.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })

  const requireUser = () => {
    if (isLive && !s.user) {
      s.showToast(IN_APP ? t('memSignIn') : t('signInToBuy'))
      navigate('/auth?next=/membership')
      return false
    }
    return true
  }

  const claimLaunch = async () => {
    setErr(null)
    if (!requireUser()) return
    setBusy('launch')
    const r = await claimOffer('launch')
    setBusy(null)
    if (r.ok) s.showToast(t('offerClaimed'))
    else setErr(r.reason === 'sold_out' ? t('offerGone') : r.reason ?? 'Error')
  }

  const startTrial = async () => {
    setErr(null)
    if (isLive && !s.user) return requireUser()
    setBusy('trial')
    const ok = await startTrialIfNew()
    setBusy(null)
    s.showToast(ok ? `${!isLive ? `${t('demo')} · ` : ''}✓ ${t('trialTitle')}` : t('trialEnded'))
  }

  const choose = async (id: PassId) => {
    setErr(null)
    if (!isLive) return
    if (!requireUser()) return
    setBusy(id)
    try {
      const r = await payWithRazorpay({ sku: id }, { email: s.user?.email, name: s.profile.name })
      if (r === 'paid') s.showToast(t('paySuccess', { p: t(`plan_${id.split('_')[0] as PlanId}`) }))
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

  const onTrial = s.membership.source === 'trial' && status.state === 'active'
  const day = trialDay()
  const trialDone = !!trialStartedAt() && !onTrial
  const launchOpen = spots !== null && spots > 0
  const table = IN_APP ? rows(t).filter((r) => r.label !== t('cmp_alacarte')) : rows(t)

  const PassPrice = ({ id }: { id: PassId }) => {
    const p = passesFor(id.split('_')[0] as PlanId).find((x) => x.id === id)!
    return (
      <div className="mt-2" data-testid={`price-${id}`}>
        <span className="text-[28px] font-extrabold tabular-nums">₹{inr(p.priceInr)}</span>
        <span className="ml-1 text-[12px] text-muted">/ {t('passDays', { d: p.days })}</span>
        <div className="mt-0.5 font-mono text-[11px] text-muted">{t('perDayEq', { x: inr(perDay(p), 1) })}{p.days > 30 ? ` · ${t('perMonthEq', { x: inr(perMonth(p)) })}` : ''}</div>
      </div>
    )
  }

  return (
    <div>
      <Header title={t('membership')} back />
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold/12 text-gold"><Crown size={26} /></span>
        <h1 className="mt-3 text-[24px] font-extrabold tracking-tight">{IN_APP ? t('memTitle') : t('plansTitle')}</h1>
        <p className="mt-1 text-[13px] text-muted">{IN_APP ? t('memSub') : t('plansSub')}</p>
      </div>

      {IN_APP && (
        <div className="card mt-4 p-4" data-testid="mem-status">
          <div className="label">{t('memCurrent')}</div>
          <div className={`mt-1 flex items-center gap-2 text-[20px] font-extrabold ${plan === 'platinum' ? 'text-platinum' : ''}`} style={plan === 'platinum' ? undefined : { color: PLAN_BY_ID[plan].accent }}>
            {t(`plan_${plan}`)}
            {onTrial && <Badge tone="gold">{t('trialTitle').split(' ')[0]}</Badge>}
            {s.membership.source === 'demo' && <Badge tone="gold">{t('demo')}</Badge>}
          </div>
          {plan !== 'free' && s.membership.until && <div className="mt-0.5 text-[12.5px] text-muted" data-testid="mem-until">{t('validUntil', { d: fmtDate(s.membership.until, s.lang) })}</div>}
          <div className="mt-1 text-[12px] text-muted">{t('aiChecksN', { n: PLAN_BY_ID[plan].analyses })} · {KNOWLEDGE_LANGS[plan].length >= 3 ? 'EN · HI · GU' : KNOWLEDGE_LANGS[plan].join(' · ').toUpperCase()}</div>
          <p className="mt-3 text-[12.5px] leading-snug text-muted">{t('memLinked')}</p>
          {isLive && !s.user && <Button className="mt-3 w-full" size="sm" onClick={() => navigate('/auth?next=/membership')}>{t('signIn')}</Button>}
        </div>
      )}

      {!isLive && (
        <div className="mt-4 rounded-2xl border border-violet/30 bg-violet/[0.06] p-3" data-testid="demo-tiers">
          <div className="flex items-center gap-2 text-[12px] font-bold text-violet"><FlaskConical size={14} /> {t('demoPreview')}</div>
          {!IN_APP && <p data-testid="payments-off" className="mt-1.5 text-[11.5px] leading-snug text-gold">{t('paymentsOffDemo')}</p>}
          <div className="relative mt-2 grid grid-cols-4 gap-1 rounded-xl border border-white/10 p-1">
            {PLANS.map((p) => (
              <button key={p.id} data-testid={`demo-${p.id}`} data-on={plan === p.id || undefined} onClick={() => preview(p.id)} className={`relative z-[1] h-9 rounded-lg text-[12px] font-bold transition-colors duration-300 ${plan === p.id ? 'text-frost' : 'text-muted'}`}>{t(`plan_${p.id}`)}</button>
            ))}
            <Beam dep={plan} />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold text-muted">{t('demoTrial')}</span>
            {[1, TRIAL.days].map((d) => (
              <button key={d} data-testid={`demo-trial-${d}`} onClick={() => { demoTrialDay(d); s.showToast(`${t('demo')} · ${t('demoTrialDay', { n: d })}`) }} className="h-8 flex-1 rounded-lg border border-white/10 text-[11.5px] font-semibold text-frost">{t('demoTrialDay', { n: d })}</button>
            ))}
            <button data-testid="demo-trial-end" onClick={() => { demoTrialDay(0); s.showToast(`${t('demo')} · ${t('demoTrialEnd')}`) }} className="h-8 flex-1 rounded-lg border border-gold/30 text-[11.5px] font-semibold text-gold">{t('demoTrialEnd')}</button>
          </div>
          {!IN_APP && <p className="mt-2 text-[11px] leading-snug text-muted">{t('demoPreviewNote')}</p>}
          {plan !== 'free' && status.state === 'active' && s.membership.source !== 'trial' && (
            <button data-testid="demo-expire" onClick={() => { s.set({ membership: { ...s.membership, until: new Date(trustedNow() - 1000).toISOString() } }); s.showToast(t('demoExpired')) }} className="mt-2 w-full rounded-lg border border-gold/30 py-2 text-[12px] font-semibold text-gold">{t('demoExpire')}</button>
          )}
        </div>
      )}

      {status.state === 'grace' && status.graceUntil && (
        <div data-testid="grace-banner" className="mt-4 rounded-2xl border border-gold/40 bg-gold/[0.08] p-3 text-[13px] leading-snug text-gold">
          <b>{t('dlUnlockedUntil', { t: new Date(status.graceUntil).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })}</b>
          <p className="mt-1 text-[11.5px] text-gold/80">{t(IN_APP ? 'graceRuleApp' : 'graceRule')}</p>
        </div>
      )}

      {/* 7-day Platinum trial */}
      <div className="mt-4 rounded-[20px] border border-gold/30 bg-gold/[0.05] p-4" data-testid="trial-card">
        <div className="flex items-center gap-2"><Gift size={17} className="text-gold" /><span className="label !text-gold">{t('trialTitle')}</span></div>
        {onTrial && day ? (
          <p data-testid="trial-active" className="mt-2 text-[14px] font-semibold text-ok">{t('trialActive', { n: day, d: TRIAL.days, t: new Date(s.membership.until!).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
        ) : trialDone ? (
          <p data-testid="trial-ended" className="mt-2 text-[14px] leading-snug">{t('trialEnded')}</p>
        ) : (
          <>
            <p className="mt-2 text-[14px] leading-snug">{t('trialBody')}</p>
            {plan === 'free' && <Button variant="gold" className="mt-3 w-full" disabled={!!busy} onClick={() => void startTrial()} data-testid="trial-start">{t('trialStart')}</Button>}
          </>
        )}
      </div>

      {/* launch offer — only when the server reports real spots */}
      {launchOpen && plan === 'free' && (
        <div className="mt-3 rounded-[20px] border border-cyan/25 bg-cyan/[0.04] p-4">
          <div className="flex items-center gap-2"><Gift size={17} className="text-cyan" /><span className="label !text-cyan">{t('offerTitle')}</span><span data-testid="offer-spots" className="ml-auto font-mono text-[11px] font-bold text-cyan">{t('offerSpots', { n: spots })}</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan" style={{ width: `${Math.min(100, Math.max(0, (1 - spots / LAUNCH_SPOTS) * 100))}%` }} /></div>
          {!s.launchClaimed && <Button className="mt-3 w-full" disabled={!!busy} onClick={() => void claimLaunch()}>{t('offerClaim')}</Button>}
        </div>
      )}

      {err && <p className="mt-3 rounded-xl border border-bad/30 bg-bad/[0.08] px-3 py-2 text-[13px] text-bad">{err}</p>}

      {/* tier cards (website only) */}
      {!IN_APP && <>
      <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {PLANS.map((p) => {
          const current = plan === p.id
          const passes = passesFor(p.id)
          const chosen = p.id === 'platinum' ? passes.find((x) => x.id === platPass) ?? passes[0] : passes[0]
          const popular = !!POPULAR_PASS && passes.some((x) => x.id === POPULAR_PASS)
          const lower = PLAN_RANK[p.id] < PLAN_RANK[plan] && status.state !== 'grace'
          return (
            <div key={p.id} data-testid={`tier-${p.id}`} className={`card relative flex w-[78%] shrink-0 snap-center flex-col overflow-hidden p-4 ${p.id === 'platinum' ? 'platinum-card' : p.id === 'gold' ? 'gold-card' : ''} ${popular ? 'border-cyan/40' : ''}`}>
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: p.accent }} />
              <div className="flex items-center gap-2">
                <h3 className={`text-[19px] font-extrabold ${p.id === 'platinum' ? 'text-platinum' : ''}`} style={p.id === 'platinum' ? undefined : { color: p.accent }}>{t(`plan_${p.id}`)}</h3>
                {popular && <Badge tone="cyan">{t('mostPopular')}</Badge>}
                {current && <Badge tone="ok">{onTrial ? t('trialTitle').split(' ')[0] + ' ' + t('current') : t('current')}</Badge>}
              </div>
              {p.id === 'free' ? (
                <div className="mt-2"><span className="text-[28px] font-extrabold tabular-nums">₹0</span><span className="ml-1 text-[12px] text-muted">{t('forever')}</span></div>
              ) : <PassPrice id={chosen.id} />}
              {p.id === 'platinum' && (
                <div className="relative mt-2 grid grid-cols-3 gap-1 rounded-xl border border-white/10 p-1" role="radiogroup">
                  {passes.map((x) => (
                    <button key={x.id} role="radio" aria-checked={platPass === x.id} data-on={platPass === x.id || undefined} data-testid={`pass-${x.id}`} onClick={() => setPlatPass(x.id)} className={`relative z-[1] h-9 rounded-lg text-[12px] font-bold transition-colors duration-300 ${platPass === x.id ? 'text-platinum' : 'text-muted'}`}>
                      {t('passDays', { d: x.days })}
                      {x.id === POPULAR_PASS && <span className="absolute -top-1.5 right-1 h-2 w-2 rounded-full bg-cyan shadow-[0_0_6px_#22d3ee]" />}
                    </button>
                  ))}
                  <Beam dep={platPass} />
                </div>
              )}
              <div className="mt-2 text-[12px] text-muted">{t('aiChecksN', { n: p.analyses })} · {KNOWLEDGE_LANGS[p.id].length >= 3 ? 'EN · HI · GU' : KNOWLEDGE_LANGS[p.id].join(' · ').toUpperCase()}</div>
              {current && p.id !== 'free' && s.membership.until && <div className="mt-1 text-[11.5px] text-muted">{t('validUntil', { d: fmtDate(s.membership.until, s.lang) })}</div>}
              {p.id !== 'free' && !lower && (
                <Button className="mt-auto w-full !mt-3" size="sm" variant={p.id === 'platinum' ? 'outline' : 'primary'} disabled={!!busy || !isLive} onClick={() => void choose(chosen.id)} data-testid={`buy-${chosen.id}`}>
                  {!isLive ? <Lock size={14} /> : <Crown size={14} />}
                  {busy === chosen.id ? t('paying') : `${current && !onTrial ? t('renew') : t('choosePlan', { p: t(`plan_${p.id}`) })} · ₹${inr(chosen.priceInr)}`}
                </Button>
              )}
            </div>
          )
        })}
      </div>
      {!isLive && <p className="mt-2 text-center text-[12px] text-gold">{t('paymentsAtLaunch')}</p>}

      {/* à-la-carte */}
      <div className="card mt-4 p-4" data-testid="ala-card">
        <div className="text-[15px] font-bold">{t('alaTitle')}</div>
        <p className="mt-1 text-[12.5px] leading-snug text-muted">{t('alaBody', { v: UNLOCKS.video, p: UNLOCKS.pdf, nv: UNLOCKS.pack.videos, np: UNLOCKS.pack.pdfs, k: UNLOCKS.pack.priceInr })}</p>
        <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => navigate('/knowledge')}>{t('knowledge')} →</Button>
      </div>

      {showsPostPasses(plan) && (
        <div className="card mt-4 p-4" data-testid="pp-section">
          <div className="text-[15px] font-bold">{t('ppTitle')}</div>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">{t('ppSub')}</p>
          <div className="mt-3"><PostPassButtons /></div>
          <ActivePassList />
        </div>
      )}
      </>}

      {/* comparison */}
      <h2 className="label mt-5">{t('features')}</h2>
      <div className="card mt-2 overflow-hidden p-0" data-testid="compare-table">
        <div className="grid grid-cols-[1fr_40px_40px_42px_54px] items-center gap-1 border-b border-white/[0.07] px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-wider text-muted">
          <span />
          {PLANS.map((p) => <span key={p.id} className={`text-center ${p.id === 'platinum' ? 'text-platinum' : ''}`} style={p.id === 'platinum' ? undefined : { color: p.accent }}>{t(`plan_${p.id}`)}</span>)}
        </div>
        {table.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_40px_40px_42px_54px] items-center gap-1 border-b border-white/[0.04] px-3 py-2.5 last:border-0">
            <span className="text-[12.5px] leading-snug">{r.label}</span>
            {r.cells.map((c, i) => (
              <span key={i} className="grid place-items-center">
                {c === true ? <Check size={16} className={i === 3 ? 'text-violet' : i === 2 ? 'text-gold' : 'text-cyan'} /> : c === false ? <Minus size={14} className="text-dim" /> : <span className="font-mono text-[12px] font-bold">{c}</span>}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-dim">{t('aiNote')}</p>

      {plan !== 'free' && s.membership.until && <p className="mt-3 text-center text-[12px] text-muted">{t('validUntil', { d: fmtDate(s.membership.until, s.lang) })}{s.membership.source === 'demo' ? ` · ${t('demo')}` : ''}</p>}
      {!IN_APP && <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-dim"><ShieldCheck size={14} /> {t('payWith')}</p>}
      <p className="mt-2 text-center text-[11px] text-dim">
        <a className="underline" href="#/legal/terms">{t('terms')}</a>{!IN_APP && <> · <a className="underline" href="#/legal/refunds">{t('refunds')}</a></>}
      </p>
    </div>
  )
}
