import { useEffect, useRef, useState, type ReactNode } from 'react'

const BASE = import.meta.env.BASE_URL || '/'
/** URL of one of Darshan's photos in public/media. */
export const mediaUrl = (name: string, small = false) => `${BASE}media/${name}${small ? '-sm' : ''}.webp`

/** Focal points so object-cover keeps the athlete in frame. */
const FOCUS: Record<string, string> = { 'front-lever': '50% 56%', 'sl-rdl': '58% 45%', 'pull-up': '50% 35%', nordic: '35% 70%' }

export function Photo({ name, alt, className = '', small = false, eager = false }: { name: string; alt: string; className?: string; small?: boolean; eager?: boolean }) {
  return (
    <img
      src={mediaUrl(name, small)}
      srcSet={`${mediaUrl(name, true)} 520w, ${mediaUrl(name)} 1200w`}
      sizes={small ? '200px' : '(max-width: 520px) 100vw, 520px'}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`h-full w-full object-cover ${className}`}
      style={{ objectPosition: FOCUS[name] ?? '50% 50%' }}
    />
  )
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
