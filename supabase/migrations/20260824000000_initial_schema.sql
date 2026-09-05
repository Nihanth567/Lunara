-- The base schema: every object the later migrations assume already exists.
--
-- Until now `supabase/migrations/` held only additive migrations, and every
-- table, RPC, trigger and policy they alter was created by hand in the
-- dashboard. `supabase db reset` against a fresh project failed on the first
-- statement of the first migration (`alter table public.entries`), which meant
-- the project could not be rebuilt, staged, or rolled back — and, more
-- seriously, that the RLS enforcing the reveal gate lived nowhere anyone could
-- read or review it.
--
-- This file is that missing baseline, reconstructed from the live database
-- (pg_dump-equivalent introspection of pg_proc, pg_policies, pg_constraint,
-- pg_trigger and pg_publication_tables) as it stood *before* the first
-- additive migration. Replaying it and then the migrations that follow
-- reproduces the current schema exactly.
--
-- Written idempotently (`if not exists`, `create or replace`, `drop policy if
-- exists`) so it is also safe to run against the existing project, whose
-- migration history predates this file. See README for the
-- `supabase migration repair` steps that reconcile the two.
--
-- ─── The reveal gate ─────────────────────────────────────────────────────────
--
-- The one policy worth reading before any other is "select partner entries
-- after mutual submit" on public.entries, below. It is what makes the product's
-- central promise true: a partner's answers are not returned by the API until
-- both people have submitted for that date. It is enforced here, in the
-- database, not in the client — so it holds for a leaked anon key, a curl
-- against PostgREST, or a modified build.

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- One row per auth user, created by the on_auth_user_created trigger below.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text        not null default '',
  birthday    date,
  pronouns    text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The couple itself. `member_count` is the pairing capacity check (a couple is
-- exactly two people) and is maintained by join_couple, not by a trigger, so
-- the "is there room" test and the insert happen in one atomic statement.
create table if not exists public.couples (
  id             uuid primary key default gen_random_uuid(),
  invite_code    text        not null unique,
  start_date     date        not null default current_date,
  current_streak int         not null default 0,
  longest_streak int         not null default 0,
  member_count   int         not null default 1,
  created_at     timestamptz not null default now()
);

-- Membership. The UNIQUE on user_id is what stops one person belonging to two
-- couples; create_couple and join_couple both check it first so the user gets a
-- sentence rather than a constraint violation, but the constraint is the
-- backstop.
create table if not exists public.couple_members (
  couple_id uuid        not null references public.couples(id) on delete cascade,
  user_id   uuid        not null references auth.users(id)     on delete cascade,
  name      text        not null,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

-- One row per partner per night. The primary key is what makes the client's
-- upsert (`on_conflict: 'couple_id,date,user_id'`) idempotent.
create table if not exists public.entries (
  couple_id  uuid        not null references public.couples(id) on delete cascade,
  date       date        not null,
  user_id    uuid        not null references auth.users(id)     on delete cascade,
  grateful   text        not null default '',
  cute       text        not null default '',
  grow       text        not null default '',
  submitted  boolean     not null default false,
  reaction   text,
  updated_at timestamptz not null default now(),
  primary key (couple_id, date, user_id)
);

create index if not exists entries_couple_date_idx on public.entries (couple_id, date);

-- The shared long-form Q&A. Same both-must-answer gate as entries, keyed on the
-- question rather than the date.
create table if not exists public.keepsakes (
  couple_id    uuid        not null references public.couples(id) on delete cascade,
  user_id      uuid        not null references auth.users(id)     on delete cascade,
  question_key text        not null,
  answer       text        not null default '',
  updated_at   timestamptz not null default now(),
  primary key (couple_id, user_id, question_key)
);

-- ─── Functions ───────────────────────────────────────────────────────────────

-- Every auth user gets a profile row immediately, so the app never has to
-- handle "signed in but no profile". SECURITY DEFINER because the inserting
-- role is the auth service, not the user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$function$;

-- Start a couple and become its first member.
--
-- The alphabet deliberately omits I, O, 0 and 1: the code is read aloud and
-- typed by hand off a message, and those four are where that goes wrong.
-- The loop retries on collision rather than trusting 33^6 to be enough.
create or replace function public.create_couple(p_user_name text)
returns public.couples
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text;
  v_couple public.couples;
  v_exists int;
begin
  select count(*) into v_exists from public.couple_members where user_id = auth.uid();
  if v_exists > 0 then
    raise exception 'This device is already paired.' using errcode = 'P0001';
  end if;

  loop
    v_code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 33) + 1)::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.couples where invite_code = v_code);
  end loop;

  insert into public.couples (invite_code, start_date, member_count)
  values (v_code, current_date, 1)
  returning * into v_couple;

  insert into public.couple_members (couple_id, user_id, name)
  values (v_couple.id, auth.uid(), p_user_name);

  return v_couple;
end;
$function$;

-- Redeem an invite code. This is where every pairing edge case is decided, so
-- the four outcomes are worth stating plainly:
--
--   unknown code          → raises 'That invite code isn''t available.'
--   you are already in it → returns the couple unchanged (a re-tapped link is
--                           not an error, and must stay idempotent)
--   you are in another    → raises 'This invite code is no longer available.'
--   a third person joins  → the `member_count < 2` guard in the UPDATE fails,
--                           `not found`, same refusal
--
-- The capacity check lives in the UPDATE's WHERE clause rather than in a
-- preceding SELECT so that two people racing the same last slot cannot both
-- pass the check — the row lock on the update serialises them, and the loser
-- gets `not found`.
--
-- Codes do not expire. Nothing here reads a TTL, and the audit's "expired code"
-- case therefore behaves exactly like a valid one; if expiry is wanted it has
-- to be added, not assumed.
create or replace function public.join_couple(p_invite_code text, p_user_name text)
returns public.couples
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_couple public.couples;
  v_already int;
  v_elsewhere int;
  v_updated public.couples;
begin
  select * into v_couple from public.couples where invite_code = upper(trim(p_invite_code));
  if not found then
    raise exception 'That invite code isn''t available. Ask your partner to check it.' using errcode = 'P0001';
  end if;

  select count(*) into v_already from public.couple_members where couple_id = v_couple.id and user_id = auth.uid();
  if v_already > 0 then
    return v_couple;
  end if;

  select count(*) into v_elsewhere from public.couple_members where user_id = auth.uid();
  if v_elsewhere > 0 then
    raise exception 'This invite code is no longer available.' using errcode = 'P0001';
  end if;

  update public.couples set member_count = member_count + 1
  where id = v_couple.id and member_count < 2
  returning * into v_updated;

  if not found then
    raise exception 'This invite code is no longer available.' using errcode = 'P0001';
  end if;

  insert into public.couple_members (couple_id, user_id, name) values (v_updated.id, auth.uid(), p_user_name);

  return v_updated;
end;
$function$;

-- The couple as the app needs it, including the partner's display name.
-- 'Waiting...' is the placeholder for a couple nobody has joined yet; the
-- client treats a missing couple_members row as the real "not paired" signal
-- and only uses this for display.
--
-- Dropped first so this file stays re-runnable against a database that already
-- has the later, wider version of this function: `create or replace` cannot
-- change a function's return type, and 20260825 adds `is_subscribed` to it.
drop function if exists public.get_my_couple();

create function public.get_my_couple()
returns table (
  id             uuid,
  invite_code    text,
  partner_name   text,
  start_date     date,
  current_streak int,
  longest_streak int
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    c.id,
    c.invite_code,
    coalesce((select cm2.name from public.couple_members cm2 where cm2.couple_id = c.id and cm2.user_id != auth.uid() limit 1), 'Waiting...') as partner_name,
    c.start_date,
    c.current_streak,
    c.longest_streak
  from public.couples c
  join public.couple_members cm on cm.couple_id = c.id
  where cm.user_id = auth.uid();
$function$;

-- `submitted` is a one-way latch and a reaction is never cleared by an
-- unrelated write. The client sends whole rows, so without this an upsert that
-- omitted a field would silently un-submit a finished night.
create or replace function public.entries_before_write()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if TG_OP = 'UPDATE' then
    new.submitted := old.submitted or new.submitted;
    new.reaction := coalesce(new.reaction, old.reaction);
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.keepsakes_before_write()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- Fire-and-forget call into the entries-webhook edge function, which sends the
-- "your partner shared tonight" push.
--
-- Swallows every exception on purpose: a webhook that cannot be reached must
-- never roll back the night the user just wrote. The cost is that a delivery
-- failure is invisible here — it is observable only in the function's logs.
--
-- The URL is project-specific. It reads `app.settings.entries_webhook_url`
-- when that is set (`alter database postgres set app.settings.entries_webhook_url = '...'`)
-- so a staging or branch database posts to its own function rather than to
-- production's, and falls back to the production URL that was hardcoded here
-- before, which keeps existing behaviour identical where the setting is absent.
create or replace function public.notify_entries_webhook()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'net'
as $function$
begin
  perform net.http_post(
    url := coalesce(
      nullif(current_setting('app.settings.entries_webhook_url', true), ''),
      'https://lumixwmobjvlzgqrdjak.supabase.co/functions/v1/entries-webhook'
    ),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
exception when others then
  return new;
end;
$function$;

-- The server's copy of the streak.
--
-- This is the ORIGINAL version, kept here so the migration history is honest
-- about what it was: anchored to `current_date` (so a couple read 0 every
-- morning until they finished that evening) and strict about `longest`.
-- `20260829000000_retention_streak_and_notify_once.sql` and
-- `20260830000000_streak_grace_alignment.sql` replace it in turn, and the
-- second of those brings it in line with `lib/streak.ts`. Do not "fix" it
-- here — the later migration is where the current rules live.
create or replace function public.recompute_couple_streaks()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  done          date[];
  d             date;
  prev          date;
  running       int  := 0;
  longest       int  := 0;
  current_s     int  := 0;
  cursor_date   date;
  members       int;
begin
  select member_count into members from public.couples where id = new.couple_id;

  select array_agg(t.date order by t.date) into done
  from (
    select date
    from public.entries
    where couple_id = new.couple_id and submitted = true
    group by date
    having count(distinct user_id) = members and members = 2
  ) t;

  if done is null then
    update public.couples
    set current_streak = 0
    where id = new.couple_id;
    return new;
  end if;

  prev := null;
  foreach d in array done loop
    if prev is not null and d = prev + 1 then
      running := running + 1;
    else
      running := 1;
    end if;
    longest := greatest(longest, running);
    prev := d;
  end loop;

  cursor_date := current_date;
  loop
    if cursor_date = any(done) then
      current_s := current_s + 1;
      cursor_date := cursor_date - 1;
    else
      exit;
    end if;
  end loop;

  update public.couples
  set current_streak = current_s,
      longest_streak = greatest(longest_streak, longest, current_s)
  where id = new.couple_id;

  return new;
end;
$function$;

-- ─── Triggers ────────────────────────────────────────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists entries_before_write_trigger on public.entries;
create trigger entries_before_write_trigger
before insert or update on public.entries
for each row execute function public.entries_before_write();

drop trigger if exists entries_recompute_streaks on public.entries;
create trigger entries_recompute_streaks
after insert or update on public.entries
for each row execute function public.recompute_couple_streaks();

-- Replaced by the insert/update split in
-- 20260829000000_retention_streak_and_notify_once.sql, which stops a partner
-- being re-notified every time the row is touched after submission.
drop trigger if exists entries_submit_webhook on public.entries;
create trigger entries_submit_webhook
after insert or update on public.entries
for each row when (new.submitted = true)
execute function public.notify_entries_webhook();

drop trigger if exists keepsakes_before_write_trigger on public.keepsakes;
create trigger keepsakes_before_write_trigger
before insert or update on public.keepsakes
for each row execute function public.keepsakes_before_write();

-- ─── Row level security ──────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.couples        enable row level security;
alter table public.couple_members enable row level security;
alter table public.entries        enable row level security;
alter table public.keepsakes      enable row level security;

-- profiles: yours only. There is deliberately no policy letting you read your
-- partner's profile row — the partner's name reaches the app through
-- couple_members and get_my_couple, and `expo_push_token` is read only by the
-- edge functions using the service role.
drop policy if exists "select own profile" on public.profiles;
create policy "select own profile" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
for update using (auth.uid() = id);

-- No INSERT policy: rows are created only by handle_new_user().

-- couples / couple_members: readable by members. No INSERT or UPDATE policy on
-- either — all writes go through the SECURITY DEFINER RPCs above, which is what
-- keeps `member_count` and the membership rows consistent.
drop policy if exists "select own couple" on public.couples;
create policy "select own couple" on public.couples
for select using (
  exists (
    select 1 from public.couple_members cm
    where cm.couple_id = couples.id and cm.user_id = auth.uid()
  )
);

drop policy if exists "select own couple members" on public.couple_members;
create policy "select own couple members" on public.couple_members
for select using (
  exists (
    select 1 from public.couple_members cm2
    where cm2.couple_id = couple_members.couple_id and cm2.user_id = auth.uid()
  )
);

-- entries: your own row, always.
drop policy if exists "select own entries" on public.entries;
create policy "select own entries" on public.entries
for select using (user_id = auth.uid());

drop policy if exists "insert own entries" on public.entries;
create policy "insert own entries" on public.entries
for insert with check (user_id = auth.uid());

drop policy if exists "update own entries" on public.entries;
create policy "update own entries" on public.entries
for update using (user_id = auth.uid());

-- THE REVEAL GATE.
--
-- Your partner's row for a date is returned only when all three hold:
--   1. their row is submitted
--   2. you are a member of that couple
--   3. YOUR row for the same date is also submitted
--
-- (3) is the gate. Until you have submitted, the partner row is not filtered
-- out of a response — it is never selected in the first place, so there is
-- nothing on the wire for a client to reveal early. Deleting your own row
-- re-closes the gate, and there is no way to satisfy (3) without writing the
-- night yourself.
drop policy if exists "select partner entries after mutual submit" on public.entries;
create policy "select partner entries after mutual submit" on public.entries
for select using (
  submitted = true
  and exists (
    select 1 from public.couple_members cm
    where cm.couple_id = entries.couple_id and cm.user_id = auth.uid()
  )
  and exists (
    select 1 from public.entries mine
    where mine.couple_id = entries.couple_id
      and mine.date      = entries.date
      and mine.user_id   = auth.uid()
      and mine.submitted = true
  )
);

-- keepsakes: the same shape, keyed on the question rather than the date. Note
-- there is no `submitted` concept here — answering at all is the commitment.
drop policy if exists "select own keepsake answers" on public.keepsakes;
create policy "select own keepsake answers" on public.keepsakes
for select using (user_id = auth.uid());

drop policy if exists "insert own keepsake answers" on public.keepsakes;
create policy "insert own keepsake answers" on public.keepsakes
for insert with check (user_id = auth.uid());

drop policy if exists "update own keepsake answers" on public.keepsakes;
create policy "update own keepsake answers" on public.keepsakes
for update using (user_id = auth.uid());

drop policy if exists "select partner keepsake after mutual answer" on public.keepsakes;
create policy "select partner keepsake after mutual answer" on public.keepsakes
for select using (
  exists (
    select 1 from public.couple_members cm
    where cm.couple_id = keepsakes.couple_id and cm.user_id = auth.uid()
  )
  and exists (
    select 1 from public.keepsakes mine
    where mine.couple_id    = keepsakes.couple_id
      and mine.question_key = keepsakes.question_key
      and mine.user_id      = auth.uid()
  )
);

-- ─── Storage: avatars ────────────────────────────────────────────────────────
--
-- Public bucket, path layout {user_id}/... — a profile picture is shown to the
-- partner, so it is readable by URL. Nothing private is ever stored here; the
-- private `voice-notes` bucket arrives in 20260828000100.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar images are publicly readable" on storage.objects;
create policy "avatar images are publicly readable" on storage.objects
for select using (bucket_id = 'avatars');

drop policy if exists "users can upload their own avatar" on storage.objects;
create policy "users can upload their own avatar" on storage.objects
for insert with check (
  bucket_id = 'avatars'
  and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
);

drop policy if exists "users can update their own avatar" on storage.objects;
create policy "users can update their own avatar" on storage.objects
for update using (
  bucket_id = 'avatars'
  and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
);

drop policy if exists "users can delete their own avatar" on storage.objects;
create policy "users can delete their own avatar" on storage.objects
for delete using (
  bucket_id = 'avatars'
  and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
);

-- ─── Realtime ────────────────────────────────────────────────────────────────
--
-- AppContext subscribes to all four for the paired couple. Realtime respects
-- RLS, so the reveal gate applies to the change stream too: a partner's
-- unsubmitted row does not arrive early over the socket either.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couples') then
      alter publication supabase_realtime add table public.couples;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_members') then
      alter publication supabase_realtime add table public.couple_members;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entries') then
      alter publication supabase_realtime add table public.entries;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'keepsakes') then
      alter publication supabase_realtime add table public.keepsakes;
    end if;
  end if;
end
$$;
