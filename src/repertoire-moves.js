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

function cloneNotes(notes = {}) {
  return Object.fromEntries(Object.entries(notes).map(([ply, note]) => [Number(ply), note]));
}

function notationLabel(chess, ply, uci) {
  const san = chess.notationFor(uci);
  const moveNumber = Math.floor(ply / 2) + 1;
  return chess.turn() === 'w' ? `${moveNumber}.${san}` : `${moveNumber}...${san}`;
}

export function summarizeExactBranchMatches(matches) {
  const seenIds = new Set();
  const seenTitles = new Set();
  const titles = [];

  for (const match of matches ?? []) {
    const line = match?.line;
    const title = line?.title;
    if (!title) continue;

    const id = line.id ?? null;
    if (id && seenIds.has(id)) continue;
    if (!id && seenTitles.has(title)) continue;

    if (id) seenIds.add(id);
    seenTitles.add(title);
    titles.push(title);
  }

  return {
    primaryTitle: titles[0] ?? null,
    moreTitles: titles.slice(1),
    titles
  };
}

export class RepertoireMoveIndex {
  constructor(course) {
    this.course = course;
    this.lineById = new Map((course?.lines ?? []).map(line => [line.id, line]));
    this.movesByPosition = new Map();
    this.microByPosition = new Map();
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

    for (const deviation of this.course?.deviations ?? []) {
      this.indexMicroDeviation(deviation);
    }
  }

  indexMicroDeviation(deviation) {
    const line = this.lineById.get(deviation?.anchor?.lineId);
    const ply = deviation?.anchor?.ply;
    if (!line || !Number.isInteger(ply) || ply < 0 || ply >= line.moves.length) {
      throw new Error(`Invalid deviation anchor: ${deviation?.id ?? 'unknown'}`);
    }

    const chess = new MiniChess();
    for (const uci of line.moves.slice(0, ply)) chess.moveUci(uci);
    if (chess.turn() === this.course.side) {
      throw new Error(`Deviation ${deviation.id} must begin on the opponent turn`);
    }

    const probe = chess.clone();
    probe.moveUci(deviation.move);
    if (probe.turn() !== this.course.side) {
      throw new Error(`Deviation ${deviation.id} does not hand the move to the repertoire side`);
    }
    probe.moveUci(deviation.response);
    for (const uci of deviation.continuation ?? []) probe.moveUci(uci);

    const key = positionKey(chess);
    const entries = this.microByPosition.get(key) ?? [];
    entries.push({ ...deviation, line, ply });
    this.microByPosition.set(key, entries);
  }

  canonicalRoute(line) {
    return {
      id: `canonical:${line.id}`,
      kind: 'canonical',
      lineId: line.id,
      moves: [...(line.moves ?? [])],
      notes: cloneNotes(line.notes),
      label: line.title,
      idea: line.summary ?? '',
      divergencePly: null,
      targetLineId: line.id,
      targetTitles: [line.title]
    };
  }

  branchRoute(line, ply, move, matches, chess) {
    const ordered = [...matches].sort((a, b) => {
      const aExact = a.ply === ply && sharesMovePrefix(line, a.line, ply) ? 0 : 1;
      const bExact = b.ply === ply && sharesMovePrefix(line, b.line, ply) ? 0 : 1;
      return aExact - bExact;
    });
    const match = ordered[0];
    if (!match) return null;

    const notes = {};
    for (const [notePly, note] of Object.entries(line.notes ?? {})) {
      const numeric = Number(notePly);
      if (numeric < ply) notes[numeric] = note;
    }
    for (const [notePly, note] of Object.entries(match.line.notes ?? {})) {
      const numeric = Number(notePly);
      if (numeric <= match.ply) continue;
      notes[ply + (numeric - match.ply)] = note;
    }

    const titles = [];
    const seen = new Set();
    for (const entry of ordered) {
      if (!entry.line?.title || seen.has(entry.line.id ?? entry.line.title)) continue;
      seen.add(entry.line.id ?? entry.line.title);
      titles.push(entry.line.title);
    }

    return {
      id: `branch:${line.id}:${ply}:${moveKey(move)}`,
      kind: 'branch',
      lineId: line.id,
      moves: [
        ...line.moves.slice(0, ply),
        move,
        ...match.line.moves.slice(match.ply + 1)
      ],
      notes,
      label: match.line.title,
      idea: match.line.summary ?? '',
      divergencePly: ply,
      opponentMove: move,
      opponentLabel: notationLabel(chess, ply, move),
      targetLineId: match.line.id,
      targetTitles: titles
    };
  }

  microRoute(line, deviation, chess, ply) {
    const notes = {};
    for (const [notePly, note] of Object.entries(line.notes ?? {})) {
      const numeric = Number(notePly);
      if (numeric < ply) notes[numeric] = note;
    }
    if (deviation.responseNote) notes[ply + 1] = deviation.responseNote;
    for (const [relativePly, note] of Object.entries(deviation.notes ?? {})) {
      notes[ply + 2 + Number(relativePly)] = note;
    }

    return {
      id: `micro:${deviation.id}`,
      kind: 'micro',
      lineId: line.id,
      deviationId: deviation.id,
      moves: [
        ...line.moves.slice(0, ply),
        deviation.move,
        deviation.response,
        ...(deviation.continuation ?? [])
      ],
      notes,
      label: deviation.title,
      idea: deviation.idea ?? '',
      divergencePly: ply,
      opponentMove: deviation.move,
      opponentLabel: notationLabel(chess, ply, deviation.move),
      targetLineId: null,
      targetTitles: []
    };
  }

  opponentAlternatives(line, ply) {
    if (!line?.moves?.[ply]) return [];
    const chess = new MiniChess();
    for (const uci of line.moves.slice(0, ply)) chess.moveUci(uci);
    if (chess.turn() === this.course.side) return [];

    const key = positionKey(chess);
    const canonical = moveKey(line.moves[ply]);
    const routes = [];
    const coveredMoves = new Set([canonical]);
    const byMove = this.movesByPosition.get(key) ?? new Map();

    for (const [move, entries] of byMove.entries()) {
      if (coveredMoves.has(move)) continue;
      const matches = entries.filter(entry => entry.line?.id !== line.id);
      if (!matches.length) continue;
      const route = this.branchRoute(line, ply, move, matches, chess);
      if (route) {
        routes.push(route);
        coveredMoves.add(move);
      }
    }

    for (const deviation of this.microByPosition.get(key) ?? []) {
      const move = moveKey(deviation.move);
      if (coveredMoves.has(move)) continue;
      routes.push(this.microRoute(line, deviation, chess, ply));
      coveredMoves.add(move);
    }

    return routes;
  }

  alternativesForLine(line) {
    const routes = [];
    const seen = new Set();
    const chess = new MiniChess();
    for (let ply = 0; ply < (line?.moves?.length ?? 0); ply += 1) {
      if (chess.turn() !== this.course.side) {
        for (const route of this.opponentAlternatives(line, ply)) {
          if (seen.has(route.id)) continue;
          seen.add(route.id);
          routes.push(route);
        }
      }
      chess.moveUci(line.moves[ply]);
    }
    return routes;
  }

  isRouteLearned(route, progress) {
    if (!route || route.kind === 'canonical') return true;
    if ((progress?.learnedDeviations ?? []).includes(route.id)) return true;
    return route.kind === 'branch' && Boolean(
      route.targetLineId && (progress?.discovered ?? []).includes(route.targetLineId)
    );
  }

  learnedAlternativesForLine(line, progress) {
    const learned = new Set(progress?.learnedDeviations ?? []);
    return this.alternativesForLine(line).filter(route => learned.has(route.id));
  }

  pickPracticeRoute(line, progress, random = Math.random) {
    const canonical = this.canonicalRoute(line);
    const alternatives = this.learnedAlternativesForLine(line, progress);
    if (!alternatives.length || random() >= 0.5) return canonical;
    return alternatives[Math.floor(random() * alternatives.length)] ?? canonical;
  }

  /**
   * Classify a training move against the complete course repertoire from the
   * actual chess position. Position identity decides whether a move belongs to
   * the repertoire; move-prefix identity is tracked separately so the UI only
   * names branches the user actually followed rather than transposition-only
   * matches.
   */
  classify(chess, currentLine, ply, attemptedUci, expectedOverride = null) {
    const expected = expectedOverride ?? currentLine?.moves?.[ply] ?? null;
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
