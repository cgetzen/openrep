import test from 'node:test';
import assert from 'node:assert/strict';
import { caroKann } from '../src/openings/caro-kann.js';
import { MiniChess } from '../src/mini-chess.js';

test('course has twelve unique practical branches', () => {
  assert.equal(caroKann.side, 'b');
  assert.equal(caroKann.lines.length, 12);
  assert.equal(new Set(caroKann.lines.map(line => line.id)).size, 12);
});

test('every course line is legal in the in-browser chess rules layer', () => {
  for (const line of caroKann.lines) {
    const chess = new MiniChess();
    line.moves.forEach((uci, index) => {
      assert.doesNotThrow(() => chess.moveUci(uci), `${line.id} illegal ply ${index + 1}: ${uci}`);
    });
  }
});

test('every line begins with the Caro-Kann and teaches Black moves', () => {
  for (const line of caroKann.lines) {
    assert.deepEqual(line.moves.slice(0, 2), ['e2e4', 'c7c6']);
    const blackMoves = line.moves.map((_, index) => index).filter(index => index % 2 === 1);
    const covered = blackMoves.filter(index => Boolean(line.notes[index])).length;
    assert.ok(covered / blackMoves.length >= 0.7, `${line.id} needs more explanations`);
  }
});

test('rules layer handles the castling positions used by the course', () => {
  const panov = caroKann.lines.find(line => line.id === 'panov-main');
  const chess = new MiniChess();
  for (const move of panov.moves) chess.moveUci(move);
  assert.equal(chess.get('g8')?.type, 'k');
  assert.equal(chess.get('f8')?.type, 'r');
  assert.equal(chess.get('e8'), null);
  assert.equal(chess.get('h8'), null);
});
