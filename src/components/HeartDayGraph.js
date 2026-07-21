import { useEffect, useState } from 'react'
import { fetchHeartRatePoints, isConnected } from '../lib/google-health'
import { getHRTags } from '../lib/db'
import { HR_TAG_CATEGORIES } from '../lib/constants'

// Intraday heart-rate curve for a chosen day, with that day's tags marked on it.
//
// Points are fetched from Google Health on demand rather than stored -- the API
// serves history for past dates, so there's no need to duplicate it locally and
// no gap for days before this feature existed.

const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const W = 320, H = 120, PAD = 4

export default function HeartDayGraph() {
  const [offset, setOffset] = useState(0)          // 0 = today, 1 = yesterday...
  const [points, setPoints] = useState(null)
  const [tags, setTags] = useState([])
  const [err, setErr] = useState('')

  const date = (() => { const d = new Date(); d.setDate(d.getDate() - offset); return d })()
  const key = dayKey(date)

  useEffect(() => {
    let live = true
    setPoints(null); setErr('')
    ;(async () => {
      if (!isConnected()) { if (live) { setPoints([]); setErr('Connect Fitbit in More to see heart rate.') } return }
      try {
        const pts = await fetchHeartRatePoints(key)
        const mapped = pts
          .map(p => ({
            t: new Date(p?.heartRate?.sampleTime?.physicalTime || p?.heartRate?.sampleTime?.civilTime).getTime(),
            v: Number(p?.heartRate?.beatsPerMinute),
          }))
          .filter(p => Number.isFinite(p.t) && Number.isFinite(p.v))
          .sort((a, b) => a.t - b.t)
        if (live) setPoints(mapped)
      } catch (e) {
        if (live) { setPoints([]); setErr('Could not load heart rate for this day.') }
      }
      try {
        const start = new Date(date); start.setHours(0, 0, 0, 0)
        const end = new Date(date); end.setHours(23, 59, 59, 999)
        const t = await getHRTags(start.toISOString(), end.toISOString())
        if (live) setTags(t)
      } catch { /* tags are optional */ }
    })()
    return () => { live = false }
  }, [key]) // eslint-disable-line

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0)
  const spanMs = 24 * 60 * 60 * 1000
  const vals = (points || []).map(p => p.v)
  const lo = vals.length ? Math.min(...vals) : 50
  const hi = vals.length ? Math.max(...vals) : 120
  const range = hi - lo || 1

  const x = t => PAD + ((t - dayStart.getTime()) / spanMs) * (W - PAD * 2)
  const y = v => H - PAD - ((v - lo) / range) * (H - PAD * 2)

  const path = (points || []).map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={() => setOffset(o => o + 1)} style={navBtn}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--ink4)' }}>{key}</div>
        </div>
        <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} style={{ ...navBtn, opacity: offset === 0 ? .3 : 1 }}>›</button>
      </div>

      {points === null && <div className="mono" style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', padding: 24 }}>Loading…</div>}

      {points?.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink3)', textAlign: 'center', padding: 20, lineHeight: 1.5 }}>
          {err || 'No heart-rate data recorded for this day.'}
        </div>
      )}

      {points?.length > 0 && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* 6-hour gridlines */}
            {[6, 12, 18].map(h => {
              const gx = PAD + (h / 24) * (W - PAD * 2)
              return <line key={h} x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke="var(--bd)" strokeWidth="1" />
            })}
            <path d={path} fill="none" stroke="var(--red)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            {/* Tag markers on the same time axis */}
            {tags.map(tg => {
              const t = new Date(tg.tagged_at).getTime()
              const gx = x(t)
              if (gx < PAD || gx > W - PAD) return null
              const cat = HR_TAG_CATEGORIES.find(c => c.id === tg.category) || {}
              return (
                <g key={tg.id}>
                  <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke={cat.color || 'var(--indigo)'} strokeWidth="1" strokeDasharray="2 2" opacity=".7" />
                  <circle cx={gx} cy={PAD + 4} r="3.5" fill={cat.color || 'var(--indigo)'} />
                </g>
              )
            })}
          </svg>

          <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: 'var(--ink4)', marginTop: 2 }}>
            <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
          </div>

          <div className="stat3" style={{ marginTop: 10 }}>
            {[['Low', lo], ['Average', Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)], ['High', hi]].map(([l, v]) => (
              <div key={l} className="stat-tile">
                <div className="mono" style={{ fontSize: 16, fontWeight: 300, color: 'var(--red)', lineHeight: 1, marginBottom: 3 }}>{v}</div>
                <div className="eyebrow">{l}</div>
              </div>
            ))}
          </div>

          {tags.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--bd)' }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Tags this day</div>
              {tags.map(tg => {
                const cat = HR_TAG_CATEGORIES.find(c => c.id === tg.category) || {}
                return (
                  <div key={tg.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0' }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink3)', flexShrink: 0 }}>
                      {new Date(tg.tagged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: 12, color: cat.color || 'var(--ink)' }}>{cat.icon} {cat.label || tg.category}</span>
                    {tg.notes && <span style={{ fontSize: 11.5, color: 'var(--ink2)' }}>— {tg.notes}</span>}
                  </div>
                )
              })}
            </div>
          )}
          <div className="mono" style={{ fontSize: 9, color: 'var(--ink4)', marginTop: 8, textAlign: 'center' }}>
            {points.length} readings
          </div>
        </>
      )}
    </div>
  )
}

const navBtn = {
  minHeight: 44, minWidth: 44, border: 'none', background: 'none',
  color: 'var(--ink2)', fontSize: 22, cursor: 'pointer', fontFamily: 'inherit',
}
