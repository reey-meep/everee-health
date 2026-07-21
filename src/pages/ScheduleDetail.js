import { useEffect, useState } from 'react'
import { SCHEDULE_KINDS, SCHEDULE_TARGETS, minutesUntil, PROMPT_SOURCES, fmtTime } from '../lib/constants'

// Read-only timeline. Nothing is ticked off here -- status is derived from the
// food diary, water log, Daily Practices and symptom scores, so there is one
// place to log each thing and the schedule simply reflects it.

const WHERE = {
  meal: 'Log in Body → Food diary',
  water: 'Log in Body → Water',
  practice: 'Tick in Daily Practices',
  scores: 'Score in Symptom scores',
  info: null,
}

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

export default function ScheduleDetail({ schedule, statuses, totals, onBack }) {
  // Ticks so the now-marker keeps pace without a reload.
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })
  useEffect(() => {
    const t = setInterval(() => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()) }, 30000)
    return () => clearInterval(t)
  }, [])

  const nowLabel = fmtTime(`${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}`)
  // Index of the first prompt still ahead -- the marker sits just above it.
  const firstAhead = schedule.findIndex(p => toMin(p.time) > nowMin)

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', paddingBottom: 40 }}>
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
      </div>

      <div style={{ padding: '4px 16px 12px' }}>
        <div className="page-title" style={{ marginBottom: 6 }}>Today&rsquo;s schedule</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink3)' }}>
          {Math.round(totals.calories)} / {SCHEDULE_TARGETS.calories.min} cal ·{' '}
          {Math.round(totals.water)} / {SCHEDULE_TARGETS.water.min} oz
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink4)', marginTop: 4, lineHeight: 1.5 }}>
          Reflects what you&rsquo;ve logged elsewhere — nothing to tick off here.
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {schedule.map((p, idx) => {
          const status = statuses[p.id]
          const kind = SCHEDULE_KINDS[p.kind] || {}
          const src = PROMPT_SOURCES[p.id] || { type: 'info' }
          const mins = minutesUntil(p.time)
          const overdue = !status && mins < 0 && src.type !== 'info'
          const isNow = !status && mins >= 0 && mins <= 15

          const marker = idx === firstAhead ? (
            <div key="now" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--indigo)', fontWeight: 700, flexShrink: 0 }}>{nowLabel}</span>
              <span style={{ flex: 1, height: 2, background: 'var(--indigo)', borderRadius: 1 }} />
              <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--indigo)', flexShrink: 0 }} />
            </div>
          ) : null

          return (
            <div key={p.id} style={{ display: 'contents' }}>
            {marker}
            <div className="card" style={{
              padding: 0, display: 'flex', overflow: 'hidden',
              opacity: src.type === 'info' ? 0.72 : 1,
              borderColor: p.critical && overdue ? 'var(--red)' : isNow ? 'var(--indigo)' : undefined,
            }}>
              <div style={{ width: 4, background: kind.color, flexShrink: 0 }} />
              <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <span className="mono" style={{
                    fontSize: 11,
                    color: p.critical && overdue ? 'var(--red)' : overdue ? 'var(--amber)' : 'var(--ink3)',
                    fontWeight: overdue ? 700 : 400,
                  }}>
                    {fmtTime(p.time)}{p.critical ? ' ⚠' : ''}
                  </span>
                  {status === 'done' && <span className="mono" style={{ fontSize: 10, color: 'var(--green)' }}>✓ logged</span>}
                  {status === 'partial' && <span className="mono" style={{ fontSize: 10, color: 'var(--amber)' }}>partial</span>}
                  {overdue && !status && <span className="mono" style={{ fontSize: 10, color: p.critical ? 'var(--red)' : 'var(--amber)' }}>not logged</span>}
                </div>

                <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 2, color: status === 'done' ? 'var(--ink2)' : 'var(--ink)' }}>
                  {p.title}
                </div>
                {p.detail && <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2, lineHeight: 1.45 }}>{p.detail}</div>}

                {!status && WHERE[src.type] && (
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink4)', marginTop: 6 }}>{WHERE[src.type]}</div>
                )}
              </div>
            </div>
            </div>
          )
        })}
        {/* Everything done for today -- marker sits at the end. */}
        {firstAhead === -1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--indigo)', fontWeight: 700 }}>{nowLabel}</span>
            <span style={{ flex: 1, height: 2, background: 'var(--indigo)', borderRadius: 1 }} />
            <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--indigo)' }} />
          </div>
        )}
      </div>
    </div>
  )
}
