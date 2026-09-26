/**
 * Tonight's phases and the single nudge slot. Run with:  npm run test:nudge
 *
 * These pin the product rule: ritual first, at most one gentle nudge, and
 * nothing at all while someone is waiting on their partner.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pickNudge, tonightPhase, type TonightPhase, type TonightState } from './nudge.ts';

const base: TonightState = {
  answeredCount: 0,
  submitted: false,
  partnerJoined: true,
  partnerSubmitted: false,
  revealed: false,
};

const everything = { checkBack: true, tipFollowUp: true, guidance: true, tip: true };

test('phases follow the night in order', () => {
  assert.equal(tonightPhase(base), 'not_started');
  assert.equal(tonightPhase({ ...base, answeredCount: 1 }), 'writing');
  assert.equal(tonightPhase({ ...base, answeredCount: 3, submitted: true }), 'waiting');
  assert.equal(
    tonightPhase({ ...base, answeredCount: 3, submitted: true, partnerSubmitted: true }),
    'ready_to_reveal',
  );
  assert.equal(
    tonightPhase({ ...base, answeredCount: 3, submitted: true, partnerSubmitted: true, revealed: true }),
    'revealed',
  );
});

test('a partner who has not joined yet is still waiting, never ready', () => {
  assert.equal(
    tonightPhase({ ...base, submitted: true, partnerJoined: false, partnerSubmitted: false }),
    'waiting',
  );
});

test('waiting, writing and ready-to-reveal never show a nudge', () => {
  const quiet: TonightPhase[] = ['writing', 'waiting', 'ready_to_reveal'];
  for (const phase of quiet) assert.equal(pickNudge(phase, everything), null, phase);
});

test('after the reveal, exactly one nudge — the highest priority', () => {
  assert.equal(pickNudge('revealed', everything), 'checkBack');
  assert.equal(pickNudge('revealed', { tipFollowUp: true, guidance: true, tip: true }), 'tipFollowUp');
  assert.equal(pickNudge('revealed', { guidance: true, tip: true }), 'guidance');
  assert.equal(pickNudge('revealed', { tip: true }), 'tip');
  assert.equal(pickNudge('revealed', {}), null);
});

test('a new day opens with a follow-up at most — never a tip before the night', () => {
  assert.equal(pickNudge('not_started', everything), 'checkBack');
  assert.equal(pickNudge('not_started', { tipFollowUp: true, tip: true }), 'tipFollowUp');
  assert.equal(pickNudge('not_started', { guidance: true, tip: true }), null);
});
