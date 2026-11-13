import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Info, Plus, X, Timer, Trophy } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Confirm, Ring, Sheet, Stepper, Label } from '../components/ui'
import { BodyMap } from '../components/BodyMap'
import { EX_BY_ID, exName } from '../data/exercises'
import { navigate } from '../lib/router'
import { beep, fmtClock, fmtNum, speak } from '../lib/util'
import { useNow } from '../lib/hooks'
import { finishWorkout, type PRecord } from '../lib/workout'
import type { LoggedSet, WorkoutSession } from '../types'

export function Player() {
  const t = useT()
  const s = useApp()
  const a = s.active
  const now = useNow(250)
  const [restEnd, setRestEnd] = useState<number | null>(null)
  const [restTotal, setRestTotal] = useState(60)
  const [hold, setHold] = useState<{ set: number; end: number } | null>(null)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [info, setInfo] = useState(false)
  const [summary, setSummary] = useState<{ session: WorkoutSession; newPRs: PRecord[] } | null>(null)
  const firedRest = useRef(false)
  const firedHold = useRef(false)

  // rest timer end
  useEffect(() => {
    if (restEnd && now >= restEnd && !firedRest.current) {
      firedRest.current = true
      beep()
      if (s.voice) speak(s.lang === 'hi' ? 'आराम खत्म, अगला सेट' : s.lang === 'gu' ? 'આરામ પૂરો, આગલો સેટ' : 'Rest over. Next set.', s.lang)
      setRestEnd(null)
    }
  }, [now, restEnd, s.voice, s.lang])

  // timed hold end
  useEffect(() => {
    if (hold && now >= hold.end && !firedHold.current && a) {
      firedHold.current = true
      beep()
      markDone(hold.set, true)
      setHold(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, hold])

  if (summary) return <Summary data={summary} onDone={() => { setSummary(null); navigate('/progress') }} />

  if (!a) {
    return (
      <div className="pt-16 text-center">
        <p className="text-muted">{t('empty')}</p>
        <Button className="mt-4" onClick={() => navigate('/train')}>{t('choose')}</Button>
      </div>
    )
  }

  const item = a.items[a.current]
  const log = a.log[a.current]
  const ex = EX_BY_ID[item.exId]
  const timed = ex.tracking === 'time'
  const elapsed = (now - new Date(a.startedAt).getTime()) / 1000
  const totalSets = a.log.reduce((n, l) => n + l.sets.length, 0)
  const doneSets = a.log.reduce((n, l) => n + l.sets.filter((x) => x.done).length, 0)

  const patchSet = (i: number, p: Partial<LoggedSet>) => {
    const logs = a.log.map((l, li) => (li !== a.current ? l : { ...l, sets: l.sets.map((st, si) => (si === i ? { ...st, ...p } : st)) }))
    useApp.setState({ active: { ...a, log: logs } })
  }
  function markDone(i: number, done: boolean) {
    const cur = useApp.getState().active
    if (!cur) return
    const logs = cur.log.map((l, li) => (li !== cur.current ? l : { ...l, sets: l.sets.map((st, si) => (si === i ? { ...st, done } : st)) }))
    useApp.setState({ active: { ...cur, log: logs } })
    if (done) {
      const restSec = cur.items[cur.current].rest
      const isLastSet = i === logs[cur.current].sets.length - 1
      if (restSec > 0 && !(isLastSet && cur.current === cur.items.length - 1)) {
        firedRest.current = false
        setRestTotal(restSec)
        setRestEnd(Date.now() + restSec * 1000)
      }
      if (isLastSet && logs[cur.current].sets.every((x) => x.done) && cur.current < cur.items.length - 1) {
        useApp.setState({ active: { ...useApp.getState().active!, current: cur.current + 1 } })
      }
    }
  }
  const addSet = () => {
    const last = log.sets[log.sets.length - 1]
    const logs = a.log.map((l, li) => (li !== a.current ? l : { ...l, sets: [...l.sets, { ...(last ?? { reps: item.reps ?? 10, kg: 0, secs: item.secs }), done: false }] }))
    useApp.setState({ active: { ...a, log: logs } })
  }
  const go = (d: number) => {
    const n = a.current + d
    if (n >= 0 && n < a.items.length) useApp.setState({ active: { ...a, current: n } })
  }
  const finish = () => {
    const r = finishWorkout()
    setRestEnd(null)
    if (r) setSummary(r)
  }

  const restLeft = restEnd ? Math.max(0, (restEnd - now) / 1000) : 0

  return (
    <div className="pt-[calc(env(safe-area-inset-top)+10px)]">
      {/* top bar */}
      <div className="flex items-center gap-2">
        <button aria-label={t('discard')} onClick={() => setConfirmDiscard(true)} className="-ml-2 grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-white/5"><X size={22} /></button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[13px] text-muted">{a.name}</div>
          <div className="font-mono text-xl font-bold tabular-nums">{fmtClock(elapsed)}</div>
        </div>
        <Button size="sm" onClick={() => setConfirmFinish(true)} disabled={doneSets === 0}>{t('done')}</Button>
      </div>

      {/* progress */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${(doneSets / Math.max(1, totalSets)) * 100}%` }} /></div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {a.items.map((it, i) => {
          const l = a.log[i]
          const complete = l.sets.length > 0 && l.sets.every((x) => x.done)
          return (
            <button key={i} onClick={() => useApp.setState({ active: { ...a, current: i } })} className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium ${i === a.current ? 'border-cyan/60 bg-cyan/10 text-cyan' : complete ? 'border-ok/30 text-ok' : 'border-white/10 text-muted'}`}>
              {complete && <Check size={12} strokeWidth={3} />}{i + 1}. {exName(EX_BY_ID[it.exId], s.lang)}
            </button>
          )
        })}
      </div>

      {/* exercise */}
      <div className="card mt-3 p-4">
        <div className="flex items-start gap-3">
          <div className="w-[104px] shrink-0"><BodyMap primary={ex.primary} secondary={ex.secondary} compact /></div>
          <div className="min-w-0 flex-1">
            <Label>{t('setOf', { n: Math.min(log.sets.filter((x) => x.done).length + 1, log.sets.length), t: log.sets.length })}</Label>
            <h2 className="mt-1 text-[20px] font-extrabold leading-tight">{exName(ex, s.lang)}</h2>
            <p className="mt-1 text-[13px] text-muted">{t('target')}: {item.sets} × {timed ? `${item.secs}s` : `${item.reps} ${t('reps').toLowerCase()}`} · {t('rest')} {item.rest}s</p>
            <button onClick={() => setInfo(true)} className="mt-2 flex items-center gap-1 text-[13px] font-semibold text-cyan"><Info size={14} /> {t('howTo')}</button>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-[13px] text-frost/90">💡 {ex.cues[0]}</div>
      </div>

      {/* sets */}
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[28px_1fr_1fr_48px] items-center gap-2 px-1 text-center">
          <span className="label">#</span>
          <span className="label">{timed ? t('sec') : t('kg')}</span>
          <span className="label">{timed ? '' : t('reps')}</span>
          <span />
        </div>
        {log.sets.map((st, i) => (
          <div key={i} className={`grid grid-cols-[28px_1fr_1fr_48px] items-center gap-2 rounded-2xl border p-1.5 ${st.done ? 'border-ok/25 bg-ok/[0.05]' : 'border-white/[0.07] bg-panel'}`}>
            <span className="text-center font-mono text-sm text-muted">{i + 1}</span>
            {timed ? (
              <>
                <Stepper value={st.secs ?? item.secs ?? 30} onChange={(v) => patchSet(i, { secs: v })} step={5} min={5} max={600} />
                {hold?.set === i ? (
                  <div className="text-center font-mono text-lg font-bold tabular-nums text-cyan">{Math.ceil(Math.max(0, (hold.end - now) / 1000))}s</div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => { firedHold.current = false; setHold({ set: i, end: Date.now() + (st.secs ?? item.secs ?? 30) * 1000 }) }} disabled={st.done || !!hold}>
                    <Timer size={14} /> {t('startHold')}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Stepper value={st.kg} onChange={(v) => patchSet(i, { kg: v })} step={2.5} min={0} max={500} />
                <Stepper value={st.reps} onChange={(v) => patchSet(i, { reps: v })} min={0} max={200} />
              </>
            )}
            <button aria-label={t('logSet')} onClick={() => markDone(i, !st.done)} className={`grid h-11 w-11 place-items-center justify-self-center rounded-xl transition-colors ${st.done ? 'bg-ok text-[#04140c]' : 'bg-white/[0.06] text-muted hover:bg-white/10'}`}>
              <Check size={20} strokeWidth={3} />
            </button>
          </div>
        ))}
        <button onClick={addSet} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/12 text-[13px] font-semibold text-muted hover:text-frost"><Plus size={15} /> {t('sets')}</button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => go(-1)} disabled={a.current === 0}><ChevronLeft size={17} /> {t('prevEx')}</Button>
        {a.current < a.items.length - 1 ? (
          <Button variant="outline" onClick={() => go(1)}>{t('nextEx')} <ChevronRight size={17} /></Button>
        ) : (
          <Button onClick={() => setConfirmFinish(true)} disabled={doneSets === 0}>{t('finish')}</Button>
        )}
      </div>
      <div className="h-40" />

      {/* rest timer */}
      {restEnd && (
        <div className="sheet-in fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg rounded-t-[28px] border border-white/10 bg-[#0c1116] px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4">
          <div className="flex items-center gap-4">
            <Ring value={restLeft / restTotal} size={84} stroke={7}>
              <span className="font-mono text-xl font-bold tabular-nums">{fmtClock(restLeft)}</span>
            </Ring>
            <div className="flex-1">
              <Label>{t('restTimer')}</Label>
              <p className="mt-1 text-[14px] text-muted">{t('next')}: {exName(EX_BY_ID[a.items[a.current].exId], s.lang)}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setRestEnd((restEnd ?? Date.now()) + 15000); setRestTotal(restTotal + 15) }}>{t('addTime')}</Button>
                <Button size="sm" onClick={() => setRestEnd(null)}>{t('skipRest')}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Sheet open={info} onClose={() => setInfo(false)} title={exName(ex, s.lang)}>
        <BodyMap primary={ex.primary} secondary={ex.secondary} frontLabel={t('front')} backLabel={t('backView')} />
        <Label className="mt-4">{t('howTo')}</Label>
        <ol className="mt-2 space-y-2">{ex.steps.map((x, i) => <li key={i} className="flex gap-3 text-[14px]"><span className="font-mono text-cyan">{i + 1}</span>{x}</li>)}</ol>
        <Label className="mt-4">{t('mistakes')}</Label>
        <ul className="mt-2 space-y-1.5">{ex.mistakes.map((x, i) => <li key={i} className="text-[14px] text-muted">✕ {x}</li>)}</ul>
      </Sheet>
      <Confirm open={confirmFinish} text={t('finishQ')} confirmLabel={t('finish')} cancelLabel={t('cancel')} onClose={() => setConfirmFinish(false)} onConfirm={finish} />
      <Confirm open={confirmDiscard} text={t('discardQ')} confirmLabel={t('discard')} cancelLabel={t('cancel')} danger onClose={() => setConfirmDiscard(false)} onConfirm={() => { useApp.setState({ active: null }); navigate('/train') }} />
    </div>
  )
}

function Summary({ data, onDone }: { data: { session: WorkoutSession; newPRs: PRecord[] }; onDone: () => void }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const { session, newPRs } = data
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  const reps = session.exercises.reduce((n, e) => n + e.sets.reduce((m, st) => m + (st.reps || 0), 0), 0)
  return (
    <div className="pt-[calc(env(safe-area-inset-top)+40px)] text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok/15 text-ok"><Check size={32} strokeWidth={3} /></div>
      <h1 className="mt-4 text-[26px] font-extrabold">{t('summary')}</h1>
      <p className="mt-1 text-muted">{session.name}</p>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {[
          [t('duration'), fmtClock(session.durationSec)],
          session.volumeKg > 0 ? [t('volume'), `${fmtNum(session.volumeKg)} ${t('kg')}`] : [t('reps'), String(reps)],
          [t('setsDone'), String(sets)],
        ].map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="text-lg font-extrabold tabular-nums">{v}</div>
            <div className="text-[11px] text-muted">{k}</div>
          </div>
        ))}
      </div>
      {newPRs.length > 0 && (
        <div className="card mt-4 p-4 text-left">
          <div className="flex items-center gap-2"><Trophy size={17} className="text-gold" /><span className="label !text-gold">{t('newPRs')}</span></div>
          <ul className="mt-2 space-y-1.5">
            {newPRs.map((r) => (
              <li key={r.exId} className="flex justify-between text-[14px]">
                <span>{exName(EX_BY_ID[r.exId], lang)}</span>
                <span className="font-mono text-gold">{r.kind === 'weight' ? `${r.kg}kg × ${r.reps}` : r.kind === 'time' ? `${r.value}s` : `${r.value} ${t('reps').toLowerCase()}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button size="lg" className="mt-6 w-full" onClick={onDone}>{t('done')}</Button>
    </div>
  )
}
