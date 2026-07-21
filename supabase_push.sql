-- everee health -- push scheduling
-- Run in the SQL editor for the HEALTH project only:
-- https://supabase.com/dashboard/project/jdxtlxpvimjvcfrmeeap/sql
--
-- Idempotent. Run after supabase_schedule.sql.

do $$
begin
  if to_regclass('public.push_subscriptions') is null then
    raise exception 'Run supabase_schedule.sql first (push_subscriptions missing). Nothing was changed.';
  end if;
end $$;

-- 1. The schedule, server-side.
-- Seeded from src/lib/constants.js SCHEDULE so the client and the push sender
-- cannot drift. If you edit the schedule in constants.js, re-run this file.
create table if not exists schedule_prompts (
  id text primary key,
  time text not null,          -- HH:MM at the 07:30 wake anchor
  kind text not null,
  title text not null,
  detail text,
  action text,
  water int default 0,
  critical boolean default false,
  sort_order int default 0
);

insert into schedule_prompts (id, time, kind, title, detail, action, water, critical, sort_order)
values
  ('wake', '07:30', 'rest', 'Wake + sunlight', '10 min daylight if you can', 'confirm', 0, false, 0),
  ('meds_am', '07:35', 'meds', 'Propranolol #1 + antihistamines', 'Propranolol 10mg · Loratadine 10mg · Famotidine 20mg', 'confirm', 0, false, 1),
  ('meal_1', '07:45', 'food', 'Mini meal #1', '~150 cal', 'meal', 12, false, 2),
  ('water_0830', '08:30', 'water', 'Water', '12 oz', 'water', 12, false, 3),
  ('meal_2', '09:00', 'food', 'Mini meal #2', '~150 cal', 'meal', 0, false, 4),
  ('vestibular_1', '09:30', 'movement', 'Vestibular session #1', '10 min', 'timer', 0, false, 5),
  ('water_1000', '10:00', 'water', 'Water', '16 oz', 'water', 16, false, 6),
  ('meal_3', '10:30', 'food', 'Mini meal #3', '~150 cal', 'meal', 0, false, 7),
  ('meds_mid', '11:30', 'meds', 'Propranolol #2', '10mg', 'confirm', 0, false, 8),
  ('meal_4', '12:00', 'food', 'Mini meal #4', '~200 cal + 16 oz water', 'meal', 16, false, 9),
  ('checkin_mid', '12:30', 'check', 'Symptom check-in', 'Score your five', 'checkin', 0, false, 10),
  ('rest_1300', '13:00', 'rest', 'Rest horizontal', '20 min', 'timer', 0, false, 11),
  ('meal_5', '14:00', 'food', 'Mini meal #5', '~150 cal + 12 oz water', 'meal', 12, false, 12),
  ('walk', '14:30', 'movement', 'Grounding walk', '15-20 min', 'timer', 0, false, 13),
  ('meal_6', '15:30', 'food', 'Mini meal #6', '~150 cal + 12 oz water', 'meal', 12, false, 14),
  ('vestibular_2', '16:00', 'movement', 'Vestibular session #2', '10 min', 'timer', 0, false, 15),
  ('meal_7', '17:00', 'food', 'Mini meal #7', '~150 cal', 'meal', 0, false, 16),
  ('meds_pm', '17:30', 'meds', 'Propranolol #3', '10mg -- do not let this one run late', 'confirm', 0, true, 17),
  ('meal_8', '18:30', 'food', 'Mini meal #8 + Famotidine PM', '~250 cal + 12 oz water', 'meal', 12, false, 18),
  ('checkin_pm', '19:00', 'check', 'Symptom check-in', 'Score your five', 'checkin', 0, false, 19),
  ('meal_9', '20:00', 'food', 'Mini meal #9', '~200 cal + 8 oz water', 'meal', 8, false, 20),
  ('winddown', '20:30', 'rest', 'Wind-down', 'Screens off · magnesium', 'confirm', 0, false, 21),
  ('bed', '21:00', 'rest', 'In bed', 'Aim 9-10h to clear 7-8h asleep', 'confirm', 0, false, 22)
on conflict (id) do update set
  time = excluded.time, kind = excluded.kind, title = excluded.title,
  detail = excluded.detail, action = excluded.action, water = excluded.water,
  critical = excluded.critical, sort_order = excluded.sort_order;

-- Seed settings row if absent.
insert into schedule_settings (user_id, wake_time, enabled, timezone)
values ('1e133101-10e9-468a-ab81-d9b76a20e8ed', '07:30', true, 'America/Los_Angeles')
on conflict (user_id) do nothing;

alter table schedule_prompts enable row level security;
drop policy if exists "anon_all_schedule_prompts" on schedule_prompts;
create policy "anon_all_schedule_prompts" on schedule_prompts for all using (true) with check (true);

-- 2. Cron. Requires pg_cron and pg_net (both available on Supabase).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> below before running section 2.
-- The service-role key is required to invoke an Edge Function from SQL; it is
-- stored inside the database, not in the app bundle.
--
--   select cron.unschedule('everee-push');   -- if re-running
--
--   select cron.schedule(
--     'everee-push',
--     '*/5 * * * *',
--     $$
--       select net.http_post(
--         url     := 'https://jdxtlxpvimjvcfrmeeap.supabase.co/functions/v1/send-scheduled-push',
--         headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--         body    := '{}'::jsonb
--       );
--     $$
--   );
--
-- Verify:   select * from cron.job;
--           select * from cron.job_run_details order by start_time desc limit 10;

notify pgrst, 'reload schema';
