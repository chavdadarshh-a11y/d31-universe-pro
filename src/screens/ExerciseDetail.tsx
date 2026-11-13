import { useState } from 'react'
import { ScanLine, Plus, Check, X, Sparkles, ListOrdered, History, Trophy, Route, Trash2 } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Card, Header, Label, Sheet } from '../components/ui'
import { BodyMap, MUSCLE_COLORS } from '../components/BodyMap'
import { allExercises, exName } from '../data/exercises'
import { LADDER_BY_ID } from '../data/ladders'
import { Photo } from '../components/hud'
import { computeRecords } from '../lib/workout'
import { criterionText, summarizeSets } from '../lib/training'
import { navigate } from '../lib/router'
import { cloud } from '../lib/cloud'

export function ExerciseDetail({ id }: { id: string }) {
  const t = useT()
  const s = useApp()
  const [addOpen, setAddOpen] = useState(false)
  const e = allExercises().find((x) => x.id === id)
  if (!e) return <div><Header title="—" back="#/library" /><p className="text-muted">{t('empty')}</p></div>
  const history = s.sessions
    .flatMap((x) => x.exercises.filter((le) => le.exId === e.id && le.sets.some((st) => st.done)).map((le) => ({ date: x.startedAt, text: summarizeSets(le.sets, e.tracking) })))
    .slice(0, 5)
  const rec = computeRecords(s.sessions).find((r) => r.exId === e.id)
  const ladder = e.ladder ? LADDER_BY_ID[e.ladder] : undefined
  const stepIdx = ladder ? ladder.steps.findIndex((x) => x.exId === e.id) : -1
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(s.lang === 'en' ? 'en-IN' : `${s.lang}-IN`, { day: 'numeric', month: 'short' })
  const levelLabel = t(e.level === 1 ? 'level_beginner' : e.level === 2 ? 'level_intermediate' : 'level_advanced')

  const addTo = (wid: string) => {
    const w = s.customWorkouts.find((x) => x.id === wid)
    if (!w) return
    const nw = { ...w, items: [...w.items, e.tracking === 'time' ? { exId: e.id, sets: 3, secs: 20, rest: 90 } : { exId: e.id, sets: 3, reps: 8, rest: s.restDefault }] }
    s.saveCustom(nw)
    void cloud.custom(nw)
    setAddOpen(false)
    s.showToast(`✓ ${w.name}`)
  }

  return (
    <div>
      <Header title={exName(e, s.lang)} sub={s.lang !== 'en' ? e.name : undefined} back="#/library" />
      {e.media && (
        <div className="card hud-full scanlines holo-sweep relative -mt-1 mb-3 h-[230px] overflow-hidden">
          <Photo smart name={e.media} alt={t('photoOf', { x: e.name })} eager />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(4,6,12,0.92))]" />
          <div className="absolute bottom-3 left-4 z-[2] font-mono text-[9.5px] uppercase tracking-[0.24em] text-gold/90">{t('byDarshan')}</div>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="muted">{t(`cat_${e.category}`)}</Badge>
        <Badge tone={e.level === 3 ? 'violet' : 'muted'}>{levelLabel}</Badge>
        <Badge tone="cyan">{e.layer}</Badge>
        {e.equipment.map((q) => <Badge key={q} tone="muted">{t(`eq_${q}`)}</Badge>)}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-frost/90">{e.summary}</p>

      <Card className="mt-4 p-4">
        <div className="mb-2 flex items-center gap-2"><History size={16} className="text-cyan" /><Label>{t('lastTime')}</Label>
          {rec && <span className="ml-auto flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-[11px] text-gold"><Trophy size={12} /> {t('yourBest')}: {rec.kind === 'time' ? `${rec.value}s` : rec.kind === 'weight' ? `${rec.kg}kg × ${rec.reps}` : `${rec.value}`}</span>}
        </div>
        {history.length === 0 ? (
          <p className="text-[13px] text-muted">{t('noLogsYet')}</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-[13.5px]"><span className="text-muted">{fmtDate(h.date)}</span><span className="readout font-mono">{h.text}</span></li>
            ))}
          </ul>
        )}
      </Card>

      {ladder && stepIdx >= 0 && (
        <Card className="mt-3 p-4" onClick={() => navigate(`/path/${ladder.id}`)}>
          <div className="flex items-center gap-2"><Route size={16} color="url(#g-gold)" /><Label>{t('partOfPath')}</Label><span className="ml-auto font-mono text-[11px] text-cyan">{t('stepOf', { n: stepIdx + 1, t: ladder.steps.length })}</span></div>
          <div className="title-hud mt-2 text-[14px]">{ladder.name}</div>
          <p className="mt-1 text-[13px] text-muted"><span className="text-gold">{t('goalLbl')}:</span> {criterionText(ladder.steps[stepIdx].goal)} — {ladder.steps[stepIdx].tip}</p>
        </Card>
      )}

      <Card className="mt-3 p-4">
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

      {e.custom && (
        <Button variant="ghost" className="mt-2 w-full" onClick={() => { s.deleteCustomExercise(e.id); navigate('/library') }}><Trash2 size={15} /> {t('delete')}</Button>
      )}
      {e.steps.length > 0 && <Section icon={<ListOrdered size={16} className="text-cyan" />} title={t('howTo')}>
        <ol className="space-y-3">
          {e.steps.map((x, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan/12 font-mono text-[12px] font-bold text-cyan">{i + 1}</span>
              <span className="text-[14.5px] leading-relaxed">{x}</span>
            </li>
          ))}
        </ol>
      </Section>}
      {e.cues.length > 0 && <Section icon={<Sparkles size={16} className="text-gold" />} title={t('cues')}>
        <ul className="space-y-2">{e.cues.map((x, i) => <li key={i} className="rounded-xl bg-white/[0.04] px-3 py-2 text-[14px]">“{x}”</li>)}</ul>
      </Section>}
      {e.mistakes.length > 0 && <Section icon={<X size={16} className="text-bad" />} title={t('mistakes')}>
        <ul className="space-y-2">{e.mistakes.map((x, i) => <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed"><X size={16} className="mt-0.5 shrink-0 text-bad" />{x}</li>)}</ul>
      </Section>}
      {e.benefits.length > 0 && <Section icon={<Check size={16} className="text-ok" />} title={t('benefits')}>
        <ul className="space-y-2">{e.benefits.map((x, i) => <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed"><Check size={16} className="mt-0.5 shrink-0 text-ok" />{x}</li>)}</ul>
      </Section>}

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
