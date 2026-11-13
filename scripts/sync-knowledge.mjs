#!/usr/bin/env node
/**
 * D31 Knowledge sync — reads Darshan's PUBLIC Drive folder "D31 KNOWLEDGE" and writes
 * public/knowledge/posts.json, which the app loads. Zero manual work: add files in Drive, the
 * scheduled GitHub Action runs this, the app shows them.
 *
 *   node scripts/sync-knowledge.mjs [--root <folderId>] [--out public/knowledge/posts.json]
 *
 * Works WITHOUT any key (uses Drive's public embedded folder view). If GOOGLE_API_KEY is set it
 * uses the official Drive API v3 instead (adds file sizes for better duplicate detection).
 *
 * Expected structure (names matched loosely — case, spaces, dots and emoji don't matter):
 *   D31 KNOWLEDGE/
 *     501. TITLE/                 ← post folder: number + title
 *       COVER/  cover.jpg         ← card cover (prefers a file named "cover", else first image)
 *       PHOTO/  *.jpg|png         ← gallery
 *       PDF/    ENGLISH/ हिंदी/ ગુજરાતી/   *.pdf
 *       VIDEO/  ENGLISH/ हिंदी/ ગુજરાતી/   *.mp4
 *       meta.json (optional)      ← {"title":{"en":"","hi":"","gu":""},"description":{...}}
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const argv = process.argv.slice(2)
const arg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined }
const ROOT = arg('root') || process.env.KNOWLEDGE_ROOT_ID || '1JpV8qaI29rtwQ-aINWhRQ7R6-fkMp5md'
const OUT = arg('out') || 'public/knowledge/posts.json'
const KEY = process.env.GOOGLE_API_KEY || ''
const FOLDER = 'application/vnd.google-apps.folder'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (D31 knowledge sync)' } })
    if (r.ok) return r
    if (i === tries - 1) throw new Error(`${r.status} ${url.replace(KEY, '***')}`)
    await sleep(800 * (i + 1))
  }
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))

/** List one folder → [{id, name, mimeType, size?, modifiedTime?}] */
async function list(folderId) {
  if (KEY) {
    const out = []
    let pageToken = ''
    do {
      const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
      const r = await (await get(`https://www.googleapis.com/drive/v3/files?q=${q}&key=${KEY}&pageSize=1000&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)${pageToken ? `&pageToken=${pageToken}` : ''}`)).json()
      out.push(...r.files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, size: f.size ? +f.size : undefined, modifiedTime: f.modifiedTime })))
      pageToken = r.nextPageToken || ''
    } while (pageToken)
    return out
  }
  const html = await (await get(`https://drive.google.com/embeddedfolderview?id=${folderId}`)).text()
  const out = []
  for (const block of html.split('<div class="flip-entry" id="entry-').slice(1)) {
    const id = block.match(/^([\w-]+)"/)?.[1]
    const href = block.match(/<a href="([^"]+)"/)?.[1] ?? ''
    const type = block.match(/\/type\/([^"]+)"/)?.[1]
    const title = block.match(/flip-entry-title">([\s\S]*?)<\/div>/)?.[1]
    if (!id || title === undefined) continue
    out.push({ id, name: decode(title), mimeType: href.includes('/folders/') ? FOLDER : decode(type ?? 'application/octet-stream') })
  }
  return out
}

const clean = (s) => s.replace(/\s+/g, ' ').trim()
const kind = (name) => {
  const n = name.toLowerCase().replace(/[^a-z]/g, '')
  if (/^covers?$|^thumb|^poster/.test(n)) return 'cover'
  if (/^pdfs?$|^docs?$|^guides?$/.test(n)) return 'pdf'
  if (/^photos?$|^images?$|^pics?$|^gallery$/.test(n)) return 'photo'
  if (/^videos?$|^clips?$|^reels?$/.test(n)) return 'video'
  return null
}
const lang = (name) => {
  const n = name.toLowerCase()
  if (/english|^\s*en\b/.test(n)) return 'en'
  if (/हिंदी|हिन्दी|hindi|^\s*hi\b/.test(n)) return 'hi'
  if (/ગુજરાતી|gujarati|^\s*gu\b/.test(n)) return 'gu'
  return null
}
/** Language from the script a file name is written in (catches files dropped into the wrong language folder). */
const scriptLang = (name) => (/[\u0a80-\u0aff]/.test(name) ? 'gu' : /[\u0900-\u097f]/.test(name) ? 'hi' : null)
const isImg = (m) => m.startsWith('image/')
const isPdf = (m) => m === 'application/pdf'
const isVid = (m) => m.startsWith('video/')
const fileOut = (f) => ({ id: f.id, name: f.name, mime: f.mimeType, ...(f.size ? { size: f.size } : {}), ...(f.modifiedTime ? { modified: f.modifiedTime } : {}) })

/** All files under a folder (depth ≤ 3) with the language folder they sit in. */
async function walk(folderId, depth = 0, langHint = null) {
  const items = await list(folderId)
  const files = []
  for (const it of items) {
    if (it.mimeType === FOLDER) {
      if (depth >= 3) continue
      files.push(...(await walk(it.id, depth + 1, lang(it.name) ?? langHint)))
    } else files.push({ ...it, lang: langHint })
  }
  return files
}

function parsePostName(raw) {
  const name = clean(raw)
  const m = name.match(/^(\d{2,5})\s*[.\-_):]*\s*(.*)$/)
  if (!m) return null
  let title = m[2].replace(/\.\s*pdf$/i, '').replace(/^[.\s…]+|[.\s…]+$/g, '').trim()
  if (/^[.\s…]*$/.test(title)) title = ''
  return { number: +m[1], title }
}

async function main() {
  const top = await list(ROOT)
  const posts = []
  const globalWarnings = []
  for (const pf of top) {
    if (pf.mimeType !== FOLDER) { globalWarnings.push(`Loose file in root (not in a post folder): ${pf.name}`); continue }
    const p = parsePostName(pf.name)
    if (!p) { globalWarnings.push(`Folder without a post number skipped: "${clean(pf.name)}"`); continue }
    const warnings = []
    const children = await list(pf.id)
    const post = { id: pf.id, number: p.number, title: p.title, rawName: clean(pf.name), cover: null, photos: [], pdfs: { en: [], hi: [], gu: [], all: [] }, videos: { en: [], hi: [], gu: [], all: [] }, meta: null, warnings }
    const coverCands = []
    for (const c of children) {
      if (c.mimeType !== FOLDER) {
        if (/^meta\.json$/i.test(c.name)) {
          try { post.meta = await (await get(`https://drive.google.com/uc?export=download&id=${c.id}`)).json() } catch (e) { warnings.push(`meta.json could not be read: ${e.message}`) }
          continue
        }
        if (isImg(c.mimeType) && /^cover\b/i.test(c.name)) coverCands.push({ ...c, pri: 0 })
        else if (isImg(c.mimeType)) post.photos.push(fileOut(c))
        else if (isPdf(c.mimeType)) post.pdfs.all.push(fileOut(c))
        else if (isVid(c.mimeType)) post.videos.all.push(fileOut(c))
        else warnings.push(`Unsupported file at post root: ${c.name} (${c.mimeType})`)
        continue
      }
      const k = kind(c.name)
      if (!k) warnings.push(`Unknown subfolder "${clean(c.name)}" — scanned anyway, files sorted by type`)
      const files = await walk(c.id, 1, lang(c.name))
      for (const f of files) {
        const sl = scriptLang(f.name)
        if (f.lang && sl && sl !== f.lang && !isImg(f.mimeType)) {
          warnings.push(`"${f.name}" is in the ${f.lang.toUpperCase()} folder but its name is ${sl === 'gu' ? 'Gujarati' : 'Hindi'} — shown under ${sl.toUpperCase()}`)
          f.lang = sl
        }
        const out = { ...fileOut(f), ...(f.lang ? { lang: f.lang } : {}) }
        if (k === 'cover') {
          if (isImg(f.mimeType)) coverCands.push({ ...f, pri: /^cover\b/i.test(f.name) ? 0 : 1 })
          else warnings.push(`Non-image in COVER folder ignored: ${f.name}${isPdf(f.mimeType) ? ' (move it to PDF/<language>)' : ''}`)
          continue
        }
        if (isImg(f.mimeType)) { post.photos.push(out); if (k && k !== 'photo') warnings.push(`Image inside ${clean(c.name)} shown in Photos: ${f.name}`) }
        else if (isPdf(f.mimeType)) { post.pdfs[f.lang ?? 'all'].push(out); if (k && k !== 'pdf') warnings.push(`PDF inside ${clean(c.name)} shown in PDFs: ${f.name}`) }
        else if (isVid(f.mimeType)) { post.videos[f.lang ?? 'all'].push(out); if (k && k !== 'video') warnings.push(`Video inside ${clean(c.name)} shown in Videos: ${f.name}`) }
        else warnings.push(`Unsupported file skipped: ${f.name} (${f.mimeType})`)
      }
    }
    coverCands.sort((a, b) => a.pri - b.pri)
    if (coverCands.length) post.cover = fileOut(coverCands[0])
    else if (post.photos.length) { post.cover = post.photos[0]; warnings.push('No COVER image — using the first photo') }
    else warnings.push('No cover image')
    // duplicates: same file name twice in the same list → show once
    const dedupe = (arr, where) => {
      const seen = new Set()
      return arr.filter((f) => {
        const key = f.size ? `${f.name}|${f.size}` : f.name
        if (seen.has(key)) { warnings.push(`Duplicate hidden: "${f.name}" appears twice in ${where}`); return false }
        seen.add(key); return true
      })
    }
    post.photos = dedupe(post.photos, 'Photos')
    for (const l of Object.keys(post.pdfs)) post.pdfs[l] = dedupe(post.pdfs[l], `PDF/${l}`)
    for (const l of Object.keys(post.videos)) post.videos[l] = dedupe(post.videos[l], `Video/${l}`)
    const stem = (n) => n.replace(/\s*\(\d+\)(?=\.\w+$)|-\d+(?=\.\w+$)/, '').toLowerCase()
    const near = new Map()
    for (const f of [...post.photos, ...Object.values(post.pdfs).flat()]) {
      const key = stem(f.name)
      if (near.has(key) && near.get(key) !== f.name) warnings.push(`Looks like a copy: "${f.name}" vs "${near.get(key)}"`)
      else near.set(key, f.name)
    }
    if (!p.title) warnings.push('Folder has no title yet (only a number)')
    const n = post.photos.length + Object.values(post.pdfs).flat().length + Object.values(post.videos).flat().length
    if (!n && !post.cover) warnings.push('Empty post — hidden in the app until something is added')
    post.empty = !n && !post.cover
    posts.push(post)
  }
  posts.sort((a, b) => a.number - b.number)
  const manifest = { version: 1, generatedAt: new Date().toISOString(), source: { rootId: ROOT, via: KEY ? 'drive-api' : 'public-folder-view' }, posts, warnings: globalWarnings }
  if (!posts.length) throw new Error('No posts found — is the folder still shared "Anyone with the link"? Not overwriting posts.json.')
  const strip = (m) => JSON.stringify({ ...m, generatedAt: '' })
  if (existsSync(OUT)) {
    try { if (strip(JSON.parse(readFileSync(OUT, 'utf8'))) === strip(manifest)) { console.log('posts.json unchanged'); return } } catch { /* rewrite */ }
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(manifest, null, 1))
  console.log(`wrote ${OUT}: ${posts.length} posts`)
  for (const p of posts) console.log(`  #${p.number} ${p.title || '(no title)'} — cover:${p.cover ? 'yes' : 'no'} photos:${p.photos.length} pdfs:${Object.values(p.pdfs).flat().length} videos:${Object.values(p.videos).flat().length}${p.warnings.length ? `  ⚠ ${p.warnings.length}` : ''}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
