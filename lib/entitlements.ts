import type { Couple } from '@/context/AppContext';
import { toDateKey } from '@/lib/streak';

/**
 * How many trailing days of completed prompts a non-entitled user can see.
 *
 * ─── This is now a backstop, not a business model ────────────────────────────
 *
 * Lunara used to be freemium: the ritual, the reveal and the last 30 days were
 * free forever, and Premium sold four extras on top. That is no longer true —
 * `app/index.tsx` gates the whole app behind an active entitlement or trial, so
 * nobody reaches this screen without one.
 *
 * The constant stays because `app/(app)/history.tsx` reads it, and because a
 * belt-and-braces gate inside the app is the correct shape for something that
 * is also enforced at the front door: if the front gate is ever bypassed by a
 * routing bug, this degrades to a limited archive rather than the full one.
 * It should not be described to anyone as a free tier, because it is not one.
 */
export const FREE_HISTORY_DAYS = 30;

export function isPro(couple: Couple | null): boolean {
  return couple?.isSubscribed ?? false;
}

/**
 * What Lunara Premium is — the single list the paywall and the Us tab render.
 *
 * ─── The list changed shape, because the product did ─────────────────────────
 *
 * This used to name four add-ons (archive, voice notes, recap, date nights) and
 * carried a rule that every entry must correspond to a gate in the code, plus a
 * note that the nightly ritual was "deliberately absent" because it was free
 * for everyone.
 *
 * The ritual is no longer free for everyone. There is one gate now and it is
 * the front door, so the honest list is the product itself rather than four
 * things bolted to the side of a free app. The rule survives the change and is
 * what the `gate` field still records: every line here names where it is
 * actually enforced.
 *
 * Three entries, not six. A paywall that lists everything reads as a feature
 * matrix; a paywall that names three things reads as a product.
 */
export interface PremiumFeature {
  /** Ionicons name. */
  icon: string;
  /** The full line, as the paywall lists it. */
  text: string;
  /** Two or three words, for the places that name Premium in a sentence. */
  short: string;
  /** Where the gate for this actually lives, so the claim stays checkable. */
  gate: string;
}

export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    icon: 'moon-outline',
    text: 'Your nightly ritual and the reveal you open together',
    short: 'your nightly ritual',
    gate: 'app/index.tsx — requireEntitlement gate',
  },
  {
    icon: 'infinite-outline',
    text: 'Every night you have kept — with voice notes, and your fox',
    short: 'your whole archive',
    gate: 'app/index.tsx gate; app/(app)/history.tsx backstop',
  },
  {
    icon: 'flame-outline',
    text: 'A streak that belongs to both of you, not to whoever paid',
    short: 'your shared streak',
    gate: 'context/AppContext — couple.isSubscribed is bool_or across members',
  },
];

/**
 * One sentence naming everything Premium unlocks, for the places that describe the
 * subscription in prose rather than as a list (the Us tab, the preview screen).
 * Built from `PREMIUM_FEATURES` rather than written out again, so removing a feature
 * removes it from every sentence that mentions it.
 */
export function premiumSummary(): string {
  const parts = PREMIUM_FEATURES.map((f) => f.short);
  const last = parts[parts.length - 1];
  const sentence = `${parts.slice(0, -1).join(', ')}, and ${last}`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

/**
 * The one-person-pays promise, stated plainly enough to sit on the paywall.
 *
 * Replaces `freeTierSummary()`, which described a free tier that no longer
 * exists. This is the sentence that has to be true instead: whichever half of
 * the couple subscribes, both halves get the product, and the person who did
 * not pay never sees a wall.
 *
 * It is enforced server-side — `get_my_couple()` derives the couple's
 * `is_subscribed` as `bool_or(profiles.is_subscribed)` across its members — so
 * this is a description of behaviour rather than a marketing claim.
 */
export function coupleCoverageSummary(): string {
  return 'One of you subscribes and Lunara opens for both of you. Your partner never pays, and never sees a paywall.';
}

/** Oldest date (YYYY-MM-DD) still visible to a free user in the Moments feed. */
export function freeHistoryCutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - (FREE_HISTORY_DAYS - 1));
  return toDateKey(d);
}
