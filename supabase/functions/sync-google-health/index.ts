// everee health -- unattended Google Health sync
//
// Runs on a cron with the app closed. Mints a fresh access token from the
// stored refresh token, pulls the day's metrics from Health API v4, and writes
// them to daily_logs. Also backfills past days and serves intraday heart rate.
//
// The v4 request shapes here were established the hard way against the live API
// (see git history) -- do not "simplify" them without re-testing:
//   * dailyRollUp is POST .../dataPoints:dailyRollUp with a CivilDateTime range
//     of { date: {year,month,day} }. Flat {year,month,day} is rejected.
//   * Rollup responses are rollupDataPoints, and carry AGGREGATE field names
//     (steps.countSum, distance.millimetersSum) returned as strings.
//   * Several types reject rollup entirely and must use list: oxygen-saturation,
//     heart-rate-variability, daily-resting-heart-rate, daily-respiratory-rate.
//   * Filter expressions are snake_case INCLUDING the type prefix
//     (heart_rate.sample_time...), while payload keys are camelCase (heartRate).
//
// Deploy:
//   supabase functions deploy sync-google-health --project-ref jdxtlxpvimjvcfrmeeap
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import { createClient } from 'npm:@supabase/supabase-js@2'

const USER_ID = '1e133101-10e9-468a-ab81-d9b76a20e8ed'
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const TZ = 'America/Los_Angeles'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } })

const pad = (n: number) => String(n).padStart(2, '0')
const localToday = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, dd + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}
const civil = (d: string) => {
  const [year, month, day] = d.split('-').map(Number)
  return { date: { year, month, day } }
}
const filterKey = (t: string) => t.replace(/-/g, '_')
const payloadKey = (t: string) => t.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
const num = (v: unknown) => (v == null ? null : Number(v))

// ── token ───────────────────────────────────────────────────────────────────
async function accessToken() {
  const { data: row } = await db.from('google_oauth').select('*').eq('user_id', USER_ID).maybeSingle()
  if (!row?.refresh_token) throw new Error('not connected: no refresh token stored')

  // Reuse while it has >2 min left.
  if (row.access_token && row.expires_at && new Date(row.expires_at).getTime() - Date.now() > 120_000) {
    return row.access_token
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tok = await res.json()
  if (!res.ok) {
    await db.from('google_oauth').update({ last_error: tok?.error_description || tok?.error }).eq('user_id', USER_ID)
    throw new Error(`refresh failed: ${tok?.error_description || tok?.error}`)
  }
  await db.from('google_oauth').update({
    access_token: tok.access_token,
    expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
    last_refresh_at: new Date().toISOString(),
    last_error: null,
  }).eq('user_id', USER_ID)
  return tok.access_token
}

// ── v4 helpers ──────────────────────────────────────────────────────────────
async function gh(token: string, path: string, body?: unknown) {
  const res = await fetch(`https://health.googleapis.com/v4/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let j: any = null
  try { j = text ? JSON.parse(text) : null } catch { /* non-JSON error */ }
  if (!res.ok) return { ok: false, error: j?.error?.message || text.slice(0, 160) }
  return { ok: true, data: j }
}

const rollup = async (token: string, type: string, date: string) => {
  const r = await gh(token, `users/me/dataTypes/${type}/dataPoints:dailyRollUp`, {
    range: { start: civil(date), end: civil(addDays(date, 1)) }, windowSizeDays: 1,
  })
  return r.ok ? (r.data?.rollupDataPoints || []) : []
}
const list = async (token: string, type: string, filter: string, pageSize = 1440) => {
  const qs = new URLSearchParams({ pageSize: String(pageSize), filter })
  const r = await gh(token, `users/me/dataTypes/${type}/dataPoints?${qs}`)
  return r.ok ? (r.data?.dataPoints || []) : []
}
const dayFilter = (type: string, field: string, date: string) => {
  const k = filterKey(type)
  return `${k}.${field} >= "${date}" AND ${k}.${field} < "${addDays(date, 1)}"`
}
const firstNum = (obj: any, keys: string[]) => {
  if (!obj) return null
  for (const k of keys) { const v = num(obj[k]); if (v != null && !Number.isNaN(v)) return v }
  return null
}
const avgOf = (pts: any[], type: string, keys: string[]) => {
  const vals = pts.map(p => firstNum(p?.[payloadKey(type)], keys)).filter(v => v != null) as number[]
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

async function snapshot(token: string, date: string) {
  const [steps, dist, floors, azm, resting, hrv, spo2, resp, hr, sleep] = await Promise.all([
    rollup(token, 'steps', date),
    rollup(token, 'distance', date),
    rollup(token, 'floors', date),
    rollup(token, 'active-zone-minutes', date),
    list(token, 'daily-resting-heart-rate', dayFilter('daily-resting-heart-rate', 'date', date), 100),
    list(token, 'heart-rate-variability', dayFilter('heart-rate-variability', 'sample_time.civil_time', date), 500),
    list(token, 'oxygen-saturation', dayFilter('oxygen-saturation', 'sample_time.civil_time', date), 500),
    list(token, 'daily-respiratory-rate', dayFilter('daily-respiratory-rate', 'date', date), 100),
    list(token, 'heart-rate', dayFilter('heart-rate', 'sample_time.civil_time', date), 10000),
    list(token, 'sleep', dayFilter('sleep', 'interval.civil_end_time', date), 25),
  ])

  const first = (rows: any[], pick: (r: any) => any) => {
    for (const r of rows) { const v = pick(r); if (v != null) return num(v) }
    return null
  }
  const hrVals = hr.map((p: any) => num(p?.heartRate?.beatsPerMinute)).filter((v: any) => v != null) as number[]
  const azmRow = azm.find((r: any) => r?.activeZoneMinutes)?.activeZoneMinutes
  const zone = (k: string) => num(azmRow?.[k]) || 0
  const distMm = first(dist, r => firstNum(r?.distance, ['millimetersSum', 'millimeters']))

  let sleepHours: number | null = null
  if (sleep.length) {
    const mins = sleep.reduce((s: number, p: any) => s + (num(p?.sleep?.summary?.minutesAsleep) || 0), 0)
    if (mins > 0) sleepHours = Math.round((mins / 60) * 10) / 10
  }

  const round = (v: number | null, dp = 0) =>
    v == null || Number.isNaN(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp

  return {
    steps: first(steps, r => firstNum(r?.steps, ['countSum', 'count'])),
    distance_km: distMm != null ? round(distMm / 1e6, 2) : null,
    floors: first(floors, r => firstNum(r?.floors, ['countSum', 'count'])),
    active_zone_minutes: azmRow
      ? zone('sumInFatBurnHeartZone') + zone('sumInCardioHeartZone') + zone('sumInPeakHeartZone')
      : null,
    resting_hr: round(avgOf(resting, 'daily-resting-heart-rate', ['beatsPerMinute'])
      ?? (hrVals.length ? Math.min(...hrVals) : null)),
    avg_hr: hrVals.length ? round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length) : null,
    peak_hr: hrVals.length ? round(Math.max(...hrVals)) : null,
    hrv: round(avgOf(hrv, 'heart-rate-variability', ['rootMeanSquareOfSuccessiveDifferencesMilliseconds'])),
    spo2: round(avgOf(spo2, 'oxygen-saturation', ['percentage']), 1),
    respiratory_rate: round(avgOf(resp, 'daily-respiratory-rate', ['breathsPerMinute']), 1),
    sleep_hours: sleepHours,
  }
}

async function writeDay(date: string, snap: Record<string, unknown>) {
  const updates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(snap)) if (v != null) updates[k] = v
  const written = Object.keys(updates).length
  if (written) {
    await db.from('daily_logs')
      .upsert({ user_id: USER_ID, date, ...updates }, { onConflict: 'user_id,date' })
  }
  await db.from('sync_log').insert({
    target_date: date, ok: written > 0, metrics_written: written,
    detail: written ? Object.keys(updates).join(',') : 'no metrics returned',
  })
  return written
}

Deno.serve(async req => {
  let body: any = {}
  try { body = await req.json() } catch { /* cron sends none */ }
  const action = body.action || 'sync'

  try {
    const token = await accessToken()

    if (action === 'hr') {
      const date = body.date || localToday()
      const pts = await list(token, 'heart-rate', dayFilter('heart-rate', 'sample_time.civil_time', date), 10000)
      return json({
        date,
        points: pts.map((p: any) => ({
          t: p?.heartRate?.sampleTime?.physicalTime || p?.heartRate?.sampleTime?.civilTime,
          v: num(p?.heartRate?.beatsPerMinute),
        })).filter((p: any) => p.t && p.v != null),
      })
    }

    if (action === 'backfill') {
      const days = Math.min(Number(body.days) || 14, 60)
      const results: Record<string, number> = {}
      for (let i = 0; i < days; i++) {
        const d = addDays(localToday(), -i)
        results[d] = await writeDay(d, await snapshot(token, d))
      }
      return json({ action, days, results })
    }

    const date = body.date || localToday()
    const written = await writeDay(date, await snapshot(token, date))
    return json({ action: 'sync', date, metrics_written: written })
  } catch (e) {
    const detail = String((e as Error)?.message || e)
    await db.from('sync_log').insert({ target_date: localToday(), ok: false, detail })
    return json({ error: detail }, 500)
  }
})
