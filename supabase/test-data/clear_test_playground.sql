-- ============================================================================
-- TEST PLAYGROUND — cleanup script.
--
-- Removes every row inserted by seed_test_playground.sql AND
-- refresh_test_confirmations.sql (same fixed ids, so this stays correct even
-- after re-running either script many times). Safe to run even if one or
-- both of those scripts were never run, or were only partially run — every
-- delete is a no-op in that case.
--
-- Deletion order respects foreign keys (event_confirmations/event_contacts
-- before events; everything before the tables events/daily_routines don't
-- reference). on delete cascade on event_confirmations/event_contacts would
-- handle this automatically when the events are deleted, but they're listed
-- explicitly for clarity and so this script keeps working if that cascade
-- ever changes.
-- ============================================================================

begin;

-- refresh_test_confirmations.sql rows
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

-- seed_test_playground.sql rows
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

delete from public.constraints where id in (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003'
);

delete from public.events where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006'
);

delete from public.daily_routines where id in (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
);

commit;

-- Sanity check: should return 0 rows if everything above was cleared.
select 'remaining test rows' as check, (
  (select count(*) from public.event_confirmations where id::text like '92000000%') +
  (select count(*) from public.event_contacts where id::text like '91000000%') +
  (select count(*) from public.events where id::text like '90000000%' or id::text like '10000000%') +
  (select count(*) from public.task_completions where id::text like '70000000%') +
  (select count(*) from public.direct_tasks where id::text like '20000000%') +
  (select count(*) from public.constraints where id::text like '30000000%') +
  (select count(*) from public.daily_routines where id::text like '40000000%')
) as remaining_count;
