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
run these three files **in order** (paste each one's contents, run, then move
to the next):

1. `supabase/migrations/0001_init.sql` — creates every table, the `profiles`
   trigger, RLS policies, realtime publication entries, and the
   `attachments` storage bucket.
2. `supabase/migrations/0001a_fix_role_check_constraints.sql` — safe to run
   even if you don't think you need it.
3. `supabase/migrations/0002_seed_data.sql` — your real data from Base44 (see
   step 7).

(Or, if you use the Supabase CLI: `supabase db push` after `supabase link` —
it will pick up all three in filename order.)

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

## Adding real email later

When you're ready, pick a provider (Resend is the easiest to wire into a
Vercel function) and fill in the two `TODO`s in `api/submit-access-request.js`
and `api/process-withdrawal.js`. Both already have the full HTML/recipient
logic ported from the original Base44 functions — just add the actual send
call.
