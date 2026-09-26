-- "התקבל" (received) as its own status, separate from "הוזמן" (ordered) —
-- so placing the real order and the shipment actually arriving are two
-- different, explicit steps instead of one status meaning both. Marking an
-- order "התקבל" (see src/pages/Playbox.jsx) also credits its quantity back
-- into the matching playbox_items.current_quantity, so the stock tab
-- reflects that the shortage was filled.
alter table public.playbox_orders drop constraint if exists playbox_orders_status_check;
alter table public.playbox_orders add constraint playbox_orders_status_check
  check (status in ('ממתין', 'הוזמן', 'התקבל', 'בוטל'));
