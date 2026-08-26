-- Web Push race reminders — storage for browser subscriptions and a per-session
-- "already sent" log so a reminder goes out exactly once.
-- See docs/web-push-notifiche.md for the full setup.

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  lang       text default 'it',
  user_agent text,
  created_at timestamptz not null default now()
);

-- One row per (race, session) that has already been notified. The unique
-- constraint is what guarantees a single push even if the cron overlaps.
create table if not exists public.sent_reminders (
  id          bigint generated always as identity primary key,
  race_round  int  not null,
  season      int  not null,
  session_key text not null,
  sent_at     timestamptz not null default now(),
  unique (season, race_round, session_key)
);

-- Row Level Security.
-- The browser (anon key) only needs to add or remove its own subscription.
-- Endpoints are capability URLs, not personal data; sending still requires the
-- server-only VAPID private key, so anon access here is low-risk for a hobby app.
alter table public.push_subscriptions enable row level security;
alter table public.sent_reminders     enable row level security;

drop policy if exists "anon insert subscription" on public.push_subscriptions;
drop policy if exists "anon update subscription" on public.push_subscriptions;
drop policy if exists "anon delete subscription" on public.push_subscriptions;

create policy "anon insert subscription" on public.push_subscriptions
  for insert to anon with check (true);
create policy "anon update subscription" on public.push_subscriptions
  for update to anon using (true) with check (true);
create policy "anon delete subscription" on public.push_subscriptions
  for delete to anon using (true);

-- sent_reminders is written only by the Edge Function (service role, which
-- bypasses RLS). No anon policies → the table is invisible to the anon key.
