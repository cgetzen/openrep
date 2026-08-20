import { CoachingTrainerApp } from './coaching-trainer.js?v=terminal-theory-v1';

function sameMoveSequence(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((move, index) => move === b[index]);
}

function routeMatchesLine(route, line, expectedKind) {
  if (!route || !line || route.kind !== expectedKind) return false;
  if (route.label !== line.title) return false;
  if (!sameMoveSequence(route.moves, line.moves)) return false;
  if (route.targetLineId !== line.id) return false;
  return true;
}

function validatedCanonicalRoute(line, canonicalRouteForLine) {
  const canonical = canonicalRouteForLine(line);
  if (!routeMatchesLine(canonical, line, 'canonical')) {
    throw new Error(`Canonical practice route identity mismatch for line ${line?.id ?? 'unknown'}`);
  }
  return canonical;
}

export function resolvePracticeSessionRoute(sourceLine, candidateRoute, lines, canonicalRouteForLine) {
  if (!sourceLine?.id) throw new Error('Practice session requires a source line with stable identity');
  if (typeof canonicalRouteForLine !== 'function') {
    throw new Error('Practice session requires a canonical route resolver');
  }

  if (candidateRoute?.kind === 'response') return candidateRoute;

  if (candidateRoute?.kind === 'canonical' && routeMatchesLine(candidateRoute, sourceLine, 'canonical')) {
    return candidateRoute;
  }

  if (candidateRoute?.kind === 'branch') {
    const targetLine = (lines ?? []).find(line => line.id === candidateRoute.targetLineId);
    if (targetLine && routeMatchesLine(candidateRoute, targetLine, 'branch')) {
      return candidateRoute;
    }
  }

  return validatedCanonicalRoute(sourceLine, canonicalRouteForLine);
}

export class OpenRepTrainerApp extends CoachingTrainerApp {
  beginRoute(route, startPly = 0) {
    if (this.mode !== 'practice') {
      super.beginRoute(route, startPly);
      return;
    }

    const safeRoute = resolvePracticeSessionRoute(
      this.line,
      route,
      this.course?.lines,
      line => this.repertoire.canonicalRoute(line)
    );
    super.beginRoute(safeRoute, safeRoute === route ? startPly : 0);
  }
}
