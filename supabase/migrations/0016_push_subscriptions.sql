-- Feature: real Web Push notifications (VAPID). One row here = one browser's
-- subscription to push messages for one signed-in user — a person signed in
-- on two devices (phone + laptop) gets two rows, and both receive every push
-- sent to that user. Written/deleted almost entirely through the two
-- server-side endpoints (api/push-subscribe.js, api/push-unsubscribe.js,
-- called from src/lib/pushNotifications.js), which use the service-role key
-- and so bypass RLS — the policies below exist for defense in depth /
-- consistency with every other table, not because the client is expected to
-- write here directly.
--
-- Consumed by api/_lib/webPush.js, from api/send-daily-tasks-push.js (the
-- 7:00 daily reminder, see 0017_announcements.sql's sibling cron migration
-- note) and api/publish-announcement.js (admin broadcasts).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger trg_push_subscriptions_updated before update on public.push_subscriptions
  for each row execute function public.set_updated_date();

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "read own or admin" on public.push_subscriptions for select
  using (user_id = auth.uid() or public.is_admin());
create policy "create own" on public.push_subscriptions for insert
  with check (user_id = auth.uid());
create policy "update own" on public.push_subscriptions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own or admin" on public.push_subscriptions for delete
  using (user_id = auth.uid() or public.is_admin());
