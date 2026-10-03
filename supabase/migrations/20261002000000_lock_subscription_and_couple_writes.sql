-- Close two write holes found while testing.
--
-- ─── 1. Anyone could give themselves Lunara+ ─────────────────────────────────
--
-- "update own profile" lets a user update their own profiles row — every
-- column of it, including `is_subscribed`. One request from a signed-in client
-- (`update profiles set is_subscribed = true where id = auth.uid()`) made
-- `get_my_couple` report the couple as subscribed, and the front gate opened
-- for free. Verified against the live project before this migration.
--
-- Fix with column privileges rather than a policy: the client may update only
-- the fields the app actually writes (name, birthday, pronouns, avatar,
-- push token, updated_at). `is_subscribed` and `revenuecat_app_user_id` are
-- written only by the RevenueCat webhook, which uses the service role and is
-- unaffected.
revoke update on table public.profiles from authenticated, anon;
grant update (name, birthday, pronouns, avatar_url, expo_push_token, updated_at)
  on table public.profiles to authenticated;

-- ─── 2. Entries and keepsakes could be written into any couple ───────────────
--
-- Their INSERT/UPDATE checks were only `user_id = auth.uid()`, so a signed-in
-- user who knew another couple's id could write rows into it. Couple ids are
-- random and never shown to non-members, so this was hard to reach, but "only
-- members write into a couple" should hold on every path. Membership now goes
-- through is_couple_member(), the non-recursive helper from 20261001000000.

drop policy if exists "insert own entries" on public.entries;
create policy "insert own entries" on public.entries
for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "update own entries" on public.entries;
create policy "update own entries" on public.entries
for update using (user_id = auth.uid())
with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "insert own keepsake answers" on public.keepsakes;
create policy "insert own keepsake answers" on public.keepsakes
for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "update own keepsake answers" on public.keepsakes;
create policy "update own keepsake answers" on public.keepsakes
for update using (user_id = auth.uid())
with check (user_id = auth.uid() and public.is_couple_member(couple_id));
