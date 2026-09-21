import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGate, type GateInput } from './accessGate.ts';

/**
 * These protect the front door.
 *
 * Lunara has no free full product any more, which means this function is the
 * only thing standing between a paying couple and a paywall they already bought
 * their way past. Most of these tests are about *timing* rather than logic: two
 * of the inputs settle asynchronously, and the expensive mistake is treating
 * "not known yet" as "not entitled".
 */

/** Signed in, onboarded, store answered, nobody has paid. */
function base(over: Partial<GateInput> = {}): GateInput {
  return {
    isLoading: false,
    sessionExpired: false,
    onboardingComplete: true,
    coupleEntitled: false,
    purchasesReady: true,
    purchasesConfigurable: true,
    isDev: false,
    isDemo: false,
    ...over,
  };
}

test('a cold, unentitled user lands on the paywall, not the ritual', () => {
  assert.equal(resolveGate(base()), 'paywall');
});

test('an entitled couple goes straight in', () => {
  assert.equal(resolveGate(base({ coupleEntitled: true })), 'app');
});

test('the partner who never paid gets in on the couple flag alone', () => {
  // `coupleEntitled` is bool_or across members — this IS the non-payer's path,
  // and it must not depend on anything on their own device.
  assert.equal(
    resolveGate(base({ coupleEntitled: true, purchasesReady: false })),
    'app',
  );
});

test('an entitled couple never waits on the store', () => {
  // Checked before `purchasesReady` on purpose: the server already said yes.
  assert.equal(resolveGate(base({ coupleEntitled: true, purchasesReady: false })), 'app');
});

test('"not asked yet" is never treated as "not entitled"', () => {
  // The restore case and the seconds after a purchase. Returning `paywall` here
  // is the bug this whole file exists to prevent.
  assert.equal(resolveGate(base({ purchasesReady: false })), 'loading');
});

test('an expired session outranks entitlement', () => {
  assert.equal(resolveGate(base({ sessionExpired: true, coupleEntitled: true })), 'auth');
});

test('onboarding comes before the paywall', () => {
  // Selling to someone who has not seen a single screen is both rude and worse
  // converting; pairing has to happen first or one-person-pays is meaningless.
  assert.equal(resolveGate(base({ onboardingComplete: false })), 'onboarding');
});

test('nothing routes while the app is still loading', () => {
  assert.equal(resolveGate(base({ isLoading: true })), 'loading');
  assert.equal(resolveGate(base({ isLoading: true, sessionExpired: true })), 'loading');
});

test('a dev build with no store key opens, so local work is possible', () => {
  assert.equal(resolveGate(base({ purchasesConfigurable: false, isDev: true })), 'app');
});

test('a production build with no store key still gates', () => {
  // A missing key in production is a misconfiguration someone has to notice,
  // not a reason to hand out the product.
  assert.equal(resolveGate(base({ purchasesConfigurable: false, isDev: false })), 'paywall');
});

test('the dev escape needs BOTH a dev build and an unconfigurable store', () => {
  assert.equal(resolveGate(base({ purchasesConfigurable: true, isDev: true })), 'paywall');
});

test('the demo sandbox is never gated, in production too', () => {
  // Demo has no server couple and no RevenueCat customer, so the paywall
  // refuses to sell to it. Gating it strands someone on an undismissable screen
  // with a disabled button — which is exactly what shipped before this test.
  assert.equal(resolveGate(base({ isDemo: true })), 'app');
  assert.equal(resolveGate(base({ isDemo: true, isDev: false, purchasesReady: false })), 'app');
});

test('demo does not rescue a real couple that simply has not paid', () => {
  assert.equal(resolveGate(base({ isDemo: false })), 'paywall');
});
