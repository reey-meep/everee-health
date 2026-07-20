import { useState, useEffect, useRef } from 'react'
import { getDailyLog, upsertDailyLog, getPracticeLogs, togglePractice } from '../lib/db'
import { getCurrentPhase, getDayNumber, CYCLE_PHASES, ALL_TASKS } from '../lib/constants'
import { fetchDaySnapshot, fetchCurrentWeather, isConnected } from '../lib/google-health'
import SymptomScores from '../components/SymptomScores'
import Checklist from '../components/Checklist'

const today = new Date().toISOString().split('T')[0]

function weatherDesc(code) {
  if (!code && code !== 0) return ''
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 49) return 'Foggy'
  if (code <= 69) return 'Rainy'
  if (code <= 99) return 'Stormy'
  return ''
}

// Infer cycle phase from cycle day
function inferCyclePhase(day) {
  if (!day) return null
  const d = parseInt(day)
  if (d >= 1 && d <= 5) return 'menstrual'
  if (d >= 6 && d <= 13) return 'follicular'
  if (d >= 14 && d <= 16) return 'ovulation'
  if (d >= 17 && d <= 22) return 'luteal_early'
  if (d >= 23) return 'luteal_late'
  return null
}

export default function Today({ showToast }) {
  const [log, setLog] = useState({})
  const [practices, setPractices] = useState({})
  const [weather, setWeather] = useState(null)
  const [prevPressure, setPrevPressure] = useState(null)
  const [fitbitData, setFitbitData] = useState(null)
  const [wins, setWins] = useState(['', '', ''])
  const [autoSuggestions, setAutoSuggestions] = useState([])
  const saveTimeout = useRef(null)

  const phase = getCurrentPhase()
  const dayNum = getDayNumber()

  useEffect(() => {
    loadData()
    fetchWeatherAndFitbit()
  }, [])

  async function loadData() {
    const [logData, practiceData] = await Promise.all([
      getDailyLog(today),
      getPracticeLogs(today)
    ])
    if (logData) {
      setLog(logData)
      setWins(logData.daily_wins || ['', '', ''])
    }
    const practiceMap = {}
    practiceData.forEach(p => { practiceMap[p.practice_id] = p.completed })
    setPractices(practiceMap)
  }

  async function fetchWeatherAndFitbit() {
    // Get yesterday's pressure for delta comparison
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      )
      const { latitude: lat, longitude: lon } = pos.coords

      // Today's weather
      const w = await fetchCurrentWeather(lat, lon)
      if (w) setWeather(w)

      // Yesterday's pressure for delta
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yDate = yesterday.toISOString().split('T')[0]
      const yLog = await getDailyLog(yDate)
      if (yLog?.weather_pressure) setPrevPressure(yLog.weather_pressure)

      // Save weather to today's log silently
      if (w) {
        await upsertDailyLog(today, {
          weather_temp: w.temp,
          weather_conditions: weatherDesc(w.code),
          weather_pressure: w.pressure,
        })
        setLog(l => ({ ...l, weather_temp: w.temp, weather_conditions: weatherDesc(w.code), weather_pressure: w.pressure }))
      }
    } catch {}

    // Pull Fitbit data if connected
    if (isConnected()) {
      const snapshot = await fetchDaySnapshot(today)
      if (snapshot) {
        setFitbitData(snapshot)

        // Auto-populate sleep hours if not already set
        if (snapshot.sleep_hours) {
          setLog(l => {
            if (!l.sleep_hours) {
              upsertDailyLog(today, { sleep_hours: snapshot.sleep_hours })
              return { ...l, sleep_hours: snapshot.sleep_hours }
            }
            return l
          })
        }

        // Build auto-suggestions from activity data
        const suggestions = []
        if (snapshot.walk_detected && snapshot.walk_minutes >= 10) {
          suggestions.push({ id: 'walk', text: `${snapshot.walk_minutes} min walk detected`, practiceId: 'walk' })
        }
        if (snapshot.weights_detected) {
          suggestions.push({ id: 'weights', text: 'Strength training detected', practiceId: 'weights' })
        }
        if (suggestions.length > 0) setAutoSuggestions(suggestions)
      }
    }
  }

  async function handleScoreChange(symptomId, value) {
    const scores = { ...(log.scores || {}), [symptomId]: value }
    setLog(l => ({ ...l, scores }))
    await upsertDailyLog(today, { scores })
  }

  async function handleToggle(practiceId, completed) {
    setPractices(p => ({ ...p, [practiceId]: completed }))
    await togglePractice(today, practiceId, completed)
  }

  // Accept an auto-suggestion and mark the practice done
  async function acceptSuggestion(suggestion) {
    await handleToggle(suggestion.practiceId, true)
    setAutoSuggestions(s => s.filter(x => x.id !== suggestion.id))
    showToast('Marked as done')
  }

  async function handleCycleDay(val) {
    const inferredPhase = inferCyclePhase(val)
    setLog(l => ({ ...l, cycle_day: val, cycle_phase: inferredPhase || l.cycle_phase }))
    await upsertDailyLog(today, { cycle_day: val, cycle_phase: inferredPhase })
  }

  async function handleCyclePhase(phaseId) {
    const cyclePhase = log.cycle_phase === phaseId ? null : phaseId
    setLog(l => ({ ...l, cycle_phase: cyclePhase }))
    await upsertDailyLog(today, { cycle_phase: cyclePhase })
  }

  async function handleWinChange(i, value) {
    const newWins = [...wins]
    newWins[i] = value
    setWins(newWins)
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => upsertDailyLog(today, { daily_wins: newWins }), 800)
  }

  const done = ALL_TASKS.filter(t => practices[t.id]).length
  const total = ALL_TASKS.length
  const pct = total ? done / total : 0
  const C = 119.4

  const highRisk = ['luteal_late', 'pms'].includes(log.cycle_phase)
  const pressureDrop = prevPressure && weather ? weather.pressure - prevPressure : null
  const pressureAlert = pressureDrop && pressureDrop < -3

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="view">
      {/* HERO */}
      <div className="hero">
        <div className="eyebrow">everee health · {dateLabel}</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontStyle: 'italic', fontWeight: 300 }}>Day {dayNum}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span className="pill" style={{ color: phase.color, borderColor: phase.color + '60' }}>{phase.name}</span>
          {weather && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: pressureAlert ? 'var(--amber)' : 'var(--ink3)' }}>
              {weather.temp}°F · {weatherDesc(weather.code)} · {weather.pressure}hPa
              {pressureDrop !== null && (
                <span style={{ color: pressureAlert ? 'var(--amber)' : 'var(--ink3)' }}>
                  {' '}({pressureDrop > 0 ? '+' : ''}{pressureDrop}hPa)
                </span>
              )}
            </span>
          )}
        </div>
        {pressureAlert && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--amber)', lineHeight: 1.5 }}>
            ⚠ Barometric pressure dropped {Math.abs(pressureDrop)}hPa since yesterday. Known MCAS trigger. Lower threshold day.
          </div>
        )}
      </div>

      {/* FITBIT AUTO DATA */}
      {fitbitData && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-head">
            <span className="card-title" style={{ color: 'var(--sky)' }}>From Fitbit</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink3)' }}>auto-synced</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Sleep', value: fitbitData.sleep_hours ? `${fitbitData.sleep_hours}h` : '--', color: fitbitData.sleep_hours < 7 ? 'var(--amber)' : 'var(--green)' },
                { label: 'Resting HR', value: fitbitData.resting_hr ? `${Math.round(fitbitData.resting_hr)}` : '--', color: 'var(--ink)' },
                { label: 'HRV', value: fitbitData.hrv ? `${Math.round(fitbitData.hrv)}` : '--', color: 'var(--sky)' },
                { label: 'SpO2', value: fitbitData.spo2 ? `${fitbitData.spo2}%` : '--', color: 'var(--indigo-l)' },
              ].map(s => (
                <div key={s.label} className="stat">
                  <div className="stat-v" style={{ color: s.color, fontSize: 18 }}>{s.value}</div>
                  <div className="stat-l">{s.label}</div>
                </div>
              ))}
            </div>
            {fitbitData.sleep_hours && fitbitData.sleep_hours < 7 && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--amber)', lineHeight: 1.5 }}>
                Under 7 hours sleep. Expect higher symptom sensitivity today.
              </div>
            )}
          </div>
        </div>
      )}

      {/* AUTO SUGGESTIONS */}
      {autoSuggestions.length > 0 && (
        <div className="card" style={{ marginBottom: 12, borderColor: 'rgba(56,189,248,.3)' }}>
          <div className="card-head">
            <span className="card-title" style={{ color: 'var(--sky)' }}>Fitbit detected</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {autoSuggestions.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{s.text}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--green)', color: 'var(--green)' }} onClick={() => acceptSuggestion(s)}>Mark done</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setAutoSuggestions(s2 => s2.filter(x => x.id !== s.id))}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROGRESS RING */}
      <div className="card">
        <div className="ring-wrap">
          <svg width="52" height="52" viewBox="0 0 52 52" className="ring-svg">
            <circle className="ring-bg" cx="26" cy="26" r="19" />
            <circle className="ring-fill" cx="26" cy="26" r="19"
              strokeDasharray={C} strokeDashoffset={C - C * pct}
              style={{ stroke: pct === 1 ? 'var(--green)' : pct > .6 ? 'var(--indigo)' : 'var(--amber)' }}
            />
          </svg>
          <div className="ring-info">
            <h3>{done} of {total} done</h3>
            <p>{pct === 1 ? 'Perfect day' : pct > .7 ? 'Great work' : 'Keep going'}</p>
          </div>
        </div>
      </div>

      {/* CYCLE */}
      <div className="card">
        <div className="card-head">
          <span className="card-title" style={{ color: 'var(--pink-l)' }}>Cycle</span>
          {log.cycle_phase && (
            <span className="pill" style={{ color: highRisk ? 'var(--red)' : 'var(--pink)', borderColor: highRisk ? 'var(--red)40' : 'var(--pink)40', fontSize: 8.5 }}>
              {CYCLE_PHASES.find(c => c.id === log.cycle_phase)?.label || log.cycle_phase}
            </span>
          )}
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: log.cycle_day ? 10 : 0 }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Cycle day</label>
              <input
                type="number" className="input" placeholder="e.g. 14"
                value={log.cycle_day || ''} onChange={e => handleCycleDay(e.target.value)}
                min="1" max="35"
              />
              {log.cycle_day && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink3)', marginTop: 4 }}>
                  Phase auto-detected from day
                </div>
              )}
            </div>
            <div style={{ flex: 2 }}>
              <label className="form-label">Override phase</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {CYCLE_PHASES.map(cp => (
                  <button key={cp.id} onClick={() => handleCyclePhase(cp.id)}
                    style={{
                      padding: '3px 8px', borderRadius: 99,
                      border: `1.5px solid ${log.cycle_phase === cp.id ? (cp.risk ? 'var(--red)' : 'var(--pink)') : 'var(--bd)'}`,
                      background: log.cycle_phase === cp.id ? (cp.risk ? 'rgba(239,68,68,.15)' : 'rgba(236,72,153,.15)') : 'var(--s2)',
                      color: log.cycle_phase === cp.id ? (cp.risk ? 'var(--red)' : 'var(--pink)') : 'var(--ink3)',
                      fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer',
                    }}>
                    {cp.label}{cp.risk ? '*' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {highRisk && (
            <div style={{ background: 'rgba(239,68,68,.1)', border: '1.5px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 11px', fontSize: 11.5, color: '#F0A0A0', lineHeight: 1.6 }}>
              <strong>High risk window.</strong> Oestrogen dropping. Mast cells destabilised. Lower your threshold expectations.
            </div>
          )}
        </div>
      </div>

      {/* SYMPTOM SCORES */}
      <div className="card">
        <div className="card-head">
          <span className="card-title" style={{ color: 'var(--indigo-l)' }}>Symptom Scores</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink3)' }}>1=mild · 5=severe</span>
        </div>
        <div className="card-body">
          <SymptomScores scores={log.scores} onChange={handleScoreChange} />
        </div>
      </div>

      {/* DAILY WINS */}
      <div className="card">
        <div className="card-head"><span className="card-title" style={{ color: 'var(--amber)' }}>Wins today</span></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {wins.map((win, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--amber)', fontSize: 14 }}>★</span>
              <input className="input" placeholder={`Win ${i + 1}...`} value={win} onChange={e => handleWinChange(i, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* CHECKLIST */}
      <div className="card">
        <div className="card-head">
          <span className="card-title" style={{ color: 'var(--green)' }}>Daily Practices</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{done}/{total}</span>
        </div>
        <div className="card-body">
          <Checklist completed={practices} onToggle={handleToggle} />
        </div>
      </div>

      {/* NOTES */}
      <div className="card">
        <div className="card-head"><span className="card-title" style={{ color: 'var(--sky)' }}>Notes</span></div>
        <div className="card-body">
          <textarea className="textarea" placeholder="How did today feel? Patterns, wins, hard moments..."
            rows={3} value={log.notes || ''}
            onChange={e => setLog(l => ({ ...l, notes: e.target.value }))}
            onBlur={e => upsertDailyLog(today, { notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
