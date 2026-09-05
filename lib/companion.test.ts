/**
 * The companion's states, as executable statements of intent.
 *
 * Run with:  npm run test:companion
 *
 * Same shape as `streak.test.ts` and for the same reason — `node --test` is
 * built in, strips the types itself, and costs nothing to keep. The rules here
 * are the ones a UI bug would quietly invert: which state wins when two apply,
 * and how long a quiet stretch has to be before the creature falls asleep.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  companionLabel,
  companionTier,
  getCompanionState,
  lastCompletedDate,
  type CompanionInput,
} from './companion.ts';

const TODAY = '2026-09-02';

function daysAgo(n: number): string {
  const d = new Date(`${TODAY}T00:00:00`);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

/** A couple mid-run with tonight untouched — the base every case varies from. */
function input(overrides: Partial<CompanionInput> = {}): CompanionInput {
  return {
    mySubmitted: false,
    partnerSubmitted: false,
    bothRevealed: false,
    streak: 0,
    lastCompletedAt: null,
    now: TODAY,
    partnerJoined: true,
    ...overrides,
  };
}

// ─── Tonight outranks history ────────────────────────────────────────────────

test('a revealed night is glowing, however long the streak', () => {
  assert.equal(
    getCompanionState(input({ mySubmitted: true, partnerSubmitted: true, bothRevealed: true, streak: 41, lastCompletedAt: TODAY })),
    'glowing',
  );
});

test('both submitted but unopened is ready, not glowing', () => {
  assert.equal(
    getCompanionState(input({ mySubmitted: true, partnerSubmitted: true, streak: 4, lastCompletedAt: daysAgo(1) })),
    'ready',
  );
});

test('a 40-night couple who just submitted is waiting, not streak-lit', () => {
  // The state with something to do beats the state with something to admire.
  assert.equal(
    getCompanionState(input({ mySubmitted: true, streak: 40, lastCompletedAt: daysAgo(1) })),
    'waiting',
  );
});

test('waiting is symmetric — the partner going first counts too', () => {
  assert.equal(getCompanionState(input({ partnerSubmitted: true, lastCompletedAt: daysAgo(1), streak: 3 })), 'waiting');
});

// ─── Nobody to wait for ──────────────────────────────────────────────────────

test('a solo user who submits is nesting, never waiting', () => {
  // There is no partner to hold a light for, and implying there is would be the
  // one way this feature could be cruel.
  assert.equal(getCompanionState(input({ mySubmitted: true, partnerJoined: false })), 'nesting');
});

test('no completed night ever is nesting', () => {
  assert.equal(getCompanionState(input()), 'nesting');
});

// ─── History, once tonight is untouched ──────────────────────────────────────

test('a live streak with tonight still open is streak-lit', () => {
  assert.equal(getCompanionState(input({ streak: 9, lastCompletedAt: daysAgo(1) })), 'streaklit');
});

test('a lapsed run inside the resting window is resting', () => {
  assert.equal(getCompanionState(input({ streak: 0, lastCompletedAt: daysAgo(3) })), 'resting');
});

test('past the resting window the companion sleeps — and only then', () => {
  assert.equal(getCompanionState(input({ streak: 0, lastCompletedAt: daysAgo(4) })), 'sleeping');
});

test('sleeping is reachable only with history — a new couple nests instead', () => {
  assert.equal(getCompanionState(input({ streak: 0, lastCompletedAt: null })), 'nesting');
});

// ─── Tiers ───────────────────────────────────────────────────────────────────

test('tiers step at 7, 14 and 30', () => {
  assert.equal(companionTier(0), 0);
  assert.equal(companionTier(6), 0);
  assert.equal(companionTier(7), 1);
  assert.equal(companionTier(13), 1);
  assert.equal(companionTier(14), 2);
  assert.equal(companionTier(29), 2);
  assert.equal(companionTier(30), 3);
  assert.equal(companionTier(400), 3);
});

// ─── Copy ────────────────────────────────────────────────────────────────────

test('waiting copy names the right side of the couple', () => {
  assert.equal(companionLabel('waiting', { waitingOn: 'partner' }), 'Holding a light for them');
  assert.notEqual(
    companionLabel('waiting', { waitingOn: 'you' }),
    companionLabel('waiting', { waitingOn: 'partner' }),
  );
});

test('no state is ever described as lost, dead or failed', () => {
  const banned = /dead|dying|died|decay|lost|fail|broke|broken|miss|forgot|guilt|neglect/i;
  const states = ['nesting', 'waiting', 'ready', 'glowing', 'streaklit', 'resting', 'sleeping'] as const;
  for (const state of states) {
    const line = companionLabel(state, { streak: 5 });
    assert.ok(!banned.test(line), `"${line}" (${state}) uses shame language`);
  }
});

// ─── The completed-nights helper ─────────────────────────────────────────────

test('lastCompletedDate ignores half-finished nights and takes the newest', () => {
  const entries = [
    { date: daysAgo(1), submitted: true, partnerSubmitted: false },
    { date: daysAgo(5), submitted: true, partnerSubmitted: true },
    { date: daysAgo(2), submitted: true, partnerSubmitted: true },
  ];
  assert.equal(lastCompletedDate(entries), daysAgo(2));
  assert.equal(lastCompletedDate([]), null);
});
