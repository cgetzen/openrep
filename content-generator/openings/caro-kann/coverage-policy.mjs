export const caroKannCoveragePolicy = {
  version: 'coverage-v1',
  responseContent: {
    'two-knights-after-d5': {
      d2d4: {
        responseId: 'two-knights-d4-transposition',
        teachingOwnerLineId: 'two-knights',
        continuation: ['c3e4'],
        label: '3.d4 transposition',
        idea: 'White returns to the main d4 center after developing Nc3 first. Resolve the center with dxe4; after Nxe4 the position joins the Classical structure.',
        responseNote: 'dxe4 uses the same central solution as the Classical Caro-Kann and removes move-order noise from the position.'
      },
      d1f3: {
        responseId: 'two-knights-qf3',
        teachingOwnerLineId: 'two-knights',
        continuation: ['c3e4', 'g8f6'],
        label: '3.Qf3 pressure',
        idea: 'The early queen adds pressure but does not stop Black from resolving the center. Exchange on e4, then develop against the centralized pieces.',
        responseNote: 'dxe4 challenges the center immediately; after Nxe4, Nf6 develops with tempo against White’s active setup.'
      },
      e4d5: {
        responseId: 'two-knights-exchange',
        teachingOwnerLineId: 'two-knights',
        continuation: ['d2d4', 'g8f6'],
        label: '3.exd5 exchange',
        idea: 'White releases the tension before playing d4. Recapture with the c-pawn and use the developed c3-knight as a target for normal active development.',
        responseNote: 'cxd5 restores the pawn and reaches an Exchange-style center without changing Black’s basic development priorities.'
      },
      d2d3: {
        responseId: 'two-knights-d3',
        teachingOwnerLineId: 'two-knights',
        continuation: ['d3e4'],
        label: '3.d3 support',
        idea: 'White supports e4 with the d-pawn rather than occupying d4. Resolve the central tension now instead of allowing White to build a protected center.',
        responseNote: 'dxe4 forces White to define the center and keeps Black’s development uncomplicated.'
      }
    }
  }
};
