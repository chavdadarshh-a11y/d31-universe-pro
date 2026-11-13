import type { PlanItem, Program } from '../types'

/**
 * Program templates. Every number here is a SUGGESTED target range, never a fixed prescription:
 * in the logger the athlete adds/removes sets, changes reps, kg, hold time, RPE and set type freely.
 */
const lo = (target: string) => {
  const n = parseInt(target, 10)
  return Number.isFinite(n) ? n : undefined
}
/** rep-based line: sets × target range (e.g. '6–10', '3–5 / leg', 'max') */
const r = (exId: string, sets: number, target: string, rest = 90, note?: string): PlanItem => ({ exId, sets, reps: lo(target), target, rest, note })
/** timed hold line: sets × target seconds range (e.g. '5–10 s') */
const h = (exId: string, sets: number, target: string, rest = 60, note?: string): PlanItem => ({ exId, sets, secs: lo(target) ?? 20, target, rest, note })

export const PROGRAMS: Program[] = [
  {
    id: 'lever-lab', name: 'D31 Lever Lab', kind: 'skill', level: 'advanced', weeks: 10, daysPerWeek: 3, plan: 'pro', media: 'front-lever', ladder: 'front-lever',
    goal: ['skills', 'strength'], equipment: ['bar'],
    description: 'Front lever built on straight-arm strength. Holds use YOUR current ladder step (tuck → adv. tuck → one-leg → straddle → full) — swap the exercise in the logger whenever you move up.',
    days: [
      { name: 'Lever Strength', items: [h('dead-hang', 2, '20–30 s', 45, 'Warm-up: active shoulders'), r('scap-pull-up', 2, '8–10', 60), h('tuck-front-lever', 5, '5–10 s', 120, 'Use your current lever step. Stop the set when form breaks.'), r('front-lever-raise', 3, '3–6', 120), r('weighted-pull-up', 4, '3–6', 150), h('hollow-hold', 3, '20–40 s', 45)] },
      { name: 'Pull Volume', items: [r('pull-up', 4, '6–10', 120), r('barbell-row', 3, '6–10', 120), r('face-pull', 3, '12–20', 60), r('toes-to-bar', 3, '6–10', 75), h('tuck-front-lever', 4, '5–10 s', 120, 'Current lever step')] },
      { name: 'Lever Density', items: [h('tuck-front-lever', 6, '4–8 s', 90, 'Current lever step, crisp holds only'), r('archer-pull-up', 3, '3–5 / side', 120), r('inverted-row', 3, '8–12', 75), r('dragon-flag-negative', 3, '3–5', 90)] },
    ],
  },
  {
    id: 'nordic-armor', name: 'Nordic Hamstring Armor', kind: 'strength', level: 'intermediate', weeks: 8, daysPerWeek: 2, plan: 'free', media: 'nordic', ladder: 'nordic',
    goal: ['strength', 'skills'], equipment: ['none', 'barbell', 'dumbbell', 'band'],
    description: 'Eccentric-first hamstring work plus single-leg hinging. Start with LOW nordic volume — soreness is high in the first 2 weeks. Add a rep or a slower lowering before adding sets.',
    days: [
      { name: 'Eccentric Day', items: [r('nordic-negative', 3, '3–5', 120, 'Note your lowering time and how deep you control'), r('single-leg-rdl-loaded', 3, '6–8 / leg', 120), r('hip-thrust', 3, '8–12', 90), r('calf-raise', 3, '10–15', 60), h('side-plank', 2, '30–45 s / side', 45)] },
      { name: 'Hinge Day', items: [r('band-nordic', 3, '5–8', 90), r('romanian-deadlift', 3, '6–10', 120), r('bulgarian-split-squat', 3, '8–10 / leg', 90), h('hollow-hold', 3, '20–40 s', 45)] },
    ],
  },
  {
    id: 'unilateral-mastery', name: 'Unilateral Mastery', kind: 'strength', level: 'intermediate', weeks: 6, daysPerWeek: 3, plan: 'pro', media: 'sl-rdl', ladder: 'sl-rdl',
    goal: ['strength', 'muscle'], equipment: ['dumbbell', 'barbell', 'bench'],
    description: 'One side at a time: find and fix left–right gaps. Log each side with a note (L / R) so the app can show the difference.',
    days: [
      { name: 'Hinge Focus', items: [r('b-stance-rdl', 2, '8–10 / leg', 60, 'Warm-up ramp'), r('single-leg-rdl-loaded', 4, '5–8 / leg', 120), r('dumbbell-row', 3, '8–12 / side', 90), r('nordic-negative', 2, '3–5', 120), h('side-plank', 2, '30–45 s / side', 45)] },
      { name: 'Squat Focus', items: [r('bulgarian-split-squat', 4, '6–10 / leg', 120), r('pistol-squat', 3, '3–6 / leg', 120, 'Use a box or counterweight if needed'), r('forward-lunge', 2, '8–12 / leg', 75), r('calf-raise', 3, '10–15 / leg', 60)] },
      { name: 'Total Single-Side', items: [r('single-leg-rdl', 3, '8–12 / leg', 90), r('archer-pull-up', 3, '3–5 / side', 120), r('lateral-raise', 3, '10–15', 60), r('preacher-curl', 3, '8–12', 75)] },
    ],
  },
  {
    id: 'v-taper', name: 'Vertical Pull · V-Taper', kind: 'split', level: 'intermediate', weeks: 8, daysPerWeek: 4, plan: 'pro', media: 'pull-up', ladder: 'pull-up',
    goal: ['muscle', 'strength'], equipment: ['bar', 'dumbbell', 'barbell', 'cable', 'bench'],
    description: 'Wide back, capped shoulders, strong arms. Weighted pull-ups lead the heavy day; machines and curls add the volume.',
    days: [
      { name: 'Pull · Heavy', items: [r('weighted-pull-up', 4, '4–6', 150), r('barbell-row', 3, '6–8', 120), r('lat-pulldown', 3, '8–12', 90), r('face-pull', 3, '12–20', 60), r('preacher-curl', 3, '8–12', 75)] },
      { name: 'Push · Shoulders', items: [r('overhead-press', 4, '5–8', 150), r('dips', 3, '6–12', 90), r('lateral-raise', 4, '12–20', 60), r('triceps-pushdown', 3, '10–15', 60)] },
      { name: 'Pull · Volume', items: [r('pull-up', 4, '6–10', 120), r('chin-up', 3, '6–10', 90), r('dumbbell-row', 3, '8–12 / side', 90), r('hammer-curl', 3, '10–12', 60), r('preacher-curl', 2, '10–15', 60)] },
      { name: 'Legs · Core', items: [r('back-squat', 4, '5–8', 150), r('single-leg-rdl-loaded', 3, '6–8 / leg', 120), r('toes-to-bar', 3, '6–10', 75), r('calf-raise', 3, '10–15', 60)] },
    ],
  },
  {
    id: 'iron-aether', name: 'Iron & Aether', kind: 'split', level: 'advanced', weeks: 8, daysPerWeek: 4, plan: 'gold', media: 'shoot/023',
    goal: ['strength', 'skills', 'muscle'], equipment: ['barbell', 'bar', 'bench', 'dumbbell'],
    description: 'The duality of movement: two “Iron” barbell days and two “Aether” bodyweight-skill days in one week.',
    days: [
      { name: 'Iron · Lower', items: [r('back-squat', 4, '3–6', 180), r('single-leg-rdl-loaded', 3, '6–8 / leg', 120), r('nordic-negative', 3, '3–5', 120), r('calf-raise', 3, '10–15', 60)] },
      { name: 'Aether · Pull', items: [h('tuck-front-lever', 5, '5–10 s', 120, 'Current lever step'), r('weighted-pull-up', 4, '3–6', 150), r('toes-to-bar', 3, '6–10', 75), r('dragon-flag-negative', 3, '3–5', 90)] },
      { name: 'Iron · Upper', items: [r('bench-press', 4, '4–6', 180), r('barbell-row', 4, '6–8', 120), r('overhead-press', 3, '5–8', 150), r('preacher-curl', 3, '8–12', 75)] },
      { name: 'Aether · Push & Flag', items: [h('freestanding-handstand', 6, '5–20 s', 60, 'Best clean hold per attempt'), r('handstand-push-up', 4, '3–6', 120), h('human-flag-progression', 4, '4–10 s / side', 120, 'Current flag step'), r('dips', 3, '8–12', 90)] },
    ],
  },
  {
    id: 'foundation', name: 'D31 Foundation', kind: 'split', level: 'beginner', weeks: 4, daysPerWeek: 3, plan: 'free', media: 'shoot/059',
    goal: ['muscle', 'fatloss', 'strength'], equipment: ['none'],
    description: 'Three full-body sessions a week with zero equipment. Learn the patterns, build the habit. Start at the low end of each range.',
    days: [
      { name: 'Day A · Legs & Push', items: [r('bodyweight-squat', 3, '12–20', 60), r('push-up', 3, '6–15', 75), r('forward-lunge', 3, '8–12 / leg', 60), h('plank', 3, '20–45 s', 45)] },
      { name: 'Day B · Hinge & Pull', items: [r('single-leg-rdl', 3, '8–12 / leg', 60), r('inverted-row', 3, '6–12', 75), r('hip-thrust', 3, '12–20', 60), h('hollow-hold', 3, '15–30 s', 45)] },
      { name: 'Day C · Full Body', items: [r('bodyweight-squat', 3, '15–25', 60), r('pike-push-up', 3, '5–10', 75), r('burpee', 3, '8–12', 60), r('calf-raise', 3, '15–25', 45)] },
    ],
  },
  {
    id: 'mobility-15', name: 'Daily Mobility 15', kind: 'mobility', level: 'beginner', weeks: 4, daysPerWeek: 7, plan: 'free', media: 'shoot/072',
    goal: ['mobility'], equipment: ['none'],
    description: 'Fifteen minutes to undo sitting: hips, spine, hamstrings and quads.',
    days: [
      { name: 'Flow', items: [r('cat-cow', 2, '8–10', 20), r('worlds-greatest-stretch', 2, '4–6 / side', 20), h('deep-squat-hold', 3, '30–60 s', 20), h('couch-stretch', 2, '30–60 s / side', 15)] },
    ],
  },
  {
    id: 'split-mobility', name: 'Split Mobility', kind: 'mobility', level: 'intermediate', weeks: 8, daysPerWeek: 3, plan: 'free', media: 'shoot/034',
    goal: ['mobility', 'skills'], equipment: ['none'],
    description: 'Front and middle split range with blocks and patience. Stretch to strong tension, never sharp pain.',
    days: [
      { name: 'Front Split', items: [r('worlds-greatest-stretch', 2, '4–6 / side', 20), h('couch-stretch', 2, '45–60 s / side', 20), h('front-split', 3, '30–60 s / side', 30, 'Use blocks, hips square')] },
      { name: 'Middle Split', items: [h('deep-squat-hold', 2, '45–60 s', 20), h('middle-split', 4, '30–60 s', 30, 'Knees and toes point up'), r('cat-cow', 2, '8–10', 20)] },
    ],
  },
  {
    id: 'home-burn', name: 'Home Burn 20', kind: 'split', level: 'beginner', weeks: 4, daysPerWeek: 4, plan: 'free', media: 'shoot/089',
    goal: ['fatloss'], equipment: ['none'],
    description: 'Short, sweaty conditioning circuits you can do in a small room.',
    days: [
      { name: 'Circuit 1', items: [h('jump-rope', 4, '30–60 s', 30), r('burpee', 4, '8–12', 45), r('bodyweight-squat', 4, '15–25', 30), h('plank', 3, '30–45 s', 30)] },
      { name: 'Circuit 2', items: [r('forward-lunge', 4, '10–14 / leg', 30), r('push-up', 4, '8–15', 45), h('hollow-hold', 3, '20–30 s', 30), r('calf-raise', 3, '20–30', 30)] },
    ],
  },
  {
    id: 'ppl', name: 'Push · Pull · Legs', kind: 'split', level: 'intermediate', weeks: 8, daysPerWeek: 6, plan: 'pro', media: 'shoot/019',
    goal: ['muscle'], equipment: ['barbell', 'dumbbell', 'bench', 'bar', 'cable'],
    description: 'Classic hypertrophy split, each muscle twice a week. Progress by adding reps inside the range, then load.',
    days: [
      { name: 'Push', items: [r('bench-press', 4, '6–10', 120), r('overhead-press', 3, '6–10', 120), r('dips', 3, '8–12', 90), r('lateral-raise', 3, '12–20', 60), r('skull-crusher', 3, '10–15', 75)] },
      { name: 'Pull', items: [r('pull-up', 4, '6–10', 120), r('barbell-row', 3, '8–10', 90), r('face-pull', 3, '12–20', 60), r('preacher-curl', 3, '8–12', 75), r('hammer-curl', 2, '10–12', 60)] },
      { name: 'Legs', items: [r('back-squat', 4, '5–8', 150), r('romanian-deadlift', 3, '8–10', 120), r('bulgarian-split-squat', 3, '8–10 / leg', 90), r('nordic-negative', 2, '3–5', 120), r('calf-raise', 4, '10–15', 60)] },
    ],
  },
  {
    id: 'upper-lower', name: 'Upper / Lower Strength', kind: 'strength', level: 'intermediate', weeks: 8, daysPerWeek: 4, plan: 'pro', media: 'shoot/064',
    goal: ['strength', 'muscle'], equipment: ['barbell', 'bench', 'bar'],
    description: 'Four days, heavy compounds first. Built for people who want to get genuinely strong.',
    days: [
      { name: 'Upper Heavy', items: [r('bench-press', 4, '3–6', 180), r('weighted-pull-up', 4, '3–6', 150), r('overhead-press', 3, '5–8', 150), r('dumbbell-row', 3, '8–10 / side', 90)] },
      { name: 'Lower Heavy', items: [r('back-squat', 4, '3–6', 180), r('romanian-deadlift', 3, '6–8', 150), r('hip-thrust', 3, '8–10', 90), h('plank', 3, '30–60 s', 60)] },
      { name: 'Upper Volume', items: [r('overhead-press', 4, '8–10', 120), r('chin-up', 4, '6–10', 120), r('dips', 3, '8–12', 90), r('skull-crusher', 3, '10–12', 75)] },
      { name: 'Lower Volume', items: [r('front-squat', 4, '6–8', 150), r('deadlift', 3, '3–5', 180), r('bulgarian-split-squat', 3, '8–10 / leg', 90), r('calf-raise', 4, '10–15', 60)] },
    ],
  },
  {
    id: 'strength-5x5', name: 'Barbell Strength Base', kind: 'strength', level: 'beginner', weeks: 12, daysPerWeek: 3, plan: 'pro', media: 'shoot/057',
    goal: ['strength'], equipment: ['barbell', 'bench'],
    description: 'Low reps, heavy compounds, small load jumps when every working set hits the top of the range.',
    days: [
      { name: 'Workout A', items: [r('back-squat', 4, '3–5', 180), r('bench-press', 4, '3–5', 180), r('barbell-row', 4, '5–8', 120)] },
      { name: 'Workout B', items: [r('back-squat', 4, '3–5', 180), r('overhead-press', 4, '3–5', 180), r('deadlift', 2, '3–5', 180)] },
    ],
  },
  {
    id: 'handstand-path', name: 'Handstand Path', kind: 'skill', level: 'intermediate', weeks: 8, daysPerWeek: 4, plan: 'pro', media: 'shoot/068', ladder: 'handstand',
    goal: ['skills'], equipment: ['none'],
    description: 'Wrist prep, shoulder stack and line work — from wall to first freestanding seconds.',
    days: [
      { name: 'Line & Stack', items: [r('cat-cow', 2, '8–10', 20), h('hollow-hold', 3, '20–40 s', 45), h('chest-to-wall-handstand', 5, '20–45 s', 90), r('pike-push-up', 3, '6–10', 90)] },
      { name: 'Balance & Strength', items: [h('freestanding-handstand', 8, '3–15 s', 45, 'Quality attempts; log best clean hold'), r('handstand-push-up', 3, '2–5', 120), h('l-sit', 4, '10–20 s', 60)] },
    ],
  },
  {
    id: 'dragon-flag-core', name: 'Dragon Flag Core', kind: 'skill', level: 'intermediate', weeks: 6, daysPerWeek: 3, plan: 'pro', ladder: 'dragon-flag',
    goal: ['skills'], equipment: ['bench', 'bar'],
    description: 'Bruce-Lee core. Eccentric-first progressions to a full dragon flag.',
    days: [
      { name: 'Core Lever', items: [h('hollow-hold', 3, '20–40 s', 45), r('tuck-dragon-flag', 3, '6–10', 75), r('dragon-flag-negative', 4, '3–5', 120), r('toes-to-bar', 3, '6–10', 75), r('skull-crusher', 3, '8–12', 75)] },
    ],
  },
  {
    id: 'human-flag-path', name: 'Human Flag Path', kind: 'skill', level: 'advanced', weeks: 12, daysPerWeek: 3, plan: 'gold', media: 'shoot/067', ladder: 'human-flag',
    goal: ['skills'], equipment: ['bar'],
    description: 'Vertical flag → tucked → straddle → full layout. Push the bottom hand, pull the top hand.',
    days: [
      { name: 'Flag Day', items: [h('side-plank', 2, '30–45 s / side', 45), h('vertical-flag', 4, '5–10 s', 90), h('human-flag-progression', 5, '4–8 s / side', 120, 'Current flag step'), r('pull-up', 3, '6–10', 120)] },
      { name: 'Support Strength', items: [r('handstand-push-up', 3, '3–6', 120), r('toes-to-bar', 3, '6–10', 75), h('l-sit', 4, '10–20 s', 60), r('dips', 3, '8–12', 90)] },
    ],
  },
]

export const PROGRAM_BY_ID: Record<string, Program> = Object.fromEntries(PROGRAMS.map((p) => [p.id, p]))
