-- everee health -- separate overnight sleep from naps
-- Run in the SQL editor for the HEALTH project only:
-- https://supabase.com/dashboard/project/jdxtlxpvimjvcfrmeeap/sql
--
-- Idempotent.
--
-- WHY: sleep_hours summed every sleep block Google returned, so 5.8h overnight
-- plus a 2.1h afternoon nap was stored as 7.9h. That reads as clearing the 7h
-- minimum when the night itself fell nearly 1.2h short.
--
-- It also flattens the correlations: a short night rescued by a nap and a genuine
-- 7.9h night are physiologically different, but were indistinguishable in the data.
--
-- sleep_hours now means the overnight block only. Naps are counted separately.

do $$
begin
  if to_regclass('public.daily_logs') is null then
    raise exception 'WRONG PROJECT: daily_logs not found. Nothing was changed.';
  end if;
end $$;

alter table daily_logs add column if not exists nap_minutes int;
alter table daily_logs add column if not exists total_sleep_hours numeric(4,1);

notify pgrst, 'reload schema';

-- Verify after the next sync:
--   select date, sleep_hours, nap_minutes, total_sleep_hours
--   from daily_logs order by date desc limit 7;
--
-- For 2026-07-20 expect roughly: sleep_hours 5.8, nap_minutes 125,
-- total_sleep_hours 7.9
