import { OpenRepTrainerApp } from './practice-trainer.js?v=recent-attempt-mastery-v1';
import { CoachingTrainerApp } from './coaching-trainer.js?v=history-attempt-parity-v1';

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

  replayHistoricalMove(from, to) {
    const replay = this.historicalReplayContext();
    if (!replay?.interactive) return;

    const attempted = `${from}${to}`;
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
