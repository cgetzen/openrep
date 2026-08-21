export function generatedDecision(generated, decisionId) {
  return (generated?.decisions ?? []).find(decision => decision.id === decisionId) ?? null;
}

export function generatedDecisionMove(generated, decisionId, opponentMove) {
  return generatedDecision(generated, decisionId)?.moves?.find(entry => entry.move === opponentMove) ?? null;
}

export function generatedResponsesForDecision(generated, decisionId) {
  const decision = generatedDecision(generated, decisionId);
  if (!decision) return [];

  return decision.moves.flatMap(entry => {
    const selection = entry.response;
    if (!selection?.responseId) return [];

    return [{
      id: selection.responseId,
      source: 'generated',
      discovery: 'coverage-driven',
      positionKey: decision.positionKey,
      teachingOwnerLineId: selection.teachingOwnerLineId,
      move: entry.move,
      response: selection.repertoireMove,
      continuation: [...(selection.continuation ?? [])],
      label: selection.label ?? 'Coverage response',
      idea: selection.idea ?? '',
      responseNote: selection.responseNote ?? '',
      evidence: {
        snapshotDate: generated.snapshotDate,
        policyVersion: generated.policyVersion,
        decisionId: decision.id,
        source: decision.source,
        games: entry.games,
        percent: entry.percent,
        cumulativePercent: entry.cumulativePercent,
        tier: entry.tier,
        selection: selection.selection ?? ''
      }
    }];
  });
}

export function generatedTerminalAlternative(generated, decisionId) {
  return generated?.terminalAlternatives?.[decisionId] ?? null;
}
