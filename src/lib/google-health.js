// Google Health API v4 client.
//
// This file previously targeted the Google Fit v1 REST shapes (`value[0].fpVal`,
// GET `:dailyRollUp` with query params, response key `dataPoints`). None of that
// exists in Health API v4, so every metric resolved to null while errors were
// swallowed -- which presented as "connected but no data".
//
// Verified against:
//   https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints
//   https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list
//   https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/dailyRollUp
//   https://developers.google.com/health/scopes

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID
  || '777031835250-sadrm1559ahp1ntjcqoghgkm3d32fi2o.apps.googleusercontent.com'

// Registered redirect URI is the directory form with a trailing slash. Landing on
// /everee-health (no slash) would otherwise produce a redirect_uri_mismatch.
const REDIRECT_URI = (() => {
  const path = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : window.location.pathname + '/'
  return window.location.origin + path
})()

// v4 scopes are functional bundles under .../auth/googlehealth.*, not per-metric.
const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
].join(' ')

const TOKEN_KEY = 'gh_access_token'
const EXPIRY_KEY = 'gh_token_expiry'

// ── AUTH ──────────────────────────────────────────────────
export function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    // Implicit flow: a static GitHub Pages SPA cannot hold a client secret,
    // so there is no way to exchange an auth code.
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export const getToken = () => {
  const t = localStorage.getItem(TOKEN_KEY)
  if (!t) return null
  const exp = parseInt(localStorage.getItem(EXPIRY_KEY) || '0', 10)
  // Implicit-flow tokens last ~1h. Treat an expired token as absent rather than
  // reporting "connected" while every request 401s.
  if (exp && Date.now() > exp) { clearToken(); return null }
  return t
}
export const isConnected = () => !!getToken()
export const setToken = (t, expiresInSec) => {
  localStorage.setItem(TOKEN_KEY, t)
  if (expiresInSec) localStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresInSec * 1000))
}
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
}

// Call once on mount. Consumes #access_token=... from the OAuth redirect.
export function handleAuthRedirect() {
  const hash = window.location.hash.substring(1)
  if (!hash) return false
  const p = new URLSearchParams(hash)
  const token = p.get('access_token')
  if (!token) return false
  setToken(token, parseInt(p.get('expires_in') || '3600', 10))
  window.history.replaceState({}, document.title, window.location.pathname)
  return true
}

// ── DEBUG LOG ─────────────────────────────────────────────
// Every request is recorded so failures are inspectable instead of silent.
// Surfaced in the More tab.
const DEBUG_MAX = 40
let debugLog = []
const record = e => { debugLog = [{ at: new Date().toISOString(), ...e }, ...debugLog].slice(0, DEBUG_MAX) }
export const getDebugLog = () => debugLog
export const clearDebugLog = () => { debugLog = [] }

// ── TRANSPORT ─────────────────────────────────────────────
// Returns { ok, status, data, error }. Never returns a bare null, so callers can
// tell "no data" apart from "request failed".
async function ghFetch(path, { method = 'GET', body = null } = {}) {
  const token = getToken()
  if (!token) {
    const r = { ok: false, status: 0, data: null, error: 'not connected' }
    record({ path, method, ...r })
    return r
  }
  try {
    const res = await fetch(`https://health.googleapis.com/v4/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { /* non-JSON error body */ }

    if (res.status === 401) clearToken()
    if (!res.ok) {
      const error = json?.error?.message || text.slice(0, 200) || `HTTP ${res.status}`
      record({ path, method, ok: false, status: res.status, error })
      return { ok: false, status: res.status, data: null, error }
    }
    record({ path, method, ok: true, status: res.status, sample: JSON.stringify(json).slice(0, 400) })
    return { ok: true, status: res.status, data: json, error: null }
  } catch (e) {
    const error = String(e?.message || e)
    record({ path, method, ok: false, status: 0, error })
    return { ok: false, status: 0, data: null, error }
  }
}

// ── REQUEST BUILDERS ──────────────────────────────────────
const civil = dateStr => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year, month, day }
}
const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

// POST {parent}/dataPoints:dailyRollUp with a civil-date range.
// Response: { rollupDataPoints: [ { civilStartTime, civilEndTime, <dataType>: {...} } ] }
async function rollupDaily(dataType, date) {
  const r = await ghFetch(`users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`, {
    method: 'POST',
    body: { range: { start: civil(date), end: civil(addDays(date, 1)) }, windowSizeDays: 1 },
  })
  return r.ok ? (r.data?.rollupDataPoints || []) : []
}

// GET {parent}/dataPoints?filter=...  Response: { dataPoints: [...], nextPageToken }
async function listPoints(dataType, filter, pageSize = 1440) {
  const qs = new URLSearchParams({ pageSize: String(pageSize) })
  if (filter) qs.set('filter', filter)
  const r = await ghFetch(`users/me/dataTypes/${dataType}/dataPoints?${qs}`)
  return r.ok ? (r.data?.dataPoints || []) : []
}

const dayFilter = (dataType, field, date) =>
  `${dataType}.${field} >= "${date}" AND ${dataType}.${field} < "${addDays(date, 1)}"`

const num = v => (typeof v === 'number' ? v : v == null ? null : Number(v))
const round = (v, dp = 0) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp)

// ── HEART RATE ────────────────────────────────────────────
export async function fetchHeartRatePoints(date) {
  return listPoints('heart-rate', dayFilter('heart-rate', 'sample_time.civil_time', date), 10000)
}

const hrValue = p => num(p?.heartRate?.beatsPerMinute)
const hrTime = p => p?.heartRate?.sampleTime?.physicalTime || p?.heartRate?.sampleTime?.civilTime || null

export async function fetchCurrentHeartRate() {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const pts = await fetchHeartRatePoints(today)
  const vals = pts.map(hrValue).filter(v => v != null)
  return vals.length ? vals[vals.length - 1] : null
}

// Back-compat shim: PropranololAnalytics.js (currently unreachable from App.js)
// still imports this. Returns the v4 point list under the old wrapper shape.
export async function fetchHeartRate(startTime) {
  const d = startTime ? new Date(startTime) : new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { dataPoints: await fetchHeartRatePoints(date) }
}

export async function avgHRInWindow(startMs, endMs) {
  const d = new Date(startMs)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const pts = await fetchHeartRatePoints(date)
  const vals = pts
    .filter(p => { const t = new Date(hrTime(p)).getTime(); return t >= startMs && t <= endMs })
    .map(hrValue)
    .filter(v => v != null)
  return vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length, 1) : null
}

// ── FULL DAY SNAPSHOT ─────────────────────────────────────
export async function fetchDaySnapshot(date) {
  const [
    stepsRoll, distanceRoll, floorsRoll, azmRoll,
    restingRoll, hrvRoll, spo2Roll, respRoll,
    hrPoints, sleepPoints,
  ] = await Promise.all([
    rollupDaily('steps', date),
    rollupDaily('distance', date),
    rollupDaily('floors', date),
    rollupDaily('active-zone-minutes', date),
    rollupDaily('daily-resting-heart-rate', date),
    rollupDaily('heart-rate-variability', date),
    rollupDaily('oxygen-saturation', date),
    rollupDaily('daily-respiratory-rate', date),
    fetchHeartRatePoints(date),
    listPoints('sleep', dayFilter('sleep', 'interval.civil_end_time', date), 25),
  ])

  const first = (rows, pick) => {
    for (const r of rows) { const v = pick(r); if (v != null) return num(v) }
    return null
  }

  // Sleep: prefer the API's own summary, fall back to summing stage durations.
  let sleep_hours = null
  let sleep_stages = null
  if (sleepPoints.length) {
    const mins = sleepPoints.reduce((s, p) => s + (num(p?.sleep?.summary?.minutesAsleep) || 0), 0)
    if (mins > 0) sleep_hours = round(mins / 60, 1)

    const stages = { deep: 0, light: 0, rem: 0, awake: 0 }
    let sawStage = false
    sleepPoints.forEach(p => {
      (p?.sleep?.stages || []).forEach(st => {
        const start = st?.interval?.startTime, end = st?.interval?.endTime
        if (!start || !end) return
        const m = (new Date(end) - new Date(start)) / 60000
        if (!Number.isFinite(m)) return
        const type = String(st?.type || st?.stage || '').toUpperCase()
        sawStage = true
        if (type.includes('DEEP')) stages.deep += m
        else if (type.includes('REM')) stages.rem += m
        else if (type.includes('AWAKE') || type.includes('WAKE')) stages.awake += m
        else stages.light += m
      })
    })
    if (sawStage) {
      sleep_stages = Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, Math.round(v)]))
      if (sleep_hours == null) {
        sleep_hours = round((stages.deep + stages.light + stages.rem) / 60, 1)
      }
    }
  }

  const hrVals = hrPoints.map(hrValue).filter(v => v != null)
  const steps = first(stepsRoll, r => r?.steps?.count)
  const distance_mm = first(distanceRoll, r => r?.distance?.millimeters)
  const azm = first(azmRoll, r => r?.activeZoneMinutes?.activeZoneMinutes)

  return {
    // Activity
    steps,
    distance_km: distance_mm != null ? round(distance_mm / 1e6, 2) : null,
    floors: first(floorsRoll, r => r?.floors?.count),
    active_zone_minutes: azm,
    cardio_minutes: azm,
    walk_minutes: null,      // requires the exercise data type; not wired yet
    weights_detected: false, // as above

    // Vitals
    sleep_hours,
    sleep_stages,
    resting_hr: round(
      first(restingRoll, r => r?.dailyRestingHeartRate?.beatsPerMinute)
      ?? (hrVals.length ? Math.min(...hrVals) : null)
    ),
    avg_hr: hrVals.length ? round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length) : null,
    peak_hr: hrVals.length ? round(Math.max(...hrVals)) : null,
    hrv: round(first(hrvRoll, r => r?.heartRateVariability?.rootMeanSquareOfSuccessiveDifferencesMilliseconds)),
    spo2: round(first(spo2Roll, r => r?.oxygenSaturation?.percentage), 1),
    respiratory_rate: round(first(respRoll, r => r?.dailyRespiratoryRate?.breathsPerMinute), 1),

    hr_points: hrPoints
      .map(p => ({ t: new Date(hrTime(p)).getTime(), v: hrValue(p) }))
      .filter(p => p.v != null && Number.isFinite(p.t)),
  }
}

// ── FOOD SEARCH (Open Food Facts — unchanged) ─────────────
export async function searchFood(query) {
  if (!query || query.length < 3) return []
  try {
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,nutriments,serving_size`)
    const data = await res.json()
    return (data.products || []).map(p => ({
      name: [p.product_name, p.brands].filter(Boolean).join(' · ').slice(0, 60),
      calories: Math.round(p.nutriments?.['energy-kcal_serving'] || p.nutriments?.['energy-kcal_100g'] || 0),
      protein: Math.round((p.nutriments?.['proteins_serving'] || p.nutriments?.['proteins_100g'] || 0) * 10) / 10,
      serving: p.serving_size || null,
    })).filter(p => p.calories > 0)
  } catch { return [] }
}

// ── WEATHER (Open-Meteo — unchanged) ──────────────────────
export async function fetchCurrentWeather(lat, lon) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,surface_pressure&temperature_unit=fahrenheit`)
    const data = await res.json()
    const c = data.current
    return { temp: Math.round(c.temperature_2m), pressure: Math.round(c.surface_pressure), code: c.weather_code }
  } catch { return null }
}

// ── SIGNAL ────────────────────────────────────────────────
export const categorizeHeartRate = bpm => !bpm ? 'unknown' : bpm < 100 ? 'normal' : bpm < 150 ? 'elevated' : 'high'
export const heartRateSignal = cat => ({
  normal: { label: 'Normal', color: '#00C896', message: 'Heart rate is in normal range' },
  elevated: { label: 'Elevated', color: '#FF9500', message: 'Heart rate is elevated' },
  high: { label: 'High', color: '#FF3B5C', message: 'Heart rate is significantly elevated' },
  unknown: { label: 'Checking...', color: '#A0A6B8', message: 'Checking heart rate' },
}[cat] || { label: 'Unknown', color: '#A0A6B8', message: '' })
