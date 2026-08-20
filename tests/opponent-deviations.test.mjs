import test from 'node:test';
import assert from 'node:assert/strict';
import { MiniChess } from '../src/mini-chess.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKannResponses } from '../src/openings/caro-kann-responses.js';
import {
  RepertoireMoveIndex,
  normalizePositionKey,
  responseIdentityKey
} from '../src/repertoire-moves.js';

const course = { ...caroKann, responses: caroKannResponses };
const advance = course.lines.find(line => line.id === 'advance-main');
const advanceTal = course.lines.find(line => line.id === 'advance-tal');

function routeIsLegal(route) {
  const chess = new MiniChess();
  for (const move of route.moves) chess.moveUci(move);
}

test('classifies new responses separately from moves covered in other lessons', () => {
  const index = new RepertoireMoveIndex(course);
  const options = index.opponentAlternatives(advance, 6);

  assert.deepEqual(
    options.map(route => [route.opponentLabel, route.coverage, route.targetLineId]),
    [
      ['4.Be2', 'new-response', null],
      ['4.h4', 'covered-elsewhere', 'advance-tal'],
      ['4.Nc3', 'covered-elsewhere', 'advance-bayonet']
    ]
  );
});

test('response identity is position plus opponent move, independent of teaching owner or anchor', () => {
  const index = new RepertoireMoveIndex(course);
  const ownerRoute = index.opponentAlternatives(advance, 6)
    .find(candidate => candidate.responseId === 'advance-quiet-be2');
  const equivalentRoute = index.opponentAlternatives(advanceTal, 6)
    .find(candidate => candidate.responseId === 'advance-quiet-be2');
  const position = ownerRoute.responseKey.split('::')[0];

  assert.ok(ownerRoute.responseKey);
  assert.equal(ownerRoute.responseKey, equivalentRoute.responseKey);
  assert.equal(ownerRoute.responseKey, responseIdentityKey(position, 'f1e2'));
  assert.equal(ownerRoute.teachingOwnerLineId, 'advance-main');
  assert.equal(ownerRoute.source, 'curated');
  assert.equal(index.responseAt(position, 'f1e2')?.id, 'advance-quiet-be2');
  assert.equal(
    normalizePositionKey(`${position} 12 34`),
    position
  );
});

test('accepted future discovery candidates can enter the same registry by positionKey without an authoring anchor', () => {
  const baseCourse = {
    id: 'position-key-source-course',
    side: 'b',
    lines: [
      {
        id: 'owner',
        title: 'Owner',
        summary: 'Owner line.',
        moves: ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'f1g2', 'e7e6'],
        notes: {}
      }
    ]
  };
  const baseIndex = new RepertoireMoveIndex(baseCourse);
  const positionKey = baseIndex.positionForLine('owner', 4);
  const discoveredCourse = {
    ...baseCourse,
    responses: [
      {
        id: 'opening-db-b3',
        source: 'opening-db',
        positionKey,
        teachingOwnerLineId: 'owner',
        move: 'b2b3',
        response: 'e7e6',
        label: 'Quiet b3',
        idea: 'Develop normally.'
      }
    ]
  };

  const index = new RepertoireMoveIndex(discoveredCourse);
  const route = index.opponentAlternatives(discoveredCourse.lines[0], 4)
    .find(candidate => candidate.responseId === 'opening-db-b3');

  assert.ok(route);
  assert.equal(route.coverage, 'new-response');
  assert.equal(route.source, 'opening-db');
  assert.equal(route.responseKey, responseIdentityKey(positionKey, 'b2b3'));
  assert.equal(index.responseAt(positionKey, 'b2b3')?.authoringAnchor, null);
});

test('builds a covered route by reusing the target repertoire continuation', () => {
  const index = new RepertoireMoveIndex(course);
  const route = index.opponentAlternatives(advance, 6).find(candidate => candidate.opponentMove === 'h2h4');

  assert.equal(route.kind, 'branch');
  assert.equal(route.coverage, 'covered-elsewhere');
  assert.equal(route.targetLineId, 'advance-tal');
  assert.deepEqual(route.moves.slice(0, 10), [
    'e2e4','c7c6','d2d4','d7d5','e4e5','c8f5','h2h4','h7h5','f1d3','f5d3'
  ]);
  assert.doesNotThrow(() => routeIsLegal(route));
});

test('builds a legal response route with response and illustrative continuation metadata', () => {
  const index = new RepertoireMoveIndex(course);
  const route = index.opponentAlternatives(advance, 6).find(candidate => candidate.coverage === 'new-response');

  assert.equal(route.id, 'response:advance-quiet-be2');
  assert.equal(route.kind, 'response');
  assert.equal(route.responseId, 'advance-quiet-be2');
  assert.equal(route.moves[6], 'f1e2');
  assert.equal(route.moves[7], 'e7e6');
  assert.equal(route.responsePly, 7);
  assert.equal(route.responseLabel, '4...e6');
  assert.deepEqual(route.exampleLabels, ['5.Nf3', '5...c5']);
  assert.match(route.notes[7], /prepares the same central counterplay/i);
  assert.doesNotThrow(() => routeIsLegal(route));
});

test('a response is new only in its teaching owner and covered elsewhere in equivalent lessons', () => {
  const index = new RepertoireMoveIndex(course);
  const ownerRoute = index.opponentAlternatives(advance, 6)
    .find(route => route.responseId === 'advance-quiet-be2');
  const otherRoute = index.opponentAlternatives(advanceTal, 6)
    .find(route => route.responseId === 'advance-quiet-be2');

  assert.equal(ownerRoute.coverage, 'new-response');
  assert.equal(ownerRoute.teachingOwnerLineId, 'advance-main');
  assert.equal(ownerRoute.targetLineId, null);

  assert.equal(otherRoute.kind, 'response');
  assert.equal(otherRoute.coverage, 'covered-elsewhere');
  assert.equal(otherRoute.teachingOwnerLineId, 'advance-main');
  assert.equal(otherRoute.targetLineId, 'advance-main');
  assert.equal(otherRoute.label, 'Advance — Main setup');

  assert.deepEqual(
    index.newResponsesForLine(advanceTal).map(route => route.responseId),
    []
  );
});

test('Practice admits discovered covered lessons and learned responses from any equivalent lesson', () => {
  const index = new RepertoireMoveIndex(course);
  const options = index.opponentAlternatives(advance, 6);
  const be2 = options.find(route => route.responseId === 'advance-quiet-be2');
  const tal = options.find(route => route.targetLineId === 'advance-tal');

  assert.equal(index.isResponseLearned(be2, { learnedResponses: [] }), false);
  assert.equal(index.isCoveredLessonDiscovered(tal, { discovered: [] }), false);
  assert.deepEqual(index.practiceAlternativesForLine(advance, {
    discovered: [],
    learnedResponses: []
  }), []);

  const coveredReady = index.practiceAlternativesForLine(advance, {
    discovered: ['advance-tal'],
    learnedResponses: []
  });
  assert.deepEqual(coveredReady.map(route => route.targetLineId), ['advance-tal']);

  const responseReady = index.practiceAlternativesForLine(advance, {
    discovered: [],
    learnedResponses: ['advance-quiet-be2']
  });
  assert.deepEqual(responseReady.map(route => route.responseId), ['advance-quiet-be2']);

  const equivalentReady = index.practiceAlternativesForLine(advanceTal, {
    discovered: [],
    learnedResponses: ['advance-quiet-be2']
  });
  assert.equal(equivalentReady.some(route => route.responseId === 'advance-quiet-be2'), true);

  const picked = index.pickPracticeRoute(advance, {
    discovered: [],
    learnedResponses: ['advance-quiet-be2']
  }, () => 0);
  assert.equal(picked.responseId, 'advance-quiet-be2');
});

test('newResponsesForLine excludes full branches that are already taught elsewhere', () => {
  const index = new RepertoireMoveIndex(course);
  const responses = index.newResponsesForLine(advance);

  assert.deepEqual(responses.map(route => route.responseId), ['advance-quiet-be2']);
  assert.equal(responses.some(route => route.targetLineId), false);
});

test('classification can use the active response route expected move', () => {
  const index = new RepertoireMoveIndex(course);
  const route = index.opponentAlternatives(advance, 6).find(candidate => candidate.kind === 'response');
  const chess = new MiniChess();
  for (const move of route.moves.slice(0, 7)) chess.moveUci(move);

  const result = index.classify(chess, advance, 7, 'e7e6', 'e7e6');
  assert.equal(result.kind, 'expected');
  assert.equal(result.expected, 'e7e6');
});

test('duplicate response definitions for the same position and opponent move fail fast across transpositions', () => {
  const duplicateCourse = {
    id: 'duplicate-response-course',
    side: 'b',
    lines: [
      {
        id: 'knight-first',
        title: 'Knight first',
        moves: ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'f1g2', 'e7e6'],
        notes: {}
      },
      {
        id: 'fianchetto-first',
        title: 'Fianchetto first',
        moves: ['g2g3', 'd7d5', 'g1f3', 'g8f6', 'f1g2', 'e7e6'],
        notes: {}
      }
    ],
    responses: [
      {
        id: 'quiet-b3-a',
        source: 'curated',
        anchor: { lineId: 'knight-first', ply: 4 },
        teachingOwnerLineId: 'knight-first',
        move: 'b2b3',
        response: 'e7e6'
      },
      {
        id: 'quiet-b3-b',
        source: 'curated',
        anchor: { lineId: 'fianchetto-first', ply: 4 },
        teachingOwnerLineId: 'knight-first',
        move: 'b2b3',
        response: 'e7e6'
      }
    ]
  };

  assert.throws(
    () => new RepertoireMoveIndex(duplicateCourse),
    /Duplicate response identity/
  );
});

test('standalone response content cannot duplicate a move already covered by a full repertoire lesson', () => {
  const duplicateCoverageCourse = {
    id: 'duplicate-coverage-course',
    side: 'b',
    lines: [
      {
        id: 'main',
        title: 'Main',
        moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'g1f3', 'g8f6'],
        notes: {}
      },
      {
        id: 'alternative',
        title: 'Alternative',
        moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'f1e2', 'g8f6'],
        notes: {}
      }
    ],
    responses: [
      {
        id: 'already-covered-be2',
        source: 'curated',
        anchor: { lineId: 'main', ply: 4 },
        teachingOwnerLineId: 'main',
        move: 'f1e2',
        response: 'g8f6'
      }
    ]
  };

  assert.throws(
    () => new RepertoireMoveIndex(duplicateCoverageCourse),
    /duplicates full repertoire coverage/
  );
});

test('teaching owner must reach the canonical response position', () => {
  const invalidOwnerCourse = {
    id: 'invalid-owner-course',
    side: 'b',
    lines: [
      {
        id: 'owner',
        title: 'Owner',
        moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'g1f3', 'g8f6'],
        notes: {}
      },
      {
        id: 'anchor',
        title: 'Anchor',
        moves: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'g1f3', 'g8f6'],
        notes: {}
      }
    ],
    responses: [
      {
        id: 'quiet-nc3',
        source: 'curated',
        anchor: { lineId: 'anchor', ply: 4 },
        teachingOwnerLineId: 'owner',
        move: 'b1c3',
        response: 'g8f6'
      }
    ]
  };

  assert.throws(
    () => new RepertoireMoveIndex(invalidOwnerCourse),
    /does not reach the response position/
  );
});

test('responses follow the current path when an equivalent position is reached by transposition', () => {
  const transposedCourse = {
    id: 'transposed-response-course',
    side: 'b',
    lines: [
      {
        id: 'knight-first',
        title: 'Knight first',
        summary: 'Same destination.',
        moves: ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'f1g2', 'e7e6'],
        notes: {}
      },
      {
        id: 'fianchetto-first',
        title: 'Fianchetto first',
        summary: 'Same destination.',
        moves: ['g2g3', 'd7d5', 'g1f3', 'g8f6', 'f1g2', 'e7e6'],
        notes: {}
      }
    ],
    responses: [
      {
        id: 'quiet-b3',
        source: 'curated',
        anchor: { lineId: 'knight-first', ply: 4 },
        teachingOwnerLineId: 'knight-first',
        move: 'b2b3',
        response: 'e7e6',
        label: 'Quiet development',
        idea: 'Develop normally.'
      }
    ]
  };
  const index = new RepertoireMoveIndex(transposedCourse);
  const owner = transposedCourse.lines[0];
  const current = transposedCourse.lines[1];
  const ownerRoute = index.opponentAlternatives(owner, 4).find(candidate => candidate.responseId === 'quiet-b3');
  const route = index.opponentAlternatives(current, 4).find(candidate => candidate.responseId === 'quiet-b3');

  assert.ok(ownerRoute);
  assert.equal(ownerRoute.coverage, 'new-response');
  assert.ok(route);
  assert.equal(route.coverage, 'covered-elsewhere');
  assert.equal(route.targetLineId, 'knight-first');
  assert.deepEqual(route.moves.slice(0, 4), current.moves.slice(0, 4));
  assert.equal(route.divergencePly, 4);
  assert.doesNotThrow(() => routeIsLegal(route));
});
