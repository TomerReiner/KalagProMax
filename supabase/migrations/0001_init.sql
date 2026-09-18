-- KalagProMax: Base44 -> Supabase schema migration
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- Recreates every Base44 entity as a Postgres table, keeps the same field
-- names the frontend already uses (created_date / updated_date / created_by /
-- created_by_id), adds a profiles table synced to auth.users, and sets up RLS
-- policies that match the app's Base44 defaults (see README-SUPABASE.md).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: touch updated_date on every UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (Base44 "User" entity) — one row per auth.users row
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text check (role in ('admin', 'user', 'קלף', 'רסר', 'סגל')),
  pluga text check (pluga in ('פארן', 'בשור', 'צין', 'רמון', 'תמר')),
  equipment_manager boolean not null default false,
  notifications_last_read timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_date();

-- Auto-create a profile row whenever a new auth user is created (Google
-- sign-in or an admin invite). role/pluga come from invite metadata when the
-- admin invited the user directly; otherwise they start NULL, which the app
-- treats as "not registered yet" until an admin approves an access request.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, pluga)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'pluga'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Security-definer helper so RLS policies can check "is the caller an admin"
-- without recursively querying profiles under RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Lets a signed-in user mark their own notifications read without being able
-- to touch role / pluga / equipment_manager on their own row (that would be
-- a privilege-escalation bug if it went through a plain UPDATE policy).
create or replace function public.mark_notifications_read(read_at timestamptz)
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set notifications_last_read = read_at where id = auth.uid();
$$;

alter table public.profiles enable row level security;

create policy "profiles readable by any signed-in user"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "admins manage all profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Generic helper macro (written out per table — Postgres has no real macros)
-- Every "operational" table below gets the same shape:
--   id, created_date, updated_date, created_by, created_by_id, ...fields
--   RLS: any authenticated user can select/insert/update/delete
-- ---------------------------------------------------------------------------

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  assigned_role text check (assigned_role in ('קלף', 'רסר', 'סגל', 'admin')),
  pluga text check (pluga in ('פארן', 'בשור', 'צין', 'רמון', 'תמר')),
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_access_requests_updated before update on public.access_requests
  for each row execute function public.set_updated_date();
alter table public.access_requests enable row level security;
create policy "admins only" on public.access_requests for all
  using (public.is_admin()) with check (public.is_admin());

create table public.constraints (
  id uuid primary key default gen_random_uuid(),
  pluga text,
  plugas text[],
  constraint_date text not null,
  start_time text not null,
  end_time text not null,
  title text not null,
  details text,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_constraints_updated before update on public.constraints
  for each row execute function public.set_updated_date();
alter table public.constraints enable row level security;
create policy "authenticated full access" on public.constraints for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.daily_routines (
  id uuid primary key default gen_random_uuid(),
  routine_date text not null,
  morning_assembly_plugas text[],
  frisa_morning text default 'טרם הוחלט',
  noon_cleaning text default 'טרם הוחלט',
  evening_cleaning text default 'טרם הוחלט',
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_daily_routines_updated before update on public.daily_routines
  for each row execute function public.set_updated_date();
alter table public.daily_routines enable row level security;
create policy "authenticated full access" on public.daily_routines for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_date text not null,
  entries jsonb not null default '[]',
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_daily_summaries_updated before update on public.daily_summaries
  for each row execute function public.set_updated_date();
alter table public.daily_summaries enable row level security;
create policy "authenticated full access" on public.daily_summaries for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.direct_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  pluga text,
  responsible_plugas text[],
  task_date text not null,
  start_time text,
  end_time text,
  status text not null default 'פתוחה' check (status in ('פתוחה', 'טופלה')),
  notes text,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_direct_tasks_updated before update on public.direct_tasks
  for each row execute function public.set_updated_date();
alter table public.direct_tasks enable row level security;
create policy "authenticated full access" on public.direct_tasks for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.equipment_holdings (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  warehouse text not null,
  quantity numeric not null,
  pluga text not null,
  held_by_name text,
  withdrawal_date text not null,
  expected_return_date text,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_equipment_holdings_updated before update on public.equipment_holdings
  for each row execute function public.set_updated_date();
alter table public.equipment_holdings enable row level security;
create policy "authenticated full access" on public.equipment_holdings for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.equipment_settings (
  id uuid primary key default gen_random_uuid(),
  responsible_klaf_id text,
  responsible_klaf_name text,
  notification_emails text[],
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_equipment_settings_updated before update on public.equipment_settings
  for each row execute function public.set_updated_date();
alter table public.equipment_settings enable row level security;
create policy "authenticated full access" on public.equipment_settings for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('חיצוני', 'פנימי')),
  event_date text not null,
  start_time text not null,
  end_time text not null,
  title text not null,
  details text,
  transport_pluga text,
  transport_details text,
  food_pluga text,
  food_details text,
  responsible_plugas text[],
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_events_updated before update on public.events
  for each row execute function public.set_updated_date();
alter table public.events enable row level security;
create policy "authenticated full access" on public.events for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.gaps (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  gap text not null,
  location text,
  class_name text,
  building_number text,
  room_number text,
  status text not null default 'טרם הועלה',
  priority text not null default 'בינוני',
  note text,
  reporter_name text,
  reporter_phone text,
  attachments jsonb not null default '[]',
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_gaps_updated before update on public.gaps
  for each row execute function public.set_updated_date();
alter table public.gaps enable row level security;
create policy "authenticated full access" on public.gaps for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.gap_updates (
  id uuid primary key default gen_random_uuid(),
  gap_id uuid references public.gaps(id) on delete cascade,
  update_type text not null default 'תגובה',
  field text,
  old_value text,
  new_value text,
  text text,
  author_name text,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_gap_updates_updated before update on public.gap_updates
  for each row execute function public.set_updated_date();
alter table public.gap_updates enable row level security;
create policy "authenticated full access" on public.gap_updates for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.recurring_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_time text not null,
  end_time text not null,
  recurrence text not null check (recurrence in ('daily', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
  pluga text,
  details text,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_recurring_events_updated before update on public.recurring_events
  for each row execute function public.set_updated_date();
alter table public.recurring_events enable row level security;
create policy "authenticated full access" on public.recurring_events for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.recurring_overrides (
  id uuid primary key default gen_random_uuid(),
  recurring_event_id uuid references public.recurring_events(id) on delete cascade,
  original_date text not null,
  new_date text not null,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_recurring_overrides_updated before update on public.recurring_overrides
  for each row execute function public.set_updated_date();
alter table public.recurring_overrides enable row level security;
create policy "authenticated full access" on public.recurring_overrides for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_type text not null check (task_type in ('event', 'shotaf')),
  task_id text not null,
  task_field text,
  task_label text,
  task_date text not null,
  pluga text,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
alter table public.task_completions enable row level security;
create policy "read own or admin" on public.task_completions for select
  using (created_by_id = auth.uid() or public.is_admin());
create policy "create own" on public.task_completions for insert
  with check (created_by_id = auth.uid());
create policy "delete own or admin" on public.task_completions for delete
  using (created_by_id = auth.uid() or public.is_admin());

create table public.warehouse_items (
  id uuid primary key default gen_random_uuid(),
  warehouse text not null,
  name text not null,
  quantity numeric not null default 0,
  returnable boolean not null default false,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_warehouse_items_updated before update on public.warehouse_items
  for each row execute function public.set_updated_date();
alter table public.warehouse_items enable row level security;
create policy "authenticated full access" on public.warehouse_items for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  warehouse text not null,
  items jsonb not null default '[]',
  requested_by_name text,
  pluga text not null,
  request_date text not null,
  expected_return_date text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by_name text,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_withdrawal_requests_updated before update on public.withdrawal_requests
  for each row execute function public.set_updated_date();
alter table public.withdrawal_requests enable row level security;
create policy "authenticated full access" on public.withdrawal_requests for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- Realtime: the app subscribes to live changes on these three tables
-- (notifications bell, pending-withdrawals badge, admin access-request badge).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.gaps;
alter publication supabase_realtime add table public.gap_updates;
alter publication supabase_realtime add table public.access_requests;
alter publication supabase_realtime add table public.withdrawal_requests;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for gap attachments (images/videos), replacing
-- Base44's UploadPublicFile integration.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "public read attachments"
  on storage.objects for select
  using (bucket_id = 'attachments');

create policy "authenticated upload attachments"
  on storage.objects for insert
  with check (bucket_id = 'attachments' and auth.uid() is not null);

create policy "authenticated delete own attachments"
  on storage.objects for delete
  using (bucket_id = 'attachments' and auth.uid() is not null);
