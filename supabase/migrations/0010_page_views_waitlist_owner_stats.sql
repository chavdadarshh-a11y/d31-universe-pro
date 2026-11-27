-- v4.5.1: privacy-friendly page views, plan waitlist, owner-only stats RPC.
-- Insert-only for visitors. Nobody except the owner can read the tables.
-- Run this in the Supabase SQL editor. Do not put service-role keys in the app.

create table if not exists public.owner_emails (
  email text primary key
);
alter table public.owner_emails enable row level security;
-- no client policies: only security-definer functions and the service role can read/write
insert into public.owner_emails (email) values ('dpchavda22@gmail.com')
  on conflict (email) do nothing;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from auth.users u
      join public.owner_emails o on lower(u.email) = lower(o.email)
      where u.id = auth.uid()
    );
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated, service_role;

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  path text not null,
  referrer text not null default '',
  device text not null default 'computer' check (device in ('phone','tablet','computer')),
  language text not null default 'en',
  user_id uuid references auth.users(id) on delete set null,
  email text,
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_at on public.page_views (created_at desc);
create index if not exists page_views_visitor on public.page_views (visitor_id);
create index if not exists page_views_path on public.page_views (path);
alter table public.page_views enable row level security;

drop policy if exists "page_views_insert_anon" on public.page_views;
create policy "page_views_insert_anon" on public.page_views
  for insert to anon
  with check (user_id is null and email is null and visitor_id <> '' and path <> '');

drop policy if exists "page_views_insert_auth" on public.page_views;
create policy "page_views_insert_auth" on public.page_views
  for insert to authenticated
  with check (
    visitor_id <> '' and path <> ''
    and (user_id is null or user_id = auth.uid())
    and (email is null or user_id = auth.uid())
  );
-- no select/update/delete policies for clients

grant insert on public.page_views to anon, authenticated;

create table if not exists public.plan_waitlist (
  id uuid primary key default gen_random_uuid(),
  plan text not null check (plan in ('pro','gold','platinum')),
  email text,
  user_id uuid references auth.users(id) on delete set null,
  visitor_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists plan_waitlist_email_plan
  on public.plan_waitlist (lower(email), plan)
  where email is not null;
alter table public.plan_waitlist enable row level security;

drop policy if exists "plan_waitlist_insert_anon" on public.plan_waitlist;
create policy "plan_waitlist_insert_anon" on public.plan_waitlist
  for insert to anon
  with check (user_id is null and plan in ('pro','gold','platinum'));

drop policy if exists "plan_waitlist_insert_auth" on public.plan_waitlist;
create policy "plan_waitlist_insert_auth" on public.plan_waitlist
  for insert to authenticated
  with check (
    plan in ('pro','gold','platinum')
    and (user_id is null or user_id = auth.uid())
  );

grant insert on public.plan_waitlist to anon, authenticated;

create or replace function public.owner_site_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec jsonb;
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  rec := jsonb_build_object(
    'ok', true,
    'page_views', (select count(*) from public.page_views),
    'unique_visitors', (select count(distinct visitor_id) from public.page_views),
    'signed_up', (select count(*) from auth.users),
    'waitlist', (select count(*) from public.plan_waitlist),
    'daily', coalesce((
      select jsonb_agg(x order by day)
      from (
        select created_at::date::text as day,
               count(*)::int as views,
               count(distinct visitor_id)::int as visitors
        from public.page_views
        where created_at >= (now() - interval '14 days')
        group by created_at::date
      ) x
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(x)
      from (
        select path, count(*)::int as views
        from public.page_views
        group by path
        order by count(*) desc
        limit 12
      ) x
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(x)
      from (
        select u.id::text as id,
               coalesce(u.email, '') as email,
               coalesce(p.name, '') as name,
               coalesce(p.created_at::text, '') as "createdAt",
               coalesce((
                 select max(pv.created_at)::text
                 from public.page_views pv
                 where pv.user_id = u.id or (u.email is not null and lower(pv.email) = lower(u.email))
               ), '') as "lastSeen"
        from auth.users u
        left join public.profiles p on p.id = u.id
        order by p.created_at desc nulls last
        limit 200
      ) x
    ), '[]'::jsonb)
  );
  return rec;
end;
$$;

revoke all on function public.owner_site_stats() from public, anon;
grant execute on function public.owner_site_stats() to authenticated, service_role;
