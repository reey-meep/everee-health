import RabbitPixel from './RabbitPixel'
import { getAdaptiveScore, moodFromScore, MOOD_MESSAGES, getBars } from '../lib/pet'
import { TASK_GROUPS } from '../lib/constants'

const BAR_COLORS = { body: 'var(--amber)', mind: 'var(--indigo)', joy: 'var(--pink)' }

function MiniBar({ label, value, color }) {
  const pct = Math.max(0, Math.min(value, 1))
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink3)' }}>{Math.round(pct * 100)}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 3, transition: 'width .3s' }} />
      </div>
    </div>
  )
}

export default function PetPanel({ actual, practices }) {
  const { score, target } = getAdaptiveScore(actual)
  // QA override: ?mood=0..5 forces a mood so all six states can be checked
  // without waiting for the day's data to move.
  const forced = new URLSearchParams(window.location.search).get('mood')
  const mood = forced !== null && forced !== '' ? Math.max(0, Math.min(5, Number(forced))) : moodFromScore(score)
  const bars = getBars(actual, TASK_GROUPS, practices)

  const behind = k => (actual[k] || 0) < (target[k] || 0) * 0.85

  return (
    <div className="card" style={{ padding: '16px 16px 14px', marginBottom: 10 }}>
      <RabbitPixel mood={mood} size={168} />

      <div style={{ textAlign: 'center', marginTop: 2, marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{MOOD_MESSAGES[mood]}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3 }}>
          {Math.round(actual.cal || 0)}/{Math.round(target.cal)} cal
          <span style={{ color: behind('cal') ? 'var(--amber)' : 'var(--ink4)' }}> · </span>
          {Math.round(actual.water || 0)}/{Math.round(target.water)} oz
          <span style={{ color: behind('water') ? 'var(--amber)' : 'var(--ink4)' }}> · </span>
          {Math.round(actual.steps || 0)}/{Math.round(target.steps)} steps
        </div>
        <div className="mono" style={{ fontSize: 9, color: 'var(--ink4)', marginTop: 2 }}>
          target for {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}, not end of day
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <MiniBar label="Body" value={bars.body} color={BAR_COLORS.body} />
        <MiniBar label="Mind" value={bars.mind} color={BAR_COLORS.mind} />
        <MiniBar label="Joy" value={bars.joy} color={BAR_COLORS.joy} />
      </div>

      {actual.bonusDone > 0 && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--green)', textAlign: 'center' }}>
          +{actual.bonusDone} bonus practices
        </div>
      )}
    </div>
  )
}
