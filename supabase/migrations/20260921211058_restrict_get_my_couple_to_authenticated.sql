-- Bring `get_my_couple` in line with its two siblings.
--
-- `create_couple` and `join_couple` are both SECURITY DEFINER and both grant
-- EXECUTE to `authenticated` only. `get_my_couple` was the odd one out: it is
-- created by a plain `create function` with no revoke — in
-- `20260825000000_add_couples_subscription_status.sql`, and again in
-- `20260921210922_together_points_and_voice_metadata.sql` when adding
-- `together_points` — so each time it came back with Postgres' default PUBLIC
-- grant plus Supabase's default grant to `anon`.
--
-- This was never a data leak. The body filters on `cm.user_id = auth.uid()`,
-- and for an anonymous caller `auth.uid()` is null, so the join matches nothing
-- and the call returns zero rows. What it was, was an unauthenticated entry
-- point into a SECURITY DEFINER function — safe only for as long as nobody
-- edits the body without noticing who can reach it. Supabase's database linter
-- flags it for exactly that reason (0028_anon_security_definer_function_executable).
--
-- `authenticated` is deliberately kept: the app calls this on every sign-in and
-- every refresh. Only PUBLIC and `anon` lose access.
--
-- NOTE for whoever next changes this function's signature: `create or replace`
-- preserves grants, but a `drop` + `create` (which a return-type change forces)
-- resets them. If you drop it, re-apply these two revokes in the same migration.

revoke execute on function public.get_my_couple() from public;
revoke execute on function public.get_my_couple() from anon;
