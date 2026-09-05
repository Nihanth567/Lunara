import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Every URL Lunara advertises, in one place.
 *
 * The invite link and the widget's tap target are the only two URLs the app
 * hands to the outside world, and both used to be string literals written at
 * their call sites — one in `app/(app)/index.tsx`, one in
 * `app/(onboarding)/pairing.tsx`, one in Swift. Nothing tied them to the router,
 * so `lunara://join/<code>` and `lunara://tonight` both pointed at routes that
 * did not exist and every tap landed on the not-found screen.
 *
 * The constants below are named after the route files that answer them, so a
 * rename that breaks a link breaks it here first:
 *
 *   INVITE_PATH   'join'      → app/join/[code].tsx
 *   TONIGHT_PATH  'tonight'   → app/tonight.tsx   (redirects to the Tonight tab)
 *
 * `scheme` in app.json is `lunara`, so `lunara://join/ABC123` arrives at
 * expo-router as the path `join/ABC123`. There is no associated-domain
 * (https://) form on purpose — universal links need an apple-app-site-association
 * file served from a domain Lunara does not own yet, and a https:// link with no
 * AASA behind it opens Safari to a 404, which is the bug this fixes rather than
 * a fix for it.
 */
export const APP_SCHEME = 'lunara';
export const INVITE_PATH = 'join';
export const TONIGHT_PATH = 'tonight';

/** Invite codes are exactly six A–Z / 0–9 characters (see the `create_couple` RPC). */
export const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_PATTERN = /^[A-Z0-9]{6}$/;

/** Upper-cased, stripped of anything a messaging app may have decorated it with. */
export function normalizeInviteCode(raw: string | undefined | null): string {
  return (raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, INVITE_CODE_LENGTH);
}

/** Whether a code is even *shaped* like an invite — checked before any network call. */
export function isWellFormedInviteCode(code: string): boolean {
  return INVITE_CODE_PATTERN.test(code);
}

export function inviteUrl(code: string): string {
  return `${APP_SCHEME}://${INVITE_PATH}/${encodeURIComponent(normalizeInviteCode(code))}`;
}

export function tonightUrl(): string {
  return `${APP_SCHEME}://${TONIGHT_PATH}`;
}

/**
 * The message that goes into the share sheet. The code is spelled out as well
 * as linked: the link only works on a phone with Lunara installed, and the
 * person being invited usually doesn't have it yet.
 */
export function inviteShareMessage(code: string): string {
  const normalized = normalizeInviteCode(code);
  return `Join me on Lunara — our private nightly ritual. Enter the code ${normalized}, or tap ${inviteUrl(normalized)} if you already have the app.`;
}

// ─── Pending invite (cold start) ─────────────────────────────────────────────

const PENDING_INVITE_KEY = 'lunara_pending_invite_v1';

/**
 * An invite tapped by someone who isn't signed in yet.
 *
 * The link is the *first* thing most second partners ever see of Lunara, and it
 * arrives before they have an account. Holding the code across the sign-in
 * detour is what makes "tap link → sign in → you're paired" one journey instead
 * of two, the second of which asks them to find a code they already tapped.
 */
export async function stashPendingInvite(code: string): Promise<void> {
  const normalized = normalizeInviteCode(code);
  if (!isWellFormedInviteCode(normalized)) return;
  await AsyncStorage.setItem(PENDING_INVITE_KEY, normalized).catch(() => {});
}

export async function readPendingInvite(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(PENDING_INVITE_KEY).catch(() => null);
  if (!stored) return null;
  const normalized = normalizeInviteCode(stored);
  return isWellFormedInviteCode(normalized) ? normalized : null;
}

/** Call once the code has been redeemed, or once it's clear it never will be. */
export async function clearPendingInvite(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_INVITE_KEY).catch(() => {});
}
