/**
 * GIF-like Knowledge video preview: a tiny muted looping montage (made at deploy by scripts/make-previews.mjs)
 * that autoplays only while on screen (IntersectionObserver), loads nothing until it is near the viewport,
 * and pauses off-screen. Tap → the normal in-app player. Data-saver / reduced-motion → still frame only.
 * Fallbacks: no montage yet → direct Drive stream (when an API key is configured) limited to the first 4 s,
 * otherwise the video's thumbnail with a slow pan, so every video still "moves".
 */
import { useEffect, useRef, useState } from 'react'
import { Lock, Play } from 'lucide-react'
import { kImg, kStream } from '../lib/knowledge'
import { useT } from '../i18n'
import { useSettings } from '../store/settings'

let index: Promise<Set<string>> | null = null
function previewIds(): Promise<Set<string>> {
  if (!index) index = fetch(`${import.meta.env.BASE_URL}knowledge/previews/index.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : { ids: [] }))
    .then((j: { ids?: string[] }) => new Set(j.ids ?? []))
    .catch(() => new Set<string>())
  return index
}
const lowData = () => {
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return useSettings.getState().reduceData || !!c?.saveData || c?.effectiveType === 'slow-2g' || c?.effectiveType === '2g' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function KPreview({ id, onClick, locked, label, className = '', bare = false }: { id: string; onClick?: () => void; locked?: boolean; label?: string; className?: string; bare?: boolean }) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const vid = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<string | null | undefined>(undefined) // undefined = not decided yet
  const [near, setNear] = useState(false)
  const [visible, setVisible] = useState(false)
  const [playing, setPlaying] = useState(false)
  const still = lowData()

  // decide the source once the tile is near the screen
  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      for (const e of es) { if (e.isIntersecting) setNear(true); setVisible(e.intersectionRatio >= 0.35) }
    }, { rootMargin: '200px 0px', threshold: [0, 0.35, 0.7] })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!near || still || src !== undefined) return
    let live = true
    void previewIds().then((ids) => {
      if (!live) return
      setSrc(ids.has(id) ? `${import.meta.env.BASE_URL}knowledge/previews/${id}.mp4` : kStream(id))
    })
    return () => { live = false }
  }, [near, still, id, src])
  // play only while visible
  useEffect(() => {
    const v = vid.current
    if (!v || !src) return
    if (visible && document.visibilityState === 'visible') v.play().catch(() => setPlaying(false))
    else v.pause()
  }, [visible, src])
  useEffect(() => {
    const on = () => { const v = vid.current; if (v && document.visibilityState !== 'visible') v.pause() }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  const direct = !!src && !src.includes('/knowledge/previews/')
  const poster = kImg(id, 480)
  return (
    <div
      ref={box} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} data-testid="k-gif" data-playing={playing || undefined}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick() } : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
      className={`kgif dark-zone overflow-hidden ${bare ? 'pointer-events-none' : 'relative aspect-video rounded-xl border border-white/10 bg-black'} ${className}`}
    >
      {!bare && <img src={poster} alt="" loading="lazy" referrerPolicy="no-referrer" className={`absolute inset-0 h-full w-full object-cover ${!src && !still ? 'kgif-pan' : ''} ${playing ? 'opacity-0' : ''} transition-opacity duration-500`} />}
      {src && (
        <video
          ref={vid} src={src} muted loop playsInline preload="metadata" disablePictureInPicture aria-hidden
          onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setSrc(null)}
          onTimeUpdate={direct ? (e) => { const v = e.currentTarget; if (v.currentTime > 4) v.currentTime = 0 } : undefined}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${playing ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {!bare && (
        <>
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(4,6,12,0.75))]" />
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-[0.15em] text-cyan backdrop-blur">{t('kGifTag')}{label ? ` · ${label}` : ''}</span>
          <span className={`pointer-events-none absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full ${locked ? 'border border-gold/60 bg-black/60 text-gold' : 'bg-neon-static text-[#05080f]'}`}>{locked ? <Lock size={15} /> : <Play size={15} fill="currentColor" className="ml-0.5" />}</span>
        </>
      )}
    </div>
  )
}
