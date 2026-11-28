-- v4.5.x: daily habit loop — one-tap "Workout done", reminder time and best streak.
-- Guests keep this on their phone (localStorage). After Google / email-link login the app copies it here.
-- Profiles, workouts (PRs) and body_measurements (bodyweight graph) already exist (0002) and are reused.
-- Every row belongs to one user; RLS lets a user see and change only their own rows.
-- Run in the Supabase SQL editor AFTER 0001–0010. Safe to run twice.

create table if not exists public.workout_done (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  minutes int check (minutes is null or minutes between 1 and 600),
  focus text,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.workout_done enable row level security;
drop policy if exists "workout_done_select_own" on public.workout_done;
drop policy if exists "workout_done_insert_own" on public.workout_done;
drop policy if exists "workout_done_update_own" on public.workout_done;
drop policy if exists "workout_done_delete_own" on public.workout_done;
create policy "workout_done_select_own" on public.workout_done for select to authenticated using (user_id = auth.uid());
create policy "workout_done_insert_own" on public.workout_done for insert to authenticated with check (user_id = auth.uid());
create policy "workout_done_update_own" on public.workout_done for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workout_done_delete_own" on public.workout_done for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.workout_done to authenticated;

create table if not exists public.user_habits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminder_enabled boolean not null default false,
  reminder_time text not null default '18:00' check (reminder_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  reminder_days int[] not null default '{1,2,3,4,5,6}',
  best_streak int not null default 0 check (best_streak >= 0),
  updated_at timestamptz not null default now()
);
alter table public.user_habits enable row level security;
drop policy if exists "user_habits_select_own" on public.user_habits;
drop policy if exists "user_habits_insert_own" on public.user_habits;
drop policy if exists "user_habits_update_own" on public.user_habits;
create policy "user_habits_select_own" on public.user_habits for select to authenticated using (user_id = auth.uid());
create policy "user_habits_insert_own" on public.user_habits for insert to authenticated with check (user_id = auth.uid());
create policy "user_habits_update_own" on public.user_habits for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.user_habits to authenticated;

-- current streak for the signed-in user, from their own workouts + "Workout done" days (no fake numbers)
create or replace function public.my_streak()
returns int
language sql
stable
security invoker
set search_path = public
as $$
  with days as (
    select day from public.workout_done where user_id = auth.uid()
    union
    select (started_at at time zone 'Asia/Kolkata')::date from public.workouts where user_id = auth.uid()
  ), anchor as (
    select case when exists (select 1 from days where day = (now() at time zone 'Asia/Kolkata')::date)
                then (now() at time zone 'Asia/Kolkata')::date
                else (now() at time zone 'Asia/Kolkata')::date - 1 end as d
  ), numbered as (
    select day, (select d from anchor) - day as back, row_number() over (order by day desc) - 1 as rn
    from days where day <= (select d from anchor)
  )
  select count(*)::int from numbered where back = rn;
$$;
revoke all on function public.my_streak() from public, anon;
grant execute on function public.my_streak() to authenticated;
