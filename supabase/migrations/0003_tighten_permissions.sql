-- KalagProMax: tighten permissions
--
-- Fixes two gaps found in a security review of 0001_init.sql:
--
-- 1. handle_new_user() copied `role` / `pluga` out of raw_user_meta_data, which
--    the signing-up user controls (supabase.auth.signUp({ options: { data } })).
--    Anyone could self-register with role = 'admin'. New users now always start
--    with role/pluga NULL; only an admin (AdminPanel -> profiles UPDATE) sets them.
--
-- 2. Every operational table allowed ALL operations to any signed-in user, even
--    one whose role is still NULL (i.e. never approved). Policies now require a
--    *registered* user (a profiles row with a non-null role).
--
-- Run after 0001 / 0001a / 0002. Idempotent.

begin;

-- ---------------------------------------------------------------------------
-- 1. New users never inherit role/pluga from client-controlled metadata
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. is_registered(): signed in AND approved (profiles.role is set)
-- ---------------------------------------------------------------------------
create or replace function public.is_registered()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role is not null
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Replace "authenticated full access" with "registered full access"
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'constraints', 'daily_routines', 'daily_summaries', 'direct_tasks',
    'equipment_holdings', 'equipment_settings', 'events', 'gaps', 'gap_updates',
    'recurring_events', 'recurring_overrides', 'warehouse_items', 'withdrawal_requests'
  ]
  loop
    execute format('drop policy if exists "authenticated full access" on public.%I', t);
    execute format('drop policy if exists "registered full access" on public.%I', t);
    execute format(
      'create policy "registered full access" on public.%I for all
         using (public.is_registered()) with check (public.is_registered())', t);
  end loop;
end $$;

-- task_completions: same rule, keeping the per-owner semantics
drop policy if exists "read own or admin" on public.task_completions;
drop policy if exists "create own" on public.task_completions;
drop policy if exists "delete own or admin" on public.task_completions;

create policy "read own or admin" on public.task_completions for select
  using (public.is_registered() and (created_by_id = auth.uid() or public.is_admin()));
create policy "create own" on public.task_completions for insert
  with check (public.is_registered() and created_by_id = auth.uid());
create policy "delete own or admin" on public.task_completions for delete
  using (public.is_registered() and (created_by_id = auth.uid() or public.is_admin()));

-- ---------------------------------------------------------------------------
-- 4. Storage: only registered users upload; only admins delete
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated upload attachments" on storage.objects;
drop policy if exists "registered upload attachments" on storage.objects;
create policy "registered upload attachments"
  on storage.objects for insert
  with check (bucket_id = 'attachments' and public.is_registered());

drop policy if exists "authenticated delete own attachments" on storage.objects;
drop policy if exists "admins delete attachments" on storage.objects;
create policy "admins delete attachments"
  on storage.objects for delete
  using (bucket_id = 'attachments' and public.is_admin());

commit;
