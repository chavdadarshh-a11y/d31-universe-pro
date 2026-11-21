// Knowledge "GIF" previews: for every Drive video in posts.json, cut a tiny muted looping montage
// (5 × 1.2 s moments spread across the video, 360 px wide, 12 fps, no audio, ~30–150 KB) with ffmpeg.
// Output: <out>/<fileId>.mp4 + <out>/index.json ({ ids: [...] }). The app shows these in every post.
// usage: node scripts/make-previews.mjs --posts public/knowledge/posts.json --out public/knowledge/previews [--reuse URL/]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const POSTS = arg('--posts', 'public/knowledge/posts.json'), OUT = arg('--out', 'public/knowledge/previews'), REUSE = arg('--reuse', '')
fs.mkdirSync(OUT, { recursive: true })
const m = JSON.parse(fs.readFileSync(POSTS, 'utf8'))
const ids = new Set()
for (const p of m.posts ?? []) for (const list of Object.values(p.videos ?? {})) for (const f of list) if (f?.id) ids.add(f.id)
const src = (id) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`
const done = []
for (const id of ids) {
  const out = path.join(OUT, `${id}.mp4`)
  try {
    if (REUSE) {
      const r = await fetch(`${REUSE}${id}.mp4`).catch(() => null)
      if (r && r.ok && (r.headers.get('content-type') || '').includes('video')) { fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); done.push(id); console.log('reused', id); continue }
    }
    const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src(id)], { timeout: 60000 }).toString()) || 0
    const N = dur > 20 ? 5 : 1, SEG = dur > 20 ? 1.2 : Math.min(4, dur || 4)
    const at = N === 1 ? [0] : [0.06, 0.24, 0.44, 0.64, 0.84].map((f) => +(f * dur).toFixed(2))
    const inputs = at.flatMap((s) => ['-ss', String(s), '-t', String(SEG), '-i', src(id)])
    const chain = at.map((_, i) => `[${i}:v]scale=360:-2:flags=bicubic,fps=12,setsar=1,format=yuv420p[v${i}]`).join(';')
    const filt = `${chain};${at.map((_, i) => `[v${i}]`).join('')}concat=n=${at.length}:v=1:a=0[out]`
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filt, '-map', '[out]', '-an', '-c:v', 'libx264', '-profile:v', 'baseline', '-crf', '31', '-preset', 'veryfast', '-movflags', '+faststart', out], { timeout: 180000 })
    done.push(id)
    console.log('made', id, `${(fs.statSync(out).size / 1024).toFixed(0)} KB`, `${dur.toFixed(0)}s source`)
  } catch (e) { console.log('skip', id, String(e).slice(0, 160)) }
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), ids: done }))
console.log(`${done.length}/${ids.size} previews`)
