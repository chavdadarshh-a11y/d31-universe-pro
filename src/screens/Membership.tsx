import { useState } from 'react'
import { Beam } from '../components/Beam'
import { Check, Gift, ShieldCheck, Crown, Minus, FlaskConical, Lock, Users } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Header } from '../components/ui'
import { PLANS, PLAN_RANK, PLAN_BY_ID, passStatus, trustedNow } from '../lib/plans'
import { PLAN_IDS, KNOWLEDGE_LANGS, POPULAR_PASS, TRIAL, passesFor, foundingPrice, type PassId } from '../config/plans'
import { demoTrialDay, startTrialIfNew, trialDay, trialStartedAt } from '../lib/trial'
import { can, type Feature } from '../lib/entitlements'
import { FoundingCard } from '../components/OfferBanner'
import { isLive } from '../lib/env'
import { navigate } from '../lib/router'
import { payWithRazorpay } from '../lib/payments'
import { fmtDate } from '../lib/util'
import { PROGRAMS } from '../data/programs'
import type { PlanId } from '../types'
import type { StringKey } from '../i18n/strings'
import { IN_APP } from '../lib/appMode'
import { ActiveUnlockList, PostPassButtons, UpgradeNudge, WalletPayToggle, showsPostPasses } from '../components/PostPasses'
import { foundingDiscountActive, spotsLeft, useFoundingCount, useIsFounding } from '../lib/founding'
import { useWallet } from '../lib/wallet'
import { REFERRAL } from '../config/plans'
import { isOnWaitlist, joinWaitlist, type WaitPlan } from '../lib/waitlist'

const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString()
const progCount = (p: PlanId) => PROGRAMS.filter((x) => x.plan === p).length

type Cell = boolean | string
type Row4 = { label: string; cells: [Cell, Cell, Cell, Cell] }
/** Feature comparison — every row is something the app actually does and gates, or a published service promise (support / early access). */
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
    { label: t('cmp_pdfs'), cells: [t('cmp_pdfs_free'), t('cmp_pdfs_pro'), t('cmp_pdfs_gold'), t('cmp_pdfs_gold')] },
    { label: t('cmp_langs'), cells: PLAN_IDS.map((p) => (KNOWLEDGE_LANGS[p].length >= 3 ? '3' : KNOWLEDGE_LANGS[p].join('+').toUpperCase())) as [Cell, Cell, Cell, Cell] },
    { label: t('cmp_knowledgeDl'), cells: [t('cmp_limited'), true, true, true] },
    { label: t('cmp_offline'), cells: [t('cmp_limited'), true, true, true] },
    { label: t('cmp_portal'), cells: [true, true, true, false] },
    { label: t('cmp_support'), cells: [false, false, t('cmp_support_std'), t('cmp_support_vip')] },
    { label: t('cmp_early'), cells: [false, false, t('cmp_early_sel'), true] },
    { label: t('cmp_backup'), cells: by('download.backup') },
  ]
}


function WaitlistTiers({ active }: { active: PlanId }) {
  const t = useT()
  const user = useApp((s) => s.user)
  const toast = useApp((s) => s.showToast)
  const [on, setOn] = useState<Partial<Record<WaitPlan, boolean>>>({
    pro: isOnWaitlist('pro'), gold: isOnWaitlist('gold'), platinum: isOnWaitlist('platinum'),
  })
  const [busy, setBusy] = useState<WaitPlan | null>(null)
  const bits: Record<PlanId, string[]> = {
    free: [t('cmp_library'), t('cmp_logging'), t('cmp_tracking'), t('cmp_counter'), t('aiChecksN', { n: PLAN_BY_ID.free.analyses })],
    pro: [t('cmp_programs'), t('aiChecksN', { n: PLAN_BY_ID.pro.analyses }), t('cmp_photos'), t('cmp_knowledgeDl'), t('cmp_offline')],
    gold: [t('cmp_platinumPaths'), t('aiChecksN', { n: PLAN_BY_ID.gold.analyses }), t('cmp_pdfs'), t('cmp_langs'), t('cmp_support_std')],
    platinum: [t('aiChecksN', { n: PLAN_BY_ID.platinum.analyses }), t('cmp_support_vip'), t('cmp_early')],
  }
  const join = async (id: WaitPlan) => {
    if (on[id]) return
    if (!user) { toast(t('waitlistSignIn')); navigate('/auth?next=/membership'); return }
    setBusy(id)
    const r = await joinWaitlist(id)
    setBusy(null)
    setOn((s) => ({ ...s, [id]: true }))
    toast(r.already ? t('waitlistJoined') : t('waitlistThanks', { p: t(`plan_${id}`) }))
  }
  return (
    <div className="mt-5" data-testid="plan-compare">
      <h2 className="label">{t('plansCompareTitle')}</h2>
      <p className="mt-1 text-[12.5px] leading-snug text-muted">{t('plansCompareSub')}</p>
      <div className="mt-3 space-y-3">
        {PLANS.map((p) => {
          const current = active === p.id
          const paid = p.id !== 'free'
          const joined = paid && on[p.id as WaitPlan]
          return (
            <div key={p.id} data-testid={`plan-card-${p.id}`} className={`card relative overflow-hidden p-4 ${p.id === 'platinum' ? 'platinum-card' : p.id === 'gold' ? 'gold-card' : ''}`}>
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: p.accent }} />
              <div className="flex items-center gap-2">
                <h3 className={`text-[18px] font-extrabold ${p.id === 'platinum' ? 'text-platinum' : ''}`} style={p.id === 'platinum' ? undefined : { color: p.accent }}>{t(`plan_${p.id}`)}</h3>
                {current && <Badge tone="ok">{t('current')}</Badge>}
                {paid && <Badge tone="gold">{t('comingSoonCta')}</Badge>}
              </div>
              <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">{t(`posRole_${p.id}` as StringKey)}</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{t(`posLine_${p.id}` as StringKey)}</p>
              <ul className="mt-2 space-y-1">
                {bits[p.id].map((line) => (
                  <li key={line} className="flex items-start gap-1.5 text-[12.5px] leading-snug"><Check size={13} className="mt-0.5 shrink-0 text-cyan" /> <span>{line}</span></li>
                ))}
              </ul>
              {paid && (
                <Button className="mt-3 w-full" size="sm" variant={joined ? 'ghost' : 'outline'} disabled={!!busy || !!joined} onClick={() => void join(p.id as WaitPlan)} data-testid={`waitlist-${p.id}`}>
                  {busy === p.id ? '…' : joined ? t('waitlistJoined') : t('joinWaitlist')}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Membership() {
  const t = useT()
  const s = useApp()
  const plan = effectivePlan(s.membership)
  const status = passStatus(s.membership)
  const claimed = useFoundingCount()
  const isFounder = useIsFounding()
  /* Founding prices only when the member already has the discount, or a real backend count says spots remain.
     If there is no backend, show list prices and describe the offer without a fake counter. */
  const showFoundingPrice = foundingDiscountActive(isFounder, s.membership) || (spotsLeft(claimed) !== null && (spotsLeft(claimed) as number) > 0)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [period, setPeriod] = useState<'30' | '365'>('30')
  const [wallet, setWallet] = useState(true)
  const locale = s.lang === 'en' ? 'en-IN' : `${s.lang}-IN`
  const inr = (x: number, d = 0) => d > 0 ? Number(x).toFixed(d) : Math.round(x).toLocaleString('en-IN')
  const priceOf = (list: number) => (showFoundingPrice ? foundingPrice(list) : list)

  const requireUser = () => {
    if (isLive && !s.user) {
      s.showToast(IN_APP ? t('memSignIn') : t('signInToBuy'))
      navigate('/auth?next=/membership')
      return false
    }
    return true
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
      const r = await payWithRazorpay({ sku: id, wallet }, { email: s.user?.email, name: s.profile.name })
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
  const table = rows(t)
  const walletBal = useWallet((s) => s.balance)

  const PassPrice = ({ id }: { id: PassId }) => {
    const p = passesFor(id.split('_')[0] as PlanId).find((x) => x.id === id)!
    const shown = priceOf(p.priceInr)
    return (
      <div className="mt-2" data-testid={`price-${id}`}>
        {showFoundingPrice && shown !== p.priceInr && (
          <div className="mb-0.5 font-mono text-[11px] text-gold">{t('first131Price')} · <s className="text-muted">₹{inr(p.priceInr)}</s></div>
        )}
        <span className="text-[28px] font-extrabold tabular-nums">₹{inr(shown)}</span>
        <span className="ml-1 text-[12px] text-muted">/ {p.days === 365 ? t('passYearly') : t('passMonthly')}</span>
        <div className="mt-0.5 font-mono text-[11px] text-muted">{t('perDayEq', { x: inr(shown / p.days, 1) })}{p.days > 30 ? ` · ${t('perMonthEq', { x: inr((shown / p.days) * 30) })}` : ''}</div>
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
        {!IN_APP && <p className="mt-1 px-1 font-mono text-[10px] uppercase leading-5 tracking-[0.12em] text-cyan/80">{t('taglinePosts')}<br />{t('taglineLinks')}<br />{t('taglineDrive')}</p>}
      </div>

      {IN_APP && (
        <div className="card mt-4 p-4" data-testid="mem-status">
          <div className="label">{t('memCurrent')}</div>
          <div className={`mt-1 flex items-center gap-2 text-[20px] font-extrabold ${plan === 'platinum' ? 'text-platinum' : ''}`} style={plan === 'platinum' ? undefined : { color: PLAN_BY_ID[plan].accent }}>
            {t(`plan_${plan}`)}
            {onTrial && <Badge tone="gold">{t('trialTitle').split(' ')[0]}</Badge>}
            {s.membership.source === 'demo' && <Badge tone="gold">{t('demo')}</Badge>}
            {isFounder && <Badge tone="gold">{t('first131Badge')}</Badge>}
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

      <FoundingCard />
      <UpgradeNudge />

      {err && <p className="mt-3 rounded-xl border border-bad/30 bg-bad/[0.08] px-3 py-2 text-[13px] text-bad">{err}</p>}

      {/* tier cards (website only) */}
      {!IN_APP && <>
      <div className="relative mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/10 p-1" role="radiogroup" data-testid="period-toggle">
        {(['30', '365'] as const).map((d) => (
          <button key={d} role="radio" aria-checked={period === d} data-on={period === d || undefined} data-testid={`period-${d}`} onClick={() => setPeriod(d)} className={`relative z-[1] h-9 rounded-lg text-[12px] font-bold ${period === d ? 'text-frost' : 'text-muted'}`}>
            {d === '30' ? t('passMonthly') : t('passYearly')}
          </button>
        ))}
        <Beam dep={period} />
      </div>
      <div className="mt-3"><WalletPayToggle on={wallet} setOn={setWallet} /></div>

      <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {PLANS.map((p) => {
          const current = plan === p.id
          const passes = passesFor(p.id)
          const chosen = passes.find((x) => String(x.days) === period) ?? passes[0]
          const popular = !!POPULAR_PASS && passes.some((x) => x.id === POPULAR_PASS)
          const lower = PLAN_RANK[p.id] < PLAN_RANK[plan] && status.state !== 'grace'
          const shown = chosen ? priceOf(chosen.priceInr) : 0
          return (
            <div key={p.id} data-testid={`tier-${p.id}`} className={`card relative flex w-[78%] shrink-0 snap-center flex-col overflow-hidden p-4 ${p.id === 'platinum' ? 'platinum-card' : p.id === 'gold' ? 'gold-card' : ''} ${popular ? 'border-cyan/40' : ''}`}>
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: p.accent }} />
              <div className="flex items-center gap-2">
                <h3 className={`text-[19px] font-extrabold ${p.id === 'platinum' ? 'text-platinum' : ''}`} style={p.id === 'platinum' ? undefined : { color: p.accent }}>{t(`plan_${p.id}`)}</h3>
                {popular && <Badge tone="cyan">{t('mostPopular')}</Badge>}
                {current && <Badge tone="ok">{onTrial ? t('trialTitle').split(' ')[0] + ' ' + t('current') : t('current')}</Badge>}
              </div>
              <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">{t(`posRole_${p.id}` as StringKey)}</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{t(`posLine_${p.id}` as StringKey)}</p>
              {p.id === 'free' ? (
                <div className="mt-2"><span className="text-[28px] font-extrabold tabular-nums">₹0</span><span className="ml-1 text-[12px] text-muted">{t('forever')}</span></div>
              ) : chosen ? <PassPrice id={chosen.id} /> : null}
              <div className="mt-2 text-[12px] text-muted">{t('aiChecksN', { n: p.analyses })} · {KNOWLEDGE_LANGS[p.id].length >= 3 ? 'EN · HI · GU' : KNOWLEDGE_LANGS[p.id].join(' · ').toUpperCase()}</div>
              {current && p.id !== 'free' && s.membership.until && <div className="mt-1 text-[11.5px] text-muted">{t('validUntil', { d: fmtDate(s.membership.until, s.lang) })}</div>}
              {p.id !== 'free' && !lower && chosen && (
                <Button className="mt-auto w-full !mt-3" size="sm" variant={p.id === 'platinum' ? 'outline' : 'primary'} disabled={!!busy || !isLive} onClick={() => void choose(chosen.id)} data-testid={`buy-${chosen.id}`}>
                  {!isLive ? <Lock size={14} /> : <Crown size={14} />}
                  {busy === chosen.id ? t('paying') : `${current && !onTrial ? t('renew') : t('choosePlan', { p: t(`plan_${p.id}`) })} · ₹${inr(shown)}`}
                </Button>
              )}
            </div>
          )
        })}
      </div>
      {!isLive && <p className="mt-2 text-center text-[12px] text-gold">{t('paymentsAtLaunch')}</p>}

      {showsPostPasses(plan) && (
        <div className="card mt-4 p-4" data-testid="pp-section">
          <div className="text-[15px] font-bold">{t('ppTitle')}</div>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">{t('ppSub')}</p>
          <div className="mt-3"><PostPassButtons /></div>
          <ActiveUnlockList />
        </div>
      )}
      {plan === 'platinum' && !IN_APP && (
        <p className="mt-3 text-center text-[12px] text-muted" data-testid="pp-hidden-platinum">{t('posLine_platinum')}</p>
      )}

      <button type="button" onClick={() => navigate('/referral')} className="card mt-4 flex w-full items-center gap-3 p-4 text-left" data-testid="ref-teaser">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan/12 text-cyan"><Users size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold">{t('refTitle')}</div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{t('refSub', { n: REFERRAL.rewardInr, m: REFERRAL.maxPerMember })}</p>
        </div>
        {!IN_APP && walletBal > 0 && <span className="font-mono text-[12px] font-bold text-gold">{t('walletBal', { n: walletBal })}</span>}
      </button>
      </>}

      {IN_APP && <WaitlistTiers active={plan} />}

      {/* comparison */}
      <h2 className="label mt-5 scroll-mt-[5.5rem]">{t('features')}</h2>
      <div className="card mt-2 overflow-x-auto p-0" data-testid="compare-table">
        <div className="min-w-[312px]">
        <div className="grid grid-cols-[minmax(84px,1.2fr)_46px_46px_54px_72px] items-center gap-1 border-b border-white/[0.07] px-2.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted">
          <span />
          {PLANS.map((p) => <span key={p.id} className={`text-center leading-tight whitespace-nowrap ${p.id === 'platinum' ? 'text-platinum' : ''}`} style={p.id === 'platinum' ? undefined : { color: p.accent }}>{t(`plan_${p.id}`)}</span>)}
        </div>
        {table.map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(84px,1.2fr)_46px_46px_54px_72px] items-center gap-1 border-b border-white/[0.04] px-2.5 py-2.5 last:border-0">
            <span className="text-[12.5px] leading-snug">{r.label}</span>
            {r.cells.map((c, i) => (
              <span key={i} className="grid place-items-center px-0.5 text-center">
                {c === true ? <Check size={16} className={i === 3 ? 'text-violet' : i === 2 ? 'text-gold' : 'text-cyan'} /> : c === false ? <Minus size={14} className="text-dim" /> : <span className="font-mono text-[10px] font-bold leading-tight">{c}</span>}
              </span>
            ))}
          </div>
        ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-dim">{t('aiNoteLimits', { f: PLAN_BY_ID.free.analyses, p: PLAN_BY_ID.pro.analyses, g: PLAN_BY_ID.gold.analyses, x: PLAN_BY_ID.platinum.analyses })}</p>

      {plan !== 'free' && s.membership.until && <p className="mt-3 text-center text-[12px] text-muted">{t('validUntil', { d: fmtDate(s.membership.until, s.lang) })}{s.membership.source === 'demo' ? ` · ${t('demo')}` : ''}</p>}
      {!IN_APP && <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-dim"><ShieldCheck size={14} /> {t('payWith')}</p>}
      <p className="mt-2 text-center text-[11px] text-dim">
        <a className="underline" href="#/legal/terms">{t('terms')}</a>
        {!IN_APP && <> · <a className="underline" href="#/legal/refunds">{t('refunds')}</a> · <a className="underline" href="#/legal/credits">{t('creditPolicy')}</a> · <a className="underline" href="#/legal/founding">{t('foundingLegal')}</a></>}
      </p>
    </div>
  )
}
