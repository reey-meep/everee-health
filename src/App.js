import { useState } from 'react'
import Today from './pages/Today'
import Fitness from './pages/Fitness'
import Body from './pages/Body'
import More from './pages/More'
import MetricDetail from './pages/MetricDetail'
import EpisodeDetail from './pages/EpisodeDetail'
import Toast from './components/Toast'

const TABS = [
  { id: 'today', label: 'Today', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { id: 'fitness', label: 'Fitness', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id: 'body', label: 'Body', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  { id: 'more', label: 'More', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
]

export default function App() {
  const [tab, setTab] = useState('today')
  const [detail, setDetail] = useState(null) // { type: 'metric'|'episode', data }
  const [toast, setToast] = useState(null)

  function showToast(msg, color) {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2500)
  }

  function openMetric(data) { setDetail({ type: 'metric', data }) }
  function openEpisode(data) { setDetail({ type: 'episode', data }) }
  function closeDetail() { setDetail(null) }

  const pageProps = { showToast, openMetric, openEpisode }

  return (
    <>
      {/* MAIN TABS */}
      <div key={tab} className="fade-up">
        {tab === 'today' && <Today {...pageProps} />}
        {tab === 'fitness' && <Fitness {...pageProps} />}
        {tab === 'body' && <Body {...pageProps} />}
        {tab === 'more' && <More {...pageProps} />}
      </div>

      {/* DETAIL OVERLAY */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg)', overflowY: 'auto' }} className="slide-up">
          {detail.type === 'metric' && <MetricDetail data={detail.data} onBack={closeDetail} />}
          {detail.type === 'episode' && <EpisodeDetail data={detail.data} onBack={closeDetail} showToast={showToast} />}
        </div>
      )}

      {/* TAB BAR -- hide when detail open */}
      {!detail && (
        <nav className="tab-bar">
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {toast && <Toast message={toast.msg} color={toast.color} />}
    </>
  )
}
