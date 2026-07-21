-- everee health -- persist the daily Fitbit snapshot so trends can be charted
-- Run in the SQL editor for the HEALTH project only:
-- https://supabase.com/dashboard/project/jdxtlxpvimjvcfrmeeap/sql
--
-- Idempotent.
--
-- WHY: fetchDaySnapshot pulls steps, HRV, resting HR, SpO2 etc. from Google
-- Health on every app open, but only sleep_hours was ever written to
-- daily_logs. Everything else was displayed and thrown away, so there was no
-- history to chart -- MetricDetail had nothing to draw. These columns give each
-- metric somewhere to land, and the app now writes the snapshot on each sync.
--
-- Note: this starts history from today. Charts stay sparse until a few days
-- accumulate; it cannot backfill what was never stored.

do $$
begin
  if to_regclass('public.daily_logs') is null then
    raise exception 'WRONG PROJECT: daily_logs not found. Nothing was changed.';
  end if;
end $$;

alter table daily_logs add column if not exists steps int;
alter table daily_logs add column if not exists distance_km numeric(6,2);
alter table daily_logs add column if not exists floors int;
alter table daily_logs add column if not exists active_zone_minutes int;
alter table daily_logs add column if not exists avg_hr int;
alter table daily_logs add column if not exists peak_hr int;
alter table daily_logs add column if not exists respiratory_rate numeric(4,1);

-- resting_hr, hrv, spo2, sleep_hours, walk_minutes already exist.

notify pgrst, 'reload schema';

-- Verify:
--   select date, steps, resting_hr, hrv, spo2, sleep_hours
--   from daily_logs order by date desc limit 7;
