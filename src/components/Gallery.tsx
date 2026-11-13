import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, ArrowUpRight } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Chip } from './ui'
import { mediaUrl } from './hud'
import { SHOOT, SHOOT_CATS, shootName, type ShootCat, type ShootPhoto } from '../data/gallery'
import { exOf, exName } from '../data/exercises'
import { navigate } from '../lib/router'

function Tile({ p, onOpen }: { p: ShootPhoto; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <button onClick={onOpen} className="shoot-tile group relative mb-2 block w-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]" style={{ aspectRatio: `${p.w} / ${p.h}` }} aria-label={p.title}>
      <img src={mediaUrl(shootName(p.id), true)} alt={p.title} loading="lazy" decoding="async" onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.03] ${loaded ? 'opacity-100' : 'opacity-0'}`} />
      {!loaded && <span className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,transparent,rgba(34,211,238,0.06),transparent)]" />}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(4,6,12,0.85))] px-2 pb-1.5 pt-6 text-left font-mono text-[9.5px] uppercase tracking-[0.14em] text-frost/85">{p.title}</span>
      <span className="pointer-events-none absolute left-1.5 top-1.5 h-2.5 w-2.5 border-l border-t border-gold/70" />
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b border-r border-cyan/70" />
    </button>
  )
}

export function Viewer({ list, index, onIndex, onClose }: { list: ShootPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const p = list[index]
  const touch = useRef<number | null>(null)
  const go = (d: number) => onIndex((index + d + list.length) % list.length)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  })
  useEffect(() => { // preload neighbours
    for (const d of [1, -1]) { const n = list[(index + d + list.length) % list.length]; if (n) new Image().src = mediaUrl(shootName(n.id)) }
  }, [index, list])
  if (!p) return null
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={p.title} className="dark-zone fixed inset-0 z-[70] flex flex-col bg-[#03050b]/97 backdrop-blur-md"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); touch.current = null }}>
      <div className="flex items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <span className="font-mono text-[11px] tracking-[0.2em] text-cyan">{String(index + 1).padStart(3, '0')} / {list.length}</span>
        <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(247,197,72,0.5),transparent)]" />
        <button onClick={onClose} aria-label={t('closeLbl')} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-frost"><X size={20} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <img key={p.id} src={mediaUrl(shootName(p.id))} alt={p.title} className="max-h-full max-w-full rounded-lg object-contain" />
        <button onClick={() => go(-1)} aria-label={t('prevLbl')} className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-[#04060c]/70 text-frost"><ChevronLeft size={22} /></button>
        <button onClick={() => go(1)} aria-label={t('nextLbl')} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-[#04060c]/70 text-frost"><ChevronRight size={22} /></button>
      </div>
      <div className="flex items-center gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-gold/90">{t(`gcat_${p.cat}`)}</div>
          <div className="title-hud mt-0.5 truncate text-[14px]">{p.title}</div>
        </div>
        {p.exId && (
          <button onClick={() => { onClose(); navigate(`/library/${p.exId}`) }} className="flex shrink-0 items-center gap-1 rounded-xl border border-cyan/40 bg-cyan/10 px-3 py-2 text-[12px] font-semibold text-cyan">
            {exName(exOf(p.exId), lang)} <ArrowUpRight size={14} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function ShootGallery() {
  const t = useT()
  const [cat, setCat] = useState<ShootCat | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const list = useMemo(() => (cat ? SHOOT.filter((p) => p.cat === cat) : SHOOT), [cat])
  const cols = useMemo(() => { // balanced 2-column masonry by height
    const c: { p: ShootPhoto; i: number }[][] = [[], []]; const h = [0, 0]
    list.forEach((p, i) => { const k = h[0] <= h[1] ? 0 : 1; c[k].push({ p, i }); h[k] += p.h / p.w })
    return c
  }, [list])
  return (
    <div className="mt-3">
      <p className="text-[13px] leading-snug text-muted">{t('gallerySub')} <span className="font-mono text-cyan">{t('photosN', { n: SHOOT.length })}</span></p>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        <Chip active={!cat} onClick={() => setCat(null)}>{t('all')} · {SHOOT.length}</Chip>
        {SHOOT_CATS.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)}>{t(`gcat_${c}`)} · {SHOOT.filter((p) => p.cat === c).length}</Chip>)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {cols.map((col, k) => <div key={k}>{col.map(({ p, i }) => <Tile key={p.id} p={p} onOpen={() => setOpen(i)} />)}</div>)}
      </div>
      {open !== null && <Viewer list={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  )
}
