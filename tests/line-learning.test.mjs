import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isLineMastered,
  lineLearningStatus,
  lineWeaknessProfile,
  recentLineAttempts,
  recordLineAttempt
} from '../src/progress.js';

test('line attempts keep only the latest five completed runs', () => {
  let progress = {};
  for (const mistakes of [1, 0, 2, 0, 0, 0]) {
    progress = recordLineAttempt(progress, mistakes);
  }

  assert.deepEqual(recentLineAttempts(progress), [0, 2, 0, 0, 0]);
});

test('mistake severity is capped at three per attempt', () => {
  const progress = recordLineAttempt({}, 12);
  assert.deepEqual(progress.recentAttempts, [3]);
  assert.deepEqual(lineWeaknessProfile(progress), { tier: 0, severity: 3, attempts: 1 });
});

test('mastery requires exactly five recent clean attempts', () => {
  assert.equal(isLineMastered({ recentAttempts: [0, 0, 0, 0] }), false);
  assert.equal(isLineMastered({ recentAttempts: [0, 0, 0, 0, 0] }), true);
  assert.equal(isLineMastered({ recentAttempts: [0, 0, 1, 0, 0] }), false);
});

test('a failure drops mastery until it rolls out after five later clean attempts', () => {
  let progress = { recentAttempts: [0, 0, 0, 0, 0] };
  progress = recordLineAttempt(progress, 1);
  assert.equal(isLineMastered(progress), false);

  for (let index = 0; index < 5; index += 1) {
    progress = recordLineAttempt(progress, 0);
  }
  assert.equal(isLineMastered(progress), true);
});

test('undiscovered lines remain New even with clean practice history', () => {
  const mastered = { recentAttempts: [0, 0, 0, 0, 0] };
  assert.equal(lineLearningStatus(mastered, false), 'New');
  assert.equal(lineLearningStatus(mastered, true), 'Mastered');
  assert.equal(lineLearningStatus({ recentAttempts: [0, 0] }, true), 'Learning');
});

test('weakness tiers failures before undertrained clean lines before mastered lines', () => {
  assert.deepEqual(
    lineWeaknessProfile({ recentAttempts: [2, 0, 1, 0, 0] }),
    { tier: 0, severity: 3, attempts: 5 }
  );
  assert.deepEqual(
    lineWeaknessProfile({ recentAttempts: [0, 0] }),
    { tier: 1, severity: 0, attempts: 2 }
  );
  assert.deepEqual(
    lineWeaknessProfile({ recentAttempts: [0, 0, 0, 0, 0] }),
    { tier: 2, severity: 0, attempts: 5 }
  );
});
