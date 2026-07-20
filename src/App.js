import { useState } from 'react'
import Today from './pages/Today'
import Fitness from './pages/Fitness'
import Body from './pages/Body'
import More from './pages/More'
import MetricDetail from './pages/MetricDetail'
import EpisodeDetail from './pages/EpisodeDetail'
import Toast from './components/Toast'

// Tab icons
const ICONS = {
  today: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  fitness: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  body: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  more: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
}

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'body', label: 'Body' },
  { id: 'more', label: 'More' },
]

export default function App() {
  const [tab, setTab] = useState('today')
  const [detail, setDetail] = useState(null) // { type: 'metric'|'episode', data: {} }
  const [toast, setToast] = useState(null)

  const showToast = (msg, color) => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2500)
  }

  const openDetail = (type, data) => setDetail({ type, data })
  const closeDetail = () => setDetail(null)

  const p = { showToast, openDetail }

  const pages = {
    today: <Today {...p} />,
    fitness: <Fitness {...p} />,
    body: <Body {...p} />,
    more: <More {...p} />,
  }

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100svh', background: 'var(--bg)', position: 'relative' }}>
      {/* MAIN CONTENT */}
      <div key={tab} style={{ animation: 'fadeUp .18s ease-out' }}>
        {pages[tab]}
      </div>

      {/* DETAIL OVERLAY */}
      {detail && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'var(--bg)',
          animation: 'slideUp .22s cubic-bezier(.4,0,.2,1)',
          maxWidth: 430, margin: '0 auto',
        }}>
          {detail.type === 'metric' && <MetricDetail data={detail.data} onBack={closeDetail} />}
          {detail.type === 'episode' && <EpisodeDetail data={detail.data} onBack={closeDetail} showToast={showToast} />}
        </div>
      )}

      {/* TAB BAR */}
      {!detail && (
        <nav style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430,
          background: 'rgba(255,255,255,.92)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid var(--bd)',
          display: 'flex', alignItems: 'stretch',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 100,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '10px 0 8px',
                background: 'none', border: 'none',
                color: tab === t.id ? 'var(--indigo)' : 'var(--ink4)',
                cursor: 'pointer', transition: 'color .15s',
              }}>
              <div style={{
                width: 26, height: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
                  {t.id === 'today' && <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                  {t.id === 'fitness' && <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>}
                  {t.id === 'body' && <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>}
                  {t.id === 'more' && <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>}
                </svg>
              </div>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 600,
                letterSpacing: '.02em',
              }}>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {toast && <Toast message={toast.msg} color={toast.color} />}
    </div>
  )
}
