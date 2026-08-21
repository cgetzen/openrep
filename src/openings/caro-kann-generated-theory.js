import { caroKannGeneratedRepertoire } from './generated/caro-kann.generated.js';

export const caroKannGeneratedMoveTheory = Object.entries(
  caroKannGeneratedRepertoire.terminalAlternatives ?? {}
).flatMap(([decisionId, alternative]) =>
  (alternative.acceptedMoves ?? []).map(move => ({
    anchor: alternative.anchor,
    move,
    cue: alternative.cue,
    rationale: alternative.rationaleByMove?.[move] ?? '',
    source: 'generated',
    provenance: {
      decisionId,
      snapshotDate: caroKannGeneratedRepertoire.snapshotDate,
      policyVersion: caroKannGeneratedRepertoire.policyVersion,
      evidence: alternative.evidence
    }
  }))
);

export function applyGeneratedLessonAlternatives(decisions) {
  const alternatives = caroKannGeneratedRepertoire.terminalAlternatives ?? {};
  return (decisions ?? []).map(decision => {
    const generated = alternatives[decision.id];
    if (!generated) return decision;
    return {
      ...decision,
      acceptedMoves: [...new Set([
        ...(decision.acceptedMoves ?? []),
        ...(generated.acceptedMoves ?? [])
      ])],
      generatedEvidence: {
        snapshotDate: caroKannGeneratedRepertoire.snapshotDate,
        policyVersion: caroKannGeneratedRepertoire.policyVersion,
        ...generated.evidence
      }
    };
  });
}
