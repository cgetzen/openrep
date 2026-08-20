import { TrainerApp } from './trainer.js';
import { defaultLineProgress, saveProgress } from './progress.js';
import { explainWrongMove } from './move-explanations.js';
import { RepertoireMoveIndex } from './repertoire-moves.js';
import { EvaluationBar } from './evaluation-bar.js?v=eval-bar-v4';
import { StockfishEvaluator } from './stockfish-evaluator.js';

export class CoachingTrainerApp extends TrainerApp {
  constructor(root, course, options = {}) {
    super(root, course);
    this.repertoireMoves = new RepertoireMoveIndex(course);
    this.evaluator = Object.prototype.hasOwnProperty.call(options, 'evaluator')
      ? options.evaluator
      : (typeof StockfishEvaluator === 'undefined' ? null : new StockfishEvaluator());
    this.evaluationRequest = 0;
    this.evaluationBar = null;
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

  onUserMove(from, to) {
    if (this.viewPly !== null || this.lineFinished || this.chess.turn() !== this.course.side) return;
    const attempted = `${from}${to}`;
    const classification = this.repertoireMoves.classify(this.chess, this.line, this.ply, attempted);

    if (classification.kind === 'expected') {
      super.onUserMove(from, to);
      return;
    }

    this.mistakesThisLine += 1;
    let explanationArrow = null;

    if (classification.kind === 'repertoire-alternative') {
      const attemptedNotation = this.chess.notationFor(attempted);
      const expectedNotation = this.chess.notationFor(classification.expected);
      const branchTitles = [...new Set(classification.alternatives.map(match => match.line?.title).filter(Boolean))];
      const branchDescription = branchTitles.length === 1
        ? ` in “${branchTitles[0]}”`
        : ' in another repertoire branch';
      this.showFeedback(
        `${attemptedNotation} is a repertoire move${branchDescription}, but this rep is training “${this.line.title}.” Play ${expectedNotation} here.`,
        'wrong'
      );
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
  }
}
