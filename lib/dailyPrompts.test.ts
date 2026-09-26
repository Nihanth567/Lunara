/**
 * Tonight's questions. Run with:  npm run test:prompts
 *
 * The promises worth pinning: both partners see the same question for the same
 * night, the cards don't move in lockstep, and a bad date never breaks a card.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { dailyPrompt, PROMPTS, type PromptType } from './dailyPrompts.ts';

const TYPES: PromptType[] = ['grateful', 'cute', 'grow'];

test('the same night always asks the same question', () => {
  for (const type of TYPES) {
    assert.equal(dailyPrompt(type, '2026-09-23'), dailyPrompt(type, '2026-09-23'));
  }
});

test('consecutive nights ask something different', () => {
  for (const type of TYPES) {
    assert.notEqual(dailyPrompt(type, '2026-09-23'), dailyPrompt(type, '2026-09-24'));
  }
});

test('every question in a pool comes up before any repeats', () => {
  for (const type of TYPES) {
    const pool = PROMPTS[type];
    const seen = new Set<string>();
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < pool.length; i++) {
      const key = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      seen.add(dailyPrompt(type, key));
    }
    assert.equal(seen.size, pool.length);
  }
});

test('the three cards do not repeat as a set on the same weekday', () => {
  const combo = (key: string) => TYPES.map((t) => dailyPrompt(t, key)).join('|');
  assert.notEqual(combo('2026-09-23'), combo('2026-09-30'));
});

test('a malformed date still gets a question rather than undefined', () => {
  for (const type of TYPES) {
    assert.equal(typeof dailyPrompt(type, 'not-a-date'), 'string');
    assert.ok(dailyPrompt(type, '').length > 0);
  }
});
