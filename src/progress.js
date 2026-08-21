const STORAGE_PREFIX = 'openrep:v1:';

export const RECENT_ATTEMPT_LIMIT = 5;
export const MAX_ATTEMPT_MISTAKES = 3;

function normalizeMistakeCount(value) {
  const numeric = Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(MAX_ATTEMPT_MISTAKES, numeric));
}

export function recentLineAttempts(progress) {
  if (!Array.isArray(progress?.recentAttempts)) return [];
  return progress.recentAttempts
    .map(normalizeMistakeCount)
    .slice(-RECENT_ATTEMPT_LIMIT);
}

export function recordLineAttempt(progress, mistakes) {
  return {
    ...(progress ?? {}),
    recentAttempts: [
      ...recentLineAttempts(progress),
      normalizeMistakeCount(mistakes)
    ].slice(-RECENT_ATTEMPT_LIMIT)
  };
}

export function isLineMastered(progress) {
  const attempts = recentLineAttempts(progress);
  return attempts.length === RECENT_ATTEMPT_LIMIT && attempts.every(mistakes => mistakes === 0);
}

export function lineLearningStatus(progress, discovered) {
  if (!discovered) return 'New';
  return isLineMastered(progress) ? 'Mastered' : 'Learning';
}

export function lineWeaknessProfile(progress) {
  const attempts = recentLineAttempts(progress);
  const severity = attempts.reduce((sum, mistakes) => sum + mistakes, 0);

  if (severity > 0) {
    return { tier: 0, severity, attempts: attempts.length };
  }
  if (attempts.length < RECENT_ATTEMPT_LIMIT) {
    return { tier: 1, severity: 0, attempts: attempts.length };
  }
  return { tier: 2, severity: 0, attempts: attempts.length };
}

export function defaultLineProgress(now = Date.now()) {
  return {
    repetitions: 0,
    intervalDays: 0,
    ease: 2.5,
    dueAt: now,
    mistakes: 0,
    completions: 0,
    recentAttempts: []
  };
}

export function defaultCourseProgress() {
  return { discovered: [], learnedResponses: [], lines: {}, totalSessions: 0 };
}

export function normalizeCourseProgress(raw = {}) {
  const parsed = raw && typeof raw === 'object' ? raw : {};
  const explicitResponses = Array.isArray(parsed.learnedResponses) ? parsed.learnedResponses : [];
  const legacyResponses = Array.isArray(parsed.learnedDeviations)
    ? parsed.learnedDeviations
      .filter(id => typeof id === 'string' && id.startsWith('micro:'))
      .map(id => id.slice('micro:'.length))
    : [];
  const { learnedDeviations: _legacy, ...rest } = parsed;

  return {
    ...defaultCourseProgress(),
    ...rest,
    learnedResponses: [...new Set([...explicitResponses, ...legacyResponses])]
  };
}

export function scheduleReview(current, grade, now = Date.now()) {
  const next = { ...current, lastGrade: grade, completions: current.completions + 1 };
  if (grade === 'again') {
    next.repetitions = 0;
    next.intervalDays = 0;
    next.ease = Math.max(1.3, current.ease - 0.2);
    next.dueAt = now + 10 * 60 * 1000;
    return next;
  }

  const easeDelta = grade === 'hard' ? -0.15 : grade === 'easy' ? 0.15 : 0;
  next.ease = Math.max(1.3, current.ease + easeDelta);
  next.repetitions = current.repetitions + 1;

  if (grade === 'hard') next.intervalDays = Math.max(1, Math.round((current.intervalDays || 1) * 1.2));
  else if (current.repetitions === 0) next.intervalDays = grade === 'easy' ? 4 : 1;
  else if (current.repetitions === 1) next.intervalDays = grade === 'easy' ? 8 : 3;
  else {
    const multiplier = grade === 'easy' ? next.ease * 1.3 : next.ease;
    next.intervalDays = Math.max(1, Math.round(current.intervalDays * multiplier));
  }

  next.dueAt = now + next.intervalDays * 24 * 60 * 60 * 1000;
  return next;
}

export function loadProgress(courseId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${courseId}`);
    return raw ? normalizeCourseProgress(JSON.parse(raw)) : defaultCourseProgress();
  } catch {
    return defaultCourseProgress();
  }
}

export function saveProgress(courseId, progress) {
  localStorage.setItem(`${STORAGE_PREFIX}${courseId}`, JSON.stringify(progress));
}

export function resetProgress(courseId) {
  localStorage.removeItem(`${STORAGE_PREFIX}${courseId}`);
}
