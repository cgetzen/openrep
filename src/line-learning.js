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
