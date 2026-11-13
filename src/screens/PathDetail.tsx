import { CheckCircle2, Circle, Crosshair, Play } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Card, Header, Empty } from '../components/ui'
import { Photo } from '../components/hud'
import { LADDER_BY_ID } from '../data/ladders'
import { exOf, exName } from '../data/exercises'
import { navigate } from '../lib/router'
import { criterionText, ladderStatus } from '../lib/training'
import { itemFor, startWorkout } from '../lib/workout'

export function PathDetail({ id }: { id: string }) {
  const t = useT()
  const s = useApp()
  const l = LADDER_BY_ID[id]
  if (!l) return <div><Header title="—" back="#/library?tab=paths" /><Empty text={t('empty')} /></div>
  const st = ladderStatus(l, s.sessions)
  const cur = l.steps[st.current]
  const train = () => {
    if (!s.active) startWorkout(`${l.name} · ${exName(exOf(cur.exId), s.lang)}`, [{ ...itemFor(cur.exId), sets: cur.goal.sets, target: criterionText(cur.goal) }])
    navigate('/player')
  }
  return (
    <div>
      <Header title={l.name} sub={t('skillPaths')} back="#/library?tab=paths" />
      {l.media && (
        <div className="card hud-full scanlines holo-sweep relative -mt-1 mb-3 h-[220px] overflow-hidden">
          <Photo name={l.media} alt={t('photoOf', { x: l.name })} eager />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(4,6,12,0.92))]" />
          <div className="absolute bottom-3 left-4 z-[2] font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: l.accent }}>{t('stepOf', { n: st.current + 1, t: l.steps.length })}</div>
        </div>
      )}
      <p className="text-[14px] leading-relaxed text-frost/90">{l.summary}</p>
      <p className="mt-2 text-[12px] text-dim">{t('skillPathsSub')}</p>

      <div className="relative mt-4 space-y-2.5 pl-5">
        <span aria-hidden className="absolute bottom-4 left-[9px] top-4 w-px" style={{ background: `linear-gradient(${l.accent}, rgba(255,255,255,0.08))` }} />
        {l.steps.map((step, i) => {
          const ex = exOf(step.exId)
          const done = st.cleared[i]
          const isCur = i === st.current
          return (
            <Card key={step.exId} onClick={() => navigate(`/library/${ex.id}`)} className={`relative p-3.5 ${isCur ? 'hud-gold' : ''}`}>
              <span className="absolute -left-[21px] top-4 grid h-5 w-5 place-items-center rounded-full bg-ink">
                {done ? <CheckCircle2 size={18} style={{ color: l.accent }} /> : isCur ? <Crosshair size={18} className="text-gold" /> : <Circle size={16} className="text-dim" />}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-dim">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{exName(ex, s.lang)}</span>
                {done && <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: l.accent }}>{t('cleared')}</span>}
                {isCur && !done && <span className="font-mono text-[10px] uppercase tracking-wider text-gold">{t('currentStep')}</span>}
              </div>
              <div className="mt-1 text-[12.5px]"><span className="text-cyan">{t('goalLbl')}:</span> <span className="font-mono">{criterionText(step.goal)}</span></div>
              <p className="mt-1 text-[12.5px] leading-snug text-muted">{step.tip}</p>
            </Card>
          )
        })}
      </div>
      <Button className="mt-4 w-full" onClick={train}><Play size={16} fill="currentColor" /> {s.active ? t('resume') : `${t('startHere')} · ${exName(exOf(cur.exId), s.lang)}`}</Button>
    </div>
  )
}
