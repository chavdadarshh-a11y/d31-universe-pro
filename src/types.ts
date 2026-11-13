export type Lang = 'en' | 'hi' | 'gu'
export type PlanId = 'free' | 'pro' | 'platinum'
export type Goal = 'muscle' | 'fatloss' | 'strength' | 'skills' | 'mobility'
export type Level = 'beginner' | 'intermediate' | 'advanced'
export type Equipment = 'none' | 'dumbbell' | 'barbell' | 'bar' | 'band' | 'bench' | 'kettlebell' | 'cable'
export type Category = 'strength' | 'calisthenics' | 'mobility' | 'cardio'
export type D31Layer = 'RANGE' | 'CONTROL' | 'FORCE' | 'EXPRESSION' | 'IDENTITY'

export type MuscleId =
  | 'chest' | 'shoulders' | 'rear_delts' | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques' | 'traps' | 'lats' | 'upper_back' | 'lower_back'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'calves'

export type Exercise = {
  id: string
  name: string
  nameHi: string
  nameGu: string
  category: Category
  equipment: Equipment[]
  level: 1 | 2 | 3
  layer: D31Layer
  tracking: 'reps' | 'time'
  primary: MuscleId[]
  secondary: MuscleId[]
  summary: string
  steps: string[]
  cues: string[]
  mistakes: string[]
  benefits: string[]
  /** Photo of Darshan doing this exercise (public/media/<media>.webp) */
  media?: string
  /** Short looping clip of Darshan doing this exercise (public/media/clips/<clip>.mp4|.webm) */
  clip?: string
  /** Progression ladder this exercise belongs to */
  ladder?: string
  /** User-created exercise (stored on the phone) */
  custom?: boolean
}

/** A template line. Every number is only a SUGGESTION — the logger lets the user add/remove sets and change everything. */
export type PlanItem = { exId: string; sets: number; reps?: number; secs?: number; rest: number; target?: string; note?: string }
export type ProgramDay = { name: string; items: PlanItem[] }
export type Program = {
  id: string
  name: string
  kind: 'split' | 'skill' | 'strength' | 'mobility'
  level: Level
  weeks: number
  daysPerWeek: number
  plan: PlanId
  goal: Goal[]
  equipment: Equipment[]
  description: string
  days: ProgramDay[]
  /** Cover photo (public/media/<media>.webp) */
  media?: string
  /** Skill ladder this program drives */
  ladder?: string
}

export type CustomWorkout = { id: string; name: string; items: PlanItem[]; createdAt: string; note?: string }

export type SetType = 'warmup' | 'working' | 'drop' | 'failure'
export type LoggedSet = { reps: number; kg: number; secs?: number; rpe?: number; note?: string; type?: SetType; done: boolean }
export type LoggedExercise = { exId: string; sets: LoggedSet[]; note?: string }
export type WorkoutSession = {
  id: string
  name: string
  programId?: string
  dayIndex?: number
  startedAt: string
  durationSec: number
  volumeKg: number
  exercises: LoggedExercise[]
  source: 'player' | 'camera'
}

export type Measurement = {
  id: string
  date: string
  weightKg?: number
  waistCm?: number
  chestCm?: number
  armCm?: number
  thighCm?: number
  bodyFat?: number
}

export type ProgressPhoto = { id: string; date: string; dataUrl: string; note?: string }

export type FoodEntry = { id: string; date: string; name: string; kcal: number; protein: number; carbs: number; fat: number }

export type CheckIn = {
  date: string
  sleepH: number
  sleepQ: number
  soreness: number
  energy: number
  stress: number
  score: number
}

export type Profile = {
  name: string
  goal: Goal
  level: Level
  equipment: Equipment[]
  sex: 'male' | 'female'
  age: number
  heightCm: number
  weightKg: number
  activity: 1.2 | 1.375 | 1.55 | 1.725
}

export type AnalysisRecord = {
  id: string
  date: string
  exId?: string
  prompt: string
  sections: Record<string, string>
  raw: string
  demo: boolean
  thumb?: string
}

export type ActiveWorkout = {
  name: string
  programId?: string
  dayIndex?: number
  startedAt: string
  items: PlanItem[]
  log: LoggedExercise[]
  current: number
  /** set while the timer is paused (ISO) */
  pausedAt?: string
  /** total paused time so far, ms */
  pausedMs?: number
  /** last time anything was logged/edited (ISO) — caps the duration of a session left open by mistake */
  lastActivityAt?: string
}
