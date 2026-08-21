import { OpenRepTrainerApp } from './practice-trainer.js?v=recent-attempt-mastery-v1';

export class AutomaticSpacedTrainerApp extends OpenRepTrainerApp {
  renderShell() {
    super.renderShell();
    this.hideManualGrading();
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
