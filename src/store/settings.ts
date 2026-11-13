import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ThemePref = 'night' | 'light' | 'system'
export type Reminder = { enabled: boolean; time: string; days: number[] }

/** Device-level settings (shared by every account on this phone). */
export type Settings = {
  theme: ThemePref
  weightUnit: 'kg' | 'lb'
  lengthUnit: 'cm' | 'in'
  sound: boolean
  vibration: boolean
  bgVideo: boolean
  reduceData: boolean
  reminder: Reminder
  installDismissed: boolean
  set: (p: Partial<Omit<Settings, 'set'>>) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'night',
      weightUnit: 'kg',
      lengthUnit: 'cm',
      sound: true,
      vibration: true,
      bgVideo: true,
      reduceData: false,
      reminder: { enabled: false, time: '18:00', days: [1, 2, 3, 4, 5, 6] },
      installDismissed: false,
      set: (p) => set(p),
    }),
    { name: 'd31-settings', version: 1, storage: createJSONStorage(() => localStorage), partialize: ({ set: _s, ...rest }) => { void _s; return rest as Settings } },
  ),
)

/** Resolved theme right now. */
export function resolvedTheme(pref: ThemePref): 'night' | 'light' {
  if (pref === 'system') return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'night'
  return pref
}

export function applyTheme(pref: ThemePref) {
  const t = resolvedTheme(pref)
  const root = document.documentElement
  root.classList.toggle('light', t === 'light')
  root.style.colorScheme = t === 'light' ? 'light' : 'dark'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#eef2f8' : '#07080b')
}
