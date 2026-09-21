/**
 * The monetisation event seam.
 *
 * ─── Why this exists as its own file ─────────────────────────────────────────
 *
 * The paywall funnel is the one part of this app where "we shipped it and it
 * felt fine" is not an acceptable standard — a default package, a trial length
 * and a price are decisions that can only be judged against numbers. There was
 * no analytics of any kind in the app, so this is the seam: one typed function,
 * called from the handful of places that matter, with exactly one place to plug
 * a real provider in later.
 *
 * ─── What it deliberately is not ─────────────────────────────────────────────
 *
 * It is not an analytics SDK and it does not add one. Nothing here leaves the
 * device. Wiring Amplitude / PostHog / RevenueCat's own events means filling in
 * `sink` below and changing nothing else — which is the entire point of putting
 * it behind a function on day one rather than sprinkling SDK calls through the
 * paywall and discovering later that half the funnel was never instrumented.
 *
 * ─── No content, ever ────────────────────────────────────────────────────────
 *
 * Lunara's payload is two people's private writing. Nothing in this file may
 * ever carry an answer, a name, an email or an invite code — the props are
 * deliberately limited to plan shape and funnel position, and the type stops
 * anything else being passed by accident.
 */

/** The monetisation funnel, in the order a person moves through it. */
export type MonetisationEvent =
  /** The paywall became visible, in either presentation. */
  | 'paywall_view'
  /** Tapped the primary CTA with a weekly package selected. */
  | 'paywall_cta_weekly_trial'
  /** Tapped the primary CTA with the annual package selected. */
  | 'paywall_cta_yearly'
  /** A purchase completed and the entitlement came back inside its free trial. */
  | 'trial_started'
  /** A purchase completed and is being paid for now. */
  | 'purchase_completed'
  /** Restore found a previous purchase and re-entitled this device. */
  | 'restore_completed'
  /** The couple (not just the payer) is now entitled. */
  | 'couple_premium_granted'
  /** Someone tried to leave the front gate without an entitlement. */
  | 'paywall_dismiss_blocked';

/**
 * Non-identifying context. Plan shape and funnel position only — see the note
 * above on why this type is closed rather than `Record<string, unknown>`.
 */
export interface EventProps {
  /** 'weekly' | 'annual' | 'monthly' | 'unknown' — never a product price. */
  plan?: string;
  /** Where the paywall was opened from: 'gate' | 'modal' | 'onboarding'. */
  source?: string;
  /** Free-trial length in days, as the store reported it. */
  trialDays?: number;
  /** Whether the couple has both members joined — one-person-pays depends on it. */
  paired?: boolean;
}

/**
 * The single place a provider gets wired in.
 *
 * Left as a dev-only console line on purpose: a stub that silently discards in
 * development is a stub nobody notices is unwired, and this funnel is too easy
 * to ship broken for that to be a good default.
 */
function sink(event: MonetisationEvent, props: EventProps): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, props);
  }
}

/** Record a funnel event. Never throws — analytics must not break a purchase. */
export function track(event: MonetisationEvent, props: EventProps = {}): void {
  try {
    sink(event, props);
  } catch {
    // An analytics failure is never allowed to interrupt a checkout.
  }
}
