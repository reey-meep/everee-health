import { useState } from 'react'
import Today from './pages/Today'
import Episodes from './pages/Episodes'
import Heart from './pages/Heart'
import Food from './pages/Food'
import Analytics from './pages/Analytics'
import More from './pages/More'
import Toast from './components/Toast'

const TABS = [
  { id: 'today', label: 'Today', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
  { id: 'episodes', label: 'Episodes', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
  { id: 'heart', label: 'Heart', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  { id: 'food', label: 'Food', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> },
  { id: 'analytics', label: 'Insights', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id: 'more', label: 'More', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg> },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('today')
  const [toast, setToast] = useState(null)

  const showToast = (msg, color) => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2500)
  }

  const pageProps = { showToast }

  const pages = {
    today: <Today {...pageProps} />,
    episodes: <Episodes {...pageProps} />,
    heart: <Heart {...pageProps} />,
    food: <Food {...pageProps} />,
    analytics: <Analytics {...pageProps} />,
    more: <More {...pageProps} />,
  }

  return (
    <>
      <div>{pages[activeTab]}</div>
      <nav className="bottom-nav">
        {TABS.map(tab => (
          <button key={tab.id} className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
      {toast && <Toast message={toast.msg} color={toast.color} />}
    </>
  )
}
