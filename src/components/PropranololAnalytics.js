import { useState, useEffect } from 'react'
import { getPracticeLogs } from '../lib/db'
import { fetchHeartRate } from '../lib/google-health'

// Practice IDs for propranolol doses
const PROP_IDS = ['prop1', 'prop2', 'prop3']
const DOSE_LABELS = { prop1: 'Dose 1', prop2: 'Dose 2', prop3: 'Dose 3' }
const DOSE_NAMES = { prop1: 'Morning', prop2: 'Midday', prop3: 'Evening' }
const TARGET_GAP_HOURS = 6
const TARGET_GAP_MS = TARGET_GAP_HOURS * 60 * 60 * 1000
const LATE_THRESHOLD_MIN = 30 // minutes over 6h gap = late
const EARLY_THRESHOLD_MIN = 20 // minutes under 6h gap = early

// Pull average HR from a time window via Google Health
async function avgHRInWindow(startMs, endMs) {
  try {
    const data = await fetchHeartRate(
      new Date(startMs).toISOString(),
      new Date(endMs).toISOString()
    )
    const points = data?.dataPoints || []
    if (!points.length) return null
    const values = points.map(p => p?.value?.[0]?.fpVal).filter(Boolean)
    if (!values.length) return null
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  } catch {
    return null
  }
}

// Analyse a single day's dose timing
async function analyseDayDoses(date, practiceLogs) {
  const dayLogs = practiceLogs.filter(l => l.date === date)
  const doses = PROP_IDS.map(id => {
    const log = dayLogs.find(l => l.practice_id === id && l.completed)
    return { id, takenAt: log?.completed_at ? new Date(log.completed_at) : null }
  }).filter(d => d.takenAt)

  if (doses.length < 2) return doses.map(d => ({ ...d, gapMinutes: null, status: 'only_dose', hrBefore: null, hrAfter: null }))

  const results = []
  for (let i = 0; i < doses.length; i++) {
    const dose = doses[i]
    const prev = doses[i - 1]
    let gapMinutes = null
    let status = 'on_time'

    if (prev) {
      gapMinutes = Math.round((dose.takenAt - prev.takenAt) / 60000)
      const diffFromTarget = gapMinutes - TARGET_GAP_HOURS * 60
      if (diffFromTarget > LATE_THRESHOLD_MIN) status = 'late'
      else if (diffFromTarget < -EARLY_THRESHOLD_MIN) status = 'early'
      else status = 'on_time'
    }

    // Fetch HR windows around this dose time
    const ts = dose.takenAt.getTime()
    const [hrBefore, hrAfter] = await Promise.all([
      avgHRInWindow(ts - 35 * 60000, ts - 5 * 60000),   // 35-5 min before
      avgHRInWindow(ts + 20 * 60000, ts + 55 * 60000),   // 20-55 min after
    ])

    results.push({ ...dose, gapMinutes, status, hrBefore, hrAfter })
  }
  return results
}

function formatGap(minutes) {
  if (minutes === null) return '--'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

function statusColor(status) {
  if (status === 'on_time') return 'var(--green)'
  if (status === 'late') return 'var(--amber)'
  if (status === 'early') return 'var(--sky)'
  return 'var(--ink3)'
}

function statusLabel(status, gapMinutes) {
  if (status === 'on_time') return 'On time'
  if (status === 'late') {
    const over = gapMinutes - TARGET_GAP_HOURS * 60
    return `${over} min late`
  }
  if (status === 'early') {
    const under = TARGET_GAP_HOURS * 60 - gapMinutes
    return `${under} min early`
  }
  return '--'
}

export default function PropranololAnalytics({ showToast }) {
  const [loading, setLoading] = useState(true)
  const [daysData, setDaysData] = useState([])
  const [summary, setSummary] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    // Get last 14 days of practice logs
    const allLogs = []
    const today = new Date()
    const dates = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      dates.push(d.toISOString().split('T')[0])
    }

    // Fetch all practice logs for the window
    const { supabase } = await import('../lib/supabase')
    const USER_ID = '1e133101-10e9-468a-ab81-d9b76a20e8ed'
    const { data } = await supabase
      .from('practice_logs')
      .select('*')
      .eq('user_id', USER_ID)
      .in('practice_id', PROP_IDS)
      .gte('date', dates[dates.length - 1])
      .order('date', { ascending: false })

    const logs = data || []

    // Analyse each day that has at least one dose logged
    const dayResults = []
    for (const date of dates) {
      const dayLogs = logs.filter(l => l.date === date && l.completed)
      if (dayLogs.length === 0) continue
      const doses = await analyseDayDoses(date, logs)
      if (doses.length > 0) dayResults.push({ date, doses })
    }

    // Build summary stats
    const allDoses = dayResults.flatMap(d => d.doses)
    const withGap = allDoses.filter(d => d.gapMinutes !== null)
    const late = withGap.filter(d => d.status === 'late')
    const onTime = withGap.filter(d => d.status === 'on_time')
    const withHR = allDoses.filter(d => d.hrBefore && d.hrAfter)
    const avgBefore = withHR.length ? Math.round(withHR.reduce((s, d) => s + d.hrBefore, 0) / withHR.length) : null
    const avgAfter = withHR.length ? Math.round(withHR.reduce((s, d) => s + d.hrAfter, 0) / withHR.length) : null

    // Late dose 3 count -- most important
    const dose3 = allDoses.filter(d => d.id === 'prop3')
    const dose3Late = dose3.filter(d => d.status === 'late').length

    setSummary({
      totalDoses: allDoses.length,
      late: late.length,
      onTime: onTime.length,
      avgBefore, avgAfter,
      hrReduction: (avgBefore && avgAfter) ? avgBefore - avgAfter : null,
      dose3Late,
      withHRCount: withHR.length,
    })
    setDaysData(dayResults)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
      Analysing dose data and heart rate windows...
    </div>
  )

  return (
    <div>
      {daysData.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', color: 'var(--ink2)', marginBottom: 8 }}>No dose data yet</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.7 }}>
              Mark propranolol doses as complete in the Today checklist. The system will track timing and analyse heart rate before and after each dose automatically.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* SUMMARY */}
          {summary && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-head">
                <span className="card-title" style={{ color: 'var(--indigo-l)' }}>14-day summary</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'On time', value: summary.onTime, color: 'var(--green)' },
                    { label: 'Late', value: summary.late, color: summary.late > 0 ? 'var(--amber)' : 'var(--ink3)' },
                    { label: 'Dose 3 late', value: summary.dose3Late, color: summary.dose3Late > 0 ? 'var(--red)' : 'var(--ink3)' },
                  ].map(s => (
                    <div key={s.label} className="stat">
                      <div className="stat-v" style={{ color: s.color }}>{s.value}</div>
                      <div className="stat-l">{s.label}</div>
                    </div>
                  ))}
                </div>

                {summary.dose3Late > 0 && (
                  <div style={{ background: 'rgba(239,68,68,.1)', border: '1.5px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--red)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Evening dose -- {summary.dose3Late} late in 14 days</div>
                    <div style={{ fontSize: 12, color: '#D4A0A0', lineHeight: 1.6 }}>
                      The July 19 cardiac episode occurred after a missed evening dose. Late or missed dose 3 is the highest risk pattern in your data.
                    </div>
                  </div>
                )}

                {summary.hrReduction !== null && (
                  <div style={{ background: 'var(--s2)', border: 'var(--border)', borderRadius: 8, padding: '12px' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--sky)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                      Average HR impact per dose
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'italic', color: 'var(--ink)' }}>{summary.avgBefore}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)' }}>avg before</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
                          -{summary.hrReduction} bpm
                        </div>
                        <div style={{ height: 1, background: 'var(--bd)', margin: '4px 0' }} />
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 7.5, color: 'var(--ink3)' }}>
                          from {summary.withHRCount} readings
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'italic', color: 'var(--green)' }}>{summary.avgAfter}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)' }}>avg after</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginTop: 8, lineHeight: 1.6 }}>
                      Before window: 5-35 min before dose · After window: 20-55 min after dose
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DAY BY DAY */}
          {daysData.map(({ date, doses }) => (
            <div key={date} className="card" style={{ marginBottom: 8 }}>
              <div className="card-head">
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink2)' }}>
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>
                  {doses.length} dose{doses.length > 1 ? 's' : ''} logged
                </span>
              </div>
              <div className="card-body">
                {doses.map(dose => (
                  <div key={dose.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--s2)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 12, color: statusColor(dose.status) }}>
                          {DOSE_LABELS[dose.id]}
                        </span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>
                          {DOSE_NAMES[dose.id]}
                        </span>
                        {dose.id === 'prop3' && (
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, color: 'var(--red)', background: 'rgba(239,68,68,.15)', padding: '1px 5px', borderRadius: 99 }}>critical</span>
                        )}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>
                        {dose.takenAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {dose.gapMinutes !== null && (
                          <span style={{ marginLeft: 8 }}>gap: {formatGap(dose.gapMinutes)}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {dose.gapMinutes !== null && (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: statusColor(dose.status), fontWeight: 600, marginBottom: 2 }}>
                          {statusLabel(dose.status, dose.gapMinutes)}
                        </div>
                      )}
                      {dose.hrBefore && dose.hrAfter ? (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>
                          {dose.hrBefore}→{dose.hrAfter} bpm
                        </div>
                      ) : (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink3)', opacity: .6 }}>
                          no HR data
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
