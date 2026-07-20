import { runAllAnalytics } from '../lib/analytics'
import { useState, useEffect } from 'react'

export default function More({ showToast, openMetric }) {
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runAllAnalytics().then(r => {
      setInsights(r?.insights?.slice(0, 4) || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="screen active">
      <div className="header" style={{ paddingBottom: 16 }}>
        <div className="page-title">More</div>
      </div>
      <div className="body">
        <div className="section-label">Top insights {!loading && `(${insights.length} found)`}</div>
        {loading && <div className="mono" style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', padding: 20 }}>Running analysis...</div>}
        {!loading && insights.length === 0 && (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.65 }}>Log symptom scores daily for at least 5 days to start seeing correlations. The more you log, the more patterns emerge.</div>
          </div>
        )}
        {insights.map((card, i) => (
          <div key={i} className="insight-card" style={{ borderColor: card.color + '40', marginBottom: 8 }}>
            <div className="mono" style={{ fontSize: 8.5, color: card.color, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 5 }}>
              {card.color === 'var(--green)' ? '↓ Helps' : '↑ Raises'} · {card.impact} pt impact · n={card.n}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.3 }}>{card.headline}</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.55 }}>{card.body}</div>
          </div>
        ))}

        <div className="section-label" style={{ marginTop: 4 }}>Settings</div>
        <div className="card">
          {[
            { label: 'Connect Fitbit', sub: 'Link your Fitbit for automatic data' },
            { label: 'Heart monitor', sub: 'Rylie mode + HR tracking' },
            { label: 'Medications', sub: 'View your full medication list' },
            { label: 'Wellness plan', sub: 'Foundation phase protocol' },
            { label: 'Analytics', sub: 'Full correlation dashboard' },
          ].map((item, i, arr) => (
            <div key={item.label} className="row" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--bd)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{item.label}</div>
                {item.sub && <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>{item.sub}</div>}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
