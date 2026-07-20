-- everee health Supabase schema
-- Run this in the Supabase SQL editor at https://jdxtlxpvimjvcfrmeeap.supabase.co

-- DAILY LOGS
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
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

-- PRACTICE LOGS
create table if not exists practice_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  date date not null,
  practice_id text not null,
  completed boolean default false,
  completed_at timestamptz,
  unique(user_id, date, practice_id)
);

-- EPISODES
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
  created_at timestamptz default now()
);

-- FOOD ENTRIES
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

-- TRIGGER FOODS
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

-- MEDICATIONS
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

-- MEDICATION LOGS
create table if not exists medication_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  medication_id uuid references medications(id),
  medication_name text,
  taken_at timestamptz not null default now(),
  dose_number int,
  notes text
);

-- VESTIBULAR SESSIONS
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

-- Enable Row Level Security on all tables
alter table daily_logs enable row level security;
alter table practice_logs enable row level security;
alter table episodes enable row level security;
alter table food_entries enable row level security;
alter table trigger_foods enable row level security;
alter table medications enable row level security;
alter table medication_logs enable row level security;
alter table vestibular_sessions enable row level security;

-- RLS policies (anon key access for single-user personal app)
create policy "anon_all_daily_logs" on daily_logs for all using (true) with check (true);
create policy "anon_all_practice_logs" on practice_logs for all using (true) with check (true);
create policy "anon_all_episodes" on episodes for all using (true) with check (true);
create policy "anon_all_food_entries" on food_entries for all using (true) with check (true);
create policy "anon_all_trigger_foods" on trigger_foods for all using (true) with check (true);
create policy "anon_all_medications" on medications for all using (true) with check (true);
create policy "anon_all_medication_logs" on medication_logs for all using (true) with check (true);
create policy "anon_all_vestibular_sessions" on vestibular_sessions for all using (true) with check (true);

-- HEART RATE TAGS
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

alter table heart_rate_tags enable row level security;
create policy "anon_all_heart_rate_tags" on heart_rate_tags for all using (true) with check (true);


-- Add auto-context columns to episodes (run if table already exists)
alter table episodes add column if not exists cycle_phase_at_episode text;
alter table episodes add column if not exists weather_pressure_at_episode int;
alter table episodes add column if not exists heart_rate_during int;

-- Add resting_hr, hrv, spo2 to daily_logs
alter table daily_logs add column if not exists resting_hr numeric(5,1);
alter table daily_logs add column if not exists hrv numeric(5,1);
alter table daily_logs add column if not exists spo2 numeric(4,1);
alter table daily_logs add column if not exists walk_minutes int;
alter table daily_logs add column if not exists weights_done boolean default false;
