-- Together points, and the two pieces of metadata a voice note was missing.
--
-- ─── Together points ─────────────────────────────────────────────────────────
--
-- One point per night both partners submitted. Written by the same trigger
-- that maintains the streaks, from the same `done` array, because they are
-- literally two readings of one set: the streak is the longest run in it, the
-- points are its cardinality.
--
-- Derived rather than incremented, for the reason spelled out in
-- lib/togetherPoints.ts: `points = points + 1` is a second source of truth that
-- a retried upsert, a backfill, or a double-delivered realtime event can put
-- permanently out of step with the entries it claims to count. Recomputing is
-- idempotent — running the trigger a hundred times on the same data yields the
-- same number — so there is no event to lose and none to double.
--
-- The client computes the same value from `entries` (AppContext folds it into
-- `couple`, exactly as it already does for `current_streak`). This column is
-- what makes the number correct on a cold start before entries have loaded,
-- and what a server-side reader — the widget payload, a future digest — can
-- use without pulling a couple's whole history.
--
-- ─── Voice note duration ─────────────────────────────────────────────────────
--
-- `voice_*` holds a Storage path and nothing else, so the only way to learn how
-- long a recording is was to resolve a signed URL and load the audio. That made
-- every player render "Voice note" and a spinner first, and it made showing a
-- duration anywhere cheap-feeling impossible — a list of past nights would have
-- had to download every clip to label them.
--
-- The duration is known at the moment of recording and costs three integers to
-- keep. Nullable throughout: notes recorded before this migration have no
-- duration, and a null renders as the old behaviour rather than as a zero.
--
-- Deliberately *not* added: a transcript column. Transcription (the
-- `transcribe-voice` function added alongside this) writes into the card's own
-- text field, which the couple then edits and submits — so the transcript is
-- already stored, in the one place they can see and correct it. A second
-- immutable copy of their words that the app never shows them would be a
-- privacy liability with no reader.

alter table public.couples
  add column if not exists together_points int not null default 0;

comment on column public.couples.together_points is
  'One point per night both partners submitted. Recomputed by recompute_couple_streaks from the same set of completed dates as the streaks — never incremented. Mirrors togetherPoints() in lib/togetherPoints.ts.';

alter table public.entries
  add column if not exists voice_grateful_duration_ms int
    check (voice_grateful_duration_ms is null or voice_grateful_duration_ms >= 0),
  add column if not exists voice_cute_duration_ms int
    check (voice_cute_duration_ms is null or voice_cute_duration_ms >= 0),
  add column if not exists voice_grow_duration_ms int
    check (voice_grow_duration_ms is null or voice_grow_duration_ms >= 0);

comment on column public.entries.voice_grateful_duration_ms is
  'Length of the Grateful voice note in milliseconds, captured at record time. Null for notes recorded before this column existed.';
comment on column public.entries.voice_cute_duration_ms is
  'Length of the Cute voice note in milliseconds, captured at record time.';
comment on column public.entries.voice_grow_duration_ms is
  'Length of the Grow voice note in milliseconds, captured at record time.';

-- ─── The trigger, extended ───────────────────────────────────────────────────
--
-- Identical to 20260901010635_streak_grace_alignment.sql except for the two
-- places noted inline. Restated in full rather than patched: the streak rules
-- are mirrored from lib/streak.ts and are meant to be checkable against it by
-- eye, which is only possible while the whole function reads from one place.

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
  run_len       int  := 0;
  run_grace     boolean := false;
  longest       int  := 0;
  current_s     int  := 0;
  cursor_date   date;
  grace_used    boolean := false;
  members       int;
begin
  select member_count into members from public.couples where id = new.couple_id;

  -- Dates where BOTH partners submitted. A solo couple never accrues a streak.
  select array_agg(t.date order by t.date) into done
  from (
    select date
    from public.entries
    where couple_id = new.couple_id and submitted = true
    group by date
    having count(distinct user_id) = members and members = 2
  ) t;

  if done is null then
    -- CHANGED: points are zeroed here too. There is no such thing as a point
    -- without a completed night, so the empty case must say so explicitly —
    -- leaving the column alone would strand a stale total on a couple whose
    -- history was cleared.
    update public.couples
    set current_streak  = 0,
        together_points = 0
    where id = new.couple_id;
    return new;
  end if;

  -- Longest run, walking forward with the same one-forgiven-night rule the
  -- current run uses. A gap of exactly one day is stepped over once per run;
  -- anything larger, or a second gap, starts a new run.
  -- `done` is ordered ascending, so the previous element is the previous
  -- completed night and one pass is enough.
  prev      := null;
  run_len   := 0;
  run_grace := false;
  foreach d in array done loop
    if prev is null then
      run_len := 1;
      run_grace := false;
    elsif d = prev + 1 then
      -- Consecutive with the previous completed night.
      run_len := run_len + 1;
    elsif not run_grace and d = prev + 2 then
      -- Exactly one missed night, and this run has not spent its grace yet.
      run_grace := true;
      run_len := run_len + 1;
    else
      run_len := 1;
      run_grace := false;
    end if;
    longest := greatest(longest, run_len);
    prev := d;
  end loop;

  -- Current run. Anchored to yesterday unless tonight is already done, so an
  -- unfinished evening leaves the streak intact-but-at-risk rather than zeroed.
  -- The grace is available from the first step, so a missed *last* night is
  -- forgiven today rather than tomorrow.
  cursor_date := case when current_date = any(done) then current_date else current_date - 1 end;

  loop
    if cursor_date = any(done) then
      current_s := current_s + 1;
      cursor_date := cursor_date - 1;
    elsif not grace_used and (cursor_date - 1) = any(done) then
      grace_used := true;
      cursor_date := cursor_date - 1;
    else
      exit;
    end if;
  end loop;

  -- CHANGED: `together_points` is the size of the same `done` set the streaks
  -- were read out of. Not `+ 1`, and not conditional on this being a new night
  -- — every run of this trigger restates the total from the entries as they
  -- stand, which is what makes it impossible to drift.
  update public.couples
  set current_streak  = current_s,
      longest_streak  = greatest(longest_streak, longest, current_s),
      together_points = coalesce(array_length(done, 1), 0)
  where id = new.couple_id;

  return new;
end;
$function$;

comment on function public.recompute_couple_streaks() is
  'Mirrors lib/streak.ts exactly: both partners only; anchored to yesterday until tonight is complete; one missed night forgiven per run, including last night; longest measured with the same grace rule as current. Also restates couples.together_points as the count of completed nights (lib/togetherPoints.ts).';

-- ─── Backfill ────────────────────────────────────────────────────────────────
--
-- The trigger only fires on the next entry write, so without this a couple who
-- does not open the app tonight reads 0 points against a history of real
-- nights. Same query as the trigger's, grouped per couple.

update public.couples c
set together_points = coalesce(p.nights, 0)
from (
  select couple_id, count(*) as nights
  from (
    select e.couple_id, e.date
    from public.entries e
    join public.couples c2 on c2.id = e.couple_id
    where e.submitted = true and c2.member_count = 2
    group by e.couple_id, e.date
    having count(distinct e.user_id) = 2
  ) nights_per_couple
  group by couple_id
) p
where p.couple_id = c.id;

-- ─── get_my_couple ───────────────────────────────────────────────────────────
--
-- Dropped and recreated rather than replaced: adding a column changes the
-- return type, which `create or replace` refuses.

drop function if exists public.get_my_couple();

create function public.get_my_couple()
returns table (
  id              uuid,
  invite_code     text,
  partner_name    text,
  start_date      date,
  current_streak  int,
  longest_streak  int,
  is_subscribed   boolean,
  together_points int
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
    c.longest_streak,
    coalesce((
      select bool_or(p.is_subscribed)
      from public.couple_members cm3
      join public.profiles p on p.id = cm3.user_id
      where cm3.couple_id = c.id
    ), false) as is_subscribed,
    c.together_points
  from public.couples c
  join public.couple_members cm on cm.couple_id = c.id
  where cm.user_id = auth.uid();
$function$;
