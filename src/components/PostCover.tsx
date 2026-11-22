import { useEffect, useRef, useState } from 'react'
import { kImg, pick, type KFile, type KLang, type KPost } from '../lib/knowledge'

/** The post's own cover: its COVER folder image; if that folder is empty, the first page of the post's own PDF
 *  (same post, never another post's file); then its first photo; then an honest number placeholder. */
export function coverFile(p: KPost, lang: KLang = 'en'): { f: KFile; from: 'cover' | 'pdf' | 'photo' } | null {
  if (p.cover) return { f: p.cover, from: 'cover' }
  const pdf = pick(p.pdfs, lang).files[0] ?? p.pdfs.en[0] ?? p.pdfs.all[0] ?? p.pdfs.hi[0] ?? p.pdfs.gu[0]
  if (pdf) return { f: pdf, from: 'pdf' }
  if (p.photos[0]) return { f: p.photos[0], from: 'photo' }
  return null
}

/** Fills its (horizontal) box. Cover photos: object-fit cover, centred. PDF-page fallback: contain on a dark backdrop. */
export function Cover({ p, w = 800, className = '', lang = 'en', eager = false }: { p: KPost; w?: number; className?: string; lang?: KLang; eager?: boolean }) {
  const [bad, setBad] = useState<string | null>(null)
  const c = coverFile(p, lang)
  const load = eager ? 'eager' : 'lazy'
  if (c && bad !== c.f.id && c.from === 'pdf')
    return (
      <div className={`pc-pdf h-full w-full ${className}`} data-cover-from="pdf">
        <img src={kImg(c.f.id, w)} alt="" loading={load} decoding="async" draggable={false} referrerPolicy="no-referrer" onError={() => setBad(c.f.id)} className="h-full w-full object-contain" />
      </div>
    )
  if (c && bad !== c.f.id)
    return <img src={kImg(c.f.id, w)} alt="" loading={load} decoding="async" draggable={false} referrerPolicy="no-referrer" data-cover-from={c.from} onError={() => setBad(c.f.id)} className={`h-full w-full object-cover object-center ${className}`} />
  // honest placeholder — no stock photo, no broken image
  return (
    <div className={`relative grid h-full w-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.28),transparent_60%),radial-gradient(circle_at_80%_90%,rgba(247,197,72,0.22),transparent_55%),#070b14] ${className}`} data-cover-from="none">
      <span className="readout text-[56px] font-extrabold leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(165,243,252,0.55)]">{p.number}</span>
    </div>
  )
}

/** A clean horizontal 16:9 rounded cover card (no text on it). */
export function CoverCard({ p, lang, w = 720, className = '', eager }: { p: KPost; lang: KLang; w?: number; className?: string; eager?: boolean }) {
  return (
    <div className={`pc-card ${className}`}>
      <Cover p={p} w={w} lang={lang} eager={eager} />
      <i className="pc-sheen" aria-hidden />
    </div>
  )
}

/** Adds `.is-in` once the element scrolls into view (tilt-in reveal). */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('is-in'); return }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}
