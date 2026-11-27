#!/usr/bin/env node
/**
 * Idempotent Drive → D31.UNIVERSE media import.
 *
 * The recurring runner lists Drive (via the Google Drive connector — no GitHub-side
 * Google credentials) and writes a catalog + downloaded files, then runs this script.
 *
 * Videos are never auto-cut into exercises. New stills that pass quality, AI, and
 * perceptual-hash duplicate checks can be applied to the Shoot gallery with --apply-photos.
 */
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const DEFAULT_FOLDERS = join(HERE, 'folders.json')
const DEFAULT_MANIFEST = join(HERE, 'manifest.json')

const AI_NAME = /(gemini_generated|\bveo\b|synthid|file_000000|ai[-_ ]?watermark|google verification)/i
const SCREENSHOT = /^screenshot|\bscreenshot\b|\bscreen.?shot\b/i
const EDUCATIONAL = /(masterclass|slideshow|मूर्तिकला|hack|रिवर्स|ट्राइसेप्स_हैक|प्रीचर_कर्ल_मशीन_हैक)/i
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.tif', '.tiff'])
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv'])
const IMAGE_MIME = /image\//
const VIDEO_MIME = /video\//

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}
function has(flag) { return process.argv.includes(flag) }

function loadJson(p, fallback) {
  if (!existsSync(p)) return fallback
  return JSON.parse(readFileSync(p, 'utf8'))
}

function sha256File(p) {
  const h = createHash('sha256')
  h.update(readFileSync(p))
  return h.digest('hex')
}

function nowIso() { return new Date().toISOString().replace(/\.\d+Z$/, 'Z') }

function findInboxFile(inbox, id, name) {
  if (!inbox || !existsSync(inbox)) return null
  const ext = extname(name || '')
  const candidates = [
    join(inbox, id),
    join(inbox, id + ext),
    join(inbox, `${id}_${name}`),
    join(inbox, name),
  ]
  for (const c of candidates) if (existsSync(c) && statSync(c).isFile()) return c
  // loose: any file starting with id
  try {
    const hit = readdirSync(inbox).find((f) => f === id || f.startsWith(id + '.') || f.startsWith(id + '_'))
    if (hit) return join(inbox, hit)
  } catch {}
  return null
}

function kindOf(file) {
  const mime = file.mimeType || ''
  const ext = extname(file.name || '').toLowerCase()
  if (IMAGE_MIME.test(mime) || IMAGE_EXT.has(ext)) return 'photo'
  if (VIDEO_MIME.test(mime) || VIDEO_EXT.has(ext)) return 'video'
  return 'other'
}

function decideName(file) {
  const n = file.name || ''
  if (AI_NAME.test(n)) return 'skipped-ai'
  if (SCREENSHOT.test(n)) return 'skipped-screenshot'
  if (EDUCATIONAL.test(n)) return 'skipped-educational-or-slideshow'
  return null
}

function ahash(path) {
  const py = `
from PIL import Image
import sys
im = Image.open(sys.argv[1]).convert('L').resize((16, 16), Image.Resampling.LANCZOS)
px = list(im.getdata())
avg = sum(px) / len(px)
bits = ''.join('1' if p >= avg else '0' for p in px)
print(hex(int(bits, 2))[2:].rjust(16, '0'))
`
  const r = spawnSync('python3', ['-c', py, path], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'ahash failed').trim())
  return r.stdout.trim()
}

function hamming(a, b) {
  const x = BigInt('0x' + a) ^ BigInt('0x' + b)
  return x.toString(2).replace(/0/g, '').length
}

function imageSize(path) {
  const py = `
from PIL import Image
import sys
im = Image.open(sys.argv[1])
print(f"{im.width} {im.height}")
`
  const r = spawnSync('python3', ['-c', py, path], { encoding: 'utf8' })
  if (r.status !== 0) return { w: 0, h: 0 }
  const [w, h] = r.stdout.trim().split(/\s+/).map(Number)
  return { w, h }
}

function writeWebp(src, dest, maxEdge) {
  const py = `
from PIL import Image
import sys
src, dest, max_edge = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src)
im = im.convert('RGB')
w, h = im.size
scale = max_edge / max(w, h)
if scale < 1:
    im = im.resize((max(1, int(w*scale)), max(1, int(h*scale))), Image.Resampling.LANCZOS)
im.save(dest, 'WEBP', quality=82, method=6)
print(f"{im.size[0]} {im.size[1]}")
`
  const r = spawnSync('python3', ['-c', py, src, dest, String(maxEdge)], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'webp failed').trim())
  const [w, h] = r.stdout.trim().split(/\s+/).map(Number)
  return { w, h }
}

function nextShootId(existingIds) {
  let n = 0
  for (const id of existingIds) {
    const v = parseInt(id, 10)
    if (Number.isFinite(v) && v > n) n = v
  }
  return String(n + 1).padStart(3, '0')
}

function parseShootIds(galleryTs) {
  const ids = new Set()
  for (const m of galleryTs.matchAll(/\{\s*id:\s*'(\d+)'/g)) ids.add(m[1])
  return ids
}

function appendShootEntry(galleryPath, entry, dry) {
  const src = readFileSync(galleryPath, 'utf8')
  // Insert before the closing of the SHOOT array. Last entry is typically `,\n]` or `\n]`
  const re = /(export const SHOOT: ShootPhoto\[\] = \[[\s\S]*?)(\n\])/
  const m = src.match(re)
  if (!m) throw new Error('Could not find SHOOT array in gallery.ts')
  const line = `  { id: '${entry.id}', cat: '${entry.cat}', title: ${JSON.stringify(entry.title)}, w: ${entry.w}, h: ${entry.h} },\n`
  const next = src.replace(re, `$1\n${line}$2`)
  if (!dry) writeFileSync(galleryPath, next)
  return line.trim()
}

function videoPreview(src, destJpg) {
  mkdirSync(join(destJpg, '..'), { recursive: true })
  // 12-frame contact at ~2s intervals starting at 1s; rotate if metadata says so via auto
  try {
    execFileSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', src,
      '-vf', "thumbnail,scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,tile=4x3",
      '-frames:v', '1', destJpg,
    ], { timeout: 120000 })
    return destJpg
  } catch (e) {
    return null
  }
}

function usage() {
  console.log(`Usage:
  node scripts/drive-sync/import.mjs --catalog CATALOG.json --inbox INBOX --state STATE --repo REPO [options]

Required for a real import:
  --catalog   JSON array (or {files:[...]}) of Drive files:
              {id, name, mimeType, size, md5Checksum?, modifiedTime, parents?, path?, folderId?}
  --inbox     Directory of downloaded files named {id}, {id}.ext, or {id}_{name}
  --state     Persistent state dir (manifest + hashes + queues). Default: ./state next to cwd
  --repo      App repo root (contains src/data/gallery.ts and public/media)

Options:
  --folders        folders.json (default: scripts/drive-sync/folders.json)
  --apply-photos   Write qualifying new stills into public/media/shoot + gallery.ts
  --dry-run        Plan only; do not write media or edit source
  --help           This text

Exit codes: 0 ok, 2 usage / missing inputs.
`)
}

function main() {
  if (has('--help') || has('-h')) { usage(); process.exit(0) }
  const catalogPath = arg('--catalog')
  const inbox = arg('--inbox')
  const stateDir = resolve(arg('--state', join(process.cwd(), 'state')))
  const repo = resolve(arg('--repo', process.cwd()))
  const foldersPath = arg('--folders', DEFAULT_FOLDERS)
  const applyPhotos = has('--apply-photos')
  const dry = has('--dry-run')

  if (!catalogPath) { usage(); process.exit(2) }

  mkdirSync(stateDir, { recursive: true })
  const manifestPath = join(stateDir, 'manifest.json')
  const hashesPath = join(stateDir, 'hashes.json')
  const queuePath = join(stateDir, 'pending-review.json')
  const previewDir = join(stateDir, '..', 'previews')
  mkdirSync(previewDir, { recursive: true })

  const foldersDoc = loadJson(foldersPath, { folders: [] })
  const allowed = new Set((foldersDoc.folders || []).map((f) => f.id))
  const knowledge = new Set((foldersDoc.folders || []).filter((f) => f.role === 'knowledge').map((f) => f.id))

  let manifest = loadJson(manifestPath, null) || loadJson(DEFAULT_MANIFEST, { version: 1, files: [] })
  if (!manifest.files) manifest.files = []
  const byId = new Map(manifest.files.map((f) => [f.id, f]))
  const hashes = loadJson(hashesPath, { version: 1, sha256: {}, ahash: {} })

  const shootDir = join(repo, 'public/media/shoot')
  if (existsSync(shootDir)) {
    for (const f of readdirSync(shootDir)) {
      if (!f.endsWith('.webp') || f.endsWith('-sm.webp')) continue
      const p = join(shootDir, f)
      const key = 'shoot:' + f.replace(/\.webp$/, '')
      if (!hashes.ahash[key]) {
        try { hashes.ahash[key] = ahash(p) } catch {}
      }
    }
  }

  const raw = loadJson(catalogPath, null)
  if (!raw) { console.error('Cannot read catalog', catalogPath); process.exit(2) }
  const catalog = Array.isArray(raw) ? raw : (raw.files || raw.items || [])
  if (!Array.isArray(catalog)) { console.error('Catalog must be an array or {files:[]}'); process.exit(2) }

  const report = { addedPhotos: [], queuedVideos: [], skipped: [], seen: 0, newFiles: 0 }
  const pending = loadJson(queuePath, { videos: [], photos: [] })

  for (const file of catalog) {
    if (!file || !file.id) continue
    if (file.mimeType === 'application/vnd.google-apps.folder') continue
    const folderId = file.folderId || file.folder || (file.parents && file.parents[0]) || null
    if (folderId && allowed.size && !allowed.has(folderId) && !(file.path && [...allowed].some((id) => (file.path || '').includes(id)))) {
      // still accept if parent is a known folder; if unknown, skip unless no folder given
      if (folderId && !allowed.has(folderId)) {
        // Knowledge posts have their own sync — never import as shoot/clips.
        if (knowledge.has(folderId)) {
          if (!byId.has(file.id)) {
            byId.set(file.id, { id: file.id, name: file.name, folder: folderId, kind: 'knowledge', status: 'seen', decision: 'deferred-to-sync-knowledge' })
          }
          continue
        }
        report.skipped.push({ id: file.id, name: file.name, reason: 'outside-watched-folders' })
        continue
      }
    }
    report.seen++
    const existing = byId.get(file.id)
    const kind = kindOf(file)
    const local = findInboxFile(inbox, file.id, file.name)

    let sha = file.sha256 || null
    if (local) {
      sha = sha256File(local)
    }

    // Already known and unchanged: leave the stored decision alone.
    if (existing && !local) {
      continue
    }
    if (existing && sha && existing.sha256 && sha === existing.sha256) {
      continue
    }
    if (existing && (existing.decision === 'imported-as-clip' || existing.decision === 'imported-as-shoot' || existing.status === 'imported') && !sha) {
      continue
    }

    const named = decideName(file)
    if (sha && hashes.sha256[sha] && hashes.sha256[sha] !== file.id) {
      const rec = {
        id: file.id, name: file.name, size: file.size, mimeType: file.mimeType,
        modifiedTime: file.modifiedTime, md5Checksum: file.md5Checksum, sha256: sha,
        folder: folderId, kind, status: 'seen', decision: 'skipped-duplicate-hash',
        duplicateOf: hashes.sha256[sha],
      }
      byId.set(file.id, rec)
      report.skipped.push({ id: file.id, name: file.name, reason: 'duplicate-hash', of: hashes.sha256[sha] })
      continue
    }

    if (named) {
      const rec = {
        id: file.id, name: file.name, size: file.size, mimeType: file.mimeType,
        modifiedTime: file.modifiedTime, sha256: sha, folder: folderId, kind,
        status: 'seen', decision: named,
      }
      byId.set(file.id, rec)
      report.skipped.push({ id: file.id, name: file.name, reason: named })
      continue
    }

    if (!local) {
      const rec = {
        id: file.id, name: file.name, size: file.size, mimeType: file.mimeType,
        modifiedTime: file.modifiedTime, md5Checksum: file.md5Checksum, folder: folderId,
        kind, status: 'seen', decision: 'pending-download',
      }
      byId.set(file.id, rec)
      report.newFiles++
      continue
    }

    if (kind === 'video') {
      const preview = join(previewDir, `${file.id}.jpg`)
      if (!dry) videoPreview(local, preview)
      const rec = {
        id: file.id, name: file.name, size: file.size, mimeType: file.mimeType,
        modifiedTime: file.modifiedTime, md5Checksum: file.md5Checksum, sha256: sha,
        folder: folderId, kind: 'video', status: 'seen', decision: 'pending-review',
        preview: dry ? null : preview,
      }
      byId.set(file.id, rec)
      if (sha) hashes.sha256[sha] = file.id
      pending.videos = pending.videos.filter((v) => v.id !== file.id)
      pending.videos.push({ id: file.id, name: file.name, size: file.size, preview: rec.preview, sha256: sha })
      report.queuedVideos.push({ id: file.id, name: file.name })
      report.newFiles++
      continue
    }

    if (kind === 'photo') {
      const { w, h } = imageSize(local)
      if (Math.max(w, h) < 800) {
        const rec = {
          id: file.id, name: file.name, size: file.size, w, h, sha256: sha,
          folder: folderId, kind: 'photo', status: 'seen', decision: 'skipped-too-small',
        }
        byId.set(file.id, rec)
        report.skipped.push({ id: file.id, name: file.name, reason: 'too-small', w, h })
        continue
      }
      let ph = null
      try { ph = ahash(local) } catch (e) {
        report.skipped.push({ id: file.id, name: file.name, reason: 'ahash-failed' })
        continue
      }
      let near = null, dist = 99
      for (const [key, val] of Object.entries(hashes.ahash)) {
        const d = hamming(ph, val)
        if (d < dist) { dist = d; near = key }
      }
      if (dist <= 8) {
        const rec = {
          id: file.id, name: file.name, size: file.size, w, h, sha256: sha, ahash: ph,
          folder: folderId, kind: 'photo', status: 'seen', decision: 'skipped-near-duplicate',
          near, hamming: dist,
        }
        byId.set(file.id, rec)
        report.skipped.push({ id: file.id, name: file.name, reason: 'near-duplicate', of: near, hamming: dist, note: 'kept existing (already in gallery); re-run with a higher-res original only after review' })
        continue
      }

      const galleryPath = join(repo, 'src/data/gallery.ts')
      const ids = existsSync(galleryPath) ? parseShootIds(readFileSync(galleryPath, 'utf8')) : new Set()
      const newId = nextShootId(ids)
      const title = 'Studio shoot' // honest, no guessed exercise
      if (applyPhotos) {
        const dest = join(shootDir, `${newId}.webp`)
        const destSm = join(shootDir, `${newId}-sm.webp`)
        let dims = { w, h }
        if (!dry) {
          mkdirSync(shootDir, { recursive: true })
          dims = writeWebp(local, dest, 1200)
          writeWebp(local, destSm, 520)
          if (existsSync(galleryPath)) {
            appendShootEntry(galleryPath, { id: newId, cat: 'brand', title, w: dims.w, h: dims.h }, dry)
          }
        }
        const rec = {
          id: file.id, name: file.name, size: file.size, w: dims.w, h: dims.h, sha256: sha, ahash: ph,
          folder: folderId, kind: 'photo', status: 'imported', decision: 'imported-as-shoot',
          shootId: newId, title,
        }
        byId.set(file.id, rec)
        if (sha) hashes.sha256[sha] = file.id
        hashes.ahash['shoot:' + newId] = ph
        report.addedPhotos.push({ driveId: file.id, name: file.name, shootId: newId, title, w: dims.w, h: dims.h })
        report.newFiles++
      } else {
        const rec = {
          id: file.id, name: file.name, size: file.size, w, h, sha256: sha, ahash: ph,
          folder: folderId, kind: 'photo', status: 'seen', decision: 'pending-review-photo',
        }
        byId.set(file.id, rec)
        pending.photos = pending.photos.filter((p) => p.id !== file.id)
        pending.photos.push({ id: file.id, name: file.name, w, h, sha256: sha, ahash: ph, suggestedTitle: title })
        report.newFiles++
      }
      continue
    }

    const rec = {
      id: file.id, name: file.name, size: file.size, mimeType: file.mimeType,
      folder: folderId, kind, status: 'seen', decision: 'skipped-unsupported-type',
    }
    byId.set(file.id, rec)
    report.skipped.push({ id: file.id, name: file.name, reason: 'unsupported-type' })
  }

  manifest = {
    version: 1,
    updatedAt: nowIso(),
    folders: foldersDoc.folders || manifest.folders || [],
    files: [...byId.values()],
  }
  if (!dry) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    writeFileSync(hashesPath, JSON.stringify(hashes, null, 2))
    writeFileSync(queuePath, JSON.stringify({ updatedAt: nowIso(), ...pending }, null, 2))
    // keep a copy next to the script in the repo when repo is this app
    try { writeFileSync(join(HERE, 'manifest.json'), JSON.stringify(manifest, null, 2)) } catch {}
  }

  const reportPath = join(stateDir, 'last-run.json')
  const out = { updatedAt: nowIso(), dry, applyPhotos, catalog: catalogPath, inbox, ...report, pendingVideos: pending.videos.length, pendingPhotos: pending.photos.length }
  if (!dry) writeFileSync(reportPath, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

main()
