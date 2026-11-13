import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ActiveWorkout, AnalysisRecord, CheckIn, CustomWorkout, Exercise, FoodEntry, Lang, Measurement, PlanId,
  Profile, ProgressPhoto, WorkoutSession,
} from '../types'
import { dayKey, uid } from '../lib/util'

export type Membership = { plan: PlanId; until?: string; source: 'none' | 'razorpay' | 'launch_offer' | 'trial' | 'demo' }

export type AppState = {
  onboarded: boolean
  lang: Lang
  profile: Profile
  voice: boolean
  restDefault: number
  activeProgramId?: string
  programDay: Record<string, number>
  customWorkouts: CustomWorkout[]
  customExercises: Exercise[]
  sessions: WorkoutSession[]
  measurements: Measurement[]
  photos: ProgressPhoto[]
  foods: FoodEntry[]
  water: Record<string, number>
  checkins: CheckIn[]
  analyses: AnalysisRecord[]
  active: ActiveWorkout | null
  membership: Membership
  launchClaimed: boolean
  trialUsed: boolean
  user: { id: string; email: string } | null
  toast: string | null

  set: (p: Partial<AppState>) => void
  setLang: (l: Lang) => void
  setProfile: (p: Partial<Profile>) => void
  completeOnboarding: () => void
  addSession: (s: WorkoutSession) => void
  deleteSession: (id: string) => void
  addMeasurement: (m: Omit<Measurement, 'id'>) => Measurement
  deleteMeasurement: (id: string) => void
  addPhoto: (p: Omit<ProgressPhoto, 'id'>) => ProgressPhoto
  deletePhoto: (id: string) => void
  addFood: (f: Omit<FoodEntry, 'id'>) => FoodEntry
  deleteFood: (id: string) => void
  addWater: (delta: number) => void
  saveCheckin: (c: CheckIn) => void
  addAnalysis: (a: AnalysisRecord) => void
  saveCustom: (w: CustomWorkout) => void
  deleteCustom: (id: string) => void
  saveCustomExercise: (e: Exercise) => void
  deleteCustomExercise: (id: string) => void
  showToast: (msg: string) => void
  resetAll: () => void
}

const defaultProfile: Profile = {
  name: '', goal: 'muscle', level: 'beginner', equipment: ['none'], sex: 'male', age: 25, heightCm: 172, weightKg: 70, activity: 1.375,
}

const initial = {
  onboarded: false,
  lang: 'en' as Lang,
  profile: defaultProfile,
  voice: true,
  restDefault: 90,
  activeProgramId: undefined,
  programDay: {},
  customWorkouts: [],
  customExercises: [] as Exercise[],
  sessions: [],
  measurements: [],
  photos: [],
  foods: [],
  water: {},
  checkins: [],
  analyses: [],
  active: null,
  membership: { plan: 'free' as PlanId, source: 'none' as const },
  launchClaimed: false,
  trialUsed: false,
  user: null,
  toast: null,
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...initial,
      set: (p) => set(p),
      setLang: (lang) => {
        document.documentElement.lang = lang
        set({ lang })
      },
      setProfile: (p) => set({ profile: { ...get().profile, ...p } }),
      completeOnboarding: () => set({ onboarded: true }),
      addSession: (s) => set({ sessions: [s, ...get().sessions] }),
      deleteSession: (id) => set({ sessions: get().sessions.filter((s) => s.id !== id) }),
      addMeasurement: (m) => {
        const row = { ...m, id: uid() }
        set({ measurements: [...get().measurements, row].sort((a, b) => a.date.localeCompare(b.date)) })
        return row
      },
      deleteMeasurement: (id) => set({ measurements: get().measurements.filter((m) => m.id !== id) }),
      addPhoto: (p) => {
        const row = { ...p, id: uid() }
        set({ photos: [row, ...get().photos] })
        return row
      },
      deletePhoto: (id) => set({ photos: get().photos.filter((p) => p.id !== id) }),
      addFood: (f) => {
        const row = { ...f, id: uid() }
        set({ foods: [row, ...get().foods] })
        return row
      },
      deleteFood: (id) => set({ foods: get().foods.filter((f) => f.id !== id) }),
      addWater: (delta) => {
        const k = dayKey()
        const w = { ...get().water }
        w[k] = Math.max(0, (w[k] ?? 0) + delta)
        set({ water: w })
      },
      saveCheckin: (c) => set({ checkins: [c, ...get().checkins.filter((x) => x.date !== c.date)] }),
      addAnalysis: (a) => set({ analyses: [a, ...get().analyses].slice(0, 30) }),
      saveCustom: (w) => set({ customWorkouts: [w, ...get().customWorkouts.filter((x) => x.id !== w.id)] }),
      deleteCustom: (id) => set({ customWorkouts: get().customWorkouts.filter((x) => x.id !== id) }),
      saveCustomExercise: (e) => set({ customExercises: [{ ...e, custom: true }, ...get().customExercises.filter((x) => x.id !== e.id)] }),
      deleteCustomExercise: (id) => set({ customExercises: get().customExercises.filter((x) => x.id !== id) }),
      showToast: (msg) => {
        if (toastTimer) clearTimeout(toastTimer)
        set({ toast: msg })
        toastTimer = setTimeout(() => set({ toast: null }), 2600)
      },
      resetAll: () => set({ ...initial, onboarded: get().onboarded, lang: get().lang, profile: get().profile, user: get().user }),
    }),
    {
      name: 'd31-pro-v1',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // v1/v2 → v3: sets gain a type; custom exercises list added. Nothing is deleted.
      migrate: (persisted, version) => {
        const st = (persisted ?? {}) as Partial<AppState>
        if (version < 3) {
          st.customExercises = st.customExercises ?? []
          const fix = <T extends { exercises?: { sets: { type?: string }[] }[] }>(x: T) => {
            x.exercises?.forEach((e) => e.sets.forEach((set) => { set.type = set.type ?? 'working' }))
            return x
          }
          st.sessions = (st.sessions ?? []).map(fix)
          if (st.active) st.active.log.forEach((l) => l.sets.forEach((set) => { set.type = set.type ?? 'working' }))
        }
        return st as AppState
      },
      partialize: (s) => {
        const { toast: _t, set: _s, ...rest } = s
        void _t
        void _s
        return rest as unknown as AppState
      },
    },
  ),
)

/** Effective plan honouring expiry */
export function effectivePlan(m: Membership): PlanId {
  if (m.plan === 'free') return 'free'
  if (m.until && new Date(m.until).getTime() < Date.now()) return 'free'
  return m.plan
}
