/**
 * Read an uploaded lift video on this device and measure per-frame joint angles
 * with MediaPipe Pose. The file is never uploaded.
 */
import { getLandmarker } from '../pose'
import { buildPose } from '../formCheck'
import type { Pt } from '../poseFilter'
import type { FrameMetrics, FrameView } from './momentSearch'

function kneeRatioOf(lm: Pt[], view: FrameView, aspect: number): number | undefined {
  if (view === 'side') return undefined
  const lk = lm[25], rk = lm[26], la = lm[27], ra = lm[28]
  if (!lk || !rk || !la || !ra) return undefined
  const kneeS = Math.hypot((lk.x - rk.x) * aspect, lk.y - rk.y)
  const ankS = Math.hypot((la.x - ra.x) * aspect, la.y - ra.y)
  if (ankS < 0.02) return undefined
  return kneeS / ankS
}

function metricsAt(lm: Pt[] | null, W: number, H: number, t: number): FrameMetrics {
  const pose = buildPose(lm, W, H)
  const m = pose.metrics
  return {
    t,
    ok: pose.ok,
    view: pose.ok ? pose.view : 'unknown',
    knee: m.knee?.v,
    hip: m.hip?.v,
    elbow: m.elbow?.v,
    trunkLean: m.trunkLean?.v,
    kneeRatio: lm && pose.ok ? kneeRatioOf(lm, pose.view, W / (H || 1)) : undefined,
  }
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done)
      resolve()
    }
    video.addEventListener('seeked', done)
    try {
      video.currentTime = Math.min(Math.max(0, t), Math.max(0, (video.duration || t) - 0.001))
    } catch {
      done()
      return
    }
    // some browsers skip seeked if the time is already close
    window.setTimeout(done, 600)
  })
}

export type ScanProgress = { t: number; duration: number; frames: number }

export async function scanVideoFile(
  video: HTMLVideoElement,
  opts: { onProgress?: (p: ScanProgress) => void; signal?: AbortSignal; fps?: number } = {},
): Promise<FrameMetrics[]> {
  const duration = video.duration
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('unreadable')
  const fps = opts.fps ?? (duration > 90 ? 4 : duration > 60 ? 6 : 8)
  const step = 1 / fps
  const W = video.videoWidth || 1
  const H = video.videoHeight || 1
  const frames: FrameMetrics[] = []
  const pl = await getLandmarker('VIDEO')
  let ts = 1
  let usedImage = false
  let imageDetect: ((c: HTMLCanvasElement) => Promise<Pt[] | null>) | null = null

  const canvas = document.createElement('canvas')
  const draw = () => {
    canvas.width = W
    canvas.height = H
    canvas.getContext('2d')!.drawImage(video, 0, 0, W, H)
  }

  for (let t = 0; t < duration; t += step) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    await seekTo(video, t)
    let lm: Pt[] | null = null
    if (!usedImage) {
      try {
        const r = pl.detectForVideo(video, ts++)
        lm = (r.landmarks[0] as Pt[] | undefined) ?? null
      } catch {
        usedImage = true
      }
    }
    if (usedImage) {
      if (!imageDetect) {
        const img = await getLandmarker('IMAGE')
        imageDetect = async (c) => {
          const r = img.detect(c)
          r.segmentationMasks?.forEach((x) => x.close())
          return (r.landmarks[0] as Pt[] | undefined) ?? null
        }
      }
      draw()
      lm = await imageDetect(canvas)
    }
    frames.push(metricsAt(lm, W, H, t))
    opts.onProgress?.({ t, duration, frames: frames.length })
  }
  return frames
}

export function openVideoFile(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.src = url
    const ok = () => resolve({ video, url })
    video.onloadedmetadata = ok
    video.onerror = () => reject(new Error('open-failed'))
    // iOS sometimes never fires loadedmetadata until play() is nudged
    void video.play().then(() => { video.pause(); video.currentTime = 0 }).catch(() => { /* wait for event */ })
  })
}

export const MAX_RECOMMENDED_SEC = 90
