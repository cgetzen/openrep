import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePracticeSelection,
  pickPracticeLineIndex,
  pickSpacedLineIndex,
  pickWeakLineIndex,
  practiceRoutePresentation
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

test('practice presentation follows the active covered branch instead of the scheduled source line', () => {
  const sourceLine = {
    title: 'Hillbilly Attack',
    variation: '1.e4 c6 2.Bc4 d5'
  };
  const route = {
    kind: 'branch',
    label: '2.Nf3 — Flexible response',
    divergencePly: 2,
    moves: ['e2e4', 'c7c6', 'g1f3', 'd7d5', 'e4d5', 'c6d5']
  };

  assert.deepEqual(practiceRoutePresentation(sourceLine, route), {
    title: '2.Nf3 — Flexible response',
    variation: '1.e4 c6 2.Nf3 d5'
  });
});

test('practice presentation names learned standalone responses and shows the route through the response', () => {
  const sourceLine = {
    title: 'Advance — h4 / Tal ideas',
    variation: '1.e4 c6 2.d4 d5 3.e5 Bf5 4.h4 h5'
  };
  const route = {
    kind: 'response',
    teachingOwnerTitle: 'Advance — Main setup',
    responseTopicLabel: 'Quiet development',
    divergencePly: 6,
    moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'c8f5', 'f1e2', 'e7e6']
  };

  assert.deepEqual(practiceRoutePresentation(sourceLine, route), {
    title: 'Advance — Main setup — Quiet development',
    variation: '1.e4 c6 2.d4 d5 3.e5 Bf5 4.Be2 e6'
  });
});

test('spaced practice chooses the earliest due line and breaks ties by repetitions', () => {
  const progress = {
    lines: {
      a: { dueAt: 500, repetitions: 2 },
      b: { dueAt: 100, repetitions: 3 },
      c: { dueAt: 100, repetitions: 1 },
      d: { dueAt: 1900, repetitions: 0 },
      e: { dueAt: 1700, repetitions: 0 }
    }
  };

  assert.equal(pickSpacedLineIndex(lines, progress, 1000), 2);
  assert.equal(pickPracticeLineIndex(lines, progress, 'spaced', { now: 1000 }), 2);
});

test('spaced practice returns no item when every scheduled review is in the future', () => {
  const progress = {
    lines: Object.fromEntries(lines.map((line, index) => [
      line.id,
      { dueAt: 2000 + index, repetitions: index }
    ]))
  };

  assert.equal(pickSpacedLineIndex(lines, progress, 1000), null);
  assert.equal(pickPracticeLineIndex(lines, progress, 'spaced', { now: 1000 }), null);
});

test('unseen lines remain immediately due in spaced practice', () => {
  const progress = {
    lines: {
      a: { dueAt: 2000, repetitions: 1 }
    }
  };

  assert.equal(pickSpacedLineIndex(lines, progress, 1000), 1);
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
