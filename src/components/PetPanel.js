import { useState } from 'react'
import RabbitPixel from './RabbitPixel'
import { getAdaptiveScore, stateFromScore, PET_STATES, getBars, BODY_GROUPS, MIND_GROUPS } from '../lib/pet'
import { TASK_GROUPS } from '../lib/constants'

const BARS = [
  {
    key: 'body', label: 'Body', color: 'var(--amber)',
    what: 'Food, water and steps against where they should be by this hour, plus vestibular drills and medications.',
  },
  {
    key: 'mind', label: 'Mind', color: 'var(--indigo)',
    what: 'Everything else — movement, gut care, vagal practices, sleep routine and wellness.',
  },
]

function groupCounts(groupIds, practices) {
  const tasks = TASK_GROUPS.filter(g => groupIds.includes(g.id)).flatMap(g => g.tasks)
  return { done: tasks.filter(t => practices[t.id]).length, total: tasks.length }
}

export default function PetPanel({ actual, practices }) {
  const [explain, setExplain] = useState(null)
  const { score, target } = getAdaptiveScore(actual)

  // QA override: ?state=0..3 forces a state without waiting for the day to move.
  const forced = new URLSearchParams(window.location.search).get('state')
  const state = forced !== null && forced !== ''
    ? Math.max(0, Math.min(3, Number(forced)))
    : stateFromScore(score)

  const meta = PET_STATES[state]
  const bars = getBars(actual, TASK_GROUPS, practices)

  const detail = {
    body: (() => {
      const c = groupCounts(BODY_GROUPS, practices)
      return `${Math.round(actual.cal || 0)}/${Math.round(target.cal)} cal · ${Math.round(actual.water || 0)}/${Math.round(target.water)} oz · ${Math.round(actual.steps || 0)}/${Math.round(target.steps)} steps · ${c.done}/${c.total} practices`
    })(),
    mind: (() => { const c = groupCounts(MIND_GROUPS, practices); return `${c.done} of ${c.total} practices done` })(),
  }

  return (
    <div className="card" style={{ padding: '16px 16px 14px', marginBottom: 10 }}>
      <RabbitPixel state={state} size={168} />

      <div style={{ textAlign: 'center', marginTop: 4, marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{meta.message}</div>
        <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink4)', marginTop: 4, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          {meta.label} · {meta.hint}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {BARS.map(b => {
          const pct = Math.max(0, Math.min(bars[b.key], 1))
          const open = explain === b.key
          return (
            <div key={b.key} style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExplain(open ? null : b.key)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span className="eyebrow" style={{ color: open ? b.color : undefined }}>{b.label}</span>
                <span className="mono" style={{ fontSize: 9.5, color: open ? b.color : 'var(--ink3)' }}>
                  {Math.round(pct * 100)}%
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct * 100}%`, background: b.color, borderRadius: 3, transition: 'width .3s' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* What feeds each bar was opaque -- tapping one now explains it. */}
      {explain ? (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.55 }}>
            {BARS.find(b => b.key === explain).what}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 5 }}>{detail[explain]}</div>
        </div>
      ) : (
        <div className="mono" style={{ fontSize: 9, color: 'var(--ink4)', marginTop: 10, textAlign: 'center' }}>
          tap a bar to see what feeds it
        </div>
      )}

      {actual.bonusDone > 0 && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--green)', textAlign: 'center', marginTop: 8 }}>
          +{actual.bonusDone} bonus practices
        </div>
      )}
    </div>
  )
}
