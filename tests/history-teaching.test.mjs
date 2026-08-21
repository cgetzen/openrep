import test from 'node:test';
import assert from 'node:assert/strict';

import { reviewDecisionPly } from '../src/coaching-trainer.js';

test('history review shows the decision at a side-to-move position', () => {
  assert.deepEqual(
    reviewDecisionPly(5, 'b', 'b'),
    { decisionPly: 5, moveAlreadyPlayed: false }
  );
});

test('history review carries the same advice forward to the position after the repertoire move', () => {
  assert.deepEqual(
    reviewDecisionPly(6, 'w', 'b'),
    { decisionPly: 5, moveAlreadyPlayed: true }
  );
});

test('history review has no repertoire advice before the opponent has made the first move', () => {
  assert.equal(reviewDecisionPly(0, 'w', 'b'), null);
});

test('history review decision selection is side-agnostic', () => {
  assert.deepEqual(
    reviewDecisionPly(4, 'b', 'w'),
    { decisionPly: 3, moveAlreadyPlayed: true }
  );
});
