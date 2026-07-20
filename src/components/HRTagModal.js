import { useState } from 'react'
import { createHRTag } from '../lib/db'
import { HR_TAG_CATEGORIES } from '../lib/constants'

export default function HRTagModal({ onClose, onSaved, currentHR }) {
  const [form, setForm] = useState({
    category: '',
    label: '',
    tagged_at: new Date().toISOString().slice(0, 16),
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!form.category) return
    setSaving(true)
    await createHRTag({
      ...form,
      tagged_at: new Date(form.tagged_at).toISOString(),
      heart_rate_at_tag: currentHR || null,
      label: form.label || HR_TAG_CATEGORIES.find(c => c.id === form.category)?.label || form.category,
    })
    setSaving(false)
    onSaved?.()
    onClose()
  }

  const selected = HR_TAG_CATEGORIES.find(c => c.id === form.category)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <span className="modal-title">Tag this moment</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {currentHR && (
          <div style={{ background: 'var(--s2)', border: 'var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink2)' }}>
            Current heart rate: <strong style={{ color: 'var(--ink)' }}>{currentHR} bpm</strong> will be attached to this tag
          </div>
        )}

        <div className="form-group">
          <label className="form-label">What is happening?</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {HR_TAG_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setForm(f => ({ ...f, category: cat.id }))}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1.5px solid ${form.category === cat.id ? cat.color : 'var(--bd)'}`,
                  background: form.category === cat.id ? cat.color + '20' : 'var(--s2)',
                  color: form.category === cat.id ? cat.color : 'var(--ink3)',
                  fontSize: 11.5,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Custom label (optional)</label>
          <input
            type="text"
            className="input"
            placeholder={selected ? `e.g. ${selected.label} -- add detail` : 'Describe what happened'}
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Time</label>
          <input
            type="datetime-local"
            className="input"
            value={form.tagged_at}
            onChange={e => setForm(f => ({ ...f, tagged_at: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <textarea
            className="textarea"
            rows={2}
            placeholder="Any additional context..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <button
          className="btn btn-primary btn-full"
          onClick={submit}
          disabled={!form.category || saving}
          style={{ opacity: !form.category ? .5 : 1 }}
        >
          {saving ? 'Saving...' : 'Save tag'}
        </button>
      </div>
    </div>
  )
}
