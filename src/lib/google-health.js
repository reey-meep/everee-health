const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '777031835250-hvhmbb63opkntprba4s373abdrmo3mm4.apps.googleusercontent.com'
const REDIRECT_URI = window.location.origin + window.location.pathname

const SCOPES = [
  'https://www.googleapis.com/auth/health.heart_rate.read',
  'https://www.googleapis.com/auth/health.heart_rate_variability.read',
  'https://www.googleapis.com/auth/health.sleep.read',
  'https://www.googleapis.com/auth/health.activity.read',
  'https://www.googleapis.com/auth/health.oxygen_saturation.read',
  'https://www.googleapis.com/auth/health.respiratory_rate.read',
].join(' ')

export function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export function isConnected() { return !!localStorage.getItem('gh_access_token') }
export function getToken() { return localStorage.getItem('gh_access_token') }
export function setToken(token) { localStorage.setItem('gh_access_token', token) }
export function clearToken() { localStorage.removeItem('gh_access_token') }

async function ghFetch(path) {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`https://health.googleapis.com/v4/${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.error('Google Health fetch error:', e)
    return null
  }
}

// ── HEART RATE ────────────────────────────────────────────
export async function fetchHeartRate(startTime, endTime) {
  const start = startTime || new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const end = endTime || new Date().toISOString()
  return ghFetch(`users/me/dataTypes/heart-rate/dataPoints?startTime=${start}&endTime=${end}&pageSize=500`)
}

export async function fetchCurrentHeartRate() {
  const data = await fetchHeartRate(
    new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    new Date().toISOString()
  )
  if (!data?.dataPoints?.length) return null
  const latest = data.dataPoints[data.dataPoints.length - 1]
  return latest?.value?.[0]?.fpVal || null
}

// Average HR in a time window -- used by propranolol analytics and episode overlay
export async function avgHRInWindow(startMs, endMs) {
  const data = await fetchHeartRate(
    new Date(startMs).toISOString(),
    new Date(endMs).toISOString()
  )
  const points = data?.dataPoints || []
  if (!points.length) return null
  const values = points.map(p => p?.value?.[0]?.fpVal).filter(Boolean)
  if (!values.length) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

// ── SLEEP ─────────────────────────────────────────────────
export async function fetchSleepForDate(date) {
  // date = 'YYYY-MM-DD'
  const start = `${date}T00:00:00Z`
  const end = `${date}T23:59:59Z`
  const data = await ghFetch(`users/me/dataTypes/sleep/dataPoints?startTime=${start}&endTime=${end}&pageSize=10`)
  if (!data?.dataPoints?.length) return null
  // Sum all sleep segments in hours
  const totalMs = data.dataPoints.reduce((sum, p) => {
    const start = new Date(p.startTime).getTime()
    const end = new Date(p.endTime).getTime()
    return sum + (end - start)
  }, 0)
  return Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10 // hours to 1dp
}

// ── RESTING HEART RATE ────────────────────────────────────
export async function fetchRestingHR(date) {
  const data = await ghFetch(`users/me/dataTypes/dailyRestingHeartRate/dataPoints?startTime=${date}T00:00:00Z&endTime=${date}T23:59:59Z&pageSize=1`)
  if (!data?.dataPoints?.length) return null
  return data.dataPoints[0]?.value?.[0]?.fpVal || null
}

// ── HRV ───────────────────────────────────────────────────
export async function fetchHRV(date) {
  const data = await ghFetch(`users/me/dataTypes/dailyHeartRateVariability/dataPoints?startTime=${date}T00:00:00Z&endTime=${date}T23:59:59Z&pageSize=1`)
  if (!data?.dataPoints?.length) return null
  return data.dataPoints[0]?.value?.[0]?.fpVal || null
}

// ── ACTIVITY ──────────────────────────────────────────────
export async function fetchActivityForDate(date) {
  const data = await ghFetch(`users/me/dataTypes/activity/dataPoints?startTime=${date}T00:00:00Z&endTime=${date}T23:59:59Z&pageSize=50`)
  if (!data?.dataPoints?.length) return null
  return data.dataPoints // each has activityType, startTime, endTime, activeZoneMinutes
}

// ── SPO2 ──────────────────────────────────────────────────
export async function fetchSpO2(date) {
  const data = await ghFetch(`users/me/dataTypes/oxygenSaturation/dataPoints?startTime=${date}T00:00:00Z&endTime=${date}T23:59:59Z&pageSize=10`)
  if (!data?.dataPoints?.length) return null
  const values = data.dataPoints.map(p => p?.value?.[0]?.fpVal).filter(Boolean)
  if (!values.length) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10
}

// ── FULL DAY SNAPSHOT ────────────────────────────────────
// Pull everything for a date in one go -- used to auto-populate Today
export async function fetchDaySnapshot(date) {
  const [sleep, restingHR, hrv, spO2, activity] = await Promise.all([
    fetchSleepForDate(date),
    fetchRestingHR(date),
    fetchHRV(date),
    fetchSpO2(date),
    fetchActivityForDate(date),
  ])

  // Detect walks from activity data
  const WALK_TYPES = ['WALKING', 'OUTDOOR_WALK', 'TREADMILL_WALKING']
  const WEIGHT_TYPES = ['WEIGHT_TRAINING', 'STRENGTH_TRAINING', 'CIRCUIT_TRAINING']
  const walks = activity?.filter(a => WALK_TYPES.includes(a.activityType)) || []
  const weights = activity?.filter(a => WEIGHT_TYPES.includes(a.activityType)) || []
  const totalWalkMinutes = walks.reduce((s, a) => {
    return s + (new Date(a.endTime) - new Date(a.startTime)) / 60000
  }, 0)

  return {
    sleep_hours: sleep,
    resting_hr: restingHR,
    hrv,
    spo2: spO2,
    walk_detected: totalWalkMinutes >= 10,
    walk_minutes: Math.round(totalWalkMinutes),
    weights_detected: weights.length > 0,
    activity_raw: activity,
  }
}

// ── FOOD CALORIE LOOKUP (Open Food Facts -- no key needed) ─
export async function searchFood(query) {
  if (!query || query.length < 3) return []
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,nutriments,serving_size`
    )
    const data = await res.json()
    return (data.products || []).map(p => ({
      name: [p.product_name, p.brands].filter(Boolean).join(' · ').slice(0, 60),
      calories: Math.round(p.nutriments?.['energy-kcal_serving'] || p.nutriments?.['energy-kcal_100g'] || 0),
      protein: Math.round((p.nutriments?.['proteins_serving'] || p.nutriments?.['proteins_100g'] || 0) * 10) / 10,
      serving: p.serving_size || null,
    })).filter(p => p.calories > 0)
  } catch {
    return []
  }
}

// ── WEATHER (barometric pressure for episode correlation) ──
export async function fetchCurrentWeather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,surface_pressure&temperature_unit=fahrenheit`
    )
    const data = await res.json()
    const c = data.current
    return { temp: Math.round(c.temperature_2m), pressure: Math.round(c.surface_pressure), code: c.weather_code }
  } catch {
    return null
  }
}

// ── SIGNAL DISPLAY ─────────────────────────────────────────
export function categorizeHeartRate(bpm) {
  if (!bpm) return 'unknown'
  if (bpm < 100) return 'normal'
  if (bpm < 150) return 'elevated'
  return 'high'
}

export function heartRateSignal(category) {
  const signals = {
    normal: { label: 'Normal', color: '#10B981', message: 'Heart rate is in normal range' },
    elevated: { label: 'Elevated', color: '#F59E0B', message: 'Heart rate is elevated' },
    high: { label: 'High', color: '#EF4444', message: 'Heart rate is significantly elevated' },
    unknown: { label: 'Checking...', color: '#5A5A7A', message: 'Checking heart rate' },
  }
  return signals[category] || signals.unknown
}
