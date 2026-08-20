import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePracticeSelection,
  pickPracticeLineIndex,
  pickSpacedLineIndex,
  pickWeakLineIndex
} from '../src/practice-selection.js';

const lines = [
  { id: 'a' },
  { id: 'b' },
  { id: 'c' },
  { id: 'd' },
  { id: 'e' }
];

test('practice selection defaults to spaced', () => {
  assert.equal(normalizePracticeSelection('spaced'), 'spaced');
  assert.equal(normalizePracticeSelection('weak'), 'weak');
  assert.equal(normalizePracticeSelection('time'), 'spaced');
});

test('spaced practice chooses the earliest due line and breaks ties by repetitions', () => {
  const progress = {
    lines: {
      a: { dueAt: 500, repetitions: 2 },
      b: { dueAt: 100, repetitions: 3 },
      c: { dueAt: 100, repetitions: 1 },
      d: { dueAt: 900, repetitions: 0 },
      e: { dueAt: 700, repetitions: 0 }
    }
  };

  assert.equal(pickSpacedLineIndex(lines, progress, 1000), 2);
  assert.equal(pickPracticeLineIndex(lines, progress, 'spaced', { now: 1000 }), 2);
});

test('weak practice samples only from the weakest four lines', () => {
  const progress = {
    lines: {
      a: { completions: 5, repetitions: 3, mistakes: 0 },
      b: { completions: 1, repetitions: 0, mistakes: 4 },
      c: { completions: 2, repetitions: 1, mistakes: 2 },
      d: { completions: 0, repetitions: 0, mistakes: 1 },
      e: { completions: 10, repetitions: 5, mistakes: 0 }
    }
  };

  assert.equal(pickWeakLineIndex(lines, progress, () => 0), 1);
  assert.notEqual(pickWeakLineIndex(lines, progress, () => 0.999999), 4);
  assert.equal(pickPracticeLineIndex(lines, progress, 'weak', { random: () => 0 }), 1);
});
