import { MiniChess } from './mini-chess.js';
import { ChessBoard } from './chess-board.js';
import { defaultLineProgress, loadProgress, resetProgress, saveProgress, scheduleReview } from './progress.js';

export class TrainerApp {
  constructor(root, course) {
    this.root = root;
    this.course = course;
    this.chess = new MiniChess();
    this.progress = loadProgress(course.id);
    this.mode = 'learn';
    this.line = course.lines[0];
    this.lineIndex = 0;
    this.ply = 0;
    this.mistakesThisLine = 0;
    this.hintEnabled = true;
    this.lineFinished = false;
    this.timerStartedAt = 0;
    this.timerHandle = null;
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
          ${['learn','practice','drill','time'].map(mode => `<button class="mode-btn" data-mode="${mode}">${mode[0].toUpperCase()+mode.slice(1)}<small>${this.modeSubtitle(mode)}</small></button>`).join('')}
        </nav>
        <section class="trainer-grid">
          <div class="board-column">
            <div id="board" aria-label="Chess board"></div>
            <div class="board-actions">
              <button id="hint-toggle" class="secondary-btn" type="button">Hint: on</button>
              <button id="reset-line" class="secondary-btn" type="button">Restart line</button>
            </div>
          </div>
          <aside class="lesson-card">
            <div class="lesson-meta"><span id="line-counter"></span><span id="timer" class="timer"></span></div>
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
    this.root.querySelector('#hint-toggle').addEventListener('click', () => { this.hintEnabled = !this.hintEnabled; this.refresh(); });
    this.root.querySelector('#reset-line').addEventListener('click', () => this.startLine(this.lineIndex));
    this.root.querySelector('#prev-line').addEventListener('click', () => this.startLine((this.lineIndex - 1 + this.course.lines.length) % this.course.lines.length));
    this.root.querySelector('#next-line').addEventListener('click', () => this.advanceLine());
    this.root.querySelector('#reset-progress').addEventListener('click', () => {
      resetProgress(this.course.id);
      this.progress = loadProgress(this.course.id);
      this.refresh();
    });
    this.root.querySelectorAll('[data-grade]').forEach(button => button.addEventListener('click', () => this.gradeLine(button.dataset.grade)));
  }

  modeSubtitle(mode) {
    return ({ learn: 'discover lines', practice: 'spaced review', drill: 'rapid reps', time: 'beat the clock' })[mode];
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'practice') this.lineIndex = this.pickDueLineIndex();
    else if (mode === 'drill' || mode === 'time') this.lineIndex = this.pickWeakLineIndex();
    this.startLine(this.lineIndex);
  }

  pickDueLineIndex() {
    const now = Date.now();
    return this.course.lines.map((line, index) => {
      const progress = this.progress.lines[line.id] ?? defaultLineProgress(now);
      return { index, dueAt: progress.dueAt, repetitions: progress.repetitions };
    }).sort((a,b) => a.dueAt - b.dueAt || a.repetitions - b.repetitions)[0].index;
  }

  pickWeakLineIndex() {
    const ranked = this.course.lines.map((line, index) => {
      const p = this.progress.lines[line.id] ?? defaultLineProgress();
      return { index, score: p.completions * 2 + p.repetitions - p.mistakes * 3 };
    }).sort((a,b) => a.score - b.score);
    const weakest = ranked.slice(0, Math.min(4, ranked.length));
    return weakest[Math.floor(Math.random() * weakest.length)].index;
  }

  startLine(index) {
    if (this.timerHandle !== null) window.clearInterval(this.timerHandle);
    this.timerHandle = null;
    this.lineIndex = index;
    this.line = this.course.lines[index];
    this.chess.reset();
    this.ply = 0;
    this.mistakesThisLine = 0;
    this.lineFinished = false;
    this.board.clearSelection();
    this.timerStartedAt = Date.now();
    const timer = this.root.querySelector('#timer');
    if (timer) timer.textContent = '';
    if (this.mode === 'time') this.startTimer();
    this.clearFeedback();
    this.refresh();
    window.setTimeout(() => this.autoPlayIfNeeded(), 90);
  }

  startTimer() {
    this.timerHandle = window.setInterval(() => {
      const timer = this.root.querySelector('#timer');
      if (timer) timer.textContent = `${((Date.now() - this.timerStartedAt) / 1000).toFixed(1)}s`;
    }, 100);
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
      else window.setTimeout(() => this.autoPlayIfNeeded(), 75);
    } catch (error) {
      this.showFeedback(`Course data error at ply ${this.ply + 1}: ${error.message}`, 'wrong');
    }
  }

  onUserMove(from, to) {
    if (this.lineFinished || this.chess.turn() !== this.course.side) return;
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
      this.refreshBoardHint();
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

  finishLine() {
    this.lineFinished = true;
    if (this.timerHandle !== null) window.clearInterval(this.timerHandle);
    this.timerHandle = null;
    if (!this.progress.discovered.includes(this.line.id)) this.progress.discovered.push(this.line.id);
    this.progress.totalSessions += 1;
    saveProgress(this.course.id, this.progress);
    this.showFeedback(this.mistakesThisLine === 0 ? 'Line complete — clean rep.' : `Line complete — ${this.mistakesThisLine} mistake${this.mistakesThisLine === 1 ? '' : 's'}.`, this.mistakesThisLine === 0 ? 'correct' : 'neutral');
    this.refresh();
  }

  gradeLine(grade) {
    const current = this.progress.lines[this.line.id] ?? defaultLineProgress();
    this.progress.lines[this.line.id] = scheduleReview(current, grade);
    saveProgress(this.course.id, this.progress);
    this.advanceLine();
  }

  advanceLine() {
    if (this.mode === 'practice') this.lineIndex = this.pickDueLineIndex();
    else if (this.mode === 'drill' || this.mode === 'time') this.lineIndex = this.pickWeakLineIndex();
    else this.lineIndex = (this.lineIndex + 1) % this.course.lines.length;
    this.startLine(this.lineIndex);
  }

  refresh() {
    this.root.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === this.mode));
    const hintButton = this.root.querySelector('#hint-toggle');
    hintButton.textContent = `Hint: ${this.hintEnabled ? 'on' : 'off'}`;
    this.root.querySelector('#line-counter').textContent = `${this.mode.toUpperCase()} · Line ${this.lineIndex + 1}/${this.course.lines.length}`;
    this.root.querySelector('#line-title').textContent = this.line.title;
    this.root.querySelector('#line-variation').textContent = this.line.variation;

    const prompt = this.root.querySelector('#prompt');
    if (this.lineFinished) prompt.innerHTML = `<strong>Complete.</strong><span>${this.line.summary}</span>`;
    else if (this.chess.turn() === this.course.side && this.ply < this.line.moves.length) {
      const expected = this.line.moves[this.ply];
      const clue = this.mode === 'learn' || this.hintEnabled ? ` Find ${this.chess.notationFor(expected)}.` : '';
      prompt.innerHTML = `<strong>Your move as Black.</strong><span>${this.line.summary}${clue}</span>`;
    } else prompt.innerHTML = `<strong>Opponent move.</strong><span>Watch White’s choice, then respond from the repertoire.</span>`;

    this.root.querySelector('#grading').classList.toggle('hidden', !this.lineFinished);
    this.renderProgress();
    this.renderLineList();
    this.refreshBoardHint();
  }

  refreshBoardHint() {
    const expected = !this.lineFinished && this.chess.turn() === this.course.side ? this.line.moves[this.ply] : null;
    this.board.setExpectedMove(expected, this.hintEnabled || this.mode === 'learn');
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
