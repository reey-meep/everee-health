import { useState, useEffect } from 'react'
import { getMetricTrend } from '../lib/db'

const METRICS = {
  steps: {
    label: 'Steps', color: '#5B5EF4', unit: '',
    value: (d) => d?.steps?.toLocaleString() ?? '--',
    goal: 7500, raw: (d) => d?.steps,
    about: 'Steps and light walking directly support vestibular rehabilitation and autonomic stability. Your dysautonomia means pacing matters -- 7,500 is your Foundation phase ceiling, not your floor. Correlation data shows your dizziness is lowest on days with 5,000-7,500 steps.',
  },
  sleep_hours: {
    label: 'Sleep', color: '#8B5CF6', unit: 'h',
    value: (d) => d?.sleep_hours ? `${d.sleep_hours}h` : '--',
    goal: 8, raw: (d) => d?.sleep_hours,
    about: 'Sleep is your single highest-impact variable. Under 7 hours consistently raises MCAS reactivity, vestibular sensitivity, and autonomic instability. The correlation engine shows sleep has the strongest next-day effect on your symptom scores.',
  },
  resting_hr: {
    label: 'Resting HR', color: '#FF3B5C', unit: 'bpm',
    value: (d) => d?.resting_hr ? `${Math.round(d.resting_hr)}` : '--',
    about: 'Resting heart rate is your autonomic baseline. With dysautonomia, elevated resting HR can signal a flare day. Your propranolol keeps this stable -- watch for rises above 75 bpm at rest as a signal to lower activity.',
  },
  hrv: {
    label: 'HRV', color: '#00B4D8', unit: 'ms',
    value: (d) => d?.hrv ? `${Math.round(d.hrv)}` : '--',
    about: 'HRV measures autonomic nervous system recovery. Higher is generally better -- low HRV days predict higher symptom load the next day in your correlation data. Your dysautonomia means your HRV will naturally be lower than average; the trend matters more than the number.',
  },
  active_zone_minutes: {
    label: 'Cardio load', color: '#F0468A', unit: 'AZM',
    value: (d) => d?.active_zone_minutes ?? '--',
    about: 'Active Zone Minutes are your cardio load metric. During Foundation phase, 10-20 AZM per day builds aerobic base without triggering dysautonomia flares. Time in fat burn, cardio, and peak zones all count.',
  },
  spo2: {
    label: 'SpO2', color: '#8B5CF6', unit: '%',
    value: (d) => d?.spo2 ? `${d.spo2}%` : '--',
    about: 'Blood oxygen saturation. Normal range is 95-100%. Lower values during sleep can indicate breathing disruption which worsens autonomic symptoms.',
  },
  respiratory_rate: {
    label: 'Respiratory rate', color: '#00B4D8', unit: 'br/m',
    value: (d) => d?.respiratory_rate ?? '--',
    about: 'Average breathing rate during sleep. Normal range is 12-20. Elevated respiratory rate can signal MCAS activation or autonomic stress.',
  },
  visual: { label: 'Visual', color: '#00B4D8', unit: '/5', value: (d) => d?.score ?? '--', about: 'Your logged visual symptom scores -- oscillopsia, derealization, and light sensitivity. Tracks with VOR dysfunction and nystagmus; tends to worsen with poor sleep and in luteal late phase.' },
  dizziness: { label: 'Dizziness', color: '#5B5EF4', unit: '/5', value: (d) => '--', about: 'Your logged dizziness scores over time. Correlates strongly with sleep, vestibular session count, and cycle phase.' },
  fatigue: { label: 'Fatigue', color: '#F0468A', unit: '/5', value: (d) => '--', about: 'Your logged fatigue scores over time. Calorie intake and sleep are the two strongest correlates.' },
  gut: { label: 'Gut symptoms', color: '#00C896', unit: '/5', value: (d) => '--', about: 'Your logged gut symptom scores. DAO enzyme use and ox bile correlate with lower scores on meal days.' },
  anxiety: { label: 'Anxiety', color: '#FF9500', unit: '/5', value: (d) => '--', about: 'Your logged anxiety scores. Vagal practices correlate with same-day reduction.' },
}

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// Day removed -- a single day is not a trend. Values map to lookback length.
const PERIODS = { Week: 7, Month: 30, '3 Months': 90 }

export default function MetricDetail({ data, onBack }) {
  const [period, setPeriod] = useState('Week')
  const [trend, setTrend] = useState(null)   // null = loading, [] = genuinely none

  const metricKey = data?.metric || 'steps'
  useEffect(() => {
    let live = true
    setTrend(null)
    getMetricTrend(metricKey, PERIODS[period])
      .then(t => { if (live) setTrend(t) })
      .catch(() => { if (live) setTrend([]) })
    return () => { live = false }
  }, [metricKey, period])
  const cfg = METRICS[data?.metric] || METRICS.steps
  const color = cfg.color
  
  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', paddingBottom: 40 }}>
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div className="eyebrow" style={{ color, marginBottom: 5 }}>{cfg.label}</div>
        <div className="mono" style={{ fontSize: 52, fontWeight: 300, color, lineHeight: 1, letterSpacing: '-.04em', marginBottom: 6 }}>
          {data?.currentValue ?? cfg.value(data)}
          <span style={{ fontSize: 18, color: 'var(--ink3)', marginLeft: 2 }}>{cfg.unit}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.55 }}>{cfg.about}</div>
      </div>

      {/* Period selector */}
      <div className="period-row">
        {Object.keys(PERIODS).map(p => (
          <button key={p} className={`period-btn${period === p ? ' on' : ''}`}
            style={period === p ? { background: color, borderColor: color } : {}}
            onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Real history from daily_logs. Never synthesised -- if there is no
            data the card says so rather than drawing a plausible shape. */}
        <div className="card" style={{ padding: '16px 12px 10px' }}>
          <div className="eyebrow" style={{ padding: '0 4px 10px' }}>History · last {PERIODS[period]} days</div>
          {trend === null && (
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', padding: 18 }}>Loading…</div>
          )}
          {trend?.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5, textAlign: 'center', padding: 16 }}>
              Nothing recorded yet for this metric.<br />
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink4)' }}>history starts building from today</span>
            </div>
          )}
          {trend?.length > 0 && (() => {
            const vals = trend.map(t => t.value)
            const max = Math.max(...vals), min = Math.min(...vals)
            const span = max - min || 1
            return (
              <>
                <div className="bar-chart" style={{ alignItems: 'flex-end' }}>
                  {trend.map((t, i) => {
                    // Scale within the observed range so small variations stay legible.
                    const h = Math.max(4, Math.round(((t.value - min) / span) * 60) + 12)
                    const isLast = i === trend.length - 1
                    return (
                      <div key={t.date} className="bar-col" title={`${t.date}: ${t.value}`}>
                        <div className="bar-fill" style={{ height: h, background: isLast ? color : color + '55' }} />
                        <div className="bar-lbl" style={{ color: isLast ? color : 'var(--ink3)', fontWeight: isLast ? 700 : 400 }}>
                          {Number(t.date.slice(8, 10))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="stat3" style={{ marginTop: 12 }}>
                  {[
                    ['Average', (vals.reduce((a, b) => a + b, 0) / vals.length)],
                    ['High', max],
                    ['Low', min],
                  ].map(([l, v]) => (
                    <div key={l} className="stat-tile">
                      <div className="mono" style={{ fontSize: 17, fontWeight: 300, color, lineHeight: 1, marginBottom: 4 }}>
                        {Math.round(v * 10) / 10}
                      </div>
                      <div className="eyebrow">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink4)', textAlign: 'center', marginTop: 8 }}>
                  {trend.length} day{trend.length === 1 ? '' : 's'} with data
                </div>
              </>
            )
          })()}
        </div>

        {/* Goal bar — only when this metric actually has a value.
            Previously read data.steps for every metric (so Sleep computed
            steps/8 and always showed 100%) and fell back to a fake 7240. */}
        {cfg.goal && cfg.raw?.(data) != null && (
          <div className="card" style={{ padding: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Goal progress</div>
            <div className="prog">
              <div className="prog-fill" style={{ width: `${Math.min((cfg.raw(data) / cfg.goal) * 100, 100)}%`, background: color }} />
            </div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 3 }}>
              {Math.round(Math.min((cfg.raw(data) / cfg.goal) * 100, 100))}% of {cfg.goal.toLocaleString()} goal
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
