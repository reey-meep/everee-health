import { useState, useEffect } from 'react'
import { runAllAnalytics, computeTrends } from '../lib/analytics'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

const SYMPTOM_COLORS = { dizziness: '#6366F1', visual: '#38BDF8', fatigue: '#EC4899', gut: '#10B981', anxiety: '#F59E0B', symptom_avg: '#9898B8' }
const PHASE_LABELS = { menstrual: 'Menstrual', follicular: 'Follicular', ovulation: 'Ovulation', luteal_early: 'Luteal early', luteal_late: 'Luteal late', pms: 'PMS' }

function InsightCard({ card }) {
  const isGood = card.color === 'var(--green)'
  return (
    <div className="card" style={{ marginBottom: 8, borderColor: card.color + '40' }}>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: card.color, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {isGood ? '↓ Helps' : '↑ Raises'} · {card.impact} pt impact · n={card.n}
          </div>
          {card.lag > 0 && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', background: 'var(--s2)', padding: '1px 6px', borderRadius: 99 }}>next-day effect</div>
          )}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 5 }}>{card.headline}</div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.65 }}>{card.body}</div>
      </div>
    </div>
  )
}

function TrendBadge({ direction }) {
  const map = { improving: { label: 'Improving', color: 'var(--green)' }, worsening: { label: 'Worsening', color: 'var(--red)' }, stable: { label: 'Stable', color: 'var(--ink3)' } }
  const t = map[direction] || map.stable
  return <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: t.color, background: t.color + '20', padding: '2px 7px', borderRadius: 99 }}>{t.label}</span>
}

export default function Analytics({ showToast }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [trends, setTrends] = useState(null)
  const [activeSection, setActiveSection] = useState('overview')
  const [insightFilter, setInsightFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await runAllAnalytics()
      setResult(r)
      setTrends(computeTrends(r.dataset))
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="view">
      <div className="hero">
        <div className="eyebrow">everee health · Analytics</div>
        <h1>Running analysis</h1>
        <p>Correlating all your data across every dimension. This takes a moment.</p>
      </div>
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
        Analysing {['medications','sleep','vestibular','food','cycle','environment','movement'].map((t, i) => (
          <span key={t} style={{ opacity: .4 + i * .08 }}>{t} · </span>
        ))}
      </div>
    </div>
  )

  if (!result?.dataQuality?.sufficient) return (
    <div className="view">
      <div className="hero">
        <div className="eyebrow">everee health · Analytics</div>
        <h1>Building your picture</h1>
        <p>Analytics need at least 5 days of symptom scores to find patterns.</p>
      </div>
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'italic', color: 'var(--indigo-l)', marginBottom: 4 }}>{result?.dataQuality?.days_with_scores || 0}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 12 }}>days with symptom scores</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.7 }}>
            Log your symptom scores in Today each day. After {Math.max(0, 5 - (result?.dataQuality?.days_with_scores || 0))} more days the correlation engine will start surfacing patterns.
          </div>
        </div>
      </div>
    </div>
  )

  const { insights, practiceRankings, cycleInsights, foodInsights, streakInsights, episodePatterns, dataset } = result
  const chartData = dataset.filter(d => d.symptom_avg !== null).slice(-30)

  const SECTIONS = ['overview', 'insights', 'practices', 'cycle', 'food', 'episodes']
  const SECTION_LABELS = { overview: 'Overview', insights: 'Correlations', practices: 'Practices', cycle: 'Cycle', food: 'Food', episodes: 'Episodes' }

  const filteredInsights = insightFilter === 'all' ? insights
    : insightFilter === 'helps' ? insights.filter(c => c.color === 'var(--green)')
    : insightFilter === 'raises' ? insights.filter(c => c.color !== 'var(--green)')
    : insights.filter(c => c.outputKey === insightFilter)

  return (
    <div className="view">
      <div className="hero">
        <div className="eyebrow">everee health · Analytics</div>
        <h1>Your patterns</h1>
        <p>
          {result.dataQuality.days} days · {result.dataQuality.days_with_scores} scored · {insights.length} correlations found
        </p>
      </div>

      {/* SECTION TABS */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: 5, marginBottom: 12, paddingBottom: 2 }}>
        {SECTIONS.map(s => (
          <button key={s} onClick={() => setActiveSection(s)}
            style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${activeSection === s ? 'var(--indigo)' : 'var(--bd)'}`, background: activeSection === s ? 'rgba(99,102,241,.15)' : 'var(--s1)', color: activeSection === s ? 'var(--indigo-l)' : 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 10.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeSection === 'overview' && (
        <>
          {/* TREND SUMMARY */}
          {trends && (
            <div className="card">
              <div className="card-head"><span className="card-title" style={{ color: 'var(--indigo-l)' }}>Last 14 days vs prior 14</span></div>
              <div className="card-body">
                {Object.entries(trends).filter(([k]) => k !== 'episodes').map(([metric, t]) => (
                  <div key={metric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--s2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: SYMPTOM_COLORS[metric] || 'var(--ink3)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, textTransform: 'capitalize' }}>{metric.replace('_avg', ' overall').replace('_', ' ')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>{t.prior_avg} → {t.recent_avg}</span>
                      <TrendBadge direction={t.direction} />
                    </div>
                  </div>
                ))}
                {trends.episodes && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
                    <span style={{ fontSize: 12.5 }}>Episodes</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>{trends.episodes.prior_total} → {trends.episodes.recent_total}</span>
                      <TrendBadge direction={trends.episodes.direction} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SYMPTOM CHART */}
          {chartData.length > 0 && (
            <div className="card">
              <div className="card-head"><span className="card-title" style={{ color: 'var(--ink2)' }}>30-day symptom trend</span></div>
              <div className="card-body" style={{ paddingLeft: 0, paddingRight: 4 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--s3)" />
                    <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 7, fill: 'var(--ink3)' }} />
                    <YAxis domain={[1, 5]} tick={{ fontSize: 7, fill: 'var(--ink3)' }} width={16} />
                    <Tooltip contentStyle={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, fontSize: 11 }} />
                    {['dizziness','fatigue','gut','anxiety'].map(k => (
                      <Line key={k} type="monotone" dataKey={k} stroke={SYMPTOM_COLORS[k]} dot={false} strokeWidth={1.5} name={k} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TOP INSIGHTS PREVIEW */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="eyebrow" style={{ margin: 0 }}>Top correlations found</div>
            <button onClick={() => setActiveSection('insights')} style={{ background: 'none', border: 'none', color: 'var(--indigo-l)', fontFamily: 'var(--mono)', fontSize: 10, cursor: 'pointer' }}>See all {insights.length} →</button>
          </div>
          {insights.slice(0, 4).map((card, i) => <InsightCard key={i} card={card} />)}
        </>
      )}

      {/* ALL CORRELATIONS */}
      {activeSection === 'insights' && (
        <>
          <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
            {['all','helps','raises','dizziness','fatigue','gut','anxiety','episode_count'].map(f => (
              <button key={f} onClick={() => setInsightFilter(f)}
                style={{ padding: '5px 10px', borderRadius: 99, border: `1.5px solid ${insightFilter === f ? 'var(--indigo)' : 'var(--bd)'}`, background: insightFilter === f ? 'rgba(99,102,241,.15)' : 'var(--s1)', color: insightFilter === f ? 'var(--indigo-l)' : 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 9.5, cursor: 'pointer' }}>
                {f === 'all' ? `All (${insights.length})` : f === 'helps' ? '↓ Helps' : f === 'raises' ? '↑ Raises' : f.replace('_count', '').replace('_', ' ')}
              </button>
            ))}
          </div>
          {filteredInsights.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11 }}>No correlations in this filter yet</div>
          ) : (
            filteredInsights.map((card, i) => <InsightCard key={i} card={card} />)
          )}
        </>
      )}

      {/* PRACTICE RANKINGS */}
      {activeSection === 'practices' && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-head"><span className="card-title" style={{ color: 'var(--green)' }}>What's actually helping most</span></div>
            <div className="card-body">
              {practiceRankings.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink3)', textAlign: 'center', padding: 16 }}>Need more data to rank practices</div>
              ) : (
                practiceRankings.map((r, i) => (
                  <div key={r.inputKey} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < practiceRankings.length - 1 ? '1px solid var(--s2)' : 'none' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)', width: 18, flexShrink: 0 }}>#{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--ink)', marginBottom: 2 }}>{r.practice}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>done: {r.avg_done} · missed: {r.avg_missed} avg symptoms · n={r.n}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>-{Math.abs(r.impact).toFixed(1)}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 7.5, color: 'var(--ink3)' }}>pts lower</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {streakInsights.length > 0 && (
            <div className="card">
              <div className="card-head"><span className="card-title" style={{ color: 'var(--sky)' }}>Streak effects</span></div>
              <div className="card-body">
                {streakInsights.map((s, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: i < streakInsights.length - 1 ? '1px solid var(--s2)' : 'none' }}>
                    <div style={{ fontSize: 12.5, color: 'var(--ink)', marginBottom: 3 }}>
                      Consistent {s.practice.replace('_', ' ')} streaks
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>
                      Streak days avg: {s.streak_avg} · Other days: {s.non_streak_avg} · Difference: {Math.abs(s.diff).toFixed(1)} pts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* CYCLE ANALYSIS */}
      {activeSection === 'cycle' && (
        <>
          {cycleInsights.length === 0 ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--ink3)' }}>
                Need more data across multiple cycle phases to surface cycle correlations. Keep logging your cycle day each day.
              </div>
            </div>
          ) : (
            cycleInsights.map((ci, idx) => (
              <div key={idx} className="card" style={{ marginBottom: 10 }}>
                <div className="card-head">
                  <span className="card-title" style={{ color: 'var(--pink-l)' }}>{ci.outputKey.replace('_', ' ')} by cycle phase</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{ci.range.toFixed(1)} pt range</span>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={Object.entries(ci.phases).map(([phase, val]) => ({ phase: PHASE_LABELS[phase] || phase, avg: val.avg, n: val.n }))} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
                      <XAxis dataKey="phase" tick={{ fontSize: 7, fill: 'var(--ink3)' }} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 7, fill: 'var(--ink3)' }} />
                      <Tooltip contentStyle={{ background: 'var(--s2)', border: '1px solid var(--bd)', fontSize: 10 }} />
                      <Bar dataKey="avg" radius={[3, 3, 0, 0]}>
                        {Object.entries(ci.phases).map(([phase], i) => (
                          <Cell key={i} fill={['luteal_late','pms'].includes(phase) ? '#EF4444' : '#6366F1'} fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 11.5, color: 'var(--ink2)', lineHeight: 1.6, marginTop: 6 }}>
                    Worst phase: <strong style={{ color: 'var(--red)' }}>{PHASE_LABELS[ci.worst_phase]}</strong> (avg {ci.phases[ci.worst_phase]?.avg}) ·
                    Best phase: <strong style={{ color: 'var(--green)' }}>{PHASE_LABELS[ci.best_phase]}</strong> (avg {ci.phases[ci.best_phase]?.avg})
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* FOOD ANALYSIS */}
      {activeSection === 'food' && (
        <>
          {foodInsights.length === 0 ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--ink3)' }}>
                Need more food logging data to find trigger patterns. Log meals consistently for 2+ weeks.
              </div>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 10 }}>
                <div className="card-head"><span className="card-title" style={{ color: 'var(--amber)' }}>Trigger food impact on symptoms</span></div>
                <div className="card-body">
                  {foodInsights.slice(0, 8).map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < Math.min(foodInsights.length, 8) - 1 ? '1px solid var(--s2)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--ink)' }}>{f.food}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>with: {f.avg_with} · without: {f.avg_without} avg symptoms · n={f.n}</div>
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: f.diff > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700, flexShrink: 0, marginLeft: 10 }}>
                        {f.diff > 0 ? '+' : ''}{f.diff.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calorie impact */}
              <div className="card">
                <div className="card-head"><span className="card-title" style={{ color: 'var(--amber)' }}>Calorie intake vs symptoms</span></div>
                <div className="card-body">
                  {insights.filter(c => c.inputKey.includes('calorie') || c.inputKey.includes('under_1')).map((card, i) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--s2)', fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
                      {card.body}
                    </div>
                  ))}
                  {!insights.some(c => c.inputKey.includes('calorie')) && (
                    <div style={{ fontSize: 12, color: 'var(--ink3)' }}>Need more data to correlate calories with symptoms.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* EPISODE PATTERNS */}
      {activeSection === 'episodes' && episodePatterns && (
        <>
          <div className="card">
            <div className="card-head"><span className="card-title" style={{ color: 'var(--red)' }}>Episode risk factors</span></div>
            <div className="card-body">
              {[
                { label: 'High-risk cycle phase', with: episodePatterns.high_risk_cycle_episode_rate, without: episodePatterns.normal_cycle_episode_rate, unit: 'episode rate' },
                { label: 'Sleep under 7h', with: episodePatterns.low_sleep_episode_rate, without: episodePatterns.good_sleep_episode_rate, unit: 'episode rate' },
                { label: 'Trigger food consumed', with: episodePatterns.trigger_food_episode_rate, without: episodePatterns.clean_food_episode_rate, unit: 'episode rate' },
                { label: 'Missed evening propranolol', with: episodePatterns.missed_prop3_episode_rate, without: episodePatterns.took_prop3_episode_rate, unit: 'episode rate' },
              ].map((row, i) => {
                const riskIncrease = row.with - row.without
                const pct = Math.round(row.with * 100)
                const pctWithout = Math.round(row.without * 100)
                if (isNaN(pct) || isNaN(pctWithout)) return null
                return (
                  <div key={i} style={{ padding: '9px 0', borderBottom: i < 3 ? '1px solid var(--s2)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                      <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{row.label}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: riskIncrease > 0.05 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                        {riskIncrease > 0 ? '+' : ''}{Math.round(riskIncrease * 100)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>
                      <span>With: {pct}% of days have episodes</span>
                      <span>Without: {pctWithout}%</span>
                    </div>
                  </div>
                )
              }).filter(Boolean)}
            </div>
          </div>

          {episodePatterns.most_common_type && (
            <div className="card">
              <div className="card-body">
                <div className="eyebrow" style={{ marginBottom: 6 }}>Most common episode type</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontStyle: 'italic', color: 'var(--ink)' }}>
                  {episodePatterns.most_common_type.replace('prebm', 'Pre-BM presyncope').replace('mcas', 'MCAS reaction')}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* DATA QUALITY NOTE */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textAlign: 'center', padding: '8px 0', lineHeight: 1.7 }}>
        {result.dataQuality.days} days logged · {result.dataQuality.days_with_scores} scored ·
        Correlations require {5} data points per group · More data = stronger signal
      </div>
    </div>
  )
}
