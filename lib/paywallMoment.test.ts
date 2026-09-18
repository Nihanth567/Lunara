import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYWALL_MIN_SHARED_NIGHTS,
  shouldOfferPremium,
  type PaywallMomentInput,
} from './paywallMoment.ts';

/**
 * These are product promises, not implementation details.
 *
 * Every one of them protects a moment rather than an invariant, which is
 * exactly the kind of rule that gets quietly relaxed later by someone tuning
 * conversion. If one of these fails, the question to ask is not "how do I make
 * the test pass" but "are we now selling to someone who hasn't seen the
 * product yet".
 */

/** A couple in the afterglow of their fourth shared night, on free. */
function eligible(over: Partial<PaywallMomentInput> = {}): PaywallMomentInput {
  return {
    isPro: false,
    alreadyAsked: false,
    tonightRevealed: true,
    sharedNights: 4,
    ...over,
  };
}

test('the baseline case actually offers — otherwise every test below is vacuous', () => {
  assert.equal(shouldOfferPremium(eligible()), true);
});

test('never before the first mutual reveal', () => {
  assert.equal(shouldOfferPremium(eligible({ sharedNights: 0, tonightRevealed: false })), false);
});

test('never on the first shared night, however good it was', () => {
  assert.equal(shouldOfferPremium(eligible({ sharedNights: 1 })), false);
});

test('waits for the threshold, then offers on the night it is reached', () => {
  assert.equal(shouldOfferPremium(eligible({ sharedNights: PAYWALL_MIN_SHARED_NIGHTS - 1 })), false);
  assert.equal(shouldOfferPremium(eligible({ sharedNights: PAYWALL_MIN_SHARED_NIGHTS })), true);
});

test('never interrupts — the night must be finished and open', () => {
  assert.equal(shouldOfferPremium(eligible({ tonightRevealed: false })), false);
});

test('a half-finished night does not count, even on a long history', () => {
  assert.equal(
    shouldOfferPremium(eligible({ sharedNights: 40, tonightRevealed: false })),
    false,
  );
});

test('asks once — a declined offer stays declined', () => {
  assert.equal(shouldOfferPremium(eligible({ alreadyAsked: true })), false);
});

test('never shown to someone already paying', () => {
  assert.equal(shouldOfferPremium(eligible({ isPro: true })), false);
  // Belt and braces: being Pro outranks every other condition.
  assert.equal(
    shouldOfferPremium(eligible({ isPro: true, alreadyAsked: false, sharedNights: 999 })),
    false,
  );
});

test('the threshold is at least three — day one and day two are protected', () => {
  assert.ok(
    PAYWALL_MIN_SHARED_NIGHTS >= 3,
    'lowering this below 3 sells to couples who have barely used the app',
  );
});
