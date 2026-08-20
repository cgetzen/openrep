import { MiniChess } from './mini-chess.js';
import { miniChessToFen } from './position-fen.js';
import { normalizePositionKey } from './repertoire-moves.js?v=response-learning-v2';

function moveKey(uci) {
  return typeof uci === 'string' ? uci.slice(0, 4) : '';
}

function positionKey(chess) {
  return normalizePositionKey(miniChessToFen(chess));
}

export function moveTheoryIdentityKey(position, move) {
  const normalizedPosition = normalizePositionKey(position);
  const normalizedMove = moveKey(move);
  return normalizedPosition && normalizedMove.length === 4
    ? `${normalizedPosition}::${normalizedMove}`
    : '';
}

export class MoveTheoryIndex {
  constructor(course) {
    this.course = course;
    this.lineById = new Map((course?.lines ?? []).map(line => [line.id, line]));
    this.theoryByIdentity = new Map();
    this.decisionByLinePly = new Map();
    this.buildTheory();
    this.buildDecisions();
  }

  chessAt(line, ply) {
    const chess = new MiniChess();
    for (const uci of line.moves.slice(0, ply)) chess.moveUci(uci);
    return chess;
  }

  findPositionOccurrence(key) {
    for (const line of this.course?.lines ?? []) {
      const chess = new MiniChess();
      for (let ply = 0; ply < (line.moves?.length ?? 0); ply += 1) {
        if (positionKey(chess) === key) return { line, ply, chess };
        chess.moveUci(line.moves[ply]);
      }
    }
    return null;
  }

  resolvePosition(record, label) {
    let anchored = null;
    if (record?.anchor) {
      const line = this.lineById.get(record.anchor.lineId);
      const ply = record.anchor.ply;
      if (!line || !Number.isInteger(ply) || ply < 0 || ply >= (line.moves?.length ?? 0)) {
        throw new Error(`${label} has an invalid authoring anchor`);
      }
      const chess = this.chessAt(line, ply);
      anchored = { line, ply, chess, key: positionKey(chess) };
    }

    const declaredKey = normalizePositionKey(record?.positionKey ?? '');
    if (declaredKey && anchored && declaredKey !== anchored.key) {
      throw new Error(`${label} positionKey does not match its authoring anchor`);
    }

    const key = declaredKey || anchored?.key;
    if (!key) throw new Error(`${label} must provide a positionKey or authoring anchor`);

    const occurrence = anchored ?? this.findPositionOccurrence(key);
    if (!occurrence) throw new Error(`${label} position is not present in the course graph`);
    return { ...occurrence, key };
  }

  buildTheory() {
    for (const entry of this.course?.moveTheory ?? []) {
      const { key, chess } = this.resolvePosition(entry, 'Move theory');
      const move = moveKey(entry.move);
      const identity = moveTheoryIdentityKey(key, move);
      if (!identity) throw new Error('Move theory has an invalid move');
      if (this.theoryByIdentity.has(identity)) {
        throw new Error(`Duplicate move theory identity: ${identity}`);
      }

      const probe = chess.clone();
      let notation;
      try {
        notation = probe.notationFor(move);
        probe.moveUci(move);
      } catch {
        throw new Error(`Move theory has an illegal move at ${identity}`);
      }

      this.theoryByIdentity.set(identity, {
        ...entry,
        move,
        notation,
        positionKey: key,
        theoryKey: identity,
        source: entry.source ?? 'curated'
      });
    }
  }

  buildDecisions() {
    const seenIds = new Set();
    for (const entry of this.course?.lessonDecisions ?? []) {
      if (!entry?.id || seenIds.has(entry.id)) {
        throw new Error(`Lesson decision must have a unique id: ${entry?.id ?? 'missing'}`);
      }
      seenIds.add(entry.id);

      const { line, ply, chess, key } = this.resolvePosition(entry, `Lesson decision ${entry.id}`);
      if (!entry.anchor || entry.anchor.lineId !== line.id || entry.anchor.ply !== ply) {
        throw new Error(`Lesson decision ${entry.id} must use a lesson authoring anchor`);
      }
      if (chess.turn() !== this.course.side) {
        throw new Error(`Lesson decision ${entry.id} must belong to the repertoire side`);
      }
      if (!entry.objective || typeof entry.objective !== 'string') {
        throw new Error(`Lesson decision ${entry.id} must explain its teaching objective`);
      }

      const primaryMove = moveKey(line.moves[ply]);
      const acceptedMoves = [];
      const seenMoves = new Set([primaryMove]);
      for (const rawMove of entry.acceptedMoves ?? []) {
        const move = moveKey(rawMove);
        if (move.length !== 4 || seenMoves.has(move)) {
          throw new Error(`Lesson decision ${entry.id} has a duplicate or invalid accepted move`);
        }
        const probe = chess.clone();
        try {
          probe.moveUci(move);
        } catch {
          throw new Error(`Lesson decision ${entry.id} has an illegal accepted move: ${move}`);
        }
        seenMoves.add(move);
        acceptedMoves.push(move);
      }

      const choices = [primaryMove, ...acceptedMoves].map((move, index) => {
        const theory = this.theoryAt(key, move);
        if (!theory) {
          throw new Error(`Lesson decision ${entry.id} is missing move theory for ${move}`);
        }
        return {
          move,
          notation: theory.notation,
          role: index === 0 ? 'primary' : 'accepted',
          theory
        };
      });

      const decisionKey = `${line.id}:${ply}`;
      if (this.decisionByLinePly.has(decisionKey)) {
        throw new Error(`Duplicate lesson decision at ${decisionKey}`);
      }
      this.decisionByLinePly.set(decisionKey, {
        ...entry,
        lineId: line.id,
        ply,
        positionKey: key,
        primaryMove,
        acceptedMoves,
        choices
      });
    }
  }

  theoryAt(position, move) {
    return this.theoryByIdentity.get(moveTheoryIdentityKey(position, move)) ?? null;
  }

  decisionForLine(lineId, ply) {
    return this.decisionByLinePly.get(`${lineId}:${ply}`) ?? null;
  }

  decisionForLinePosition(lineId, position, primaryMove) {
    const key = normalizePositionKey(position);
    const move = moveKey(primaryMove);
    for (const decision of this.decisionByLinePly.values()) {
      if (decision.lineId !== lineId) continue;
      if (decision.positionKey !== key) continue;
      if (decision.primaryMove !== move) continue;
      return decision;
    }
    return null;
  }
}
