export const caroKann20260821Snapshot = {
  schemaVersion: 1,
  openingId: 'caro-kann-black',
  snapshotDate: '2026-08-21',
  policyVersion: 'coverage-v1',
  coverageThresholds: [80, 90, 95],
  provenance: {
    database: '365Chess master-game opening database',
    databaseSnapshot: 'Queried 2026-08-21; database pages reported games through Jul 2026 where available',
    cohort: 'Master-game practical reference; not rating/time-control personalized',
    sourceUrl: 'https://www.365chess.com/chess-openings/Caro-Kann-Defense',
    enginePolicy: 'Repertoire responses remain curated/theory-reviewed. Engine labels may support alternatives but never imply automatic curriculum acceptance.',
    reviewBoundary: 'This file is an offline evidence snapshot. Runtime code must not query the source database or regenerate curriculum.'
  },
  decisions: [
    {
      id: 'caro-root-after-c6',
      anchor: { lineId: 'advance-early-c5', ply: 2 },
      totalGames: 146000,
      source: '365Chess: 1.e4 c6 possible continuations',
      observedMoves: [
        { move: 'd2d4', games: 115657 },
        { move: 'b1c3', games: 11288 },
        { move: 'g1f3', games: 6819 },
        { move: 'c2c4', games: 6002 },
        { move: 'd2d3', games: 4508 },
        { move: 'f2f4', games: 516 },
        { move: 'g1e2', games: 504 },
        { move: 'f1c4', games: 219 },
        { move: 'b2b3', games: 162 },
        { move: 'g2g3', games: 93 },
        { move: 'c2c3', games: 83 },
        { move: 'e4e5', games: 51 },
        { move: 'd1e2', games: 26 },
        { move: 'f1e2', games: 18 },
        { move: 'f2f3', games: 18 },
        { move: 'd1f3', games: 12 },
        { move: 'a2a3', games: 7 },
        { move: 'h2h4', games: 6 },
        { move: 'd1h5', games: 4 },
        { move: 'b2b4', games: 3 },
        { move: 'f1d3', games: 2 }
      ],
      responses: [
        { opponentMove: 'd2d4', repertoireMove: 'd7d5', selection: 'existing-primary-repertoire' },
        { opponentMove: 'b1c3', repertoireMove: 'd7d5', selection: 'existing-primary-repertoire' },
        { opponentMove: 'g1f3', repertoireMove: 'd7d5', selection: 'existing-primary-repertoire' },
        { opponentMove: 'c2c4', repertoireMove: 'd7d5', selection: 'existing-primary-repertoire' },
        { opponentMove: 'd2d3', repertoireMove: 'd7d5', selection: 'existing-primary-repertoire' }
      ]
    },
    {
      id: 'advance-c5-after-c5',
      anchor: { lineId: 'advance-early-c5', ply: 6 },
      totalGames: 5327,
      source: '365Chess: 1.e4 c6 2.d4 d5 3.e5 c5 possible continuations',
      observedMoves: [
        { move: 'd4c5', games: 3249 },
        { move: 'g1f3', games: 1060 },
        { move: 'c2c3', games: 762 },
        { move: 'c2c4', games: 146 },
        { move: 'g1e2', games: 39 },
        { move: 'f1b5', games: 23 },
        { move: 'b1c3', games: 19 },
        { move: 'f2f4', games: 15 },
        { move: 'c1e3', games: 10 },
        { move: 'f1d3', games: 1 },
        { move: 'h2h3', games: 1 },
        { move: 'h2h4', games: 1 },
        { move: 'a2a3', games: 1 }
      ],
      responses: [
        { opponentMove: 'd4c5', repertoireMove: 'e7e6', selection: 'existing-coverage-response' },
        { opponentMove: 'g1f3', repertoireMove: 'c5d4', selection: 'existing-coverage-response' },
        { opponentMove: 'c2c3', repertoireMove: 'b8c6', selection: 'existing-primary-line' }
      ]
    },
    {
      id: 'exchange-after-cxd5',
      anchor: { lineId: 'exchange-main', ply: 6 },
      totalGames: 29796,
      source: '365Chess: 1.e4 c6 2.d4 d5 3.exd5 cxd5 possible continuations',
      observedMoves: [
        { move: 'c2c4', games: 15810 },
        { move: 'f1d3', games: 10420 },
        { move: 'g1f3', games: 1961 },
        { move: 'c2c3', games: 690 },
        { move: 'b1c3', games: 467 },
        { move: 'c1f4', games: 258 },
        { move: 'f1b5', games: 88 },
        { move: 'h2h3', games: 28 },
        { move: 'g2g3', games: 18 },
        { move: 'c1e3', games: 17 },
        { move: 'f1e2', games: 11 },
        { move: 'f2f4', games: 11 },
        { move: 'c1g5', games: 4 },
        { move: 'b2b3', games: 4 },
        { move: 'g1e2', games: 3 },
        { move: 'b1d2', games: 3 },
        { move: 'd1f3', games: 3 }
      ],
      responses: [
        { opponentMove: 'c2c4', repertoireMove: 'g8f6', selection: 'existing-panov-line' },
        { opponentMove: 'f1d3', repertoireMove: 'b8c6', selection: 'existing-exchange-line' },
        { opponentMove: 'g1f3', repertoireMove: 'b8c6', selection: 'existing-coverage-response' },
        { opponentMove: 'c2c3', repertoireMove: 'b8c6', selection: 'existing-coverage-response' }
      ]
    },
    {
      id: 'two-knights-after-d5',
      anchor: { lineId: 'two-knights', ply: 4 },
      totalGames: 11309,
      source: '365Chess: 1.e4 c6 2.Nc3 d5 possible continuations',
      observedMoves: [
        { move: 'g1f3', games: 8054 },
        { move: 'd2d4', games: 1223 },
        { move: 'd1f3', games: 775 },
        { move: 'e4d5', games: 434 },
        { move: 'd2d3', games: 270 },
        { move: 'f2f4', games: 247 },
        { move: 'd1e2', games: 166 },
        { move: 'g2g3', games: 70 },
        { move: 'e4e5', games: 27 },
        { move: 'f2f3', games: 24 },
        { move: 'f1d3', games: 7 },
        { move: 'h2h3', games: 4 },
        { move: 'b2b3', games: 3 },
        { move: 'g1e2', games: 2 },
        { move: 'd1h5', games: 1 },
        { move: 'a2a3', games: 1 },
        { move: 'f1e2', games: 1 }
      ],
      responses: [
        { opponentMove: 'g1f3', repertoireMove: 'c8g4', selection: 'existing-two-knights-line' },
        { opponentMove: 'd2d4', repertoireMove: 'd5e4', selection: 'classical-transposition' },
        { opponentMove: 'd1f3', repertoireMove: 'd5e4', selection: 'database-mainline-and-theory-review' },
        { opponentMove: 'e4d5', repertoireMove: 'c6d5', selection: 'forced-structural-recapture' },
        { opponentMove: 'd2d3', repertoireMove: 'd5e4', selection: 'database-mainline-and-repertoire-consistency' }
      ]
    }
  ],
  terminalAlternatives: [
    {
      decisionId: 'early-nf3-terminal-light-bishop',
      anchor: { lineId: 'early-nf3', ply: 11 },
      cue: 'Activate the light-squared bishop before e6.',
      acceptedMoves: ['c8g4'],
      rationaleByMove: {
        c8g4: 'Also develops the bishop before e6, using the knight on f3 as a target and creating a pin.'
      },
      evidence: {
        type: 'curated-theory',
        reviewDate: '2026-08-21',
        note: 'Existing accepted alternative retained by the generated snapshot.'
      }
    },
    {
      decisionId: 'hillbilly-completion',
      anchor: { lineId: 'hillbilly', ply: 11 },
      cue: 'Use the extra time to activate the light bishop before e6.',
      acceptedMoves: ['c8g4'],
      rationaleByMove: {
        c8g4: 'Develops the bishop outside the pawn chain and uses the f3-knight as a target; it satisfies the same teaching objective as Bf5.'
      },
      evidence: {
        type: 'engine-plus-theory-review',
        reviewDate: '2026-08-21',
        observedEngineLabel: 'Best',
        observedScoreDifference: '-0.01',
        note: 'Accepted because it is both engine-equivalent in the reviewed position and pedagogically equivalent to the terminal objective; the engine label alone is not sufficient for acceptance.'
      }
    }
  ]
};
