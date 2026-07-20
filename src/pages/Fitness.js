import { useState, useEffect } from 'react'
import { getEpisodes, createEpisode, getDailyLog } from '../lib/db'
import { EPISODE_TYPES } from '../lib/constants'
import { avgHRInWindow } from '../lib/google-health'

// Local calendar date, not UTC. Recomputed per call so a PWA left open
// past midnight rolls over instead of writing to yesterday's key.
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const TRIGGERS = ['Gluten','Citric acid','Chocolate','Banana','High fat meal','Late propranolol','Emotional stress','Exercise','Sudden waking','Standing too fast','Gas pressure','Period','Luteal phase','Poor sleep','Unknown']
const HELPED = ['Famotidine','Propranolol','Valsalva','Cold face','Ginger','Havening','Breathing','Rylie','Rest horizontal','DAO enzyme','Time']
const SX = ['Flushing','Heart racing','Nausea','Dizziness','Visual disturbance','Exhaustion wave','Presyncope','Panic','Gut cramping','Throat clearing','Chest flutter','Headache','Facial pain']

export default function Fitness({ showToast, openEpisode }) {
  const [episodes, setEpisodes] = useState([])
  const [sheet, setSheet] = useState(false)
  const [form, setForm] = useState({ episode_type: '', severity: null, started_at: new Date().toISOString().slice(0, 16), duration_minutes: '', triggers: [], symptoms_present: [], what_helped: [], recovery_minutes: '' })

  useEffect(() => { load() }, [])
  async function load() { setEpisodes(await getEpisodes(30)) }
  function tog(f, v) { setForm(x => ({ ...x, [f]: x[f].includes(v) ? x[f].filter(a => a !== v) : [...x[f], v] })) }

  async function submit() {
    if (!form.episode_type || !form.severity) { showToast('Select type and severity', 'var(--amber)'); return }
    const tl = await getDailyLog(todayKey())
    const startMs = new Date(form.started_at).getTime()
    const hr = await avgHRInWindow(startMs, startMs + 30 * 60000).catch(() => null)
    try {
      await createEpisode({ ...form, started_at: new Date(form.started_at).toISOString(), duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null, recovery_minutes: form.recovery_minutes ? parseInt(form.recovery_minutes) : null, cycle_phase_at_episode: tl?.cycle_phase || null, weather_pressure_at_episode: tl?.weather_pressure || null, heart_rate_during: hr })
    } catch {
      // Episode details are hard to reconstruct after the fact — keep the form.
      showToast('Not saved — episode not logged', 'var(--red)')
      return
    }
    showToast('Episode logged'); setSheet(false)
    setForm({ episode_type: '', severity: null, started_at: new Date().toISOString().slice(0, 16), duration_minutes: '', triggers: [], symptoms_present: [], what_helped: [], recovery_minutes: '' })
    load()
  }

  const fmt = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const typeCounts = EPISODE_TYPES.map(t => ({ ...t, count: episodes.filter(e => e.episode_type === t.id).length })).filter(t => t.count > 0)

  return (
    <div className="screen active">
      <div className="header" style={{ paddingBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Fitness</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="page-title">Episodes</div>
          <button className="btn-black" style={{ width: 'auto', padding: '9px 14px' }} onClick={() => setSheet(true)}>+ Log</button>
        </div>
      </div>

      <div className="body">
        {/* Summary card */}
        <div className="card" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Last 30 days</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: episodes.length ? 14 : 0 }}>
            <div><div className="mono" style={{ fontSize: 44, fontWeight: 300, color: 'var(--red)', lineHeight: 1, letterSpacing: '-.04em' }}>{episodes.length}</div><div className="mono" style={{ fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase' }}>episodes</div></div>
            {episodes.filter(e => e.severity).length > 0 && (
              <div style={{ borderLeft: '1px solid var(--bd)', paddingLeft: 14 }}>
                <div className="mono" style={{ fontSize: 22, fontWeight: 300, color: 'var(--amber)' }}>
                  {(episodes.filter(e => e.severity).reduce((s, e) => s + e.severity, 0) / episodes.filter(e => e.severity).length).toFixed(1)}
                </div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase' }}>avg severity</div>
              </div>
            )}
          </div>
          {typeCounts.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', width: 100 }}>{t.label}</div>
              <div style={{ flex: 1, height: 4, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(t.count / episodes.length) * 100}%`, background: t.color, borderRadius: 99 }} />
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink3)', width: 14, textAlign: 'right' }}>{t.count}</div>
            </div>
          ))}
        </div>

        {/* Pre-BM protocol */}
        <div className="section-label">Pre-BM presyncope protocol</div>
        <div className="card">
          {['Sit immediately at exhaustion wave', 'Feet hard into floor · tense legs · hand on belly', 'Slow nasal breathing -- inhale 4, exhale 6-8', 'Walk only when wave eases', 'After BM: sit 2 min · havening · ginger chew'].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 14px', borderBottom: i < 4 ? '1px solid var(--bd)' : 'none', alignItems: 'flex-start' }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--amber)', flexShrink: 0, paddingTop: 1, fontWeight: 700 }}>0{i + 1}</span>
              <span style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.45 }}>{s}</span>
            </div>
          ))}
        </div>

        {/* History */}
        <div className="section-label">History</div>
        {episodes.length === 0
          ? <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11 }}>No episodes logged yet</div>
          : episodes.map(ep => {
            const t = EPISODE_TYPES.find(x => x.id === ep.episode_type) || { color: 'var(--pink)', label: ep.episode_type }
            return (
              <div key={ep.id} onClick={() => openEpisode(ep)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 14, cursor: 'pointer', marginBottom: 6 }}>
                <div style={{ width: 4, height: 40, borderRadius: 99, background: t.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{t.label}</div>
                  <div className="mono" style={{ fontSize: 9, color: 'var(--ink3)' }}>
                    {fmt(ep.started_at)}{ep.severity && ` · ${ep.severity}/5`}{ep.duration_minutes && ` · ${ep.duration_minutes}m`}{ep.heart_rate_during && ` · HR ${ep.heart_rate_during}bpm`}
                  </div>
                  {ep.triggers?.length > 0 && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{ep.triggers.slice(0, 2).join(', ')}</div>}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            )
          })
        }
      </div>

      {/* Log sheet */}
      {sheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setSheet(false)}>
            <div className="sheet">
              <div className="sheet-handle" />
              <div className="sheet-title">Log episode</div>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Type</label>
                <div className="chip-row">{EPISODE_TYPES.map(t => <button key={t.id} className={`chip${form.episode_type === t.id ? ' on' : ''}`} style={form.episode_type === t.id ? { background: t.color, borderColor: t.color } : {}} onClick={() => setForm(f => ({ ...f, episode_type: f.episode_type === t.id ? '' : t.id }))}>{t.label}</button>)}</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Severity</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setForm(f => ({ ...f, severity: f.severity === n ? null : n }))} style={{ flex: 1, padding: '12px', borderRadius: 10, border: `1.5px solid ${form.severity === n ? 'var(--ink)' : 'var(--bd)'}`, background: form.severity === n ? 'var(--ink)' : 'var(--bg)', color: form.severity === n ? 'white' : 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 18, cursor: 'pointer' }}>{n}</button>)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div><label className="form-label">Started</label><input type="datetime-local" className="input" value={form.started_at} onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))}/></div>
                <div><label className="form-label">Duration (min)</label><input type="number" className="input" placeholder="25" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}/></div>
              </div>
              {[{ f: 'triggers', label: 'Triggers', opts: TRIGGERS, color: 'var(--amber)' }, { f: 'symptoms_present', label: 'Symptoms', opts: SX, color: 'var(--pink)' }, { f: 'what_helped', label: 'What helped', opts: HELPED, color: 'var(--green)' }].map(row => (
                <div key={row.f} style={{ marginBottom: 14 }}>
                  <label className="form-label">{row.label}</label>
                  <div className="chip-row">{row.opts.map(o => <button key={o} className={`chip${form[row.f].includes(o) ? ' on' : ''}`} style={form[row.f].includes(o) ? { background: row.color, borderColor: row.color } : {}} onClick={() => tog(row.f, o)}>{o}</button>)}</div>
                </div>
              ))}
              <div style={{ marginBottom: 20 }}><label className="form-label">Recovery (min)</label><input type="number" className="input" placeholder="15" value={form.recovery_minutes} onChange={e => setForm(f => ({ ...f, recovery_minutes: e.target.value }))}/></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setSheet(false)}>Cancel</button>
                <button className="btn-black" style={{ flex: 2 }} onClick={submit}>Save episode</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
