-- Stop the two "after you've both answered" policies recursing into themselves.
--
-- Same defect as 20261001000000_fix_couple_members_recursion.sql, one level
-- down. Each policy asked "has the caller answered too?" by selecting from the
-- very table it protects:
--
--   entries   — "select partner entries after mutual submit" read `entries`
--   keepsakes — "select partner keepsake after mutual answer" read `keepsakes`
--
-- so Postgres refused every read and write touching those tables with
-- "infinite recursion detected in policy". Nobody could save a night, let
-- alone reveal one.
--
-- The "have I answered?" checks now live in SECURITY DEFINER functions that
-- read the table without re-entering its policies. Each answers only for the
-- caller (`auth.uid()`), so neither can be used to learn anything about a
-- partner's answers. The reveal gate itself is unchanged: a partner's row is
-- returned only once it is submitted AND your own row for that night is too.

create or replace function public.has_submitted_night(p_couple_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.entries
    where couple_id = p_couple_id
      and date = p_date
      and user_id = auth.uid()
      and submitted = true
  );
$function$;

create or replace function public.has_answered_keepsake(p_couple_id uuid, p_question_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.keepsakes
    where couple_id = p_couple_id
      and question_key = p_question_key
      and user_id = auth.uid()
  );
$function$;

revoke all on function public.has_submitted_night(uuid, date) from public, anon;
revoke all on function public.has_answered_keepsake(uuid, text) from public, anon;
grant execute on function public.has_submitted_night(uuid, date) to authenticated;
grant execute on function public.has_answered_keepsake(uuid, text) to authenticated;

drop policy if exists "select partner entries after mutual submit" on public.entries;
create policy "select partner entries after mutual submit" on public.entries
for select using (
  submitted = true
  and public.is_couple_member(couple_id)
  and public.has_submitted_night(couple_id, date)
);

drop policy if exists "select partner keepsake after mutual answer" on public.keepsakes;
create policy "select partner keepsake after mutual answer" on public.keepsakes
for select using (
  public.is_couple_member(couple_id)
  and public.has_answered_keepsake(couple_id, question_key)
);
