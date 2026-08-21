import { CoachingTrainerApp, reviewDecisionPly } from './coaching-trainer.js?v=history-advice-v2';
import { miniChessToFen } from './position-fen.js';
import { BranchTeachingIndex } from './branch-teaching.js?v=branch-briefings-v1';
import { normalizeTeachingProse } from './teaching-copy.js';
import { defaultLineProgress, isLineMastered, lineLearningStatus, recordLineAttempt } from './progress.js';
import { pickPracticeLineIndex } from './practice-selection.js?v=recent-attempt-mastery-v1';

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

export function formatMoveTeachingFeedback(moveSan, note = '') {
  const notation = String(moveSan ?? '').trim();
  let explanation = normalizeTeachingProse(String(note ?? '').trim());
  if (!notation) return explanation;
  if (!explanation) return `${notation}. Correct.`;

  explanation = explanation.replace(/^\d+\.(?:\.\.)?\s*/, '').trim();
  if (explanation === notation) return notation;
  if (explanation.startsWith(`${notation} `)) {
    explanation = explanation.slice(notation.length).trim();
  }

  return explanation ? `${notation} ${explanation}` : notation;
}

export function normalizeMoveTeachingFeedback(message) {
  const text = normalizeTeachingProse(String(message ?? ''));
  const separator = ' — ';
  const separatorIndex = text.indexOf(separator);
  if (separatorIndex <= 0) return text;

  const notation = text.slice(0, separatorIndex).trim();
  const note = text.slice(separatorIndex + separator.length).trim();
  const withoutMoveNumber = note.replace(/^\d+\.(?:\.\.)?\s*/, '').trim();
  if (withoutMoveNumber !== notation && !withoutMoveNumber.startsWith(`${notation} `)) return text;
  return formatMoveTeachingFeedback(notation, note);
}

export class OpenRepTrainerApp extends CoachingTrainerApp {
  constructor(root, course, options = {}) {
    super(root, course, options);
    this.branchTeaching = new BranchTeachingIndex(course);
  }

  historicalReplayContext() {
    if (this.viewPly === null || this.practiceCaughtUp) return null;

    const { chess, lastOpponentMove } = this.positionAtPly(this.viewPly);
    const expected = chess.turn() === this.course.side ? this.moveAtPly(this.viewPly) : null;
    const interactive = Boolean(
      expected
      && this.viewPly < this.ply
      && chess.turn() === this.course.side
    );

    return { chess, lastOpponentMove, expected, interactive };
  }

  refreshBoardState() {
    if (this.viewPly === null) {
      super.refreshBoardState();
      return;
    }

    const replay = this.historicalReplayContext();
    if (!replay) {
      super.refreshBoardState();
      return;
    }

    this.board.setPosition(replay.chess, {
      lastMove: replay.lastOpponentMove,
      interactive: replay.interactive
    });
    this.board.setExpectedMove(replay.expected, replay.interactive && this.hintEnabled);
    this.refreshEvaluation(replay.chess);
  }

  showHistoricalReplayFeedback(message, kind) {
    const liveFeedback = this.root.querySelector('#feedback');
    const historyFeedback = this.root.querySelector('#history-feedback');
    if (liveFeedback) liveFeedback.hidden = true;
    if (!historyFeedback) return;

    historyFeedback.hidden = false;
    historyFeedback.className = `feedback ${kind}`;
    historyFeedback.textContent = message;
    historyFeedback.setAttribute('aria-hidden', 'false');
  }

  replayHistoricalMove(from, to) {
    const replay = this.historicalReplayContext();
    if (!replay?.interactive) return;

    const attempted = `${from}${to}`;
    if (!replay.expected?.startsWith(attempted)) {
      const expectedNotation = replay.expected ? replay.chess.notationFor(replay.expected) : '';
      const message = this.mode === 'learn' && expectedNotation
        ? `Not quite. Look for ${expectedNotation}.`
        : 'Not in the repertoire. Try again.';
      this.board.clearSelection();
      this.showHistoricalReplayFeedback(message, 'wrong');
      this.refreshBoardState();
      return;
    }

    const nextPly = this.viewPly + 1;
    this.viewPly = nextPly === this.ply ? null : nextPly;
    this.board.clearSelection();
    this.refreshHistoryView();
    this.queueHistoricalOpponentReplay();
  }

  queueHistoricalOpponentReplay() {
    if (this.viewPly === null) return;

    const replayPly = this.viewPly;
    const { chess } = this.positionAtPly(replayPly);
    if (chess.turn() === this.course.side) return;

    window.setTimeout(() => {
      if (this.viewPly !== replayPly) return;
      this.navigateHistory(1);
      this.queueHistoricalOpponentReplay();
    }, 130);
  }

  onUserMove(from, to) {
    if (this.viewPly === null) {
      super.onUserMove(from, to);
      return;
    }
    this.replayHistoricalMove(from, to);
  }

  renderShell() {
    super.renderShell();
    const liveFeedback = this.root.querySelector('#feedback');
    const opponentOptions = this.root.querySelector('#opponent-options');
    if (!liveFeedback) return;

    if (opponentOptions) opponentOptions.before(liveFeedback);

    const historyFeedback = document.createElement('div');
    historyFeedback.id = 'history-feedback';
    historyFeedback.className = 'feedback';
    historyFeedback.hidden = true;
    historyFeedback.setAttribute('aria-hidden', 'true');
    liveFeedback.after(historyFeedback);
  }

  showFeedback(message, kind) {
    const displayed = kind === 'correct' ? normalizeMoveTeachingFeedback(message) : message;
    super.showFeedback(displayed, kind);
  }

  pickPracticeLineIndex() {
    return pickPracticeLineIndex(
      this.course.lines,
      this.progress,
      this.practiceSelection,
      { random: this.random }
    );
  }

  displayedDecisionContext() {
    if (this.practiceCaughtUp || this.sessionRoute?.kind === 'response') return null;

    const displayPly = this.viewPly === null ? this.ply : this.viewPly;
    const { chess: displayedChess } = this.positionAtPly(displayPly);
    const review = reviewDecisionPly(displayPly, displayedChess.turn(), this.course.side);
    if (!review) return null;

    const { chess } = this.positionAtPly(review.decisionPly);
    if (chess.turn() !== this.course.side) return null;
    const expected = this.moveAtPly(review.decisionPly);
    if (!expected) return null;

    const teachingLineId = this.sessionRoute?.kind === 'branch' && this.sessionRoute.targetLineId
      ? this.sessionRoute.targetLineId
      : this.line?.id ?? null;
    const branchBriefing = this.branchTeaching?.briefingForDecision?.(
      teachingLineId,
      review.decisionPly
    ) ?? null;
    const cue = branchBriefing ?? this.moveTheory.cueAt(miniChessToFen(chess), expected);
    if (!cue) return null;

    return {
      ...review,
      displayPly,
      opponentDecisionPly: review.decisionPly > 0 ? review.decisionPly - 1 : null,
      chess,
      expected,
      cue,
      teachingKind: branchBriefing ? 'branch-briefing' : 'move-cue'
    };
  }

  displayedDecisionAdvice() {
    return this.displayedDecisionContext();
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
    return `${normalizeTeachingProse(this.sessionRoute.idea)}${clue}`;
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

    const decision = this.displayedDecisionContext();
    if (!decision) return;

    const showHint = this.viewPly === null
      && !this.lineFinished
      && !decision.moveAlreadyPlayed
      && this.hintEnabled;
    const clue = showHint ? ` Find ${decision.chess.notationFor(decision.expected)}.` : '';

    if (decision.teachingKind === 'branch-briefing') {
      const [body, keyIdea, ...extra] = decision.cue.split('\n');
      if (!body || !keyIdea || extra.length > 0 || !keyIdea.startsWith('Key idea: ')) {
        throw new Error('Branch briefing presentation must contain one dedicated Key idea line');
      }

      const bodyText = document.createElement('span');
      bodyText.className = 'branch-briefing-body';
      bodyText.textContent = body;
      const keyIdeaText = document.createElement('span');
      keyIdeaText.className = 'branch-key-idea';
      keyIdeaText.textContent = `${keyIdea}${clue}`;
      prompt.append(bodyText, keyIdeaText);
      return;
    }

    const text = document.createElement('span');
    text.textContent = `${decision.cue}${clue}`;
    prompt.append(text);
  }

  displayedOpponentOptions() {
    if (this.mode !== 'learn' || this.sessionRoute?.kind !== 'canonical') return [];
    if (this.viewPly === null && this.lineFinished) return [];

    const decision = this.displayedDecisionContext();
    if (decision?.opponentDecisionPly === null || decision?.opponentDecisionPly === undefined) return [];
    return this.repertoire.opponentAlternatives(this.line, decision.opponentDecisionPly);
  }

  renderOpponentOptions() {
    const panel = this.root.querySelector('#opponent-options');
    const routes = this.displayedOpponentOptions();
    this.visibleOpponentOptions = routes;
    const visible = routes.length > 0;
    panel.classList.toggle('hidden', !visible);
    panel.replaceChildren();
    if (!visible) return;

    const heading = document.createElement('div');
    heading.className = 'opponent-options-heading';
    const strong = document.createElement('strong');
    strong.textContent = 'Other good moves for White';
    const small = document.createElement('span');
    small.textContent = 'Alternatives to the White move this advice responds to.';
    heading.append(strong, small);
    panel.append(heading);

    const newResponses = routes.filter(route => route.coverage === 'new-response');
    const coveredElsewhere = routes.filter(route => route.coverage === 'covered-elsewhere');
    this.appendOpponentOptionGroup(panel, 'New responses', newResponses);
    this.appendOpponentOptionGroup(panel, 'Covered elsewhere', coveredElsewhere);
  }

  findNewResponseRoute(routeId) {
    const visibleRoute = this.visibleOpponentOptions?.find(candidate =>
      candidate.id === routeId && candidate.coverage === 'new-response'
    );
    if (visibleRoute) return visibleRoute;
    return super.findNewResponseRoute(routeId);
  }

  openCoveredLesson(routeId) {
    const visibleRoute = this.visibleOpponentOptions?.find(candidate =>
      candidate.id === routeId && candidate.coverage === 'covered-elsewhere'
    );
    if (visibleRoute?.targetLineId) {
      const targetIndex = this.course.lines.findIndex(line => line.id === visibleRoute.targetLineId);
      if (targetIndex >= 0) this.startLine(targetIndex);
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
          : formatMoveTeachingFeedback(move.san, note)
      };
    }
    return latest;
  }

  renderDisplayedFeedback() {
    const liveFeedback = this.root.querySelector('#feedback');
    const historyFeedback = this.root.querySelector('#history-feedback');
    if (!liveFeedback || !historyFeedback) return;

    if (this.viewPly === null) {
      liveFeedback.hidden = false;
      historyFeedback.hidden = true;
      historyFeedback.className = 'feedback';
      historyFeedback.textContent = '';
      historyFeedback.setAttribute('aria-hidden', 'true');
      return;
    }

    liveFeedback.hidden = true;
    const feedback = this.displayedMoveFeedback();
    if (!feedback) {
      historyFeedback.hidden = true;
      historyFeedback.className = 'feedback';
      historyFeedback.textContent = '';
      historyFeedback.setAttribute('aria-hidden', 'true');
      return;
    }

    historyFeedback.hidden = false;
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

  finishLine() {
    if (!this.isLearnResponseLesson() && this.line?.id) {
      const current = this.progress.lines[this.line.id] ?? defaultLineProgress();
      this.progress.lines[this.line.id] = recordLineAttempt(current, this.mistakesThisLine);
    }
    super.finishLine();
  }

  renderProgress() {
    const discovered = this.progress.discovered.length;
    const mastered = this.course.lines.filter(line =>
      this.progress.discovered.includes(line.id) && isLineMastered(this.progress.lines[line.id])
    ).length;
    this.root.querySelector('#course-progress').innerHTML = `<div><strong>${discovered}/${this.course.lines.length}</strong><span>discovered</span></div><div><strong>${mastered}</strong><span>mastered</span></div>`;
  }

  renderLineList() {
    super.renderLineList();
    const el = this.root.querySelector('#line-list');
    el.querySelectorAll('[data-line-index]').forEach(button => {
      const line = this.course.lines[Number(button.dataset.lineIndex)];
      if (!line) return;
      const discovered = this.progress.discovered.includes(line.id);
      const status = lineLearningStatus(this.progress.lines[line.id], discovered);
      const pill = button.querySelector('.status-pill');
      if (!pill) return;
      pill.textContent = status;
      pill.className = `status-pill ${status.toLowerCase()}`;
    });
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
