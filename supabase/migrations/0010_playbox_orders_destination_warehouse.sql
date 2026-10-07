-- Marking a playbox_orders row "התקבל" (received — see
-- 0009_playbox_orders_received_status.sql) now also asks which physical
-- warehouse the goods actually went into (the same 3 from
-- src/pages/Equipment.jsx / src/lib/constants.js's WAREHOUSES), and credits
-- that warehouse's warehouse_items stock by the order's quantity — so
-- equipment received via Playbox actually shows up in "משיכות ציוד" instead
-- of only being tracked as a closed order. Nullable: only ever set once an
-- order reaches "התקבל"; never required for ממתין/הוזמן/בוטל.
alter table public.playbox_orders add column if not exists destination_warehouse text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'playbox_orders_destination_warehouse_check'
  ) then
    alter table public.playbox_orders add constraint playbox_orders_destination_warehouse_check
      check (destination_warehouse is null or destination_warehouse in ('מכולה', 'מחסן קרביץ', 'מחסן לוגיסטי'));
  end if;
end $$;
