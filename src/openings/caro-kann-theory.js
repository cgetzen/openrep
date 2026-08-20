export const caroKannMoveTheory = [
  {
    anchor: { lineId: 'early-nf3', ply: 11 },
    move: 'c8f5',
    rationale: 'Develops the light-squared bishop outside the pawn chain before ...e6 while keeping the bishop flexible.',
    source: 'curated'
  },
  {
    anchor: { lineId: 'early-nf3', ply: 11 },
    move: 'c8g4',
    rationale: 'Also develops the bishop before ...e6, using the knight on f3 as a target and creating a pin.',
    source: 'curated'
  }
];

export const caroKannLessonDecisions = [
  {
    id: 'early-nf3-terminal-light-bishop',
    anchor: { lineId: 'early-nf3', ply: 11 },
    objective: 'Activate the light-squared bishop before ...e6.',
    acceptedMoves: ['c8g4']
  }
];
