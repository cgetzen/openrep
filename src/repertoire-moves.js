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
   * actual chess position. This intentionally uses position identity rather
   * than move-prefix identity so transpositions are handled correctly.
   */
  classify(chess, currentLine, ply, attemptedUci) {
    const expected = currentLine?.moves?.[ply] ?? null;
    if (expected && sameMove(expected, attemptedUci)) {
      return { kind: 'expected', expected, alternatives: [] };
    }

    const matches = this.movesByPosition.get(positionKey(chess))?.get(moveKey(attemptedUci)) ?? [];
    const alternatives = matches.filter(match => match.line?.id !== currentLine?.id);

    if (alternatives.length > 0) {
      return { kind: 'repertoire-alternative', expected, alternatives };
    }

    return { kind: 'out-of-repertoire', expected, alternatives: [] };
  }
}
