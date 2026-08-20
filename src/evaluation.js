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
    return `M${Math.abs(score.value)}`;
  }
  const pawns = score.value / 100;
  if (Math.abs(pawns) < 0.005) return '0.00';
  return Math.abs(pawns).toFixed(2);
}

function scoreForSide(score, side) {
  if (!score) return null;
  const multiplier = side === 'b' ? -1 : 1;
  return { type: score.type, value: score.value * multiplier };
}

export function formatMoveScoreDifference(deltaCentipawns) {
  if (!Number.isFinite(deltaCentipawns)) return '';
  const normalized = Math.abs(deltaCentipawns) < 0.5 ? 0 : deltaCentipawns;
  const pawns = normalized / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

export function classifyMoveQuality(beforeScore, moveScore, side) {
  if (!beforeScore || !moveScore) return null;
  const before = scoreForSide(beforeScore, side);
  const after = scoreForSide(moveScore, side);

  if (after.type === 'mate' && after.value < 0) {
    return { classification: 'Blunder', scoreDifference: 'allowed mate', deltaCentipawns: null };
  }

  if (before.type === 'mate' && before.value > 0) {
    if (after.type !== 'mate' || after.value <= 0) {
      return { classification: 'Miss', scoreDifference: 'lost mate', deltaCentipawns: null };
    }
    return { classification: 'Best', scoreDifference: '0.00', deltaCentipawns: 0 };
  }

  if (before.type !== 'cp' || after.type !== 'cp') {
    return { classification: 'Best', scoreDifference: '0.00', deltaCentipawns: 0 };
  }

  const deltaCentipawns = after.value - before.value;
  const loss = Math.max(0, -deltaCentipawns);

  if (before.value >= 300 && after.value <= 100 && after.value >= -50 && loss >= 200) {
    return {
      classification: 'Miss',
      scoreDifference: formatMoveScoreDifference(deltaCentipawns),
      deltaCentipawns
    };
  }

  let classification;
  if (loss <= 10) classification = 'Best';
  else if (loss <= 25) classification = 'Excellent';
  else if (loss <= 50) classification = 'Good';
  else if (loss <= 100) classification = 'Inaccuracy';
  else if (loss <= 200) classification = 'Mistake';
  else classification = 'Blunder';

  return {
    classification,
    scoreDifference: formatMoveScoreDifference(deltaCentipawns),
    deltaCentipawns
  };
}

export function formatMoveQualityLabel(quality) {
  if (!quality) return '';
  const difference = String(quality.scoreDifference ?? '').trim();
  return difference ? `${quality.classification} (${difference})` : quality.classification;
}
