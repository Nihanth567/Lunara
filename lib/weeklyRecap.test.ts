/**
 * "Your week". Run with:  npm run test:recap
 *
 * The rule that matters most is the one an innocent refactor would break: the
 * recap must never show tonight's answers before the two of you have opened
 * them together.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { weekRecap, type RecapEntry } from './weeklyRecap.ts';

function night(date: string, overrides: Partial<RecapEntry> = {}): RecapEntry {
  return {
    date,
    submitted: true,
    partnerSubmitted: true,
    revealed: true,
    grateful: `my grateful ${date}`,
    cute: `my cute ${date}`,
    grow: `my grow ${date}`,
    partnerGrateful: `their grateful ${date}`,
    partnerCute: `their cute ${date}`,
    partnerGrow: `their grow ${date}`,
    ...overrides,
  };
}

const TODAY = '2026-09-23';

test('only nights you both finished are read back', () => {
  const recap = weekRecap(
    [night('2026-09-22'), night('2026-09-21', { partnerSubmitted: false })],
    TODAY,
  );
  assert.equal(recap.nights, 1);
  assert.equal(recap.grateful.length, 2);
});

test('tonight stays out until it has been revealed', () => {
  assert.equal(weekRecap([night(TODAY, { revealed: false })], TODAY).nights, 0);
  assert.equal(weekRecap([night(TODAY, { revealed: true })], TODAY).nights, 1);
});

test('the window is the last seven nights, inclusive', () => {
  const recap = weekRecap([night('2026-09-17'), night('2026-09-16')], TODAY);
  assert.equal(recap.nights, 1);
  assert.equal(recap.cute[0].date, '2026-09-17');
});

test('newest first, yours before theirs', () => {
  const recap = weekRecap([night('2026-09-20'), night('2026-09-22')], TODAY);
  assert.deepEqual(
    recap.grow.map((l) => `${l.date}:${l.who}`),
    ['2026-09-22:me', '2026-09-22:partner', '2026-09-20:me', '2026-09-20:partner'],
  );
});

test('a spoken answer counts; an empty one does not', () => {
  const recap = weekRecap(
    [night('2026-09-22', { grateful: '', voiceGrateful: 'c/d/u/grateful.m4a', partnerGrateful: '  ' })],
    TODAY,
  );
  assert.equal(recap.grateful.length, 1);
  assert.equal(recap.grateful[0].voice, 'c/d/u/grateful.m4a');
  assert.equal(recap.grateful[0].text, '');
});

test('the window crosses a month boundary', () => {
  const recap = weekRecap([night('2026-09-28'), night('2026-10-02')], '2026-10-03');
  assert.equal(recap.nights, 2);
});
