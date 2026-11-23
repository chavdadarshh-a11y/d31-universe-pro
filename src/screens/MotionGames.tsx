/** Camera MOTION GAMES: WAVE RIDE · DEPTH METER · SQUAT CHECK. Pose runs on the phone; best scores stay on it. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Camera, ChevronRight, FlipHorizontal2, Gamepad2, Heart, Pause, Play, RotateCcw, ShieldCheck, Trophy, X } from 'lucide-react'
import { useApp } from '../store/app'
import { useT, type T } from '../i18n'
import type { StringKey } from '../i18n/strings'
import { Button, Card, Header, Label } from '../components/ui'
import { MotionCam, type CamState, type FrameFn } from '../components/MotionCam'
import { navigate } from '../lib/router'
import { sfx } from '../lib/sfx'
import { cloud } from '../lib/cloud'
import { uid } from '../lib/util'
import { currentAccountId } from '../lib/accountKeys'
import { depthColor, drawSkeleton, drawSquatOverlay } from '../lib/motionDraw'
import {
  DepthGame, PUSH_TARGET_PCT, SquatGame, WaveGame, trackAt, waveLen, waveParams,
  type DepthSnap, type SquatSnap, type WaveMove, type WaveSnap,
} from '../lib/motionGames'
import type { Pt } from '../lib/poseFilter'
import type { WorkoutSession } from '../types'

export const MOTION_IDS = ['wave', 'depth', 'squatcheck'] as const
export type MotionId = (typeof MOTION_IDS)[number]
export const isMotion = (id: string): id is MotionId => (MOTION_IDS as readonly string[]).includes(id)
const COLOR: Record<MotionId, string> = { wave: '#22d3ee', depth: '#f7c548', squatcheck: '#a3e635' }

// ── local bests (per account) ──
type Best = Partial<Record<string, number>>
const useMotion = create<{ byAcc: Record<string, Best>; set: (k: string, v: number, lower?: boolean) => boolean }>()(persist((set, get) => ({
  byAcc: {},
  set: (k, v, lower) => {
    const a = currentAccountId() ?? 'guest'
    const cur = get().byAcc[a]?.[k]
    const better = cur === undefined || (lower ? v < cur : v > cur)
    if (better) set({ byAcc: { ...get().byAcc, [a]: { ...get().byAcc[a], [k]: v } } })
    return better
  },
}), { name: 'd31-motion-v1' }))
const EMPTY: Best = {}
const useBest = () => useMotion((s) => s.byAcc[currentAccountId() ?? 'guest'] ?? EMPTY)
const fmtS = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// ── hub cards ──
export function MotionTiles() {
  const t = useT()
  const best = useBest()
  const items: { id: MotionId; need: StringKey; best: string }[] = [
    { id: 'wave', need: 'mgUpperOrFull', best: best.wave_pushup !== undefined || best.wave_squat !== undefined ? String(Math.max(best.wave_pushup ?? 0, best.wave_squat ?? 0)) : '—' },
    { id: 'depth', need: 'mgUpper', best: best.depth !== undefined ? `${best.depth} ${t('reps').toLowerCase()}` : '—' },
    { id: 'squatcheck', need: 'mgFull', best: best.squat_10 !== undefined ? fmtS(best.squat_10) : '—' },
  ]
  return (
    <div className="mt-2 space-y-2" data-testid="motion-tiles">
      {items.map(({ id, need, best: b }) => {
        const c = COLOR[id]
        return (
          <button key={id} data-testid={`motion-card-${id}`} onClick={() => navigate(`/train/game/${id}`)} className="card relative flex w-full items-center gap-3 overflow-hidden p-3 text-left" style={{ borderColor: `${c}55` }}>
            <span className="pointer-events-none absolute inset-0 opacity-50" style={{ background: `radial-gradient(80% 140% at 0% 50%, ${c}22, transparent 60%)` }} />
            <span className="dark-zone relative grid h-[68px] w-[92px] shrink-0 place-items-center overflow-hidden rounded-2xl border bg-[#060a12]" style={{ borderColor: `${c}66` }}><MiniArt id={id} /></span>
            <span className="relative min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="title-hud text-[14.5px]" style={{ color: c }}>{t(`mg_${id}` as StringKey)}</span>
                <span className="rounded-full border border-gold/50 bg-gold/10 px-1.5 py-px font-mono text-[9px] font-bold text-gold">{t('newTag')}</span>
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{t(`mgD_${id}` as StringKey)}</span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-frost/80">
                <span className="flex items-center gap-1"><Camera size={11} className="text-cyan" />{t(need)}</span>
                <span className="flex items-center gap-1"><Trophy size={11} className="text-gold" />{b}</span>
              </span>
            </span>
            <ChevronRight size={16} className="relative shrink-0 text-dim" />
          </button>
        )
      })}
    </div>
  )
}
function MiniArt({ id }: { id: MotionId }) {
  if (id === 'wave') return (
    <svg viewBox="0 0 92 68" className="h-full w-full"><path d="M0 34 Q11.5 8 23 34 T46 34 T69 34 T92 34" fill="none" stroke="#22d3ee" strokeOpacity="0.25" strokeWidth="14" /><path d="M0 34 Q11.5 8 23 34 T46 34 T69 34 T92 34" fill="none" stroke="#22d3ee" strokeWidth="2.5" className="mg-dash" /><circle cx="30" cy="27" r="5" fill="#a3e635" className="mg-bob" /><line x1="30" y1="6" x2="30" y2="62" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" /></svg>
  )
  if (id === 'depth') return (
    <svg viewBox="0 0 92 68" className="h-full w-full"><rect x="10" y="12" width="26" height="44" rx="7" fill="#0b1220" stroke="#ffffff22" /><text x="23" y="38" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff" fontFamily="Orbitron, sans-serif">12</text><rect x="58" y="6" width="20" height="56" rx="10" fill="#0b1220" stroke="#ffffff22" /><rect x="60" y="8" width="16" height="52" rx="8" fill="url(#mgfill)" className="mg-fill" /><line x1="55" y1="16" x2="81" y2="16" stroke="#fff" strokeWidth="2" /><defs><linearGradient id="mgfill" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ef4444" /><stop offset="0.55" stopColor="#facc15" /><stop offset="1" stopColor="#34d399" /></linearGradient></defs></svg>
  )
  return (
    <svg viewBox="0 0 92 68" className="h-full w-full"><circle cx="24" cy="40" r="15" fill="none" stroke="#ffffff22" strokeWidth="4" /><circle cx="24" cy="40" r="15" fill="none" stroke="#a3e635" strokeWidth="4" strokeDasharray="70 94" strokeLinecap="round" transform="rotate(-90 24 40)" /><text x="24" y="45" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="Orbitron, sans-serif">10</text><g className="mg-squat" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none"><circle cx="66" cy="14" r="4" fill="#fff" stroke="none" /><path d="M66 18 L66 34 M66 34 L58 46 L64 58 M66 34 L74 46 L70 58 M66 22 L76 28" /></g><line x1="54" y1="40" x2="82" y2="40" stroke="#34d399" strokeWidth="3" strokeLinecap="round" /></svg>
  )
}

// ── one game screen ──
type Stage = 'ready' | 'live' | 'done'
type Result = { id: MotionId; main: number; mainLabel: StringKey; isTime?: boolean; best?: number; bestIsTime?: boolean; pb: boolean; title: StringKey; stats: { k: StringKey; v: string; c?: string }[] }

export function MotionPlay({ id }: { id: MotionId }) {
  const t = useT()
  const best = useBest()
  const [stage, setStage] = useState<Stage>('ready')
  const [mirror, setMirror] = useState(true)
  const [move, setMove] = useState<WaveMove>('pushup')
  const [target, setTarget] = useState(10)
  const [result, setResult] = useState<Result | null>(null)
  const [run, setRun] = useState(0)
  const c = COLOR[id]
  const start = () => { sfx.prime(); setResult(null); setRun((r) => r + 1); setStage('live') }

  if (stage === 'live') {
    const end = (r: Result | null) => { if (r) { setResult(r); setStage('done') } else navigate('/train/game') }
    return <LiveShell key={run} id={id} move={move} target={target} mirror={mirror} setMirror={setMirror} onEnd={end} />
  }
  if (stage === 'done' && result) return <EndView t={t} r={result} onAgain={start} />

  const need: StringKey = id === 'depth' || (id === 'wave' && move === 'pushup') ? 'mgUpper' : 'mgFull'
  const bestTxt = id === 'wave' ? best[`wave_${move}`] : id === 'depth' ? best.depth : best[`squat_${target}`]
  return (
    <div data-testid="motion-ready" data-game={id}>
      <Header title={t(`mg_${id}` as StringKey)} sub={t(`mgD_${id}` as StringKey)} back="#/train/game" />
      <div className="card game-grid relative overflow-hidden p-4" style={{ borderColor: `${c}55` }}>
        <div className="flex items-center gap-3">
          <span className="dark-zone grid h-[74px] w-[100px] shrink-0 place-items-center overflow-hidden rounded-2xl border bg-[#060a12]" style={{ borderColor: `${c}66` }}><MiniArt id={id} /></span>
          <div className="min-w-0">
            <div className="title-hud text-[13px]" style={{ color: c }}>{t('gameHow')}</div>
            <p className="mt-1 text-[12.5px] leading-snug text-muted">{t(`mgHow_${id}` as StringKey)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px]">
          <span className="flex items-center gap-1 rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-cyan"><Camera size={12} /> {t(need)}</span>
          <span className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-gold" data-testid="motion-best"><Trophy size={12} /> {t('mgBest')}: {bestTxt === undefined ? '—' : id === 'squatcheck' ? fmtS(bestTxt) : bestTxt}</span>
        </div>
      </div>

      {id === 'wave' && (
        <>
          <Label className="mt-4">{t('mgMove')}</Label>
          <div className="mt-2 grid grid-cols-2 gap-2" role="tablist">
            {(['pushup', 'squat'] as const).map((m) => (
              <button key={m} role="tab" aria-selected={move === m} data-testid={`motion-move-${m}`} onClick={() => setMove(m)} className={`h-11 rounded-xl border text-[13px] font-bold ${move === m ? 'border-cyan/60 bg-cyan/12 text-cyan' : 'border-white/10 text-muted'}`}>{t(m === 'pushup' ? 'camPushup' : 'camSquat')}</button>
            ))}
          </div>
        </>
      )}
      {id === 'squatcheck' && (
        <>
          <Label className="mt-4">{t('mgTarget')}</Label>
          <div className="mt-2 grid grid-cols-4 gap-2" role="tablist">
            {[5, 10, 15, 20].map((n) => (
              <button key={n} role="tab" aria-selected={target === n} data-testid={`motion-target-${n}`} onClick={() => setTarget(n)} className={`h-11 rounded-xl border font-mono text-[14px] font-bold ${target === n ? 'border-lime/60 bg-lime/12 text-lime' : 'border-white/10 text-muted'}`}>{n}</button>
            ))}
          </div>
        </>
      )}

      <Card className="mt-4 p-3">
        <div className="title-hud text-[12px] text-frost/90">{t('mgSetup')}</div>
        <ul className="mt-1.5 space-y-1 text-[12.5px] leading-snug text-muted">
          <li>• {t(`mgSetup_${id === 'wave' ? `wave_${move}` : id}` as StringKey)}</li>
          <li>• {t('mgSetupLight')}</li>
          <li className="flex items-start gap-1.5"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-ok" />{t('mgPrivacy')}</li>
        </ul>
        <button onClick={() => setMirror(!mirror)} data-testid="motion-mirror-ready" aria-pressed={mirror} className={`mt-3 flex h-10 w-full items-center justify-between rounded-xl border px-3 text-[13px] ${mirror ? 'border-cyan/40 text-cyan' : 'border-white/10 text-muted'}`}>
          <span className="flex items-center gap-2"><FlipHorizontal2 size={15} /> {t('mgMirror')}</span><span className="font-mono text-[11px]">{mirror ? 'ON' : 'OFF'}</span>
        </button>
      </Card>
      <Button size="lg" className="mt-4 w-full" onClick={start} data-testid="motion-start"><Camera size={18} /> {t('mgStartCam')}</Button>
      <p className="mt-3 px-1 text-center text-[11px] leading-snug text-dim">{t('gameHonest')}</p>
    </div>
  )
}

// ── full-screen live shell (camera, top bar, visibility, pause) ──
type Ctl = { frame: FrameFn; finish: () => Result | null }
function LiveShell({ id, move, target, mirror, setMirror, onEnd }: { id: MotionId; move: WaveMove; target: number; mirror: boolean; setMirror: (v: boolean) => void; onEnd: (r: Result | null) => void }) {
  const t = useT()
  const [paused, setPaused] = useState(false)
  const [cam, setCam] = useState<CamState>('loading')
  const pausedRef = useRef(false)
  pausedRef.current = paused
  const ctl = useRef<Ctl | null>(null)
  // keep the screen awake while playing
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    void (navigator as unknown as { wakeLock?: { request: (k: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen').then((l) => { lock = l }).catch(() => {})
    return () => { void lock?.release().catch(() => {}) }
  }, [])
  // Android back / hash change unmounts this → camera stops in MotionCam cleanup
  const onFrame: FrameFn = (lm, dt, aspect, ctx, w, h) => ctl.current?.frame(lm, pausedRef.current ? 0 : dt, aspect, ctx, w, h)
  const finish = () => onEnd(ctl.current?.finish() ?? null)
  const game = id === 'wave' ? <WaveHud ctl={ctl} move={move} onOver={finish} paused={paused} />
    : id === 'depth' ? <DepthHud ctl={ctl} paused={paused} onFinish={finish} />
    : <SquatHud ctl={ctl} target={target} onOver={finish} paused={paused} />
  return (
    <div className="dark-zone fixed inset-0 z-[80] select-none overflow-hidden bg-black text-frost" data-testid="motion-live" data-game={id}>
      <MotionCam mirror={mirror} onFrame={onFrame} onState={setCam} />
      {cam === 'running' && game}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-[calc(env(safe-area-inset-top)+28px)]">
        <button aria-label={t('mgExit')} onClick={() => onEnd(null)} data-testid="motion-exit" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/50"><X size={18} /></button>
        <div className="title-hud min-w-0 flex-1 truncate text-[13px]" style={{ color: COLOR[id] }}>{t(`mg_${id}` as StringKey)}</div>
        <button aria-label={t('mgMirror')} aria-pressed={mirror} onClick={() => setMirror(!mirror)} data-testid="motion-mirror" className={`grid h-10 w-10 place-items-center rounded-full border bg-black/50 ${mirror ? 'border-cyan/60 text-cyan' : 'border-white/15 text-white/70'}`}><FlipHorizontal2 size={17} /></button>
        {cam === 'running' && <button aria-label={t('mgPause')} onClick={() => setPaused(true)} data-testid="motion-pause" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/50"><Pause size={17} fill="currentColor" /></button>}
      </div>
      {paused && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/75 p-8 backdrop-blur-sm" data-testid="motion-paused">
          <div className="title-hud mb-2 text-[26px] text-gold">{t('mgPaused')}</div>
          <Button size="lg" className="w-full max-w-[280px]" onClick={() => setPaused(false)} data-testid="motion-resume"><Play size={17} fill="currentColor" /> {t('mgResume')}</Button>
          <Button variant="outline" className="w-full max-w-[280px]" onClick={finish} data-testid="motion-finish">{t('mgEndGame')}</Button>
          <Button variant="ghost" className="w-full max-w-[280px]" onClick={() => onEnd(null)}>{t('mgExit')}</Button>
        </div>
      )}
    </div>
  )
}

/** throttled HUD state: the game runs every frame, React re-renders ≤ ~16×/s (or at once on an event) */
function useHud<S extends { events: string[] }>() {
  const [hud, setHud] = useState<S | null>(null)
  const last = useRef(0)
  const push = (s: S) => { const now = performance.now(); if (s.events.length || now - last.current > 60) { last.current = now; setHud(s) } }
  return [hud, push] as const
}
const Banner = ({ children, tone = 'gold', testid }: { children: ReactNode; tone?: 'gold' | 'bad' | 'ok'; testid?: string }) => (
  <div data-testid={testid} className={`rounded-2xl border px-4 py-2.5 text-center text-[13.5px] font-semibold backdrop-blur-md ${tone === 'bad' ? 'border-bad/50 bg-bad/20 text-white' : tone === 'ok' ? 'border-ok/50 bg-ok/15 text-white' : 'border-gold/45 bg-black/60 text-gold'}`}>{children}</div>
)
function CountBig({ n }: { n: number }) {
  return <div key={n} className="game-in font-display text-[110px] font-bold leading-none text-gold" style={{ textShadow: '0 0 40px rgba(247,197,72,0.8)' }} data-testid="motion-count">{n > 0 ? n : 'GO'}</div>
}
function PositionCheck({ t, need, visible, testid }: { t: T; need: 'upper' | 'full'; visible: boolean; testid: string }) {
  const parts: StringKey[] = need === 'upper' ? ['mgPartShoulders', 'mgPartElbows', 'mgPartWrists'] : ['mgPartShoulders', 'mgPartHips', 'mgPartKnees', 'mgPartAnkles']
  return (
    <div className="w-full max-w-[320px] rounded-3xl border border-cyan/35 bg-black/60 p-4 text-center backdrop-blur-md" data-testid={testid}>
      <div className="title-hud text-[13px] text-cyan">{t('mgGetReady')}</div>
      <div className="mt-1 text-[15px] font-bold">{t(need === 'upper' ? 'mgShowUpper' : 'mgShowFull')}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {parts.map((p) => <span key={p} className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${visible ? 'border-ok/50 bg-ok/15 text-ok' : 'border-white/15 text-white/60'}`}>{visible ? '✓ ' : ''}{t(p)}</span>)}
      </div>
      <div className={`mt-3 text-[12px] ${visible ? 'text-ok' : 'text-gold'}`}>{visible ? t('mgHoldStill') : t(need === 'upper' ? 'mgMoveBackUpper' : 'mgMoveBackFull')}</div>
    </div>
  )
}

// ── WAVE RIDE ──
function WaveHud({ ctl, move, onOver, paused }: { ctl: React.RefObject<Ctl | null>; move: WaveMove; onOver: () => void; paused: boolean }) {
  const t = useT()
  const g = useMemo(() => new WaveGame(move), [move])
  const [hud, push] = useHud<WaveSnap>()
  const panel = useRef<HTMLCanvasElement>(null)
  const done = useRef(false)
  const best = useBest()[`wave_${move}`] ?? 0
  // test hook only (synthetic pose runs): lets the pose script follow the live track
  if (typeof window.__d31PoseSource === 'function') (window as unknown as { __d31Motion?: unknown }).__d31Motion = { target: (lag: number) => trackAt(g.wave, g.tau, -lag).v, phase: () => g.phase }
  ctl.current = {
    frame: (lm, dt, _aspect, ctx, w, h) => {
      if (lm) drawSkeleton(ctx, lm, w, h, move === 'pushup' ? 'upper' : 'full')
      const s = g.update(lm, dt)
      for (const e of s.events) {
        if (e === 'tick' || e === 'calibStep') sfx.tick()
        else if (e === 'go') sfx.go()
        else if (e === 'calibFail') sfx.cue()
        else if (e === 'wipe') sfx.hit()
        else if (e === 'wave') sfx.level()
        else if (e === 'over') sfx.lose()
      }
      drawWavePanel(panel.current, g, s)
      push(s)
      if (s.phase === 'over' && !done.current) { done.current = true; setTimeout(onOver, 900) }
    },
    finish: () => {
      g.finish()
      const k = `wave_${move}`
      const prev = useMotion.getState().byAcc[currentAccountId() ?? 'guest']?.[k]
      const pb = g.score > 0 && useMotion.getState().set(k, g.score)
      const s = g.update(null, 0)
      return {
        id: 'wave', main: g.score, mainLabel: 'mgScore', best: Math.max(prev ?? 0, g.score), pb, title: pb ? 'gameNewBest' : 'mgGameOver',
        stats: [
          { k: 'mgWavesCleared', v: String(s.waves), c: '#22d3ee' },
          { k: 'mgBestCombo', v: `×${s.bestMult}`, c: '#f7c548' },
          { k: 'mgOnWave', v: `${s.ridePct}%`, c: '#a3e635' },
          { k: 'mgTime', v: fmtS(s.time) },
          { k: 'mgLivesLeft', v: String(s.lives) },
          { k: 'mgMoveLbl', v: t(move === 'pushup' ? 'camPushup' : 'camSquat') },
        ],
      }
    },
  }
  const s = hud
  const calib = s && (s.phase === 'calibTop' || s.phase === 'calibBottom')
  const need = move === 'pushup' ? 'upper' : 'full'
  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-testid="wave-hud" data-phase={s?.phase} data-score={s?.score} data-lives={s?.lives} data-wave={s?.wave} data-riding={s?.riding ? 1 : 0} data-wiped={s?.wiped ? 1 : 0}>
      {s?.phase === 'play' || s?.phase === 'over' ? (
        <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+86px)] flex items-start justify-between">
          <div>
            <div className="font-display text-[40px] font-bold leading-none text-white" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7)' }} data-testid="wave-n">{t('mgWave')} {s.wave}</div>
            <div className="mt-1.5 h-7">
              {s.wiped ? <span className="rounded-full border border-bad/60 bg-bad/25 px-3 py-1 font-mono text-[12px] font-bold text-white" data-testid="wave-wiped">💥 {t('mgWipedOut')}</span>
                : s.riding ? <span className="rounded-full border border-lime/60 bg-lime/15 px-3 py-1 font-mono text-[12px] font-bold text-lime" data-testid="wave-riding">{t('mgRiding')} ×{s.mult}</span>
                : <span className="rounded-full border border-gold/50 bg-black/50 px-3 py-1 font-mono text-[12px] font-bold text-gold">{t('mgFollow')}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-[30px] font-bold leading-none text-gold tabular-nums" data-testid="wave-score">{s.score}</div>
            <div className="mt-1 font-mono text-[10.5px] text-white/70">{t('mgBest')} {Math.max(best, s.score)}</div>
            <div className="mt-1.5 flex justify-end gap-1" data-testid="wave-lives">{Array.from({ length: 3 }, (_, i) => <Heart key={i} size={16} className={i < s.lives ? 'text-[#f472d0]' : 'text-white/20'} fill={i < s.lives ? 'currentColor' : 'none'} />)}</div>
          </div>
        </div>
      ) : null}
      <div className="absolute inset-x-0 top-[34%] flex flex-col items-center px-6">
        {calib && (
          <div className="w-full max-w-[320px] rounded-3xl border border-cyan/35 bg-black/60 p-4 text-center backdrop-blur-md" data-testid="wave-calib" data-step={s!.phase}>
            <div className="title-hud text-[12px] text-cyan">{t('mgCalib')} {s!.phase === 'calibTop' ? '1' : '2'}/2</div>
            <div className="mt-1 text-[17px] font-bold">{t(s!.phase === 'calibTop' ? (move === 'pushup' ? 'mgHoldTopPush' : 'mgHoldTopSquat') : (move === 'pushup' ? 'mgHoldBottomPush' : 'mgHoldBottomSquat'))}</div>
            <div className="relative mx-auto mt-3 grid h-24 w-24 place-items-center">
              <svg viewBox="0 0 96 96" className="absolute inset-0 -rotate-90"><circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" /><circle cx="48" cy="48" r="42" fill="none" stroke={s!.phase === 'calibTop' ? '#22d3ee' : '#f7c548'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${((3 - s!.calibLeft) / 3) * 264} 264`} /></svg>
              <span className="font-display text-[40px] font-bold">{s!.visible ? s!.calibLeft : '…'}</span>
            </div>
            {!s!.visible && <div className="mt-2 text-[12px] text-gold">{t(need === 'upper' ? 'mgMoveBackUpper' : 'mgMoveBackFull')}</div>}
            {s!.calibFailed && <div className="mt-2 text-[12px] text-bad" data-testid="wave-calib-fail">{t('mgCalibFail')}</div>}
          </div>
        )}
        {s?.phase === 'count' && <><CountBig n={s.count} /><div className="mt-2 text-[14px] font-semibold text-white/85">{t(move === 'pushup' ? 'mgStartTopPush' : 'mgStartTopSquat')}</div></>}
        {s && !s.visible && s.phase === 'play' && !paused && <Banner testid="motion-vis-warn">{t(need === 'upper' ? 'mgMoveBackUpper' : 'mgMoveBackFull')} · {t('mgPausedAuto')}</Banner>}
      </div>
      <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+14px)] overflow-hidden rounded-[22px] border border-cyan/25 bg-[#050912]/80 backdrop-blur-md" data-testid="wave-panel">
        <canvas ref={panel} className="block h-[118px] w-full" />
        <span className="absolute left-3 top-2 font-mono text-[10px] font-bold text-white/70">{t('mgUp')}</span>
        <span className="absolute bottom-2 left-3 font-mono text-[10px] font-bold text-white/70">{t('mgDown')}</span>
        <span className="absolute bottom-2 right-3 font-mono text-[9.5px] tracking-[0.2em] text-gold/80">D31 · WAVE RIDE</span>
      </div>
    </div>
  )
}
function drawWavePanel(c: HTMLCanvasElement | null, g: WaveGame, s: WaveSnap) {
  if (!c) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr)
  if (!W || !H) return
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  const PAST = 1.3, FUT = 3.2, nowX = W * 0.3, pad = 16 * dpr
  const X = (sec: number) => nowX + (sec / FUT) * (W - nowX)
  const Xp = (sec: number) => nowX + (sec / PAST) * nowX // sec ≤ 0
  const Y = (v: number) => pad + (1 - v) * (H - 2 * pad)
  const live = s.phase === 'play' || s.phase === 'over'
  const wave = live ? s.wave : 1, tau = live ? s.tau : 0
  const steps = 90
  const pts: { x: number; v: number; tol: number }[] = []
  for (let i = 0; i <= steps; i++) {
    const sec = -PAST + ((PAST + FUT) * i) / steps
    const r = trackAt(wave, tau, sec)
    pts.push({ x: sec < 0 ? Xp(sec) : X(sec), v: r.v, tol: waveParams(r.wave).tol })
  }
  // tolerance band
  ctx.beginPath()
  pts.forEach((p, i) => { const y = Y(Math.min(1.05, p.v + p.tol)); if (i) ctx.lineTo(p.x, y); else ctx.moveTo(p.x, y) })
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, Y(Math.max(-0.05, pts[i].v - pts[i].tol)))
  ctx.closePath()
  ctx.fillStyle = 'rgba(34,211,238,0.13)'; ctx.fill()
  // centre line (cyan → violet)
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(34,211,238,0.45)'); grad.addColorStop(0.3, '#22d3ee'); grad.addColorStop(1, '#a78bfa')
  ctx.lineWidth = 3 * dpr; ctx.strokeStyle = grad; ctx.lineJoin = 'round'
  ctx.beginPath(); pts.forEach((p, i) => { const y = Y(p.v); if (i) ctx.lineTo(p.x, y); else ctx.moveTo(p.x, y) }); ctx.stroke()
  // next-wave marker
  const toNext = waveLen(wave) - tau
  if (toNext < FUT) {
    const x = X(toNext)
    ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1 * dpr
    ctx.beginPath(); ctx.moveTo(x, 6 * dpr); ctx.lineTo(x, H - 6 * dpr); ctx.stroke(); ctx.setLineDash([])
    const label = `WAVE ${wave + 1}`
    ctx.font = `700 ${10 * dpr}px "JetBrains Mono", monospace`
    const tw = ctx.measureText(label).width + 12 * dpr
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.strokeStyle = 'rgba(247,197,72,0.7)'
    const lx = Math.max(nowX + 8 * dpr, Math.min(W - tw - 4, x - tw / 2))
    ctx.beginPath(); ctx.roundRect(lx, 6 * dpr, tw, 18 * dpr, 9 * dpr); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#f7c548'; ctx.textBaseline = 'middle'; ctx.fillText(label, lx + 6 * dpr, 15 * dpr)
  }
  // now line with markers
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5 * dpr
  ctx.beginPath(); ctx.moveTo(nowX, 4 * dpr); ctx.lineTo(nowX, H - 4 * dpr); ctx.stroke()
  ctx.fillStyle = '#fff'
  for (const [y, d] of [[4 * dpr, 1], [H - 4 * dpr, -1]] as const) { ctx.beginPath(); ctx.moveTo(nowX - 5 * dpr, y); ctx.lineTo(nowX + 5 * dpr, y); ctx.lineTo(nowX, y + d * 7 * dpr); ctx.closePath(); ctx.fill() }
  // trail + ball
  if (s.ball !== null && live) {
    const tr = s.trail
    if (tr.length > 1) {
      ctx.lineWidth = 3 * dpr; ctx.lineCap = 'round'
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i - 1], b = tr[i]
        ctx.strokeStyle = `rgba(163,230,53,${(0.15 + 0.75 * (i / tr.length)).toFixed(2)})`
        ctx.beginPath(); ctx.moveTo(Xp(Math.max(-PAST, a.t - s.time)), Y(Math.max(-0.1, Math.min(1.1, a.v)))); ctx.lineTo(Xp(Math.max(-PAST, b.t - s.time)), Y(Math.max(-0.1, Math.min(1.1, b.v)))); ctx.stroke()
      }
    }
  }
  if (s.ball !== null) {
    const by = Y(Math.max(-0.1, Math.min(1.1, s.ball)))
    const col = s.wiped ? '#ef4444' : s.riding ? '#a3e635' : '#f7c548'
    ctx.fillStyle = `${col}40`; ctx.beginPath(); ctx.arc(nowX, by, 13 * dpr, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(nowX, by, 7.5 * dpr, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * dpr; ctx.stroke()
  }
  void g
}

// ── DEPTH METER ──
function DepthHud({ ctl, paused, onFinish }: { ctl: React.RefObject<Ctl | null>; paused: boolean; onFinish: () => void }) {
  const t = useT()
  const s0 = useApp()
  const g = useMemo(() => new DepthGame(), [])
  const [hud, push] = useHud<DepthSnap>()
  const [bump, setBump] = useState(0)
  const startedAt = useRef(Date.now())
  const best = useBest().depth ?? 0
  ctl.current = {
    frame: (lm, dt, aspect, ctx, w, h) => {
      if (lm) drawSkeleton(ctx, lm, w, h, 'upper')
      const s = g.update(lm, dt, aspect)
      for (const e of s.events) {
        if (e === 'tick') sfx.tick()
        else if (e === 'go') { sfx.go(); startedAt.current = Date.now() }
        else if (e === 'rep') { sfx.rep(s.streak); setBump((b) => b + 1) } // tick + navigator.vibrate (Settings → vibration)
        else if (e === 'half' || e === 'lockout') sfx.hit()
      }
      push(s)
    },
    finish: () => {
      const prev = useMotion.getState().byAcc[currentAccountId() ?? 'guest']?.depth
      const pb = g.reps > 0 && useMotion.getState().set('depth', g.reps)
      if (g.reps > 0) logSession(s0, t('mg_depth'), 'push-up', g.reps, startedAt.current)
      return {
        id: 'depth', main: g.reps, mainLabel: 'reps', best: Math.max(prev ?? 0, g.reps), pb, title: pb ? 'gameNewBest' : 'mgSetDone',
        stats: [
          { k: 'mgBestStreak', v: String(g.bestStreak), c: '#f7c548' },
          { k: 'mgHalfReps', v: String(g.halfReps), c: '#ef4444' },
          { k: 'mgTut', v: `${g.tut.toFixed(1)}s`, c: '#22d3ee' },
          { k: 'mgCleanPct', v: g.reps + g.halfReps ? `${Math.round((g.reps / (g.reps + g.halfReps)) * 100)}%` : '—', c: '#a3e635' },
          { k: 'mgAvgTempo', v: g.reps ? `${(g.tut / Math.max(1, g.reps + g.halfReps)).toFixed(1)}s` : '—' },
          { k: 'mgTime', v: fmtS(g.time) },
        ],
      }
    },
  }
  const s = hud
  const pct = s?.visible ? s.pct : 0
  const col = depthColor(pct, PUSH_TARGET_PCT)
  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-testid="depth-hud" data-phase={s?.phase} data-reps={s?.reps} data-half={s?.halfReps} data-streak={s?.streak} data-pct={pct} data-cue={s?.cue ?? ''}>
      {(s?.phase === 'play') && (
        <>
          <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+88px)] w-[104px] rounded-[22px] border border-white/12 bg-black/65 p-3 text-center backdrop-blur-md">
            <div key={bump} className={`font-display text-[52px] font-bold leading-none tabular-nums ${bump ? 'game-pop' : ''}`} data-testid="depth-reps">{s.reps}</div>
            <div className="mt-1 font-mono text-[10px] font-bold tracking-[0.25em] text-white/70">{t('reps').toUpperCase()}</div>
            <div className="mt-2 rounded-full bg-gold/15 py-0.5 font-mono text-[11px] font-bold text-gold" data-testid="depth-streak">🔥 {s.streak}</div>
            <div className="mt-1 font-mono text-[10px] text-white/60">{t('mgBest')} {Math.max(best, s.reps)}</div>
          </div>
          <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+16px)] left-3 right-[78px] rounded-2xl border border-white/12 bg-black/60 px-3 py-2 font-mono text-[11.5px] backdrop-blur-md" data-testid="depth-tempo">
            <div className="flex justify-between"><span className="text-white/60">{t('mgTempo')}</span><span className="text-cyan">{s.lastDown !== null ? `↓${s.lastDown.toFixed(1)}s ↑${s.lastUp!.toFixed(1)}s` : '—'}</span></div>
            <div className="mt-0.5 flex justify-between"><span className="text-white/60">{t('mgTut')}</span><span className="text-gold">{s.tut.toFixed(1)}s</span></div>
            <div className="mt-0.5 flex justify-between"><span className="text-white/60">{t('mgHalfReps')}</span><span className="text-bad">{s.halfReps}</span></div>
          </div>
        </>
      )}
      {s?.phase !== 'position' && (
        <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+88px)] flex flex-col items-center" data-testid="depth-gauge">
          <div className="mb-1 rounded-full bg-black/65 px-2 py-0.5 font-mono text-[13px] font-bold tabular-nums" style={{ color: col }} data-testid="depth-pct">{pct}%</div>
          <div className="relative h-[46vh] max-h-[400px] w-[50px] overflow-hidden rounded-full border border-white/15 bg-black/55 backdrop-blur-md">
            <div className="absolute inset-x-[5px] bottom-[5px] rounded-full transition-[height] duration-75" style={{ height: `calc(${pct}% - 10px * ${pct / 100})`, background: col, boxShadow: `0 0 18px ${col}` }} />
            <div className="absolute inset-x-1 h-[3px] rounded-full bg-white shadow-[0_0_8px_#fff]" style={{ bottom: `${PUSH_TARGET_PCT}%` }} />
          </div>
          {s?.angle !== null && s?.angle !== undefined && <div className="mt-1 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white/80">{Math.round(s.angle)}°</div>}
        </div>
      )}
      <div className="absolute inset-x-0 top-[36%] flex flex-col items-center px-6">
        {s?.phase === 'position' && <PositionCheck t={t} need="upper" visible={s.visible} testid="depth-position" />}
        {s?.phase === 'count' && <><CountBig n={s.count} /><div className="mt-2 text-[14px] font-semibold text-white/85">{t('mgStartTopPush')}</div></>}
        {s?.phase === 'play' && s.cue && <Banner tone="bad" testid="depth-cue">{t(s.cue === 'lower' ? 'mgCueLower' : 'mgCueLockout')}</Banner>}
        {s?.phase === 'play' && !s.visible && !paused && <div className="mt-2"><Banner testid="motion-vis-warn">{t('mgMoveBackUpper')}</Banner></div>}
      </div>
      {s?.phase === 'play' && (
        <button onClick={onFinish} className="pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+16px)] right-3 grid h-[62px] w-[62px] place-items-center rounded-2xl border border-gold/50 bg-gold/15 font-mono text-[11px] font-bold text-gold" data-testid="depth-done">{t('done').toUpperCase()}</button>
      )}
    </div>
  )
}

// ── SQUAT CHECK ──
function SquatHud({ ctl, target, onOver, paused }: { ctl: React.RefObject<Ctl | null>; target: number; onOver: () => void; paused: boolean }) {
  const t = useT()
  const s0 = useApp()
  const g = useMemo(() => new SquatGame(target), [target])
  const [hud, push] = useHud<SquatSnap>()
  const done = useRef(false)
  const startedAt = useRef(Date.now())
  ctl.current = {
    frame: (lm, dt, aspect, ctx, w, h) => {
      const s = g.update(lm, dt, aspect)
      if (lm && s.visible) drawSquatOverlay(ctx, lm as Pt[], w, h, s.pct, s.parallel)
      if (lm) drawSkeleton(ctx, lm, w, h, 'full')
      for (const e of s.events) {
        if (e === 'tick') sfx.tick()
        else if (e === 'go') { sfx.go(); startedAt.current = Date.now() }
        else if (e === 'rep') sfx.rep(s.reps)
        else if (e === 'shallow') sfx.hit()
        else if (e === 'cue') sfx.tick()
        else if (e === 'done') sfx.win()
      }
      push(s)
      if (s.phase === 'over' && !done.current) { done.current = true; setTimeout(onOver, 700) }
    },
    finish: () => {
      const complete = g.reps >= g.target
      const key = `squat_${g.target}`
      const prev = useMotion.getState().byAcc[currentAccountId() ?? 'guest']?.[key]
      const secs = Math.round(g.time)
      const pb = complete && useMotion.getState().set(key, secs, true)
      if (g.reps > 0) logSession(s0, t('mg_squatcheck'), 'bodyweight-squat', g.reps, startedAt.current)
      return {
        id: 'squatcheck', main: g.reps, mainLabel: 'reps', best: prev !== undefined ? (complete ? Math.min(prev, secs) : prev) : complete ? secs : undefined, bestIsTime: true, pb,
        title: pb ? 'gameNewBest' : complete ? 'mgTargetHit' : 'mgSetDone',
        stats: [
          { k: 'mgTime', v: fmtS(g.time), c: '#22d3ee' },
          { k: 'mgShallow', v: String(g.shallow), c: '#ef4444' },
          { k: 'mgCleanPct', v: g.reps + g.shallow ? `${Math.round((g.reps / (g.reps + g.shallow)) * 100)}%` : '—', c: '#a3e635' },
          { k: 'mgCueKnees', v: String(g.cues.knees) },
          { k: 'mgCueChest', v: String(g.cues.chest) },
          { k: 'mgTarget', v: String(g.target) },
        ],
      }
    },
  }
  const s = hud
  const R = 44, C = 2 * Math.PI * R
  const col = s?.parallel ? '#34d399' : depthColor(s?.pct ?? 0)
  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-testid="squat-hud" data-phase={s?.phase} data-left={s?.left} data-reps={s?.reps} data-shallow={s?.shallow} data-pct={s?.pct} data-parallel={s?.parallel ? 1 : 0} data-view={s?.view} data-cue={s?.cue ?? ''} data-visible={s?.visible ? 1 : 0}>
      <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+86px)] h-[92px] w-[70px] overflow-hidden rounded-2xl border border-gold/40 bg-[linear-gradient(180deg,#0b1220,#1a1206)]" data-testid="squat-demo">
        <svg viewBox="0 0 70 92" className="h-full w-full"><g className="mg-squat-demo" stroke="#f7c548" strokeWidth="3" strokeLinecap="round" fill="none"><circle cx="35" cy="16" r="6" fill="#f7c548" stroke="none" /><path d="M35 23 L35 46 M35 30 L52 38 M35 46 L26 62 L30 82 M35 46 L44 62 L40 82" /></g><line x1="12" y1="84" x2="58" y2="84" stroke="#ffffff44" strokeWidth="2" /></svg>
      </div>
      {s?.phase === 'play' && s.visible && s.view !== 'unknown' && <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+86px)] rounded-full border border-cyan/40 bg-black/60 px-2.5 py-1 font-mono text-[10.5px] font-bold text-cyan" data-testid="squat-view">{t(s.view === 'front' ? 'mgViewFront' : 'mgViewSide')}</div>}
      <div className="absolute inset-x-0 top-[36%] flex flex-col items-center gap-2 px-6">
        {s?.phase === 'position' && <PositionCheck t={t} need="full" visible={s.visible} testid="squat-position" />}
        {s?.phase === 'count' && <><CountBig n={s.count} /><div className="text-[14px] font-semibold text-white/85">{t('mgStartTopSquat')}</div></>}
        {s?.phase === 'play' && !s.visible && !paused && <Banner testid="motion-vis-warn">{t('mgMoveBackFull')}</Banner>}
        {s?.phase === 'play' && s.visible && s.cue && <Banner tone="bad" testid="squat-cue">{t(s.cue === 'deeper' ? 'mgCueDeeper' : s.cue === 'knees' ? 'mgCueKnees' : 'mgCueChest')}</Banner>}
        {s?.phase === 'play' && s.visible && s.parallel && !s.cue && <Banner tone="ok" testid="squat-parallel">✓ {t('mgParallel')}</Banner>}
      </div>
      {s && s.phase !== 'position' && (
        <>
          <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+18px)] left-4 flex flex-col items-center" data-testid="squat-ring">
            <div className="relative grid h-[108px] w-[108px] place-items-center">
              <svg viewBox="0 0 108 108" className="absolute inset-0 -rotate-90"><circle cx="54" cy="54" r={R} fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.18)" strokeWidth="7" /><circle cx="54" cy="54" r={R} fill="none" stroke="#a3e635" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(s.left / s.target) * C} ${C}`} style={{ transition: 'stroke-dasharray .3s' }} /></svg>
              <span className="font-display text-[40px] font-bold tabular-nums" data-testid="squat-left">{s.left}</span>
            </div>
            <div className="mt-1 font-mono text-[11px] font-bold tracking-[0.2em] text-white/80">{t('camSquat').toUpperCase()}</div>
          </div>
          <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+22px)] right-4 flex flex-col items-center" data-testid="squat-gauge">
            <div className="mb-1 rounded-full bg-black/65 px-2 py-0.5 font-mono text-[12px] font-bold tabular-nums" style={{ color: col }}>{s.pct}%</div>
            <div className="relative h-[150px] w-[44px] overflow-hidden rounded-full border border-white/15 bg-black/55">
              <div className="absolute inset-x-[5px] bottom-[5px] rounded-full transition-[height] duration-75" style={{ height: `calc(${s.pct}% - 10px * ${s.pct / 100})`, background: col, boxShadow: `0 0 16px ${col}` }} />
              <div className="absolute inset-x-1 top-[5px] h-[3px] rounded-full bg-white" />
            </div>
            {s.angle !== null && s.view === 'side' && <div className="mt-1 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white/80">{t('jKnee')} {Math.round(s.angle)}°</div>}
          </div>
        </>
      )}
    </div>
  )
}

function logSession(s: ReturnType<typeof useApp.getState>, name: string, exId: string, reps: number, startMs: number) {
  const session: WorkoutSession = {
    id: uid(), name: `${name}`, startedAt: new Date(startMs).toISOString(), durationSec: Math.round((Date.now() - startMs) / 1000), volumeKg: 0, source: 'camera',
    exercises: [{ exId, sets: [{ reps, kg: 0, done: true }] }],
  }
  s.addSession(session); void cloud.session(session)
}

function EndView({ t, r, onAgain }: { t: T; r: Result; onAgain: () => void }) {
  const c = COLOR[r.id]
  return (
    <div data-testid="motion-result" data-game={r.id} data-main={r.main} data-pb={r.pb ? 1 : 0}>
      <Header title={t(`mg_${r.id}` as StringKey)} back="#/train/game" />
      <div className="card hud-gold game-grid relative overflow-hidden p-5 text-center">
        <div className="game-in title-hud text-[24px]" style={{ color: r.pb ? '#f7c548' : c, textShadow: `0 0 24px ${r.pb ? '#f7c548' : c}` }}>{t(r.title)}</div>
        <div className="mt-3 font-display text-[64px] font-bold leading-none tabular-nums text-frost" data-testid="motion-result-main">{r.main}</div>
        <div className="mt-1 text-[12px] text-muted">{t(r.mainLabel)}</div>
        <div className="mt-2 font-mono text-[12px] text-gold" data-testid="motion-result-best"><Trophy size={12} className="mr-1 inline" />{t('mgBest')}: {r.best === undefined ? '—' : r.bestIsTime ? fmtS(r.best) : r.best}</div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {r.stats.map((x) => <div key={x.k} className="card-2 p-2"><div className="font-mono text-[16px] font-bold" style={{ color: x.c }}>{x.v}</div><div className="text-[10.5px] leading-tight text-muted">{t(x.k)}</div></div>)}
        </div>
        <p className="mt-4 text-[11.5px] text-dim">{t('mgSavedLocal')}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => navigate('/train/game')}><Gamepad2 size={16} /> {t('gameHubBtn')}</Button>
        <Button onClick={onAgain} data-testid="motion-again"><RotateCcw size={16} /> {t('gameAgain')}</Button>
      </div>
    </div>
  )
}
