/**
 * The paywall's plan arithmetic. Run with:  npm run test:pricing
 *
 * The rule that matters most is that the saving badge never claims more than
 * the store's own prices give.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { trialDays, trialLength, yearlySavingsPercent } from './pricing.ts';

test('the launch prices save 69% on yearly', () => {
  // $2.99 × 52 = $155.48 a year, against $48.
  assert.equal(yearlySavingsPercent(2.99, 48), 69);
});

test('the saving rounds down, never up', () => {
  // 1 - 40 / 52 = 23.07…% — says 23, not 24, and never more than the truth.
  assert.equal(yearlySavingsPercent(1, 40), 23);
  const claimed = yearlySavingsPercent(2.99, 48)!;
  assert.ok(claimed <= (1 - 48 / (2.99 * 52)) * 100);
});

test('an exact saving is not floored a point low by floating point', () => {
  // 1 - 36.92 / 52 is 29% exactly; naive flooring gives 28.
  assert.equal(yearlySavingsPercent(1, 36.92), 29);
});

test('no saving, no badge', () => {
  assert.equal(yearlySavingsPercent(2.99, 155.48), null);
  assert.equal(yearlySavingsPercent(2.99, 200), null);
  assert.equal(yearlySavingsPercent(0, 48), null);
  assert.equal(yearlySavingsPercent(2.99, 0), null);
  assert.equal(yearlySavingsPercent(Number.NaN, 48), null);
});

test('a 21-day trial reads "21-day" whether the store says days or weeks', () => {
  assert.equal(trialLength('DAY', 21), '21-day');
  assert.equal(trialLength('WEEK', 3), '21-day');
  assert.equal(trialLength('WEEK', 1), '7-day');
});

test('the unit stays singular inside the compound', () => {
  assert.equal(trialLength('MONTH', 1), '1-month');
  assert.equal(trialLength('MONTH', 2), '2-month');
  assert.equal(trialLength('YEAR', 1), '1-year');
  assert.doesNotMatch(trialLength('DAY', 21)!, /days/i);
});

test('trial days for the lede and analytics', () => {
  assert.equal(trialDays('DAY', 21), 21);
  assert.equal(trialDays('WEEK', 3), 21);
  assert.equal(trialDays('MONTH', 1), 30);
  assert.equal(trialDays('YEAR', 1), 365);
});

test('something that is not a length is not a trial', () => {
  assert.equal(trialLength('DAY', 0), null);
  assert.equal(trialLength('FORTNIGHT', 1), null);
  assert.equal(trialDays('DAY', -3), null);
  assert.equal(trialDays('UNKNOWN', 3), null);
});
