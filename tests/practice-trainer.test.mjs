import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePracticeSessionRoute } from '../src/practice-trainer.js';

const sourceLine = {
  id: 'knight-first',
  title: 'Knight first',
  moves: ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'f1g2', 'e7e6']
};
const targetLine = {
  id: 'fianchetto-first',
  title: 'Fianchetto first',
  moves: ['g2g3', 'd7d5', 'g1f3', 'g8f6', 'b2b3', 'e7e6']
};
const lines = [sourceLine, targetLine];

function canonicalRoute(line) {
  return {
    id: `canonical:${line.id}`,
    kind: 'canonical',
    label: line.title,
    targetLineId: line.id,
    moves: [...line.moves]
  };
}

test('transposition-only branch routes cannot enter a practice session under another line title', () => {
  const hybridRoute = {
    id: 'branch:knight-first:4:b2b3',
    kind: 'branch',
    label: targetLine.title,
    targetLineId: targetLine.id,
    moves: ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'b2b3', 'e7e6']
  };

  const resolved = resolvePracticeSessionRoute(sourceLine, hybridRoute, lines, canonicalRoute);

  assert.deepEqual(resolved, canonicalRoute(sourceLine));
  assert.equal(resolved.label, sourceLine.title);
  assert.deepEqual(resolved.moves, sourceLine.moves);
});

test('an exact covered branch is preserved when its full move sequence and title match its target line', () => {
  const exactRoute = {
    id: 'branch:knight-first:0:g2g3',
    kind: 'branch',
    label: targetLine.title,
    targetLineId: targetLine.id,
    moves: [...targetLine.moves]
  };

  assert.equal(resolvePracticeSessionRoute(sourceLine, exactRoute, lines, canonicalRoute), exactRoute);
});

test('stale branch title metadata is rejected even when the moves match the target line', () => {
  const mislabeledRoute = {
    id: 'branch:knight-first:0:g2g3',
    kind: 'branch',
    label: 'Wrong title',
    targetLineId: targetLine.id,
    moves: [...targetLine.moves]
  };

  assert.deepEqual(
    resolvePracticeSessionRoute(sourceLine, mislabeledRoute, lines, canonicalRoute),
    canonicalRoute(sourceLine)
  );
});

test('canonical fallback is itself validated so corrupt line identity fails fast', () => {
  assert.throws(
    () => resolvePracticeSessionRoute(sourceLine, null, lines, line => ({
      kind: 'canonical',
      label: line.title,
      targetLineId: line.id,
      moves: [...targetLine.moves]
    })),
    /Canonical practice route identity mismatch/
  );
});

test('standalone response routes remain position-based and are not forced to impersonate a full branch', () => {
  const responseRoute = {
    id: 'response:quiet-b3',
    kind: 'response',
    label: 'Quiet response',
    moves: ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'b2b3', 'e7e6']
  };

  assert.equal(resolvePracticeSessionRoute(sourceLine, responseRoute, lines, canonicalRoute), responseRoute);
});
