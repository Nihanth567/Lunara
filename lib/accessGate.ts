/**
 * Where a person goes when they open Lunara.
 *
 * ─── Why this is a pure function and not four `if`s in a screen ──────────────
 *
 * This is the front gate: after this change there is no free full product, so
 * the answer this function returns is the difference between a paying couple
 * reaching their night and a paying couple staring at a wall they already paid
 * to remove. Two of its inputs are asynchronous and settle at different times,
 * which is exactly the shape of bug that never reproduces on the machine where
 * it was written. So the decision is pure, total, and tested, and the screen
 * only routes.
 *
 * ─── The one failure mode worth naming ───────────────────────────────────────
 *
 * `couple.isSubscribed` is `bool_or(profiles.is_subscribed)` across the
 * couple's members, written by the RevenueCat webhook. It is authoritative and
 * it is *late*: seconds-to-minutes behind a purchase, and never written at all
 * for a restore, which emits no webhook. The device's own RevenueCat answer is
 * immediate but only speaks for the person holding the phone.
 *
 * Either one being true means entitled. Neither being true means nothing at all
 * until RevenueCat has actually been asked — which is what `purchasesReady`
 * records, and why `loading` exists as a distinct answer rather than being
 * folded into `paywall`. Treating "not yet known" as "not entitled" is the bug
 * this file exists to make impossible.
 */

export type GateDestination =
  /** Nothing is known yet. Hold the splash; do not route. */
  | 'loading'
  /** There was an account and there isn't one now. */
  | 'auth'
  /** This device has never finished onboarding. */
  | 'onboarding'
  /** Signed in, onboarded, and not entitled. The front gate. */
  | 'paywall'
  /** Entitled — by subscription or by an active trial, theirs or their partner's. */
  | 'app';

export interface GateInput {
  /** AppContext's own load flag: profile and couple resolved. */
  isLoading: boolean;
  /** The session expired out from under a device that had one. */
  sessionExpired: boolean;
  /** This device has completed onboarding at least once. */
  onboardingComplete: boolean;
  /**
   * `couple.isSubscribed` — the server's answer, true if *either* member holds
   * the entitlement. This is what makes one-person-pays work.
   */
  coupleEntitled: boolean;
  /** RevenueCat has been configured and asked at least once. */
  purchasesReady: boolean;
  /**
   * Whether a RevenueCat API key exists for this platform at all. Without one
   * there is no entitlement to read and no purchase to make — see the note on
   * `purchasesConfigurable` below.
   */
  purchasesConfigurable: boolean;
  /** Build-time dev flag. Only consulted alongside `purchasesConfigurable`. */
  isDev: boolean;
  /**
   * The local sandbox couple (`couple.isDemoMode`), with its scripted partner
   * and its AsyncStorage-backed entries.
   *
   * Demo is not a free copy of the product — it is a preview with a partner who
   * does not exist. See the note in `resolveGate`.
   */
  isDemo: boolean;
}

export function resolveGate({
  isLoading,
  sessionExpired,
  onboardingComplete,
  coupleEntitled,
  purchasesReady,
  purchasesConfigurable,
  isDev,
  isDemo,
}: GateInput): GateDestination {
  if (isLoading) return 'loading';
  // An expired session outranks everything: the alternative is rendering a
  // fully-populated app where not one write can land.
  if (sessionExpired) return 'auth';
  if (!onboardingComplete) return 'onboarding';

  // Entitled is entitled, whichever half of the couple paid, and whether they
  // are paying or still inside the free trial. Checked before `purchasesReady`
  // so a couple the server already knows about never waits on the store.
  if (coupleEntitled) return 'app';

  /**
   * The demo sandbox is never gated, and this is not a hole in "no free full
   * product".
   *
   * Demo mode has no couple on the server and no RevenueCat customer, so a
   * subscription bought from inside it could not be attributed to anyone and
   * could not unlock anything for two people — which is exactly why the paywall
   * already refuses to sell to a demo user and says so. Gating it therefore
   * sells nothing; it only strands somebody on a screen with a disabled button
   * and, in gate mode, no way back. The partner in there is scripted and the
   * entries are generated, so there is no real product being given away.
   */
  if (isDemo) return 'app';

  /**
   * No RevenueCat key on this platform — web, or a local build without the env
   * vars. There is no entitlement to read *and nothing to sell*, so gating
   * would not protect revenue, it would just make the app impossible to open.
   *
   * Narrow on purpose: it requires a dev build **and** an unconfigurable store.
   * A production build with a missing key still gates, loudly, because that is
   * a misconfiguration someone needs to notice rather than a door to leave ajar.
   */
  if (!purchasesConfigurable && isDev) return 'app';

  // The server says no. Before believing it, make sure the device has been
  // asked — this is the restore case and the just-purchased case.
  if (!purchasesReady) return 'loading';

  return 'paywall';
}
