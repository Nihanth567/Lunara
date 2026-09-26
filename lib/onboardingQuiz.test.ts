/**
 * The first-run quiz. Run with:  npm run test:quiz
 *
 * The rule that matters most: a personalised line may reflect an answer, but it
 * must never claim the app does something it doesn't — above all, never
 * mention a reminder that isn't switched on.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  NIGHT_FEELS,
  QUESTIONS,
  beliefLine,
  nightPlanSteps,
  planChips,
  planFraming,
  rhythmLine,
  type QuizAnswers,
} from './onboardingQuiz.ts';

/** Every combination of one answer per question, plus "not answered". */
function everyAnswerSet(): QuizAnswers[] {
  let sets: QuizAnswers[] = [{}];
  for (const q of QUESTIONS) {
    const next: QuizAnswers[] = [];
    for (const set of sets) {
      next.push(set);
      for (const option of q.options) next.push({ ...set, [q.key]: option.id });
    }
    sets = next;
  }
  return sets;
}

test('six questions, each with three or four distinct answers', () => {
  assert.equal(QUESTIONS.length, 6);
  assert.equal(new Set(QUESTIONS.map((q) => q.key)).size, QUESTIONS.length);
  for (const q of QUESTIONS) {
    assert.ok(q.options.length >= 3 && q.options.length <= 4, q.key);
    assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length, q.key);
    for (const o of q.options) assert.ok(o.label.trim().length > 0 && o.icon.length > 0);
  }
});

test('the plan is always four finished lines, whatever was answered', () => {
  for (const answers of everyAnswerSet()) {
    for (const remindersOn of [true, false]) {
      const steps = nightPlanSteps(answers, { remindersOn });
      assert.equal(steps.length, 4);
      for (const line of steps) assert.doesNotMatch(line, /undefined|null/);
    }
  }
});

test('a reminder is only promised when reminders are on', () => {
  const forget: QuizAnswers = { barrier: 'forget' };
  assert.match(nightPlanSteps(forget, { remindersOn: true }).join(' '), /reminder each night/);
  const off = nightPlanSteps(forget, { remindersOn: false }).join(' ');
  assert.doesNotMatch(off, /reminder each night/);
  assert.match(off, /turn on any time/);
});

test('unanswered questions fall back to something warm, not something blank', () => {
  for (const line of [beliefLine({}), planFraming({}), rhythmLine({})]) {
    assert.ok(line.length > 10);
  }
  assert.deepEqual(planChips({}), []);
});

test('the plan chips name only what was chosen', () => {
  assert.deepEqual(planChips({ rhythm: 'few', stage: 'distance' }, 'soft'), [
    'Soft nights',
    'A few times a week',
    'Long-distance',
  ]);
  assert.deepEqual(planChips({ stage: 'married' }), ['Married']);
});

test('no copy slips into clinical or guilt-trip language', () => {
  const copy = [
    ...QUESTIONS.flatMap((q) => [q.title, ...q.options.map((o) => o.label)]),
    ...NIGHT_FEELS.flatMap((f) => [f.label, f.detail]),
    ...everyAnswerSet().flatMap((a) => [
      beliefLine(a),
      planFraming(a),
      rhythmLine(a),
      ...nightPlanSteps(a, { remindersOn: true }),
      ...nightPlanSteps(a, { remindersOn: false }),
    ]),
  ].join(' ');
  assert.doesNotMatch(copy, /therap|diagnos|symptom|disorder|toxic|fail|fix your/i);
});
