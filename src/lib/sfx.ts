/** Tiny synth sound effects + haptics for Game mode and Run cues (respects Settings → sound / vibration). */
import { useSettings } from '../store/settings'

let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  try {
    if (!ctx) { const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; ctx = new C() }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}
function tone(freq: number, dur = 0.12, type: OscillatorType = 'sine', vol = 0.18, delay = 0) {
  if (!useSettings.getState().sound) return
  const c = ac(); if (!c) return
  const t0 = c.currentTime + delay
  const o = c.createOscillator(), g = c.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02)
}
export function buzz(p: number | number[]) { if (useSettings.getState().vibration && navigator.vibrate) navigator.vibrate(p) }

export const sfx = {
  /** unlock audio on the first tap (mobile browsers need a gesture) */
  prime: () => { ac() },
  rep: (combo: number) => { tone(520 + Math.min(combo, 30) * 22, 0.09, 'triangle', 0.2); buzz(25) },
  combo: () => { [660, 880, 1320].forEach((f, i) => tone(f, 0.12, 'square', 0.08, i * 0.06)); buzz([20, 30, 20]) },
  tick: () => tone(1000, 0.05, 'sine', 0.12),
  go: () => { tone(1320, 0.25, 'square', 0.1); buzz(80) },
  hit: () => { tone(140, 0.16, 'sawtooth', 0.16); tone(90, 0.2, 'square', 0.08, 0.02); buzz(35) },
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, i * 0.11)); buzz([60, 40, 60, 40, 140]) },
  lose: () => { [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sine', 0.14, i * 0.18)); buzz(200) },
  level: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.09)); buzz([40, 30, 40, 30, 40]) },
  cue: () => { tone(880, 0.15, 'sine', 0.18); tone(1175, 0.2, 'sine', 0.16, 0.16); buzz([120, 60, 120]) },
}
