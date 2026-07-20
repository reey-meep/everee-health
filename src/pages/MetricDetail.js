import { useState } from 'react'

const METRICS = {
  steps: {
    label: 'Steps', color: '#5B5EF4', unit: '',
    value: (d) => d?.steps?.toLocaleString() ?? '--',
    goal: 7500,
    about: 'Steps and light walking directly support vestibular rehabilitation and autonomic stability. Your dysautonomia means pacing matters -- 7,500 is your Foundation phase ceiling, not your floor. Correlation data shows your dizziness is lowest on days with 5,000-7,500 steps.',
    weekBars: [30, 55, 45, 60, 20, 50, 58],
    stats: { avg: '6,420', high: '8,100', low: '3,200' },
  },
  sleep_hours: {
    label: 'Sleep', color: '#8B5CF6', unit: 'h',
    value: (d) => d?.sleep_hours ? `${d.sleep_hours}h` : '--',
    goal: 8,
    about: 'Sleep is your single highest-impact variable. Under 7 hours consistently raises MCAS reactivity, vestibular sensitivity, and autonomic instability. The correlation engine shows sleep has the strongest next-day effect on your symptom scores.',
    weekBars: [58, 42, 65, 38, 55, 70, 55],
    stats: { avg: '7.0h', high: '8.5h', low: '5.8h' },
  },
  resting_hr: {
    label: 'Resting HR', color: '#FF3B5C', unit: 'bpm',
    value: (d) => d?.resting_hr ? `${Math.round(d.resting_hr)}` : '--',
    about: 'Resting heart rate is your autonomic baseline. With dysautonomia, elevated resting HR can signal a flare day. Your propranolol keeps this stable -- watch for rises above 75 bpm at rest as a signal to lower activity.',
    weekBars: [62, 68, 64, 72, 60, 63, 62],
    stats: { avg: '64 bpm', high: '72 bpm', low: '58 bpm' },
  },
  hrv: {
    label: 'HRV', color: '#00B4D8', unit: 'ms',
    value: (d) => d?.hrv ? `${Math.round(d.hrv)}` : '--',
    about: 'HRV measures autonomic nervous system recovery. Higher is generally better -- low HRV days predict higher symptom load the next day in your correlation data. Your dysautonomia means your HRV will naturally be lower than average; the trend matters more than the number.',
    weekBars: [48, 32, 55, 28, 52, 60, 48],
    stats: { avg: '44 ms', high: '62 ms', low: '28 ms' },
  },
  active_zone_minutes: {
    label: 'Cardio load', color: '#F0468A', unit: 'AZM',
    value: (d) => d?.active_zone_minutes ?? '--',
    about: 'Active Zone Minutes are your cardio load metric. During Foundation phase, 10-20 AZM per day builds aerobic base without triggering dysautonomia flares. Time in fat burn, cardio, and peak zones all count.',
    weekBars: [12, 34, 28, 0, 22, 45, 34],
    stats: { avg: '28 min', high: '55 min', low: '0 min' },
  },
  spo2: {
    label: 'SpO2', color: '#8B5CF6', unit: '%',
    value: (d) => d?.spo2 ? `${d.spo2}%` : '--',
    about: 'Blood oxygen saturation. Normal range is 95-100%. Lower values during sleep can indicate breathing disruption which worsens autonomic symptoms.',
    weekBars: [97, 96, 98, 95, 97, 98, 97],
    stats: { avg: '97%', high: '99%', low: '94%' },
  },
  respiratory_rate: {
    label: 'Respiratory rate', color: '#00B4D8', unit: 'br/m',
    value: (d) => d?.respiratory_rate ?? '--',
    about: 'Average breathing rate during sleep. Normal range is 12-20. Elevated respiratory rate can signal MCAS activation or autonomic stress.',
    weekBars: [14, 15, 13, 16, 14, 13, 14],
    stats: { avg: '14 br/m', high: '17 br/m', low: '12 br/m' },
  },
  dizziness: { label: 'Dizziness', color: '#5B5EF4', unit: '/5', value: (d) => '--', weekBars: [2,3,1,4,2,1,2], stats: { avg: '2.1', high: '4', low: '1' }, about: 'Your logged dizziness scores over time. Correlates strongly with sleep, vestibular session count, and cycle phase.' },
  fatigue: { label: 'Fatigue', color: '#F0468A', unit: '/5', value: (d) => '--', weekBars: [3,2,1,4,3,2,3], stats: { avg: '2.6', high: '4', low: '1' }, about: 'Your logged fatigue scores over time. Calorie intake and sleep are the two strongest correlates.' },
  gut: { label: 'Gut symptoms', color: '#00C896', unit: '/5', value: (d) => '--', weekBars: [1,2,1,3,1,1,2], stats: { avg: '1.6', high: '3', low: '1' }, about: 'Your logged gut symptom scores. DAO enzyme use and ox bile correlate with lower scores on meal days.' },
  anxiety: { label: 'Anxiety', color: '#FF9500', unit: '/5', value: (d) => '--', weekBars: [3,2,2,4,3,2,3], stats: { avg: '2.8', high: '4', low: '1' }, about: 'Your logged anxiety scores. Vagal practices correlate with same-day reduction.' },
}

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PERIODS = ['Day', 'Week', 'Month', 'Year']

export default function MetricDetail({ data, onBack }) {
  const [period, setPeriod] = useState('Week')
  const cfg = METRICS[data?.metric] || METRICS.steps
  const color = cfg.color
  const maxBar = Math.max(...cfg.weekBars)

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
        {PERIODS.map(p => (
          <button key={p} className={`period-btn${period === p ? ' on' : ''}`}
            style={period === p ? { background: color, borderColor: color } : {}}
            onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Chart */}
        <div className="card" style={{ padding: '16px 12px 8px' }}>
          <div className="bar-chart">
            {cfg.weekBars.map((v, i) => {
              const h = Math.max(4, Math.round((v / maxBar) * 72))
              const isToday = i === cfg.weekBars.length - 1
              return (
                <div key={i} className="bar-col">
                  <div className="bar-fill" style={{ height: h, background: isToday ? color : color + '55' }} />
                  <div className="bar-lbl" style={{ color: isToday ? color : 'var(--ink3)', fontWeight: isToday ? 700 : 400 }}>{WEEK_LABELS[i]}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="stat3">
          {[['Average', cfg.stats.avg], ['High', cfg.stats.high], ['Low', cfg.stats.low]].map(([l, v]) => (
            <div key={l} className="stat-tile">
              <div className="mono" style={{ fontSize: 18, fontWeight: 300, color, lineHeight: 1, marginBottom: 4 }}>{v}</div>
              <div className="eyebrow">{l}</div>
            </div>
          ))}
        </div>

        {/* Goal bar if applicable */}
        {cfg.goal && (
          <div className="card" style={{ padding: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Goal progress</div>
            <div className="prog">
              <div className="prog-fill" style={{ width: `${Math.min((parseInt(data?.steps || 7240) / cfg.goal) * 100, 100)}%`, background: color }} />
            </div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 3 }}>
              {Math.round(Math.min((parseInt(data?.steps || 7240) / cfg.goal) * 100, 100))}% of {cfg.goal.toLocaleString()} goal
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
