import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * App-wide neon focus effect for text inputs (ref: light beam from the caret).
 * One fixed overlay follows the focused <input>: a warm gold → cyan cone of light anchored at the START of the text,
 * spreading right ACROSS what is written (empty → across the placeholder), fading just after the last character,
 * plus a glowing caret line at the caret and a few sparkles inside the beam. Static (no sparkles / no animation) with reduced motion.
 * Opt out with data-no-neon on an input.
 */
const TYPES = new Set(['text', 'search', 'email', 'password', 'tel', 'url'])
type State = { top: number; left: number; w: number; h: number; x: number; bx: number; bw: number | null; ch: number; radius: string; sel: boolean }
const SPARKS = [
  { dx: 10, dy: -7, d: 0 }, { dx: 26, dy: 5, d: 0.5, c: true }, { dx: 44, dy: -3, d: 1.1 }, { dx: 62, dy: 8, d: 0.3 },
  { dx: 80, dy: -9, d: 1.5, c: true }, { dx: 18, dy: 10, d: 1.8 }, { dx: 98, dy: 2, d: 0.8 },
]

export function NeonInputs() {
  const [st, setSt] = useState<State | null>(null)
  const [reduce] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    let el: HTMLInputElement | null = null
    let raf = 0
    const ctx = document.createElement('canvas').getContext('2d')
    const measure = () => {
      raf = 0
      if (!el || document.activeElement !== el || !ctx) { setSt(null); return }
      const r = el.getBoundingClientRect()
      if (r.width < 40 || r.bottom < 0 || r.top > window.innerHeight) { setSt(null); return }
      const cs = getComputedStyle(el)
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      const raw = el.value
      const v = el.type === 'password' ? '•'.repeat(raw.length) : raw
      let pos = raw.length, end = raw.length
      try { pos = el.selectionStart ?? raw.length; end = el.selectionEnd ?? pos } catch { /* email inputs have no selection API */ }
      const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)
      const pr = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth)
      const spacing = parseFloat(cs.letterSpacing) || 0
      let x = pl + ctx.measureText(v.slice(0, pos)).width + spacing * pos - el.scrollLeft
      x = Math.max(pl, Math.min(r.width - pr, x))
      // beam: origin = left edge of the text box; length follows the written text (placeholder when empty)
      const FADE = 22
      let bw: number | null = null
      if (v.length) {
        const textEnd = pl + ctx.measureText(v).width + spacing * v.length - el.scrollLeft
        bw = Math.max(28, Math.min(r.width - pr + 6, textEnd) - pl + FADE)
      } else if (el.placeholder) {
        bw = Math.max(Math.min(250, r.width * 0.8), Math.min(r.width - pl - pr, ctx.measureText(el.placeholder).width + FADE * 2))
      }
      setSt({ top: r.top, left: r.left, w: r.width, h: r.height, x, bx: pl, bw, ch: Math.min(r.height - 12, parseFloat(cs.fontSize) * 1.3), radius: cs.borderRadius, sel: end !== pos })
    }
    const queue = () => { if (!raf) raf = requestAnimationFrame(measure) }
    // follow layout changes for a moment after focus (sheets slide in, keyboard opens)
    const settle = () => { let n = 0; const tick = () => { measure(); if (++n < 24 && el) requestAnimationFrame(tick) }; tick() }
    const onIn = (e: FocusEvent) => {
      const t = e.target
      if (!(t instanceof HTMLInputElement) || !TYPES.has(t.type) || t.readOnly || t.disabled || 'noNeon' in t.dataset) return
      el = t
      t.classList.add('neon-on')
      settle()
    }
    const onOut = (e: FocusEvent) => {
      if (e.target !== el) return
      el?.classList.remove('neon-on')
      el = null
      setSt(null)
    }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    document.addEventListener('selectionchange', queue)
    document.addEventListener('input', queue, true)
    document.addEventListener('keyup', queue, true)
    document.addEventListener('pointerup', queue, true)
    window.addEventListener('scroll', queue, true)
    window.addEventListener('resize', queue)
    window.visualViewport?.addEventListener('resize', queue)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
      document.removeEventListener('selectionchange', queue)
      document.removeEventListener('input', queue, true)
      document.removeEventListener('keyup', queue, true)
      document.removeEventListener('pointerup', queue, true)
      window.removeEventListener('scroll', queue, true)
      window.removeEventListener('resize', queue)
      window.visualViewport?.removeEventListener('resize', queue)
      el?.classList.remove('neon-on')
    }
  }, [])

  if (!st) return null
  return createPortal(
    <div className="neon-ov" aria-hidden data-testid="neon-overlay" style={{ top: st.top, left: st.left, width: st.w, height: st.h, borderRadius: st.radius }}>
      {!st.sel && <div className="neon-beam" data-testid="neon-beam" style={{ left: st.bx, width: st.bw ?? undefined }} />}
      {!st.sel && !reduce && SPARKS.map((p, i) => {
        const len = (st.bw ?? 220) - 18
        return <span key={i} className={`neon-spark ${p.c ? 'c' : ''}`} style={{ left: st.bx + (p.dx / 110) * len, top: st.h / 2 + p.dy * Math.min(1, 0.45 + (p.dx / 110)), animationDelay: `${p.d}s` }} />
      })}
      {!st.sel && <div className="neon-caret" style={{ left: st.x, height: st.ch }} />}
    </div>,
    document.body,
  )
}
