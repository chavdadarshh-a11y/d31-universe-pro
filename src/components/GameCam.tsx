/** Live camera rep counter for Game mode (MediaPipe pose, runs on the phone — video never leaves it). */
import { useEffect, useRef, useState } from 'react'
import { Camera, SwitchCamera } from 'lucide-react'
import { drawPose, getLandmarker } from '../lib/pose'
import { CamReps, type CamKind, type RepEvent } from '../lib/repCam'
import { useT } from '../i18n'

export function GameCam({ kind, active, onRep, onState }: { kind: CamKind; active: boolean; onRep: (e: RepEvent) => void; onState?: (s: 'loading' | 'running' | 'denied' | 'error') => void }) {
  const t = useT()
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const counter = useRef(new CamReps(kind))
  const raf = useRef(0)
  const [state, setState] = useState<'loading' | 'running' | 'denied' | 'error'>('loading')
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [seen, setSeen] = useState(true)
  const [ang, setAng] = useState<number | null>(null)
  const cb = useRef({ onRep, active })
  cb.current = { onRep, active }
  useEffect(() => { counter.current = new CamReps(kind) }, [kind])
  const set = (s: typeof state) => { setState(s); onState?.(s) }

  useEffect(() => {
    let dead = false
    set('loading')
    ;(async () => {
      try {
        const [pl, media] = await Promise.all([
          getLandmarker('VIDEO'),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 960 }, height: { ideal: 720 } }, audio: false }),
        ])
        if (dead) { media.getTracks().forEach((x) => x.stop()); return }
        stream.current = media
        const v = video.current!
        v.srcObject = media
        await v.play()
        set('running')
        let last = -1
        const loop = () => {
          if (dead || !stream.current) return
          if (v.readyState >= 2 && v.currentTime !== last) {
            last = v.currentTime
            const c = canvas.current!
            if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight }
            const ctx = c.getContext('2d')!
            ctx.clearRect(0, 0, c.width, c.height)
            const r = pl.detectForVideo(v, performance.now())
            const lm = r.landmarks[0]
            if (lm) {
              drawPose(ctx, lm, c.width, c.height, { mirror: false })
              if (cb.current.active) {
                const e = counter.current.update(lm)
                setSeen(e.visible); setAng(e.angle)
                if (e.counted) cb.current.onRep(e)
              }
            } else setSeen(false)
          }
          raf.current = requestAnimationFrame(loop)
        }
        loop()
      } catch (e) {
        const name = (e as { name?: string })?.name
        set(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      }
    })()
    return () => { dead = true; cancelAnimationFrame(raf.current); stream.current?.getTracks().forEach((x) => x.stop()); stream.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing])

  const mirror = facing === 'user'
  return (
    <div className="dark-zone relative aspect-[3/4] overflow-hidden rounded-[22px] border border-cyan/25 bg-[#05070a]" data-testid="game-cam">
      <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${mirror ? '-scale-x-100' : ''} ${state === 'running' ? '' : 'opacity-0'}`} />
      <canvas ref={canvas} className={`absolute inset-0 h-full w-full object-cover ${mirror ? '-scale-x-100' : ''}`} />
      {state !== 'running' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet/12 text-violet"><Camera size={26} /></span>
          <p className="max-w-[250px] text-[13px] leading-relaxed text-muted">{state === 'denied' ? t('camDenied') : state === 'error' ? t('gameCamErr') : t('camLoading')}</p>
        </div>
      )}
      {state === 'running' && !seen && <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-3 py-2 text-center text-[12.5px] text-gold">{t(kind === 'jacks' ? 'gameCamFull' : 'camNoBody')}</div>}
      {state === 'running' && ang !== null && <div className="absolute right-3 top-3 rounded-lg bg-black/70 px-2 py-1 font-mono text-[11px] text-white">{Math.round(ang)}°</div>}
      <button onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/60 text-white" aria-label="Flip camera"><SwitchCamera size={15} /></button>
    </div>
  )
}
