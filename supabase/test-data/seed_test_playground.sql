-- ============================================================================
-- TEST PLAYGROUND SEED DATA — not a schema migration, run manually whenever
-- you want a full sandbox to click through every feature/edge case as admin
-- (preview mode) across all 5 plugot.
--
-- Dates are relative to "today" (Asia/Jerusalem), computed fresh every time
-- this script runs, so the test data always shows up right where you'd
-- naturally look in the app instead of needing to navigate to some fixed
-- date. That also means it's meant to be RE-RUN each time you sit down to
-- test (same re-run pattern as refresh_test_confirmations.sql) — if you ran
-- it yesterday and come back today without re-running it, "TEST_DAY_1" is
-- now yesterday instead of today.
--
-- Safe to re-run any time regardless: every statement below deletes its own
-- fixed test rows (by explicit id) before re-inserting them, so running this
-- twice in a row (or once a day) just refreshes the same data rather than
-- duplicating it.
--
-- Every title is prefixed "[TEST]" so it's easy to spot in the UI and easy
-- to bulk-delete later (see clear_test_playground.sql in this same folder).
--
-- Test dates used (all relative to today, D+0 = today):
--   D+0  TEST_DAY_1        — fully assigned day (שוטף + אירועים + אילוץ)
--   D+1  TEST_DAY_2        — partially assigned, mixed open/completed
--   D+2  TEST_DAY_3        — everything unassigned ("טרם הוחלט")
--   D+3  TEST_DAY_4        — overlapping event+constraint, cross-midnight constraint
--   D+4  (intentionally not seeded — a second, unlabeled empty day)
--   D+5  TEST_DAY_EMPTY    — deliberately left empty, no rows inserted (empty-state test)
--   D+6  TEST_DAY_FULL_DONE — everything on this day is already completed (100%)
--
-- Event-confirmation (bus/contact) test data is intentionally NOT here — its
-- reminder/escalation states are computed relative to "now" (not just the
-- date), so it lives in refresh_test_confirmations.sql, meant to be re-run
-- each time you sit down to test rather than pinned to a fixed date.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- daily_routines (שוטף)
-- ---------------------------------------------------------------------------
delete from public.daily_routines where id in (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
);

insert into public.daily_routines (id, routine_date, morning_assembly_plugas, frisa_morning, noon_cleaning, evening_cleaning, created_by)
values
  -- TEST_DAY_1 (today): fully assigned
  ('40000000-0000-4000-8000-000000000001', to_char((now() at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD'), array['פארן','בשור'], 'צין', 'רמון', 'תמר', 'test-seed'),
  -- TEST_DAY_2 (tomorrow): partial — one field assigned (פארן, for a completion test), two "טרם הוחלט", one assigned to בשור
  ('40000000-0000-4000-8000-000000000002', to_char((now() at time zone 'Asia/Jerusalem')::date + 1, 'YYYY-MM-DD'), array['פארן'], 'טרם הוחלט', 'טרם הוחלט', 'בשור', 'test-seed'),
  -- TEST_DAY_3 (D+2): everything unassigned
  ('40000000-0000-4000-8000-000000000003', to_char((now() at time zone 'Asia/Jerusalem')::date + 2, 'YYYY-MM-DD'), array[]::text[], 'טרם הוחלט', 'טרם הוחלט', 'טרם הוחלט', 'test-seed'),
  -- TEST_DAY_FULL_DONE (D+6): fully assigned to פארן (all 4 fields get completions below)
  ('40000000-0000-4000-8000-000000000004', to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), array['פארן'], 'פארן', 'פארן', 'פארן', 'test-seed');

-- ---------------------------------------------------------------------------
-- events (אירועים)
-- ---------------------------------------------------------------------------
delete from public.events where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006'
);

insert into public.events (id, event_type, event_date, start_time, end_time, title, details, transport_pluga, transport_details, food_pluga, food_details, responsible_plugas, created_by)
values
  -- TEST_DAY_1 (today): internal event, single pluga responsible
  ('10000000-0000-4000-8000-000000000001', 'פנימי', to_char((now() at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD'), '09:00', '10:00', '[TEST] מסדר פנימי - פארן בלבד', null, null, null, null, null, array['פארן'], 'test-seed'),
  -- TEST_DAY_1 (today): internal event, multiple plugot responsible
  ('10000000-0000-4000-8000-000000000002', 'פנימי', to_char((now() at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD'), '11:00', '12:00', '[TEST] פעילות פנימית - כמה פלוגות', null, null, null, null, null, array['בשור','צין'], 'test-seed'),
  -- TEST_DAY_2 (tomorrow): internal event, NOT assigned to any pluga yet (shows in "משימות לשיבוץ")
  ('10000000-0000-4000-8000-000000000003', 'פנימי', to_char((now() at time zone 'Asia/Jerusalem')::date + 1, 'YYYY-MM-DD'), '10:00', '11:00', '[TEST] אירוע פנימי טרם שובץ', null, null, null, null, null, array[]::text[], 'test-seed'),
  -- TEST_DAY_4 (D+3): external event, transport + food both assigned to different plugot (overlaps a constraint below)
  ('10000000-0000-4000-8000-000000000004', 'חיצוני', to_char((now() at time zone 'Asia/Jerusalem')::date + 3, 'YYYY-MM-DD'), '13:00', '16:00', '[TEST] טיול שנתי', 'לבדיקת חפיפה עם אילוץ', 'רמון', 'הסעה משוריינת - 3 אוטובוסים', 'תמר', 'ארוחת צהריים בשטח', null, 'test-seed'),
  -- TEST_DAY_4 (D+3): external event, only transport assigned, food still "טרם הוחלט"
  ('10000000-0000-4000-8000-000000000005', 'חיצוני', to_char((now() at time zone 'Asia/Jerusalem')::date + 3, 'YYYY-MM-DD'), '17:00', '19:00', '[TEST] אירוע ערב - אוכל טרם שובץ', null, 'פארן', null, null, null, null, 'test-seed'),
  -- TEST_DAY_FULL_DONE (D+6): internal event, assigned to פארן (gets a completion below)
  ('10000000-0000-4000-8000-000000000006', 'פנימי', to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), '08:00', '09:00', '[TEST] יום מושלם - אירוע', null, null, null, null, null, array['פארן'], 'test-seed');

-- ---------------------------------------------------------------------------
-- constraints (אילוצים) — one matches the singular `pluga` column (the shape
-- KlafConstraints.jsx itself saves), one matches the `plugas` array (the
-- shape the admin's multi-select "אילוצים" page saves) — both must show up
-- on the relevant pluga's Klaf timeline after the matching fix.
-- ---------------------------------------------------------------------------
delete from public.constraints where id in (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003'
);

insert into public.constraints (id, pluga, plugas, constraint_date, start_time, end_time, title, details, created_by)
values
  -- TEST_DAY_4 (D+3): overlaps E4 (transport, רמון) in time — tests side-by-side column layout. Saved via `plugas` array (admin-style).
  ('30000000-0000-4000-8000-000000000001', null, array['רמון'], to_char((now() at time zone 'Asia/Jerusalem')::date + 3, 'YYYY-MM-DD'), '13:30', '14:30', '[TEST] אילוץ חופף - רמון', 'בודק תצוגה זה-לצד-זה עם האירוע', 'test-seed'),
  -- TEST_DAY_4 (D+3): crosses midnight (end_time < start_time) — exercises the cross-midnight height calc. Saved via singular `pluga` (klaf-style).
  ('30000000-0000-4000-8000-000000000002', 'פארן', null, to_char((now() at time zone 'Asia/Jerusalem')::date + 3, 'YYYY-MM-DD'), '22:00', '02:00', '[TEST] אילוץ חוצה חצות - פארן', null, 'test-seed'),
  -- TEST_DAY_1 (today): normal, two plugot via the `plugas` array
  ('30000000-0000-4000-8000-000000000003', null, array['פארן','בשור'], to_char((now() at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD'), '08:00', '09:30', '[TEST] אילוץ רגיל - שתי פלוגות', null, 'test-seed');

-- ---------------------------------------------------------------------------
-- direct_tasks (משימות ישירות + כלליות/backlog)
-- ---------------------------------------------------------------------------
delete from public.direct_tasks where id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000007',
  '20000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000009',
  '20000000-0000-4000-8000-000000000010'
);

insert into public.direct_tasks (id, title, pluga, responsible_plugas, task_date, start_time, end_time, status, notes, created_by)
values
  -- TEST_DAY_1 (today): single pluga, has a time (shows on the לוז timeline too)
  ('20000000-0000-4000-8000-000000000001', '[TEST] משימה ישירה עם שעה', 'צין', null, to_char((now() at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD'), '14:00', '15:00', 'פתוחה', null, 'test-seed'),
  -- TEST_DAY_1 (today): multiple plugot, no time (list-only)
  ('20000000-0000-4000-8000-000000000002', '[TEST] משימה למספר פלוגות', null, array['רמון','תמר'], to_char((now() at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD'), null, null, 'פתוחה', null, 'test-seed'),
  -- TEST_DAY_1 (today): assigned to ALL 5 plugot at once — tests the pluga-chip row doesn't overflow
  ('20000000-0000-4000-8000-000000000005', '[TEST] משימה לכל הפלוגות', null, array['פארן','בשור','צין','רמון','תמר'], to_char((now() at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD'), null, null, 'פתוחה', null, 'test-seed'),
  -- TEST_DAY_2 (tomorrow): very long title + notes — tests text wrapping/truncation doesn't break the card
  ('20000000-0000-4000-8000-000000000004', '[TEST] משימה עם כותרת ארוכה מאוד כדי לבדוק שהעיצוב לא נשבר ושהטקסט מתגלגל יפה בכרטיסייה ולא גולש מחוץ לגבולות המסגרת בשום מסך', 'בשור', null, to_char((now() at time zone 'Asia/Jerusalem')::date + 1, 'YYYY-MM-DD'), null, null, 'פתוחה', 'הערה ארוכה גם כן, כדי לוודא שגם טקסט חופשי ארוך במיוחד מוצג כראוי ולא שובר את הפריסה של הכרטיסייה.', 'test-seed'),
  -- Backlog (no date): no pluga yet
  ('20000000-0000-4000-8000-000000000006', '[TEST] משימה כללית לשיבוץ - ללא פלוגה', null, null, null, null, null, 'פתוחה', null, 'test-seed'),
  -- Backlog (no date): single pluga pre-set
  ('20000000-0000-4000-8000-000000000007', '[TEST] משימה כללית לשיבוץ - עם פלוגה', 'צין', null, null, null, null, 'פתוחה', null, 'test-seed'),
  -- Backlog (no date): multiple plugot pre-set
  ('20000000-0000-4000-8000-000000000008', '[TEST] משימה כללית - מספר פלוגות', null, array['פארן','רמון'], null, null, null, 'פתוחה', null, 'test-seed'),
  -- TEST_DAY_FULL_DONE (D+6): two tasks, both already done (status + completion row below)
  ('20000000-0000-4000-8000-000000000009', '[TEST] יום מושלם - משימה 1', 'פארן', null, to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), null, null, 'טופלה', null, 'test-seed'),
  ('20000000-0000-4000-8000-000000000010', '[TEST] יום מושלם - משימה 2', 'פארן', null, to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), null, null, 'טופלה', null, 'test-seed');

-- ---------------------------------------------------------------------------
-- task_completions — drives the "הושלם" state on the Klaf page independently
-- of direct_tasks.status (see the comment on TEST_DAY_FULL_DONE above).
-- ---------------------------------------------------------------------------
delete from public.task_completions where id in (
  '70000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000004',
  '70000000-0000-4000-8000-000000000005',
  '70000000-0000-4000-8000-000000000006',
  '70000000-0000-4000-8000-000000000007',
  '70000000-0000-4000-8000-000000000008'
);

insert into public.task_completions (id, task_type, task_id, task_field, task_label, task_date, pluga, created_by)
values
  -- TEST_DAY_2 (tomorrow): the one assigned shotaf field (morning_assembly_plugas -> פארן) is completed, everything else on that day stays open — a mixed day
  ('70000000-0000-4000-8000-000000000001', 'shotaf', '40000000-0000-4000-8000-000000000002', 'morning_assembly_plugas', '[TEST] מסדר בוקר', to_char((now() at time zone 'Asia/Jerusalem')::date + 1, 'YYYY-MM-DD'), 'פארן', 'test-seed'),
  -- TEST_DAY_FULL_DONE (D+6): all 4 shotaf fields for פארן
  ('70000000-0000-4000-8000-000000000002', 'shotaf', '40000000-0000-4000-8000-000000000004', 'frisa_morning', '[TEST] משיכת פינת פריסה', to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), 'פארן', 'test-seed'),
  ('70000000-0000-4000-8000-000000000003', 'shotaf', '40000000-0000-4000-8000-000000000004', 'morning_assembly_plugas', '[TEST] מסדר בוקר', to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), 'פארן', 'test-seed'),
  ('70000000-0000-4000-8000-000000000004', 'shotaf', '40000000-0000-4000-8000-000000000004', 'noon_cleaning', '[TEST] ניקוי צהריים', to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), 'פארן', 'test-seed'),
  ('70000000-0000-4000-8000-000000000005', 'shotaf', '40000000-0000-4000-8000-000000000004', 'evening_cleaning', '[TEST] ניקוי ערב', to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), 'פארן', 'test-seed'),
  -- TEST_DAY_FULL_DONE (D+6): the internal event
  ('70000000-0000-4000-8000-000000000006', 'event', '10000000-0000-4000-8000-000000000006', 'responsible', '[TEST] יום מושלם - אירוע', to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), 'פארן', 'test-seed'),
  -- TEST_DAY_FULL_DONE (D+6): the two direct tasks (task_field = the task's own id for type "direct")
  ('70000000-0000-4000-8000-000000000007', 'direct', '20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000009', '[TEST] יום מושלם - משימה 1', to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), 'פארן', 'test-seed'),
  ('70000000-0000-4000-8000-000000000008', 'direct', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000010', '[TEST] יום מושלם - משימה 2', to_char((now() at time zone 'Asia/Jerusalem')::date + 6, 'YYYY-MM-DD'), 'פארן', 'test-seed');

commit;
