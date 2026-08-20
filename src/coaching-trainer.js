import { TrainerApp } from './trainer.js';
import { defaultLineProgress, saveProgress } from './progress.js';
import { explainWrongMove } from './move-explanations.js';

export class CoachingTrainerApp extends TrainerApp {
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
