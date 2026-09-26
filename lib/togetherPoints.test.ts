/**
 * Together points, as executable statements of intent.
 *
 * Run with:  npm run test:points
 *
 * The rules worth pinning are the ones an "optimisation" would break: that the
 * total is derived rather than counted (so it can't double-count a replayed
 * event), that it survives a broken streak, and that it never goes down.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  shouldShowTogetherPoints,
  togetherPoints,
  togetherPointsLabel,
  type TogetherPointsEntry,
} from './togetherPoints.ts';

function night(date: string, mine: boolean, theirs: boolean): TogetherPointsEntry {
  return { date, submitted: mine, partnerSubmitted: theirs };
}

test('a night counts only when both partners submitted', () => {
  assert.equal(togetherPoints([night('2026-09-01', true, true)]), 1);
  assert.equal(togetherPoints([night('2026-09-01', true, false)]), 0);
  assert.equal(togetherPoints([night('2026-09-01', false, true)]), 0);
  assert.equal(togetherPoints([night('2026-09-01', false, false)]), 0);
});

test('no entries is zero, not a crash', () => {
  assert.equal(togetherPoints([]), 0);
});

test('one point per night, across many nights', () => {
  assert.equal(
    togetherPoints([
      night('2026-09-01', true, true),
      night('2026-09-02', true, true),
      night('2026-09-03', true, true),
    ]),
    3,
  );
});

test('a duplicated night counts once', () => {
  // Demo mode stores entries as a plain array, and a realtime event can arrive
  // twice. Neither may inflate the total — this is the property an incrementing
  // counter could not give us.
  assert.equal(
    togetherPoints([
      night('2026-09-01', true, true),
      night('2026-09-01', true, true),
    ]),
    1,
  );
});

test('points survive a broken streak', () => {
  // The whole reason this number sits next to the streak: a missed Wednesday
  // ends a run, and takes nothing away from the nights on either side of it.
  const entries = [
    night('2026-09-01', true, true),
    night('2026-09-02', true, true),
    // Wednesday missed entirely — no row at all.
    night('2026-09-04', true, true),
  ];
  assert.equal(togetherPoints(entries), 3);
});

test('an unfinished night between two finished ones is not a point', () => {
  const entries = [
    night('2026-09-01', true, true),
    night('2026-09-02', true, false),
    night('2026-09-03', true, true),
  ];
  assert.equal(togetherPoints(entries), 2);
});

test('order does not matter', () => {
  const ascending = [
    night('2026-09-01', true, true),
    night('2026-09-02', true, true),
  ];
  assert.equal(togetherPoints(ascending), togetherPoints([...ascending].reverse()));
});

test('the chip stays hidden until the number means something', () => {
  // "0 points" on night one is a scoreboard opening at nil.
  assert.equal(shouldShowTogetherPoints(0), false);
  assert.equal(shouldShowTogetherPoints(1), false);
  assert.equal(shouldShowTogetherPoints(2), true);
  assert.equal(shouldShowTogetherPoints(48), true);
});

test('the label counts nights, not points, and pluralises', () => {
  assert.equal(togetherPointsLabel(1), '1 night together');
  assert.equal(togetherPointsLabel(2), '2 nights together');
  assert.equal(togetherPointsLabel(0), '0 nights together');
});
