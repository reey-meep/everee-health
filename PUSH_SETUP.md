# Push notifications — setup

Everything on the app side is deployed. These are the three things only you can do.

## Why this needs a server at all

There is no browser API for scheduling a local notification. Chrome's
Notification Triggers (`showTrigger` / `TimestampTrigger`) was abandoned by
Google, and a service worker is killed after ~30 seconds idle, so nothing on the
phone can hold a timer for hours. Every scheduled prompt has to be pushed from
outside the device.

**Web push is best-effort.** Android battery optimisation can delay or drop it,
and Chrome makes no delivery-time guarantee. Keep a phone alarm for the 17:30
propranolol dose. The app is the log and the picture; it should not be the only
thing standing between you and that dose.

---

## 1. Run the SQL

Open the SQL editor **pinned to the health project**:

    https://supabase.com/dashboard/project/jdxtlxpvimjvcfrmeeap/sql

Paste `supabase_push.sql` and run it. It creates `schedule_prompts` and seeds
all 23 prompts (generated from `src/lib/constants.js`, so client and server
cannot drift), plus a settings row.

It stops with an error if `supabase_schedule.sql` hasn't been run first.

**Leave section 2 (the `cron.schedule` block) commented for now** — it needs the
function deployed first, and your service-role key.

## 2. Deploy the Edge Function

Needs the Supabase CLI (`brew install supabase/tap/supabase`), then:

    cd ~/Downloads/everee-health
    supabase login
    supabase functions deploy send-scheduled-push --project-ref jdxtlxpvimjvcfrmeeap

Then set three secrets in **Project Settings → Edge Functions → Secrets**:

| Secret | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key in `~/Downloads/everee-vapid-keys.txt` |
| `VAPID_PRIVATE_KEY` | the private key in that same file |
| `VAPID_SUBJECT` | `mailto:capri.yeakley@alpha.school` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

> Copy the private key straight from the file. Don't paste it into a chat —
> unlike the anon key it bypasses every RLS policy on your health data.

Test it manually before wiring the cron:

    curl -X POST \
      -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
      https://jdxtlxpvimjvcfrmeeap.supabase.co/functions/v1/send-scheduled-push

It returns JSON showing the local date, current minute, and which prompts it
considered due. Outside a prompt window `due: 0` is the correct answer.

## 3. Schedule the cron

Back in the SQL editor, uncomment section 2 of `supabase_push.sql`, replace
`<SERVICE_ROLE_KEY>`, and run it. It fires every 5 minutes.

Verify:

    select * from cron.job;
    select * from cron.job_run_details order by start_time desc limit 10;

---

## Turning it on in the app

**More → Reminders → Turn on reminders.** Chrome will ask for permission; that
prompt only appears on a real interaction, so it has to be done on your phone.

Then **Send test** — that fires a notification straight through the service
worker without involving the server. If the test works but scheduled prompts
don't, the problem is in step 2 or 3, not the device.

## How the sender behaves

- Runs every 5 minutes, sends prompts whose time fell in the window just past
- Skips anything already marked done or skipped today
- `push_queue` gives idempotency — a prompt can't fire twice for the same day
- **The 17:30 propranolol re-alerts at +15 and +30 minutes** if still
  unconfirmed, with `requireInteraction` so it stays on screen
- Dead subscriptions (404/410) are deleted automatically
- Respects `schedule_settings.enabled` and `disabled_prompts`

## Notification actions

Each prompt carries **Done ✓** and **Skip**. Tapping either writes to
`daily_logs.schedule_completions` from inside the service worker — no app open
needed. Water prompts add their ounces on Done, matching `completePrompt()`.

## If you change the schedule

`src/lib/constants.js` is the source of truth for the UI; `schedule_prompts` is
what the sender reads. **Re-run `supabase_push.sql` after editing the schedule**
or the two will drift.
