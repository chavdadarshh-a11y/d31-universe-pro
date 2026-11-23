/** Run mode: live GPS run (distance, time, pace, route map, km splits, pause/resume), guided plans, treadmill + manual entry. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Footprints, MapPin, Pause, Play, Square, Timer, Plus, Volume2, VolumeX, LocateOff, Satellite, Gauge, Flag, Trash2, History, Flame } from 'lucide-react'
import { useApp } from '../store/app'
import { useT, type T } from '../i18n'
import { Badge, Button, Card, Chip, Confirm, Header, Label, Sheet, Stepper } from '../components/ui'
import { RunMap } from '../components/RunMap'
import { navigate } from '../lib/router'
import { fmtClock, fmtDate, speak } from '../lib/util'
import { sfx } from '../lib/sfx'
import {
  RUN_PLANS, acceptFix, fmtKm, fmtPace, liveElapsed, loadLive, planSec, runKcal, saveLive, segAt, splitsFrom, thin, useMyRuns, useRuns,
  type LiveRun, type Run, type RunKind, type Seg,
} from '../lib/runs'

const KINDS: RunKind[] = ['free', 'easy', 'intervals', 'tempo']
const KIND_COLOR: Record<RunKind, string> = { free: '#22d3ee', easy: '#a3e635', intervals: '#f472d0', tempo: '#f7c548' }
const SEG_COLOR: Record<Seg['kind'], string> = { warm: '#60a5fa', easy: '#a3e635', fast: '#f472d0', tempo: '#f7c548', cool: '#a78bfa' }

type GpsState = 'off' | 'searching' | 'good' | 'weak' | 'denied' | 'unsupported'

export function RunScreen() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const [kind, setKind] = useState<RunKind>('free')
  const [mode, setMode] = useState<'gps' | 'treadmill'>('gps')
  const [voice, setVoice] = useState(true)
  const [live, setLive] = useState<LiveRun | null>(() => loadLive())
  const [done, setDone] = useState<Run | null>(null)
  const [manual, setManual] = useState(false)
  const [gps, setGps] = useState<GpsState>('off')
  const [acc, setAcc] = useState<number | null>(null)
  const [, setTick] = useState(0)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const liveRef = useRef<LiveRun | null>(live)
  liveRef.current = live
  const watch = useRef<number | null>(null)
  const wake = useRef<{ release: () => Promise<void> } | null>(null)
  const cue = useRef({ seg: -1, km: 0 })
  const voiceRef = useRef(voice)
  voiceRef.current = voice
  const say = (s: string) => { if (voiceRef.current) speak(s, lang) }

  const stopWatch = () => { if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current); watch.current = null }
  const startWatch = () => {
    if (!('geolocation' in navigator)) { setGps('unsupported'); return }
    stopWatch()
    setGps('searching')
    watch.current = navigator.geolocation.watchPosition((pos) => {
      const l = liveRef.current
      if (!l) return
      const f = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, t: pos.timestamp || Date.now() }
      setAcc(Math.round(f.acc))
      setGps(f.acc <= 25 ? 'good' : 'weak')
      if (l.pausedAt) return
      const r = acceptFix(l.last, f)
      if (!r.ok) return
      const next: LiveRun = { ...l, last: f, distanceM: l.distanceM + r.d, path: [...l.path, [f.lat, f.lng]], samples: [...l.samples, [l.distanceM + r.d, liveElapsed(l)]] }
      setLive(next); saveLive(next)
    }, (err) => {
      if (err.code === err.PERMISSION_DENIED) { setGps('denied'); stopWatch() } else setGps('searching')
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
  }
  const lockScreen = async () => {
    try { wake.current = await (navigator as unknown as { wakeLock?: { request: (k: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null } catch { /* not allowed */ }
  }

  // resume after reload
  useEffect(() => {
    if (live) { if (live.mode === 'gps') startWatch(); void lockScreen() }
    const id = setInterval(() => setTick((x) => x + 1), 1000)
    const vis = () => { if (document.visibilityState === 'visible' && liveRef.current) void lockScreen() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); stopWatch(); void wake.current?.release().catch(() => {}); document.removeEventListener('visibilitychange', vis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const elapsed = live ? liveElapsed(live) : 0
  // guided cues + km cues
  useEffect(() => {
    if (!live || live.pausedAt) return
    const s = segAt(live.kind, elapsed)
    if (s && s.i !== cue.current.seg) {
      cue.current.seg = s.i
      if (elapsed > 1) sfx.cue()
      say(`${t(`seg_${s.seg.kind}`)}. ${Math.round(s.seg.sec / 60)} ${t('min')}`)
    } else if (!s && RUN_PLANS[live.kind].length && cue.current.seg !== 999) {
      cue.current.seg = 999; sfx.win(); say(t('runPlanDone'))
    }
    const km = Math.floor(live.distanceM / 1000)
    if (km > cue.current.km) {
      cue.current.km = km
      const sp = splitsFrom(live.samples)
      sfx.cue()
      say(t('runKmCue', { k: km, p: fmtPace(sp[sp.length - 1]) }))
    }
  })

  const start = () => {
    sfx.prime()
    const l: LiveRun = { kind, mode, startedAt: Date.now(), pausedMs: 0, pausedAt: null, distanceM: 0, path: [], samples: [[0, 0]], last: null }
    cue.current = { seg: -1, km: 0 }
    setLive(l); saveLive(l)
    if (mode === 'gps') startWatch()
    void lockScreen()
    sfx.go()
    say(t('runGo'))
  }
  const pause = () => { if (!live) return; const n = { ...live, pausedAt: Date.now() }; setLive(n); saveLive(n); say(t('runPausedCue')) }
  const resume = () => { if (!live || !live.pausedAt) return; const n = { ...live, pausedMs: live.pausedMs + (Date.now() - live.pausedAt), pausedAt: null, last: null }; setLive(n); saveLive(n); say(t('runResumedCue')) }
  const finish = () => {
    if (!live) return
    stopWatch(); void wake.current?.release().catch(() => {})
    const dur = Math.round(liveElapsed(live))
    setDone({ id: 'draft', startedAt: new Date(live.startedAt).toISOString(), durationSec: dur, distanceM: Math.round(live.distanceM), mode: live.mode, kind: live.kind, path: thin(live.path), splits: splitsFrom(live.samples) })
    setLive(null); saveLive(null); setGps('off')
  }
  const toTreadmill = () => {
    stopWatch(); setGps('off'); setMode('treadmill')
    if (live) { const n: LiveRun = { ...live, mode: 'treadmill' }; setLive(n); saveLive(n) }
  }

  if (done) return <RunSummary run={done} onClose={() => { setDone(null); navigate('/progress?tab=runs') }} onDiscard={() => setDone(null)} />

  if (live) {
    const s = segAt(live.kind, elapsed)
    const plan = RUN_PLANS[live.kind]
    const avg = live.distanceM > 30 ? elapsed / (live.distanceM / 1000) : null
    const cur = currentPace(live.samples)
    const splits = splitsFrom(live.samples)
    return (
      <div data-testid="run-live">
        <Header title={t(`runKind_${live.kind}`)} sub={live.mode === 'gps' ? t('runGps') : t('runTreadmill')} />
        {live.mode === 'gps' && <GpsBanner t={t} gps={gps} acc={acc} onRetry={startWatch} onTreadmill={toTreadmill} />}
        {live.mode === 'gps' && <RunMap path={live.path} follow className="mb-3" />}
        <div className={`card hud-gold relative overflow-hidden p-4 ${live.pausedAt ? 'opacity-80' : ''}`}>
          <div className="grid grid-cols-2 gap-3">
            <Stat big label={t('runDistance')} value={live.mode === 'gps' ? fmtKm(live.distanceM) : '—'} unit="km" color="#22d3ee" testid="run-dist" />
            <Stat big label={t('runTime')} value={fmtClock(Math.round(elapsed))} color="#f7c548" testid="run-time" />
            <Stat label={t('runPaceNow')} value={live.mode === 'gps' ? fmtPace(cur) : '—'} unit="/km" color="#f472d0" />
            <Stat label={t('runPaceAvg')} value={live.mode === 'gps' ? fmtPace(avg) : '—'} unit="/km" color="#a3e635" />
          </div>
          {live.pausedAt && <div className="mt-3 rounded-xl border border-gold/40 bg-gold/10 py-1.5 text-center font-mono text-[12px] font-bold uppercase tracking-[0.2em] text-gold">{t('timerPaused')}</div>}
        </div>
        {plan.length > 0 && <PlanCard t={t} kind={live.kind} elapsed={elapsed} seg={s} />}
        {splits.length > 0 && <Splits t={t} splits={splits} />}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {live.pausedAt
            ? <Button size="lg" onClick={resume} data-testid="run-resume"><Play size={18} fill="currentColor" /> {t('resume')}</Button>
            : <Button size="lg" variant="outline" onClick={pause} data-testid="run-pause"><Pause size={18} /> {t('runPause')}</Button>}
          <Button size="lg" variant="danger" onClick={() => setConfirmEnd(true)} data-testid="run-finish"><Square size={16} fill="currentColor" /> {t('finish')}</Button>
        </div>
        <button onClick={() => setVoice(!voice)} className="mx-auto mt-3 flex items-center gap-1.5 text-[12px] text-muted">{voice ? <Volume2 size={14} /> : <VolumeX size={14} />} {t('runVoice')}</button>
        <Confirm open={confirmEnd} text={t('runFinishQ')} confirmLabel={t('finish')} cancelLabel={t('cancel')} onClose={() => setConfirmEnd(false)} onConfirm={finish} />
      </div>
    )
  }

  return (
    <div data-testid="run-setup">
      <Header title={t('runTitle')} sub={t('runSub')} back="#/train" />
      <div className="card hud-gold holo-sweep relative overflow-hidden p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan/40 bg-cyan/10"><Footprints size={22} className="text-cyan" /></span>
          <div className="min-w-0">
            <div className="title-hud text-[15px] text-cyan">{t('runTitle')}</div>
            <p className="text-[12.5px] leading-snug text-muted">{t('runHero')}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2" role="tablist">
          {(['gps', 'treadmill'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} data-testid={`run-mode-${m}`} onClick={() => setMode(m)} className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-[13px] font-bold ${mode === m ? 'border-cyan/60 bg-cyan/12 text-cyan' : 'border-white/10 text-muted'}`}>
              {m === 'gps' ? <MapPin size={15} /> : <Gauge size={15} />} {t(m === 'gps' ? 'runGps' : 'runTreadmill')}
            </button>
          ))}
        </div>
      </div>
      <Label className="mt-4">{t('runType')}</Label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {KINDS.map((k) => (
          <button key={k} data-testid={`run-kind-${k}`} onClick={() => setKind(k)} className={`card relative overflow-hidden p-3 text-left ${kind === k ? 'neon-border' : ''}`} style={kind === k ? { boxShadow: `0 0 0 1px ${KIND_COLOR[k]}aa, 0 0 22px -8px ${KIND_COLOR[k]}` } : undefined}>
            <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: KIND_COLOR[k] }} />
            <div className="title-hud text-[13px]" style={{ color: KIND_COLOR[k] }}>{t(`runKind_${k}`)}</div>
            <div className="mt-1 text-[11.5px] leading-snug text-muted">{t(`runKindD_${k}`)}</div>
            {planSec(k) > 0 && <div className="mt-1.5 font-mono text-[11px] text-frost/80"><Timer size={11} className="mr-1 inline" />{Math.round(planSec(k) / 60)} {t('min')}</div>}
          </button>
        ))}
      </div>
      {RUN_PLANS[kind].length > 1 && <PlanBar kind={kind} elapsed={0} />}
      {mode === 'gps' && gps === 'denied' && <GpsBanner t={t} gps={gps} acc={null} onRetry={startWatch} onTreadmill={toTreadmill} />}
      <div className="mt-4 flex items-center gap-2">
        <Button size="lg" className="flex-1" onClick={start} data-testid="run-start"><Play size={18} fill="currentColor" /> {t('runStart')}</Button>
        <button onClick={() => setVoice(!voice)} aria-label={t('runVoice')} className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 text-muted">{voice ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      </div>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => setManual(true)} data-testid="run-manual"><Plus size={15} /> {t('runAddManual')}</Button>
      <p className="mt-3 px-1 text-[11.5px] leading-snug text-dim">{t('runPrivacy')}</p>
      <RecentRuns />
      <ManualRun open={manual} onClose={() => setManual(false)} kind={kind} />
    </div>
  )
}

function currentPace(samples: [number, number][]): number | null {
  if (samples.length < 2) return null
  const [d1, t1] = samples[samples.length - 1]
  let j = samples.length - 2
  while (j > 0 && t1 - samples[j][1] < 30) j--
  const [d0, t0] = samples[j]
  const dd = d1 - d0
  return dd > 15 ? ((t1 - t0) / dd) * 1000 : null
}

function Stat({ label, value, unit, color, big, testid }: { label: string; value: string; unit?: string; color: string; big?: boolean; testid?: string }) {
  return (
    <div>
      <div className="label !text-[9.5px]">{label}</div>
      <div className={`font-display font-bold tabular-nums leading-none ${big ? 'mt-1 text-[40px]' : 'mt-1 text-[22px]'}`} style={{ color, textShadow: `0 0 18px ${color}55` }} data-testid={testid}>{value}{unit && <span className="ml-1 text-[12px] font-semibold text-dim">{unit}</span>}</div>
    </div>
  )
}

function GpsBanner({ t, gps, acc, onRetry, onTreadmill }: { t: T; gps: GpsState; acc: number | null; onRetry: () => void; onTreadmill: () => void }) {
  if (gps === 'denied' || gps === 'unsupported')
    return (
      <div className="mb-3 rounded-2xl border border-gold/35 bg-gold/[0.07] p-3" data-testid="run-gps-denied">
        <div className="flex items-start gap-2 text-[13px] leading-snug text-gold"><LocateOff size={16} className="mt-0.5 shrink-0" /> <span>{t(gps === 'denied' ? 'runGpsDenied' : 'runGpsNone')}</span></div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {gps === 'denied' && <Button size="sm" variant="ghost" onClick={onRetry}>{t('runTryAgain')}</Button>}
          <Button size="sm" variant="outline" className={gps === 'denied' ? '' : 'col-span-2'} onClick={onTreadmill}><Gauge size={14} /> {t('runUseTreadmill')}</Button>
        </div>
      </div>
    )
  return (
    <div className="mb-2 flex items-center gap-2 px-1 font-mono text-[11px]" data-testid="run-gps">
      <Satellite size={13} className={gps === 'good' ? 'text-ok' : 'text-gold'} />
      <span className={gps === 'good' ? 'text-ok' : 'text-gold'}>{t(gps === 'good' ? 'runGpsGood' : gps === 'weak' ? 'runGpsWeak' : 'runGpsSearch')}{acc !== null ? ` · ±${acc} m` : ''}</span>
    </div>
  )
}

function PlanBar({ kind, elapsed }: { kind: RunKind; elapsed: number }) {
  const plan = RUN_PLANS[kind], total = planSec(kind)
  return (
    <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
      {plan.map((s, i) => {
        const startT = plan.slice(0, i).reduce((n, x) => n + x.sec, 0)
        const fill = Math.max(0, Math.min(1, (elapsed - startT) / s.sec))
        return (
          <div key={i} className="relative h-full border-r border-[#04060c]/70" style={{ width: `${(s.sec / total) * 100}%`, background: `${SEG_COLOR[s.kind]}40` }}>
            <div className="absolute inset-y-0 left-0" style={{ width: `${fill * 100}%`, background: SEG_COLOR[s.kind] }} />
          </div>
        )
      })}
    </div>
  )
}

function PlanCard({ t, kind, elapsed, seg }: { t: T; kind: RunKind; elapsed: number; seg: ReturnType<typeof segAt> }) {
  return (
    <Card className="mt-3 p-4" data-testid="run-plan">
      {seg ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="label !text-[9.5px]">{t('runNow')}</div>
            <div className="title-hud text-[20px]" style={{ color: SEG_COLOR[seg.seg.kind] }}>{t(`seg_${seg.seg.kind}`)}</div>
            {seg.next && <div className="text-[11.5px] text-muted">{t('runNext')}: {t(`seg_${seg.next.kind}`)} · {fmtClock(seg.next.sec)}</div>}
          </div>
          <div className="text-right font-display text-[30px] font-bold tabular-nums" style={{ color: SEG_COLOR[seg.seg.kind] }}>{fmtClock(Math.ceil(seg.left))}</div>
        </div>
      ) : <div className="title-hud text-center text-[15px] text-ok">✓ {t('runPlanDone')}</div>}
      <PlanBar kind={kind} elapsed={elapsed} />
    </Card>
  )
}

function Splits({ t, splits }: { t: T; splits: number[] }) {
  const best = Math.min(...splits)
  return (
    <Card className="mt-3 p-4" data-testid="run-splits">
      <div className="mb-2 flex items-center gap-2"><Flag size={15} className="text-cyan" /><Label>{t('runSplits')}</Label></div>
      <ul className="space-y-1.5">
        {splits.map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-[13px]">
            <span className="w-10 font-mono text-dim">{i + 1} km</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full rounded-full" style={{ width: `${Math.max(12, (best / s) * 100)}%`, background: s === best ? '#f7c548' : '#22d3ee' }} /></span>
            <span className={`w-14 text-right font-mono tabular-nums ${s === best ? 'text-gold' : ''}`}>{fmtPace(s)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function RunSummary({ run, onClose, onDiscard }: { run: Run; onClose: () => void; onDiscard: () => void }) {
  const t = useT()
  const add = useRuns((s) => s.add)
  const toast = useApp((s) => s.showToast)
  const weight = useApp((s) => s.profile.weightKg)
  const [km, setKm] = useState(run.mode === 'gps' ? +(run.distanceM / 1000).toFixed(2) : 0)
  const [incline, setIncline] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const dist = run.mode === 'gps' ? run.distanceM : Math.round(km * 1000)
  const avg = dist > 30 ? run.durationSec / (dist / 1000) : null
  const save = () => {
    add({ ...run, distanceM: dist, inclinePct: run.mode === 'treadmill' && incline ? incline : undefined, splits: run.mode === 'gps' ? run.splits : [] })
    toast(t('runSaved'))
    onClose()
  }
  return (
    <div data-testid="run-summary">
      <Header title={t('runDone')} sub={t(`runKind_${run.kind}`)} />
      {run.path && run.path.length > 1 && <RunMap path={run.path} className="mb-3" />}
      <div className="card hud-gold p-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t('runDistance')} value={fmtKm(dist)} unit="km" color="#22d3ee" />
          <Stat label={t('runTime')} value={fmtClock(run.durationSec)} color="#f7c548" />
          <Stat label={t('runPaceAvg')} value={fmtPace(avg)} unit="/km" color="#a3e635" />
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted"><Flame size={13} className="text-gold" /> ≈ {runKcal(dist, weight)} kcal <span className="text-dim">({t('runKcalNote')})</span></div>
      </div>
      {run.mode === 'treadmill' && (
        <Card className="mt-3 space-y-3 p-4">
          <div><Label>{t('runTreadDist')}</Label><div className="mt-1.5"><Stepper value={km} onChange={(v) => setKm(Math.round(v * 100) / 100)} step={0.1} min={0} max={100} suffix="km" /></div></div>
          <div><Label>{t('runIncline')}</Label><div className="mt-1.5"><Stepper value={incline} onChange={setIncline} step={0.5} min={0} max={20} suffix="%" /></div></div>
        </Card>
      )}
      {run.splits.length > 0 && <Splits t={t} splits={run.splits} />}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="danger" onClick={() => setConfirm(true)}><Trash2 size={15} /> {t('runDiscard')}</Button>
        <Button onClick={save} disabled={dist <= 0 && run.durationSec <= 0} data-testid="run-save"><Flag size={15} /> {t('runSave')}</Button>
      </div>
      <Confirm open={confirm} danger text={t('runDiscardQ')} confirmLabel={t('runDiscard')} cancelLabel={t('cancel')} onClose={() => setConfirm(false)} onConfirm={onDiscard} />
    </div>
  )
}

function ManualRun({ open, onClose, kind }: { open: boolean; onClose: () => void; kind: RunKind }) {
  const t = useT()
  const add = useRuns((s) => s.add)
  const toast = useApp((s) => s.showToast)
  const [km, setKm] = useState(5)
  const [min, setMin] = useState(30)
  const [sec, setSec] = useState(0)
  const [incline, setIncline] = useState(0)
  const [tread, setTread] = useState(true)
  const [k, setK] = useState<RunKind>(kind)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  useEffect(() => setK(kind), [kind])
  const save = () => {
    const d = new Date(`${date}T${new Date().toTimeString().slice(0, 5)}`)
    add({ startedAt: (isNaN(d.getTime()) ? new Date() : d).toISOString(), durationSec: min * 60 + sec, distanceM: Math.round(km * 1000), mode: tread ? 'treadmill' : 'manual', kind: k, splits: [], inclinePct: tread && incline ? incline : undefined })
    toast(t('runSaved'))
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('runAddManual')}>
      <div className="space-y-3" data-testid="run-manual-sheet">
        <div className="grid grid-cols-2 gap-2">
          <Chip active={tread} onClick={() => setTread(true)}>{t('runTreadmill')}</Chip>
          <Chip active={!tread} onClick={() => setTread(false)}>{t('runOutdoor')}</Chip>
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">{KINDS.map((x) => <Chip key={x} active={k === x} color={KIND_COLOR[x]} onClick={() => setK(x)}>{t(`runKind_${x}`)}</Chip>)}</div>
        <div><Label>{t('runDistance')}</Label><div className="mt-1.5"><Stepper value={km} onChange={(v) => setKm(Math.round(v * 100) / 100)} step={0.1} min={0} max={200} suffix="km" /></div></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t('min')}</Label><div className="mt-1.5"><Stepper value={min} onChange={setMin} min={0} max={600} /></div></div>
          <div><Label>{t('sec')}</Label><div className="mt-1.5"><Stepper value={sec} onChange={setSec} min={0} max={59} /></div></div>
        </div>
        {tread && <div><Label>{t('runIncline')}</Label><div className="mt-1.5"><Stepper value={incline} onChange={setIncline} step={0.5} min={0} max={20} suffix="%" /></div></div>}
        <label className="block"><span className="label">{t('runDate')}</span><input type="date" className="field mt-1.5" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="font-mono text-[12px] text-muted">{t('runPaceAvg')}: {fmtPace(km > 0 ? (min * 60 + sec) / km : null)} /km</div>
        <Button className="w-full" onClick={save} disabled={km <= 0 || min * 60 + sec <= 0} data-testid="run-manual-save"><Flag size={15} /> {t('runSave')}</Button>
      </div>
    </Sheet>
  )
}

function RecentRuns() {
  const t = useT()
  const runs = useMyRuns()
  if (!runs.length) return null
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between"><Label>{t('runRecent')}</Label><button className="text-[12px] text-cyan" onClick={() => navigate('/progress?tab=runs')}><History size={12} className="mr-1 inline" />{t('runAll')}</button></div>
      <div className="space-y-2">{runs.slice(0, 3).map((r) => <RunRow key={r.id} r={r} />)}</div>
    </div>
  )
}

export function RunRow({ r, onClick }: { r: Run; onClick?: () => void }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  return (
    <Card className="flex items-center gap-3 p-3" onClick={onClick} data-testid="run-row">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border" style={{ borderColor: `${KIND_COLOR[r.kind]}66`, background: `${KIND_COLOR[r.kind]}14`, color: KIND_COLOR[r.kind] }}>{r.mode === 'gps' ? <MapPin size={17} /> : <Gauge size={17} />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[14px] font-bold"><span className="tabular-nums">{fmtKm(r.distanceM)} km</span><Badge tone="muted">{t(`runKind_${r.kind}`)}</Badge></div>
        <div className="text-[11.5px] text-muted">{fmtDate(r.startedAt, lang)} · {t(r.mode === 'gps' ? 'runGps' : r.mode === 'treadmill' ? 'runTreadmill' : 'runOutdoor')}</div>
      </div>
      <div className="text-right font-mono text-[12px] tabular-nums">
        <div>{fmtClock(r.durationSec)}</div>
        <div className="text-dim">{fmtPace(r.distanceM > 0 ? r.durationSec / (r.distanceM / 1000) : null)}/km</div>
      </div>
    </Card>
  )
}

/** Progress → Runs tab */
export function RunsHistory() {
  const t = useT()
  const runs = useMyRuns()
  const remove = useRuns((s) => s.remove)
  const [open, setOpen] = useState<Run | null>(null)
  const [del, setDel] = useState<string | null>(null)
  const stats = useMemo(() => {
    const wk = Date.now() - 7 * 864e5
    const total = runs.reduce((n, r) => n + r.distanceM, 0)
    const week = runs.filter((r) => new Date(r.startedAt).getTime() >= wk).reduce((n, r) => n + r.distanceM, 0)
    const longest = runs.reduce((n, r) => Math.max(n, r.distanceM), 0)
    const paces = runs.filter((r) => r.distanceM >= 1000).map((r) => r.durationSec / (r.distanceM / 1000))
    return { total, week, longest, best: paces.length ? Math.min(...paces) : null }
  }, [runs])
  return (
    <div data-testid="runs-history">
      <div className="mb-3 grid grid-cols-2 gap-2">
        {([[t('runWeek'), `${fmtKm(stats.week)} km`, '#22d3ee'], [t('runTotal'), `${fmtKm(stats.total)} km`, '#a78bfa'], [t('runLongest'), `${fmtKm(stats.longest)} km`, '#f7c548'], [t('runBestPace'), `${fmtPace(stats.best)}/km`, '#a3e635']] as const).map(([k, v, c]) => (
          <div key={k} className="card p-3"><div className="font-display text-[20px] font-bold tabular-nums" style={{ color: c }}>{v}</div><div className="text-[11px] text-muted">{k}</div></div>
        ))}
      </div>
      <Button className="mb-3 w-full" onClick={() => navigate('/train/run')}><Footprints size={16} /> {t('runStart')}</Button>
      {runs.length === 0 ? <p className="py-8 text-center text-[13px] text-muted">{t('runNone')}</p> : (
        <div className="space-y-2">{runs.map((r) => <RunRow key={r.id} r={r} onClick={() => setOpen(r)} />)}</div>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${fmtKm(open.distanceM)} km · ${t(`runKind_${open.kind}`)}` : ''}>
        {open && (
          <div className="space-y-3">
            {open.path && open.path.length > 1 && <RunMap path={open.path} />}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="card-2 p-2"><div className="font-mono text-[15px] font-bold">{fmtClock(open.durationSec)}</div><div className="text-[10.5px] text-muted">{t('runTime')}</div></div>
              <div className="card-2 p-2"><div className="font-mono text-[15px] font-bold">{fmtPace(open.distanceM > 0 ? open.durationSec / (open.distanceM / 1000) : null)}</div><div className="text-[10.5px] text-muted">{t('runPaceAvg')}</div></div>
              <div className="card-2 p-2"><div className="font-mono text-[15px] font-bold">{open.inclinePct ? `${open.inclinePct}%` : '—'}</div><div className="text-[10.5px] text-muted">{t('runIncline')}</div></div>
            </div>
            {open.splits.length > 0 && <Splits t={t} splits={open.splits} />}
            <Button variant="danger" className="w-full" onClick={() => { setDel(open.id); setOpen(null) }}><Trash2 size={15} /> {t('delete')}</Button>
          </div>
        )}
      </Sheet>
      <Confirm open={!!del} danger text={`${t('delete')}?`} confirmLabel={t('delete')} cancelLabel={t('cancel')} onClose={() => setDel(null)} onConfirm={() => del && remove(del)} />
    </div>
  )
}
