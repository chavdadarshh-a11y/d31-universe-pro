/**
 * On-device photo search over the D31 Shoot gallery and the user's Progress photos.
 * Matches names, categories, exercise titles (en/hi/gu) and a small tag list.
 * This is keyword search — not an embedding model.
 */
import { SHOOT, type ShootPhoto } from '../../data/gallery'
import { exOf, exName } from '../../data/exercises'
import type { Lang, ProgressPhoto } from '../../types'
import { normMediaQuery, scoreMediaQuery } from './mediaQuery'

export type MediaHit = {
  source: 'shoot' | 'progress'
  id: string
  title: string
  cat?: string
  exId?: string
  date?: string
  dataUrl?: string
  shootId?: string
  score: number
  tags: string[]
}

const SYNONYMS: [RegExp, string[]][] = [
  [/hand\s*stand|handstand|हैंडस्टैंड|હેન્ડસ્ટેન્ડ/, ['handstand', 'handstand line', 'hand stand', 'hs', 'हैंडस्टैंड', 'હેન્ડસ્ટેન્ડ']],
  [/back\s*double|rear\s*double|rdb|बैक डबल|બેક ડબલ/, ['back double biceps', 'rear double biceps', 'rdb', 'back pose']],
  [/front\s*double|fdb/, ['front double biceps', 'fdb']],
  [/front\s*lever|फ्रंट लीवर|ફ્રન્ટ લીવર/, ['front lever', 'front-lever']],
  [/back\s*lever|बैक लीवर|બેક લીવર/, ['back lever', 'back-lever']],
  [/planche|प्लान्च|પ્લાન્ચ/, ['planche']],
  [/human\s*flag|फ्लैग|ફ્લેગ/, ['human flag', 'flag']],
  [/muscle[\s-]?up|मसल अप|મસલ અપ/, ['muscle up', 'muscle-up']],
  [/pull[\s-]?up|पुल अप|પુલ અપ/, ['pull up', 'pull-up', 'pullup']],
  [/push[\s-]?up|पुश अप|પુશ અપ/, ['push up', 'push-up', 'pushup']],
  [/squat|स्क्वाट|સ્ક્વોટ/, ['squat']],
  [/deadlift|rdl|डेडलिफ्ट|ડેડલિફ્ટ/, ['deadlift', 'rdl', 'romanian deadlift']],
  [/bicep|biceps|बाइसेप|બાઇસેપ/, ['biceps', 'bicep']],
  [/line/, ['line', 'handstand line']],
  [/side\s*chest|साइड चेस्ट/, ['side chest']],
  [/abs?\s*pose|vacuum|एब्स/, ['abs', 'vacuum', 'abs pose']],
  [/blueprint|outline|line art/, ['blueprint']],
]

function tagsForShoot(p: ShootPhoto, lang: Lang): string[] {
  const tags = new Set<string>([p.title, p.cat, p.id, `shoot/${p.id}`])
  if (p.exId) {
    const ex = exOf(p.exId)
    tags.add(exName(ex, 'en'))
    tags.add(exName(ex, 'hi'))
    tags.add(exName(ex, 'gu'))
    tags.add(p.exId.replace(/-/g, ' '))
  }
  const hay = `${p.title} ${p.cat} ${p.exId ?? ''}`.toLowerCase()
  for (const [re, extra] of SYNONYMS) if (re.test(hay)) extra.forEach((t) => tags.add(t))
  void lang
  return [...tags].filter(Boolean)
}

function tagsForProgress(p: ProgressPhoto): string[] {
  const tags = ['progress', 'progress photo']
  if (p.note) tags.push(p.note)
  if (p.date) {
    tags.push(p.date.slice(0, 10))
    try { tags.push(new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })) } catch { /* ignore */ }
  }
  return tags.filter(Boolean)
}

export function searchShoot(q: string, lang: Lang, list: ShootPhoto[] = SHOOT): MediaHit[] {
  if (!normMediaQuery(q)) return []
  const out: MediaHit[] = []
  for (const p of list) {
    const tags = tagsForShoot(p, lang)
    const score = scoreMediaQuery(q, tags)
    if (score <= 0) continue
    out.push({ source: 'shoot', id: p.id, shootId: p.id, title: p.title, cat: p.cat, exId: p.exId, score, tags })
  }
  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
}

export function searchProgress(q: string, photos: ProgressPhoto[]): MediaHit[] {
  if (!normMediaQuery(q)) return []
  const out: MediaHit[] = []
  for (const p of photos) {
    const tags = tagsForProgress(p)
    const score = scoreMediaQuery(q, tags)
    if (score <= 0) continue
    out.push({ source: 'progress', id: p.id, title: p.note || p.date.slice(0, 10), date: p.date, dataUrl: p.dataUrl, score, tags })
  }
  return out.sort((a, b) => b.score - a.score)
}

export function searchMedia(q: string, opts: { lang: Lang; photos?: ProgressPhoto[]; shoot?: ShootPhoto[] }): MediaHit[] {
  return [...searchShoot(q, opts.lang, opts.shoot), ...searchProgress(q, opts.photos ?? [])].sort((a, b) => b.score - a.score)
}
