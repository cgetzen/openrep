export const caroKannCurriculum = {
  schemaVersion: 1,
  courseId: 'caro-kann-black',
  presentation: {
    eyebrow: 'Curriculum map',
    title: 'Coverage-driven repertoire',
    summary: 'Core first, then common coverage gaps. Rare sidelines and alternative repertoire systems stay available without crowding the primary path.'
  },
  evidence: {
    source: '365Chess with Lichess/opening-theory cross-check',
    snapshotDate: '2026-08-21',
    cohort: 'Practical reference; percentages vary by rating and time control',
    note: 'Frequency evidence guides curriculum priority only. It is not chess-position identity or learner-progress identity.'
  },
  tiers: [
    {
      id: 'core',
      label: 'Core',
      coverageGoal: 80,
      description: 'Primary systems that cover the bulk of practical Caro-Kann encounters.'
    },
    {
      id: 'important',
      label: 'Important',
      coverageGoal: 95,
      description: 'Common independent choices that push practical coverage toward 95%.'
    },
    {
      id: 'sideline',
      label: 'Sideline',
      description: 'Distinct lower-frequency systems worth recognizing after the core is stable.'
    },
    {
      id: 'on-demand',
      label: 'On demand',
      description: 'Rare material and sound alternative repertoire choices that should not crowd the primary learning path.'
    }
  ],
  families: [
    {
      id: 'advance-c5',
      tier: 'core',
      title: 'Advance — ...c5 system',
      role: 'Primary repertoire',
      recognition: 'White locks the center with 3.e5.',
      plan: 'Challenge d4 immediately with ...c5 and make White define the center before developing around it.',
      lineIds: ['advance-early-c5'],
      responseIds: ['advance-c5-dxc5', 'advance-c5-nf3'],
      evidence: {
        label: '≈96% of replies',
        detail: '4.dxc5, 4.Nf3, and 4.c3 together cover roughly 96.5% of sampled replies after 3...c5.',
        threshold: 95,
        percent: 96.5
      }
    },
    {
      id: 'classical',
      tier: 'core',
      title: 'Classical / 3.Nd2',
      role: 'Transposition cluster',
      recognition: 'White develops the queen knight with 3.Nc3 or 3.Nd2 instead of advancing or exchanging the e-pawn.',
      plan: 'Resolve the center with ...dxe4; after Nxe4, both move orders reach the same Classical position.',
      lineIds: ['classical-main'],
      responseIds: ['classical-nd2-transposition'],
      evidence: {
        label: '≈41% after 2...d5',
        detail: '3.Nc3 and 3.Nd2 together represent roughly 40.8% of sampled continuations after 2...d5.'
      }
    },
    {
      id: 'exchange-family',
      tier: 'core',
      title: 'Exchange family',
      role: 'Pawn-structure cluster',
      recognition: 'White exchanges on d5; c4 determines whether the game becomes a Panov/IQP structure.',
      plan: 'Recapture with ...cxd5, then distinguish Panov c4 from normal Exchange development.',
      lineIds: ['exchange-main', 'panov-main'],
      responseIds: ['exchange-nf3', 'exchange-c3'],
      evidence: {
        label: '≈97% of replies',
        detail: 'Panov c4, Bd3, Nf3, and c3 cover roughly 96.9% of sampled replies after 3.exd5 cxd5.',
        threshold: 95,
        percent: 96.9
      }
    },
    {
      id: 'early-knights',
      tier: 'core',
      title: 'Early knight systems',
      role: 'Move-order cluster',
      recognition: 'White develops Nc3 or Nf3 before committing to the normal d4 move order.',
      plan: 'Challenge e4 with ...d5 and recognize when the move order transposes into Two Knights or Exchange structures.',
      lineIds: ['two-knights', 'early-nf3'],
      responseIds: [],
      evidence: {
        label: 'Common move orders',
        detail: '2.Nc3 and 2.Nf3 are the main alternatives to an immediate 2.d4 in practical databases.'
      }
    },
    {
      id: 'accelerated-panov',
      tier: 'important',
      title: '2.c4 — Accelerated Panov',
      role: 'Top-level opponent decision',
      recognition: 'White plays c4 immediately instead of building the normal d4 center.',
      plan: 'Meet c4 with ...d5, then recover the temporary d5-pawn with ...Nf6 and ...Nxd5 rather than exposing the queen too early.',
      lineIds: ['accelerated-panov'],
      responseIds: [],
      evidence: {
        label: '≈4–5% of Caro-Kanns',
        detail: '2.c4 is materially more common than most named sidelines and belongs in the practical-coverage layer.'
      }
    },
    {
      id: 'quiet-d3',
      tier: 'important',
      title: '2.d3 — Quiet system',
      role: 'Top-level opponent decision',
      recognition: 'White declines to occupy d4 and keeps the position low-contact.',
      plan: 'Take the center with ...d5 and ...e5, then develop without concessions.',
      lineIds: ['quiet-d3'],
      responseIds: [],
      evidence: {
        label: '≈3% of Caro-Kanns',
        detail: 'A modest but recurring top-level choice that requires a different central plan.'
      }
    },
    {
      id: 'fantasy',
      tier: 'sideline',
      title: 'Fantasy Variation',
      role: 'Distinct sideline',
      recognition: 'White supports e4 with f3 and accepts slower kingside development.',
      plan: 'Stay solid, pressure the center, and exploit the time White spends supporting it.',
      lineIds: ['fantasy'],
      responseIds: [],
      evidence: {
        label: '≈3% after 2...d5',
        detail: 'Distinct enough strategically to teach, but lower-frequency than 3.Nd2.'
      }
    },
    {
      id: 'hillbilly',
      tier: 'on-demand',
      title: 'Hillbilly Attack',
      role: 'Rare sideline',
      recognition: 'White develops Bc4 before building a center.',
      plan: 'Challenge e4 immediately and gain tempi from the early bishop placement.',
      lineIds: ['hillbilly'],
      responseIds: [],
      evidence: {
        label: 'Rare',
        detail: 'Useful to know, but not important enough to sit beside the major systems in the primary path.'
      }
    },
    {
      id: 'advance-bf5-alternative',
      tier: 'on-demand',
      title: 'Advance — ...Bf5 alternative',
      role: 'Alternative repertoire',
      recognition: 'After 3.e5, Black chooses the traditional bishop-first system instead of the primary ...c5 repertoire.',
      plan: 'Develop the bishop outside the pawn chain, then handle White’s bishop-chasing setups and strike with ...c5 later.',
      lineIds: ['advance-main', 'advance-tal', 'advance-bayonet'],
      responseIds: ['advance-quiet-be2'],
      evidence: {
        label: 'Sound, larger tree',
        detail: 'The existing Nf3, h4, and Nc3 leaves cover only about 70% of sampled replies after 3...Bf5, so this stays available without defining the core curriculum.'
      }
    }
  ],
  concepts: [
    {
      id: 'central-counterplay',
      title: 'Central counterplay',
      description: 'Recognize when Black should challenge White’s center with ...d5 or ...c5 rather than react on the flank.',
      lineIds: ['advance-early-c5', 'advance-main', 'advance-tal', 'advance-bayonet', 'quiet-d3', 'accelerated-panov'],
      responseIds: ['advance-c5-dxc5', 'advance-c5-nf3']
    },
    {
      id: 'transposition-recognition',
      title: 'Transposition recognition',
      description: 'Different move orders can reach the same decision position and should share the same chess identity.',
      lineIds: ['classical-main', 'two-knights', 'early-nf3'],
      responseIds: ['classical-nd2-transposition']
    },
    {
      id: 'exchange-structures',
      title: 'Exchange structures',
      description: 'Distinguish symmetrical Exchange play from Panov/IQP structures by White’s c-pawn commitment.',
      lineIds: ['exchange-main', 'panov-main', 'early-nf3', 'accelerated-panov'],
      responseIds: ['exchange-nf3', 'exchange-c3']
    },
    {
      id: 'iqp-play',
      title: 'Isolated queen pawn play',
      description: 'Recognize when c4 and central exchanges lead to IQP positions and active piece play.',
      lineIds: ['panov-main'],
      responseIds: []
    }
  ]
};
