-- "אחראי מווסתים" (meal_regulators_manager permission, src/lib/permissions.js)
-- can ask a pluga's קלפ to fill in that pluga's meal regulators for a given
-- day. The request is an ordinary direct_tasks row — so it shows up in that
-- קלפ's "המשימות שלי", in the 07:00 push and in the admin "משימות" page with
-- no extra plumbing — tagged with kind = 'meal_regulators' so the app can
-- recognize it (give it a "מלא מווסתים" button, and grant that קלפ edit
-- rights on their own pluga's regulators for that day).
-- See src/pages/MealRegulators.jsx and src/lib/mealRegulators.js.
-- Safe/idempotent — run once in the Supabase SQL Editor after 0019.

alter table public.direct_tasks add column if not exists kind text;

create index if not exists direct_tasks_kind_date_idx on public.direct_tasks(kind, task_date);
