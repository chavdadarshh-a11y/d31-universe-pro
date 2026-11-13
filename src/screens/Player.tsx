import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Check, X, Plus, Timer, Trophy, MoreHorizontal, Copy, Trash2, ArrowUp, ArrowDown, Info, StickyNote, History, Save, Play } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Confirm, Ring, Sheet, Label } from '../components/ui'
import { BodyMap } from '../components/BodyMap'
import { ExercisePicker } from '../components/ExercisePicker'
import { CountUp, Photo } from '../components/hud'
import { exOf, exName } from '../data/exercises'
import { navigate } from '../lib/router'
import { beep, fmtClock, speak } from '../lib/util'
import { useNow } from '../lib/hooks'
import { addExerciseToActive, computeRecords, finishWorkout, lastTime, patchActive, prevSetsOf, routineFromLog, startEmpty, type PRecord } from '../lib/workout'
import { beatsRecord, summarizeSets, volumeOf, SET_TYPES } from '../lib/training'
import type { ActiveWorkout, LoggedSet, SetType, WorkoutSession } from '../types'

const TYPE_STYLE: Record<SetType, string> = {
  warmup: 'border-gold/50 bg-gold/10 text-gold',
  working: 'border-cyan/40 bg-cyan/10 text-cyan',
  drop: 'border-violet/50 bg-violet/10 text-violet',
  failure: 'border-bad/50 bg-bad/10 text-bad',
}
const TYPE_SHORT: Record<SetType, string> = { warmup: 'W', working: '', drop: 'D', failure: 'F' }

type SetRef = { ex: number; set: number }

function setLabel(sets: LoggedSet[], i: number): string {
  const type = sets[i].type ?? 'working'
  if (type !== 'working') return TYPE_SHORT[type]
  return String(sets.slice(0, i + 1).filter((s) => (s.type ?? 'working') === 'working').length)
}

/** Numeric input that keeps what you type (e.g. "22.") and commits a number. */
function NumIn({ value, onChange, placeholder, step = 'decimal', label }: { value: number | undefined; onChange: (v: number) => void; placeholder?: string; step?: 'decimal' | 'numeric'; label: string }) {
  const [txt, setTxt] = useState(value ? String(value) : '')
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) { setTxt(value ? String(value) : ''); last.current = value }
  }, [value])
  return (
    <input
      className="num"
      inputMode={step}
      aria-label={label}
      placeholder={placeholder}
      value={txt}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')
        setTxt(raw)
        const n = parseFloat(raw)
        const v = Number.isFinite(n) ? n : 0
        last.current = v
        onChange(v)
      }}
    />
  )
}

function Clock({ startedAt }: { startedAt: string }) {
  const now = useNow(1000)
  return <span className="readout text-[22px] font-bold text-frost">{fmtClock((now - new Date(startedAt).getTime()) / 1000)}</span>
}

function RestSheet({ end, total, nextName, onAdd, onSkip, onDone }: { end: number; total: number; nextName: string; onAdd: () => void; onSkip: () => void; onDone: () => void }) {
  const t = useT()
  const now = useNow(250)
  const left = Math.max(0, (end - now) / 1000)
  const fired = useRef(false)
  useEffect(() => {
    if (left <= 0 && !fired.current) { fired.current = true; onDone() }
  }, [left, onDone])
  return (
    <div className="sheet-in fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg rounded-t-[28px] border border-cyan/25 bg-[linear-gradient(180deg,#0d1526,#070a12)] px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 shadow-[0_-24px_60px_-28px_rgba(34,211,238,0.6)]">
      <div className="flex items-center gap-4">
        <Ring value={left / Math.max(1, total)} size={86} stroke={7} color="#f7c548">
          <span className="readout-gold text-[19px] font-bold">{fmtClock(left)}</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <Label>{t('restTimer')}</Label>
          <p className="mt-1 truncate text-[14px] text-muted">{t('next')}: <span className="text-frost">{nextName}</span></p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" onClick={onAdd}>{t('addTime')}</Button>
            <Button size="sm" onClick={onSkip}>{t('skipRest')}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function HoldCell({ end, onFinish }: { end: number; onFinish: () => void }) {
  const now = useNow(200)
  const left = Math.max(0, Math.ceil((end - now) / 1000))
  const fired = useRef(false)
  useEffect(() => {
    if (left <= 0 && !fired.current) { fired.current = true; onFinish() }
  }, [left, onFinish])
  return <div className="readout grid h-10 place-items-center rounded-[10px] border border-cyan/50 bg-cyan/10 text-[17px] font-bold text-cyan">{left}s</div>
}

export function Player() {
  const t = useT()
  const a = useApp((s) => s.active)
  const lang = useApp((s) => s.lang)
  const voice = useApp((s) => s.voice)
  const sessions = useApp((s) => s.sessions)
  const [rest, setRest] = useState<{ end: number; total: number; next: string } | null>(null)
  const [hold, setHold] = useState<(SetRef & { end: number }) | null>(null)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [picker, setPicker] = useState(false)
  const [setSheet, setSetSheet] = useState<SetRef | null>(null)
  const [exMenu, setExMenu] = useState<number | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ session: WorkoutSession; newPRs: PRecord[]; snapshot: ActiveWorkout } | null>(null)
  const records = useMemo(() => new Map(computeRecords(sessions).map((r) => [r.exId, r])), [sessions])

  if (summary) return <Summary data={summary} onDone={() => { setSummary(null); navigate('/progress') }} />

  if (!a) {
    return (
      <div className="pt-[calc(env(safe-area-inset-top)+60px)] text-center">
        <p className="title-hud text-[15px] text-frost">{t('logWorkout')}</p>
        <p className="mx-auto mt-2 max-w-[280px] text-[14px] text-muted">{t('freeLog')}</p>
        <div className="mt-6 grid gap-2">
          <Button onClick={() => startEmpty(t('emptyWorkout'))}><Play size={15} fill="currentColor" /> {t('emptyWorkout')}</Button>
          <Button variant="outline" onClick={() => navigate('/train')}>{t('choose')}</Button>
        </div>
      </div>
    )
  }

  const update = (fn: (a: ActiveWorkout) => ActiveWorkout) => patchActive(fn)
  const patchSet = (r: SetRef, p: Partial<LoggedSet>) =>
    update((cur) => ({ ...cur, log: cur.log.map((l, li) => (li !== r.ex ? l : { ...l, sets: l.sets.map((st, si) => (si === r.set ? { ...st, ...p } : st)) })) }))
  const addSet = (ex: number, copyFrom?: number) =>
    update((cur) => ({
      ...cur,
      log: cur.log.map((l, li) => {
        if (li !== ex) return l
        const src = l.sets[copyFrom ?? l.sets.length - 1]
        const it = cur.items[li]
        const fresh: LoggedSet = src ? { ...src, done: false, note: undefined } : { reps: it?.reps ?? 0, kg: 0, secs: it?.secs, type: 'working', done: false }
        const sets = [...l.sets]
        sets.splice(copyFrom !== undefined ? copyFrom + 1 : sets.length, 0, fresh)
        return { ...l, sets }
      }),
    }))
  const removeSet = (r: SetRef) => update((cur) => ({ ...cur, log: cur.log.map((l, li) => (li !== r.ex ? l : { ...l, sets: l.sets.filter((_, si) => si !== r.set) })) }))
  const removeEx = (i: number) => update((cur) => ({ ...cur, items: cur.items.filter((_, j) => j !== i), log: cur.log.filter((_, j) => j !== i), current: 0 }))
  const moveEx = (i: number, d: -1 | 1) =>
    update((cur) => {
      const j = i + d
      if (j < 0 || j >= cur.log.length) return cur
      const items = [...cur.items], log = [...cur.log]
      ;[items[i], items[j]] = [items[j], items[i]]
      ;[log[i], log[j]] = [log[j], log[i]]
      return { ...cur, items, log }
    })

  const nextName = (ex: number, set: number) => {
    const cur = useApp.getState().active
    if (!cur) return ''
    const l = cur.log[ex]
    const remaining = l.sets.slice(set + 1).some((s) => !s.done)
    const target = remaining ? ex : Math.min(ex + 1, cur.log.length - 1)
    return exName(exOf(cur.log[target].exId), lang)
  }

  const toggleDone = (r: SetRef, done: boolean) => {
    patchSet(r, { done })
    if (!done) return
    const cur = useApp.getState().active
    if (!cur) return
    const st = cur.log[r.ex].sets[r.set]
    const exId = cur.log[r.ex].exId
    if (beatsRecord({ ...st, done: true }, exOf(exId).tracking, records.get(exId))) {
      useApp.getState().showToast(`🏆 ${t('newPR')} · ${exName(exOf(exId), lang)}`)
    }
    const restSec = cur.items[r.ex]?.rest ?? useApp.getState().restDefault
    const isLast = r.ex === cur.log.length - 1 && cur.log[r.ex].sets.every((s, i) => i === r.set || s.done)
    if (restSec > 0 && !isLast && (st.type ?? 'working') !== 'warmup') setRest({ end: Date.now() + restSec * 1000, total: restSec, next: nextName(r.ex, r.set) })
  }

  const doneSets = a.log.reduce((n, l) => n + l.sets.filter((x) => x.done).length, 0)
  const totalSets = a.log.reduce((n, l) => n + l.sets.length, 0)
  const vol = a.log.reduce((v, l) => v + volumeOf(l.sets), 0)
  const finish = () => {
    const snapshot = useApp.getState().active
    const r = finishWorkout()
    setRest(null)
    if (r && snapshot) setSummary({ ...r, snapshot })
  }
  const sheetSet = setSheet ? a.log[setSheet.ex]?.sets[setSheet.set] : undefined
  const sheetEx = setSheet ? exOf(a.log[setSheet.ex].exId) : undefined

  return (
    <div className="pt-[calc(env(safe-area-inset-top)+8px)]">
      {/* HUD top bar */}
      <div className="sticky top-0 z-30 -mx-4 bg-[#04060c]/80 px-4 pb-2 pt-2 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button aria-label={t('discard')} onClick={() => setConfirmDiscard(true)} className="-ml-1 grid h-10 w-10 place-items-center rounded-xl border border-white/[0.07] text-muted hover:bg-white/5"><X size={20} /></button>
          <div className="min-w-0 flex-1 text-center">
            <input
              aria-label={t('workoutName')}
              value={a.name}
              onChange={(e) => update((cur) => ({ ...cur, name: e.target.value }))}
              className="w-full truncate bg-transparent text-center text-[12.5px] font-semibold text-muted outline-none focus:text-frost"
            />
            <Clock startedAt={a.startedAt} />
          </div>
          <Button size="sm" onClick={() => setConfirmFinish(true)} disabled={doneSets === 0}>{t('done')}</Button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]"><div className="bg-neon-static h-full rounded-full transition-all" style={{ width: `${(doneSets / Math.max(1, totalSets)) * 100}%` }} /></div>
        <div className="mt-2 grid grid-cols-3 text-center">
          <div><div className="readout text-[15px] font-bold text-cyan">{doneSets}<span className="text-dim">/{totalSets}</span></div><div className="label !text-[9px]">{t('setsLogged')}</div></div>
          <div><div className="readout-gold text-[15px] font-bold">{Math.round(vol).toLocaleString('en-IN')}<span className="ml-0.5 text-[10px] text-dim">kg</span></div><div className="label !text-[9px]">{t('liveVolume')}</div></div>
          <div><div className="readout text-[15px] font-bold text-violet">{a.log.length}</div><div className="label !text-[9px]">{t('exercises')}</div></div>
        </div>
      </div>

      {a.items.some((it) => it.target) && (
        <p className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.05] px-3 py-2 text-[12px] leading-snug text-gold/90">{t('suggestedHint')}</p>
      )}

      <div className="mt-3 space-y-3">
        {a.log.map((l, i) => (
          <ExerciseBlock
            key={`${l.exId}-${i}`}
            i={i}
            a={a}
            record={records.get(l.exId)}
            hold={hold && hold.ex === i ? hold : null}
            onPatch={(set, p) => patchSet({ ex: i, set }, p)}
            onToggle={(set, d) => toggleDone({ ex: i, set }, d)}
            onAddSet={() => addSet(i)}
            onSetMenu={(set) => setSetSheet({ ex: i, set })}
            onMenu={() => setExMenu(i)}
            onInfo={() => setInfo(l.exId)}
            onHold={(set, secs) => setHold({ ex: i, set, end: Date.now() + secs * 1000 })}
            onHoldEnd={() => {
              const h = hold
              setHold(null)
              beep()
              if (h) toggleDone({ ex: h.ex, set: h.set }, true)
            }}
          />
        ))}
      </div>

      <Button variant="outline" className="mt-4 w-full" onClick={() => setPicker(true)}><Plus size={16} /> {t('addExercise')}</Button>
      <Button className="mt-2 w-full" onClick={() => setConfirmFinish(true)} disabled={doneSets === 0}><Check size={16} /> {t('finish')}</Button>
      <div className="h-44" />

      {rest && (
        <RestSheet
          end={rest.end}
          total={rest.total}
          nextName={rest.next}
          onAdd={() => setRest({ ...rest, end: rest.end + 15000, total: rest.total + 15 })}
          onSkip={() => setRest(null)}
          onDone={() => {
            beep()
            if (voice) speak(lang === 'hi' ? 'आराम खत्म, अगला सेट' : lang === 'gu' ? 'આરામ પૂરો, આગલો સેટ' : 'Rest over. Next set.', lang)
            setRest(null)
          }}
        />
      )}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(e) => addExerciseToActive(e.id)} />

      {/* per-set editor */}
      <Sheet open={!!setSheet && !!sheetSet} onClose={() => setSetSheet(null)} title={sheetEx ? `${exName(sheetEx, lang)} · ${t('sets')} ${setSheet ? setSheet.set + 1 : ''}` : ''}>
        {setSheet && sheetSet && sheetEx && (
          <div className="space-y-4">
            <div>
              <Label>{t('setType')}</Label>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {SET_TYPES.map((ty) => (
                  <button key={ty} onClick={() => patchSet(setSheet, { type: ty })} className={`h-10 rounded-xl border text-[12px] font-bold ${(sheetSet.type ?? 'working') === ty ? TYPE_STYLE[ty] : 'border-white/10 text-muted'}`}>{t(`st_${ty}`)}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label><span className="label">{t('kg')}</span><div className="mt-1.5"><NumIn label={t('kg')} value={sheetSet.kg} onChange={(v) => patchSet(setSheet, { kg: v })} placeholder="0" /></div></label>
              <label><span className="label">{t('reps')}</span><div className="mt-1.5"><NumIn label={t('reps')} step="numeric" value={sheetSet.reps} onChange={(v) => patchSet(setSheet, { reps: Math.round(v) })} placeholder="0" /></div></label>
              <label><span className="label">{t('sec')}</span><div className="mt-1.5"><NumIn label={t('sec')} step="numeric" value={sheetSet.secs} onChange={(v) => patchSet(setSheet, { secs: Math.round(v) || undefined })} placeholder="—" /></div></label>
            </div>
            <div>
              <Label>{t('rpe')}</Label>
              <p className="mt-0.5 text-[11.5px] text-dim">{t('rpeHint')}</p>
              <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => (
                  <button key={r} onClick={() => patchSet(setSheet, { rpe: sheetSet.rpe === r ? undefined : r })} className={`h-9 min-w-[42px] rounded-lg border px-2 text-[13px] font-bold tabular-nums ${sheetSet.rpe === r ? 'border-magenta/60 bg-magenta/15 text-magenta' : 'border-white/10 text-muted'}`}>{r}</button>
                ))}
              </div>
            </div>
            <label className="block"><span className="label">{t('note')}</span>
              <input className="field mt-1.5" value={sheetSet.note ?? ''} placeholder={t('notePh')} onChange={(e) => patchSet(setSheet, { note: e.target.value || undefined })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => { addSet(setSheet.ex, setSheet.set); setSetSheet(null) }}><Copy size={15} /> {t('duplicate')}</Button>
              <Button variant="danger" onClick={() => { removeSet(setSheet); setSetSheet(null) }}><Trash2 size={15} /> {t('removeSet')}</Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* per-exercise menu */}
      <Sheet open={exMenu !== null && !!a.log[exMenu]} onClose={() => setExMenu(null)} title={exMenu !== null && a.log[exMenu] ? exName(exOf(a.log[exMenu].exId), lang) : ''}>
        {exMenu !== null && a.log[exMenu] && (
          <div className="space-y-3">
            <label className="block"><span className="label">{t('note')}</span>
              <input className="field mt-1.5" value={a.log[exMenu].note ?? ''} placeholder={t('notePh')} onChange={(e) => update((cur) => ({ ...cur, log: cur.log.map((l, li) => (li === exMenu ? { ...l, note: e.target.value || undefined } : l)) }))} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" disabled={exMenu === 0} onClick={() => { moveEx(exMenu, -1); setExMenu(exMenu - 1) }}><ArrowUp size={15} /> {t('moveUp')}</Button>
              <Button variant="ghost" disabled={exMenu === a.log.length - 1} onClick={() => { moveEx(exMenu, 1); setExMenu(exMenu + 1) }}><ArrowDown size={15} /> {t('moveDown')}</Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => { setInfo(a.log[exMenu].exId); setExMenu(null) }}><Info size={15} /> {t('howTo')}</Button>
            <Button variant="danger" className="w-full" onClick={() => { removeEx(exMenu); setExMenu(null) }}><Trash2 size={15} /> {t('removeExercise')}</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!info} onClose={() => setInfo(null)} title={info ? exName(exOf(info), lang) : ''}>
        {info && (() => {
          const ex = exOf(info)
          return (
            <>
              {ex.media && <div className="relative -mx-1 mb-4 h-44 overflow-hidden rounded-2xl"><Photo name={ex.media} alt={t('photoOf', { x: ex.name })} /></div>}
              <BodyMap primary={ex.primary} secondary={ex.secondary} frontLabel={t('front')} backLabel={t('backView')} />
              {ex.steps.length > 0 && <><Label className="mt-4">{t('howTo')}</Label>
                <ol className="mt-2 space-y-2">{ex.steps.map((x, i) => <li key={i} className="flex gap-3 text-[14px]"><span className="font-mono text-cyan">{i + 1}</span>{x}</li>)}</ol></>}
              {ex.mistakes.length > 0 && <><Label className="mt-4">{t('mistakes')}</Label>
                <ul className="mt-2 space-y-1.5">{ex.mistakes.map((x, i) => <li key={i} className="text-[14px] text-muted">✕ {x}</li>)}</ul></>}
            </>
          )
        })()}
      </Sheet>

      <Confirm open={confirmFinish} text={t('finishQ')} confirmLabel={t('finish')} cancelLabel={t('cancel')} onClose={() => setConfirmFinish(false)} onConfirm={finish} />
      <Confirm open={confirmDiscard} text={t('discardQ')} confirmLabel={t('discard')} cancelLabel={t('cancel')} danger onClose={() => setConfirmDiscard(false)} onConfirm={() => { useApp.setState({ active: null }); navigate('/train') }} />
    </div>
  )
}

type BlockProps = {
  i: number
  a: ActiveWorkout
  record?: PRecord
  hold: (SetRef & { end: number }) | null
  onPatch: (set: number, p: Partial<LoggedSet>) => void
  onToggle: (set: number, done: boolean) => void
  onAddSet: () => void
  onSetMenu: (set: number) => void
  onMenu: () => void
  onInfo: () => void
  onHold: (set: number, secs: number) => void
  onHoldEnd: () => void
}

const ExerciseBlock = memo(function ExerciseBlock({ i, a, record, hold, onPatch, onToggle, onAddSet, onSetMenu, onMenu, onInfo, onHold, onHoldEnd }: BlockProps) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const l = a.log[i]
  const it = a.items[i]
  const ex = exOf(l.exId)
  const timed = ex.tracking === 'time'
  const prev = useMemo(() => prevSetsOf(l.exId), [l.exId])
  const last = useMemo(() => lastTime(l.exId), [l.exId])
  const prevTxt = (si: number) => {
    const p = prev[si]
    if (!p) return '—'
    return timed ? `${p.secs ?? 0}s${p.kg ? `+${p.kg}` : ''}` : p.kg ? `${p.kg}×${p.reps}` : `${p.reps}`
  }
  const complete = l.sets.length > 0 && l.sets.every((s) => s.done)
  return (
    <div className={`card overflow-hidden ${complete ? 'hud-gold' : ''}`}>
      <div className="flex items-start gap-3 p-3 pb-2">
        <button onClick={onInfo} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#070b14]">
          {ex.media ? <Photo name={ex.media} small alt="" /> : <div className="p-1"><BodyMap primary={ex.primary} secondary={ex.secondary} compact /></div>}
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={onInfo} className="block max-w-full truncate text-left text-[16px] font-bold leading-tight text-frost">{exName(ex, lang)}</button>
          {it && (it.target || it.sets) && (
            <div className="mt-0.5 text-[11.5px] text-muted"><span className="text-gold/80">{t('suggested')}</span> · {it.sets} × {it.target ?? (timed ? `${it.secs}s` : it.reps)} · {t('restLbl')} {it.rest}s</div>
          )}
          {last && <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-cyan/90"><History size={11} /> {t('lastTime')}: {last.text}</div>}
          {(l.note || it?.note) && <div className="mt-1 flex items-start gap-1 text-[11.5px] text-frost/70"><StickyNote size={11} className="mt-0.5 shrink-0 text-gold" /> {l.note ?? it?.note}</div>}
        </div>
        <button aria-label="Menu" onClick={onMenu} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] text-muted"><MoreHorizontal size={18} /></button>
      </div>

      <div className="grid grid-cols-[34px_minmax(0,1fr)_64px_58px_42px] items-center gap-1.5 px-3 text-center">
        <span className="label !text-[9px]">{t('sets')}</span>
        <span className="label !text-[9px]">{t('previous')}</span>
        <span className="label !text-[9px]">{timed ? t('sec') : t('kg')}</span>
        <span className="label !text-[9px]">{timed ? t('kgOpt') : t('reps')}</span>
        <span />
      </div>
      <div className="space-y-1.5 px-3 pb-2 pt-1.5">
        {l.sets.map((st, si) => {
          const type = st.type ?? 'working'
          const pr = beatsRecord(st, ex.tracking, record)
          return (
            <div key={si}>
              <div className={`grid grid-cols-[34px_minmax(0,1fr)_64px_58px_42px] items-center gap-1.5 rounded-xl px-0.5 py-0.5 transition-colors ${st.done ? 'bg-ok/[0.07]' : ''}`}>
                <button aria-label={t('setType')} onClick={() => onSetMenu(si)} className={`grid h-9 w-[34px] place-items-center rounded-lg border font-mono text-[13px] font-bold ${TYPE_STYLE[type]}`}>{setLabel(l.sets, si)}</button>
                <button onClick={() => onSetMenu(si)} className="truncate text-center font-mono text-[12px] text-dim">
                  {timed && !st.done && !hold ? <span className="inline-flex items-center gap-1 text-cyan" onClick={(e) => { e.stopPropagation(); onHold(si, st.secs ?? it?.secs ?? 20) }}><Timer size={13} /> {t('holdSec')}</span> : prevTxt(si)}
                </button>
                {timed ? (
                  hold && hold.set === si ? <HoldCell end={hold.end} onFinish={onHoldEnd} /> : <NumIn label={t('sec')} step="numeric" value={st.secs} placeholder={String(prev[si]?.secs ?? it?.secs ?? '')} onChange={(v) => onPatch(si, { secs: Math.round(v) })} />
                ) : (
                  <NumIn label={t('kg')} value={st.kg} placeholder={prev[si]?.kg ? String(prev[si].kg) : '0'} onChange={(v) => onPatch(si, { kg: v })} />
                )}
                {timed ? (
                  <NumIn label={t('kgOpt')} value={st.kg} placeholder="—" onChange={(v) => onPatch(si, { kg: v })} />
                ) : (
                  <NumIn label={t('reps')} step="numeric" value={st.reps} placeholder={String(prev[si]?.reps ?? it?.reps ?? '')} onChange={(v) => onPatch(si, { reps: Math.round(v) })} />
                )}
                <button aria-label={t('logSet')} onClick={() => onToggle(si, !st.done)} className={`relative grid h-10 w-[42px] place-items-center rounded-xl transition-colors ${st.done ? 'bg-ok text-[#04140c] shadow-[0_0_16px_-4px_rgba(52,211,153,0.9)]' : 'border border-white/10 bg-white/[0.05] text-muted'}`}>
                  <Check size={19} strokeWidth={3} />
                  {pr && <Trophy size={13} className="pr-pop absolute -right-1.5 -top-1.5 rounded-full bg-[#0b0f18] p-[1px] text-gold" />}
                </button>
              </div>
              {(st.rpe || st.note) && (
                <div className="ml-[40px] mt-0.5 truncate text-left text-[11px] text-muted">
                  {st.rpe ? <span className="mr-2 font-semibold text-magenta">RPE {st.rpe}</span> : null}{st.note}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button onClick={onAddSet} className="flex h-10 w-full items-center justify-center gap-1.5 border-t border-white/[0.06] text-[13px] font-semibold text-cyan hover:bg-cyan/[0.05]"><Plus size={15} /> {t('addSet')}</button>
    </div>
  )
})

function Summary({ data, onDone }: { data: { session: WorkoutSession; newPRs: PRecord[]; snapshot: ActiveWorkout }; onDone: () => void }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const saveCustom = useApp((s) => s.saveCustom)
  const showToast = useApp((s) => s.showToast)
  const { session, newPRs, snapshot } = data
  const [name, setName] = useState(session.name)
  const [saved, setSaved] = useState(false)
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  const reps = session.exercises.reduce((n, e) => n + e.sets.reduce((m, st) => m + (st.reps || 0), 0), 0)
  return (
    <div className="pt-[calc(env(safe-area-inset-top)+32px)]">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-ok/40 bg-ok/10 text-ok shadow-[0_0_30px_-8px_rgba(52,211,153,0.8)]"><Check size={32} strokeWidth={3} /></div>
        <h1 className="title-hud mt-4 text-[20px]">{t('summary')}</h1>
        <p className="mt-1 text-muted">{session.name}</p>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center"><div className="readout text-[18px] font-bold">{fmtClock(session.durationSec)}</div><div className="mt-1 text-[11px] text-muted">{t('duration')}</div></div>
        <div className="card p-3 text-center"><div className="readout-gold text-[18px] font-bold">{session.volumeKg > 0 ? <CountUp value={session.volumeKg} /> : <CountUp value={reps} />}</div><div className="mt-1 text-[11px] text-muted">{session.volumeKg > 0 ? `${t('volume')} (kg)` : t('reps')}</div></div>
        <div className="card p-3 text-center"><div className="readout text-[18px] font-bold"><CountUp value={sets} /></div><div className="mt-1 text-[11px] text-muted">{t('setsDone')}</div></div>
      </div>
      {newPRs.length > 0 && (
        <div className="card hud-gold mt-3 p-4">
          <div className="flex items-center gap-2"><Trophy size={17} className="text-gold" /><span className="label !text-gold">{t('newPRs')}</span></div>
          <ul className="mt-2 space-y-1.5">
            {newPRs.map((r) => (
              <li key={r.exId} className="flex justify-between gap-3 text-[14px]">
                <span className="truncate">{exName(exOf(r.exId), lang)}</span>
                <span className="font-mono text-gold">{r.kind === 'weight' ? `${r.kg}kg × ${r.reps}` : r.kind === 'time' ? `${r.value}s` : `${r.value} ${t('reps').toLowerCase()}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card mt-3 divide-y divide-white/[0.05] px-4">
        {session.exercises.map((e) => (
          <div key={e.exId} className="flex items-center justify-between gap-3 py-2.5">
            <span className="truncate text-[14px]">{exName(exOf(e.exId), lang)}</span>
            <span className="shrink-0 font-mono text-[12px] text-cyan">{summarizeSets(e.sets, exOf(e.exId).tracking)}</span>
          </div>
        ))}
      </div>
      <div className="card mt-3 p-4">
        <Label>{t('saveRoutine')}</Label>
        <div className="mt-2 flex gap-2">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('routineName')} />
          <Button disabled={saved || !name.trim()} onClick={() => { saveCustom(routineFromLog(name.trim(), snapshot)); setSaved(true); showToast(`✓ ${t('routineSaved')}`) }}>{saved ? <Check size={16} /> : <Save size={16} />}</Button>
        </div>
      </div>
      <Button size="lg" className="mt-5 w-full" onClick={onDone}>{t('done')}</Button>
    </div>
  )
}
