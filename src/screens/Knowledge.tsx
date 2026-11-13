import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Play, BookOpen, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Film, Image as ImageIcon, Languages, Lock, PlayCircle, RefreshCw, Search, X } from 'lucide-react'
import { useApp } from '../store/app'
import { useT, type T } from '../i18n'
import type { StringKey } from '../i18n/strings'
import { Badge, Button, Card, Empty, Header, Sheet, Tabs } from '../components/ui'
import { navigate } from '../lib/router'
import { useCan } from '../lib/entitlements'
import { fileTitle, kDownload, kImg, kPreview, kView, langsWith, pick, postDesc, postTitle, useKnowledge, visiblePosts, type KFile, type KLang, type KPost } from '../lib/knowledge'

const LANG_LABEL: Record<KLang, string> = { en: 'English', hi: 'हिंदी', gu: 'ગુજરાતી' }
const plural = (t: T, n: number, one: StringKey, many: StringKey) => t(n === 1 ? one : many, { n })

function counts(t: T, p: KPost, lang: KLang) {
  return [
    plural(t, pick(p.videos, lang).files.length, 'kVideo1', 'kVideoN'),
    plural(t, p.photos.length, 'kPhoto1', 'kPhotoN'),
    plural(t, pick(p.pdfs, lang).files.length, 'kPdf1', 'kPdfN'),
  ].join(' • ')
}

function Cover({ p, w = 800, className = '' }: { p: KPost; w?: number; className?: string }) {
  const [bad, setBad] = useState(false)
  if (p.cover && !bad)
    return <img src={kImg(p.cover.id, w)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBad(true)} className={`h-full w-full object-cover ${className}`} />
  // honest placeholder — no stock photo, no broken image
  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.28),transparent_60%),radial-gradient(circle_at_80%_90%,rgba(247,197,72,0.22),transparent_55%),#070b14]">
      <span className="readout text-[64px] font-extrabold leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(165,243,252,0.55)]">{p.number}</span>
    </div>
  )
}

/** Post cards — used by the Knowledge screen and the Library "Learn" tab. */
export function KnowledgeGrid({ query = '' }: { query?: string }) {
  const t = useT()
  const lang = useApp((s) => s.lang) as KLang
  const { data, error, loading } = useKnowledge()
  const q = query.trim().toLowerCase()
  const posts = useMemo(() => visiblePosts(data).filter((p) => !q || `${p.number} ${postTitle(p, lang)} ${p.rawName}`.toLowerCase().includes(q)), [data, q, lang])

  if (loading) return <div className="mt-6 grid place-items-center text-muted"><RefreshCw size={18} className="animate-spin" /></div>
  if (!data && error) return <Empty icon={<BookOpen size={28} />} text={t('kOffline')} />
  if (!posts.length) return <Empty icon={<BookOpen size={28} />} text={q ? t('kNoMatch') : t('kNoPosts')} />
  return (
    <div data-testid="knowledge-grid">
      <PostPanels posts={posts} />
      <p className="pt-3 text-center font-mono text-[10.5px] text-dim">{t('kSynced', { x: new Date(data!.generatedAt).toLocaleString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
    </div>
  )
}

const ACCENTS = ['#f7c548', '#22d3ee', '#a78bfa']

/**
 * Knowledge posts as horizontal expanding panels (3 per page, swipe for more).
 * Tap a collapsed panel → it grows; tap the open panel or its round button → the post opens.
 */
export function PostPanels({ posts }: { posts: KPost[] }) {
  const t = useT()
  const lang = useApp((s) => s.lang) as KLang
  const groups = useMemo(() => {
    const g: KPost[][] = []
    for (let i = 0; i < posts.length; i += 3) g.push(posts.slice(i, i + 3))
    return g
  }, [posts])
  const [active, setActive] = useState<Record<number, number>>({})
  const [page, setPage] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const onScroll = () => {
    const el = scroller.current
    if (el) setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
  }
  const goPage = (i: number) => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' })
  const open = (p: KPost) => navigate(`/knowledge/${p.number}`)

  return (
    <div data-testid="post-panels">
      <div ref={scroller} onScroll={onScroll} className="no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto">
        {groups.map((g, gi) => {
          const act = Math.min(active[gi] ?? 0, g.length - 1)
          const small = g.length === 2 ? 2.4 : 1.5
          return (
            <div key={gi} className="kp-row w-full shrink-0 snap-center px-4" aria-label={`${gi + 1} / ${groups.length}`}>
              {g.map((p, i) => {
                const on = i === act
                const kc = ACCENTS[(gi * 3 + i) % ACCENTS.length]
                const title = postTitle(p, lang)
                const hasVideo = pick(p.videos, lang).files.length > 0
                return (
                  <div
                    key={p.id} role="button" tabIndex={0} data-testid={`kpost-${p.number}`} aria-expanded={on}
                    aria-label={`#${p.number} ${title}`}
                    onClick={() => (on ? open(p) : setActive({ ...active, [gi]: i }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (on) open(p); else setActive({ ...active, [gi]: i }) } }}
                    className={`kp dark-zone ${on ? 'is-active' : ''}`}
                    style={{ flexGrow: on ? 6.5 : small, ['--kc' as string]: kc }}
                  >
                    <div className="kp-cover"><Cover p={p} w={900} /></div>
                    <div className="kp-shade" />
                    <span className="kp-tag">#{p.number}</span>
                    <div className="kp-text">
                      <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.3em]" style={{ color: kc }}>{t('knowledge')}</div>
                      <h3 className="kp-title mt-2" style={{ fontSize: title.length > 26 ? 23 : title.length > 14 ? 28 : 34 }}>{title}</h3>
                    </div>
                    <div className="kp-meta">{counts(t, p, lang)}</div>
                    <button
                      type="button" className="kp-btn" tabIndex={-1} data-testid={on ? 'kpost-open' : undefined}
                      aria-label={on ? `${t('kOpenPost')} #${p.number}` : `#${p.number}`}
                      onClick={(e) => { e.stopPropagation(); if (on) open(p); else setActive({ ...active, [gi]: i }) }}
                    >
                      {hasVideo ? <Play size={on ? 20 : 17} fill="currentColor" className="ml-0.5" /> : <ArrowUpRight size={on ? 22 : 18} />}
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {groups.length > 1 && (
        <div className="kp-dots" role="tablist">
          {groups.map((_, i) => <button key={i} aria-label={`${i + 1} / ${groups.length}`} aria-current={i === page} onClick={() => goPage(i)} />)}
        </div>
      )}
    </div>
  )
}

export function Knowledge() {
  const t = useT()
  const [q, setQ] = useState('')
  return (
    <div>
      <Header title={t('knowledge')} sub={t('kSub')} back />
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <input className="field pl-9" placeholder={t('kSearchPh')} value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      </div>
      <KnowledgeGrid query={q} />
    </div>
  )
}

function DownloadBtn({ f }: { f: KFile }) {
  const t = useT()
  const ok = useCan('download.knowledge')
  if (!ok)
    return (
      <button data-testid="k-dl-locked" onClick={() => navigate('/membership')} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-gold/40 px-3 text-[12px] font-bold text-gold" title={t('kPlatinumOnly')}>
        <Lock size={13} /> {t('plan_platinum')}
      </button>
    )
  return (
    <a data-testid="k-dl" href={kDownload(f.id)} target="_blank" rel="noreferrer" className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-neon-static px-3 text-[12px] font-bold text-[#05080f]">
      <Download size={14} /> {t('kDownload')}
    </a>
  )
}

function FileRow({ f, icon, onOpen }: { f: KFile; icon: React.ReactNode; onOpen: () => void }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan/25 bg-cyan/[0.07] text-cyan">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">{fileTitle(f.name)}</span>
          {f.lang && <span className="font-mono text-[10.5px] uppercase tracking-wider text-dim">{LANG_LABEL[f.lang]}</span>}
        </span>
      </button>
      <DownloadBtn f={f} />
    </Card>
  )
}

function Lightbox({ photos, index, onClose }: { photos: KFile[]; index: number; onClose: () => void }) {
  const t = useT()
  const [i, setI] = useState(index)
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') setI((x) => (x + 1) % photos.length); if (e.key === 'ArrowLeft') setI((x) => (x - 1 + photos.length) % photos.length) }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [photos.length, onClose])
  return createPortal(
    <div className="dark-zone fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-modal="true" data-testid="k-lightbox">
      <div className="flex items-center justify-between p-3 pt-[calc(env(safe-area-inset-top)+12px)] text-white">
        <span className="font-mono text-[12px] text-white/70">{i + 1} / {photos.length}</span>
        <button onClick={onClose} aria-label={t('closeLbl')} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><X size={20} /></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
        <img key={photos[i].id} src={kImg(photos[i].id, 1600)} alt={fileTitle(photos[i].name)} referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-lg object-contain" />
        {photos.length > 1 && <>
          <button aria-label={t('prevLbl')} onClick={() => setI((i - 1 + photos.length) % photos.length)} className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white"><ChevronLeft size={22} /></button>
          <button aria-label={t('nextLbl')} onClick={() => setI((i + 1) % photos.length)} className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white"><ChevronRight size={22} /></button>
        </>}
      </div>
      <div className="flex items-center justify-between gap-2 p-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
        <span className="min-w-0 truncate text-[12.5px] text-white/70">{fileTitle(photos[i].name)}</span>
        <DownloadBtn f={photos[i]} />
      </div>
    </div>,
    document.body,
  )
}

type Tab = 'overview' | 'videos' | 'photos' | 'pdfs'

export function KnowledgePost({ id }: { id: string }) {
  const t = useT()
  const appLang = useApp((s) => s.lang) as KLang
  const [lang, setLang] = useState<KLang>(appLang)
  useEffect(() => setLang(appLang), [appLang])
  const { data, loading } = useKnowledge()
  const [tab, setTab] = useState<Tab>('overview')
  const [view, setView] = useState<{ f: KFile; kind: 'video' | 'pdf' } | null>(null)
  const [photo, setPhoto] = useState<number | null>(null)
  const p = data?.posts.find((x) => String(x.number) === id || x.id === id)

  if (loading) return <div className="mt-20 grid place-items-center text-muted"><RefreshCw size={18} className="animate-spin" /></div>
  if (!p) return <div><Header title={t('knowledge')} back="#/knowledge" /><Empty icon={<BookOpen size={28} />} text={t('kNotFound')} /></div>

  const vids = pick(p.videos, lang)
  const pdfs = pick(p.pdfs, lang)
  const fallbackNote = (used: KLang) => <p className="mb-2 flex items-center gap-1.5 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-[12px] text-gold"><Languages size={13} /> {t('kFallback', { a: LANG_LABEL[lang], b: LANG_LABEL[used] })}</p>
  const available = Array.from(new Set([...langsWith(p.videos), ...langsWith(p.pdfs)]))

  return (
    <div data-testid="kpost">
      <Header title={`#${p.number}`} sub={postTitle(p, appLang)} back="#/knowledge" />
      <div className="dark-zone relative -mx-4 -mt-3 aspect-[16/11] overflow-hidden">
        <Cover p={p} w={1200} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#04060c] via-[#04060c]/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="font-mono text-[12px] font-bold tracking-[0.2em] text-cyan">D31 // KNOWLEDGE #{p.number}</span>
          <h1 className="title-hud mt-1 text-[22px] leading-tight text-white">{postTitle(p, lang)}</h1>
          <div className="mt-1.5 font-mono text-[11px] text-white/70">{counts(t, p, lang)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2" data-testid="k-langs">
        <Languages size={15} className="shrink-0 text-muted" />
        {(['en', 'hi', 'gu'] as KLang[]).map((l) => (
          <button key={l} data-testid={`k-lang-${l}`} onClick={() => setLang(l)} className={`h-8 flex-1 rounded-lg border text-[12.5px] font-bold ${lang === l ? 'border-cyan/60 bg-cyan/15 text-cyan' : 'border-white/10 text-muted'} ${available.includes(l) || !available.length ? '' : 'opacity-50'}`}>{LANG_LABEL[l]}</button>
        ))}
      </div>

      <div className="mt-3">
        <Tabs value={tab} onChange={setTab} items={[
          { id: 'overview', label: t('kOverview') },
          { id: 'videos', label: `${t('kVideos')} ${vids.files.length}` },
          { id: 'photos', label: `${t('kPhotos')} ${p.photos.length}` },
          { id: 'pdfs', label: `${t('kPdfs')} ${pdfs.files.length}` },
        ]} />
      </div>

      <div className="mt-3 space-y-2.5">
        {tab === 'overview' && (
          <>
            {postDesc(p, lang) && <Card className="p-4 text-[14px] leading-relaxed text-frost/90">{postDesc(p, lang)}</Card>}
            <div className="grid grid-cols-3 gap-2">
              {([['videos', vids.files.length, PlayCircle], ['photos', p.photos.length, ImageIcon], ['pdfs', pdfs.files.length, FileText]] as const).map(([k, n, Icon]) => (
                <button key={k} onClick={() => setTab(k)} className="card rounded-2xl p-3 text-left">
                  <Icon size={17} className="text-cyan" />
                  <div className="readout mt-2 text-[22px] font-extrabold">{n}</div>
                  <div className="text-[11.5px] text-muted">{t(k === 'videos' ? 'kVideos' : k === 'photos' ? 'kPhotos' : 'kPdfs')}</div>
                </button>
              ))}
            </div>
            <Card className="flex gap-3 p-4">
              <Languages size={18} className="mt-0.5 shrink-0 text-gold" />
              <div className="text-[13px] leading-snug text-muted">
                {t('kAdaptNote')}
                {available.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{available.map((l) => <Badge key={l} tone="cyan">{LANG_LABEL[l]}</Badge>)}</div>}
              </div>
            </Card>
            {p.photos.length > 0 && (
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {p.photos.slice(0, 8).map((f, i) => (
                  <button key={f.id} onClick={() => setPhoto(i)} className="dark-zone h-28 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10">
                    <img src={kImg(f.id, 300)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'videos' && (vids.files.length ? (
          <>
            {vids.fallback && fallbackNote(vids.used)}
            {vids.files.map((f) => <FileRow key={f.id} f={f} icon={<PlayCircle size={20} />} onOpen={() => setView({ f, kind: 'video' })} />)}
          </>
        ) : <Empty icon={<Film size={26} />} text={t('kNoVideos')} />)}

        {tab === 'pdfs' && (pdfs.files.length ? (
          <>
            {pdfs.fallback && fallbackNote(pdfs.used)}
            {pdfs.files.map((f) => <FileRow key={f.id} f={f} icon={<FileText size={20} />} onOpen={() => setView({ f, kind: 'pdf' })} />)}
          </>
        ) : <Empty icon={<FileText size={26} />} text={t('kNoPdfs')} />)}

        {tab === 'photos' && (p.photos.length ? (
          <div className="columns-2 gap-2 [&>*]:mb-2" data-testid="k-photos">
            {p.photos.map((f, i) => (
              <button key={f.id} onClick={() => setPhoto(i)} className="dark-zone block w-full overflow-hidden rounded-xl border border-white/10">
                <img src={kImg(f.id, 500)} alt={fileTitle(f.name)} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full object-cover" />
              </button>
            ))}
          </div>
        ) : <Empty icon={<ImageIcon size={26} />} text={t('kNoPhotos')} />)}
      </div>

      <Sheet open={!!view} onClose={() => setView(null)} title={view ? fileTitle(view.f.name) : ''}>
        {view && (
          <div className="space-y-3">
            <div className={`dark-zone overflow-hidden rounded-xl border border-white/10 bg-black ${view.kind === 'video' ? 'aspect-video' : 'h-[60vh]'}`}>
              <iframe src={kPreview(view.f.id)} title={view.f.name} allow="autoplay; fullscreen" allowFullScreen className="h-full w-full" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <a href={kView(view.f.id)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12.5px] text-cyan"><ExternalLink size={14} /> {t('kOpenDrive')}</a>
              <DownloadBtn f={view.f} />
            </div>
          </div>
        )}
      </Sheet>
      {photo !== null && <Lightbox photos={p.photos} index={photo} onClose={() => setPhoto(null)} />}
      <div className="mt-6"><Button variant="ghost" className="w-full" onClick={() => navigate('/knowledge')}>{t('kAll')}</Button></div>
    </div>
  )
}
