import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Eye, CheckCircle2, AlertTriangle, Wrench, Target, ArrowRight, X, LogIn, Camera, Square, RotateCcw, Save, Volume2, VolumeX, SwitchCamera, Zap } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Card, Chip, Header, Label, Sheet, Stepper, Tabs } from '../components/ui'
import { EXERCISES, EX_BY_ID, exName } from '../data/exercises'
import { hashQuery, navigate } from '../lib/router'
import { runAnalysis, HEADER_KEYS, D31_ANALYSIS_HEADERS } from '../lib/analyze'
import { isLive } from '../lib/env'
import { PLAN_BY_ID } from '../lib/plans'
import { compressImage, fmtDate, speak, uid } from '../lib/util'
import { drawPose, evaluatePose, getLandmarker, RepCounter, type RepKind } from '../lib/pose'
import { cloud } from '../lib/cloud'
import type { AnalysisRecord, WorkoutSession } from '../types'
import { IN_APP } from '../lib/appMode'

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

function ResultCards({ sections, raw, demo }: { sections: Record<string, string>; raw: string; demo: boolean }) {
  const t = useT()
  const has = D31_ANALYSIS_HEADERS.some((h) => sections[h])
  return (
    <div className="space-y-2.5">
      {demo && <div className="rounded-xl border border-gold/25 bg-gold/[0.07] px-3 py-2 text-[12.5px] text-gold">{t('demoAnalysis')}</div>}
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

function PosePreview({ file, show }: { file: File; show: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  // undefined = still detecting, null = no pose found
  const [lm, setLm] = useState<import('@mediapipe/tasks-vision').NormalizedLandmark[] | null | undefined>(undefined)
  const pose = useMemo(() => evaluatePose(lm ?? null), [lm])
  const t = useT()
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    if (!img) return
    let alive = true
    getLandmarker('IMAGE')
      .then((pl) => {
        const r = pl.detect(img)
        if (alive) setLm(r.landmarks[0] ?? null)
      })
      .catch(() => alive && setLm(null))
    return () => {
      alive = false
    }
  }, [img])
  useEffect(() => {
    const c = canvas.current
    if (!c || !img) return
    const scale = Math.min(1, 1080 / Math.max(img.width, img.height))
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, c.width, c.height)
    if (show && lm) drawPose(ctx, lm, c.width, c.height, { angles: pose.angles, result: pose })
  }, [img, lm, show, pose])
  return (
    <div>
      <canvas ref={canvas} className="w-full rounded-2xl bg-black" />
      {show && lm !== undefined && pose.notMeasurable && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/[0.07] px-3 py-2 text-[12.5px] leading-snug text-gold">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{t('angleNotMeasurable')}</span>
        </div>
      )}
      {show && pose.angles.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-dim">{t('anglesNote')}:</span>
          {pose.angles.map((a) => <Badge key={a.name} tone="cyan">{t(`joint_${a.name}`)} {Math.round(a.deg)}°</Badge>)}
        </div>
      )}
    </div>
  )
}

function VideoPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return url ? <video src={url} controls playsInline muted className="w-full rounded-2xl bg-black" /> : null
}

function FormCheck({ initialEx }: { initialEx: string }) {
  const t = useT()
  const s = useApp()
  const plan = effectivePlan(s.membership)
  const limit = PLAN_BY_ID[plan].analyses
  const monthKey = new Date().toISOString().slice(0, 7)
  const usedLocal = s.analyses.filter((a) => a.date.startsWith(monthKey) && !a.demo).length
  const [remaining, setRemaining] = useState<number | null>(null)
  const left = remaining ?? Math.max(0, limit - usedLocal)
  const [files, setFiles] = useState<File[]>([])
  const [exId, setExId] = useState(initialEx && EX_BY_ID[initialEx] ? initialEx : '')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisRecord | null>(null)
  const [showPose, setShowPose] = useState(true)
  const [view, setView] = useState<AnalysisRecord | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const needsSignIn = isLive && !s.user

  const pick = (list: FileList | null) => {
    if (!list) return
    const arr = [...list].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/')).slice(0, 3)
    const big = arr.find((f) => f.size > 20 * 1024 * 1024)
    setErr(big ? `${big.name}: max 20 MB` : null)
    setFiles(arr.filter((f) => f.size <= 20 * 1024 * 1024))
    setResult(null)
  }

  const run = async () => {
    if (needsSignIn) return navigate('/auth?next=/analyze')
    if (isLive && left <= 0) return IN_APP ? useApp.getState().showToast(t('memberOnly')) : navigate('/membership')
    setBusy(true)
    setErr(null)
    try {
      const ex = exId ? EX_BY_ID[exId] : undefined
      const r = await runAnalysis({ files, prompt, exercise: ex })
      if (typeof r.remaining === 'number') setRemaining(r.remaining)
      const firstImg = files.find((f) => f.type.startsWith('image/'))
      const rec: AnalysisRecord = {
        id: uid(), date: new Date().toISOString(), exId: ex?.id, prompt, sections: r.sections as Record<string, string>, raw: r.raw, demo: r.demo,
        thumb: firstImg ? await compressImage(firstImg, 200, 0.7) : undefined,
      }
      s.addAnalysis(rec)
      setResult(rec)
      setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const firstImage = files.find((f) => f.type.startsWith('image/'))

  return (
    <div>
      <section className="glass-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Label>{t('uploadTitle')}</Label>
        <Badge tone={left > 0 ? 'cyan' : 'bad'}>{t('analysesLeft', { n: left })}</Badge>
      </div>
      <input ref={input} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => pick(e.target.files)} />

      {files.length === 0 ? (
        <button onClick={() => input.current?.click()} className="glass-drop mt-3 flex w-full flex-col items-center gap-3 rounded-[20px] px-6 py-9 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan/30 bg-cyan/10 text-cyan shadow-[0_0_28px_-6px_rgba(34,211,238,0.7)]"><Upload size={24} /></span>
          <span className="text-[15px] font-semibold">{t('pickFiles')}</span>
          <span className="max-w-[260px] text-[12.5px] text-muted">{t('uploadSub')}</span>
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          {firstImage ? <PosePreview file={firstImage} show={showPose} /> : files[0] && <VideoPreview file={files[0]} />}
          <div className="flex flex-wrap items-center gap-2">
            {files.map((f, i) => (
              <span key={i} className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] pl-3 pr-1 text-[12px]">
                <span className="max-w-[140px] truncate">{f.name}</span>
                <button aria-label={t('delete')} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={13} /></button>
              </span>
            ))}
            {files.length < 3 && <Chip onClick={() => input.current?.click()}>+ {t('add')}</Chip>}
            {firstImage && <Chip active={showPose} onClick={() => setShowPose(!showPose)}>{t('skeleton')}</Chip>}
          </div>
        </div>
      )}

      <label className="mt-4 block">
        <span className="label">{t('forExercise')}</span>
        <select className="field mt-1.5 appearance-none" value={exId} onChange={(e) => setExId(e.target.value)}>
          <option value="">—</option>
          {EXERCISES.map((e) => <option key={e.id} value={e.id}>{exName(e, s.lang)}</option>)}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="label">{t('yourQuestion')}</span>
        <textarea className="field mt-1.5 min-h-[84px] resize-none" placeholder={t('questionPh')} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>

      {err && <p className="mt-3 rounded-xl border border-bad/30 bg-bad/[0.08] px-3 py-2 text-[13px] text-bad">{err}</p>}

      {needsSignIn ? (
        <Button className="mt-4 w-full" size="lg" onClick={() => navigate('/auth?next=/analyze')}><LogIn size={17} /> {t('signInToAnalyze')}</Button>
      ) : (
        <Button className="mt-4 w-full" size="lg" disabled={files.length === 0 || busy} onClick={run}>
          {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> {t('analyzing')}</> : <>{t('runAnalysis')} <ArrowRight size={17} /></>}
        </Button>
      )}
      </section>

      {result && (
        <div id="result" className="mt-6 scroll-mt-24">
          <Label className="mb-2">{result.exId ? exName(EX_BY_ID[result.exId], s.lang) : t('formCheck')}</Label>
          <ResultCards sections={result.sections} raw={result.raw} demo={result.demo} />
        </div>
      )}

      {s.analyses.length > 0 && (
        <>
          <div className="label mb-2 mt-7 !text-frost/80">{t('pastAnalyses')}</div>
          <div className="space-y-2">
            {s.analyses.slice(0, 8).map((a) => (
              <Card key={a.id} onClick={() => setView(a)} className="flex items-center gap-3 p-2.5">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-panel-2">{a.thumb && <img src={a.thumb} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{a.exId ? exName(EX_BY_ID[a.exId], s.lang) : t('formCheck')}</div>
                  <div className="truncate text-[12px] text-muted">{a.sections['QUICK VERDICT'] ?? a.prompt}</div>
                </div>
                <div className="flex flex-col items-end gap-1"><span className="text-[11px] text-dim">{fmtDate(a.date, s.lang)}</span>{a.demo && <Badge tone="gold">{t('demo')}</Badge>}</div>
              </Card>
            ))}
          </div>
        </>
      )}
      <Sheet open={!!view} onClose={() => setView(null)} title={view?.exId ? exName(EX_BY_ID[view.exId], s.lang) : t('formCheck')}>
        {view && <ResultCards sections={view.sections} raw={view.raw} demo={view.demo} />}
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
