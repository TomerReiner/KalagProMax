-- Cleanup for anyone who already ran an earlier draft of
-- 0005_delegated_permissions.sql (before "משיכת מזון לנסיעות" was redesigned
-- from its own permission+table into a plain checkbox on events — see
-- events.food_pickup_needed and getFoodPickupState() in
-- src/lib/eventConfirmations.js). That earlier draft created a
-- food_travel_requests table; the current 0005 file never creates it, so a
-- fresh project never needs this file at all — it only matters if
-- food_travel_requests already exists in your database.
--
-- `cascade` also drops its update-timestamp trigger and RLS policy, which
-- only exist because the table does, and Postgres automatically drops a
-- table's entry from any realtime publication (supabase_realtime included)
-- along with the table itself, so there's nothing else to clean up here.
drop table if exists public.food_travel_requests cascade;

-- Optional: if you ever used the admin UI to grant the old `food_travel`
-- permission to anyone before this redesign, those rows are now inert (the
-- app no longer recognizes the key, so they're simply ignored) but harmless
-- to leave in place. Uncomment to remove them too:
-- delete from public.user_permissions where permission = 'food_travel';
