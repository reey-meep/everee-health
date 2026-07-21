import { SCHEDULE_KINDS, SCHEDULE_TARGETS, minutesUntil, PROMPT_SOURCES } from '../lib/constants'

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

export default function ScheduleDetail({ schedule, statuses, totals, onBack }) {
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
          {Math.round(totals.calories)} / {SCHEDULE_TARGETS.calories.goal} cal ·{' '}
          {Math.round(totals.water)} / {SCHEDULE_TARGETS.water.goal} oz
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink4)', marginTop: 4, lineHeight: 1.5 }}>
          Reflects what you&rsquo;ve logged elsewhere — nothing to tick off here.
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {schedule.map(p => {
          const status = statuses[p.id]
          const kind = SCHEDULE_KINDS[p.kind] || {}
          const src = PROMPT_SOURCES[p.id] || { type: 'info' }
          const mins = minutesUntil(p.time)
          const overdue = !status && mins < 0 && src.type !== 'info'
          const isNow = !status && mins >= 0 && mins <= 15

          return (
            <div key={p.id} className="card" style={{
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
                    {p.time}{p.critical ? ' ⚠' : ''}
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
          )
        })}
      </div>
    </div>
  )
}
