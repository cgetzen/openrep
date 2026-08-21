import { caroKann } from './caro-kann.js';

const cue = {
  caroStart: 'Prepare to challenge White’s center with ...d5.',
  d4Challenge: 'Challenge White’s pawn center before it can consolidate.',
  advanceBishop: 'White has advanced the center. Activate the light bishop before closing it in.',
  exchangeRecapture: 'Restore the pawn while keeping a balanced central structure.'
};

const caroKannDecisionCues = {
  'advance-main': {
    1: cue.caroStart,
    3: cue.d4Challenge,
    5: cue.advanceBishop,
    7: 'Stabilize the center and prepare the thematic attack on d4.',
    9: 'Strike at the base of White’s advanced center before it becomes comfortable.',
    11: 'Develop with pressure on d4 and support the central counterplay.',
    13: 'Keep development flexible and prepare more pressure on the center.'
  },
  'advance-tal': {
    1: cue.caroStart,
    3: cue.d4Challenge,
    5: cue.advanceBishop,
    7: 'White is trying to chase your bishop. Stop the pawn advance without giving up the bishop.',
    9: 'White has offered a trade while your bishop is a target. Resolve it before losing time.',
    11: 'Secure the center and open the path to complete development.',
    13: 'Attack d4, the base of White’s space advantage.'
  },
  'advance-bayonet': {
    1: cue.caroStart,
    3: cue.d4Challenge,
    5: cue.advanceBishop,
    7: 'Prepare a safe retreat for the bishop and the standard central break.',
    9: 'Preserve the bishop and let White spend tempi on pawn expansion.',
    11: 'Counter in the center before White’s kingside expansion becomes dangerous.',
    13: 'Challenge the pawn chain before White can roll it forward.'
  },
  'classical-main': {
    1: cue.caroStart,
    3: cue.d4Challenge,
    5: 'Resolve the central tension while White’s knight can recapture into an exposed square.',
    7: 'Develop actively with tempo against the centralized knight.',
    9: 'Keep the bishop active while making White spend more time to chase it.',
    11: 'Give the bishop a safe retreat before White’s h-pawn gains more space.',
    13: 'Finish developing behind the compact center and prepare ...Ngf6.',
    15: 'Keep the bishop safe without abandoning its useful diagonal.'
  },
  'exchange-main': {
    1: cue.caroStart,
    3: cue.d4Challenge,
    5: cue.exchangeRecapture,
    7: 'Develop toward d4 and keep central breaks available.',
    9: 'Develop naturally and prepare to castle.',
    11: 'Avoid passive symmetry; develop actively by creating a useful pin.',
    13: 'Meet the pressure on b7 while keeping the queenside coordinated.'
  },
  'panov-main': {
    1: cue.caroStart,
    3: cue.d4Challenge,
    5: cue.exchangeRecapture,
    7: 'Develop quickly and pressure the center instead of trying to hold it with pawns.',
    9: 'Build a solid center and prepare the isolated-pawn structure on favorable terms.',
    11: 'Develop with pressure on the knight that supports White’s center.',
    13: 'Recapture to keep active piece play even if it leaves an isolated pawn.',
    15: 'Secure the king before turning to pressure against White’s center.'
  },
  'two-knights': {
    1: cue.caroStart,
    3: 'Challenge e4 before White’s pieces can fully support it.',
    5: 'Use White’s knight placement to develop the light bishop actively before ...e6.',
    7: 'White is spending a tempo to question the bishop. Resolve the tension rather than retreat passively.',
    9: 'Build a sound center now that the bishop has done its job.',
    11: 'Increase pressure on e4 while completing natural development.',
    13: 'The center is ready to simplify. Remove White’s e-pawn before it can advance or be reinforced.'
  },
  'fantasy': {
    1: cue.caroStart,
    3: cue.d4Challenge,
    5: 'White has committed f3. Stay solid and reinforce the center rather than overreact.',
    7: 'Develop with pressure on the knight that supports White’s center.',
    9: 'Keep the bishop and prepare to castle rather than spending more tempi on the pin.',
    11: 'Develop with pressure on e4 and add another defender to the center.',
    13: 'White has advanced. Reroute pieces toward squares that can challenge the pawn chain.'
  },
  'hillbilly': {
    1: cue.caroStart,
    3: 'White’s bishop moved early. Challenge e4 immediately and gain time from the exposed bishop.',
    5: 'Restore the pawn and claim central presence.',
    7: 'Develop naturally while meeting the bishop’s interference.',
    9: 'Develop with pressure on the center rather than spending tempi chasing the bishop.',
    11: 'Use the extra time to activate the light bishop before ...e6.'
  },
  'quiet-d3': {
    1: cue.caroStart,
    3: 'White has declined to occupy the center. Claim equal central space immediately.',
    5: 'Take the extra central space White has left available.',
    7: 'Develop to support the broad center and prepare kingside safety.',
    9: 'Complete natural development while holding the center.',
    11: 'Secure the king; the opening has given Black an easy, stable setup.'
  },
  'early-nf3': {
    1: cue.caroStart,
    3: 'White’s move order changes little. Challenge e4 on principle.',
    5: 'Restore the pawn and settle into an Exchange-like structure.',
    7: 'Develop with pressure on d4.',
    9: 'Meet the pin with normal development instead of making concessions.',
    11: 'Activate the light-squared bishop before ...e6.'
  },
  'advance-early-c5': {
    1: cue.caroStart,
    3: cue.d4Challenge,
    5: 'White has advanced the center. Challenge d4 immediately instead of committing the bishop first.',
    7: 'Add another attacker to d4 and keep the pressure growing.',
    9: 'Develop actively by using the f3-knight as a target.',
    11: 'Reinforce the center and open the dark bishop while maintaining pressure.',
    13: 'Keep development flexible and support ...Nf5 without blocking the f-pawn.'
  },
  'accelerated-panov': {
    1: cue.caroStart,
    3: 'White has challenged the center immediately with c4. Meet it directly with d5.',
    5: 'Restore the central pawn with the c-pawn and keep the position open for active piece play.',
    7: 'Do not expose the queen to a developing tempo. Develop Nf6 and attack the temporary d5-pawn first.',
    9: 'The knight is developed and the pawn is still isolated. Recover d5 now without losing time.',
    11: 'Simplify White’s most active queenside piece before completing development.',
    13: 'The d-file has opened. Trade queens to remove White’s remaining initiative.',
    15: 'Finish natural development after the central liquidation; Black has equal material and an easy game.'
  }
};

const completionRationale = {
  'advance-main': 'Develops without blocking the f-pawn and supports ...Ng6, where the knight can add pressure to White’s center.',
  'advance-tal': 'Strikes at d4, the base of White’s advanced center, before White can consolidate the extra space.',
  'advance-bayonet': 'Challenges White’s kingside pawn chain immediately and prevents h5 from gaining more space for free.',
  'classical-main': 'Completes the standard bishop retreat, keeping the bishop safe while Black finishes development behind a compact structure.',
  'exchange-main': 'Defends b7, connects the queenside pieces, and keeps Black coordinated in the symmetrical Exchange structure.',
  'panov-main': 'Secures the king and connects the rook before Black turns fully to pressure against the isolated d-pawn.',
  'two-knights': 'Uses the moment to remove White’s central pawn and simplify after Black’s pieces are developed to pressure e4.',
  'fantasy': 'Reroutes the knight toward c5 or e5, where it can challenge White’s advanced center instead of being pushed around.',
  'hillbilly': 'Develops the light-squared bishop actively before ...e6, using the time White spent on the early bishop sortie.',
  'quiet-d3': 'Completes development and secures the king after Black has comfortably claimed central space.',
  'early-nf3': 'Develops the light-squared bishop outside the pawn chain before ...e6 while keeping the bishop flexible.',
  'advance-early-c5': 'Develops toward f5 or g6 while keeping the f-pawn free, reinforcing the flexible pressure created by the early ...c5 setup.',
  'accelerated-panov': 'Develops the last queenside minor piece after the tactical liquidation, leaving Black with equal material and no exposed queen to target.'
};

export const caroKannMoveTheory = caroKann.lines.flatMap(line => {
  const cues = caroKannDecisionCues[line.id] ?? {};
  const terminalPly = line.moves.length - 1;
  return Object.entries(cues).map(([rawPly, decisionCue]) => {
    const ply = Number(rawPly);
    const entry = {
      anchor: { lineId: line.id, ply },
      move: line.moves[ply],
      cue: decisionCue,
      source: 'curated'
    };
    if (ply === terminalPly) entry.rationale = completionRationale[line.id];
    return entry;
  });
});

caroKannMoveTheory.push({
  anchor: { lineId: 'early-nf3', ply: 11 },
  move: 'c8g4',
  cue: caroKannDecisionCues['early-nf3'][11],
  rationale: 'Also develops the bishop before ...e6, using the knight on f3 as a target and creating a pin.',
  source: 'curated'
});

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
  },
  {
    id: 'accelerated-panov-completion',
    anchor: { lineId: 'accelerated-panov', ply: 15 },
    objective: 'Meet c4 with ...d5, recover the temporary d5-pawn through development, and simplify without giving White tempi on the queen.'
  }
];
