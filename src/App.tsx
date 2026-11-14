import { lazy, Suspense, useEffect, useState } from 'react'
import { Beam } from './components/Beam'
import { useUnlocks } from './lib/unlocks'
import { usePostPasses } from './lib/postPasses'
import { Home as HomeIcon, Dumbbell, ScanLine, BookOpen, LineChart, User, Play, Pause, Square } from 'lucide-react'
import { useRoute, navigate } from './lib/router'
import { useApp } from './store/app'
import { useT } from './i18n'
import { isLive } from './lib/env'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Train } from './screens/Train'
import { ProgramDetail } from './screens/ProgramDetail'
import { Builder } from './screens/Builder'
import { Player } from './screens/Player'
import { Library } from './screens/Library'
import { ExerciseDetail } from './screens/ExerciseDetail'
import { Progress } from './screens/Progress'
import { Fuel } from './screens/Fuel'
import { Profile } from './screens/Profile'
import { Membership } from './screens/Membership'
import { Legal } from './screens/Legal'
import { Auth } from './screens/Auth'
import { PathDetail } from './screens/PathDetail'
import { Cosmos } from './components/Cosmos'
import { Settings } from './screens/Settings'
import { Knowledge, KnowledgePost } from './screens/Knowledge'
import { NotFound } from './screens/NotFound'
import { NeonInputs } from './components/NeonInputs'
import { Downloads } from './screens/Downloads'
import { useDownloads, onWifi, persistStorage } from './lib/downloads'
import { trustedNow } from './lib/plans'
import { downloadAccess } from './lib/entitlements'
import { InstallPrompt } from './components/InstallPrompt'
import { useSettings, applyTheme } from './store/settings'
import { useReminders } from './lib/reminders'
import { ClipViewer, GradDefs } from './components/hud'
import { EndWorkoutSheet, SessionClock } from './components/EndWorkout'

const Analyze = lazy(() => import('./screens/Analyze'))

const NAV = [
  { id: 'home', icon: HomeIcon, key: 'navHome' },
  { id: 'train', icon: Dumbbell, key: 'navTrain' },
  { id: 'analyze', icon: ScanLine, key: 'navAnalyze' },
  { id: 'library', icon: BookOpen, key: 'navLibrary' },
  { id: 'progress', icon: LineChart, key: 'navProgress' },
  { id: 'profile', icon: User, key: 'navProfile' },
] as const

function BottomNav({ current }: { current: string }) {
  const t = useT()
  return (
    <nav className="nav-bar safe-bottom fixed inset-x-0 bottom-0 z-40 bg-[#04060c]/85 backdrop-blur-xl" aria-label="Main">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#f7c548,#22d3ee,transparent)] opacity-60" />
      <div className="relative mx-auto grid max-w-lg grid-cols-6 px-1">
        {NAV.map(({ id, icon: Icon, key }) => {
          const active = current === id
          return (
            <button key={id} onClick={() => navigate('/' + id)} aria-current={active ? 'page' : undefined} className="relative flex h-[62px] flex-col items-center justify-center gap-1">
              <span className={`relative z-[1] grid h-7 w-12 place-items-center rounded-full transition-all duration-300 ${active ? 'text-gold drop-shadow-[0_0_6px_rgba(247,197,72,0.55)]' : 'text-dim'}`}>
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={`relative z-[1] font-ui text-[10px] font-semibold uppercase leading-none tracking-[0.06em] transition-colors duration-300 ${active ? 'text-gold' : 'text-dim'}`}>{t(key)}</span>
            </button>
          )
        })}
        <Beam dep={current} variant="nav" />
      </div>
    </nav>
  )
}

function ResumeBar() {
  const active = useApp((s) => s.active)
  const t = useT()
  const [end, setEnd] = useState(false)
  if (!active) return null
  return (
    <>
      <div data-testid="resume-bar" className={`neon-border neon-shadow fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[480px] items-center gap-2 rounded-2xl bg-[#0b1420]/95 py-2 pl-3 pr-2 backdrop-blur-xl`}>
        <button onClick={() => navigate('/player')} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${active.pausedAt ? 'border border-gold/50 bg-gold/10 text-gold' : 'bg-neon-static text-[#060a14]'}`}>{active.pausedAt ? <Pause size={15} /> : <Play size={16} fill="currentColor" />}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{active.name}</span>
            <span className={`text-xs ${active.pausedAt ? 'text-gold' : 'text-muted'}`}>{active.pausedAt ? t('timerPaused') : t('resume')}</span>
          </span>
          <SessionClock a={active} className="font-mono text-sm tabular-nums text-cyan" />
        </button>
        <button aria-label={t('endWorkout')} data-testid="resume-end" onClick={() => setEnd(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-bad/30 bg-bad/10 text-bad"><Square size={14} fill="currentColor" /></button>
      </div>
      <EndWorkoutSheet open={end} onClose={() => setEnd(false)} onFinished={(r) => {
        if (r) { { const n = r.session.exercises.reduce((m, e) => m + e.sets.length, 0); useApp.getState().showToast(t(n === 1 ? 'workoutSaved1' : 'workoutSaved', { n })) }; navigate('/progress') }
      }} />
    </>
  )
}

function Toast() {
  const toast = useApp((s) => s.toast)
  if (!toast) return null
  return (
    <div role="status" className="rise fixed inset-x-4 top-[calc(env(safe-area-inset-top)+12px)] z-[60] mx-auto max-w-sm rounded-2xl border border-white/10 bg-[#121822] px-4 py-3 text-center text-sm font-medium shadow-2xl">
      {toast}
    </div>
  )
}

export default function App() {
  const parts = useRoute()
  const hasActive = useApp((s) => !!s.active)
  const onboarded = useApp((s) => s.onboarded)
  const lang = useApp((s) => s.lang)
  const [root, a, b] = parts
  const t = useT()

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const theme = useSettings((s) => s.theme)
  const units = useSettings((s) => `${s.weightUnit}${s.lengthUnit}`)
  const accountKey = useApp((s) => s.user?.id ?? 'guest')
  // clock tick: passes + grace periods end on time (and the trusted clock keeps moving forward)
  const [, setTick] = useState(0)
  useEffect(() => {
    trustedNow()
    const id = setInterval(() => { trustedNow(); setTick((x) => x + 1) }, 60_000)
    return () => clearInterval(id)
  }, [])
  // in-app downloads: load this account's list; after a reinstall, re-download on Wi-Fi if allowed
  useEffect(() => {
    void useUnlocks.getState().refresh()
    void usePostPasses.getState().refresh()
    void useDownloads.getState().refresh().then(() => {
      const { list, present, restoreMissing } = useDownloads.getState()
      const missing = list.some((x) => !present[x.item_id])
      if (missing && useSettings.getState().dlAutoWifi && onWifi() && downloadAccess(useApp.getState().membership).state !== 'locked') void restoreMissing()
      if (list.length) void persistStorage()
    })
  }, [accountKey])
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const on = () => applyTheme('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [theme])
  useReminders()

  useEffect(() => {
    if (onboarded && !root) navigate('/home')
  }, [onboarded, root])

  if (!onboarded && root !== 'legal' && root !== 'auth') return (<><Cosmos /><GradDefs /><Onboarding key={accountKey} /><Toast /><NeonInputs /></>)

  let screen: React.ReactNode
  let showNav = true
  switch (root) {
    case 'train':
      if (a === 'program' && b) screen = <ProgramDetail id={b} />
      else if (a === 'builder') screen = <Builder editId={b} />
      else screen = <Train />
      break
    case 'player': screen = <Player />; showNav = false; break
    case 'analyze': screen = <Suspense fallback={<div className="p-8 text-center text-muted">…</div>}><Analyze /></Suspense>; break
    case 'library': screen = a ? <ExerciseDetail id={a} /> : <Library />; break
    case 'progress': screen = <Progress />; break
    case 'fuel': screen = <Fuel />; break
    case 'profile': screen = <Profile />; break
    case 'membership': screen = <Membership />; break
    case 'legal': screen = <Legal doc={a ?? 'privacy'} />; showNav = onboarded; break
    case 'path': screen = <PathDetail id={a ?? ''} />; break
    case 'auth': screen = <Auth />; showNav = false; break
    case 'settings': screen = <Settings />; break
    case 'downloads': screen = <Downloads />; break
    case 'knowledge': screen = a ? <KnowledgePost id={decodeURIComponent(a)} /> : <Knowledge />; break
    case 'home': case undefined: case '': screen = <Home />; break
    default: screen = <NotFound />
  }
  const navId = NAV.some((n) => n.id === root) ? root : root === 'fuel' ? 'home' : root === 'path' ? 'library' : root === 'membership' || root === 'settings' ? 'profile' : root === 'knowledge' ? 'library' : ''

  return (
    <div className="relative z-[1] mx-auto min-h-dvh max-w-lg px-4">
      <Cosmos />
      <GradDefs />
      {!isLive && (
        <div className="-mx-4 flex items-center justify-center gap-2 bg-[linear-gradient(90deg,rgba(245,185,66,0.12),rgba(251,146,60,0.12))] px-4 py-1.5 text-center text-[11px] font-medium leading-tight text-gold">
          <span className="rounded bg-gold px-1 font-mono text-[9px] font-bold text-black">{t('demo')}</span>
          <span>{t('demoBanner')}</span>
        </div>
      )}
      <main className={showNav ? (hasActive ? 'pb-nav-resume' : 'pb-nav') : 'pb-8'}>
        <div key={`${window.location.hash}|${units}|${accountKey}`} className="rise">{screen}</div>
      </main>
      {showNav && root !== 'player' && <ResumeBar />}
      {showNav && <BottomNav current={navId} />}
      <ClipViewer />
      {showNav && <InstallPrompt />}
      <Toast />
      <NeonInputs />
    </div>
  )
}
