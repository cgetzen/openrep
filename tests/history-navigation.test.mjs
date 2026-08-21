import test from 'node:test';
import assert from 'node:assert/strict';

import { TrainerApp } from '../src/trainer.js';

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

test('history navigation uses the narrow history projection instead of full refresh', () => {
  const app = historyHarness({ ply: 4 });

  TrainerApp.prototype.navigateHistory.call(app, -1);

  assert.equal(app.viewPly, 3);
  assert.deepEqual(app.calls, ['clearSelection', 'refreshHistoryView']);
});

test('history navigation returns to live position through the same narrow projection', () => {
  const app = historyHarness({ ply: 4, viewPly: 3 });

  TrainerApp.prototype.navigateHistory.call(app, 1);

  assert.equal(app.viewPly, null);
  assert.deepEqual(app.calls, ['clearSelection', 'refreshHistoryView']);
});

test('history projection is restricted to advice, board state, and history controls', () => {
  const calls = [];
  const app = {
    refresh() {
      throw new Error('history projection must never invoke the full trainer refresh');
    },
    refreshHistoryAdvice() {
      calls.push('advice');
    },
    refreshBoardState() {
      calls.push('board');
    },
    refreshHistoryControls() {
      calls.push('controls');
    }
  };

  TrainerApp.prototype.refreshHistoryView.call(app);

  assert.deepEqual(calls, ['advice', 'board', 'controls']);
});

test('history navigation does nothing when already at the requested boundary', () => {
  const app = historyHarness({ ply: 4, viewPly: 0 });

  TrainerApp.prototype.navigateHistory.call(app, -1);

  assert.equal(app.viewPly, 0);
  assert.deepEqual(app.calls, []);
});
