-- Bug fix: task_completions.task_type only ever allowed ('event', 'shotaf')
-- (see 0001_init.sql), but the app itself has always written a third value,
-- 'direct', for completions of direct_tasks rows — see the task_type: 'direct'
-- entries in src/testdata/fixtures.js and Klaf.jsx's `task_type: task.type`
-- (src/pages/Klaf.jsx), where task.type is 'direct' for a direct task. Any
-- real attempt to mark a direct task complete has always violated this CHECK
-- constraint and failed outright — this was never exercised until real
-- production data (a Base44 export containing task_type: 'direct' rows) was
-- imported and hit it. Widening the constraint to match what the app already
-- writes; no data needs backfilling, since a row that violated the old
-- constraint could never have been inserted in the first place.
alter table public.task_completions drop constraint if exists task_completions_task_type_check;
alter table public.task_completions add constraint task_completions_task_type_check
  check (task_type in ('event', 'shotaf', 'direct'));
