import { MiniChess } from './mini-chess.js';
import { miniChessToFen } from './position-fen.js';

function moveKey(uci) {
  return typeof uci === 'string' ? uci.slice(0, 4) : '';
}

function sameMove(a, b) {
  const aKey = moveKey(a);
  return aKey.length === 4 && aKey === moveKey(b);
}

function positionKey(chess) {
  return miniChessToFen(chess).split(' ').slice(0, 4).join(' ');
}

function sharesMovePrefix(a, b, ply) {
  if (!a?.moves || !b?.moves || ply < 0) return false;
  if (a.moves.length < ply || b.moves.length < ply) return false;
  for (let index = 0; index < ply; index += 1) {
    if (!sameMove(a.moves[index], b.moves[index])) return false;
  }
  return true;
}

export class RepertoireMoveIndex {
  constructor(course) {
    this.course = course;
    this.movesByPosition = new Map();
    this.build();
  }

  build() {
    for (const line of this.course?.lines ?? []) {
      const chess = new MiniChess();
      for (let ply = 0; ply < (line.moves?.length ?? 0); ply += 1) {
        const uci = line.moves[ply];
        const key = positionKey(chess);
        const byMove = this.movesByPosition.get(key) ?? new Map();
        const move = moveKey(uci);
        const entries = byMove.get(move) ?? [];
        entries.push({ line, ply, uci });
        byMove.set(move, entries);
        this.movesByPosition.set(key, byMove);
        chess.moveUci(uci);
      }
    }
  }

  /**
   * Classify a training move against the complete course repertoire from the
   * actual chess position. Position identity decides whether a move belongs to
   * the repertoire; move-prefix identity is tracked separately so the UI only
   * names branches the user actually followed rather than transposition-only
   * matches.
   */
  classify(chess, currentLine, ply, attemptedUci) {
    const expected = currentLine?.moves?.[ply] ?? null;
    if (expected && sameMove(expected, attemptedUci)) {
      return {
        kind: 'expected',
        expected,
        alternatives: [],
        exactPathMatches: [],
        transpositionMatches: []
      };
    }

    const matches = this.movesByPosition.get(positionKey(chess))?.get(moveKey(attemptedUci)) ?? [];
    const alternatives = matches.filter(match => match.line?.id !== currentLine?.id);
    const exactPathMatches = alternatives.filter(match =>
      match.ply === ply && sharesMovePrefix(currentLine, match.line, ply)
    );
    const exactSet = new Set(exactPathMatches);
    const transpositionMatches = alternatives.filter(match => !exactSet.has(match));

    if (alternatives.length > 0) {
      return {
        kind: 'repertoire-alternative',
        expected,
        alternatives,
        exactPathMatches,
        transpositionMatches
      };
    }

    return {
      kind: 'out-of-repertoire',
      expected,
      alternatives: [],
      exactPathMatches: [],
      transpositionMatches: []
    };
  }
}
