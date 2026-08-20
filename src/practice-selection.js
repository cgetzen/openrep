export const PRACTICE_SELECTIONS = Object.freeze(['spaced', 'weak']);

export function normalizePracticeSelection(selection) {
  return PRACTICE_SELECTIONS.includes(selection) ? selection : 'spaced';
}

export function pickSpacedLineIndex(lines, progress, now = Date.now()) {
  const lineProgress = progress?.lines ?? {};
  return lines.map((line, index) => {
    const current = lineProgress[line.id];
    return {
      index,
      dueAt: current?.dueAt ?? now,
      repetitions: current?.repetitions ?? 0
    };
  }).sort((a, b) => a.dueAt - b.dueAt || a.repetitions - b.repetitions)[0]?.index ?? 0;
}

export function pickWeakLineIndex(lines, progress, random = Math.random) {
  const lineProgress = progress?.lines ?? {};
  const ranked = lines.map((line, index) => {
    const current = lineProgress[line.id];
    const score = (current?.completions ?? 0) * 2
      + (current?.repetitions ?? 0)
      - (current?.mistakes ?? 0) * 3;
    return { index, score };
  }).sort((a, b) => a.score - b.score || a.index - b.index);

  const weakest = ranked.slice(0, Math.min(4, ranked.length));
  if (weakest.length === 0) return 0;
  const randomIndex = Math.min(weakest.length - 1, Math.floor(random() * weakest.length));
  return weakest[randomIndex].index;
}

export function pickPracticeLineIndex(lines, progress, selection, options = {}) {
  const normalized = normalizePracticeSelection(selection);
  if (normalized === 'weak') return pickWeakLineIndex(lines, progress, options.random);
  return pickSpacedLineIndex(lines, progress, options.now);
}
