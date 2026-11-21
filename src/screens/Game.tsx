/** Bodyweight GAME MODE: timed challenges, boss rounds, combos, XP / levels, streaks, badges. Only your own results. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Gamepad2, Trophy, Flame, Zap, Camera, Hand, Swords, Lock, Timer, Play, RotateCcw, Shield, Crown, Star } from 'lucide-react'
import { useApp } from '../store/app'
import { useSettings } from '../store/settings'
import { useT, type T } from '../i18n'
import { Button, Card, Header, Label } from '../components/ui'
import { GameCam } from '../components/GameCam'
import { navigate } from '../lib/router'
import { fmtClock, uid } from '../lib/util'
import { sfx } from '../lib/sfx'
import { cloud } from '../lib/cloud'
import { exName, exOf } from '../data/exercises'
import { romLevels, romText } from '../data/rom'
import {
  BADGES, CHALLENGES, COMBO_WINDOW_MS, challenge, comboMult, earnedBadges, levelOf, rankOf, statsOf, useGame, useMyGames,
  type BadgeId, type Challenge, type GameResult,
} from '../lib/game'
import type { RepEvent } from '../lib/repCam'
import type { WorkoutSession } from '../types'

export function GameHub() {
  const t = useT()
  const results = useMyGames()
  const st = useMemo(() => statsOf(results), [results])
  const lv = levelOf(st.xp)
  const earned = useMemo(() => earnedBadges(results), [results])
  const sound = useSettings((s) => s.sound)
  return (
    <div data-testid="game-hub">
      <Header title={t('gameTitle')} sub={t('gameSub')} back="#/train" right={<button onClick={() => useSettings.setState({ sound: !sound })} className="rounded-lg border border-white/10 px-2 py-1 font-mono text-[11px] text-muted">{sound ? '🔊' : '🔇'}</button>} />
      <div className="card hud-gold game-grid relative overflow-hidden p-4" data-testid="game-player">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-dashed border-gold/25 game-spin" />
        <div className="flex items-center gap-4">
          <div className="relative grid h-20 w-20 shrink-0 place-items-center">
            <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" /><circle cx="40" cy="40" r="34" fill="none" stroke="url(#g-gold)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(lv.into / lv.need) * 213.6} 213.6`} /></svg>
            <div className="text-center"><div className="font-mono text-[9px] text-dim">LVL</div><div className="font-display text-[28px] font-bold leading-none text-gold" data-testid="game-level">{lv.level}</div></div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="title-hud text-[16px] text-gold">{t(rankOf(lv.level))}</div>
            <div className="mt-0.5 font-mono text-[11.5px] text-muted">{lv.into} / {lv.need} XP · {t('gameTotalXp', { n: st.xp })}</div>
            <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
              <span className="flex items-center gap-1 text-[#fb923c]"><Flame size={14} /> {t('gameStreak', { n: st.streak })}</span>
              <span className="flex items-center gap-1 text-cyan"><Zap size={14} /> {t('gameReps', { n: st.totalReps })}</span>
            </div>
          </div>
        </div>
      </div>

      <Label className="mt-5">{t('gameChallenges')}</Label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {CHALLENGES.filter((c) => !c.rounds).map((c) => <ChallengeTile key={c.id} c={c} best={st.best[c.id]} t={t} locked={false} />)}
      </div>
      <Label className="mt-5">{t('gameBosses')}</Label>
      <div className="mt-2 space-y-2">
        {CHALLENGES.filter((c) => c.rounds).map((c) => <BossTile key={c.id} c={c} best={st.best[c.id]} t={t} locked={(c.minLevel ?? 0) > lv.level} />)}
      </div>

      <Label className="mt-5">{t('gameBadges')} · {earned.size}/{BADGES.length}</Label>
      <div className="mt-2 grid grid-cols-4 gap-2" data-testid="game-badges">
        {BADGES.map((b) => {
          const on = earned.has(b.id)
          return (
            <div key={b.id} className={`card flex flex-col items-center gap-1 p-2 text-center ${on ? '' : 'opacity-45 grayscale'}`} title={t(`badgeD_${b.id}`)}>
              <span className="grid h-10 w-10 place-items-center rounded-full text-[20px]" style={{ background: on ? `${b.color}22` : 'transparent', boxShadow: on ? `0 0 16px -4px ${b.color}` : undefined, border: `1px solid ${on ? b.color : 'rgba(255,255,255,0.12)'}` }}>{on ? b.icon : <Lock size={14} className="text-dim" />}</span>
              <span className="line-clamp-2 text-[10px] font-semibold leading-tight">{t(`badge_${b.id}`)}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-4 px-1 text-center text-[11px] leading-snug text-dim">{t('gameHonest')}</p>
    </div>
  )
}

function ChallengeTile({ c, best, t, locked }: { c: Challenge; best?: number; t: T; locked: boolean }) {
  return (
    <button data-testid={`game-${c.id}`} disabled={locked} onClick={() => navigate(`/train/game/${c.id}`)} className="card relative overflow-hidden p-3 text-left disabled:opacity-50">
      <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: c.color, boxShadow: `0 0 12px ${c.color}` }} />
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${c.color}1c`, color: c.color }}>{c.hold ? <Shield size={17} /> : <Timer size={17} />}</span>
        {c.cam && <Camera size={13} className="text-dim" />}
      </div>
      <div className="title-hud mt-2 text-[13px]" style={{ color: c.color }}>{t(`ch_${c.id}`)}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-muted">{t(`chD_${c.id}`)}</div>
      <div className="mt-2 font-mono text-[11px] text-frost/80"><Trophy size={11} className="mr-1 inline text-gold" />{best !== undefined ? (c.hold ? `${best}s` : `${best}`) : '—'}</div>
    </button>
  )
}

function BossTile({ c, best, t, locked }: { c: Challenge; best?: number; t: T; locked: boolean }) {
  const lang = useApp((s) => s.lang)
  return (
    <button data-testid={`game-${c.id}`} disabled={locked} onClick={() => navigate(`/train/game/${c.id}`)} className={`card relative w-full overflow-hidden p-4 text-left disabled:opacity-60 ${locked ? '' : 'game-glow'}`} style={{ borderColor: `${c.color}66` }}>
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: `radial-gradient(90% 120% at 100% 0%, ${c.color}33, transparent 60%)` }} />
      <div className="relative flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-[22px]" style={{ borderColor: `${c.color}88`, background: `${c.color}18`, color: c.color }}>{locked ? <Lock size={18} /> : <Swords size={20} />}</span>
        <div className="min-w-0 flex-1">
          <div className="title-hud text-[15px]" style={{ color: c.color }}>{t(`ch_${c.id}`)}</div>
          <div className="text-[11.5px] leading-snug text-muted">{c.rounds!.map((r) => `${r.reps} ${exName(exOf(r.exId), lang)}`).join(' · ')}</div>
          <div className="mt-1 font-mono text-[11px] text-frost/80">{locked ? t('gameNeedLevel', { n: c.minLevel ?? 0 }) : <>{fmtClock(c.sec ?? 0)} · <Crown size={11} className="mx-0.5 inline text-gold" />{best !== undefined ? fmtClock(best) : '—'}</>}</div>
        </div>
      </div>
    </button>
  )
}

type Phase = 'ready' | 'count' | 'play' | 'done'
type Fx = { id: string; text: string; color: string }

export function GamePlay({ id }: { id: string }) {
  const t = useT()
  const c = challenge(id)
  if (!c) return <div><Header title={t('gameTitle')} back="#/train/game" /><p className="text-muted">—</p></div>
  return <Play1 c={c} />
}

function Play1({ c }: { c: Challenge }) {
  const t = useT()
  const s = useApp()
  const results = useMyGames()
  const add = useGame((x) => x.add)
  const [phase, setPhase] = useState<Phase>('ready')
  const [useCam, setUseCam] = useState(false)
  const [count, setCount] = useState(3)
  const [now, setNow] = useState(Date.now())
  const [reps, setReps] = useState(0)
  const [round, setRound] = useState(0)
  const [roundReps, setRoundReps] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [xp, setXp] = useState(0)
  const [deep, setDeep] = useState(0)
  const [lastLevel, setLastLevel] = useState<number | null>(null)
  const [fx, setFx] = useState<Fx[]>([])
  const [bump, setBump] = useState(0)
  const [hitShake, setHitShake] = useState(0)
  const [result, setResult] = useState<{ r: GameResult; levelUp: boolean; newBadges: BadgeId[]; pb: boolean } | null>(null)
  const startAt = useRef(0)
  const lastRep = useRef(0)
  const perEx = useRef<Record<string, number>>({})
  const ended = useRef(false)

  const before = useMemo(() => statsOf(results), [results])
  const boss = !!c.rounds
  const total = boss ? c.rounds!.reduce((n, r) => n + r.reps, 0) : 0
  const cur = boss ? c.rounds![Math.min(round, c.rounds!.length - 1)] : { exId: c.exId, reps: 0, cam: c.cam }
  const camKind = cur.cam
  const elapsed = phase === 'play' || phase === 'done' ? Math.max(0, (now - startAt.current) / 1000) : 0
  const left = c.sec ? Math.max(0, c.sec - elapsed) : 0

  // clock
  useEffect(() => {
    if (phase !== 'count' && phase !== 'play') return
    const iv = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(iv)
  }, [phase])
  // countdown
  useEffect(() => {
    if (phase !== 'count') return
    if (count <= 0) { sfx.go(); startAt.current = Date.now(); lastRep.current = 0; setNow(Date.now()); setPhase('play'); return }
    sfx.tick()
    const to = setTimeout(() => setCount((x) => x - 1), 800)
    return () => clearTimeout(to)
  }, [phase, count])
  // time up
  useEffect(() => {
    if (phase === 'play' && c.sec && left <= 0) end(boss ? false : undefined)
    if (phase === 'play' && c.sec && !c.hold && left > 0 && left <= 3.05 && Math.abs(left - Math.round(left)) < 0.06) sfx.tick()
  })

  const pop = (text: string, color: string) => {
    const f = { id: uid(), text, color }
    setFx((x) => [...x.slice(-5), f])
    setTimeout(() => setFx((x) => x.filter((y) => y.id !== f.id)), 900)
  }

  const rep = (e?: RepEvent) => {
    if (phase !== 'play' || ended.current) return
    const tnow = Date.now()
    if (!e && tnow - lastRep.current < 280) return // a double-tap is not two reps
    const nextCombo = lastRep.current && tnow - lastRep.current <= COMBO_WINDOW_MS ? combo + 1 : 1
    lastRep.current = tnow
    const mult = comboMult(nextCombo)
    const lvl = e?.level ?? null
    const depthBonus = cur.cam === 'squat' && lvl !== null ? lvl : 0 // parallel +1, deep +2
    const gain = Math.round(2 * mult + depthBonus + (e ? 1 : 0))
    setCombo(nextCombo); setBestCombo((b) => Math.max(b, nextCombo)); setXp((x) => x + gain)
    setReps((r) => r + 1); setBump((b) => b + 1)
    perEx.current[cur.exId] = (perEx.current[cur.exId] ?? 0) + 1
    if (cur.cam === 'squat' && lvl === 2) setDeep((d) => d + 1)
    if (cur.cam === 'squat' && e) setLastLevel(lvl)
    pop(`+${gain} XP`, mult > 1 ? '#f7c548' : '#22d3ee')
    if (nextCombo > 1 && nextCombo % 5 === 0) { sfx.combo(); pop(`COMBO ×${comboMult(nextCombo)}`, '#fb923c') } else sfx.rep(nextCombo)
    if (boss) {
      sfx.hit(); setHitShake((h) => h + 1)
      const rr = roundReps + 1
      if (rr >= cur.reps) {
        if (round + 1 >= c.rounds!.length) { setRoundReps(rr); end(true, gain, lvl === 2 && cur.cam === 'squat' ? 1 : 0); return }
        setRound(round + 1); setRoundReps(0); sfx.level(); pop(t('gameRoundClear'), '#a3e635')
      } else setRoundReps(rr)
    }
  }

  const end = (win?: boolean, extraXp = 0, extraDeep = 0) => {
    if (ended.current) return
    ended.current = true
    const dur = Math.round((Date.now() - startAt.current) / 1000)
        const finalReps = boss ? Object.values(perEx.current).reduce((n, x) => n + x, 0) : c.hold ? 0 : reps
    const pb = !boss && !c.hold ? finalReps > (before.best[c.id] ?? 0) && finalReps > 0 : c.hold ? dur > (before.best[c.id] ?? 0) : !!win && dur < (before.best[c.id] ?? Infinity)
    const bonus = (c.hold ? Math.floor(dur / 2) : 0) + (win ? (c.id === 'boss2' ? 200 : 100) : 0) + (pb ? 25 : 0)
    const r: Omit<GameResult, 'id'> = { at: new Date().toISOString(), challenge: c.id, score: c.hold ? dur : finalReps, xp: xp + extraXp + bonus, bestCombo: Math.max(bestCombo, combo + (extraXp ? 1 : 0)), deepReps: deep + extraDeep, camera: useCam, win: boss ? !!win : undefined, durationSec: dur, perEx: c.hold ? { [c.exId]: dur } : { ...perEx.current } }
    const oldBadges = earnedBadges(results)
    const saved = add(r)
    const after = [saved, ...results]
    const newBadges = Array.from(earnedBadges(after)).filter((b) => !oldBadges.has(b))
    const levelUp = levelOf(before.xp + saved.xp).level > levelOf(before.xp).level
    // also into the normal workout history (so it counts in Progress)
    if ((c.hold && dur > 0) || finalReps > 0) {
      const session: WorkoutSession = {
        id: uid(), name: `${t('gameTitle')} · ${t(`ch_${c.id}`)}`, startedAt: new Date(startAt.current).toISOString(), durationSec: dur, volumeKg: 0, source: useCam ? 'camera' : 'player',
        exercises: c.hold ? [{ exId: c.exId, sets: [{ reps: 0, kg: 0, secs: dur, done: true }] }] : Object.entries(perEx.current).map(([exId, n]) => ({ exId, sets: [{ reps: n, kg: 0, done: true }] })),
      }
      s.addSession(session); void cloud.session(session)
    }
    if (boss) { if (win) sfx.win(); else sfx.lose() } else if (levelUp) sfx.level(); else sfx.win()
    setResult({ r: saved, levelUp, newBadges, pb })
    setPhase('done')
  }

  const restart = () => {
    ended.current = false; perEx.current = {}
    setReps(0); setRound(0); setRoundReps(0); setCombo(0); setBestCombo(0); setXp(0); setDeep(0); setLastLevel(null); setResult(null); setCount(3); setPhase('count')
  }

  // keyboard: space = rep (desktop testing / bluetooth clickers)
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.code === 'Space' && phase === 'play' && !useCam && !c.hold) { e.preventDefault(); rep() } }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  if (phase === 'done' && result) return <GameResultView t={t} c={c} res={result} onAgain={restart} totalXp={before.xp + result.r.xp} />

  const hp = boss ? Math.max(0, total - Object.values(perEx.current).reduce((n, x) => n + x, 0)) : 0
  const mult = comboMult(combo)
  const color = c.color
  const levels = cur.cam === 'squat' ? romLevels('bodyweight-squat') : null

  return (
    <div data-testid="game-play">
      <Header title={t(`ch_${c.id}`)} sub={boss ? t('gameBossSub') : t(`chD_${c.id}`)} back="#/train/game" />

      {phase === 'ready' && (
        <div className="space-y-3">
          <Card className="p-4">
            <div className="title-hud text-[14px]" style={{ color }}>{t('gameHow')}</div>
            <p className="mt-1 text-[13px] leading-snug text-muted">{t(boss ? 'gameHowBoss' : c.hold ? 'gameHowHold' : 'gameHowTimed', { s: c.sec ?? 0 })}</p>
            {boss && <ol className="mt-2 space-y-1 text-[13px]">{c.rounds!.map((r, i) => <li key={i} className="flex gap-2"><span className="font-mono text-gold">R{i + 1}</span>{r.reps} × {exName(exOf(r.exId), s.lang)}{r.cam && <Camera size={12} className="mt-1 text-dim" />}</li>)}</ol>}
          </Card>
          {!c.hold && (c.cam || c.rounds?.some((r) => r.cam)) && (
            <div className="grid grid-cols-2 gap-2" role="tablist">
              <button role="tab" aria-selected={!useCam} onClick={() => setUseCam(false)} data-testid="game-input-tap" className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-[13px] font-bold ${!useCam ? 'border-cyan/60 bg-cyan/12 text-cyan' : 'border-white/10 text-muted'}`}><Hand size={16} /> {t('gameTap')}</button>
              <button role="tab" aria-selected={useCam} onClick={() => setUseCam(true)} data-testid="game-input-cam" className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-[13px] font-bold ${useCam ? 'border-violet/60 bg-violet/12 text-violet' : 'border-white/10 text-muted'}`}><Camera size={16} /> {t('gameCam')}</button>
            </div>
          )}
          {useCam && <p className="px-1 text-[12px] leading-snug text-muted">{t('gameCamTip')}</p>}
          {useCam && camKind && <GameCam kind={camKind} active={false} onRep={() => {}} />}
          <Button size="lg" className="w-full" onClick={() => { sfx.prime(); restart() }} data-testid="game-start"><Play size={18} fill="currentColor" /> {t('gameStart')}</Button>
        </div>
      )}

      {(phase === 'count' || phase === 'play') && (
        <div className="space-y-3">
          {boss && (
            <div key={hitShake} className={`card p-3 ${hitShake ? 'game-shake' : ''}`} data-testid="game-boss-hp">
              <div className="mb-1.5 flex items-center justify-between font-mono text-[11px]"><span className="flex items-center gap-1 font-bold" style={{ color }}><Swords size={13} /> {t(`ch_${c.id}`)}</span><span className="text-muted">HP {hp}/{total}</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${(hp / total) * 100}%`, background: `linear-gradient(90deg, ${color}, #ef4444)`, boxShadow: `0 0 14px ${color}` }} /></div>
              <div className="mt-2 flex gap-1">{c.rounds!.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < round ? 'bg-ok' : i === round ? 'bg-gold' : 'bg-white/10'}`} />)}</div>
              <div className="mt-1.5 text-[12.5px]"><span className="font-mono text-gold">R{round + 1}</span> · {cur.reps - roundReps} × {exName(exOf(cur.exId), s.lang)}</div>
            </div>
          )}
          <div className="card game-grid relative overflow-hidden p-4 text-center" style={{ borderColor: `${color}55` }}>
            <div className="flex items-center justify-between font-mono text-[12px]">
              <span className="flex items-center gap-1" style={{ color }}><Timer size={14} /> {c.hold ? fmtClock(Math.floor(elapsed)) : fmtClock(Math.ceil(left))}</span>
              <span className="flex items-center gap-1 text-gold"><Star size={13} /> {xp} XP</span>
            </div>
            {c.sec && !c.hold && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${(left / c.sec) * 100}%`, background: color }} /></div>}
            <div className="relative mt-3 h-[120px]">
              {phase === 'count'
                ? <div key={count} className="game-in font-display text-[96px] font-bold leading-[120px]" style={{ color, textShadow: `0 0 30px ${color}` }}>{count > 0 ? count : 'GO'}</div>
                : <div key={bump} className={`font-display text-[100px] font-bold leading-[120px] tabular-nums ${bump ? 'game-pop' : ''}`} style={{ color, textShadow: `0 0 34px ${color}aa` }} data-testid="game-reps">{c.hold ? Math.floor(elapsed) : boss ? roundReps : reps}</div>}
              {fx.map((f) => <span key={f.id} className="game-float top-6 font-mono text-[15px] font-bold" style={{ color: f.color, textShadow: `0 0 10px ${f.color}` }}>{f.text}</span>)}
            </div>
            {!c.hold && (
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className={`rounded-full px-3 py-1 font-mono text-[12px] font-bold ${combo >= 5 ? 'bg-[#fb923c]/20 text-[#fb923c] game-glow' : 'bg-white/[0.06] text-muted'}`} data-testid="game-combo"><Flame size={12} className="mr-1 inline" />{t('gameCombo')} {combo} · ×{mult}</span>
                {levels && lastLevel !== null && <span className="rounded-full bg-ok/15 px-3 py-1 font-mono text-[12px] font-bold text-ok">{romText(levels[lastLevel].name, s.lang)}</span>}
              </div>
            )}
          </div>

          {phase === 'play' && c.hold && <Button size="lg" variant="danger" className="h-16 w-full text-[17px]" onClick={() => end()} data-testid="game-drop">{t('gameDropped')}</Button>}
          {phase === 'play' && !c.hold && useCam && camKind && <GameCam kind={camKind} active onRep={(e) => rep(e)} />}
          {phase === 'play' && !c.hold && (!useCam || !camKind) && (
            <button onPointerDown={(e) => { e.preventDefault(); rep() }} data-testid="game-tap" className="relative mx-auto grid h-44 w-44 place-items-center rounded-full border-2 font-display text-[22px] font-bold tracking-wider active:scale-95" style={{ borderColor: color, color, background: `radial-gradient(circle, ${color}33, transparent 70%)`, boxShadow: `0 0 40px -8px ${color}, inset 0 0 30px -10px ${color}` }}>
              <span className="absolute inset-2 rounded-full border border-dashed opacity-40 game-spin" style={{ borderColor: color }} />
              {t('gameTapRep')}
            </button>
          )}
          {phase === 'play' && !c.hold && <Button variant="ghost" className="w-full" onClick={() => end(boss ? false : undefined)}>{t('gameStop')}</Button>}
        </div>
      )}
    </div>
  )
}

function GameResultView({ t, c, res, onAgain, totalXp }: { t: T; c: Challenge; res: { r: GameResult; levelUp: boolean; newBadges: BadgeId[]; pb: boolean }; onAgain: () => void; totalXp: number }) {
  const lv = levelOf(totalXp)
  const boss = !!c.rounds
  const title = boss ? (res.r.win ? t('gameVictory') : t('gameDefeat')) : res.pb ? t('gameNewBest') : t('gameDone')
  const color = boss && !res.r.win ? '#ef4444' : '#f7c548'
  return (
    <div data-testid="game-result">
      <Header title={t(`ch_${c.id}`)} back="#/train/game" />
      <div className="card hud-gold game-grid relative overflow-hidden p-5 text-center">
        <div className="game-in title-hud text-[26px]" style={{ color, textShadow: `0 0 24px ${color}` }}>{title}</div>
        <div className="mt-3 font-display text-[64px] font-bold leading-none tabular-nums text-frost">{c.hold ? `${res.r.score}s` : boss ? fmtClock(res.r.durationSec) : res.r.score}</div>
        <div className="mt-1 text-[12px] text-muted">{c.hold ? t('gameHeld') : boss ? t('gameTime') : t('reps')}</div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="card-2 p-2"><div className="font-mono text-[17px] font-bold text-gold">+{res.r.xp}</div><div className="text-[10.5px] text-muted">XP</div></div>
          <div className="card-2 p-2"><div className="font-mono text-[17px] font-bold text-[#fb923c]">{res.r.bestCombo}</div><div className="text-[10.5px] text-muted">{t('gameBestCombo')}</div></div>
          <div className="card-2 p-2"><div className="font-mono text-[17px] font-bold text-ok">{res.r.deepReps}</div><div className="text-[10.5px] text-muted">{t('gameDeep')}</div></div>
        </div>
        {res.levelUp && <div className="game-in game-glow mt-4 rounded-2xl border border-gold/50 bg-gold/10 p-3 font-display text-[18px] font-bold text-gold" data-testid="game-levelup">⬆ {t('gameLevelUp', { n: lv.level })} · {t(rankOf(lv.level))}</div>}
        {res.newBadges.length > 0 && (
          <div className="mt-4">
            <div className="label">{t('gameNewBadges')}</div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">{res.newBadges.map((b) => { const B = BADGES.find((x) => x.id === b)!; return <span key={b} className="game-in rounded-full border px-3 py-1 text-[12.5px] font-bold" style={{ borderColor: B.color, color: B.color, background: `${B.color}18` }}>{B.icon} {t(`badge_${b}`)}</span> })}</div>
          </div>
        )}
        <p className="mt-4 text-[11.5px] text-dim">{t('gameSavedHistory')}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => navigate('/train/game')}><Gamepad2 size={16} /> {t('gameHubBtn')}</Button>
        <Button onClick={onAgain} data-testid="game-again"><RotateCcw size={16} /> {t('gameAgain')}</Button>
      </div>
    </div>
  )
}
