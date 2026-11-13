import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SHOOT } from '../data/gallery'

const SHOOT_BY_ID = Object.fromEntries(SHOOT.map((p) => [p.id, p]))

const BASE = import.meta.env.BASE_URL || '/'
/** URL of one of Darshan's photos in public/media. */
export const mediaUrl = (name: string, small = false) => `${BASE}media/${name}${small ? '-sm' : ''}.webp`

/** Short muted looping clip of Darshan. Plays only while on screen; poster only with reduced motion. */
export function ClipPlayer({ name, alt, className = '' }: { name: string; alt: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [still] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const poster = `${BASE}media/clips/${name}-poster.webp`
  useEffect(() => {
    const v = ref.current
    if (!v || still || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) v.play().catch(() => {})
      else v.pause()
    }, { threshold: 0.25 })
    io.observe(v)
    return () => { io.disconnect(); v.pause() }
  }, [still])
  if (still) return <img src={poster} alt={alt} loading="lazy" decoding="async" className={`h-full w-full object-cover ${className}`} />
  return (
    <video ref={ref} className={`h-full w-full object-cover ${className}`} poster={poster} muted loop playsInline preload="none" aria-label={alt}>
      <source src={`${BASE}media/clips/${name}.webm`} type="video/webm" />
      <source src={`${BASE}media/clips/${name}.mp4`} type="video/mp4" />
    </video>
  )
}

type ClipReq = { name: string; title: string; exId?: string }
/** Open the fullscreen clip viewer from anywhere. */
export const openClip = (c: ClipReq) => window.dispatchEvent(new CustomEvent<ClipReq>('d31-clip', { detail: c }))

/** Highlighted, auto-looping clip tile (GIF-like): neon ring + CLIP badge; tap → fullscreen. */
export function ClipThumb({ name, title, exId, className = '', badge = true }: { name: string; title: string; exId?: string; className?: string; badge?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`▶ ${title}`}
      data-clip={name}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); openClip({ name, title, exId }) }}
      className={`clip-ring group relative block overflow-hidden rounded-xl bg-[#070b14] ${className}`}
    >
      <ClipPlayer name={name} alt={title} className="transition-transform duration-500 group-active:scale-[1.04]" />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(4,6,12,0.75))]" />
      {badge && (
        <span className="clip-badge pointer-events-none absolute bottom-1 left-1 flex items-center gap-[3px] rounded-[5px] px-1 py-[1px] font-mono text-[8px] font-bold uppercase tracking-[0.14em]">
          <span className="clip-dot" />CLIP
        </span>
      )}
    </button>
  )
}

/** Fullscreen looping viewer for Darshan's clips. Mounted once in App. */
export function ClipViewer() {
  const [c, setC] = useState<ClipReq | null>(null)
  const [paused, setPaused] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const on = (e: Event) => { setPaused(false); setC((e as CustomEvent<ClipReq>).detail) }
    window.addEventListener('d31-clip', on)
    return () => window.removeEventListener('d31-clip', on)
  }, [])
  useEffect(() => {
    if (!c) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setC(null)
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [c])
  if (!c) return null
  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) { v.play().catch(() => {}); setPaused(false) } else { v.pause(); setPaused(true) }
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={c.title} data-testid="clip-viewer" className="fixed inset-0 z-[70] flex flex-col bg-black/95 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="min-w-0 flex-1">
          <div className="clip-badge inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em]"><span className="clip-dot" />CLIP</div>
          <div className="mt-1 truncate text-[17px] font-bold text-frost">{c.title}</div>
        </div>
        <button aria-label="Close" onClick={() => setC(null)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-frost">✕</button>
      </div>
      <button className="relative mx-auto flex min-h-0 w-full max-w-lg flex-1 items-center justify-center px-3" onClick={toggle} aria-label={paused ? 'Play' : 'Pause'}>
        <div className="clip-ring relative h-full max-h-full overflow-hidden rounded-3xl" style={{ aspectRatio: '480 / 854' }}>
          <video ref={ref} key={c.name} className="h-full w-full object-cover" poster={`${BASE}media/clips/${c.name}-poster.webp`} autoPlay muted loop playsInline>
            <source src={`${BASE}media/clips/${c.name}.webm`} type="video/webm" />
            <source src={`${BASE}media/clips/${c.name}.mp4`} type="video/mp4" />
          </video>
          {paused && <span className="absolute inset-0 grid place-items-center bg-black/40 text-5xl text-frost">▶</span>}
        </div>
      </button>
      <div className="flex items-center justify-between gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold/90">Darshan Chavda · D31</span>
        {c.exId && !window.location.hash.startsWith(`#/library/${c.exId}`) && (
          <a href={`#/library/${c.exId}`} onClick={() => setC(null)} className="rounded-xl border border-cyan/40 bg-cyan/10 px-3 py-2 text-[13px] font-semibold text-cyan">How to →</a>
        )}
      </div>
    </div>
  )
}

/** Focal points so object-cover keeps the athlete in frame. */
const FOCUS: Record<string, string> = {
  'front-lever': '50% 56%', 'sl-rdl': '58% 45%', 'pull-up': '50% 35%', nordic: '35% 70%',
  'shoot/023': '50% 66%', 'shoot/019': '55% 62%', 'shoot/079': '50% 45%', 'shoot/072': '50% 72%', 'shoot/057': '50% 42%',
  'shoot/056': '50% 45%', 'shoot/064': '50% 38%', 'shoot/059': '50% 55%', 'shoot/090': '50% 40%', 'shoot/048': '45% 45%',
  'shoot/089': '50% 55%', 'shoot/034': '50% 72%', 'shoot/030': '50% 50%', 'shoot/032': '50% 55%', 'shoot/080': '50% 40%', 'shoot/055': '50% 60%',
}
const LEGACY_ASPECT: Record<string, number> = { 'front-lever': 0.667 }
const aspectOf = (name: string) => {
  if (name.startsWith('shoot/')) { const p = SHOOT_BY_ID[name.slice(6)]; return p ? p.w / p.h : 1 }
  return LEGACY_ASPECT[name] ?? 1.6
}

/**
 * One of Darshan's photos. `smart` (for wide headers): a tall portrait is shown whole (object-contain)
 * over a blurred, darkened copy of itself instead of being cropped to the middle.
 */
export function Photo({ name, alt, className = '', small = false, eager = false, smart = false }: { name: string; alt: string; className?: string; small?: boolean; eager?: boolean; smart?: boolean }) {
  const img = (cls: string, a: string, style?: React.CSSProperties) => (
    <img
      src={mediaUrl(name, small)}
      srcSet={`${mediaUrl(name, true)} 520w, ${mediaUrl(name)} 1200w`}
      sizes={small ? '200px' : '(max-width: 520px) 100vw, 520px'}
      alt={a}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cls}
      style={style}
    />
  )
  if (smart && aspectOf(name) < 0.8) {
    return (
      <span className={`relative block h-full w-full overflow-hidden ${className}`}>
        {img('absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl', '')}
        {img('relative h-full w-full object-contain', alt)}
      </span>
    )
  }
  return img(`h-full w-full object-cover ${className}`, alt, { objectPosition: FOCUS[name] ?? '50% 50%' })
}

/** Shared SVG gradients so lucide icons can be stroked with a gradient: <Icon color="url(#g-cyan)" /> */
export function GradDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
      <defs>
        <linearGradient id="g-cyan" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5ee8ff" /><stop offset="1" stopColor="#a78bfa" /></linearGradient>
        <linearGradient id="g-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset="1" stopColor="#fb923c" /></linearGradient>
        <linearGradient id="g-magenta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f472d0" /><stop offset="1" stopColor="#a78bfa" /></linearGradient>
        <linearGradient id="g-lime" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9f99d" /><stop offset="1" stopColor="#34d399" /></linearGradient>
      </defs>
    </svg>
  )
}

/** Animated number readout (counts up once; instant with reduced motion). */
export function CountUp({ value, decimals = 0, duration = 900, className = '' }: { value: number; decimals?: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !Number.isFinite(value)) { setShown(value); from.current = value; return }
    const start = performance.now(), a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration)
      const e = 1 - Math.pow(1 - k, 3)
      setShown(a + (value - a) * e)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className={className}>{shown.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</span>
}

/** Small HUD section title: ◆ LABEL ───── tag */
export function HudTitle({ children, tag, action, className = '' }: { children: ReactNode; tag?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`mb-2.5 mt-7 flex items-center gap-2 px-0.5 ${className}`}>
      <span aria-hidden className="h-2 w-2 rotate-45 bg-gold shadow-[0_0_8px_rgba(247,197,72,0.8)]" />
      <span className="label !text-frost/90">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-cyan/40 via-cyan/10 to-transparent" />
      {tag && <span className="font-mono text-[9.5px] tracking-[0.2em] text-cyan/60">{tag}</span>}
      {action}
    </div>
  )
}

/** Icon tile with gradient-stroked lucide icon. */
export function IconTile({ icon: Icon, grad = 'cyan', size = 40 }: { icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; grad?: 'cyan' | 'gold' | 'magenta' | 'lime'; size?: number }) {
  const tint = { cyan: 'rgba(34,211,238,0.14)', gold: 'rgba(247,197,72,0.14)', magenta: 'rgba(244,114,208,0.14)', lime: 'rgba(163,230,53,0.14)' }[grad]
  const edge = { cyan: 'rgba(34,211,238,0.35)', gold: 'rgba(247,197,72,0.4)', magenta: 'rgba(244,114,208,0.35)', lime: 'rgba(163,230,53,0.35)' }[grad]
  return (
    <span className="grid place-items-center rounded-xl" style={{ width: size, height: size, background: `linear-gradient(140deg, ${tint}, rgba(255,255,255,0.02))`, border: `1px solid ${edge}` }}>
      <Icon size={Math.round(size * 0.5)} color={`url(#g-${grad})`} strokeWidth={2.2} />
    </span>
  )
}
