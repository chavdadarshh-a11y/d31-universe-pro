/** Range-of-motion (depth) levels: exercise page card, a picker for logging, and the camera/photo estimate. */
import { useMemo } from 'react'
import { Ruler, ScanLine } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Card, Label } from './ui'
import { romAngleFromMetrics, romFamily, romFromAngle, romText, type RomFamily } from '../data/rom'
import type { Exercise } from '../types'
import { navigate } from '../lib/router'

const LV_COLORS = ['#60a5fa', '#22d3ee', '#a3e635', '#f7c548']
export const romColor = (i: number) => (i < 0 ? '#94a3b8' : LV_COLORS[Math.min(LV_COLORS.length - 1, i + 1)])

/** depth meter: n small bars, the first `i+1` lit */
export function RomMeter({ i, n, size = 'sm' }: { i: number; n: number; size?: 'sm' | 'lg' }) {
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden>
      {Array.from({ length: n }, (_, k) => (
        <span key={k} className="rounded-sm" style={{ width: size === 'lg' ? 7 : 4, height: (size === 'lg' ? 9 : 5) + k * (size === 'lg' ? 6 : 3), background: k <= i ? romColor(i) : 'rgba(148,163,184,0.25)', boxShadow: k <= i ? `0 0 6px ${romColor(i)}88` : undefined }} />
      ))}
    </span>
  )
}

const JOINT: Record<NonNullable<RomFamily['metric']>, 'jKnee' | 'jHip' | 'jElbow' | 'jShoulder'> = { kneeMin: 'jKnee', hip: 'jHip', elbowMin: 'jElbow', shoulder: 'jShoulder' }

export function RomCard({ ex }: { ex: Exercise }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const sessions = useApp((s) => s.sessions)
  const fam = romFamily(ex)
  const usual = useMemo(() => {
    const n: Record<string, number> = {}
    for (const s of sessions) for (const e of s.exercises) if (e.exId === ex.id) for (const st of e.sets) if (st.rom) n[st.rom] = (n[st.rom] ?? 0) + 1
    const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0]
    return top ? fam.levels.find((l) => l.id === top[0]) : undefined
  }, [sessions, ex.id, fam])
  return (
    <Card className="mt-3 p-4" data-testid="rom-card">
      <div className="mb-1 flex items-center gap-2"><Ruler size={16} className="text-cyan" /><Label>{t('romTitle')}</Label>{usual && <span className="ml-auto font-mono text-[11px] text-gold">{t('romUsual', { x: romText(usual.name, lang) })}</span>}</div>
      <p className="mb-3 text-[12px] leading-snug text-muted">{t('romSub')}</p>
      <ol className="space-y-2">
        {fam.levels.map((l, i) => (
          <li key={l.id} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center"><RomMeter i={i} n={fam.levels.length} size="lg" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[14px] font-bold" style={{ color: romColor(i) }}>{romText(l.name, lang)}<span className="font-mono text-[10px] font-semibold text-dim">L{i + 1}</span></div>
              <div className="text-[12.5px] leading-snug text-muted">{romText(l.desc, lang)}</div>
            </div>
          </li>
        ))}
      </ol>
      {fam.metric && (
        <button onClick={() => navigate('/analyze')} className="mt-3 flex w-full items-center gap-2 rounded-xl border border-violet/30 bg-violet/[0.06] px-3 py-2 text-left text-[12px] text-violet">
          <ScanLine size={14} className="shrink-0" /> {t('romCamHint', { j: t(JOINT[fam.metric]) })}
        </button>
      )}
    </Card>
  )
}

/** chips to choose a level (tap the chosen one again to clear) */
export function RomPicker({ exId, value, onChange, compact = false }: { exId: string; value?: string; onChange: (id: string | undefined) => void; compact?: boolean }) {
  const lang = useApp((s) => s.lang)
  const fam = romFamily(exId)
  return (
    <div className={`no-scrollbar flex gap-1.5 overflow-x-auto ${compact ? '' : 'mt-2'}`} data-testid="rom-picker">
      {fam.levels.map((l, i) => {
        const on = value === l.id
        return (
          <button key={l.id} onClick={() => onChange(on ? undefined : l.id)} className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 font-semibold ${compact ? 'h-7 text-[11.5px]' : 'h-9 text-[12.5px]'} ${on ? '' : 'border-white/10 text-muted'}`} style={on ? { borderColor: `${romColor(i)}aa`, color: romColor(i), background: `${romColor(i)}18` } : undefined}>
            <RomMeter i={i} n={fam.levels.length} /> {romText(l.name, lang)}
          </button>
        )
      })}
    </div>
  )
}

export function romName(exId: string, id: string | undefined, lang: 'en' | 'hi' | 'gu') {
  if (!id) return ''
  const fam = romFamily(exId)
  const i = fam.levels.findIndex((l) => l.id === id)
  return i < 0 ? '' : romText(fam.levels[i].name, lang)
}
export function RomTag({ exId, id }: { exId: string; id?: string }) {
  const lang = useApp((s) => s.lang)
  const fam = romFamily(exId)
  const i = fam.levels.findIndex((l) => l.id === id)
  if (i < 0) return null
  return <span className="inline-flex items-center gap-1 font-semibold" style={{ color: romColor(i) }}><RomMeter i={i} n={fam.levels.length} /> {romText(fam.levels[i].name, lang)}</span>
}

/** Analyze: depth reached in this photo, from the measured joint angle */
export function RomEstimate({ exId, metrics }: { exId: string; metrics: Record<string, { v: number } | undefined> }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const fam = romFamily(exId)
  const deg = romAngleFromMetrics(fam, metrics)
  if (deg === null || !fam.cut) return null
  const i = romFromAngle(fam, deg)
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cyan/25 bg-cyan/[0.05] p-3" data-testid="rom-estimate">
      <span className="grid h-10 w-10 shrink-0 place-items-center"><RomMeter i={i ?? -1} n={fam.levels.length} size="lg" /></span>
      <div className="min-w-0 flex-1">
        <div className="label !text-[9.5px]">{t('romReached')}</div>
        <div className="text-[15px] font-bold" style={{ color: i === null ? '#f7c548' : romColor(i) }}>{i === null ? t('romBelow', { x: romText(fam.levels[0].name, lang) }) : romText(fam.levels[i].name, lang)}</div>
        <div className="font-mono text-[11px] text-muted">{t('romAngle', { j: t(JOINT[fam.metric!]), d: Math.round(deg) })}{i !== null && i < fam.levels.length - 1 ? ` · ${t('romNext', { x: romText(fam.levels[i + 1].name, lang) })}` : ''}</div>
      </div>
    </div>
  )
}
