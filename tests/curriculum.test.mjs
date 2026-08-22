import test from 'node:test';
import assert from 'node:assert/strict';

import { MiniChess } from '../src/mini-chess.js';
import { miniChessToFen } from '../src/position-fen.js';
import {
  buildCurriculumCourse,
  curriculumConceptsForMember,
  curriculumLineOrder,
  curriculumTeachingUnitPresentation,
  validateCurriculum
} from '../src/curriculum.js';
import { normalizePositionKey, RepertoireMoveIndex } from '../src/repertoire-moves.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKannResponses } from '../src/openings/caro-kann-responses.js';
import { caroKannCurriculum } from '../src/openings/caro-kann-curriculum.js';

function buildCourse() {
  return buildCurriculumCourse({
    ...caroKann,
    responses: caroKannResponses
  }, caroKannCurriculum);
}

function positionAfter(moves) {
  const chess = new MiniChess();
  for (const move of moves) chess.moveUci(move);
  return normalizePositionKey(miniChessToFen(chess));
}

test('curriculum classifies every stable line exactly once while keeping stored line identity/order unchanged', () => {
  const course = buildCourse();
  assert.equal(validateCurriculum(course, caroKannCurriculum), true);
  assert.deepEqual(
    course.lines.map(line => line.id),
    caroKann.lines.map(line => line.id)
  );
  assert.equal(course.lines.length, caroKann.lines.length);

  const recommendedOrder = curriculumLineOrder(course.lines, caroKannCurriculum);
  assert.equal(recommendedOrder[0].id, 'advance-early-c5');

  const assigned = caroKannCurriculum.families.flatMap(family => family.lineIds ?? []);
  assert.equal(assigned.length, caroKann.lines.length);
  assert.equal(new Set(assigned).size, caroKann.lines.length);
});

test('primary families are exclusive while concepts can overlap across teaching dimensions', () => {
  const course = buildCourse();
  assert.equal(validateCurriculum(course, caroKannCurriculum), true);

  const earlyNf3Concepts = curriculumConceptsForMember(caroKannCurriculum, 'line', 'early-nf3').map(concept => concept.id);
  assert.deepEqual(earlyNf3Concepts.sort(), ['exchange-structures', 'transposition-recognition']);

  const acceleratedConcepts = curriculumConceptsForMember(caroKannCurriculum, 'line', 'accelerated-panov').map(concept => concept.id);
  assert.deepEqual(acceleratedConcepts.sort(), ['central-counterplay', 'exchange-structures']);
});

test('response teaching-unit presentation is canonical and independent of its owner line route', () => {
  const nd2 = curriculumTeachingUnitPresentation(
    caroKannCurriculum,
    'response',
    'classical-nd2-transposition',
    '3.Nd2 transposition'
  );
  assert.equal(nd2.title, '3.Nd2 transposition');
  assert.equal(nd2.familyId, 'classical');
  assert.equal(nd2.standaloneResponseFamily, false);
});

test('generic curriculum validation is not tied to a Caro-Kann course', () => {
  const course = {
    id: 'sample-course',
    lines: [{ id: 'line-a' }, { id: 'line-b' }],
    responses: [{ id: 'response-a' }]
  };
  const curriculum = {
    schemaVersion: 1,
    courseId: 'sample-course',
    tiers: [{ id: 'primary', label: 'Primary' }],
    families: [
      { id: 'family-a', tier: 'primary', title: 'A', lineIds: ['line-a'], responseIds: ['response-a'] },
      { id: 'family-b', tier: 'primary', title: 'B', lineIds: ['line-b'], responseIds: [] }
    ],
    concepts: [
      { id: 'shared-pattern', title: 'Shared pattern', lineIds: ['line-a', 'line-b'], responseIds: ['response-a'] }
    ]
  };

  assert.equal(validateCurriculum(course, curriculum), true);
  assert.deepEqual(curriculumLineOrder(course.lines, curriculum).map(line => line.id), ['line-a', 'line-b']);
  assert.deepEqual(curriculumConceptsForMember(curriculum, 'line', 'line-b').map(concept => concept.id), ['shared-pattern']);
});

test('generic curriculum validation rejects duplicate primary ownership but permits concept overlap', () => {
  const course = {
    id: 'sample-course',
    lines: [{ id: 'line-a' }],
    responses: []
  };
  const curriculum = {
    schemaVersion: 1,
    courseId: 'sample-course',
    tiers: [{ id: 'primary', label: 'Primary' }],
    families: [
      { id: 'family-a', tier: 'primary', title: 'A', lineIds: ['line-a'] },
      { id: 'family-b', tier: 'primary', title: 'B', lineIds: ['line-a'] }
    ],
    concepts: [
      { id: 'concept-a', title: 'A concept', lineIds: ['line-a'] },
      { id: 'concept-b', title: 'Another concept', lineIds: ['line-a'] }
    ]
  };

  assert.throws(() => validateCurriculum(course, curriculum), /assigned to both family-a and family-b/);
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
  assert.deepEqual(accelerated.lineIds, ['accelerated-panov']);
  assert.deepEqual(accelerated.responseIds, []);
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

test('2.c4 is a full Important branch with multiple repertoire decisions', () => {
  const course = buildCourse();
  const index = new RepertoireMoveIndex(course);
  const accelerated = course.lines.find(line => line.id === 'accelerated-panov');
  assert.ok(accelerated);
  assert.deepEqual(accelerated.moves, [
    'e2e4','c7c6','c2c4','d7d5','e4d5','c6d5','c4d5','g8f6',
    'b1c3','f6d5','g1f3','d5c3','d2c3','d8d1','e1d1','b8c6'
  ]);

  const primary = course.lines.find(line => line.id === 'advance-early-c5');
  const c4 = index.opponentAlternatives(primary, 2).find(candidate => candidate.opponentMove === 'c2c4');
  assert.ok(c4);
  assert.equal(c4.kind, 'branch');
  assert.equal(c4.coverage, 'covered-elsewhere');
  assert.equal(c4.targetLineId, 'accelerated-panov');
  assert.equal(index.responseById.has('accelerated-panov-c4'), false);
});

test('5.Bd3 is a full On demand Burris line rather than a standalone response', () => {
  const course = buildCourse();
  const index = new RepertoireMoveIndex(course);
  const burris = course.lines.find(line => line.id === 'classical-burris');
  assert.ok(burris);
  assert.deepEqual(burris.moves, [
    'e2e4','c7c6','d2d4','d7d5','b1c3','d5e4','c3e4','c8f5',
    'f1d3','d8d4','g1f3','d4d8','d1e2','e7e6','e1g1','f5e4',
    'd3e4','g8f6','c1f4','b8d7','f1d1','d8b6'
  ]);

  const family = caroKannCurriculum.families.find(candidate => candidate.id === 'classical-burris');
  assert.ok(family);
  assert.equal(family.tier, 'on-demand');
  assert.deepEqual(family.lineIds, ['classical-burris']);
  assert.deepEqual(family.responseIds, []);

  const classical = course.lines.find(line => line.id === 'classical-main');
  const bd3 = index.opponentAlternatives(classical, 8).find(candidate => candidate.opponentMove === 'f1d3');
  assert.ok(bd3);
  assert.equal(bd3.kind, 'branch');
  assert.equal(bd3.coverage, 'covered-elsewhere');
  assert.equal(bd3.targetLineId, 'classical-burris');
  assert.equal(index.responseById.has('classical-bd3'), false);
});
