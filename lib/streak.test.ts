/**
 * The streak rules, as executable statements of intent.
 *
 * Run with:  npm run test:streak
 *
 * There is no test framework in this repo and this file deliberately doesn't
 * add one — `node --test` has been built in since Node 18 and Node strips the
 * types on its own, so these cost nothing to keep and nothing to run.
 *
 * `recompute_couple_streaks()` in
 * `supabase/migrations/20260830000000_streak_grace_alignment.sql` implements the
 * same four rules in SQL. When a case here changes, that function changes with
 * it — the two disagreeing is precisely the bug this file exists to prevent.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { computeStreakState } from './streak.ts';

const TODAY = '2026-08-30';

/** Date keys for the `offsets` days before TODAY (0 = today, 1 = yesterday…). */
function daysAgo(...offsets: number[]): string[] {
  return offsets.map((n) => {
    const d = new Date(`${TODAY}T00:00:00`);
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
  });
}

// ─── Rule 1: both partners, or it isn't a night ──────────────────────────────

test('no completed nights is a streak of zero, not at risk', () => {
  const s = computeStreakState([], TODAY);
  assert.equal(s.current, 0);
  assert.equal(s.longest, 0);
  assert.equal(s.atRisk, false);
});

// ─── Rule 2: anchored to yesterday until tonight is done ─────────────────────

test('an unfinished tonight leaves yesterday’s run intact and at risk', () => {
  const s = computeStreakState(daysAgo(1, 2, 3, 4), TODAY);
  assert.equal(s.current, 4);
  assert.equal(s.todayComplete, false);
  assert.equal(s.atRisk, true);
});

test('finishing tonight extends the run and clears the risk', () => {
  const s = computeStreakState(daysAgo(0, 1, 2, 3, 4), TODAY);
  assert.equal(s.current, 5);
  assert.equal(s.todayComplete, true);
  assert.equal(s.atRisk, false);
});

// ─── Rule 3: one forgiven night, and it covers last night (B-11) ─────────────

test('a missed night in the middle of a run is stepped over', () => {
  // …done, done, MISSED, done, done — reading back from yesterday.
  const s = computeStreakState(daysAgo(1, 2, 4, 5), TODAY);
  assert.equal(s.current, 4);
  assert.equal(s.protectedDate, daysAgo(3)[0]);
  assert.equal(s.graceAvailable, false);
});

test('missing LAST night is forgiven the same day, not the next one', () => {
  // The B-11 regression: this used to read 0 all day and jump to 4 tonight.
  const before = computeStreakState(daysAgo(2, 3, 4), TODAY);
  assert.equal(before.current, 3, 'yesterday is forgiven while today is still open');
  assert.equal(before.protectedDate, daysAgo(1)[0]);
  assert.equal(before.atRisk, true);

  // …and finishing tonight continues the same run rather than revealing it.
  const after = computeStreakState(daysAgo(0, 2, 3, 4), TODAY);
  assert.equal(after.current, 4, 'no 0 → N+1 jump across the submit');
});

test('two missed nights end the run', () => {
  const s = computeStreakState(daysAgo(3, 4, 5), TODAY);
  assert.equal(s.current, 0);
  assert.equal(s.atRisk, false);
});

test('a single lone night with nothing behind it is not a forgiven run', () => {
  const s = computeStreakState(daysAgo(5), TODAY);
  assert.equal(s.current, 0);
});

test('grace is spent once per run, never twice', () => {
  // done, MISSED, done, MISSED, done — only the first gap is stepped over.
  const s = computeStreakState(daysAgo(1, 3, 5), TODAY);
  assert.equal(s.current, 2);
  assert.equal(s.protectedDate, daysAgo(2)[0]);
});

// ─── Rule 4: longest uses the same rules as current (B-17) ───────────────────

test('longest counts a forgiven night the same way current does', () => {
  const s = computeStreakState(daysAgo(1, 2, 4, 5), TODAY);
  assert.equal(s.longest, s.current, 'the record must bound the live run, not undercut it');
  assert.equal(s.longest, 4);
});

test('longest survives a run that has since ended', () => {
  const old = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'];
  const s = computeStreakState([...old, ...daysAgo(1)], TODAY);
  assert.equal(s.current, 1);
  assert.equal(s.longest, 4);
});
