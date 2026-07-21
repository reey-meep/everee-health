import { useState } from 'react'
import { SCHEDULE_KINDS, SCHEDULE_TARGETS, minutesUntil } from '../lib/constants'

export default function ScheduleDetail({ schedule, completions, totals, onAction, onBack, showToast }) {
  const [busy, setBusy] = useState(null)
  const [timer, setTimer] = useState(null) // { id, endsAt, label }

  async function act(prompt, status) {
    setBusy(prompt.id)
    try {
      await onAction(prompt, status)
    } catch {
      showToast('Not saved — nothing was logged', 'var(--red)')
    }
    setBusy(null)
  }

  function startTimer(prompt) {
    setTimer({ id: prompt.id, endsAt: Date.now() + prompt.minutes * 60000, label: prompt.title })
    showToast(`${prompt.minutes} min — timer started`)
  }

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()

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
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {schedule.map(p => {
          const c = completions[p.id]
          const doneState = c?.status
          const kind = SCHEDULE_KINDS[p.kind] || {}
          const mins = minutesUntil(p.time)
          const overdue = !doneState && mins < 0
          const isNow = !doneState && mins >= 0 && mins <= 15

          return (
            <div key={p.id} className="card" style={{
              padding: 0, display: 'flex', overflow: 'hidden',
              opacity: doneState === 'skipped' ? .45 : 1,
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
                  {doneState === 'done' && <span className="mono" style={{ fontSize: 10, color: 'var(--green)' }}>✓ done</span>}
                  {doneState === 'skipped' && <span className="mono" style={{ fontSize: 10, color: 'var(--ink4)' }}>skipped</span>}
                </div>

                <div style={{
                  fontSize: 13.5, fontWeight: 700, marginTop: 2,
                  textDecoration: doneState === 'skipped' ? 'line-through' : 'none',
                }}>{p.title}</div>
                {p.detail && <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2, lineHeight: 1.45 }}>{p.detail}</div>}

                {timer?.id === p.id && (
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--green)', marginTop: 6 }}>
                    timer running · {p.minutes} min
                  </div>
                )}

                {!doneState && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {p.action === 'timer' && (
                      <button onClick={() => startTimer(p)} style={btn('var(--bg)', 'var(--ink2)', true)}>
                        Start {p.minutes}m
                      </button>
                    )}
                    <button disabled={busy === p.id} onClick={() => act(p, 'done')} style={btn(kind.color, '#fff')}>
                      {busy === p.id ? '…' : 'Done ✓'}
                    </button>
                    <button disabled={busy === p.id} onClick={() => act(p, 'skipped')} style={btn('var(--bg)', 'var(--ink3)', true)}>
                      Skip
                    </button>
                  </div>
                )}

                {doneState && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => act(p, doneState === 'done' ? 'skipped' : 'done')} style={btn('var(--bg)', 'var(--ink3)', true)}>
                      {doneState === 'done' ? 'Undo' : 'Mark done'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const btn = (bg, color, outline = false) => ({
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 10,
  border: outline ? '1.5px solid var(--bd)' : 'none',
  background: bg,
  color,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
})
