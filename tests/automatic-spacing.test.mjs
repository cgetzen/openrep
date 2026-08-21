import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SPACING_INTERVAL_DAYS,
  defaultLineProgress,
  lineSpacingStage,
  recordLineAttempt,
  scheduleLineAttempt
} from '../src/progress.js';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 7, 21);

test('clean attempts advance through the automatic spacing schedule', () => {
  let progress = defaultLineProgress(now);
  const observed = [];

  for (let index = 0; index < SPACING_INTERVAL_DAYS.length; index += 1) {
    progress = recordLineAttempt(progress, 0, now);
    observed.push(progress.intervalDays);
  }

  assert.deepEqual(observed, [1, 3, 7, 14, 30, 60]);
  assert.equal(progress.spacingStage, 5);
  assert.equal(progress.dueAt, now + 60 * DAY);
});

test('one and two mistakes step the schedule back by one and two stages', () => {
  const base = {
    ...defaultLineProgress(now),
    spacingStage: 4,
    intervalDays: 30
  };

  const oneMistake = scheduleLineAttempt(base, 1, now);
  const twoMistakes = scheduleLineAttempt(base, 2, now);

  assert.equal(oneMistake.spacingStage, 3);
  assert.equal(oneMistake.intervalDays, 14);
  assert.equal(twoMistakes.spacingStage, 2);
  assert.equal(twoMistakes.intervalDays, 7);
});

test('three or more mistakes reset the schedule to a one-day review', () => {
  const base = {
    ...defaultLineProgress(now),
    spacingStage: 5,
    intervalDays: 60
  };

  const reset = recordLineAttempt(base, 9, now);
  assert.equal(reset.spacingStage, 0);
  assert.equal(reset.intervalDays, 1);
  assert.equal(reset.dueAt, now + DAY);
  assert.equal(reset.recentAttempts.at(-1), 3);
});

test('legacy interval progress maps into the new spacing stage before the next attempt', () => {
  assert.equal(lineSpacingStage({ intervalDays: 1 }), 0);
  assert.equal(lineSpacingStage({ intervalDays: 3 }), 1);
  assert.equal(lineSpacingStage({ intervalDays: 8 }), 2);
  assert.equal(lineSpacingStage({ intervalDays: 30 }), 4);

  const migrated = scheduleLineAttempt({ intervalDays: 3, completions: 4 }, 0, now);
  assert.equal(migrated.spacingStage, 2);
  assert.equal(migrated.intervalDays, 7);
  assert.equal(migrated.completions, 5);
});
