import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Check } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Sheet } from './ui'
import { exOf, exName } from '../data/exercises'
import { wTxt } from '../lib/units'
import { getSpeechRecognition, parseSpeechSet, speechLang, type ParsedSet, type SpeechRec } from '../lib/ai/speechLog'
import { addExerciseToActive, patchActive, startEmpty } from '../lib/workout'
import type { LoggedSet } from '../types'


function applyParsedSet(parsed: ParsedSet, emptyName: string): string | null {
  if (!parsed.ok || !parsed.exId) return null
  if (!useApp.getState().active) startEmpty(emptyName)
  const before = useApp.getState().active
  if (!before) return null
  let exIdx = before.log.findIndex((l) => l.exId === parsed.exId)
  if (exIdx < 0) {
    addExerciseToActive(parsed.exId)
    exIdx = (useApp.getState().active?.log.length ?? 1) - 1
  }
  const set: LoggedSet = {
    reps: parsed.reps,
    kg: parsed.kg,
    secs: parsed.secs,
    note: parsed.note,
    type: 'working',
    done: true,
  }
  const idx = exIdx
  patchActive((cur) => ({
    ...cur,
    log: cur.log.map((l, i) => (i !== idx ? l : { ...l, sets: [...l.sets, set] })),
    current: idx,
  }))
  return parsed.exId
}

export function AudioScribe() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const supported = !!getSpeechRecognition()
  const [listening, setListening] = useState(false)
  const [typed, setTyped] = useState('')
  const [heard, setHeard] = useState('')
  const [parsed, setParsed] = useState<ParsedSet | null>(null)
  const recRef = useRef<SpeechRec | null>(null)

  useEffect(() => () => { try { recRef.current?.abort() } catch { /* ignore */ } }, [])

  const openParse = (text: string) => {
    setHeard(text)
    setParsed(parseSpeechSet(text))
  }

  const start = () => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) return
    try { recRef.current?.abort() } catch { /* ignore */ }
    const rec = new Ctor()
    rec.lang = speechLang(lang)
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript?.trim() ?? ''
      if (text) openParse(text)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  const stop = () => {
    try { recRef.current?.stop() } catch { /* ignore */ }
    setListening(false)
  }

  const save = () => {
    if (!parsed?.ok) return
    const id = applyParsedSet(parsed, t('emptyWorkout'))
    if (!id) return
    useApp.getState().showToast(t('aiScribeSaved', { ex: exName(exOf(id), lang) }))
    setParsed(null)
    setHeard('')
    setTyped('')
  }

  return (
    <div className="mt-3" data-testid="audio-scribe">
      {supported ? (
        <Button variant="outline" className="w-full" data-testid="audio-scribe-mic" onClick={listening ? stop : start}>
          {listening ? <MicOff size={16} className="text-gold" /> : <Mic size={16} className="text-cyan" />}
          {listening ? t('aiScribeListen') : t('aiScribeTap')}
        </Button>
      ) : (
        <p className="mb-2 text-center text-[12px] text-muted">{t('aiScribeUnsupported')}</p>
      )}
      <p className="mt-2 text-center text-[11.5px] leading-snug text-dim">{t('aiScribeSub')}</p>
      {!supported && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) openParse(typed.trim()) }}>
          <input className="num flex-1 !text-left !text-[13px]" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('aiScribeTypePh')} data-testid="audio-scribe-type" aria-label={t('aiScribe')} />
          <Button size="sm" type="submit">{t('aiScribeSave').split(' ')[0]}</Button>
        </form>
      )}
      <Sheet open={!!parsed} onClose={() => setParsed(null)} title={t('aiScribe')}>
        {parsed && <ScribeConfirm parsed={parsed} heard={heard} onRetry={() => { setParsed(null); if (supported) start() }} onSave={save} />}
      </Sheet>
    </div>
  )
}

function ScribeConfirm({ parsed, heard, onRetry, onSave }: { parsed: ParsedSet; heard: string; onRetry: () => void; onSave: () => void }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const ex = parsed.exId ? exName(exOf(parsed.exId), lang) : parsed.exQuery || '—'
  const err = parsed.error === 'no-exercise' ? t('aiScribeNeedEx') : parsed.error === 'no-numbers' ? t('aiScribeNeedNum') : null
  const bits = [
    ex,
    parsed.kg ? wTxt(parsed.kg, true) : '',
    parsed.reps ? t('reps') + ' ' + parsed.reps : '',
    parsed.secs != null ? `${parsed.secs}s` : '',
    parsed.note ?? '',
  ].filter(Boolean)
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted">{t('aiScribeHeard')} <span className="text-frost">{heard}</span></p>
      <div className="card p-3">
        <div className="title-hud text-[15px] text-frost">{bits.join(' · ')}</div>
        {err && <p className="mt-2 text-[13px] text-gold">{err}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onRetry}>{t('aiScribeRetry')}</Button>
        <Button className="flex-1" data-testid="audio-scribe-save" disabled={!parsed.ok} onClick={onSave}><Check size={15} /> {t('aiScribeSave')}</Button>
      </div>
    </div>
  )
}
