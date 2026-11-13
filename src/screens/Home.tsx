import { Flame, ScanLine, Camera, Utensils, HeartPulse, ChevronRight, Lock, Play, Droplets, Plus, Activity } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Button, Card, Ring, Badge } from '../components/ui'
import { LogoMark, Wordmark } from '../components/Brand'
import { OfferBanner } from '../components/OfferBanner'
import { CountUp, HudTitle, IconTile, Photo } from '../components/hud'
import { navigate } from '../lib/router'
import { PROGRAM_BY_ID } from '../data/programs'
import { LADDERS } from '../data/ladders'
import { exOf, exName } from '../data/exercises'
import { computeStreak, dayKey, nutritionTargets, readinessBand, weekStart } from '../lib/util'
import { estimateMinutes } from '../lib/plan'
import { startEmpty, startWorkout } from '../lib/workout'
import { ladderStatus } from '../lib/training'
import { hasPlan } from '../lib/plans'

export function Home() {
  const t = useT()
  const s = useApp()
  const plan = effectivePlan(s.membership)
  const today = dayKey()
  const checkin = s.checkins.find((c) => c.date === today)
  const program = s.activeProgramId ? PROGRAM_BY_ID[s.activeProgramId] : undefined
  const dayIdx = program ? (s.programDay[program.id] ?? 0) % program.days.length : 0
  const day = program?.days[dayIdx]
  const locked = program ? !hasPlan(plan, program.plan) : false
  const streak = computeStreak(s.sessions)
  const ws = weekStart(new Date()).getTime()
  const weekSessions = s.sessions.filter((x) => new Date(x.startedAt).getTime() >= ws)
  const weekTarget = program?.daysPerWeek ?? 3
  const targets = nutritionTargets(s.profile)
  const foodsToday = s.foods.filter((f) => f.date === today)
  const kcal = foodsToday.reduce((a, f) => a + f.kcal, 0)
  const protein = foodsToday.reduce((a, f) => a + f.protein, 0)
  const water = s.water[today] ?? 0
  const band = checkin ? readinessBand(checkin.score) : null
  const bandColor = band === 'hard' ? '#34d399' : band === 'moderate' ? '#fbbf24' : '#f87171'
  const name = s.profile.name || t('athleteLbl')
  const heroPhoto = program?.media ?? 'sl-rdl'

  const start = () => {
    if (!program || !day) return
    if (locked) return navigate('/membership')
    if (!s.active) startWorkout(`${program.name} · ${day.name}`, day.items, program.id, dayIdx)
    navigate('/player')
  }
  const free = () => {
    if (!s.active) startEmpty(t('emptyWorkout'))
    navigate('/player')
  }

  return (
    <div className="pt-[calc(env(safe-area-inset-top)+12px)]">
      <div className="flex items-center gap-3">
        <span className="rounded-2xl shadow-[0_0_26px_-6px_rgba(247,197,72,0.65)]"><LogoMark size={42} /></span>
        <div className="min-w-0 flex-1">
          <Wordmark className="block text-[15px]" />
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-cyan/80">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_8px_rgba(163,230,53,0.9)]" />
            {t('systemOnline')} · {new Date().toLocaleDateString(s.lang === 'en' ? 'en-IN' : `${s.lang}-IN`, { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </div>
        <button onClick={() => navigate('/membership')}><Badge tone={plan === 'free' ? 'muted' : 'gold'}>{t(`plan_${plan}`)}</Badge></button>
      </div>

      {/* HERO */}
      <section className="card hud-full neon-shadow relative mt-4 overflow-hidden !rounded-[24px]">
        <div className="scanlines holo-sweep relative h-[300px]">
          <Photo name={heroPhoto} alt={t('photoOf', { x: program?.name ?? 'D31' })} eager />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,6,12,0.55)_0%,rgba(4,6,12,0.05)_32%,rgba(4,6,12,0.35)_58%,rgba(4,6,12,0.97)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,6,12,0.55),transparent_55%)]" />
          <div className="absolute left-4 top-4 z-[2]">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-gold/90">{t('scanLabel')} · {t('todayWorkout')}</div>
            <h1 className="title-hud mt-1.5 text-[24px] leading-[1.05] text-frost drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">{t('hello', { n: name })}</h1>
            <p className="mt-1.5 inline-block max-w-[240px] rounded-md bg-[#04060c]/70 px-2 py-0.5 text-[12px] font-semibold text-cyan backdrop-blur">{t('heroKicker')}</p>
          </div>
          <div className="absolute inset-x-4 bottom-3 z-[2]">
            {program && day ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-gold/50 bg-gold/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gold">{dayIdx + 1}/{program.days.length}</span>
                  <span className="truncate text-[12px] text-muted">{program.name} · ~{estimateMinutes(day.items)} {t('min')}</span>
                </div>
                <h2 className="mt-1 truncate text-[22px] font-bold leading-tight">{day.name}</h2>
                <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                  {day.items.map((it, k) => (
                    <span key={k} className="shrink-0 rounded-lg border border-cyan/20 bg-[#04060c]/70 px-2 py-1 text-[11.5px] text-frost/90 backdrop-blur">
                      {exName(exOf(it.exId), s.lang)} <span className="text-cyan/80">{it.sets}×{it.target ?? it.reps ?? `${it.secs}s`}</span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[14px] text-frost/90">{t('noProgram')}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 p-3">
          {program && day ? (
            <Button className="flex-1" onClick={start} variant={locked ? 'gold' : 'primary'}>
              {locked ? <><Lock size={16} /> {t('unlockWith', { p: t(`plan_${program.plan}`) })}</> : <><Play size={16} fill="currentColor" /> {s.active ? t('resume') : t('start')}</>}
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => navigate('/train')}>{t('choose')}</Button>
          )}
          <Button variant="outline" onClick={free} aria-label={t('emptyWorkout')}><Plus size={16} /> {t('emptyWorkout')}</Button>
        </div>
      </section>

      {/* Readouts */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Card className="p-3">
          <IconTile icon={Flame} grad="gold" size={30} />
          <div className="readout-gold mt-2 text-[26px] font-bold leading-none"><CountUp value={streak} /></div>
          <div className="mt-1 text-[10.5px] text-muted">{t('streak')}</div>
        </Card>
        <Card className="flex flex-col items-center justify-center p-3">
          <Ring value={weekSessions.length / weekTarget} size={58} stroke={5}>
            <span className="readout text-[14px] font-bold">{weekSessions.length}/{weekTarget}</span>
          </Ring>
          <div className="mt-1.5 text-[10.5px] text-muted">{t('thisWeek')}</div>
        </Card>
        <Card className="p-3" onClick={() => navigate('/fuel?tab=recovery')}>
          <IconTile icon={HeartPulse} grad="lime" size={30} />
          <div className="readout mt-2 text-[26px] font-bold leading-none" style={{ color: checkin ? bandColor : undefined }}>{checkin ? <CountUp value={checkin.score} /> : '—'}</div>
          <div className="mt-1 text-[10.5px] text-muted">{t('readiness')}</div>
        </Card>
      </div>

      <Card className="mt-2.5 flex items-center gap-3 p-3.5" onClick={() => navigate('/fuel?tab=recovery')}>
        <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: checkin ? bandColor : '#2c3545', boxShadow: checkin ? `0 0 12px ${bandColor}` : undefined }} />
        <p className="flex-1 text-[13.5px] leading-snug">{checkin && band ? t(`rec_${band}`) : t('readinessNone')}</p>
        <ChevronRight size={18} className="text-dim" />
      </Card>

      {/* Skill paths */}
      <HudTitle tag="LADDERS" action={<button className="text-[11px] font-semibold text-cyan" onClick={() => navigate('/library?tab=paths')}>{t('seeAll')}</button>}>{t('skillPaths')}</HudTitle>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {LADDERS.map((l) => {
          const st = ladderStatus(l, s.sessions)
          const cur = l.steps[st.current]
          return (
            <button key={l.id} onClick={() => navigate(`/path/${l.id}`)} className="card relative h-[168px] w-[150px] shrink-0 snap-start overflow-hidden text-left">
              {l.media ? <Photo name={l.media} small alt="" className="absolute inset-0 opacity-80" /> : <div className="grid-bg absolute inset-0" style={{ background: `radial-gradient(120% 90% at 0% 0%, ${l.accent}33, transparent 60%)` }} />}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_25%,rgba(4,6,12,0.95))]" />
              <div className="absolute inset-x-3 bottom-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: l.accent }}>{t('stepOf', { n: st.current + 1, t: l.steps.length })}</div>
                <div className="title-hud mt-1 text-[12.5px] leading-tight">{l.name}</div>
                <div className="mt-1 truncate text-[11px] text-muted">{exName(exOf(cur.exId), s.lang)}</div>
                <div className="mt-2 flex gap-0.5">{l.steps.map((_, k) => <span key={k} className="h-1 flex-1 rounded-full" style={{ background: st.cleared[k] ? l.accent : k === st.current ? `${l.accent}66` : 'rgba(255,255,255,0.12)' }} />)}</div>
              </div>
            </button>
          )
        })}
      </div>

      <OfferBanner />

      <HudTitle tag="QUICK">{t('quick')}</HudTitle>
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { icon: ScanLine, label: t('qAnalyze'), to: '/analyze', g: 'cyan' as const },
          { icon: Camera, label: t('qCamera'), to: '/analyze?tab=live', g: 'magenta' as const },
          { icon: Utensils, label: t('qMeal'), to: '/fuel?tab=nutrition', g: 'gold' as const },
          { icon: Activity, label: t('qCheckin'), to: '/fuel?tab=recovery', g: 'lime' as const },
        ].map(({ icon, label, to, g }) => (
          <button key={to} onClick={() => navigate(to)} className="card flex flex-col items-center gap-2 px-1 py-3.5">
            <IconTile icon={icon} grad={g} />
            <span className="text-center text-[11px] font-semibold leading-tight">{label}</span>
          </button>
        ))}
      </div>

      <HudTitle tag="FUEL" action={<button className="text-[11px] font-semibold text-cyan" onClick={() => navigate('/fuel')}>{t('seeAll')}</button>}>{t('fuelToday')}</HudTitle>
      <Card className="flex items-center gap-4 p-4" onClick={() => navigate('/fuel?tab=nutrition')}>
        <Ring value={kcal / targets.kcal} size={78} stroke={7} color="#f7c548">
          <div>
            <div className="readout-gold text-[15px] font-bold leading-none">{Math.round(kcal).toLocaleString('en-IN')}</div>
            <div className="mt-0.5 text-[10px] text-muted">/{targets.kcal.toLocaleString('en-IN')}</div>
          </div>
        </Ring>
        <div className="flex-1 space-y-2.5">
          <Bar label={t('protein')} value={protein} max={targets.protein} unit="g" color="#22d3ee" />
          <div className="flex items-center gap-2 text-[13px]">
            <Droplets size={15} className="text-cyan" />
            <span className="text-muted">{t('water')}</span>
            <span className="ml-auto font-semibold tabular-nums">{water}/{targets.water} <span className="text-xs font-normal text-dim">{t('glasses')}</span></span>
          </div>
        </div>
      </Card>
      <p className="mt-6 text-center font-mono text-[9.5px] uppercase tracking-[0.3em] text-dim">D31.UNIVERSE · {t('byDarshan')}</p>
    </div>
  )
}

const BAR_END: Record<string, string> = { '#22d3ee': '#a78bfa', '#f5b942': '#fb923c', '#f7c548': '#fb923c', '#34d399': '#a3e635', '#a78bfa': '#f472d0', '#f87171': '#f472d0' }

export function Bar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular-nums">{Math.round(value)}<span className="text-dim">/{max}{unit}</span></span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: `linear-gradient(90deg, ${color}, ${BAR_END[color] ?? color})`, boxShadow: `0 0 10px ${color}88` }} />
      </div>
    </div>
  )
}
