# Google Health — unattended sync setup

Fitbit data now syncs server-side on a schedule. You connect once and it stays
connected; you no longer need to reconnect hourly or open the app for data to
save.

## What changed and why

The app used **implicit OAuth**: the access token lived in the browser and
expired after about an hour, with no way to renew it. Data only saved on the
rare occasion you reconnected *and* opened the app — which is why `steps`,
`hrv`, `resting_hr` and `spo2` were all still null.

It now uses the **authorisation-code flow**. Google returns a refresh token, an
Edge Function keeps it alive, and a cron syncs with the app closed. Past days
can be backfilled.

**The browser no longer holds any Google token.** The refresh token lives in
`google_oauth`, which has no anon policy — only the Edge Functions can read it.
The app sees a `google_status` view exposing a boolean and a timestamp, nothing
more.

---

## 1. Get a client secret from Google

Console → APIs & Services → Credentials → your **everee web client**
(`777031835250-sadrm1559...`).

- Copy the **Client secret**
- Under **Authorised redirect URIs**, add exactly:

```
https://jdxtlxpvimjvcfrmeeap.supabase.co/functions/v1/google-oauth-callback
```

Keep the existing `https://reey-meep.github.io/everee-health/` entry too.

## 2. Run the SQL

At https://supabase.com/dashboard/project/jdxtlxpvimjvcfrmeeap/sql, run
`supabase_oauth.sql`. Leave the cron block at the bottom commented for now.

## 3. Deploy both functions

```bash
cd ~/Downloads/everee-health
supabase functions deploy google-oauth-callback --no-verify-jwt --project-ref jdxtlxpvimjvcfrmeeap
supabase functions deploy sync-google-health --project-ref jdxtlxpvimjvcfrmeeap
```

`--no-verify-jwt` on the callback is required — Google calls it directly and has
no Supabase JWT.

Then set secrets in **Project Settings → Edge Functions → Secrets**:

| Secret | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | `777031835250-sadrm1559ahp1ntjcqoghgkm3d32fi2o.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | from step 1 |
| `APP_URL` | `https://reey-meep.github.io/everee-health/` |

> Paste the client secret straight from the Google console into Supabase. Don't
> put it in a chat — it can mint tokens for your health data.

## 4. Connect

App → **More → Fitbit → Connect Fitbit**. Google will ask for consent (it must
re-prompt, otherwise no refresh token is issued). You'll land back on the app
with "Fitbit connected".

Then **Sync now**. It should report how many metrics were written. **Backfill 14
days** pulls history for the past fortnight.

## 5. Schedule it

Back in the SQL editor, uncomment the cron block in `supabase_oauth.sql`,
replace `<SERVICE_ROLE_KEY>`, and run. It syncs every 30 minutes.

Check it's working:

```sql
select * from sync_log order by ran_at desc limit 10;
```

The **Recent syncs** list in More shows the same thing.

---

## Troubleshooting

**"Google did not return a refresh token"** — Google only issues one on first
consent. Revoke at https://myaccount.google.com/permissions and connect again.

**Sync says "connected, but Google returned nothing"** — the API is reachable
but has no data for that day. Check the Fitbit app has synced to Google.

**`sync_log` shows `refresh failed`** — the refresh token was revoked or the
client secret is wrong. Reconnect.

## Known limitation

Rylie's live heart-rate view polls once a minute, not continuously. Fitbit syncs
to Google on its own cadence, so the newest reading is typically minutes old —
this was never real-time, and the previous 2-second polling just burned API
calls without getting fresher data.
