-- Playbox stock/reorder-point tracking. Until now /playbox only logged
-- ad-hoc order requests (playbox_orders). This adds a per-pluga, per-item
-- "how much of this do we need" (target_quantity) vs. "how much do we have
-- right now" (current_quantity) table, so a gap between the two can be
-- turned into an initial order automatically instead of someone noticing
-- the shortage and typing it in by hand — see src/pages/Playbox.jsx's
-- "מלאי ומעקב חוסרים" tab. Gated by the SAME playbox_orders permission as
-- the rest of the page; no new permission key.
create table if not exists public.playbox_items (
  id uuid primary key default gen_random_uuid(),
  pluga text not null check (pluga in ('פארן', 'בשור', 'צין', 'רמון', 'תמר')),
  item text not null,
  target_quantity numeric not null default 0,
  current_quantity numeric not null default 0,
  created_by text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (pluga, item)
);
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_playbox_items_updated') then
    create trigger trg_playbox_items_updated before update on public.playbox_items
      for each row execute function public.set_updated_date();
  end if;
end $$;
alter table public.playbox_items enable row level security;
drop policy if exists "authenticated full access" on public.playbox_items;
create policy "authenticated full access" on public.playbox_items for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Marks an order the app created by itself from a stock gap (rather than
-- someone typing in a manual request), so the order log can label it and so
-- the "create gap orders" action can tell it already made one for a given
-- pluga+item and avoid creating a duplicate while the first is still
-- pending.
alter table public.playbox_orders add column if not exists auto_generated boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'playbox_items'
  ) then
    alter publication supabase_realtime add table public.playbox_items;
  end if;
end $$;
