export const caroKann = {
  id: 'caro-kann-black',
  name: 'Caro-Kann Defense',
  side: 'b',
  tagline: 'A practical Black repertoire against 1.e4',
  description:
    'Build a durable Caro-Kann repertoire by learning recurring ideas: challenge the center with ...d5, develop the light bishop before ...e6 when possible, and reach familiar structures against White’s major systems.',
  lines: [
    {
      id: 'advance-main',
      title: 'Advance — Main setup',
      variation: '1.e4 c6 2.d4 d5 3.e5 Bf5',
      summary: 'Develop outside the pawn chain, then attack White’s center with ...c5.',
      moves: ['e2e4','c7c6','d2d4','d7d5','e4e5','c8f5','g1f3','e7e6','f1e2','c6c5','e1g1','b8c6','c2c3','g8e7'],
      notes: {
        1: '1...c6 prepares ...d5 while keeping the c-pawn available to reinforce or challenge the center.',
        3: '2...d5 immediately contests e4. This is the strategic backbone of the Caro-Kann.',
        5: '3...Bf5 gets the light-squared bishop outside the pawn chain before ...e6.',
        7: '4...e6 stabilizes d5 and opens the dark-squared bishop.',
        9: '5...c5 is the thematic break. Attack the base and sides of White’s advanced center.',
        11: '6...Nc6 increases pressure on d4 and supports queenside pressure.',
        13: '7...Nge7 keeps options flexible and supports ...Ng6 without committing the f-pawn.'
      }
    },
    {
      id: 'advance-tal',
      title: 'Advance — h4 / Tal ideas',
      variation: '1.e4 c6 2.d4 d5 3.e5 Bf5 4.h4 h5',
      summary: 'Meet the bishop chase without panicking; hold the bishop and undermine later.',
      moves: ['e2e4','c7c6','d2d4','d7d5','e4e5','c8f5','h2h4','h7h5','f1d3','f5d3','d1d3','e7e6','g1f3','c6c5'],
      notes: {
        1: '1...c6 begins the Caro-Kann structure.',
        3: '2...d5 challenges e4 before White can consolidate.',
        5: '3...Bf5 activates the bishop before ...e6.',
        7: '4...h5 prevents h5 from trapping the bishop and fixes White’s kingside pawn structure.',
        9: '5...Bxd3 trades the bishop before it becomes a target.',
        11: '6...e6 secures the center and clears development.',
        13: '7...c5 attacks d4, the usual source of White’s space advantage.'
      }
    },
    {
      id: 'advance-bayonet',
      title: 'Advance — Bayonet',
      variation: '1.e4 c6 2.d4 d5 3.e5 Bf5 4.Nc3 e6 5.g4 Bg6',
      summary: 'Retreat efficiently, then strike the center before White’s kingside expansion becomes dangerous.',
      moves: ['e2e4','c7c6','d2d4','d7d5','e4e5','c8f5','b1c3','e7e6','g2g4','f5g6','g1e2','c6c5','h2h4','h7h5'],
      notes: {
        1: '1...c6 supports the coming ...d5 challenge.',
        3: '2...d5 takes direct aim at e4.',
        5: '3...Bf5 gets the bishop active early.',
        7: '4...e6 gives the bishop a safe g6 retreat and prepares the standard ...c5 break.',
        9: '5...Bg6 preserves the bishop pair and lets White spend tempi on pawns.',
        11: '6...c5 is urgent counterplay against d4.',
        13: '7...h5 challenges the pawn chain before White can simply roll forward.'
      }
    },
    {
      id: 'classical-main',
      title: 'Classical — 4...Bf5',
      variation: '1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5',
      summary: 'Exchange the e-pawn, activate the bishop, and build a compact position.',
      moves: ['e2e4','c7c6','d2d4','d7d5','b1c3','d5e4','c3e4','c8f5','e4g3','f5g6','h2h4','h7h6','g1f3','b8d7','h4h5','g6h7'],
      notes: {
        1: '1...c6 keeps the position flexible.',
        3: '2...d5 challenges the center immediately.',
        5: '3...dxe4 resolves the central tension on favorable terms.',
        7: '4...Bf5 develops with tempo on the centralized knight.',
        9: '5...Bg6 keeps the bishop active and invites White’s h-pawn forward.',
        11: '6...h6 gives the bishop h7 and prevents h5-h6 from gaining more space for free.',
        13: '7...Nd7 supports ...Ngf6 and reinforces the compact Caro-Kann structure.',
        15: '8...Bh7 completes the standard bishop maneuver.'
      }
    },
    {
      id: 'exchange-main',
      title: 'Exchange — Active development',
      variation: '1.e4 c6 2.d4 d5 3.exd5 cxd5',
      summary: 'The structure is symmetrical, so prioritize activity and development speed.',
      moves: ['e2e4','c7c6','d2d4','d7d5','e4d5','c6d5','f1d3','b8c6','c2c3','g8f6','c1f4','c8g4','d1b3','d8d7'],
      notes: {
        1: '1...c6 prepares the central break.',
        3: '2...d5 challenges White’s pawn duo.',
        5: '3...cxd5 restores material and produces the characteristic symmetrical Exchange structure.',
        7: '4...Nc6 develops toward d4 and keeps ...e5 ideas available.',
        9: '5...Nf6 develops naturally and prepares quick kingside castling.',
        11: '6...Bg4 develops actively instead of passively mirroring White.',
        13: '7...Qd7 calmly defends b7 and connects the queenside pieces.'
      }
    },
    {
      id: 'panov-main',
      title: 'Panov Attack',
      variation: '1.e4 c6 2.d4 d5 3.exd5 cxd5 4.c4 Nf6',
      summary: 'Pressure the isolated d-pawn and develop rapidly rather than trying to hold everything with pawns.',
      moves: ['e2e4','c7c6','d2d4','d7d5','e4d5','c6d5','c2c4','g8f6','b1c3','e7e6','g1f3','f8b4','c4d5','e6d5','f1d3','e8g8'],
      notes: {
        1: '1...c6 prepares ...d5.',
        3: '2...d5 fights for the center.',
        5: '3...cxd5 restores the pawn.',
        7: '4...Nf6 develops and pressures the center without committing the e-pawn too early.',
        9: '5...e6 builds the classic isolated-queen-pawn structure after exchanges.',
        11: '6...Bb4 pins the knight and adds pressure to White’s central setup.',
        13: '7...exd5 accepts an isolated d-pawn in exchange for active piece play.',
        15: '8...O-O finishes development before starting concrete play against d4.'
      }
    },
    {
      id: 'two-knights',
      title: 'Two Knights',
      variation: '1.e4 c6 2.Nc3 d5 3.Nf3 Bg4',
      summary: 'Pin the knight, trade when provoked, then challenge White’s center.',
      moves: ['e2e4','c7c6','b1c3','d7d5','g1f3','c8g4','h2h3','g4f3','d1f3','e7e6','d2d4','g8f6','f1d3','d5e4'],
      notes: {
        1: '1...c6 establishes the opening.',
        3: '2...d5 immediately challenges e4.',
        5: '3...Bg4 is an active answer before ...e6 shuts in the bishop.',
        7: '4...Bxf3 avoids losing time to h3 and creates a slight structural concession.',
        9: '5...e6 locks in a sound center after the bishop has done its job.',
        11: '6...Nf6 increases pressure on e4 and prepares normal development.',
        13: '7...dxe4 uses the moment to simplify White’s center.'
      }
    },
    {
      id: 'fantasy',
      title: 'Fantasy Variation',
      variation: '1.e4 c6 2.d4 d5 3.f3 e6',
      summary: 'Do not overreact to f3. Build a resilient center and develop with pressure.',
      moves: ['e2e4','c7c6','d2d4','d7d5','f2f3','e7e6','b1c3','f8b4','a2a3','b4e7','c1e3','g8f6','e4e5','f6d7'],
      notes: {
        1: '1...c6 starts with the normal Caro-Kann shell.',
        3: '2...d5 challenges the center.',
        5: '3...e6 reinforces d5 and keeps the position robust against White’s ambitious setup.',
        7: '4...Bb4 develops with a pin and asks White to spend a tempo resolving it.',
        9: '5...Be7 keeps the bishop and prepares to castle.',
        11: '6...Nf6 attacks e4 and adds another defender to the center.',
        13: '7...Nfd7 reroutes toward c5/e5 and immediately questions White’s advanced center.'
      }
    },
    {
      id: 'hillbilly',
      title: 'Hillbilly Attack',
      variation: '1.e4 c6 2.Bc4 d5',
      summary: 'Hit the center immediately; the early bishop sortie gives Black useful tempi.',
      moves: ['e2e4','c7c6','f1c4','d7d5','e4d5','c6d5','c4b5','b8c6','d2d4','g8f6','g1f3','c8f5'],
      notes: {
        1: '1...c6 keeps the Caro-Kann structure.',
        3: '2...d5 is the clean response: challenge e4 before White gains anything from Bc4.',
        5: '3...cxd5 restores the pawn with central presence.',
        7: '4...Nc6 develops and meets the bishop interference naturally.',
        9: '5...Nf6 develops with pressure on the center.',
        11: '6...Bf5 activates the bishop before ...e6.'
      }
    },
    {
      id: 'quiet-d3',
      title: '2.d3 — Quiet system',
      variation: '1.e4 c6 2.d3 d5',
      summary: 'Take the center White declined to occupy and develop without concessions.',
      moves: ['e2e4','c7c6','d2d3','d7d5','b1d2','e7e5','g1f3','f8d6','g2g3','g8f6','f1g2','e8g8'],
      notes: {
        1: '1...c6 keeps the usual Caro-Kann structure.',
        3: '2...d5 claims equal central space immediately.',
        5: '3...e5 creates a broad center because White has not challenged it.',
        7: '4...Bd6 develops toward the kingside and supports the center.',
        9: '5...Nf6 completes natural development.',
        11: '6...O-O secures the king and leaves Black with an easy game.'
      }
    },
    {
      id: 'early-nf3',
      title: '2.Nf3 — Flexible response',
      variation: '1.e4 c6 2.Nf3 d5',
      summary: 'Stay principled: challenge e4 and transpose into familiar structures.',
      moves: ['e2e4','c7c6','g1f3','d7d5','e4d5','c6d5','d2d4','b8c6','f1b5','g8f6','e1g1','c8f5'],
      notes: {
        1: '1...c6 sets up ...d5.',
        3: '2...d5 is still the point of the opening; White’s move order changes little.',
        5: '3...cxd5 restores the pawn and reaches an Exchange-like structure.',
        7: '4...Nc6 develops with pressure on d4.',
        9: '5...Nf6 meets the pin with normal development.',
        11: '6...Bf5 gets the bishop active before ...e6.'
      }
    },
    {
      id: 'advance-early-c5',
      title: 'Advance — Immediate counterplay',
      variation: '1.e4 c6 2.d4 d5 3.e5 c5',
      summary: 'A direct alternative: challenge d4 immediately and force White to define the center.',
      moves: ['e2e4','c7c6','d2d4','d7d5','e4e5','c6c5','c2c3','b8c6','g1f3','c8g4','f1e2','e7e6','e1g1','g8e7'],
      notes: {
        1: '1...c6 starts the Caro-Kann.',
        3: '2...d5 challenges e4.',
        5: '3...c5 attacks d4 immediately. This line emphasizes central counterplay over bishop development.',
        7: '4...Nc6 adds a second attacker to d4.',
        9: '5...Bg4 develops actively and increases pressure by pinning the f3-knight.',
        11: '6...e6 reinforces the center and opens the dark bishop.',
        13: '7...Nge7 supports ...Nf5 and keeps the f-pawn free.'
      }
    },
    {
      id: 'accelerated-panov',
      title: '2.c4 — Accelerated Panov',
      variation: '1.e4 c6 2.c4 d5 3.exd5 cxd5 4.cxd5 Nf6',
      summary: 'Challenge immediately, recover the temporary d5-pawn with development, then simplify into an easy game.',
      moves: ['e2e4','c7c6','c2c4','d7d5','e4d5','c6d5','c4d5','g8f6','b1c3','f6d5','g1f3','d5c3','d2c3','d8d1','e1d1','b8c6'],
      notes: {
        1: '1...c6 begins the Caro-Kann and prepares the central challenge.',
        3: '2...d5 meets White’s early c4 directly instead of giving up the center.',
        5: '3...cxd5 restores the central pawn and keeps the position open enough for active development.',
        7: '4...Nf6 is the key move. Develop with tempo on d5 instead of exposing the queen to Nc3.',
        9: '5...Nxd5 recovers the temporary pawn now that the knight can do it without losing time.',
        11: '6...Nxc3 simplifies White’s active queenside knight before completing development.',
        13: '7...Qxd1+ uses the open d-file to trade queens and remove White’s initiative.',
        15: '8...Nc6 finishes the opening with easy development and equal material.'
      }
    },
    {
      id: 'classical-burris',
      title: 'Classical — 5.Bd3 Burris Gambit',
      variation: '1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Bd3 Qxd4',
      summary: 'Accept the offered d-pawn, then give back queen tempi to consolidate the extra material and finish development.',
      moves: ['e2e4','c7c6','d2d4','d7d5','b1c3','d5e4','c3e4','c8f5','f1d3','d8d4','g1f3','d4d8','d1e2','e7e6','e1g1','f5e4','d3e4','g8f6','c1f4','b8d7'],
      notes: {
        1: '1...c6 keeps the Caro-Kann structure and prepares the central challenge.',
        3: '2...d5 contests White’s center immediately.',
        5: '3...dxe4 resolves the tension and draws the knight to e4.',
        7: '4...Bf5 develops with tempo against the centralized knight.',
        9: '5...Qxd4 accepts the Burris Gambit pawn instead of declining White’s compensation.',
        11: '6...Qd8 steps out of the developing tempo while keeping the extra pawn.',
        13: '7...e6 reinforces the position and opens the dark-squared bishop.',
        15: '8...Bxe4 removes the centralized knight and reduces White’s attacking momentum.',
        17: '9...Nf6 develops with tempo against the bishop on e4 and brings Black closer to castling.',
        19: '10...Nbd7 completes queenside development and leaves Black ready for Be7 and castling.'
      }
    }
  ]
};