import { useState, useEffect, useRef } from 'react'
import { fetchCurrentHeartRate, categorizeHeartRate, heartRateSignal, getAuthUrl, isConnected } from '../lib/google-health'
import { getHRTags, deleteHRTag } from '../lib/db'
import { HR_TAG_CATEGORIES } from '../lib/constants'
import HRTagModal from '../components/HRTagModal'

const PIN = '1234'

const SOLO_STEPS = [
  { title: 'Sit or stay down', body: 'Do not stand up. Sit on the floor, bed edge, or a chair. You cannot faint sitting down. Are you sitting or lying down right now?', yes: 'Good. Stay there. Move to breathing.', no: 'Sit down or lie down now before anything else. Take 30 seconds. Then come back.' },
  { title: 'Slow exhale breathing', body: 'Exhale as slowly and completely as you can. Let your body inhale on its own. Do this 5 times. Does it feel like it is slowing down even slightly?', yes: 'Keep breathing slowly and try the Valsalva next.', no: 'That is okay. Keep breathing slowly while you try the next step.' },
  { title: 'Valsalva maneuver', body: 'Take a breath in. Bear down firmly like a bowel movement. Hold 10-15 seconds. Then release completely. Repeat twice. Do you feel any change at all?', yes: 'Keep going. Repeat one more time and stay sitting.', no: 'That is okay. Try cold face next.' },
  { title: 'Cold water on face', body: 'Splash cold water on your face, submerge your face in a bowl of cold water for 20 seconds, or press a cold wet cloth hard against your face. Can you do this right now?', yes: 'Good. Do it now and come back. Does anything feel different?', no: 'Skip to drinking cold water instead.' },
  { title: 'Drink cold water', body: 'Drink a large glass of ice cold water quickly. Same diving reflex. Have you done this?', yes: 'Good. Wait 2 minutes. Any improvement at all, even slight?', no: 'Get cold water now if possible. If not, move to propranolol.' },
  { title: 'Propranolol', body: 'Is your next propranolol dose due or overdue? Or did you skip a dose recently?', yes: 'Take your propranolol now. It will take 15-20 minutes to work. Keep breathing slowly and stay sitting.', no: 'Not due yet. Keep doing slow exhale breathing. If it has been more than 30 minutes and nothing is improving, call 911.' },
  { title: 'Wait and breathe', body: 'You have done everything right. Now you wait. Slow exhale breathing. Feet on the floor. Eyes on one still point. Has it been more than 30 minutes since the episode started?', yes: 'Call 911 now if your heart is still racing hard and not coming down at all. If it has eased even slightly, keep waiting.', no: 'Keep waiting. The episode will resolve. You have gotten through every single one.' },
]

export default function Heart({ showToast }) {
  const [mode, setMode] = useState('solo')
  const [activeTab, setActiveTab] = useState('monitor')
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [liveHR, setLiveHR] = useState(null)
  const [signal, setSignal] = useState('unknown')
  const [rylieSignal, setRylieSignal] = useState(null)
  const [rylieHR, setRylieHR] = useState('')
  const [hrHistory, setHrHistory] = useState([])
  const [episodeActive, setEpisodeActive] = useState(false)
  const [soloStep, setSoloStep] = useState(0)
  const [soloTimer, setSoloTimer] = useState(0)
  const [soloResponse, setSoloResponse] = useState(null)
  const [connected, setConnected] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [tags, setTags] = useState([])
  const timerRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    setConnected(isConnected())
    loadTags()
    const interval = setInterval(() => {
      const stored = localStorage.getItem('heart_signal_v3')
      if (stored) {
        try { const d = JSON.parse(stored); if (d) setRylieSignal(d.signal) } catch {}
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (mode === 'rylie' && connected) {
      pollRef.current = setInterval(async () => {
        const hr = await fetchCurrentHeartRate()
        if (hr) {
          setLiveHR(hr)
          setSignal(categorizeHeartRate(hr))
          setHrHistory(h => [{ hr, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }, ...h].slice(0, 30))
        }
      }, 30000)
      return () => clearInterval(pollRef.current)
    }
  }, [mode, connected])

  async function loadTags() {
    const data = await getHRTags()
    setTags(data)
  }

  function enterRylieMode() {
    if (pinInput === PIN) { setMode('rylie'); setShowPinModal(false); setPinInput(''); setPinError(false) }
    else setPinError(true)
  }

  function sendSignal(sig) {
    localStorage.setItem('heart_signal_v3', JSON.stringify({ signal: sig, ts: Date.now() }))
    showToast(`Signal sent to Ree`)
  }

  function startEpisode() {
    setEpisodeActive(true); setSoloStep(0); setSoloTimer(0); setSoloResponse(null)
    timerRef.current = setInterval(() => setSoloTimer(t => t + 1), 1000)
  }

  function endEpisode() {
    setEpisodeActive(false); clearInterval(timerRef.current); setSoloTimer(0); setSoloStep(0); setSoloResponse(null)
  }

  function soloAnswer(yes) {
    setSoloResponse({ yes, msg: yes ? SOLO_STEPS[soloStep].yes : SOLO_STEPS[soloStep].no })
  }

  function nextStep() { setSoloResponse(null); setSoloStep(s => Math.min(s + 1, SOLO_STEPS.length - 1)) }
  function formatTimer(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

  const sigInfo = rylieSignal ? {
    safe: { label: 'Your heart rate is normal.', sub: 'You are okay. Rylie is watching. Keep breathing slowly.', color: 'var(--green)', bg: 'rgba(16,185,129,.1)', bd: 'rgba(16,185,129,.3)' },
    watch: { label: 'Coming down. Keep going.', sub: 'The maneuvers are working. Stay where you are.', color: 'var(--amber)', bg: 'rgba(245,158,11,.1)', bd: 'rgba(245,158,11,.3)' },
    act: { label: 'Rylie is calling for help.', sub: 'Stay exactly where you are. Keep breathing. You just breathe.', color: 'var(--red)', bg: 'rgba(239,68,68,.1)', bd: 'rgba(239,68,68,.3)' },
  }[rylieSignal] : null

  const catColor = signal !== 'unknown' ? heartRateSignal(categorizeHeartRate(liveHR))?.color : 'var(--ink2)'

  function tagCatInfo(id) { return HR_TAG_CATEGORIES.find(c => c.id === id) || {} }

  const RYLIE_TABS = ['monitor', 'tags', 'history']
  const RYLIE_TAB_LABELS = { monitor: 'Monitor', tags: 'Tags', history: 'HR History' }

  return (
    <div className="view">
      <div style={{ background: 'var(--bg)', borderBottom: 'var(--border)', padding: '52px 16px 20px', marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 4 }}>Heart monitor</div>
        <h1>Heart monitor</h1>
        <p>Your view is always safe. No numbers ever. Rylie's view has the full data.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={`btn ${mode === 'solo' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setMode('solo')}>My view</button>
        <button className={`btn ${mode === 'rylie' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => mode !== 'rylie' ? setShowPinModal(true) : setMode('solo')}>Rylie's view</button>
      </div>

      {/* SOLO MODE */}
      {mode === 'solo' && (
        <>
          {sigInfo ? (
            <div style={{ background: sigInfo.bg, border: `1.5px solid ${sigInfo.bd}`, borderRadius: 'var(--r)', padding: 20, textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontStyle: 'italic', color: sigInfo.color, marginBottom: 6 }}>{sigInfo.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.6 }}>{sigInfo.sub}</div>
            </div>
          ) : (
            <div className="card pulsing" style={{ textAlign: 'center', padding: 24, marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontStyle: 'italic', color: 'var(--ink2)', marginBottom: 5 }}>Waiting for Rylie's signal</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>Share the Rylie view with Rylie during an episode. You will never see the number.</div>
            </div>
          )}

          {/* TAG BUTTON -- always visible */}
          <button
            onClick={() => setShowTagModal(true)}
            style={{ width: '100%', marginBottom: 10, padding: '11px', borderRadius: 'var(--r)', border: '1.5px solid var(--bd)', background: 'var(--bg)', color: 'var(--ink2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <span style={{ fontSize: 16 }}>★</span> Tag this moment
          </button>

          {/* RECENT TAGS */}
          {tags.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-head"><span className="card-title" style={{ color: 'var(--sky)' }}>Recent tags</span></div>
              <div className="card-body">
                {tags.slice(-5).reverse().map(tag => {
                  const cat = tagCatInfo(tag.category)
                  return (
                    <div key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--s2)' }}>
                      <div>
                        <span style={{ fontSize: 13 }}>{cat.icon || '·'} {tag.label}</span>
                        {tag.heart_rate_at_tag && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginLeft: 8 }}>{tag.heart_rate_at_tag} bpm</span>}
                        {tag.notes && <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 2 }}>{tag.notes}</div>}
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink3)', flexShrink: 0, marginLeft: 8 }}>
                        {new Date(tag.tagged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* EPISODE BUTTON */}
          {!episodeActive ? (
            <button onClick={startEpisode} style={{ width: '100%', padding: 18, borderRadius: 'var(--r)', border: '1.5px solid var(--amber)', background: 'rgba(245,158,11,.1)', color: 'var(--amber)', fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', cursor: 'pointer', marginBottom: 12 }}>
              I am having an episode right now
            </button>
          ) : (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ textAlign: 'center', padding: '12px 14px 0' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 36, fontStyle: 'italic', color: soloTimer >= 1800 ? 'var(--red)' : soloTimer >= 900 ? 'var(--amber)' : 'var(--ink)' }}>{formatTimer(soloTimer)}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink3)', marginBottom: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  {soloTimer >= 1800 ? 'Call 911 if still at peak' : soloTimer >= 900 ? 'Check propranolol' : 'Episode timer'}
                </div>
              </div>
              <div className="card-body">
                {soloResponse ? (
                  <div>
                    <div style={{ background: soloResponse.yes ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)', border: `1.5px solid ${soloResponse.yes ? 'rgba(16,185,129,.3)' : 'rgba(245,158,11,.3)'}`, borderRadius: 8, padding: 12, fontSize: 12.5, color: soloResponse.yes ? '#A0D4BC' : '#D4B060', lineHeight: 1.6, marginBottom: 10 }}>
                      {soloResponse.msg}
                    </div>
                    {soloStep < SOLO_STEPS.length - 1
                      ? <button className="btn btn-secondary btn-full" onClick={nextStep}>Continue →</button>
                      : <button className="btn btn-primary btn-full" onClick={endEpisode}>I got through it</button>
                    }
                  </div>
                ) : (
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 7 }}>{SOLO_STEPS[soloStep]?.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 12 }}>{SOLO_STEPS[soloStep]?.body}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary" style={{ flex: 1, borderColor: 'var(--green)', color: 'var(--green)' }} onClick={() => soloAnswer(true)}>Yes</button>
                      <button className="btn btn-secondary" style={{ flex: 1, borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => soloAnswer(false)}>No</button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: '0 14px 12px' }}>
                <button className="btn btn-secondary btn-sm" onClick={endEpisode}>End episode</button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body" style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.75 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--red)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Call 911 if</div>
              Episode not resolving after 30 min · Actual fainting · Chest, jaw, or arm pain · Severe shortness of breath
            </div>
          </div>

          <div className="card">
            <div className="card-body" style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.75 }}>
              <strong style={{ color: 'var(--ink)' }}>Remember:</strong> SVT in a structurally normal heart is a benign arrhythmia. Not pleasant. Not dangerous to your heart muscle. You have gotten through every single episode. You will get through this one.
            </div>
          </div>
        </>
      )}

      {/* RYLIE MODE */}
      {mode === 'rylie' && (
        <>
          {/* RYLIE TABS */}
          <div style={{ display: 'flex', background: 'var(--bg)', border: 'var(--border)', borderRadius: 10, padding: 3, marginBottom: 12, gap: 3 }}>
            {RYLIE_TABS.map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                style={{ flex: 1, padding: '7px 4px', borderRadius: 7, border: 'none', background: activeTab === t ? 'var(--s2)' : 'none', color: activeTab === t ? 'var(--ink)' : 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 10.5, cursor: 'pointer' }}>
                {RYLIE_TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {activeTab === 'monitor' && (
            <>
              {connected ? (
                <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 12 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 72, fontWeight: 300, color: catColor, lineHeight: 1, marginBottom: 4 }}>{liveHR || '--'}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .6, marginBottom: 4 }}>beats per minute</div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>updates every 30 seconds from Fitbit</div>
                </div>
              ) : (
                <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 12 }}>Connect Google Health to see live Fitbit heart rate data.</div>
                  <button className="btn btn-primary" onClick={() => window.location.href = getAuthUrl()}>Connect Fitbit</button>
                </div>
              )}

              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-head"><span className="card-title" style={{ color: 'var(--sky)' }}>Manual HR entry</span></div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input type="number" className="input" placeholder="BPM from Fitbit" value={rylieHR} onChange={e => setRylieHR(e.target.value)} style={{ flex: 1 }} onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const hr = parseInt(rylieHR)
                        if (!hr) return
                        setLiveHR(hr); setSignal(categorizeHeartRate(hr))
                        setHrHistory(h => [{ hr, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }, ...h].slice(0, 30))
                        setRylieHR('')
                      }
                    }}/>
                    <button className="btn btn-secondary" onClick={() => {
                      const hr = parseInt(rylieHR); if (!hr) return
                      setLiveHR(hr); setSignal(categorizeHeartRate(hr))
                      setHrHistory(h => [{ hr, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }, ...h].slice(0, 30))
                      setRylieHR('')
                    }}>Log</button>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'var(--mono)', lineHeight: 1.6 }}>Under 100: normal · 100-150: elevated · Above 150 + 30 min: call 911</div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-head"><span className="card-title" style={{ color: 'var(--green)' }}>Send signal to Ree</span></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => sendSignal('safe')} style={{ padding: 12, borderRadius: 10, border: '1.5px solid var(--green)', background: 'rgba(16,185,129,.1)', color: 'var(--green)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Heart rate is normal</button>
                    <button onClick={() => sendSignal('watch')} style={{ padding: 12, borderRadius: 10, border: '1.5px solid var(--amber)', background: 'rgba(245,158,11,.1)', color: 'var(--amber)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Coming down</button>
                  </div>
                  <button onClick={() => sendSignal('act')} style={{ padding: 12, borderRadius: 10, border: '1.5px solid var(--red)', background: 'rgba(239,68,68,.1)', color: 'var(--red)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Episode not resolving -- calling for help</button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'tags' && (
            <>
              <button className="btn btn-primary btn-full" style={{ marginBottom: 12 }} onClick={() => setShowTagModal(true)}>
                ★ Tag this moment
              </button>
              <div className="card">
                <div className="card-head"><span className="card-title" style={{ color: 'var(--sky)' }}>All tags</span></div>
                <div className="card-body">
                  {tags.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 16, color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11 }}>No tags yet</div>
                  ) : (
                    [...tags].reverse().map(tag => {
                      const cat = tagCatInfo(tag.category)
                      return (
                        <div key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--s2)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontSize: 14 }}>{cat.icon}</span>
                              <span style={{ fontSize: 12.5, color: cat.color || 'var(--ink)' }}>{tag.label}</span>
                              {tag.heart_rate_at_tag && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', background: 'var(--s1)', padding: '1px 6px', borderRadius: 99 }}>{tag.heart_rate_at_tag} bpm</span>}
                            </div>
                            {tag.notes && <div style={{ fontSize: 11, color: 'var(--ink3)', marginLeft: 20 }}>{tag.notes}</div>}
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink3)', marginLeft: 20, marginTop: 2 }}>
                              {new Date(tag.tagged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                          <button onClick={async () => { await deleteHRTag(tag.id); loadTags() }}
                            style={{ background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 16, cursor: 'pointer', padding: '0 0 0 8px' }}>×</button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="card">
              <div className="card-head"><span className="card-title">Session readings</span></div>
              <div className="card-body">
                {hrHistory.length === 0
                  ? <div style={{ textAlign: 'center', padding: 16, color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11 }}>No readings this session</div>
                  : hrHistory.map((h, i) => {
                    const c = h.hr < 100 ? 'var(--green)' : h.hr < 150 ? 'var(--amber)' : 'var(--red)'
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--s2)', fontSize: 12 }}>
                        <span style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 10 }}>{h.time}</span>
                        <span style={{ color: c, fontWeight: 600, fontFamily: 'var(--mono)' }}>{h.hr} bpm</span>
                      </div>
                    )
                  })
                }
              </div>
            </div>
          )}
        </>
      )}

      {/* TAG MODAL */}
      {showTagModal && (
        <HRTagModal
          currentHR={liveHR}
          onClose={() => setShowTagModal(false)}
          onSaved={() => { loadTags(); showToast('Tag saved') }}
        />
      )}

      {/* PIN MODAL */}
      {showPinModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPinModal(false)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">Rylie's view</span>
              <button className="modal-close" onClick={() => setShowPinModal(false)}>×</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 14, lineHeight: 1.6 }}>Enter PIN to see live heart rate numbers. Ree never sees this view.</p>
            <div className="form-group">
              <input type="password" className="input" placeholder="PIN" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && enterRylieMode()} autoFocus />
              {pinError && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 5, fontFamily: 'var(--mono)' }}>Incorrect PIN</div>}
            </div>
            <button className="btn btn-primary btn-full" onClick={enterRylieMode}>Enter</button>
          </div>
        </div>
      )}
    </div>
  )
}
