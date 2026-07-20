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
    client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,
    response_type: 'code', scope: SCOPES,
    access_type: 'offline', prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export const isConnected = () => !!localStorage.getItem('gh_access_token')
export const getToken = () => localStorage.getItem('gh_access_token')
export const setToken = t => localStorage.setItem('gh_access_token', t)
export const clearToken = () => localStorage.removeItem('gh_access_token')

async function gh(path) {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`https://health.googleapis.com/v4/${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// Generic rollup fetcher for daily aggregate types
async function dailyRollup(dataType, date) {
  const start = `${date}T00:00:00Z`
  const end = `${date}T23:59:59Z`
  return gh(`users/me/dataTypes/${dataType}:dailyRollUp?startTime=${start}&endTime=${end}`)
}

// Generic data points fetcher
async function dataPoints(dataType, startTime, endTime, pageSize = 500) {
  return gh(`users/me/dataTypes/${dataType}/dataPoints?startTime=${startTime}&endTime=${endTime}&pageSize=${pageSize}`)
}

function avgPoints(data) {
  const pts = data?.dataPoints || []
  if (!pts.length) return null
  const vals = pts.map(p => p?.value?.[0]?.fpVal || p?.value?.[0]?.intVal).filter(v => v != null)
  return vals.length ? Math.round(vals.reduce((a,b) => a+b, 0) / vals.length * 10) / 10 : null
}

function sumPoints(data) {
  const pts = data?.dataPoints || []
  if (!pts.length) return null
  const vals = pts.map(p => p?.value?.[0]?.fpVal || p?.value?.[0]?.intVal).filter(v => v != null)
  return vals.length ? Math.round(vals.reduce((a,b) => a+b, 0)) : null
}

// ── LIVE HEART RATE ──────────────────────────────────────
export async function fetchHeartRate(startTime, endTime) {
  const start = startTime || new Date(Date.now() - 3600000).toISOString()
  const end = endTime || new Date().toISOString()
  return dataPoints('heart-rate', start, end)
}

export async function fetchCurrentHeartRate() {
  const data = await fetchHeartRate(
    new Date(Date.now() - 300000).toISOString(),
    new Date().toISOString()
  )
  if (!data?.dataPoints?.length) return null
  const latest = data.dataPoints[data.dataPoints.length - 1]
  return latest?.value?.[0]?.fpVal || null
}

export async function avgHRInWindow(startMs, endMs) {
  const data = await fetchHeartRate(new Date(startMs).toISOString(), new Date(endMs).toISOString())
  return avgPoints(data)
}

// ── FULL DAY SNAPSHOT ────────────────────────────────────
export async function fetchDaySnapshot(date) {
  const start = `${date}T00:00:00Z`
  const end = `${date}T23:59:59Z`

  // Parallel fetch everything
  const [
    sleepData, hrData, hrvData, spo2Data, respData,
    stepsData, distanceData, floorsData,
    totalCalData, activeCalData, activeMinData,
    activeZoneData, restingHrData, vo2Data,
    hrZonesData, activityData,
  ] = await Promise.all([
    dataPoints('sleep', start, end, 20),
    dataPoints('heart-rate', start, end, 1000),
    dailyRollup('daily-heart-rate-variability', date),
    dailyRollup('daily-oxygen-saturation', date),
    dailyRollup('daily-respiratory-rate', date),
    dailyRollup('steps', date),
    dailyRollup('distance', date),
    dailyRollup('floors', date),
    dailyRollup('total-calories', date),
    dailyRollup('active-energy-burned', date),
    dailyRollup('active-minutes', date),
    dailyRollup('active-zone-minutes', date),
    dailyRollup('daily-resting-heart-rate', date),
    dailyRollup('run-vo2-max', date),
    dailyRollup('daily-heart-rate-zones', date),
    dataPoints('activity', start, end, 50),
  ])

  // Sleep processing
  let sleep_hours = null, sleep_stages = null
  if (sleepData?.dataPoints?.length) {
    const totalMs = sleepData.dataPoints.reduce((s, p) => s + (new Date(p.endTime) - new Date(p.startTime)), 0)
    sleep_hours = Math.round(totalMs / 3600000 * 10) / 10
    const stages = { deep: 0, light: 0, rem: 0, awake: 0 }
    sleepData.dataPoints.forEach(p => {
      const stage = p?.value?.[0]?.intVal
      const mins = (new Date(p.endTime) - new Date(p.startTime)) / 60000
      if (stage === 1) stages.awake += mins
      else if (stage === 2) stages.light += mins
      else if (stage === 3) stages.deep += mins
      else if (stage === 4) stages.rem += mins
    })
    sleep_stages = stages
  }

  // HR processing
  const hrPoints = hrData?.dataPoints || []
  const resting_hr = restingHrData?.dataPoints?.[0]?.value?.[0]?.fpVal
    || (hrPoints.length ? Math.round(Math.min(...hrPoints.map(p => p?.value?.[0]?.fpVal).filter(Boolean))) : null)
  const peak_hr = hrPoints.length ? Math.round(Math.max(...hrPoints.map(p => p?.value?.[0]?.fpVal).filter(Boolean))) : null
  const avg_hr = avgPoints(hrData)

  // HR zones
  let hr_zones = null
  if (hrZonesData?.dataPoints?.length) {
    const z = hrZonesData.dataPoints[0]?.value
    if (z) hr_zones = {
      out_of_range: Math.round(z[0]?.fpVal || 0),
      fat_burn: Math.round(z[1]?.fpVal || 0),
      cardio: Math.round(z[2]?.fpVal || 0),
      peak: Math.round(z[3]?.fpVal || 0),
    }
  }

  // Activity processing
  const WALK_TYPES = ['WALKING', 'OUTDOOR_WALK', 'TREADMILL_WALKING']
  const WEIGHT_TYPES = ['WEIGHT_TRAINING', 'STRENGTH_TRAINING']
  const activities = activityData?.dataPoints || []
  const walks = activities.filter(a => WALK_TYPES.includes(a.activityType))
  const weights = activities.filter(a => WEIGHT_TYPES.includes(a.activityType))
  const walk_minutes = Math.round(walks.reduce((s, a) => s + (new Date(a.endTime) - new Date(a.startTime)) / 60000, 0))

  // Steps
  const steps = stepsData?.dataPoints?.[0]?.value?.[0]?.intVal
    || sumPoints(await dataPoints('steps', start, end, 1000))

  // Active zone minutes (cardio load proxy)
  let active_zone_minutes = null, cardio_minutes = null
  if (activeZoneData?.dataPoints?.length) {
    const v = activeZoneData.dataPoints[0]?.value
    if (v) {
      const fat_burn = v[0]?.intVal || 0
      const cardio = v[1]?.intVal || 0
      const peak = v[2]?.intVal || 0
      active_zone_minutes = fat_burn + cardio + peak
      cardio_minutes = cardio + peak
    }
  }

  return {
    // Activity
    steps: steps || null,
    distance_km: distanceData?.dataPoints?.[0]?.value?.[0]?.fpVal
      ? Math.round(distanceData.dataPoints[0].value[0].fpVal / 100) / 10 : null,
    floors: floorsData?.dataPoints?.[0]?.value?.[0]?.intVal || null,
    active_minutes: activeMinData?.dataPoints?.[0]?.value?.[0]?.intVal || null,
    active_zone_minutes,
    cardio_minutes,
    total_calories_burned: totalCalData?.dataPoints?.[0]?.value?.[0]?.fpVal
      ? Math.round(totalCalData.dataPoints[0].value[0].fpVal) : null,
    active_calories_burned: activeCalData?.dataPoints?.[0]?.value?.[0]?.fpVal
      ? Math.round(activeCalData.dataPoints[0].value[0].fpVal) : null,
    walk_minutes,
    walk_detected: walk_minutes >= 10,
    weights_detected: weights.length > 0,
    activity_count: activities.length,

    // Vitals
    sleep_hours,
    sleep_stages,
    resting_hr: resting_hr ? Math.round(resting_hr) : null,
    avg_hr: avg_hr ? Math.round(avg_hr) : null,
    peak_hr,
    hrv: hrvData?.dataPoints?.[0]?.value?.[0]?.fpVal
      ? Math.round(hrvData.dataPoints[0].value[0].fpVal) : null,
    spo2: spo2Data?.dataPoints?.[0]?.value?.[0]?.fpVal
      ? Math.round(spo2Data.dataPoints[0].value[0].fpVal * 10) / 10 : null,
    respiratory_rate: respData?.dataPoints?.[0]?.value?.[0]?.fpVal
      ? Math.round(respData.dataPoints[0].value[0].fpVal * 10) / 10 : null,
    vo2_max: vo2Data?.dataPoints?.[0]?.value?.[0]?.fpVal
      ? Math.round(vo2Data.dataPoints[0].value[0].fpVal * 10) / 10 : null,
    hr_zones,
    hr_points: hrPoints.map(p => ({
      t: new Date(p.endTime).getTime(),
      v: Math.round(p?.value?.[0]?.fpVal || 0)
    })).filter(p => p.v > 0),
  }
}

// ── FOOD SEARCH ───────────────────────────────────────────
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

// ── WEATHER ───────────────────────────────────────────────
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
