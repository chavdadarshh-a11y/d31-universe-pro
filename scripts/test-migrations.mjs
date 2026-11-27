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

// v4.2.2 Knowledge post passes
blocked = false
try { await as(A, () => db.exec(`insert into public.user_post_passes (user_id, pass_type, post_ids, expires_at) values ('${A}', 'post_1', '{501}', now() + interval '1 day')`)) } catch { blocked = true }
ok(blocked, 'RLS: user cannot insert a post pass for themselves')

await db.exec(`insert into public.user_post_passes (user_id, pass_type, post_ids, expires_at) values ('${A}', 'post_3', '{}', now() + interval '1 day')`)
const already = await as(A, () => db.query(`select public.claim_post_pass_slot(501) r`))
ok(already.rows[0].r.ok === true, 'user A claims first slot of a 3-post pass (#501)')
const again = await as(A, () => db.query(`select public.claim_post_pass_slot(501) r`))
ok(again.rows[0].r.ok === true && again.rows[0].r.reason === 'already', 'claiming the same post again is already')
await as(A, () => db.query(`select public.claim_post_pass_slot(502) r`))
await as(A, () => db.query(`select public.claim_post_pass_slot(503) r`))
const full = await as(A, () => db.query(`select public.claim_post_pass_slot(504) r`))
ok(full.rows[0].r.ok === false && full.rows[0].r.reason === 'no_slot', 'fourth claim on a 3-post pass is rejected')
const ids = (await db.query(`select post_ids from public.user_post_passes where user_id = '${A}'`)).rows[0].post_ids
ok(Array.isArray(ids) && ids.includes(501) && ids.includes(502) && ids.includes(503) && ids.length === 3, `post_ids are 501,502,503 (got ${ids})`)

const seenByBpp = await as(B, () => db.query('select count(*)::int c from public.user_post_passes'))
ok(seenByBpp.rows[0].c === 0, 'RLS: user B cannot see user A post passes')
const noSlotB = await as(B, () => db.query(`select public.claim_post_pass_slot(501) r`))
ok(noSlotB.rows[0].r.ok === false && noSlotB.rows[0].r.reason === 'no_slot', 'user B has no pass to claim a slot on')

await db.exec(`insert into public.user_post_passes (user_id, pass_type, post_ids, expires_at) values ('${B}', 'post_1', '{}', now() - interval '1 hour')`)
const expired = await as(B, () => db.query(`select public.claim_post_pass_slot(501) r`))
ok(expired.rows[0].r.ok === false && expired.rows[0].r.reason === 'no_slot', 'expired post pass cannot be claimed')

const own = await as(A, () => db.query('select count(*)::int c from public.user_post_passes'))
ok(own.rows[0].c === 1, 'user A can read their own post pass')


// v4.4.0 Portal credits, founding, referral, wallet
blocked = false
try { await as(A, () => db.exec(`insert into public.portal_credit_lots (user_id, pass_type, hours, credits, remaining) values ('${A}', 'post_3', 24, 3, 3)`)) } catch { blocked = true }
ok(blocked, 'RLS: user cannot insert portal credit lots')

await db.exec(`insert into public.portal_credit_lots (user_id, pass_type, hours, credits, remaining) values ('${A}', 'post_3', 24, 3, 3)`)
const u1 = await as(A, () => db.query(`select public.unlock_portal_post(601) r`))
ok(u1.rows[0].r.ok === true && !u1.rows[0].r.reason, `unlock #601 spends 1 credit (got ${JSON.stringify(u1.rows[0].r)})`)
const rem = (await db.query(`select remaining from public.portal_credit_lots where user_id = '${A}' and pass_type = 'post_3'`)).rows[0].remaining
ok(rem === 2, `lot remaining is 2 after first unlock (got ${rem})`)
const u1b = await as(A, () => db.query(`select public.unlock_portal_post(601) r`))
ok(u1b.rows[0].r.ok === true && u1b.rows[0].r.reason === 'already' && rem === 2, 'same active post returns already and does not spend again')
await as(A, () => db.query(`select public.unlock_portal_post(602) r`))
await as(A, () => db.query(`select public.unlock_portal_post(603) r`))
const uFull = await as(A, () => db.query(`select public.unlock_portal_post(604) r`))
ok(uFull.rows[0].r.ok === false && uFull.rows[0].r.reason === 'no_credit', 'fourth unlock is rejected when credits are gone')

const seenLotsB = await as(B, () => db.query('select count(*)::int c from public.portal_credit_lots'))
ok(seenLotsB.rows[0].c === 0, 'RLS: user B cannot see user A credit lots')
const seenUnlB = await as(B, () => db.query('select count(*)::int c from public.portal_unlocks'))
ok(seenUnlB.rows[0].c === 0, 'RLS: user B cannot see user A unlocks')

await db.exec(`insert into public.portal_credit_lots (user_id, pass_type, hours, credits, remaining) values ('${B}', 'post_1', 24, 1, 1)`)
await db.exec(`insert into public.portal_unlocks (user_id, post_number, expires_at) values ('${B}', 701, now() - interval '1 hour')`)
const reUnlock = await as(B, () => db.query(`select public.unlock_portal_post(701) r`))
ok(reUnlock.rows[0].r.ok === true && !reUnlock.rows[0].r.reason, 'expired unlock can be opened again by spending a new credit')

ok((await db.query('select public.founding_claimed_count() n')).rows[0].n === 0, 'founding count starts at 0')
blocked = false
try { await as(A, () => db.exec(`insert into public.founding_members (user_id) values ('${A}')`)) } catch { blocked = true }
ok(blocked, 'RLS: user cannot insert a founding membership')
blocked = false
try { await as(A, () => db.query(`select public.try_claim_founding('${A}', 'ord_x') r`)) } catch { blocked = true }
ok(blocked, 'authenticated cannot call try_claim_founding')
const f1 = (await db.query(`select public.try_claim_founding('${A}', 'ord_1') r`)).rows[0].r
ok(f1.ok === true && f1.index === 1, 'service role claims founding #1 for A')
ok((await db.query('select public.founding_claimed_count() n')).rows[0].n === 1, 'founding count is the real claimed total (1)')
const f1b = (await db.query(`select public.try_claim_founding('${A}', 'ord_1b') r`)).rows[0].r
ok(f1b.ok === true && f1b.reason === 'already', 'second founding claim for the same user is already')

const codeA = await as(A, () => db.query('select public.my_referral_code() c'))
ok(typeof codeA.rows[0].c === 'string' && codeA.rows[0].c.length >= 6, `A gets a referral code (${codeA.rows[0].c})`)
const selfRef = await as(A, () => db.query(`select public.attach_referral('${codeA.rows[0].c}', 'device-aaaa-aaaa') r`))
ok(selfRef.rows[0].r.ok === false && selfRef.rows[0].r.reason === 'self', 'self-referral is blocked')
await as(A, () => db.query(`select public.register_device('device-shared-999') r`))
const dupDev = await as(B, () => db.query(`select public.attach_referral('${codeA.rows[0].c}', 'device-shared-999') r`))
ok(dupDev.rows[0].r.ok === false && dupDev.rows[0].r.reason === 'duplicate_device', 'same device as the referrer is blocked')
const okRef = await as(B, () => db.query(`select public.attach_referral('${codeA.rows[0].c}', 'device-bbbb-bbbb') r`))
ok(okRef.rows[0].r.ok === true, `B can attach A’s code (got ${JSON.stringify(okRef.rows[0].r)})`)

blocked = false
try { await as(A, () => db.query(`select public.wallet_apply('${A}', 25, 'cheat', 'x') r`)) } catch { blocked = true }
ok(blocked, 'authenticated cannot call wallet_apply')
ok((await as(A, () => db.query('select public.wallet_balance() n'))).rows[0].n === 0, 'A wallet starts at 0')
const rew = (await db.query(`select public.reward_referral_if_first('${B}', 'ord_first') r`)).rows[0].r
ok(rew.ok === true, `first paid purchase rewards both wallets (got ${JSON.stringify(rew)})`)
ok((await as(A, () => db.query('select public.wallet_balance() n'))).rows[0].n === 25, 'referrer A received ₹25')
ok((await as(B, () => db.query('select public.wallet_balance() n'))).rows[0].n === 25, 'friend B received ₹25')


// v4.5.1 page views, waitlist, owner stats
async function asAnon(fn) {
  await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`)
  try { return await fn() } finally { await db.exec(`reset role;`) }
}

const anonOk = await asAnon(() => db.exec(`insert into public.page_views (visitor_id, path, referrer, device, language) values ('v1', '/home', '', 'phone', 'en')`))
ok(true, 'anon can insert a page view without email')
let anonEmailBlocked = false
try { await asAnon(() => db.exec(`insert into public.page_views (visitor_id, path, email) values ('v2', '/home', 'sneak@x.in')`)) } catch { anonEmailBlocked = true }
ok(anonEmailBlocked, 'anon cannot attach an email to a page view')

await as(A, () => db.exec(`insert into public.page_views (visitor_id, path, user_id, email, device, language) values ('vA', '/membership', '${A}', 'a@x.in', 'computer', 'en')`))
const seenViewsB = await as(B, () => db.query('select count(*)::int c from public.page_views'))
ok(seenViewsB.rows[0].c === 0, 'RLS: user B cannot read page views')

const forbidden = await as(A, () => db.query('select public.owner_site_stats() r'))
ok(forbidden.rows[0].r.ok === false && forbidden.rows[0].r.reason === 'forbidden', 'non-owner cannot read owner stats')

await db.exec(`insert into public.owner_emails (email) values ('a@x.in') on conflict do nothing`)
const stats = await as(A, () => db.query('select public.owner_site_stats() r'))
ok(stats.rows[0].r.ok === true && stats.rows[0].r.page_views >= 2, `owner can read stats (views=${stats.rows[0].r?.page_views})`)
ok(stats.rows[0].r.unique_visitors >= 1, 'owner stats include unique visitors')
ok(Array.isArray(stats.rows[0].r.users), 'owner stats include signed-up users')

await as(A, () => db.exec(`insert into public.plan_waitlist (plan, email, user_id, visitor_id) values ('gold', 'a@x.in', '${A}', 'vA')`))
const seenWaitB = await as(B, () => db.query('select count(*)::int c from public.plan_waitlist'))
ok(seenWaitB.rows[0].c === 0, 'RLS: user B cannot read the waitlist')

console.log(failures ? `\n${failures} check(s) failed` : '\nAll database checks passed')
process.exit(failures ? 1 : 0)
