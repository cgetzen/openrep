import { MiniChess } from './mini-chess.js';
import { ChessBoard } from './chess-board.js';
import { defaultLineProgress, loadProgress, resetProgress, saveProgress, scheduleReview } from './progress.js';
import { normalizePracticeSelection, pickPracticeLineIndex as selectPracticeLineIndex } from './practice-selection.js';

export class TrainerApp {
  constructor(root, course) {
    this.root = root;
    this.course = course;
    this.chess = new MiniChess();
    this.progress = loadProgress(course.id);
    this.mode = 'learn';
    this.practiceSelection = 'spaced';
    this.practiceCaughtUp = false;
    this.line = course.lines[0];
    this.lineIndex = 0;
    this.ply = 0;
    this.viewPly = null;
    this.mistakesThisLine = 0;
    this.hintEnabled = true;
    this.lineFinished = false;
  }

  mount() {
    this.renderShell();
    this.startLine(0);
  }

  renderShell() {
    this.root.innerHTML = `
      <header class="topbar">
        <a class="brand" href="#" aria-label="OpenRep home"><span class="brand-mark">OR</span><span>OpenRep</span></a>
        <div class="local-badge"><span class="status-dot"></span> Static app · progress stays in this browser</div>
      </header>
      <main class="page-shell">
        <section class="course-header">
          <div>
            <div class="eyebrow">Opening course · Black repertoire</div>
            <h1>${this.course.name}</h1>
            <p>${this.course.tagline}</p>
          </div>
          <div class="course-progress" id="course-progress"></div>
        </section>
        <nav class="modes" aria-label="Training modes">
          ${['learn','practice'].map(mode => `<button class="mode-btn" data-mode="${mode}">${mode[0].toUpperCase()+mode.slice(1)}<small>${this.modeSubtitle(mode)}</small></button>`).join('')}
        </nav>
        <section id="practice-options" class="practice-options hidden" aria-label="Practice selection">
          <span class="practice-options-label">Practice selection</span>
          <div class="practice-toggle" role="group" aria-label="Select practice material">
            <button class="practice-option" type="button" data-practice-selection="spaced">Spaced<small>review on schedule</small></button>
            <button class="practice-option" type="button" data-practice-selection="weak">Weak<small>focus weakest lines</small></button>
          </div>
        </section>
        <section class="trainer-grid">
          <div class="board-column">
            <div id="board" aria-label="Chess board"></div>
            <div class="board-history" aria-label="Move navigation">
              <button id="history-back" class="history-btn" type="button" aria-label="Previous move" aria-keyshortcuts="ArrowLeft">←</button>
              <span id="history-status">Current position</span>
              <button id="history-forward" class="history-btn" type="button" aria-label="Next move" aria-keyshortcuts="ArrowRight">→</button>
              <span class="keyboard-hint">Keyboard ← →</span>
            </div>
            <div class="board-actions">
              <button id="hint-toggle" class="secondary-btn" type="button">Hint: on</button>
              <button id="reset-line" class="secondary-btn" type="button">Restart line</button>
            </div>
          </div>
          <aside class="lesson-card">
            <div class="lesson-meta"><span id="line-counter"></span></div>
            <h2 id="line-title"></h2>
            <p class="variation" id="line-variation"></p>
            <div class="prompt" id="prompt"></div>
            <div class="feedback" id="feedback" aria-live="polite"></div>
            <div id="grading" class="grading hidden">
              <p>How well did that line stick?</p>
              <div class="grade-row">
                <button data-grade="again">Again</button>
                <button data-grade="hard">Hard</button>
                <button data-grade="good">Good</button>
                <button data-grade="easy">Easy</button>
              </div>
            </div>
            <div class="line-nav">
              <button id="prev-line" class="secondary-btn" type="button">← Previous</button>
              <button id="next-line" class="primary-btn" type="button">Next line →</button>
            </div>
          </aside>
        </section>
        <section class="course-map">
          <div class="section-heading"><div><div class="eyebrow">Course map</div><h2>12 practical branches</h2></div><button id="reset-progress" class="text-btn" type="button">Reset local progress</button></div>
          <div id="line-list" class="line-list"></div>
        </section>
      </main>`;

    this.board = new ChessBoard(
      this.root.querySelector('#board'),
      this.chess,
      this.course.side,
      { onMove: (from, to) => this.onUserMove(from, to) }
    );

    this.root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => this.setMode(button.dataset.mode)));
    this.root.querySelectorAll('[data-practice-selection]').forEach(button => button.addEventListener('click', () => this.setPracticeSelection(button.dataset.practiceSelection)));
    this.root.querySelector('#hint-toggle').addEventListener('click', () => { this.hintEnabled = !this.hintEnabled; this.refresh(); });
    this.root.querySelector('#reset-line').addEventListener('click', () => this.startLine(this.lineIndex));
    this.root.querySelector('#prev-line').addEventListener('click', () => this.startLine((this.lineIndex - 1 + this.course.lines.length) % this.course.lines.length));
    this.root.querySelector('#next-line').addEventListener('click', () => this.advanceLine());
    this.root.querySelector('#history-back').addEventListener('click', () => this.navigateHistory(-1));
    this.root.querySelector('#history-forward').addEventListener('click', () => this.navigateHistory(1));
    this.root.querySelector('#reset-progress').addEventListener('click', () => {
      resetProgress(this.course.id);
      this.progress = loadProgress(this.course.id);
      if (this.mode === 'practice') this.startPracticeQueue();
      else this.refresh();
    });
    this.root.querySelectorAll('[data-grade]').forEach(button => button.addEventListener('click', () => this.gradeLine(button.dataset.grade)));

    window.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.navigateHistory(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.navigateHistory(1);
      }
    });
  }

  modeSubtitle(mode) {
    return ({ learn: 'discover lines', practice: 'test your recall' })[mode];
  }

  setMode(mode) {
    if (!['learn', 'practice'].includes(mode)) return;
    this.mode = mode;
    if (mode === 'practice') {
      this.startPracticeQueue();
      return;
    }
    this.startLine(this.lineIndex);
  }

  setPracticeSelection(selection) {
    this.practiceSelection = normalizePracticeSelection(selection);
    if (this.mode === 'practice') {
      this.startPracticeQueue();
      return;
    }
    this.refresh();
  }

  pickPracticeLineIndex() {
    return selectPracticeLineIndex(this.course.lines, this.progress, this.practiceSelection);
  }

  startPracticeQueue() {
    const index = this.pickPracticeLineIndex();
    if (index === null) {
      this.enterPracticeCaughtUp();
      return;
    }
    this.startLine(index);
  }

  enterPracticeCaughtUp() {
    this.practiceCaughtUp = true;
    this.lineFinished = true;
    this.viewPly = null;
    this.board.clearSelection();
    this.clearFeedback();
    this.showFeedback('No spaced reviews are due right now.', 'correct');
    this.refresh();
  }

  startLine(index) {
    this.practiceCaughtUp = false;
    this.lineIndex = index;
    this.line = this.course.lines[index];
    this.chess.reset();
    this.ply = 0;
    this.viewPly = null;
    this.mistakesThisLine = 0;
    this.lineFinished = false;
    this.board.clearSelection();
    this.clearFeedback();
    this.refresh();
    window.setTimeout(() => this.autoPlayIfNeeded(), 90);
  }

  autoPlayIfNeeded() {
    if (this.lineFinished || this.ply >= this.line.moves.length) return;
    if (this.chess.turn() === this.course.side) { this.refresh(); return; }
    try {
      this.chess.moveUci(this.line.moves[this.ply]);
      this.ply += 1;
      this.board.clearSelection();
      this.refresh();
      if (this.ply >= this.line.moves.length) this.finishLine();
      else if (this.chess.turn() !== this.course.side) {
        window.setTimeout(() => this.autoPlayIfNeeded(), 75);
      }
    } catch (error) {
      this.showFeedback(`Course data error at ply ${this.ply + 1}: ${error.message}`, 'wrong');
    }
  }

  onUserMove(from, to) {
    if (this.viewPly !== null || this.lineFinished || this.chess.turn() !== this.course.side) return;
    const expected = this.line.moves[this.ply];
    const attempted = `${from}${to}`;
    if (!expected.startsWith(attempted)) {
      this.mistakesThisLine += 1;
      const expectedNotation = this.chess.notationFor(expected);
      this.showFeedback(this.mode === 'learn' ? `Not quite. Look for ${expectedNotation}.` : 'Not in the repertoire. Try again.', 'wrong');
      const p = this.progress.lines[this.line.id] ?? defaultLineProgress();
      p.mistakes += 1;
      this.progress.lines[this.line.id] = p;
      saveProgress(this.course.id, this.progress);
      this.board.clearSelection();
      this.refreshBoardState();
      return;
    }

    try {
      const move = this.chess.moveUci(expected);
      const moveIndex = this.ply;
      this.ply += 1;
      this.board.clearSelection();
      const note = this.line.notes[moveIndex];
      this.showFeedback(note ? `${move.san} — ${note}` : `${move.san}. Correct.`, 'correct');
      this.refresh();
      if (this.ply >= this.line.moves.length) this.finishLine();
      else window.setTimeout(() => this.autoPlayIfNeeded(), 130);
    } catch (error) {
      this.showFeedback(`Illegal course move: ${error.message}`, 'wrong');
    }
  }

  navigateHistory(delta) {
    const current = this.viewPly === null ? this.ply : this.viewPly;
    const next = Math.max(0, Math.min(this.ply, current + delta));
    if (next === current) return;
    this.viewPly = next === this.ply ? null : next;
    this.board.clearSelection();
    this.refresh();
  }

  positionAtPly(ply) {
    const chess = new MiniChess();
    let lastOpponentMove = null;
    for (let i = 0; i < ply; i += 1) {
      const mover = chess.turn();
      const move = chess.moveUci(this.line.moves[i]);
      if (mover !== this.course.side) lastOpponentMove = { from: move.from, to: move.to };
    }
    return { chess, lastOpponentMove };
  }

  finishLine() {
    this.lineFinished = true;
    if (!this.progress.discovered.includes(this.line.id)) this.progress.discovered.push(this.line.id);
    this.progress.totalSessions += 1;
    saveProgress(this.course.id, this.progress);
    this.showFeedback(this.mistakesThisLine === 0 ? 'Line complete — clean rep.' : `Line complete — ${this.mistakesThisLine} mistake${this.mistakesThisLine === 1 ? '' : 's'}.`, this.mistakesThisLine === 0 ? 'correct' : 'neutral');
    this.refresh();
  }

  gradeLine(grade) {
    if (this.practiceCaughtUp) return;
    const current = this.progress.lines[this.line.id] ?? defaultLineProgress();
    this.progress.lines[this.line.id] = scheduleReview(current, grade);
    saveProgress(this.course.id, this.progress);
    this.advanceLine();
  }

  advanceLine() {
    if (this.mode === 'practice') {
      this.startPracticeQueue();
      return;
    }
    this.lineIndex = (this.lineIndex + 1) % this.course.lines.length;
    this.startLine(this.lineIndex);
  }

  refresh() {
    this.root.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === this.mode));
    const practiceOptions = this.root.querySelector('#practice-options');
    practiceOptions.classList.toggle('hidden', this.mode !== 'practice');
    this.root.querySelectorAll('[data-practice-selection]').forEach(button => {
      button.classList.toggle('active', button.dataset.practiceSelection === this.practiceSelection);
    });

    const hintButton = this.root.querySelector('#hint-toggle');
    hintButton.textContent = `Hint: ${this.hintEnabled ? 'on' : 'off'}`;
    const practiceLabel = this.mode === 'practice' ? ` · ${this.practiceSelection.toUpperCase()}` : '';
    const caughtUpLabel = this.practiceCaughtUp ? ' · CAUGHT UP' : '';
    this.root.querySelector('#line-counter').textContent = this.practiceCaughtUp
      ? `${this.mode.toUpperCase()}${practiceLabel}${caughtUpLabel}`
      : `${this.mode.toUpperCase()}${practiceLabel} · Line ${this.lineIndex + 1}/${this.course.lines.length}`;
    this.root.querySelector('#line-title').textContent = this.practiceCaughtUp ? 'Spaced reviews complete' : this.line.title;
    this.root.querySelector('#line-variation').textContent = this.practiceCaughtUp ? 'Nothing else is due right now.' : this.line.variation;

    const prompt = this.root.querySelector('#prompt');
    if (this.practiceCaughtUp) {
      prompt.innerHTML = '<strong>You’re caught up.</strong><span>No spaced reviews are due right now. Switch to Weak for extra practice.</span>';
    } else if (this.viewPly !== null) {
      prompt.innerHTML = `<strong>Reviewing this line.</strong><span>Position ${this.viewPly} of ${this.ply}. Use → to return to the current position.</span>`;
    } else if (this.lineFinished) prompt.innerHTML = `<strong>Complete.</strong><span>${this.line.summary}</span>`;
    else if (this.chess.turn() === this.course.side && this.ply < this.line.moves.length) {
      const expected = this.line.moves[this.ply];
      const clue = this.mode === 'learn' || this.hintEnabled ? ` Find ${this.chess.notationFor(expected)}.` : '';
      prompt.innerHTML = `<strong>Your move as Black.</strong><span>${this.line.summary}${clue}</span>`;
    } else prompt.innerHTML = `<strong>Opponent move.</strong><span>Watch White’s choice, then respond from the repertoire.</span>`;

    this.root.querySelector('#grading').classList.toggle('hidden', !this.lineFinished || this.practiceCaughtUp);
    const nextLineButton = this.root.querySelector('#next-line');
    nextLineButton.disabled = this.mode === 'practice';
    nextLineButton.textContent = this.mode === 'practice'
      ? (this.practiceCaughtUp ? 'Reviews complete' : this.lineFinished ? 'Grade to continue' : 'Practice queue')
      : 'Next line →';
    this.root.querySelector('#reset-line').disabled = this.practiceCaughtUp;

    this.renderProgress();
    this.renderLineList();
    this.refreshBoardState();
    this.refreshHistoryControls();
  }

  refreshBoardState() {
    const displayPly = this.viewPly === null ? this.ply : this.viewPly;
    const { chess, lastOpponentMove } = this.positionAtPly(displayPly);
    const live = this.viewPly === null;
    this.board.setPosition(chess, {
      lastMove: lastOpponentMove,
      interactive: live && !this.lineFinished
    });
    const expected = live && !this.lineFinished && this.chess.turn() === this.course.side ? this.line.moves[this.ply] : null;
    this.board.setExpectedMove(expected, live && (this.hintEnabled || this.mode === 'learn'));
  }

  refreshHistoryControls() {
    const displayPly = this.viewPly === null ? this.ply : this.viewPly;
    const back = this.root.querySelector('#history-back');
    const forward = this.root.querySelector('#history-forward');
    const status = this.root.querySelector('#history-status');
    back.disabled = displayPly === 0;
    forward.disabled = displayPly === this.ply;
    status.textContent = this.viewPly === null ? 'Current position' : `Position ${displayPly} / ${this.ply}`;
  }

  clearFeedback() {
    const el = this.root.querySelector('#feedback');
    if (el) { el.className = 'feedback'; el.textContent = ''; }
  }

  showFeedback(message, kind) {
    const el = this.root.querySelector('#feedback');
    el.className = `feedback ${kind}`;
    el.textContent = message;
  }

  renderProgress() {
    const discovered = this.progress.discovered.length;
    const mastered = this.course.lines.filter(line => (this.progress.lines[line.id]?.repetitions ?? 0) >= 2).length;
    this.root.querySelector('#course-progress').innerHTML = `<div><strong>${discovered}/${this.course.lines.length}</strong><span>discovered</span></div><div><strong>${mastered}</strong><span>mastered</span></div>`;
  }

  renderLineList() {
    const el = this.root.querySelector('#line-list');
    el.innerHTML = this.course.lines.map((line, index) => {
      const p = this.progress.lines[line.id];
      const discovered = this.progress.discovered.includes(line.id);
      const status = (p?.repetitions ?? 0) >= 2 ? 'Mastered' : discovered ? 'Learning' : 'New';
      return `<button class="line-item ${index === this.lineIndex ? 'current' : ''}" data-line-index="${index}"><span class="line-number">${String(index + 1).padStart(2,'0')}</span><span><strong>${line.title}</strong><small>${line.variation}</small></span><span class="status-pill ${status.toLowerCase()}">${status}</span></button>`;
    }).join('');
    el.querySelectorAll('[data-line-index]').forEach(button => button.addEventListener('click', () => this.startLine(Number(button.dataset.lineIndex))));
  }
}
