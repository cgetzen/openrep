import test from 'node:test';
import assert from 'node:assert/strict';

import { hasBlackMoveEllipsis, normalizeTeachingProse } from '../src/teaching-copy.js';
import { formatMoveTeachingFeedback, normalizeMoveTeachingFeedback } from '../src/practice-trainer.js';


test('teaching prose removes black-move ellipsis without changing normal prose', () => {
  assert.equal(
    normalizeTeachingProse('Play ...d5, then 4...Bf5. Keep developing.'),
    'Play d5, then Bf5. Keep developing.'
  );
  assert.equal(
    normalizeTeachingProse('Challenge d4 immediately with ...c5 and make White define the center.'),
    'Challenge d4 immediately with c5 and make White define the center.'
  );
  assert.equal(normalizeTeachingProse('A normal sentence.'), 'A normal sentence.');
  assert.equal(hasBlackMoveEllipsis('Play ...c5.'), true);
  assert.equal(hasBlackMoveEllipsis(normalizeTeachingProse('Play ...c5.')), false);
});


test('move feedback cannot reintroduce black-move ellipsis from authored notes', () => {
  assert.equal(
    formatMoveTeachingFeedback('c6', '1...c6 prepares ...d5 while keeping the c-pawn flexible.'),
    'c6 prepares d5 while keeping the c-pawn flexible.'
  );
  assert.equal(
    normalizeMoveTeachingFeedback('Bxf3 — 4...Bxf3 avoids losing time and prepares ...e6.'),
    'Bxf3 avoids losing time and prepares e6.'
  );
});
