import { useEffect, useRef } from 'react'

/**
 * Layered futuristic background: animated aurora mesh (CSS), a canvas starfield with
 * three depth layers that parallax on scroll, and a perspective holo-grid horizon.
 * Cheap on phones: DPR capped at 1.5, ~30 fps, paused when the tab is hidden,
 * and fully static when the user prefers reduced motion.
 */
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
      <div className="aurora a1" />
      <div className="aurora a2" />
      <div className="aurora a3" />
      <div className="aurora a4" />
      <canvas ref={ref} />
      <div className="horizon"><i /></div>
      <div className="vignette" />
    </div>
  )
}
