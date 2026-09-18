-- KalagProMax: fix role/assigned_role CHECK constraints
--
-- Run this ONCE, after 0001_init.sql and BEFORE 0002_seed_data.sql, if you
-- hit an error like:
--   ERROR: new row for relation "access_requests" violates check
--   constraint "access_requests_assigned_role_check"
--
-- Cause: an earlier draft of 0001_init.sql briefly had the Hebrew "Peh"
-- character in these two CHECK constraints written in its final form (ף,
-- U+05E3 — the shape a Peh takes only at the end of a word) instead of its
-- regular form (פ, U+05E4 — used everywhere else, including here, since
-- קלפ is not the end of the word it appears in). If that earlier draft is
-- what actually got run against this project, the live constraint rejects
-- the correct value 'קלפ' that the app and the seed data both use.
--
-- This is idempotent — it just makes sure both constraints match the
-- values in the current 0001_init.sql, regardless of what's live now.

begin;

alter table public.access_requests drop constraint if exists access_requests_assigned_role_check;
alter table public.access_requests add constraint access_requests_assigned_role_check
  check (assigned_role in ('קלפ', 'רסר', 'סגל', 'admin'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'user', 'קלפ', 'רסר', 'סגל'));

commit;
