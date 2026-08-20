import { miniChessToFen } from './position-fen.js';
import { parseUciScore } from './evaluation.js';

export class StockfishEvaluator {
  constructor({ workerUrl = './vendor/stockfish/stockfish-18-lite-single.js', depth = 12, WorkerClass = globalThis.Worker } = {}) {
    this.workerUrl = workerUrl;
    this.depth = depth;
    this.WorkerClass = WorkerClass;
    this.worker = null;
    this.readyPromise = null;
    this.readyResolve = null;
    this.readyReject = null;
    this.active = null;
    this.pending = null;
    this.cache = new Map();
    this.failed = false;
  }

  async evaluate(chess) {
    const fen = miniChessToFen(chess);
    if (this.cache.has(fen)) return this.cache.get(fen);
    if (this.failed || !this.WorkerClass) return null;
    try {
      await this.ensureReady();
    } catch {
      return null;
    }
    return new Promise(resolve => this.queue({ fen, resolve }));
  }

  ensureReady() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
      try {
        this.worker = new this.WorkerClass(this.workerUrl);
        this.worker.addEventListener('message', event => this.onMessage(event.data));
        this.worker.addEventListener('error', error => this.fail(error));
        this.worker.postMessage('uci');
      } catch (error) {
        this.fail(error);
      }
    });
    return this.readyPromise;
  }

  onMessage(payload) {
    for (const raw of String(payload).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line === 'uciok') {
        this.worker?.postMessage('isready');
        continue;
      }
      if (line === 'readyok') {
        this.readyResolve?.();
        this.readyResolve = null;
        this.readyReject = null;
        continue;
      }
      if (line.startsWith('info ') && this.active) {
        const side = this.active.fen.split(' ')[1];
        const score = parseUciScore(line, side);
        if (score) this.active.score = score;
        continue;
      }
      if (line.startsWith('bestmove')) this.finishActive();
    }
  }

  queue(request) {
    if (this.pending) this.pending.resolve(null);
    this.pending = null;

    if (this.active) {
      if (!this.active.cancelled) {
        this.active.cancelled = true;
        this.active.resolve(null);
      }
      this.pending = request;
      this.worker?.postMessage('stop');
      return;
    }
    this.start(request);
  }

  start(request) {
    this.active = { ...request, score: null, cancelled: false };
    this.worker?.postMessage(`position fen ${request.fen}`);
    this.worker?.postMessage(`go depth ${this.depth}`);
  }

  finishActive() {
    const finished = this.active;
    this.active = null;
    if (finished && !finished.cancelled) {
      if (finished.score) this.cache.set(finished.fen, finished.score);
      finished.resolve(finished.score);
    }
    const next = this.pending;
    this.pending = null;
    if (next) this.start(next);
  }

  fail(error) {
    this.failed = true;
    this.readyReject?.(error);
    this.readyResolve = null;
    this.readyReject = null;
    if (this.active && !this.active.cancelled) this.active.resolve(null);
    if (this.pending) this.pending.resolve(null);
    this.active = null;
    this.pending = null;
  }

  destroy() {
    this.worker?.terminate?.();
    this.worker = null;
  }
}
