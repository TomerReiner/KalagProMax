-- Feature: personal permission delegation. Admins can grant any of a fixed
-- set of capability keys to any user, independent of their role. Some keys
-- are scoped to one or more plugot; one row here = one (user, permission,
-- pluga) grant, so "this person can pull from the frisa corner on behalf of
-- Paran AND Bashor" is just two rows, not an array column. This deliberately
-- avoids the pluga/plugas dual-shape that constraints.pluga vs
-- constraints.plugas already caused one real bug from (Klaf.jsx /
-- KlafConstraints.jsx having to match both shapes).
--
-- pluga = null means the grant is global (not tied to a specific pluga) —
-- used for playbox_orders (one org-wide responsible klaf).
--
-- Equipment withdrawal ("משיכת ציוד") is NOT one of the permission keys
-- below — it already has its own personal-flag column, profiles
-- .equipment_manager (see 0001_init.sql), which is exactly this same
-- "personal flag, independent of role" model. No need to duplicate it here;
-- the admin UI just shows both under one "הרשאות" section.
--
-- No CHECK constraint on `permission` on purpose, so a new permission key
-- can be introduced later without a migration — validity is enforced
-- app-side (see src/lib/permissions.js).

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  pluga text check (pluga in ('פארן', 'בשור', 'צין', 'רמון', 'תמר')),
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now()
);

-- A pluga-scoped grant can't be duplicated (same user+permission+pluga)...
create unique index if not exists user_permissions_scoped_uniq
  on public.user_permissions(user_id, permission, pluga) where pluga is not null;
-- ...and neither can a global one (pluga is null, which a plain unique
-- constraint would treat as always-distinct, so this needs its own partial
-- index rather than folding into the constraint above).
create unique index if not exists user_permissions_global_uniq
  on public.user_permissions(user_id, permission) where pluga is null;

create index if not exists user_permissions_user_idx on public.user_permissions(user_id);

alter table public.user_permissions enable row level security;
drop policy if exists "authenticated full access" on public.user_permissions;
create policy "authenticated full access" on public.user_permissions for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- playbox_orders — permission key: playbox_orders (global; one responsible
-- klaf per org holds it). Any klaf can log an order request for their pluga
-- for the coming week; the permission holder sees the consolidated list
-- across all plugot before placing the real order on Playbox's site.
-- ---------------------------------------------------------------------------
create table if not exists public.playbox_orders (
  id uuid primary key default gen_random_uuid(),
  pluga text not null check (pluga in ('פארן', 'בשור', 'צין', 'רמון', 'תמר')),
  order_date text not null,
  item text not null,
  quantity numeric not null default 1,
  notes text,
  status text not null default 'ממתין' check (status in ('ממתין', 'הוזמן', 'בוטל')),
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_playbox_orders_updated') then
    create trigger trg_playbox_orders_updated before update on public.playbox_orders
      for each row execute function public.set_updated_date();
  end if;
end $$;
alter table public.playbox_orders enable row level security;
drop policy if exists "authenticated full access" on public.playbox_orders;
create policy "authenticated full access" on public.playbox_orders for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- meal_regulators — permission key: meal_regulators, pluga-scoped. 2-3 named
-- people per pluga per meal (lunch/dinner), edited day by day by that
-- pluga's own klaf (or whoever was granted the permission for that pluga).
-- ---------------------------------------------------------------------------
create table if not exists public.meal_regulators (
  id uuid primary key default gen_random_uuid(),
  pluga text not null check (pluga in ('פארן', 'בשור', 'צין', 'רמון', 'תמר')),
  meal_date text not null,
  meal_type text not null check (meal_type in ('צהריים', 'ערב')),
  names text[] not null default '{}',
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (pluga, meal_date, meal_type)
);
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_meal_regulators_updated') then
    create trigger trg_meal_regulators_updated before update on public.meal_regulators
      for each row execute function public.set_updated_date();
  end if;
end $$;
alter table public.meal_regulators enable row level security;
drop policy if exists "authenticated full access" on public.meal_regulators;
create policy "authenticated full access" on public.meal_regulators for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- food pickup ("משיכת מזון לנסיעות", e.g. sandwiches from Kibbutz Einat) is
-- NOT a separate registration table/permission (an earlier draft of this
-- migration had one — food_travel_requests — dropped before ever shipping).
-- It's simpler than that: a checkbox on the event itself. An external event
-- (events.event_type = 'חיצוני') that needs someone to go pick up food gets
-- food_pickup_needed = true; the existing "אוכל" task already shown on the
-- Klaf page for events.food_pluga (src/pages/Klaf.jsx) then gets reminder
-- styling (day-before / hours-before) computed the same way event-
-- confirmation reminders already are — see src/lib/eventConfirmations.js
-- and its new getFoodPickupState(). No approval workflow, no separate
-- permission: whoever's pluga already holds food_pluga for that event just
-- sees the richer reminder on a task they'd see anyway.
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists food_pickup_needed boolean not null default false;

-- Realtime, matching the app's existing live-update tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'user_permissions', 'playbox_orders', 'meal_regulators'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
