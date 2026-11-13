import { useEffect, useRef, useState } from 'react'
import { mediaUrl } from './hud'
import { useSettings } from '../store/settings'

/**
 * Layered futuristic background: animated aurora mesh (CSS), a canvas starfield with
 * three depth layers that parallax on scroll, over Darshan's cosmic Shiva artwork (darkened for readability).
 * Cheap on phones: DPR capped at 1.5, ~30 fps, paused when the tab is hidden,
 * and fully static when the user prefers reduced motion.
 */
const BASE = import.meta.env.BASE_URL || '/'

/** Live Shiva background: Darshan's cosmic Shiva artwork only (darkened), a 22 s seamless sine-eased pan
 *  head → heart chakra → head with a gentle 1.15→1.35→1.15 zoom (muted, WebM VP9 + H.264 MP4). Static artwork with reduced motion / Save-Data / video error. */
function LiveShiva() {
  const allow = useSettings((s) => s.bgVideo && !s.reduceData)
  return allow ? <LiveShivaVideo /> : <img className="shiva" src={mediaUrl('shiva-720')} srcSet={`${mediaUrl('shiva-720')} 720w, ${mediaUrl('shiva')} 981w`} sizes="100vw" alt="" decoding="async" fetchPriority="low" />
}

function LiveShivaVideo() {
  const vref = useRef<HTMLVideoElement>(null)
  const [still, setStill] = useState(() => {
    if (typeof window === 'undefined') return true
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } }
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !!nav.connection?.saveData
  })
  useEffect(() => {
    const v = vref.current
    if (!v || still) return
    const sync = () => { if (document.hidden) v.pause(); else v.play().catch(() => {}) }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [still])
  if (still) return <img className="shiva" src={mediaUrl('shiva-720')} srcSet={`${mediaUrl('shiva-720')} 720w, ${mediaUrl('shiva')} 981w`} sizes="100vw" alt="" decoding="async" fetchPriority="low" />
  return (
    <video
      ref={vref}
      className="shiva shiva-video"
      poster={`${BASE}media/bg/shiva-loop-poster.jpg`}
      autoPlay muted loop playsInline preload="auto"
      disablePictureInPicture
      onError={() => setStill(true)}
    >
      <source src={`${BASE}media/bg/shiva-loop.webm`} type="video/webm" />
      <source src={`${BASE}media/bg/shiva-loop.mp4`} type="video/mp4" onError={() => setStill(true)} />
    </video>
  )
}

export function Cosmos() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    let w = 0, h = 0
    type Star = { x: number; y: number; r: number; z: number; tw: number; c: string }
    let stars: Star[] = []
    const COLORS = ['#ffffff', '#bdefff', '#ffe7a8', '#d8ccff']
    const seed = () => {
      const n = Math.round(Math.min(170, (w * h) / 5200))
      stars = Array.from({ length: n }, () => {
        const z = Math.random() < 0.6 ? 0.25 : Math.random() < 0.75 ? 0.55 : 1
        return { x: Math.random() * w, y: Math.random() * h, r: (0.35 + Math.random() * 0.9) * (0.6 + z * 0.7), z, tw: Math.random() * Math.PI * 2, c: COLORS[(Math.random() * COLORS.length) | 0] }
      })
    }
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
      if (reduce) draw(0)
    }
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      const sy = window.scrollY
      for (const s of stars) {
        const y = (((s.y - sy * s.z * 0.18 + (reduce ? 0 : t * 0.004 * s.z)) % h) + h) % h
        const a = reduce ? 0.7 : 0.45 + 0.55 * Math.abs(Math.sin(s.tw + t * 0.0012 * (0.5 + s.z)))
        ctx.globalAlpha = a * (0.35 + s.z * 0.65)
        ctx.fillStyle = s.c
        ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, Math.PI * 2); ctx.fill()
        if (s.z === 1 && s.r > 1.1) {
          ctx.globalAlpha = a * 0.18
          ctx.beginPath(); ctx.arc(s.x, y, s.r * 3.2, 0, Math.PI * 2); ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }
    let raf = 0, last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || t - last < 33) return
      last = t
      draw(t)
    }
    resize()
    window.addEventListener('resize', resize)
    const onScroll = () => reduce && draw(0)
    window.addEventListener('scroll', onScroll, { passive: true })
    if (!reduce) raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('scroll', onScroll) }
  }, [])
  return (
    <div className="cosmos" aria-hidden>
      <LiveShiva />
      <div className="shiva-veil" />
      <div className="aurora a1" />
      <div className="aurora a2" />
      <canvas ref={ref} />
      <div className="vignette" />
    </div>
  )
}
