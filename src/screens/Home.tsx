import { Flame, ScanLine, Camera, Utensils, HeartPulse, ChevronRight, Lock, Play, Droplets } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Button, Card, Label, Ring, SectionHead, Badge } from '../components/ui'
import { LogoMark } from '../components/Brand'
import { OfferBanner } from '../components/OfferBanner'
import { navigate } from '../lib/router'
import { PROGRAM_BY_ID } from '../data/programs'
import { EX_BY_ID, exName } from '../data/exercises'
import { computeStreak, dayKey, fmtNum, nutritionTargets, readinessBand, weekStart } from '../lib/util'
import { estimateMinutes } from '../lib/plan'
import { startWorkout } from '../lib/workout'
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
  const hour = new Date().getHours()
  const name = s.profile.name || 'Athlete'

  const start = () => {
    if (!program || !day) return
    if (locked) return navigate('/membership')
    if (!s.active) startWorkout(`${program.name} · ${day.name}`, day.items, program.id, dayIdx)
    navigate('/player')
  }

  return (
    <div className="pt-[calc(env(safe-area-inset-top)+14px)]">
      <div className="flex items-center gap-3">
        <LogoMark size={40} />
        <div className="min-w-0 flex-1">
          <div className="label">{new Date().toLocaleDateString(s.lang === 'en' ? 'en-IN' : `${s.lang}-IN`, { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <h1 className="truncate text-[22px] font-extrabold tracking-tight">{t('hello', { n: name })} {hour < 12 ? '☀️' : hour < 18 ? '⚡' : '🌙'}</h1>
        </div>
        <button onClick={() => navigate('/membership')}><Badge tone={plan === 'free' ? 'muted' : 'gold'}>{t(`plan_${plan}`)}</Badge></button>
      </div>

      {/* Today's workout */}
      <Card className="mt-5 overflow-hidden">
        <div className="grid-bg border-b border-white/[0.06] p-4">
          <div className="flex items-center justify-between">
            <Label>{t('todayWorkout')}</Label>
            {program && <span className="font-mono text-[11px] text-dim">{dayIdx + 1}/{program.days.length}</span>}
          </div>
          {program && day ? (
            <>
              <h2 className="mt-2 text-xl font-bold leading-tight">{day.name}</h2>
              <p className="mt-0.5 text-[13px] text-muted">{program.name} · ~{estimateMinutes(day.items)} {t('min')} · {day.items.length} {t('exercises').toLowerCase()}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {day.items.map((it) => (
                  <span key={it.exId} className="rounded-lg bg-white/[0.05] px-2 py-1 text-[12px] text-frost/90">
                    {exName(EX_BY_ID[it.exId], s.lang)} <span className="text-dim">{it.sets}×{it.reps ?? `${it.secs}s`}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{t('noProgram')}</p>
          )}
        </div>
        <div className="flex gap-2 p-3">
          {program && day ? (
            <>
              <Button className="flex-1" onClick={start} variant={locked ? 'gold' : 'primary'}>
                {locked ? <><Lock size={16} /> {t('unlockWith', { p: t(`plan_${program.plan}`) })}</> : <><Play size={16} fill="currentColor" /> {s.active ? t('resume') : t('start')}</>}
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/train/program/${program.id}`)}>{t('seeAll')}</Button>
            </>
          ) : (
            <Button className="flex-1" onClick={() => navigate('/train')}>{t('choose')}</Button>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Card className="p-3.5">
          <Flame size={18} className="text-gold" />
          <div className="mt-2 text-2xl font-extrabold tabular-nums">{streak}</div>
          <div className="text-[11px] text-muted">{t('streak')}</div>
        </Card>
        <Card className="flex flex-col items-center justify-center p-3">
          <Ring value={weekSessions.length / weekTarget} size={56} stroke={5}>
            <span className="text-sm font-bold tabular-nums">{weekSessions.length}/{weekTarget}</span>
          </Ring>
          <div className="mt-1.5 text-[11px] text-muted">{t('thisWeek')}</div>
        </Card>
        <Card className="p-3.5" onClick={() => navigate('/fuel?tab=recovery')}>
          <HeartPulse size={18} style={{ color: checkin ? bandColor : '#5c6575' }} />
          <div className="mt-2 text-2xl font-extrabold tabular-nums">{checkin ? checkin.score : '—'}</div>
          <div className="text-[11px] text-muted">{t('readiness')}</div>
        </Card>
      </div>

      {/* Readiness advice */}
      <Card className="mt-3 flex items-center gap-3 p-4" onClick={() => navigate('/fuel?tab=recovery')}>
        <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: checkin ? bandColor : '#2c3545' }} />
        <p className="flex-1 text-[14px] leading-snug">{checkin && band ? t(`rec_${band}`) : t('readinessNone')}</p>
        <ChevronRight size={18} className="text-dim" />
      </Card>

      <OfferBanner />

      <SectionHead title={t('quick')} />
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { icon: ScanLine, label: t('qAnalyze'), to: '/analyze', c: 'text-cyan bg-cyan/10' },
          { icon: Camera, label: t('qCamera'), to: '/analyze?tab=live', c: 'text-violet bg-violet/10' },
          { icon: Utensils, label: t('qMeal'), to: '/fuel?tab=nutrition', c: 'text-gold bg-gold/10' },
          { icon: HeartPulse, label: t('qCheckin'), to: '/fuel?tab=recovery', c: 'text-ok bg-ok/10' },
        ].map(({ icon: Icon, label, to, c }) => (
          <button key={to} onClick={() => navigate(to)} className="card flex flex-col items-center gap-2 px-1 py-3.5 hover:border-white/15">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${c}`}><Icon size={19} /></span>
            <span className="text-center text-[11.5px] font-medium leading-tight">{label}</span>
          </button>
        ))}
      </div>

      <SectionHead title={t('fuelToday')} action={<button className="text-xs font-semibold text-cyan" onClick={() => navigate('/fuel')}>{t('seeAll')}</button>} />
      <Card className="flex items-center gap-4 p-4" onClick={() => navigate('/fuel?tab=nutrition')}>
        <Ring value={kcal / targets.kcal} size={76} stroke={7} color="#f5b942">
          <div>
            <div className="text-[15px] font-extrabold tabular-nums leading-none">{fmtNum(kcal)}</div>
            <div className="mt-0.5 text-[10px] text-muted">/{fmtNum(targets.kcal)}</div>
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
    </div>
  )
}

export function Bar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular-nums">{Math.round(value)}<span className="text-dim">/{max}{unit}</span></span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: color }} />
      </div>
    </div>
  )
}
