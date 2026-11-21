import { useT } from '../i18n'
import { env } from '../lib/env'

/** Darshan's official channels. Only real links — nothing shown for a platform without one. No follower counts. */
export const SOCIALS = [
  { id: 'instagram', name: 'Instagram', handle: '@d31.universe', url: env.socials.instagram || 'https://www.instagram.com/d31.universe/', cta: 'socFollow', sub: 'socIg', glow: '#e1306c' },
  { id: 'youtube', name: 'YouTube', handle: '@d31.universe', url: env.socials.youtube || 'https://youtube.com/@d31.universe', cta: 'socSubscribe', sub: 'socYt', glow: '#ff0000' },
  ...(env.socials.snapchat ? [{ id: 'snapchat', name: 'Snapchat', handle: '', url: env.socials.snapchat, cta: 'socFollow', sub: '', glow: '#fffc00' }] : []),
  ...(env.socials.facebook ? [{ id: 'facebook', name: 'Facebook', handle: '', url: env.socials.facebook, cta: 'socFollow', sub: '', glow: '#1877f2' }] : []),
] as const

export function SocialIcon({ id, size = 28 }: { id: string; size?: number }) {
  if (id === 'instagram') return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs><radialGradient id="soc-ig" cx="30%" cy="107%" r="150%"><stop offset="0" stopColor="#fdf497" /><stop offset=".05" stopColor="#fdf497" /><stop offset=".45" stopColor="#fd5949" /><stop offset=".6" stopColor="#d6249f" /><stop offset=".9" stopColor="#285AEB" /></radialGradient></defs>
      <rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#soc-ig)" />
      <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.9" /><circle cx="16.4" cy="7.6" r="1.05" fill="#fff" />
    </svg>)
  if (id === 'youtube') return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="0.5" y="4" width="23" height="16" rx="4.6" fill="#ff0000" /><path d="M9.6 8.4v7.2l6.2-3.6z" fill="#fff" />
    </svg>)
  if (id === 'snapchat') return (<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><rect x="1" y="1" width="22" height="22" rx="6" fill="#fffc00" /><path d="M12 5.5c2.4 0 3.8 1.8 3.8 3.9v1.7l1.3-.3c.5 0 .6.6.1.8l-1.3.6c.5 1.4 1.6 2.4 2.6 2.7.4.2.3.6-.1.7-.7.2-1.3.3-1.5.7-.1.4-.3.6-.7.5-1.2-.2-1.7.9-4.2.9s-3-1.1-4.2-.9c-.4.1-.6-.1-.7-.5-.2-.4-.8-.5-1.5-.7-.4-.1-.5-.5-.1-.7 1-.3 2.1-1.3 2.6-2.7l-1.3-.6c-.5-.2-.4-.8.1-.8l1.3.3V9.4C8.2 7.3 9.6 5.5 12 5.5z" fill="#fff" stroke="#111" strokeWidth=".6" /></svg>)
  return (<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="11" fill="#1877f2" /><path d="M13.3 19v-5.6h1.9l.3-2.2h-2.2V9.8c0-.6.2-1.1 1.1-1.1h1.2V6.8c-.2 0-.9-.1-1.7-.1-1.7 0-2.9 1-2.9 2.9v1.6H9.1v2.2H11V19z" fill="#fff" /></svg>)
}

/** Full section: glowing glass cards (Profile, Settings). */
export function SocialSection({ className = '' }: { className?: string }) {
  const t = useT()
  return (
    <section className={`soc-wrap ${className}`} data-testid="social-section">
      <div className="mb-2 flex items-end justify-between gap-2">
        <div><div className="label">{t('socTitle')}</div><p className="mt-0.5 text-[12px] text-muted">{t('socSub')}</p></div>
        <span className="soc-badge">✓ {t('socOfficial')}</span>
      </div>
      <div className="grid gap-2.5">
        {SOCIALS.map((x) => (
          <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer" data-testid={`social-${x.id}`} className="soc-card group" style={{ ['--soc' as string]: x.glow }}>
            <span className="soc-icon"><SocialIcon id={x.id} size={30} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-bold tracking-wide text-frost">{x.name}</span>
              {x.handle && <span className="block font-mono text-[12px] text-cyan">{x.handle}</span>}
              {x.sub && <span className="block truncate text-[11.5px] text-muted">{t(x.sub as never)}</span>}
            </span>
            <span className="soc-cta">{t(x.cta as never)} ↗</span>
          </a>
        ))}
      </div>
      <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{t('socOpens')}</p>
    </section>
  )
}

/** Compact row for Today. */
export function SocialRow({ className = '' }: { className?: string }) {
  const t = useT()
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`} data-testid="social-row">
      {SOCIALS.map((x) => (
        <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer" aria-label={`${x.name} ${x.handle}`} className="soc-pill" style={{ ['--soc' as string]: x.glow }}>
          <SocialIcon id={x.id} size={18} /><span className="font-mono text-[11px] text-frost/90">{x.handle || x.name}</span><span className="text-[10.5px] font-semibold text-cyan">{t(x.cta as never)}</span>
        </a>
      ))}
    </div>
  )
}
