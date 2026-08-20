import { TrainerApp } from './trainer.js';
import { defaultLineProgress, saveProgress } from './progress.js';
import { explainWrongMove } from './move-explanations.js';
import { EvaluationBar } from './evaluation-bar.js?v=eval-bar-v4';
import { StockfishEvaluator } from './stockfish-evaluator.js';

export class CoachingTrainerApp extends TrainerApp {
  constructor(root, course, options = {}) {
    super(root, course);
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
    const expected = this.line.moves[this.ply];
    const attempted = `${from}${to}`;

    if (expected.startsWith(attempted)) {
      super.onUserMove(from, to);
      return;
    }

    this.mistakesThisLine += 1;
    const explanation = explainWrongMove(this.chess, attempted, expected, this.line.notes[this.ply] ?? '');
    this.showFeedback(explanation.message, 'wrong');

    const progress = this.progress.lines[this.line.id] ?? defaultLineProgress();
    progress.mistakes += 1;
    this.progress.lines[this.line.id] = progress;
    saveProgress(this.course.id, this.progress);

    this.board.clearSelection();
    this.refreshBoardState();
    this.board.setExplanationArrow(explanation.arrow);
  }
}
