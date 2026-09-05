-- Retention pass: the two server-side rules that were quietly working against
-- the habit loop.
--
-- 1. The partner-submitted push fired on EVERY update where submitted = true,
--    not just when it became true. Adding a voice note, tapping a reaction, or
--    answering the Grow check-back each re-sent "your partner shared their
--    heart tonight" to someone who had already been told.
--
-- 2. `current_streak` anchored the run to `current_date`, so a couple on 40
--    nights read 0 from midnight until they finished that evening. A streak
--    that has to be re-earned before it is allowed to exist is not loss
--    aversion, it is just loss. It also disagreed with the client, which has
--    always counted back from yesterday.
--
-- Both are rewritten below to match `lib/streak.ts`, which is the reference
-- implementation and has the reasoning in full.

-- ─── 1. Notify once, on the transition ───────────────────────────────────────

-- Split in two rather than one INSERT OR UPDATE trigger: OLD isn't available in
-- the WHEN clause of an insert, and TG_OP isn't available in a WHEN clause at
-- all — both are only visible inside the function body.

drop trigger if exists entries_submit_webhook        on public.entries;
drop trigger if exists entries_submit_webhook_insert on public.entries;
drop trigger if exists entries_submit_webhook_update on public.entries;

-- A row born submitted (someone whose first write is the submit itself).
create trigger entries_submit_webhook_insert
after insert on public.entries
for each row
when (new.submitted = true)
execute function public.notify_entries_webhook();

-- The usual path: a draft row that becomes submitted. Only the transition
-- notifies, so later edits to the same row (voice note, reaction, Grow
-- check-back) stay silent.
create trigger entries_submit_webhook_update
after update on public.entries
for each row
when (new.submitted = true and old.submitted is distinct from new.submitted)
execute function public.notify_entries_webhook();

comment on trigger entries_submit_webhook_update on public.entries is
  'Fires only when submitted flips false -> true, so a partner is told about a night exactly once no matter how many times the row is later touched.';

-- ─── 2. Streak: yesterday-anchored, one forgiven night ───────────────────────

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
    update public.couples
    set current_streak = 0
    where id = new.couple_id;
    return new;
  end if;

  -- Longest run, strict consecutive days. Kept strict on purpose: the
  -- high-water mark is a record, and records shouldn't include forgiven nights.
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

  -- Current run. Anchored to yesterday unless tonight is already done, so an
  -- unfinished evening leaves the streak intact-but-at-risk rather than zeroed.
  -- One single missed night is stepped over, once per run.
  cursor_date := case when current_date = any(done) then current_date else current_date - 1 end;

  loop
    if cursor_date = any(done) then
      current_s := current_s + 1;
      cursor_date := cursor_date - 1;
    elsif not grace_used and current_s > 0 and (cursor_date - 1) = any(done) then
      grace_used := true;
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

comment on function public.recompute_couple_streaks() is
  'Mirrors lib/streak.ts: both-partners-only, anchored to yesterday until tonight is complete, one missed night forgiven per run.';
