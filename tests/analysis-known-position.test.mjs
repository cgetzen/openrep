import test from 'node:test';
import assert from 'node:assert/strict';

import { AutomaticSpacedTrainerApp } from '../src/automatic-spaced-trainer.js';
import { MiniChess } from '../src/mini-chess.js';
import { MoveTheoryIndex } from '../src/move-theory.js';
import { RepertoireMoveIndex } from '../src/repertoire-moves.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKannResponses } from '../src/openings/caro-kann-responses.js';
import { caroKannMoveTheory, caroKannLessonDecisions } from '../src/openings/caro-kann-theory.js';
import {
  applyGeneratedLessonAlternatives,
  caroKannGeneratedMoveTheory
} from '../src/openings/caro-kann-generated-theory.js';

function generatedCourse() {
  return {
    ...caroKann,
    responses: caroKannResponses,
    moveTheory: [...caroKannMoveTheory, ...caroKannGeneratedMoveTheory],
    lessonDecisions: applyGeneratedLessonAlternatives(caroKannLessonDecisions)
  };
}

function chessAfter(...moves) {
  const chess = new MiniChess();
  for (const move of moves) chess.moveUci(move);
  return chess;
}

test('analysis recognizes a position by canonical chess state rather than navigation path', () => {
  const course = generatedCourse();
  const app = Object.create(AutomaticSpacedTrainerApp.prototype);
  Object.assign(app, {
    course,
    repertoire: new RepertoireMoveIndex(course),
    moveTheory: new MoveTheoryIndex(course)
  });

  const reachedThroughAnalysis = chessAfter('e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5');
  const known = app.analysisKnownPosition(reachedThroughAnalysis);

  assert.ok(known);
  assert.ok(known.lines.length > 0);
  assert.ok(known.lines.some(line => /Advance/i.test(line.title)));
});

test('analysis leaves unshipped positions as engine-only exploration', () => {
  const course = generatedCourse();
  const app = Object.create(AutomaticSpacedTrainerApp.prototype);
  Object.assign(app, {
    course,
    repertoire: new RepertoireMoveIndex(course),
    moveTheory: new MoveTheoryIndex(course)
  });

  const unknown = chessAfter('a2a3');
  assert.equal(app.analysisKnownPosition(unknown), null);
});
