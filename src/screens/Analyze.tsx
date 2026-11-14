import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Eye, CheckCircle2, AlertTriangle, Wrench, Target, ArrowRight, X, Camera, Square, RotateCcw, Save, Volume2, VolumeX, SwitchCamera, Zap, ChevronRight, Info, ScanLine } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Card, Chip, Header, Label, Sheet, Stepper, Tabs } from '../components/ui'
import { BodyMap } from '../components/BodyMap'
import { hashQuery } from '../lib/router'
import { runAnalysis, HEADER_KEYS, D31_ANALYSIS_HEADERS } from '../lib/analyze'
import { isLive } from '../lib/env'
import { fmtDate, speak, uid } from '../lib/util'
import { detectPhoto, drawPose, getLandmarker, maskToPng, pngToMask, RepCounter, type RawMask, type RepKind } from '../lib/pose'
import { cloud } from '../lib/cloud'
import type { AnalysisRecord, Lang, MuscleId, WorkoutSession } from '../types'
import {
  analysisEx, buildPose, evaluateRules, exerciseSetup, exLabel, guessExercise, insights, l3, musclesFor, MUSCLE_NAMES, searchExercises,
  type CheckResult, type Guess, type Mode, type Pose,
} from '../lib/formCheck'
import { renderAnalysis } from '../lib/analysisDraw'
import { fitMuscles, type Mask } from '../lib/muscleAnatomy'
import { fineName, roleWord, rolesFor, ROLE_ORDER } from '../lib/muscleRoles'
import { ROLE_COLOR } from '../lib/muscleDraw'
import { hudData, renderPoster, sharePoster, svgToImage, ROLE_LEVEL, type Hud } from '../lib/poster'

const SECTION_STYLE: Record<string, { icon: typeof Eye; color: string }> = {
  'WHAT I SEE': { icon: Eye, color: '#8b93a3' },
  'QUICK VERDICT': { icon: Zap, color: '#22d3ee' },
  "WHAT'S GOOD": { icon: CheckCircle2, color: '#34d399' },
  'FIX THIS': { icon: AlertTriangle, color: '#f87171' },
  TECHNIQUE: { icon: Wrench, color: '#f5b942' },
  'NEXT MOVE': { icon: Target, color: '#a78bfa' },
}

export default function Analyze() {
  const t = useT()
  const q = hashQuery()
  const [tab, setTab] = useState<'form' | 'live'>(q.get('tab') === 'live' ? 'live' : 'form')
  return (
    <div>
      <Header title={t('navAnalyze')} />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'form', label: t('formCheck') }, { id: 'live', label: t('liveReps') }]} />
      <div className="mt-4">{tab === 'form' ? <FormCheck initialEx={q.get('ex') ?? ''} /> : <LiveReps />}</div>
    </div>
  )
}



function AiCards({ sections, raw }: { sections: Record<string, string>; raw: string }) {
  const t = useT()
  const has = D31_ANALYSIS_HEADERS.some((h) => sections[h])
  if (!has && !raw) return null
  return (
    <div className="space-y-2.5">
      {has ? (
        D31_ANALYSIS_HEADERS.filter((h) => sections[h]).map((h) => {
          const st = SECTION_STYLE[h]
          const Icon = st.icon
          return (
            <div key={h} className="card relative overflow-hidden p-4 pl-5">
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: st.color }} />
              <div className="flex items-center gap-2" style={{ color: st.color }}><Icon size={16} /><span className="label" style={{ color: st.color }}>{t(HEADER_KEYS[h])}</span></div>
              <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-frost/95">{sections[h].replace(/^\s*[-*]\s*/gm, '• ').replace(/\*\*/g, '')}</p>
            </div>
          )
        })
      ) : (
        <div className="card whitespace-pre-line p-4 text-[14px] leading-relaxed">{raw}</div>
      )}
    </div>
  )
}

/** Draw a media file (image, or the current frame of a video element) onto a canvas, long side ≤ max. */
function toCanvas(src: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, max: number): HTMLCanvasElement {
  const w0 = src instanceof HTMLVideoElement ? src.videoWidth : src instanceof HTMLCanvasElement ? src.width : src.naturalWidth
  const h0 = src instanceof HTMLVideoElement ? src.videoHeight : src instanceof HTMLCanvasElement ? src.height : src.naturalHeight
  const k = Math.min(1, max / Math.max(w0, h0))
  const c = document.createElement('canvas')
  c.width = Math.round(w0 * k)
  c.height = Math.round(h0 * k)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}
const loadImg = (url: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
const lmToPts = (lm?: number[][]) => lm?.map(([x, y, v, z]) => ({ x, y, z, visibility: v, presence: v }))
/** raw mask → Mask in the coordinate space of a W×H image */
const scaleMask = (m: RawMask | null | undefined, W: number, H: number): Mask | null => (m && W && H ? { w: m.w, h: m.h, data: m.data, sx: m.w / W, sy: m.h / H } : null)
const ROLE_SWATCH = { primary: '#ff2d26', secondary: '#ffce2e' }

const STATUS_COLOR: Record<CheckResult['status'], string> = { ok: '#34d399', warn: '#f5b942', fix: '#ff3b30', info: '#8b93a3' }
const MODE_SUB: Record<Mode, 'subAngles' | 'subMuscles' | 'subTechnique'> = { angles: 'subAngles', muscles: 'subMuscles', technique: 'subTechnique' }

function useResult(rec: AnalysisRecord, lang: Lang, src: HTMLCanvasElement | HTMLImageElement | null, raw: RawMask | null) {
  const W = src ? (src instanceof HTMLCanvasElement ? src.width : src.naturalWidth) : 0
  const H = src ? (src instanceof HTMLCanvasElement ? src.height : src.naturalHeight) : 0
  const pose = useMemo<Pose | null>(() => (src && rec.lm ? buildPose(lmToPts(rec.lm), W, H) : src ? buildPose(null, W, H) : null), [src, rec.lm, W, H])
  const exId = rec.exId
  const setup = exerciseSetup(exId)
  const muscles = musclesFor(exId)
  const evals = useMemo(() => (pose ? evaluateRules(pose, exId, lang) : { checks: [], skipped: [] }), [pose, exId, lang])
  const roles = useMemo(() => rolesFor(exId), [exId])
  const anatomy = useMemo(() => (pose ? fitMuscles(pose, scaleMask(raw, W, H), roles) : { drawn: [], notDrawn: [], occluders: [] }), [pose, raw, W, H, roles])
  return { pose, setup, muscles, roles, anatomy, mask: scaleMask(raw, W, H), ...evals }
}

function specRows(t: ReturnType<typeof useT>, pose: Pose, exName: string, focus: string, mode: Mode, muscles: { primary: MuscleId[] }, lang: Lang): [string, string][] {
  const body = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
  const n = body.filter((i) => pose.pts[i]).length
  const f = mode === 'muscles' && muscles.primary.length ? muscles.primary.map((m) => l3(MUSCLE_NAMES[m], lang)).join(' / ') : focus
  return [
    [t('specSubject'), exName || '—'],
    [t('specFocus'), f || '—'],
    [t('specView'), t(pose.view === 'front' ? 'viewFront' : pose.view === 'back' ? 'viewBack' : 'viewSide')],
    [t('specPoints'), `${n}/12`],
  ]
}

/** Result "slide": overlay canvas + mode tabs + insights + checks + body map. Works for new and saved results. */
function ResultView({ rec, src, mask, onChangeEx, guesses }: { rec: AnalysisRecord; src?: HTMLCanvasElement | null; mask?: RawMask | null; onChangeEx?: (id: string) => void; guesses?: Guess[] }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const [img, setImg] = useState<HTMLCanvasElement | HTMLImageElement | null>(src ?? null)
  useEffect(() => {
    if (src) { setImg(src); return }
    if (rec.photo) loadImg(rec.photo).then(setImg).catch(() => setImg(null))
  }, [src, rec.photo])
  const [raw, setRaw] = useState<RawMask | null>(mask ?? null)
  useEffect(() => {
    if (mask) { setRaw(mask); return }
    setRaw(null)
    if (rec.mask) pngToMask(rec.mask).then(setRaw).catch(() => setRaw(null))
  }, [mask, rec.mask])
  const { pose, setup, muscles, roles, anatomy, mask: maskS, checks, skipped } = useResult(rec, lang, img, raw)
  const [mode, setMode] = useState<Mode>(rec.mode ?? setup.mode)
  useEffect(() => setMode(rec.mode ?? exerciseSetup(rec.exId).mode), [rec.exId, rec.mode])
  const [bw, setBw] = useState(true)
  const [posterMsg, setPosterMsg] = useState('')
  const bodyMapRef = useRef<HTMLDivElement>(null)
  const roleKinds = useMemo(() => ROLE_ORDER.filter((r) => Object.values(roles).includes(r)), [roles])
  const canvas = useRef<HTMLCanvasElement>(null)
  const ex = analysisEx(rec.exId)
  const name = ex ? exLabel(ex, lang) : ''
  useEffect(() => {
    const c = canvas.current
    if (!c || !img || !pose) return
    const draw = () => {
      renderAnalysis(c, img, pose, {
        mode, lang, title: name || t('formCheck'), subtitle: t(MODE_SUB[mode]), profile: setup.profile, muscles,
        spec: pose.ok ? specRows(t, pose, name, l3(setup.profile.focus, lang), mode, muscles, lang) : [],
        anatomy: { drawn: anatomy.drawn, mask: maskS, roles: roleKinds, occluders: anatomy.occluders }, bw: mode === 'muscles' && bw,
      })
      // test hook: the exact outlines that were drawn (checked by the anti-primitive e2e test)
      ;(window as unknown as { __d31MuscleShapes?: unknown }).__d31MuscleShapes = mode === 'muscles' && maskS ? anatomy.drawn.map((m) => ({ id: m.id, role: m.role, polys: m.polys })) : []
    }
    draw()
    // redraw once the condensed font is ready
    document.fonts?.load('700 40px Oswald').then(draw).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, pose, mode, lang, rec.exId, anatomy, bw, maskS])
  const hud: Hud = useMemo(() => hudData(pose, checks, setup.profile, anatomy.drawn, anatomy.notDrawn, lang), [pose, checks, setup.profile, anatomy, lang])
  const savePoster = async () => {
    if (!img || !pose) return
    setPosterMsg('')
    try {
      const ov = document.createElement('canvas')
      renderAnalysis(ov, img, pose, {
        mode, lang, title: '', subtitle: '', profile: setup.profile, muscles, spec: [], chrome: false, labels: true,
        anatomy: { drawn: anatomy.drawn, mask: maskS, roles: roleKinds, occluders: anatomy.occluders }, bw: mode === 'muscles' && bw,
      })
      const bm = await svgToImage(bodyMapRef.current?.querySelector('svg') ?? null)
      const poster = renderPoster({ overlay: ov, bodyMap: bm, hud, title: name || t('formCheck'), lang, t: (k) => t(k as never), date: fmtDate(rec.date, lang) })
      ;(window as unknown as { __d31Poster?: string }).__d31Poster = poster.toDataURL('image/png')
      const how = await sharePoster(poster, `d31-${(rec.exId || 'analysis')}-${rec.id.slice(0, 6)}.png`)
      setPosterMsg(how === 'downloaded' ? t('posterReady') : '')
    } catch (e) {
      setPosterMsg(t('posterFail', { e: e instanceof Error ? e.message : String(e) }))
    }
  }
  const top = insights(checks)
  const [picking, setPicking] = useState(false)
  const alts = (guesses ?? []).filter((g) => g.id !== rec.exId)
  const unsure = !rec.exId && !!guesses?.length
  return (
    <div className="space-y-3" data-testid="od-result">
      <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#05070b]">
        <canvas ref={canvas} className="block w-full" data-testid="od-canvas" />
      </div>
      <div className="flex gap-1.5" role="tablist" data-testid="mode-tabs">
        {(['angles', 'muscles', 'technique'] as Mode[]).map((m) => (
          <button key={m} role="tab" data-testid={`mode-${m}`} aria-selected={mode === m} onClick={() => setMode(m)}
            className={`flex-1 rounded-xl border px-2 py-2 font-mono text-[11.5px] font-bold uppercase tracking-wider transition ${mode === m ? 'border-[#ff3b30]/60 bg-[#ff3b30]/12 text-white' : 'border-white/10 bg-white/[0.03] text-muted'}`}>
            {t(m === 'angles' ? 'modeAngles' : m === 'muscles' ? 'modeMuscles' : 'modeTechnique')}
          </button>
        ))}
      </div>

      {pose?.ok && (
        <div className="flex items-center gap-2">
          {mode === 'muscles' && (
            <button data-testid="bw-toggle" aria-pressed={bw} onClick={() => setBw(!bw)}
              className={`rounded-xl border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider ${bw ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 text-muted'}`}>{t('bwPhoto')}</button>
          )}
          <button data-testid="save-poster" onClick={savePoster} className="ml-auto flex items-center gap-1.5 rounded-xl border border-[#ff3b30]/50 bg-[#ff3b30]/10 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white">
            <Save size={13} /> {t('savePoster')}
          </button>
        </div>
      )}
      {posterMsg && <p className="px-1 text-[12px] text-cyan" data-testid="poster-msg">{posterMsg}</p>}
      {mode === 'muscles' && pose?.ok && rec.exId && anatomy.drawn.length === 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-gold/25 bg-gold/[0.07] p-3 text-[13px] leading-snug text-gold" data-testid="no-muscles">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{t('musclesNoneDrawn')}</span>
        </div>
      )}

      {onChangeEx && (unsure || rec.detected || picking) && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" data-testid="detect-box">
          {rec.exId && rec.detected ? (
            <div className="flex items-center gap-2 text-[13px]"><ScanLine size={15} className="text-cyan" /> <span>{t('detectedAs', { x: name })}</span></div>
          ) : (
            <div className="flex items-start gap-2 text-[13px] text-gold"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{t('pickExQ')}</span></div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {rec.exId && rec.detected && <span className="text-[11.5px] text-dim">{t('changeQ')}</span>}
            {alts.map((g) => <Chip key={g.id} onClick={() => onChangeEx(g.id)}>{exLabel(analysisEx(g.id), lang)}</Chip>)}
            <Chip active={picking} onClick={() => setPicking(!picking)}>{t('otherEx')}</Chip>
          </div>
          {picking && <div className="mt-2"><ExercisePickerField value="" onPick={(id) => { setPicking(false); onChangeEx(id) }} /></div>}
        </div>
      )}

      {pose && !pose.ok ? (
        <div className="flex items-start gap-2 rounded-2xl border border-gold/25 bg-gold/[0.07] p-3 text-[13px] leading-snug text-gold" data-testid="no-pose">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{t('noPose')}</span>
        </div>
      ) : (
        <div className="rounded-[22px] border border-white/10 bg-[#07090d] p-4" data-testid="insights">
          <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#ff3b30]">{t('odTitle')} · {t('keyPoints')}</div>
          <div className="mt-1 text-[26px] font-bold uppercase leading-none tracking-tight" style={{ fontFamily: 'Oswald, "Noto Sans Devanagari", "Noto Sans Gujarati", sans-serif' }}>{name || t('formCheck')}</div>
          {!rec.exId ? (
            <p className="mt-3 text-[13.5px] text-muted">{t('pickExercise')}</p>
          ) : top.length ? (
            <ul className="mt-3 space-y-2.5">
              {top.map((c) => (
                <li key={c.metric} className="flex gap-2 text-[14px] leading-snug">
                  <ChevronRight size={18} strokeWidth={3} className="mt-[1px] shrink-0 text-[#ff3b30]" />
                  <span><b className="text-white">{c.label}:</b> <span className="text-frost/90">{c.msg}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13.5px] text-muted">{setup.profile.checks.length ? t('angleNotMeasurable') : t('noRules')}</p>
          )}
          {rec.exId && setup.profile.cues.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">{setup.profile.cues.map((c, i) => <span key={i} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[10.5px] uppercase tracking-wide text-frost/80">{l3(c, lang)}</span>)}</div>
          )}
        </div>
      )}

      {pose?.ok && checks.length > 0 && (
        <div className="card p-3.5" data-testid="checks">
          <div className="label mb-2">{t('checksTitle')}</div>
          <div className="space-y-2">
            {checks.map((c) => (
              <div key={c.metric} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[c.status] }} />
                <div className="min-w-0 flex-1 text-[13px] leading-snug">
                  <div className="flex items-baseline justify-between gap-2"><span className="font-semibold">{c.label}</span><span className="font-mono text-[12.5px] text-cyan">{c.value}</span></div>
                  {c.msg && <div className="text-muted">{c.msg}</div>}
                </div>
              </div>
            ))}
          </div>
          {skipped.length > 0 && <p className="mt-2.5 text-[11.5px] text-dim">{t('skippedNote', { x: skipped.join(', ') })}</p>}
        </div>
      )}

      {rec.exId && pose?.ok && <HudPanels hud={hud} t={t} />}

      {rec.exId && muscles.primary.length > 0 && (
        <div className="card p-3.5" data-testid="bodymap">
          <div className="label mb-2">{t('musclesWorked')}</div>
          <div ref={bodyMapRef}>
            <BodyMap primary={muscles.primary} secondary={muscles.secondary} frontLabel={t('viewFront')} backLabel={t('viewBack')} colors={{ primary: ROLE_SWATCH.primary, secondary: ROLE_SWATCH.secondary }} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-1.5" data-testid="muscle-list">
            {hud.muscles.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-[12.5px]">
                <span className="h-3 w-3 shrink-0" style={{ background: ROLE_COLOR[m.role].fill }} />
                <span className="font-semibold">{m.name}</span>
                <span className="text-dim">· {roleWord(m.role, lang)}</span>
                {pose?.ok && <span className={`ml-auto text-[11px] ${m.drawn ? 'text-cyan' : 'text-dim'}`}>{m.drawn ? t('drawnOnPhoto') : t('notInPhoto')}</span>}
              </div>
            ))}
          </div>
          {pose?.ok && anatomy.notDrawn.length > 0 && (
            <p className="mt-2.5 text-[11.5px] leading-snug text-dim" data-testid="not-drawn">
              {t('notDrawnTitle')}: {anatomy.notDrawn.map((m) => fineName(m.id, lang)).join(', ')}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-dim">{t('typicalRole')}</p>
        </div>
      )}

      <p className="flex gap-1.5 px-1 text-[11.5px] leading-snug text-dim"><Info size={13} className="mt-[1px] shrink-0" /> {t('honestNote')}</p>

      {(rec.raw || Object.keys(rec.sections ?? {}).length > 0) && (
        <div>
          <div className="label mb-2 mt-2">{t('aiTitle')}</div>
          <AiCards sections={rec.sections} raw={rec.raw} />
        </div>
      )}
    </div>
  )
}

function HudPanels({ hud, t }: { hud: Hud; t: ReturnType<typeof useT> }) {
  const head = (n: string, k: string) => (
    <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em]"><span className="text-[#ff3b30]">{n}</span><span className="text-white">{t(k as never)}</span></div>
  )
  const box = 'relative rounded-xl border border-white/10 bg-[#0a0e15] p-3 before:absolute before:left-0 before:top-0 before:h-3 before:w-3 before:border-l-2 before:border-t-2 before:border-[#ff3b30]'
  const g = hud.gauge
  const v = g ? Math.max(0, Math.min(180, g.value)) : 0
  const R = 46, cx = 60, cy = 58
  const end = { x: cx + Math.cos(Math.PI + (v / 180) * Math.PI) * R, y: cy + Math.sin(Math.PI + (v / 180) * Math.PI) * R }
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="hud">
      <div className={box}>
        {head('01', 'hudTarget')}
        <ul className="space-y-1">
          {hud.muscles.filter((m) => m.role === 'primary').slice(0, 4).map((m) => (
            <li key={m.id} className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase leading-tight text-frost"><span className="h-2 w-2 shrink-0" style={{ background: ROLE_COLOR.primary.fill }} />{m.name}</li>
          ))}
        </ul>
      </div>
      <div className={box} data-testid="hud-gauge">
        {head('02', 'hudAngles')}
        {g ? (
          <div className="flex flex-col items-center">
            <svg viewBox="0 0 120 70" className="w-full max-w-[150px]">
              <path d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`} stroke="rgba(255,255,255,0.14)" strokeWidth="9" fill="none" />
              {v > 0 && <path d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${end.x.toFixed(1)},${end.y.toFixed(1)}`} stroke="#ff3b30" strokeWidth="9" fill="none" />}
              <line x1={cx} y1={cy} x2={cx + (end.x - cx) * 0.78} y2={cy + (end.y - cy) * 0.78} stroke="#fff" strokeWidth="2.5" />
            </svg>
            <div className="-mt-1 text-[24px] font-bold leading-none" style={{ fontFamily: 'Oswald, sans-serif' }}>{Math.round(g.value)}°</div>
            <div className="mt-0.5 font-mono text-[9.5px] uppercase text-dim">{g.label} · EST.</div>
          </div>
        ) : <p className="text-[11.5px] text-dim">{t('hudNoAngle')}</p>}
      </div>
      <div className={box}>
        {head('03', 'hudPath')}
        <ul className="space-y-1.5">{hud.path.map((c, i) => <li key={i} className="flex gap-1.5 font-mono text-[10.5px] uppercase leading-snug text-frost/90"><span className="text-[#ff3b30]">↻</span>{c}</li>)}</ul>
      </div>
      <div className={box} data-testid="hud-form">
        {head('04', 'hudForm')}
        {hud.form.length ? (
          <ul className="space-y-1.5">{hud.form.map((f, i) => <li key={i} className="flex gap-1.5 text-[11px] leading-snug"><span className={f.ok ? 'text-[#34d399]' : 'text-gold'}>{f.ok ? '✓' : '!'}</span><span className="text-frost/90">{f.text}</span></li>)}</ul>
        ) : <p className="text-[11.5px] text-dim">{t('hudNoForm')}</p>}
      </div>
      <div className={`${box} col-span-2`} data-testid="hud-activation">
        {head('05', 'hudActivation')}
        <div className="space-y-1.5">
          {hud.muscles.slice(0, 6).map((m) => (
            <div key={m.id} className="grid grid-cols-[1fr_1.1fr_auto] items-center gap-2 font-mono text-[10.5px] uppercase">
              <span className="truncate text-frost">{m.name}</span>
              <span className="h-1.5 bg-white/10"><span className="block h-full" style={{ width: `${ROLE_LEVEL[m.role] * 100}%`, background: ROLE_COLOR[m.role].text }} /></span>
              <span style={{ color: ROLE_COLOR[m.role].text }}>{roleWordShort(m.role, t)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-dim">{t('typicalRole')}</p>
      </div>
    </div>
  )
}
const roleWordShort = (r: 'primary' | 'secondary' | 'stabilizer', t: ReturnType<typeof useT>) => (r === 'primary' ? t('primaryM') : r === 'secondary' ? t('secondaryM') : roleWord('stabilizer', useApp.getState().lang))

function ExercisePickerField({ value, onPick, placeholder }: { value: string; onPick: (id: string) => void; placeholder?: string }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  useEffect(() => setQ(value), [value])
  const list = useMemo(() => searchExercises(q, 8), [q])
  return (
    <div className="relative">
      <input className="field" data-testid="ex-input" placeholder={placeholder ?? t('exSearchPh')} value={q} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value) onPick('') }} />
      {open && list.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f17] shadow-xl" data-testid="ex-suggest">
          {list.map((e) => (
            <button key={e.id} type="button" className="block w-full px-3 py-2.5 text-left text-[13.5px] hover:bg-white/[0.06]" onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => { setQ(exLabel(e, lang)); setOpen(false); onPick(e.id) }}>
              {exLabel(e, lang)}{lang !== 'en' && <span className="ml-1.5 text-[11.5px] text-dim">{e.name}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function makeThumb(base: HTMLCanvasElement, lm: number[][] | undefined, exId: string | undefined, mode: Mode, lang: Lang, mask?: RawMask | null): string {
  const small = document.createElement('canvas')
  const k = Math.min(1, 200 / Math.max(base.width, base.height))
  const w = Math.round(base.width * k), h = Math.round(base.height * k)
  // fit at full resolution (precise contour), then draw scaled down
  const full = buildPose(lmToPts(lm), base.width, base.height)
  const mk = scaleMask(mask, base.width, base.height)
  const fit = full.ok && mode === 'muscles' ? fitMuscles(full, mk, rolesFor(exId)) : { drawn: [], occluders: [] }
  const sc = (p: { x: number; y: number }) => ({ x: p.x * k, y: p.y * k })
  const drawn = fit.drawn.map((m) => ({ ...m, anchor: sc(m.anchor), polys: m.polys.map((q) => q.map(sc)), fibers: m.fibers.map((q) => q.map(sc)) }))
  const pose = buildPose(lmToPts(lm), w, h)
  const setup = exerciseSetup(exId)
  renderAnalysis(small, base, pose, { mode, lang, title: '', subtitle: '', profile: setup.profile, muscles: musclesFor(exId), spec: [], chrome: false, anatomy: { drawn, mask: scaleMask(mask, w, h), roles: [], occluders: fit.occluders.map((q) => q.map(sc)) }, bw: mode === 'muscles' })
  return small.toDataURL('image/jpeg', 0.72)
}

function FormCheck({ initialEx }: { initialEx: string }) {
  const t = useT()
  const s = useApp()
  const [files, setFiles] = useState<File[]>([])
  const [exId, setExId] = useState(initialEx && analysisEx(initialEx) ? initialEx : '')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState<'' | 'model' | 'ai'>('')
  const [err, setErr] = useState<string | null>(null)
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [current, setCurrent] = useState<{ id: string; base: HTMLCanvasElement; guesses: Guess[]; mask: RawMask | null } | null>(null)
  const [view, setView] = useState<AnalysisRecord | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const media = files[0]
  const isVideo = !!media?.type.startsWith('video/')
  const rec = current ? s.analyses.find((a) => a.id === current.id) ?? null : null
  // clean out any legacy fake demo entries that are still in memory
  useEffect(() => {
    if (s.analyses.some((a) => a.demo)) useApp.setState({ analyses: s.analyses.filter((a) => !a.demo) })
  }, [s.analyses])
  useEffect(() => {
    if (!media) { setPreviewUrl(''); return }
    const u = URL.createObjectURL(media)
    setPreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [media])

  const pick = (list: FileList | null) => {
    if (!list) return
    const arr = [...list].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/')).slice(0, 3)
    const big = arr.find((f) => f.size > 20 * 1024 * 1024)
    setErr(big ? `${big.name}: max 20 MB` : null)
    setFiles(arr.filter((f) => f.size <= 20 * 1024 * 1024))
    setCurrent(null)
    setAiNote(null)
  }

  const update = (id: string, patch: Partial<AnalysisRecord>) =>
    useApp.setState({ analyses: useApp.getState().analyses.map((a) => (a.id === id ? { ...a, ...patch } : a)) })

  const run = async () => {
    if (!media || !previewUrl) return
    setBusy('model')
    setErr(null)
    setAiNote(null)
    try {
      let srcEl: HTMLImageElement | HTMLVideoElement
      if (isVideo) {
        const v = video.current!
        if (v.readyState < 2) await new Promise((r) => v.addEventListener('loadeddata', r, { once: true }))
        if (v.currentTime === 0) { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); await new Promise((r) => v.addEventListener('seeked', r, { once: true })) }
        v.pause()
        srcEl = v
      } else srcEl = await loadImg(previewUrl)
      const base = toCanvas(srcEl, 1080)
      const det = await detectPhoto(base)
      const raw = det.lm
      const lm = raw?.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4), +(Math.min(p.visibility ?? 0, p.presence ?? 1)).toFixed(3), +(p.z ?? 0).toFixed(4)])
      const pose = buildPose(lmToPts(lm), base.width, base.height)
      const guesses = exId ? [] : guessExercise(pose)
      const chosen = exId || (guesses[0]?.sure ? guesses[0].id : '')
      const photoC = toCanvas(base, 540)
      const mode = exerciseSetup(chosen || undefined).mode
      const id = uid()
      const record: AnalysisRecord = {
        id, date: new Date().toISOString(), exId: chosen || undefined, prompt, sections: {}, raw: '', kind: 'ondevice',
        photo: photoC.toDataURL('image/jpeg', 0.72), lm: pose.ok ? lm : undefined, poseFound: pose.ok, detected: !exId && !!chosen,
        mask: pose.ok && det.mask ? maskToPng(det.mask) : undefined,
        thumb: makeThumb(base, pose.ok ? lm : undefined, chosen || undefined, mode, s.lang, det.mask),
      }
      s.addAnalysis(record)
      setCurrent({ id, base, guesses, mask: det.mask })
      setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
      // AI coach in addition (only when the backend is really configured + signed in)
      if (isLive && s.user && !isVideo) {
        setBusy('ai')
        try {
          const ai = await runAnalysis({ files, prompt, exercise: chosen ? (analysisEx(chosen) as never) : undefined })
          if (ai) {
            update(id, { sections: ai.sections as Record<string, string>, raw: ai.raw })
            if (typeof ai.remaining === 'number') setRemaining(ai.remaining)
          }
        } catch (e) {
          setAiNote(t('aiFailed', { e: e instanceof Error ? e.message : String(e) }))
        }
      } else if (!isLive) setAiNote(t('aiNotConnected'))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const changeEx = (newId: string) => {
    if (!current || !rec) return
    const mode = exerciseSetup(newId || undefined).mode
    update(rec.id, { exId: newId || undefined, detected: false, mode: undefined, thumb: makeThumb(current.base, rec.lm, newId || undefined, mode, s.lang, current.mask) })
  }
  const past = s.analyses.filter((a) => !a.demo && a.id !== current?.id)

  return (
    <div>
      <section className="glass-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Label>{t('uploadTitle')}</Label>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="cyan">{t('odUnlimited')}</Badge>
            {remaining !== null && <Badge tone={remaining > 0 ? 'violet' : 'bad'}>{t('aiLeft', { n: remaining })}</Badge>}
          </div>
        </div>
        <input ref={input} type="file" accept="image/*,video/*" multiple className="hidden" data-testid="file-input" onChange={(e) => pick(e.target.files)} />

        {!media ? (
          <button onClick={() => input.current?.click()} className="glass-drop mt-3 flex w-full flex-col items-center gap-3 rounded-[20px] px-6 py-9 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan/30 bg-cyan/10 text-cyan shadow-[0_0_28px_-6px_rgba(34,211,238,0.7)]"><Upload size={24} /></span>
            <span className="text-[15px] font-semibold">{t('pickFiles')}</span>
            <span className="max-w-[260px] text-[12.5px] text-muted">{t('uploadSub')}</span>
          </button>
        ) : (
          <div className="mt-2 space-y-2">
            {!current && previewUrl && (isVideo ? (
              <>
                <video ref={video} src={previewUrl} controls playsInline muted preload="auto" className="w-full rounded-2xl bg-black" />
                <p className="text-[11.5px] text-muted">{t('pickFrame')}</p>
              </>
            ) : (
              <img src={previewUrl} alt="" className="w-full rounded-2xl bg-black" />
            ))}
            <div className="flex flex-wrap items-center gap-2">
              {files.map((f, i) => (
                <span key={i} className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] pl-3 pr-1 text-[12px]">
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  <button aria-label={t('delete')} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10" onClick={() => { setFiles(files.filter((_, j) => j !== i)); setCurrent(null) }}><X size={13} /></button>
                </span>
              ))}
              {files.length < 3 && <Chip onClick={() => input.current?.click()}>+ {t('add')}</Chip>}
            </div>
          </div>
        )}

        <label className="mt-4 block">
          <span className="label">{t('forExercise')}</span>
          <div className="mt-1.5"><ExercisePickerField value={exId ? exLabel(analysisEx(exId), s.lang) : ''} onPick={(id) => { setExId(id); if (current) changeEx(id) }} /></div>
        </label>
        {isLive && s.user && (
          <label className="mt-3 block">
            <span className="label">{t('yourQuestion')}</span>
            <textarea className="field mt-1.5 min-h-[70px] resize-none" placeholder={t('questionPh')} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
        )}

        {err && <p className="mt-3 rounded-xl border border-bad/30 bg-bad/[0.08] px-3 py-2 text-[13px] text-bad">{err}</p>}

        <Button className="mt-4 w-full" size="lg" data-testid="run-check" disabled={!media || !!busy} onClick={run}>
          {busy === 'model' ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> {t('poseLoading')}</> : <>{t('checkForm')} <ArrowRight size={17} /></>}
        </Button>
      </section>

      {rec && current && (
        <div id="result" className="mt-6 scroll-mt-24">
          <ResultView rec={rec} src={current.base} mask={current.mask} guesses={current.guesses} onChangeEx={changeEx} />
          {busy === 'ai' && <p className="mt-3 text-[12.5px] text-muted">{t('aiRunning')}</p>}
          {aiNote && <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-muted" data-testid="ai-note">{aiNote}</p>}
        </div>
      )}

      {past.length > 0 && (
        <>
          <div className="label mb-2 mt-7 !text-frost/80">{t('pastAnalyses')}</div>
          <div className="space-y-2" data-testid="past">
            {past.slice(0, 10).map((a) => {
              const ex = analysisEx(a.exId)
              return (
                <Card key={a.id} onClick={() => setView(a)} className="flex items-center gap-3 p-2.5">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-panel-2">{a.thumb && <img src={a.thumb} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{ex ? exLabel(ex, s.lang) : t('formCheck')}</div>
                    <div className="truncate text-[12px] text-muted">{a.kind === 'ondevice' ? (a.poseFound ? t('odTitle') : t('noPose')) : a.sections['QUICK VERDICT'] ?? a.prompt}</div>
                  </div>
                  <span className="text-[11px] text-dim">{fmtDate(a.date, s.lang)}</span>
                </Card>
              )
            })}
          </div>
        </>
      )}
      <Sheet open={!!view} onClose={() => setView(null)} title={view?.exId ? exLabel(analysisEx(view.exId), s.lang) : t('formCheck')}>
        {view && (view.kind === 'ondevice' ? <ResultView rec={view} /> : <AiCards sections={view.sections} raw={view.raw} />)}
      </Sheet>
    </div>
  )
}

function LiveReps() {
  const t = useT()
  const s = useApp()
  const [kind, setKind] = useState<RepKind>('squat')
  const [target, setTarget] = useState(12)
  const [state, setState] = useState<'idle' | 'loading' | 'running' | 'denied' | 'error'>('idle')
  const [reps, setReps] = useState(0)
  const [phase, setPhase] = useState<'up' | 'down'>('up')
  const [ang, setAng] = useState<number | null>(null)
  const [visible, setVisible] = useState(true)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [voice, setVoice] = useState(s.voice)
  const [errMsg, setErrMsg] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const counter = useRef(new RepCounter('squat'))
  const raf = useRef(0)
  const stream = useRef<MediaStream | null>(null)
  const startedAt = useRef<string>('')
  const voiceRef = useRef(voice)
  voiceRef.current = voice

  const stop = () => {
    cancelAnimationFrame(raf.current)
    stream.current?.getTracks().forEach((tr) => tr.stop())
    stream.current = null
    setState('idle')
  }
  useEffect(() => () => stop(), [])

  const start = async () => {
    setState('loading')
    counter.current = new RepCounter(kind)
    setReps(0)
    startedAt.current = new Date().toISOString()
    try {
      const [pl, media] = await Promise.all([
        getLandmarker('VIDEO'),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
      ])
      stream.current = media
      const v = video.current!
      v.srcObject = media
      await v.play()
      setState('running')
      let last = -1
      const loop = () => {
        if (!stream.current) return
        if (v.readyState >= 2 && v.currentTime !== last) {
          last = v.currentTime
          const c = canvas.current!
          if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight }
          const ctx = c.getContext('2d')!
          ctx.clearRect(0, 0, c.width, c.height)
          const r = pl.detectForVideo(v, performance.now())
          const lm = r.landmarks[0]
          if (lm) {
            const res = counter.current.update(lm)
            setVisible(res.angle !== null)
            setAng(res.angle)
            setPhase(counter.current.phase)
            if (res.counted) {
              setReps(counter.current.reps)
              if (voiceRef.current) speak(String(counter.current.reps), s.lang)
              if (navigator.vibrate) navigator.vibrate(40)
            }
            drawPose(ctx, lm, c.width, c.height, { mirror: false })
          } else setVisible(false)
        }
        raf.current = requestAnimationFrame(loop)
      }
      loop()
    } catch (e) {
      const name = (e as { name?: string })?.name
      stream.current?.getTracks().forEach((tr) => tr.stop())
      stream.current = null
      if (name === 'NotAllowedError' || name === 'SecurityError') setState('denied')
      else {
        setErrMsg(e instanceof Error ? e.message : String(e))
        setState('error')
      }
    }
  }

  const save = () => {
    if (reps === 0) return
    const exId = kind === 'squat' ? 'bodyweight-squat' : 'push-up'
    const session: WorkoutSession = {
      id: uid(), name: `${t(kind === 'squat' ? 'camSquat' : 'camPushup')} · ${t('liveReps')}`, startedAt: startedAt.current || new Date().toISOString(),
      durationSec: Math.round((Date.now() - new Date(startedAt.current || Date.now()).getTime()) / 1000), volumeKg: 0,
      exercises: [{ exId, sets: [{ reps, kg: 0, done: true }] }], source: 'camera',
    }
    s.addSession(session)
    void cloud.session(session)
    s.showToast(t('camSaved'))
    counter.current.reset()
    setReps(0)
  }

  const running = state === 'running'
  const mirror = facing === 'user'

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center gap-2">
        <Chip active={kind === 'squat'} onClick={() => !running && setKind('squat')}>{t('camSquat')}</Chip>
        <Chip active={kind === 'pushup'} onClick={() => !running && setKind('pushup')}>{t('camPushup')}</Chip>
        <button onClick={() => setVoice(!voice)} className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-white/10 text-muted" aria-label={t('camVoice')}>{voice ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
        <button onClick={() => !running && setFacing(facing === 'user' ? 'environment' : 'user')} disabled={running} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-muted disabled:opacity-30" aria-label="Flip camera"><SwitchCamera size={15} /></button>
      </div>

      <div className="relative mt-3 aspect-[3/4] overflow-hidden rounded-[22px] border border-white/10 bg-[#05070a]">
        <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${mirror ? '-scale-x-100' : ''} ${running ? '' : 'opacity-0'}`} />
        <canvas ref={canvas} className={`absolute inset-0 h-full w-full object-cover ${mirror ? '-scale-x-100' : ''}`} />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-violet/12 text-violet"><Camera size={28} /></span>
            <p className="max-w-[250px] text-[13.5px] leading-relaxed text-muted">{state === 'denied' ? t('camDenied') : state === 'error' ? errMsg : state === 'loading' ? t('camLoading') : t('camTip')}</p>
          </div>
        )}
        {running && (
          <>
            <div className="absolute left-3 top-3 rounded-2xl border border-white/10 bg-black/70 px-4 py-2 backdrop-blur">
              <div className="label">{t('camReps')}</div>
              <div className="font-mono text-5xl font-bold tabular-nums leading-none">{reps}<span className="text-xl text-dim">/{target}</span></div>
            </div>
            <div className="absolute right-3 top-3 space-y-1.5 text-right">
              <div className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${phase === 'down' ? 'bg-gold text-black' : 'bg-cyan text-black'}`}>{phase === 'down' ? t('camDown') : t('camUp')}</div>
              {ang !== null && <div className="rounded-lg bg-black/70 px-2.5 py-1 font-mono text-xs">{t('camAngle')} {Math.round(ang)}°</div>}
            </div>
            {!visible && <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-3 py-2 text-center text-[13px] text-gold">{t('camNoBody')}</div>}
            {reps >= target && <div className="absolute inset-x-3 bottom-3 rounded-xl bg-ok px-3 py-2 text-center text-sm font-bold text-black">✓ {target} {t('reps').toLowerCase()}</div>}
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="w-36"><div className="label mb-1">{t('target')}</div><Stepper value={target} onChange={setTarget} min={1} max={100} /></div>
        <div className="flex-1 pt-5">
          {running ? (
            <Button variant="danger" className="w-full" onClick={stop}><Square size={15} /> {t('camStop')}</Button>
          ) : (
            <Button className="w-full" onClick={start} disabled={state === 'loading'}><Camera size={16} /> {state === 'loading' ? t('camLoading') : t('camStart')}</Button>
          )}
        </div>
      </div>
      {reps > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => { counter.current.reset(); setReps(0) }}><RotateCcw size={15} /> {t('camReset')}</Button>
          <Button variant="outline" onClick={save}><Save size={15} /> {t('camSave')}</Button>
        </div>
      )}
      <p className="mt-4 text-center text-[11.5px] text-muted">MediaPipe Pose · on-device · video never leaves your phone</p>
    </div>
  )
}
