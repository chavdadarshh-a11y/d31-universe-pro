import { Lock, Play, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp, effectivePlan } from '../store/app'
import { HERO_ROTATION } from '../data/gallery'
import { useT } from '../i18n'
import { Button, Badge } from '../components/ui'
import { LogoMark, Wordmark } from '../components/Brand'
import { HudTitle, Photo, mediaUrl, openClip } from '../components/hud'
import { navigate } from '../lib/router'
import { PROGRAM_BY_ID } from '../data/programs'
import { exOf, exName } from '../data/exercises'
import { estimateMinutes } from '../lib/plan'
import { startEmpty, startWorkout } from '../lib/workout'
import { canProgram } from '../lib/entitlements'
import { useKnowledge, visiblePosts } from '../lib/knowledge'
import { PostPanels } from './Knowledge'
import { IN_APP } from '../lib/appMode'

/** Darshan's Knowledge posts (auto-fed from Drive) as expanding panels. */
function HomeKnowledge() {
  const t = useT()
  const { data, loading } = useKnowledge()
  const posts = visiblePosts(data)
  if (loading && !posts.length) return <div className="mt-6 h-[380px] animate-pulse rounded-[22px] border border-white/5 bg-white/[0.03]" />
  if (!posts.length) return null
  return (
    <section data-testid="home-knowledge">
      <HudTitle tag="KNOWLEDGE" action={<button className="text-[11px] font-semibold text-cyan" onClick={() => navigate('/knowledge')}>{t('seeAll')}</button>}>{t('knowledge')}</HudTitle>
      <PostPanels posts={posts} />
      <p className="mt-2 text-center text-[11px] text-dim">{t('kTapHint')}</p>
    </section>
  )
}

export function Home() {
  const t = useT()
  const s = useApp()
  const plan = effectivePlan(s.membership)
  const program = s.activeProgramId ? PROGRAM_BY_ID[s.activeProgramId] : undefined
  const dayIdx = program ? (s.programDay[program.id] ?? 0) % program.days.length : 0
  const day = program?.days[dayIdx]
  const locked = program ? !canProgram(program.plan, plan) : false
  const name = s.profile.name || t('athleteLbl')

  const start = () => {
    if (!program || !day) return
    if (locked) return IN_APP ? s.showToast(t('memberOnly')) : navigate('/membership')
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
        <div className="dark-zone scanlines holo-sweep relative h-[300px]">
          <HeroRotator first={program?.media} alt={t('photoOf', { x: program?.name ?? 'D31' })} />
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
                  {day.items.map((it, k) => { const ex = exOf(it.exId); return ex.clip ? (
                    <button key={k} onClick={() => openClip({ name: ex.clip!, title: exName(ex, s.lang), exId: ex.id })} className="shrink-0 rounded-lg border border-gold/50 bg-[#04060c]/75 px-2 py-1 text-[11.5px] text-frost backdrop-blur shadow-[0_0_12px_-4px_rgba(247,197,72,0.7)]">
                      <span className="text-gold">▶</span> {exName(ex, s.lang)} <span className="text-cyan/80">{it.sets}×{it.target ?? it.reps ?? `${it.secs}s`}</span>
                    </button>
                  ) : (
                    <span key={k} className="shrink-0 rounded-lg border border-cyan/20 bg-[#04060c]/70 px-2 py-1 text-[11.5px] text-frost/90 backdrop-blur">
                      {exName(ex, s.lang)} <span className="text-cyan/80">{it.sets}×{it.target ?? it.reps ?? `${it.secs}s`}</span>
                    </span>
                  ) })}
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
              {locked ? <><Lock size={16} /> {IN_APP ? t('memberOnly') : t('unlockWith', { p: t(`plan_${program.plan}`) })}</> : <><Play size={16} fill="currentColor" /> {s.active ? t('resume') : t('start')}</>}
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => navigate('/train')}>{t('choose')}</Button>
          )}
          <Button variant="outline" onClick={free} aria-label={t('emptyWorkout')}><Plus size={16} /> {t('emptyWorkout')}</Button>
        </div>
      </section>

      {/* Darshan's posts — the main content of Today */}
      <HomeKnowledge />

      <footer className="mt-8 flex items-center justify-center gap-2 pb-2 font-mono text-[9.5px] uppercase tracking-[0.3em] text-dim">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold/50" />D31.UNIVERSE · {t('byDarshan')}<span className="h-px w-8 bg-gradient-to-l from-transparent to-gold/50" />
      </footer>
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

/** Crossfading hero of Darshan's shoot. Only the current and next photo are mounted; static under reduced motion. */
function HeroRotator({ first, alt }: { first?: string; alt: string }) {
  const list = [...new Set([first, ...HERO_ROTATION].filter(Boolean) as string[])]
  const [i, setI] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => { if (!document.hidden) setI((x) => (x + 1) % list.length) }, 6000)
    return () => clearInterval(id)
  }, [list.length])
  useEffect(() => { new Image().src = mediaUrl(list[(i + 1) % list.length]) }, [i, list])
  return (
    <>
      {list.map((name, k) => (k === i || k === (i - 1 + list.length) % list.length) && (
        <div key={name} className={`absolute inset-0 transition-opacity duration-[1400ms] ${k === i ? 'opacity-100' : 'opacity-0'}`}>
          <Photo smart name={name} alt={k === i ? alt : ''} eager={k === 0} className={k === i ? 'hero-drift' : ''} />
        </div>
      ))}
      <div className="absolute right-3 top-3 z-[3] flex gap-1">
        {list.map((n, k) => <button key={n} aria-label={`${k + 1}`} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-gold' : 'w-1.5 bg-white/35'}`} />)}
      </div>
    </>
  )
}
