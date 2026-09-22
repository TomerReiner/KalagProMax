-- Feature: event contact persons (e.g. bus drivers) + per-pluga confirmation
-- tracking with admin-configurable automatic reminders and escalation.
--
-- Design notes:
--  * A single event can serve "all plugot" (or any subset): event_confirmations
--    has one row per (event, pluga) that needs to confirm, so one Event record
--    is shared while each pluga gets its own independent confirm checkbox.
--  * Reminder/escalation timing is computed live on the client from
--    events.event_date + events.start_time - reminder_offset_minutes — there is
--    no server-side cron. This matches the in-app-only notification scope
--    already chosen for the daily open-tasks reminder (no real push), and
--    avoids depending on Vercel Cron's minimum daily-schedule granularity on
--    the Hobby plan, which is too coarse for a "1-2 hours before" reminder.
--  * RLS follows this app's existing default for operational tables: any
--    authenticated user can read/write (mirrors events/constraints).

alter table public.events add column if not exists reminder_offset_minutes integer;

create table if not exists public.event_contacts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  phone text not null,
  role_label text,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_event_contacts_updated'
  ) then
    create trigger trg_event_contacts_updated before update on public.event_contacts
      for each row execute function public.set_updated_date();
  end if;
end $$;
alter table public.event_contacts enable row level security;
drop policy if exists "authenticated full access" on public.event_contacts;
create policy "authenticated full access" on public.event_contacts for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table if not exists public.event_confirmations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  pluga text not null check (pluga in ('פארן', 'בשור', 'צין', 'רמון', 'תמר')),
  confirmed boolean not null default false,
  confirmed_by text,
  confirmed_by_id uuid references auth.users(id),
  confirmed_at timestamptz,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (event_id, pluga)
);
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_event_confirmations_updated'
  ) then
    create trigger trg_event_confirmations_updated before update on public.event_confirmations
      for each row execute function public.set_updated_date();
  end if;
end $$;
alter table public.event_confirmations enable row level security;
drop policy if exists "authenticated full access" on public.event_confirmations;
create policy "authenticated full access" on public.event_confirmations for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Make sure realtime updates actually reach connected clients for the tables
-- this app's live badges/timelines subscribe to (harmless if already added).
do $$
declare
  t text;
begin
  foreach t in array array[
    'direct_tasks', 'task_completions', 'events', 'daily_routines',
    'constraints', 'event_contacts', 'event_confirmations'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
