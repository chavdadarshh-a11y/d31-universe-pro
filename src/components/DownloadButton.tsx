import { useState } from 'react'
import { Download, Lock, Loader2 } from 'lucide-react'
import { useT } from '../i18n'
import { useCan, FEATURE_PLAN, type Feature } from '../lib/entitlements'
import { navigate } from '../lib/router'
import { useApp } from '../store/app'
import { IN_APP } from '../lib/appMode'

/** A download gated by entitlements (Gold+ for your own PDFs/CSV). Everyone else sees a lock + upgrade CTA (one gate: entitlements). */
export function DownloadButton({ feature, label, run, testid, className = '' }: { feature: Feature; label: string; run: () => Promise<void> | void; testid?: string; className?: string }) {
  const t = useT()
  const ok = useCan(feature)
  const toast = useApp((s) => s.showToast)
  const [busy, setBusy] = useState(false)
  if (!ok)
    return (
      <button data-testid={testid ? `${testid}-locked` : undefined} onClick={() => (IN_APP ? toast(t('memberOnly')) : navigate('/membership'))} className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/[0.06] px-3 text-[13px] font-bold text-gold ${className}`}>
        <Lock size={15} /> {label} <span className="font-mono text-[10.5px] tracking-wider opacity-80">· {t(`plan_${FEATURE_PLAN[feature]}`).toUpperCase()}</span>
      </button>
    )
  return (
    <button data-testid={testid} disabled={busy} onClick={async () => {
      setBusy(true)
      try { await run() } catch (e) { toast(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
    }} className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan/40 bg-cyan/[0.08] px-3 text-[13px] font-bold text-cyan disabled:opacity-60 ${className}`}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {label}
    </button>
  )
}
