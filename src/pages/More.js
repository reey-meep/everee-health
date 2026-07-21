import { runAllAnalytics } from '../lib/analytics'
import { useState, useEffect } from 'react'
import {
  getAuthUrl, isConnected, clearToken,
  fetchDaySnapshot, getDebugLog, clearDebugLog,
} from '../lib/google-health'
import { pushSupported, permission, getSubscription, enablePush, disablePush, sendTestNotification } from '../lib/push'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function More({ showToast, openMetric }) {
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(isConnected())
  const [syncing, setSyncing] = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  const [showDebug, setShowDebug] = useState(false)
  const [log, setLog] = useState([])
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushNote, setPushNote] = useState('')

  useEffect(() => {
    getSubscription().then(sub => setPushOn(!!sub)).catch(() => {})
  }, [])

  async function togglePush() {
    setPushBusy(true); setPushNote('')
    const res = pushOn ? await disablePush() : await enablePush()
    if (res.ok) {
      setPushOn(!pushOn)
      showToast(pushOn ? 'Reminders off' : 'Reminders on', pushOn ? undefined : 'var(--green)')
    } else {
      setPushNote(res.reason || 'Could not change notification settings.')
      showToast('Not changed', 'var(--red)')
    }
    setPushBusy(false)
  }

  async function testPush() {
    const res = await sendTestNotification()
    if (!res.ok) { setPushNote(res.reason); showToast('Test failed', 'var(--red)') }
  }

  useEffect(() => {
    runAllAnalytics().then(r => {
      setInsights(r?.insights?.slice(0, 4) || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Runs a real snapshot and shows exactly what came back, so a failure is
  // visible as a status code rather than an empty screen.
  async function syncNow() {
    setSyncing(true)
    clearDebugLog()
    try {
      const s = await fetchDaySnapshot(todayKey())
      setSnapshot(s)
      const got = Object.entries(s).filter(([k, v]) => v != null && k !== 'hr_points').length
      showToast(got ? `Synced — ${got} metrics` : 'Connected, but no data returned', got ? 'var(--green)' : 'var(--amber)')
    } catch (e) {
      showToast('Sync failed', 'var(--red)')
    }
    setLog(getDebugLog())
    setShowDebug(true)
    setSyncing(false)
  }

  function disconnect() {
    clearToken()
    setConnected(false)
    setSnapshot(null)
    showToast('Disconnected')
  }

  return (
    <div className="screen active">
      <div className="header" style={{ paddingBottom: 16 }}>
        <div className="page-title">More</div>
      </div>
      <div className="body">
        <div className="section-label">Top insights {!loading && `(${insights.length} found)`}</div>
        {loading && <div className="mono" style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', padding: 20 }}>Running analysis...</div>}
        {!loading && insights.length === 0 && (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.65 }}>Log symptom scores daily for at least 5 days to start seeing correlations. The more you log, the more patterns emerge.</div>
          </div>
        )}
        {insights.map((card, i) => (
          <div key={i} className="insight-card" style={{ borderColor: card.color + '40', marginBottom: 8 }}>
            <div className="mono" style={{ fontSize: 8.5, color: card.color, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 5 }}>
              {card.color === 'var(--green)' ? '↓ Helps' : '↑ Raises'} · {card.impact} pt impact · n={card.n}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.3 }}>{card.headline}</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.55 }}>{card.body}</div>
          </div>
        ))}

        {/* ── REMINDERS ────────────────────────────────────── */}
        <div className="section-label" style={{ marginTop: 4 }}>Reminders</div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: pushOn ? 'var(--green)' : 'var(--ink4)' }} />
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{pushOn ? 'Scheduled reminders on' : 'Scheduled reminders off'}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.55, marginBottom: 12 }}>
            {pushSupported()
              ? 'Prompts fire at their scheduled time with Done and Skip buttons, so you can log without opening the app.'
              : 'This browser does not support push notifications.'}
          </div>

          <div style={{
            fontSize: 11.5, lineHeight: 1.5, color: '#7A4500', background: 'var(--amber-xl)',
            border: '1px solid var(--amber)', borderRadius: 8, padding: '8px 10px', marginBottom: 12,
          }}>
            Web push is best-effort — Android battery saver can delay or drop it.
            Keep a phone alarm for the 17:30 propranolol dose.
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button disabled={pushBusy || !pushSupported()} onClick={togglePush} style={{
              minHeight: 44, padding: '0 16px', borderRadius: 10, border: pushOn ? '1.5px solid var(--bd)' : 'none',
              background: pushOn ? 'var(--bg)' : 'var(--indigo)', color: pushOn ? 'var(--ink2)' : '#fff',
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: pushBusy ? .6 : 1,
            }}>
              {pushBusy ? '…' : pushOn ? 'Turn off' : 'Turn on reminders'}
            </button>
            {pushOn && (
              <button onClick={testPush} style={{
                minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1.5px solid var(--bd)',
                background: 'var(--bg)', color: 'var(--ink2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              }}>Send test</button>
            )}
          </div>

          {pushNote && (
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 10, lineHeight: 1.5 }}>{pushNote}</div>
          )}
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink4)', marginTop: 8 }}>
            permission: {permission()}
          </div>
        </div>

        {/* ── FITBIT / GOOGLE HEALTH ───────────────────────── */}
        <div className="section-label" style={{ marginTop: 4 }}>Fitbit</div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: connected ? 'var(--green)' : 'var(--ink4)' }} />
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{connected ? 'Connected' : 'Not connected'}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.55, marginBottom: 12 }}>
            {connected
              ? 'Pull today’s steps, sleep, resting HR, HRV and SpO2 from Google Health.'
              : 'Link your Google account to pull steps, sleep, resting HR, HRV and SpO2 automatically.'}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!connected && (
              <button
                onClick={() => { window.location.href = getAuthUrl() }}
                style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--indigo)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                Connect Fitbit
              </button>
            )}
            {connected && (
              <>
                <button
                  onClick={syncNow} disabled={syncing}
                  style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--indigo)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: syncing ? .6 : 1 }}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </button>
                <button
                  onClick={disconnect}
                  style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1.5px solid var(--bd)', background: 'var(--bg)', color: 'var(--ink2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                  Disconnect
                </button>
              </>
            )}
          </div>

          {snapshot && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Today&rsquo;s values</div>
              {Object.entries(snapshot)
                .filter(([k]) => k !== 'hr_points' && k !== 'sleep_stages')
                .map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                    <span style={{ color: 'var(--ink3)' }}>{k}</span>
                    <span className="mono" style={{ color: v == null ? 'var(--ink4)' : 'var(--ink)' }}>{v == null ? '—' : String(v)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* ── DEBUG ────────────────────────────────────────── */}
        {log.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 4 }}>
              API debug
              <a onClick={() => setShowDebug(v => !v)} style={{ cursor: 'pointer' }}>{showDebug ? 'Hide' : 'Show'}</a>
            </div>
            {showDebug && (
              <div className="card" style={{ padding: 12 }}>
                {log.map((e, i) => (
                  <div key={i} style={{ borderBottom: i < log.length - 1 ? '1px solid var(--bd)' : 'none', padding: '6px 0' }}>
                    <div className="mono" style={{ fontSize: 9.5, color: e.ok ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {e.method} {e.status || 'ERR'} {e.ok ? 'OK' : 'FAIL'}
                    </div>
                    <div className="mono" style={{ fontSize: 9, color: 'var(--ink3)', wordBreak: 'break-all', marginTop: 2 }}>{e.path}</div>
                    {e.error && <div className="mono" style={{ fontSize: 9, color: 'var(--red)', marginTop: 3, wordBreak: 'break-word' }}>{e.error}</div>}
                    {e.sample && <div className="mono" style={{ fontSize: 8.5, color: 'var(--ink2)', marginTop: 3, wordBreak: 'break-all' }}>{e.sample}</div>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── NOT YET BUILT ────────────────────────────────── */}
        <div className="section-label" style={{ marginTop: 4 }}>Not yet built</div>
        <div className="card">
          {[
            { label: 'Heart monitor', sub: 'Rylie mode + HR tracking' },
            { label: 'Medications', sub: 'View your full medication list' },
            { label: 'Wellness plan', sub: 'Foundation phase protocol' },
            { label: 'Analytics', sub: 'Full correlation dashboard' },
          ].map((item, i, arr) => (
            <div key={item.label} className="row" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--bd)' : 'none', opacity: .5 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{item.label}</div>
                {item.sub && <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>{item.sub}</div>}
              </div>
              <span className="mono" style={{ fontSize: 9, color: 'var(--ink4)' }}>SOON</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
