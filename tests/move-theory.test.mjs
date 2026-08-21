import test from 'node:test';
import assert from 'node:assert/strict';
import { MiniChess } from '../src/mini-chess.js';
import { miniChessToFen } from '../src/position-fen.js';
import { MoveTheoryIndex } from '../src/move-theory.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKannMoveTheory, caroKannLessonDecisions } from '../src/openings/caro-kann-theory.js';

function courseWithTheory(overrides = {}) {
  return {
    ...caroKann,
    moveTheory: caroKannMoveTheory,
    lessonDecisions: caroKannLessonDecisions,
    ...overrides
  };
}

test('every full Caro-Kann line has a unique completion takeaway and primary move theory', () => {
  const index = new MoveTheoryIndex(courseWithTheory());
  const decisions = caroKann.lines.map(line => {
    const terminalPly = line.moves.length - 1;
    const decision = index.decisionForLine(line.id, terminalPly);
    assert.ok(decision, `${line.id} is missing a completion lesson`);
    assert.equal(decision.primaryMove, line.moves[terminalPly]);
    assert.equal(decision.choices[0].role, 'primary');
    assert.ok(decision.choices[0].theory.rationale.length > 0);
    assert.doesNotMatch(decision.objective, /\.\.\.(?=[A-Za-z0-9])/);
    assert.doesNotMatch(decision.choices[0].theory.rationale, /\.\.\.(?=[A-Za-z0-9])/);
    return decision;
  });

  assert.equal(decisions.length, caroKann.lines.length);
  assert.equal(new Set(decisions.map(decision => decision.objective)).size, caroKann.lines.length);

  const decisionsWithAcceptedMoves = decisions.filter(decision => decision.acceptedMoves.length > 0);
  assert.deepEqual(
    decisionsWithAcceptedMoves.map(decision => [decision.lineId, decision.acceptedMoves]),
    [['early-nf3', ['c8g4']]]
  );

  const exactOnlyDecision = index.decisionForLine('advance-main', 13);
  assert.deepEqual(exactOnlyDecision.acceptedMoves, []);
  assert.deepEqual(exactOnlyDecision.choices.map(choice => choice.role), ['primary']);
});

test('every Black decision in every Caro-Kann branch has a non-answer strategic cue', () => {
  const index = new MoveTheoryIndex(courseWithTheory());
  let decisionCount = 0;

  for (const line of caroKann.lines) {
    const chess = new MiniChess();
    for (let ply = 0; ply < line.moves.length; ply += 1) {
      const move = line.moves[ply];
      if (chess.turn() === caroKann.side) {
        const theory = index.theoryAt(miniChessToFen(chess), move);
        assert.ok(theory?.cue, `${line.id} ply ${ply} is missing a decision cue`);
        assert.doesNotMatch(theory.cue, /\.\.\.(?=[A-Za-z0-9])/);
        if (theory.rationale) assert.doesNotMatch(theory.rationale, /\.\.\.(?=[A-Za-z0-9])/);
        const answer = chess.notationFor(move);
        assert.equal(
          theory.cue.includes(answer),
          false,
          `${line.id} ply ${ply} cue reveals the expected move ${answer}`
        );
        decisionCount += 1;
      }
      chess.moveUci(move);
    }
  }

  assert.equal(decisionCount, 91);
});

test('the same position can teach different strategic cues for different repertoire choices', () => {
  const index = new MoveTheoryIndex(courseWithTheory());
  const advance = caroKann.lines.find(line => line.id === 'advance-main');
  const chess = new MiniChess();
  for (const move of advance.moves.slice(0, 5)) chess.moveUci(move);
  const position = miniChessToFen(chess);

  const bishopCue = index.cueAt(position, 'c8f5');
  const immediateBreakCue = index.cueAt(position, 'c6c5');
  assert.ok(bishopCue);
  assert.ok(immediateBreakCue);
  assert.notEqual(bishopCue, immediateBreakCue);
  assert.match(bishopCue, /light bishop/);
  assert.match(immediateBreakCue, /Challenge d4 immediately/);
});

test('terminal decision keeps primary repertoire move separate from accepted moves', () => {
  const index = new MoveTheoryIndex(courseWithTheory());
  const decision = index.decisionForLine('early-nf3', 11);

  assert.equal(decision.objective, 'Activate the light-squared bishop before e6.');
  assert.equal(decision.primaryMove, 'c8f5');
  assert.deepEqual(decision.acceptedMoves, ['c8g4']);
  assert.deepEqual(
    decision.choices.map(choice => [choice.notation, choice.role]),
    [['Bf5', 'primary'], ['Bg4', 'accepted']]
  );
  assert.match(decision.choices[0].theory.rationale, /outside the pawn chain/);
  assert.match(decision.choices[1].theory.rationale, /pin/);

  const line = caroKann.lines.find(candidate => candidate.id === 'early-nf3');
  const chess = new MiniChess();
  for (const move of line.moves.slice(0, 11)) chess.moveUci(move);
  assert.equal(
    index.decisionForLinePosition('early-nf3', miniChessToFen(chess), 'c8f5')?.id,
    decision.id
  );
});

test('move theory identity follows canonical position rather than move order', () => {
  const lineA = {
    id: 'a',
    moves: ['g1f3', 'g8f6', 'b1c3', 'b8c6', 'e2e4', 'e7e5', 'f1c4']
  };
  const lineB = {
    id: 'b',
    moves: ['b1c3', 'b8c6', 'g1f3', 'g8f6', 'e2e4', 'e7e5', 'f1c4']
  };
  const course = {
    id: 'theory-transposition',
    side: 'w',
    lines: [lineA, lineB],
    moveTheory: [
      {
        anchor: { lineId: 'a', ply: 6 },
        move: 'f1c4',
        cue: 'Develop actively toward the vulnerable kingside.',
        rationale: 'Develop with pressure on f7.'
      }
    ],
    lessonDecisions: []
  };
  const index = new MoveTheoryIndex(course);
  const chess = new MiniChess();
  for (const move of lineB.moves.slice(0, 6)) chess.moveUci(move);

  const theory = index.theoryAt(miniChessToFen(chess), 'f1c4');
  assert.ok(theory);
  assert.equal(theory.notation, 'Bc4');
  assert.match(theory.cue, /Develop actively/);
});

test('shared authoring anchors collapse into one canonical move theory record', () => {
  const index = new MoveTheoryIndex(courseWithTheory());
  const chess = new MiniChess();
  chess.moveUci('e2e4');

  const theory = index.theoryAt(miniChessToFen(chess), 'c7c6');
  assert.ok(theory);
  assert.equal(theory.cue, 'Prepare to challenge White’s center with d5.');
  assert.equal(theory.authoringAnchors.length, caroKann.lines.length);
});

test('move theory normalizes black-move ellipsis before canonical comparison', () => {
  const base = caroKannMoveTheory[0];
  const duplicate = {
    ...base,
    anchor: { lineId: 'advance-tal', ply: 1 },
    cue: 'Prepare to challenge White’s center with d5.'
  };

  assert.doesNotThrow(() => new MoveTheoryIndex(courseWithTheory({
    moveTheory: [...caroKannMoveTheory, duplicate]
  })));
});

test('lesson decisions fail fast when an accepted move has no theory', () => {
  const course = courseWithTheory({
    moveTheory: caroKannMoveTheory.filter(entry => entry.move !== 'c8g4')
  });

  assert.throws(
    () => new MoveTheoryIndex(course),
    /missing move theory for c8g4/
  );
});

test('conflicting teaching copy for the same position and move is rejected', () => {
  const conflict = {
    ...caroKannMoveTheory[0],
    anchor: { lineId: 'advance-tal', ply: 1 },
    cue: 'A conflicting strategic instruction.'
  };
  const course = courseWithTheory({
    moveTheory: [...caroKannMoveTheory, conflict]
  });

  assert.throws(
    () => new MoveTheoryIndex(course),
    /Conflicting move theory cue/
  );
});
