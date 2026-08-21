import { normalizeTeachingProse } from './teaching-copy.js';

const PIECE_NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const EXPLANATION_FILES = 'abcdefgh';

function sideName(color) {
  return color === 'w' ? 'White' : 'Black';
}

function allSquares() {
  const squares = [];
  for (const file of EXPLANATION_FILES) for (let rank = 1; rank <= 8; rank += 1) squares.push(`${file}${rank}`);
  return squares;
}

function capturesOn(chess, targetSquare) {
  return allSquares().flatMap(from => {
    const piece = chess.get(from);
    if (!piece || piece.color !== chess.turn()) return [];
    if (!chess.legalDestinations(from).includes(targetSquare)) return [];
    const uci = `${from}${targetSquare}`;
    return [{ from, to: targetSquare, uci, san: chess.notationFor(uci), piece }];
  }).sort((a, b) => PIECE_VALUE[a.piece.type] - PIECE_VALUE[b.piece.type]);
}

function canRecapture(chessAfterCapture, targetSquare) {
  return capturesOn(chessAfterCapture, targetSquare).length > 0;
}

export function explainWrongMove(chess, attemptedUci, expectedUci, expectedNote = '') {
  const preview = chess.clone();
  let attemptedMove;
  try {
    attemptedMove = preview.moveUci(attemptedUci);
  } catch {
    return {
      kind: 'illegal',
      message: 'That move is not legal in this position.',
      arrow: null
    };
  }

  const movedPiece = preview.get(attemptedMove.to);
  const opponent = sideName(preview.turn());
  const expectedSan = chess.notationFor(expectedUci);
  const teachingNote = normalizeTeachingProse(expectedNote);
  const captures = capturesOn(preview, attemptedMove.to);

  for (const capture of captures) {
    const afterCapture = preview.clone();
    afterCapture.moveUci(capture.uci);
    if (canRecapture(afterCapture, attemptedMove.to)) continue;

    const pieceName = PIECE_NAME[movedPiece?.type] ?? 'piece';
    const plan = teachingNote ? ` ${expectedSan} is the repertoire choice: ${teachingNote}` : ` The repertoire move is ${expectedSan}.`;
    return {
      kind: 'hanging-piece',
      message: `Why this is bad: ${attemptedMove.san} leaves the ${pieceName} on ${attemptedMove.to} hanging. ${opponent} can play ${capture.san} and you cannot recapture.${plan}`,
      arrow: { from: capture.from, to: capture.to },
      response: capture.san
    };
  }

  const plan = teachingNote
    ? `${expectedSan} is the repertoire choice here: ${teachingNote}`
    : `${expectedSan} is the repertoire move here.`;
  return {
    kind: 'strategic',
    message: `${attemptedMove.san} is not the move this line teaches. ${plan}`,
    arrow: null
  };
}
