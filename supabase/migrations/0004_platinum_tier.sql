-- v4.0: three tiers — free, pro, platinum. Old 'premium'/'coaching' rows become 'platinum'.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
update public.subscriptions set plan = 'platinum' where plan in ('premium', 'coaching');
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('free', 'pro', 'platinum'));
update public.payments set plan = 'platinum' where plan in ('premium', 'coaching');
