import { TrainerApp } from './trainer.js?v=hint-toggle-v3';
import { MiniChess } from './mini-chess.js';
import { miniChessToFen } from './position-fen.js';
import { explainWrongMove } from './move-explanations.js';
import { MoveTheoryIndex } from './move-theory.js?v=decision-cues-v1';
import { summarizeExactBranchMatches } from './repertoire-moves.js?v=response-learning-v2';
import { practiceRoutePresentation } from './practice-selection.js?v=practice-route-label-v1';
import { EvaluationBar } from './evaluation-bar.js?v=eval-bar-v4';
import { classifyMoveQuality, formatMoveQualityLabel } from './evaluation.js?v=move-quality-v1';
import { StockfishEvaluator } from './stockfish-evaluator.js?v=move-quality-v1';

export function reviewDecisionPly(displayPly, displayedTurn, courseSide) {
  if (!Number.isInteger(displayPly) || displayPly < 0) return null;
  if (!['w', 'b'].includes(displayedTurn) || !['w', 'b'].includes(courseSide)) return null;
  if (displayedTurn === courseSide) {
    return { decisionPly: displayPly, moveAlreadyPlayed: false };
  }
  if (displayPly === 0) return null;
  return { decisionPly: displayPly - 1, moveAlreadyPlayed: true };
}

export class CoachingTrainerApp extends TrainerApp {
  constructor(root, course, options = {}) {
    super(root, course, options);
    this.moveTheory = new MoveTheoryIndex(course);
    this.completedTerminalMove = null;
    this.evaluator = Object.prototype.hasOwnProperty.call(options, 'evaluator')
      ? options.evaluator
      : (typeof StockfishEvaluator === 'undefined' ? null : new StockfishEvaluator());
    this.evaluationRequest = 0;
    this.wrongMoveEvaluationRequest = 0;
    this.evaluationBar = null;
    this.preservePromptDuringAcceptedMoveRefresh = false;
  }

  beginRoute(route, startPly = 0) {
    this.completedTerminalMove = null;
    this.wrongMoveEvaluationRequest += 1;
    super.beginRoute(route, startPly);
  }

  startResponseLesson(routeId) {
    const completedTerminalMove = this.completedTerminalMove
      ? { ...this.completedTerminalMove }
      : null;
    super.startResponseLesson(routeId);
    if (this.responseReturn) this.responseReturn.completedTerminalMove = completedTerminalMove;
  }

  returnToLesson() {
    const completedTerminalMove = this.responseReturn?.completedTerminalMove
      ? { ...this.responseReturn.completedTerminalMove }
      : null;
    super.returnToLesson();
    if (completedTerminalMove) {
      this.completedTerminalMove = completedTerminalMove;
      this.refresh();
    }
  }

  practicePresentation() {
    return practiceRoutePresentation(this.line, this.sessionRoute);
  }

  moveAtPly(ply) {
    if (this.completedTerminalMove?.ply === ply) return this.completedTerminalMove.move;
    return this.sessionRoute?.moves?.[ply] ?? null;
  }

  historicalDecisionCue() {
    if (this.practiceCaughtUp || this.viewPly === null || this.isLearnResponseLesson()) return null;

    const { chess: displayedChess } = this.positionAtPly(this.viewPly);
    const review = reviewDecisionPly(this.viewPly, displayedChess.turn(), this.course.side);
    if (!review) return null;

    const { chess } = this.positionAtPly(review.decisionPly);
    if (chess.turn() !== this.course.side) return null;
    const expected = this.moveAtPly(review.decisionPly);
    if (!expected) return null;
    const cue = this.moveTheory.cueAt(miniChessToFen(chess), expected);
    if (!cue) return null;

    return { ...review, chess, expected, cue };
  }

  currentDecisionCue() {
    if (this.practiceCaughtUp || this.viewPly !== null || this.lineFinished || this.isLearnResponseLesson()) {
      return null;
    }
    if (this.chess.turn() !== this.course.side) return null;

    const expected = this.currentExpectedMove();
    if (!expected) return null;
    return this.moveTheory.cueAt(miniChessToFen(this.chess), expected);
  }

  renderDecisionPrompt() {
    const prompt = this.root.querySelector('#prompt');
    if (this.viewPly !== null) {
      const review = this.historicalDecisionCue();
      prompt.replaceChildren();
      if (!review) return;
      const advice = document.createElement('span');
      advice.textContent = review.cue;
      prompt.append(advice);
      return;
    }

    const decisionCue = this.currentDecisionCue();
    if (!decisionCue) return;

    const expected = this.currentExpectedMove();
    const clue = this.hintEnabled ? ` Find ${this.chess.notationFor(expected)}.` : '';
    prompt.innerHTML = `<strong>Your move as Black.</strong><span>${decisionCue}${clue}</span>`;
  }

  refreshHistoryAdvice() {
    if (this.viewPly === null) super.refreshHistoryAdvice();
    this.renderDecisionPrompt();
  }

  refresh() {
    const prompt = this.root.querySelector('#prompt');
    const preservedPrompt = this.preservePromptDuringAcceptedMoveRefresh && prompt
      ? prompt.innerHTML
      : null;

    super.refresh();

    if (preservedPrompt !== null && !this.lineFinished && this.chess.turn() !== this.course.side) {
      prompt.innerHTML = preservedPrompt;
    } else {
      this.renderDecisionPrompt();
    }
    if (this.mode === 'practice' && !this.practiceCaughtUp) {
      const presentation = this.practicePresentation();
      this.root.querySelector('#line-title').textContent = presentation.title;
      this.root.querySelector('#line-variation').textContent = presentation.variation;
    }
    this.renderCompletionTheory();
  }

  renderShell() {
    super.renderShell();

    const grading = this.root.querySelector('#grading');
    const completion = document.createElement('section');
    completion.id = 'completion-theory';
    completion.className = 'completion-theory';
    completion.hidden = true;
    completion.setAttribute('aria-label', 'What to remember');
    grading.before(completion);

    if (typeof EvaluationBar === 'undefined') return;
    const board = this.root.querySelector('#board');
    const stage = document.createElement('div');
    stage.className = 'board-stage';
    board.before(stage);

    const bar = document.createElement('div');
    stage.append(bar, board);
    this.evaluationBar = new EvaluationBar(bar, this.course.side);
    if (!this.evaluator) this.evaluationBar.setUnavailable();
  }

  positionAtPly(ply) {
    const accepted = this.completedTerminalMove;
    if (!accepted || ply <= accepted.ply) return super.positionAtPly(ply);

    const chess = new MiniChess();
    let lastOpponentMove = null;
    for (let index = 0; index < ply; index += 1) {
      const mover = chess.turn();
      const uci = index === accepted.ply ? accepted.move : this.sessionRoute.moves[index];
      const move = chess.moveUci(uci);
      if (mover !== this.course.side) lastOpponentMove = { from: move.from, to: move.to };
    }
    return { chess, lastOpponentMove };
  }

  refreshBoardState() {
    super.refreshBoardState();
    const displayPly = this.viewPly === null ? this.ply : this.viewPly;
    const { chess } = this.positionAtPly(displayPly);
    this.refreshEvaluation(chess);
  }

  refreshEvaluation(chess) {
    if (!this.evaluationBar || !this.evaluator) return;
    const request = ++this.evaluationRequest;
    this.evaluationBar.setLoading();
    Promise.resolve(this.evaluator.evaluate(chess)).then(score => {
      if (request !== this.evaluationRequest) return;
      if (score) this.evaluationBar.setEvaluation(score);
      else this.evaluationBar.setUnavailable();
    }).catch(() => {
      if (request === this.evaluationRequest) this.evaluationBar.setUnavailable();
    });
  }

  prependMoveQualityFeedback(quality) {
    const feedback = this.root.querySelector('#feedback');
    if (!feedback || !quality) return;
    const prefix = document.createElement('span');
    prefix.className = 'move-quality';
    prefix.textContent = `${formatMoveQualityLabel(quality)}. `;
    feedback.prepend(prefix);
  }

  refreshWrongMoveQuality(attempted) {
    if (!this.evaluator?.evaluateMove) return;
    const request = ++this.wrongMoveEvaluationRequest;
    Promise.resolve(this.evaluator.evaluateMove(this.chess, attempted)).then(result => {
      if (request !== this.wrongMoveEvaluationRequest || !result) return;
      const quality = classifyMoveQuality(result.before, result.move, this.course.side);
      if (!quality) return;
      this.prependMoveQualityFeedback(quality);
      if (this.evaluationBar && result.before) this.evaluationBar.setEvaluation(result.before);
    }).catch(() => {});
  }

  expectedMoveContext(expectedNotation) {
    if (this.isLearnResponseLesson()) {
      return `this response lesson is teaching ${expectedNotation}`;
    }
    const title = this.mode === 'practice'
      ? this.practicePresentation().title
      : this.line.title;
    return `this rep is training “${title}.” Play ${expectedNotation} here`;
  }

  showRepertoireAlternativeFeedback(classification, attemptedNotation, expectedNotation) {
    const feedback = this.root.querySelector('#feedback');
    feedback.className = 'feedback wrong';
    feedback.replaceChildren();

    const context = this.expectedMoveContext(expectedNotation);
    const branchSummary = summarizeExactBranchMatches(classification.exactPathMatches);
    if (!branchSummary.primaryTitle) {
      feedback.textContent = `${attemptedNotation} is a repertoire move from this position, but ${context}.`;
      return;
    }

    feedback.append(document.createTextNode(
      `${attemptedNotation} is a repertoire move in “${branchSummary.primaryTitle}”`
    ));

    if (branchSummary.moreTitles.length > 0) {
      feedback.append(document.createTextNode(' '));
      const more = document.createElement('span');
      more.className = 'branch-more';
      more.tabIndex = 0;
      more.textContent = 'and more';
      more.setAttribute('aria-describedby', 'branch-more-tooltip');

      const tooltip = document.createElement('span');
      tooltip.className = 'branch-more-tooltip';
      tooltip.id = 'branch-more-tooltip';
      tooltip.setAttribute('role', 'tooltip');

      const label = document.createElement('span');
      label.className = 'branch-more-tooltip-label';
      label.textContent = 'Also in:';
      tooltip.append(label);

      for (const title of branchSummary.moreTitles) {
        const item = document.createElement('span');
        item.className = 'branch-more-tooltip-item';
        item.textContent = title;
        tooltip.append(item);
      }

      more.append(tooltip);
      feedback.append(more);
    }

    feedback.append(document.createTextNode(`, but ${context}.`));
  }

  terminalDecision() {
    const terminalPly = (this.sessionRoute?.moves?.length ?? 0) - 1;
    if (terminalPly < 0) return null;

    if (this.sessionRoute?.kind === 'canonical') {
      return this.moveTheory.decisionForLine(this.line.id, terminalPly);
    }

    if (this.sessionRoute?.kind === 'branch' && this.sessionRoute.targetLineId) {
      const { chess } = super.positionAtPly(terminalPly);
      return this.moveTheory.decisionForLinePosition(
        this.sessionRoute.targetLineId,
        miniChessToFen(chess),
        this.sessionRoute.moves[terminalPly]
      );
    }

    return null;
  }

  currentAcceptedTerminalDecision(attempted) {
    const decision = this.terminalDecision();
    const terminalPly = (this.sessionRoute?.moves?.length ?? 0) - 1;
    if (!decision || this.ply !== terminalPly) return null;
    return decision.acceptedMoves.includes(attempted) ? decision : null;
  }

  completeAcceptedTerminalMove(attempted) {
    try {
      const move = this.chess.moveUci(attempted);
      const moveIndex = this.ply;
      this.ply += 1;
      this.completedTerminalMove = { ply: moveIndex, move: attempted };
      this.board.clearSelection();
      this.showFeedback(`${move.san} also works here.`, 'correct');
      this.finishLine();
    } catch (error) {
      this.showFeedback(`Illegal move: ${error.message}`, 'wrong');
    }
  }

  finishLine() {
    const decision = this.terminalDecision();
    if (decision && !this.completedTerminalMove) {
      this.completedTerminalMove = {
        ply: (this.sessionRoute?.moves?.length ?? 1) - 1,
        move: decision.primaryMove
      };
    }
    super.finishLine();
  }

  renderCompletionTheory() {
    const panel = this.root.querySelector('#completion-theory');
    if (!panel) return;

    const decision = this.lineFinished && !this.practiceCaughtUp && !this.isLearnResponseLesson()
      ? this.terminalDecision()
      : null;
    panel.hidden = !decision;
    panel.replaceChildren();
    if (!decision) return;

    const heading = document.createElement('div');
    heading.className = 'completion-theory-heading';
    const eyebrow = document.createElement('span');
    eyebrow.textContent = 'What to remember';
    const objective = document.createElement('strong');
    objective.textContent = decision.objective;
    heading.append(eyebrow, objective);
    panel.append(heading);

    const playedMove = this.completedTerminalMove?.move ?? decision.primaryMove;
    const list = document.createElement('div');
    list.className = 'completion-theory-list';

    for (const choice of decision.choices) {
      const row = document.createElement('div');
      const played = choice.move === playedMove;
      row.className = `completion-theory-choice ${choice.role}${played ? ' played' : ''}`;

      const title = document.createElement('div');
      title.className = 'completion-theory-choice-title';
      const move = document.createElement('strong');
      move.textContent = choice.notation;
      const role = document.createElement('span');
      role.className = `completion-theory-badge ${choice.role}`;
      role.textContent = choice.role === 'primary' ? 'Primary' : 'Also works';
      title.append(move, role);

      if (played) {
        const playedBadge = document.createElement('span');
        playedBadge.className = 'completion-theory-badge played';
        playedBadge.textContent = 'You played';
        title.append(playedBadge);
      }

      const rationale = document.createElement('p');
      rationale.textContent = choice.theory.rationale;
      row.append(title, rationale);
      list.append(row);
    }

    panel.append(list);
  }

  onUserMove(from, to) {
    if (this.viewPly !== null || this.lineFinished || this.chess.turn() !== this.course.side) return;
    const attempted = `${from}${to}`;
    const acceptedDecision = this.currentAcceptedTerminalDecision(attempted);
    if (acceptedDecision) {
      this.wrongMoveEvaluationRequest += 1;
      this.completeAcceptedTerminalMove(attempted);
      return;
    }

    const classification = this.repertoire.classify(
      this.chess,
      this.line,
      this.ply,
      attempted,
      this.currentExpectedMove()
    );

    if (classification.kind === 'expected') {
      this.wrongMoveEvaluationRequest += 1;
      this.preservePromptDuringAcceptedMoveRefresh = true;
      try {
        super.onUserMove(from, to);
      } finally {
        this.preservePromptDuringAcceptedMoveRefresh = false;
      }
      return;
    }

    this.recordTrainingMistake();
    let explanationArrow = null;

    if (classification.kind === 'repertoire-alternative') {
      const attemptedNotation = this.chess.notationFor(attempted);
      const expectedNotation = this.chess.notationFor(classification.expected);
      this.showRepertoireAlternativeFeedback(classification, attemptedNotation, expectedNotation);
    } else {
      const explanation = explainWrongMove(
        this.chess,
        attempted,
        classification.expected,
        this.currentRouteNote()
      );
      explanationArrow = explanation.arrow;
      this.showFeedback(explanation.message, 'wrong');
    }

    this.board.clearSelection();
    this.refreshBoardState();
    this.board.setExplanationArrow(explanationArrow);
    this.refreshWrongMoveQuality(attempted);
  }
}
