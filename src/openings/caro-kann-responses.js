import { generatedResponsesForDecision } from '../generated-repertoire.js';
import { caroKannGeneratedRepertoire } from './generated/caro-kann.generated.js';

const generatedTwoKnightsResponses = generatedResponsesForDecision(
  caroKannGeneratedRepertoire,
  'two-knights-after-d5'
);

export const caroKannResponses = [
  {
    id: 'advance-quiet-be2',
    source: 'curated',
    anchor: { lineId: 'advance-main', ply: 6 },
    teachingOwnerLineId: 'advance-main',
    move: 'f1e2',
    response: 'e7e6',
    continuation: ['g1f3', 'c6c5'],
    label: 'Quiet development',
    idea: 'White develops without chasing the bishop. Keep the normal Caro-Kann plan: reinforce d5, then challenge the center with c5.',
    responseNote: 'e6 keeps the bishop outside the pawn chain and prepares the same central counterplay as the main setup.'
  },
  {
    id: 'classical-bd3',
    source: 'curated',
    anchor: { lineId: 'classical-main', ply: 8 },
    teachingOwnerLineId: 'classical-main',
    move: 'f1d3',
    response: 'e7e6',
    continuation: ['g1f3', 'b8d7'],
    label: 'Quiet development',
    idea: 'White develops instead of immediately chasing the bishop. Complete the compact setup and bring the queenside knight toward f6.',
    responseNote: 'e6 supports the center and keeps development simple; there is no need to manufacture tactics against Bd3.'
  },
  {
    id: 'exchange-nf3',
    source: 'curated',
    anchor: { lineId: 'exchange-main', ply: 6 },
    teachingOwnerLineId: 'exchange-main',
    move: 'g1f3',
    response: 'b8c6',
    continuation: ['f1d3', 'g8f6'],
    label: 'Natural development',
    idea: 'When White develops the king knight first, stay active: develop toward d4 and match natural development without passivity.',
    responseNote: 'Nc6 develops toward d4 and keeps Black ready for Nf6 and e5 ideas.'
  },
  {
    id: 'panov-nf3-first',
    source: 'curated',
    anchor: { lineId: 'panov-main', ply: 8 },
    teachingOwnerLineId: 'panov-main',
    move: 'g1f3',
    response: 'e7e6',
    continuation: ['b1c3', 'f8b4'],
    label: 'Nf3 move order',
    idea: 'The move order changes, but the target structure does not. Build the IQP setup with e6 and active piece pressure.',
    responseNote: 'e6 heads for the same isolated-queen-pawn structure while keeping development flexible.'
  },
  {
    id: 'two-knights-be2',
    source: 'curated',
    anchor: { lineId: 'two-knights', ply: 6 },
    teachingOwnerLineId: 'two-knights',
    move: 'f1e2',
    response: 'b8d7',
    continuation: ['d2d4', 'e7e6'],
    label: 'Calm bishop retreat',
    idea: 'If White calmly breaks the pin, do not force an exchange. Develop, reinforce the center, and keep the bishop useful.',
    responseNote: 'Nd7 develops while preserving the bishop and supports a resilient e6 setup.'
  },
  {
    id: 'classical-nd2-transposition',
    source: 'curated',
    discovery: 'coverage-driven',
    anchor: { lineId: 'classical-main', ply: 4 },
    teachingOwnerLineId: 'classical-main',
    move: 'b1d2',
    response: 'd5e4',
    continuation: ['d2e4'],
    label: '3.Nd2 transposition',
    idea: 'White develops with Nd2 instead of Nc3. Resolve the center the same way; after Nxe4, the position transposes into the Classical lesson you already know.',
    responseNote: 'dxe4 removes the central tension. After Nxe4, move-order history disappears and the normal Classical plan applies.'
  },
  {
    id: 'advance-c5-dxc5',
    source: 'curated',
    discovery: 'coverage-driven',
    anchor: { lineId: 'advance-early-c5', ply: 6 },
    teachingOwnerLineId: 'advance-early-c5',
    move: 'd4c5',
    response: 'e7e6',
    continuation: ['b1c3', 'f8c5'],
    label: 'Main capture on c5',
    idea: 'White accepts the pawn and tries to make the extra c5-pawn awkward to recover. Open the bishop with e6 and develop toward the pawn instead of chasing it with the queen.',
    responseNote: 'e6 opens the f8-bishop toward c5 and builds development around recovering the advanced pawn.'
  },
  {
    id: 'advance-c5-nf3',
    source: 'curated',
    discovery: 'coverage-driven',
    anchor: { lineId: 'advance-early-c5', ply: 6 },
    teachingOwnerLineId: 'advance-early-c5',
    move: 'g1f3',
    response: 'c5d4',
    continuation: ['f3d4', 'b8c6'],
    label: 'Develop first with Nf3',
    idea: 'If White develops instead of supporting d4, use the moment to exchange the base of the pawn chain and then develop against the centralized knight.',
    responseNote: 'cxd4 removes the base of White’s advanced center before it can be reinforced.'
  },
  {
    id: 'exchange-c3',
    source: 'curated',
    discovery: 'coverage-driven',
    anchor: { lineId: 'exchange-main', ply: 6 },
    teachingOwnerLineId: 'exchange-main',
    move: 'c2c3',
    response: 'b8c6',
    continuation: ['f1d3', 'g8f6'],
    label: 'Solid c3 setup',
    idea: 'White supports d4 with c3 instead of developing immediately. Keep the same active Exchange plan and develop toward d4 rather than mirroring passively.',
    responseNote: 'Nc6 develops with pressure on d4 and keeps Black ready for Nf6 and active piece play.'
  },
  ...generatedTwoKnightsResponses
];
