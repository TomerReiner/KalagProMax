-- Feature: admin broadcast announcements ("לאפשר למנהלים להפיץ הודעות").
-- Any admin can post one; every signed-in user can read the list (surfaced
-- in src/components/NotificationsBell.jsx alongside gap updates). Publishing
-- one also triggers a real Web Push notification to every subscribed device
-- (api/publish-announcement.js, called right after the row is created — see
-- src/components/AdminPanel.jsx's "הודעות" tab) — this table only holds the
-- announcement itself, not delivery/read state per recipient (read state
-- reuses profiles.notifications_last_read, the same cutoff already used for
-- gap updates).

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger trg_announcements_updated before update on public.announcements
  for each row execute function public.set_updated_date();

alter table public.announcements enable row level security;

create policy "readable by any signed-in user" on public.announcements for select
  using (auth.uid() is not null);
create policy "admins manage announcements" on public.announcements for all
  using (public.is_admin()) with check (public.is_admin());

-- Realtime, matching gaps/gap_updates so the notifications bell updates live
-- without a manual refresh.
alter publication supabase_realtime add table public.announcements;
