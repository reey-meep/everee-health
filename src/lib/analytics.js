/**
 * everee health -- Analytics and Correlation Engine
 * 
 * Architecture:
 * 1. buildDataset()    -- assembles every day's full data record
 * 2. correlate()       -- finds meaningful input/output relationships
 * 3. runAllAnalytics() -- runs all analyses and returns structured insights
 */

import { supabase } from './supabase'

const USER_ID = '1e133101-10e9-468a-ab81-d9b76a20e8ed'
const MIN_POINTS = 5 // minimum data points to surface a correlation card

// ── DATASET ASSEMBLY ──────────────────────────────────────────────────────────
// Pulls all tables and assembles one record per day with every known variable

export async function buildDataset(days = 60) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  // Local calendar date -- toISOString() is UTC and rolls over early evening,
  // shifting the whole window by a day.
  const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`

  // practice_logs runs ~55 rows/day, so 60 days exceeds a single PostgREST page.
  // Silent truncation would drop the oldest weeks from every correlation.
  async function fetchAllPractices() {
    const PAGE = 1000
    let all = [], from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('practice_logs').select('*')
        .eq('user_id', USER_ID).gte('date', sinceStr)
        .order('date').range(from, from + PAGE - 1)
      if (error) { console.error(error); break }
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    return { data: all }
  }

  const [logsRes, practicesRes, episodesRes, foodRes] = await Promise.all([
    supabase.from('daily_logs').select('*').eq('user_id', USER_ID).gte('date', sinceStr).order('date'),
    fetchAllPractices(),
    supabase.from('episodes').select('*').eq('user_id', USER_ID).gte('started_at', since.toISOString()),
    supabase.from('food_entries').select('*').eq('user_id', USER_ID).gte('date', sinceStr),
  ])

  const logs = logsRes.data || []
  const practices = practicesRes.data || []
  const episodes = episodesRes.data || []
  const food = foodRes.data || []

  // Index by date for fast lookup
  const practicesByDate = {}
  practices.forEach(p => {
    if (!practicesByDate[p.date]) practicesByDate[p.date] = {}
    practicesByDate[p.date][p.practice_id] = p.completed
  })

  const episodesByDate = {}
  episodes.forEach(ep => {
    const date = ep.started_at.split('T')[0]
    if (!episodesByDate[date]) episodesByDate[date] = []
    episodesByDate[date].push(ep)
  })

  const foodByDate = {}
  food.forEach(f => {
    if (!foodByDate[f.date]) foodByDate[f.date] = []
    foodByDate[f.date].push(f)
  })

  // Build one record per day
  const dataset = logs.map(log => {
    const date = log.date
    const p = practicesByDate[date] || {}
    // No practice rows at all = the app was never opened that day. Emit null so
    // the correlation guards drop the day, rather than false which would score
    // it as a deliberate skip.
    const logged = Object.keys(p).length > 0
    const pv = k => (logged ? !!p[k] : null)
    const pcount = keys => (logged ? keys.filter(k => p[k]).length : null)
    const eps = episodesByDate[date] || []
    const dayFood = foodByDate[date] || []

    // Medication adherence
    const meds = {
      loratadine: pv('loratadine'),
      famotidine_am: pv('famo_am'),
      famotidine_pm: pv('famo_pm'),
      propranolol_all3: logged ? !!(p.prop1 && p.prop2 && p.prop3) : null,
      propranolol_dose3: pv('prop3'),
      quercetin_both: logged ? !!(p.quercetin_am && p.quercetin_pm) : null,
      antihistamine_complete: logged ? !!(p.loratadine && p.famo_am && p.famo_pm) : null,
    }

    // Vestibular sessions
    const vestSessions = pcount(['vest1', 'vest2', 'vest3', 'vest4', 'vest5'])

    // Vagal practices
    const vagalCount = pcount(['breath_am', 'gargle', 'hum', 'breath_pm', 'cold_face', 'red_light'])

    // Movement
    const movement = {
      walk: pv('walk'),
      stretch: pv('stretch'),
      weights: pv('weights'),
      taichi: pv('taichi'),
      walk_minutes: log.walk_minutes || 0,
    }

    // Sleep hygiene
    const sleepHygiene = pcount(['screens_off', 'mouth_tape', 'window', 'bed_time'])

    // Food
    const totalCals = dayFood.reduce((s, f) => s + (f.calories || 0), 0)
    const totalProtein = dayFood.reduce((s, f) => s + (f.protein_grams || 0), 0)
    const hasTriggerFood = dayFood.some(f => f.flagged_triggers?.length > 0)
    const daoUsed = dayFood.some(f => f.dao_taken)
    const oxBileUsed = dayFood.some(f => f.oxbile_taken)
    const triggerFoods = [...new Set(dayFood.flatMap(f => f.flagged_triggers || []))]

    // Episodes
    const episodeCount = eps.length
    const maxSeverity = eps.length ? Math.max(...eps.map(e => e.severity || 0)) : 0
    const episodeTypes = [...new Set(eps.map(e => e.episode_type))]
    const avgRecovery = eps.filter(e => e.recovery_minutes).length
      ? eps.filter(e => e.recovery_minutes).reduce((s, e) => s + e.recovery_minutes, 0) / eps.filter(e => e.recovery_minutes).length
      : null

    // Symptom scores (from log.scores JSONB)
    const scores = log.scores || {}

    // Practice completion rate
    const allPracticeIds = ['loratadine','famo_am','famo_pm','b2','quercetin_am','quercetin_pm','b12','d3','dmannose','probiotic','iron','prozac','prop1','prop2','prop3','vest1','vest2','vest3','vest4','vest5','taichi','barefoot','singleleg','walk','stretch','weights','coffee_after','nuun','eve_tea','breath_am','gargle','hum','breath_pm','cold_face','red_light','screens_off','mouth_tape','window','bed_time','journal','puzzle','photo','bed','texted','masturbate','cell_song','incense','shower','cycle','food_log','episode_log','packet']
    const completedCount = allPracticeIds.filter(id => p[id]).length
    const completionRate = Math.round((completedCount / allPracticeIds.length) * 100)

    return {
      date,
      // Symptom outputs (what we're trying to understand)
      dizziness: scores.dizziness || null,
      visual: scores.visual || null,
      fatigue: scores.fatigue || null,
      gut: scores.gut || null,
      anxiety: scores.anxiety || null,
      mood: log.mood_score || null,
      symptom_avg: scores.dizziness ? Object.values(scores).filter(Boolean).reduce((a,b) => a+b, 0) / Object.values(scores).filter(Boolean).length : null,

      // Episode outputs
      episode_count: episodeCount,
      max_severity: maxSeverity,
      had_episode: episodeCount > 0,
      episode_types: episodeTypes,
      avg_recovery_minutes: avgRecovery,

      // Fitbit inputs
      sleep_hours: log.sleep_hours || null,
      resting_hr: log.resting_hr || null,
      hrv: log.hrv || null,
      spo2: log.spo2 || null,

      // Environmental inputs
      weather_pressure: log.weather_pressure || null,
      pressure_delta: null, // computed in post-processing

      // Cycle inputs
      cycle_phase: log.cycle_phase || null,
      cycle_day: log.cycle_day ? parseInt(log.cycle_day) : null,
      high_risk_cycle: ['luteal_late', 'pms'].includes(log.cycle_phase),

      // Medication inputs
      ...meds,

      // Practice inputs
      vest_sessions: vestSessions,
      vagal_count: vagalCount,
      ...movement,
      sleep_hygiene_score: sleepHygiene,
      completion_rate: completionRate,

      // Food inputs
      total_calories: totalCals,
      total_protein: totalProtein,
      has_trigger_food: hasTriggerFood,
      dao_used: daoUsed,
      ox_bile_used: oxBileUsed,
      trigger_foods: triggerFoods,
      under_1200_cal: totalCals > 0 && totalCals < 1200,
      under_1500_cal: totalCals > 0 && totalCals < 1500,
      hit_calorie_goal: totalCals >= 1500,
    }
  })

  // Compute pressure delta (today vs yesterday)
  for (let i = 1; i < dataset.length; i++) {
    if (dataset[i].weather_pressure && dataset[i-1].weather_pressure) {
      dataset[i].pressure_delta = dataset[i].weather_pressure - dataset[i-1].weather_pressure
    }
  }

  return dataset
}

// ── CORRELATION ENGINE ────────────────────────────────────────────────────────
// For binary inputs: compare average output when input=true vs input=false
// For numeric inputs: split into low/high groups and compare
// Returns a correlation card if difference is meaningful and sample size is adequate

// Lag must be measured in CALENDAR days, not array positions. dataset only
// contains days that have a daily_logs row, so dataset[i - 1] is "the previous
// logged day" -- if a day is skipped, a 1-day lag silently becomes 2 or more.
function shiftDate(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + deltaDays)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function pairByDate(dataset, lagDays) {
  const byDate = new Map(dataset.map(d => [d.date, d]))
  const out = []
  dataset.forEach(output => {
    const input = lagDays === 0 ? output : byDate.get(shiftDate(output.date, -lagDays))
    if (input) out.push({ input, output })
  })
  return out
}

function binaryCorrelation(dataset, inputKey, outputKey, lagDays = 0) {
  const pairs = []
  pairByDate(dataset, lagDays).forEach(({ input, output }) => {
    if (input[inputKey] === null || input[inputKey] === undefined) return
    if (output[outputKey] === null || output[outputKey] === undefined) return
    pairs.push({ input: input[inputKey] ? 1 : 0, output: output[outputKey] })
  })

  const group1 = pairs.filter(p => p.input === 1).map(p => p.output) // practice done / true
  const group0 = pairs.filter(p => p.input === 0).map(p => p.output) // practice missed / false

  if (group1.length < MIN_POINTS || group0.length < MIN_POINTS) return null

  const avg1 = group1.reduce((a, b) => a + b, 0) / group1.length
  const avg0 = group0.reduce((a, b) => a + b, 0) / group0.length
  const diff = avg1 - avg0
  const absDiff = Math.abs(diff)

  // Require at least 0.3 point difference on a 1-5 scale to surface
  if (absDiff < 0.3) return null

  return {
    inputKey,
    outputKey,
    lagDays,
    avg_when_true: Math.round(avg1 * 10) / 10,
    avg_when_false: Math.round(avg0 * 10) / 10,
    difference: Math.round(diff * 10) / 10,
    n_true: group1.length,
    n_false: group0.length,
    direction: diff < 0 ? 'better_when_done' : 'worse_when_done', // for symptom scores lower = better
  }
}

function numericCorrelation(dataset, inputKey, outputKey, threshold, lagDays = 0) {
  const pairs = []
  pairByDate(dataset, lagDays).forEach(({ input, output }) => {
    if (input[inputKey] === null || input[inputKey] === undefined) return
    if (output[outputKey] === null || output[outputKey] === undefined) return
    pairs.push({ input: input[inputKey], output: output[outputKey] })
  })

  const high = pairs.filter(p => p.input >= threshold).map(p => p.output)
  const low = pairs.filter(p => p.input < threshold).map(p => p.output)

  if (high.length < MIN_POINTS || low.length < MIN_POINTS) return null

  const avgHigh = high.reduce((a, b) => a + b, 0) / high.length
  const avgLow = low.reduce((a, b) => a + b, 0) / low.length
  const diff = avgHigh - avgLow

  if (Math.abs(diff) < 0.3) return null

  return {
    inputKey,
    outputKey,
    threshold,
    lagDays,
    avg_above_threshold: Math.round(avgHigh * 10) / 10,
    avg_below_threshold: Math.round(avgLow * 10) / 10,
    difference: Math.round(diff * 10) / 10,
    n_above: high.length,
    n_below: low.length,
  }
}

function cyclePhaseCorrelation(dataset, outputKey) {
  const phases = ['menstrual', 'follicular', 'ovulation', 'luteal_early', 'luteal_late', 'pms']
  const results = {}
  phases.forEach(phase => {
    const days = dataset.filter(d => d.cycle_phase === phase && d[outputKey] !== null)
    if (days.length >= MIN_POINTS) {
      results[phase] = {
        avg: Math.round(days.reduce((s, d) => s + d[outputKey], 0) / days.length * 10) / 10,
        n: days.length,
      }
    }
  })
  if (Object.keys(results).length < 2) return null

  const avgs = Object.values(results).map(r => r.avg)
  const range = Math.max(...avgs) - Math.min(...avgs)
  if (range < 0.4) return null // not enough variation across phases

  const worst = Object.entries(results).sort((a, b) => b[1].avg - a[1].avg)[0]
  const best = Object.entries(results).sort((a, b) => a[1].avg - b[1].avg)[0]

  return { outputKey, phases: results, worst_phase: worst[0], best_phase: best[0], range }
}

function triggerFoodCorrelation(dataset, outputKey) {
  // Find which specific foods correlate with worse outcomes
  const allTriggers = [...new Set(dataset.flatMap(d => d.trigger_foods))]
  const results = []

  allTriggers.forEach(food => {
    const withFood = dataset.filter(d => d.trigger_foods.includes(food) && d[outputKey] !== null)
    const withoutFood = dataset.filter(d => !d.trigger_foods.includes(food) && d[outputKey] !== null)

    if (withFood.length < 3 || withoutFood.length < MIN_POINTS) return

    const avgWith = withFood.reduce((s, d) => s + d[outputKey], 0) / withFood.length
    const avgWithout = withoutFood.reduce((s, d) => s + d[outputKey], 0) / withoutFood.length
    const diff = avgWith - avgWithout

    if (Math.abs(diff) < 0.4) return
    results.push({ food, avg_with: Math.round(avgWith * 10) / 10, avg_without: Math.round(avgWithout * 10) / 10, diff: Math.round(diff * 10) / 10, n: withFood.length })
  })

  return results.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
}

function practiceStreakCorrelation(dataset) {
  // Find which 5+ day streaks of a practice correlate with improvement trends
  const STREAK_PRACTICES = ['vest_sessions', 'vagal_count', 'completion_rate']
  const results = []

  STREAK_PRACTICES.forEach(practice => {
    // Find periods of consistent high performance (>= 3 vestibular sessions, >= 4 vagal, >= 70% completion)
    const thresholds = { vest_sessions: 3, vagal_count: 4, completion_rate: 70 }
    const threshold = thresholds[practice]

    let streakDays = []
    let current = []

    dataset.forEach(d => {
      if (d[practice] !== null && d[practice] >= threshold) {
        current.push(d)
      } else {
        if (current.length >= 5) streakDays.push(...current)
        current = []
      }
    })
    if (current.length >= 5) streakDays.push(...current)

    const nonStreakDays = dataset.filter(d => !streakDays.includes(d) && d.symptom_avg !== null)
    const streakAvg = streakDays.filter(d => d.symptom_avg !== null).reduce((s, d) => s + d.symptom_avg, 0) / (streakDays.filter(d => d.symptom_avg !== null).length || 1)
    const nonStreakAvg = nonStreakDays.reduce((s, d) => s + d.symptom_avg, 0) / (nonStreakDays.length || 1)

    if (streakDays.filter(d => d.symptom_avg !== null).length >= MIN_POINTS && nonStreakDays.length >= MIN_POINTS) {
      const diff = streakAvg - nonStreakAvg
      if (Math.abs(diff) >= 0.3) {
        results.push({ practice, streak_avg: Math.round(streakAvg * 10) / 10, non_streak_avg: Math.round(nonStreakAvg * 10) / 10, diff: Math.round(diff * 10) / 10, streak_days: streakDays.length })
      }
    }
  })

  return results
}

// ── INSIGHT CARD BUILDER ──────────────────────────────────────────────────────

const SYMPTOM_LABELS = { dizziness: 'dizziness', visual: 'visual symptoms', fatigue: 'fatigue', gut: 'gut symptoms', anxiety: 'anxiety', symptom_avg: 'overall symptoms', episode_count: 'episode frequency', max_severity: 'episode severity' }
const INPUT_LABELS = {
  sleep_hours: 'sleep', hrv: 'HRV', resting_hr: 'resting heart rate', spo2: 'SpO2',
  vest_sessions: 'vestibular sessions', vagal_count: 'vagal practices', completion_rate: 'daily practice completion',
  total_calories: 'calorie intake', total_protein: 'protein intake',
  antihistamine_complete: 'full antihistamine stack (loratadine + famotidine x2)',
  propranolol_all3: 'all 3 propranolol doses', propranolol_dose3: 'evening propranolol dose',
  loratadine: 'loratadine', quercetin_both: 'quercetin both doses',
  has_trigger_food: 'trigger food exposure', dao_used: 'DAO enzyme', ox_bile_used: 'ox bile',
  walk: 'grounding walk', stretch: 'stretching', weights: 'weights and cervical exercises',
  taichi: 'tai chi', high_risk_cycle: 'high-risk cycle phase',
  pressure_delta: 'barometric pressure change', hit_calorie_goal: 'hitting calorie goal',
  under_1500_cal: 'under-eating (below 1500 cal)',
}

function buildInsightCard(correlation, type) {
  if (!correlation) return null

  if (type === 'binary') {
    const { inputKey, outputKey, difference, avg_when_true, avg_when_false, lagDays, direction, n_true, n_false } = correlation
    const inputLabel = INPUT_LABELS[inputKey] || inputKey
    const outputLabel = SYMPTOM_LABELS[outputKey] || outputKey
    const lagNote = lagDays > 0 ? ` (effect measured ${lagDays} day${lagDays > 1 ? 's' : ''} later)` : ''
    // Every output in SYMPTOM_LABELS is lower-is-better, including episode_count
    // and max_severity. Excluding those two forced better=false, so a practice
    // that REDUCED episodes was rendered red as '↑ Raises'.
    const better = direction === 'better_when_done'
    const color = better ? 'var(--green)' : 'var(--red)'
    const impact = Math.abs(difference).toFixed(1)

    let headline, body
    if (direction === 'better_when_done') {
      headline = `${inputLabel} is lowering your ${outputLabel}`
      body = `On days you complete ${inputLabel}, your ${outputLabel} averages ${avg_when_true} vs ${avg_when_false} when you skip it${lagNote}. That is a ${impact} point difference on a 5-point scale.`
    } else {
      headline = `${inputLabel} appears to raise your ${outputLabel}`
      body = `On days with ${inputLabel}, your ${outputLabel} averages ${avg_when_true} vs ${avg_when_false} without${lagNote}. Worth investigating -- may be correlation not causation.`
    }

    return { type: 'binary', headline, body, color, impact: parseFloat(impact), inputKey, outputKey, n: n_true + n_false }
  }

  if (type === 'numeric') {
    const { inputKey, outputKey, threshold, avg_above_threshold, avg_below_threshold, difference, lagDays, n_above, n_below } = correlation
    const inputLabel = INPUT_LABELS[inputKey] || inputKey
    const outputLabel = SYMPTOM_LABELS[outputKey] || outputKey
    const lagNote = lagDays > 0 ? ` (effect next day)` : ''
    const lowerIsBetter = !['hrv', 'spo2', 'total_protein', 'total_calories', 'sleep_hours'].includes(inputKey)
    const better = difference < 0 // lower symptom score = better
    const color = better ? 'var(--green)' : 'var(--amber)'
    const impact = Math.abs(difference).toFixed(1)

    const thresholdLabel = inputKey === 'sleep_hours' ? `${threshold} hours` : inputKey === 'total_calories' ? `${threshold} calories` : inputKey === 'hrv' ? `HRV ${threshold}` : inputKey === 'completion_rate' ? `${threshold}%` : threshold

    let headline, body
    if (inputKey === 'sleep_hours') {
      headline = difference < 0
        ? `More sleep is reducing your ${outputLabel}`
        : `Sleep under ${threshold} hours is raising your ${outputLabel}`
      body = `Above ${thresholdLabel}: avg ${outputLabel} ${avg_above_threshold}. Below: avg ${avg_below_threshold}${lagNote}. That is a ${impact} point gap.`
    } else if (inputKey === 'hrv') {
      headline = difference < 0
        ? `Higher HRV predicts better ${outputLabel}`
        : `Low HRV days have higher ${outputLabel}`
      body = `HRV above ${threshold}: avg ${outputLabel} ${avg_above_threshold}. Below: ${avg_below_threshold}${lagNote}. HRV is your autonomic recovery marker.`
    } else if (inputKey === 'vest_sessions') {
      headline = `More vestibular sessions = lower ${outputLabel}`
      body = `${threshold}+ sessions per day: avg ${outputLabel} ${avg_above_threshold}. Fewer: ${avg_below_threshold}${lagNote}. ${impact} point difference.`
    } else if (inputKey === 'total_calories') {
      headline = difference < 0
        ? `Eating more is reducing your ${outputLabel}`
        : `Low calorie days have higher ${outputLabel}`
      body = `Above ${thresholdLabel}: avg ${outputLabel} ${avg_above_threshold}. Below: ${avg_below_threshold}${lagNote}. Your body needs fuel to regulate.`
    } else {
      headline = `${inputLabel} above ${thresholdLabel} affects your ${outputLabel}`
      body = `Above: avg ${outputLabel} ${avg_above_threshold}. Below: ${avg_below_threshold}${lagNote}. Difference: ${impact} points.`
    }

    return { type: 'numeric', headline, body, color, impact: parseFloat(impact), inputKey, outputKey, n: n_above + n_below }
  }

  return null
}

// ── MAIN ANALYTICS RUNNER ─────────────────────────────────────────────────────

export async function runAllAnalytics() {
  const dataset = await buildDataset(90)
  if (dataset.length < MIN_POINTS) {
    return { dataset, insights: [], practiceRankings: [], cycleInsights: [], foodInsights: [], streakInsights: [], episodePatterns: [], dataQuality: { days: dataset.length, sufficient: false } }
  }

  const SYMPTOM_OUTPUTS = ['dizziness', 'visual', 'fatigue', 'gut', 'anxiety', 'symptom_avg']
  const EPISODE_OUTPUTS = ['episode_count', 'max_severity']
  const ALL_OUTPUTS = [...SYMPTOM_OUTPUTS, ...EPISODE_OUTPUTS]

  const BINARY_INPUTS = [
    'loratadine', 'famotidine_am', 'famotidine_pm', 'antihistamine_complete',
    'propranolol_all3', 'propranolol_dose3', 'quercetin_both',
    'walk', 'stretch', 'weights', 'taichi',
    'has_trigger_food', 'dao_used', 'ox_bile_used',
    'high_risk_cycle', 'hit_calorie_goal', 'under_1500_cal',
  ]

  const NUMERIC_INPUTS = [
    { key: 'sleep_hours', threshold: 7 },
    { key: 'sleep_hours', threshold: 8 },
    { key: 'hrv', threshold: 30 },
    { key: 'hrv', threshold: 50 },
    { key: 'resting_hr', threshold: 65 },
    { key: 'vest_sessions', threshold: 3 },
    { key: 'vest_sessions', threshold: 5 },
    { key: 'vagal_count', threshold: 4 },
    { key: 'total_calories', threshold: 1200 },
    { key: 'total_calories', threshold: 1500 },
    { key: 'total_protein', threshold: 50 },
    { key: 'completion_rate', threshold: 70 },
    { key: 'pressure_delta', threshold: -3 },
  ]

  const rawInsights = []

  // Same-day correlations
  BINARY_INPUTS.forEach(inputKey => {
    ALL_OUTPUTS.forEach(outputKey => {
      const result = binaryCorrelation(dataset, inputKey, outputKey, 0)
      const card = buildInsightCard(result, 'binary')
      if (card) rawInsights.push({ ...card, lag: 0 })
    })
  })

  NUMERIC_INPUTS.forEach(({ key, threshold }) => {
    ALL_OUTPUTS.forEach(outputKey => {
      const result = numericCorrelation(dataset, key, outputKey, threshold, 0)
      const card = buildInsightCard(result, 'numeric')
      if (card) rawInsights.push({ ...card, lag: 0 })
    })
  })

  // Next-day lagged correlations (today's input -> tomorrow's output)
  const LAGGED_BINARY = ['antihistamine_complete', 'propranolol_all3', 'walk', 'stretch', 'weights', 'hit_calorie_goal', 'under_1500_cal', 'has_trigger_food']
  const LAGGED_NUMERIC = [
    { key: 'sleep_hours', threshold: 7 },
    { key: 'sleep_hours', threshold: 8 },
    { key: 'hrv', threshold: 30 },
    { key: 'total_calories', threshold: 1500 },
    { key: 'vest_sessions', threshold: 3 },
  ]

  LAGGED_BINARY.forEach(inputKey => {
    SYMPTOM_OUTPUTS.forEach(outputKey => {
      const result = binaryCorrelation(dataset, inputKey, outputKey, 1)
      const card = buildInsightCard(result, 'binary')
      if (card) rawInsights.push({ ...card, lag: 1 })
    })
  })

  LAGGED_NUMERIC.forEach(({ key, threshold }) => {
    SYMPTOM_OUTPUTS.forEach(outputKey => {
      const result = numericCorrelation(dataset, key, outputKey, threshold, 1)
      const card = buildInsightCard(result, 'numeric')
      if (card) rawInsights.push({ ...card, lag: 1 })
    })
  })

  // Deduplicate -- keep highest-impact card per input/output pair
  const seen = new Map()
  rawInsights.forEach(card => {
    const key = `${card.inputKey}_${card.outputKey}`
    if (!seen.has(key) || card.impact > seen.get(key).impact) {
      seen.set(key, card)
    }
  })
  const insights = Array.from(seen.values()).sort((a, b) => b.impact - a.impact)

  // Practice rankings -- which practices correlate most with lower overall symptoms
  const practiceRankings = BINARY_INPUTS
    .map(inputKey => {
      const result = binaryCorrelation(dataset, inputKey, 'symptom_avg', 0)
      if (!result) return null
      return {
        practice: INPUT_LABELS[inputKey] || inputKey,
        inputKey,
        impact: result.difference,
        avg_done: result.avg_when_true,
        avg_missed: result.avg_when_false,
        n: result.n_true + result.n_false,
      }
    })
    .filter(Boolean)
    .filter(r => r.impact < -0.2) // only show practices that actually help
    .sort((a, b) => a.impact - b.impact) // most negative impact first (biggest improvement)

  // Cycle phase analysis
  const cycleInsights = SYMPTOM_OUTPUTS
    .map(outputKey => cyclePhaseCorrelation(dataset, outputKey))
    .filter(Boolean)

  // Trigger food analysis
  const foodInsights = triggerFoodCorrelation(dataset, 'symptom_avg')

  // Streak analysis
  const streakInsights = practiceStreakCorrelation(dataset)

  // Episode patterns
  const episodeDays = dataset.filter(d => d.had_episode)
  const episodePatterns = {
    total_episodes: dataset.reduce((sum, d) => sum + (d.episode_count || 0), 0),
    most_common_type: (() => {
      const typeCounts = {}
      dataset.flatMap(d => d.episode_types).forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1 })
      return Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    })(),
    high_risk_cycle_episode_rate: episodeDays.filter(d => d.high_risk_cycle).length / (dataset.filter(d => d.high_risk_cycle).length || 1),
    normal_cycle_episode_rate: episodeDays.filter(d => !d.high_risk_cycle).length / (dataset.filter(d => !d.high_risk_cycle).length || 1),
    low_sleep_episode_rate: episodeDays.filter(d => d.sleep_hours && d.sleep_hours < 7).length / (dataset.filter(d => d.sleep_hours && d.sleep_hours < 7).length || 1),
    good_sleep_episode_rate: episodeDays.filter(d => d.sleep_hours && d.sleep_hours >= 7).length / (dataset.filter(d => d.sleep_hours && d.sleep_hours >= 7).length || 1),
    trigger_food_episode_rate: episodeDays.filter(d => d.has_trigger_food).length / (dataset.filter(d => d.has_trigger_food).length || 1),
    clean_food_episode_rate: episodeDays.filter(d => !d.has_trigger_food).length / (dataset.filter(d => !d.has_trigger_food).length || 1),
    missed_prop3_episode_rate: episodeDays.filter(d => !d.propranolol_dose3).length / (dataset.filter(d => !d.propranolol_dose3).length || 1),
    took_prop3_episode_rate: episodeDays.filter(d => d.propranolol_dose3).length / (dataset.filter(d => d.propranolol_dose3).length || 1),
  }

  return {
    dataset,
    insights: insights.slice(0, 30), // top 30 correlations
    practiceRankings,
    cycleInsights,
    foodInsights,
    streakInsights,
    episodePatterns,
    dataQuality: {
      days: dataset.length,
      days_with_scores: dataset.filter(d => d.symptom_avg !== null).length,
      days_with_episodes: dataset.filter(d => d.had_episode).length,
      sufficient: dataset.filter(d => d.symptom_avg !== null).length >= MIN_POINTS,
    }
  }
}

// ── TREND ANALYSIS ────────────────────────────────────────────────────────────
// Week over week improvement tracking

export function computeTrends(dataset) {
  if (dataset.length < 14) return null

  const recent = dataset.slice(-14)
  const prior = dataset.slice(-28, -14)

  const METRICS = ['dizziness', 'visual', 'fatigue', 'gut', 'anxiety', 'symptom_avg']

  const trends = {}
  METRICS.forEach(metric => {
    const recentVals = recent.filter(d => d[metric] !== null).map(d => d[metric])
    const priorVals = prior.filter(d => d[metric] !== null).map(d => d[metric])
    if (!recentVals.length || !priorVals.length) return

    const recentAvg = recentVals.reduce((a, b) => a + b, 0) / recentVals.length
    const priorAvg = priorVals.reduce((a, b) => a + b, 0) / priorVals.length
    const change = recentAvg - priorAvg

    trends[metric] = {
      recent_avg: Math.round(recentAvg * 10) / 10,
      prior_avg: Math.round(priorAvg * 10) / 10,
      change: Math.round(change * 10) / 10,
      direction: change < -0.15 ? 'improving' : change > 0.15 ? 'worsening' : 'stable',
    }
  })

  const recentEpisodes = recent.reduce((s, d) => s + d.episode_count, 0)
  const priorEpisodes = prior.reduce((s, d) => s + d.episode_count, 0)
  trends.episodes = {
    recent_total: recentEpisodes,
    prior_total: priorEpisodes,
    direction: recentEpisodes < priorEpisodes ? 'improving' : recentEpisodes > priorEpisodes ? 'worsening' : 'stable',
  }

  return trends
}
