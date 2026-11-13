import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Card, Header, Stepper, Empty } from '../components/ui'
import { ExercisePicker } from '../components/ExercisePicker'
import { EX_BY_ID, exName } from '../data/exercises'
import { hashQuery, navigate } from '../lib/router'
import { uid } from '../lib/util'
import { cloud } from '../lib/cloud'
import type { CustomWorkout, PlanItem } from '../types'

export function Builder({ editId }: { editId?: string }) {
  const t = useT()
  const s = useApp()
  const existing = editId ? s.customWorkouts.find((w) => w.id === editId) : undefined
  const add = hashQuery().get('add')
  const [name, setName] = useState(existing?.name ?? '')
  const [items, setItems] = useState<PlanItem[]>(() => {
    if (existing) return existing.items
    const ex = add ? EX_BY_ID[add] : undefined
    return ex ? [ex.tracking === 'time' ? { exId: ex.id, sets: 3, secs: 30, rest: 60 } : { exId: ex.id, sets: 3, reps: 10, rest: s.restDefault }] : []
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
  const save = () => {
    const w: CustomWorkout = { id: existing?.id ?? uid(), name: name.trim() || t('newWorkout'), items, createdAt: existing?.createdAt ?? new Date().toISOString() }
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
        <input className="field mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Upper body · Home" />
      </label>

      <div className="mt-4 space-y-3">
        {items.length === 0 && <Empty text={t('noCustom')} />}
        {items.map((it, i) => {
          const ex = EX_BY_ID[it.exId]
          const timed = ex?.tracking === 'time'
          return (
            <Card key={i} className="p-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 font-mono text-xs text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{ex ? exName(ex, s.lang) : it.exId}</span>
                <button aria-label="Move up" onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5 disabled:opacity-30" disabled={i === 0}><ArrowUp size={15} /></button>
                <button aria-label="Move down" onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5 disabled:opacity-30" disabled={i === items.length - 1}><ArrowDown size={15} /></button>
                <button aria-label={t('delete')} onClick={() => setItems(items.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5"><Trash2 size={15} /></button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div><div className="label mb-1">{t('sets')}</div><Stepper value={it.sets} onChange={(v) => update(i, { sets: Math.max(1, v) })} min={1} max={10} /></div>
                <div><div className="label mb-1">{timed ? t('sec') : t('reps')}</div>{timed ? <Stepper value={it.secs ?? 30} onChange={(v) => update(i, { secs: v })} step={5} min={5} max={600} /> : <Stepper value={it.reps ?? 10} onChange={(v) => update(i, { reps: v })} min={1} max={100} />}</div>
                <div><div className="label mb-1">{t('rest')}</div><Stepper value={it.rest} onChange={(v) => update(i, { rest: v })} step={15} min={0} max={600} /></div>
              </div>
            </Card>
          )
        })}
      </div>

      <Button variant="outline" className="mt-3 w-full" onClick={() => setPicker(true)}><Plus size={16} /> {t('addExercise')}</Button>
      <Button className="mt-3 w-full" disabled={items.length === 0} onClick={save}>{t('saveWorkout')}</Button>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(e) => setItems([...items, e.tracking === 'time' ? { exId: e.id, sets: 3, secs: 30, rest: 60 } : { exId: e.id, sets: 3, reps: 10, rest: s.restDefault }])}
      />
    </div>
  )
}
