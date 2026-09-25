# KalagProMax — now on Supabase + Vercel

This app was exported from Base44 and has been converted to run on your own
stack: Supabase for the database/auth/storage, Vercel for hosting the
frontend and four small serverless functions. This file is the setup
checklist — do these steps in order.

## What changed

- `src/api/base44Client.js` is now a compatibility shim: it keeps the exact
  same `base44.entities.X` / `base44.auth.*` / `base44.functions.invoke` /
  `base44.integrations.Core.*` / `base44.users.*` surface every page already
  calls, but backs it with Supabase instead of Base44. **No page or component
  outside `src/lib/AuthContext.jsx` and `src/pages/ResetPassword.jsx` needed
  to change.**
- `supabase/migrations/0001_init.sql` recreates all 16 Base44 entities as
  Postgres tables (same field names — `created_date`, `updated_date`,
  `created_by`, `created_by_id` — so the shim needs no translation layer),
  plus a `profiles` table (the old `User` entity) synced to `auth.users`, RLS
  policies, and a public `attachments` storage bucket.
- `supabase/migrations/0001a_fix_role_check_constraints.sql` fixes a
  transcription bug in an early draft of `0001_init.sql`: the Hebrew role
  value `קלפ` was briefly written with the final form of the last letter
  (`ף`) instead of the regular form (`פ`) in two CHECK constraints. Run this
  once, right after `0001_init.sql`, even if your project already ran the
  buggy draft — it's idempotent.
- `supabase/migrations/0002_seed_data.sql` imports your real historical data
  from the 15 CSV files you exported out of Base44 (see step 7 below — this
  replaces the manual "import CSV via Table Editor" approach entirely).
- `supabase/migrations/0003_direct_tasks_nullable_date.sql` makes
  `direct_tasks.task_date` nullable, so an admin can create a general/weekly
  task with no date yet ("backlog") and assign it to a day later from the
  Tasks page.
- `supabase/migrations/0004_event_contacts_confirmations.sql` adds event
  contact persons (e.g. a bus driver, with a call button) and per-pluga
  confirmation tracking for events (confirm checkbox, live reminder/escalation
  styling, admin oversight dashboard) — plus adds a few more tables to the
  realtime publication so live badges/timelines actually update without a
  page refresh.
- `supabase/migrations/0005_delegated_permissions.sql` adds the delegated-
  permissions feature: `user_permissions` plus two new tables
  (`playbox_orders`, `meal_regulators`), and a plain `food_pickup_needed`
  boolean column on `events`. See the dedicated section below for how it
  works.
- `supabase/migrations/0006_drop_food_travel_requests.sql` — only matters if
  you already ran an earlier draft of `0005` that created a
  `food_travel_requests` table (that feature was redesigned into the
  `food_pickup_needed` checkbox above before it ever really shipped). Drops
  that table if it exists; a no-op on a project that never had it.
- The 3 Base44 backend functions became Vercel serverless functions under
  `/api`, plus a 4th (`/api/invite-user.js`) that replaces
  `base44.users.inviteUser` (admin invites need the service-role key, which
  can only ever run server-side).
- `src/pages/OAuthConsent.jsx` was **dropped from routing** (still on disk,
  unused). It authorized AI clients against Base44's own hosted MCP server —
  that has no equivalent once the app is off Base44, and isn't part of the
  app's actual functionality.
- Email notifications (new access requests, new withdrawal requests) are
  **not wired up yet** — you asked to skip that for now. The two spots are
  marked `TODO` in `api/submit-access-request.js` and
  `api/process-withdrawal.js`. Nothing is lost functionally: admins still see
  new requests live (realtime + the bell badge), there's just no email ping.

## 1. Run the database migrations

In the Supabase dashboard for your project: **SQL Editor → New query**, and
run these files **in order** (paste each one's contents, run, then move
to the next):

1. `supabase/migrations/0001_init.sql` — creates every table, the `profiles`
   trigger, RLS policies, realtime publication entries, and the
   `attachments` storage bucket.
2. `supabase/migrations/0001a_fix_role_check_constraints.sql` — safe to run
   even if you don't think you need it.
3. `supabase/migrations/0002_seed_data.sql` — your real data from Base44 (see
   step 7).
4. `supabase/migrations/0003_direct_tasks_nullable_date.sql` — safe/idempotent,
   needed for the "general task with no date" feature.
5. `supabase/migrations/0004_event_contacts_confirmations.sql` — safe/
   idempotent, needed for the event contacts/confirmation feature.
6. `supabase/migrations/0005_delegated_permissions.sql` — safe/idempotent,
   needed for the delegated-permissions feature. **If you already ran an
   earlier draft of this exact file** (one that created a
   `food_travel_requests` table), re-running this updated version is still
   safe — everything in it is idempotent, so it just adds the one thing
   that's new (`events.food_pickup_needed`) and no-ops on the rest.
7. `supabase/migrations/0006_drop_food_travel_requests.sql` — only needed if
   you're in the situation above; drops the leftover `food_travel_requests`
   table. Safe/no-op if you never had it.

(Or, if you use the Supabase CLI: `supabase db push` after `supabase link` —
it will pick up all seven in filename order.)

## 2. Turn on email-OTP signup (only if you'll use the Register page)

The main **Login** page only offers "Continue with Google" + "request
access" — most people will never touch `/register`. If you do want the
email/password + 6-digit-code signup flow on `/register` to work as written,
Supabase's default signup email is a magic link, not a 6-digit code. Switch
it in **Authentication → Email Templates → Confirm signup**: change the link
to use `{{ .Token }}` (the OTP code) instead of `{{ .ConfirmationURL }}`. If
you skip this, Register.jsx's OTP screen will show for a code that never
arrives — Google sign-in is unaffected either way.

## 3. Turn on Google as an auth provider

**Authentication → Providers → Google** — you'll need a Google OAuth client
ID/secret (from Google Cloud Console); Supabase's docs walk through this
under "Login with Google". Set the authorized redirect URI to the one
Supabase shows you there.

## 4. Environment variables

`.env.local` is already filled in with your project's URL and
anon/publishable key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`SUPABASE_URL`). The one value only you should type in — never paste it into
a chat/AI tool, since it bypasses RLS entirely — is
`SUPABASE_SERVICE_ROLE_KEY`, from **Project Settings → API → service_role
secret**. Fill it into `.env.local` yourself.

In **Vercel → your project → Settings → Environment Variables**, set all
four:

| Name | Value | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Project URL | same as above, used by the browser |
| `VITE_SUPABASE_ANON_KEY` | anon/publishable key | same as above, used by the browser |
| `SUPABASE_URL` | Project URL | used by `/api/*` functions |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **secret** — server-only, never `VITE_`-prefixed |

The service-role key bypasses row-level security. It is only ever read
inside `api/_lib/supabaseAdmin.js`, which runs on Vercel's servers, never in
the browser bundle.

## 5. Push to GitHub, import into Vercel

1. `git push` this repo to a GitHub repo (or keep using the existing one).
2. In Vercel: **Add New → Project → Import** that repo. Vercel auto-detects
   Vite (build command `npm run build`, output `dist`) and picks up the
   `/api` functions automatically — `vercel.json` is already set for both.
3. Add the 4 environment variables from step 4, then deploy.

## 6. Make yourself an admin

After you've signed in once (Google, or via a self-registered account), open
**Supabase → Table Editor → profiles**, find your row, and set `role` to
`admin`. Everyone else's `role` stays `NULL` until you approve their access
request from the app's admin panel (top-right user-cog icon) — that's the
same "someone requests access, an admin approves it" flow the app already
had.

## 7. Your data from Base44

Already handled — `supabase/migrations/0002_seed_data.sql` was generated
directly from the 15 CSV files you exported out of Base44 and imports all of
it (34 gaps, 11 gap updates, 6 access requests, 6 events, 4 direct tasks, 9
daily routines, 11 warehouse items, 3 withdrawal requests, 2 recurring
events, 2 equipment settings, 1 daily summary, 1 task completion — the 3
empty exports, Constraint/EquipmentHolding/RecurringOverride, had nothing to
import). A few things worth knowing about how it was converted:

- Base44's 24-character ids aren't valid Postgres uuids, so every id was
  deterministically remapped to one (same input always produces the same
  output), which keeps cross-references — Gap ↔ GapUpdate,
  DirectTask ↔ TaskCompletion — intact.
- `created_by_id` couldn't be mapped to a real user in your new `auth.users`
  table (Base44's internal ids don't correspond to anyone here), so it's
  `NULL` on every imported row; the original Base44 id is kept as plain text
  in `created_by` instead, so nothing is lost.
- No file attachments were in the export, so there was nothing to re-upload
  to the `attachments` Storage bucket. If any of your gaps had photos in
  Base44, you'd need to re-upload those manually and add the URLs to the
  relevant `gaps.attachments` rows.

If you ever need to bring over more data later (a fresh export after using
Base44 a bit longer, say), the same approach works: export CSVs from Base44
and ask for them to be converted into a new numbered migration file the same
way.

## Delegated permissions

Admins can grant any user — any role, not just קלפ — one or more of three
capabilities, independent of their normal role permissions. There's no
standalone "delegated permissions" page for any of this; each capability
was folded into wherever it naturally belongs in the app instead:

- **פינת פריסה ומשיכה מהחד"א** (`frisa_pina`) — lets someone complete the
  daily "משיכת פינת פריסה" task on behalf of a pluga other than their own,
  e.g. one person doing the pickup for several plugot. Lives right on the
  Klaf page (`src/pages/Klaf.jsx`), folded into the existing frisa task —
  a klaf can always complete their own pluga's task as before; this just
  extends that to other plugot on days it's assigned to one of them.
- **ניהול מווסתים לארוחות** (`meal_regulators`) — day-by-day editing of the
  2-3 named meal regulators per pluga, for lunch and dinner separately. Also
  lives on the Klaf page: a real קלפ who holds this permission for their own
  pluga sees it as an extra section on their normal page; someone with no
  קלפ role at all who was delegated this for one or more plugot instead gets
  a minimal version of the Klaf page (just a date/pluga picker and the
  meal-regulators editor, no task list) when they visit `/klaf`.
- **פלייבוקס והזמנות להמשך השבוע** (`playbox_orders`) — org-wide, not
  per-pluga: whoever holds this sees a consolidated view of every pluga's
  order requests, before placing the real order on Playbox's own site. This
  one *does* get its own page — `src/pages/Playbox.jsx` at `/playbox` —
  since it's a focused, single-purpose screen rather than a grab-bag of
  unrelated tabs.

**"משיכת מזון לנסיעות" turned out not to need a permission or a table at
all.** It's just a checkbox on the event form itself
(`events.food_pickup_needed`, added in `EventForm.jsx`) — when checked, the
existing per-pluga "אוכל" task that already shows up on the Klaf page for
that event gets live reminder styling as the event approaches: a "לזכור
למשוך אוכל" badge starting 24 hours before, "למשוך אוכל בקרוב" inside the
last 90 minutes, and "המועד עבר - יש למשוך אוכל" once the event's start time
has passed. See `getFoodPickupState()` in `src/lib/eventConfirmations.js`
(same live-recompute-on-a-client-tick pattern as the event-confirmation
reminders) and `src/pages/Klaf.jsx` for where it's rendered.

Grant permissions from the admin menu (user-cog icon) → **משתמשים** tab →
expand **"הרשאות מיוחדות"** under any user. `frisa_pina` and
`meal_regulators` are granted **per pluga** (checkboxes — check as many
plugot as that person should cover); `playbox_orders` is a single org-wide
switch. Equipment withdrawal access is *not* part of this system — it's the
older `profiles.equipment_manager` flag, shown in the same place for
convenience but stored separately (it already was exactly this kind of
personal, role-independent flag, so there was no need to migrate it).

Storage: `user_permissions` has one row per `(user_id, permission, pluga)`
grant. A permission covering several plugot for the same person is simply
several rows — **never** an array column — which sidesteps the `pluga` vs
`plugas` dual-shape that `constraints` has and that already caused one real
bug in this codebase (Klaf.jsx / KlafConstraints.jsx having to match both
shapes). `pluga = null` means a global grant (used for `playbox_orders`).
See `src/lib/permissions.js` for the exact helpers (`hasPermission`,
`hasAnyPermission`, `plugotFor`) and
`supabase/migrations/0005_delegated_permissions.sql` for the schema/RLS.

Nav visibility follows the same permissions: `/playbox` only appears for a
`playbox_orders` holder, and `/klaf` becomes reachable for a `meal_regulators`
holder even outside the קלפ role (see `src/components/TopNav.jsx`'s
`extraPermissionKey` and `src/components/AppLayout.jsx`'s route guard, which
both check `user_permissions` in addition to role).

## Adding real email later

When you're ready, pick a provider (Resend is the easiest to wire into a
Vercel function) and fill in the two `TODO`s in `api/submit-access-request.js`
and `api/process-withdrawal.js`. Both already have the full HTML/recipient
logic ported from the original Base44 functions — just add the actual send
call.

## Test playground (manually clicking through every feature/edge case)

There are two ways to get realistic test data across all 5 plugot for
manually clicking through every feature/edge case. Test mode (below) is the
simpler one — reach for the SQL scripts only if you specifically want the
data to live in the real Supabase project (visible in the dashboard,
shareable with a teammate via a real login, etc).

### Test mode — in the app, no Supabase involved at all

Click **"כניסה למצב בדיקה (ללא Supabase)"** on the login screen. This logs
you in as a fake local admin backed entirely by an in-memory data store
(`src/testdata/fixtures.js` + `src/testdata/mockStore.js`) — nothing is ever
read from or written to your real Supabase project while it's on, and
nothing you do in test mode can affect real data. It ships pre-seeded with
the exact same scenarios described below (fully/partially/un-assigned days,
overlapping event+constraint, backlog tasks, all 5 event-confirmation
states, ...), computed relative to the moment the page loads — so unlike the
SQL scripts there's nothing to remember to re-run; every reload is
automatically fresh.

While it's on, an admin menu (the user-cog icon, "תצוגה" tab) shows an amber
"מצב בדיקה פעיל" box with two buttons: **אפס נתוני בדיקה** (reseed fresh
fixtures without leaving test mode) and **יציאה ממצב בדיקה** (turn it off
and go back to the real login). Combine it with the existing "תצוגת תפקיד"
preview switcher right below to click through the app as any pluga's klaf.

Scope: pre-seeded with realistic data are the 6 original features (Klaf, the
daily schedule/constraints, Tasks, the TopNav badge, event confirmations),
plus פערים/gaps (every status/priority, a couple of stale ones, one with a
full update/comment history), משיכות ציוד/equipment (items across all 3
warehouses, one overdue holding, one open-ended holding, and pending/
approved/rejected withdrawal requests), and delegated permissions — the test
profile is pre-granted all 3 permission keys (frisa_pina for two plugot,
playbox_orders globally, meal_regulators for one pluga), so Klaf.jsx's
meal-regulators section and `/playbox` both have something to show out of
the box. Four more events are seeded with `food_pickup_needed: true`, timed
to land in each of the four food-pickup reminder states (upcoming, reminder,
urgent, overdue) so that styling is visible on the Klaf page too without
waiting for real time to pass.

The **"משתמשים" tab in the admin menu is also seeded** — 8 fake users across
every role and pluga (`src/testdata/fixtures.js`'s `profiles` array), a
couple of them already holding a permission or two (דנה לוי has frisa_pina
for two plugot at once, for example), the rest with none — so you can expand
"הרשאות מיוחדות" for any of them and try the granting UI itself, not just
the pages that consume it. The signed-in fake admin's own profile (from
`buildProfile()`) is separate from this list and always stays the same
regardless of what you do here. Only the "בקשות גישה" tab still shows empty
— access requests aren't part of this fixture set.

### Alternative: SQL scripts against the real project

`supabase/test-data/` has three scripts, run in the SQL Editor against this
same project — no separate test project needed. They only ever touch rows
with fixed test ids and a `[TEST]` title prefix, and are all safe to re-run
any number of times (each deletes its own rows before re-inserting them, so
nothing duplicates). You don't need a real klaf account to see any of it —
sign in as your admin and use the "preview as klaf" switcher already in the
app.

1. **`seed_test_playground.sql`** — the bulk of it: a fully-assigned day, a
   partially-assigned/mixed-completion day, a fully-unassigned day, a day
   with an overlapping event+constraint and a constraint crossing midnight,
   a deliberately empty day, and a fully-completed day — plus backlog tasks
   with no date, a task assigned to all 5 plugot, and a constraint saved
   both ways (single `pluga` and multi-`plugas`) so both save paths show up
   on the klaf's own timeline. Dates are computed relative to *today* (D+0
   through D+6) each time the script runs, so the data always shows up where
   you'd naturally look in the app — no need to navigate to some far-off
   date. That also means it's meant to be **re-run each time you sit down to
   test** (like script 2 below); running it once and coming back tomorrow
   without re-running it just means "today's" test day is now yesterday's.
2. **`refresh_test_confirmations.sql`** — the event-contact/confirmation
   feature specifically. Its 5 events are scheduled *relative to whenever
   you run it* (event-confirmation reminder/escalation timing is computed
   live from "now" in the app down to the hour, not just the date, so it
   needs its own script rather than reusing script 1's day-level offsets) —
   one already confirmed, one well before its reminder time, one past the
   reminder threshold, one past its start time and still unconfirmed, and
   one serving all 5 plugot at once with a mix of confirmed/unconfirmed plus
   2 contacts with call buttons. **Re-run this one each time you sit down to
   test** so the states are fresh.
3. **`clear_test_playground.sql`** — removes everything the two scripts
   above inserted, in one go, when you're done testing. Ends with a sanity
   `select` that should show `0` remaining test rows.
