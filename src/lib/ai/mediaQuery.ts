/** Keyword score for on-device photo search. Pure — no gallery imports. */
export function normMediaQuery(s: string): string {
  return s.toLowerCase().normalize('NFC').replace(/[_\-.,/()+]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function scoreMediaQuery(q: string, tags: string[]): number {
  const nq = normMediaQuery(q)
  if (!nq) return 0
  const words = nq.split(' ').filter(Boolean)
  const hay = normMediaQuery(tags.join(' '))
  if (!hay) return 0
  let score = 0
  if (hay.includes(nq)) score += 4
  const compact = (s: string) => s.replace(/\s+/g, '')
  if (compact(hay).includes(compact(nq)) && nq.length >= 3) score += 2
  let hit = 0
  for (const w of words) {
    if (w.length < 2) continue
    if (hay.includes(w)) { hit++; score += w.length >= 5 ? 1.2 : 1 }
  }
  if (words.length && hit === 0 && score === 0) return 0
  if (words.length && hit < words.length && score < 4) score *= hit / words.length
  return score
}
