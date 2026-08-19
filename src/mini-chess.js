const FILES = 'abcdefgh';
const PIECE_LETTER = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };

function coords(square) {
  if (!/^[a-h][1-8]$/.test(square)) throw new Error(`Bad square: ${square}`);
  return [FILES.indexOf(square[0]), Number(square[1]) - 1];
}

function squareAt(file, rank) {
  return `${FILES[file]}${rank + 1}`;
}

function clonePiece(piece) {
  return piece ? { ...piece } : null;
}

export class MiniChess {
  constructor() { this.reset(); }

  reset() {
    this.board = new Map();
    for (const file of FILES) {
      this.board.set(`${file}2`, { color: 'w', type: 'p' });
      this.board.set(`${file}7`, { color: 'b', type: 'p' });
    }
    const back = ['r','n','b','q','k','b','n','r'];
    back.forEach((type, i) => {
      this.board.set(`${FILES[i]}1`, { color: 'w', type });
      this.board.set(`${FILES[i]}8`, { color: 'b', type });
    });
    this.currentTurn = 'w';
    this.castling = { w: { k: true, q: true }, b: { k: true, q: true } };
    this.history = [];
  }

  clone() {
    const next = new MiniChess();
    next.board = new Map([...this.board].map(([sq, piece]) => [sq, clonePiece(piece)]));
    next.currentTurn = this.currentTurn;
    next.castling = JSON.parse(JSON.stringify(this.castling));
    next.history = [...this.history];
    return next;
  }

  turn() { return this.currentTurn; }
  get(square) { return clonePiece(this.board.get(square) ?? null); }

  legalDestinations(from) {
    const piece = this.get(from);
    if (!piece || piece.color !== this.currentTurn) return [];
    const result = [];
    for (const file of FILES) {
      for (let rank = 1; rank <= 8; rank += 1) {
        const to = `${file}${rank}`;
        if (to !== from && this.canMove(from, to, piece)) result.push(to);
      }
    }
    return result;
  }

  canMove(from, to, piece = this.get(from)) {
    if (!piece) return false;
    const target = this.get(to);
    if (target?.color === piece.color) return false;
    const [ff, fr] = coords(from);
    const [tf, tr] = coords(to);
    const df = tf - ff;
    const dr = tr - fr;
    const adf = Math.abs(df);
    const adr = Math.abs(dr);

    if (piece.type === 'p') {
      const dir = piece.color === 'w' ? 1 : -1;
      const startRank = piece.color === 'w' ? 1 : 6;
      if (df === 0 && dr === dir && !target) return true;
      if (df === 0 && dr === 2 * dir && fr === startRank && !target) {
        return !this.get(squareAt(ff, fr + dir));
      }
      return adf === 1 && dr === dir && Boolean(target && target.color !== piece.color);
    }

    if (piece.type === 'n') return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
    if (piece.type === 'k') {
      if (adf <= 1 && adr <= 1) return true;
      if (from === (piece.color === 'w' ? 'e1' : 'e8') && adr === 0 && adf === 2) {
        const side = df > 0 ? 'k' : 'q';
        if (!this.castling[piece.color][side]) return false;
        const rank = piece.color === 'w' ? 0 : 7;
        const rookFile = side === 'k' ? 7 : 0;
        const rook = this.get(squareAt(rookFile, rank));
        if (!rook || rook.color !== piece.color || rook.type !== 'r') return false;
        const betweenFiles = side === 'k' ? [5, 6] : [1, 2, 3];
        return betweenFiles.every(file => !this.get(squareAt(file, rank)));
      }
      return false;
    }

    const diagonal = adf === adr && adf > 0;
    const straight = (df === 0) !== (dr === 0);
    if (piece.type === 'b' && !diagonal) return false;
    if (piece.type === 'r' && !straight) return false;
    if (piece.type === 'q' && !(diagonal || straight)) return false;
    return this.pathClear(ff, fr, tf, tr);
  }

  pathClear(ff, fr, tf, tr) {
    const stepF = Math.sign(tf - ff);
    const stepR = Math.sign(tr - fr);
    let f = ff + stepF;
    let r = fr + stepR;
    while (f !== tf || r !== tr) {
      if (this.get(squareAt(f, r))) return false;
      f += stepF;
      r += stepR;
    }
    return true;
  }

  moveUci(uci) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error(`Bad UCI move: ${uci}`);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci[4] || null;
    const piece = this.get(from);
    if (!piece) throw new Error(`No piece on ${from}`);
    if (piece.color !== this.currentTurn) throw new Error(`Wrong turn on ${uci}`);
    if (!this.canMove(from, to, piece)) throw new Error(`Illegal move ${uci}`);

    const target = this.get(to);
    const isCastle = piece.type === 'k' && Math.abs(coords(to)[0] - coords(from)[0]) === 2;
    let san;
    if (isCastle) {
      san = coords(to)[0] > coords(from)[0] ? 'O-O' : 'O-O-O';
      const rank = piece.color === 'w' ? '1' : '8';
      const rookFrom = coords(to)[0] > coords(from)[0] ? `h${rank}` : `a${rank}`;
      const rookTo = coords(to)[0] > coords(from)[0] ? `f${rank}` : `d${rank}`;
      const rook = this.get(rookFrom);
      this.board.delete(rookFrom);
      this.board.set(rookTo, rook);
    } else {
      const capture = Boolean(target);
      san = piece.type === 'p'
        ? `${capture ? from[0] + 'x' : ''}${to}${promotion ? `=${promotion.toUpperCase()}` : ''}`
        : `${PIECE_LETTER[piece.type]}${capture ? 'x' : ''}${to}`;
    }

    this.board.delete(from);
    const movedPiece = { ...piece };
    if (piece.type === 'p' && promotion) movedPiece.type = promotion;
    this.board.set(to, movedPiece);

    if (piece.type === 'k') this.castling[piece.color] = { k: false, q: false };
    if (piece.type === 'r') {
      if (from === 'h1') this.castling.w.k = false;
      if (from === 'a1') this.castling.w.q = false;
      if (from === 'h8') this.castling.b.k = false;
      if (from === 'a8') this.castling.b.q = false;
    }

    this.history.push({ uci, san });
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
    return { san, uci, from, to, piece: movedPiece };
  }

  notationFor(uci) {
    const clone = this.clone();
    return clone.moveUci(uci).san;
  }
}
