import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ActiveWorkout, AnalysisRecord, CheckIn, CustomWorkout, Exercise, FoodEntry, Lang, Measurement, PlanId,
  Profile, ProgressPhoto, WorkoutSession,
} from '../types'
import { dayKey, uid } from '../lib/util'
import { dataKey } from '../lib/accountKeys'
import { normalizePlan, passStatus } from '../lib/plans'

export type Membership = { plan: PlanId; until?: string; source: 'none' | 'razorpay' | 'launch_offer' | 'trial' | 'demo' }

export type AccountUser = { id: string; email: string; name?: string; avatar?: string; provider?: 'local' | 'supabase' }

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
  /** When this account's one free Platinum trial started (ISO). */
  trialStartedAt?: string
  /** Signed-in account (local on-device account in demo mode, Supabase user when live). */
  user: AccountUser | null
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

export const STORE_VERSION = 5
/** A brand-new account's data (what gets written for a fresh account before it is loaded). */
export function blankPersisted(extra: Partial<AppState> = {}) {
  const { toast: _t, ...rest } = initial
  void _t
  return { state: { ...rest, ...extra }, version: STORE_VERSION }
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
  trialStartedAt: undefined as string | undefined,
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
      version: STORE_VERSION,
      // one blob per account: the key is resolved at call time from the current session
      storage: createJSONStorage(() => ({
        getItem: () => localStorage.getItem(dataKey()),
        setItem: (_n: string, v: string) => localStorage.setItem(dataKey(), v),
        removeItem: () => localStorage.removeItem(dataKey()),
      })),
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
        // v5: the old fake "DEMO SAMPLE" analyses are removed
        st.analyses = (st.analyses ?? []).filter((a) => !a.demo)
        // v4: tiers are free / pro / platinum
        if (st.membership) st.membership = { ...st.membership, plan: normalizePlan(st.membership.plan as string) }
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
/** Tier in force now (a pass in its grace period still counts — see config/plans.ts GRACE_RULES). */
export function effectivePlan(m: Membership): PlanId {
  return passStatus(m).plan
}
