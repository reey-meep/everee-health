import { useState } from 'react'
import { EPISODE_TYPES } from '../lib/constants'

export default function EpisodeDetail({ data, onBack, showToast }) {
  const type = EPISODE_TYPES.find(t => t.id === data?.episode_type) || {}
  
  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', paddingBottom: 40 }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--bd)', padding: '52px 16px 20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: type.color || 'var(--indigo)', marginBottom: 14, padding: 0, fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Episode detail</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.3px', marginBottom: 6 }}>{type.label || data?.episode_type}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>
          {data?.started_at ? new Date(data.started_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Unknown time'}
        </div>
      </div>
      
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Severity */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>Severity</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1,2,3,4,5].map(n => (
              <div key={n} style={{ flex: 1, height: 32, borderRadius: 8, background: n <= (data?.severity || 0) ? (type.color || 'var(--indigo)') : 'var(--bg)', border: `1.5px solid ${n <= (data?.severity || 0) ? (type.color || 'var(--indigo)') : 'var(--bd)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: n <= (data?.severity || 0) ? 'white' : 'var(--ink4)' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Duration + HR */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Duration</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 26, color: 'var(--ink)', fontWeight: 300 }}>{data?.duration_minutes ?? '--'}<span style={{ fontSize: 11, color: 'var(--ink3)' }}>m</span></div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>HR During</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 26, color: data?.heart_rate_during ? 'var(--red)' : 'var(--ink4)', fontWeight: 300 }}>{data?.heart_rate_during ?? '--'}<span style={{ fontSize: 11, color: 'var(--ink3)' }}>bpm</span></div>
          </div>
        </div>

        {/* Auto-captured context */}
        {(data?.cycle_phase_at_episode || data?.weather_pressure_at_episode) && (
          <div style={{ background: 'var(--indigo-l)', border: '1px solid #C5C6FF', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#2A2D8B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Context at time of episode</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {data?.cycle_phase_at_episode && <div><div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#2A2D8B' }}>{data.cycle_phase_at_episode.replace('_', ' ')}</div><div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: '#6B70C4' }}>cycle phase</div></div>}
              {data?.weather_pressure_at_episode && <div><div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#2A2D8B' }}>{data.weather_pressure_at_episode}hPa</div><div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: '#6B70C4' }}>pressure</div></div>}
            </div>
          </div>
        )}

        {/* Triggers */}
        {data?.triggers?.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Triggers</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {data.triggers.map(t => <span key={t} style={{ padding: '4px 10px', borderRadius: 99, background: 'var(--amber-l)', color: '#7A4500', border: '1px solid #FFD699', fontSize: 12, fontWeight: 600 }}>{t}</span>)}
            </div>
          </div>
        )}

        {/* Symptoms */}
        {data?.symptoms_present?.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Symptoms</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {data.symptoms_present.map(s => <span key={s} style={{ padding: '4px 10px', borderRadius: 99, background: 'var(--red-l)', color: '#8B0020', border: '1px solid #FFB3C0', fontSize: 12, fontWeight: 600 }}>{s}</span>)}
            </div>
          </div>
        )}

        {/* What helped */}
        {data?.what_helped?.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>What helped</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {data.what_helped.map(w => <span key={w} style={{ padding: '4px 10px', borderRadius: 99, background: 'var(--green-l)', color: '#004D38', border: '1px solid #9EEEDD', fontSize: 12, fontWeight: 600 }}>{w}</span>)}
            </div>
          </div>
        )}

        {/* Recovery */}
        {data?.recovery_minutes && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Recovery time</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, color: 'var(--green)', fontWeight: 300 }}>{data.recovery_minutes} <span style={{ fontSize: 11, color: 'var(--ink3)' }}>minutes</span></div>
          </div>
        )}
      </div>
    </div>
  )
}
