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
    idea: 'White develops without chasing the bishop. Keep the normal Caro-Kann plan: reinforce d5, then challenge the center with ...c5.',
    responseNote: '4...e6 keeps the bishop outside the pawn chain and prepares the same central counterplay as the main setup.'
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
    responseNote: '5...e6 supports the center and keeps development simple; there is no need to manufacture tactics against Bd3.'
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
    responseNote: '4...Nc6 develops toward d4 and keeps Black ready for ...Nf6 and ...e5 ideas.'
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
    idea: 'The move order changes, but the target structure does not. Build the IQP setup with ...e6 and active piece pressure.',
    responseNote: '5...e6 heads for the same isolated-queen-pawn structure while keeping development flexible.'
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
    responseNote: '4...Nd7 develops while preserving the bishop and supports a resilient ...e6 setup.'
  }
];
