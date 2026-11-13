import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Sheet } from './ui'
import { EXERCISES, exName } from '../data/exercises'
import type { Exercise } from '../types'

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()
  const list = EXERCISES.filter((e) => !ql || [e.name, e.nameHi, e.nameGu, ...e.primary].some((x) => x.toLowerCase().includes(ql)))
  return (
    <Sheet open={open} onClose={onClose} title={t('addExercise')}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <input className="field pl-9" placeholder={t('searchPh')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <ul className="mt-3 divide-y divide-white/[0.05]">
        {list.map((e) => (
          <li key={e.id}>
            <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => { onPick(e); onClose() }}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{exName(e, lang)}</span>
                <span className="text-[12px] text-dim">{e.primary.map((m) => t(`m_${m}`)).join(', ')}</span>
              </span>
              <Plus size={18} className="text-cyan" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
