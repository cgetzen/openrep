function moveKey(uci) {
  return typeof uci === 'string' ? uci.slice(0, 4) : '';
}

function sameMove(a, b) {
  const aKey = moveKey(a);
  return aKey.length === 4 && aKey === moveKey(b);
}

function reachesSamePosition(line, currentLine, ply) {
  if (!Array.isArray(line?.moves) || !Array.isArray(currentLine?.moves)) return false;
  if (line.moves.length <= ply || currentLine.moves.length <= ply) return false;

  for (let index = 0; index < ply; index += 1) {
    if (line.moves[index] !== currentLine.moves[index]) return false;
  }
  return true;
}

/**
 * Classify a training move against the complete course repertoire at the
 * current position. The trainer can then decide how to present the result
 * without teaching a valid repertoire move as a chess mistake.
 */
export function classifyRepertoireMove(course, currentLine, ply, attemptedUci) {
  const expected = currentLine?.moves?.[ply] ?? null;
  if (expected && sameMove(expected, attemptedUci)) {
    return { kind: 'expected', expected, alternatives: [] };
  }

  const alternatives = (course?.lines ?? []).filter(line =>
    line !== currentLine &&
    reachesSamePosition(line, currentLine, ply) &&
    sameMove(line.moves[ply], attemptedUci)
  );

  if (alternatives.length > 0) {
    return { kind: 'repertoire-alternative', expected, alternatives };
  }

  return { kind: 'out-of-repertoire', expected, alternatives: [] };
}
