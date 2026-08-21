import test from 'node:test';
import assert from 'node:assert/strict';

import { AutomaticSpacedTrainerApp } from '../src/automatic-spaced-trainer.js';
import { CoachingTrainerApp } from '../src/coaching-trainer.js?v=history-advice-v2';
import { MiniChess } from '../src/mini-chess.js';
import { RepertoireMoveIndex } from '../src/repertoire-moves.js';
import { caroKann } from '../src/openings/caro-kann.js';

class FakeFeedback {
  constructor() {
    this.hidden = false;
    this.className = 'feedback';
    this._body = '';
    this._prefixes = [];
    this.attributes = {};
  }

  set textContent(value) {
    this._body = String(value ?? '');
    this._prefixes = [];
  }

  get textContent() {
    return `${this._prefixes.join('')}${this._body}`;
  }

  prepend(node) {
    this._prefixes.unshift(String(node?.textContent ?? ''));
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

function chessAt(moves, ply) {
  const chess = new MiniChess();
  for (const move of moves.slice(0, ply)) chess.moveUci(move);
  return chess;
}

function evaluator() {
  return {
    evaluateMove() {
      return Promise.resolve({
        before: { type: 'cp', value: -50 },
        move: { type: 'cp', value: 75 }
      });
    }
  };
}

function boardStub() {
  return {
    clearSelection() {},
    setExplanationArrow() {}
  };
}

function liveAttemptHarness(line) {
  const feedback = new FakeFeedback();
  const app = Object.create(CoachingTrainerApp.prototype);
  Object.assign(app, {
    root: { querySelector: selector => selector === '#feedback' ? feedback : null },
    course: caroKann,
    line,
    sessionRoute: { moves: [...line.moves], notes: { ...(line.notes ?? {}) } },
    repertoire: new RepertoireMoveIndex(caroKann),
    chess: chessAt(line.moves, 1),
    ply: 1,
    viewPly: null,
    lineFinished: false,
    practiceCaughtUp: false,
    mode: 'learn',
    completedTerminalMove: null,
    wrongMoveEvaluationRequest: 0,
    evaluator: evaluator(),
    evaluationBar: null,
    board: boardStub(),
    recordTrainingMistake() {},
    refreshBoardState() {},
    currentExpectedMove() { return line.moves[this.ply]; },
    currentRouteNote() { return line.notes?.[this.ply] ?? ''; }
  });
  return { app, feedback };
}

function historicalAttemptHarness(line) {
  const liveFeedback = new FakeFeedback();
  const historyFeedback = new FakeFeedback();
  historyFeedback.hidden = true;
  const historicalChess = chessAt(line.moves, 1);
  const app = Object.create(AutomaticSpacedTrainerApp.prototype);
  Object.assign(app, {
    root: {
      querySelector(selector) {
        if (selector === '#feedback') return liveFeedback;
        if (selector === '#history-feedback') return historyFeedback;
        return null;
      }
    },
    course: caroKann,
    line,
    sessionRoute: { moves: [...line.moves], notes: { ...(line.notes ?? {}) } },
    repertoire: new RepertoireMoveIndex(caroKann),
    chess: chessAt(line.moves, 5),
    ply: 5,
    viewPly: 1,
    lineFinished: false,
    practiceCaughtUp: false,
    mode: 'learn',
    completedTerminalMove: null,
    wrongMoveEvaluationRequest: 0,
    evaluator: evaluator(),
    evaluationBar: null,
    board: boardStub(),
    mistakesThisLine: 7,
    historicalReplayContext() {
      return {
        chess: historicalChess,
        lastOpponentMove: null,
        expected: line.moves[1],
        interactive: true
      };
    },
    refreshBoardState() {},
    currentRouteNote(ply = this.ply) { return line.notes?.[ply] ?? ''; },
    recordTrainingMistake() {
      throw new Error('history projection must suppress training mutation');
    }
  });
  return { app, liveFeedback, historyFeedback };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

test('1→2→X and 1→2→3→2→X use identical learner-facing wrong-move feedback', async () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return { className: '', textContent: '' };
    }
  };

  try {
    const line = caroKann.lines[0];
    const live = liveAttemptHarness(line);
    const historical = historicalAttemptHarness(line);

    CoachingTrainerApp.prototype.onUserMove.call(live.app, 'g8', 'f6');
    historical.app.replayHistoricalMove('g8', 'f6');
    await flushPromises();

    assert.equal(historical.historyFeedback.textContent, live.feedback.textContent);
    assert.match(live.feedback.textContent, /Mistake \(-1\.25\)/);
    assert.match(live.feedback.textContent, /Nf6 is not the move this line teaches/);
    assert.equal(historical.liveFeedback.hidden, true);
    assert.equal(historical.historyFeedback.hidden, false);
    assert.equal(historical.app.ply, 5);
    assert.equal(historical.app.viewPly, 1);
    assert.equal(historical.app.mistakesThisLine, 7);
  } finally {
    globalThis.document = originalDocument;
  }
});
