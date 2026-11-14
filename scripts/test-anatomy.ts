// Anti-primitive guard for the muscle overlay (run via `npm run test:anatomy`).
// Fails if any muscle template — or any shape fitted onto a synthetic body — is an ellipse/primitive,
// or if the muscle renderer contains primitive-shape drawing calls.
import fs from 'node:fs'
import { densify, ellipseLikeness, fitMuscles, primitiveScore, TEMPLATES, type Fine, type Role } from '../src/lib/muscleAnatomy.ts'
import type { Pose } from '../src/lib/formCheck.ts'

let failed = 0
const ok = (c: boolean, m: string) => { if (!c) { console.log(`✗ ${m}`); failed++ } }
const MAX = 0.93

// 0) the detector itself must flag real ellipses and circles
const ell = (a: number, b: number, rot: number) => Array.from({ length: 64 }, (_, i) => { const t = (i / 64) * Math.PI * 2; const x = Math.cos(t) * a, y = Math.sin(t) * b; return { x: x * Math.cos(rot) - y * Math.sin(rot), y: x * Math.sin(rot) + y * Math.cos(rot) } })
for (const [a, b, r] of [[50, 50, 0], [80, 20, 0.4], [30, 12, 1.2], [100, 60, 2]]) ok(ellipseLikeness(ell(a, b, r)) > 0.97, `detector recognises an ellipse ${a}x${b}`)
// a lens (two arcs) is also a primitive
const lens = Array.from({ length: 64 }, (_, i) => { const t = i / 32; return i < 32 ? { x: t * 100, y: Math.sin(t * Math.PI) * 20 } : { x: (2 - t) * 100, y: -Math.sin((2 - t) * Math.PI) * 20 } })
ok(primitiveScore(lens) > MAX, `detector recognises a lens/oval shape as primitive (${primitiveScore(lens).toFixed(3)})`)
const rect = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 30 }, { x: 50, y: 30 }, { x: 0, y: 30 }, { x: 0, y: 15 }, { x: 100, y: 15 }].slice(0, 6).concat([{ x: 0, y: 15 }])
ok(primitiveScore(rect) > MAX, 'detector recognises a rectangle as primitive')
for (const [a, b, r] of [[50, 50, 0], [80, 20, 0.4]]) ok(primitiveScore(ell(a, b, r)) > 0.97, 'primitiveScore flags ellipses')

// 1) every template outline
for (const t of TEMPLATES) {
  const poly = densify(t.poly).map(([x, y]) => ({ x: x * 100, y: y * 40 }))
  const e = primitiveScore(poly)
  ok(t.poly.length >= 5 && poly.length >= 10, `${t.id}/${t.view}: enough outline points`)
  ok(e <= MAX, `${t.id}/${t.view} is not ellipse-like (score ${e.toFixed(3)})`)
}

// 2) shapes fitted onto a synthetic side-view body with a synthetic person mask
const W = 600, H = 1000
const pts: Record<number, { x: number; y: number }> = { 0: { x: 320, y: 120 }, 11: { x: 300, y: 240 }, 13: { x: 310, y: 400 }, 15: { x: 340, y: 540 }, 23: { x: 300, y: 520 }, 25: { x: 330, y: 720 }, 27: { x: 320, y: 920 } }
const pose = { ok: true, W, H, pts, vis: Object.keys(pts).map(Number), view: 'side', front: { x: 1, y: 0 }, metrics: {}, named: { shM: pts[11], hipM: pts[23] }, torsoLen: 280, inverted: false, z: {}, spread: 0.05 } as unknown as Pose
const data = new Float32Array(W * H)
const capsule = (a: { x: number; y: number }, b: { x: number; y: number }, r: number) => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy)))
    if (Math.hypot(x - a.x - vx * t, y - a.y - vy * t) <= r) data[y * W + x] = 1
  }
}
capsule(pts[11], pts[23], 95); capsule(pts[11], pts[13], 40); capsule(pts[13], pts[15], 30); capsule(pts[23], pts[25], 62); capsule(pts[25], pts[27], 40); capsule(pts[0], pts[11], 50)
const roles: Partial<Record<Fine, Role>> = {}
for (const t of TEMPLATES) roles[t.id] = 'primary'
const fit = fitMuscles(pose, { w: W, h: H, data, sx: 1, sy: 1 }, roles)
ok(fit.drawn.length >= 10, `synthetic body: muscles fitted (${fit.drawn.length})`)
for (const m of fit.drawn) for (const poly of m.polys) {
  const e = primitiveScore(poly)
  ok(poly.length >= 10 && e <= MAX, `fitted ${m.id} is not ellipse-like (score ${e.toFixed(3)})`)
}
// 3) no mask → nothing drawn (never a fallback)
const none = fitMuscles(pose, null, roles)
ok(none.drawn.length === 0 && none.notDrawn.length > 0, 'without a body mask nothing is drawn and all are listed as not drawn')

// 4) the renderer has no primitive-shape calls
for (const f of ['src/lib/muscleDraw.ts', 'src/lib/muscleAnatomy.ts']) {
  const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
  ok(!/\.(ellipse|arc|arcTo)\s*\(/.test(src), `${f}: no ellipse()/arc()/arcTo() calls`)
}
// 5) the old renderer is gone
const draw = fs.readFileSync(new URL('../src/lib/analysisDraw.ts', import.meta.url), 'utf8')
ok(!/function (lens|drawMuscles|buildShapes)\b|T_FRONT|T_BACK|T_SIDE/.test(draw), 'old ellipse/lens muscle renderer is deleted')

console.log(failed ? `\n${failed} anatomy check(s) FAILED` : '\nAll anatomy checks passed')
process.exit(failed ? 1 : 0)
