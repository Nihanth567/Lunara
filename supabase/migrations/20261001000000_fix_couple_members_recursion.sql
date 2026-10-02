-- Stop the couple_members SELECT policy from recursing into itself.
--
-- The policy asked "is the caller a member of this couple?" by selecting from
-- couple_members — the table the policy protects — so evaluating it meant
-- evaluating it again, and Postgres refuses with "infinite recursion detected
-- in policy for relation couple_members". Every other policy that checks
-- membership (couples, entries, keepsakes, list_items, list_item_checks) reads
-- couple_members too, so the moment a couple had two members, none of their
-- shared data could be read: the partner, the reveal, the list.
--
-- The membership check now lives in a SECURITY DEFINER function, which reads
-- couple_members without re-entering its policy. It answers only for the
-- caller (`auth.uid()`), so it cannot be used to probe anyone else's couple.

create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.couple_members
    where couple_id = p_couple_id and user_id = auth.uid()
  );
$function$;

revoke all on function public.is_couple_member(uuid) from public, anon;
grant execute on function public.is_couple_member(uuid) to authenticated;

drop policy if exists "select own couple members" on public.couple_members;
create policy "select own couple members" on public.couple_members
for select using (public.is_couple_member(couple_id));
