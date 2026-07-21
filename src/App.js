import { useState, useEffect, useRef } from 'react'
import Today from './pages/Today'
import Fitness from './pages/Fitness'
import Body from './pages/Body'
import More from './pages/More'
import MetricDetail from './pages/MetricDetail'
import EpisodeDetail from './pages/EpisodeDetail'
import ScheduleDetail from './pages/ScheduleDetail'
import Heart from './pages/Heart'
import Toast from './components/Toast'
import { handleAuthRedirect } from './lib/google-health'
import { getDailyLog, getScheduleSettings, getFoodEntries, getPracticeLogs } from './lib/db'
import { shiftSchedule, deriveScheduleStatus } from './lib/constants'

const TABS = [
  { id: 'today', label: 'Today', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { id: 'fitness', label: 'Episodes', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id: 'body', label: 'Food', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  { id: 'more', label: 'More', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
]

export default function App() {
  const [tab, setTab] = useState('today')
  const [detail, setDetail] = useState(null) // { type: 'metric'|'episode', data }
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // Consume #access_token=... when Google redirects back after consent.
  // Without this the token was dropped and the app reported "not connected" forever.
  useEffect(() => {
    if (handleAuthRedirect()) showToast('Fitbit connected', 'var(--green)')
  }, [])

  function showToast(msg, color) {
    // Clear any pending timer so a second toast isn't cut short by the first.
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, color, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  const todayKey = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const [schedState, setSchedState] = useState({ practices: {}, mealCount: 0, scoreCount: 0, totals: { calories: 0, water: 0 }, wake: '07:30' })

  async function loadSchedule() {
    const [l, st, foods, practiceRows] = await Promise.all([
      getDailyLog(todayKey()),
      getScheduleSettings().catch(() => null),
      getFoodEntries(todayKey()),
      getPracticeLogs(todayKey()),
    ])
    const practices = {}
    practiceRows.forEach(r => { practices[r.practice_id] = r.completed })
    setSchedState({
      practices,
      mealCount: foods.length,
      scoreCount: Object.values(l?.scores || {}).filter(Boolean).length,
      totals: {
        calories: foods.reduce((sum, f) => sum + (f.calories || 0), 0),
        water: Number(l?.water_oz || 0),
      },
      wake: st?.wake_time || '07:30',
    })
  }

  async function openSchedule() {
    await loadSchedule()
    setDetail({ type: 'schedule' })
  }

  function openHeart() { setDetail({ type: 'heart' }) }
  function openMetric(data) { setDetail({ type: 'metric', data }) }
  function openEpisode(data) { setDetail({ type: 'episode', data }) }
  function closeDetail() { setDetail(null) }

  const pageProps = { showToast, openMetric, openEpisode, openSchedule, openHeart }

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
          {detail.type === 'heart' && (
            <div style={{ minHeight: '100svh' }}>
              <div className="detail-header">
                <button className="back-btn" onClick={closeDetail}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                  Back
                </button>
              </div>
              <Heart showToast={showToast} />
            </div>
          )}
          {detail.type === 'schedule' && (
            <ScheduleDetail
              schedule={shiftSchedule(schedState.wake)}
              statuses={deriveScheduleStatus(shiftSchedule(schedState.wake), {
                practices: schedState.practices,
                mealCount: schedState.mealCount,
                waterOz: schedState.totals.water,
                scoreCount: schedState.scoreCount,
              })}
              totals={schedState.totals}
              onBack={closeDetail}
            />
          )}
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

      {toast && <Toast key={toast.id} message={toast.msg} color={toast.color} />}
    </>
  )
}
