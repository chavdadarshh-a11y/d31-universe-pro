import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import { navigate } from '../lib/router'
import { postTitle, type KLang, type KPost } from '../lib/knowledge'
import { CoverCard } from './PostCover'

const STEP_MS = 1800 // a new card lands in the centre about every 1.8 s
const RESUME_MS = 4500 // autoplay pauses while touched and for a moment after
const mod = (a: number, n: number) => ((a % n) + n) % n
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

type Props = { posts: KPost[]; lang: KLang; jump?: boolean; sub: (p: KPost) => string; labels: { open: string; prev: string; next: string; hint: string } }

/** Knowledge posts: a vertical 3D "waterfall" of clean horizontal cards (reduced motion → plain horizontal swipe). */
export function PostCascade(props: Props) {
  const posts = useMemo(() => [...props.posts].sort((a, b) => a.number - b.number), [props.posts])
  const [rm, setRm] = useState(reducedMotion)
  useEffect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => setRm(q.matches)
    q.addEventListener?.('change', f)
    return () => q.removeEventListener?.('change', f)
  }, [])
  if (!posts.length) return null
  return rm || posts.length < 2 ? <PostSwipe {...props} posts={posts} /> : <Cascade {...props} posts={posts} />
}

/**
 * Card pose for offset o (0 = centre, flat; o > 0 = upcoming, waiting behind/above; o < 0 = leaving: pivots on its
 * bottom edge, top tilting toward the viewer, and falls out of the bottom). Darker the more it is tilted away.
 */
function pose(o: number, h: number) {
  if (o >= 0) {
    const y = -h * (0.5 * o - 0.06 * o * o) // rises, then bunches up at the back
    const z = -150 * o
    const rx = 9 * Math.min(o, 2.2) // top leans back, away from the viewer
    return { tf: `translate3d(0,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg)`, shade: clamp(0.16 + o * 0.2, 0, 0.78) * (o < 0.02 ? 0 : 1), op: clamp(3.3 - o, 0, 1), z: 100 - Math.round(o * 10) }
  }
  const a = -o
  const y = h * (0.22 * a + 0.55 * a * a)
  const rx = -76 * clamp(a, 0, 1.2) // pivots on its bottom edge, top tipping toward the viewer
  return { tf: `translate3d(0,${y.toFixed(1)}px,${(30 * a).toFixed(1)}px) rotateX(${rx.toFixed(2)}deg)`, shade: clamp(a * 0.62, 0, 0.7), op: clamp(1.75 - a, 0, 1), z: 120 + Math.round(a * 10) }
}

function Cascade({ posts, lang, jump, sub, labels }: Props) {
  const n = posts.length
  const stage = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<number, HTMLDivElement>())
  const cur = useRef(0) // animated position (float, unbounded → seamless loop)
  const target = useRef(0)
  const raf = useRef(0)
  const tw = useRef<{ from: number; to: number; t0: number; dur: number } | null>(null)
  const holdUntil = useRef(0)
  const visible = useRef(true)
  const drag = useRef<{ y: number; x: number; c: number; t: number; moved: boolean; id: number } | null>(null)
  const cardH = useRef(200)
  const [base, setBase] = useState(0)
  const [centre, setCentre] = useState(0)
  const chips = useRef<HTMLDivElement>(null)

  const paint = useCallback(() => {
    const c = cur.current
    cards.current.forEach((el, v) => {
      const p = pose(v - c, cardH.current)
      el.style.transform = p.tf
      el.style.opacity = String(p.op)
      el.style.zIndex = String(p.z)
      const s = el.firstElementChild?.nextElementSibling as HTMLElement | null // .pc-shade
      if (s) s.style.opacity = String(p.shade)
      el.dataset.on = Math.abs(v - c) < 0.5 ? '1' : ''
    })
  }, [])

  const tick = useCallback((now: number) => {
    const w = tw.current
    if (!drag.current && w) {
      const k = clamp((now - w.t0) / w.dur, 0, 1)
      const e = -(Math.cos(Math.PI * k) - 1) / 2 // easeInOutSine: long, continuous glide like the reference
      cur.current = w.from + (w.to - w.from) * e
      if (k >= 1) { cur.current = w.to; tw.current = null }
    }
    const b = Math.floor(cur.current)
    setBase((x) => (x === b ? x : b))
    const r = Math.round(cur.current)
    setCentre((x) => (x === r ? x : r))
    paint()
    if (drag.current || tw.current) raf.current = requestAnimationFrame(tick)
    else raf.current = 0
  }, [paint])
  const kick = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(tick) }, [tick])
  const goTo = useCallback((v: number, hold = true, dur = 1350) => {
    if (Math.abs(v - cur.current) > 3) cur.current = v - Math.sign(v - cur.current) // far jump: land, don't fly past 20 cards
    target.current = v
    tw.current = { from: cur.current, to: v, t0: performance.now(), dur: dur * clamp(Math.abs(v - cur.current), 0.45, 1.6) }
    if (hold) holdUntil.current = performance.now() + RESUME_MS
    kick()
  }, [kick])

  // size + first paint
  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => { const w = el.clientWidth * 0.88; cardH.current = Math.min(w, 460) * 9 / 16; paint() }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [paint])
  useLayoutEffect(() => { paint() }, [base, paint])

  // autoplay: every STEP_MS, unless touched recently, off-screen or the tab is hidden
  useEffect(() => {
    const el = stage.current
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting }, { threshold: 0.35 })
    if (el) io.observe(el)
    const id = window.setInterval(() => {
      if (!visible.current || document.hidden || drag.current || performance.now() < holdUntil.current) return
      goTo(Math.round(target.current) + 1, false)
    }, STEP_MS)
    return () => { clearInterval(id); io.disconnect(); cancelAnimationFrame(raf.current); raf.current = 0 }
  }, [goTo])

  useEffect(() => { // keep the active number chip in view
    const box = chips.current
    const c = box?.children[mod(centre, n)] as HTMLElement | undefined
    if (box && c) box.scrollTo({ left: c.offsetLeft - box.clientWidth / 2 + c.offsetWidth / 2, behavior: 'smooth' })
  }, [centre, n])

  const open = (p: KPost) => navigate(`/knowledge/${p.number}`)
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    drag.current = { y: e.clientY, x: e.clientX, c: cur.current, t: performance.now(), moved: false, id: e.pointerId }
    holdUntil.current = Infinity
    kick()
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dy, e.clientX - d.x) > 8) { d.moved = true; stage.current?.setPointerCapture(e.pointerId) }
    if (d.moved) cur.current = d.c + dy / (cardH.current * 1.1) // drag down → next card comes forward
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    holdUntil.current = performance.now() + RESUME_MS
    if (!d.moved) {
      // tap: the centred card opens; a waiting card is brought forward
      const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-v]')
      const v = hit ? +hit.dataset.v! : Math.round(cur.current)
      if (v === Math.round(cur.current)) open(posts[mod(v, n)])
      else goTo(v)
      return
    }
    const dt = Math.max(1, performance.now() - d.t)
    const vel = (cur.current - d.c) / dt * 1000 // cards per second
    goTo(Math.round(cur.current + clamp(vel * 0.07, -0.6, 0.6)), true, 650)
  }

  const p0 = posts[mod(centre, n)]
  const vs: number[] = []
  for (let v = base - 1; v <= base + 4; v++) vs.push(v) // ≤ 6 mounted (≈5 visible) cards
  const nearest = (k: number) => { const m = mod(Math.round(target.current), n); let d = k - m; if (d > n / 2) d -= n; if (d < -n / 2) d += n; return Math.round(target.current) + d }

  return (
    <div data-testid="post-panels" className="pc">
      <div
        ref={stage} className="pc-stage" data-testid="pc-stage" role="group" aria-roledescription="carousel" aria-label={labels.hint}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); goTo(Math.round(target.current) + 1) }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); goTo(Math.round(target.current) - 1) }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(p0) }
        }}
      >
        {vs.map((v) => {
          const p = posts[mod(v, n)]
          return (
            <div key={v} data-v={v} ref={(el) => { if (el) cards.current.set(v, el); else cards.current.delete(v) }} className="pc-slot" data-testid={`kpost-${p.number}`} aria-hidden={v !== centre} aria-label={`#${p.number} ${postTitle(p, lang)}`}>
              <CoverCard p={p} lang={lang} eager={Math.abs(v - centre) <= 1} />
              <i className="pc-shade" aria-hidden />
            </div>
          )
        })}
      </div>
      <div className="pc-cap" aria-live="polite">
        <button type="button" className="pc-arrow" aria-label={labels.prev} onClick={() => goTo(Math.round(target.current) - 1)}><ChevronUp size={18} /></button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(p0)} data-testid="kpost-open" aria-label={`${labels.open} #${p0.number}`}>
          <div className="flex items-baseline gap-2">
            <span className="pc-num" data-testid="ks-current">#{p0.number}</span>
            <span className="truncate text-[14px] font-semibold text-frost">{postTitle(p0, lang)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted"><span className="truncate">{sub(p0)}</span><span className="ml-auto shrink-0 text-dim">{mod(centre, n) + 1} / {n}</span></div>
        </button>
        <span className="pc-go" aria-hidden><ArrowUpRight size={18} /></span>
        <button type="button" className="pc-arrow" aria-label={labels.next} onClick={() => goTo(Math.round(target.current) + 1)}><ChevronDown size={18} /></button>
      </div>
      {jump && (
        <div ref={chips} className="ks-chips no-scrollbar" data-testid="ks-chips">
          {posts.map((p, i) => <button key={p.id} type="button" aria-current={i === mod(centre, n)} onClick={() => goTo(nearest(i))}>{p.number}</button>)}
        </div>
      )}
    </div>
  )
}

/** Reduced motion: the same clean horizontal cards in a plain horizontal swipe, caption below. */
function PostSwipe({ posts, lang, jump, sub, labels }: Props) {
  const [cur, setCur] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const onScroll = () => {
    const el = track.current
    if (!el) return
    const mid = el.scrollLeft + el.clientWidth / 2
    let best = 0, bd = Infinity
    Array.from(el.children).forEach((c, i) => { const h = c as HTMLElement; const d = Math.abs(h.offsetLeft + h.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i } })
    setCur(best)
  }
  const go = (i: number) => { const el = track.current; const c = el?.children[clamp(i, 0, posts.length - 1)] as HTMLElement | undefined; if (el && c) el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2 }) }
  const p0 = posts[cur]
  const open = (p: KPost) => navigate(`/knowledge/${p.number}`)
  return (
    <div data-testid="post-panels" className="pc pc-reduced">
      <div ref={track} onScroll={onScroll} className="pc-swipe no-scrollbar">
        {posts.map((p, i) => (
          <button type="button" key={p.id} data-testid={`kpost-${p.number}`} className="pc-swipe-item" aria-label={`#${p.number} ${postTitle(p, lang)}`} onClick={() => (i === cur ? open(p) : go(i))}>
            <CoverCard p={p} lang={lang} />
          </button>
        ))}
      </div>
      <div className="pc-cap">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(p0)} data-testid="kpost-open" aria-label={`${labels.open} #${p0.number}`}>
          <div className="flex items-baseline gap-2"><span className="pc-num" data-testid="ks-current">#{p0.number}</span><span className="truncate text-[14px] font-semibold text-frost">{postTitle(p0, lang)}</span></div>
          <div className="mt-0.5 flex gap-2 font-mono text-[10px] text-muted"><span className="truncate">{sub(p0)}</span><span className="ml-auto text-dim">{cur + 1} / {posts.length}</span></div>
        </button>
        <span className="pc-go" aria-hidden><ArrowUpRight size={18} /></span>
      </div>
      {jump && <div className="ks-chips no-scrollbar" data-testid="ks-chips">{posts.map((p, i) => <button key={p.id} type="button" aria-current={i === cur} onClick={() => go(i)}>{p.number}</button>)}</div>}
    </div>
  )
}
