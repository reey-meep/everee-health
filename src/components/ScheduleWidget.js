import { SCHEDULE_TARGETS, SCHEDULE_KINDS, nextPrompt, minutesUntil } from '../lib/constants'

function Bar({ label, value, target, color, ceiling }) {
  const pct = target ? Math.min(value / target, 1) : 0
  const over = ceiling && value > target
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ fontSize: 10.5, color: over ? 'var(--amber)' : 'var(--ink2)' }}>
          {Math.round(value)}<span style={{ color: 'var(--ink4)' }}> / {target}</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: over ? 'var(--amber)' : color, borderRadius: 3, transition: 'width .25s' }} />
      </div>
    </div>
  )
}

export default function ScheduleWidget({ schedule, completions, totals, steps, onOpen }) {
  const next = nextPrompt(schedule, completions)
  const mins = next ? minutesUntil(next.time) : null
  const done = schedule.filter(s => completions[s.id]?.status === 'done').length
  const pct = schedule.length ? done / schedule.length : 0
  const C = 2 * Math.PI * 22

  const late = mins != null && mins < 0
  const ago = late ? -mins : 0
  const until = mins == null ? null
    : late ? (ago < 60 ? `${ago}m overdue` : `${Math.floor(ago / 60)}h ${ago % 60}m overdue`)
    : mins === 0 ? 'now'
    : mins < 60 ? `in ${mins}m`
    : `in ${Math.floor(mins / 60)}h ${mins % 60}m`

  return (
    <div className="card" style={{ padding: 14, cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0 }}>
          <svg width="54" height="54" viewBox="0 0 54 54">
            <circle cx="27" cy="27" r="22" fill="none" stroke="var(--bg)" strokeWidth="4.5" />
            <circle cx="27" cy="27" r="22" fill="none"
              stroke={pct === 1 ? 'var(--green)' : 'var(--indigo)'}
              strokeWidth="4.5" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C - C * pct}
              transform="rotate(-90 27 27)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="mono" style={{ fontSize: 13, lineHeight: 1 }}>{done}</span>
            <span className="mono" style={{ fontSize: 8, color: 'var(--ink4)' }}>/{schedule.length}</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 3 }}>Next up</div>
          {next ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 3, height: 15, borderRadius: 2, background: SCHEDULE_KINDS[next.kind]?.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {next.title}
                </span>
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: late && next.critical ? 'var(--red)' : late ? 'var(--amber)' : 'var(--ink3)', fontWeight: late ? 700 : 400, marginTop: 3 }}>
                {next.time} · {until}{next.critical ? ' · critical' : ''}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink2)' }}>All done for today.</div>
          )}
        </div>
      </div>

      <Bar label="Calories" value={totals.calories} target={SCHEDULE_TARGETS.calories.goal} color="var(--amber)" />
      <Bar label="Water (oz)" value={totals.water} target={SCHEDULE_TARGETS.water.goal} color="var(--sky)" />
      <Bar label="Steps" value={steps || 0} target={SCHEDULE_TARGETS.steps.goal} color="var(--green)" ceiling />
    </div>
  )
}
