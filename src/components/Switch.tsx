import type { KeyboardEvent } from 'react'

type Props = {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  testid?: string
  /** 'aurora' = app palette (off: starfield, on: cyan/gold aurora). 'sky' = night ⇄ daylight (theme). */
  variant?: 'aurora' | 'sky'
  size?: 'md' | 'lg'
  disabled?: boolean
}

/** Horizontal pill switch: recessed track, glowing thumb, crossfading scenery. role=switch, Space/Enter/←/→. */
export function Switch({ on, onChange, label, testid, variant = 'aurora', size = 'md', disabled }: Props) {
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowRight' && !on) { e.preventDefault(); onChange(true) }
    if (e.key === 'ArrowLeft' && on) { e.preventDefault(); onChange(false) }
  }
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} data-testid={testid} disabled={disabled}
      onClick={() => onChange(!on)} onKeyDown={key}
      className={`sw sw-${variant} ${size === 'lg' ? 'sw-lg' : ''} ${on ? 'is-on' : ''}`}
    >
      <span className="sw-track" aria-hidden>
        <span className="sw-bg sw-off" />
        <span className="sw-bg sw-on">
          {variant === 'sky' && (
            <>
              <span className="sw-cloud" style={{ left: '12%', top: '14%', width: '20%', height: '30%' }} />
              <span className="sw-cloud" style={{ left: '22%', top: '20%', width: '16%', height: '26%' }} />
              <span className="sw-cloud" style={{ left: '42%', top: '30%', width: '14%', height: '22%', opacity: 0.75 }} />
              <span className="sw-cloud" style={{ left: '50%', top: '27%', width: '10%', height: '20%', opacity: 0.6 }} />
              <svg className="sw-hills" viewBox="0 0 160 24" preserveAspectRatio="none">
                <path d="M0 14 C 18 8, 30 12, 46 10 S 78 4, 98 9 S 136 6, 160 11 L160 24 L0 24 Z" fill="#3b5f8f" opacity=".75" />
                <path d="M0 18 C 22 13, 40 17, 62 15 S 104 11, 126 16 S 150 14, 160 16 L160 24 L0 24 Z" fill="#1e3a5f" />
              </svg>
            </>
          )}
        </span>
      </span>
      <span className="sw-thumb" aria-hidden />
    </button>
  )
}
