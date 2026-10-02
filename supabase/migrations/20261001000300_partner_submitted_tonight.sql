-- "Has my partner submitted tonight?" — a yes/no, never the content.
--
-- The reveal gate hides a partner's entry until you have submitted your own,
-- which is right for the words but left the partner who hasn't written yet
-- with no idea the other one was waiting. Tonight said "Settling in" over three
-- empty cards while the person they love had already shared, and the only
-- thing that could say otherwise was a push notification — which is off for
-- some people and undelivered for others.
--
-- This returns only a boolean. It reveals nothing a partner-shared push doesn't
-- already say, and nothing of what was written. It answers only for a couple
-- the caller belongs to; for anyone else it is simply false.

create or replace function public.partner_submitted_tonight(p_couple_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select public.is_couple_member(p_couple_id)
     and exists (
       select 1 from public.entries
       where couple_id = p_couple_id
         and date = p_date
         and user_id <> auth.uid()
         and submitted = true
     );
$function$;

revoke all on function public.partner_submitted_tonight(uuid, date) from public, anon;
grant execute on function public.partner_submitted_tonight(uuid, date) to authenticated;
