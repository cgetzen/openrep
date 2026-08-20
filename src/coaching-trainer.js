import { TrainerApp } from './trainer.js';
import { defaultLineProgress, saveProgress } from './progress.js';
import { explainWrongMove } from './move-explanations.js';
import { RepertoireMoveIndex, summarizeExactBranchMatches } from './repertoire-moves.js?v=branch-feedback-v2';
import { EvaluationBar } from './evaluation-bar.js?v=eval-bar-v4';
import { classifyMoveQuality, formatMoveQualityLabel } from './evaluation.js?v=move-quality-v1';
import { StockfishEvaluator } from './stockfish-evaluator.js?v=move-quality-v1';

export class CoachingTrainerApp extends TrainerApp {
  constructor(root, course, options = {}) {
    super(root, course);
    this.repertoireMoves = new RepertoireMoveIndex(course);
    this.evaluator = Object.prototype.hasOwnProperty.call(options, 'evaluator')
      ? options.evaluator
      : (typeof StockfishEvaluator === 'undefined' ? null : new StockfishEvaluator());
    this.evaluationRequest = 0;
    this.wrongMoveEvaluationRequest = 0;
    this.evaluationBar = null;
  }

  startLine(index) {
    this.wrongMoveEvaluationRequest += 1;
    super.startLine(index);
  }

  renderShell() {
    super.renderShell();
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

  showRepertoireAlternativeFeedback(classification, attemptedNotation, expectedNotation) {
    const feedback = this.root.querySelector('#feedback');
    feedback.className = 'feedback wrong';
    feedback.replaceChildren();

    const branchSummary = summarizeExactBranchMatches(classification.exactPathMatches);
    if (!branchSummary.primaryTitle) {
      feedback.textContent = `${attemptedNotation} is a repertoire move from this position, but this rep is training “${this.line.title}.” Play ${expectedNotation} here.`;
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

    feedback.append(document.createTextNode(
      `, but this rep is training “${this.line.title}.” Play ${expectedNotation} here.`
    ));
  }

  onUserMove(from, to) {
    if (this.viewPly !== null || this.lineFinished || this.chess.turn() !== this.course.side) return;
    const attempted = `${from}${to}`;
    const classification = this.repertoireMoves.classify(this.chess, this.line, this.ply, attempted);

    if (classification.kind === 'expected') {
      this.wrongMoveEvaluationRequest += 1;
      super.onUserMove(from, to);
      return;
    }

    this.mistakesThisLine += 1;
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
        this.line.notes[this.ply] ?? ''
      );
      explanationArrow = explanation.arrow;
      this.showFeedback(explanation.message, 'wrong');
    }

    const progress = this.progress.lines[this.line.id] ?? defaultLineProgress();
    progress.mistakes += 1;
    this.progress.lines[this.line.id] = progress;
    saveProgress(this.course.id, this.progress);

    this.board.clearSelection();
    this.refreshBoardState();
    this.board.setExplanationArrow(explanationArrow);
    this.refreshWrongMoveQuality(attempted);
  }
}
