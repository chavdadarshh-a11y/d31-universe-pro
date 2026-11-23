/**
 * Library → Exercises: which categories are open right now. Everything else is shown blurred with a
 * "Coming soon" label and cannot be opened from the Library list. Your own custom exercises always stay open.
 * This only affects the Library list — workouts, programs, the Add-exercise sheet and Analyze keep working
 * with every exercise, so nobody's saved workouts break.
 */
import type { Category, Exercise } from '../types'

export const LIBRARY_OPEN: Category[] = ['calisthenics']
export const libLocked = (e: Exercise) => !e.custom && !LIBRARY_OPEN.includes(e.category)
