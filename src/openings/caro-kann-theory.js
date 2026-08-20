export const caroKannMoveTheory = [
  {
    anchor: { lineId: 'advance-main', ply: 13 },
    move: 'g8e7',
    rationale: 'Develops without blocking the f-pawn and supports ...Ng6, where the knight can add pressure to White’s center.',
    source: 'curated'
  },
  {
    anchor: { lineId: 'advance-tal', ply: 13 },
    move: 'c6c5',
    rationale: 'Strikes at d4, the base of White’s advanced center, before White can consolidate the extra space.',
    source: 'curated'
  },
  {
    anchor: { lineId: 'advance-bayonet', ply: 13 },
    move: 'h7h5',
    rationale: 'Challenges White’s kingside pawn chain immediately and prevents h5 from gaining more space for free.',
    source: 'curated'
  },
  {
    anchor: { lineId: 'classical-main', ply: 15 },
    move: 'g6h7',
    rationale: 'Completes the standard bishop retreat, keeping the bishop safe while Black finishes development behind a compact structure.',
    source: 'curated'
  },
  {
    anchor: { lineId: 'exchange-main', ply: 13 },
    move: 'd8d7',
    rationale: 'Defends b7, connects the queenside pieces, and keeps Black coordinated in the symmetrical Exchange structure.',
    source: 'curated'
  },
  {
    anchor: { lineId: 'panov-main', ply: 15 },
    move: 'e8g8',
    rationale: 'Secures the king and connects the rook before Black turns fully to pressure against the isolated d-pawn.',
    source: 'curated'
  },
  {
    anchor: { lineId: 'two-knights', ply: 13 },
    move: 'd5e4',
    rationale: 'Uses the moment to remove White’s central pawn and simplify after Black’s pieces are developed to pressure e4.',
    source: 'curated'
  },
  {
    anchor: { lineId: 'fantasy', ply: 13 },
    move: 'f6d7',
    rationale: 'Reroutes the knight toward c5 or e5, where it can challenge White’s advanced center instead of being pushed around.',
    source: 'curated'
  },
  {
    anchor: { lineId: 'hillbilly', ply: 11 },
    move: 'c8f5',
    rationale: 'Develops the light-squared bishop actively before ...e6, using the time White spent on the early bishop sortie.',
    source: 'curated'
  },
  {
    anchor: { lineId: 'quiet-d3', ply: 11 },
    move: 'e8g8',
    rationale: 'Completes development and secures the king after Black has comfortably claimed central space.',
    source: 'curated'
  },
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
  },
  {
    anchor: { lineId: 'advance-early-c5', ply: 13 },
    move: 'g8e7',
    rationale: 'Develops toward f5 or g6 while keeping the f-pawn free, reinforcing the flexible pressure created by the early ...c5 setup.',
    source: 'curated'
  }
];

export const caroKannLessonDecisions = [
  {
    id: 'advance-main-completion',
    anchor: { lineId: 'advance-main', ply: 13 },
    objective: 'Develop the light bishop before ...e6, then undermine White’s advanced center with ...c5.'
  },
  {
    id: 'advance-tal-completion',
    anchor: { lineId: 'advance-tal', ply: 13 },
    objective: 'Meet the h-pawn attack without panic, then strike the base of White’s center with ...c5.'
  },
  {
    id: 'advance-bayonet-completion',
    anchor: { lineId: 'advance-bayonet', ply: 13 },
    objective: 'Let White spend tempi on kingside pawns, then challenge the pawn chain before it rolls forward.'
  },
  {
    id: 'classical-main-completion',
    anchor: { lineId: 'classical-main', ply: 15 },
    objective: 'Activate the light bishop early, then retreat it safely as White gains space.'
  },
  {
    id: 'exchange-main-completion',
    anchor: { lineId: 'exchange-main', ply: 13 },
    objective: 'In the symmetrical Exchange structure, prioritize active development and coordinated pieces.'
  },
  {
    id: 'panov-main-completion',
    anchor: { lineId: 'panov-main', ply: 15 },
    objective: 'Develop rapidly and castle before turning to the isolated d-pawn.'
  },
  {
    id: 'two-knights-completion',
    anchor: { lineId: 'two-knights', ply: 13 },
    objective: 'Activate the bishop before ...e6, then simplify White’s center when the timing is right.'
  },
  {
    id: 'fantasy-completion',
    anchor: { lineId: 'fantasy', ply: 13 },
    objective: 'Build a resilient center against f3, then reroute pieces to challenge White’s advanced center.'
  },
  {
    id: 'hillbilly-completion',
    anchor: { lineId: 'hillbilly', ply: 11 },
    objective: 'Challenge the center immediately and use White’s early bishop sortie to gain development tempi.'
  },
  {
    id: 'quiet-d3-completion',
    anchor: { lineId: 'quiet-d3', ply: 11 },
    objective: 'Take the central space White declines to occupy and complete development without concessions.'
  },
  {
    id: 'early-nf3-terminal-light-bishop',
    anchor: { lineId: 'early-nf3', ply: 11 },
    objective: 'Activate the light-squared bishop before ...e6.',
    acceptedMoves: ['c8g4']
  },
  {
    id: 'advance-early-c5-completion',
    anchor: { lineId: 'advance-early-c5', ply: 13 },
    objective: 'Challenge d4 immediately with ...c5 and build pressure without first committing to ...Bf5.'
  }
];
