import test from 'node:test';
import assert from 'node:assert/strict';

import { AnalysisVariation } from '../src/automatic-spaced-trainer.js';
import { MiniChess } from '../src/mini-chess.js';

function chessAfter(...moves) {
  const chess = new MiniChess();
  for (const move of moves) chess.moveUci(move);
  return chess;
}

test('analysis variation keeps exploratory moves on the board and supports undo/redo', () => {
  const anchor = chessAfter('e2e4', 'c7c6');
  const variation = new AnalysisVariation({ anchorPly: 2, chess: anchor, maxPlies: 6 });

  variation.play('d2d3');
  variation.play('d7d5');
  assert.equal(variation.currentChess().get('d3')?.type, 'p');
  assert.equal(variation.currentChess().get('d5')?.type, 'p');
  assert.equal(variation.cursor, 2);

  assert.equal(variation.navigate(-1), true);
  assert.equal(variation.currentChess().get('d5'), null);
  assert.equal(variation.currentChess().get('d3')?.type, 'p');

  assert.equal(variation.navigate(1), true);
  assert.equal(variation.currentChess().get('d5')?.type, 'p');
});

test('playing after undo replaces the abandoned analysis continuation', () => {
  const variation = new AnalysisVariation({
    anchorPly: 2,
    chess: chessAfter('e2e4', 'c7c6'),
    maxPlies: 6
  });

  variation.play('d2d3');
  variation.play('d7d5');
  variation.navigate(-1);
  variation.play('g8f6');

  assert.deepEqual(variation.entries.map(entry => entry.uci), ['d2d3', 'g8f6']);
  assert.equal(variation.currentChess().get('f6')?.type, 'n');
  assert.equal(variation.currentChess().get('d5'), null);
});

test('analysis variation enforces the six-ply exploration boundary without touching its anchor', () => {
  const anchor = chessAfter('e2e4', 'c7c6');
  const variation = new AnalysisVariation({ anchorPly: 2, chess: anchor, maxPlies: 6 });
  const moves = ['d2d4', 'd7d5', 'b1c3', 'g8f6', 'c1f4', 'c8f5'];
  for (const move of moves) variation.play(move);

  assert.equal(variation.cursor, 6);
  assert.equal(variation.canPlay(), false);
  assert.throws(() => variation.play('g1f3'), /ply limit/);
  assert.equal(anchor.get('d2')?.type, 'p');
  assert.equal(anchor.get('d4'), null);
});
