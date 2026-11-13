import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useT } from '../i18n'

/** In-app PDF reader for files saved inside the app (pdf.js, loaded only when needed). Nothing is written to the phone. */
export function PdfViewer({ blob, title, onClose }: { blob: Blob; title: string; onClose: () => void }) {
  const t = useT()
  const host = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState(0)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let dead = false
    document.body.style.overflow = 'hidden'
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
        pdfjs.GlobalWorkerOptions.workerSrc = worker
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
        if (dead) return
        setPages(doc.numPages)
        const el = host.current!
        const width = el.clientWidth - 16
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        for (let i = 1; i <= doc.numPages && !dead; i++) {
          const page = await doc.getPage(i)
          const vp0 = page.getViewport({ scale: 1 })
          const vp = page.getViewport({ scale: (width / vp0.width) * dpr })
          const c = document.createElement('canvas')
          c.width = vp.width; c.height = vp.height
          c.style.width = `${width}px`
          c.className = 'mx-auto mb-2 block rounded-md bg-white shadow-lg'
          c.dataset.page = String(i)
          await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise
          if (!dead) el.appendChild(c)
        }
      } catch (e) {
        console.warn('[pdf]', e)
        if (!dead) setErr(true)
      }
    })()
    return () => { dead = true; document.body.style.overflow = '' }
  }, [blob])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} data-testid="pdf-viewer" className="dark-zone fixed inset-0 z-[80] flex flex-col bg-[#05070d] text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+10px)]">
        <button aria-label={t('pClose')} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><ArrowLeft size={20} /></button>
        <div className="min-w-0 flex-1 truncate text-[15px] font-bold">{title}</div>
        {pages > 0 && <span className="font-mono text-[11px] text-white/60">{pages} pp</span>}
      </div>
      <div ref={host} className="flex-1 overflow-y-auto p-2" data-testid="pdf-pages">
        {!pages && !err && <div className="mt-20 grid place-items-center text-white/60"><Loader2 className="animate-spin" /></div>}
        {err && <p className="m-4 rounded-xl border border-bad/30 bg-bad/10 p-3 text-[13px] text-bad">PDF could not be opened.</p>}
      </div>
    </div>,
    document.body,
  )
}
