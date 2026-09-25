-- ============================================================================
-- TEST PLAYGROUND — event-confirmation refresh script.
--
-- Companion to seed_test_playground.sql, but kept separate on purpose: the
-- reminder/escalation state of an event confirmation is computed live in the
-- app (src/lib/eventConfirmations.js -> getConfirmationState) from "now" vs.
-- the event's date/time, so unlike the rest of the test data these rows
-- can't sit on a fixed date far in the past/future — they need to stay near
-- "now" to actually land in the state they're meant to demonstrate.
--
-- Run this EVERY TIME you sit down to test the confirmation/escalation
-- feature (klaf/KlafEventConfirmations.jsx, admin's EventConfirmationsOverview,
-- and the reminder-offset + contacts UI in constraints/EventForm.jsx) — the
-- events' date/time are recomputed relative to the current moment each time
-- it runs. Safe to re-run any time: deletes its own fixed test rows (by id)
-- before re-inserting, same pattern as seed_test_playground.sql.
--
-- Uses Asia/Jerusalem local time (matching how the app itself parses
-- event_date/start_time as naive local values in the browser).
--
-- Five scenarios, one pluga each except the last:
--   90000000-...0001  [TEST] אירוע מאושר         - פארן already confirmed (green)
--   90000000-...0002  [TEST] אירוע עתידי רחוק     - בשור, well before its reminder threshold (neutral/upcoming)
--   90000000-...0003  [TEST] אירוע דורש תזכורת    - צין, past reminder threshold, not yet started (amber)
--   90000000-...0004  [TEST] אירוע שחלף מועדו     - רמון, event start time already passed, unconfirmed (red/escalated)
--   90000000-...0005  [TEST] אירוע לכל הפלוגות    - all 5 plugot, mixed confirmed/unconfirmed, + 2 contacts
--
-- Clean up with clear_test_playground.sql when done testing (removes this
-- data too, matched by the same [TEST] title prefix / id ranges).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- event_confirmations + event_contacts first (FK -> events, on delete
-- cascade would handle this anyway, but deleting explicitly keeps this
-- script correct even if that cascade is ever changed).
-- ---------------------------------------------------------------------------
delete from public.event_confirmations where id in (
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000002',
  '92000000-0000-4000-8000-000000000003',
  '92000000-0000-4000-8000-000000000004',
  '92000000-0000-4000-8000-000000000005',
  '92000000-0000-4000-8000-000000000006',
  '92000000-0000-4000-8000-000000000007',
  '92000000-0000-4000-8000-000000000008',
  '92000000-0000-4000-8000-000000000009'
);

delete from public.event_contacts where id in (
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002'
);

delete from public.events where id in (
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000003',
  '90000000-0000-4000-8000-000000000004',
  '90000000-0000-4000-8000-000000000005'
);

-- ---------------------------------------------------------------------------
-- events — event_date/start_time are TEXT columns, so "now" (in Israel
-- local time) is formatted into them explicitly per row. now() is stable
-- within this transaction, so every reference below resolves to the same
-- instant.
-- ---------------------------------------------------------------------------
insert into public.events (
  id, event_type, event_date, start_time, end_time, title, details,
  responsible_plugas, reminder_offset_minutes, created_by
)
values
  -- Scenario 1: already confirmed — 3 hours from now, default 90-min offset.
  -- getConfirmationState short-circuits to 'confirmed' regardless of timing.
  (
    '90000000-0000-4000-8000-000000000001', 'פנימי',
    to_char((now() at time zone 'Asia/Jerusalem') + interval '3 hours', 'YYYY-MM-DD'),
    to_char((now() at time zone 'Asia/Jerusalem') + interval '3 hours', 'HH24:MI'),
    to_char((now() at time zone 'Asia/Jerusalem') + interval '4 hours', 'HH24:MI'),
    '[TEST] אירוע מאושר - פארן', 'תרחיש: אישור הגעה כבר בוצע', array['פארן'], 90, 'test-seed'
  ),
  -- Scenario 2: 5 hours out, 90-min offset -> reminder threshold is in 3.5h,
  -- still well before it -> 'upcoming'.
  (
    '90000000-0000-4000-8000-000000000002', 'חיצוני',
    to_char((now() at time zone 'Asia/Jerusalem') + interval '5 hours', 'YYYY-MM-DD'),
    to_char((now() at time zone 'Asia/Jerusalem') + interval '5 hours', 'HH24:MI'),
    to_char((now() at time zone 'Asia/Jerusalem') + interval '6 hours', 'HH24:MI'),
    '[TEST] אירוע עתידי רחוק - בשור', 'תרחיש: לפני סף התזכורת', array['בשור'], 90, 'test-seed'
  ),
  -- Scenario 3: 1 hour out, 90-min offset -> threshold was 30 min ago,
  -- event itself hasn't started -> 'reminder'.
  (
    '90000000-0000-4000-8000-000000000003', 'פנימי',
    to_char((now() at time zone 'Asia/Jerusalem') + interval '1 hour', 'YYYY-MM-DD'),
    to_char((now() at time zone 'Asia/Jerusalem') + interval '1 hour', 'HH24:MI'),
    to_char((now() at time zone 'Asia/Jerusalem') + interval '2 hours', 'HH24:MI'),
    '[TEST] אירוע דורש תזכורת - צין', 'תרחיש: אחרי סף התזכורת, לפני תחילת האירוע', array['צין'], 90, 'test-seed'
  ),
  -- Scenario 4: started 1 hour ago -> now >= eventDateTime -> 'escalated'.
  (
    '90000000-0000-4000-8000-000000000004', 'חיצוני',
    to_char((now() at time zone 'Asia/Jerusalem') - interval '1 hour', 'YYYY-MM-DD'),
    to_char((now() at time zone 'Asia/Jerusalem') - interval '1 hour', 'HH24:MI'),
    to_char((now() at time zone 'Asia/Jerusalem'), 'HH24:MI'),
    '[TEST] אירוע שחלף מועדו - רמון', 'תרחיש: המועד כבר עבר וטרם אושר', array['רמון'], 90, 'test-seed'
  ),
  -- Scenario 5: 45 min out, 90-min offset -> threshold was 45 min ago ->
  -- unconfirmed plugot show 'reminder'; confirmed ones show 'confirmed'.
  -- Serves all 5 plugot + 2 contacts (bus driver, event coordinator).
  (
    '90000000-0000-4000-8000-000000000005', 'חיצוני',
    to_char((now() at time zone 'Asia/Jerusalem') + interval '45 minutes', 'YYYY-MM-DD'),
    to_char((now() at time zone 'Asia/Jerusalem') + interval '45 minutes', 'HH24:MI'),
    to_char((now() at time zone 'Asia/Jerusalem') + interval '3 hours', 'HH24:MI'),
    '[TEST] אירוע לכל הפלוגות - סטטוסים מעורבים', 'תרחיש: חלק אישרו, חלק לא, כל הפלוגות',
    array['פארן','בשור','צין','רמון','תמר'], 90, 'test-seed'
  );

-- ---------------------------------------------------------------------------
-- event_contacts — only on the all-plugot event (scenario 5), per plan.
-- ---------------------------------------------------------------------------
insert into public.event_contacts (id, event_id, name, phone, role_label, created_by)
values
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000005', 'test נהג אוטובוס', '0500000001', 'נהג', 'test-seed'),
  ('91000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000005', 'test רכז אירוע', '0500000002', 'רכז', 'test-seed');

-- ---------------------------------------------------------------------------
-- event_confirmations
-- ---------------------------------------------------------------------------
insert into public.event_confirmations (id, event_id, pluga, confirmed, confirmed_by, confirmed_at, created_by)
values
  -- Scenario 1: confirmed
  ('92000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'פארן', true, 'test-seed', now(), 'test-seed'),
  -- Scenario 2: upcoming, unconfirmed
  ('92000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002', 'בשור', false, null, null, 'test-seed'),
  -- Scenario 3: reminder, unconfirmed
  ('92000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000003', 'צין', false, null, null, 'test-seed'),
  -- Scenario 4: escalated, unconfirmed
  ('92000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000004', 'רמון', false, null, null, 'test-seed'),
  -- Scenario 5: all 5 plugot, mixed — פארן + בשור already confirmed, the other 3 not
  ('92000000-0000-4000-8000-000000000005', '90000000-0000-4000-8000-000000000005', 'פארן', true, 'test-seed', now(), 'test-seed'),
  ('92000000-0000-4000-8000-000000000006', '90000000-0000-4000-8000-000000000005', 'בשור', true, 'test-seed', now(), 'test-seed'),
  ('92000000-0000-4000-8000-000000000007', '90000000-0000-4000-8000-000000000005', 'צין', false, null, null, 'test-seed'),
  ('92000000-0000-4000-8000-000000000008', '90000000-0000-4000-8000-000000000005', 'רמון', false, null, null, 'test-seed'),
  ('92000000-0000-4000-8000-000000000009', '90000000-0000-4000-8000-000000000005', 'תמר', false, null, null, 'test-seed');

commit;
