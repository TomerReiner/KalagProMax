-- Allow "backlog" direct tasks: general/weekly tasks with no specific date
-- yet. An admin creates these without a date, and later assigns ("drops")
-- them onto a specific day by setting task_date, at which point they flow
-- into the normal per-day task pipeline (Klaf view, Tasks day/week view)
-- exactly like any other direct task.
--
-- A null task_date is simply excluded by every existing `.eq('task_date', X)`
-- filter (Klaf.jsx, KlafConstraints.jsx-style queries), so no other query in
-- the app needs to change for this to be safe.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'direct_tasks'
      and column_name = 'task_date'
      and is_nullable = 'NO'
  ) then
    alter table public.direct_tasks alter column task_date drop not null;
  end if;
end $$;
