import { CoachingTrainerApp, reviewDecisionPly } from './coaching-trainer.js?v=history-advice-v2';
import { miniChessToFen } from './position-fen.js';

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
  displayedDecisionAdvice() {
    if (this.practiceCaughtUp || this.isLearnResponseLesson()) return null;

    const displayPly = this.viewPly === null ? this.ply : this.viewPly;
    const { chess: displayedChess } = this.positionAtPly(displayPly);
    const review = reviewDecisionPly(displayPly, displayedChess.turn(), this.course.side);
    if (!review) return null;

    const { chess } = this.positionAtPly(review.decisionPly);
    if (chess.turn() !== this.course.side) return null;
    const expected = this.moveAtPly(review.decisionPly);
    if (!expected) return null;
    const cue = this.moveTheory.cueAt(miniChessToFen(chess), expected);
    if (!cue) return null;

    return { ...review, chess, expected, cue };
  }

  responseAdvice() {
    if (!this.isLearnResponseLesson()) return null;
    const expected = this.currentExpectedMove();
    const showHint = this.viewPly === null
      && !this.lineFinished
      && this.chess.turn() === this.course.side
      && expected
      && this.hintEnabled;
    const clue = showHint ? ` Find ${this.chess.notationFor(expected)}.` : '';
    return `${this.sessionRoute.idea}${clue}`;
  }

  renderDecisionPrompt() {
    const prompt = this.root.querySelector('#prompt');
    prompt.replaceChildren();

    if (this.practiceCaughtUp) return;

    if (this.isLearnResponseLesson()) {
      const advice = this.responseAdvice();
      if (!advice) return;
      const text = document.createElement('span');
      text.textContent = advice;
      prompt.append(text);
      return;
    }

    const decision = this.displayedDecisionAdvice();
    if (!decision) return;

    const showHint = this.viewPly === null
      && !this.lineFinished
      && !decision.moveAlreadyPlayed
      && this.hintEnabled;
    const clue = showHint ? ` Find ${decision.chess.notationFor(decision.expected)}.` : '';
    const text = document.createElement('span');
    text.textContent = `${decision.cue}${clue}`;
    prompt.append(text);
  }

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
