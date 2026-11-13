import type { PlanItem, Program } from '../types'

const r = (exId: string, sets: number, reps: number, rest = 90): PlanItem => ({ exId, sets, reps, rest })
const t = (exId: string, sets: number, secs: number, rest = 60): PlanItem => ({ exId, sets, secs, rest })

export const PROGRAMS: Program[] = [
  {
    id: 'foundation', name: 'D31 Foundation', kind: 'split', level: 'beginner', weeks: 4, daysPerWeek: 3, plan: 'free',
    goal: ['muscle', 'fatloss', 'strength'], equipment: ['none'],
    description: 'Three full-body sessions a week with zero equipment. Learn the patterns, build the habit.',
    days: [
      { name: 'Day A · Legs & Push', items: [r('bodyweight-squat', 3, 15, 60), r('push-up', 3, 10, 75), r('forward-lunge', 3, 10, 60), t('plank', 3, 30, 45)] },
      { name: 'Day B · Hinge & Pull', items: [r('single-leg-rdl', 3, 8, 60), r('inverted-row', 3, 10, 75), r('hip-thrust', 3, 15, 60), t('hollow-hold', 3, 20, 45)] },
      { name: 'Day C · Full Body', items: [r('bodyweight-squat', 3, 20, 60), r('pike-push-up', 3, 8, 75), r('burpee', 3, 10, 60), r('calf-raise', 3, 20, 45)] },
    ],
  },
  {
    id: 'mobility-15', name: 'Daily Mobility 15', kind: 'mobility', level: 'beginner', weeks: 4, daysPerWeek: 7, plan: 'free',
    goal: ['mobility'], equipment: ['none'],
    description: 'Fifteen minutes to undo sitting: hips, spine, hamstrings and quads.',
    days: [
      { name: 'Flow', items: [r('cat-cow', 2, 10, 20), r('worlds-greatest-stretch', 2, 5, 20), t('deep-squat-hold', 3, 45, 20), t('couch-stretch', 2, 45, 15)] },
    ],
  },
  {
    id: 'home-burn', name: 'Home Burn 20', kind: 'split', level: 'beginner', weeks: 4, daysPerWeek: 4, plan: 'free',
    goal: ['fatloss'], equipment: ['none'],
    description: 'Short, sweaty conditioning circuits you can do in a small room.',
    days: [
      { name: 'Circuit 1', items: [t('jump-rope', 4, 45, 30), r('burpee', 4, 10, 45), r('bodyweight-squat', 4, 20, 30), t('plank', 3, 40, 30)] },
      { name: 'Circuit 2', items: [r('forward-lunge', 4, 12, 30), r('push-up', 4, 12, 45), t('hollow-hold', 3, 25, 30), r('calf-raise', 3, 25, 30)] },
    ],
  },
  {
    id: 'ppl', name: 'Push · Pull · Legs', kind: 'split', level: 'intermediate', weeks: 8, daysPerWeek: 6, plan: 'pro',
    goal: ['muscle'], equipment: ['barbell', 'dumbbell', 'bench', 'bar'],
    description: 'Classic hypertrophy split. Each muscle twice a week with progressive overload.',
    days: [
      { name: 'Push', items: [r('bench-press', 4, 8, 120), r('overhead-press', 3, 8, 120), r('dips', 3, 10, 90), r('skull-crusher', 3, 12, 75)] },
      { name: 'Pull', items: [r('pull-up', 4, 8, 120), r('dumbbell-row', 3, 10, 90), r('chin-up', 3, 8, 90), r('hanging-leg-raise', 3, 12, 60)] },
      { name: 'Legs', items: [r('back-squat', 4, 6, 150), r('romanian-deadlift', 3, 10, 120), r('bulgarian-split-squat', 3, 10, 90), r('calf-raise', 4, 15, 60)] },
    ],
  },
  {
    id: 'upper-lower', name: 'Upper / Lower Strength', kind: 'strength', level: 'intermediate', weeks: 8, daysPerWeek: 4, plan: 'pro',
    goal: ['strength', 'muscle'], equipment: ['barbell', 'bench', 'bar'],
    description: 'Four days, heavy compounds first. Built for people who want to get genuinely strong.',
    days: [
      { name: 'Upper Heavy', items: [r('bench-press', 5, 5, 180), r('pull-up', 4, 6, 150), r('overhead-press', 3, 6, 150), r('dumbbell-row', 3, 10, 90)] },
      { name: 'Lower Heavy', items: [r('back-squat', 5, 5, 180), r('romanian-deadlift', 3, 8, 150), r('hip-thrust', 3, 10, 90), t('plank', 3, 45, 60)] },
      { name: 'Upper Volume', items: [r('overhead-press', 4, 10, 120), r('chin-up', 4, 8, 120), r('dips', 3, 12, 90), r('skull-crusher', 3, 12, 75)] },
      { name: 'Lower Volume', items: [r('front-squat', 4, 8, 150), r('deadlift', 3, 5, 180), r('bulgarian-split-squat', 3, 10, 90), r('calf-raise', 4, 15, 60)] },
    ],
  },
  {
    id: 'strength-5x5', name: 'Barbell 5×5', kind: 'strength', level: 'beginner', weeks: 12, daysPerWeek: 3, plan: 'pro',
    goal: ['strength'], equipment: ['barbell', 'bench'],
    description: 'Add a little weight every session. The simplest proven way to build raw strength.',
    days: [
      { name: 'Workout A', items: [r('back-squat', 5, 5, 180), r('bench-press', 5, 5, 180), r('dumbbell-row', 5, 5, 120)] },
      { name: 'Workout B', items: [r('back-squat', 5, 5, 180), r('overhead-press', 5, 5, 180), r('deadlift', 1, 5, 180)] },
    ],
  },
  {
    id: 'handstand-path', name: 'Handstand Path', kind: 'skill', level: 'intermediate', weeks: 8, daysPerWeek: 4, plan: 'pro',
    goal: ['skills'], equipment: ['none'],
    description: 'Wrist prep, shoulder stack and line work — from wall to first freestanding seconds.',
    days: [
      { name: 'Line & Stack', items: [r('cat-cow', 2, 10, 20), t('hollow-hold', 3, 30, 45), t('wall-handstand', 5, 30, 90), r('pike-push-up', 3, 8, 90)] },
      { name: 'Strength', items: [r('pike-push-up', 4, 10, 90), r('push-up', 3, 15, 60), t('l-sit', 4, 15, 60), t('wall-handstand', 4, 40, 90)] },
    ],
  },
  {
    id: 'front-lever-path', name: 'Front Lever Path', kind: 'skill', level: 'advanced', weeks: 10, daysPerWeek: 3, plan: 'pro',
    goal: ['skills', 'strength'], equipment: ['bar'],
    description: 'Straight-arm pulling strength, from tuck to advanced tuck and beyond.',
    days: [
      { name: 'Lever Day', items: [t('hollow-hold', 3, 30, 45), t('tuck-front-lever', 5, 10, 120), r('pull-up', 4, 6, 120), r('hanging-leg-raise', 3, 10, 60)] },
      { name: 'Pull Strength', items: [r('pull-up', 5, 5, 150), r('inverted-row', 3, 12, 75), r('dragon-flag', 3, 5, 90), t('tuck-front-lever', 4, 12, 120)] },
    ],
  },
  {
    id: 'dragon-flag-core', name: 'Dragon Flag Core', kind: 'skill', level: 'intermediate', weeks: 6, daysPerWeek: 3, plan: 'pro',
    goal: ['skills'], equipment: ['bench', 'bar'],
    description: 'Bruce-Lee core. Eccentric-first progressions to a full dragon flag.',
    days: [
      { name: 'Core Lever', items: [t('hollow-hold', 4, 30, 45), r('hanging-leg-raise', 3, 10, 60), r('dragon-flag', 4, 4, 120), t('plank', 3, 60, 45)] },
    ],
  },
  {
    id: 'human-flag-path', name: 'Human Flag Path', kind: 'skill', level: 'advanced', weeks: 12, daysPerWeek: 3, plan: 'premium',
    goal: ['skills'], equipment: ['bar'],
    description: 'Oblique, shoulder and grip work to build the most iconic calisthenics hold.',
    days: [
      { name: 'Flag Day', items: [t('plank', 3, 45, 45), t('human-flag-progression', 6, 8, 120), r('pike-push-up', 3, 10, 90), r('pull-up', 3, 8, 120)] },
      { name: 'Support Strength', items: [r('overhead-press', 4, 8, 120), r('hanging-leg-raise', 4, 10, 60), t('l-sit', 4, 15, 60), r('dips', 3, 10, 90)] },
    ],
  },
]

export const PROGRAM_BY_ID: Record<string, Program> = Object.fromEntries(PROGRAMS.map((p) => [p.id, p]))
