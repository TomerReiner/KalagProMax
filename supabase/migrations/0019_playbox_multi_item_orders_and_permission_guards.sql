-- Feature batch (2026-10): four changes that need the database, bundled.
-- Safe/idempotent — run once in the Supabase SQL Editor after 0018.
--
-- 1) Permission helpers usable from RLS policies / triggers.
-- 2) שוטף (daily_routines) is now actually write-protected in the database:
--    only an admin or a holder of the shotaf_schedule permission can
--    create/change/delete a row. Everyone signed in can still read it.
--    Before this, the app only hid the controls in one place
--    (src/components/dailysummary/ShotafPanel.jsx) while the quick-edit on
--    the constraints calendar let anyone change it.
-- 3) user_permissions: only admins can grant/revoke. It used to be
--    "authenticated full access", which would have let anyone grant
--    themselves any permission — making every permission check (including
--    the shotaf one above) meaningless.
-- 4) playbox_orders becomes an order with several items:
--    `items jsonb` = [{ name, quantity, note }] (note = unit/remark, e.g.
--    "מטר"). The old single-item columns (item, quantity, notes) stay for
--    old rows; every existing row is backfilled into `items`.
--    Anyone can create/edit an order; only an approver (admin / סגל /
--    playbox_orders permission) can approve it or change its status, and
--    any change to its content resets the approval — enforced by a trigger,
--    not just the UI.
-- 5) equipment_holdings.untracked — a returnable item withdrawn from
--    מחסן קרביץ / מחסן קליר that was never in the inventory list (free-text
--    withdrawal). Returning it must not credit any inventory row.

-- ---------------------------------------------------------------------------
-- 1) helpers
-- ---------------------------------------------------------------------------
create or replace function public.has_global_permission(perm text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_permissions where user_id = auth.uid() and permission = perm
  );
$$;

create or replace function public.can_edit_shotaf()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_admin() or public.has_global_permission('shotaf_schedule');
$$;

-- Mirrors effectivePermissions() in src/lib/permissions.js: admin and סגל
-- hold playbox_orders automatically.
create or replace function public.can_approve_playbox()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_admin()
    or public.has_global_permission('playbox_orders')
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'סגל');
$$;

-- ---------------------------------------------------------------------------
-- 2) daily_routines — read for everyone, write for shotaf editors only
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated full access" on public.daily_routines;
drop policy if exists "daily_routines read" on public.daily_routines;
drop policy if exists "daily_routines insert" on public.daily_routines;
drop policy if exists "daily_routines update" on public.daily_routines;
drop policy if exists "daily_routines delete" on public.daily_routines;
create policy "daily_routines read" on public.daily_routines for select
  using (auth.uid() is not null);
create policy "daily_routines insert" on public.daily_routines for insert
  with check (public.can_edit_shotaf());
create policy "daily_routines update" on public.daily_routines for update
  using (public.can_edit_shotaf()) with check (public.can_edit_shotaf());
create policy "daily_routines delete" on public.daily_routines for delete
  using (public.can_edit_shotaf());

-- ---------------------------------------------------------------------------
-- 3) user_permissions — read for everyone, write for admins only
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated full access" on public.user_permissions;
drop policy if exists "user_permissions read" on public.user_permissions;
drop policy if exists "user_permissions admin write" on public.user_permissions;
create policy "user_permissions read" on public.user_permissions for select
  using (auth.uid() is not null);
create policy "user_permissions admin write" on public.user_permissions for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4) playbox_orders — multi-item orders + approval guard
-- ---------------------------------------------------------------------------
alter table public.playbox_orders add column if not exists items jsonb not null default '[]';
alter table public.playbox_orders alter column item drop not null;
alter table public.playbox_orders alter column quantity drop not null;

update public.playbox_orders
set items = jsonb_build_array(jsonb_build_object('name', item, 'quantity', coalesce(quantity, 1), 'note', null))
where items = '[]'::jsonb and item is not null;

create or replace function public.playbox_orders_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  -- auth.uid() is null for the service role / SQL editor — never block those.
  approver boolean := auth.uid() is null or public.can_approve_playbox();
begin
  if tg_op = 'INSERT' then
    if not approver then
      new.approved := false;
      new.approved_by_name := null;
      new.approved_by_id := null;
      new.approved_at := null;
      new.status := 'ממתין';
    end if;
    return new;
  end if;

  -- Clearing an approval (true -> false) is allowed for anyone — that's what
  -- an edit does. Granting one, or changing status/destination, is not.
  if not approver and (
     (new.approved and not old.approved)
     or new.status is distinct from old.status
     or new.destination_warehouse is distinct from old.destination_warehouse) then
    raise exception 'רק מנהל או אחראי פלייבוקס יכולים לאשר הזמנה או לשנות את הסטטוס שלה';
  end if;

  if new.name is distinct from old.name
     or new.order_date is distinct from old.order_date
     or new.items is distinct from old.items
     or new.notes is distinct from old.notes then
    -- Content changed: whatever was approved before no longer matches.
    new.approved := false;
    new.approved_by_name := null;
    new.approved_by_id := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_playbox_orders_guard on public.playbox_orders;
create trigger trg_playbox_orders_guard before insert or update on public.playbox_orders
  for each row execute function public.playbox_orders_guard();

drop policy if exists "authenticated full access" on public.playbox_orders;
drop policy if exists "playbox_orders read" on public.playbox_orders;
drop policy if exists "playbox_orders insert" on public.playbox_orders;
drop policy if exists "playbox_orders update" on public.playbox_orders;
drop policy if exists "playbox_orders delete" on public.playbox_orders;
create policy "playbox_orders read" on public.playbox_orders for select
  using (auth.uid() is not null);
create policy "playbox_orders insert" on public.playbox_orders for insert
  with check (auth.uid() is not null);
create policy "playbox_orders update" on public.playbox_orders for update
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "playbox_orders delete" on public.playbox_orders for delete
  using (created_by_id = auth.uid() or public.can_approve_playbox());

-- ---------------------------------------------------------------------------
-- 5) equipment_holdings.untracked
-- ---------------------------------------------------------------------------
alter table public.equipment_holdings add column if not exists untracked boolean not null default false;
