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
- `supabase/migrations/0007_meal_regulator_phones.sql` adds a phone number
  next to each meal regulator's name — see the dedicated section below.
- `supabase/migrations/0008_playbox_stock_tracking.sql` added
  `playbox_orders.auto_generated` plus a per-pluga stock/reorder-point
  tracking table, `playbox_items`. The per-pluga tracking UI built on top of
  it was later removed (see the dedicated Playbox section below) — the
  `auto_generated` column stays in active use for the equipment-shortage
  flow that replaced it, and `playbox_items` is left in the database unused
  rather than dropped.
- `supabase/migrations/0009_playbox_orders_received_status.sql` adds
  "התקבל" (received) as its own `playbox_orders.status` value, separate from
  "הוזמן" (ordered) — see the dedicated section below.
- `supabase/migrations/0010_playbox_orders_destination_warehouse.sql` adds
  `playbox_orders.destination_warehouse` — see the dedicated section below.
- `supabase/migrations/0013_playbox_orders_optional_pluga.sql` drops the
  `not null` on `playbox_orders.pluga` — an order no longer has to be tagged
  to a specific pluga, since Playbox itself doesn't split its catalog by
  pluga. See the dedicated section below.
- `supabase/migrations/0014_meal_regulator_entry_time.sql` adds
  `meal_regulators.entry_time` — one scheduled entry time per pluga+meal+day,
  since lunch in particular has each pluga entering at a different time. See
  the dedicated section below.
- `src/lib/constants.js` now exports `WAREHOUSES` (the 3 physical
  warehouses: מכולה / מחסן קרביץ / מחסן לוגיסטי), moved there from a local
  const in `src/pages/Equipment.jsx` so `src/pages/Playbox.jsx` can offer the
  same 3 destinations. No behavior change for Equipment itself.
- General tasks (`src/pages/Tasks.jsx`, the backlog list) got a straight
  "סיים משימה" (finish task) button instead of picking a date and assigning
  it to a day first — most of these just need to be marked done, not
  scheduled.
- Fixed event contact-person bugs (the "אנשי קשר" list in "עריכת אירוע",
  `src/components/constraints/EventForm.jsx`):
  - The contact inputs sat inside the outer event `<form>`, so pressing Enter
    while typing a name/phone — the natural instinct — submitted and closed
    the whole dialog instead of adding the contact, so it never actually got
    saved. Pressing Enter in those fields now adds the contact instead.
  - `Constraints.jsx`'s `handleEventSubmit` used to clear `eventEditing` to
    `null` right after saving, but that state change landed *while the edit
    dialog was still open* (EventForm's own submit handler was still waiting
    on it, hadn't called `onClose()` yet) — for one render, EventForm saw
    `open: true, editing: null`, which its effects read as "now showing a
    blank new-event form" and reset the local contacts list. `eventEditing`
    is now cleared once, correctly, in the dialog's actual `onClose` handler.
  - Contacts were only ever visible inside the edit dialog. Clicking an event
    on the schedule (the "פרטי אירוע" view dialog) now also loads and shows
    its contacts — name, role and a tap-to-call phone link — so you don't
    have to reopen the edit form just to see who to call.
  - **The actual cause of the repeated "contacts still aren't saved" reports**:
    the "אנשי קשר" name/phone fields are a *separate*, immediate save —
    `handleAddContact` calls the API the moment "הוסף" is clicked — they were
    never part of the main event form's fields and were never sent by
    "שמור שינויים". Typing a contact's details and then clicking "שמור
    שינויים" directly (the natural expectation — "save the event" should mean
    "save everything I just filled in") silently discarded whatever was
    sitting in those fields, with the dialog just closing right after as if
    nothing was lost. `handleSubmit` now checks the contact fields before
    closing: if a complete name+phone is sitting there, it saves it as part
    of the same "שמור שינויים" click; if only one of the two is filled, it
    warns instead of silently dropping it.
  Also gave the "עריכת אילוץ" button its own outlined, icon-labeled style
  instead of the same muted look as "סגור", so it reads as an action rather
  than blending into the dialog chrome.
- The meal-regulators name+phone entry row (`KlafMealRegulators.jsx`) was
  still cramped on a full desktop screen because the component was nested
  inside two 2-column grids at once (per-pluga breakdown, then per-meal-type
  inside it), quartering its real width regardless of viewport size. The
  per-meal-type grid is now always a single column (removing one level of
  nesting), and the entry row uses a wrapping flex layout with minimum input
  widths instead of a fixed 3-column grid — name+phone+button share one row
  when there's room (the common case now) and wrap instead of shrinking to
  unusable widths when there isn't.
- Every pluga-selection control app-wide now shows that pluga's color
  (`PLUGA_COLORS[p].dot` next to the name in a `<Select>`'s dropdown options,
  matching the pattern `GapForm.jsx` already used; the existing colored
  toggle-pill pattern for multi-selects), not just the plain-text options
  most of them had before: the "פלוגה אחראית"/"פלוגה מבצעת"/"פלוגה" selects in
  `EventForm.jsx` (transport + food + the "פלוגות אחראיות" pills for internal
  events), `RecurringEventForm.jsx`, `WithdrawalForm.jsx`, `DirectTaskForm.jsx`,
  `Playbox.jsx`'s add-order form, `Tasks.jsx`'s pluga filter, `Klaf.jsx`'s two
  "preview as קלפ" pluga pickers, the שוטף-task quick-edit select and the
  per-field select in `Shotaf.jsx`, and in `AdminPanel.jsx` the preview-role
  pluga picker, the pending-request pluga override, the existing-user pluga
  assignment, and the per-permission scoped-plugot checkbox grid (now with a
  colored dot per pluga and a tinted background once checked). Already-colored
  controls (`GapForm.jsx`, `StandaloneTaskForm.jsx`, the constraint-form and
  event-confirmation pills) were left as they were.
- The gaps page (`src/pages/Home.jsx`, "מעקב פערי בנייה") now has a second
  view alongside the original card list: a Jira-style board
  (`src/components/gaps/GapBoard.jsx`), one column per status (טרם הועלה /
  בטיפול / טופל), cards draggable between columns to change status — using
  `@hello-pangea/dnd`, which was already a dependency but unused until now.
  **The board is the new default view** (a "לוח"/"רשימה" toggle switches to
  the list); the original "פעילים"/"ארכיון" toggle only applies to the list,
  since the board already shows every status side by side as its own column
  (that's the point of a board — "טופל" is just another column, not hidden).
  Dragging a card updates its status the same way the list's status buttons
  do — same `Gap.update` call, same `GapUpdate` history log entry — with an
  optimistic local update so the card doesn't visibly snap back while the
  request is in flight. If you don't already have `@hello-pangea/dnd`
  installed locally, run `npm install` after pulling this — it's in
  `package.json`'s dependencies but may not be in your `node_modules` yet.
  The board also got a more prominent frame: a thick outer border around the
  whole board (so it reads as its own distinct section of the page) plus a
  thicker, status-colored border on each column (instead of a thin uniform
  gray one), so the three lists read as clearly separate the way Jira's do.
- "אחראי משיכות ציוד" (equipment withdrawal manager) moved from its own
  standalone toggle in AdminPanel's users list into the delegated-permissions
  system (`src/lib/permissions.js`'s `PERMISSION_LIST`, alongside
  `frisa_pina`/`playbox_orders`/`meal_regulators`) — it now lives under
  "הרשאות מיוחדות" like every other delegated permission instead of its own
  separate switch. `Equipment.jsx`'s `canEdit` check now reads the
  `equipment_manager` permission (via `hasPermission`/`effectivePermissions`,
  the same pattern `Playbox.jsx` already uses) instead of the
  `profiles.equipment_manager` column. `supabase/migrations/0011_equipment_manager_permission.sql`
  backfills a permission row for anyone who already had the old flag set, so
  no one loses access; the old column itself is left in place (just no
  longer read by the app) rather than dropped.
- Equipment shortage → Playbox completion-order suggestion. Whoever holds the
  `playbox_orders` or `equipment_manager` permission can now set a target
  quantity per warehouse item (`warehouse_items.target_quantity`, added by
  `supabase/migrations/0012_warehouse_item_target_quantity.sql`) — e.g. "we
  should always have 10 tents in מכולה" — through a new field in the
  add/edit-item dialog (`WarehouseItemForm.jsx`, only shown to those two
  permissions/admin; `Equipment.jsx`'s item list shows the configured target
  and a red "חסר" badge to everyone once the current quantity is already
  below it). When anyone submits an equipment withdrawal
  (`WithdrawalForm.jsx`) that would drop an item below its target, submitting
  now shows an extra confirmation step listing exactly what would go short
  and offers to auto-create a `playbox_orders` row for the shortfall
  (`auto_generated: true`, the same flag `playbox_orders` already had from
  `supabase/migrations/0008_playbox_stock_tracking.sql`) — with no pluga on the
  order itself (see `supabase/migrations/0013_playbox_orders_optional_pluga.sql`
  below): this is a shared-warehouse shortage, not any one pluga's own
  supply, so there's nothing to attribute it to. Dedup here is by item name
  alone (not pluga+item) since the physical stock is shared: an auto order
  already pending for that item from *any* pluga is treated as already
  covering it. Once created, the order's text is shown with a copy-to-clipboard
  button, so the trigger point (the person who just found the shortage while
  withdrawing) can paste it anywhere (WhatsApp, an email, ...) for whoever
  actually places Playbox orders.
  `Equipment.jsx` also has its own "צור הזמנות בפלייבוקס לכל החוסרים" button
  (same permission gate, `canSetTargets`), for proactively sweeping every
  warehouse for `target_quantity` shortfalls at once — across all 3
  warehouses, not just whatever's in the withdrawal you happen to be
  making — instead of waiting for a withdrawal to happen to surface one.
  Same dedup-by-item-name logic as above, so running it repeatedly (or
  alongside a withdrawal's own shortage flow) never creates duplicates for a
  shortage that's already got a pending auto order.
  This "צור הזמנות בפלייבוקס לכל החוסרים" button confirms before creating
  anything: clicking it computes exactly what it's about to create
  (post-dedup) and opens a dialog listing every item, quantity and warehouse
  first; the orders are only actually created once that's explicitly
  confirmed, and cancelling creates nothing.
  The same copy mechanism was added more generally to `Playbox.jsx`'s
  "הזמנות" tab too — "העתק הזמנות ממתינות כטקסט" formats every currently-
  "ממתין" order (not yet actually placed) as one block of text, for relaying
  the whole list at once rather than one shortage at a time. Each individual
  order row there also has its own small copy button (regardless of its
  status), for relaying just that one order on its own; both buttons share
  the same one-line-per-order text format (`formatOneOrderAsText` /
  `formatOrdersAsText` in `Playbox.jsx`).
- "סיכום מסדר" (`daily_summaries.entries`, a `jsonb` array — no schema
  migration needed, the shape living inside that column just grew) now
  tracks a responsible pluga per entry, and an entry can cover several
  גזרות at once instead of exactly one: each row is
  `{ areas: [...], pluga, notes }` (`areas` — plural — replacing the old
  singular `area`) built in the summary form by toggling as many of the 22
  `LOCATIONS` as apply and optionally picking one `PLUGOT` value as the
  pluga responsible for all of them, rather than adding one area at a time.
  An already-saved entry from before this change (just `{ area, notes }`,
  no `pluga`) still displays and copies fine — every read goes through an
  `entryAreas(e)` helper that falls back to wrapping the old singular
  `area` in a one-item array when `areas` isn't there. This exists as two
  independent screens onto the same `DailySummary` entity —
  `src/pages/DailySummary.jsx` (the standalone page) and
  `src/components/klaf/KlafSummary.jsx` (embedded in the Klaf page's daily
  view) — both updated identically and kept in sync by hand, the same
  convention already used for `Playbox.jsx`/`WithdrawalForm.jsx`'s order-text
  formatting, since there's no shared UI-utility module yet.
- The test-mode fixture data (`src/testdata/fixtures.js`) was updated to
  match `playbox_orders` no longer being pluga-specific: every
  manually-added demo order there now has `pluga: null`; only the one
  `auto_generated: true` demo order (from the pluga-level "מלאי ומעקב
  חוסרים" stock tracker) still carries one, since that path still needs it.
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
8. `supabase/migrations/0007_meal_regulator_phones.sql` — safe/idempotent,
   adds `meal_regulators.regulators` (name+phone pairs) and backfills it
   from the old `names` array.
9. `supabase/migrations/0008_playbox_stock_tracking.sql` — safe/idempotent,
   adds `playbox_items` and `playbox_orders.auto_generated`.
10. `supabase/migrations/0009_playbox_orders_received_status.sql` —
    safe/idempotent, adds "התקבל" to the allowed `playbox_orders.status`
    values.
11. `supabase/migrations/0010_playbox_orders_destination_warehouse.sql` —
    safe/idempotent, adds `playbox_orders.destination_warehouse`.
12. `supabase/migrations/0011_equipment_manager_permission.sql` —
    safe/idempotent, backfills a `user_permissions` row for every profile
    that currently has `equipment_manager = true`, so nobody loses access
    when the app switches from that column to the permission.
13. `supabase/migrations/0012_warehouse_item_target_quantity.sql` —
    safe/idempotent, adds `warehouse_items.target_quantity` (defaults to 0,
    meaning "no target set").
14. `supabase/migrations/0013_playbox_orders_optional_pluga.sql` —
    safe/idempotent, drops the `not null` on `playbox_orders.pluga` — see the
    dedicated section below.
15. `supabase/migrations/0014_meal_regulator_entry_time.sql` —
    safe/idempotent, adds `meal_regulators.entry_time`.

(Or, if you use the Supabase CLI: `supabase db push` after `supabase link` —
it will pick up all fifteen in filename order.)

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
  2-3 named meal regulators per pluga, for lunch and dinner separately, each
  with an optional phone number for a tap-to-call link
  (`supabase/migrations/0007_meal_regulator_phones.sql`,
  `meal_regulators.regulators jsonb` — an array of `{name, phone}`, replacing
  the old plain `names text[]`, which is kept in place unused rather than
  dropped). Each pluga+meal+day row also has its own `entry_time`
  (`supabase/migrations/0014_meal_regulator_entry_time.sql`) — lunch in
  particular has every pluga entering the dining hall at a different
  scheduled time to spread out the line, so `KlafMealRegulators.jsx` shows a
  "שעת כניסה" time field on each meal-type card, saved independently of the
  named regulators list (a time can be set before anyone's named, or vice
  versa). Also lives on the Klaf page, broken down into one color-coded
  card per pluga the viewer is authorized for (`MealRegulatorsBreakdown` in
  `Klaf.jsx`) — most קלפ holders are only granted their own pluga so they see
  just one card, but someone delegated several plugot (or an admin, who's
  authorized for all of them) sees them side by side. A real קלפ sees it as
  an extra section on their normal page; someone with no קלפ role at all who
  was delegated this instead gets a minimal version of the Klaf page (just a
  date nav and the breakdown, no task list) when they visit `/klaf`.
- **פלייבוקס והזמנות להמשך השבוע** (`playbox_orders`) — org-wide, not
  per-pluga: whoever holds this sees a consolidated view of every order
  request, before placing the real order on Playbox's own site.
  `src/pages/Playbox.jsx` at `/playbox` is a single-purpose screen for it —
  item, quantity and optional notes, track status: `ממתין` → `הוזמן` →
  `התקבל`, or `בוטל`. An order is **not** tagged to a specific pluga
  (`supabase/migrations/0013_playbox_orders_optional_pluga.sql` drops the
  `not null` on `playbox_orders.pluga`) — Playbox doesn't split its own
  catalog by pluga, so requiring one on every order was never actually
  necessary. "התקבל" (received) is deliberately its own status rather than
  folded into "הוזמן"
  (`supabase/migrations/0009_playbox_orders_received_status.sql`) —
  placing the real order and it actually showing up are two different
  events. An order with status `הוזמן` gets a dedicated green "התקבל"
  button (in addition to the status dropdown, for anyone who prefers
  that); either one opens a small "לאן ההזמנה הולכת?" dialog asking which
  of the 3 physical warehouses (`WAREHOUSES` in `src/lib/constants.js` —
  the same מכולה / מחסן קרביץ / מחסן לוגיסטי as `/equipment`) the goods
  actually went into
  (`supabase/migrations/0010_playbox_orders_destination_warehouse.sql`,
  `playbox_orders.destination_warehouse`). Confirming a warehouse credits
  that warehouse's own `warehouse_items` quantity on `/equipment` —
  creating the item there if it doesn't already exist — so equipment
  received via Playbox actually shows up in "משיכות ציוד", not just as a
  closed order here.
  This page used to have a second tab, "מלאי ומעקב חוסרים" — per-pluga
  target vs. current quantity tracking
  (`supabase/migrations/0008_playbox_stock_tracking.sql`, the `playbox_items`
  table) with its own "צור הזמנות לחוסרים" button, mirroring the one that
  still exists on `/equipment`. **Removed**: the premise didn't hold — this
  equipment was never actually any one pluga's own supply to track
  separately, it's shared across all of them, which is exactly what
  `warehouse_items.target_quantity` (below) already models correctly for
  physical equipment. `playbox_items` itself, and any data already in it,
  are left in the database rather than dropped — nothing reads or writes it
  anymore, the same way `profiles.equipment_manager` and
  `src/pages/Delegations.jsx` were retired elsewhere in this app rather than
  deleted outright.

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

**Admins hold all three permissions, for every pluga, automatically** — no
explicit grant needed, and there's nothing to check in the admin UI for an
admin user (expanding "הרשאות מיוחדות" there shows a note instead of
checkboxes, since toggling one would have no effect). This is computed on
the fly by `effectivePermissions(rawRows, role)` in `src/lib/permissions.js`
— every page that checks a signed-in user's permissions runs what it fetched
through this first, keyed off that user's *real* role, never a previewed
one (the "תצוגת תפקיד" preview switcher changes how the app displays, not
who's actually signed in, so it can't be used to borrow another role's
access).

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
