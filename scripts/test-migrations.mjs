// Runs all Supabase migrations against an in-memory Postgres (PGlite) with a
// minimal stub of Supabase's auth/storage schemas, then checks RLS + offer logic.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const db = new PGlite()
let failures = 0
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++ }

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`)

for (const f of readdirSync(join(root, "supabase/migrations")).sort()) { try {
  await db.exec(readFileSync(join(root, 'supabase/migrations', f), 'utf8'))
  ok(true, `migration ${f}`) } catch (e) { console.error(`✗ ${f}: ${e.message}`); process.exit(1) }
}
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon;
  revoke update on public.profiles from authenticated;
  grant update (id, name, goal, level, equipment, sex, age, height_cm, weight_kg, activity, lang, updated_at) on public.profiles to authenticated;`)

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.in'), ('${B}', 'b@x.in')`)
ok((await db.query('select count(*)::int c from public.profiles')).rows[0].c === 2, 'profile auto-created on sign-up')
ok((await db.query('select count(*)::int c from public.exercises')).rows[0].c >= 30, 'exercise seed loaded')

async function as(uid, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try { return await fn() } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`) }
}

await as(A, () => db.exec(`insert into public.workouts (id, user_id, name, started_at) values (gen_random_uuid(), '${A}', 'A day', now())`))
const seenByB = await as(B, () => db.query('select count(*)::int c from public.workouts'))
ok(seenByB.rows[0].c === 0, 'RLS: user B cannot see user A workouts')
let blocked = false
try { await as(B, () => db.exec(`insert into public.workouts (id, user_id, name, started_at) values (gen_random_uuid(), '${A}', 'spoof', now())`)) } catch { blocked = true }
ok(blocked, 'RLS: user B cannot insert rows as user A')

blocked = false
try { await as(A, () => db.exec(`update public.profiles set role = 'admin' where id = '${A}'`)) } catch { blocked = true }
ok(blocked, 'users cannot promote themselves to admin')
await as(A, () => db.exec(`update public.profiles set name = 'Darshan' where id = '${A}'`))
ok((await db.query(`select name from public.profiles where id = '${A}'`)).rows[0].name === 'Darshan', 'users can update their own profile')

blocked = false
try { await as(A, () => db.exec(`insert into public.subscriptions (user_id, plan, source) values ('${A}', 'coaching', 'manual')`)) } catch { blocked = true }
ok(blocked, 'users cannot grant themselves a paid plan')

blocked = false
try { await as(A, () => db.exec(`insert into public.d31_posts (post_id, title, layer, skills, core_skill, cover_url, content) values ('X','x','FORCE','{}','x','x','{}')`)) } catch { blocked = true }
ok(blocked, 'non-admins cannot write d31_posts')

ok((await db.query('select public.launch_spots_left() n')).rows[0].n === 131, 'launch spots start at 131')
const r1 = await as(A, () => db.query('select public.claim_launch_offer() r'))
ok(r1.rows[0].r.ok === true, 'user A claims launch offer')
ok((await db.query(`select public.current_plan('${A}') p`)).rows[0].p === 'pro', 'user A is now Pro')
const r2 = await as(A, () => db.query('select public.start_trial() r'))
ok(r2.rows[0].r.ok === false, 'user A cannot also take the trial')
ok((await db.query('select public.launch_spots_left() n')).rows[0].n === 130, 'launch spots decrement to 130')
const r3 = await as(B, () => db.query('select public.start_trial() r'))
ok(r3.rows[0].r.ok === true, 'user B starts a 7-day trial')

const fts = await db.query(`select count(*)::int c from public.search_d31_posts('handstand')`)
ok(fts.rows[0].c >= 0, 'search_d31_posts RPC runs')

console.log(failures ? `\n${failures} check(s) failed` : '\nAll database checks passed')
process.exit(failures ? 1 : 0)
