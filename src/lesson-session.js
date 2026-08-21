const VALID_ORIGINS = new Set(['line', 'practice', 'embedded-response', 'curriculum']);

export function createLessonSession({ teachingUnit, origin, startPly = 0, parent = null }) {
  if (!teachingUnit?.kind || !teachingUnit?.id) {
    throw new Error('Lesson session requires a stable teaching unit');
  }
  if (!VALID_ORIGINS.has(origin)) {
    throw new Error(`Unsupported lesson-session origin: ${origin ?? 'missing'}`);
  }
  if (!Number.isInteger(startPly) || startPly < 0) {
    throw new Error(`Lesson-session startPly must be a non-negative integer: ${startPly}`);
  }
  if (origin === 'embedded-response' && !parent) {
    throw new Error('Embedded response lessons require an explicit parent session');
  }
  if (origin !== 'embedded-response' && parent) {
    throw new Error(`${origin} lesson sessions cannot have a parent session`);
  }

  return Object.freeze({
    teachingUnit: Object.freeze({ kind: teachingUnit.kind, id: teachingUnit.id }),
    origin,
    startPly,
    parent
  });
}

export function responseSessionStartPly(origin, divergencePly = 0) {
  return origin === 'embedded-response' ? Math.max(0, divergencePly ?? 0) : 0;
}

export function hasParentLesson(session) {
  return Boolean(session?.parent);
}
