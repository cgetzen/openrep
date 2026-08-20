import test from 'node:test';
import assert from 'node:assert/strict';
import { MiniChess } from '../src/mini-chess.js';
import { StockfishEvaluator } from '../src/stockfish-evaluator.js';

class FakeWorker {
  static instance = null;

  constructor() {
    this.messages = [];
    this.listeners = { message: [], error: [] };
    FakeWorker.instance = this;
  }

  addEventListener(type, listener) {
    this.listeners[type].push(listener);
  }

  postMessage(message) {
    this.messages.push(message);
  }

  emitMessage(data) {
    for (const listener of this.listeners.message) listener({ data });
  }

  terminate() {}
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

test('evaluates the best position score and attempted move in one compound request', async () => {
  const evaluator = new StockfishEvaluator({ depth: 8, WorkerClass: FakeWorker });
  const chess = new MiniChess();
  const resultPromise = evaluator.evaluateMove(chess, 'e2e4');
  const worker = FakeWorker.instance;

  assert.ok(worker);
  assert.deepEqual(worker.messages, ['uci']);
  worker.emitMessage('uciok');
  assert.deepEqual(worker.messages, ['uci', 'isready']);
  worker.emitMessage('readyok');
  await flush();

  assert.equal(worker.messages.at(-2).startsWith('position fen '), true);
  assert.equal(worker.messages.at(-1), 'go depth 8');

  worker.emitMessage('info depth 8 score cp 42 nodes 10');
  worker.emitMessage('bestmove d2d4');
  assert.equal(worker.messages.at(-2).startsWith('position fen '), true);
  assert.equal(worker.messages.at(-1), 'go depth 8 searchmoves e2e4');

  worker.emitMessage('info depth 8 score cp -83 nodes 10');
  worker.emitMessage('bestmove e2e4');

  assert.deepEqual(await resultPromise, {
    before: { type: 'cp', value: 42 },
    move: { type: 'cp', value: -83 }
  });
});

test('reuses a cached baseline when grading another move from the same position', async () => {
  const evaluator = new StockfishEvaluator({ depth: 6, WorkerClass: FakeWorker });
  const chess = new MiniChess();
  evaluator.cache.set('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { type: 'cp', value: 30 });

  const resultPromise = evaluator.evaluateMove(chess, 'd2d4');
  const worker = FakeWorker.instance;
  worker.emitMessage('uciok');
  worker.emitMessage('readyok');
  await flush();

  assert.equal(worker.messages.at(-1), 'go depth 6 searchmoves d2d4');
  worker.emitMessage('info depth 6 score cp 12 nodes 10');
  worker.emitMessage('bestmove d2d4');

  assert.deepEqual(await resultPromise, {
    before: { type: 'cp', value: 30 },
    move: { type: 'cp', value: 12 }
  });
});
