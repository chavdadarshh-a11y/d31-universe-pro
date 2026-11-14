// bundle entry for scripts/test-exmatch.mjs (the app sources import JSON, which node can't load as plain TS)
export { resolveExercise, matchExercises } from '../src/lib/exerciseMatch'
export { buildPose, guessExercise } from '../src/lib/formCheck'
export { rolesFor } from '../src/lib/muscleRoles'
