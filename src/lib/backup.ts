/** JSON backup of YOUR data — always free, it's yours. Restore merges by id (nothing is overwritten blindly). */
import { useApp } from '../store/app'
import { download } from './util'

const KEYS = ['profile', 'sessions', 'measurements', 'foods', 'water', 'checkins', 'customWorkouts', 'customExercises', 'photos', 'programDay', 'activeProgramId', 'restDefault', 'lang'] as const

export function exportBackup() {
  const st = useApp.getState()
  const data: Record<string, unknown> = { app: 'D31.UNIVERSE', format: 1, exportedAt: new Date().toISOString(), account: st.user ? { email: st.user.email, name: st.user.name } : null }
  for (const k of KEYS) data[k] = st[k]
  data.analyses = st.analyses.map(({ thumb: _t, ...a }) => { void _t; return a })
  download(`d31-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2))
}

export async function importBackup(f: File): Promise<{ ok: boolean; sessions?: number; error?: string }> {
  try {
    const d = JSON.parse(await f.text())
    if (d?.app !== 'D31.UNIVERSE' && !Array.isArray(d?.sessions)) return { ok: false, error: 'Not a D31 backup file' }
    const cur = useApp.getState()
    const byId = <T extends { id: string }>(a: T[] = [], b: T[] = []) => [...new Map([...a, ...b].map((x) => [x.id, x])).values()]
    useApp.setState({
      profile: d.profile ?? cur.profile,
      sessions: byId(cur.sessions, d.sessions).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      measurements: byId(cur.measurements, d.measurements).sort((a, b) => a.date.localeCompare(b.date)),
      foods: byId(cur.foods, d.foods),
      customWorkouts: byId(cur.customWorkouts, d.customWorkouts),
      customExercises: byId(cur.customExercises, d.customExercises),
      photos: byId(cur.photos, d.photos),
      water: { ...cur.water, ...(d.water ?? {}) },
      checkins: [...new Map([...cur.checkins, ...(d.checkins ?? [])].map((c) => [c.date, c])).values()],
      onboarded: true,
    })
    return { ok: true, sessions: (d.sessions ?? []).length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
