import { useState } from 'react'
import { Search, Plus, Sparkles } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Chip, Sheet } from './ui'
import { allExercises, exName } from '../data/exercises'
import { uid } from '../lib/util'
import type { Category, Exercise, MuscleId } from '../types'

const MUSCLES: MuscleId[] = ['chest', 'shoulders', 'rear_delts', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'traps', 'lats', 'upper_back', 'lower_back', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves']
const CATS: Category[] = ['strength', 'calisthenics', 'mobility', 'cardio']

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  useApp((s) => s.customExercises)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)
  const ql = q.trim().toLowerCase()
  const list = allExercises().filter((e) => (!cat || e.category === cat) && (!ql || [e.name, e.nameHi, e.nameGu, ...e.primary].some((x) => x.toLowerCase().includes(ql))))
  const pick = (e: Exercise) => { onPick(e); setQ(''); onClose() }
  return (
    <>
      <Sheet open={open && !creating} onClose={onClose} title={t('addExercise')}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input className="field pl-9" placeholder={t('searchPh')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          <Chip active={!cat} onClick={() => setCat(null)}>{t('all')}</Chip>
          {CATS.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)}>{t(`cat_${c}`)}</Chip>)}
        </div>
        <button onClick={() => setCreating(true)} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-gold/40 bg-gold/[0.05] px-4 py-3 text-left">
          <Sparkles size={18} className="text-gold" />
          <span className="flex-1 text-[14px] font-semibold text-gold">{t('createExercise')}{q.trim() ? ` · “${q.trim()}”` : ''}</span>
          <Plus size={18} className="text-gold" />
        </button>
        <ul className="mt-2 divide-y divide-white/[0.05]">
          {list.map((e) => (
            <li key={e.id}>
              <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => pick(e)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{exName(e, lang)} {e.custom && <span className="ml-1 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold text-gold">{t('customTag')}</span>}</span>
                  <span className="text-[12px] text-dim">{e.primary.map((m) => t(`m_${m}`)).join(', ')}{e.tracking === 'time' ? ` · ${t('trk_time')}` : ''}</span>
                </span>
                <Plus size={18} className="text-cyan" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
      <CustomExerciseSheet open={open && creating} initialName={q.trim()} onClose={() => setCreating(false)} onSaved={(e) => { setCreating(false); pick(e) }} />
    </>
  )
}

export function CustomExerciseSheet({ open, initialName, onClose, onSaved }: { open: boolean; initialName?: string; onClose: () => void; onSaved: (e: Exercise) => void }) {
  const t = useT()
  const save = useApp((s) => s.saveCustomExercise)
  const [name, setName] = useState(initialName ?? '')
  const [cat, setCat] = useState<Category>('strength')
  const [tracking, setTracking] = useState<'reps' | 'time'>('reps')
  const [muscles, setMuscles] = useState<MuscleId[]>([])
  const nm = name || initialName || ''
  const submit = () => {
    const n = nm.trim()
    if (!n) return
    const e: Exercise = {
      id: `custom-${uid()}`, name: n, nameHi: n, nameGu: n, category: cat, equipment: ['none'], level: 2, layer: 'FORCE', tracking,
      primary: muscles, secondary: [], summary: '', steps: [], cues: [], mistakes: [], benefits: [], custom: true,
    }
    save(e)
    setName(''); setMuscles([])
    onSaved(e)
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('createExercise')}>
      <label className="block"><span className="label">{t('exNameLbl')}</span>
        <input className="field mt-1.5" value={nm} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ring Front Lever Row" autoFocus />
      </label>
      <div className="label mt-4">{t('tracking')}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(['reps', 'time'] as const).map((k) => (
          <button key={k} onClick={() => setTracking(k)} className={`h-11 rounded-xl border text-[13px] font-semibold ${tracking === k ? 'border-gold/60 bg-gold/10 text-gold' : 'border-white/10 text-muted'}`}>{t(`trk_${k}`)}</button>
        ))}
      </div>
      <div className="label mt-4">{t('category')}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">{CATS.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{t(`cat_${c}`)}</Chip>)}</div>
      <div className="label mt-4">{t('primaryPick')}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MUSCLES.map((m) => <Chip key={m} active={muscles.includes(m)} onClick={() => setMuscles(muscles.includes(m) ? muscles.filter((x) => x !== m) : [...muscles, m])}>{t(`m_${m}`)}</Chip>)}
      </div>
      <Button className="mt-5 w-full" disabled={!nm.trim()} onClick={submit}><Plus size={16} /> {t('save')}</Button>
    </Sheet>
  )
}
