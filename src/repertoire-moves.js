import { MiniChess } from './mini-chess.js';
import { miniChessToFen } from './position-fen.js';

function moveKey(uci) {
  return typeof uci === 'string' ? uci.slice(0, 4) : '';
}

function sameMove(a, b) {
  const aKey = moveKey(a);
  return aKey.length === 4 && aKey === moveKey(b);
}

export function normalizePositionKey(fenOrKey) {
  if (typeof fenOrKey !== 'string') return '';
  return fenOrKey.trim().split(/\s+/).slice(0, 4).join(' ');
}

function positionKey(chess) {
  return normalizePositionKey(miniChessToFen(chess));
}

export function responseIdentityKey(position, opponentMove) {
  const normalizedPosition = normalizePositionKey(position);
  const move = moveKey(opponentMove);
  return normalizedPosition && move.length === 4 ? `${normalizedPosition}::${move}` : '';
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

function notationSequence(chess, startPly, moves = []) {
  const probe = chess.clone();
  const labels = [];
  for (let offset = 0; offset < moves.length; offset += 1) {
    const uci = moves[offset];
    labels.push(notationLabel(probe, startPly + offset, uci));
    probe.moveUci(uci);
  }
  return labels;
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
    this.positionsByLine = new Map();
    this.responsesByPosition = new Map();
    this.responseByIdentity = new Map();
    this.responseById = new Map();
    this.build();
  }

  build() {
    for (const line of this.course?.lines ?? []) {
      const chess = new MiniChess();
      const positions = [];
      for (let ply = 0; ply < (line.moves?.length ?? 0); ply += 1) {
        const uci = line.moves[ply];
        const key = positionKey(chess);
        positions[ply] = key;
        const byMove = this.movesByPosition.get(key) ?? new Map();
        const move = moveKey(uci);
        const entries = byMove.get(move) ?? [];
        entries.push({ line, ply, uci });
        byMove.set(move, entries);
        this.movesByPosition.set(key, byMove);
        chess.moveUci(uci);
      }
      this.positionsByLine.set(line.id, positions);
    }

    for (const response of this.course?.responses ?? []) {
      this.indexNewResponse(response);
    }
  }

  chessAt(line, ply) {
    const chess = new MiniChess();
    for (const uci of line.moves.slice(0, ply)) chess.moveUci(uci);
    return chess;
  }

  findPositionOccurrence(key) {
    for (const line of this.course?.lines ?? []) {
      const ply = (this.positionsByLine.get(line.id) ?? []).indexOf(key);
      if (ply >= 0) return { line, ply };
    }
    return null;
  }

  resolveResponsePosition(response) {
    let anchorLine = null;
    let anchorPly = null;
    let anchorKey = '';

    if (response?.anchor) {
      anchorLine = this.lineById.get(response.anchor.lineId);
      anchorPly = response.anchor.ply;
      if (!anchorLine || !Number.isInteger(anchorPly) || anchorPly < 0 || anchorPly >= anchorLine.moves.length) {
        throw new Error(`Invalid response anchor: ${response.id}`);
      }
      anchorKey = this.positionsByLine.get(anchorLine.id)?.[anchorPly] ?? '';
    }

    const declaredKey = normalizePositionKey(response?.positionKey ?? '');
    if (declaredKey && anchorKey && declaredKey !== anchorKey) {
      throw new Error(`Response ${response.id} positionKey does not match its authoring anchor`);
    }

    const key = declaredKey || anchorKey;
    if (!key) {
      throw new Error(`Response ${response.id} must provide a positionKey or authoring anchor`);
    }

    const occurrence = anchorLine
      ? { line: anchorLine, ply: anchorPly }
      : this.findPositionOccurrence(key);
    if (!occurrence) {
      throw new Error(`Response ${response.id} position is not present in the course graph`);
    }

    const chess = this.chessAt(occurrence.line, occurrence.ply);
    if (positionKey(chess) !== key) {
      throw new Error(`Response ${response.id} could not resolve its canonical position`);
    }

    return {
      key,
      chess,
      resolvedLine: occurrence.line,
      resolvedPly: occurrence.ply
    };
  }

  indexNewResponse(response) {
    if (!response?.id || typeof response.id !== 'string') {
      throw new Error('Response must have a stable id');
    }
    if (this.responseById.has(response.id)) {
      throw new Error(`Duplicate response id: ${response.id}`);
    }

    const { key, chess, resolvedLine, resolvedPly } = this.resolveResponsePosition(response);
    if (chess.turn() === this.course.side) {
      throw new Error(`Response ${response.id} must begin on the opponent turn`);
    }

    const identity = responseIdentityKey(key, response.move);
    if (!identity) throw new Error(`Response ${response.id} has an invalid opponent move`);

    const existingResponse = this.responseByIdentity.get(identity);
    if (existingResponse) {
      throw new Error(
        `Duplicate response identity at ${identity}: ${existingResponse.id} and ${response.id}`
      );
    }

    const repertoireMatches = this.movesByPosition.get(key)?.get(moveKey(response.move)) ?? [];
    if (repertoireMatches.length > 0) {
      const titles = summarizeExactBranchMatches(repertoireMatches).titles.join(', ');
      throw new Error(
        `Response ${response.id} duplicates full repertoire coverage${titles ? ` in ${titles}` : ''}`
      );
    }

    const teachingOwnerLineId = response.teachingOwnerLineId;
    const teachingOwnerLine = this.lineById.get(teachingOwnerLineId);
    if (!teachingOwnerLine) {
      throw new Error(`Response ${response.id} has invalid teaching owner: ${teachingOwnerLineId ?? 'missing'}`);
    }

    const teachingOwnerPly = (this.positionsByLine.get(teachingOwnerLineId) ?? []).indexOf(key);
    if (teachingOwnerPly < 0) {
      throw new Error(
        `Response ${response.id} teaching owner ${teachingOwnerLineId} does not reach the response position`
      );
    }

    const probe = chess.clone();
    probe.moveUci(response.move);
    if (probe.turn() !== this.course.side) {
      throw new Error(`Response ${response.id} does not hand the move to the repertoire side`);
    }
    probe.moveUci(response.response);
    for (const uci of response.continuation ?? []) probe.moveUci(uci);

    const indexed = {
      ...response,
      source: response.source ?? 'curated',
      authoringAnchor: response.anchor ?? null,
      resolvedLine,
      resolvedPly,
      positionKey: key,
      responseKey: identity,
      teachingOwnerLineId,
      teachingOwnerLine,
      teachingOwnerPly
    };

    this.responseByIdentity.set(identity, indexed);
    this.responseById.set(response.id, indexed);
    const entries = this.responsesByPosition.get(key) ?? [];
    entries.push(indexed);
    this.responsesByPosition.set(key, entries);
  }

  positionForLine(lineId, ply) {
    return this.positionsByLine.get(lineId)?.[ply] ?? null;
  }

  responseAt(position, opponentMove) {
    return this.responseByIdentity.get(responseIdentityKey(position, opponentMove)) ?? null;
  }

  canonicalRoute(line) {
    return {
      id: `canonical:${line.id}`,
      kind: 'canonical',
      coverage: 'canonical',
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
      coverage: 'covered-elsewhere',
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

  responseRoute(line, response, chess, ply) {
    const notes = {};
    for (const [notePly, note] of Object.entries(line.notes ?? {})) {
      const numeric = Number(notePly);
      if (numeric < ply) notes[numeric] = note;
    }
    if (response.responseNote) notes[ply + 1] = response.responseNote;
    for (const [relativePly, note] of Object.entries(response.notes ?? {})) {
      notes[ply + 2 + Number(relativePly)] = note;
    }

    const afterOpponent = chess.clone();
    afterOpponent.moveUci(response.move);
    const responseLabel = notationLabel(afterOpponent, ply + 1, response.response);
    const afterResponse = afterOpponent.clone();
    afterResponse.moveUci(response.response);
    const exampleMoves = [...(response.continuation ?? [])];
    const isTeachingOwner = line.id === response.teachingOwnerLineId;
    const teachingOwnerTitle = response.teachingOwnerLine?.title ?? response.teachingOwnerLineId;

    return {
      id: `response:${response.id}`,
      kind: 'response',
      coverage: isTeachingOwner ? 'new-response' : 'covered-elsewhere',
      lineId: line.id,
      responseId: response.id,
      responseKey: response.responseKey,
      source: response.source,
      response: response.response,
      responsePly: ply + 1,
      responseLabel,
      responseTopicLabel: response.label ?? 'New response',
      exampleMoves,
      exampleLabels: notationSequence(afterResponse, ply + 2, exampleMoves),
      moves: [
        ...line.moves.slice(0, ply),
        response.move,
        response.response,
        ...exampleMoves
      ],
      notes,
      label: isTeachingOwner ? (response.label ?? 'New response') : teachingOwnerTitle,
      idea: response.idea ?? '',
      divergencePly: ply,
      opponentMove: response.move,
      opponentLabel: notationLabel(chess, ply, response.move),
      teachingOwnerLineId: response.teachingOwnerLineId,
      teachingOwnerTitle,
      teachingOwnerPly: response.teachingOwnerPly,
      targetLineId: isTeachingOwner ? null : response.teachingOwnerLineId,
      targetTitles: isTeachingOwner ? [] : [teachingOwnerTitle]
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

    for (const response of this.responsesByPosition.get(key) ?? []) {
      const move = moveKey(response.move);
      if (coveredMoves.has(move)) continue;
      routes.push(this.responseRoute(line, response, chess, ply));
      coveredMoves.add(move);
    }

    // New material is primary in the lesson that owns it. The same canonical
    // response remains visible from equivalent lessons, but as covered elsewhere.
    return routes.sort((a, b) => {
      const aRank = a.coverage === 'new-response' ? 0 : 1;
      const bRank = b.coverage === 'new-response' ? 0 : 1;
      return aRank - bRank;
    });
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

  newResponsesForLine(line) {
    return this.alternativesForLine(line).filter(route =>
      route.kind === 'response' && route.coverage === 'new-response'
    );
  }

  isResponseLearned(route, progress) {
    return Boolean(
      route?.kind === 'response'
      && route.responseId
      && (progress?.learnedResponses ?? []).includes(route.responseId)
    );
  }

  isCoveredLessonDiscovered(route, progress) {
    return Boolean(
      route?.coverage === 'covered-elsewhere'
      && route.targetLineId
      && (progress?.discovered ?? []).includes(route.targetLineId)
    );
  }

  isRouteLearned(route, progress) {
    if (!route || route.kind === 'canonical') return true;
    if (route.kind === 'response') return this.isResponseLearned(route, progress);
    if (route.kind === 'branch') return this.isCoveredLessonDiscovered(route, progress);
    return false;
  }

  practiceAlternativesForLine(line, progress) {
    return this.alternativesForLine(line).filter(route => this.isRouteLearned(route, progress));
  }

  // Compatibility alias for callers/tests from the first opponent-deviation
  // implementation. The semantics are now explicitly "practice-ready".
  learnedAlternativesForLine(line, progress) {
    return this.practiceAlternativesForLine(line, progress);
  }

  pickPracticeRoute(line, progress, random = Math.random) {
    const canonical = this.canonicalRoute(line);
    const alternatives = this.practiceAlternativesForLine(line, progress);
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
