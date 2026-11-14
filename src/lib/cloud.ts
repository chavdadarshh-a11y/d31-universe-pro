/**
 * Cloud sync with Supabase. Local-first: the app always writes to the local
 * store, and when a user is signed in each write is mirrored to Supabase
 * (row-level security limits every row to its owner).
 */
import { supabase } from './supabase'
import { SESSION_ENDED } from './accountKeys'
import { normalizePlan } from './plans'
import { useApp, type Membership } from '../store/app'
import type { CheckIn, CustomWorkout, FoodEntry, Measurement, PlanId, ProgressPhoto, WorkoutSession } from '../types'

const uidOf = () => useApp.getState().user?.id

function warn(where: string, e: unknown) {
  console.warn(`[cloud] ${where}:`, e instanceof Error ? e.message : e)
}

async function upsert(table: string, row: Record<string, unknown>) {
  const userId = uidOf()
  if (!supabase || !userId) return
  const { error } = await supabase.from(table).upsert({ ...row, user_id: userId })
  if (error) warn(`upsert ${table}`, error.message)
}

async function remove(table: string, id: string) {
  if (!supabase || !uidOf()) return
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) warn(`delete ${table}`, error.message)
}

export const cloud = {
  session: (s: WorkoutSession) =>
    upsert('workouts', {
      id: s.id, name: s.name, program_id: s.programId ?? null, day_index: s.dayIndex ?? null, started_at: s.startedAt,
      duration_sec: s.durationSec, volume_kg: s.volumeKg, exercises: s.exercises, source: s.source,
    }),
  deleteSession: (id: string) => remove('workouts', id),
  measurement: (m: Measurement) =>
    upsert('body_measurements', {
      id: m.id, date: m.date, weight_kg: m.weightKg ?? null, waist_cm: m.waistCm ?? null, chest_cm: m.chestCm ?? null,
      arm_cm: m.armCm ?? null, thigh_cm: m.thighCm ?? null, body_fat: m.bodyFat ?? null,
    }),
  deleteMeasurement: (id: string) => remove('body_measurements', id),
  food: (f: FoodEntry) =>
    upsert('nutrition_logs', { id: f.id, date: f.date, name: f.name, kcal: f.kcal, protein_g: f.protein, carbs_g: f.carbs, fat_g: f.fat }),
  deleteFood: (id: string) => remove('nutrition_logs', id),
  checkin: async (c: CheckIn) => {
    const userId = uidOf()
    if (!supabase || !userId) return
    const { error } = await supabase.from('recovery_checkins').upsert(
      { user_id: userId, date: c.date, sleep_h: c.sleepH, sleep_q: c.sleepQ, soreness: c.soreness, energy: c.energy, stress: c.stress, score: c.score },
      { onConflict: 'user_id,date' },
    )
    if (error) warn('checkin', error.message)
  },
  custom: (w: CustomWorkout) => upsert('custom_workouts', { id: w.id, name: w.name, items: w.items, created_at: w.createdAt }),
  deleteCustom: (id: string) => remove('custom_workouts', id),
  profile: async () => {
    const st = useApp.getState()
    if (!supabase || !st.user) return
    const p = st.profile
    const { error } = await supabase.from('profiles').upsert({
      id: st.user.id, name: p.name, goal: p.goal, level: p.level, equipment: p.equipment, sex: p.sex, age: p.age,
      height_cm: p.heightCm, weight_kg: p.weightKg, activity: p.activity, lang: st.lang,
    })
    if (error) warn('profile', error.message)
  },
  photo: async (p: ProgressPhoto) => {
    const userId = uidOf()
    if (!supabase || !userId) return
    try {
      const blob = await (await fetch(p.dataUrl)).blob()
      const path = `${userId}/${p.id}.jpg`
      const up = await supabase.storage.from('progress-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (up.error) throw up.error
      await upsert('progress_photos', { id: p.id, path, taken_at: p.date, note: p.note ?? null })
    } catch (e) {
      warn('photo', e)
    }
  },
  deletePhoto: async (id: string) => {
    const userId = uidOf()
    if (!supabase || !userId) return
    await supabase.storage.from('progress-photos').remove([`${userId}/${id}.jpg`])
    await remove('progress_photos', id)
  },
}

/** Pull the signed-in user's rows and merge into the local store (cloud wins on id clash). */
export async function pullAll() {
  const st = useApp.getState()
  if (!supabase || !st.user) return
  try {
    const [w, m, f, c, cw] = await Promise.all([
      supabase.from('workouts').select('*').order('started_at', { ascending: false }).limit(500),
      supabase.from('body_measurements').select('*').order('date'),
      supabase.from('nutrition_logs').select('*').order('date', { ascending: false }).limit(500),
      supabase.from('recovery_checkins').select('*').order('date', { ascending: false }).limit(60),
      supabase.from('custom_workouts').select('*'),
    ])
    const merge = <T extends { id: string }>(local: T[], remote: T[]) => {
      const map = new Map(local.map((x) => [x.id, x]))
      for (const r of remote) map.set(r.id, r)
      return [...map.values()]
    }
    const sessions: WorkoutSession[] = (w.data ?? []).map((r) => ({
      id: r.id, name: r.name, programId: r.program_id ?? undefined, dayIndex: r.day_index ?? undefined, startedAt: r.started_at,
      durationSec: r.duration_sec, volumeKg: Number(r.volume_kg), exercises: r.exercises ?? [], source: r.source ?? 'player',
    }))
    const measurements: Measurement[] = (m.data ?? []).map((r) => ({
      id: r.id, date: r.date, weightKg: r.weight_kg ?? undefined, waistCm: r.waist_cm ?? undefined, chestCm: r.chest_cm ?? undefined,
      armCm: r.arm_cm ?? undefined, thighCm: r.thigh_cm ?? undefined, bodyFat: r.body_fat ?? undefined,
    }))
    const foods: FoodEntry[] = (f.data ?? []).map((r) => ({
      id: r.id, date: r.date, name: r.name, kcal: r.kcal, protein: Number(r.protein_g), carbs: Number(r.carbs_g), fat: Number(r.fat_g),
    }))
    const checkins: CheckIn[] = (c.data ?? []).map((r) => ({
      date: r.date, sleepH: Number(r.sleep_h), sleepQ: r.sleep_q, soreness: r.soreness, energy: r.energy, stress: r.stress, score: r.score,
    }))
    const customs: CustomWorkout[] = (cw.data ?? []).map((r) => ({ id: r.id, name: r.name, items: r.items, createdAt: r.created_at }))
    const cur = useApp.getState()
    const checkMap = new Map(cur.checkins.map((x) => [x.date, x]))
    for (const r of checkins) checkMap.set(r.date, r)
    useApp.setState({
      sessions: merge(cur.sessions, sessions).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      measurements: merge(cur.measurements, measurements).sort((a, b) => a.date.localeCompare(b.date)),
      foods: merge(cur.foods, foods),
      checkins: [...checkMap.values()].sort((a, b) => b.date.localeCompare(a.date)),
      customWorkouts: merge(cur.customWorkouts, customs),
    })
    // push local-only rows created while signed out
    const remoteIds = new Set(sessions.map((s) => s.id))
    for (const s of cur.sessions) if (!remoteIds.has(s.id)) void cloud.session(s)
    const remoteM = new Set(measurements.map((x) => x.id))
    for (const x of cur.measurements) if (!remoteM.has(x.id)) void cloud.measurement(x)
  } catch (e) {
    warn('pullAll', e)
  }
}

export async function refreshMembership(): Promise<Membership | null> {
  const st = useApp.getState()
  if (!supabase || !st.user) return null
  const { data, error } = await supabase.from('subscriptions').select('plan,status,current_period_end,source').eq('user_id', st.user.id).maybeSingle()
  if (error) {
    warn('membership', error.message)
    return null
  }
  const m: Membership = data && data.status === 'active'
    ? { plan: normalizePlan(data.plan) as PlanId, until: data.current_period_end ?? undefined, source: data.source }
    : { plan: 'free', source: 'none' }
  const tr = await supabase.from('user_trials').select('started_at').eq('user_id', st.user.id).maybeSingle()
  useApp.setState({ membership: m, launchClaimed: data?.source === 'launch_offer' || st.launchClaimed, ...(tr.data?.started_at ? { trialStartedAt: tr.data.started_at as string, trialUsed: true } : {}) })
  return m
}

export async function launchSpotsLeft(): Promise<number | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('launch_spots_left')
  if (error) {
    warn('launch_spots_left', error.message)
    return null
  }
  return typeof data === 'number' ? data : null
}

export async function claimOffer(kind: 'launch' | 'trial'): Promise<{ ok: boolean; reason?: string }> {
  if (!supabase) return { ok: false, reason: 'not_configured' }
  const { data, error } = await supabase.rpc(kind === 'launch' ? 'claim_launch_offer' : 'start_trial')
  if (error) return { ok: false, reason: error.message }
  const res = data as { ok: boolean; reason?: string }
  if (res?.ok) await refreshMembership()
  return res ?? { ok: false }
}

export async function initAuth() {
  if (!supabase) return
  const { adoptSupabaseUser } = await import('./accounts')
  const apply = async (user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) => {
    const prev = useApp.getState().user
    await adoptSupabaseUser(user)
    if (user && prev?.id !== user.id) {
      await cloud.profile()
      await Promise.all([pullAll(), refreshMembership()])
      const { startTrialIfNew } = await import('./trial')
      await startTrialIfNew() // server allows it once per account
      const { useUnlocks } = await import('./unlocks')
      await useUnlocks.getState().refresh()
      const { usePostPasses } = await import('./postPasses')
      await usePostPasses.getState().refresh()
    }
  }
  // "Remember me" was off and the app was closed → end the cloud session too
  try {
    if (localStorage.getItem('d31-remember') === '0' && SESSION_ENDED.local) await supabase.auth.signOut()
  } catch { /* ignore */ }
  const { data } = await supabase.auth.getSession()
  await apply(data.session?.user ?? null)
  supabase.auth.onAuthStateChange((_e, session) => {
    void apply(session?.user ?? null)
  })
}
