/** Unit conversion. Everything is STORED in kg / cm; only display and input convert. */
import { useSettings } from '../store/settings'

const LB = 2.2046226218
const IN = 0.3937007874

const r1 = (n: number) => Math.round(n * 10) / 10
const clean = (n: number) => (Number.isInteger(r1(n)) ? String(Math.round(n)) : r1(n).toFixed(1))

export const wUnit = () => useSettings.getState().weightUnit
export const lUnit = () => useSettings.getState().lengthUnit
/** kg → number in the user's unit (1 decimal) */
export const toW = (kg: number) => (wUnit() === 'lb' ? r1(kg * LB) : r1(kg))
/** user's unit → kg (unrounded so the round trip is stable) */
export const fromW = (v: number) => (wUnit() === 'lb' ? v / LB : v)
/** "20kg" / "44lb" */
export const wTxt = (kg: number, space = false) => `${clean(wUnit() === 'lb' ? kg * LB : kg)}${space ? ' ' : ''}${wUnit()}`
export const toL = (cm: number) => (lUnit() === 'in' ? r1(cm * IN) : r1(cm))
export const fromL = (v: number) => (lUnit() === 'in' ? v / IN : v)
export const lTxt = (cm: number) => `${clean(lUnit() === 'in' ? cm * IN : cm)} ${lUnit()}`

/** Re-render on unit change. */
export function useUnits() {
  const w = useSettings((s) => s.weightUnit)
  const l = useSettings((s) => s.lengthUnit)
  return { w, l, toW, fromW, wTxt, toL, fromL, lTxt }
}
