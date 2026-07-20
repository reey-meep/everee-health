import { useState, useEffect } from 'react'
import { getEpisodes, getPracticeLogs } from '../lib/db'
import { EPISODE_TYPES, TASK_GROUPS } from '../lib/constants'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { runAllAnalytics } from '../lib/analytics'

const TODAY = new Date().toISOString().split('T')[0]

export default function Fitness({ showToast, openDetail }) {
  const [episodes, setEpisodes] = useState([])
  const [sheet, setSheet] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [practices, setPractices] = useState({})
  const [form, setForm] = useState({episode_type:'',severity:null,started_at:new Date().toISOString().slice(0,16),duration_minutes:'',triggers:[],symptoms_present:[],what_helped:[],recovery_minutes:''})
  const { getDailyLog, createEpisode, avgHRInWindow } = require('../lib/db'), ghHR = require('../lib/google-health')

  const TRIGGERS=['Gluten','Citric acid','Chocolate','Banana','High fat meal','Late propranolol','Emotional stress','Exercise','Sudden waking','Standing too fast','Gas pressure','Period','Luteal phase','Poor sleep','Unknown']
  const HELPED=['Famotidine','Propranolol','Valsalva','Cold face','Ginger','Havening','Breathing','Rylie','Rest horizontal','DAO enzyme','Time']
  const SX=['Flushing','Heart racing','Nausea','Dizziness','Visual disturbance','Exhaustion wave','Presyncope','Panic','Gut cramping','Throat clearing','Chest flutter','Headache','Facial pain']

  useEffect(() => { load() }, [])

  async function load() {
    const [eps, p] = await Promise.all([getEpisodes(30), getPracticeLogs(TODAY)])
    setEpisodes(eps)
    const m = {}; p.forEach(x => { m[x.practice_id] = x.completed }); setPractices(m)
    const a = await runAllAnalytics().catch(() => null)
    if (a) setAnalytics(a)
  }

  function tog(f,v) { setForm(x => ({...x,[f]:x[f].includes(v)?x[f].filter(a=>a!==v):[...x[f],v]})) }

  async function submit() {
    if (!form.episode_type||!form.severity){showToast('Select type and severity','var(--amber)');return}
    const tl = await getDailyLog(TODAY).catch(()=>null)
    const startMs = new Date(form.started_at).getTime()
    const hr = await ghHR.avgHRInWindow(startMs, startMs+30*60000).catch(()=>null)
    await createEpisode({...form, started_at:new Date(form.started_at).toISOString(), duration_minutes:form.duration_minutes?parseInt(form.duration_minutes):null, recovery_minutes:form.recovery_minutes?parseInt(form.recovery_minutes):null, cycle_phase_at_episode:tl?.cycle_phase||null, weather_pressure_at_episode:tl?.weather_pressure||null, heart_rate_during:hr})
    showToast('Episode logged'); setSheet(false)
    setForm({episode_type:'',severity:null,started_at:new Date().toISOString().slice(0,16),duration_minutes:'',triggers:[],symptoms_present:[],what_helped:[],recovery_minutes:''})
    load()
  }

  // Episode frequency by type for chart
  const typeCounts = EPISODE_TYPES.map(t => ({
    name: t.label.split(' ')[0],
    count: episodes.filter(e => e.episode_type === t.id).length,
    color: t.color,
  })).filter(t => t.count > 0)

  // Vestibular streak
  const vestSessions = [practices.vest1,practices.vest2,practices.vest3,practices.vest4,practices.vest5].filter(Boolean).length

  return (
    <div style={{ paddingBottom:90 }}>
      <div style={{ background:'var(--surface)', paddingTop:56, paddingBottom:20, paddingLeft:16, paddingRight:16, borderBottom:'1px solid var(--bd)' }}>
        <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Fitness</div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div style={{ fontSize:28, fontWeight:800, letterSpacing:'-.5px' }}>Episodes & practices</div>
          <button onClick={() => setSheet(true)} style={{ background:'var(--ink)', color:'white', border:'none', borderRadius:10, padding:'9px 14px', fontFamily:'var(--sans)', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Log</button>
        </div>
      </div>

      <div style={{ padding:'14px 16px 0', display:'flex', flexDirection:'column', gap:10 }}>
        {/* Episode count hero */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, padding:16 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Last 30 days</div>
          <div style={{ display:'flex', gap:14, marginBottom:14 }}>
            <div>
              <div style={{ fontFamily:'var(--mono)', fontSize:44, fontWeight:300, color:'var(--red)', lineHeight:1, letterSpacing:'-.04em' }}>{episodes.length}</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase' }}>total episodes</div>
            </div>
            {episodes.length > 0 && (
              <div style={{ borderLeft:'1px solid var(--bd)', paddingLeft:14 }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:22, fontWeight:300, color:'var(--amber)' }}>
                  {Math.round(episodes.filter(e=>e.severity).reduce((s,e)=>s+e.severity,0)/episodes.filter(e=>e.severity).length*10)/10||'--'}
                </div>
                <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase' }}>avg severity</div>
              </div>
            )}
          </div>
          {typeCounts.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {typeCounts.map(t => (
                <div key={t.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:t.color, flexShrink:0 }} />
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--ink)', width:80 }}>{t.name}</div>
                  <div style={{ flex:1, height:4, background:'var(--bg)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(t.count/episodes.length)*100}%`, background:t.color, borderRadius:99 }} />
                  </div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--ink3)', width:14, textAlign:'right' }}>{t.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vestibular sessions today */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, padding:16, borderTop:'3px solid var(--sky)' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Vestibular sessions today</div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            {[1,2,3,4,5].map(n => {
              const done = n <= vestSessions
              return (
                <div key={n} style={{ flex:1, height:36, borderRadius:8, border:`2px solid ${done?'var(--sky)':'var(--bd)'}`, background:done?'var(--sky)':'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }}>
                  <span style={{ fontFamily:'var(--mono)', fontSize:13, color:done?'white':'var(--ink4)' }}>{n}</span>
                </div>
              )
            })}
          </div>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--ink3)' }}>
            {vestSessions === 0 ? 'No sessions done yet today' : vestSessions === 5 ? '✓ All 5 sessions complete' : `${vestSessions}/5 complete · ${5-vestSessions} remaining`}
          </div>
        </div>

        {/* Pre-BM protocol */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:18, overflow:'hidden' }}>
          <div style={{ padding:'12px 14px 0', borderBottom:'1px solid var(--bd)' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Pre-BM presyncope — protocol</div>
          </div>
          {['Sit immediately at exhaustion wave','Feet hard into floor · tense legs · hand on belly','Slow nasal breathing — inhale 4, exhale 6-8','Walk only when wave eases · breathe through urgency','After BM: sit 2 min · havening · ginger chew'].map((s,i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'10px 14px', borderBottom:i<4?'1px solid var(--bd)':'none', alignItems:'flex-start' }}>
              <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--amber)', flexShrink:0, paddingTop:2, fontWeight:700 }}>0{i+1}</span>
              <span style={{ fontSize:13, color:'var(--ink2)', lineHeight:1.45, fontWeight:400 }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Episode list */}
        <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginTop:4 }}>History</div>
        {episodes.length === 0
          ? <div style={{ textAlign:'center', padding:'32px', color:'var(--ink3)', fontFamily:'var(--mono)', fontSize:11 }}>No episodes logged</div>
          : episodes.map((ep, i) => {
            const t = EPISODE_TYPES.find(x => x.id === ep.episode_type) || {}
            return (
              <button key={ep.id} onClick={() => openDetail('episode', ep)}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--surface)', border:'1px solid var(--bd)', borderRadius:14, cursor:'pointer', textAlign:'left', marginBottom:6, WebkitTapHighlightColor:'transparent' }}>
                <div style={{ width:4, height:40, borderRadius:99, background:t.color||'var(--bd)', flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)', marginBottom:3 }}>{t.label||ep.episode_type}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)' }}>
                    {new Date(ep.started_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
                    {ep.severity&&` · ${ep.severity}/5`}
                    {ep.duration_minutes&&` · ${ep.duration_minutes}m`}
                    {ep.heart_rate_during&&` · HR ${ep.heart_rate_during}bpm`}
                  </div>
                  {ep.triggers?.length>0&&<div style={{ fontSize:11, color:'var(--ink3)', marginTop:3 }}>{ep.triggers.slice(0,2).join(', ')}{ep.triggers.length>2?` +${ep.triggers.length-2}`:''}</div>}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )
          })
        }
      </div>

      {/* LOG SHEET */}
      {sheet && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(8px)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={e => e.target===e.currentTarget&&setSheet(false)}>
          <div style={{ background:'var(--surface)', borderRadius:'24px 24px 0 0', padding:'6px 16px 40px', width:'100%', maxWidth:430, maxHeight:'90svh', overflowY:'auto' }}>
            <div style={{ width:36, height:4, borderRadius:99, background:'var(--bd)', margin:'10px auto 18px' }} />
            <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Log episode</div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:7 }}>Type</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {EPISODE_TYPES.map(t => <button key={t.id} onClick={() => setForm(f=>({...f,episode_type:f.episode_type===t.id?'':t.id}))} style={{ padding:'6px 12px', borderRadius:99, border:`1.5px solid ${form.episode_type===t.id?t.color:'var(--bd)'}`, background:form.episode_type===t.id?t.color:'var(--bg)', color:form.episode_type===t.id?'white':'var(--ink2)', fontSize:12, fontWeight:600, cursor:'pointer' }}>{t.label}</button>)}
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:7 }}>Severity</div>
              <div style={{ display:'flex', gap:6 }}>
                {[1,2,3,4,5].map(n => <button key={n} onClick={() => setForm(f=>({...f,severity:f.severity===n?null:n}))} style={{ flex:1, padding:'12px', borderRadius:10, border:`1.5px solid ${form.severity===n?'var(--ink)':'var(--bd)'}`, background:form.severity===n?'var(--ink)':'var(--bg)', color:form.severity===n?'white':'var(--ink)', fontFamily:'var(--mono)', fontSize:18, cursor:'pointer' }}>{n}</button>)}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              <div><div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>Started</div><input type="datetime-local" value={form.started_at} onChange={e=>setForm(f=>({...f,started_at:e.target.value}))} style={{ width:'100%', background:'var(--bg)', border:'1.5px solid var(--bd)', borderRadius:8, padding:'10px', color:'var(--ink)', fontSize:12, outline:'none' }}/></div>
              <div><div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>Duration (min)</div><input type="number" placeholder="25" value={form.duration_minutes} onChange={e=>setForm(f=>({...f,duration_minutes:e.target.value}))} style={{ width:'100%', background:'var(--bg)', border:'1.5px solid var(--bd)', borderRadius:8, padding:'10px', color:'var(--ink)', fontSize:14, fontFamily:'var(--mono)', fontWeight:500, outline:'none' }}/></div>
            </div>
            {[{f:'triggers',label:'Triggers',opts:TRIGGERS,color:'var(--amber)'},{f:'symptoms_present',label:'Symptoms',opts:SX,color:'var(--pink)'},{f:'what_helped',label:'What helped',opts:HELPED,color:'var(--green)'}].map(row=>(
              <div key={row.f} style={{ marginBottom:14 }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:7 }}>{row.label}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{row.opts.map(o=><button key={o} onClick={()=>tog(row.f,o)} style={{ padding:'5px 11px', borderRadius:99, border:`1.5px solid ${form[row.f].includes(o)?row.color:'var(--bd)'}`, background:form[row.f].includes(o)?row.color:'var(--bg)', color:form[row.f].includes(o)?'white':'var(--ink2)', fontSize:11.5, fontWeight:600, cursor:'pointer' }}>{o}</button>)}</div>
              </div>
            ))}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>Recovery (min)</div>
              <input type="number" placeholder="15" value={form.recovery_minutes} onChange={e=>setForm(f=>({...f,recovery_minutes:e.target.value}))} style={{ width:'100%', background:'var(--bg)', border:'1.5px solid var(--bd)', borderRadius:8, padding:'11px', color:'var(--ink)', fontSize:14, fontFamily:'var(--mono)', fontWeight:500, outline:'none' }}/>
            </div>
            <button onClick={submit} style={{ width:'100%', padding:'14px', background:'var(--ink)', color:'white', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer' }}>Save episode</button>
          </div>
        </div>
      )}
    </div>
  )
}
