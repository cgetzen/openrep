import test from 'node:test';
import assert from 'node:assert/strict';
import { MiniChess } from '../src/mini-chess.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKannResponses } from '../src/openings/caro-kann-responses.js';
import { RepertoireMoveIndex } from '../src/repertoire-moves.js';

const course = { ...caroKann, responses: caroKannResponses };
const advance = course.lines.find(line => line.id === 'advance-main');

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

test('builds a legal new-response route with response and illustrative continuation metadata', () => {
  const index = new RepertoireMoveIndex(course);
  const route = index.opponentAlternatives(advance, 6).find(candidate => candidate.coverage === 'new-response');

  assert.equal(route.id, 'micro:advance-quiet-be2');
  assert.equal(route.responseId, 'advance-quiet-be2');
  assert.equal(route.moves[6], 'f1e2');
  assert.equal(route.moves[7], 'e7e6');
  assert.equal(route.responsePly, 7);
  assert.equal(route.responseLabel, '4...e6');
  assert.deepEqual(route.exampleLabels, ['5.Nf3', '5...c5']);
  assert.match(route.notes[7], /prepares the same central counterplay/i);
  assert.doesNotThrow(() => routeIsLegal(route));
});

test('Practice admits discovered covered lessons and explicitly learned new responses', () => {
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

test('classification can use the active new-response route expected move', () => {
  const index = new RepertoireMoveIndex(course);
  const route = index.opponentAlternatives(advance, 6).find(candidate => candidate.coverage === 'new-response');
  const chess = new MiniChess();
  for (const move of route.moves.slice(0, 7)) chess.moveUci(move);

  const result = index.classify(chess, advance, 7, 'e7e6', 'e7e6');
  assert.equal(result.kind, 'expected');
  assert.equal(result.expected, 'e7e6');
});

test('new responses follow the current path when an equivalent position is reached by transposition', () => {
  const transposedCourse = {
    id: 'transposed-deviation-course',
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
        anchor: { lineId: 'knight-first', ply: 4 },
        move: 'b2b3',
        response: 'e7e6',
        label: 'Quiet development',
        idea: 'Develop normally.'
      }
    ]
  };
  const index = new RepertoireMoveIndex(transposedCourse);
  const current = transposedCourse.lines[1];
  const route = index.opponentAlternatives(current, 4).find(candidate => candidate.responseId === 'quiet-b3');

  assert.ok(route);
  assert.deepEqual(route.moves.slice(0, 4), current.moves.slice(0, 4));
  assert.equal(route.divergencePly, 4);
  assert.doesNotThrow(() => routeIsLegal(route));
});
