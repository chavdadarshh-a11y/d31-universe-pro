import { useState } from 'react'
import { ScanLine, Plus, Check, X, Sparkles, ListOrdered } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Card, Header, Label, Sheet } from '../components/ui'
import { BodyMap, MUSCLE_COLORS } from '../components/BodyMap'
import { EX_BY_ID, exName } from '../data/exercises'
import { navigate } from '../lib/router'
import { cloud } from '../lib/cloud'

export function ExerciseDetail({ id }: { id: string }) {
  const t = useT()
  const s = useApp()
  const [addOpen, setAddOpen] = useState(false)
  const e = EX_BY_ID[id]
  if (!e) return <div><Header title="—" back="#/library" /><p className="text-muted">{t('empty')}</p></div>
  const levelLabel = t(e.level === 1 ? 'level_beginner' : e.level === 2 ? 'level_intermediate' : 'level_advanced')

  const addTo = (wid: string) => {
    const w = s.customWorkouts.find((x) => x.id === wid)
    if (!w) return
    const nw = { ...w, items: [...w.items, e.tracking === 'time' ? { exId: e.id, sets: 3, secs: 30, rest: 60 } : { exId: e.id, sets: 3, reps: 10, rest: s.restDefault }] }
    s.saveCustom(nw)
    void cloud.custom(nw)
    setAddOpen(false)
    s.showToast(`✓ ${w.name}`)
  }

  return (
    <div>
      <Header title={exName(e, s.lang)} sub={s.lang !== 'en' ? e.name : undefined} back="#/library" />
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="muted">{t(`cat_${e.category}`)}</Badge>
        <Badge tone={e.level === 3 ? 'violet' : 'muted'}>{levelLabel}</Badge>
        <Badge tone="cyan">{e.layer}</Badge>
        {e.equipment.map((q) => <Badge key={q} tone="muted">{t(`eq_${q}`)}</Badge>)}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-frost/90">{e.summary}</p>

      <Card className="mt-4 p-4">
        <BodyMap primary={e.primary} secondary={e.secondary} frontLabel={t('front')} backLabel={t('backView')} />
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
          <div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: MUSCLE_COLORS.primary }} /><Label>{t('primaryM')}</Label></div>
            <p className="mt-1.5 text-[14px] font-semibold">{e.primary.map((m) => t(`m_${m}`)).join(', ')}</p>
          </div>
          {e.secondary.length > 0 && (
            <div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: MUSCLE_COLORS.secondary, opacity: 0.8 }} /><Label>{t('secondaryM')}</Label></div>
              <p className="mt-1.5 text-[14px] text-frost/85">{e.secondary.map((m) => t(`m_${m}`)).join(', ')}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => (s.customWorkouts.length ? setAddOpen(true) : navigate(`/train/builder?add=${e.id}`))}><Plus size={16} /> {t('addToWorkout')}</Button>
        <Button onClick={() => navigate(`/analyze?ex=${e.id}`)}><ScanLine size={16} /> {t('analyzeThis')}</Button>
      </div>

      <Section icon={<ListOrdered size={16} className="text-cyan" />} title={t('howTo')}>
        <ol className="space-y-3">
          {e.steps.map((x, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan/12 font-mono text-[12px] font-bold text-cyan">{i + 1}</span>
              <span className="text-[14.5px] leading-relaxed">{x}</span>
            </li>
          ))}
        </ol>
      </Section>
      <Section icon={<Sparkles size={16} className="text-gold" />} title={t('cues')}>
        <ul className="space-y-2">{e.cues.map((x, i) => <li key={i} className="rounded-xl bg-white/[0.04] px-3 py-2 text-[14px]">“{x}”</li>)}</ul>
      </Section>
      <Section icon={<X size={16} className="text-bad" />} title={t('mistakes')}>
        <ul className="space-y-2">{e.mistakes.map((x, i) => <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed"><X size={16} className="mt-0.5 shrink-0 text-bad" />{x}</li>)}</ul>
      </Section>
      <Section icon={<Check size={16} className="text-ok" />} title={t('benefits')}>
        <ul className="space-y-2">{e.benefits.map((x, i) => <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed"><Check size={16} className="mt-0.5 shrink-0 text-ok" />{x}</li>)}</ul>
      </Section>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={t('addToWorkout')}>
        <div className="space-y-2">
          {s.customWorkouts.map((w) => (
            <button key={w.id} onClick={() => addTo(w.id)} className="card-2 flex w-full items-center justify-between px-4 py-3 text-left">
              <span className="font-semibold">{w.name}</span><span className="text-xs text-dim">{w.items.length} {t('exercises').toLowerCase()}</span>
            </button>
          ))}
          <Button variant="outline" className="w-full" onClick={() => navigate(`/train/builder?add=${e.id}`)}><Plus size={16} /> {t('newWorkout')}</Button>
        </div>
      </Sheet>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-3 p-4">
      <div className="mb-3 flex items-center gap-2">{icon}<Label>{title}</Label></div>
      {children}
    </Card>
  )
}
