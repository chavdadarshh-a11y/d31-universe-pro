/**
 * Library → Exercises: which categories are open right now. Everything else is shown blurred with a
 * "Coming soon" label and cannot be opened from the Library list. Your own custom exercises always stay open.
 * This only affects the Library list — workouts, programs, the Add-exercise sheet and Analyze keep working
 * with every exercise, so nobody's saved workouts break.
 *
 * When VIEW_ALL_OPEN is true (src/config/access.ts), every exercise is viewable. LIBRARY_OPEN is kept so
 * the older "only Calisthenics" rule can be restored by flipping that one flag.
 */
import type { Category, Exercise } from '../types'
import { VIEW_ALL_OPEN } from './access'

export const LIBRARY_OPEN: Category[] = ['calisthenics']
export const libLocked = (e: Exercise) => !VIEW_ALL_OPEN && !e.custom && !LIBRARY_OPEN.includes(e.category)
