import { MiniChess } from './mini-chess.js';
import { lineWeaknessProfile } from './line-learning.js';

export const PRACTICE_SELECTIONS = Object.freeze(['spaced', 'weak']);

export function normalizePracticeSelection(selection) {
  return PRACTICE_SELECTIONS.includes(selection) ? selection : 'spaced';
}

function formatRouteVariation(moves, plies) {
  const chess = new MiniChess();
  const tokens = [];
  const limit = Math.min(Array.isArray(moves) ? moves.length : 0, Math.max(0, plies));

  for (let ply = 0; ply < limit; ply += 1) {
    const uci = moves[ply];
    const san = chess.notationFor(uci);
    if (chess.turn() === 'w') tokens.push(`${Math.floor(ply / 2) + 1}.${san}`);
    else tokens.push(san);
    chess.moveUci(uci);
  }

  return tokens.join(' ');
}

export function practiceRoutePresentation(line, route) {
  const sourceTitle = line?.title ?? route?.label ?? 'Practice route';
  const sourceVariation = line?.variation ?? '';
  if (!route || route.kind === 'canonical') {
    return { title: sourceTitle, variation: sourceVariation };
  }

  let title = sourceTitle;
  if (route.kind === 'branch') {
    title = route.label ?? sourceTitle;
  } else if (route.kind === 'response') {
    const ownerTitle = route.teachingOwnerTitle ?? sourceTitle;
    const responseTitle = route.responseTopicLabel ?? route.label ?? 'Response';
    title = responseTitle && responseTitle !== ownerTitle
      ? `${ownerTitle} — ${responseTitle}`
      : ownerTitle;
  }

  const divergencePly = Number.isInteger(route.divergencePly) ? route.divergencePly : 0;
  const variation = formatRouteVariation(route.moves, divergencePly + 2) || sourceVariation;
  return { title, variation };
}

export function pickSpacedLineIndex(lines, progress, now = Date.now()) {
  const lineProgress = progress?.lines ?? {};
  const due = lines.map((line, index) => {
    const current = lineProgress[line.id];
    return {
      index,
      dueAt: current?.dueAt ?? now,
      repetitions: current?.repetitions ?? 0
    };
  }).filter(item => item.dueAt <= now);

  return due.sort((a, b) => a.dueAt - b.dueAt || a.repetitions - b.repetitions)[0]?.index ?? null;
}

function compareWeakness(a, b) {
  if (a.profile.tier !== b.profile.tier) return a.profile.tier - b.profile.tier;

  if (a.profile.tier === 0) {
    if (a.profile.severity !== b.profile.severity) {
      return b.profile.severity - a.profile.severity;
    }
    if (a.profile.attempts !== b.profile.attempts) {
      return a.profile.attempts - b.profile.attempts;
    }
  } else if (a.profile.tier === 1 && a.profile.attempts !== b.profile.attempts) {
    return a.profile.attempts - b.profile.attempts;
  }

  return a.index - b.index;
}

export function pickWeakLineIndex(lines, progress, random = Math.random) {
  const lineProgress = progress?.lines ?? {};
  const ranked = lines.map((line, index) => ({
    index,
    profile: lineWeaknessProfile(lineProgress[line.id])
  })).sort(compareWeakness);

  const weakest = ranked.slice(0, Math.min(4, ranked.length));
  if (weakest.length === 0) return 0;
  const randomIndex = Math.min(weakest.length - 1, Math.floor(random() * weakest.length));
  return weakest[randomIndex].index;
}

export function pickPracticeLineIndex(lines, progress, selection, options = {}) {
  const normalized = normalizePracticeSelection(selection);
  if (normalized === 'weak') return pickWeakLineIndex(lines, progress, options.random);
  return pickSpacedLineIndex(lines, progress, options.now);
}
