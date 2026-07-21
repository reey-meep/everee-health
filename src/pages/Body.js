import { useState, useEffect, useRef } from 'react'
import { getFoodEntries, createFoodEntry, deleteFoodEntry, getTriggerFoods, addTriggerFood, addWater, getDailyLog } from '../lib/db'
import { DEFAULT_TRIGGERS } from '../lib/constants'
import { searchFood } from '../lib/google-health'

// Local calendar date, not UTC. Recomputed per call so a PWA left open
// past midnight rolls over instead of writing to yesterday's key.
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const MIN = 1500, GOAL = 1800
const WATER_MIN = 85, WATER_GOAL = 100
const MEAL_TYPES = ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner', 'Evening snack', 'Drink']
const TRIGGER_CATS = [{ id: 'histamine', label: 'Histamine', color: '#FF3B5C' }, { id: 'mast_cell', label: 'Mast cell', color: '#F0468A' }, { id: 'oas', label: 'OAS cluster', color: '#FF9500' }, { id: 'intolerance', label: 'Intolerance', color: '#5B5EF4' }, { id: 'lpr', label: 'LPR', color: '#00B4D8' }, { id: 'other', label: 'Other', color: '#A0A6B8' }]

export default function Body({ showToast }) {
  const [entries, setEntries] = useState([])
  const [triggers, setTriggers] = useState([])
  const [bodyTab, setBodyTab] = useState('food')
  const [waterOz, setWaterOz] = useState(0)
  const [waterBusy, setWaterBusy] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState({ meal_type: '', description: '', calories: '', protein_grams: '', dao_taken: false, oxbile_taken: false })
  const [tform, setTform] = useState({ food: '', trigger_category: '', severity: '' })
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => { loadEntries(); loadTriggers() }, [])
  async function loadEntries() { setEntries(await getFoodEntries(todayKey())) }
    getDailyLog(todayKey()).then(l => setWaterOz(Number(l?.water_oz || 0))).catch(() => {})
  async function loadTriggers() { const d = await getTriggerFoods(); setTriggers(d.length > 0 ? d : DEFAULT_TRIGGERS) }

  function handleQuery(v) {
    setQuery(v); setForm(f => ({ ...f, description: v, calories: '', protein_grams: '' }))
    clearTimeout(searchRef.current)
    if (v.length < 3) { setResults([]); return }
    searchRef.current = setTimeout(async () => { setSearching(true); setResults(await searchFood(v)); setSearching(false) }, 600)
  }

  function pick(r) { setForm(f => ({ ...f, description: r.name, calories: r.calories || '', protein_grams: r.protein || '' })); setQuery(r.name); setResults([]) }
  function flagged(d) { return triggers.filter(t => d?.toLowerCase().includes((t.food || t.name || '').toLowerCase())).map(t => t.food || t.name) }

  async function submit() {
    if (!form.description || !form.meal_type) { showToast('Choose type and food', 'var(--amber)'); return }
    const fl = flagged(form.description)
    try {
      await createFoodEntry({ date: todayKey(), meal_type: form.meal_type, description: form.description, calories: form.calories ? parseInt(form.calories) : null, protein_grams: form.protein_grams ? parseFloat(form.protein_grams) : null, dao_taken: form.dao_taken, oxbile_taken: form.oxbile_taken, flagged_triggers: fl, time: new Date().toTimeString().slice(0, 5) })
    } catch {
      // Keep the sheet open and the form intact so the entry isn't lost.
      showToast('Not saved — nothing was logged', 'var(--red)')
      return
    }
    if (fl.length) showToast(`⚠ ${fl[0]} on no-go list`, 'var(--amber)'); else showToast('Logged')
    setSheet(null); setForm({ meal_type: '', description: '', calories: '', protein_grams: '', dao_taken: false, oxbile_taken: false }); setQuery(''); setResults([])
    loadEntries()
  }

  // Water lives here with food, so every intake log has one home.
  async function logWater(oz) {
    setWaterBusy(true)
    try {
      const updated = await addWater(todayKey(), oz)
      if (updated) setWaterOz(Number(updated.water_oz || 0))
      showToast(`+${oz} oz`, 'var(--sky)')
    } catch {
      showToast('Not saved — water not logged', 'var(--red)')
    }
    setWaterBusy(false)
  }

  async function submitTrigger() {
    if (!tform.food || !tform.trigger_category) return
    try {
      // severity is optional in the UI, but '' violates the CHECK constraint — send null.
      await addTriggerFood({ ...tform, severity: tform.severity || null, date_identified: todayKey() })
    } catch {
      showToast('Not saved — nothing was added', 'var(--red)')
      return
    }
    showToast('Added to no-go list'); setSheet(null); setTform({ food: '', trigger_category: '', severity: '' }); loadTriggers()
  }

  const total = entries.reduce((s, e) => s + (e.calories || 0), 0)
  const protein = entries.reduce((s, e) => s + (e.protein_grams || 0), 0)
  const pct = Math.min(total / GOAL, 1)
  const calColor = total >= GOAL ? 'var(--green)' : total >= MIN ? 'var(--amber)' : 'var(--red)'

  return (
    <div className="screen active">
      <div className="header" style={{ paddingBottom: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Nutrition</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 14 }}>
          <div className="page-title">Food diary</div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 40, fontWeight: 300, color: calColor, lineHeight: 1, letterSpacing: '-.04em' }}>{total}</div>
            <div className="mono" style={{ fontSize: 8.5, color: 'var(--ink3)', textTransform: 'uppercase' }}>cal today</div>
          </div>
        </div>
        <div className="prog" style={{ margin: '0 0 5px' }}><div className="prog-fill" style={{ width: `${pct * 100}%`, background: calColor }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginBottom: 14 }}>
          <span>0</span><span style={{ color: 'var(--amber)' }}>{MIN} min</span><span style={{ color: 'var(--green)' }}>{GOAL} goal</span>
        </div>
        {protein > 0 && <div className="mono" style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 10 }}>{protein.toFixed(0)}g protein today</div>}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span className="eyebrow">Water</span>
            <span className="mono" style={{ fontSize: 11, color: waterOz >= WATER_MIN ? 'var(--green)' : 'var(--sky)' }}>
              {Math.round(waterOz)}<span style={{ color: 'var(--ink4)' }}> / {WATER_GOAL} oz</span>
            </span>
          </div>
          <div className="prog" style={{ marginBottom: 10 }}>
            <div className="prog-fill" style={{ width: `${Math.min(waterOz / WATER_GOAL, 1) * 100}%`, background: waterOz >= WATER_MIN ? 'var(--green)' : 'var(--sky)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[8, 12, 16].map(oz => (
              <button key={oz} disabled={waterBusy} onClick={() => logWater(oz)} style={{
                flex: 1, minHeight: 44, borderRadius: 10, border: '1.5px solid var(--bd)',
                background: 'var(--bg)', color: 'var(--ink2)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', opacity: waterBusy ? .5 : 1, fontFamily: 'inherit',
              }}>+{oz} oz</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', borderTop: '1px solid var(--bd)' }}>
          {['food', 'nogo'].map(t => <button key={t} onClick={() => setBodyTab(t)} style={{ flex: 1, padding: '11px', border: 'none', background: 'none', fontWeight: 700, fontSize: 13, color: bodyTab === t ? 'var(--indigo)' : 'var(--ink3)', borderBottom: bodyTab === t ? '2px solid var(--indigo)' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit' }}>{t === 'food' ? 'Diary' : 'No-go list'}</button>)}
        </div>
      </div>

      <div className="body">
        {bodyTab === 'food' && (
          <>
            <button className="btn-black" onClick={() => setSheet('log')}>+ Log meal or drink</button>
            {entries.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Nothing logged today</div>
              : MEAL_TYPES.map(mt => {
                const me = entries.filter(e => e.meal_type === mt); if (!me.length) return null
                return (
                  <div key={mt}>
                    <div className="section-label" style={{ marginBottom: 6 }}>{mt} <span className="mono" style={{ color: 'var(--amber)', fontWeight: 600 }}>{me.reduce((s, e) => s + (e.calories || 0), 0)} cal</span></div>
                    <div className="card">
                      {me.map((e, i) => (
                        <div key={e.id} style={{ padding: '11px 14px', borderBottom: i < me.length - 1 ? '1px solid var(--bd)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.3 }}>{e.description}</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              {e.calories && <span className="mono" style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>{e.calories} cal</span>}
                              {e.protein_grams && <span className="mono" style={{ fontSize: 11, color: 'var(--sky)' }}>{e.protein_grams}g protein</span>}
                              {e.dao_taken && <span className="mono" style={{ fontSize: 9, color: 'var(--green)', fontWeight: 600 }}>DAO ✓</span>}
                              {e.flagged_triggers?.length > 0 && <span className="mono" style={{ fontSize: 9, color: 'var(--amber)', background: '#FFF8ED', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>⚠ {e.flagged_triggers[0]}</span>}
                            </div>
                          </div>
                          <button onClick={async () => { try { await deleteFoodEntry(e.id) } catch { showToast('Could not delete', 'var(--red)'); return } loadEntries() }} style={{ background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 18, cursor: 'pointer', paddingLeft: 10 }}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            }
          </>
        )}

        {bodyTab === 'nogo' && (
          <>
            <button className="btn-black" onClick={() => setSheet('trigger')}>+ Add trigger</button>
            {TRIGGER_CATS.map(cat => {
              const items = triggers.filter(t => t.trigger_category === cat.id); if (!items.length) return null
              return (
                <div key={cat.id}>
                  <div className="section-label" style={{ color: cat.color, marginBottom: 7 }}>{cat.label}</div>
                  <div className="card">
                    {items.map((t, i) => (
                      <div key={i} style={{ padding: '11px 14px', borderBottom: i < items.length - 1 ? '1px solid var(--bd)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{t.food || t.name}</span>
                        <span className="mono" style={{ fontSize: 9, color: t.severity === 'severe' ? 'var(--red)' : t.severity === 'moderate' ? 'var(--amber)' : 'var(--ink3)', fontWeight: 600, textTransform: 'uppercase' }}>{t.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Log sheet */}
      {sheet === 'log' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setSheet(null)}>
            <div className="sheet">
              <div className="sheet-handle" />
              <div className="sheet-title">Log meal</div>
              <div style={{ marginBottom: 14 }}><label className="form-label">Meal type</label><div className="chip-row">{MEAL_TYPES.map(m => <button key={m} className={`chip${form.meal_type === m ? ' on' : ''}`} onClick={() => setForm(f => ({ ...f, meal_type: m }))}>{m}</button>)}</div></div>
              <div style={{ marginBottom: 14, position: 'relative' }}>
                <label className="form-label">Search or type food</label>
                <input type="text" className="input" placeholder="e.g. Simple Mills crackers" value={query} onChange={e => handleQuery(e.target.value)} autoComplete="off" />
                {searching && <div className="mono" style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 4 }}>Searching...</div>}
                {results.length > 0 && (
                  <div className="card" style={{ marginTop: 6, position: 'absolute', left: 0, right: 0, zIndex: 10, boxShadow: '0 8px 32px rgba(0,0,0,.12)' }}>
                    {results.slice(0, 5).map((r, i) => (
                      <div key={i} onClick={() => pick(r)} style={{ padding: '10px 14px', borderBottom: i < 4 ? '1px solid var(--bd)' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{r.name}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600, marginLeft: 8 }}>{r.calories} cal</div>
                      </div>
                    ))}
                  </div>
                )}
                {flagged(form.description).length > 0 && <div style={{ marginTop: 6, padding: '8px 12px', background: '#FFF8ED', border: '1px solid #FAC775', borderRadius: 8, fontSize: 12, color: '#7A4500', fontWeight: 600 }}>⚠ {flagged(form.description).join(', ')} on your no-go list</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div><label className="form-label">Calories</label><input type="number" className="input" placeholder="auto" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))}/></div>
                <div><label className="form-label">Protein (g)</label><input type="number" className="input" placeholder="auto" value={form.protein_grams} onChange={e => setForm(f => ({ ...f, protein_grams: e.target.value }))}/></div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                {['dao_taken', 'oxbile_taken'].map(f => <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 500 }}><input type="checkbox" checked={form[f]} onChange={e => setForm(ff => ({ ...ff, [f]: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--green)' }}/>{f === 'dao_taken' ? 'DAO enzyme' : 'Ox bile'}</label>)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setSheet(null)}>Cancel</button>
                <button className="btn-black" style={{ flex: 2 }} onClick={submit}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trigger sheet */}
      {sheet === 'trigger' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setSheet(null)}>
            <div className="sheet">
              <div className="sheet-handle" />
              <div className="sheet-title">Add to no-go list</div>
              <div style={{ marginBottom: 14 }}><label className="form-label">Food</label><input type="text" className="input" placeholder="e.g. Avocado" value={tform.food} onChange={e => setTform(f => ({ ...f, food: e.target.value }))}/></div>
              <div style={{ marginBottom: 14 }}><label className="form-label">Category</label><div className="chip-row">{TRIGGER_CATS.map(c => <button key={c.id} className={`chip${tform.trigger_category === c.id ? ' on' : ''}`} style={tform.trigger_category === c.id ? { background: c.color, borderColor: c.color } : {}} onClick={() => setTform(f => ({ ...f, trigger_category: c.id }))}>{c.label}</button>)}</div></div>
              <div style={{ marginBottom: 20 }}><label className="form-label">Severity</label><div style={{ display: 'flex', gap: 8 }}>{['mild', 'moderate', 'severe'].map(s => <button key={s} className={`chip${tform.severity === s ? ' on' : ''}`} style={{ flex: 1, ...(tform.severity === s ? {} : {}) }} onClick={() => setTform(f => ({ ...f, severity: s }))}>{s}</button>)}</div></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setSheet(null)}>Cancel</button>
                <button className="btn-black" style={{ flex: 2 }} onClick={submitTrigger}>Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
