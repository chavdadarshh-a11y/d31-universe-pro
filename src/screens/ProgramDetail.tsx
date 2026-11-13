import { Lock, Play, CheckCircle2 } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Card, Header, Label } from '../components/ui'
import { PROGRAM_BY_ID } from '../data/programs'
import { exOf, exName } from '../data/exercises'
import { Photo } from '../components/hud'
import { LADDER_BY_ID } from '../data/ladders'
import { navigate } from '../lib/router'
import { hasPlan } from '../lib/plans'
import { estimateMinutes } from '../lib/plan'
import { startWorkout } from '../lib/workout'

export function ProgramDetail({ id }: { id: string }) {
  const t = useT()
  const s = useApp()
  const p = PROGRAM_BY_ID[id]
  if (!p) return <div><Header title="—" back="#/train" /><p className="text-muted">{t('empty')}</p></div>
  const plan = effectivePlan(s.membership)
  const locked = !hasPlan(plan, p.plan)
  const active = s.activeProgramId === p.id
  const next = (s.programDay[p.id] ?? 0) % p.days.length

  const startDay = (i: number) => {
    if (locked) return navigate('/membership')
    if (!active) s.set({ activeProgramId: p.id })
    if (!s.active) startWorkout(`${p.name} · ${p.days[i].name}`, p.days[i].items, p.id, i)
    navigate('/player')
  }

  return (
    <div>
      <Header title={p.name} back="#/train" />
      {p.media && (
        <div className="card hud-full scanlines relative -mt-1 mb-3 h-[190px] overflow-hidden">
          <Photo name={p.media} alt={t('photoOf', { x: p.name })} eager />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(4,6,12,0.9))]" />
          <div className="title-hud absolute bottom-3 left-4 z-[2] text-[18px] text-frost">{p.name}</div>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="muted">{t(`kind_${p.kind}`)}</Badge>
        <Badge tone="muted">{t(`level_${p.level}`)}</Badge>
        <Badge tone="muted">{p.weeks} {t('weeks')}</Badge>
        <Badge tone="muted">{p.daysPerWeek}{t('perWeek')}</Badge>
        {p.plan !== 'free' && <Badge tone="gold">{t(`plan_${p.plan}`)}</Badge>}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-frost/90">{p.description}</p>
      <p className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.05] px-3 py-2 text-[12px] leading-snug text-gold/90">{t('suggestedHint')}</p>
      {p.ladder && LADDER_BY_ID[p.ladder] && (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(`/path/${p.ladder}`)}>{t('skillPaths')}: {LADDER_BY_ID[p.ladder].name}</Button>
      )}

      {locked ? (
        <Button variant="gold" className="mt-4 w-full" onClick={() => navigate('/membership')}><Lock size={16} /> {t('unlockWith', { p: t(`plan_${p.plan}`) })}</Button>
      ) : active ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-cyan/25 bg-cyan/[0.06] px-4 py-3 text-sm text-cyan"><CheckCircle2 size={17} /> {t('isActive')}</div>
      ) : (
        <Button variant="outline" className="mt-4 w-full" onClick={() => { s.set({ activeProgramId: p.id }); s.showToast(t('isActive')) }}>{t('setActive')}</Button>
      )}

      <div className="mt-5 space-y-3">
        {p.days.map((d, i) => (
          <Card key={i} className={`p-4 ${active && i === next ? 'border-cyan/30' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <Label>{`${i + 1} / ${p.days.length}`}</Label>
                <h3 className="title-hud mt-1 text-[14px]">{d.name}</h3>
              </div>
              <span className="text-xs text-dim">~{estimateMinutes(d.items)} {t('min')}</span>
            </div>
            <ul className="mt-3 divide-y divide-white/[0.05]">
              {d.items.map((it, j) => (
                <li key={j}>
                  <button className="flex w-full items-center justify-between py-2.5 text-left" onClick={() => navigate(`/library/${it.exId}`)}>
                    <span className="min-w-0 pr-2">
                      <span className="block truncate text-[14px]">{exName(exOf(it.exId), s.lang)}</span>
                      {it.note && <span className="block truncate text-[11.5px] text-dim">{it.note}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-[12px] text-cyan/90">{it.sets} × {it.target ?? it.reps ?? `${it.secs}s`}<span className="text-dim"> · {it.rest}s</span></span>
                  </button>
                </li>
              ))}
            </ul>
            <Button size="sm" className="mt-2 w-full" variant={locked ? 'ghost' : active && i === next ? 'primary' : 'ghost'} onClick={() => startDay(i)}>
              {locked ? <Lock size={14} /> : <Play size={14} fill="currentColor" />} {t('startDay')}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
