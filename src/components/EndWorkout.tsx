import { useEffect, useState } from 'react'
import { Check, Minimize2, Pause, Play, Trash2, AlertTriangle } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Sheet } from './ui'
import { useNow } from '../lib/hooks'
import { fmtClock } from '../lib/util'
import { discardWorkout, doneSetCount, elapsedSec, finishWorkout, isStale, pauseActive, resumeActive, type PRecord } from '../lib/workout'
import { navigate } from '../lib/router'
import type { ActiveWorkout, WorkoutSession } from '../types'

export type FinishResult = { session: WorkoutSession; newPRs: PRecord[]; snapshot: ActiveWorkout }

/** Live elapsed clock of the active session (pauses excluded). */
export function SessionClock({ a, className = '' }: { a: ActiveWorkout; className?: string }) {
  const now = useNow(1000)
  return <span className={`${className} ${a.pausedAt ? 'text-gold' : ''}`}>{fmtClock(elapsedSec(a, now))}</span>
}

/**
 * One place to end a session: pause/resume, minimise, finish & save, or end & discard (with a confirm step).
 * Works with 0 ticked sets (then it only offers to end without saving) and for old/stuck persisted sessions.
 */
export function EndWorkoutSheet({ open, onClose, onFinished, minimize = false }: { open: boolean; onClose: () => void; onFinished: (r: FinishResult | null) => void; minimize?: boolean }) {
  const t = useT()
  const a = useApp((s) => s.active)
  const [step, setStep] = useState<'menu' | 'discard'>('menu')
  useEffect(() => { if (open) setStep('menu') }, [open])
  if (!a) return null
  const n = doneSetCount(a)
  const stale = isStale(a)
  const started = new Date(a.startedAt)
  const startedTxt = Number.isFinite(started.getTime()) ? started.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  const save = () => {
    const snapshot = useApp.getState().active
    const r = finishWorkout()
    onClose()
    onFinished(r && snapshot ? { ...r, snapshot } : null)
  }
  const discard = () => {
    discardWorkout()
    onClose()
    onFinished(null)
  }

  return (
    <Sheet open={open} onClose={onClose} title={step === 'discard' ? t('endDiscard') : t('workoutMenu')}>
      {step === 'discard' ? (
        <div data-testid="discard-confirm">
          <p className="mb-5 mt-1 text-[15px] leading-relaxed">{n === 0 ? t('noSetsQ') : t('discardQ')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={() => setStep('menu')}>{t('keepTraining')}</Button>
            <Button variant="danger" onClick={discard}><Trash2 size={15} /> {t('endDiscard')}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5" data-testid="end-sheet">
          <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-frost">{a.name}</div>
              <div className="font-mono text-[11px] text-muted">{t(n === 1 ? 'setsTicked1' : 'setsTicked', { n })}{a.pausedAt ? ` · ${t('timerPaused')}` : ''}</div>
            </div>
            <SessionClock a={a} className="readout text-[20px] font-bold text-cyan" />
          </div>
          {stale && (
            <p className="flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-[12.5px] leading-snug text-gold/90"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t('staleMsg', { x: startedTxt })}</p>
          )}
          {n === 0 && <p className="rounded-xl border border-white/[0.07] px-3 py-2 text-[12.5px] leading-snug text-muted">{t('tickHint')}</p>}
          <div className="grid grid-cols-2 gap-2">
            {a.pausedAt
              ? <Button variant="outline" onClick={() => resumeActive()}><Play size={15} fill="currentColor" /> {t('resumeLbl')}</Button>
              : <Button variant="ghost" onClick={() => pauseActive()}><Pause size={15} /> {t('pauseLbl')}</Button>}
            {minimize
              ? <Button variant="ghost" onClick={() => { onClose(); navigate('/home') }}><Minimize2 size={15} /> {t('minimize').split(' · ')[0]}</Button>
              : <Button variant="ghost" onClick={() => { onClose(); navigate('/player') }}><Play size={15} /> <span className="whitespace-nowrap">{t('resumeLbl')}</span></Button>}
          </div>
          {n > 0 && <Button className="w-full" onClick={save} data-testid="save-finish"><Check size={16} /> {t(n === 1 ? 'saveFinish1' : 'saveFinish', { n })}</Button>}
          <Button variant="danger" className="w-full" onClick={() => setStep('discard')} data-testid="end-discard"><Trash2 size={15} /> {n > 0 ? t('endDiscard') : t('endWorkout')}</Button>
        </div>
      )}
    </Sheet>
  )
}
