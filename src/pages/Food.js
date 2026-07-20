import { useState, useEffect, useRef } from 'react'
import { getFoodEntries, createFoodEntry, deleteFoodEntry, getTriggerFoods, addTriggerFood } from '../lib/db'
import { DEFAULT_TRIGGERS } from '../lib/constants'
import { searchFood } from '../lib/google-health'

const MEAL_TYPES = ['Breakfast','Morning snack','Lunch','Afternoon snack','Dinner','Evening snack','Drink']
const MIN=1500, GOAL=1800
const TODAY = new Date().toISOString().split('T')[0]
const TRIGGER_CATS = [
  {id:'histamine',label:'Histamine',color:'#FF3B5C'},
  {id:'mast_cell',label:'Mast cell',color:'#F0468A'},
  {id:'oas',label:'OAS cluster',color:'#FF9500'},
  {id:'intolerance',label:'Intolerance',color:'#5B5EF4'},
  {id:'lpr',label:'LPR',color:'#00B4D8'},
  {id:'other',label:'Other',color:'#A0A6B8'},
]

export default function Food({ showToast }) {
  const [entries, setEntries] = useState([])
  const [triggers, setTriggers] = useState([])
  const [sheet, setSheet] = useState(null) // 'log' | 'trigger' | null
  const [tab, setTab] = useState('diary')
  const [form, setForm] = useState({meal_type:'',description:'',calories:'',protein_grams:'',dao_taken:false,oxbile_taken:false})
  const [tform, setTform] = useState({food:'',trigger_category:'',severity:'',notes:''})
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef(null)

  useEffect(()=>{ loadEntries(); loadTriggers() },[])

  async function loadEntries() { setEntries(await getFoodEntries(TODAY)) }
  async function loadTriggers() { const d=await getTriggerFoods(); setTriggers(d.length>0?d:DEFAULT_TRIGGERS) }

  function handleQuery(v) {
    setQuery(v); setForm(f=>({...f,description:v,calories:'',protein_grams:''}))
    clearTimeout(searchRef.current)
    if (v.length<3){setResults([]);return}
    searchRef.current=setTimeout(async()=>{
      setSearching(true); const r=await searchFood(v); setResults(r); setSearching(false)
    },600)
  }

  function pick(r) {
    setForm(f=>({...f,description:r.name,calories:r.calories||'',protein_grams:r.protein||''}))
    setQuery(r.name); setResults([])
  }

  function flagged(desc) {
    return triggers.filter(t=>desc?.toLowerCase().includes((t.food||t.name||'').toLowerCase())).map(t=>t.food||t.name)
  }

  async function submit() {
    if (!form.description||!form.meal_type){showToast('Choose type and food','var(--amber)');return}
    const fl=flagged(form.description)
    await createFoodEntry({date:TODAY,meal_type:form.meal_type,description:form.description,calories:form.calories?parseInt(form.calories):null,protein_grams:form.protein_grams?parseFloat(form.protein_grams):null,dao_taken:form.dao_taken,oxbile_taken:form.oxbile_taken,flagged_triggers:fl,time:new Date().toTimeString().slice(0,5)})
    if (fl.length) showToast(`⚠ ${fl[0]} on no-go list`,'var(--amber)'); else showToast('Logged')
    setSheet(null); setForm({meal_type:'',description:'',calories:'',protein_grams:'',dao_taken:false,oxbile_taken:false}); setQuery(''); setResults([])
    loadEntries()
  }

  async function submitTrigger() {
    if (!tform.food||!tform.trigger_category) return
    await addTriggerFood({...tform,date_identified:TODAY})
    showToast('Added to no-go list'); setSheet(null); setTform({food:'',trigger_category:'',severity:'',notes:''})
    loadTriggers()
  }

  const total = entries.reduce((s,e)=>s+(e.calories||0),0)
  const protein = entries.reduce((s,e)=>s+(e.protein_grams||0),0)
  const pct = Math.min(total/GOAL,1)
  const calColor = total>=GOAL?'var(--green)':total>=MIN?'var(--amber)':'var(--red)'
  const nudge = new Date().getHours()>=14 && total<600

  return (
    <div className="screen">
      {/* HEADER */}
      <div style={{background:'var(--surface)',paddingTop:56}}>
        <div style={{padding:'0 16px 0'}}>
          <div className="page-eyebrow">Nutrition</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',paddingBottom:16}}>
            <div>
              <div style={{fontSize:30,fontWeight:800,letterSpacing:'-.5px',color:'var(--ink)'}}>Food diary</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:'var(--mono)',fontSize:40,fontWeight:300,color:calColor,lineHeight:1,letterSpacing:'-.04em'}}>{total}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'.08em'}}>cal today</div>
            </div>
          </div>
        </div>

        {/* CALORIE STRIP */}
        <div style={{padding:'0 16px 16px'}}>
          <div className="cal-bar-wrap">
            <div className="cal-bar-fill" style={{width:`${pct*100}%`,background:calColor}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--mono)',fontSize:9,color:'var(--ink3)'}}>
            <span>0</span>
            <span style={{color:'var(--amber)'}}>{MIN} min</span>
            <span style={{color:'var(--green)'}}>{GOAL} goal</span>
          </div>
          {protein>0 && <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--ink3)',marginTop:5}}>{protein.toFixed(0)}g protein today</div>}
        </div>

        {/* TABS */}
        <div style={{display:'flex',borderTop:'1px solid var(--bd)'}}>
          {['diary','nogo'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'12px',border:'none',background:'none',fontWeight:700,fontSize:13,color:tab===t?'var(--indigo)':'var(--ink3)',borderBottom:tab===t?'2px solid var(--indigo)':'2px solid transparent',cursor:'pointer'}}>
              {t==='diary'?'Diary':'No-go list'}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        {nudge && <div className="banner banner-amber" style={{marginBottom:10}}>After 2pm and under 600 cal. Your body needs fuel.</div>}

        {tab==='diary' && (
          <>
            <button className="btn btn-black btn-full" style={{marginBottom:14}} onClick={()=>setSheet('log')}>+ Log meal or drink</button>
            {entries.length===0
              ? <div style={{textAlign:'center',padding:'40px 0',color:'var(--ink3)',fontFamily:'var(--mono)',fontSize:12}}>Nothing logged yet today</div>
              : MEAL_TYPES.map(mt=>{
                  const me=entries.filter(e=>e.meal_type===mt); if(!me.length) return null
                  return (
                    <div key={mt} style={{marginBottom:14}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
                        <div className="section-label" style={{margin:0}}>{mt}</div>
                        <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--amber)',fontWeight:500}}>{me.reduce((s,e)=>s+(e.calories||0),0)} cal</div>
                      </div>
                      <div className="card">
                        {me.map((e,i)=>(
                          <div key={e.id} style={{padding:'11px 14px',borderBottom:i<me.length-1?'1px solid var(--bd2)':'none',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13.5,fontWeight:600,color:'var(--ink)',marginBottom:4,lineHeight:1.3}}>{e.description}</div>
                              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                                {e.calories&&<span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--amber)',fontWeight:500}}>{e.calories} cal</span>}
                                {e.protein_grams&&<span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--sky)'}}>{e.protein_grams}g protein</span>}
                                {e.dao_taken&&<span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--green)'}}>DAO ✓</span>}
                                {e.oxbile_taken&&<span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--green)'}}>OxBile ✓</span>}
                                {e.flagged_triggers?.length>0&&<span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--amber)',background:'var(--amber-l)',padding:'2px 7px',borderRadius:99}}>⚠ {e.flagged_triggers[0]}</span>}
                              </div>
                            </div>
                            <button onClick={async()=>{await deleteFoodEntry(e.id);loadEntries()}} style={{background:'none',border:'none',color:'var(--ink3)',fontSize:18,cursor:'pointer',paddingLeft:10,flexShrink:0}}>×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
            }
          </>
        )}

        {tab==='nogo' && (
          <>
            <button className="btn btn-black btn-full" style={{marginBottom:14}} onClick={()=>setSheet('trigger')}>+ Add to no-go list</button>
            {TRIGGER_CATS.map(cat=>{
              const items=triggers.filter(t=>t.trigger_category===cat.id)
              if(!items.length) return null
              return (
                <div key={cat.id} style={{marginBottom:14}}>
                  <div className="section-label" style={{marginBottom:7,color:cat.color}}>{cat.label}</div>
                  <div className="card">
                    {items.map((t,i)=>(
                      <div key={i} style={{padding:'11px 14px',borderBottom:i<items.length-1?'1px solid var(--bd2)':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:13.5,fontWeight:600}}>{t.food||t.name}</span>
                        <span style={{fontFamily:'var(--mono)',fontSize:9,color:t.severity==='severe'?'var(--red)':t.severity==='moderate'?'var(--amber)':'var(--ink3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.06em'}}>{t.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* LOG SHEET */}
      {sheet==='log' && (
        <div className="sheet-overlay" onClick={e=>e.target===e.currentTarget&&setSheet(null)}>
          <div className="sheet">
            <div className="sheet-handle"/>
            <div className="sheet-title">Log meal</div>
            <div className="form-group">
              <label className="form-label">Meal type</label>
              <div className="chip-wrap">
                {MEAL_TYPES.map(m=><button key={m} className={`chip${form.meal_type===m?' on':''}`} onClick={()=>setForm(f=>({...f,meal_type:m}))}>{m}</button>)}
              </div>
            </div>
            <div className="form-group" style={{position:'relative'}}>
              <label className="form-label">Search or type food</label>
              <input type="text" className="input" placeholder="e.g. Simple Mills crackers" value={query} onChange={e=>handleQuery(e.target.value)} autoComplete="off"/>
              {searching && <div style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--ink3)',marginTop:5}}>Searching...</div>}
              {results.length>0 && (
                <div className="card" style={{marginTop:6,position:'absolute',left:0,right:0,zIndex:10,boxShadow:'0 8px 32px rgba(0,0,0,.12)'}}>
                  {results.slice(0,5).map((r,i)=>(
                    <div key={i} onClick={()=>pick(r)} style={{padding:'10px 14px',borderBottom:i<Math.min(results.length,5)-1?'1px solid var(--bd2)':'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{flex:1,fontSize:13,fontWeight:500,lineHeight:1.3}}>{r.name}</div>
                      <div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--amber)',fontWeight:500,flexShrink:0,marginLeft:8}}>{r.calories} cal</div>
                    </div>
                  ))}
                </div>
              )}
              {flagged(form.description).length>0 && (
                <div className="banner banner-amber" style={{marginTop:6}}>⚠ {flagged(form.description).join(', ')} on your no-go list</div>
              )}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}} className="form-group">
              <div><label className="form-label">Calories</label><input type="number" className="input" placeholder="auto" value={form.calories} onChange={e=>setForm(f=>({...f,calories:e.target.value}))}/></div>
              <div><label className="form-label">Protein (g)</label><input type="number" className="input" placeholder="auto" value={form.protein_grams} onChange={e=>setForm(f=>({...f,protein_grams:e.target.value}))}/></div>
            </div>
            <div style={{display:'flex',gap:16,marginBottom:20}}>
              {['dao_taken','oxbile_taken'].map(f=>(
                <label key={f} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13.5,fontWeight:500}}>
                  <input type="checkbox" checked={form[f]} onChange={e=>setForm(ff=>({...ff,[f]:e.target.checked}))} style={{width:18,height:18,accentColor:'var(--green)'}}/>
                  {f==='dao_taken'?'DAO enzyme':'Ox bile'}
                </label>
              ))}
            </div>
            <button className="btn btn-black btn-full" onClick={submit}>Save</button>
          </div>
        </div>
      )}

      {/* TRIGGER SHEET */}
      {sheet==='trigger' && (
        <div className="sheet-overlay" onClick={e=>e.target===e.currentTarget&&setSheet(null)}>
          <div className="sheet">
            <div className="sheet-handle"/>
            <div className="sheet-title">Add to no-go list</div>
            <div className="form-group"><label className="form-label">Food</label><input type="text" className="input" placeholder="e.g. Avocado" value={tform.food} onChange={e=>setTform(f=>({...f,food:e.target.value}))}/></div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <div className="chip-wrap">{TRIGGER_CATS.map(c=><button key={c.id} className={`chip${tform.trigger_category===c.id?' on':''}`} style={tform.trigger_category===c.id?{background:c.color,borderColor:c.color}:{}} onClick={()=>setTform(f=>({...f,trigger_category:c.id}))}>{c.label}</button>)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Severity</label>
              <div style={{display:'flex',gap:8}}>
                {['mild','moderate','severe'].map(s=><button key={s} className={`chip${tform.severity===s?' on':''}`} style={{flex:1,tform_severity:tform.severity===s}} onClick={()=>setTform(f=>({...f,severity:s}))}>{s}</button>)}
              </div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><input type="text" className="input" placeholder="e.g. causes OAS symptoms" value={tform.notes} onChange={e=>setTform(f=>({...f,notes:e.target.value}))}/></div>
            <button className="btn btn-black btn-full" onClick={submitTrigger}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}
