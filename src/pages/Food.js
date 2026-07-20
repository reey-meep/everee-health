import { useState, useEffect, useRef } from 'react'
import { getFoodEntries, createFoodEntry, deleteFoodEntry, getTriggerFoods, addTriggerFood } from '../lib/db'
import { DEFAULT_TRIGGERS } from '../lib/constants'
import { searchFood } from '../lib/google-health'

const MEAL_TYPES = ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner', 'Evening snack', 'Drink']
const CALORIE_MIN = 1500
const CALORIE_GOAL = 1800
const today = new Date().toISOString().split('T')[0]

const TRIGGER_CATEGORIES = [
  { id: 'histamine', label: 'Histamine', color: '#EF4444' },
  { id: 'mast_cell', label: 'Mast cell', color: '#EC4899' },
  { id: 'oas', label: 'OAS cluster', color: '#F59E0B' },
  { id: 'intolerance', label: 'Intolerance', color: '#6366F1' },
  { id: 'lpr', label: 'LPR', color: '#38BDF8' },
  { id: 'other', label: 'Other', color: '#5A5A7A' },
]

export default function Food({ showToast }) {
  const [entries, setEntries] = useState([])
  const [triggers, setTriggers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showTriggerForm, setShowTriggerForm] = useState(false)
  const [activeTab, setActiveTab] = useState('diary')
  const [form, setForm] = useState({ meal_type: '', description: '', calories: '', protein_grams: '', dao_taken: false, oxbile_taken: false })
  const [triggerForm, setTriggerForm] = useState({ food: '', trigger_category: '', severity: '', notes: '' })
  const [foodSearch, setFoodSearch] = useState('')
  const [foodResults, setFoodResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef(null)

  useEffect(() => { loadEntries(); loadTriggers() }, [])

  async function loadEntries() {
    const data = await getFoodEntries(today)
    setEntries(data)
  }

  async function loadTriggers() {
    const data = await getTriggerFoods()
    setTriggers(data.length > 0 ? data : DEFAULT_TRIGGERS)
  }

  // Debounced food search against Open Food Facts
  function handleFoodSearchChange(val) {
    setFoodSearch(val)
    setForm(f => ({ ...f, description: val, calories: '', protein_grams: '' }))
    clearTimeout(searchTimeout.current)
    if (val.length < 3) { setFoodResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      const results = await searchFood(val)
      setFoodResults(results)
      setSearching(false)
    }, 600)
  }

  function selectFoodResult(result) {
    setForm(f => ({
      ...f,
      description: result.name,
      calories: result.calories || '',
      protein_grams: result.protein || '',
    }))
    setFoodSearch(result.name)
    setFoodResults([])
  }

  // Auto-detect no-go list items in description
  function getFlaggedTriggers(description) {
    return triggers
      .filter(t => description?.toLowerCase().includes((t.food || t.name || '').toLowerCase()))
      .map(t => t.food || t.name)
  }

  async function submitEntry() {
    if (!form.description || !form.meal_type) {
      showToast('Please fill in type and description', 'var(--amber)')
      return
    }
    const flagged = getFlaggedTriggers(form.description)
    await createFoodEntry({
      date: today,
      meal_type: form.meal_type,
      description: form.description,
      calories: form.calories ? parseInt(form.calories) : null,
      protein_grams: form.protein_grams ? parseFloat(form.protein_grams) : null,
      dao_taken: form.dao_taken,
      oxbile_taken: form.oxbile_taken,
      flagged_triggers: flagged,
      time: new Date().toTimeString().slice(0, 5),
    })
    if (flagged.length > 0) {
      showToast(`⚠ ${flagged[0]} is on your no-go list`, 'var(--amber)')
    } else {
      showToast('Meal logged')
    }
    setShowForm(false)
    setForm({ meal_type: '', description: '', calories: '', protein_grams: '', dao_taken: false, oxbile_taken: false })
    setFoodSearch('')
    setFoodResults([])
    loadEntries()
  }

  async function submitTrigger() {
    if (!triggerForm.food || !triggerForm.trigger_category) return
    await addTriggerFood({ ...triggerForm, date_identified: today })
    showToast('Added to no-go list')
    setShowTriggerForm(false)
    setTriggerForm({ food: '', trigger_category: '', severity: '', notes: '' })
    loadTriggers()
  }

  const totalCalories = entries.reduce((sum, e) => sum + (e.calories || 0), 0)
  const totalProtein = entries.reduce((sum, e) => sum + (e.protein_grams || 0), 0)
  const calPct = Math.min(totalCalories / CALORIE_GOAL, 1)
  const calColor = totalCalories >= CALORIE_GOAL ? 'var(--green)' : totalCalories >= CALORIE_MIN ? 'var(--amber)' : totalCalories < 600 && new Date().getHours() >= 14 ? 'var(--red)' : 'var(--ink2)'
  const remainingMin = Math.max(0, CALORIE_MIN - totalCalories)
  const remainingGoal = Math.max(0, CALORIE_GOAL - totalCalories)

  // Gentle nudge if behind by 2pm
  const showNudge = new Date().getHours() >= 14 && totalCalories < 600

  function triggerCatInfo(id) { return TRIGGER_CATEGORIES.find(c => c.id === id) || TRIGGER_CATEGORIES[TRIGGER_CATEGORIES.length - 1] }

  return (
    <div className="view">
      <div className="hero">
        <div className="eyebrow">everee health · Food</div>
        <h1>Food diary</h1>
        <p>Search any food to auto-fill calories. No-go list flags flagged automatically.</p>
      </div>

      {/* CALORIE BAR */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 36, fontStyle: 'italic', color: calColor, lineHeight: 1 }}>{totalCalories}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>calories today</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink2)' }}>{totalProtein.toFixed(0)}g protein</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>
              {totalCalories < CALORIE_MIN ? `${remainingMin} to minimum` : totalCalories < CALORIE_GOAL ? `${remainingGoal} to goal` : 'Goal reached'}
            </div>
          </div>
        </div>
        <div style={{ height: 8, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${calPct * 100}%`, background: calColor, borderRadius: 99, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink3)' }}>
          <span>0</span><span style={{ color: 'var(--amber)' }}>{CALORIE_MIN} min</span><span style={{ color: 'var(--green)' }}>{CALORIE_GOAL} goal</span>
        </div>
        {showNudge && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--amber)', lineHeight: 1.5 }}>
            After 2pm and under 600 calories. Your body needs fuel -- even something small helps.
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', background: 'var(--s1)', border: 'var(--border)', borderRadius: 10, padding: 3, marginBottom: 12, gap: 3 }}>
        {['diary', 'nogo'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ flex: 1, padding: '7px 4px', borderRadius: 7, border: 'none', background: activeTab === t ? 'var(--s2)' : 'none', color: activeTab === t ? 'var(--ink)' : 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 10.5, cursor: 'pointer' }}>
            {t === 'diary' ? 'Food Diary' : 'No-Go List'}
          </button>
        ))}
      </div>

      {activeTab === 'diary' && (
        <>
          <button className="btn btn-primary btn-full" style={{ marginBottom: 12 }} onClick={() => setShowForm(true)}>
            + Log meal or drink
          </button>

          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11 }}>Nothing logged yet today</div>
          ) : (
            MEAL_TYPES.map(mealType => {
              const mealEntries = entries.filter(e => e.meal_type === mealType)
              if (!mealEntries.length) return null
              return (
                <div key={mealType}>
                  <div className="sdiv">
                    <span style={{ background: 'var(--s2)', color: 'var(--ink2)', border: 'var(--border)', fontSize: 9 }}>{mealType}</span>
                    <hr /><span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>{mealEntries.reduce((s, e) => s + (e.calories || 0), 0)} cal</span>
                  </div>
                  {mealEntries.map(e => (
                    <div key={e.id} className="card" style={{ marginBottom: 6, padding: '10px 13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 3 }}>{e.description}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {e.calories && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--amber)', fontWeight: 600 }}>{e.calories} cal</span>}
                            {e.protein_grams && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--sky)' }}>{e.protein_grams}g protein</span>}
                            {e.dao_taken && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--green)' }}>DAO ✓</span>}
                            {e.oxbile_taken && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--green)' }}>OxBile ✓</span>}
                            {e.flagged_triggers?.length > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--amber)', background: 'rgba(245,158,11,.15)', padding: '1px 6px', borderRadius: 99 }}>⚠ {e.flagged_triggers[0]}</span>}
                          </div>
                        </div>
                        <button onClick={async () => { await deleteFoodEntry(e.id); loadEntries() }} style={{ background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 16, padding: '0 0 0 8px', cursor: 'pointer' }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </>
      )}

      {activeTab === 'nogo' && (
        <>
          <button className="btn btn-primary btn-full" style={{ marginBottom: 12 }} onClick={() => setShowTriggerForm(true)}>
            + Add to no-go list
          </button>
          {TRIGGER_CATEGORIES.map(cat => {
            const items = triggers.filter(t => t.trigger_category === cat.id)
            if (!items.length) return null
            return (
              <div key={cat.id}>
                <div className="sdiv">
                  <span style={{ background: cat.color + '20', color: cat.color, borderColor: cat.color + '40', fontSize: 9 }}>{cat.label}</span>
                  <hr />
                </div>
                {items.map((t, i) => (
                  <div key={i} className="card" style={{ marginBottom: 6, padding: '10px 13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>{t.food || t.name}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: t.severity === 'severe' ? 'var(--red)' : t.severity === 'moderate' ? 'var(--amber)' : 'var(--ink3)' }}>{t.severity || ''}</span>
                    </div>
                    {t.notes && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>{t.notes}</div>}
                  </div>
                ))}
              </div>
            )
          })}
        </>
      )}

      {/* FOOD LOG MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">Log meal</span>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">Meal type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {MEAL_TYPES.map(m => (
                  <button key={m} onClick={() => setForm(f => ({ ...f, meal_type: m }))}
                    style={{ padding: '5px 10px', borderRadius: 99, border: `1.5px solid ${form.meal_type === m ? 'var(--indigo)' : 'var(--bd)'}`, background: form.meal_type === m ? 'rgba(99,102,241,.15)' : 'var(--s2)', color: form.meal_type === m ? 'var(--indigo-l)' : 'var(--ink2)', fontSize: 11, cursor: 'pointer' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* FOOD SEARCH */}
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Search food or type it in</label>
              <input
                type="text" className="input"
                placeholder="e.g. Simple Mills almond crackers"
                value={foodSearch}
                onChange={e => handleFoodSearchChange(e.target.value)}
                autoComplete="off"
              />
              {searching && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginTop: 4 }}>Searching food database...</div>
              )}
              {foodResults.length > 0 && (
                <div style={{ background: 'var(--s2)', border: 'var(--border)', borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
                  {foodResults.map((r, i) => (
                    <div key={i} onClick={() => selectFoodResult(r)}
                      style={{ padding: '9px 12px', borderBottom: i < foodResults.length - 1 ? '1px solid var(--s3)' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, lineHeight: 1.3, marginBottom: 1 }}>{r.name}</div>
                        {r.serving && <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink3)' }}>{r.serving}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>{r.calories} cal</div>
                        {r.protein > 0 && <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--sky)' }}>{r.protein}g protein</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Trigger warning inline */}
              {form.description && getFlaggedTriggers(form.description).length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--amber)', background: 'rgba(245,158,11,.1)', border: '1.5px solid rgba(245,158,11,.3)', borderRadius: 6, padding: '5px 9px' }}>
                  ⚠ {getFlaggedTriggers(form.description).join(', ')} {getFlaggedTriggers(form.description).length > 1 ? 'are' : 'is'} on your no-go list
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }} className="form-group">
              <div style={{ flex: 1 }}>
                <label className="form-label">Calories</label>
                <input type="number" className="input" placeholder="auto-filled from search" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Protein (g)</label>
                <input type="number" className="input" placeholder="auto-filled" value={form.protein_grams} onChange={e => setForm(f => ({ ...f, protein_grams: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              {['dao_taken', 'oxbile_taken'].map(f => (
                <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5 }}>
                  <input type="checkbox" checked={form[f]} onChange={e => setForm(ff => ({ ...ff, [f]: e.target.checked }))} />
                  {f === 'dao_taken' ? 'DAO enzyme' : 'Ox bile'}
                </label>
              ))}
            </div>
            <button className="btn btn-primary btn-full" onClick={submitEntry}>Save</button>
          </div>
        </div>
      )}

      {/* TRIGGER FORM MODAL */}
      {showTriggerForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTriggerForm(false)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">Add to no-go list</span>
              <button className="modal-close" onClick={() => setShowTriggerForm(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Food or ingredient</label>
              <input type="text" className="input" placeholder="e.g. Avocado" value={triggerForm.food} onChange={e => setTriggerForm(f => ({ ...f, food: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {TRIGGER_CATEGORIES.map(c => (
                  <button key={c.id} onClick={() => setTriggerForm(f => ({ ...f, trigger_category: c.id }))}
                    style={{ padding: '5px 10px', borderRadius: 99, border: `1.5px solid ${triggerForm.trigger_category === c.id ? c.color : 'var(--bd)'}`, background: triggerForm.trigger_category === c.id ? c.color + '20' : 'var(--s2)', color: triggerForm.trigger_category === c.id ? c.color : 'var(--ink2)', fontSize: 11, cursor: 'pointer' }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Severity</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['mild', 'moderate', 'severe'].map(s => (
                  <button key={s} onClick={() => setTriggerForm(f => ({ ...f, severity: s }))}
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: `1.5px solid ${triggerForm.severity === s ? 'var(--indigo)' : 'var(--bd)'}`, background: triggerForm.severity === s ? 'rgba(99,102,241,.15)' : 'var(--s2)', color: triggerForm.severity === s ? 'var(--indigo-l)' : 'var(--ink2)', fontSize: 11, cursor: 'pointer' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input type="text" className="input" placeholder="e.g. causes OAS symptoms" value={triggerForm.notes} onChange={e => setTriggerForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <button className="btn btn-primary btn-full" onClick={submitTrigger}>Add to list</button>
          </div>
        </div>
      )}
    </div>
  )
}
