import { useState, useEffect, useRef } from 'react'
import { getDailyLog, upsertDailyLog, getPracticeLogs, togglePractice, getEpisodes } from '../lib/db'
import { getCurrentPhase, getDayNumber, CYCLE_PHASES, ALL_TASKS, SYMPTOMS, TASK_GROUPS } from '../lib/constants'
import { fetchDaySnapshot, fetchCurrentWeather, isConnected } from '../lib/google-health'
import MetricCard from '../components/MetricCard'

const TODAY = new Date().toISOString().split('T')[0]
const SYM_COLOR = { dizziness:'#5B5EF4', visual:'#00B4D8', fatigue:'#F0468A', gut:'#00C896', anxiety:'#FF9500' }

function inferPhase(day) {
  const d = parseInt(day)
  if (!d) return null
  if (d<=5) return 'menstrual'; if (d<=13) return 'follicular'
  if (d<=16) return 'ovulation'; if (d<=22) return 'luteal_early'
  return 'luteal_late'
}

function weatherDesc(code) {
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅️'
  if (code === 3) return '☁️'
  if (code <= 69) return '🌧'
  return '⛈'
}

// Horizontal snap carousel
function Carousel({ children, gap = 10, peek = 16 }) {
  const ref = useRef(null)
  const [idx, setIdx] = useState(0)
  const n = children.filter(Boolean).length
  function onScroll() {
    if (!ref.current) return
    const w = ref.current.clientWidth - peek * 2
    setIdx(Math.round(ref.current.scrollLeft / (w + gap)))
  }
  return (
    <div>
      <div ref={ref} onScroll={onScroll} style={{ display:'flex', overflowX:'scroll', scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch', scrollbarWidth:'none', gap, padding:`2px ${peek}px` }}>
        {children.filter(Boolean).map((child, i) => (
          <div key={i} style={{ scrollSnapAlign:'start', flexShrink:0, width:`calc(100% - ${peek*2+gap}px)` }}>{child}</div>
        ))}
      </div>
      {n > 1 && (
        <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:8 }}>
          {Array.from({length:n}).map((_,i) => (
            <div key={i} style={{ width:i===idx?14:5, height:5, borderRadius:99, background:i===idx?'var(--indigo)':'var(--bd)', transition:'all .25s' }} />
          ))}
        </div>
      )}
    </div>
  )
}

// Section header
function SH({ label, action, onAction }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
      <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', fontWeight:500 }}>{label}</div>
      {action && <button onClick={onAction} style={{ fontFamily:'var(--mono)', fontSize:9.5, color:'var(--indigo)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>{action}</button>}
    </div>
  )
}

export default function Today({ showToast, openDetail }) {
  const [log, setLog] = useState({})
  const [practices, setPractices] = useState({})
  const [weather, setWeather] = useState(null)
  const [fitbit, setFitbit] = useState(null)
  const [recentEpisodes, setRecentEpisodes] = useState([])
  const [openGroup, setOpenGroup] = useState('medications')
  const [showAllSymptoms, setShowAllSymptoms] = useState(false)

  const phase = getCurrentPhase()
  const day = getDayNumber()

  useEffect(() => { load() }, [])

  async function load() {
    const [l, p, eps] = await Promise.all([getDailyLog(TODAY), getPracticeLogs(TODAY), getEpisodes(5)])
    if (l) setLog(l)
    const m = {}; p.forEach(x => { m[x.practice_id] = x.completed }); setPractices(m)
    setRecentEpisodes(eps.slice(0, 3))
    loadEnv()
  }

  async function loadEnv() {
    try {
      const pos = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout:5000}))
      const w = await fetchCurrentWeather(pos.coords.latitude, pos.coords.longitude)
      if (w) { setWeather(w); upsertDailyLog(TODAY, {weather_temp:w.temp, weather_pressure:w.pressure}) }
    } catch {}
    if (isConnected()) {
      const s = await fetchDaySnapshot(TODAY)
      if (s) { setFitbit(s); if (s.sleep_hours && !log.sleep_hours) upsertDailyLog(TODAY, {sleep_hours:s.sleep_hours}) }
    }
  }

  async function setScore(id, val) {
    const scores = {...(log.scores||{}), [id]: log.scores?.[id]===val ? null : val}
    setLog(l => ({...l, scores})); upsertDailyLog(TODAY, {scores})
  }

  async function tick(id, done) {
    setPractices(p => ({...p, [id]:done})); togglePractice(TODAY, id, done)
  }

  const scores = log.scores || {}
  const scored = SYMPTOMS.filter(s => scores[s.id]).length
  const avg = scored ? (SYMPTOMS.filter(s => scores[s.id]).reduce((a,s) => a + scores[s.id], 0) / scored) : null
  const done = ALL_TASKS.filter(t => practices[t.id]).length
  const total = ALL_TASKS.length
  const pct = done / total
  const highRisk = ['luteal_late','pms'].includes(log.cycle_phase)
  const C = 2 * Math.PI * 30
  const stepPct = fitbit?.steps ? Math.min(fitbit.steps / 7500, 1) : 0
  const displaySymptoms = showAllSymptoms ? SYMPTOMS : SYMPTOMS.slice(0, 3)

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* ── HERO HEADER ─────────────────────────── */}
      <div style={{ background:'var(--surface)', paddingTop:56 }}>
        <div style={{ padding:'0 16px 0' }}>
          {/* Date + weather */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:16 }}>
            <div>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:5 }}>
                {new Date().toLocaleDateString('en-US',{weekday:'long', month:'short', day:'numeric'})}
                {weather && <span style={{ marginLeft:6 }}>{weatherDesc(weather.code)} {weather.temp}°F</span>}
              </div>
              <div style={{ fontSize:32, fontWeight:800, letterSpacing:'-.8px', color:'var(--ink)', lineHeight:1, marginBottom:8 }}>
                Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                <span style={{ fontFamily:'var(--mono)', fontSize:8.5, padding:'3px 9px', borderRadius:99, border:`1px solid ${phase.color}50`, color:phase.color, background:phase.color+'12' }}>{phase.name} · Day {day}</span>
                {log.cycle_phase && (
                  <span style={{ fontFamily:'var(--mono)', fontSize:8.5, padding:'3px 9px', borderRadius:99, border:`1px solid ${highRisk?'var(--red)':'var(--pink)'}50`, color:highRisk?'var(--red)':'var(--pink)', background:highRisk?'var(--red-l)':'var(--pink-l)' }}>
                    {CYCLE_PHASES.find(c => c.id === log.cycle_phase)?.label}
                    {highRisk && ' ⚠'}
                  </span>
                )}
              </div>
            </div>

            {/* Practice ring */}
            <div style={{ position:'relative', flexShrink:0 }}>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg)" strokeWidth="5"/>
                <circle cx="36" cy="36" r="30" fill="none"
                  stroke={pct===1?'var(--green)':pct>.6?'var(--indigo)':'var(--amber)'}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C - C*pct}
                  transform="rotate(-90 36 36)"
                  style={{ transition:'stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)' }}
                />
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:17, fontWeight:400, lineHeight:1 }}>{done}</div>
                <div style={{ fontFamily:'var(--mono)', fontSize:7, color:'var(--ink3)' }}>/{total}</div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {highRisk && (
            <div style={{ margin:'0 0 14px', padding:'9px 12px', background:'var(--red-l)', border:'1px solid #FFB3C0', borderRadius:10, fontSize:12.5, color:'#8B0020', fontWeight:500 }}>
              ⚠ High-risk cycle window. Oestrogen dropping. Mast cells destabilised.
            </div>
          )}
        </div>

        {/* ── VITALS STRIP (like Google Health / Samsung) ── */}
        {fitbit && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid var(--bd)' }}>
            {[
              {l:'Steps', v:fitbit.steps?.toLocaleString(), c:'var(--indigo)', sub:`${Math.round(stepPct*100)}%`, metric:'steps'},
              {l:'Sleep', v:fitbit.sleep_hours?`${fitbit.sleep_hours}h`:'--', c:fitbit.sleep_hours<7?'var(--amber)':'var(--purple)', metric:'sleep_hours'},
              {l:'HR rest', v:fitbit.resting_hr, c:'var(--red)', metric:'resting_hr'},
              {l:'HRV', v:fitbit.hrv, c:'var(--purple)', metric:'hrv'},
            ].map((s,i) => (
              <button key={s.l} onClick={() => openDetail('metric', {metric:s.metric, value:s.v})}
                style={{ padding:'10px 0 10px', textAlign:'center', borderRight:i<3?'1px solid var(--bd)':'none', background:'none', border:i<3?`0 0 0 0`:'none', borderRight:i<3?'1px solid var(--bd)':'none', cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:400, color:s.c, lineHeight:1 }}>{s.v??'--'}</div>
                {s.sub && <div style={{ fontFamily:'var(--mono)', fontSize:7.5, color:'var(--ink3)', marginTop:1 }}>{s.sub} of goal</div>}
                <div style={{ fontFamily:'var(--mono)', fontSize:7.5, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.06em', marginTop:2 }}>{s.l}</div>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" strokeWidth="2" style={{ marginTop:3 }}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── READINESS SCORE (like Whoop/Oura) ── */}
      {avg && (
        <div style={{ padding:'14px 16px 0' }}>
          <SH label="Today's readiness" />
          <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, padding:'16px', display:'flex', gap:16, alignItems:'center' }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="34" fill="none"
                  stroke={avg<=2?'var(--green)':avg<=3.5?'var(--amber)':'var(--red)'}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2*Math.PI*34}
                  strokeDashoffset={2*Math.PI*34*(avg/5)}
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:24, fontWeight:300, color:avg<=2?'var(--green)':avg<=3.5?'var(--amber)':'var(--red)', lineHeight:1 }}>{avg.toFixed(1)}</div>
                <div style={{ fontFamily:'var(--mono)', fontSize:7, color:'var(--ink3)' }}>/ 5</div>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--ink)', marginBottom:4 }}>
                {avg <= 2 ? 'Feeling good' : avg <= 3 ? 'Moderate symptoms' : avg <= 4 ? 'Challenging day' : 'High symptom load'}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {SYMPTOMS.filter(s => scores[s.id]).map(sym => (
                  <div key={sym.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:60, fontSize:10, color:'var(--ink3)', fontWeight:500 }}>{sym.label}</div>
                    <div style={{ flex:1, height:4, background:'var(--bg)', borderRadius:99, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(scores[sym.id]/5)*100}%`, background:SYM_COLOR[sym.id], borderRadius:99 }} />
                    </div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:10, color:SYM_COLOR[sym.id], width:12, textAlign:'right' }}>{scores[sym.id]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVITY WIDGETS (swipeable) ── */}
      {fitbit && (
        <div style={{ paddingTop:14 }}>
          <div style={{ padding:'0 16px', marginBottom:8 }}>
            <SH label="Activity" action="See all" onAction={() => openDetail('metric', {metric:'steps', value:fitbit.steps})} />
          </div>
          <Carousel>
            {/* Steps card */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, padding:16, borderTop:'3px solid var(--indigo)', cursor:'pointer' }}
              onClick={() => openDetail('metric', {metric:'steps', value:fitbit.steps, relatedToConditions:'Steps and light activity directly support vestibular rehabilitation and autonomic stability. Your dysautonomia means pacing is critical -- 7,500 steps is your ceiling during Foundation phase, not your floor.'})}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:8.5, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Steps today</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:52, fontWeight:300, color:'var(--indigo)', lineHeight:1, letterSpacing:'-.04em' }}>{fitbit.steps?.toLocaleString()??'--'}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  {fitbit.distance_km && <><div style={{ fontFamily:'var(--mono)', fontSize:22, color:'var(--sky)' }}>{fitbit.distance_km}<span style={{ fontSize:10, color:'var(--ink3)' }}>km</span></div><div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase' }}>distance</div></>}
                  {fitbit.floors && <div style={{ marginTop:8 }}><div style={{ fontFamily:'var(--mono)', fontSize:18, color:'var(--sky)' }}>{fitbit.floors}<span style={{ fontSize:10 }}> fl</span></div><div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase' }}>floors</div></div>}
                </div>
              </div>
              <div style={{ height:6, background:'var(--bg)', borderRadius:99, overflow:'hidden', marginBottom:4 }}>
                <div style={{ height:'100%', width:`${stepPct*100}%`, background:stepPct>=1?'var(--green)':'var(--indigo)', borderRadius:99, transition:'width .6s' }} />
              </div>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)' }}>{Math.round(stepPct*100)}% of 7,500 · tap for history</div>
            </div>

            {/* Cardio Load */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, padding:16, borderTop:'3px solid var(--pink)', cursor:'pointer' }}
              onClick={() => openDetail('metric', {metric:'active_zone_minutes', value:fitbit.active_zone_minutes, relatedToConditions:'Cardio load is the key metric for your exercise progression. During Foundation phase, target 10-20 active zone minutes per day -- enough to build aerobic base without triggering dysautonomia flares.'})}>
              <div style={{ fontFamily:'var(--mono)', fontSize:8.5, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Daily cardio load</div>
              <div style={{ display:'flex', gap:16, alignItems:'flex-end', marginBottom:12 }}>
                <div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:52, fontWeight:300, color:'var(--pink)', lineHeight:1, letterSpacing:'-.04em' }}>{fitbit.active_zone_minutes??'--'}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase' }}>active zone min</div>
                </div>
                {fitbit.active_minutes && <div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:26, color:'var(--amber)', fontWeight:300 }}>{fitbit.active_minutes}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase' }}>active min</div>
                </div>}
              </div>
              {fitbit.hr_zones && (() => {
                const z = fitbit.hr_zones
                const colors = { out_of_range:'#C8CDD8', fat_burn:'#00B4D8', cardio:'#5B5EF4', peak:'#FF3B5C' }
                const total = Object.values(z).reduce((a,b)=>a+b,0)
                if (!total) return null
                return (
                  <div>
                    <div style={{ display:'flex', height:6, borderRadius:99, overflow:'hidden', gap:1, marginBottom:6 }}>
                      {Object.entries(z).map(([k,v]) => v>0 && <div key={k} style={{ flex:v, background:colors[k] }} />)}
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {Object.entries(z).filter(([,v])=>v>0).map(([k,v]) => (
                        <span key={k} style={{ fontFamily:'var(--mono)', fontSize:8.5, color:'var(--ink2)' }}>
                          <span style={{ color:colors[k] }}>●</span> {k.replace('_',' ')} {v}m
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Energy */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, padding:16, borderTop:'3px solid var(--amber)', cursor:'pointer' }}
              onClick={() => openDetail('metric', {metric:'calories_burned', value:fitbit.total_calories_burned})}>
              <div style={{ fontFamily:'var(--mono)', fontSize:8.5, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Energy output</div>
              <div style={{ display:'flex', gap:14, alignItems:'flex-end', marginBottom:12 }}>
                <div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:48, fontWeight:300, color:'var(--amber)', lineHeight:1, letterSpacing:'-.04em' }}>{fitbit.total_calories_burned??'--'}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:8.5, color:'var(--ink3)', textTransform:'uppercase' }}>total burned</div>
                </div>
                {fitbit.active_calories_burned && <div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:24, color:'var(--amber)', fontWeight:300 }}>{fitbit.active_calories_burned}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase' }}>active</div>
                </div>}
              </div>
              {fitbit.vo2_max && <div style={{ background:'var(--bg)', borderRadius:10, padding:'8px 10px', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase' }}>VO2 max</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:15, color:'var(--green)' }}>{fitbit.vo2_max}</span>
              </div>}
            </div>

            {/* Sleep */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, padding:16, borderTop:'3px solid var(--purple)', cursor:'pointer' }}
              onClick={() => openDetail('metric', {metric:'sleep_hours', value:fitbit.sleep_hours, relatedToConditions:'Sleep is the single most impactful variable for your symptom load. Under 7 hours consistently raises MCAS reactivity, vestibular sensitivity, and autonomic instability. The correlation engine shows sleep has one of the highest impacts on your next-day symptoms.'})}>
              <div style={{ fontFamily:'var(--mono)', fontSize:8.5, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Sleep last night</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:52, fontWeight:300, color:fitbit.sleep_hours<7?'var(--amber)':'var(--purple)', lineHeight:1, letterSpacing:'-.04em', marginBottom:8 }}>
                {fitbit.sleep_hours??'--'}<span style={{ fontSize:16, color:'var(--ink3)' }}>h</span>
              </div>
              {fitbit.sleep_stages && (() => {
                const s = fitbit.sleep_stages
                const colors = {deep:'#5B5EF4', rem:'#8B5CF6', light:'#00B4D8', awake:'#C8CDD8'}
                const total = Object.values(s).reduce((a,b)=>a+b,0)
                if (!total) return null
                return (
                  <div>
                    <div style={{ display:'flex', height:8, borderRadius:99, overflow:'hidden', gap:1, marginBottom:6 }}>
                      {['deep','rem','light','awake'].map(k => s[k]>0 && <div key={k} style={{ flex:s[k], background:colors[k] }} />)}
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {['deep','rem','light','awake'].filter(k=>s[k]>0).map(k => (
                        <span key={k} style={{ fontFamily:'var(--mono)', fontSize:8.5, color:'var(--ink2)', textTransform:'capitalize' }}>
                          <span style={{ color:colors[k] }}>●</span> {k} {Math.round(s[k])}m
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Vitals */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, padding:16, borderTop:'3px solid var(--red)' }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:8.5, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Vitals</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  {l:'Resting HR', v:fitbit.resting_hr, u:'bpm', c:'var(--red)', m:'resting_hr'},
                  {l:'HRV', v:fitbit.hrv, u:'ms', c:'var(--purple)', m:'hrv'},
                  {l:'SpO2', v:fitbit.spo2, u:'%', c:'var(--sky)', m:'spo2'},
                  {l:'Resp rate', v:fitbit.respiratory_rate, u:'br/m', c:'var(--sky)', m:'respiratory_rate'},
                ].map(m => (
                  <button key={m.l} onClick={() => openDetail('metric', {metric:m.m, value:m.v})}
                    style={{ background:'var(--bg)', border:'none', borderRadius:10, padding:'10px', textAlign:'left', cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>
                    <div style={{ fontFamily:'var(--mono)', fontSize:22, color:m.c, fontWeight:300, lineHeight:1, marginBottom:3 }}>{m.v??'--'}<span style={{ fontSize:9, color:'var(--ink3)' }}>{m.u}</span></div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.06em' }}>{m.l}</div>
                  </button>
                ))}
              </div>
            </div>
          </Carousel>
        </div>
      )}

      {/* ── SYMPTOM SCORES ── */}
      <div style={{ padding:'14px 16px 0' }}>
        <SH label="Symptom scores" action={showAllSymptoms ? 'Show less' : 'Show all'} onAction={() => setShowAllSymptoms(v => !v)} />
        <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, overflow:'hidden' }}>
          {SYMPTOMS.map((sym, si) => (
            <div key={sym.id} style={{ padding:'12px 14px', borderBottom:si < SYMPTOMS.length-1?'1px solid var(--bd)':'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:SYM_COLOR[sym.id], flexShrink:0 }} />
                <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink)', flex:1 }}>{sym.label}</div>
                {scores[sym.id] && (
                  <button onClick={() => openDetail('metric', {metric:sym.id, value:scores[sym.id]})} style={{ fontFamily:'var(--mono)', fontSize:9.5, color:SYM_COLOR[sym.id], fontWeight:600, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                    {sym.descriptors[scores[sym.id]-1]}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                )}
              </div>
              <div style={{ display:'flex', gap:5 }}>
                {sym.descriptors.map((desc, i) => {
                  const val = i+1; const on = scores[sym.id] === val
                  return (
                    <button key={val} onClick={() => setScore(sym.id, val)}
                      style={{ flex:1, padding:'9px 2px 7px', borderRadius:10, border:`${on?2:1.5}px solid ${on?SYM_COLOR[sym.id]:'var(--bd)'}`, background:on?SYM_COLOR[sym.id]:'var(--bg)', cursor:'pointer', transition:'all .12s', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                      <span style={{ fontFamily:'var(--mono)', fontSize:15, color:on?'white':'var(--ink3)', lineHeight:1 }}>{val}</span>
                      <span style={{ fontSize:5.5, color:on?'rgba(255,255,255,.7)':'var(--ink4)', textAlign:'center', lineHeight:1.2 }}>{desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CYCLE ── */}
      <div style={{ padding:'14px 16px 0' }}>
        <SH label="Cycle" />
        <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, padding:14 }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ flexShrink:0 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5 }}>Day</div>
              <input type="number" style={{ width:70, background:'var(--bg)', border:'1.5px solid var(--bd)', borderRadius:10, padding:'8px', color:'var(--ink)', fontSize:22, fontWeight:700, fontFamily:'var(--mono)', textAlign:'center', outline:'none' }}
                placeholder="14" value={log.cycle_day||''} min="1" max="35"
                onChange={e => { const ph=inferPhase(e.target.value); setLog(l=>({...l,cycle_day:e.target.value,cycle_phase:ph||l.cycle_phase})); upsertDailyLog(TODAY,{cycle_day:e.target.value,cycle_phase:ph}) }}
              />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5 }}>Phase {log.cycle_day?'· auto':'· tap to set'}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {CYCLE_PHASES.map(cp => (
                  <button key={cp.id} onClick={() => { const ph=log.cycle_phase===cp.id?null:cp.id; setLog(l=>({...l,cycle_phase:ph})); upsertDailyLog(TODAY,{cycle_phase:ph}) }}
                    style={{ padding:'5px 11px', borderRadius:99, fontSize:11.5, fontWeight:600, cursor:'pointer', border:`1.5px solid ${log.cycle_phase===cp.id?(cp.risk?'var(--red)':'var(--pink)'):'var(--bd)'}`, background:log.cycle_phase===cp.id?(cp.risk?'var(--red)':'var(--pink)'):'var(--bg)', color:log.cycle_phase===cp.id?'white':'var(--ink2)', transition:'all .1s' }}>
                    {cp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RECENT EPISODES ── */}
      {recentEpisodes.length > 0 && (
        <div style={{ padding:'14px 16px 0' }}>
          <SH label="Recent episodes" action="Log new" onAction={() => {}} />
          <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, overflow:'hidden' }}>
            {recentEpisodes.map((ep, i) => {
              const { EPISODE_TYPES } = require('../lib/constants')
              const t = EPISODE_TYPES.find(x => x.id === ep.episode_type) || {}
              return (
                <button key={ep.id} onClick={() => openDetail('episode', ep)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'none', border:'none', borderBottom:i<recentEpisodes.length-1?'1px solid var(--bd)':'none', cursor:'pointer', textAlign:'left', WebkitTapHighlightColor:'transparent' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:t.color||'var(--ink3)', flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', marginBottom:2 }}>{t.label||ep.episode_type}</div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)' }}>
                      {new Date(ep.started_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
                      {ep.severity && ` · Severity ${ep.severity}`}
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── PRACTICES ── */}
      <div style={{ padding:'14px 16px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <SH label="Daily practices" />
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:12, color:done===total?'var(--green)':'var(--ink3)', fontWeight:600 }}>{done}/{total}</div>
            <div style={{ width:40, height:4, borderRadius:99, background:'var(--bg)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct*100}%`, background:done===total?'var(--green)':pct>.6?'var(--indigo)':'var(--amber)', borderRadius:99 }} />
            </div>
          </div>
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, overflow:'hidden' }}>
          {TASK_GROUPS.map((group, gi) => {
            const gdone = group.tasks.filter(t => practices[t.id]).length
            const isOpen = openGroup === group.id
            return (
              <div key={group.id} style={{ borderBottom:gi<TASK_GROUPS.length-1?'1px solid var(--bd)':'none' }}>
                <button onClick={() => setOpenGroup(isOpen?null:group.id)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'none', border:'none', cursor:'pointer' }}>
                  <div style={{ width:4, height:20, borderRadius:99, background:gdone===group.tasks.length?'var(--green)':gdone>0?'var(--amber)':'var(--bd)', flexShrink:0, transition:'background .2s' }} />
                  <span style={{ fontSize:13.5, fontWeight:700, color:'var(--ink)', flex:1, textAlign:'left' }}>{group.label}</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:10.5, color:gdone===group.tasks.length?'var(--green)':'var(--ink3)' }}>{gdone}/{group.tasks.length}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2" style={{ transform:isOpen?'rotate(180deg)':'none', transition:'transform .2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {isOpen && group.tasks.map((task, ti) => (
                  <button key={task.id} onClick={() => tick(task.id, !practices[task.id])}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:11, padding:'10px 14px 10px 28px', background:practices[task.id]?'var(--surface)':'var(--surface)', border:'none', borderTop:'1px solid var(--bd)', cursor:'pointer', WebkitTapHighlightColor:'transparent', opacity:practices[task.id]?.5:1 }}>
                    <div style={{ width:20, height:20, borderRadius:6, border:`1.5px solid ${practices[task.id]?'var(--green)':'var(--bd)'}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:practices[task.id]?'var(--green)':'var(--surface)', transition:'all .12s' }}>
                      {practices[task.id] && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ fontSize:13.5, fontWeight:500, color:practices[task.id]?'var(--ink3)':'var(--ink)', textDecoration:practices[task.id]?'line-through':'none', textAlign:'left', flex:1 }}>{task.text}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
