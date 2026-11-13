import { useEffect, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { ChevronLeft, Lock, X } from 'lucide-react'
import { goBack } from '../lib/router'

type BtnVariant = 'primary' | 'gold' | 'ghost' | 'outline' | 'danger'
export function Button({
  variant = 'primary', size = 'md', className = '', children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-cyan text-[#041016] hover:bg-[#4ee0f3] active:bg-[#1bb8d1]',
    gold: 'bg-gold text-[#1a1203] hover:bg-[#f8c868]',
    ghost: 'bg-white/5 text-frost hover:bg-white/10',
    outline: 'border border-white/15 text-frost hover:border-white/30 bg-transparent',
    danger: 'bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25',
  }
  const s = { sm: 'h-9 px-3 text-[13px] rounded-xl', md: 'h-11 px-4 text-[15px] rounded-2xl', lg: 'h-13 px-5 text-base rounded-2xl' }[size]
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none select-none ${v[variant]} ${s} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({ className = '', children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  if (onClick)
    return (
      <button onClick={onClick} className={`card block w-full text-left transition-colors hover:border-white/15 active:bg-white/[0.02] ${className}`}>
        {children}
      </button>
    )
  return <div className={`card ${className}`}>{children}</div>
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`label ${className}`}>{children}</div>
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center justify-between px-0.5">
      <Label>{title}</Label>
      {action}
    </div>
  )
}

export function Header({ title, back, right, sub }: { title: string; back?: boolean | string; right?: ReactNode; sub?: string }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-2 border-b border-white/[0.06] bg-void/85 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur-xl">
      {back && (
        <button aria-label="Back" onClick={() => (typeof back === 'string' ? (window.location.hash = back) : goBack())} className="-ml-2 grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-white/5 hover:text-frost">
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[19px] font-bold tracking-tight">{title}</h1>
        {sub && <div className="truncate text-xs text-muted">{sub}</div>}
      </div>
      {right}
    </header>
  )
}

export function Chip({ active, children, onClick, className = '' }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors ${
        active ? 'border-cyan/60 bg-cyan/12 text-cyan' : 'border-white/10 bg-white/[0.03] text-muted hover:text-frost'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={`h-9 flex-1 whitespace-nowrap rounded-xl px-3 text-[13px] font-semibold transition-colors ${value === it.id ? 'bg-white/10 text-frost' : 'text-muted hover:text-frost'}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function Ring({ value, size = 64, stroke = 6, color = '#22d3ee', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .5s' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', on)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet-in relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0c0f14] px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function Confirm({ open, text, confirmLabel, cancelLabel, danger, onConfirm, onClose }: { open: boolean; text: string; confirmLabel: string; cancelLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <p className="mb-5 mt-1 text-[15px] leading-relaxed">{text}</p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
      </div>
    </Sheet>
  )
}

export function Badge({ children, tone = 'cyan', className = '' }: { children: ReactNode; tone?: 'cyan' | 'gold' | 'violet' | 'muted' | 'ok' | 'bad'; className?: string }) {
  const t = {
    cyan: 'bg-cyan/12 text-cyan border-cyan/25',
    gold: 'bg-gold/12 text-gold border-gold/30',
    violet: 'bg-violet/12 text-violet border-violet/30',
    muted: 'bg-white/5 text-muted border-white/10',
    ok: 'bg-ok/12 text-ok border-ok/30',
    bad: 'bg-bad/12 text-bad border-bad/30',
  }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${t} ${className}`}>{children}</span>
}

export function LockTag({ label }: { label: string }) {
  return (
    <Badge tone="gold">
      <Lock size={10} /> {label}
    </Badge>
  )
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, suffix }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v * 100) / 100))
  return (
    <div className="flex h-11 items-center overflow-hidden rounded-xl border border-white/10 bg-[#0a0d12]">
      <button aria-label="Decrease" className="h-full w-10 text-lg text-muted hover:bg-white/5" onClick={() => onChange(clamp(value - step))}>−</button>
      <input
        inputMode="decimal"
        className="h-full w-full min-w-0 bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = parseFloat(e.target.value.replace(',', '.'))
          onChange(Number.isFinite(n) ? clamp(n) : 0)
        }}
        aria-label={suffix}
      />
      {suffix && <span className="pr-1 text-xs text-dim">{suffix}</span>}
      <button aria-label="Increase" className="h-full w-10 text-lg text-muted hover:bg-white/5" onClick={() => onChange(clamp(value + step))}>+</button>
    </div>
  )
}

export function Scale({ value, onChange, low, high }: { value: number; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-10 rounded-xl border text-sm font-semibold transition-colors ${value === n ? 'border-cyan/60 bg-cyan/15 text-cyan' : 'border-white/10 bg-white/[0.03] text-muted'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-dim">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

export function Empty({ icon, text, action }: { icon?: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="card grid-bg flex flex-col items-center gap-3 px-6 py-9 text-center">
      {icon && <div className="text-dim">{icon}</div>}
      <p className="max-w-[260px] text-sm text-muted">{text}</p>
      {action}
    </div>
  )
}
