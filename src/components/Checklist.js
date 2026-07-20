import { TASK_GROUPS } from '../lib/constants'
import { useState } from 'react'

export default function Checklist({ completed, onToggle }) {
  const [expanded, setExpanded] = useState({ medications: true, vestibular: false, movement: false, food: false, vagal: false, sleep: false, wellness: false, tracking: false })

  const total = TASK_GROUPS.flatMap(g => g.tasks).length
  const done = TASK_GROUPS.flatMap(g => g.tasks).filter(t => completed[t.id]).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          {done} of {total} completed
        </span>
        <div style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
          {Math.round((done / total) * 100)}%
        </div>
      </div>
      {TASK_GROUPS.map(group => (
        <div key={group.id} style={{ marginBottom: 8 }}>
          <button
            onClick={() => setExpanded(e => ({ ...e, [group.id]: !e[group.id] }))}
            style={{
              width: '100%', background: 'var(--s2)', border: 'var(--border)',
              borderRadius: 8, padding: '7px 11px', color: 'var(--ink2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 11, fontWeight: 600, letterSpacing: '.04em', marginBottom: expanded[group.id] ? 4 : 0
            }}
          >
            <span>{group.label}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>
              {group.tasks.filter(t => completed[t.id]).length}/{group.tasks.length} {expanded[group.id] ? '▲' : '▼'}
            </span>
          </button>
          {expanded[group.id] && (
            <div style={{ paddingLeft: 4 }}>
              {group.tasks.map(task => (
                <div
                  key={task.id}
                  className={`check-item ${completed[task.id] ? 'done' : ''}`}
                  onClick={() => onToggle(task.id, !completed[task.id])}
                >
                  <div className="chk">
                    {completed[task.id] && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="ci-text">{task.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
