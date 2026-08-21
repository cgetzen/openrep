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
  renderShell() {
    super.renderShell();
    const liveFeedback = this.root.querySelector('#feedback');
    if (!liveFeedback) return;

    const historyFeedback = document.createElement('div');
    historyFeedback.id = 'history-feedback';
    historyFeedback.className = 'feedback hidden';
    historyFeedback.setAttribute('aria-hidden', 'true');
    liveFeedback.after(historyFeedback);
  }

  displayedDecisionAdvice() {
    if (this.practiceCaughtUp || this.sessionRoute?.kind === 'response') return null;

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
    if (this.sessionRoute?.kind !== 'response') return null;
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

    if (this.sessionRoute?.kind === 'response') {
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

  displayedOpponentOptions() {
    if (this.mode !== 'learn' || this.sessionRoute?.kind !== 'canonical') return [];

    const displayPly = this.viewPly === null ? this.ply : this.viewPly;
    const { chess: displayedChess } = this.positionAtPly(displayPly);
    let opponentDecisionPly = null;

    if (displayedChess.turn() !== this.course.side) {
      opponentDecisionPly = displayPly;
    } else if (displayPly > 0) {
      const { chess: previousChess } = this.positionAtPly(displayPly - 1);
      if (previousChess.turn() !== this.course.side) opponentDecisionPly = displayPly - 1;
    }

    return opponentDecisionPly === null
      ? []
      : this.repertoire.opponentAlternatives(this.line, opponentDecisionPly);
  }

  renderOpponentOptions() {
    if (this.viewPly === null) {
      this.historyOpponentOptions = null;
      super.renderOpponentOptions();
      return;
    }

    const panel = this.root.querySelector('#opponent-options');
    const routes = this.displayedOpponentOptions();
    this.historyOpponentOptions = routes;
    const visible = routes.length > 0;
    panel.classList.toggle('hidden', !visible);
    panel.replaceChildren();
    if (!visible) return;

    const heading = document.createElement('div');
    heading.className = 'opponent-options-heading';
    const strong = document.createElement('strong');
    strong.textContent = 'Other good moves for White';
    const small = document.createElement('span');
    small.textContent = 'Alternatives from the position currently shown on the board.';
    heading.append(strong, small);
    panel.append(heading);

    const newResponses = routes.filter(route => route.coverage === 'new-response');
    const coveredElsewhere = routes.filter(route => route.coverage === 'covered-elsewhere');
    this.appendOpponentOptionGroup(panel, 'New responses', newResponses);
    this.appendOpponentOptionGroup(panel, 'Covered elsewhere', coveredElsewhere);
  }

  findNewResponseRoute(routeId) {
    if (this.viewPly !== null) {
      const route = this.historyOpponentOptions?.find(candidate =>
        candidate.id === routeId && candidate.coverage === 'new-response'
      );
      if (route) return route;
    }
    return super.findNewResponseRoute(routeId);
  }

  openCoveredLesson(routeId) {
    if (this.viewPly !== null) {
      const route = this.historyOpponentOptions?.find(candidate =>
        candidate.id === routeId && candidate.coverage === 'covered-elsewhere'
      );
      if (route?.targetLineId) {
        const targetIndex = this.course.lines.findIndex(line => line.id === route.targetLineId);
        if (targetIndex >= 0) this.startLine(targetIndex);
      }
      return;
    }
    super.openCoveredLesson(routeId);
  }

  displayedMoveFeedback() {
    if (this.viewPly === null) return null;

    let latest = null;
    for (let index = 0; index < this.viewPly; index += 1) {
      const { chess } = this.positionAtPly(index);
      if (chess.turn() !== this.course.side) continue;

      const uci = this.moveAtPly(index);
      if (!uci) continue;
      const move = chess.moveUci(uci);
      const acceptedAlternative = this.completedTerminalMove?.ply === index
        && this.completedTerminalMove.move === uci
        && this.sessionRoute?.moves?.[index] !== uci;
      const note = this.currentRouteNote(index);
      latest = {
        kind: 'correct',
        text: acceptedAlternative
          ? `${move.san} also works here.`
          : note
            ? `${move.san} — ${note}`
            : `${move.san}. Correct.`
      };
    }
    return latest;
  }

  renderDisplayedFeedback() {
    const liveFeedback = this.root.querySelector('#feedback');
    const historyFeedback = this.root.querySelector('#history-feedback');
    if (!liveFeedback || !historyFeedback) return;

    if (this.viewPly === null) {
      liveFeedback.classList.remove('hidden');
      historyFeedback.className = 'feedback hidden';
      historyFeedback.textContent = '';
      historyFeedback.setAttribute('aria-hidden', 'true');
      return;
    }

    liveFeedback.classList.add('hidden');
    const feedback = this.displayedMoveFeedback();
    if (!feedback) {
      historyFeedback.className = 'feedback hidden';
      historyFeedback.textContent = '';
      historyFeedback.setAttribute('aria-hidden', 'true');
      return;
    }

    historyFeedback.className = `feedback ${feedback.kind}`;
    historyFeedback.textContent = feedback.text;
    historyFeedback.setAttribute('aria-hidden', 'false');
  }

  renderResponseSummary() {
    if (this.viewPly !== null) {
      const panel = this.root.querySelector('#response-summary');
      panel.classList.add('hidden');
      panel.replaceChildren();
      return;
    }
    super.renderResponseSummary();
  }

  renderCompletionTheory() {
    if (this.viewPly !== null) {
      const panel = this.root.querySelector('#completion-theory');
      if (panel) panel.hidden = true;
      return;
    }
    super.renderCompletionTheory();
  }

  refresh() {
    super.refresh();
    this.renderDisplayedFeedback();
  }

  refreshHistoryView() {
    this.renderDecisionPrompt();
    this.renderOpponentOptions();
    this.renderResponseSummary();
    this.renderDisplayedFeedback();
    this.renderCompletionTheory();
    this.refreshBoardState();
    this.refreshHistoryControls();
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
