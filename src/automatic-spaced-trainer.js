import { OpenRepTrainerApp } from './practice-trainer.js?v=recent-attempt-mastery-v1';
import { CoachingTrainerApp } from './coaching-trainer.js?v=history-advice-v2';
import { classifyMoveQuality } from './evaluation.js?v=move-quality-v1';
import { miniChessToFen } from './position-fen.js';

function historicalFeedbackRoot(root) {
  return {
    querySelector(selector) {
      if (selector === '#feedback') return root.querySelector('#history-feedback');
      return root.querySelector(selector);
    }
  };
}

export class AutomaticSpacedTrainerApp extends OpenRepTrainerApp {
  renderShell() {
    super.renderShell();
    const grading = this.root.querySelector('#grading');
    if (grading) grading.replaceChildren();
    this.hideManualGrading();
  }

  gradeLine() {
    // Manual self-grading is intentionally disabled. Completed attempts are
    // scheduled automatically from observed mistakes in recordLineAttempt().
  }

  hideManualGrading() {
    const grading = this.root.querySelector('#grading');
    if (!grading) return;
    grading.classList.add('hidden');
    grading.setAttribute('aria-hidden', 'true');
  }

  expectedDecisionMoveAtPly(ply) {
    if (!Number.isInteger(ply) || ply < 0) return null;
    return this.sessionRoute?.moves?.[ply] ?? null;
  }

  historicalReplayContext() {
    const replay = super.historicalReplayContext();
    if (!replay) return null;

    const displayedTurn = replay.chess.turn();
    const repertoireTurn = displayedTurn === this.course.side;
    const expected = repertoireTurn
      ? this.expectedDecisionMoveAtPly(this.viewPly)
      : null;
    const interactive = Boolean(
      this.viewPly < this.ply
      && (repertoireTurn ? expected : true)
    );

    // Board/history reconstruction may use the move the learner actually
    // played. Attempt semantics must come from the canonical route decision.
    // Opponent turns are analysis-only: any legal move can be scored without
    // becoming part of the lesson route or learner progress.
    return {
      ...replay,
      playedMove: replay.expected,
      expected,
      interactive,
      analysisSide: repertoireTurn ? null : displayedTurn
    };
  }

  displayedDecisionContext() {
    const context = super.displayedDecisionContext();
    if (!context) return null;

    const expected = this.expectedDecisionMoveAtPly(context.decisionPly);
    if (!expected) return null;
    if (expected === context.expected) return context;

    const cue = context.teachingKind === 'branch-briefing'
      ? context.cue
      : this.moveTheory.cueAt(miniChessToFen(context.chess), expected);
    if (!cue) return null;

    return { ...context, expected, cue };
  }

  historicalAttemptProjection(replay) {
    const replayPly = this.viewPly;
    const projection = Object.create(this);
    projection.root = historicalFeedbackRoot(this.root);
    projection.chess = replay.chess;
    projection.ply = replayPly;
    projection.viewPly = null;
    projection.lineFinished = false;

    // History changes the position supplied to the normal attempt pipeline,
    // not the semantics of that pipeline. Only session-owned mutations are
    // replaced with no-ops on this projection.
    projection.recordTrainingMistake = () => {};
    projection.currentExpectedMove = () => replay.expected;
    projection.currentRouteNote = () => this.currentRouteNote(replayPly);
    projection.refreshBoardState = () => this.refreshBoardState();
    projection.finishLine = () => {};
    return projection;
  }

  prepareHistoricalAttemptFeedback() {
    const liveFeedback = this.root.querySelector('#feedback');
    const historyFeedback = this.root.querySelector('#history-feedback');
    if (liveFeedback) liveFeedback.hidden = true;
    if (!historyFeedback) return;
    historyFeedback.hidden = false;
    historyFeedback.setAttribute('aria-hidden', 'false');
  }

  showHistoricalOpponentMoveScore(notation, quality) {
    this.showHistoricalReplayFeedback(`${notation}.`, 'neutral');
    if (!quality) return;
    const projection = Object.create(this);
    projection.root = historicalFeedbackRoot(this.root);
    CoachingTrainerApp.prototype.prependMoveQualityFeedback.call(projection, quality);
  }

  evaluateHistoricalOpponentMove(replay, attempted) {
    const historyPly = this.viewPly;
    const side = replay.analysisSide ?? replay.chess.turn();
    let notation;
    try {
      notation = replay.chess.notationFor(attempted);
    } catch {
      return;
    }

    this.wrongMoveEvaluationRequest += 1;
    const request = this.wrongMoveEvaluationRequest;
    this.board.clearSelection();
    this.showHistoricalReplayFeedback(`${notation}. Evaluating…`, 'neutral');
    this.refreshBoardState();

    if (!this.evaluator?.evaluateMove) {
      this.showHistoricalReplayFeedback(`${notation}. Evaluation unavailable.`, 'neutral');
      return;
    }

    Promise.resolve(this.evaluator.evaluateMove(replay.chess, attempted)).then(result => {
      if (request !== this.wrongMoveEvaluationRequest || this.viewPly !== historyPly) return;
      if (!result) {
        this.showHistoricalReplayFeedback(`${notation}. Evaluation unavailable.`, 'neutral');
        return;
      }
      const quality = classifyMoveQuality(result.before, result.move, side);
      if (!quality) {
        this.showHistoricalReplayFeedback(`${notation}. Evaluation unavailable.`, 'neutral');
        return;
      }
      this.showHistoricalOpponentMoveScore(notation, quality);
    }).catch(() => {
      if (request === this.wrongMoveEvaluationRequest && this.viewPly === historyPly) {
        this.showHistoricalReplayFeedback(`${notation}. Evaluation unavailable.`, 'neutral');
      }
    });
  }

  replayHistoricalMove(from, to) {
    const replay = this.historicalReplayContext();
    if (!replay?.interactive) return;

    const attempted = `${from}${to}`;
    if (replay.analysisSide) {
      this.evaluateHistoricalOpponentMove(replay, attempted);
      return;
    }

    if (replay.expected?.startsWith(attempted)) {
      super.replayHistoricalMove(from, to);
      return;
    }

    // A historical attempt is the live trainer evaluated against a projected
    // chess state. The projection suppresses session mutations, but delegates
    // classification, explanation, arrows, repertoire matching, and engine
    // move-quality feedback to the exact same CoachingTrainerApp pipeline.
    this.prepareHistoricalAttemptFeedback();
    const projection = this.historicalAttemptProjection(replay);
    CoachingTrainerApp.prototype.onUserMove.call(projection, from, to);
  }

  refresh() {
    super.refresh();
    this.hideManualGrading();

    if (this.mode !== 'practice') return;
    const nextLineButton = this.root.querySelector('#next-line');
    nextLineButton.disabled = this.practiceCaughtUp || !this.lineFinished;
    nextLineButton.textContent = this.practiceCaughtUp
      ? 'Reviews complete'
      : this.lineFinished
        ? 'Next review →'
        : 'Practice queue';
  }
}
