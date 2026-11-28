/**
 * Guest → account merge. A visitor uses the app without an account (everything in localStorage);
 * when they log in, what they did as a guest is added to the account. Union by id / date, nothing
 * is deleted, and running it twice changes nothing (idempotent). Pure: no store or DOM imports.
 */
type Row = { id: string }
type State = Record<string, unknown>

const byId = <T extends Row>(a: T[] = [], b: T[] = []) => {
  const m = new Map<string, T>()
  for (const x of a) m.set(x.id, x)
  for (const x of b) if (!m.has(x.id)) m.set(x.id, x)
  return [...m.values()]
}
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** Returns the account state with the guest's data added. The account wins on clashes. */
export function mergeGuestState(account: State, guest: State | null | undefined): State {
  if (!guest) return account
  const out: State = { ...account }
  const sessions = byId(arr<Row & { startedAt: string }>(account.sessions), arr<Row & { startedAt: string }>(guest.sessions))
  out.sessions = sessions.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
  const ms = byId(arr<Row & { date: string }>(account.measurements), arr<Row & { date: string }>(guest.measurements))
  out.measurements = ms.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  out.photos = byId(arr<Row>(account.photos), arr<Row>(guest.photos))
  out.foods = byId(arr<Row>(account.foods), arr<Row>(guest.foods))
  out.customWorkouts = byId(arr<Row>(account.customWorkouts), arr<Row>(guest.customWorkouts))
  out.customExercises = byId(arr<Row>(account.customExercises), arr<Row>(guest.customExercises))
  out.analyses = byId(arr<Row>(account.analyses), arr<Row>(guest.analyses)).slice(0, 30)
  const ck = new Map<string, { date: string }>()
  for (const c of arr<{ date: string }>(guest.checkins)) ck.set(c.date, c)
  for (const c of arr<{ date: string }>(account.checkins)) ck.set(c.date, c)
  out.checkins = [...ck.values()].sort((a, b) => b.date.localeCompare(a.date))
  out.doneDays = [...new Set([...arr<string>(account.doneDays), ...arr<string>(guest.doneDays)])].sort()
  const wa = (account.water ?? {}) as Record<string, number>
  const wg = (guest.water ?? {}) as Record<string, number>
  const water: Record<string, number> = { ...wg }
  for (const [k, v] of Object.entries(wa)) water[k] = Math.max(v, water[k] ?? 0)
  out.water = water
  // a guest who set up goal / body / plan before logging in keeps it when the account has none yet
  if (!account.onboarded && guest.onboarded) {
    out.onboarded = true
    if (guest.profile) out.profile = { ...(guest.profile as object), ...(account.profile && (account.profile as { name?: string }).name ? { name: (account.profile as { name?: string }).name } : {}) }
    if (guest.activeProgramId && !account.activeProgramId) out.activeProgramId = guest.activeProgramId
  }
  return out
}
