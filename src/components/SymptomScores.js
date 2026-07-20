import { SYMPTOMS } from '../lib/constants'

export default function SymptomScores({ scores, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {SYMPTOMS.map(sym => (
        <div key={sym.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 72, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: sym.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.2 }}>{sym.label}</span>
          </div>
          <div className="pip-row" style={{ flex: 1 }}>
            {sym.descriptors.map((desc, i) => {
              const val = i + 1
              const active = scores?.[sym.id] === val
              return (
                <button
                  key={val}
                  className={`pip ${active ? 'active' : ''}`}
                  style={active ? { background: sym.color } : {}}
                  onClick={() => onChange(sym.id, active ? null : val)}
                >
                  <span>{val}</span>
                  <span className="pip-desc">{desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
