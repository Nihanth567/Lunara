-- Streak consistency pass.
--
-- Two rules were being applied differently in two places, and both differences
-- showed up as a number the couple could see move on its own.
--
-- 1. Forgiveness never covered *last* night. Both implementations refused to
--    spend the one-night grace unless the run had already started — and the
--    walk starts at the anchor, which is last night whenever tonight is still
--    open. So a couple who missed a single Tuesday read "0 nights" for all of
--    Wednesday and then jumped straight to N+1 when they finished that evening.
--    The forgiveness was real, it just arrived a day after it was needed, as a
--    surprise rather than as reassurance.
--
-- 2. `longest_streak` was computed strictly here (no forgiven nights) while the
--    client computed it with grace. A couple on a 41-night run that included one
--    forgiven night had a "longest ever" of 22 — a record lower than the streak
--    standing next to it on the same screen.
--
-- `lib/streak.ts` is the reference implementation and carries the reasoning in
-- full; `lib/streak.test.ts` states the cases. This function mirrors it.
-- Anything changed here changes in all three.

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
    update public.couples
    set current_streak = 0
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

  update public.couples
  set current_streak = current_s,
      longest_streak = greatest(longest_streak, longest, current_s)
  where id = new.couple_id;

  return new;
end;
$function$;

comment on function public.recompute_couple_streaks() is
  'Mirrors lib/streak.ts exactly: both partners only; anchored to yesterday until tonight is complete; one missed night forgiven per run, including last night; longest measured with the same grace rule as current.';
