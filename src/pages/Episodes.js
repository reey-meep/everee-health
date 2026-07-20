import { useState, useEffect } from 'react'
import { getEpisodes, createEpisode, getDailyLog } from '../lib/db'
import { avgHRInWindow } from '../lib/google-health'
import { EPISODE_TYPES } from '../lib/constants'

const TRIGGERS=['Gluten','Citric acid','Chocolate','Banana','High fat meal','Late propranolol','Emotional stress','Exercise','Sudden waking','Standing too fast','Gas pressure','Period','Luteal phase','Poor sleep','Unknown']
const HELPED=['Famotidine','Propranolol','Valsalva','Cold face','Ginger','Havening','Breathing','Rylie','Rest horizontal','Heat pad','DAO enzyme','Time']
const SX=['Flushing','Heart racing','Nausea','Dizziness','Visual disturbance','Exhaustion wave','Presyncope','Panic','Gut cramping','Throat clearing','Chest flutter','Headache','Facial pain','Sweating','Chills','Brain fog']

export default function Episodes({ showToast }) {
  const [episodes, setEpisodes] = useState([])
  const [sheet, setSheet] = useState(false)
  const [form, setForm] = useState({episode_type:'',severity:null,started_at:new Date().toISOString().slice(0,16),duration_minutes:'',triggers:[],symptoms_present:[],what_helped:[],recovery_minutes:''})

  useEffect(()=>{load()},[])
  async function load() { setEpisodes(await getEpisodes(30)) }

  function tog(f,v){setForm(x=>({...x,[f]:x[f].includes(v)?x[f].filter(a=>a!==v):[...x[f],v]}))}

  async function submit() {
    if (!form.episode_type||!form.severity){showToast('Select type and severity','var(--amber)');return}
    const tl=await getDailyLog(new Date().toISOString().split('T')[0])
    const startMs=new Date(form.started_at).getTime()
    const hr=await avgHRInWindow(startMs,startMs+30*60000).catch(()=>null)
    await createEpisode({...form,started_at:new Date(form.started_at).toISOString(),duration_minutes:form.duration_minutes?parseInt(form.duration_minutes):null,recovery_minutes:form.recovery_minutes?parseInt(form.recovery_minutes):null,cycle_phase_at_episode:tl?.cycle_phase||null,weather_pressure_at_episode:tl?.weather_pressure||null,heart_rate_during:hr})
    showToast('Episode logged'); setSheet(false)
    setForm({episode_type:'',severity:null,started_at:new Date().toISOString().slice(0,16),duration_minutes:'',triggers:[],symptoms_present:[],what_helped:[],recovery_minutes:''})
    load()
  }

  function fmt(ts){return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
  function ti(id){return EPISODE_TYPES.find(t=>t.id===id)||{}}

  return (
    <div className="screen">
      <div style={{background:'var(--surface)',paddingTop:56,paddingBottom:20,paddingLeft:16,paddingRight:16}}>
        <div className="page-eyebrow" style={{marginBottom:4}}>Episode log</div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
          <div style={{fontSize:30,fontWeight:800,letterSpacing:'-.5px'}}>Events</div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:36,fontWeight:300,color:'var(--red)',lineHeight:1}}>{episodes.length}</div>
            <div style={{fontFamily:'var(--mono)',fontSize:8,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'.08em'}}>last 30 days</div>
          </div>
        </div>
      </div>

      <div className="section">
        <button className="btn btn-black btn-full" style={{marginBottom:14}} onClick={()=>setSheet(true)}>+ Log episode</button>

        {/* PRE-BM CARD */}
        <div className="section-label">Pre-BM presyncope — protocol</div>
        <div className="card" style={{marginBottom:14,borderLeft:'3px solid var(--amber)'}}>
          {['Sit immediately at exhaustion wave','Feet hard into floor, tense legs, hand on belly','Slow nasal breathing — inhale 4, exhale 6-8','Walk only when wave eases','After: stay 2 min, then havening + ginger'].map((s,i)=>(
            <div key={i} style={{display:'flex',gap:12,padding:'9px 14px',borderBottom:i<4?'1px solid var(--bd2)':'none',alignItems:'flex-start'}}>
              <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--amber)',flexShrink:0,paddingTop:2,fontWeight:500}}>0{i+1}</span>
              <span style={{fontSize:13,color:'var(--ink2)',lineHeight:1.4,fontWeight:400}}>{s}</span>
            </div>
          ))}
        </div>

        {/* EPISODE LIST */}
        <div className="section-label">History</div>
        {episodes.length===0
          ? <div style={{textAlign:'center',padding:'32px 0',color:'var(--ink3)',fontFamily:'var(--mono)',fontSize:11}}>No episodes logged</div>
          : episodes.map(ep=>{
              const t=ti(ep.episode_type)
              return (
                <div key={ep.id} className="card" style={{borderLeft:`3px solid ${t.color||'var(--bd)'}`,marginBottom:8}}>
                  <div style={{padding:'12px 14px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:5}}>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <span className="pill" style={{color:t.color,borderColor:t.color+'40',background:t.color+'12'}}>{t.label||ep.episode_type}</span>
                        {ep.severity&&<span className="pill" style={{color:ep.severity>=4?'var(--red)':ep.severity>=3?'var(--amber)':'var(--green)',borderColor:'var(--bd)'}}>{ep.severity}/5</span>}
                      </div>
                      <span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--ink3)'}}>{fmt(ep.started_at)}</span>
                    </div>
                    <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--ink3)',marginBottom:ep.triggers?.length?4:0}}>
                      {[ep.duration_minutes&&`${ep.duration_minutes}m`,ep.recovery_minutes&&`${ep.recovery_minutes}m recovery`,ep.heart_rate_during&&`HR ${ep.heart_rate_during}bpm`].filter(Boolean).join(' · ')}
                    </div>
                    {ep.triggers?.length>0&&<div style={{fontSize:12,color:'var(--ink2)',fontWeight:500}}>Triggers: {ep.triggers.join(', ')}</div>}
                  </div>
                </div>
              )
            })
        }
      </div>

      {sheet && (
        <div className="sheet-overlay" onClick={e=>e.target===e.currentTarget&&setSheet(false)}>
          <div className="sheet">
            <div className="sheet-handle"/>
            <div className="sheet-title">Log episode</div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <div className="chip-wrap">{EPISODE_TYPES.map(t=><button key={t.id} className={`chip${form.episode_type===t.id?' on':''}`} style={form.episode_type===t.id?{background:t.color,borderColor:t.color}:{}} onClick={()=>setForm(f=>({...f,episode_type:f.episode_type===t.id?'':t.id}))}>{t.label}</button>)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Severity</label>
              <div style={{display:'flex',gap:6}}>
                {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setForm(f=>({...f,severity:f.severity===n?null:n}))} style={{flex:1,padding:'12px 4px',borderRadius:10,border:`1.5px solid ${form.severity===n?'var(--ink)':'var(--bd)'}`,background:form.severity===n?'var(--ink)':'var(--bg)',color:form.severity===n?'white':'var(--ink)',fontFamily:'var(--mono)',fontSize:18,cursor:'pointer'}}>{n}</button>)}
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}} className="form-group">
              <div><label className="form-label">Started</label><input type="datetime-local" className="input" value={form.started_at} onChange={e=>setForm(f=>({...f,started_at:e.target.value}))}/></div>
              <div><label className="form-label">Duration (min)</label><input type="number" className="input" placeholder="25" value={form.duration_minutes} onChange={e=>setForm(f=>({...f,duration_minutes:e.target.value}))}/></div>
            </div>
            <div className="form-group"><label className="form-label">Triggers</label><div className="chip-wrap">{TRIGGERS.map(t=><button key={t} className={`chip${form.triggers.includes(t)?' on':''}`} style={form.triggers.includes(t)?{background:'var(--amber)',borderColor:'var(--amber)'}:{}} onClick={()=>tog('triggers',t)}>{t}</button>)}</div></div>
            <div className="form-group"><label className="form-label">Symptoms</label><div className="chip-wrap">{SX.map(s=><button key={s} className={`chip${form.symptoms_present.includes(s)?' on':''}`} style={form.symptoms_present.includes(s)?{background:'var(--pink)',borderColor:'var(--pink)'}:{}} onClick={()=>tog('symptoms_present',s)}>{s}</button>)}</div></div>
            <div className="form-group"><label className="form-label">What helped</label><div className="chip-wrap">{HELPED.map(w=><button key={w} className={`chip${form.what_helped.includes(w)?' on':''}`} style={form.what_helped.includes(w)?{background:'var(--green)',borderColor:'var(--green)'}:{}} onClick={()=>tog('what_helped',w)}>{w}</button>)}</div></div>
            <div className="form-group"><label className="form-label">Recovery (min)</label><input type="number" className="input" placeholder="15" value={form.recovery_minutes} onChange={e=>setForm(f=>({...f,recovery_minutes:e.target.value}))}/></div>
            <button className="btn btn-black btn-full" onClick={submit}>Save episode</button>
          </div>
        </div>
      )}
    </div>
  )
}
