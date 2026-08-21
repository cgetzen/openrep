import test from 'node:test';
import assert from 'node:assert/strict';

import { TrainerApp } from '../src/trainer.js';
import { OpenRepTrainerApp } from '../src/practice-trainer.js';
import { MiniChess } from '../src/mini-chess.js';

function historyHarness({ ply = 4, viewPly = null } = {}) {
  const calls = [];
  return {
    ply,
    viewPly,
    board: {
      clearSelection() {
        calls.push('clearSelection');
      }
    },
    refresh() {
      throw new Error('history navigation must never invoke the full trainer refresh');
    },
    refreshHistoryView() {
      calls.push('refreshHistoryView');
    },
    calls
  };
}

function chessAt(moves, ply) {
  const chess = new MiniChess();
  for (const move of moves.slice(0, ply)) chess.moveUci(move);
  return chess;
}

test('history navigation uses the history projection instead of full refresh', () => {
  const app = historyHarness({ ply: 4 });

  TrainerApp.prototype.navigateHistory.call(app, -1);

  assert.equal(app.viewPly, 3);
  assert.deepEqual(app.calls, ['clearSelection', 'refreshHistoryView']);
});

test('history navigation returns to live position through the same projection', () => {
  const app = historyHarness({ ply: 4, viewPly: 3 });

  TrainerApp.prototype.navigateHistory.call(app, 1);

  assert.equal(app.viewPly, null);
  assert.deepEqual(app.calls, ['clearSelection', 'refreshHistoryView']);
});

test('OpenRep history projection refreshes all position-derived right-panel surfaces', () => {
  const calls = [];
  const app = {
    renderDecisionPrompt() { calls.push('advice'); },
    renderOpponentOptions() { calls.push('opponent-options'); },
    renderResponseSummary() { calls.push('response-summary'); },
    renderDisplayedFeedback() { calls.push('move-feedback'); },
    renderCompletionTheory() { calls.push('completion-theory'); },
    refreshBoardState() { calls.push('board'); },
    refreshHistoryControls() { calls.push('controls'); },
    refresh() {
      throw new Error('history projection must never invoke the full trainer refresh');
    }
  };

  OpenRepTrainerApp.prototype.refreshHistoryView.call(app);

  assert.deepEqual(calls, [
    'advice',
    'opponent-options',
    'response-summary',
    'move-feedback',
    'completion-theory',
    'board',
    'controls'
  ]);
});

test('historical move feedback follows the most recent repertoire move at displayPly', () => {
  const moves = [
    'e2e4', 'c7c6', 'd2d3', 'd7d5', 'b1d2',
    'e7e5', 'g1f3', 'f8d6', 'g2g3'
  ];
  const notes = {
    1: '1...c6 keeps the usual Caro-Kann structure.',
    3: '2...d5 claims equal central space immediately.',
    5: '3...e5 creates a broad center because White has not challenged it.',
    7: '4...Bd6 develops toward the kingside and supports the center.'
  };
  const app = {
    viewPly: 9,
    course: { side: 'b' },
    sessionRoute: { moves, notes },
    completedTerminalMove: null,
    positionAtPly(ply) { return { chess: chessAt(moves, ply) }; },
    moveAtPly(ply) { return moves[ply] ?? null; },
    currentRouteNote(ply) { return notes[ply] ?? ''; }
  };

  const feedbackAt = ply => {
    app.viewPly = ply;
    return OpenRepTrainerApp.prototype.displayedMoveFeedback.call(app)?.text ?? '';
  };

  assert.equal(feedbackAt(9), 'Bd6 — 4...Bd6 develops toward the kingside and supports the center.');
  assert.equal(feedbackAt(8), 'Bd6 — 4...Bd6 develops toward the kingside and supports the center.');
  assert.equal(feedbackAt(7), 'e5 — 3...e5 creates a broad center because White has not challenged it.');
  assert.equal(feedbackAt(5), 'd5 — 2...d5 claims equal central space immediately.');
  assert.equal(feedbackAt(1), '');
});

test('decision context advances on the opponent move and stays fixed through the repertoire reply', () => {
  const moves = ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'c8f5'];
  const app = {
    viewPly: 1,
    ply: 5,
    practiceCaughtUp: false,
    course: { side: 'b' },
    sessionRoute: { kind: 'canonical', moves },
    positionAtPly(ply) { return { chess: chessAt(moves, ply) }; },
    moveAtPly(ply) { return moves[ply] ?? null; },
    moveTheory: { cueAt() { return 'cue'; } }
  };

  const contextAt = ply => {
    app.viewPly = ply;
    const context = OpenRepTrainerApp.prototype.displayedDecisionContext.call(app);
    return context && {
      decisionPly: context.decisionPly,
      opponentDecisionPly: context.opponentDecisionPly,
      moveAlreadyPlayed: context.moveAlreadyPlayed
    };
  };

  assert.deepEqual(contextAt(1), { decisionPly: 1, opponentDecisionPly: 0, moveAlreadyPlayed: false });
  assert.deepEqual(contextAt(2), { decisionPly: 1, opponentDecisionPly: 0, moveAlreadyPlayed: true });
  assert.deepEqual(contextAt(3), { decisionPly: 3, opponentDecisionPly: 2, moveAlreadyPlayed: false });
  assert.deepEqual(contextAt(4), { decisionPly: 3, opponentDecisionPly: 2, moveAlreadyPlayed: true });
  assert.deepEqual(contextAt(5), { decisionPly: 5, opponentDecisionPly: 4, moveAlreadyPlayed: false });
});

test('opponent alternatives consume the same decision context as advice', () => {
  const moves = ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'c8f5'];
  const requested = [];
  const app = {
    mode: 'learn',
    viewPly: 3,
    ply: 5,
    lineFinished: false,
    practiceCaughtUp: false,
    course: { side: 'b' },
    line: { moves },
    sessionRoute: { kind: 'canonical', moves },
    positionAtPly(ply) { return { chess: chessAt(moves, ply) }; },
    moveAtPly(ply) { return moves[ply] ?? null; },
    moveTheory: { cueAt() { return 'cue'; } },
    displayedDecisionContext() {
      return OpenRepTrainerApp.prototype.displayedDecisionContext.call(this);
    },
    repertoire: {
      opponentAlternatives(_line, ply) {
        requested.push(ply);
        return [{ ply }];
      }
    }
  };

  const optionsAt = ply => {
    app.viewPly = ply;
    return OpenRepTrainerApp.prototype.displayedOpponentOptions.call(app);
  };

  assert.deepEqual(optionsAt(3), [{ ply: 2 }]);
  assert.deepEqual(optionsAt(4), [{ ply: 2 }]);
  assert.deepEqual(optionsAt(5), [{ ply: 4 }]);
  assert.deepEqual(optionsAt(2), [{ ply: 0 }]);
  assert.deepEqual(requested, [2, 2, 4, 0]);
});

test('history navigation does nothing when already at the requested boundary', () => {
  const app = historyHarness({ ply: 4, viewPly: 0 });

  TrainerApp.prototype.navigateHistory.call(app, -1);

  assert.equal(app.viewPly, 0);
  assert.deepEqual(app.calls, []);
});
