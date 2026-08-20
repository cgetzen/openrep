import test from 'node:test';
import assert from 'node:assert/strict';
import { miniChessToFen } from '../src/position-fen.js';
import { parseUciScore, scoreToWhiteShare, formatEvaluation, formatCompactEvaluation } from '../src/evaluation.js';

function startChess() {
  const board = new Map();
  for (const file of 'abcdefgh') {
    board.set(`${file}2`, { color: 'w', type: 'p' });
    board.set(`${file}7`, { color: 'b', type: 'p' });
  }
  const back = ['r','n','b','q','k','b','n','r'];
  back.forEach((type, i) => {
    board.set(`${'abcdefgh'[i]}1`, { color: 'w', type });
    board.set(`${'abcdefgh'[i]}8`, { color: 'b', type });
  });
  return {
    board,
    currentTurn: 'w',
    castling: { w: { k: true, q: true }, b: { k: true, q: true } },
    history: [],
    get(square) { return this.board.get(square) ?? null; },
    turn() { return this.currentTurn; }
  };
}

test('serializes the starting position to FEN', () => {
  assert.equal(miniChessToFen(startChess()), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
});

test('includes side, en-passant target, and move number in FEN', () => {
  const chess = startChess();
  chess.board.delete('e2');
  chess.board.set('e4', { color: 'w', type: 'p' });
  chess.currentTurn = 'b';
  chess.history.push({ uci: 'e2e4', san: 'e4' });
  assert.equal(miniChessToFen(chess), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
});

test('normalizes centipawn scores to White perspective', () => {
  assert.deepEqual(parseUciScore('info depth 12 score cp 84 nodes 10', 'w'), { type: 'cp', value: 84 });
  assert.deepEqual(parseUciScore('info depth 12 score cp 84 nodes 10', 'b'), { type: 'cp', value: -84 });
});

test('normalizes mate scores to White perspective', () => {
  assert.deepEqual(parseUciScore('info depth 12 score mate -3 nodes 10', 'b'), { type: 'mate', value: 3 });
});

test('maps equal evaluation to an even bar', () => {
  assert.equal(scoreToWhiteShare({ type: 'cp', value: 0 }), 50);
});

test('maps advantages symmetrically and keeps the bar bounded', () => {
  const white = scoreToWhiteShare({ type: 'cp', value: 300 });
  const black = scoreToWhiteShare({ type: 'cp', value: -300 });
  assert.ok(white > 75 && white < 97);
  assert.ok(black > 3 && black < 25);
  assert.ok(Math.abs((white + black) - 100) < 0.001);
});

test('formats centipawn and mate evaluations for accessibility text', () => {
  assert.equal(formatEvaluation({ type: 'cp', value: -125 }), 'Black +1.25');
  assert.equal(formatEvaluation({ type: 'mate', value: 4 }), 'White mate in 4');
});

test('formats compact scores for the visible evaluation bar', () => {
  assert.equal(formatCompactEvaluation({ type: 'cp', value: 42 }), '+0.42');
  assert.equal(formatCompactEvaluation({ type: 'cp', value: -125 }), '-1.25');
  assert.equal(formatCompactEvaluation({ type: 'cp', value: 0 }), '0.00');
  assert.equal(formatCompactEvaluation({ type: 'mate', value: 3 }), 'M3');
  assert.equal(formatCompactEvaluation({ type: 'mate', value: -2 }), '-M2');
});
