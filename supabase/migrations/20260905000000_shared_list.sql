-- The shared list.
--
-- Lunara's nightly ritual is deliberately private-until-mutual: neither partner
-- sees the other's answers until both have written. The list is the exact
-- opposite and that contrast is the point — it is the one surface in the app
-- where you can see what the other person is doing *as they do it*. Nothing
-- here is gated; both members read and write the same rows.
--
-- ─── Why completion is a separate table ──────────────────────────────────────
--
-- The obvious shape is `list_items.done boolean`. It cannot express the feature
-- that makes this a couples list rather than a todo app: an item that is only
-- finished when BOTH people tick it. Two booleans (`done_by_a` / `done_by_b`)
-- would work but require the app to know which member is "a", which it doesn't
-- — membership is a set, not an ordered pair.
--
-- `list_item_checks` stores one row per (item, person). Completion is then
-- derived, never stored:
--
--     needs_both = false → done when ANY check exists
--     needs_both = true  → done when a check exists for every member
--
-- Deriving it means a partner leaving, an item flipping to `needs_both` after
-- one person already ticked it, or two simultaneous taps all resolve correctly
-- instead of needing a repair path. Same principle as `computeStreaks()`.

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.list_items (
  id          uuid        primary key default gen_random_uuid(),
  couple_id   uuid        not null references public.couples(id) on delete cascade,
  title       text        not null,
  note        text        not null default '',
  -- "Some tasks are only done when you both tick them."
  needs_both  boolean     not null default false,
  created_by  uuid        not null references auth.users(id) on delete cascade,
  -- Sparse ordering: reordering rewrites one row's position rather than
  -- renumbering the list, so two people dragging at once can't collide.
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists list_items_couple_idx
  on public.list_items (couple_id, position);

create table if not exists public.list_item_checks (
  item_id    uuid        not null references public.list_items(id) on delete cascade,
  user_id    uuid        not null references auth.users(id)        on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

-- ─── Triggers ────────────────────────────────────────────────────────────────

create or replace function public.touch_list_item()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists list_items_touch on public.list_items;
create trigger list_items_touch
  before update on public.list_items
  for each row execute function public.touch_list_item();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.list_items       enable row level security;
alter table public.list_item_checks enable row level security;

-- list_items: anything belonging to a couple you are a member of. No
-- author-only restriction — either partner can edit or remove any item, which
-- is what "your list" rather than "your items and my items" means.
drop policy if exists "select couple list items" on public.list_items;
create policy "select couple list items" on public.list_items
for select using (
  exists (
    select 1 from public.couple_members cm
    where cm.couple_id = list_items.couple_id and cm.user_id = auth.uid()
  )
);

-- INSERT additionally pins created_by to the caller, so authorship (and the
-- colour the app draws from it) cannot be forged.
drop policy if exists "insert couple list items" on public.list_items;
create policy "insert couple list items" on public.list_items
for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.couple_members cm
    where cm.couple_id = list_items.couple_id and cm.user_id = auth.uid()
  )
);

drop policy if exists "update couple list items" on public.list_items;
create policy "update couple list items" on public.list_items
for update using (
  exists (
    select 1 from public.couple_members cm
    where cm.couple_id = list_items.couple_id and cm.user_id = auth.uid()
  )
);

drop policy if exists "delete couple list items" on public.list_items;
create policy "delete couple list items" on public.list_items
for delete using (
  exists (
    select 1 from public.couple_members cm
    where cm.couple_id = list_items.couple_id and cm.user_id = auth.uid()
  )
);

-- Checks are readable by both — seeing who did what is the feature — but
-- writable only for yourself. You cannot tick a shared item on your partner's
-- behalf, which is what keeps `needs_both` meaningful.
drop policy if exists "select couple list checks" on public.list_item_checks;
create policy "select couple list checks" on public.list_item_checks
for select using (
  exists (
    select 1
    from public.list_items li
    join public.couple_members cm on cm.couple_id = li.couple_id
    where li.id = list_item_checks.item_id and cm.user_id = auth.uid()
  )
);

drop policy if exists "insert own list check" on public.list_item_checks;
create policy "insert own list check" on public.list_item_checks
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.list_items li
    join public.couple_members cm on cm.couple_id = li.couple_id
    where li.id = list_item_checks.item_id and cm.user_id = auth.uid()
  )
);

drop policy if exists "delete own list check" on public.list_item_checks;
create policy "delete own list check" on public.list_item_checks
for delete using (user_id = auth.uid());

-- ─── Realtime ────────────────────────────────────────────────────────────────

-- "See in real time who did what" is a product promise, so both tables have to
-- be published. Guarded the same way as the base schema so replaying this
-- against the live project is a no-op.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'list_items'
    ) then
      alter publication supabase_realtime add table public.list_items;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'list_item_checks'
    ) then
      alter publication supabase_realtime add table public.list_item_checks;
    end if;
  end if;
end
$$;
