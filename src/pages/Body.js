import { useState, useEffect } from 'react'
import { getFoodEntries, createFoodEntry, deleteFoodEntry, getTriggerFoods, addTriggerFood } from '../lib/db'
import { DEFAULT_TRIGGERS } from '../lib/constants'
import { searchFood } from '../lib/google-health'
import { useRef } from 'react'

const TODAY = new Date().toISOString().split('T')[0]
const MIN=1500, GOAL=1800
const MEAL_TYPES=['Breakfast','Morning snack','Lunch','Afternoon snack','Dinner','Evening snack','Drink']
const TRIGGER_CATS=[{id:'histamine',label:'Histamine',color:'#FF3B5C'},{id:'mast_cell',label:'Mast cell',color:'#F0468A'},{id:'oas',label:'OAS cluster',color:'#FF9500'},{id:'intolerance',label:'Intolerance',color:'#5B5EF4'},{id:'lpr',label:'LPR',color:'#00B4D8'},{id:'other',label:'Other',color:'#A0A6B8'}]

export default function Body({ showToast, openDetail }) {
  const [entries, setEntries] = useState([])
  const [triggers, setTriggers] = useState([])
  const [tab, setTab] = useState('food')
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState({meal_type:'',description:'',calories:'',protein_grams:'',dao_taken:false,oxbile_taken:false})
  const [tform, setTform] = useState({food:'',trigger_category:'',severity:'',notes:''})
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const ref = useRef(null)

  useEffect(() => { loadEntries(); loadTriggers() }, [])
  async function loadEntries() { setEntries(await getFoodEntries(TODAY)) }
  async function loadTriggers() { const d=await getTriggerFoods(); setTriggers(d.length>0?d:DEFAULT_TRIGGERS) }

  function handleQuery(v) {
    setQuery(v); setForm(f=>({...f,description:v,calories:'',protein_grams:''}))
    clearTimeout(ref.current)
    if (v.length<3){setResults([]);return}
    ref.current=setTimeout(async()=>{setSearching(true);setResults(await searchFood(v));setSearching(false)},600)
  }

  function pick(r){setForm(f=>({...f,description:r.name,calories:r.calories||'',protein_grams:r.protein||''}));setQuery(r.name);setResults([])}

  function flagged(d){return triggers.filter(t=>d?.toLowerCase().includes((t.food||t.name||'').toLowerCase())).map(t=>t.food||t.name)}

  async function submit(){
    if(!form.description||!form.meal_type){showToast('Choose type and food','var(--amber)');return}
    const fl=flagged(form.description)
    await createFoodEntry({date:TODAY,meal_type:form.meal_type,description:form.description,calories:form.calories?parseInt(form.calories):null,protein_grams:form.protein_grams?parseFloat(form.protein_grams):null,dao_taken:form.dao_taken,oxbile_taken:form.oxbile_taken,flagged_triggers:fl,time:new Date().toTimeString().slice(0,5)})
    if(fl.length)showToast(`⚠ ${fl[0]} on no-go list`,'var(--amber)');else showToast('Logged')
    setSheet(null);setForm({meal_type:'',description:'',calories:'',protein_grams:'',dao_taken:false,oxbile_taken:false});setQuery('');setResults([])
    loadEntries()
  }

  async function submitTrigger(){
    if(!tform.food||!tform.trigger_category)return
    await addTriggerFood({...tform,date_identified:TODAY})
    showToast('Added to no-go list');setSheet(null);setTform({food:'',trigger_category:'',severity:'',notes:''});loadTriggers()
  }

  const total=entries.reduce((s,e)=>s+(e.calories||0),0)
  const protein=entries.reduce((s,e)=>s+(e.protein_grams||0),0)
  const pct=Math.min(total/GOAL,1)
  const calColor=total>=GOAL?'var(--green)':total>=MIN?'var(--amber)':'var(--red)'
  const nudge=new Date().getHours()>=14&&total<600

  return (
    <div style={{ paddingBottom:90 }}>
      {/* HEADER */}
      <div style={{ background:'var(--surface)', paddingTop:56, borderBottom:'1px solid var(--bd)' }}>
        <div style={{ padding:'0 16px 16px' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Nutrition & triggers</div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
            <div style={{ fontSize:28, fontWeight:800, letterSpacing:'-.5px' }}>Body</div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:42, fontWeight:300, color:calColor, lineHeight:1, letterSpacing:'-.04em' }}>{total}</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:8.5, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.06em' }}>cal today</div>
            </div>
          </div>
          <div style={{ height:5, background:'var(--bg)', borderRadius:99, overflow:'hidden', margin:'12px 0 6px' }}>
            <div style={{ height:'100%', width:`${pct*100}%`, background:calColor, borderRadius:99, transition:'width .5s' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:9, color:'var(--ink3)' }}>
            <span>0</span><span style={{color:'var(--amber)'}}>{MIN} min</span><span style={{color:'var(--green)'}}>{GOAL} goal</span>
          </div>
          {protein>0&&<div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--ink3)',marginTop:5}}>{protein.toFixed(0)}g protein today</div>}
        </div>
        <div style={{ display:'flex', borderTop:'1px solid var(--bd)' }}>
          {['food','nogo'].map(t=><button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:'12px', border:'none', background:'none', fontWeight:700, fontSize:13, color:tab===t?'var(--indigo)':'var(--ink3)', borderBottom:tab===t?'2px solid var(--indigo)':'2px solid transparent', cursor:'pointer' }}>{t==='food'?'Diary':'No-go list'}</button>)}
        </div>
      </div>

      <div style={{ padding:'14px 16px 0' }}>
        {nudge&&<div style={{marginBottom:10,padding:'10px 14px',background:'var(--amber-l)',border:'1px solid #FFD699',borderRadius:12,fontSize:13,color:'#7A4500',fontWeight:600}}>After 2pm and under 600 cal. Your body needs fuel.</div>}

        {tab==='food'&&(
          <>
            <button onClick={()=>setSheet('log')} style={{ width:'100%', padding:'13px', background:'var(--ink)', color:'white', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:14 }}>+ Log meal or drink</button>
            {entries.length===0
              ?<div style={{textAlign:'center',padding:'40px 0',color:'var(--ink3)',fontFamily:'var(--mono)',fontSize:12}}>Nothing logged today</div>
              :MEAL_TYPES.map(mt=>{
                const me=entries.filter(e=>e.meal_type===mt);if(!me.length)return null
                return(
                  <div key={mt} style={{marginBottom:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
                      <div style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'.1em'}}>{mt}</div>
                      <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--amber)',fontWeight:600}}>{me.reduce((s,e)=>s+(e.calories||0),0)} cal</div>
                    </div>
                    <div style={{background:'var(--surface)',border:'1px solid var(--bd)',borderRadius:16,overflow:'hidden'}}>
                      {me.map((e,i)=>(
                        <div key={e.id} style={{padding:'12px 14px',borderBottom:i<me.length-1?'1px solid var(--bd)':'none',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,fontWeight:600,color:'var(--ink)',marginBottom:5,lineHeight:1.3}}>{e.description}</div>
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                              {e.calories&&<span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--amber)',fontWeight:600}}>{e.calories} cal</span>}
                              {e.protein_grams&&<span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--sky)'}}>{e.protein_grams}g protein</span>}
                              {e.dao_taken&&<span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--green)',fontWeight:600}}>DAO ✓</span>}
                              {e.oxbile_taken&&<span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--green)',fontWeight:600}}>OxBile ✓</span>}
                              {e.flagged_triggers?.length>0&&<span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--amber)',background:'var(--amber-l)',padding:'2px 7px',borderRadius:99,fontWeight:600}}>⚠ {e.flagged_triggers[0]}</span>}
                            </div>
                          </div>
                          <button onClick={async()=>{await deleteFoodEntry(e.id);loadEntries()}} style={{background:'none',border:'none',color:'var(--ink3)',fontSize:18,cursor:'pointer',paddingLeft:10}}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            }
          </>
        )}

        {tab==='nogo'&&(
          <>
            <button onClick={()=>setSheet('trigger')} style={{ width:'100%', padding:'13px', background:'var(--ink)', color:'white', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:14 }}>+ Add trigger</button>
            {TRIGGER_CATS.map(cat=>{
              const items=triggers.filter(t=>t.trigger_category===cat.id);if(!items.length)return null
              return(
                <div key={cat.id} style={{marginBottom:14}}>
                  <div style={{fontFamily:'var(--mono)',fontSize:9,color:cat.color,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:7,fontWeight:600}}>{cat.label}</div>
                  <div style={{background:'var(--surface)',border:'1px solid var(--bd)',borderRadius:16,overflow:'hidden'}}>
                    {items.map((t,i)=>(
                      <div key={i} style={{padding:'11px 14px',borderBottom:i<items.length-1?'1px solid var(--bd)':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:14,fontWeight:600}}>{t.food||t.name}</span>
                        <span style={{fontFamily:'var(--mono)',fontSize:9,color:t.severity==='severe'?'var(--red)':t.severity==='moderate'?'var(--amber)':'var(--ink3)',fontWeight:600,textTransform:'uppercase'}}>{t.severity}</span>
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
      {sheet==='log'&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(8px)',zIndex:200,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setSheet(null)}>
          <div style={{background:'var(--surface)',borderRadius:'24px 24px 0 0',padding:'6px 16px 40px',width:'100%',maxHeight:'90svh',overflowY:'auto'}}>
            <div style={{width:36,height:4,borderRadius:99,background:'var(--bd)',margin:'10px auto 18px'}}/>
            <div style={{fontSize:18,fontWeight:800,marginBottom:20}}>Log meal</div>
            <div style={{marginBottom:14}}>
              <div style={{fontFamily:'var(--mono)',fontSize:8.5,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:7}}>Meal type</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>{MEAL_TYPES.map(m=><button key={m} onClick={()=>setForm(f=>({...f,meal_type:m}))} style={{padding:'6px 12px',borderRadius:99,border:`1.5px solid ${form.meal_type===m?'var(--ink)':'var(--bd)'}`,background:form.meal_type===m?'var(--ink)':'var(--bg)',color:form.meal_type===m?'white':'var(--ink2)',fontSize:12,fontWeight:600,cursor:'pointer'}}>{m}</button>)}</div>
            </div>
            <div style={{marginBottom:14,position:'relative'}}>
              <div style={{fontFamily:'var(--mono)',fontSize:8.5,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:7}}>Search or type food</div>
              <input type="text" value={query} onChange={e=>handleQuery(e.target.value)} placeholder="e.g. Simple Mills crackers" autoComplete="off" style={{width:'100%',background:'var(--bg)',border:'1.5px solid var(--bd)',borderRadius:10,padding:'11px 14px',color:'var(--ink)',fontSize:14,fontWeight:500,outline:'none'}}/>
              {searching&&<div style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--ink3)',marginTop:4}}>Searching...</div>}
              {results.length>0&&(
                <div style={{background:'var(--surface)',border:'1px solid var(--bd)',borderRadius:12,marginTop:6,overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,.12)',position:'absolute',left:0,right:0,zIndex:10}}>
                  {results.slice(0,5).map((r,i)=>(
                    <div key={i} onClick={()=>pick(r)} style={{padding:'11px 14px',borderBottom:i<4?'1px solid var(--bd)':'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{flex:1,fontSize:13,fontWeight:600,lineHeight:1.3}}>{r.name}</div>
                      <div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--amber)',fontWeight:600,flexShrink:0,marginLeft:8}}>{r.calories} cal</div>
                    </div>
                  ))}
                </div>
              )}
              {flagged(form.description).length>0&&<div style={{marginTop:6,padding:'8px 12px',background:'var(--amber-l)',border:'1px solid #FFD699',borderRadius:8,fontSize:12,color:'#7A4500',fontWeight:600}}>⚠ {flagged(form.description).join(', ')} on your no-go list</div>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <div><div style={{fontFamily:'var(--mono)',fontSize:8.5,color:'var(--ink3)',textTransform:'uppercase',marginBottom:6}}>Calories</div><input type="number" placeholder="auto" value={form.calories} onChange={e=>setForm(f=>({...f,calories:e.target.value}))} style={{width:'100%',background:'var(--bg)',border:'1.5px solid var(--bd)',borderRadius:8,padding:'10px',color:'var(--ink)',fontSize:15,fontFamily:'var(--mono)',fontWeight:600,outline:'none'}}/></div>
              <div><div style={{fontFamily:'var(--mono)',fontSize:8.5,color:'var(--ink3)',textTransform:'uppercase',marginBottom:6}}>Protein (g)</div><input type="number" placeholder="auto" value={form.protein_grams} onChange={e=>setForm(f=>({...f,protein_grams:e.target.value}))} style={{width:'100%',background:'var(--bg)',border:'1.5px solid var(--bd)',borderRadius:8,padding:'10px',color:'var(--ink)',fontSize:15,fontFamily:'var(--mono)',fontWeight:600,outline:'none'}}/></div>
            </div>
            <div style={{display:'flex',gap:20,marginBottom:20}}>
              {['dao_taken','oxbile_taken'].map(f=>(
                <label key={f} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13.5,fontWeight:600}}>
                  <input type="checkbox" checked={form[f]} onChange={e=>setForm(ff=>({...ff,[f]:e.target.checked}))} style={{width:18,height:18,accentColor:'var(--green)'}}/>
                  {f==='dao_taken'?'DAO enzyme':'Ox bile'}
                </label>
              ))}
            </div>
            <button onClick={submit} style={{width:'100%',padding:'14px',background:'var(--ink)',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer'}}>Save</button>
          </div>
        </div>
      )}

      {/* TRIGGER SHEET */}
      {sheet==='trigger'&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(8px)',zIndex:200,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setSheet(null)}>
          <div style={{background:'var(--surface)',borderRadius:'24px 24px 0 0',padding:'6px 16px 40px',width:'100%'}}>
            <div style={{width:36,height:4,borderRadius:99,background:'var(--bd)',margin:'10px auto 18px'}}/>
            <div style={{fontSize:18,fontWeight:800,marginBottom:20}}>Add to no-go list</div>
            <div style={{marginBottom:14}}><div style={{fontFamily:'var(--mono)',fontSize:8.5,color:'var(--ink3)',textTransform:'uppercase',marginBottom:7}}>Food</div><input type="text" value={tform.food} onChange={e=>setTform(f=>({...f,food:e.target.value}))} placeholder="e.g. Avocado" style={{width:'100%',background:'var(--bg)',border:'1.5px solid var(--bd)',borderRadius:10,padding:'11px 14px',color:'var(--ink)',fontSize:14,fontWeight:500,outline:'none'}}/></div>
            <div style={{marginBottom:14}}><div style={{fontFamily:'var(--mono)',fontSize:8.5,color:'var(--ink3)',textTransform:'uppercase',marginBottom:7}}>Category</div><div style={{display:'flex',flexWrap:'wrap',gap:5}}>{TRIGGER_CATS.map(c=><button key={c.id} onClick={()=>setTform(f=>({...f,trigger_category:c.id}))} style={{padding:'6px 12px',borderRadius:99,border:`1.5px solid ${tform.trigger_category===c.id?c.color:'var(--bd)'}`,background:tform.trigger_category===c.id?c.color:'var(--bg)',color:tform.trigger_category===c.id?'white':'var(--ink2)',fontSize:12,fontWeight:600,cursor:'pointer'}}>{c.label}</button>)}</div></div>
            <div style={{marginBottom:20}}><div style={{fontFamily:'var(--mono)',fontSize:8.5,color:'var(--ink3)',textTransform:'uppercase',marginBottom:7}}>Severity</div><div style={{display:'flex',gap:8}}>{['mild','moderate','severe'].map(s=><button key={s} onClick={()=>setTform(f=>({...f,severity:s}))} style={{flex:1,padding:'10px',borderRadius:10,border:`1.5px solid ${tform.severity===s?'var(--ink)':'var(--bd)'}`,background:tform.severity===s?'var(--ink)':'var(--bg)',color:tform.severity===s?'white':'var(--ink2)',fontSize:13,fontWeight:700,cursor:'pointer'}}>{s}</button>)}</div></div>
            <button onClick={submitTrigger} style={{width:'100%',padding:'14px',background:'var(--ink)',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer'}}>Add to list</button>
          </div>
        </div>
      )}
    </div>
  )
}
