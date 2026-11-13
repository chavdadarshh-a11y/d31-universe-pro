-- v4.1: four tiers — free, pro, gold, platinum.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('free', 'pro', 'gold', 'platinum'));
