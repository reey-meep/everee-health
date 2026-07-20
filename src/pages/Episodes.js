import { getDailyLog } from '../lib/db'
import { avgHRInWindow } from '../lib/google-health'
import { useState, useEffect } from 'react'
import { getEpisodes, createEpisode } from '../lib/db'
import { EPISODE_TYPES } from '../lib/constants'

const TRIGGERS = ['Gluten', 'Citric acid', 'Chocolate', 'Banana', 'High fat meal', 'Late propranolol', 'Emotional stress', 'Exercise', 'Vigorous activity', 'Sudden waking', 'Standing too fast', 'Gas pressure', 'Period', 'Luteal phase', 'Poor sleep', 'Unknown']
const WHAT_HELPED = ['Famotidine', 'Propranolol', 'Valsalva', 'Cold face immersion', 'Ginger chew', 'Havening', 'Breathing', 'Rylie', 'Rest horizontal', 'Heat pad', 'DAO enzyme', 'Time']
const EPISODE_SYMPTOMS = ['Flushing', 'Heart racing', 'Nausea', 'Dizziness', 'Visual disturbance', 'Exhaustion wave', 'Presyncope', 'Panic', 'Gut cramping', 'Throat clearing', 'Chest flutter', 'Headache', 'Facial pain', 'Sweating', 'Chills', 'Brain fog']

export default function Episodes({ showToast }) {
  const [episodes, setEpisodes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    episode_type: '', severity: null, started_at: new Date().toISOString().slice(0, 16),
    duration_minutes: '', triggers: [], symptoms_present: [], what_helped: [], recovery_minutes: '', notes: ''
  })

  useEffect(() => { loadEpisodes() }, [])

  async function loadEpisodes() {
    const data = await getEpisodes(30)
    setEpisodes(data)
  }

  function toggleArr(field, val) {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(val) ? f[field].filter(x => x !== val) : [...f[field], val]
    }))
  }

  async function submit() {
    // Auto-attach context: cycle phase, weather pressure, HR window
    const todayLog = await getDailyLog(new Date().toISOString().split("T")[0])
    const startMs = new Date(form.started_at).getTime()
    const hrDuring = await avgHRInWindow(startMs, startMs + 30 * 60 * 1000).catch(() => null)
    const autoContext = {
      cycle_phase_at_episode: todayLog?.cycle_phase || null,
      weather_pressure_at_episode: todayLog?.weather_pressure || null,
      heart_rate_during: hrDuring,
    }
    if (!form.episode_type || !form.severity) {
      showToast('Please select type and severity', 'var(--amber)')
      return
    }
    await createEpisode({ ...autoContext,
      ...form,
      started_at: new Date(form.started_at).toISOString(),
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      recovery_minutes: form.recovery_minutes ? parseInt(form.recovery_minutes) : null,
    })
    showToast('Episode logged')
    setShowForm(false)
    setForm({ episode_type: '', severity: null, started_at: new Date().toISOString().slice(0, 16), duration_minutes: '', triggers: [], symptoms_present: [], what_helped: [], recovery_minutes: '', notes: '' })
    loadEpisodes()
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const typeInfo = (id) => EPISODE_TYPES.find(t => t.id === id) || {}

  return (
    <div className="view">
      <div className="hero">
        <div className="eyebrow">everee health · Episodes</div>
        <h1>Episode log</h1>
        <p>Every type of episode in one place. Your data for your GP.</p>
      </div>

      <button className="btn btn-primary btn-full" style={{ marginBottom: 12 }} onClick={() => setShowForm(true)}>
        + Log episode
      </button>

      {/* QUICK PROTOCOLS */}
      <div className="card">
        <div className="card-head"><span className="card-title" style={{ color: 'var(--amber)' }}>Pre-BM Presyncope Protocol</span></div>
        <div className="card-body" style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.7 }}>
          <p><strong style={{ color: 'var(--amber)' }}>1.</strong> Sit immediately at exhaustion wave. Do not walk to bathroom yet.</p>
          <p><strong style={{ color: 'var(--amber)' }}>2.</strong> Feet pressed hard into floor. Tense leg muscles.</p>
          <p><strong style={{ color: 'var(--amber)' }}>3.</strong> Start slow nasal breathing NOW. Inhale 4, exhale 6-8.</p>
          <p><strong style={{ color: 'var(--amber)' }}>4.</strong> Warm hand on lower belly.</p>
          <p><strong style={{ color: 'var(--amber)' }}>5.</strong> Walk slowly when wave eases. Breathe through urgency.</p>
          <p><strong style={{ color: 'var(--amber)' }}>6.</strong> After: stay seated 2 min before standing. Havening 3-5 min.</p>
        </div>
      </div>

      {/* EPISODE LIST */}
      {episodes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
          No episodes logged yet
        </div>
      ) : (
        episodes.map(ep => {
          const t = typeInfo(ep.episode_type)
          return (
            <div key={ep.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ padding: '10px 13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span className="pill" style={{ color: t.color, borderColor: t.color + '50', marginRight: 6 }}>{t.label || ep.episode_type}</span>
                    <span className="pill" style={{ color: ep.severity >= 4 ? 'var(--red)' : ep.severity >= 3 ? 'var(--amber)' : 'var(--green)', borderColor: 'var(--bd)' }}>
                      Severity {ep.severity}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{formatTime(ep.started_at)}</span>
                </div>
                {ep.duration_minutes && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', marginBottom: 3 }}>Duration: {ep.duration_minutes} min · Recovery: {ep.recovery_minutes || '?'} min</div>}
                {ep.triggers?.length > 0 && <div style={{ fontSize: 11, color: 'var(--ink2)' }}>Triggers: {ep.triggers.join(', ')}</div>}
                {ep.notes && <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 4, lineHeight: 1.5 }}>{ep.notes}</div>}
              </div>
            </div>
          )
        })
      )}

      {/* LOG FORM MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">Log Episode</span>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">Episode type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {EPISODE_TYPES.map(t => (
                  <button key={t.id} onClick={() => setForm(f => ({ ...f, episode_type: f.episode_type === t.id ? '' : t.id }))}
                    style={{ padding: '5px 10px', borderRadius: 99, border: `1.5px solid ${form.episode_type === t.id ? t.color : 'var(--bd)'}`, background: form.episode_type === t.id ? t.color + '20' : 'var(--s2)', color: form.episode_type === t.id ? t.color : 'var(--ink2)', fontSize: 11, cursor: 'pointer' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Severity</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setForm(f => ({ ...f, severity: f.severity === n ? null : n }))}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 7, border: `1.5px solid ${form.severity === n ? 'var(--indigo)' : 'var(--bd)'}`, background: form.severity === n ? 'var(--indigo)' : 'var(--s2)', color: form.severity === n ? 'white' : 'var(--ink2)', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }} className="form-group">
              <div style={{ flex: 1 }}>
                <label className="form-label">Started at</label>
                <input type="datetime-local" className="input" value={form.started_at} onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Duration (min)</label>
                <input type="number" className="input" placeholder="e.g. 25" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Possible triggers</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {TRIGGERS.map(t => (
                  <button key={t} onClick={() => toggleArr('triggers', t)}
                    style={{ padding: '4px 9px', borderRadius: 99, border: `1.5px solid ${form.triggers.includes(t) ? 'var(--amber)' : 'var(--bd)'}`, background: form.triggers.includes(t) ? 'rgba(245,158,11,.15)' : 'var(--s2)', color: form.triggers.includes(t) ? 'var(--amber)' : 'var(--ink3)', fontSize: 10.5, cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Symptoms present</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {EPISODE_SYMPTOMS.map(s => (
                  <button key={s} onClick={() => toggleArr('symptoms_present', s)}
                    style={{ padding: '4px 9px', borderRadius: 99, border: `1.5px solid ${form.symptoms_present.includes(s) ? 'var(--pink)' : 'var(--bd)'}`, background: form.symptoms_present.includes(s) ? 'rgba(236,72,153,.15)' : 'var(--s2)', color: form.symptoms_present.includes(s) ? 'var(--pink)' : 'var(--ink3)', fontSize: 10.5, cursor: 'pointer' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">What helped</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {WHAT_HELPED.map(w => (
                  <button key={w} onClick={() => toggleArr('what_helped', w)}
                    style={{ padding: '4px 9px', borderRadius: 99, border: `1.5px solid ${form.what_helped.includes(w) ? 'var(--green)' : 'var(--bd)'}`, background: form.what_helped.includes(w) ? 'rgba(16,185,129,.15)' : 'var(--s2)', color: form.what_helped.includes(w) ? 'var(--green)' : 'var(--ink3)', fontSize: 10.5, cursor: 'pointer' }}>
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Recovery time (min)</label>
              <input type="number" className="input" placeholder="e.g. 15" value={form.recovery_minutes} onChange={e => setForm(f => ({ ...f, recovery_minutes: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="textarea" placeholder="What were you doing, how did it feel, anything unusual..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>

            <button className="btn btn-primary btn-full" onClick={submit}>Save Episode</button>
          </div>
        </div>
      )}
    </div>
  )
}
