-- v4.1: 7-day Platinum trial for every new account (once), à-la-carte unlocks, multi-length one-time passes.
-- Prices live in supabase/functions/_shared/pricing.json (server) — not in SQL.

-- ── passes & unlocks on payments ─────────────────────────────────────────────
alter table public.payments add column if not exists sku text;
alter table public.payments add column if not exists days int not null default 30;
alter table public.payments add column if not exists items jsonb;

-- ── à-la-carte unlocks: server-written only (after a verified Razorpay payment) ─
create table if not exists public.user_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null check (item_key ~ '^[0-9]{1,6}:(video|pdf):[0-9]{1,3}$'),
  kind text not null check (kind in ('video', 'pdf')),
  order_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, item_key)
);
alter table public.user_unlocks enable row level security;
drop policy if exists "user_unlocks_owner_select" on public.user_unlocks;
create policy "user_unlocks_owner_select" on public.user_unlocks for select to authenticated using (user_id = auth.uid());
-- no insert/update/delete policies: only the service role (razorpay-verify) writes here.

-- downloads remember which unlock opened them
alter table public.user_downloads add column if not exists unlock_key text;

-- ── trial: once per account ──────────────────────────────────────────────────
create table if not exists public.user_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'platinum',
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);
alter table public.user_trials enable row level security;
drop policy if exists "user_trials_owner_select" on public.user_trials;
create policy "user_trials_owner_select" on public.user_trials for select to authenticated using (user_id = auth.uid());

-- 7 days of Platinum, once per user; never replaces an active paid pass. Keep the length in sync with pricing.json → trial.days.
create or replace function public.start_trial() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); started timestamptz := now(); trial_days int := 7;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if exists (select 1 from public.user_trials where user_id = uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;
  if public.current_plan(uid) <> 'free' then return jsonb_build_object('ok', false, 'reason', 'already_member'); end if;
  insert into public.user_trials (user_id, plan, started_at, ends_at) values (uid, 'platinum', started, started + make_interval(days => trial_days));
  insert into public.subscriptions (user_id, plan, status, source, current_period_end, updated_at)
  values (uid, 'platinum', 'active', 'trial', started + make_interval(days => trial_days), now())
  on conflict (user_id) do update set plan = 'platinum', status = 'active', source = 'trial', current_period_end = started + make_interval(days => trial_days), updated_at = now();
  return jsonb_build_object('ok', true, 'started_at', started);
end $$;
grant execute on function public.start_trial() to authenticated;
