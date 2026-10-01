-- Two unrelated small changes bundled into one migration since both came
-- from the same feature-request batch:
--
-- 1) Rename the "מחסן לוגיסטי" warehouse to "מחסן קליר". The warehouse name
--    is stored directly as the value everywhere (warehouse_items.warehouse,
--    withdrawal_requests.warehouse, playbox_orders.destination_warehouse,
--    equipment_holdings.warehouse) — there's no separate id/label split — so
--    the rename has to touch every existing row, not just
--    src/lib/constants.js's WAREHOUSES list.
--
-- 2) playbox_orders gets a name (an optional title for the order, separate
--    from the item itself) and an explicit approval flag, independent of
--    `status` — feature request: "לתת שם להזמנה בפלייבוקס ואפשרות לערוך
--    אותה. כל מי שיש לו הרשאות לפלייבוקס יכול לאשר כל הזמנה, וגם אחרי עדכון
--    הזמנה יש לאשר אותה מחדש." Editing an order (src/pages/Playbox.jsx) resets
--    approved back to false app-side, same way updating anything else here
--    is just a plain UPDATE — no trigger needed for that part.

update public.warehouse_items set warehouse = 'מחסן קליר' where warehouse = 'מחסן לוגיסטי';
update public.withdrawal_requests set warehouse = 'מחסן קליר' where warehouse = 'מחסן לוגיסטי';
update public.equipment_holdings set warehouse = 'מחסן קליר' where warehouse = 'מחסן לוגיסטי';
update public.playbox_orders set destination_warehouse = 'מחסן קליר' where destination_warehouse = 'מחסן לוגיסטי';

alter table public.playbox_orders drop constraint if exists playbox_orders_destination_warehouse_check;
alter table public.playbox_orders add constraint playbox_orders_destination_warehouse_check
  check (destination_warehouse is null or destination_warehouse in ('מכולה', 'מחסן קרביץ', 'מחסן קליר'));

alter table public.playbox_orders add column if not exists name text;
alter table public.playbox_orders add column if not exists approved boolean not null default false;
alter table public.playbox_orders add column if not exists approved_by_name text;
alter table public.playbox_orders add column if not exists approved_by_id uuid references auth.users(id);
alter table public.playbox_orders add column if not exists approved_at timestamptz;
