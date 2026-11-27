/**
 * Knowledge posts — auto-fed from Darshan's public Drive folder "D31 KNOWLEDGE".
 * scripts/sync-knowledge.mjs (GitHub Action, every 30 min) writes knowledge/posts.json; the app reads it.
 */
import { env } from './env'
import { SITE_PATH } from '../config/site'
import { useEffect, useState } from 'react'
import type { Lang } from '../types'
import { OPEN_LIMITS, OPEN_POSTS } from '../config/knowledgeOpen'
import { VIEW_ALL_OPEN } from '../config/access'

export type KLang = 'en' | 'hi' | 'gu'
export interface KFile { id: string; name: string; mime: string; size?: number; lang?: KLang }
export interface KPost {
  id: string; number: number; title: string; rawName: string
  cover: KFile | null; photos: KFile[]
  pdfs: Record<KLang | 'all', KFile[]>; videos: Record<KLang | 'all', KFile[]>
  meta: { title?: Partial<Record<KLang, string>>; description?: Partial<Record<KLang, string>> } | null
  warnings: string[]; empty: boolean
  /** set by curate(): no real files, or (when VIEW_ALL_OPEN is false) not one of OPEN_POSTS → cover only, "Coming soon" */
  locked?: boolean
  /** locked post whose cover is the first page of its own PDF (kept only as the cover image) */
  coverFromPdf?: boolean
}
export interface KManifest { version: number; generatedAt: string; posts: KPost[] }

/** beta/preview builds read the live site's feed (always fresh from the Drive sync) */
const KBASE = (import.meta.env.VITE_KNOWLEDGE_BASE as string | undefined) || SITE_PATH
const URL_ = `${KBASE}knowledge/posts.json`
const CACHE = 'd31-knowledge-cache'
let mem: KManifest | null = null

function cached(): KManifest | null {
  try { const s = localStorage.getItem(CACHE); return s ? curate(JSON.parse(s) as KManifest) : null } catch { return null }
}

const LANGS3: KLang[] = ['en', 'hi', 'gu']
/** "Front_Squat_Biomechanics (3).pdf" and "Front_Squat_Biomechanics.pdf" are the same file → one key */
const copyKey = (f: KFile) => fileTitle(f.name).toLowerCase()
const distinct = (fs: KFile[]) => { const seen = new Set<string>(); return fs.filter((f) => { const k = copyKey(f); if (seen.has(k)) return false; seen.add(k); return true }) }
const emptyMap = (): Record<KLang | 'all', KFile[]> => ({ en: [], hi: [], gu: [], all: [] })
/** Up to n real files per language; language-less files (shown in every language) fill the remaining places. */
function limitMap(map: Record<KLang | 'all', KFile[]>, n: number) {
  const out = emptyMap()
  for (const l of LANGS3) out[l] = distinct([...(map[l] ?? []), ...(map.all ?? [])]).slice(0, n)
  return out
}
export const isOpenPost = (n: number) => OPEN_POSTS.includes(n)
/** True when every visitor may browse this post's real files (VIEW_ALL_OPEN, or it is one of OPEN_POSTS). */
export const isViewablePost = (n: number) => VIEW_ALL_OPEN || isOpenPost(n)
function hasFiles(p: KPost) {
  const n = (m: Record<string, KFile[]>) => Object.values(m).reduce((a, xs) => a + xs.length, 0)
  return !p.empty && !!(p.cover || p.photos.length || n(p.pdfs) || n(p.videos))
}
/** Applies the open-post / view-all rule to the Drive feed (idempotent). */
export function curate(m: KManifest): KManifest {
  const posts = m.posts.map((p): KPost => {
    if (!hasFiles(p)) {
      const pdf = p.pdfs.en[0] ?? p.pdfs.all[0] ?? p.pdfs.hi[0] ?? p.pdfs.gu[0]
      const cover = p.cover ?? pdf ?? p.photos[0] ?? null
      // keep feed-empty posts empty (hidden). A numbered post with no files yet stays visible as Coming soon.
      return { ...p, locked: true, cover, coverFromPdf: p.coverFromPdf ?? (!p.cover && !!pdf), photos: [], pdfs: emptyMap(), videos: emptyMap(), meta: p.meta ? { title: p.meta.title } : null }
    }
    if (!isViewablePost(p.number)) {
      // keep only what the cover needs: its COVER image, else the first page of its own PDF, else its first photo
      const pdf = p.pdfs.en[0] ?? p.pdfs.all[0] ?? p.pdfs.hi[0] ?? p.pdfs.gu[0]
      const cover = p.cover ?? pdf ?? p.photos[0] ?? null
      return { ...p, locked: true, cover, coverFromPdf: p.coverFromPdf ?? (!p.cover && !!pdf), photos: [], pdfs: emptyMap(), videos: emptyMap(), meta: p.meta ? { title: p.meta.title } : null }
    }
    if (!VIEW_ALL_OPEN) {
      const photos = distinct(p.photos.filter((f) => f.id !== p.cover?.id && !/^cover\./i.test(f.name))).slice(0, OPEN_LIMITS.photos)
      return { ...p, locked: false, photos, videos: limitMap(p.videos, OPEN_LIMITS.videos), pdfs: limitMap(p.pdfs, OPEN_LIMITS.pdfs) }
    }
    return { ...p, locked: false }
  })
  return { ...m, posts }
}

export async function loadKnowledge(): Promise<KManifest> {
  const r = await fetch(URL_, { cache: 'no-cache' })
  if (!r.ok) throw new Error(String(r.status))
  const raw = (await r.json()) as KManifest
  const m = curate(raw)
  mem = m
  try { localStorage.setItem(CACHE, JSON.stringify(raw)) } catch { /* quota */ }
  return m
}

export function useKnowledge() {
  const [data, setData] = useState<KManifest | null>(() => mem ?? cached())
  const [error, setError] = useState(false)
  useEffect(() => {
    let live = true
    loadKnowledge().then((m) => live && setData(m)).catch(() => live && setError(true))
    return () => { live = false }
  }, [])
  return { data, error, loading: !data && !error }
}

/** open posts first (OPEN_POSTS order), then the "Coming soon" ones by number */
const rankPost = (p: KPost) => { const i = OPEN_POSTS.indexOf(p.number); return i >= 0 ? i - 1e6 : p.number }
export const sortPosts = (ps: KPost[]) => [...ps].sort((a, b) => rankPost(a) - rankPost(b))
export const visiblePosts = (m: KManifest | null) => sortPosts((m?.posts ?? []).filter((p) => !p.empty))

// ---- media URLs (work for files shared "Anyone with the link") ----
export const kImg = (id: string, w = 800) => `https://lh3.googleusercontent.com/d/${id}=w${w}`
export const kPreview = (id: string) => `https://drive.google.com/file/d/${id}/preview`
/** Direct, range-capable, CORS-enabled stream of a PUBLIC Drive file via the Drive API (plays in <video>, fetchable for in-app saves).
 *  Needs VITE_GOOGLE_API_KEY. (drive.usercontent.google.com answers 403 to any cross-site browser request, so it can't be used.)
 *  Without a key → null, and the player falls back to Drive's own preview inside our chrome. */
export const kStream = (id: string): string | null =>
  env.googleApiKey ? `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(env.googleApiKey)}` : null
/** URL an in-app save fetches from. Photos come from lh3 (CORS-open, no key); videos/PDFs need the API key. */
export const kFetchUrl = (type: 'video' | 'pdf' | 'photo', id: string): string | null => (type === 'photo' ? kImg(id, 2400) : kStream(id))
export const canSaveType = (type: 'video' | 'pdf' | 'photo') => kFetchUrl(type, 'x') !== null
export const kDownload = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`
export const kView = (id: string) => `https://drive.google.com/file/d/${id}/view`

/** Title Case for ALL-CAPS folder names ("FRONT SQUATS" → "Front Squats"); leaves mixed case alone. */
function nice(s: string) {
  if (!s) return s
  const letters = s.replace(/[^A-Za-z]/g, '')
  if (letters && letters === letters.toUpperCase() && letters.length > 3)
    return s.toLowerCase().replace(/(^|[\s(&/-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
  return s
}
export function postTitle(p: KPost, lang: Lang) {
  return p.meta?.title?.[lang] || p.meta?.title?.en || nice(p.title) || `#${p.number}`
}
export const postDesc = (p: KPost, lang: Lang) => p.meta?.description?.[lang] || p.meta?.description?.en || ''

/** "Kinetic_Dragon_Flag_Analysis (1).pdf" → "Kinetic Dragon Flag Analysis" */
export function fileTitle(name: string) {
  return name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/\.JPG$/i, '').replace(/\s*\(\d+\)$/, '').replace(/_+/g, ' ').replace(/\s+-\s+/g, ' · ').replace(/\s+/g, ' ').trim()
}

const ORDER: KLang[] = ['en', 'hi', 'gu']
/** Files for the chosen language; falls back to another language when there are none. Language-less files always show. */
export function pick(map: Record<KLang | 'all', KFile[]>, lang: KLang): { files: KFile[]; used: KLang; fallback: boolean } {
  const order = [lang, ...ORDER.filter((l) => l !== lang)]
  const used = order.find((l) => map[l]?.length) ?? lang
  return { files: [...(map[used] ?? []), ...(map.all ?? [])], used, fallback: used !== lang && !!map[used]?.length }
}
export const langsWith = (map: Record<KLang | 'all', KFile[]>) => ORDER.filter((l) => map[l]?.length)
