import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, Play } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Card, Header, Stepper, Empty } from '../components/ui'
import { ExercisePicker } from '../components/ExercisePicker'
import { exOf, exName, EX_BY_ID } from '../data/exercises'
import { hashQuery, navigate } from '../lib/router'
import { uid } from '../lib/util'
import { cloud } from '../lib/cloud'
import { startWorkout } from '../lib/workout'
import type { CustomWorkout, Exercise, PlanItem } from '../types'

const fresh = (e: Exercise, rest: number): PlanItem =>
  e.tracking === 'time' ? { exId: e.id, sets: 3, secs: 20, rest: 90, target: '' } : { exId: e.id, sets: 3, reps: 8, rest, target: '' }

export function Builder({ editId }: { editId?: string }) {
  const t = useT()
  const s = useApp()
  const existing = editId ? s.customWorkouts.find((w) => w.id === editId) : undefined
  const add = hashQuery().get('add')
  const [name, setName] = useState(existing?.name ?? '')
  const [items, setItems] = useState<PlanItem[]>(() => {
    if (existing) return existing.items
    const ex = add ? EX_BY_ID[add] : undefined
    return ex ? [fresh(ex, s.restDefault)] : []
  })
  const [picker, setPicker] = useState(false)

  const update = (i: number, p: Partial<PlanItem>) => setItems(items.map((it, j) => (j === i ? { ...it, ...p } : it)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const n = [...items]
    ;[n[i], n[j]] = [n[j], n[i]]
    setItems(n)
  }
  const build = (): CustomWorkout => ({ id: existing?.id ?? uid(), name: name.trim() || t('newWorkout'), items: items.map((it) => ({ ...it, target: it.target?.trim() || undefined })), createdAt: existing?.createdAt ?? new Date().toISOString() })
  const save = () => {
    const w = build()
    s.saveCustom(w)
    void cloud.custom(w)
    s.showToast(`✓ ${w.name}`)
    navigate('/train?tab=mine')
  }

  return (
    <div>
      <Header title={t('builder')} back="#/train" />
      <label className="block">
        <span className="label">{t('workoutName')}</span>
        <input className="field mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lever Day · Pull" />
      </label>
      <p className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.05] px-3 py-2 text-[12px] leading-snug text-gold/90">{t('suggestedHint')}</p>

      <div className="mt-4 space-y-3">
        {items.length === 0 && <Empty text={t('noCustom')} />}
        {items.map((it, i) => {
          const ex = exOf(it.exId)
          const timed = ex.tracking === 'time'
          return (
            <Card key={i} className="p-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan/30 bg-cyan/10 font-mono text-xs text-cyan">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{exName(ex, s.lang)}</span>
                <button aria-label={t('moveUp')} onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5 disabled:opacity-30" disabled={i === 0}><ArrowUp size={15} /></button>
                <button aria-label={t('moveDown')} onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5 disabled:opacity-30" disabled={i === items.length - 1}><ArrowDown size={15} /></button>
                <button aria-label={t('delete')} onClick={() => setItems(items.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5"><Trash2 size={15} /></button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div><div className="label mb-1">{t('sets')}</div><Stepper value={it.sets} onChange={(v) => update(i, { sets: Math.max(1, v) })} min={1} max={20} /></div>
                <div><div className="label mb-1">{timed ? t('sec') : t('reps')}</div>{timed ? <Stepper value={it.secs ?? 20} onChange={(v) => update(i, { secs: v })} step={5} min={1} max={600} /> : <Stepper value={it.reps ?? 8} onChange={(v) => update(i, { reps: v })} min={0} max={100} />}</div>
                <div><div className="label mb-1">{t('rest')}</div><Stepper value={it.rest} onChange={(v) => update(i, { rest: v })} step={15} min={0} max={600} /></div>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_1.4fr] gap-2">
                <label><span className="label">{t('targetLbl')}</span><input className="field mt-1 !py-2 text-[14px]" value={it.target ?? ''} placeholder={timed ? '5–10 s' : '6–10'} onChange={(e) => update(i, { target: e.target.value })} /></label>
                <label><span className="label">{t('note')}</span><input className="field mt-1 !py-2 text-[14px]" value={it.note ?? ''} placeholder={t('notePh')} onChange={(e) => update(i, { note: e.target.value || undefined })} /></label>
              </div>
            </Card>
          )
        })}
      </div>

      <Button variant="outline" className="mt-3 w-full" onClick={() => setPicker(true)}><Plus size={16} /> {t('addExercise')}</Button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="ghost" disabled={items.length === 0} onClick={() => { const w = build(); s.saveCustom(w); void cloud.custom(w); if (!s.active) startWorkout(w.name, w.items); navigate('/player') }}><Play size={15} fill="currentColor" /> {t('start')}</Button>
        <Button disabled={items.length === 0} onClick={save}>{t('saveWorkout')}</Button>
      </div>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(e) => setItems([...items, fresh(e, s.restDefault)])} />
    </div>
  )
}
