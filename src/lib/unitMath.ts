/** Pure unit maths (no store imports, so unit tests can load it directly). Stored values are always kg / cm. */
export const LB_PER_KG = 2.2046226218
export const IN_PER_CM = 0.3937007874
export const kgToLb = (kg: number) => kg * LB_PER_KG
export const lbToKg = (lb: number) => lb / LB_PER_KG
export const cmToIn = (cm: number) => cm * IN_PER_CM
export const inToCm = (inch: number) => inch / IN_PER_CM

/** Sane input ranges. Stored values are metric; imperial ranges are derived for display. */
export const AGE = { min: 13, max: 90 }
export const HEIGHT_CM = { min: 100, max: 250 }
export const WEIGHT_KG = { min: 30, max: 250 }
export const HEIGHT_IN = { min: 39.5, max: 98 } // ≈3'3" – 8'2"
export const WEIGHT_LB = { min: 67, max: 551 }
const between = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
/** cm, kept to 0.1 so inch input round-trips without drift */
export const clampHeightCm = (cm: number) => Math.round(between(cm, HEIGHT_CM.min, HEIGHT_CM.max) * 10) / 10
/** kg, kept to 0.01 so lb input round-trips without drift */
export const clampWeightKg = (kg: number) => Math.round(between(kg, WEIGHT_KG.min, WEIGHT_KG.max) * 100) / 100

/** Repair a saved profile: non-numbers, out-of-range values, and values stuck at the OLD clamp edges
 *  (age 13/90, height 120/230, weight 30/250 — produced by the old per-keystroke clamp bug) go back to defaults.
 *  oldEdges=false (every load): only missing / non-number / out-of-range values are repaired. */
export function repairBody<T extends { age?: unknown; heightCm?: unknown; weightKg?: unknown }>(p: T, def = { age: 25, heightCm: 172, weightKg: 70 }, oldEdges = true): T {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : NaN)
  const a = num(p.age), h = num(p.heightCm), w = num(p.weightKg)
  const age = !Number.isFinite(a) || a < AGE.min || a > AGE.max || (oldEdges && (a === 13 || a === 90)) ? def.age : Math.round(a)
  const heightCm = !Number.isFinite(h) || h < HEIGHT_CM.min || h > HEIGHT_CM.max || (oldEdges && (h === 120 || h === 230)) ? def.heightCm : h
  const weightKg = !Number.isFinite(w) || w < WEIGHT_KG.min || w > WEIGHT_KG.max || (oldEdges && (w === 30 || w === 250)) ? def.weightKg : w
  return { ...p, age, heightCm, weightKg }
}

