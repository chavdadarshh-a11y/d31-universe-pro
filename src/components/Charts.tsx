type Datum = { label: string; value: number }

export function BarChart({ data, color = '#22d3ee', height = 140, format = (v: number) => String(Math.round(v)) }: { data: Datum[]; color?: string; height?: number; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const w = 320
  const pad = { t: 18, b: 22 }
  const bw = (w / data.length) * 0.56
  const ih = height - pad.t - pad.b
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img">
      {[0.5, 1].map((g) => (
        <line key={g} x1="0" x2={w} y1={pad.t + ih * (1 - g)} y2={pad.t + ih * (1 - g)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 4" />
      ))}
      <line x1="0" x2={w} y1={pad.t + ih} y2={pad.t + ih} stroke="rgba(255,255,255,0.1)" />
      {data.map((d, i) => {
        const cx = (w / data.length) * (i + 0.5)
        const h = (d.value / max) * ih
        const last = i === data.length - 1
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={pad.t + ih - h} width={bw} height={Math.max(h, d.value > 0 ? 2 : 0)} rx="4" fill={color} fillOpacity={last ? 1 : 0.45} />
            {d.value > 0 && (
              <text x={cx} y={pad.t + ih - h - 5} textAnchor="middle" fontSize="9.5" fill={last ? '#eef1f5' : '#8b93a3'} fontFamily="JetBrains Mono, monospace">{format(d.value)}</text>
            )}
            <text x={cx} y={height - 6} textAnchor="middle" fontSize="9.5" fill="#5c6575" fontFamily="JetBrains Mono, monospace">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function LineChart({ data, color = '#f5b942', height = 150, unit = '' }: { data: Datum[]; color?: string; height?: number; unit?: string }) {
  const w = 320
  const pad = { l: 8, r: 8, t: 20, b: 22 }
  if (data.length === 0) return null
  const vals = data.map((d) => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(1, max - min)
  const ih = height - pad.t - pad.b
  const iw = w - pad.l - pad.r
  const x = (i: number) => pad.l + (data.length === 1 ? iw / 2 : (iw * i) / (data.length - 1))
  const y = (v: number) => pad.t + ih - ((v - min) / span) * ih * 0.85 - ih * 0.075
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${path} L${x(data.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`
  const step = Math.ceil(data.length / 6)
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img">
      <line x1="0" x2={w} y1={pad.t + ih} y2={pad.t + ih} stroke="rgba(255,255,255,0.1)" />
      <path d={area} fill={color} fillOpacity="0.08" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r={i === data.length - 1 ? 4 : 2.5} fill={i === data.length - 1 ? color : '#0e1117'} stroke={color} strokeWidth="1.5" />
          {(i === data.length - 1 || i === 0) && (
            <text x={x(i)} y={y(d.value) - 9} textAnchor={i === 0 && data.length > 1 ? 'start' : 'end'} fontSize="10" fill="#eef1f5" fontFamily="JetBrains Mono, monospace">{d.value}{unit}</text>
          )}
          {i % step === 0 && <text x={x(i)} y={height - 6} textAnchor="middle" fontSize="9.5" fill="#5c6575" fontFamily="JetBrains Mono, monospace">{d.label}</text>}
        </g>
      ))}
    </svg>
  )
}
