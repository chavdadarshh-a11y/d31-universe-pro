/**
 * Knowledge posts — auto-fed from Darshan's public Drive folder "D31 KNOWLEDGE".
 * scripts/sync-knowledge.mjs (GitHub Action, every 30 min) writes knowledge/posts.json; the app reads it.
 */
import { env } from './env'
import { useEffect, useState } from 'react'
import type { Lang } from '../types'

export type KLang = 'en' | 'hi' | 'gu'
export interface KFile { id: string; name: string; mime: string; size?: number; lang?: KLang }
export interface KPost {
  id: string; number: number; title: string; rawName: string
  cover: KFile | null; photos: KFile[]
  pdfs: Record<KLang | 'all', KFile[]>; videos: Record<KLang | 'all', KFile[]>
  meta: { title?: Partial<Record<KLang, string>>; description?: Partial<Record<KLang, string>> } | null
  warnings: string[]; empty: boolean
}
export interface KManifest { version: number; generatedAt: string; posts: KPost[] }

const URL_ = `${import.meta.env.BASE_URL}knowledge/posts.json`
const CACHE = 'd31-knowledge-cache'
let mem: KManifest | null = null

function cached(): KManifest | null {
  try { const s = localStorage.getItem(CACHE); return s ? (JSON.parse(s) as KManifest) : null } catch { return null }
}

export async function loadKnowledge(): Promise<KManifest> {
  const r = await fetch(URL_, { cache: 'no-cache' })
  if (!r.ok) throw new Error(String(r.status))
  const m = (await r.json()) as KManifest
  mem = m
  try { localStorage.setItem(CACHE, JSON.stringify(m)) } catch { /* quota */ }
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

export const visiblePosts = (m: KManifest | null) => (m?.posts ?? []).filter((p) => !p.empty)

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
