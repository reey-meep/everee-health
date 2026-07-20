// Tappable metric card -- every number is a door
export default function MetricCard({ 
  label, value, unit, subvalue, sublabel,
  color = 'var(--indigo)', accent,
  chart, // optional mini sparkline data [numbers]
  onClick, trend, // 'up'|'down'|'stable'
  size = 'md', // 'lg'|'md'|'sm'
  badge,
}) {
  const sizes = {
    lg: { val: 44, unit: 14, label: 9 },
    md: { val: 32, unit: 11, label: 8.5 },
    sm: { val: 22, unit: 10, label: 8 },
  }
  const s = sizes[size] || sizes.md

  const trendColor = trend === 'up' ? 'var(--red)' : trend === 'down' ? 'var(--green)' : 'var(--ink3)'
  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'

  // Mini sparkline
  function Sparkline({ data, color }) {
    if (!data || data.length < 2) return null
    const w = 60, h = 24
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const pts = data.map((v, i) => [
      (i / (data.length - 1)) * w,
      h - ((v - min) / range) * h,
    ])
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".6" />
      </svg>
    )
  }

  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--bd)',
        borderRadius: 16,
        padding: '14px 14px 12px',
        borderTop: accent ? `3px solid ${accent || color}` : undefined,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        width: '100%',
        transition: 'transform .1s, background .1s',
        WebkitTapHighlightColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
      }}
      onTouchStart={e => { if (onClick) e.currentTarget.style.background = 'var(--bg)' }}
      onTouchEnd={e => { if (onClick) e.currentTarget.style.background = 'var(--surface)' }}
    >
      {/* Top label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: s.label, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {badge && <span style={{ fontFamily: 'var(--mono)', fontSize: 8, padding: '2px 6px', borderRadius: 99, background: badge.bg || 'var(--bg)', color: badge.color || 'var(--ink3)', border: `1px solid ${badge.bd || 'var(--bd)'}` }}>{badge.text}</span>}
          {trend && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: trendColor }}>{trendArrow}</span>}
          {onClick && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}
        </div>
      </div>

      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: subvalue ? 4 : 0 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: s.val, fontWeight: 300, color, lineHeight: 1, letterSpacing: '-.03em' }}>
          {value ?? '--'}
        </span>
        {unit && <span style={{ fontFamily: 'var(--mono)', fontSize: s.unit, color: 'var(--ink3)', marginBottom: 3 }}>{unit}</span>}
        {chart && <div style={{ marginLeft: 'auto' }}><Sparkline data={chart} color={color} /></div>}
      </div>

      {/* Sub value */}
      {subvalue && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink3)' }}>
          {sublabel && <span>{sublabel}: </span>}{subvalue}
        </div>
      )}
    </button>
  )
}
