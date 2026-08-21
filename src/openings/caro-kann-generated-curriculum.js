import { generatedDecisionMove } from '../generated-repertoire.js';
import { caroKannCurriculum as curatedCurriculum } from './caro-kann-curriculum.js';
import { caroKannGeneratedRepertoire } from './generated/caro-kann.generated.js';

function evidenceFor(decisionId, move, detail) {
  const entry = generatedDecisionMove(caroKannGeneratedRepertoire, decisionId, move);
  if (!entry) throw new Error(`Missing generated curriculum evidence for ${decisionId}:${move}`);
  return {
    label: `≈${entry.percent}% in snapshot`,
    detail,
    percent: entry.percent,
    cumulativePercent: entry.cumulativePercent,
    snapshotDate: caroKannGeneratedRepertoire.snapshotDate,
    policyVersion: caroKannGeneratedRepertoire.policyVersion
  };
}

function generatedTier(decisionId, move) {
  const entry = generatedDecisionMove(caroKannGeneratedRepertoire, decisionId, move);
  if (!entry) throw new Error(`Missing generated curriculum tier for ${decisionId}:${move}`);
  return entry.tier;
}

const twoKnightsResponses = [
  'two-knights-d4-transposition',
  'two-knights-qf3',
  'two-knights-exchange',
  'two-knights-d3'
];

const generatedFamilies = curatedCurriculum.families.flatMap(family => {
  if (family.id === 'early-knights') {
    return [
      {
        ...family,
        id: 'two-knights-coverage',
        tier: generatedTier('caro-root-after-c6', 'b1c3'),
        title: '2.Nc3 — Two Knights & transpositions',
        role: 'Coverage-driven move-order cluster',
        recognition: 'White develops Nc3 before committing the d-pawn.',
        plan: 'Challenge e4 with d5, then recognize Nf3, d4 transpositions, early queen pressure, exchanges, and d3 support.',
        lineIds: ['two-knights'],
        responseIds: twoKnightsResponses,
        evidence: evidenceFor(
          'caro-root-after-c6',
          'b1c3',
          '2.Nc3 is required to cross the 80% top-level coverage checkpoint. Inside 2.Nc3 d5, the canonical 3.Nf3 line plus four generated responses cover about 95.1% of the sampled continuations.'
        )
      },
      {
        ...family,
        id: 'early-nf3',
        tier: generatedTier('caro-root-after-c6', 'g1f3'),
        title: '2.Nf3 — Flexible move order',
        role: 'Top-level opponent decision',
        recognition: 'White develops Nf3 before committing the d-pawn.',
        plan: 'Challenge e4 with d5 and transpose into familiar Exchange or development structures when White commits the center.',
        lineIds: ['early-nf3'],
        responseIds: [],
        evidence: evidenceFor(
          'caro-root-after-c6',
          'g1f3',
          '2.Nf3 is the next top-level choice needed to pass the 90% practical-coverage checkpoint in the dated snapshot.'
        )
      }
    ];
  }

  if (family.id === 'accelerated-panov') {
    return [{
      ...family,
      tier: generatedTier('caro-root-after-c6', 'c2c4'),
      evidence: evidenceFor(
        'caro-root-after-c6',
        'c2c4',
        '2.c4 brings cumulative top-level practical coverage to about 95.7%, so it remains in the Important layer.'
      )
    }];
  }

  if (family.id === 'quiet-d3') {
    return [{
      ...family,
      tier: generatedTier('caro-root-after-c6', 'd2d3'),
      evidence: evidenceFor(
        'caro-root-after-c6',
        'd2d3',
        '2.d3 begins beyond the 95% top-level coverage checkpoint in this master-game snapshot, so it moves to Sideline.'
      )
    }];
  }

  return [family];
});

export const caroKannGeneratedCurriculum = {
  ...curatedCurriculum,
  evidence: {
    ...curatedCurriculum.evidence,
    source: caroKannGeneratedRepertoire.provenance.database,
    snapshotDate: caroKannGeneratedRepertoire.snapshotDate,
    cohort: caroKannGeneratedRepertoire.provenance.cohort,
    note: 'Tier and coverage evidence is compiled offline from the dated snapshot; runtime only consumes this committed artifact.'
  },
  families: generatedFamilies
};
