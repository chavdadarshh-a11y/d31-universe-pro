// Pose reliability filter checks (run via npm test).
import { evaluatePose, layoutLabels, plausiblePose, reliable, type Pt } from '../src/lib/poseFilter.ts'

let failed = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failed++ }

const blank = (): Pt[] => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.05 }))
const set = (lm: Pt[], i: number, x: number, y: number, v = 0.95) => { lm[i] = { x, y, visibility: v, presence: v } }

// Full-body side squat — realistic proportions, everything visible
function squat(): Pt[] {
  const lm = blank()
  set(lm, 0, 0.42, 0.18)
  set(lm, 11, 0.45, 0.28); set(lm, 12, 0.47, 0.28)
  set(lm, 13, 0.55, 0.38); set(lm, 14, 0.56, 0.38)
  set(lm, 15, 0.62, 0.45); set(lm, 16, 0.63, 0.45)
  set(lm, 23, 0.40, 0.55); set(lm, 24, 0.42, 0.55)
  set(lm, 25, 0.62, 0.62); set(lm, 26, 0.63, 0.62)
  set(lm, 27, 0.58, 0.88); set(lm, 28, 0.59, 0.88)
  return lm
}
const sq = evaluatePose(squat())
ok(sq.ok && !sq.notMeasurable, 'full-body squat passes')
ok(sq.angles.map((a) => a.name).join(',') === 'knee,hip,elbow', 'squat → knee, hip and elbow angles')

// The reported bug: lying arm curl close-up. Arm/head/shoulder visible; MediaPipe
// "hallucinated" knee + hip inside the torso area with mid visibility.
function armCurl(): Pt[] {
  const lm = blank()
  set(lm, 0, 0.30, 0.30)
  set(lm, 11, 0.45, 0.45); set(lm, 13, 0.62, 0.30); set(lm, 15, 0.55, 0.12)
  set(lm, 23, 0.52, 0.62, 0.7); set(lm, 25, 0.48, 0.55, 0.7); set(lm, 27, 0.60, 0.75, 0.66)
  return lm
}
const ac = evaluatePose(armCurl())
ok(!ac.angles.some((a) => a.name === 'knee' || a.name === 'hip'), 'arm close-up never reports knee/hip')
ok(ac.angles.length === 0 && ac.notMeasurable, 'arm close-up → no angle labels, "not measurable" notice')

// Exact geometry of the bug report: HIP ≈ 18°, KNEE ≈ 156° (knee folded back onto the torso)
const bug = armCurl(); set(bug, 25, 0.462, 0.551, 0.8); set(bug, 27, 0.40, 0.62, 0.8); set(bug, 23, 0.52, 0.62, 0.8)
ok(evaluatePose(bug).angles.length === 0, 'reported case (hip 18°, knee 156° on an arm photo) → no angles')

// Same close-up where knee/hip are predicted off-image (out of bounds)
const off = armCurl(); set(off, 23, 0.6, 1.08); set(off, 25, 0.7, 1.4); set(off, 27, 0.7, 1.7)
const offR = evaluatePose(off)
ok(!offR.points.some((i) => i >= 23), 'out-of-frame hips/knees are not drawn')
ok(offR.angles.length === 0 && offR.notMeasurable, 'only one measurable joint → no labels')

// Low visibility (0.6) lower body is rejected even if positions look fine
const low = squat(); for (const i of [23, 24, 25, 26, 27, 28]) { low[i].visibility = 0.6; low[i].presence = 0.6 }
const lowR = evaluatePose(low)
ok(lowR.angles.length === 0, 'visibility 0.60 < 0.65 → lower-body angles dropped (elbow alone is not enough)')

// Hips not visible → knees skipped even if knee landmarks look confident
const noHip = squat(); noHip[23].visibility = 0.2; noHip[24].visibility = 0.2
ok(!evaluatePose(noHip).points.some((i) => i >= 23), 'no reliable hip → no lower-body points')

// Knee inside the torso → pose discarded
const inTorso = squat(); set(inTorso, 25, 0.43, 0.42); set(inTorso, 26, 0.44, 0.42)
ok(!plausiblePose(inTorso) && !evaluatePose(inTorso).ok, 'knee landmark inside torso → whole pose discarded')

// Wildly inconsistent limbs → discarded
const longShin = squat(); set(longShin, 27, 0.6, 0.98); set(longShin, 25, 0.41, 0.58); set(longShin, 26, 0.42, 0.58)
ok(!plausiblePose(longShin), 'shin 10× thigh → pose discarded')

// Missing visibility+presence is treated as unknown, not as visible
ok(!reliable({ x: 0.5, y: 0.5 }), 'landmark with no visibility/presence is not trusted')
ok(!reliable({ x: 0.995, y: 0.5, visibility: 0.99 }), 'landmark on the image edge is not trusted')
ok(evaluatePose(null).angles.length === 0, 'no pose → no angles')

// Label layout: no overlaps, always inside the image
const boxes = layoutLabels([{ x: 100, y: 100, w: 80, h: 20 }, { x: 102, y: 101, w: 80, h: 20 }, { x: 395, y: 2, w: 80, h: 20 }], 400, 300)
const placed = boxes.filter(Boolean) as { x: number; y: number; w: number; h: number }[]
const inside = placed.every((r) => r.x >= 4 && r.y >= 4 && r.x + r.w <= 396 && r.y + r.h <= 296)
let overlap = false
for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
  const a = placed[i], b = placed[j]
  if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap = true
}
ok(placed.length === 3 && inside && !overlap, 'angle labels stay inside the image and never overlap')

console.log(failed ? `\n${failed} pose checks failed` : '\nAll pose checks passed')
process.exit(failed ? 1 : 0)
