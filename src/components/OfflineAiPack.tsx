import { Cpu } from 'lucide-react'
import { useT } from '../i18n'

export function OfflineAiPack({ className = '' }: { className?: string }) {
  const t = useT()
  return (
    <div data-testid="offline-ai-pack" className={`card relative overflow-hidden p-4 ${className}`}>
      <span className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,#f7c548,#22d3ee)]" />
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold"><Cpu size={18} /></span>
        <div className="min-w-0">
          <div className="title-hud text-[13px] text-gold">{t('aiOfflineTitle')}</div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{t('aiOfflineBody')}</p>
        </div>
      </div>
    </div>
  )
}
