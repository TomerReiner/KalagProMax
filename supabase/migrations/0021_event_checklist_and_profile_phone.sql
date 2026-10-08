-- Two small schema additions for the 2026-10 feature batch.
-- Safe/idempotent — run once in the Supabase SQL Editor after 0020.
--
-- 1) events.checklist — the event logistics checklist
--    (src/lib/eventChecklist.js, src/components/constraints/EventChecklist.jsx):
--    [{ id, text, pluga, done, done_by, done_at }]. Edited in the event form,
--    ticked off from the event view and from each pluga's "המשימות שלי".
--    Until this runs, the app simply doesn't send the field (see EventForm's
--    payload guard), so saving events keeps working either way.
--
-- 2) profiles.phone + set_my_phone() — a phone number per user, shown in
--    "ספר קשר" (src/pages/Directory.jsx) and the pluga drill-down with
--    tap-to-call / WhatsApp. profiles can only be UPDATEd by admins (RLS),
--    so users set their OWN phone through this security-definer function —
--    the same pattern as mark_notifications_read() in 0001_init.sql, which
--    lets a user touch exactly one column of their own row and nothing else.

alter table public.events add column if not exists checklist jsonb not null default '[]';

alter table public.profiles add column if not exists phone text;

create or replace function public.set_my_phone(p_phone text)
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles
  set phone = nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '')
  where id = auth.uid();
$$;

grant execute on function public.set_my_phone(text) to authenticated;
