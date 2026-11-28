import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellOff, Check, Flame, Play, Share2, Download, Sparkles, ChevronRight, Settings2 } from 'lucide-react'
import { useApp } from '../store/app'
import { useSettings } from '../store/settings'
import { useT } from '../i18n'
import { Button, Sheet } from './ui'
import { openClip } from './hud'
import { navigate } from '../lib/router'
import { exOf, exName } from '../data/exercises'
import { estimateMinutes } from '../lib/plan'
import { startWorkout } from '../lib/workout'
import { dayKey } from '../lib/util'
import { bestStreak, dailyPlan, isDoneOn, streak, weekStrip } from '../lib/habits'
import { cloud } from '../lib/cloud'
import { askLogin } from '../lib/loginAsk'
import { askNotificationPermission, reminderSupport } from '../lib/reminders'
import { drawShareCard, shareOrDownload } from '../lib/shareCard'
import { useKnowledge, visiblePosts, kImg, postTitle } from '../lib/knowledge'
import { APP_URL, SITE_URL } from '../config/site'

const SEEN = 'd31-new-seen'

/** Newest D31 post (highest number with real files) — first thing on Today. */
export function NewPostCard() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const { data } = useKnowledge()
  const post = useMemo(() => visiblePosts(data).filter((p) => !p.locked).sort((a, b) => b.number - a.number)[0], [data])
  const [seen] = useState(() => { try { return localStorage.getItem(SEEN) } catch { return null } })
  if (!post) return null
  const isNew = seen !== post.id
  const open = () => { try { localStorage.setItem(SEEN, post.id) } catch { /* ignore */ } navigate(`/knowledge/${post.number}`) }
  const vids = Object.values(post.videos).reduce((n, xs) => n + xs.length, 0)
  return (
    <button data-testid="new-post" data-post={post.number} onClick={open} className="neon-border relative mt-4 flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-[#0b1420]/90 p-2.5 text-left">
      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gold/40 bg-white/5">
        {post.cover && <img src={kImg(post.cover.id, 200)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
        {vids > 0 && <span className="absolute inset-0 grid place-items-center bg-black/25"><Play size={18} fill="currentColor" className="text-white drop-shadow" /></span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {isNew ? <span className="rounded-md bg-gold px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-black">{t('newLbl')}</span> : null}
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-cyan/85">{t('latestLbl')}</span>
        </span>
        <span className="mt-1 block truncate text-[15px] font-bold">#{post.number} · {postTitle(post, lang)}</span>
      </span>
      <span className="flex items-center gap-0.5 text-[12px] font-semibold text-gold">{t('newPostOpen')} <ChevronRight size={15} /></span>
    </button>
  )
}

/** First-visit hint: personalising is optional (no wall). */
export function SetupCard() {
  const t = useT()
  const onboarded = useApp((s) => s.onboarded)
  if (onboarded) return null
  return (
    <div data-testid="setup-card" className="card mt-3 flex items-center gap-3 p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan/30 bg-cyan/10 text-cyan"><Settings2 size={18} /></span>
      <div className="min-w-0 flex-1"><div className="text-[14px] font-bold">{t('setupTitle')}</div><div className="text-[12px] leading-snug text-muted">{t('setupSub')}</div></div>
      <Button size="sm" variant="outline" onClick={() => navigate('/setup')} data-testid="setup-open">{t('setupBtn')}</Button>
    </div>
  )
}

export function useStreak() {
  const sessions = useApp((s) => s.sessions)
  const doneDays = useApp((s) => s.doneDays)
  return useMemo(() => ({ now: streak(sessions, doneDays ?? []), best: bestStreak(sessions, doneDays ?? []), week: weekStrip(sessions, doneDays ?? []), today: isDoneOn(dayKey(), sessions, doneDays ?? []) }), [sessions, doneDays])
}

/** Today: 10–15 min plan + one-tap Workout done + streak + reminder + share. All works as a guest. */
export function DailyPlanCard() {
  const t = useT()
  const s = useApp()
  const st = useStreak()
  const [share, setShare] = useState(false)
  const plan = useMemo(() => dailyPlan(new Date(), s.profile.goal, s.profile.level), [s.profile.goal, s.profile.level])
  const mins = estimateMinutes(plan.items)
  const doneTap = s.doneDays?.includes(dayKey())
  const focusName = t(`focus_${plan.focus}`)
  const streakTxt = (n: number) => (n === 1 ? t('streakDay1') : t('streakDays', { n }))

  const start = () => {
    if (!s.active) startWorkout(`D31 · ${focusName} · ${mins} ${t('min')}`, plan.items)
    navigate('/player')
  }
  const done = () => {
    s.markDone()
    void cloud.workoutDone(dayKey(), mins, plan.focus)
    const n = streak(useApp.getState().sessions, useApp.getState().doneDays)
    s.showToast(n === 1 ? t('dpDoneToast1') : t('dpDoneToast', { n }))
    void cloud.habits({ ...habitRow(), best_streak: bestStreak(useApp.getState().sessions, useApp.getState().doneDays) })
    setTimeout(() => askLogin('streak'), 900)
  }
  const undo = () => { s.unmarkDone(); void cloud.undoWorkoutDone(dayKey()) }

  return (
    <section data-testid="daily-plan" className="card neon-shadow relative mt-4 overflow-hidden p-4">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,#f7c548,#22d3ee)]" />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/90">{t('dpTitle')}</div>
          <h2 className="mt-1 text-[19px] font-bold leading-tight">{focusName} <span className="text-cyan">· ~{mins} {t('min')}</span></h2>
          <p className="mt-0.5 text-[12px] text-muted">{t('dpSub')}</p>
        </div>
        <div data-testid="streak-chip" className="flex shrink-0 flex-col items-center rounded-2xl border border-gold/40 bg-gold/10 px-3 py-1.5">
          <span className="flex items-center gap-1 font-ui text-[22px] font-bold tabular-nums text-gold"><Flame size={17} /><span data-testid="streak-n">{st.now}</span></span>
          <span className="text-[10px] uppercase tracking-wider text-gold/80">{t('streakLbl')}</span>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {plan.items.map((it) => { const ex = exOf(it.exId); return (
          <li key={it.exId} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[13.5px]">
            {ex.clip ? <button aria-label={t('playClip')} onClick={() => openClip({ name: ex.clip!, title: exName(ex, s.lang), exId: ex.id })} className="text-gold">▶</button> : <span className="h-1.5 w-1.5 rounded-full bg-cyan" />}
            <button className="min-w-0 flex-1 truncate text-left" onClick={() => navigate(`/library/${ex.id}`)}>{exName(ex, s.lang)}</button>
            <span className="font-mono text-[12px] text-cyan/90">{it.sets}×{it.reps ?? `${it.secs}s`}</span>
          </li>
        ) })}
      </ul>
      {/* last 7 days — real data only */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-dim">{t('weekLbl')}</span>
        <div className="flex flex-1 justify-end gap-1.5" data-testid="week-strip">
          {st.week.map((d) => <span key={d.day} title={d.day} className={`h-5 w-5 rounded-md ${d.done ? 'bg-cyan shadow-[0_0_8px_rgba(34,211,238,0.7)]' : 'border border-white/15'}`} />)}
        </div>
      </div>
      <p className="mt-1 text-right text-[11px] text-muted">{st.now ? `${streakTxt(st.now)} · ${t('bestStreak', { n: st.best })}` : t('streakNone')}</p>
      <div className="mt-3 flex gap-2">
        {st.today ? (
          <>
            <div data-testid="done-today" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-lime/40 bg-lime/10 text-[14px] font-bold text-lime"><Check size={17} strokeWidth={3} /> {t('dpDoneToday')}</div>
            <Button variant="gold" onClick={() => setShare(true)} data-testid="share-open"><Share2 size={16} /> {t('dpShare')}</Button>
          </>
        ) : (
          <>
            <Button className="flex-1" variant="outline" onClick={start} data-testid="dp-start"><Play size={16} fill="currentColor" /> {t('dpStart')}</Button>
            <Button className="flex-1" onClick={done} data-testid="dp-done"><Check size={17} strokeWidth={3} /> {t('dpDone')}</Button>
          </>
        )}
      </div>
      {doneTap && <button onClick={undo} data-testid="dp-undo" className="mt-1.5 w-full text-center text-[11.5px] text-dim underline">{t('dpUndo')}</button>}
      <ReminderRow />
      <ShareSheet open={share} onClose={() => setShare(false)} focus={focusName} mins={mins} />
    </section>
  )
}

const habitRow = () => { const r = useSettings.getState().reminder; return { reminder_enabled: r.enabled, reminder_time: r.time, reminder_days: r.days } }

function ReminderRow() {
  const t = useT()
  const r = useSettings((s) => s.reminder)
  const set = useSettings((s) => s.set)
  const toast = useApp((s) => s.showToast)
  const [sup, setSup] = useState(() => reminderSupport())
  const save = (p: Partial<typeof r>) => {
    const next = { ...r, ...p }
    set({ reminder: next })
    void cloud.habits({ reminder_enabled: next.enabled, reminder_time: next.time, reminder_days: next.days, best_streak: bestStreak(useApp.getState().sessions, useApp.getState().doneDays) })
  }
  const turnOn = async () => {
    const p = await askNotificationPermission()
    setSup(reminderSupport())
    if (p === 'granted') save({ enabled: true })
    else toast(p === 'unsupported' ? t('remUnsupported') : t('remDenied'))
  }
  const note = sup === 'ios-browser' ? t('remIos') : sup === 'unsupported' ? t('remUnsupported') : sup === 'denied' ? t('remDenied') : t('remHonest')
  return (
    <div data-testid="reminder-row" className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <span className={r.enabled ? 'text-gold' : 'text-muted'}>{r.enabled ? <Bell size={17} /> : <BellOff size={17} />}</span>
        <span className="flex-1 text-[13.5px] font-semibold">{t('remTitle')}{r.enabled ? <span className="ml-1 font-normal text-cyan"> {t('remOnAt', { t: r.time })}</span> : null}</span>
        <input aria-label={t('timeLbl')} data-testid="reminder-time" type="time" value={r.time} onChange={(e) => e.target.value && save({ time: e.target.value })} className="field !h-9 w-[124px] shrink-0 !px-2 text-[13px]" />
        {sup === 'ok' || r.enabled ? (
          <Button size="sm" variant={r.enabled ? 'ghost' : 'primary'} data-testid="reminder-btn" onClick={() => (r.enabled ? save({ enabled: false }) : void turnOn())}>{r.enabled ? t('remTurnOff') : t('remTurnOn')}</Button>
        ) : null}
      </div>
      <p data-testid="reminder-note" className="mt-1.5 text-[11px] leading-snug text-dim">{note}</p>
    </div>
  )
}

export function ShareSheet({ open, onClose, focus, mins }: { open: boolean; onClose: () => void; focus: string; mins: number }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const st = useStreak()
  const toast = useApp((s) => s.showToast)
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!open) { setReady(false); return }
    let live = true
    const locale = lang === 'en' ? 'en-IN' : `${lang}-IN`
    void drawShareCard({
      headline: t('scHeadline'),
      streakText: st.now === 1 ? t('scStreak1') : t('scStreak', { n: st.now }),
      sub: `${focus} · ${mins} ${t('min')}`,
      dateText: new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      site: SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      week: st.week.map((d) => d.done),
    }).then((c) => {
      if (!live || !box.current) return
      c.className = 'mx-auto block h-auto w-full max-w-[260px] rounded-2xl border border-gold/30'
      c.setAttribute('data-testid', 'share-canvas')
      box.current.replaceChildren(c)
      canvas.current = c
      setReady(true)
    })
    return () => { live = false }
  }, [open, lang, st.now, focus, mins]) // eslint-disable-line react-hooks/exhaustive-deps
  const go = async () => {
    if (!canvas.current) return
    const r = await shareOrDownload(canvas.current, t('scText'), SITE_URL || APP_URL)
    if (r === 'downloaded') toast(t('scSaved'))
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('scTitle')}>
      <div data-testid="share-card">
        <div ref={box} className="min-h-[200px]" />
        <Button className="mt-4 w-full" disabled={!ready} onClick={() => void go()} data-testid="share-go"><Share2 size={16} /> {t('scShareBtn')}</Button>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px] text-dim"><Download size={12} /> {t('scDownload')} · <Sparkles size={12} /> D31.UNIVERSE</p>
      </div>
    </Sheet>
  )
}
