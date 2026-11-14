/** Fine-muscle roles per exercise (TYPICAL textbook role — never a measurement). Pure. */
import ANAT from '../data/analysis/anatomy.json'
import type { Lang } from '../types'
import { exerciseSetup, l3, musclesFor } from './formCheck'
import { COARSE_TO_FINE, type Fine, type Role } from './muscleAnatomy'

type L3 = { en: string; hi: string; gu: string }
const NAMES = ANAT.names as Record<Fine, L3>
const WORDS = ANAT.roleWords as Record<Role, L3>
const BY_EX = ANAT.byExercise as Record<string, Record<Role, Fine[]>>
const STAB = ANAT.profileStabilizers as Record<string, Fine[]>
type VarGroup = { appliesTo: string[] } & Partial<Record<string, Record<Role, Fine[]>>>
const VARIANTS = Object.entries(ANAT.variants as unknown as Record<string, VarGroup | string>).filter(([k]) => k !== '_doc').map(([, v]) => v as VarGroup)

export const ROLE_ORDER: Role[] = ['primary', 'secondary', 'stabilizer']
export const fineName = (id: Fine, lang: Lang) => l3(NAMES[id], lang)
export const roleWord = (r: Role, lang: Lang) => l3(WORDS[r], lang)

/** primary > secondary > stabilizer; a muscle gets only its highest role */
export function rolesFor(exId?: string, grip?: string): Partial<Record<Fine, Role>> {
  const out: Partial<Record<Fine, Role>> = {}
  if (!exId) return out
  const set = (ids: Fine[], r: Role) => { for (const id of ids) if (!out[id]) out[id] = r }
  const vg = grip ? VARIANTS.find((g) => g.appliesTo.includes(exId) && g[grip]) : undefined
  const fixed = (vg?.[grip!] as Record<Role, Fine[]> | undefined) ?? BY_EX[exId]
  if (fixed) { for (const r of ROLE_ORDER) set(fixed[r] ?? [], r); return out }
  const m = musclesFor(exId)
  set(m.primary.flatMap((c) => COARSE_TO_FINE[c] ?? []), 'primary')
  set(m.secondary.flatMap((c) => COARSE_TO_FINE[c] ?? []), 'secondary')
  set(STAB[exerciseSetup(exId).profileId] ?? [], 'stabilizer')
  return out
}

export function rolesList(roles: Partial<Record<Fine, Role>>): { id: Fine; role: Role }[] {
  return (Object.entries(roles) as [Fine, Role][]).map(([id, role]) => ({ id, role })).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
}
