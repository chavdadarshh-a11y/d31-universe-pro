-- v4.4.0: Portal Pass credit ledger + per-post unlocks, THE FIRST 131, referral wallet, analytics.
-- Prices live in supabase/functions/_shared/pricing.json — not in SQL.
-- Unused Portal credits never expire. Each unlock starts its own timer (hours come from the lot).
-- Only the service role inserts credit lots (after Razorpay verify). Members spend credits via unlock_portal_post().

-- ══════════════ Portal credits & per-post unlocks ══════════════

create table if not exists public.portal_credit_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pass_type text not null check (pass_type in ('post_1', 'post_3', 'post_30')),
  hours int not null check (hours > 0),
  credits int not null check (credits > 0),
  remaining int not null check (remaining >= 0),
  purchased_at timestamptz not null default now(),
  order_id text,
  constraint portal_credit_lots_remain check (remaining <= credits)
);
create index if not exists portal_credit_lots_user on public.portal_credit_lots (user_id, remaining);

create table if not exists public.portal_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_number int not null check (post_number >= 1 and post_number <= 999999),
  lot_id uuid references public.portal_credit_lots(id) on delete set null,
  unlocked_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists portal_unlocks_user_post on public.portal_unlocks (user_id, post_number, expires_at);

alter table public.portal_credit_lots enable row level security;
alter table public.portal_unlocks enable row level security;
drop policy if exists "portal_credit_lots_owner_select" on public.portal_credit_lots;
create policy "portal_credit_lots_owner_select" on public.portal_credit_lots
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "portal_unlocks_owner_select" on public.portal_unlocks;
create policy "portal_unlocks_owner_select" on public.portal_unlocks
  for select to authenticated using (user_id = auth.uid());
-- no insert/update/delete for authenticated: service role writes lots; spending goes through the RPC.

create or replace function public.unlock_portal_post(p_post int, p_type text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lot public.portal_credit_lots%rowtype;
  unlock public.portal_unlocks%rowtype;
  exp timestamptz;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if p_post is null or p_post < 1 or p_post > 999999 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_post');
  end if;
  if p_type is not null and p_type not in ('post_1', 'post_3', 'post_30') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_type');
  end if;

  select * into unlock
  from public.portal_unlocks u
  where u.user_id = uid and u.post_number = p_post and u.expires_at > now()
  order by u.expires_at desc
  limit 1;
  if found then
    return jsonb_build_object('ok', true, 'reason', 'already', 'unlock_id', unlock.id, 'expires_at', unlock.expires_at);
  end if;

  select * into lot
  from public.portal_credit_lots l
  where l.user_id = uid
    and l.remaining > 0
    and (p_type is null or l.pass_type = p_type)
  order by l.hours asc, l.purchased_at asc
  for update
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_credit');
  end if;

  exp := now() + (lot.hours || ' hours')::interval;
  update public.portal_credit_lots set remaining = remaining - 1 where id = lot.id;
  insert into public.portal_unlocks (user_id, post_number, lot_id, expires_at)
    values (uid, p_post, lot.id, exp)
    returning * into unlock;

  return jsonb_build_object('ok', true, 'unlock_id', unlock.id, 'lot_id', lot.id, 'expires_at', exp, 'hours', lot.hours);
end $$;

grant execute on function public.unlock_portal_post(int, text) to authenticated;

-- ══════════════ THE FIRST 131 ══════════════

create table if not exists public.founding_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  order_id text,
  early_access boolean not null default true
);

alter table public.founding_members enable row level security;
drop policy if exists "founding_members_self_select" on public.founding_members;
create policy "founding_members_self_select" on public.founding_members
  for select to authenticated using (user_id = auth.uid());
-- no public list of members; the counter is an RPC. service role inserts.

create or replace function public.founding_claimed_count()
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.founding_members
$$;
grant execute on function public.founding_claimed_count() to anon, authenticated;

create or replace function public.is_founding_member(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.founding_members where user_id = uid)
$$;
grant execute on function public.is_founding_member(uuid) to authenticated;

-- Called by razorpay-verify (service role) after a paid membership. Caps at 131.
create or replace function public.try_claim_founding(uid uuid, oid text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cap int := 131;
  n int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'no_user'); end if;
  if exists (select 1 from public.founding_members where user_id = uid) then
    return jsonb_build_object('ok', true, 'reason', 'already', 'index', (select count(*) from public.founding_members));
  end if;
  select count(*)::int into n from public.founding_members;
  if n >= cap then
    return jsonb_build_object('ok', false, 'reason', 'sold_out', 'count', n);
  end if;
  insert into public.founding_members (user_id, order_id) values (uid, oid);
  return jsonb_build_object('ok', true, 'index', n + 1);
end $$;

-- ══════════════ Wallet ══════════════

create table if not exists public.user_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_inr int not null default 0 check (balance_inr >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_inr int not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);

alter table public.user_wallets enable row level security;
alter table public.wallet_ledger enable row level security;
drop policy if exists "user_wallets_owner_select" on public.user_wallets;
create policy "user_wallets_owner_select" on public.user_wallets
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "wallet_ledger_owner_select" on public.wallet_ledger;
create policy "wallet_ledger_owner_select" on public.wallet_ledger
  for select to authenticated using (user_id = auth.uid());

create or replace function public.wallet_balance(uid uuid default auth.uid())
returns int
language plpgsql security definer set search_path = public as $$
declare b int;
begin
  if uid is null then return 0; end if;
  insert into public.user_wallets (user_id, balance_inr) values (uid, 0) on conflict (user_id) do nothing;
  select balance_inr into b from public.user_wallets where user_id = uid;
  return coalesce(b, 0);
end $$;
grant execute on function public.wallet_balance(uuid) to authenticated;

-- Service role (and security-definer callers) credit / debit the wallet atomically.
create or replace function public.wallet_apply(uid uuid, amount_inr int, reason text, ref text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare b int;
begin
  if uid is null or amount_inr = 0 then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  insert into public.user_wallets (user_id, balance_inr) values (uid, 0) on conflict (user_id) do nothing;
  if amount_inr < 0 then
    update public.user_wallets
       set balance_inr = balance_inr + amount_inr, updated_at = now()
     where user_id = uid and balance_inr + amount_inr >= 0
     returning balance_inr into b;
    if not found then return jsonb_build_object('ok', false, 'reason', 'insufficient'); end if;
  else
    update public.user_wallets
       set balance_inr = balance_inr + amount_inr, updated_at = now()
     where user_id = uid
     returning balance_inr into b;
  end if;
  insert into public.wallet_ledger (user_id, amount_inr, reason, ref) values (uid, amount_inr, reason, ref);
  return jsonb_build_object('ok', true, 'balance', b);
end $$;

-- ══════════════ Referral ══════════════

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  constraint referral_codes_fmt check (code ~ '^[A-Z0-9]{6,12}$')
);
create table if not exists public.user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null,
  first_seen timestamptz not null default now(),
  primary key (user_id, device_hash)
);
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  device_hash text,
  attached_at timestamptz not null default now(),
  rewarded_at timestamptz,
  constraint referrals_no_self check (referrer_id <> referred_id),
  constraint referrals_one_referrer unique (referred_id)
);
create index if not exists referrals_referrer on public.referrals (referrer_id, rewarded_at);

alter table public.referral_codes enable row level security;
alter table public.user_devices enable row level security;
alter table public.referrals enable row level security;
drop policy if exists "referral_codes_owner_select" on public.referral_codes;
create policy "referral_codes_owner_select" on public.referral_codes
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "user_devices_owner_select" on public.user_devices;
create policy "user_devices_owner_select" on public.user_devices
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "referrals_owner_select" on public.referrals;
create policy "referrals_owner_select" on public.referrals
  for select to authenticated using (referrer_id = auth.uid() or referred_id = auth.uid());

create or replace function public.my_referral_code()
returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c text;
  i int := 0;
begin
  if uid is null then return null; end if;
  select code into c from public.referral_codes where user_id = uid;
  if found then return c; end if;
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.referral_codes (user_id, code) values (uid, c);
      return c;
    exception when unique_violation then
      i := i + 1;
      if i > 8 then raise exception 'could not allocate referral code'; end if;
    end;
  end loop;
end $$;
grant execute on function public.my_referral_code() to authenticated;

create or replace function public.register_device(p_device text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if p_device is null or length(p_device) < 8 or length(p_device) > 128 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_device');
  end if;
  insert into public.user_devices (user_id, device_hash) values (uid, p_device)
    on conflict (user_id, device_hash) do nothing;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.register_device(text) to authenticated;

create or replace function public.attach_referral(p_code text, p_device text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ref_id uuid;
  clean text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  clean := upper(trim(p_code));
  if clean is null or clean = '' then return jsonb_build_object('ok', false, 'reason', 'invalid_code'); end if;

  if exists (select 1 from public.referrals where referred_id = uid) then
    return jsonb_build_object('ok', true, 'reason', 'already');
  end if;

  select user_id into ref_id from public.referral_codes where referral_codes.code = clean;
  if ref_id is null then return jsonb_build_object('ok', false, 'reason', 'unknown_code'); end if;
  if ref_id = uid then return jsonb_build_object('ok', false, 'reason', 'self'); end if;

  -- same email as the referrer
  if exists (
    select 1 from auth.users a join auth.users b on lower(a.email) = lower(b.email)
    where a.id = uid and b.id = ref_id and a.email is not null and a.email <> ''
  ) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_email');
  end if;

  -- same device already used by the referrer
  if p_device is not null and exists (
    select 1 from public.user_devices d where d.user_id = ref_id and d.device_hash = p_device
  ) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_device');
  end if;

  if p_device is not null then
    insert into public.user_devices (user_id, device_hash) values (uid, p_device)
      on conflict (user_id, device_hash) do nothing;
  end if;

  insert into public.referrals (referrer_id, referred_id, code, device_hash)
    values (ref_id, uid, clean, p_device);
  return jsonb_build_object('ok', true, 'referrer_id', ref_id);
exception when unique_violation then
  return jsonb_build_object('ok', true, 'reason', 'already');
end $$;
grant execute on function public.attach_referral(text, text) to authenticated;

-- Called by razorpay-verify after the friend's first paid purchase. ₹25 each, max 5 per referrer.
create or replace function public.reward_referral_if_first(uid uuid, oid text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  rec public.referrals%rowtype;
  rewarded_n int;
  reward int := 25;
  max_n int := 5;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'no_user'); end if;
  -- first paid purchase only (any earlier paid payment besides this order)
  if exists (
    select 1 from public.payments
    where user_id = uid and status = 'paid' and razorpay_order_id is distinct from oid
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_first');
  end if;
  select * into rec from public.referrals where referred_id = uid;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_referral'); end if;
  if rec.rewarded_at is not null then return jsonb_build_object('ok', true, 'reason', 'already'); end if;
  select count(*)::int into rewarded_n from public.referrals where referrer_id = rec.referrer_id and rewarded_at is not null;
  if rewarded_n >= max_n then
    return jsonb_build_object('ok', false, 'reason', 'cap');
  end if;
  perform public.wallet_apply(rec.referrer_id, reward, 'referral_reward', oid);
  perform public.wallet_apply(uid, reward, 'referral_signup', oid);
  update public.referrals set rewarded_at = now() where id = rec.id;
  return jsonb_build_object('ok', true, 'referrer_id', rec.referrer_id);
end $$;

create or replace function public.my_referral_stats()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', (select code from public.referral_codes where user_id = auth.uid()),
    'attached', (select count(*) from public.referrals where referrer_id = auth.uid()),
    'rewarded', (select count(*) from public.referrals where referrer_id = auth.uid() and rewarded_at is not null),
    'max', 5,
    'reward_inr', 25
  )
$$;
grant execute on function public.my_referral_stats() to authenticated;

-- ══════════════ Analytics (insert own events; no public read of others) ══════════════

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  props jsonb not null default '{}'::jsonb,
  device_hash text,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_event_at on public.analytics_events (event, created_at desc);
alter table public.analytics_events enable row level security;
drop policy if exists "analytics_events_insert_own" on public.analytics_events;
create policy "analytics_events_insert_own" on public.analytics_events
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());
drop policy if exists "analytics_events_select_own" on public.analytics_events;
create policy "analytics_events_select_own" on public.analytics_events
  for select to authenticated using (user_id = auth.uid());
-- anon cannot insert (signup/install before login go through the client after auth, or stay local).

alter table public.payments add column if not exists wallet_inr int not null default 0;
alter table public.payments add column if not exists founding_discount boolean not null default false;

-- Privileged RPCs: service role only (Edge Functions). Default PUBLIC execute would let clients self-claim.
revoke all on function public.try_claim_founding(uuid, text) from public, anon, authenticated;
grant execute on function public.try_claim_founding(uuid, text) to service_role;

revoke all on function public.wallet_apply(uuid, int, text, text) from public, anon, authenticated;
grant execute on function public.wallet_apply(uuid, int, text, text) to service_role;

revoke all on function public.reward_referral_if_first(uuid, text) from public, anon, authenticated;
grant execute on function public.reward_referral_if_first(uuid, text) to service_role;
