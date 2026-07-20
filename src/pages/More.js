import PropranololAnalytics from '../components/PropranololAnalytics'
import { useState, useEffect } from 'react'
import { getSymptomTrend, getEpisodeTrend } from '../lib/db'
import { getCurrentPhase, PHASES } from '../lib/constants'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const PHASE_EXERCISES = {
  Foundation: {
    stretch: ['Supine spinal twist', 'Cat-cow', 'Child\'s pose arm reach', 'Supine hamstring stretch'],
    weights: ['Chin tucks', 'Isometric neck holds', 'Prone W raises', 'Glute bridges'],
    cardio: 'Walking only 10-20 minutes. Building pace gradually.',
  },
  Building: {
    stretch: ['All Phase 1 stretches', 'Doorframe chest opener', 'Seated hip flexor', 'Thread the needle'],
    weights: ['All Phase 1 exercises', 'Prone Y raises', 'Knee push-ups', 'Seated dumbbell curls', 'Seated overhead press'],
    cardio: 'Recumbent bike 8-15 min building. Alternating with walks.',
  },
  Consolidate: {
    stretch: ['All Phase 2 stretches', 'Standing quad stretch', 'Standing hip hinge', 'Thoracic extension'],
    weights: ['All Phase 2 exercises', 'Full push-ups', 'Tricep kickbacks', 'Lateral raises'],
    cardio: 'First slow jog 3-5 min if dizziness below 5 for 2 weeks.',
  },
  Integration: {
    stretch: ['Full routine', 'Add seated pigeon pose'],
    weights: ['Full standing routine integrating all previous'],
    cardio: 'Running 8-20 min building. Full integration phase.',
  },
}

const MEDICATIONS = [
  { name: 'Loratadine', dose: '10mg', schedule: 'morning' },
  { name: 'Famotidine', dose: '20mg', schedule: 'morning and evening' },
  { name: 'Propranolol', dose: '10mg', schedule: '3x daily on alarm', flag: true },
  { name: 'Prozac', dose: '15mg', schedule: 'morning' },
  { name: 'B2 Riboflavin', dose: '400mg', schedule: 'morning' },
  { name: 'Quercetin', dose: '250-500mg', schedule: '2x daily with food' },
  { name: 'Magnesium', dose: 'standard', schedule: 'morning' },
  { name: 'Probiotic', dose: 'standard', schedule: 'morning' },
  { name: 'D3', dose: 'standard', schedule: 'morning' },
  { name: 'D-mannose', dose: 'standard', schedule: 'morning' },
  { name: 'Iron + Vit C', dose: 'standard', schedule: 'every other day' },
  { name: 'DAO enzyme', dose: 'as needed', schedule: 'before histamine meals' },
  { name: 'Ox bile', dose: 'as needed', schedule: 'before fatty meals' },
  { name: 'Cromolyn sodium', dose: 'PENDING GP', schedule: 'before meals', pending: true },
  { name: 'Montelukast', dose: '10mg PENDING GP', schedule: 'nightly', pending: true },
]

export default function More({ showToast }) {
  const [activeSection, setActiveSection] = useState('plan')
  const [trendData, setTrendData] = useState([])
  const [episodeData, setEpisodeData] = useState([])

  const phase = getCurrentPhase()
  const exercises = PHASE_EXERCISES[phase.name] || PHASE_EXERCISES.Foundation

  useEffect(() => {
    if (activeSection === 'trends') {
      loadTrends()
    }
  }, [activeSection])

  async function loadTrends() {
    const [symptoms, episodes] = await Promise.all([
      getSymptomTrend(14),
      getEpisodeTrend(30)
    ])
    setTrendData(symptoms.map(d => ({
      date: d.date.slice(5),
      dizziness: d.dizziness_score,
      visual: d.visual_score,
      fatigue: d.fatigue_score,
      gut: d.gut_score,
      anxiety: d.anxiety_score,
    })))
    setEpisodeData(episodes)
  }

  const SECTIONS = ['plan', 'trends', 'propranolol', 'medications']
  const SECTION_LABELS = { plan: 'Wellness Plan', trends: 'Trends', propranolol: 'Propranolol', medications: 'Medications' }

  return (
    <div className="view">
      <div className="hero">
        <div className="eyebrow">everee health · More</div>
        <h1>More</h1>
        <p>Your wellness plan, symptom trends, and medication log.</p>
      </div>

      {/* SECTION TABS */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {SECTIONS.map(s => (
          <button key={s} onClick={() => setActiveSection(s)}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${activeSection === s ? 'var(--indigo)' : 'var(--bd)'}`, background: activeSection === s ? 'rgba(99,102,241,.15)' : 'var(--s1)', color: activeSection === s ? 'var(--indigo-l)' : 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '.04em', cursor: 'pointer' }}>
            {SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* WELLNESS PLAN */}
      {activeSection === 'plan' && (
        <>
          {/* PHASE BANNER */}
          <div className="card" style={{ borderColor: phase.color + '60' }}>
            <div className="card-body">
              <div className="eyebrow">Current phase</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 24, fontStyle: 'italic', color: phase.color, marginBottom: 4 }}>{phase.name}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>{phase.start} → {phase.end}</div>
            </div>
          </div>

          {/* PHASE OVERVIEW */}
          <div className="card">
            <div className="card-head"><span className="card-title" style={{ color: 'var(--indigo-l)' }}>All phases</span></div>
            <div className="card-body">
              {PHASES.map(p => {
                const isActive = p.name === phase.name
                return (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, flexShrink: 0, marginTop: 5 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12.5, color: isActive ? p.color : 'var(--ink2)', marginBottom: 1 }}>
                        {p.name} {isActive && '← now'}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{p.start} → {p.end}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* EXERCISE THIS PHASE */}
          <div className="card">
            <div className="card-head"><span className="card-title" style={{ color: 'var(--green)' }}>This phase's exercises</span></div>
            <div className="card-body">
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--sky)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Stretching (10 min)</div>
                {exercises.stretch.map(e => (
                  <div key={e} style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 3 }}>· {e}</div>
                ))}
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--pink)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Weights + cervical (10 min)</div>
                {exercises.weights.map(e => (
                  <div key={e} style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 3 }}>· {e}</div>
                ))}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--amber)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Cardio</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>{exercises.cardio}</div>
              </div>
            </div>
          </div>

          {/* DECEMBER GOALS */}
          <div className="card">
            <div className="card-head"><span className="card-title" style={{ color: 'var(--amber)' }}>December 31 goals</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {['Sprint 2 min with kids without cascade', 'Restaurant without aftermath calculation', 'Work bathroom without fear', 'Drive 45 min without health event'].map(g => (
                <div key={g} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.35 }}>
                  <span style={{ color: 'var(--amber)', flexShrink: 0 }}>→</span>
                  {g}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* TRENDS */}
      {activeSection === 'trends' && (
        <>
          {trendData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
              No trend data yet.<br/>Log daily symptoms in Today for 3+ days to see patterns.
            </div>
          ) : (
            <div className="card">
              <div className="card-head"><span className="card-title" style={{ color: 'var(--indigo-l)' }}>14-day symptom trend</span></div>
              <div className="card-body" style={{ overflowX: 'auto' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--s3)" />
                    <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'var(--ink3)' }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 8, fill: 'var(--ink3)' }} />
                    <Tooltip contentStyle={{ background: 'var(--s2)', border: 'var(--border)', borderRadius: 8, fontSize: 11 }} />
                    <Line type="monotone" dataKey="dizziness" stroke="#6366F1" dot={false} strokeWidth={1.5} name="Dizziness" />
                    <Line type="monotone" dataKey="fatigue" stroke="#EC4899" dot={false} strokeWidth={1.5} name="Fatigue" />
                    <Line type="monotone" dataKey="anxiety" stroke="#F59E0B" dot={false} strokeWidth={1.5} name="Anxiety" />
                    <Line type="monotone" dataKey="gut" stroke="#10B981" dot={false} strokeWidth={1.5} name="Gut" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {episodeData.length > 0 && (
            <div className="card">
              <div className="card-head"><span className="card-title" style={{ color: 'var(--red)' }}>Episodes last 30 days</span></div>
              <div className="card-body">
                <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontStyle: 'italic', color: 'var(--ink)' }}>{episodeData.length}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>total episodes</div>
                {['mcas','prebm','cardiac','vestibular','gut','esophageal','anxiety'].map(type => {
                  const count = episodeData.filter(e => e.episode_type === type).length
                  if (!count) return null
                  return (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--s2)', fontSize: 12 }}>
                      <span style={{ color: 'var(--ink2)', textTransform: 'capitalize' }}>{type.replace('prebm', 'Pre-BM presyncope')}</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink)' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', color: 'var(--ink3)', fontSize: 12, lineHeight: 1.7 }}>
              Correlation insights appear after 14+ days of data.<br/>Keep logging daily to unlock pattern detection.
            </div>
          </div>
        </>
      )}

      {activeSection === 'propranolol' && (
        <PropranololAnalytics showToast={showToast} />
      )}

      {/* MEDICATIONS */}
      {activeSection === 'medications' && (
        <>
          <div className="card">
            <div className="card-head"><span className="card-title" style={{ color: 'var(--red)' }}>⚠ Propranolol -- critical</span></div>
            <div className="card-body" style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.7 }}>
              3 doses daily on alarm. Never skip dose 3 before bed.<br/>
              Missing dose 3 was a contributing factor to the July 19 cardiac episode.<br/>
              If dose 3 is not logged by 7pm, a reminder will fire.
            </div>
          </div>

          {MEDICATIONS.map(med => (
            <div key={med.name} className="card" style={{ marginBottom: 6, padding: '10px 13px', borderColor: med.pending ? 'var(--bd)' : med.flag ? 'rgba(239,68,68,.3)' : 'var(--bd)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: med.pending ? 'var(--ink3)' : 'var(--ink)', marginBottom: 2 }}>
                    {med.name} {med.pending && <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--amber)', background: 'rgba(245,158,11,.15)', padding: '1px 6px', borderRadius: 99 }}>PENDING GP</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink3)' }}>{med.dose} · {med.schedule}</div>
                </div>
                {med.flag && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--red)', background: 'rgba(239,68,68,.15)', padding: '2px 7px', borderRadius: 99 }}>ALARM</span>}
              </div>
            </div>
          ))}

          <div className="card" style={{ marginTop: 8 }}>
            <div className="card-body" style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.7 }}>
              Medication adherence tracking coming in next update. For now use the checklist on the Today tab to log each dose.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
