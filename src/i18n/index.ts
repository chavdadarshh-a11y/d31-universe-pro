import { useApp } from '../store/app'
import { DICTS, type StringKey } from './strings'
import type { Lang } from '../types'

export type T = (k: StringKey, vars?: Record<string, string | number>) => string

export function translate(lang: Lang, k: StringKey, vars?: Record<string, string | number>): string {
  let s: string = DICTS[lang][k] ?? DICTS.en[k] ?? k
  if (vars) for (const [key, v] of Object.entries(vars)) s = s.replaceAll(`{${key}}`, String(v))
  return s
}

export function useT(): T {
  const lang = useApp((s) => s.lang)
  return (k, vars) => translate(lang, k, vars)
}

export const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: 'en', label: 'English', native: 'English' },
  { id: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { id: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
]
export type { StringKey }
