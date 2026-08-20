import test from 'node:test';
import assert from 'node:assert/strict';
import { MiniChess } from '../src/mini-chess.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKannDeviations } from '../src/openings/caro-kann-deviations.js';
import { RepertoireMoveIndex } from '../src/repertoire-moves.js';

const course = { ...caroKann, deviations: caroKannDeviations };
const advance = course.lines.find(line => line.id === 'advance-main');

function routeIsLegal(route) {
  const chess = new MiniChess();
  for (const move of route.moves) chess.moveUci(move);
}

test('indexes known branch choices and curated micro-variations at the same position', () => {
  const index = new RepertoireMoveIndex(course);
  const options = index.opponentAlternatives(advance, 6);

  assert.deepEqual(
    options.map(route => [route.opponentLabel, route.kind, route.targetLineId]),
    [
      ['4.h4', 'branch', 'advance-tal'],
      ['4.Nc3', 'branch', 'advance-bayonet'],
      ['4.Be2', 'micro', null]
    ]
  );
});

test('builds a branch route by reusing the target repertoire continuation', () => {
  const index = new RepertoireMoveIndex(course);
  const route = index.opponentAlternatives(advance, 6).find(candidate => candidate.opponentMove === 'h2h4');

  assert.equal(route.kind, 'branch');
  assert.equal(route.targetLineId, 'advance-tal');
  assert.deepEqual(route.moves.slice(0, 10), [
    'e2e4','c7c6','d2d4','d7d5','e4e5','c8f5','h2h4','h7h5','f1d3','f5d3'
  ]);
  assert.doesNotThrow(() => routeIsLegal(route));
});

test('builds a legal micro-route with a curated response and teaching note', () => {
  const index = new RepertoireMoveIndex(course);
  const route = index.opponentAlternatives(advance, 6).find(candidate => candidate.kind === 'micro');

  assert.equal(route.id, 'micro:advance-quiet-be2');
  assert.equal(route.moves[6], 'f1e2');
  assert.equal(route.moves[7], 'e7e6');
  assert.match(route.notes[7], /prepares the same central counterplay/i);
  assert.doesNotThrow(() => routeIsLegal(route));
});

test('only learned deviations are eligible for surprise Practice routes', () => {
  const index = new RepertoireMoveIndex(course);
  const microId = 'micro:advance-quiet-be2';

  assert.deepEqual(index.learnedAlternativesForLine(advance, { discovered: [], learnedDeviations: [] }), []);

  const knownBranch = index.opponentAlternatives(advance, 6).find(route => route.targetLineId === 'advance-tal');
  assert.equal(index.isRouteLearned(knownBranch, { discovered: ['advance-tal'], learnedDeviations: [] }), true);
  assert.deepEqual(index.learnedAlternativesForLine(advance, {
    discovered: ['advance-tal'],
    learnedDeviations: []
  }), []);

  const picked = index.pickPracticeRoute(advance, {
    discovered: [],
    learnedDeviations: [microId]
  }, () => 0);
  assert.equal(picked.id, microId);
});

test('classification can use the active deviation route expected move', () => {
  const index = new RepertoireMoveIndex(course);
  const route = index.opponentAlternatives(advance, 6).find(candidate => candidate.kind === 'micro');
  const chess = new MiniChess();
  for (const move of route.moves.slice(0, 7)) chess.moveUci(move);

  const result = index.classify(chess, advance, 7, 'e7e6', 'e7e6');
  assert.equal(result.kind, 'expected');
  assert.equal(result.expected, 'e7e6');
});

test('micro-variations follow the current path when an equivalent position is reached by transposition', () => {
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
    deviations: [
      {
        id: 'quiet-b3',
        anchor: { lineId: 'knight-first', ply: 4 },
        move: 'b2b3',
        response: 'e7e6',
        title: 'Quiet b3',
        idea: 'Develop normally.'
      }
    ]
  };
  const index = new RepertoireMoveIndex(transposedCourse);
  const current = transposedCourse.lines[1];
  const route = index.opponentAlternatives(current, 4).find(candidate => candidate.id === 'micro:quiet-b3');

  assert.ok(route);
  assert.deepEqual(route.moves.slice(0, 4), current.moves.slice(0, 4));
  assert.equal(route.divergencePly, 4);
  assert.doesNotThrow(() => routeIsLegal(route));
});
