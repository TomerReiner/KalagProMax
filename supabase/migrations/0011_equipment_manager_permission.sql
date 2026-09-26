-- Equipment withdrawal delegation ("אחראי משיכות ציוד") moves from its own
-- personal-flag column (profiles.equipment_manager, see 0001_init.sql) into
-- the delegated-permissions system (user_permissions, see
-- 0005_delegated_permissions.sql) as a new key: 'equipment_manager', global
-- (pluga is null) — same shape as playbox_orders. This is purely an admin-UI
-- reorganization (AdminPanel now manages it under "הרשאות מיוחדות" like every
-- other delegated permission, instead of its own separate switch); the
-- actual access it grants (Equipment.jsx's canEdit check) is unchanged.
--
-- This migration only needs to backfill: create a user_permissions row for
-- every profile that currently has equipment_manager = true, so nobody loses
-- access when the app starts reading the permission instead of the column.
-- No new table/column, no CHECK constraint change — user_permissions.permission
-- has never had one (see 0005), by design, so a new key needs no migration
-- for the column itself.
--
-- profiles.equipment_manager itself is intentionally left in place (not
-- dropped) — nothing in the app reads it after this, but dropping a column
-- is a one-way door and there's no reason to take it here.

insert into public.user_permissions (user_id, permission, pluga)
select p.id, 'equipment_manager', null
from public.profiles p
where p.equipment_manager = true
on conflict do nothing;
