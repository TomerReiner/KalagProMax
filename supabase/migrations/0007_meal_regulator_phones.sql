-- Meal regulators need a phone number next to each name (so whoever's
-- coordinating meals can just tap to call), not only the name itself.
-- `names text[]` can't hold a name+phone pair per entry, so this adds a
-- `regulators jsonb` column holding an array of {"name": ..., "phone": ...}
-- objects instead, and backfills it from the existing `names` array (each
-- name gets phone: null, since that information didn't exist before).
--
-- `names` is intentionally left in place rather than dropped — the app no
-- longer reads or writes it after this migration (see
-- src/components/klaf/KlafMealRegulators.jsx), but keeping the column means
-- this migration can't lose data even if something unexpected already
-- depended on it. Drop it yourself once you've confirmed `regulators` has
-- everything you need:
--   alter table public.meal_regulators drop column names;
alter table public.meal_regulators add column if not exists regulators jsonb not null default '[]'::jsonb;

update public.meal_regulators
set regulators = (
  select coalesce(jsonb_agg(jsonb_build_object('name', n, 'phone', null)), '[]'::jsonb)
  from unnest(names) as n
)
where jsonb_array_length(regulators) = 0
  and names is not null
  and array_length(names, 1) > 0;
