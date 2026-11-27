import { useRef, useState } from 'react'
import { Upload, ScanLine, Sparkles } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Header, Label } from '../components/ui'
import { OfflineAiPack } from '../components/OfflineAiPack'
import { SearchBox } from '../components/SearchBox'
import { isLive } from '../lib/env'
import { navigate } from '../lib/router'
import { detectPhoto, drawPose } from '../lib/pose'
import { analysisEx, buildPose, evaluateRules, exLabel, insights, metricLabel, searchExercises, type AnalysisExercise, type CheckResult, type Pose } from '../lib/formCheck'
import { runAnalysis, HEADER_KEYS, D31_ANALYSIS_HEADERS } from '../lib/analyze'
import { ANALYST_HEADERS, buildAnalystPrompt, parseAnalystReply, type AnalystHeader, type AnalystReply } from '../lib/ai/analystPrompt'

const ANGLE_KEYS = ['knee', 'hip', 'elbow', 'shoulder', 'trunkLean'] as const

const ANALYST_I18N: Record<AnalystHeader, 'h_EXERCISE' | 'h_VISIBLE' | 'h_GOOD' | 'h_CHECK' | 'h_CORRECTION' | 'h_NEXT_CUE' | 'h_CONFIDENCE'> = {
  EXERCISE: 'h_EXERCISE',
  VISIBLE: 'h_VISIBLE',
  GOOD: 'h_GOOD',
  CHECK: 'h_CHECK',
  CORRECTION: 'h_CORRECTION',
  'NEXT CUE': 'h_NEXT_CUE',
  CONFIDENCE: 'h_CONFIDENCE',
}

function toCanvas(src: HTMLImageElement, max: number): HTMLCanvasElement {
  const w0 = src.naturalWidth || src.width
  const h0 = src.naturalHeight || src.height
  const k = Math.min(1, max / Math.max(w0, h0, 1))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w0 * k))
  c.height = Math.max(1, Math.round(h0 * k))
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return c
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } finally {
    URL.revokeObjectURL(url)
  }
  return img
}

export default function AskImage() {
  const t = useT()
  const s = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [pose, setPose] = useState<Pose | null>(null)
  const [checks, setChecks] = useState<CheckResult[]>([])
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ai, setAi] = useState<AnalystReply | null>(null)
  const [aiLegacy, setAiLegacy] = useState<Record<string, string> | null>(null)
  const [aiRaw, setAiRaw] = useState<string | null>(null)
  const [exQ, setExQ] = useState('')
  const [exId, setExId] = useState<string | undefined>()
  const suggestions = exQ.trim() ? searchExercises(exQ, 6) : []
  const chosen: AnalysisExercise | undefined = analysisEx(exId)

  const runLocal = async (f: File, id?: string) => {
    setBusy(true)
    setError(null)
    setAi(null)
    setAiLegacy(null)
    setAiRaw(null)
    try {
      const img = await loadImage(f)
      const base = toCanvas(img, 720)
      const { lm } = await detectPhoto(base)
      const p = buildPose(lm, base.width, base.height)
      setPose(p)
      const ev = evaluateRules(p, id, s.lang)
      setChecks(ev.checks)
      const out = canvasRef.current
      if (out) {
        out.width = base.width
        out.height = base.height
        const ctx = out.getContext('2d')!
        ctx.drawImage(base, 0, 0)
        if (lm) drawPose(ctx, lm as never, base.width, base.height)
      }
    } catch {
      setError(t('aiNoAngles'))
      setPose(null)
      setChecks([])
    } finally {
      setBusy(false)
    }
  }

  const onFile = (f: File | undefined) => {
    if (!f) return
    setFile(f)
    void runLocal(f, exId)
  }

  const pickEx = (e: AnalysisExercise) => {
    setExId(e.id)
    setExQ(exLabel(e, s.lang))
    if (file) void runLocal(file, e.id)
  }

  const angles = pose
    ? ANGLE_KEYS.filter((k) => pose.metrics[k]).map((k) => ({ label: metricLabel(k, s.lang), value: `${Math.round(pose.metrics[k]!.v)}°` }))
    : []
  const heads = insights(checks)
  const canAi = isLive && !!s.user

  const askAi = async () => {
    if (!file) return
    if (!canAi) {
      if (!isLive) { s.showToast(t('aiNotConnected')); return }
      navigate('/auth')
      return
    }
    setAiBusy(true)
    setError(null)
    try {
      const prompt = buildAnalystPrompt({
        lang: s.lang,
        angles,
        cues: checks.map((c) => ({ label: c.label, value: c.value, msg: c.msg })),
        exercise: chosen ? exLabel(chosen, s.lang) : exQ || undefined,
        view: pose?.ok ? pose.view : undefined,
      })
      const res = await runAnalysis({ files: [file], prompt, exercise: chosen as never })
      if (!res) {
        s.showToast(t('aiNotConnected'))
        return
      }
      const parsed = parseAnalystReply(res.raw)
      setAi(parsed.parsed ? parsed : parsed)
      setAiRaw(res.raw)
      if (!parsed.parsed && res.parsed) setAiLegacy(res.sections as Record<string, string>)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('aiNotConnected'))
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div>
      <Header title={t('aiAsk')} back="#/analyze" sub={t('aiAskSub')} />
      <p className="text-[12.5px] leading-relaxed text-muted">{t('aiAskHow')}</p>
      <SearchBox wrapClass="mt-3" value={exQ} onValue={(v) => { setExQ(v); setExId(undefined) }} placeholder={t('search')} testid="ask-ex" clearLabel={t('closeLbl')} />
      {suggestions.length > 0 && !exId && (
        <div className="mt-1 overflow-hidden rounded-xl border border-white/10">
          {suggestions.map((e) => (
            <button key={e.id} type="button" className="block w-full truncate px-3 py-2 text-left text-[13px] text-frost hover:bg-white/5" onClick={() => pickEx(e)}>
              {exLabel(e, s.lang)}
            </button>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="ask-file" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      <Button className="mt-3 w-full" onClick={() => fileRef.current?.click()}><Upload size={16} /> {t('aiPickPhoto')}</Button>
      {busy && <p className="mt-3 flex items-center gap-2 text-[13px] text-cyan"><ScanLine size={16} className="animate-pulse" /> …</p>}
      <canvas ref={canvasRef} className={`mt-3 w-full rounded-2xl border border-white/10 ${pose ? '' : 'hidden'}`} />
      {pose && (
        <div className="mt-3" data-testid="ask-angles">
          <Label>{t('aiAnglesTitle')}</Label>
          {pose.ok && <p className="mt-1 text-[11.5px] text-dim">{t('aiView', { v: pose.view })}</p>}
          {angles.length ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {angles.map((a) => (
                <div key={a.label} className="card p-3">
                  <div className="label !text-[9px]">{a.label}</div>
                  <div className="readout-gold mt-0.5 text-[18px] font-bold">{a.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-gold">{t('aiNoAngles')}</p>
          )}
          {heads.length > 0 && (
            <div className="mt-3">
              <Label>{t('aiLocalCues')}</Label>
              <ul className="mt-2 space-y-1.5">
                {heads.map((c) => (
                  <li key={c.metric} className="text-[13.5px] leading-snug text-frost/90">
                    <span className={c.status === 'fix' ? 'text-bad' : c.status === 'warn' ? 'text-gold' : 'text-cyan'}>{c.label}</span>
                    {' · '}{c.value}{c.msg ? ` — ${c.msg}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-[12px] leading-snug text-dim">{t('aiSentNote')}</p>
          {!canAi && <p className="mt-2 text-[12.5px] text-gold">{isLive ? t('aiNeedSignIn') : t('aiNotConnected')}</p>}
          <Button className="mt-3 w-full" data-testid="ask-ai" disabled={aiBusy || !file} onClick={() => void askAi()}>
            <Sparkles size={16} /> {aiBusy ? t('aiSending') : t('aiGetFeedback')}
          </Button>
        </div>
      )}
      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
      {ai?.parsed && (
        <div className="mt-4 space-y-2.5" data-testid="ask-feedback">
          <Label>{t('aiFeedback')}</Label>
          {ANALYST_HEADERS.filter((h) => ai.sections[h]).map((h) => (
            <div key={h} className="card p-4">
              <div className="label text-cyan">{t(ANALYST_I18N[h])}</div>
              <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-frost/95">{ai.sections[h]}</p>
            </div>
          ))}
        </div>
      )}
      {!ai?.parsed && aiLegacy && (
        <div className="mt-4 space-y-2.5">
          {D31_ANALYSIS_HEADERS.filter((h) => aiLegacy[h]).map((h) => (
            <div key={h} className="card p-4">
              <div className="label text-cyan">{t(HEADER_KEYS[h])}</div>
              <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-frost/95">{aiLegacy[h]}</p>
            </div>
          ))}
        </div>
      )}
      {!ai?.parsed && !aiLegacy && aiRaw && (
        <div className="card mt-4 whitespace-pre-line p-4 text-[14px] leading-relaxed">{aiRaw}</div>
      )}
      <OfflineAiPack className="mt-4" />
    </div>
  )
}
