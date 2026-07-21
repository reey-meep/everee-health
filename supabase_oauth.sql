-- everee health -- server-side Google OAuth + unattended sync
-- Run in the SQL editor for the HEALTH project only:
-- https://supabase.com/dashboard/project/jdxtlxpvimjvcfrmeeap/sql
--
-- Idempotent. Run after supabase_trends.sql.
--
-- WHY: the app used implicit OAuth, so the access token lived in the browser
-- and expired after ~1 hour with no way to renew it. Data only saved on the
-- rare occasion Ree happened to reconnect and open the app, which left the
-- history full of holes and the correlations weak.
--
-- Authorisation-code flow returns a refresh token, which an Edge Function can
-- use to mint fresh access tokens indefinitely. Sync then runs on a schedule
-- with the app closed, and past days can be backfilled.

do $$
begin
  if to_regclass('public.daily_logs') is null then
    raise exception 'WRONG PROJECT: daily_logs not found. Nothing was changed.';
  end if;
end $$;

-- Token store. Deliberately NOT readable with the anon key -- the refresh token
-- is a long-lived credential to Ree's health data, unlike the access tokens the
-- browser used to hold.
create table if not exists google_oauth (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null unique,
  refresh_token text,
  access_token text,
  expires_at timestamptz,
  scope text,
  last_refresh_at timestamptz,
  last_error text,
  updated_at timestamptz default now()
);

alter table google_oauth enable row level security;

-- No anon policy at all: only the service role (the Edge Functions) can touch
-- this table. Every other table in this project is anon-readable; this one must
-- not be.
drop policy if exists "anon_all_google_oauth" on google_oauth;

-- Audit of each sync run, so gaps are visible rather than silent.
create table if not exists sync_log (
  id uuid default gen_random_uuid() primary key,
  ran_at timestamptz default now(),
  target_date date,
  ok boolean,
  metrics_written int default 0,
  detail text
);

alter table sync_log enable row level security;
drop policy if exists "anon_read_sync_log" on sync_log;
create policy "anon_read_sync_log" on sync_log for select using (true);

-- The app must be able to tell whether it's connected, but must NOT be able to
-- read the tokens. This view exposes a boolean and a timestamp, nothing else.
create or replace view google_status as
  select user_id,
         (refresh_token is not null) as connected,
         last_refresh_at,
         last_error
  from google_oauth;

grant select on google_status to anon;

notify pgrst, 'reload schema';

-- ── Cron (run after deploying the sync function) ────────────────────────────
-- Replace <SERVICE_ROLE_KEY>, then run. Every 30 minutes keeps today's row
-- current without hammering the API.
--
--   select cron.unschedule('everee-google-sync');   -- if re-running
--
--   select cron.schedule(
--     'everee-google-sync',
--     '*/30 * * * *',
--     $$
--       select net.http_post(
--         url     := 'https://jdxtlxpvimjvcfrmeeap.supabase.co/functions/v1/sync-google-health',
--         headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--         body    := '{"action":"sync"}'::jsonb
--       );
--     $$
--   );
--
-- Verify:  select * from sync_log order by ran_at desc limit 10;
