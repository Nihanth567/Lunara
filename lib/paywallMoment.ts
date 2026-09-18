/**
 * When Lunara is allowed to mention Premium on its own.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * Premium used to be introduced by a screen in onboarding: a preview, then the
 * paywall, before the person had spent a single night in the product. That is
 * the worst possible moment to ask. They have no streak, no archive, nothing
 * they would miss, and no evidence the app is any good — so the pitch has to do
 * all the work, and a pitch that has to do all the work reads as a pitch.
 *
 * Cutting onboarding to five screens removed that prompt, which left Premium
 * reachable only by bumping into a locked feature. This file is the deliberate
 * replacement: one proactive moment, placed after the product has already
 * proved itself.
 *
 * ─── The rules, and they are rules ───────────────────────────────────────────
 *
 * 1. **Never before the first mutual reveal.** The reveal is the thing the app
 *    is for. A couple who has not had one has not seen the product, and selling
 *    to them is selling a promise rather than a thing.
 * 2. **Never during it either.** The prompt waits until a night is *finished* —
 *    it is an afterglow, not an interruption. Nothing is allowed to come
 *    between two people and the night they just opened.
 * 3. **Once.** If they say no, the answer is no. Locked features still route to
 *    the paywall when tapped, because that is the person asking, not us.
 *
 * ─── Derived, never stored ───────────────────────────────────────────────────
 *
 * Same principle as `computeStreaks()` and `getCompanionState()`: this reads
 * the entries the app already has rather than keeping a counter. The only
 * persisted bit is "have we asked yet", which is genuinely per-device state and
 * nothing to do with the couple.
 */

/** Nights a couple must have finished together before Premium is mentioned. */
export const PAYWALL_MIN_SHARED_NIGHTS = 3;

export interface PaywallMomentInput {
  /** Already paying — there is nothing to offer. */
  isPro: boolean;
  /** Has this device already been asked once? */
  alreadyAsked: boolean;
  /** Is tonight finished and open? The prompt only lands in the afterglow. */
  tonightRevealed: boolean;
  /** Nights where BOTH partners submitted. Use `completedDates().length`. */
  sharedNights: number;
}

/**
 * The single decision. Pure, total, and easy to reason about at a glance —
 * which matters more here than in most places, because every one of these
 * conditions is protecting a moment rather than an invariant.
 */
export function shouldOfferPremium({
  isPro,
  alreadyAsked,
  tonightRevealed,
  sharedNights,
}: PaywallMomentInput): boolean {
  if (isPro || alreadyAsked) return false;
  // Rule 2: only ever in the afterglow of a finished night.
  if (!tonightRevealed) return false;
  // Rules 1 and the day-3 threshold, which are the same check — you cannot
  // reach three shared nights without having had a first reveal.
  return sharedNights >= PAYWALL_MIN_SHARED_NIGHTS;
}
