import { useEffect, useRef, useState } from 'react'
import { Film, Upload, Square } from 'lucide-react'
import { useT } from '../i18n'
import { Button, Chip, Header } from '../components/ui'
import { OfflineAiPack } from '../components/OfflineAiPack'
import { fmtStamp, runMomentQuery, type FrameMetrics, type MomentHit, type MomentKind } from '../lib/ai/momentSearch'
import { MAX_RECOMMENDED_SEC, openVideoFile, scanVideoFile } from '../lib/ai/videoScan'

const CHIPS: { kind: MomentKind; q: string; key: 'aiChipDeep' | 'aiChipBreak' | 'aiChipPush' | 'aiChipLock' | 'aiChipReps' }[] = [
  { kind: 'deepest-squat', q: 'show deepest squat', key: 'aiChipDeep' },
  { kind: 'form-break', q: 'where did form break?', key: 'aiChipBreak' },
  { kind: 'deepest-pushup', q: 'show deepest push-up', key: 'aiChipPush' },
  { kind: 'lockout', q: 'lockout', key: 'aiChipLock' },
  { kind: 'reps', q: 'count reps', key: 'aiChipReps' },
]

export default function VideoMoments() {
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const playerRef = useRef<HTMLVideoElement>(null)
  const urlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [frames, setFrames] = useState<FrameMetrics[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState('')
  const [scanMs, setScanMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [longClip, setLongClip] = useState(false)
  const [query, setQuery] = useState('show deepest squat')
  const [hit, setHit] = useState<MomentHit | null>(null)
  const [miss, setMiss] = useState(false)

  useEffect(() => () => {
    abortRef.current?.abort()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  const seek = (sec: number) => {
    const v = playerRef.current
    if (!v) return
    v.currentTime = Math.max(0, sec)
    void v.play().catch(() => { /* user can press play */ })
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    abortRef.current?.abort()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setFileName(file.name)
    setFrames(null)
    setHit(null)
    setMiss(false)
    setError(null)
    setScanning(true)
    const started = performance.now()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const { video, url } = await openVideoFile(file)
      urlRef.current = url
      if (playerRef.current) {
        playerRef.current.src = url
        playerRef.current.load()
      }
      const dur = video.duration
      setDuration(dur)
      setLongClip(dur > MAX_RECOMMENDED_SEC)
      const list = await scanVideoFile(video, {
        signal: ac.signal,
        onProgress: (p) => setProgress(t('aiScanning', { t: fmtStamp(p.t), d: fmtStamp(p.duration) })),
      })
      setFrames(list)
      setScanMs(performance.now() - started)
      const first = runMomentQuery(query, list)
      setHit(first)
      setMiss(!first)
      if (first) seek(first.t)
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return
      setError(t('aiOpenFailed'))
    } finally {
      setScanning(false)
    }
  }

  const find = (q = query) => {
    if (!frames) return
    const next = runMomentQuery(q, frames)
    setHit(next)
    setMiss(!next)
    if (next) seek(next.t)
  }

  const reason = (r: MomentHit | { t: number; reason: MomentHit['reason']; value?: number }) => {
    const stamp = fmtStamp(r.t)
    switch (r.reason) {
      case 'deepest-squat': return t('aiReasonDeep', { v: r.value ?? '—' })
      case 'valgus': return t('aiReasonValgus', { t: stamp })
      case 'trunk': return t('aiReasonTrunk', { t: stamp, v: r.value ?? '—' })
      case 'shallow-rep': return t('aiReasonShallow', { t: stamp, v: r.value ?? '—' })
      case 'deepest-pushup': return t('aiReasonPush', { v: r.value ?? '—' })
      case 'lockout': return t('aiReasonLock', { t: stamp })
      case 'reps': return t('aiReasonReps', { n: r.value ?? 0 })
      default: return stamp
    }
  }

  return (
    <div>
      <Header title={t('aiMoments')} back="#/analyze" sub={t('aiMomentsSub')} />
      <p className="text-[12.5px] leading-relaxed text-muted">{t('aiMomentsHow')}</p>
      <input ref={fileRef} type="file" accept="video/*" className="hidden" data-testid="moments-file" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      <Button className="mt-3 w-full" onClick={() => fileRef.current?.click()}><Upload size={16} /> {t('aiUploadVideo')}</Button>
      <p className="mt-2 text-[11.5px] leading-snug text-dim">{t('aiVideoHint')}</p>
      {fileName && <p className="mt-2 truncate font-mono text-[11px] text-cyan">{fileName}{duration ? ` · ${fmtStamp(duration)}` : ''}</p>}
      {longClip && <p className="mt-2 text-[12px] text-gold">{t('aiTooLong')}</p>}
      {scanning && (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-cyan">
          <Film size={16} className="animate-pulse" />
          <span>{progress}</span>
          <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}><Square size={12} /> {t('aiStop')}</Button>
        </div>
      )}
      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
      <video ref={playerRef} data-testid="moments-video" className="mt-3 w-full rounded-2xl border border-white/10 bg-black" controls playsInline muted />
      {frames && duration > 0 && (
        <Timeline duration={duration} frames={frames} hit={hit} onSeek={seek} />
      )}
      {frames && (
        <p className="mt-2 text-[11.5px] text-dim">{t('aiScanDone', { n: frames.length, s: Math.max(1, Math.round(scanMs / 1000)) })}</p>
      )}
      <div className="mt-3">
        <input
          data-testid="moments-query"
          className="num w-full !text-left !text-[14px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') find() }}
          placeholder={t('aiQueryPh')}
          aria-label={t('aiFind')}
          disabled={!frames || scanning}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <Chip key={c.kind} active={query === c.q} onClick={() => { setQuery(c.q); if (frames) find(c.q) }}>{t(c.key)}</Chip>
          ))}
        </div>
        <Button className="mt-3 w-full" data-testid="moments-find" disabled={!frames || scanning || !query.trim()} onClick={() => find()}>{t('aiFind')}</Button>
      </div>
      {hit && (
        <div className="card mt-3 p-4" data-testid="moments-result">
          <button type="button" className="w-full text-left" onClick={() => seek(hit.t)}>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold">{fmtStamp(hit.t)}</div>
            <div className="mt-1 text-[14.5px] text-frost">{reason(hit)}</div>
          </button>
          {hit.also?.map((x, i) => (
            <button type="button" key={`${x.t}-${i}`} className="mt-2 block text-left text-[12.5px] text-cyan" onClick={() => seek(x.t)}>
              {t('aiAlso', { t: fmtStamp(x.t) })} · {reason(x)}
            </button>
          ))}
        </div>
      )}
      {miss && frames && !hit && <p className="mt-3 text-[13px] text-gold">{frames.some((f) => f.ok) ? t('aiNoHit') : t('aiNoPose')}</p>}
      <OfflineAiPack className="mt-4" />
    </div>
  )
}

function Timeline({ duration, frames, hit, onSeek }: { duration: number; frames: FrameMetrics[]; hit: MomentHit | null; onSeek: (t: number) => void }) {
  const marks = frames.filter((f) => f.ok)
  return (
    <button
      type="button"
      data-testid="moments-timeline"
      className="relative mt-2 h-8 w-full overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        onSeek(((e.clientX - r.left) / r.width) * duration)
      }}
    >
      {marks.map((f) => (
        <span
          key={f.t}
          className="absolute top-1 bottom-1 w-px bg-cyan/40"
          style={{ left: `${(f.t / duration) * 100}%` }}
        />
      ))}
      {hit && (
        <span
          className="absolute top-0 bottom-0 w-0.5 bg-gold shadow-[0_0_8px_#f7c548]"
          style={{ left: `${(hit.t / duration) * 100}%` }}
        />
      )}
    </button>
  )
}
