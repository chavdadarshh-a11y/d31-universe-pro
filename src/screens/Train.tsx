import { useState } from 'react'
import { Plus, Play, Pencil, Trash2, Dumbbell, CalendarDays, CheckCircle2 } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Card, Chip, Confirm, Empty, Header, LockTag, Tabs } from '../components/ui'
import { PROGRAMS } from '../data/programs'
import { EX_BY_ID, exName } from '../data/exercises'
import { navigate, hashQuery } from '../lib/router'
import { hasPlan } from '../lib/plans'
import { estimateMinutes } from '../lib/plan'
import { startWorkout } from '../lib/workout'
import { cloud } from '../lib/cloud'
import type { Program } from '../types'

const KIND_ACCENT: Record<Program['kind'], string> = { split: '#22d3ee', skill: '#a78bfa', strength: '#f5b942', mobility: '#34d399' }

export function Train() {
  const t = useT()
  const s = useApp()
  const plan = effectivePlan(s.membership)
  const [tab, setTab] = useState<'programs' | 'mine'>(hashQuery().get('tab') === 'mine' ? 'mine' : 'programs')
  const [kind, setKind] = useState<Program['kind'] | 'all'>('all')
  const [del, setDel] = useState<string | null>(null)
  const list = PROGRAMS.filter((p) => kind === 'all' || p.kind === kind)

  return (
    <div>
      <Header title={t('navTrain')} right={<Button size="sm" variant="ghost" onClick={() => navigate('/train/builder')}><Plus size={16} /> {t('newWorkout')}</Button>} />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'programs', label: t('programs') }, { id: 'mine', label: t('myWorkouts') }]} />

      {tab === 'programs' && (
        <>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {(['all', 'split', 'skill', 'strength', 'mobility'] as const).map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{k === 'all' ? t('all') : t(`kind_${k}`)}</Chip>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {list.map((p) => {
              const locked = !hasPlan(plan, p.plan)
              const active = s.activeProgramId === p.id
              return (
                <Card key={p.id} onClick={() => navigate(`/train/program/${p.id}`)} className="relative overflow-hidden p-4">
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: KIND_ACCENT[p.kind] }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="muted">{t(`kind_${p.kind}`)}</Badge>
                        <Badge tone="muted">{t(`level_${p.level}`)}</Badge>
                        {active && <Badge tone="cyan"><CheckCircle2 size={10} /> {t('isActive')}</Badge>}
                      </div>
                      <h3 className="mt-2 text-[17px] font-bold leading-tight">{p.name}</h3>
                    </div>
                    {locked && <LockTag label={t(`plan_${p.plan}`)} />}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted">{p.description}</p>
                  <div className="mt-3 flex items-center gap-4 text-[12px] text-dim">
                    <span className="flex items-center gap-1"><CalendarDays size={13} /> {p.weeks} {t('weeks')}</span>
                    <span className="flex items-center gap-1"><Dumbbell size={13} /> {p.daysPerWeek}{t('perWeek')}</span>
                    <span>~{estimateMinutes(p.days[0].items)} {t('min')}</span>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {tab === 'mine' && (
        <div className="mt-3 space-y-3">
          {s.customWorkouts.length === 0 && (
            <Empty icon={<Dumbbell size={28} />} text={t('noCustom')} action={<Button size="sm" onClick={() => navigate('/train/builder')}><Plus size={15} /> {t('newWorkout')}</Button>} />
          )}
          {s.customWorkouts.map((w) => (
            <Card key={w.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate text-[16px] font-bold">{w.name}</h3>
                <div className="flex gap-1">
                  <button aria-label={t('edit')} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5" onClick={() => navigate(`/train/builder/${w.id}`)}><Pencil size={15} /></button>
                  <button aria-label={t('delete')} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5" onClick={() => setDel(w.id)}><Trash2 size={15} /></button>
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] text-muted">{w.items.map((i) => exName(EX_BY_ID[i.exId], s.lang)).join(' · ')}</p>
              <Button size="sm" className="mt-3" onClick={() => { if (!s.active) startWorkout(w.name, w.items); navigate('/player') }}>
                <Play size={14} fill="currentColor" /> {t('start')} · ~{estimateMinutes(w.items)} {t('min')}
              </Button>
            </Card>
          ))}
        </div>
      )}
      <Confirm open={!!del} text={`${t('delete')}?`} confirmLabel={t('delete')} cancelLabel={t('cancel')} danger onClose={() => setDel(null)} onConfirm={() => { if (del) { s.deleteCustom(del); void cloud.deleteCustom(del) } }} />
    </div>
  )
}
