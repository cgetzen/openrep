import test from 'node:test';
import assert from 'node:assert/strict';
import { MiniChess } from '../src/mini-chess.js';
import { explainWrongMove } from '../src/move-explanations.js';

test('1...b5 is explained with the concrete Bxb5 punishment', () => {
  const chess = new MiniChess();
  chess.moveUci('e2e4');
  const result = explainWrongMove(
    chess,
    'b7b5',
    'c7c6',
    '1...c6 prepares ...d5 while keeping the c-pawn available to reinforce or challenge the center.'
  );

  assert.equal(result.kind, 'hanging-piece');
  assert.equal(result.response, 'Bxb5');
  assert.deepEqual(result.arrow, { from: 'f1', to: 'b5' });
  assert.match(result.message, /Bxb5/);
  assert.match(result.message, /c6 prepares d5/);
  assert.doesNotMatch(result.message, /\.\.\.(?=[A-Za-z0-9])/);
});

test('a non-tactical deviation explains the repertoire choice without inventing a criticism', () => {
  const chess = new MiniChess();
  chess.moveUci('e2e4');
  const result = explainWrongMove(chess, 'g8f6', 'c7c6', 'c6 prepares ...d5.');

  assert.equal(result.kind, 'strategic');
  assert.equal(result.arrow, null);
  assert.match(result.message, /not the move this line teaches/);
  assert.match(result.message, /c6/);
  assert.match(result.message, /prepares d5/);
  assert.doesNotMatch(result.message, /\.\.\.(?=[A-Za-z0-9])/);
  assert.doesNotMatch(result.message, /inaccurate/i);
  assert.doesNotMatch(result.message, /misses the main point/i);
});
