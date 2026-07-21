/* everee health service worker -- push delivery + one-tap logging.
 *
 * Notification actions write straight to Supabase from the worker, so "Done"
 * logs the prompt without opening the app.
 */

const SUPABASE_URL = 'https://jdxtlxpvimjvcfrmeeap.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkeHRseHB2aW1qdmNmcm1lZWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjI3MjMsImV4cCI6MjA5NDE5ODcyM30.bM2UrDjohZMAPubrLQWFIr39pkh0vYlhz1KQPmAzDsI'
const USER_ID = '1e133101-10e9-468a-ab81-d9b76a20e8ed'
const APP_PATH = '/everee-health/'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const headers = {
  apikey: SUPABASE_ANON,
  Authorization: `Bearer ${SUPABASE_ANON}`,
  'Content-Type': 'application/json',
}

self.addEventListener('push', event => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch (e) { d = { title: 'everee health' } }

  const critical = !!d.critical
  const actions = d.promptId
    ? [{ action: 'done', title: 'Done ✓' }, { action: 'skip', title: 'Skip' }]
    : []

  event.waitUntil(self.registration.showNotification(d.title || 'everee health', {
    body: d.body || '',
    tag: d.promptId || 'everee',
    // Critical prompts (the 17:30 propranolol) stay on screen and re-alert
    // rather than being quietly collapsed.
    renotify: critical,
    requireInteraction: critical,
    vibrate: critical ? [200, 100, 200, 100, 200] : [100],
    data: { promptId: d.promptId, water: d.water || 0, critical },
    actions,
  }))
})

// Records the prompt result, mirroring completePrompt() in src/lib/db.js.
async function record(promptId, water, status) {
  const date = todayKey()
  const q = `${SUPABASE_URL}/rest/v1/daily_logs?user_id=eq.${USER_ID}&date=eq.${date}&select=schedule_completions,water_oz`
  const cur = await fetch(q, { headers }).then(r => r.json()).catch(() => [])
  const row = Array.isArray(cur) && cur[0] ? cur[0] : {}
  const completions = { ...(row.schedule_completions || {}) }
  const already = completions[promptId] && completions[promptId].status === 'done'
  completions[promptId] = { status, at: new Date().toISOString() }

  const body = { user_id: USER_ID, date, schedule_completions: completions }
  if (status === 'done' && !already && water) {
    body.water_oz = Number(row.water_oz || 0) + Number(water)
  }
  await fetch(`${SUPABASE_URL}/rest/v1/daily_logs?on_conflict=user_id,date`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(body),
  })
}

self.addEventListener('notificationclick', event => {
  const { promptId, water } = event.notification.data || {}
  const action = event.action
  event.notification.close()

  if (action === 'done' || action === 'skip') {
    event.waitUntil(record(promptId, water, action === 'done' ? 'done' : 'skipped'))
    return
  }

  // Plain tap: focus an open tab or open the app.
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const hit = all.find(c => c.url.includes(APP_PATH))
    if (hit) return hit.focus()
    return self.clients.openWindow(APP_PATH)
  })())
})
