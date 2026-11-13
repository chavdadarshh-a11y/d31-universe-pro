-- D31.UNIVERSE PRO — application schema
-- Every user table has RLS: a user can only see and change their own rows.
-- Memberships/payments can only be written by the server (service role or SECURITY DEFINER functions).

-- gen_random_uuid() is built into Postgres 13+ (Supabase runs 15+)

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text default '',
  goal text check (goal in ('muscle','fatloss','strength','skills','mobility')) default 'muscle',
  level text check (level in ('beginner','intermediate','advanced')) default 'beginner',
  equipment text[] default '{none}',
  sex text check (sex in ('male','female')) default 'male',
  age int check (age between 10 and 100),
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  activity numeric(4,3) default 1.375,
  lang text check (lang in ('en','hi','gu')) default 'en',
  role text not null default 'member' check (role in ('member','admin','coach')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid() and role = 'member');
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- users can never change their own role (column-level privilege)
revoke update on public.profiles from authenticated;
grant update (id, name, goal, level, equipment, sex, age, height_cm, weight_kg, activity, lang, updated_at) on public.profiles to authenticated;

-- auto-create a profile row on sign-up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- d31_posts: only admins may write (the original schema allowed any signed-in user)
create policy "d31_posts_admin_insert" on public.d31_posts for insert to authenticated with check (public.is_admin());
create policy "d31_posts_admin_update" on public.d31_posts for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "d31_posts_admin_delete" on public.d31_posts for delete to authenticated using (public.is_admin());

-- ── Exercise library (public read, admin write) ─────────────────────────────
create table if not exists public.exercises (
  id text primary key,
  name text not null,
  name_hi text,
  name_gu text,
  category text not null check (category in ('strength','calisthenics','mobility','cardio')),
  equipment text[] not null default '{}',
  level smallint not null check (level between 1 and 3),
  layer text not null check (layer in ('RANGE','CONTROL','FORCE','EXPRESSION','IDENTITY')),
  tracking text not null check (tracking in ('reps','time')),
  primary_muscles text[] not null,
  secondary_muscles text[] not null default '{}',
  summary text not null,
  steps text[] not null,
  cues text[] not null,
  mistakes text[] not null,
  benefits text[] not null,
  video_url text,
  created_at timestamptz not null default now()
);
alter table public.exercises enable row level security;
create policy "exercises_public_read" on public.exercises for select to anon, authenticated using (true);
create policy "exercises_admin_write" on public.exercises for all to authenticated using (public.is_admin()) with check (public.is_admin());
create index if not exists idx_exercises_primary on public.exercises using gin (primary_muscles);

-- ── Training data ───────────────────────────────────────────────────────────
create table if not exists public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  program_id text,
  day_index int,
  started_at timestamptz not null,
  duration_sec int not null default 0,
  volume_kg numeric(10,1) not null default 0,
  exercises jsonb not null default '[]',
  source text not null default 'player' check (source in ('player','camera')),
  created_at timestamptz not null default now()
);
create index if not exists idx_workouts_user_time on public.workouts (user_id, started_at desc);

create table if not exists public.custom_workouts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,1), waist_cm numeric(5,1), chest_cm numeric(5,1), arm_cm numeric(5,1), thigh_cm numeric(5,1), body_fat numeric(4,1),
  created_at timestamptz not null default now()
);
create index if not exists idx_measure_user_date on public.body_measurements (user_id, date);

create table if not exists public.progress_photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  taken_at timestamptz not null default now(),
  note text
);

create table if not exists public.nutrition_logs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  name text not null,
  kcal int not null check (kcal >= 0),
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_food_user_date on public.nutrition_logs (user_id, date);

create table if not exists public.recovery_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep_h numeric(3,1) not null,
  sleep_q smallint not null check (sleep_q between 1 and 5),
  soreness smallint not null check (soreness between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  stress smallint not null check (stress between 1 and 5),
  score smallint not null check (score between 0 and 100),
  unique (user_id, date)
);

create table if not exists public.form_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text,
  prompt text,
  result text not null,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists idx_analyses_user_time on public.form_analyses (user_id, created_at desc);

-- owner-only RLS for all user tables
do $$
declare t text;
begin
  foreach t in array array['workouts','custom_workouts','body_measurements','progress_photos','nutrition_logs','recovery_checkins'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_owner_all" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;
-- analyses are written by the edge function (service role); users may read/delete their own
alter table public.form_analyses enable row level security;
create policy "form_analyses_owner_select" on public.form_analyses for select to authenticated using (user_id = auth.uid());
create policy "form_analyses_owner_delete" on public.form_analyses for delete to authenticated using (user_id = auth.uid());

-- ── Memberships & payments (server-written only) ───────────────────────────
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free','pro','premium','coaching')),
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  source text not null check (source in ('razorpay','launch_offer','trial','manual')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "subscriptions_owner_select" on public.subscriptions for select to authenticated using (user_id = auth.uid());

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  amount_paise int not null,
  currency text not null default 'INR',
  razorpay_order_id text unique not null,
  razorpay_payment_id text unique,
  status text not null default 'created' check (status in ('created','paid','failed','refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.payments enable row level security;
create policy "payments_owner_select" on public.payments for select to authenticated using (user_id = auth.uid());

create table if not exists public.offer_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('launch','trial')),
  claimed_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.offer_claims enable row level security;
create policy "offer_claims_owner_select" on public.offer_claims for select to authenticated using (user_id = auth.uid());

-- effective plan helper (used by edge functions)
create or replace function public.current_plan(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select plan from public.subscriptions where user_id = uid and status = 'active' and (current_period_end is null or current_period_end > now())),
    'free');
$$;

-- launch offer: first 131 members get Pro free for 1 month (atomic, one per user)
create or replace function public.launch_spots_left() returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, 131 - (select count(*)::int from public.offer_claims where kind = 'launch'));
$$;
grant execute on function public.launch_spots_left() to anon, authenticated;

create or replace function public.claim_launch_offer() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); taken int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  perform pg_advisory_xact_lock(31131);
  if exists (select 1 from public.offer_claims where user_id = uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;
  select count(*) into taken from public.offer_claims where kind = 'launch';
  if taken >= 131 then return jsonb_build_object('ok', false, 'reason', 'sold_out'); end if;
  if public.current_plan(uid) <> 'free' then return jsonb_build_object('ok', false, 'reason', 'already_member'); end if;
  insert into public.offer_claims (user_id, kind) values (uid, 'launch');
  insert into public.subscriptions (user_id, plan, status, source, current_period_end, updated_at)
  values (uid, 'pro', 'active', 'launch_offer', now() + interval '30 days', now())
  on conflict (user_id) do update set plan = 'pro', status = 'active', source = 'launch_offer', current_period_end = now() + interval '30 days', updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.claim_launch_offer() to authenticated;

create or replace function public.start_trial() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if exists (select 1 from public.offer_claims where user_id = uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;
  if public.current_plan(uid) <> 'free' then return jsonb_build_object('ok', false, 'reason', 'already_member'); end if;
  insert into public.offer_claims (user_id, kind) values (uid, 'trial');
  insert into public.subscriptions (user_id, plan, status, source, current_period_end, updated_at)
  values (uid, 'pro', 'active', 'trial', now() + interval '7 days', now())
  on conflict (user_id) do update set plan = 'pro', status = 'active', source = 'trial', current_period_end = now() + interval '7 days', updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.start_trial() to authenticated;

-- ── Storage: private progress photos (path = <user_id>/<photo_id>.jpg) ─────
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;
create policy "progress_photos_owner_rw" on storage.objects for all to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
