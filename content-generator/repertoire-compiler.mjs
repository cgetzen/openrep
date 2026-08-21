const DEFAULT_THRESHOLDS = Object.freeze([80, 90, 95]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function roundPercent(value) {
  return Math.round(value * 100) / 100;
}

function stableMoveSort(a, b) {
  const countDelta = b.games - a.games;
  return countDelta || a.move.localeCompare(b.move);
}

function curriculumTierForMove(move, coverage, thresholds) {
  const [coreThreshold, , practicalThreshold] = thresholds;
  if (coverage[String(coreThreshold)]?.includes(move)) return 'core';
  if (coverage[String(practicalThreshold)]?.includes(move)) return 'important';
  return 'sideline';
}

export function rankObservedMoves(observedMoves, totalGames = null) {
  assert(Array.isArray(observedMoves) && observedMoves.length > 0, 'Decision must include observed moves');

  const seen = new Set();
  const ranked = observedMoves.map(entry => {
    assert(entry && typeof entry.move === 'string' && entry.move.length >= 4, 'Observed move must have a move');
    assert(Number.isInteger(entry.games) && entry.games > 0, `Observed move ${entry.move} must have a positive game count`);
    assert(!seen.has(entry.move), `Duplicate observed move: ${entry.move}`);
    seen.add(entry.move);
    return { ...entry };
  }).sort(stableMoveSort);

  const observedTotal = ranked.reduce((sum, entry) => sum + entry.games, 0);
  const denominator = totalGames ?? observedTotal;
  assert(Number.isInteger(denominator) && denominator > 0, 'Decision totalGames must be a positive integer');
  assert(observedTotal <= denominator, 'Observed move counts cannot exceed totalGames');

  let cumulativeGames = 0;
  return ranked.map(entry => {
    cumulativeGames += entry.games;
    return Object.freeze({
      ...entry,
      percent: roundPercent((entry.games / denominator) * 100),
      cumulativePercent: roundPercent((cumulativeGames / denominator) * 100)
    });
  });
}

export function coverageForThresholds(rankedMoves, thresholds = DEFAULT_THRESHOLDS) {
  assert(Array.isArray(thresholds) && thresholds.length === 3, 'Coverage thresholds must contain 80/90/95-style bands');
  assert(thresholds.every(Number.isFinite), 'Coverage thresholds must be numeric');
  assert(thresholds[0] < thresholds[1] && thresholds[1] < thresholds[2], 'Coverage thresholds must be strictly increasing');

  return Object.freeze(Object.fromEntries(thresholds.map(threshold => {
    const selected = [];
    for (const entry of rankedMoves) {
      selected.push(entry.move);
      if (entry.cumulativePercent >= threshold) break;
    }
    assert(
      rankedMoves.at(-1)?.cumulativePercent >= threshold,
      `Observed moves reach only ${rankedMoves.at(-1)?.cumulativePercent ?? 0}% and cannot satisfy the ${threshold}% coverage checkpoint`
    );
    return [String(threshold), Object.freeze(selected)];
  })));
}

function compileDecision(decision, thresholds) {
  assert(decision?.id, 'Decision must have a stable id');
  assert(decision?.anchor?.lineId && Number.isInteger(decision?.anchor?.ply), `Decision ${decision?.id ?? 'unknown'} needs an authoring anchor`);
  assert(typeof decision?.positionKey === 'string' && decision.positionKey.length > 0, `Decision ${decision.id} needs a canonical positionKey`);

  const rankedMoves = rankObservedMoves(decision.observedMoves, decision.totalGames ?? null);
  const coverage = coverageForThresholds(rankedMoves, thresholds);
  const responseByOpponentMove = new Map();
  for (const response of decision.responses ?? []) {
    assert(response?.opponentMove, `Decision ${decision.id} has a response without an opponent move`);
    assert(response?.repertoireMove, `Decision ${decision.id} response ${response.opponentMove} is missing repertoireMove`);
    assert(!responseByOpponentMove.has(response.opponentMove), `Decision ${decision.id} has duplicate response ${response.opponentMove}`);
    responseByOpponentMove.set(response.opponentMove, response);
  }
  const requiredMoves = new Set(Object.values(coverage).flat());

  for (const move of requiredMoves) {
    assert(responseByOpponentMove.has(move), `Decision ${decision.id} is missing a repertoire response for coverage move ${move}`);
  }

  const moves = rankedMoves
    .filter(entry => responseByOpponentMove.has(entry.move))
    .map(entry => Object.freeze({
      ...entry,
      tier: curriculumTierForMove(entry.move, coverage, thresholds),
      response: Object.freeze({ ...responseByOpponentMove.get(entry.move) })
    }));

  return Object.freeze({
    id: decision.id,
    anchor: Object.freeze({ ...decision.anchor }),
    positionKey: decision.positionKey,
    totalGames: decision.totalGames ?? rankedMoves.reduce((sum, entry) => sum + entry.games, 0),
    source: decision.source ?? null,
    moves: Object.freeze(moves),
    coverage
  });
}

export function compileRepertoireSnapshot(snapshot) {
  assert(snapshot?.schemaVersion === 1, 'Unsupported repertoire snapshot schema');
  assert(snapshot?.openingId, 'Snapshot requires openingId');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(snapshot?.snapshotDate ?? ''), 'Snapshot requires a YYYY-MM-DD snapshotDate');

  const thresholds = Object.freeze([...(snapshot.coverageThresholds ?? DEFAULT_THRESHOLDS)]);
  const decisions = (snapshot.decisions ?? []).map(decision => compileDecision(decision, thresholds));
  assert(decisions.length > 0, 'Snapshot must include at least one opponent decision');

  const decisionIds = new Set();
  for (const decision of decisions) {
    assert(!decisionIds.has(decision.id), `Duplicate decision id: ${decision.id}`);
    decisionIds.add(decision.id);
  }

  const terminalAlternativeIds = new Set();
  const terminalAlternatives = Object.freeze(Object.fromEntries(
    (snapshot.terminalAlternatives ?? []).map(entry => {
      assert(entry?.decisionId, 'Terminal alternative requires decisionId');
      assert(!terminalAlternativeIds.has(entry.decisionId), `Duplicate terminal alternative: ${entry.decisionId}`);
      terminalAlternativeIds.add(entry.decisionId);
      assert(entry?.anchor?.lineId && Number.isInteger(entry?.anchor?.ply), `Terminal alternative ${entry?.decisionId ?? 'unknown'} needs an authoring anchor`);
      assert(Array.isArray(entry.acceptedMoves) && entry.acceptedMoves.length > 0, `Terminal alternative ${entry.decisionId} needs acceptedMoves`);
      assert(new Set(entry.acceptedMoves).size === entry.acceptedMoves.length, `Terminal alternative ${entry.decisionId} has duplicate accepted moves`);
      return [entry.decisionId, Object.freeze({
        anchor: Object.freeze({ ...entry.anchor }),
        cue: entry.cue ?? '',
        acceptedMoves: Object.freeze([...entry.acceptedMoves]),
        rationaleByMove: Object.freeze({ ...(entry.rationaleByMove ?? {}) }),
        evidence: Object.freeze({ ...(entry.evidence ?? {}) })
      })];
    })
  ));

  return Object.freeze({
    schemaVersion: 1,
    openingId: snapshot.openingId,
    snapshotDate: snapshot.snapshotDate,
    policyVersion: snapshot.policyVersion ?? '1',
    coverageThresholds: thresholds,
    provenance: Object.freeze({ ...(snapshot.provenance ?? {}) }),
    decisions: Object.freeze(decisions),
    terminalAlternatives
  });
}

export function serializeGeneratedModule(exportName, compiled) {
  assert(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(exportName), 'Generated export name must be a JavaScript identifier');
  return `// Generated by content-generator. Do not edit by hand.\n` +
    `// Snapshot: ${compiled.snapshotDate}; policy: ${compiled.policyVersion}.\n\n` +
    `export const ${exportName} = Object.freeze(${JSON.stringify(compiled, null, 2)});\n`;
}
