-- everee health -- schedule + push notifications
-- Run in the SQL editor for the HEALTH project only:
-- https://supabase.com/dashboard/project/jdxtlxpvimjvcfrmeeap/sql
--
-- Idempotent: safe to run more than once.

-- Guard: refuse to run anywhere but the everee-health database.
do $$
begin
  if to_regclass('public.daily_logs') is null or to_regclass('public.practice_logs') is null then
    raise exception
      'WRONG PROJECT: expected the everee-health database (ref jdxtlxpvimjvcfrmeeap). Nothing was changed.';
  end if;
end $$;

-- 1. Daily totals + which scheduled prompts were actioned.
alter table daily_logs add column if not exists water_oz numeric(6,1) default 0;
alter table daily_logs add column if not exists calories_logged int default 0;
-- schedule_completions: { "<prompt_id>": { "status": "done"|"skipped", "at": "<iso8601>" } }
alter table daily_logs add column if not exists schedule_completions jsonb default '{}'::jsonb;

-- 2. Web Push subscriptions (one row per browser/device).
create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  last_success_at timestamptz,
  last_error text
);

-- 3. Outbound queue. The cron job inserts due prompts here; the Edge Function
-- drains it. A queue (rather than firing directly from cron) means a failed
-- send can be retried and inspected instead of vanishing.
create table if not exists push_queue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  prompt_id text not null,
  scheduled_for timestamptz not null,
  title text not null,
  body text,
  critical boolean default false,
  sent_at timestamptz,
  attempts int default 0,
  last_error text,
  created_at timestamptz default now(),
  unique(user_id, prompt_id, scheduled_for)
);

create index if not exists push_queue_pending_idx
  on push_queue (scheduled_for)
  where sent_at is null;

-- 4. Per-prompt enable/disable + wake-time offset.
create table if not exists schedule_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null unique,
  wake_time text default '07:30',
  enabled boolean default true,
  -- disabled_prompts: ["water_0830", ...]
  disabled_prompts text[] default '{}',
  snooze_minutes int default 15,
  timezone text default 'America/Los_Angeles',
  updated_at timestamptz default now()
);

-- 5. RLS
alter table push_subscriptions enable row level security;
alter table push_queue         enable row level security;
alter table schedule_settings  enable row level security;

drop policy if exists "anon_all_push_subscriptions" on push_subscriptions;
drop policy if exists "anon_all_push_queue"         on push_queue;
drop policy if exists "anon_all_schedule_settings"  on schedule_settings;

create policy "anon_all_push_subscriptions" on push_subscriptions for all using (true) with check (true);
create policy "anon_all_push_queue"         on push_queue         for all using (true) with check (true);
create policy "anon_all_schedule_settings"  on schedule_settings  for all using (true) with check (true);

notify pgrst, 'reload schema';
