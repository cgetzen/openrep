export function parseUciScore(line, sideToMove) {
  const match = String(line).match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  if (!match) return null;
  const multiplier = sideToMove === 'b' ? -1 : 1;
  return { type: match[1], value: Number(match[2]) * multiplier };
}

export function scoreToWhiteShare(score) {
  if (!score) return 50;
  if (score.type === 'mate') return score.value > 0 ? 97 : score.value < 0 ? 3 : 50;
  const share = 50 + 47 * Math.tanh(score.value / 400);
  return Math.max(3, Math.min(97, share));
}

export function formatEvaluation(score) {
  if (!score) return 'Evaluation unavailable';
  if (score.type === 'mate') {
    if (score.value === 0) return 'Mate';
    return score.value > 0 ? `White mate in ${score.value}` : `Black mate in ${Math.abs(score.value)}`;
  }
  const pawns = score.value / 100;
  if (Math.abs(pawns) < 0.005) return 'Equal';
  return pawns > 0 ? `White +${pawns.toFixed(2)}` : `Black +${Math.abs(pawns).toFixed(2)}`;
}

export function formatCompactEvaluation(score) {
  if (!score) return '';
  if (score.type === 'mate') {
    if (score.value === 0) return 'M';
    return score.value > 0 ? `M${score.value}` : `-M${Math.abs(score.value)}`;
  }
  const pawns = score.value / 100;
  if (Math.abs(pawns) < 0.005) return '0.00';
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
}
