import type { MuscleId } from '../types'

/**
 * Clean anatomical front/back body map. Muscles are flat, solid-tint regions with a
 * thin outline — no glow, no blur, no gradients. Primary = cyan, secondary = amber.
 */

type Pt = [number, number]

/** Closed Catmull-Rom spline through points → smooth SVG path */
function closed(pts: Pt[], tension = 0.5): string {
  const n = pts.length
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension * 2
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension * 2
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension * 2
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension * 2
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return d + 'Z'
}

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [200 - x, y] as Pt)

/** Full silhouette from a left-half outline (top-centre → crotch), mirrored. */
const TORSO_LEFT: Pt[] = [
  [100, 50], [91, 52], [90, 62], [76, 66], [64, 72], [62, 92], [64, 104], [66, 130], [69, 160], [67, 190],
  [64, 228], [66, 268], [69, 292], [66, 318], [66, 344], [71, 380], [72, 398], [64, 410], [86, 412], [89, 396],
  [88, 352], [90, 304], [92, 268], [96, 232], [100, 216],
]
const torso = (): Pt[] => [...TORSO_LEFT, ...mirror(TORSO_LEFT.slice(1, -1)).reverse()]

const ARM_LEFT: Pt[] = [
  [64, 72], [54, 76], [48, 92], [45, 128], [42, 152], [37, 190], [34, 208], [30, 226], [38, 234], [45, 214],
  [52, 178], [57, 150], [61, 118], [64, 100],
]

type Region = { id: MuscleId; pts: Pt[] }

const FRONT: Region[] = [
  { id: 'traps', pts: [[91, 56], [80, 63], [70, 68], [84, 68], [92, 64]] },
  { id: 'shoulders', pts: [[69, 69], [58, 74], [51, 86], [51, 100], [57, 104], [63, 92], [69, 80]] },
  { id: 'chest', pts: [[98, 72], [82, 70], [70, 80], [67, 96], [76, 107], [90, 108], [98, 102]] },
  { id: 'biceps', pts: [[57, 106], [51, 120], [51, 138], [56, 146], [61, 134], [62, 114]] },
  { id: 'forearms', pts: [[48, 152], [42, 170], [39, 196], [44, 200], [51, 180], [56, 158]] },
  { id: 'abs', pts: [[98.5, 112], [90, 113], [89, 127], [98.5, 128]] },
  { id: 'abs', pts: [[98.5, 131], [89, 131], [88.5, 146], [98.5, 147]] },
  { id: 'abs', pts: [[98.5, 150], [88.5, 150], [88.5, 165], [98.5, 166]] },
  { id: 'abs', pts: [[98.5, 169], [89, 169], [91, 186], [98.5, 196]] },
  { id: 'obliques', pts: [[85, 112], [72, 114], [70, 140], [72, 168], [84, 184], [85, 146]] },
  { id: 'quads', pts: [[70, 204], [66, 236], [69, 270], [76, 288], [88, 286], [93, 262], [93, 230], [86, 212]] },
  { id: 'adductors', pts: [[95, 222], [93, 246], [95, 262], [98, 246], [99, 226]] },
  { id: 'calves', pts: [[70, 312], [68, 336], [72, 368], [77, 352], [78, 322]] },
  { id: 'calves', pts: [[88, 314], [84.5, 330], [85, 352], [88.5, 348], [89.5, 328]] },
]

const BACK: Region[] = [
  { id: 'traps', pts: [[100, 52], [89, 58], [72, 68], [86, 76], [94, 96], [100, 104]] },
  { id: 'rear_delts', pts: [[70, 70], [58, 74], [51, 86], [52, 100], [60, 94], [68, 82]] },
  { id: 'upper_back', pts: [[94, 102], [86, 80], [73, 80], [68, 92], [76, 106], [90, 112]] },
  { id: 'lats', pts: [[69, 98], [68, 122], [74, 150], [86, 164], [95, 150], [92, 124], [80, 112]] },
  { id: 'triceps', pts: [[56, 102], [51, 118], [52, 140], [58, 147], [62, 128], [62, 108]] },
  { id: 'forearms', pts: [[48, 152], [42, 170], [39, 196], [44, 200], [51, 180], [56, 158]] },
  { id: 'lower_back', pts: [[98, 156], [91, 162], [88, 184], [98, 192]] },
  { id: 'glutes', pts: [[98, 194], [82, 190], [69, 202], [69, 222], [82, 234], [98, 230]] },
  { id: 'hamstrings', pts: [[70, 234], [67, 262], [71, 288], [85, 292], [93, 268], [94, 240], [84, 238]] },
  { id: 'calves', pts: [[70, 304], [66, 326], [70, 350], [78, 358], [86, 342], [86, 312], [78, 302]] },
]

export const FRONT_IDS = new Set(FRONT.map((r) => r.id))
export const BACK_IDS = new Set(BACK.map((r) => r.id))

const COLORS = {
  body: '#141922',
  bodyStroke: '#2c3545',
  muscle: '#202836',
  muscleStroke: '#344055',
  primary: '#22d3ee',
  secondary: '#f5b942',
}

function Figure({ regions, primary, secondary, label, showLabel, viewBox = '0 0 200 430' }: { regions: Region[]; primary: Set<MuscleId>; secondary: Set<MuscleId>; label: string; showLabel: boolean; viewBox?: string }) {
  const fill = (id: MuscleId) => (primary.has(id) ? COLORS.primary : secondary.has(id) ? COLORS.secondary : COLORS.muscle)
  const op = (id: MuscleId) => (primary.has(id) ? 0.92 : secondary.has(id) ? 0.7 : 1)
  return (
    <svg viewBox={viewBox} className="h-full w-full" role="img" aria-label={label}>
      <ellipse cx="100" cy="30" rx="15" ry="19" fill={COLORS.body} stroke={COLORS.bodyStroke} strokeWidth="1" />
      <path d={closed(torso(), 0.45)} fill={COLORS.body} stroke={COLORS.bodyStroke} strokeWidth="1" />
      <path d={closed(ARM_LEFT, 0.45)} fill={COLORS.body} stroke={COLORS.bodyStroke} strokeWidth="1" />
      <path d={closed(mirror(ARM_LEFT), 0.45)} fill={COLORS.body} stroke={COLORS.bodyStroke} strokeWidth="1" />
      {regions.map((r, i) => (
        <g key={r.id + i}>
          <path d={closed(r.pts)} fill={fill(r.id)} fillOpacity={op(r.id)} stroke={COLORS.muscleStroke} strokeWidth="0.8" strokeLinejoin="round">
            
          </path>
          <path d={closed(mirror(r.pts))} fill={fill(r.id)} fillOpacity={op(r.id)} stroke={COLORS.muscleStroke} strokeWidth="0.8" strokeLinejoin="round" />
        </g>
      ))}
      {showLabel && (
        <text x="100" y="427" textAnchor="middle" fontSize="11" fill="#7d8799" fontFamily="JetBrains Mono, monospace" letterSpacing="2">
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  )
}

export function BodyMap({
  primary, secondary, frontLabel = 'Front', backLabel = 'Back', compact = false, className = '',
}: { primary: MuscleId[]; secondary: MuscleId[]; frontLabel?: string; backLabel?: string; compact?: boolean; className?: string }) {
  const p = new Set(primary)
  const s = new Set(secondary.filter((m) => !p.has(m)))
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <div className={compact ? 'h-24' : 'h-64'}>
        <Figure regions={FRONT} primary={p} secondary={s} label={frontLabel} showLabel={!compact} />
      </div>
      <div className={compact ? 'h-24' : 'h-64'}>
        <Figure regions={BACK} primary={p} secondary={s} label={backLabel} showLabel={!compact} />
      </div>
    </div>
  )
}

/** Single figure, for list thumbnails. */
export function BodyThumb({ primary, secondary, view }: { primary: MuscleId[]; secondary: MuscleId[]; view: 'front' | 'back' }) {
  const p = new Set(primary)
  const s = new Set(secondary.filter((m) => !p.has(m)))
  return <Figure regions={view === 'front' ? FRONT : BACK} primary={p} secondary={s} label={view} showLabel={false} viewBox="26 6 148 412" />
}

export const MUSCLE_COLORS = COLORS
