import { supabase } from './supabase'

const USER_ID = '1e133101-10e9-468a-ab81-d9b76a20e8ed'

// ── DAILY LOGS ──────────────────────────────────────────────
export async function getDailyLog(date) {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('date', date)
    .maybeSingle()
  if (error) console.error(error)
  return data
}

export async function upsertDailyLog(date, updates) {
  const { data, error } = await supabase
    .from('daily_logs')
    .upsert({ user_id: USER_ID, date, ...updates }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) { console.error(error); throw error }
  return data
}

// ── PRACTICE LOGS ──────────────────────────────────────────
export async function getPracticeLogs(date) {
  const { data, error } = await supabase
    .from('practice_logs')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('date', date)
  if (error) console.error(error)
  return data || []
}

export async function togglePractice(date, practiceId, completed) {
  const { error } = await supabase
    .from('practice_logs')
    .upsert(
      { user_id: USER_ID, date, practice_id: practiceId, completed, completed_at: completed ? new Date().toISOString() : null },
      { onConflict: 'user_id,date,practice_id' }
    )
  if (error) { console.error(error); throw error }
}

// ── EPISODES ────────────────────────────────────────────────
export async function getEpisodes(limit = 20) {
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('user_id', USER_ID)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) console.error(error)
  return data || []
}

export async function createEpisode(episode) {
  const { data, error } = await supabase
    .from('episodes')
    .insert({ user_id: USER_ID, ...episode })
    .select()
    .single()
  if (error) { console.error(error); throw error }
  return data
}

export async function updateEpisode(id, updates) {
  const { data, error } = await supabase
    .from('episodes')
    .update(updates)
    .eq('id', id)
    .eq('user_id', USER_ID)
    .select()
    .single()
  if (error) { console.error(error); throw error }
  return data
}

// ── FOOD ENTRIES ────────────────────────────────────────────
export async function getFoodEntries(date) {
  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('date', date)
    .order('created_at', { ascending: true })
  if (error) console.error(error)
  return data || []
}

export async function createFoodEntry(entry) {
  const { data, error } = await supabase
    .from('food_entries')
    .insert({ user_id: USER_ID, ...entry })
    .select()
    .single()
  if (error) { console.error(error); throw error }
  return data
}

export async function deleteFoodEntry(id) {
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID)
  if (error) { console.error(error); throw error }
}

// ── TRIGGER FOODS ───────────────────────────────────────────
export async function getTriggerFoods() {
  const { data, error } = await supabase
    .from('trigger_foods')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('active', true)
    .order('food', { ascending: true })
  if (error) console.error(error)
  return data || []
}

export async function addTriggerFood(food) {
  const { data, error } = await supabase
    .from('trigger_foods')
    .insert({ user_id: USER_ID, active: true, ...food })
    .select()
    .single()
  if (error) { console.error(error); throw error }
  return data
}

// ── MEDICATION LOGS ─────────────────────────────────────────
export async function getMedLogs(date) {
  const { data, error } = await supabase
    .from('medication_logs')
    .select('*, medications(name, dose, schedule)')
    .eq('user_id', USER_ID)
    .gte('taken_at', date + 'T00:00:00')
    .lte('taken_at', date + 'T23:59:59')
  if (error) console.error(error)
  return data || []
}

// ── TRENDS ──────────────────────────────────────────────────
export async function getSymptomTrend(days = 14) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data, error } = await supabase
    .from('daily_logs')
    .select('date, dizziness_score, visual_score, fatigue_score, gut_score, anxiety_score, mood_score')
    .eq('user_id', USER_ID)
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: true })
  if (error) console.error(error)
  return data || []
}

export async function getEpisodeTrend(days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data, error } = await supabase
    .from('episodes')
    .select('id, episode_type, severity, started_at, duration_minutes')
    .eq('user_id', USER_ID)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: true })
  if (error) console.error(error)
  return data || []
}

// ── HEART RATE TAGS ─────────────────────────────────────────
export async function getHRTags(startDate, endDate) {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const end = endDate || new Date().toISOString()
  const { data, error } = await supabase
    .from('heart_rate_tags')
    .select('*')
    .eq('user_id', USER_ID)
    .gte('tagged_at', start)
    .lte('tagged_at', end)
    .order('tagged_at', { ascending: true })
  if (error) console.error(error)
  return data || []
}

export async function createHRTag(tag) {
  const { data, error } = await supabase
    .from('heart_rate_tags')
    .insert({ user_id: USER_ID, ...tag })
    .select()
    .single()
  if (error) console.error(error)
  return data
}

export async function deleteHRTag(id) {
  const { error } = await supabase
    .from('heart_rate_tags')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID)
  if (error) console.error(error)
}

// ── PROPRANOLOL DOSE ANALYTICS ──────────────────────────────
export async function logPropranololDose(doseNumber, scheduledAt, takenAt, hrBefore, hrAfter, notes) {
  const { data, error } = await supabase
    .from('propranolol_doses')
    .insert({
      user_id: USER_ID,
      dose_number: doseNumber,
      scheduled_at: scheduledAt,
      taken_at: takenAt,
      missed: !takenAt,
      heart_rate_before: hrBefore || null,
      heart_rate_after: hrAfter || null,
      notes: notes || null,
    })
    .select()
    .single()
  if (error) console.error(error)
  return data
}

export async function getPropranololDoses(days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data, error } = await supabase
    .from('propranolol_doses')
    .select('*')
    .eq('user_id', USER_ID)
    .gte('scheduled_at', since.toISOString())
    .order('scheduled_at', { ascending: false })
  if (error) console.error(error)
  return data || []
}

export async function getPropranololAnalytics(days = 30) {
  const doses = await getPropranololDoses(days)
  if (!doses.length) return null
  
  const taken = doses.filter(d => d.taken_at && !d.missed)
  const missed = doses.filter(d => d.missed)
  const late = taken.filter(d => d.minutes_late > 15)
  const onTime = taken.filter(d => d.minutes_late <= 15)
  
  const avgLateness = late.length 
    ? late.reduce((sum, d) => sum + (d.minutes_late || 0), 0) / late.length 
    : 0
  
  // HR before/after comparison for taken doses
  const hrData = taken.filter(d => d.heart_rate_before && d.heart_rate_after)
  const avgHrBefore = hrData.length 
    ? hrData.reduce((s, d) => s + d.heart_rate_before, 0) / hrData.length 
    : null
  const avgHrAfter = hrData.length 
    ? hrData.reduce((s, d) => s + d.heart_rate_after, 0) / hrData.length 
    : null
  
  // Dose 3 specifically (most critical)
  const dose3 = doses.filter(d => d.dose_number === 3)
  const dose3Missed = dose3.filter(d => d.missed).length
  const dose3Late = dose3.filter(d => !d.missed && d.minutes_late > 20).length
  
  return {
    totalLogged: doses.length,
    taken: taken.length,
    missed: missed.length,
    late: late.length,
    onTime: onTime.length,
    adherenceRate: doses.length ? Math.round((taken.length / doses.length) * 100) : 0,
    avgLatenessMinutes: Math.round(avgLateness),
    avgHrBefore: avgHrBefore ? Math.round(avgHrBefore) : null,
    avgHrAfter: avgHrAfter ? Math.round(avgHrAfter) : null,
    hrReductionOnDose: (avgHrBefore && avgHrAfter) ? Math.round(avgHrBefore - avgHrAfter) : null,
    dose3Missed,
    dose3Late,
    rawDoses: doses,
  }
}

// ── SCHEDULE / TAMAGOTCHI ───────────────────────────────────
// Records a scheduled prompt as done or skipped, and folds any calories/water
// it carries into the day's running totals. Read-modify-write on the jsonb blob
// is fine here: single user, single device at a time.
export async function completePrompt(date, prompt, status = 'done') {
  const current = await getDailyLog(date)
  const completions = { ...(current?.schedule_completions || {}) }
  const already = completions[prompt.id]?.status === 'done'
  completions[prompt.id] = { status, at: new Date().toISOString() }

  const updates = { schedule_completions: completions }
  // Water has no diary equivalent, so the schedule is its source. Calories are
  // NOT added here -- food_entries is the single source of truth, and adding an
  // estimate too would double-count any meal logged in both places.
  if (status === 'done' && !already && prompt.water) {
    updates.water_oz = Number(current?.water_oz || 0) + prompt.water
  }
  return upsertDailyLog(date, updates)
}

export async function addWater(date, oz) {
  const current = await getDailyLog(date)
  return upsertDailyLog(date, { water_oz: Number(current?.water_oz || 0) + oz })
}

export async function getScheduleSettings() {
  const { data, error } = await supabase
    .from('schedule_settings')
    .select('*')
    .eq('user_id', USER_ID)
    .maybeSingle()
  if (error) console.error(error)
  return data
}

export async function saveScheduleSettings(updates) {
  const { data, error } = await supabase
    .from('schedule_settings')
    .upsert({ user_id: USER_ID, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) { console.error(error); throw error }
  return data
}

export async function savePushSubscription(sub) {
  const json = sub.toJSON ? sub.toJSON() : sub
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: USER_ID,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    }, { onConflict: 'endpoint' })
    .select()
    .single()
  if (error) { console.error(error); throw error }
  return data
}

export async function deletePushSubscription(endpoint) {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) { console.error(error); throw error }
}
