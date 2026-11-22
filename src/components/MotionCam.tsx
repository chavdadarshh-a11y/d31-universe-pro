/**
 * Full-screen front camera + overlay canvas for the motion games. MediaPipe pose (lite, GPU→CPU fallback) runs
 * on the phone; the video never leaves it. Test hook: if `window.__d31PoseSource` is a function (set by the test
 * runner before the app loads), no camera / model is used — it is called every frame for synthetic landmarks.
 */
import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw } from 'lucide-react'
import { getLandmarker } from '../lib/pose'
import type { Pt } from '../lib/poseFilter'
import { useT } from '../i18n'

export type PoseSource = (tMs: number) => Pt[] | null
declare global { interface Window { __d31PoseSource?: PoseSource } }
export type CamState = 'loading' | 'running' | 'denied' | 'error'
export type FrameFn = (lm: Pt[] | null, dt: number, aspect: number, ctx: CanvasRenderingContext2D, w: number, h: number) => void

export function MotionCam({ mirror, onFrame, onState }: { mirror: boolean; onFrame: FrameFn; onState?: (s: CamState) => void }) {
  const t = useT()
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<CamState>('loading')
  const [attempt, setAttempt] = useState(0)
  const cb = useRef({ onFrame, onState })
  cb.current = { onFrame, onState }
  const synthetic = typeof window !== 'undefined' && typeof window.__d31PoseSource === 'function'

  useEffect(() => {
    let dead = false, raf = 0
    let stream: MediaStream | null = null
    const set = (s: CamState) => { if (!dead) { setState(s); cb.current.onState?.(s) } }
    set('loading')
    const c = canvas.current!
    const ctx = c.getContext('2d')!
    let lastT = 0
    const tick = (lm: Pt[] | null, now: number) => {
      const dt = lastT ? (now - lastT) / 1000 : 0
      lastT = now
      ctx.clearRect(0, 0, c.width, c.height)
      cb.current.onFrame(lm, dt, c.width / c.height, ctx, c.width, c.height)
    }
    if (synthetic) {
      c.width = 480; c.height = 640
      set('running')
      let last = 0
      const loop = (now: number) => {
        if (dead) return
        if (now - last >= 32) { last = now; tick(window.__d31PoseSource!(now), now) } // ~30 fps
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => { dead = true; cancelAnimationFrame(raf) }
    }
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no camera'), { name: 'NotSupportedError' })
        const [pl, media] = await Promise.all([
          getLandmarker('VIDEO'),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } }, audio: false }),
        ])
        if (dead) { media.getTracks().forEach((x) => x.stop()); return }
        stream = media
        const v = video.current!
        v.srcObject = media
        await v.play()
        set('running')
        let lastVt = -1, slow = 0, skip = false, lastLm: Pt[] | null = null
        const loop = () => {
          if (dead) return
          if (v.readyState >= 2 && v.currentTime !== lastVt) {
            lastVt = v.currentTime
            if (c.width !== v.videoWidth || c.height !== v.videoHeight) { c.width = v.videoWidth; c.height = v.videoHeight }
            const now = performance.now()
            // mid-range phones: if inference is slow, run it every other frame and reuse the last pose
            if (!skip) {
              const r = pl.detectForVideo(v, now)
              slow = slow * 0.9 + (performance.now() - now) * 0.1
              lastLm = (r.landmarks[0] as Pt[] | undefined) ?? null
            }
            skip = slow > 45 ? !skip : false
            tick(lastLm, now)
          }
          raf = requestAnimationFrame(loop)
        }
        loop()
      } catch (e) {
        const name = (e as { name?: string })?.name
        set(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      }
    })()
    return () => { dead = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((x) => x.stop()) }
  }, [attempt, synthetic])

  const flip = mirror ? '-scale-x-100' : ''
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#03050a]" data-testid="motion-cam" data-cam-state={state}>
      {synthetic && <div className="absolute inset-0 game-grid opacity-60" />}
      <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${flip} ${state === 'running' && !synthetic ? '' : 'opacity-0'}`} />
      <canvas ref={canvas} className={`absolute inset-0 h-full w-full object-cover ${flip}`} data-testid="motion-canvas" />
      {state !== 'running' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-8 text-center" data-testid={`motion-cam-${state}`}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan/30 bg-cyan/10 text-cyan"><Camera size={26} /></span>
          <p className="max-w-[280px] text-[13.5px] leading-relaxed text-frost/90">{state === 'denied' ? t('mgCamDenied') : state === 'error' ? t('mgCamError') : t('camLoading')}</p>
          {(state === 'denied' || state === 'error') && (
            <button onClick={() => setAttempt((a) => a + 1)} className="mt-1 flex h-11 items-center gap-2 rounded-2xl border border-gold/50 bg-gold/10 px-5 text-[14px] font-bold text-gold" data-testid="motion-cam-retry"><RotateCcw size={15} /> {t('mgTryAgain')}</button>
          )}
        </div>
      )}
    </div>
  )
}
