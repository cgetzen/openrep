import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLessonSession,
  hasParentLesson,
  responseSessionStartPly
} from '../src/lesson-session.js';

test('curriculum response lessons start from the root even when their route diverges later', () => {
  assert.equal(responseSessionStartPly('curriculum', 6), 0);
  assert.equal(responseSessionStartPly('line', 6), 0);
  assert.equal(responseSessionStartPly('practice', 6), 0);
});

test('only embedded response lessons inherit the divergence start and require a parent', () => {
  const parent = { lineId: 'line-a', ply: 4 };
  const session = createLessonSession({
    teachingUnit: { kind: 'response', id: 'response-a' },
    origin: 'embedded-response',
    startPly: responseSessionStartPly('embedded-response', 4),
    parent
  });

  assert.equal(session.startPly, 4);
  assert.equal(hasParentLesson(session), true);
  assert.equal(session.parent, parent);
  assert.throws(() => createLessonSession({
    teachingUnit: { kind: 'response', id: 'response-a' },
    origin: 'embedded-response',
    startPly: 4
  }), /explicit parent session/);
});

test('root lesson sessions cannot accidentally acquire return-to-parent semantics', () => {
  for (const origin of ['line', 'practice', 'curriculum']) {
    const session = createLessonSession({
      teachingUnit: { kind: origin === 'curriculum' ? 'response' : 'line', id: `${origin}-unit` },
      origin,
      startPly: 0
    });
    assert.equal(hasParentLesson(session), false);
    assert.throws(() => createLessonSession({
      teachingUnit: session.teachingUnit,
      origin,
      startPly: 0,
      parent: { fake: true }
    }), /cannot have a parent session/);
  }
});
