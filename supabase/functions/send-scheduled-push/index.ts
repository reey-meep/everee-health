// everee health -- scheduled push sender
//
// Invoked by pg_cron every 5 minutes. Works out which prompts fell due in the
// window just past, skips anything already actioned, and pushes to every
// registered subscription.
//
// Why server-side at all: there is no browser API for scheduling a local
// notification. Chrome's Notification Triggers was abandoned, and a service
// worker is killed after ~30s idle, so nothing on the device can hold a timer
// for hours. The schedule has to be driven from outside the phone.
//
// Deploy:
//   supabase functions deploy send-scheduled-push --project-ref jdxtlxpvimjvcfrmeeap
// Secrets (Project Settings > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically)

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const WINDOW_MIN = 5          // must match the cron interval
const CRITICAL_REPEATS = [15, 30]  // re-alert an unconfirmed critical dose

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:capri.yeakley@alpha.school'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
const db = createClient(SUPABASE_URL, SERVICE_KEY)

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Current wall-clock minutes and calendar date in the user's timezone.
function localNow(tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

Deno.serve(async () => {
  const log: string[] = []
  try {
    const { data: settings } = await db.from('schedule_settings').select('*').limit(1).maybeSingle()
    if (!settings?.enabled) return json({ skipped: 'schedule disabled' })

    const tz = settings.timezone || 'America/Los_Angeles'
    const { date, minutes: nowMin } = localNow(tz)
    const shift = toMin(settings.wake_time || '07:30') - toMin('07:30')
    const disabled: string[] = settings.disabled_prompts || []

    const { data: prompts } = await db.from('schedule_prompts').select('*').order('sort_order')
    if (!prompts?.length) return json({ skipped: 'no prompts' })

    // Today's completions, so an already-actioned prompt is never re-sent.
    const { data: logRow } = await db
      .from('daily_logs').select('schedule_completions')
      .eq('user_id', settings.user_id).eq('date', date).maybeSingle()
    const completions = logRow?.schedule_completions || {}

    // Which prompts are due in this window?
    const due = []
    for (const p of prompts) {
      if (disabled.includes(p.id)) continue
      if (completions[p.id]) continue                    // done or skipped
      const at = toMin(p.time) + shift
      const delta = nowMin - at
      const firstFire = delta >= 0 && delta < WINDOW_MIN
      // A critical dose that is still unconfirmed re-alerts at +15 and +30.
      const repeat = p.critical && CRITICAL_REPEATS.some(r => delta >= r && delta < r + WINDOW_MIN)
      if (firstFire || repeat) due.push({ ...p, delta, repeat: !!repeat })
    }
    if (!due.length) return json({ date, nowMin, due: 0 })

    const { data: subs } = await db.from('push_subscriptions').select('*')
    if (!subs?.length) return json({ due: due.length, sent: 0, note: 'no subscriptions' })

    let sent = 0
    for (const p of due) {
      // Idempotency: one row per prompt per day per fire-stage.
      const stage = p.repeat ? `r${Math.floor(p.delta / 15) * 15}` : 'first'
      const scheduledFor = `${date}T00:00:00Z`
      const { error: qErr } = await db.from('push_queue').insert({
        user_id: settings.user_id,
        prompt_id: `${p.id}:${stage}`,
        scheduled_for: scheduledFor,
        title: p.title,
        body: p.detail,
        critical: p.critical,
      })
      if (qErr) { log.push(`skip ${p.id} (${stage}): already queued`); continue }

      const payload = JSON.stringify({
        title: p.repeat ? `Still due: ${p.title}` : p.title,
        body: p.detail || '',
        promptId: p.id,
        water: p.water || 0,
        critical: p.critical,
      })

      for (const s of subs) {
        const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
        try {
          await webpush.sendNotification(sub, payload, { TTL: 900, urgency: p.critical ? 'high' : 'normal' })
          sent++
          await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), last_error: null }).eq('id', s.id)
        } catch (e: any) {
          const code = e?.statusCode
          log.push(`send fail ${p.id} -> ${code}`)
          // 404/410 mean the subscription is dead; drop it so it stops retrying.
          if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
          else await db.from('push_subscriptions').update({ last_error: String(e?.message || e) }).eq('id', s.id)
        }
      }
      await db.from('push_queue')
        .update({ sent_at: new Date().toISOString() })
        .eq('user_id', settings.user_id).eq('prompt_id', `${p.id}:${stage}`).eq('scheduled_for', scheduledFor)
    }

    return json({ date, nowMin, due: due.map(d => d.id), sent, log })
  } catch (e: any) {
    return json({ error: String(e?.message || e), log }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
