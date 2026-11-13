import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Gauge, Lock, LockOpen, Maximize, Minimize, Minus, Pause, Play, Plus, Repeat, RotateCcw, RotateCw, SkipBack, SkipForward } from 'lucide-react'
import { useT } from '../i18n'

/**
 * One in-app player for Darshan's exercise clips and Knowledge videos.
 * Streams the file directly (public Drive files via drive.usercontent, or a saved in-app blob),
 * with our own controls; falls back to Drive's embedded player — still inside our frame — if a file can't stream.
 */
export type PlayerItem = { title: string; sub?: string; sources: { src: string; type?: string }[]; poster?: string; embed?: string; link?: { href: string; label: string } }
type Req = { items: PlayerItem[]; index?: number; loop?: boolean }

export const openPlayer = (r: Req) => window.dispatchEvent(new CustomEvent<Req>('d31-player', { detail: r }))

export const SPEED_MIN = 0.25
export const SPEED_MAX = 4
export const SPEED_STEP = 0.05
export const SPEED_MARKS = [0.25, 1, 2, 3, 4]
const clampSpeed = (v: number) => Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, v)) / SPEED_STEP) * SPEED_STEP
const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`
}

export function VideoPlayer() {
  const [req, setReq] = useState<Req | null>(null)
  useEffect(() => {
    const on = (e: Event) => setReq((e as CustomEvent<Req>).detail)
    // Darshan's exercise clips use the same player (looping by default)
    const clip = (e: Event) => {
      const c = (e as CustomEvent<{ name: string; title: string; exId?: string }>).detail
      const B = import.meta.env.BASE_URL || '/'
      setReq({
        loop: true,
        items: [{
          title: c.title, sub: 'Darshan Chavda · D31',
          sources: [{ src: `${B}media/clips/${c.name}.webm`, type: 'video/webm' }, { src: `${B}media/clips/${c.name}.mp4`, type: 'video/mp4' }],
          poster: `${B}media/clips/${c.name}-poster.webp`,
          link: c.exId && !window.location.hash.startsWith(`#/library/${c.exId}`) ? { href: `#/library/${c.exId}`, label: 'How to →' } : undefined,
        }],
      })
    }
    window.addEventListener('d31-player', on)
    window.addEventListener('d31-clip', clip)
    return () => { window.removeEventListener('d31-player', on); window.removeEventListener('d31-clip', clip) }
  }, [])
  if (!req) return null
  return createPortal(<Player req={req} onClose={() => setReq(null)} />, document.body)
}

function Player({ req, onClose }: { req: Req; onClose: () => void }) {
  const t = useT()
  const v = useRef<HTMLVideoElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(req.index ?? 0)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const [buf, setBuf] = useState(0)
  const [speed, setSpeedState] = useState(1)
  const [loop, setLoop] = useState(!!req.loop)
  const [locked, setLocked] = useState(false)
  const [ui, setUi] = useState(true)
  const [sheet, setSheet] = useState(false)
  const [failed, setFailed] = useState(() => !req.items[req.index ?? 0]?.sources.length)
  const [fs, setFs] = useState(false)
  const [ripple, setRipple] = useState<{ side: 'l' | 'r'; n: number } | null>(null)
  const item = req.items[idx]
  const many = req.items.length > 1

  const setSpeed = useCallback((x: number) => {
    const s = clampSpeed(x)
    setSpeedState(s)
    if (v.current) v.current.playbackRate = s
  }, [])
  const seek = useCallback((d: number) => {
    const el = v.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min((el.duration || 0) - 0.05, el.currentTime + d))
    setCur(el.currentTime)
  }, [])
  const toggle = useCallback(() => {
    const el = v.current
    if (!el) return
    if (el.paused) el.play().catch(() => {}); else el.pause()
  }, [])
  const go = useCallback((d: number) => {
    setFailed(!req.items[(idx + d + req.items.length) % req.items.length]?.sources.length); setCur(0); setDur(0); setBuf(0)
    setIdx((i) => (i + d + req.items.length) % req.items.length)
  }, [req.items, idx])
  const close = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    onClose()
  }, [onClose])
  const toggleFs = async () => {
    const el = box.current
    if (!el) return
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.().catch(() => {})
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
      await o?.lock?.('landscape').catch(() => {})
    } else {
      try { (screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.() } catch { /* ignore */ }
      await document.exitFullscreen().catch(() => {})
    }
  }

  // keep rate/loop on source change
  useEffect(() => { const el = v.current; if (el) { el.playbackRate = speed; el.loop = loop } }, [idx, speed, loop])
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('fullscreenchange', on); document.body.style.overflow = '' }
  }, [])
  // auto-hide controls while playing
  useEffect(() => {
    if (!ui || !playing || sheet) return
    const id = setTimeout(() => setUi(false), 3200)
    return () => clearTimeout(id)
  }, [ui, playing, sheet, cur])
  // keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'range' && e.key.startsWith('Arrow')) return
      if (e.key === 'Escape') { if (sheet) setSheet(false); else void close(); return }
      if (locked) return
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle() }
      else if (e.key === 'ArrowLeft' || e.key === 'j') { e.preventDefault(); seek(-10) }
      else if (e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); seek(10) }
      else if (e.key === '+' || e.key === '=') setSpeed(speed + SPEED_STEP)
      else if (e.key === '-' || e.key === '_') setSpeed(speed - SPEED_STEP)
      else if (e.key === 'f') void toggleFs()
      else return
      setUi(true)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  // taps: single = show/hide controls, double left/right = ∓10 s, double centre = play/pause
  const lastTap = useRef<{ t: number; x: number } | null>(null)
  const single = useRef<number>(0)
  const onTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (locked) { setUi(true); return }
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const now = performance.now()
    const prev = lastTap.current
    if (prev && now - prev.t < 300) {
      clearTimeout(single.current)
      lastTap.current = null
      if (x < 0.38) { seek(-10); setRipple({ side: 'l', n: Date.now() }) }
      else if (x > 0.62) { seek(10); setRipple({ side: 'r', n: Date.now() }) }
      else toggle()
      return
    }
    lastTap.current = { t: now, x }
    single.current = window.setTimeout(() => setUi((u) => !u), 260)
  }
  useEffect(() => { if (!ripple) return; const id = setTimeout(() => setRipple(null), 600); return () => clearTimeout(id) }, [ripple])

  const pct = dur ? (cur / dur) * 100 : 0
  const bufPct = dur ? (buf / dur) * 100 : 0
  const btn = 'grid place-items-center rounded-full text-white transition active:scale-90 disabled:opacity-30'

  return (
    <div ref={box} role="dialog" aria-modal="true" aria-label={item.title} data-testid="player" className="vp dark-zone fixed inset-0 z-[80] bg-black text-white select-none">
      {failed && item.embed ? (
        <div className="absolute inset-0 flex flex-col pt-[calc(env(safe-area-inset-top)+64px)]">
          {item.sources.length > 0 && <p className="mx-4 mb-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-[12px] text-gold">{t('pStreamFail')}</p>}
          <iframe key={item.embed} src={item.embed} title={item.title} allow="autoplay; fullscreen" allowFullScreen className="w-full flex-1 border-0" data-testid="player-embed" />
          {many && (
            <div className="flex items-center justify-center gap-4 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
              <button aria-label={t('pPrev')} data-testid="p-prev" onClick={() => go(-1)} className={`${btn} h-11 w-11 bg-white/10`}><SkipBack size={20} fill="currentColor" /></button>
              <span className="font-mono text-[12px] text-white/70">{idx + 1}/{req.items.length}</span>
              <button aria-label={t('pNext')} data-testid="p-next" onClick={() => go(1)} className={`${btn} h-11 w-11 bg-white/10`}><SkipForward size={20} fill="currentColor" /></button>
            </div>
          )}
        </div>
      ) : (
        <>
          <video
            ref={v} key={`${idx}-${item.sources[0]?.src}`} data-testid="player-video" crossOrigin="anonymous"
            className="absolute inset-0 h-full w-full object-contain" poster={item.poster} autoPlay playsInline preload="metadata"
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => { setDur(e.currentTarget.duration); e.currentTarget.playbackRate = speed; e.currentTarget.loop = loop }}
            onDurationChange={(e) => setDur(e.currentTarget.duration)}
            onProgress={(e) => { const b = e.currentTarget.buffered; if (b.length) setBuf(b.end(b.length - 1)) }}
            onEnded={() => { if (!loop && many && idx < req.items.length - 1) go(1) }}
            onError={() => item.embed && setFailed(true)}
          >
            {item.sources.map((s) => <source key={s.src} src={s.src} type={s.type} onError={(e) => { const p = e.currentTarget.parentElement as HTMLVideoElement | null; if (p && e.currentTarget === p.lastElementChild && item.embed) setFailed(true) }} />)}
          </video>
          <div className="absolute inset-0" onPointerUp={onTap} data-testid="player-tap" />
          {ripple && <div key={ripple.n} className={`vp-ripple ${ripple.side === 'l' ? 'left-0' : 'right-0'}`}><span>{ripple.side === 'l' ? <RotateCcw size={26} /> : <RotateCw size={26} />}<b>10 s</b></span></div>}
        </>
      )}

      {/* top bar */}
      <div className={`vp-top absolute inset-x-0 top-0 z-[2] flex items-center gap-2 px-3 pb-6 pt-[calc(env(safe-area-inset-top)+10px)] transition-opacity duration-300 ${(ui || failed) && !locked ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button aria-label={t('pClose')} data-testid="p-close" onClick={() => void close()} className={`${btn} h-10 w-10 bg-white/10 backdrop-blur`}><ArrowLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold" data-testid="player-title">{item.title}</div>
          {(item.sub || many) && <div className="truncate font-mono text-[10.5px] tracking-wider text-white/60">{item.sub}{many ? `${item.sub ? ' · ' : ''}${idx + 1}/${req.items.length}` : ''}</div>}
        </div>
        <button aria-label={t('pLoop')} aria-pressed={loop} data-testid="p-loop" onClick={() => setLoop(!loop)} className={`${btn} h-10 w-10 ${loop ? 'bg-cyan/25 text-cyan shadow-[0_0_16px_-4px_rgba(34,211,238,0.9)]' : 'bg-white/10'}`}><Repeat size={18} /></button>
        <button aria-label={t('pLock')} data-testid="p-lock" onClick={() => { setLocked(true); setSheet(false) }} className={`${btn} h-10 w-10 bg-white/10`}><Lock size={17} /></button>
      </div>

      {/* centre controls */}
      {!failed && (
        <div className={`absolute inset-x-0 top-1/2 z-[2] flex -translate-y-1/2 items-center justify-center gap-3 transition-opacity duration-300 ${ui && !locked ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <button aria-label={t('pPrev')} data-testid="p-prev" disabled={!many} onClick={() => go(-1)} className={`${btn} h-11 w-11 bg-black/40`}><SkipBack size={20} fill="currentColor" /></button>
          <button aria-label={t('pBack10')} data-testid="p-back10" onClick={() => seek(-10)} className={`${btn} relative h-12 w-12 bg-black/40`}><RotateCcw size={26} /><span className="absolute text-[8.5px] font-bold">10</span></button>
          <button aria-label={playing ? t('pPause') : t('pPlay')} data-testid="p-play" onClick={toggle} className="vp-play grid h-[72px] w-[72px] place-items-center rounded-full text-[#05080f] active:scale-95">{playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}</button>
          <button aria-label={t('pFwd10')} data-testid="p-fwd10" onClick={() => seek(10)} className={`${btn} relative h-12 w-12 bg-black/40`}><RotateCw size={26} /><span className="absolute text-[8.5px] font-bold">10</span></button>
          <button aria-label={t('pNext')} data-testid="p-next" disabled={!many} onClick={() => go(1)} className={`${btn} h-11 w-11 bg-black/40`}><SkipForward size={20} fill="currentColor" /></button>
        </div>
      )}

      {/* bottom bar */}
      {!failed && (
        <div className={`vp-bottom absolute inset-x-0 bottom-0 z-[2] px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-8 transition-opacity duration-300 ${ui && !locked ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className="flex items-center gap-3">
            <span className="w-12 font-mono text-[11.5px] tabular-nums text-white/90" data-testid="p-time">{fmt(cur)}</span>
            <div className="relative flex-1">
              <div className="vp-rail"><span className="vp-buf" style={{ width: `${bufPct}%` }} /><span className="vp-fill" style={{ width: `${pct}%` }} /></div>
              <input type="range" aria-label="Seek" data-testid="p-scrub" min={0} max={dur || 0} step={0.1} value={cur} onChange={(e) => { const el = v.current; if (el) { el.currentTime = Number(e.target.value); setCur(el.currentTime) } }} className="vp-range" style={{ ['--p' as string]: `${pct}%` }} />
            </div>
            <span className="w-12 text-right font-mono text-[11.5px] tabular-nums text-white/60" data-testid="p-dur">{fmt(dur)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button aria-label={`${t('pSpeed')} −`} onClick={() => setSpeed(speed - SPEED_STEP)} className={`${btn} h-9 w-9 bg-white/10`}><Minus size={16} /></button>
            <button data-testid="p-speed" onClick={() => setSheet(true)} className="flex h-9 items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/10 px-3 font-mono text-[13px] font-bold text-cyan"><Gauge size={15} /> {speed.toFixed(2)}x</button>
            <button aria-label={`${t('pSpeed')} +`} onClick={() => setSpeed(speed + SPEED_STEP)} className={`${btn} h-9 w-9 bg-white/10`}><Plus size={16} /></button>
            {item.link && <a href={item.link.href} onClick={() => void close()} className="ml-1 truncate rounded-full border border-gold/40 px-3 py-1.5 text-[12px] font-semibold text-gold">{item.link.label}</a>}
            <button aria-label={t('pFullscreen')} data-testid="p-fs" onClick={() => void toggleFs()} className={`${btn} ml-auto h-9 w-9 bg-white/10`}>{fs ? <Minimize size={17} /> : <Maximize size={17} />}</button>
          </div>
        </div>
      )}

      {/* locked */}
      {locked && (
        <button data-testid="p-unlock" onClick={() => { setLocked(false); setUi(true) }} className="absolute bottom-[calc(env(safe-area-inset-bottom)+28px)] left-1/2 z-[3] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2.5 text-[13px] font-semibold backdrop-blur">
          <LockOpen size={16} /> {t('pUnlock')}
        </button>
      )}

      {/* speed sheet */}
      {sheet && (
        <div className="absolute inset-0 z-[4] flex items-end bg-black/40" onClick={() => setSheet(false)}>
          <div className="vp-sheet w-full rounded-t-[26px] px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4" onClick={(e) => e.stopPropagation()} data-testid="p-speed-sheet">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
            <div className="flex items-center justify-between">
              <span className="label !text-white/70">{t('pSpeed')}</span>
              <button data-testid="p-speed-reset" onClick={() => setSpeed(1)} className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[12px] font-semibold"><RotateCcw size={13} /> {t('pReset')}</button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-4">
              <button aria-label={`${t('pSpeed')} −`} data-testid="p-speed-minus" onClick={() => setSpeed(speed - SPEED_STEP)} className={`${btn} h-11 w-11 bg-white/10`}><Minus size={18} /></button>
              <div className="vp-speed-val w-[120px] text-center font-mono text-[34px] font-bold tabular-nums" data-testid="p-speed-val">{speed.toFixed(2)}x</div>
              <button aria-label={`${t('pSpeed')} +`} data-testid="p-speed-plus" onClick={() => setSpeed(speed + SPEED_STEP)} className={`${btn} h-11 w-11 bg-white/10`}><Plus size={18} /></button>
            </div>
            <div className="relative mt-4">
              <input type="range" aria-label={t('pSpeed')} data-testid="p-speed-slider" min={SPEED_MIN} max={SPEED_MAX} step={SPEED_STEP} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="vp-range vp-range-speed" style={{ ['--p' as string]: `${((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%` }} />
              <div className="relative mt-2 h-6">
                {SPEED_MARKS.map((m) => {
                  const left = ((m - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100
                  return (
                    <button key={m} onClick={() => setSpeed(m)} className={`absolute top-0 -translate-x-1/2 font-mono text-[11.5px] font-bold ${Math.abs(speed - m) < 0.001 ? 'text-cyan' : 'text-white/55'}`} style={{ left: `${left}%` }}>
                      <span className="mx-auto mb-0.5 block h-1.5 w-px bg-current" />{m.toFixed(m < 1 ? 2 : 1)}x
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
