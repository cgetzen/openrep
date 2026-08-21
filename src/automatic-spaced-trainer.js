import { OpenRepTrainerApp } from './practice-trainer.js?v=recent-attempt-mastery-v1';

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
