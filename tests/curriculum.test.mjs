import test from 'node:test';
import assert from 'node:assert/strict';

import { MiniChess } from '../src/mini-chess.js';
import { miniChessToFen } from '../src/position-fen.js';
import { normalizePositionKey, RepertoireMoveIndex } from '../src/repertoire-moves.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKannResponses } from '../src/openings/caro-kann-responses.js';
import {
  buildCaroKannCurriculumCourse,
  caroKannCurriculum,
  validateCaroKannCurriculum
} from '../src/openings/caro-kann-curriculum.js';

function buildCourse() {
  return buildCaroKannCurriculumCourse({
    ...caroKann,
    responses: caroKannResponses
  }, caroKannCurriculum);
}

function positionAfter(moves) {
  const chess = new MiniChess();
  for (const move of moves) chess.moveUci(move);
  return normalizePositionKey(miniChessToFen(chess));
}

test('curriculum classifies every stable line exactly once and starts with the primary Advance system', () => {
  const course = buildCourse();
  assert.equal(validateCaroKannCurriculum(course, caroKannCurriculum), true);
  assert.deepEqual(
    new Set(course.lines.map(line => line.id)),
    new Set(caroKann.lines.map(line => line.id))
  );
  assert.equal(course.lines.length, caroKann.lines.length);
  assert.equal(course.lines[0].id, 'advance-early-c5');
  assert.equal(course.lines[0].title, 'Advance — ...c5 main system');

  const assigned = caroKannCurriculum.families.flatMap(family => family.lineIds ?? []);
  assert.equal(assigned.length, caroKann.lines.length);
  assert.equal(new Set(assigned).size, caroKann.lines.length);
});

test('Core and Important tiers encode the intended practical coverage thresholds', () => {
  const advance = caroKannCurriculum.families.find(family => family.id === 'advance-c5');
  const exchange = caroKannCurriculum.families.find(family => family.id === 'exchange-family');
  const accelerated = caroKannCurriculum.families.find(family => family.id === 'accelerated-panov');

  assert.equal(advance.tier, 'core');
  assert.ok(advance.evidence.percent >= 95);
  assert.deepEqual(advance.responseIds, ['advance-c5-dxc5', 'advance-c5-nf3']);

  assert.equal(exchange.tier, 'core');
  assert.ok(exchange.evidence.percent >= 95);
  assert.deepEqual(exchange.lineIds, ['exchange-main', 'panov-main']);
  assert.ok(exchange.responseIds.includes('exchange-c3'));

  assert.equal(accelerated.tier, 'important');
  assert.deepEqual(accelerated.responseIds, ['accelerated-panov-c4']);
});

test('3.Nd2 response transposes into the existing Classical chess position', () => {
  const course = buildCourse();
  const index = new RepertoireMoveIndex(course);
  const classical = course.lines.find(line => line.id === 'classical-main');
  const route = index.newResponsesForLine(classical).find(candidate =>
    candidate.responseId === 'classical-nd2-transposition'
  );

  assert.ok(route, '3.Nd2 should be owned by the Classical lesson');
  assert.equal(route.opponentMove, 'b1d2');
  assert.equal(route.response, 'd5e4');
  assert.deepEqual(route.exampleMoves, ['d2e4']);

  const nd2Position = positionAfter(route.moves);
  const nc3ClassicalPosition = positionAfter(classical.moves.slice(0, 7));
  assert.equal(nd2Position, nc3ClassicalPosition);
});

test('primary 3...c5 lesson covers the two major non-canonical fourth moves as response lessons', () => {
  const course = buildCourse();
  const index = new RepertoireMoveIndex(course);
  const advance = course.lines.find(line => line.id === 'advance-early-c5');
  const routes = index.newResponsesForLine(advance);

  const dxc5 = routes.find(route => route.responseId === 'advance-c5-dxc5');
  const nf3 = routes.find(route => route.responseId === 'advance-c5-nf3');
  assert.ok(dxc5);
  assert.equal(dxc5.opponentMove, 'd4c5');
  assert.equal(dxc5.response, 'e7e6');
  assert.ok(nf3);
  assert.equal(nf3.opponentMove, 'g1f3');
  assert.equal(nf3.response, 'c5d4');
});

test('2.c4 is a directly teachable Important response from the primary path', () => {
  const course = buildCourse();
  const index = new RepertoireMoveIndex(course);
  const primary = course.lines.find(line => line.id === 'advance-early-c5');
  const route = index.newResponsesForLine(primary).find(candidate =>
    candidate.responseId === 'accelerated-panov-c4'
  );

  assert.ok(route);
  assert.equal(route.opponentMove, 'c2c4');
  assert.equal(route.response, 'd7d5');
  assert.match(route.idea, /Accelerated Panov|c4/i);
});
