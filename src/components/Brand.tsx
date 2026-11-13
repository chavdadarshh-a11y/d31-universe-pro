export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-brand font-extrabold tracking-[0.14em] ${className}`}>
      <span className="text-gold">D31</span>
      <span className="text-grad">.UNIVERSE</span>
    </span>
  )
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0e1117" stroke="rgba(255,255,255,0.12)" />
      <path d="M9 18h6.5c7 0 11 5.5 11 14s-4 14-11 14H9z" fill="none" stroke="#f5b942" strokeWidth="4" strokeLinejoin="round" />
      <path d="M31 18.5h7a6 6 0 0 1 0 12h-3.5M34.5 30.5H38a7.25 7.25 0 0 1 0 14.5h-7" fill="none" stroke="#f5b942" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 22.5l4.5-4V46" fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
