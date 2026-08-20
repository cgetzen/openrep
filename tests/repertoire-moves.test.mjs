import test from 'node:test';
import assert from 'node:assert/strict';
import { MiniChess } from '../src/mini-chess.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { RepertoireMoveIndex, summarizeExactBranchMatches } from '../src/repertoire-moves.js';

function positionAfter(moves) {
  const chess = new MiniChess();
  for (const move of moves) chess.moveUci(move);
  return chess;
}

test('classifies the expected move separately', () => {
  const line = caroKann.lines.find(candidate => candidate.id === 'advance-main');
  const chess = positionAfter(line.moves.slice(0, 5));
  const index = new RepertoireMoveIndex(caroKann);

  const result = index.classify(chess, line, 5, 'c8f5');

  assert.equal(result.kind, 'expected');
  assert.equal(result.expected, 'c8f5');
  assert.deepEqual(result.exactPathMatches, []);
  assert.deepEqual(result.transpositionMatches, []);
});

test('recognizes 3...c5 as an exact-path move from another Caro-Kann branch', () => {
  const line = caroKann.lines.find(candidate => candidate.id === 'advance-main');
  const chess = positionAfter(line.moves.slice(0, 5));
  const index = new RepertoireMoveIndex(caroKann);

  const result = index.classify(chess, line, 5, 'c6c5');

  assert.equal(result.kind, 'repertoire-alternative');
  assert.equal(result.expected, 'c8f5');
  assert.deepEqual(result.alternatives.map(match => match.line.id), ['advance-early-c5']);
  assert.deepEqual(result.exactPathMatches.map(match => match.line.id), ['advance-early-c5']);
  assert.deepEqual(result.transpositionMatches, []);
});

test('keeps transposition matches valid without treating them as exact branch paths', () => {
  const course = {
    lines: [
      {
        id: 'knight-first',
        title: 'Knight first',
        moves: ['g1f3', 'd7d5', 'g2g3', 'g8f6']
      },
      {
        id: 'fianchetto-first',
        title: 'Fianchetto first',
        moves: ['g2g3', 'd7d5', 'g1f3', 'c7c5']
      }
    ]
  };
  const currentLine = course.lines[0];
  const chess = positionAfter(currentLine.moves.slice(0, 3));
  const index = new RepertoireMoveIndex(course);

  const result = index.classify(chess, currentLine, 3, 'c7c5');

  assert.equal(result.kind, 'repertoire-alternative');
  assert.deepEqual(result.alternatives.map(match => match.line.id), ['fianchetto-first']);
  assert.deepEqual(result.exactPathMatches, []);
  assert.deepEqual(result.transpositionMatches.map(match => match.line.id), ['fianchetto-first']);
});

test('preserves all exact branch matches and summarizes 2+ as first plus more', () => {
  const sharedPrefix = ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5'];
  const course = {
    lines: [
      {
        id: 'current',
        title: 'Current branch',
        moves: [...sharedPrefix, 'c8f5']
      },
      {
        id: 'early-c5-a',
        title: 'Immediate counterplay',
        moves: [...sharedPrefix, 'c6c5']
      },
      {
        id: 'early-c5-b',
        title: 'Sharp counterplay',
        moves: [...sharedPrefix, 'c6c5']
      }
    ]
  };
  const currentLine = course.lines[0];
  const chess = positionAfter(sharedPrefix);
  const index = new RepertoireMoveIndex(course);

  const result = index.classify(chess, currentLine, 5, 'c6c5');
  const summary = summarizeExactBranchMatches(result.exactPathMatches);

  assert.equal(result.kind, 'repertoire-alternative');
  assert.deepEqual(result.exactPathMatches.map(match => match.line.id), ['early-c5-a', 'early-c5-b']);
  assert.deepEqual(result.transpositionMatches, []);
  assert.equal(summary.primaryTitle, 'Immediate counterplay');
  assert.deepEqual(summary.moreTitles, ['Sharp counterplay']);
});

test('keeps genuinely off-repertoire moves on the coaching path', () => {
  const line = caroKann.lines.find(candidate => candidate.id === 'advance-main');
  const chess = positionAfter(line.moves.slice(0, 1));
  const index = new RepertoireMoveIndex(caroKann);

  const result = index.classify(chess, line, 1, 'b7b5');

  assert.equal(result.kind, 'out-of-repertoire');
  assert.equal(result.expected, 'c7c6');
  assert.deepEqual(result.alternatives, []);
  assert.deepEqual(result.exactPathMatches, []);
  assert.deepEqual(result.transpositionMatches, []);
});
