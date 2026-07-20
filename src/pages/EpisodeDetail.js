import { EPISODE_TYPES } from '../lib/constants'

export default function EpisodeDetail({ data, onBack }) {
  const ep = data || {}
  const t = EPISODE_TYPES.find(x => x.id === ep.episode_type) || { label: ep.episode_type || 'Episode', color: '#F0468A' }

  function fmt(ts) {
    if (!ts) return 'Unknown time'
    return new Date(ts).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', paddingBottom: 40 }}>
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div className="eyebrow" style={{ color: t.color, marginBottom: 5 }}>Episode detail</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.3px', marginBottom: 5 }}>{t.label}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink3)' }}>{fmt(ep.started_at)}</div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Severity */}
        {ep.severity && (
          <div className="card" style={{ padding: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Severity</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1,2,3,4,5].map(n => (
                <div key={n} style={{ flex: 1, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: n <= ep.severity ? t.color : 'var(--bg)', border: `1.5px solid ${n <= ep.severity ? t.color : 'var(--bd)'}` }}>
                  <span className="mono" style={{ fontSize: 13, color: n <= ep.severity ? 'white' : 'var(--ink4)' }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Duration + HR */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Duration</div>
            <div className="mono" style={{ fontSize: 26, color: 'var(--ink)', fontWeight: 300 }}>{ep.duration_minutes ?? '--'}<span style={{ fontSize: 11, color: 'var(--ink3)' }}>m</span></div>
          </div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>HR during</div>
            <div className="mono" style={{ fontSize: 26, color: ep.heart_rate_during ? 'var(--red)' : 'var(--ink4)', fontWeight: 300 }}>{ep.heart_rate_during ?? '--'}<span style={{ fontSize: 11, color: 'var(--ink3)' }}>bpm</span></div>
          </div>
        </div>

        {/* Auto-captured context */}
        {(ep.cycle_phase_at_episode || ep.weather_pressure_at_episode) && (
          <div className="card" style={{ padding: '12px 14px', background: '#EEF0FF', borderColor: '#C5C6FF' }}>
            <div className="eyebrow" style={{ color: '#2A2D8B', marginBottom: 8 }}>Auto-captured context</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {ep.cycle_phase_at_episode && <div><div className="mono" style={{ fontSize: 11, color: '#2A2D8B' }}>{ep.cycle_phase_at_episode.replace('_', ' ')}</div><div className="mono" style={{ fontSize: 8, color: '#6B70C4' }}>cycle phase</div></div>}
              {ep.weather_pressure_at_episode && <div><div className="mono" style={{ fontSize: 11, color: '#2A2D8B' }}>{ep.weather_pressure_at_episode} hPa</div><div className="mono" style={{ fontSize: 8, color: '#6B70C4' }}>pressure</div></div>}
            </div>
          </div>
        )}

        {/* Triggers */}
        {ep.triggers?.length > 0 && (
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Triggers</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ep.triggers.map(tr => <span key={tr} style={{ padding: '4px 10px', borderRadius: 99, background: '#FFF8ED', color: '#854F0B', border: '1px solid #FAC775', fontSize: 12, fontWeight: 600 }}>{tr}</span>)}
            </div>
          </div>
        )}

        {/* Symptoms */}
        {ep.symptoms_present?.length > 0 && (
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Symptoms</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ep.symptoms_present.map(s => <span key={s} style={{ padding: '4px 10px', borderRadius: 99, background: '#FFF0F3', color: '#8B0020', border: '1px solid #FFB3C0', fontSize: 12, fontWeight: 600 }}>{s}</span>)}
            </div>
          </div>
        )}

        {/* What helped */}
        {ep.what_helped?.length > 0 && (
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>What helped</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ep.what_helped.map(w => <span key={w} style={{ padding: '4px 10px', borderRadius: 99, background: '#E1F5EE', color: '#0F6E56', border: '1px solid #5DCAA5', fontSize: 12, fontWeight: 600 }}>{w}</span>)}
            </div>
          </div>
        )}

        {/* Recovery */}
        {ep.recovery_minutes && (
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Recovery time</div>
            <div className="mono" style={{ fontSize: 22, color: 'var(--green)', fontWeight: 300 }}>{ep.recovery_minutes}<span style={{ fontSize: 11, color: 'var(--ink3)' }}> min</span></div>
          </div>
        )}
      </div>
    </div>
  )
}
