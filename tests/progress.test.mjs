import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLineProgress, normalizeCourseProgress, scheduleReview } from '../src/progress.js';

const now = Date.UTC(2026, 7, 19);

test('Again repeats a failed line in ten minutes', () => {
  const result = scheduleReview(defaultLineProgress(now), 'again', now);
  assert.equal(result.repetitions, 0);
  assert.equal(result.dueAt - now, 10 * 60 * 1000);
});

test('successful recalls grow spacing', () => {
  const first = scheduleReview(defaultLineProgress(now), 'good', now);
  const second = scheduleReview(first, 'good', now);
  const third = scheduleReview(second, 'good', now);
  assert.equal(first.intervalDays, 1);
  assert.equal(second.intervalDays, 3);
  assert.ok(third.intervalDays > second.intervalDays);
});

test('Easy schedules farther out than Good', () => {
  const base = { ...defaultLineProgress(now), repetitions: 2, intervalDays: 6 };
  assert.ok(scheduleReview(base, 'easy', now).intervalDays > scheduleReview(base, 'good', now).intervalDays);
});

test('legacy micro deviation progress migrates to response-level learning state', () => {
  const result = normalizeCourseProgress({
    discovered: ['advance-main'],
    learnedDeviations: ['micro:advance-quiet-be2', 'branch:advance-main:6:h2h4'],
    lines: {},
    totalSessions: 1
  });

  assert.deepEqual(result.learnedResponses, ['advance-quiet-be2']);
  assert.equal(Object.hasOwn(result, 'learnedDeviations'), false);
});
