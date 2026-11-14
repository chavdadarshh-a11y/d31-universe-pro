// Anti-primitive guard for the muscle overlay (run via `npm run test:anatomy`).
// Fails if any muscle template — or any shape fitted onto a synthetic body — is an ellipse/primitive,
// or if the muscle renderer contains primitive-shape drawing calls.
import fs from 'node:fs'
import { densify, ellipseLikeness, fitMuscles, NO_ART, primitiveScore, TEMPLATES, TRIANGLE_MAX, triangleLikeness, type Fine, type Role } from '../src/lib/muscleAnatomy.ts'
import type { Pose } from '../src/lib/formCheck.ts'
import { ART, anchorDebug, coons, triangleIoU } from '../src/lib/muscleArt.ts'

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

// triangle detector works (a rounded triangle — like the old trapezius shapes — is caught; an ellipse is not)
const triPts: [number, number][] = [[0, 0], [0.5, 0.02], [1, 0], [0.75, 0.45], [0.52, 0.9], [0.25, 0.45]]
const tri = densify(triPts).map(([x, y]) => ({ x: x * 100, y: y * 80 }))
ok(triangleLikeness(tri) >= TRIANGLE_MAX, `detector recognises a triangle (${triangleLikeness(tri).toFixed(3)})`)
ok(triangleLikeness(ell(60, 30, 0.3)) < 0.5, 'an ellipse is not a triangle')
// the old triangle/sliver outlines are gone for good
for (const id of ['traps_upper', 'traps_mid', 'rhomboids', 'teres_major', 'serratus'] as Fine[]) {
  ok(!TEMPLATES.some((t) => t.id === id) && NO_ART.has(id), `${id}: no primitive template left (side view: not drawn; front/back: anatomical artwork)`)
}

// 1) every template outline
for (const t of TEMPLATES) {
  const tl = triangleLikeness(densify(t.poly).map(([x, y]) => ({ x, y })))
  ok(tl < TRIANGLE_MAX, `${t.id}/${t.view} is not triangle-like (score ${tl.toFixed(3)})`)
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
  ok(triangleLikeness(poly) < TRIANGLE_MAX, `fitted ${m.id} is not triangle-like (${triangleLikeness(poly).toFixed(3)})`)
}
// 2b) the triangle check is IoU-based: curved / concave muscles must pass, a triangle must not
const crescent = Array.from({ length: 80 }, (_, i) => { const t = i / 79; return i < 40 ? { x: Math.cos(Math.PI * t * 2) * 100, y: Math.sin(Math.PI * t * 2) * 100 } : { x: Math.cos(Math.PI * (2 - t * 2)) * 70 + 20, y: Math.sin(Math.PI * (2 - t * 2)) * 60 } })
ok(triangleIoU(crescent) < TRIANGLE_MAX, `a curved crescent is not called a triangle (${triangleIoU(crescent).toFixed(3)})`)
ok(triangleIoU([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }]) > 0.99, 'a real triangle scores 1')

// 2c) the artwork: every part of every muscle (raw patch) is a curved anatomical shape — never a primitive
const outline = (C: [number, number][][]) => { const nu = C.length, ns = C[0].length, o: { x: number; y: number }[] = []
  for (let i = 0; i < nu; i++) o.push({ x: C[i][0][0], y: C[i][0][1] }); for (let j = 1; j < ns; j++) o.push({ x: C[nu - 1][j][0], y: C[nu - 1][j][1] })
  for (let i = nu - 2; i >= 0; i--) o.push({ x: C[i][ns - 1][0], y: C[i][ns - 1][1] }); for (let j = ns - 2; j > 0; j--) o.push({ x: C[0][j][0], y: C[0][j][1] }); return o }
for (const m of ART) for (const [k, part] of Object.entries(m.parts)) {
  if (part.apo) continue
  const sc = part.frame === 'trunk' ? 1 : 100
  const ol = outline(coons(part)).map((p) => ({ x: p.x * sc, y: p.y * sc }))
  ok(primitiveScore(ol) <= MAX, `art ${m.view}/${m.id}.${k} is not ellipse-like (${primitiveScore(ol).toFixed(3)})`)
  ok(triangleIoU(ol) < TRIANGLE_MAX, `art ${m.view}/${m.id}.${k} is not triangle-like (${triangleIoU(ol).toFixed(3)})`)
}

// 2d) synthetic BACK and FRONT bodies: artwork fitted, every drawn part passes the shape checks
for (const view of ['back', 'front'] as const) {
  const W2 = 600, H2 = 1000
  const L = { x: 220, y: 260 }, R = { x: 380, y: 260 }, hl = { x: 255, y: 540 }, hr = { x: 345, y: 540 }
  const sh = view === 'back' ? [L, R] : [R, L], hp = view === 'back' ? [hl, hr] : [hr, hl]
  const p2: Record<number, { x: number; y: number }> = { 0: { x: 300, y: 150 }, 7: { x: 270, y: 160 }, 8: { x: 330, y: 160 }, 11: sh[0], 12: sh[1], 23: hp[0], 24: hp[1],
    13: { x: view === 'back' ? 190 : 410, y: 420 }, 14: { x: view === 'back' ? 410 : 190, y: 420 }, 15: { x: view === 'back' ? 185 : 415, y: 560 }, 16: { x: view === 'back' ? 415 : 185, y: 560 },
    25: { x: view === 'back' ? 250 : 350, y: 750 }, 26: { x: view === 'back' ? 350 : 250, y: 750 }, 27: { x: view === 'back' ? 250 : 350, y: 950 }, 28: { x: view === 'back' ? 350 : 250, y: 950 } }
  const z = view === 'back' ? { 0: 0.4, 7: 0.1, 8: 0.1 } : { 0: -0.5, 7: -0.2, 8: -0.2 }
  const d2 = new Float32Array(W2 * H2)
  const cap2 = (a: { x: number; y: number }, b: { x: number; y: number }, r: number) => {
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      const vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy)))
      if (Math.hypot(x - a.x - vx * t, y - a.y - vy * t) <= r) d2[y * W2 + x] = 1
    }
  }
  // torso: a tapered body (shoulders → waist → hips), neck/head, arms and legs
  for (let y = 250; y < 600; y++) { const t = (y - 250) / 350, hw = t < 0.6 ? 112 - 40 * (t / 0.6) : 72 + 18 * ((t - 0.6) / 0.4); for (let x = Math.round(300 - hw); x <= 300 + hw; x++) d2[y * W2 + x] = 1 }
  cap2({ x: 300, y: 150 }, { x: 300, y: 260 }, 45); cap2(L, { x: 190, y: 420 }, 34); cap2({ x: 190, y: 420 }, { x: 185, y: 560 }, 28); cap2(R, { x: 410, y: 420 }, 34); cap2({ x: 410, y: 420 }, { x: 415, y: 560 }, 28)
  cap2({ x: 255, y: 560 }, { x: 250, y: 750 }, 50); cap2({ x: 345, y: 560 }, { x: 350, y: 750 }, 50); cap2({ x: 250, y: 750 }, { x: 250, y: 950 }, 34); cap2({ x: 350, y: 750 }, { x: 350, y: 950 }, 34)
  const T2 = 280
  const pose2 = { ok: true, W: W2, H: H2, pts: p2, vis: Object.keys(p2).map(Number), view, metrics: { hip: { v: 175 } }, named: { shM: { x: 300, y: 260 }, hipM: { x: 300, y: 540 } }, torsoLen: T2, inverted: false, z, spread: 0.57 } as unknown as Pose
  const r2: Partial<Record<Fine, Role>> = {}
  for (const m of ART) if (m.view === view) r2[m.id] = 'primary'
  const f2 = fitMuscles(pose2, { w: W2, h: H2, data: d2, sx: 1, sy: 1 }, r2)
  const want = ART.filter((m) => m.view === view).length
  if (process.env.DBG) console.log(view, anchorDebug.splice(0).map((d) => d.msg).join(" | "))
  ok(f2.drawn.length >= want - 2, `synthetic ${view} body: artwork fitted (${f2.drawn.length}/${want}; not drawn: ${f2.notDrawn.map((n) => n.id).join(',') || '-'})`)
  for (const m of f2.drawn) m.polys.forEach((poly, i) => {
    if (m.apo?.[i]) return
    ok(primitiveScore(poly) <= MAX, `${view} fitted ${m.id} is not ellipse-like (${primitiveScore(poly).toFixed(3)})`)
    ok(triangleIoU(poly) < TRIANGLE_MAX, `${view} fitted ${m.id} is not triangle-like (${triangleIoU(poly).toFixed(3)})`)
    let inside = 0; for (const p of poly) if (d2[Math.round(p.y) * W2 + Math.round(p.x)] > 0.5) inside++
    ok(inside / poly.length > 0.6, `${view} fitted ${m.id} lies on the body (${(inside / poly.length).toFixed(2)})`)
  })
  // ambiguous facing (no face depth cue) → the artwork is not drawn at all
  const amb = fitMuscles({ ...pose2, z: {} } as Pose, { w: W2, h: H2, data: d2, sx: 1, sy: 1 }, r2)
  ok(amb.drawn.length === 0 && amb.notDrawn.every((n) => n.reason === 'view'), `${view}: uncertain facing → nothing drawn`)
}

// 3) no mask → nothing drawn (never a fallback)
const none = fitMuscles(pose, null, roles)
ok(none.drawn.length === 0 && none.notDrawn.length > 0, 'without a body mask nothing is drawn and all are listed as not drawn')

// 4) the renderer has no primitive-shape calls
for (const f of ['src/lib/muscleDraw.ts', 'src/lib/muscleAnatomy.ts', 'src/lib/muscleArt.ts']) {
  const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
  ok(!/\.(ellipse|arc|arcTo)\s*\(/.test(src), `${f}: no ellipse()/arc()/arcTo() calls`)
}
// 5) the old renderer is gone
const draw = fs.readFileSync(new URL('../src/lib/analysisDraw.ts', import.meta.url), 'utf8')
ok(!/function (lens|drawMuscles|buildShapes)\b|T_FRONT|T_BACK|T_SIDE/.test(draw), 'old ellipse/lens muscle renderer is deleted')

console.log(failed ? `\n${failed} anatomy check(s) FAILED` : '\nAll anatomy checks passed')
process.exit(failed ? 1 : 0)
