-- v4.1: per-account list of in-app downloads, so a reinstall can show and re-download them.
-- The files themselves stay on the phone (in-app storage); only this list is in the cloud.
create table if not exists public.user_downloads (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,                       -- e.g. 'video:<drive id>'
  type text not null check (type in ('video', 'pdf', 'photo')),
  title text not null default '',
  source_id text not null,                     -- Google Drive file id
  size bigint not null default 0,
  downloaded_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.user_downloads enable row level security;
drop policy if exists "own downloads: read" on public.user_downloads;
drop policy if exists "own downloads: insert" on public.user_downloads;
drop policy if exists "own downloads: update" on public.user_downloads;
drop policy if exists "own downloads: delete" on public.user_downloads;
create policy "own downloads: read" on public.user_downloads for select using (auth.uid() = user_id);
create policy "own downloads: insert" on public.user_downloads for insert with check (auth.uid() = user_id);
create policy "own downloads: update" on public.user_downloads for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own downloads: delete" on public.user_downloads for delete using (auth.uid() = user_id);
create index if not exists user_downloads_user_idx on public.user_downloads (user_id, downloaded_at desc);
