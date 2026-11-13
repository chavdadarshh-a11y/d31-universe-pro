import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Flashlight beam for option groups (bottom nav, tabs, segmented controls, selectors).
 * Drop <Beam dep={value} /> as the LAST child of a `position: relative` group; it finds the selected
 * sibling ([data-on], aria-current="page", aria-selected / aria-checked / aria-pressed = "true") and
 * slides a soft gold → cyan cone of light onto it (~0.4 s). Static (no slide, no sparkles) with reduced motion.
 */
const SEL = ':scope > [data-on], :scope > [aria-current="page"], :scope > [aria-selected="true"], :scope > [aria-checked="true"], :scope > [aria-pressed="true"]'

export function Beam({ dep, variant = 'tab' }: { dep: unknown; variant?: 'nav' | 'tab' }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const place = () => {
      const on = parent.querySelector<HTMLElement>(SEL)
      setBox(on ? { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight } : null)
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [dep])
  return (
    <span
      ref={ref} aria-hidden data-testid={`beam-${variant}`}
      className={`beam-slide beam-${variant}`}
      style={box ? { transform: `translate3d(${box.x}px, ${box.y}px, 0)`, width: box.w, height: box.h, opacity: 1 } : { opacity: 0 }}
    >
      <i className="beam-cone" /><i className="beam-bar" /><i className="beam-sp s1" /><i className="beam-sp s2" /><i className="beam-sp s3" />
    </span>
  )
}
