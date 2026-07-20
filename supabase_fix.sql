-- everee health -- corrective migration
-- Run this ONCE in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jdxtlxpvimjvcfrmeeap/sql
--
-- WHY THIS EXISTS:
-- Only `food_entries` was ever created, as a stub missing 7 of its 11 columns.
-- All 8 other tables do not exist. Because supabase_schema.sql uses
-- `create table if not exists`, re-running it does NOT repair the stub -- Postgres
-- sees the table, skips it, and the missing columns stay missing. This file drops
-- the stub (verified 0 rows) and builds everything from scratch.
--
-- This script is idempotent: safe to run more than once.

-- 1. DROP THE BROKEN STUB (verified empty: 0 rows, no data loss)
drop table if exists food_entries cascade;

-- 2. TABLES

create table if not exists daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  date date not null,
  scores jsonb default '{}',
  mood_score int check (mood_score between 1 and 5),
  sleep_hours numeric(3,1),
  daily_wins text[] default '{}',
  cycle_day int,
  cycle_phase text,
  weather_temp int,
  weather_conditions text,
  weather_pressure int,
  notes text,
  task_completion_count int default 0,
  resting_hr numeric(5,1),
  hrv numeric(5,1),
  spo2 numeric(4,1),
  walk_minutes int,
  weights_done boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

create table if not exists practice_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  date date not null,
  practice_id text not null,
  completed boolean default false,
  completed_at timestamptz,
  unique(user_id, date, practice_id)
);

create table if not exists episodes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  episode_type text not null,
  severity int check (severity between 1 and 5),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes int,
  triggers text[] default '{}',
  symptoms_present text[] default '{}',
  what_helped text[] default '{}',
  recovery_minutes int,
  notes text,
  heart_rate_peak int,
  heart_rate_data jsonb,
  cycle_phase_at_episode text,
  weather_pressure_at_episode int,
  heart_rate_during int,
  created_at timestamptz default now()
);

create table if not exists food_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  date date not null,
  meal_type text,
  time text,
  description text not null,
  calories int,
  protein_grams numeric(5,1),
  dao_taken boolean default false,
  oxbile_taken boolean default false,
  flagged_triggers text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists trigger_foods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  food text not null,
  trigger_category text,
  severity text check (severity in ('mild','moderate','severe')),
  date_identified date,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists medications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  name text not null,
  dose text,
  schedule text,
  active boolean default true,
  notes text,
  added_at timestamptz default now()
);

create table if not exists medication_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  medication_id uuid references medications(id),
  medication_name text,
  taken_at timestamptz not null default now(),
  dose_number int,
  notes text
);

create table if not exists vestibular_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  date date not null,
  session_number int check (session_number between 1 and 5),
  exercises_done text,
  notes text,
  completed boolean default false,
  unique(user_id, date, session_number)
);

create table if not exists heart_rate_tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  tagged_at timestamptz not null default now(),
  category text not null,
  label text,
  heart_rate_at_tag int,
  notes text,
  created_at timestamptz default now()
);

-- 3. ROW LEVEL SECURITY
alter table daily_logs          enable row level security;
alter table practice_logs       enable row level security;
alter table episodes            enable row level security;
alter table food_entries        enable row level security;
alter table trigger_foods       enable row level security;
alter table medications         enable row level security;
alter table medication_logs     enable row level security;
alter table vestibular_sessions enable row level security;
alter table heart_rate_tags     enable row level security;

-- 4. POLICIES (single-user personal app: anon key has full access)
-- Postgres has no `create policy if not exists`, so drop first to stay idempotent.
drop policy if exists "anon_all_daily_logs"          on daily_logs;
drop policy if exists "anon_all_practice_logs"       on practice_logs;
drop policy if exists "anon_all_episodes"            on episodes;
drop policy if exists "anon_all_food_entries"        on food_entries;
drop policy if exists "anon_all_trigger_foods"       on trigger_foods;
drop policy if exists "anon_all_medications"         on medications;
drop policy if exists "anon_all_medication_logs"     on medication_logs;
drop policy if exists "anon_all_vestibular_sessions" on vestibular_sessions;
drop policy if exists "anon_all_heart_rate_tags"     on heart_rate_tags;

create policy "anon_all_daily_logs"          on daily_logs          for all using (true) with check (true);
create policy "anon_all_practice_logs"       on practice_logs       for all using (true) with check (true);
create policy "anon_all_episodes"            on episodes            for all using (true) with check (true);
create policy "anon_all_food_entries"        on food_entries        for all using (true) with check (true);
create policy "anon_all_trigger_foods"       on trigger_foods       for all using (true) with check (true);
create policy "anon_all_medications"         on medications         for all using (true) with check (true);
create policy "anon_all_medication_logs"     on medication_logs     for all using (true) with check (true);
create policy "anon_all_vestibular_sessions" on vestibular_sessions for all using (true) with check (true);
create policy "anon_all_heart_rate_tags"     on heart_rate_tags     for all using (true) with check (true);

-- 5. Reload PostgREST schema cache so the API sees the new tables immediately.
notify pgrst, 'reload schema';
