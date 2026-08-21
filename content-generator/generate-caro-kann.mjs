import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MiniChess } from '../src/mini-chess.js';
import { miniChessToFen } from '../src/position-fen.js';
import { normalizePositionKey } from '../src/repertoire-moves.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKann20260821Snapshot } from './openings/caro-kann/2026-08-21.snapshot.mjs';
import { caroKannCoveragePolicy } from './openings/caro-kann/coverage-policy.mjs';
import { compileRepertoireSnapshot, serializeGeneratedModule } from './repertoire-compiler.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CARO_KANN_GENERATED_PATH = path.resolve(HERE, '../src/openings/generated/caro-kann.generated.js');

export function positionKeyForAnchor(course, anchor) {
  const line = (course?.lines ?? []).find(candidate => candidate.id === anchor?.lineId);
  if (!line || !Number.isInteger(anchor?.ply) || anchor.ply < 0 || anchor.ply >= line.moves.length) {
    throw new Error(`Invalid generator anchor: ${anchor?.lineId ?? 'missing'}:${anchor?.ply ?? 'missing'}`);
  }

  const chess = new MiniChess();
  for (const move of line.moves.slice(0, anchor.ply)) chess.moveUci(move);
  return normalizePositionKey(miniChessToFen(chess));
}

function applyCoveragePolicy(decision) {
  const contentByMove = caroKannCoveragePolicy.responseContent?.[decision.id] ?? {};
  return {
    ...decision,
    responses: (decision.responses ?? []).map(response => ({
      ...response,
      ...(contentByMove[response.opponentMove] ?? {})
    }))
  };
}

export function compileCaroKannSnapshot() {
  if (caroKann20260821Snapshot.policyVersion !== caroKannCoveragePolicy.version) {
    throw new Error('Caro-Kann snapshot and generation policy versions do not match');
  }

  const decisions = caroKann20260821Snapshot.decisions.map(rawDecision => {
    const decision = applyCoveragePolicy(rawDecision);
    return {
      ...decision,
      positionKey: positionKeyForAnchor(caroKann, decision.anchor)
    };
  });

  return compileRepertoireSnapshot({
    ...caroKann20260821Snapshot,
    decisions
  });
}

export function generateCaroKannModule() {
  return serializeGeneratedModule('caroKannGeneratedRepertoire', compileCaroKannSnapshot());
}

export function writeCaroKannGeneratedArtifact({ check = false } = {}) {
  const expected = generateCaroKannModule();
  const current = fs.existsSync(CARO_KANN_GENERATED_PATH)
    ? fs.readFileSync(CARO_KANN_GENERATED_PATH, 'utf8')
    : null;

  if (check) {
    if (current !== expected) {
      throw new Error('Generated Caro-Kann repertoire is stale. Run npm run repertoire:generate and commit the result.');
    }
    return false;
  }

  fs.mkdirSync(path.dirname(CARO_KANN_GENERATED_PATH), { recursive: true });
  if (current === expected) return false;
  fs.writeFileSync(CARO_KANN_GENERATED_PATH, expected);
  return true;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const check = process.argv.includes('--check');
  writeCaroKannGeneratedArtifact({ check });
  console.log(check ? 'Caro-Kann generated repertoire is current.' : 'Generated Caro-Kann repertoire artifact.');
}
