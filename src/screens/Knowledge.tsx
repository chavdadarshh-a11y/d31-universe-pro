import { useEffect, useMemo, useState } from 'react'
import { Beam } from '../components/Beam'
import { createPortal } from 'react-dom'
import { CheckCircle2, HardDriveDownload, BookOpen, ChevronLeft, ChevronRight, FileText, Film, Image as ImageIcon, Languages, Lock, PlayCircle, RefreshCw, Search, X } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { KNOWLEDGE_LANGS, UNLOCKS, passesFor, unlockPrice } from '../config/plans'
import { buyUnlock, isUnlocked, kindOf, unlockKey, useUnlocked, useUnlocks, type UnlockKind } from '../lib/unlocks'
import { isPostOpen, usePostPasses } from '../lib/postPasses'
import { isLive } from '../lib/env'
import { useT, type T } from '../i18n'
import type { StringKey } from '../i18n/strings'
import { Badge, Button, Card, Empty, Header, Sheet, Tabs } from '../components/ui'
import { navigate } from '../lib/router'
import { knowledgeDownloadOk, useDownloadAccess } from '../lib/entitlements'
import { getBlob, itemId, savedUrl, useDownloads, type DlType } from '../lib/downloads'
import { openPlayer } from '../components/VideoPlayer'
import { KPreview } from '../components/KPreview'
import { Cover, CoverCard, useReveal } from '../components/PostCover'
import { PostCascade } from '../components/PostCascade'
import { PdfViewer } from '../components/PdfViewer'
import { canSaveType, fileTitle, kImg, kPreview, kStream, langsWith, pick, postDesc, postTitle, useKnowledge, visiblePosts, type KFile, type KLang, type KPost } from '../lib/knowledge'
import { IN_APP } from '../lib/appMode'
import { PostPassBanner, PostPassButtons, Remain, showsPostPasses, useOpenUntil, useSlotCount } from '../components/PostPasses'

const LANG_LABEL: Record<KLang, string> = { en: 'English', hi: 'हिंदी', gu: 'ગુજરાતી' }
const plural = (t: T, n: number, one: StringKey, many: StringKey) => t(n === 1 ? one : many, { n })

function counts(t: T, p: KPost, lang: KLang) {
  return [
    plural(t, pick(p.videos, lang).files.length, 'kVideo1', 'kVideoN'),
    plural(t, p.photos.length, 'kPhoto1', 'kPhotoN'),
    plural(t, pick(p.pdfs, lang).files.length, 'kPdf1', 'kPdfN'),
  ].join(' • ')
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
      {!q && <PostPanels posts={posts} jump />}
      <div className="label mb-2 mt-5">{t('kAll')} · {posts.length}</div>
      <PostList posts={posts} />
      <p className="pt-3 text-center font-mono text-[10.5px] text-dim">{t('kSynced', { x: new Date(data!.generatedAt).toLocaleString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
    </div>
  )
}

/** Knowledge posts on Today / Library / Knowledge: the 3D cascade of horizontal cover cards (see PostCascade). */
export function PostPanels({ posts, jump = false }: { posts: KPost[]; jump?: boolean }) {
  const t = useT()
  const lang = useApp((s) => s.lang) as KLang
  return <PostCascade posts={posts} lang={lang} jump={jump} sub={(p) => counts(t, p, lang)} labels={{ open: t('kOpenPost'), prev: '‹', next: '›', hint: t('ksHint') }} />
}

/** Every post as a clean horizontal 16:9 card, title below, tilting in as it scrolls into view. */
export function PostList({ posts }: { posts: KPost[] }) {
  const t = useT()
  const lang = useApp((s) => s.lang) as KLang
  return (
    <div className="pl-grid" data-testid="post-list">
      {[...posts].sort((a, b) => a.number - b.number).map((p) => <PostListItem key={p.id} p={p} lang={lang} sub={counts(t, p, lang)} openLabel={t('kOpenPost')} />)}
    </div>
  )
}
function PostListItem({ p, lang, sub, openLabel }: { p: KPost; lang: KLang; sub: string; openLabel: string }) {
  const ref = useReveal<HTMLButtonElement>()
  return (
    <button ref={ref} type="button" className="pl-item" data-testid={`klist-${p.number}`} aria-label={`${openLabel} #${p.number} ${postTitle(p, lang)}`} onClick={() => navigate(`/knowledge/${p.number}`)}>
      <CoverCard p={p} lang={lang} w={640} />
      <div className="mt-2 flex items-baseline gap-2 px-1 text-left">
        <span className="pc-num text-[13px]">#{p.number}</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-frost">{postTitle(p, lang)}</span>
      </div>
      <div className="truncate px-1 text-left font-mono text-[10px] text-muted">{sub}</div>
    </button>
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

/** Platinum: save a file INSIDE the app (IndexedDB) — never to the gallery / file system. */
function SaveBtn({ f, type, post, ukey }: { f: KFile; type: DlType; post?: number; ukey?: string }) {
  const t = useT()
  const bought = useUnlocked(ukey)
  const plan = effectivePlan(useApp((s) => s.membership))
  const ok = knowledgeDownloadOk(post, plan) || (UNLOCKS.allowDownload && bought)
  const id = itemId(type, f.id)
  const prog = useDownloads((s) => s.progress[id])
  const present = useDownloads((s) => s.present[id])
  const err = useDownloads((s) => s.errors[id])
  const save = useDownloads((s) => s.save)
  const toast = useApp((s) => s.showToast)
  if (!ok)
    return (
      <button data-testid="k-dl-locked" onClick={() => (IN_APP ? toast(t('memberOnly')) : navigate('/membership'))} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-gold/40 px-3 text-[12px] font-bold text-gold" title={t('kPlatinumOnly')}>
        <Lock size={13} /> {t('plan_pro')}
      </button>
    )
  if (prog !== undefined)
    return (
      <span data-testid="k-dl-progress" className="relative flex h-9 w-[92px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan/40 text-[11.5px] font-bold text-cyan">
        <span className="absolute inset-y-0 left-0 bg-cyan/20" style={{ width: `${Math.round(prog * 100)}%` }} />
        <span className="relative">{Math.round(prog * 100)}%</span>
      </span>
    )
  if (present)
    return (
      <button data-testid="k-saved" onClick={() => navigate('/downloads')} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-ok/40 bg-ok/10 px-3 text-[12px] font-bold text-ok">
        <CheckCircle2 size={14} /> {t('dlSaved')}
      </button>
    )
  if (!canSaveType(type))
    return (
      <button data-testid="k-dl-setup" onClick={() => toast(t('dlNeedsKey'))} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-cyan/30 bg-cyan/[0.06] px-3 text-[12px] font-bold text-cyan/70">
        <HardDriveDownload size={14} /> {t('dlAtLaunch')}
      </button>
    )
  return (
    <button data-testid="k-dl" title={err ? t('dlFailed') : undefined} onClick={async () => { if (!(await save({ type, title: fileTitle(f.name), source_id: f.id, mime: f.mime, size: f.size, post, unlock: ukey }))) toast(t('dlFailed')); else toast(t('dlSaved')) }} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-neon-static px-3 text-[12px] font-bold text-[#05080f]">
      <HardDriveDownload size={14} /> {t('dlSave')}
    </button>
  )
}

function FileRow({ f, icon, onOpen, type, post, ukey, locked, onLocked, gif }: { f: KFile; icon: React.ReactNode; onOpen: () => void; type: DlType; post: number; ukey?: string; locked?: boolean; onLocked?: () => void; gif?: boolean }) {
  const t = useT()
  const bought = useUnlocked(ukey)
  return (
    <Card className="overflow-hidden" data-testid={locked ? 'k-file-locked' : 'k-file'}>
    {gif && <KPreview id={f.id} locked={locked} label={f.lang ? LANG_LABEL[f.lang] : undefined} onClick={locked ? onLocked : onOpen} className="!rounded-none !border-0 !border-b" />}
    <div className="flex items-center gap-3 p-3">
      <button onClick={locked ? onLocked : onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${locked ? 'border-gold/35 bg-gold/[0.08] text-gold' : 'border-cyan/25 bg-cyan/[0.07] text-cyan'}`}>{locked ? <Lock size={18} /> : icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">{fileTitle(f.name)}</span>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-dim">{f.lang ? LANG_LABEL[f.lang] : ''}{bought ? `${f.lang ? ' · ' : ''}${t('ulOwned')}` : ''}</span>
        </span>
      </button>
      {locked
        ? <button data-testid="k-unlock" onClick={onLocked} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-gold/45 px-3 text-[12px] font-bold text-gold"><Lock size={13} /> {IN_APP ? t('locked') : t('ppOpenThis')}</button>
        : <SaveBtn f={f} type={type} post={post} ukey={ukey} />}
    </div>
    </Card>
  )
}

/** Sheet for a locked item: buy just this item, add it to a mini pack, or upgrade. */
type UnlockItem = { post: number; key?: string; title?: string }
function UnlockSheet({ item, onClose }: { item: UnlockItem | null; onClose: () => void }) {
  const t = useT()
  const toast = useApp((s) => s.showToast)
  const plan = effectivePlan(useApp((s) => s.membership))
  const pack = useUnlocks((s) => s.pack)
  const togglePick = useUnlocks((s) => s.togglePick)
  const grant = useUnlocks((s) => s.grant)
  const claim = usePostPasses((s) => s.claim)
  const slots = useSlotCount()
  const open = useOpenUntil(item?.post ?? 0)
  const [busy, setBusy] = useState(false)
  if (!item) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  if (IN_APP) return <Sheet open onClose={onClose} title={item.title ?? t('locked')}><p data-testid="unlock-sheet-app" className="flex items-center gap-2 pb-2 text-[14px] leading-snug text-gold"><Lock size={16} className="shrink-0" /> {t('memberOnly')}</p></Sheet>
  const kind = item.key ? kindOf(item.key) : null
  const inPack = !!(item.key && pack.includes(item.key))
  const pro = passesFor('pro')[0]
  const buy = async () => {
    if (!item.key || !kind) return
    setBusy(true)
    try {
      const r = await buyUnlock(kind, [item.key])
      if (r === 'demo') { grant([item.key]); toast(`${t('demo')} · ${t('ulDone')}`) }
      else if (r === 'paid') toast(t('ulDone'))
      if (r !== 'dismissed') onClose()
    } catch { toast(t('payFailed')) } finally { setBusy(false) }
  }
  const useSlot = async () => {
    const r = await claim(item.post)
    if (r === 'none') toast(t('ppNeedPost'))
    else { toast(t('ppClaimed')); onClose() }
  }
  return (
    <Sheet open onClose={onClose} title={item.title ?? t('ppOpenThis')}>
      <div className="space-y-2.5" data-testid="unlock-sheet">
        {open.open && open.until ? (
          <div className="rounded-xl border border-cyan/30 bg-cyan/[0.07] px-3 py-2 text-[13px] text-cyan">
            <div className="font-semibold">{t('ppClaimed')} · <Remain until={open.until} /></div>
            <p className="mt-0.5 text-[11.5px] text-cyan/80">{t('ppViewOnly')}</p>
          </div>
        ) : (
          <>
            {slots > 0 && (
              <Button variant="outline" className="w-full" data-testid="pp-claim" onClick={() => void useSlot()}>
                {t('ppClaim', { n: slots })}
              </Button>
            )}
            {showsPostPasses(plan) && <PostPassButtons post={item.post} onDone={onClose} />}
          </>
        )}
        {UNLOCKS.offered && item.key && kind && (
          <>
            <p className="pt-1 text-[13px] leading-snug text-muted">{showsPostPasses(plan) ? t('ppOrFile') : t('ulWhy')}</p>
            <Button className="w-full" disabled={busy} onClick={() => void buy()} data-testid="unlock-single">
              <Lock size={15} /> {t(kind === 'video' ? 'ulVideo' : 'ulPdf', { p: unlockPrice(kind) })}{!isLive ? ` · ${t('demo')}` : ''}
            </Button>
            <Button variant="outline" className="w-full" data-testid="unlock-pack-add" onClick={() => {
              const r = togglePick(item.key!)
              toast(r === 'full' ? t('ulPackFull', { n: kind === 'video' ? UNLOCKS.pack.videos : UNLOCKS.pack.pdfs }) : r === 'added' ? t('ulPackAdded') : t('ulPackRemoved'))
              if (r !== 'full') onClose()
            }}>
              {inPack ? t('ulPackRemove') : t('ulPackAdd', { v: UNLOCKS.pack.videos, d: UNLOCKS.pack.pdfs, p: UNLOCKS.pack.priceInr })}
            </Button>
          </>
        )}
        <Button variant="gold" className="w-full" data-testid="unlock-upgrade" onClick={() => { onClose(); navigate('/membership') }}>
          {t('ulUpgrade', { p: pro?.priceInr ?? 0, d: pro?.days ?? 30 })}
        </Button>
      </div>
    </Sheet>
  )
}

/** Floating mini-pack bar: shows picked items and buys them together. */
export function PackBar() {
  const t = useT()
  const pack = useUnlocks((s) => s.pack)
  const grant = useUnlocks((s) => s.grant)
  const clear = useUnlocks((s) => s.clearPack)
  const toast = useApp((s) => s.showToast)
  const [busy, setBusy] = useState(false)
  if (IN_APP || !UNLOCKS.offered || !pack.length) return null
  const v = pack.filter((k) => kindOf(k) === 'video').length, d = pack.length - v
  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-40 mx-auto max-w-[460px]">
    <div data-testid="pack-bar" className="glass-panel pack-bar flex items-center gap-2 p-2.5 pl-3.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold">{t('ulPack')} · ₹{UNLOCKS.pack.priceInr}</div>
        <div className="font-mono text-[11px] text-muted">{t('ulPackCount', { v, vm: UNLOCKS.pack.videos, d, dm: UNLOCKS.pack.pdfs })}</div>
      </div>
      <button aria-label="Clear" onClick={clear} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-muted"><X size={15} /></button>
      <Button size="sm" disabled={busy} data-testid="pack-buy" onClick={async () => {
        setBusy(true)
        try {
          const r = await buyUnlock('pack', pack)
          if (r === 'demo') { grant(pack); toast(`${t('demo')} · ${t('ulDone')}`) } else if (r === 'paid') { clear(); toast(t('ulDone')) }
        } catch { toast(t('payFailed')) } finally { setBusy(false) }
      }}>{t('ulBuyPack')}{!isLive ? ` · ${t('demo')}` : ''}</Button>
    </div>
    </div>
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
        <SaveBtn f={photos[i]} type="photo" />
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
  const [pdf, setPdf] = useState<{ blob: Blob; title: string } | null>(null)
  const access = useDownloadAccess()
  const dl = useDownloads()
  const plan = useApp((s) => effectivePlan(s.membership))
  const okLangs = KNOWLEDGE_LANGS[plan]
  useUnlocks((s) => s.keys) // re-render when something is unlocked
  const [unlock, setUnlock] = useState<UnlockItem | null>(null)
  usePostPasses((s) => s.unlocks)
  useEffect(() => { void useDownloads.getState().refresh() }, [])
  const [photo, setPhoto] = useState<number | null>(null)
  const p = data?.posts.find((x) => String(x.number) === id || x.id === id)

  if (loading) return <div className="mt-20 grid place-items-center text-muted"><RefreshCw size={18} className="animate-spin" /></div>
  if (!p) return <div><Header title={t('knowledge')} back="#/knowledge" /><Empty icon={<BookOpen size={28} />} text={t('kNotFound')} /></div>

  const vids = pick(p.videos, lang)
  const pdfs = pick(p.pdfs, lang)
  const fallbackNote = (used: KLang) => <p className="mb-2 flex items-center gap-1.5 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-[12px] text-gold"><Languages size={13} /> {t('kFallback', { a: LANG_LABEL[lang], b: LANG_LABEL[used] })}</p>
  const available = Array.from(new Set([...langsWith(p.videos), ...langsWith(p.pdfs)]))
  /** unlock key + open rule for one file (language-neutral files are open to everyone) */
  const gate = (kind: UnlockKind, f: KFile, used: KLang) => {
    const list = (kind === 'video' ? p.videos : p.pdfs)[used] ?? []
    const n = list.findIndex((x) => x.id === f.id)
    if (n < 0) return { key: undefined, locked: false }
    const key = unlockKey(p.number, kind, n)
    return { key, locked: !okLangs.includes(f.lang ?? used) && !isUnlocked(key) && !isPostOpen(p.number) }
  }
  const canOpenSaved = (key?: string) => access.state !== 'locked' || (UNLOCKS.allowDownload && isUnlocked(key))
  const langLocked = (tab === 'videos' || tab === 'pdfs') && !okLangs.includes(tab === 'videos' ? vids.used : pdfs.used) && !isPostOpen(p.number)
  const postOpen = isPostOpen(p.number)
  const openVideo = async (f: KFile) => {
    const open = vids.files.filter((x) => !gate('video', x, vids.used).locked)
    const items = await Promise.all(open.map(async (x) => {
      const xk = gate('video', x, vids.used).key
      const local = canOpenSaved(xk) && dl.present[itemId('video', x.id)] ? await savedUrl(itemId('video', x.id)) : null
      return { title: fileTitle(x.name), sub: `#${p.number} · ${LANG_LABEL[x.lang ?? vids.used]}${local ? ` · ${t('dlOffline')}` : ''}`, sources: (() => { const src = local ?? kStream(x.id); return src ? [{ src, type: 'video/mp4' }] : [] })(), embed: kPreview(x.id) }
    }))
    openPlayer({ items, index: Math.max(0, open.findIndex((x) => x.id === f.id)) })
  }
  const tapVideo = (f: KFile) => { const g = gate('video', f, vids.used); if (g.locked) { if (g.key) setUnlock({ key: g.key, title: fileTitle(f.name), post: p.number }) } else void openVideo(f) }

  return (
    <div data-testid="kpost">
      <Header title={`#${p.number}`} sub={postTitle(p, appLang)} back="#/knowledge" />
      <div className="pd-head" data-testid="kpost-head">
        <div className="pc-card pd-card dark-zone"><Cover p={p} w={1200} lang={lang} eager /><i className="pc-sheen" aria-hidden /></div>
        <div className="mt-3 px-0.5">
          <span className="font-mono text-[12px] font-bold tracking-[0.2em] text-cyan">D31 // KNOWLEDGE #{p.number}</span>
          <h1 className="title-hud mt-1 text-[22px] leading-tight text-frost">{postTitle(p, lang)}</h1>
          <div className="mt-1.5 font-mono text-[11px] text-muted">{counts(t, p, lang)}</div>
        </div>
      </div>

      <div className="relative mt-3 flex items-center gap-2" data-testid="k-langs">
        <Languages size={15} className="shrink-0 text-muted" />
        {(['en', 'hi', 'gu'] as KLang[]).map((l) => (
          <button key={l} data-testid={`k-lang-${l}`} data-on={lang === l || undefined} onClick={() => setLang(l)} className={`relative z-[1] flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border text-[12.5px] font-bold transition-colors duration-300 ${lang === l ? 'border-cyan/40 text-cyan' : 'border-white/10 text-muted'} ${available.includes(l) || !available.length ? '' : 'opacity-50'}`}>{!okLangs.includes(l) && !isPostOpen(p.number) && <Lock size={11} className="text-gold" />}{LANG_LABEL[l]}</button>
        ))}
        <Beam dep={lang} />
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
        {postOpen && <PostPassBanner post={p.number} />}
        {langLocked && (
          <div data-testid="k-lang-locked" className="flex flex-col gap-2 rounded-2xl border border-gold/35 bg-gold/[0.07] p-3">
            <div className="flex items-center gap-3">
              <Lock size={17} className="shrink-0 text-gold" />
              <p className="flex-1 text-[12.5px] leading-snug text-gold">{IN_APP ? t('memberOnly') : t('kLangLockedPass')}</p>
              {!IN_APP && <Button size="sm" variant="gold" onClick={() => navigate('/membership')}>{t('upgrade')}</Button>}
            </div>
            {!IN_APP && showsPostPasses(plan) && (
              <Button size="sm" variant="outline" className="w-full" data-testid="pp-open-this" onClick={() => setUnlock({ post: p.number, title: postTitle(p, appLang) })}>{t('ppOpenThis')}</Button>
            )}
          </div>
        )}
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
            {vids.files.length > 0 && (
              <div data-testid="k-gif-strip">
                <div className="mb-1.5 flex items-center gap-1.5 px-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-cyan"><PlayCircle size={13} /> {t('kGifStrip')}</div>
                <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4">
                  {vids.files.map((f) => (
                    <div key={f.id} className="w-[78%] shrink-0 snap-start">
                      <KPreview id={f.id} locked={gate('video', f, vids.used).locked} label={LANG_LABEL[f.lang ?? vids.used]} onClick={() => tapVideo(f)} />
                      <div className="mt-1 truncate px-0.5 text-[12px] font-semibold text-frost/90">{fileTitle(f.name)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            {vids.files.map((f) => { const g = gate('video', f, vids.used); return <FileRow key={f.id} gif f={f} type="video" post={p.number} ukey={g.key} locked={g.locked} onLocked={() => g.key && setUnlock({ key: g.key, title: fileTitle(f.name), post: p.number })} icon={<PlayCircle size={20} />} onOpen={() => void openVideo(f)} /> })}
          </>
        ) : <Empty icon={<Film size={26} />} text={t('kNoVideos')} />)}

        {tab === 'pdfs' && (pdfs.files.length ? (
          <>
            {pdfs.fallback && fallbackNote(pdfs.used)}
            {pdfs.files.map((f) => { const g = gate('pdf', f, pdfs.used); return <FileRow key={f.id} f={f} type="pdf" post={p.number} ukey={g.key} locked={g.locked} onLocked={() => g.key && setUnlock({ key: g.key, title: fileTitle(f.name), post: p.number })} icon={<FileText size={20} />} onOpen={async () => {
              const b = canOpenSaved(g.key) && dl.present[itemId('pdf', f.id)] ? await getBlob(itemId('pdf', f.id)).catch(() => undefined) : undefined
              if (b) setPdf({ blob: b, title: fileTitle(f.name) }); else setView({ f, kind: 'pdf' })
            }} /> })}
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
            <div className="flex items-center justify-end gap-2">
              <SaveBtn f={view.f} type={view.kind} post={p.number} ukey={gate(view.kind, view.f, view.kind === 'video' ? vids.used : pdfs.used).key} />
            </div>
          </div>
        )}
      </Sheet>
      <UnlockSheet item={unlock} onClose={() => setUnlock(null)} />
      <PackBar />
      {pdf && <PdfViewer blob={pdf.blob} title={pdf.title} onClose={() => setPdf(null)} />}
      {photo !== null && <Lightbox photos={p.photos} index={photo} onClose={() => setPhoto(null)} />}
      <div className="mt-6"><Button variant="ghost" className="w-full" onClick={() => navigate('/knowledge')}>{t('kAll')}</Button></div>
    </div>
  )
}
