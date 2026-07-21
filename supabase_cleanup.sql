-- everee health -- tidy-up
-- Run in the SQL editor for the HEALTH project only:
-- https://supabase.com/dashboard/project/jdxtlxpvimjvcfrmeeap/sql
--
-- Optional. Nothing depends on this; it just removes data the app no longer
-- reads so future analytics aren't looking at dead rows.

do $$
begin
  if to_regclass('public.practice_logs') is null then
    raise exception 'WRONG PROJECT: practice_logs not found. Nothing was changed.';
  end if;
end $$;

-- 1. Show what will go, before it goes.
select practice_id, count(*) as rows
from practice_logs
where practice_id in ('cycle', 'food_log', 'episode_log', 'packet')
group by practice_id
order by practice_id;

-- 2. The 'tracking' task group was removed from the app -- it duplicated things
-- already recorded elsewhere (cycle day on daily_logs, food in food_entries,
-- episodes in episodes). These rows are now orphaned: nothing reads them, and
-- they'd otherwise be counted as practices that can never be completed.
delete from practice_logs
where practice_id in ('cycle', 'food_log', 'episode_log', 'packet');

-- 3. calories_logged is no longer written or read. The food diary is the single
-- source of calories; this column held the schedule's old estimates and would
-- double-count if anything started reading it again.
update daily_logs set calories_logged = 0 where calories_logged <> 0;

-- Verify:
--   select count(*) from practice_logs
--     where practice_id in ('cycle','food_log','episode_log','packet');   -- expect 0
--   select date, calories_logged from daily_logs order by date desc limit 5;
