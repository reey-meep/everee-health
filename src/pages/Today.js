import { useState, useEffect, useRef } from 'react'
import { getDailyLog, upsertDailyLog, getPracticeLogs, togglePractice, getEpisodes, getScheduleSettings, getFoodEntries } from '../lib/db'
import { getCurrentPhase, getDayNumber, CYCLE_PHASES, ALL_TASKS, SYMPTOMS, TASK_GROUPS, shiftSchedule, deriveScheduleStatus, TRACKABLE_PROMPTS } from '../lib/constants'
import ScheduleWidget from '../components/ScheduleWidget'
import PetPanel from '../components/PetPanel'
import { REQUIRED_PRACTICE_IDS } from '../lib/pet'
import { fetchDaySnapshot, fetchCurrentWeather, isConnected } from '../lib/google-health'

// Local calendar date, not UTC. Recomputed per call so a PWA left open
// past midnight rolls over instead of writing to yesterday's key.
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const SYM_COLOR = { dizziness: '#5B5EF4', visual: '#00B4D8', fatigue: '#F0468A', gut: '#00C896', anxiety: '#FF9500' }

function inferPhase(day) {
  const d = parseInt(day)
  if (!d) return null
  if (d <= 5) return 'menstrual'
  if (d <= 13) return 'follicular'
  if (d <= 16) return 'ovulation'
  if (d <= 22) return 'luteal_early'
  return 'luteal_late'
}

function weatherEmoji(code) {
  if (!code && code !== 0) return ''
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅️'
  if (code === 3) return '☁️'
  if (code <= 69) return '🌧'
  return '⛈'
}

// Horizontal snap carousel
function Carousel({ children }) {
  const ref = useRef(null)
  const [idx, setIdx] = useState(0)
  const items = children.filter(Boolean)
  function onScroll() {
    if (!ref.current) return
    setIdx(Math.round(ref.current.scrollLeft / (ref.current.clientWidth - 22)))
  }
  return (
    <div>
      <div ref={ref} className="carousel-wrap" onScroll={onScroll}>
        {items.map((child, i) => <div key={i} style={{ scrollSnapAlign: 'start', flexShrink: 0, width: 'calc(100% - 44px)' }}>{child}</div>)}
      </div>
      {items.length > 1 && (
        <div className="cdots">
          {items.map((_, i) => <div key={i} className="cdot" style={{ width: i === idx ? 14 : 5, background: i === idx ? 'var(--indigo)' : 'var(--bd)' }} />)}
        </div>
      )}
    </div>
  )
}

export default function Today({ showToast, openMetric, openEpisode, openSchedule }) {
  const [log, setLog] = useState({})
  const [practices, setPractices] = useState({})
  const [fitbit, setFitbit] = useState(null)
  const [weather, setWeather] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [openGroup, setOpenGroup] = useState('medications')
  const [showAllSymptoms, setShowAllSymptoms] = useState(false)
  const [settings, setSettings] = useState(null)
  const [foods, setFoods] = useState([])

  const phase = getCurrentPhase()
  const day = getDayNumber()

  useEffect(() => { load() }, [])

  async function load() {
    const [l, p, eps, fe] = await Promise.all([
      getDailyLog(todayKey()), getPracticeLogs(todayKey()), getEpisodes(3), getFoodEntries(todayKey()),
    ])
    setFoods(fe)
    if (l) setLog(l)
    const m = {}; p.forEach(x => { m[x.practice_id] = x.completed }); setPractices(m)
    setEpisodes(eps)
    getScheduleSettings().then(setSettings).catch(() => {})
    loadEnv(l || {})
  }

  async function loadEnv(currentLog = {}) {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }))
      const w = await fetchCurrentWeather(pos.coords.latitude, pos.coords.longitude)
      if (w) { setWeather(w); upsertDailyLog(todayKey(), { weather_temp: w.temp, weather_pressure: w.pressure }) }
    } catch {}
    if (isConnected()) {
      const s = await fetchDaySnapshot(todayKey())
      if (s) { setFitbit(s); if (s.sleep_hours && !currentLog.sleep_hours) upsertDailyLog(todayKey(), { sleep_hours: s.sleep_hours }) }
    }
  }

  // Each of these updates the UI optimistically, then rolls the change back and
  // tells the user if the write actually failed. Previously a failed save looked
  // identical to a successful one.
  async function setScore(id, val) {
    const prev = log.scores || {}
    const scores = { ...prev, [id]: prev[id] === val ? null : val }
    setLog(l => ({ ...l, scores }))
    try {
      await upsertDailyLog(todayKey(), { scores })
    } catch {
      setLog(l => ({ ...l, scores: prev }))
      showToast('Not saved — check connection', 'var(--red)')
    }
  }

  async function tick(id, done) {
    setPractices(p => ({ ...p, [id]: done }))
    try {
      await togglePractice(todayKey(), id, done)
    } catch {
      setPractices(p => ({ ...p, [id]: !done }))
      showToast('Not saved — check connection', 'var(--red)')
    }
  }

  async function setCycleDay(v) {
    // cycle_day is an int column: an empty field must send null, not ''.
    // Sending '' rejected the whole row, silently dropping cycle_phase too.
    const cycleDay = v === '' || v == null ? null : parseInt(v, 10)
    if (cycleDay !== null && Number.isNaN(cycleDay)) return
    const ph = inferPhase(v)
    const prev = { cycle_day: log.cycle_day, cycle_phase: log.cycle_phase }
    setLog(l => ({ ...l, cycle_day: v, cycle_phase: ph }))
    try {
      await upsertDailyLog(todayKey(), { cycle_day: cycleDay, cycle_phase: ph })
    } catch {
      setLog(l => ({ ...l, ...prev }))
      showToast('Not saved — check connection', 'var(--red)')
    }
  }

  const scores = log.scores || {}
  const scored = SYMPTOMS.filter(s => scores[s.id]).length
  const avg = scored ? SYMPTOMS.filter(s => scores[s.id]).reduce((a, s) => a + scores[s.id], 0) / scored : null
  const done = ALL_TASKS.filter(t => practices[t.id]).length
  const total = ALL_TASKS.length
  const pct = done / total
  const C = 2 * Math.PI * 28
  const highRisk = ['luteal_late', 'pms'].includes(log.cycle_phase)
  const stepPct = fitbit?.steps ? Math.min(fitbit.steps / 7500, 1) : 0
  const displaySymptoms = showAllSymptoms ? SYMPTOMS : SYMPTOMS.slice(0, 3)
  // Pet inputs are derived, never manually entered: calories from the food
  // diary, water from daily_logs, steps from Google Health, practices from
  // practice_logs. Required items are the 10 that actually exist in TASK_GROUPS.
  const reqDone = REQUIRED_PRACTICE_IDS.filter(id => practices[id]).length
  const bonusDone = ALL_TASKS.filter(t => practices[t.id] && !REQUIRED_PRACTICE_IDS.includes(t.id)).length
  const petActual = {
    cal: foods.reduce((sum, f) => sum + (f.calories || 0), 0),
    water: Number(log.water_oz || 0),
    steps: fitbit?.steps || 0,
    reqDone,
    bonusDone,
  }

  const schedule = shiftSchedule(settings?.wake_time || '07:30')
  // Status is derived from what she actually logged, not from ticks on the
  // schedule itself -- the schedule is a read-only view of the day.
  const scheduleStatuses = deriveScheduleStatus(schedule, {
    practices,
    mealCount: foods.length,
    waterOz: petActual.water,
    scoreCount: Object.values(scores).filter(Boolean).length,
  })
  // Same numbers the pet uses -- one calorie figure across the whole screen.
  const scheduleTotals = { calories: petActual.cal, water: petActual.water }

  return (
    <div className="screen active">
      {/* HEADER */}
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 14 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              {weather && <span style={{ marginLeft: 6 }}>{weatherEmoji(weather.code)} {weather.temp}°F</span>}
            </div>
            <div className="page-title" style={{ marginBottom: 8 }}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <span className="pill" style={{ color: phase.color, borderColor: phase.color + '40', background: phase.color + '12' }}>{phase.name} · Day {day}</span>
              {log.cycle_phase && (
                <span className="pill" style={{ color: highRisk ? 'var(--red)' : 'var(--pink)', borderColor: highRisk ? 'rgba(255,59,92,0.25)' : 'rgba(240,70,138,0.19)', background: highRisk ? 'var(--red-l)' : '#FEF0F6' }}>
                  {CYCLE_PHASES.find(c => c.id === log.cycle_phase)?.label}{highRisk && ' ⚠'}
                </span>
              )}
            </div>
          </div>
          {/* Practice ring */}
          <div style={{ position: 'relative', width: 70, height: 70, flexShrink: 0 }}>
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r="28" fill="none" stroke="var(--bg)" strokeWidth="5"/>
              <circle cx="35" cy="35" r="28" fill="none"
                stroke={pct === 1 ? 'var(--green)' : pct > .6 ? 'var(--indigo)' : 'var(--amber)'}
                strokeWidth="5" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C - C * pct}
                transform="rotate(-90 35 35)"
                style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="mono" style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1 }}>{done}</div>
              <div className="mono" style={{ fontSize: 7, color: 'var(--ink3)' }}>/{total}</div>
            </div>
          </div>
        </div>

        {highRisk && <div className="alert" style={{ background: '#FFF0F3', border: '1px solid #FFB3C0', color: '#8B0020', marginBottom: 14 }}>⚠ High-risk cycle window. Oestrogen dropping. Mast cells destabilised.</div>}

        {/* Vitals strip */}
        {fitbit && (
          <div className="vitals-strip">
            {[
              { label: 'Steps', value: fitbit.steps?.toLocaleString() ?? '--', color: 'var(--indigo)', sub: `${Math.round(stepPct * 100)}%`, metric: 'steps' },
              { label: 'Sleep', value: fitbit.sleep_hours ? `${fitbit.sleep_hours}h` : '--', color: (fitbit.sleep_hours != null && fitbit.sleep_hours < 7) ? 'var(--amber)' : 'var(--purple)', metric: 'sleep_hours' },
              { label: 'HR rest', value: fitbit.resting_hr ? Math.round(fitbit.resting_hr) : '--', color: 'var(--red)', metric: 'resting_hr' },
              { label: 'HRV', value: fitbit.hrv ? Math.round(fitbit.hrv) : '--', color: 'var(--sky)', metric: 'hrv' },
            ].map((s, i) => (
              <div key={s.label} className="vstat" onClick={() => openMetric({ metric: s.metric, currentValue: s.value, ...fitbit })}>
                <div className="vstat-val" style={{ color: s.color }}>{s.value}</div>
                {s.sub && <div className="mono" style={{ fontSize: 7, color: 'var(--ink3)', marginTop: 1 }}>{s.sub} of goal</div>}
                <div className="vstat-lbl">{s.label} ›</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="body">
        {/* Activity widgets */}
        {fitbit && (
          <div>
            <div className="section-label">Activity <a onClick={() => openMetric({ metric: 'steps', currentValue: fitbit.steps?.toLocaleString(), ...fitbit })}>See all ›</a></div>
            <Carousel>
              {/* Steps */}
              <div className="widget" style={{ borderTop: '3px solid var(--indigo)' }} onClick={() => openMetric({ metric: 'steps', currentValue: fitbit.steps?.toLocaleString(), ...fitbit })}>
                <div className="wlbl">Steps today</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div className="bignum" style={{ color: 'var(--indigo)' }}>{fitbit.steps?.toLocaleString() ?? '--'}</div>
                  <div style={{ textAlign: 'right' }}>
                    {fitbit.distance_km && <><div className="mono" style={{ fontSize: 18, color: 'var(--sky)', fontWeight: 300 }}>{fitbit.distance_km}<span style={{ fontSize: 10, color: 'var(--ink3)' }}>km</span></div><div className="mono" style={{ fontSize: 7.5, color: 'var(--ink3)', textTransform: 'uppercase' }}>distance</div></>}
                    {fitbit.floors && <><div className="mono" style={{ fontSize: 14, color: 'var(--sky)', marginTop: 4 }}>{fitbit.floors}<span style={{ fontSize: 9 }}> fl</span></div><div className="mono" style={{ fontSize: 7.5, color: 'var(--ink3)', textTransform: 'uppercase' }}>floors</div></>}
                  </div>
                </div>
                <div className="prog"><div className="prog-fill" style={{ width: `${stepPct * 100}%`, background: stepPct >= 1 ? 'var(--green)' : 'var(--indigo)' }} /></div>
                <div className="mono" style={{ fontSize: 8.5, color: 'var(--ink3)' }}>{Math.round(stepPct * 100)}% of 7,500 · tap for history ›</div>
              </div>

              {/* Cardio load */}
              <div className="widget" style={{ borderTop: '3px solid var(--pink)' }} onClick={() => openMetric({ metric: 'active_zone_minutes', currentValue: fitbit.active_zone_minutes, ...fitbit })}>
                <div className="wlbl">Cardio load</div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 10 }}>
                  <div><div className="bignum" style={{ color: 'var(--pink)' }}>{fitbit.active_zone_minutes ?? '--'}</div><div className="mono" style={{ fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase' }}>active zone min</div></div>
                  {fitbit.active_minutes && <div><div className="mono" style={{ fontSize: 24, color: 'var(--amber)', fontWeight: 300 }}>{fitbit.active_minutes}</div><div className="mono" style={{ fontSize: 8, color: 'var(--ink3)', textTransform: 'uppercase' }}>active min</div></div>}
                </div>
                {fitbit.hr_zones && (() => {
                  const z = fitbit.hr_zones
                  const colors = { out_of_range: '#C8CDD8', fat_burn: '#00B4D8', cardio: '#5B5EF4', peak: '#FF3B5C' }
                  const total = Object.values(z).reduce((a, b) => a + b, 0)
                  if (!total) return null
                  return (
                    <div>
                      <div style={{ display: 'flex', height: 5, borderRadius: 99, overflow: 'hidden', gap: 1, marginBottom: 5 }}>
                        {Object.entries(z).map(([k, v]) => v > 0 && <div key={k} style={{ flex: v, background: colors[k] }} />)}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Object.entries(z).filter(([, v]) => v > 0).map(([k, v]) => <span key={k} className="mono" style={{ fontSize: 8.5, color: 'var(--ink2)' }}><span style={{ color: colors[k] }}>●</span> {k.replace('_', ' ')} {v}m</span>)}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Sleep */}
              <div className="widget" style={{ borderTop: '3px solid var(--purple)' }} onClick={() => openMetric({ metric: 'sleep_hours', currentValue: `${fitbit.sleep_hours}h`, ...fitbit })}>
                <div className="wlbl">Sleep last night</div>
                <div className="bignum" style={{ color: (fitbit.sleep_hours != null && fitbit.sleep_hours < 7) ? 'var(--amber)' : 'var(--purple)', marginBottom: 8 }}>
                  {fitbit.sleep_hours ?? '--'}<span style={{ fontSize: 16, color: 'var(--ink3)' }}>h</span>
                </div>
                {fitbit.sleep_stages && (() => {
                  const s = fitbit.sleep_stages
                  const colors = { deep: '#5B5EF4', rem: '#8B5CF6', light: '#00B4D8', awake: '#C8CDD8' }
                  const total = Object.values(s).reduce((a, b) => a + b, 0)
                  if (!total) return null
                  return (
                    <div>
                      <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', gap: 1, marginBottom: 6 }}>
                        {['deep', 'rem', 'light', 'awake'].map(k => s[k] > 0 && <div key={k} style={{ flex: s[k], background: colors[k] }} />)}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['deep', 'rem', 'light', 'awake'].filter(k => s[k] > 0).map(k => <span key={k} className="mono" style={{ fontSize: 8.5, color: 'var(--ink2)', textTransform: 'capitalize' }}><span style={{ color: colors[k] }}>●</span> {k} {Math.round(s[k])}m</span>)}
                      </div>
                    </div>
                  )
                })()}
                {fitbit.sleep_hours != null && fitbit.sleep_hours < 7 && <div style={{ marginTop: 8, fontSize: 11.5, color: '#7A4500', background: 'var(--amber-xl)', borderRadius: 8, padding: '6px 10px', fontWeight: 500 }}>Under 7h -- higher symptom sensitivity today.</div>}
              </div>

              {/* Vitals */}
              <div className="widget" style={{ borderTop: '3px solid var(--red)' }}>
                <div className="wlbl">Vitals</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { l: 'Resting HR', v: fitbit.resting_hr ? Math.round(fitbit.resting_hr) : '--', u: 'bpm', c: 'var(--red)', m: 'resting_hr' },
                    { l: 'HRV', v: fitbit.hrv ? Math.round(fitbit.hrv) : '--', u: 'ms', c: 'var(--sky)', m: 'hrv' },
                    { l: 'SpO2', v: fitbit.spo2 ? `${fitbit.spo2}%` : '--', u: '', c: 'var(--purple)', m: 'spo2' },
                    { l: 'Resp rate', v: fitbit.respiratory_rate ? `${fitbit.respiratory_rate}` : '--', u: 'br/m', c: 'var(--sky)', m: 'respiratory_rate' },
                  ].map(m => (
                    <div key={m.l} onClick={() => openMetric({ metric: m.m, currentValue: m.v + m.u, ...fitbit })}
                      style={{ background: 'var(--bg)', borderRadius: 10, padding: 9, cursor: 'pointer' }}>
                      <div className="mono" style={{ fontSize: 20, color: m.c, fontWeight: 300, lineHeight: 1, marginBottom: 3 }}>{m.v}<span style={{ fontSize: 9, color: 'var(--ink3)' }}>{m.u}</span></div>
                      <div className="mono" style={{ fontSize: 7.5, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{m.l} ›</div>
                    </div>
                  ))}
                </div>
              </div>
            </Carousel>
          </div>
        )}

        {/* Symptom scores */}
        <div>
          <div className="section-label">
            Symptom scores
            <a onClick={() => setShowAllSymptoms(v => !v)}>{showAllSymptoms ? 'Show less ›' : 'Show all ›'}</a>
          </div>
          <div className="card">
            {/* Readiness ring */}
            {avg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--bd)' }}>
                <div style={{ position: 'relative', width: 62, height: 62, flexShrink: 0 }}>
                  <svg width="62" height="62" viewBox="0 0 62 62">
                    <circle cx="31" cy="31" r="26" fill="none" stroke="var(--bg)" strokeWidth="5"/>
                    <circle cx="31" cy="31" r="26" fill="none"
                      stroke={avg <= 2 ? 'var(--green)' : avg <= 3.5 ? 'var(--amber)' : 'var(--red)'}
                      strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 26}
                      strokeDashoffset={2 * Math.PI * 26 * (avg / 5)}
                      transform="rotate(-90 31 31)"
                      style={{ transition: 'all .4s' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 300, color: avg <= 2 ? 'var(--green)' : avg <= 3.5 ? 'var(--amber)' : 'var(--red)', lineHeight: 1 }}>{avg.toFixed(1)}</div>
                    <div className="mono" style={{ fontSize: 7, color: 'var(--ink3)' }}>/ 5</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
                    {avg <= 2 ? 'Feeling good' : avg <= 3 ? 'Moderate day' : avg <= 4 ? 'Challenging day' : 'High symptom load'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {SYMPTOMS.filter(s => scores[s.id]).map(sym => (
                      <div key={sym.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 52, fontSize: 10, color: 'var(--ink3)', fontWeight: 500 }}>{sym.label}</div>
                        <div style={{ flex: 1, height: 4, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${scores[sym.id] * 20}%`, background: SYM_COLOR[sym.id], borderRadius: 99 }} />
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: SYM_COLOR[sym.id], width: 10 }}>{scores[sym.id]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Score rows */}
            {displaySymptoms.map((sym, si) => (
              <div key={sym.id} style={{ padding: '11px 14px', borderBottom: si < displaySymptoms.length - 1 ? '1px solid var(--bd)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: SYM_COLOR[sym.id], flexShrink: 0 }} />
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{sym.label}</div>
                  {scores[sym.id] && (
                    <button onClick={() => openMetric({ metric: sym.id, currentValue: scores[sym.id] })}
                      style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: SYM_COLOR[sym.id], fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {sym.descriptors[scores[sym.id] - 1]}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  )}
                </div>
                <div className="score-strip">
                  {sym.descriptors.map((desc, i) => {
                    const val = i + 1; const on = scores[sym.id] === val
                    return (
                      <button key={val} className={`score-btn${on ? ' on' : ''}`}
                        style={on ? { background: SYM_COLOR[sym.id], borderColor: SYM_COLOR[sym.id] } : {}}
                        onClick={() => setScore(sym.id, val)}>
                        <span className="sn">{val}</span>
                        <span className="sd">{desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cycle */}
        <div>
          <div className="section-label">Cycle</div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div>
                <div className="form-label">Day</div>
                <input type="number" className="input" placeholder="14" value={log.cycle_day || ''} min="1" max="35"
                  style={{ width: 72, textAlign: 'center', fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', padding: '8px' }}
                  onChange={e => setCycleDay(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="form-label">Phase {log.cycle_day ? '· auto' : ''}</div>
                <div className="chip-row">
                  {CYCLE_PHASES.map(cp => (
                    <button key={cp.id} className={`chip${log.cycle_phase === cp.id ? ' on' : ''}`}
                      style={log.cycle_phase === cp.id ? { background: cp.risk ? 'var(--red)' : 'var(--pink)', borderColor: cp.risk ? 'var(--red)' : 'var(--pink)' } : {}}
                      onClick={() => { const ph = log.cycle_phase === cp.id ? null : cp.id; setLog(l => ({ ...l, cycle_phase: ph })); upsertDailyLog(todayKey(), { cycle_phase: ph }) }}>
                      {cp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tamagotchi -- sits below Cycle */}
        <PetPanel actual={petActual} practices={practices} />

        <div className="section-label">Schedule <a onClick={openSchedule}>Open ›</a></div>
        <ScheduleWidget
          schedule={schedule}
          statuses={scheduleStatuses}
          trackable={TRACKABLE_PROMPTS}
          totals={scheduleTotals}
          steps={fitbit?.steps}
          onOpen={openSchedule}
        />


        {/* Recent episodes */}
        {episodes.length > 0 && (
          <div>
            <div className="section-label">Recent episodes <a onClick={() => {}}>+ Log ›</a></div>
            <div className="card">
              {episodes.map((ep, i) => {
                const { EPISODE_TYPES } = require('../lib/constants')
                const t = EPISODE_TYPES.find(x => x.id === ep.episode_type) || { color: 'var(--pink)', label: ep.episode_type }
                return (
                  <div key={ep.id} className="row" onClick={() => openEpisode(ep)}>
                    <div style={{ width: 4, height: 36, borderRadius: 99, background: t.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{t.label}</div>
                      <div className="mono" style={{ fontSize: 9, color: 'var(--ink3)' }}>
                        {new Date(ep.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {ep.severity && ` · Severity ${ep.severity}`}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Practices */}
        <div>
          <div className="section-label">
            Daily practices
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="mono" style={{ fontSize: 11, color: done === total ? 'var(--green)' : 'var(--ink3)', fontWeight: 600 }}>{done}/{total}</div>
              <div style={{ width: 44, height: 4, borderRadius: 99, background: 'var(--bd)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct * 100}%`, background: pct === 1 ? 'var(--green)' : 'var(--indigo)', borderRadius: 99 }} />
              </div>
            </div>
          </div>
          <div className="card">
            {TASK_GROUPS.map((group, gi) => {
              const gdone = group.tasks.filter(t => practices[t.id]).length
              const isOpen = openGroup === group.id
              const barColor = gdone === group.tasks.length ? 'var(--green)' : gdone > 0 ? 'var(--amber)' : 'var(--bd)'
              return (
                <div key={group.id} style={{ borderBottom: gi < TASK_GROUPS.length - 1 ? '1px solid var(--bd)' : 'none' }}>
                  <div className="group-header" onClick={() => setOpenGroup(isOpen ? null : group.id)}>
                    <div style={{ width: 4, height: 20, borderRadius: 99, background: barColor }} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{group.label}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: gdone === group.tasks.length ? 'var(--green)' : 'var(--ink3)' }}>{gdone}/{group.tasks.length}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                  {isOpen && group.tasks.map(task => (
                    <div key={task.id} className="check-row" onClick={() => tick(task.id, !practices[task.id])} style={{ opacity: practices[task.id] ? .5 : 1 }}>
                      <div className={`chk${practices[task.id] ? ' done' : ''}`}>
                        {practices[task.id] && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: practices[task.id] ? 'var(--ink3)' : 'var(--ink)', textDecoration: practices[task.id] ? 'line-through' : 'none' }}>{task.text}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
