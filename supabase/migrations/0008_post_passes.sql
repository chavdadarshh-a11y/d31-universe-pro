-- v4.2.2: time-limited Knowledge post passes (1/3/30 posts).
-- Prices & durations live in supabase/functions/_shared/pricing.json — not in SQL.
-- A pass opens the chosen posts in every language (videos + PDFs) for viewing/streaming only.
-- In-app downloads stay Platinum-only. Only the service role (razorpay-verify) inserts rows;
-- the owner may claim remaining slots through claim_post_pass_slot().

create or replace function public.post_pass_ids_valid(ids int[], ptype text)
returns boolean
language sql immutable as $$
  select
    cardinality(ids) <= case ptype
      when 'post_1' then 1
      when 'post_3' then 3
      when 'post_30' then 30
      else 0
    end
    and not exists (select 1 from unnest(ids) as x where x < 1 or x > 999999)
    and (select count(*) from unnest(ids) as x) = (select count(distinct x) from unnest(ids) as x);
$$;

create table if not exists public.user_post_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pass_type text not null check (pass_type in ('post_1', 'post_3', 'post_30')),
  post_ids int[] not null default '{}',
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  order_id text,
  constraint user_post_passes_ids_ok check (public.post_pass_ids_valid(post_ids, pass_type))
);
create index if not exists user_post_passes_user_exp on public.user_post_passes (user_id, expires_at);

alter table public.user_post_passes enable row level security;
drop policy if exists "user_post_passes_owner_select" on public.user_post_passes;
create policy "user_post_passes_owner_select" on public.user_post_passes
  for select to authenticated using (user_id = auth.uid());
-- no insert/update/delete policies for authenticated: service role writes purchases;
-- slot assignment goes through the SECURITY DEFINER function below.

create or replace function public.claim_post_pass_slot(post_number int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rec public.user_post_passes%rowtype;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if post_number is null or post_number < 1 or post_number > 999999 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_post');
  end if;
  if exists (
    select 1 from public.user_post_passes
    where user_id = uid and expires_at > now() and post_number = any (post_ids)
  ) then
    return jsonb_build_object('ok', true, 'reason', 'already');
  end if;

  select * into rec
  from public.user_post_passes
  where user_id = uid
    and expires_at > now()
    and cardinality(post_ids) < case pass_type
      when 'post_1' then 1
      when 'post_3' then 3
      when 'post_30' then 30
      else 0
    end
  order by expires_at asc
  for update
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_slot');
  end if;

  update public.user_post_passes
     set post_ids = array_append(post_ids, post_number)
   where id = rec.id;

  return jsonb_build_object('ok', true, 'pass_id', rec.id, 'expires_at', rec.expires_at);
end $$;

grant execute on function public.claim_post_pass_slot(int) to authenticated;
