export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-brand font-extrabold tracking-[0.16em] glow-gold ${className}`}>
      <span className="text-gold-grad">D31.UNIVERSE</span>
    </span>
  )
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lm-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset="1" stopColor="#e2a12a" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#070b14" stroke="rgba(247,197,72,0.35)" />
      <path d="M9 18h6.5c7 0 11 5.5 11 14s-4 14-11 14H9z" fill="none" stroke="url(#lm-gold)" strokeWidth="4" strokeLinejoin="round" />
      <path d="M31 18.5h7a6 6 0 0 1 0 12h-3.5M34.5 30.5H38a7.25 7.25 0 0 1 0 14.5h-7" fill="none" stroke="url(#lm-gold)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 22.5l4.5-4V46" fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
