import { supabase } from './supabase'

// Server-backed Google Health.
//
// The browser holds no Google token at all now. Authorisation-code flow sends
// Google to an Edge Function, which exchanges the code for a refresh token and
// keeps it server-side; a cron then syncs with the app closed. Previously the
// implicit-flow access token sat in localStorage and expired after ~1 hour, so
// data only landed on the rare occasions Ree reconnected and opened the app.

const FUNCTIONS = 'https://jdxtlxpvimjvcfrmeeap.supabase.co/functions/v1'
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID
  || '777031835250-sadrm1559ahp1ntjcqoghgkm3d32fi2o.apps.googleusercontent.com'
const REDIRECT_URI = `${FUNCTIONS}/google-oauth-callback`

const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
].join(' ')

// access_type=offline + prompt=consent are what make Google return a refresh
// token. Without both, it issues an access token that dies in an hour and the
// whole server-side arrangement is pointless.
export function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// Reads the google_status view -- a boolean and timestamps. The tokens
// themselves are not readable with the anon key.
export async function getConnectionStatus() {
  const { data, error } = await supabase.from('google_status').select('*').maybeSingle()
  if (error) { console.error(error); return { connected: false, error: error.message } }
  return {
    connected: !!data?.connected,
    lastRefreshAt: data?.last_refresh_at || null,
    lastError: data?.last_error || null,
  }
}

async function callSync(body) {
  const res = await fetch(`${FUNCTIONS}/sync-google-health`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabase.supabaseKey}`,
      apikey: supabase.supabaseKey,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` }
  return { ok: true, ...json }
}

export const syncToday = () => callSync({ action: 'sync' })
export const backfill = days => callSync({ action: 'backfill', days })
export const fetchHrDay = date => callSync({ action: 'hr', date })

// Latest reading available. Note this is not live: Fitbit syncs to Google on
// its own cadence, so the newest point is typically minutes old. Polling faster
// than that just burns API calls.
export async function fetchLatestHr() {
  const r = await fetchHrDay(undefined)
  if (!r.ok || !r.points?.length) return null
  const last = r.points[r.points.length - 1]
  return { bpm: last.v, at: last.t }
}

// When did each day last sync, and did it write anything?
export async function getSyncLog(limit = 10) {
  const { data, error } = await supabase
    .from('sync_log').select('*').order('ran_at', { ascending: false }).limit(limit)
  if (error) { console.error(error); return [] }
  return data || []
}
