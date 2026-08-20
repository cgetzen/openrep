const FILES = 'abcdefgh';
const PIECE_TO_FEN = { p: 'p', n: 'n', b: 'b', r: 'r', q: 'q', k: 'k' };

export function miniChessToFen(chess) {
  const ranks = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    let empty = 0;
    let row = '';
    for (const file of FILES) {
      const piece = chess.get(`${file}${rank}`);
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      const letter = PIECE_TO_FEN[piece.type];
      row += piece.color === 'w' ? letter.toUpperCase() : letter;
    }
    if (empty) row += String(empty);
    ranks.push(row);
  }

  const rights = [];
  if (chess.castling?.w?.k) rights.push('K');
  if (chess.castling?.w?.q) rights.push('Q');
  if (chess.castling?.b?.k) rights.push('k');
  if (chess.castling?.b?.q) rights.push('q');

  let enPassant = '-';
  const last = chess.history?.at?.(-1);
  if (last?.uci) {
    const from = last.uci.slice(0, 2);
    const to = last.uci.slice(2, 4);
    const piece = chess.get(to);
    if (piece?.type === 'p' && from[0] === to[0] && Math.abs(Number(from[1]) - Number(to[1])) === 2) {
      enPassant = `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}`;
    }
  }

  const fullmove = Math.floor((chess.history?.length ?? 0) / 2) + 1;
  return `${ranks.join('/')} ${chess.turn()} ${rights.join('') || '-'} ${enPassant} 0 ${fullmove}`;
}
