import { MiniChess } from './mini-chess.js';
import { ChessBoard } from './chess-board.js';
import { defaultLineProgress, loadProgress, resetProgress, saveProgress, scheduleReview } from './progress.js';
import { normalizePracticeSelection, pickPracticeLineIndex as selectPracticeLineIndex } from './practice-selection.js';
import { RepertoireMoveIndex } from './repertoire-moves.js?v=response-learning-v2';

export class TrainerApp {
  constructor(root, course, options = {}) {
    this.root = root;
    this.course = course;
    this.chess = new MiniChess();
    this.progress = loadProgress(course.id);
    this.repertoire = new RepertoireMoveIndex(course);
    this.random = options.random ?? Math.random;
    this.mode = 'learn';
    this.practiceSelection = 'spaced';
    this.practiceCaughtUp = false;
    this.line = course.lines[0];
    this.lineIndex = 0;
    this.sessionRoute = this.repertoire.canonicalRoute(this.line);
    this.learnOpponentOptions = [];
    this.responseReturn = null;
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
            <section id="opponent-options" class="opponent-options hidden" aria-label="Other good opponent moves"></section>
            <section id="response-summary" class="response-summary hidden" aria-label="Responses to learn"></section>
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
    this.root.querySelector('#reset-line').addEventListener('click', () => this.restartCurrentRoute());
    this.root.querySelector('#prev-line').addEventListener('click', () => this.startLine((this.lineIndex - 1 + this.course.lines.length) % this.course.lines.length));
    this.root.querySelector('#next-line').addEventListener('click', () => this.advanceLine());
    this.root.querySelector('#history-back').addEventListener('click', () => this.navigateHistory(-1));
    this.root.querySelector('#history-forward').addEventListener('click', () => this.navigateHistory(1));
    this.root.querySelector('#reset-progress').addEventListener('click', () => {
      resetProgress(this.course.id);
      this.progress = loadProgress(this.course.id);
      if (this.mode === 'practice') this.startPracticeQueue();
      else this.startLine(this.lineIndex);
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

  isLearnResponseLesson() {
    return this.mode === 'learn' && this.sessionRoute?.coverage === 'new-response';
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
    this.learnOpponentOptions = [];
    this.responseReturn = null;
    this.board.clearSelection();
    this.clearFeedback();
    this.showFeedback('No spaced reviews are due right now.', 'correct');
    this.refresh();
  }

  startLine(index) {
    this.practiceCaughtUp = false;
    this.lineIndex = index;
    this.line = this.course.lines[index];
    this.responseReturn = null;
    const route = this.mode === 'practice'
      ? this.repertoire.pickPracticeRoute(this.line, this.progress, this.random)
      : this.repertoire.canonicalRoute(this.line);
    this.beginRoute(route, 0);
  }

  beginRoute(route, startPly = 0) {
    this.practiceCaughtUp = false;
    this.sessionRoute = route;
    this.chess.reset();
    for (const move of route.moves.slice(0, startPly)) this.chess.moveUci(move);
    this.ply = startPly;
    this.viewPly = null;
    this.mistakesThisLine = 0;
    this.lineFinished = false;
    this.learnOpponentOptions = [];
    this.board.clearSelection();
    this.clearFeedback();
    this.refresh();
    window.setTimeout(() => this.autoPlayIfNeeded(), 90);
  }

  restartCurrentRoute() {
    if (this.practiceCaughtUp) return;
    const startPly = this.sessionRoute?.kind === 'canonical' ? 0 : (this.sessionRoute?.divergencePly ?? 0);
    this.beginRoute(this.sessionRoute ?? this.repertoire.canonicalRoute(this.line), startPly);
  }

  currentExpectedMove() {
    return this.sessionRoute?.moves?.[this.ply] ?? null;
  }

  currentRouteNote(ply = this.ply) {
    return this.sessionRoute?.notes?.[ply] ?? '';
  }

  recordTrainingMistake() {
    this.mistakesThisLine += 1;
    if (this.isLearnResponseLesson()) return;

    const progress = this.progress.lines[this.line.id] ?? defaultLineProgress();
    progress.mistakes += 1;
    this.progress.lines[this.line.id] = progress;
    saveProgress(this.course.id, this.progress);
  }

  autoPlayIfNeeded() {
    if (this.lineFinished || this.ply >= this.sessionRoute.moves.length) return;
    if (this.chess.turn() === this.course.side) { this.refresh(); return; }
    try {
      const alternatives = this.mode === 'learn' && this.sessionRoute.kind === 'canonical'
        ? this.repertoire.opponentAlternatives(this.line, this.ply)
        : [];
      this.chess.moveUci(this.sessionRoute.moves[this.ply]);
      this.ply += 1;
      this.learnOpponentOptions = alternatives;
      this.board.clearSelection();
      this.refresh();
      if (this.ply >= this.sessionRoute.moves.length) this.finishLine();
      else if (this.chess.turn() !== this.course.side) {
        window.setTimeout(() => this.autoPlayIfNeeded(), 75);
      }
    } catch (error) {
      this.showFeedback(`Course data error at ply ${this.ply + 1}: ${error.message}`, 'wrong');
    }
  }

  findNewResponseRoute(routeId) {
    const candidates = [
      ...this.learnOpponentOptions,
      ...this.repertoire.newResponsesForLine(this.line)
    ];
    return candidates.find(route => route.id === routeId && route.coverage === 'new-response') ?? null;
  }

  startResponseLesson(routeId) {
    if (this.mode !== 'learn') return;
    const route = this.findNewResponseRoute(routeId);
    if (!route) return;

    this.responseReturn = {
      lineIndex: this.lineIndex,
      lineId: this.line.id,
      ply: this.ply,
      lineFinished: this.lineFinished,
      mistakesThisLine: this.mistakesThisLine,
      learnOpponentOptions: [...this.learnOpponentOptions]
    };
    this.beginRoute(route, route.divergencePly ?? 0);
  }

  openCoveredLesson(routeId) {
    if (this.mode !== 'learn') return;
    const route = this.learnOpponentOptions.find(candidate =>
      candidate.id === routeId && candidate.coverage === 'covered-elsewhere'
    );
    if (!route?.targetLineId) return;
    const targetIndex = this.course.lines.findIndex(line => line.id === route.targetLineId);
    if (targetIndex >= 0) this.startLine(targetIndex);
  }

  returnToLesson() {
    const state = this.responseReturn;
    if (!state) {
      this.startLine(this.lineIndex);
      return;
    }

    const line = this.course.lines[state.lineIndex];
    if (!line || line.id !== state.lineId) {
      this.startLine(this.lineIndex);
      return;
    }

    this.lineIndex = state.lineIndex;
    this.line = line;
    this.sessionRoute = this.repertoire.canonicalRoute(line);
    this.chess.reset();
    for (const move of this.sessionRoute.moves.slice(0, state.ply)) this.chess.moveUci(move);
    this.ply = state.ply;
    this.viewPly = null;
    this.mistakesThisLine = state.mistakesThisLine;
    this.lineFinished = state.lineFinished;
    this.learnOpponentOptions = state.learnOpponentOptions;
    this.responseReturn = null;
    this.board.clearSelection();
    this.clearFeedback();
    this.refresh();
  }

  markResponseLearned(responseId) {
    if (!responseId) return;
    const learned = new Set(this.progress.learnedResponses ?? []);
    learned.add(responseId);
    this.progress.learnedResponses = [...learned];
  }

  completeResponseLesson(move, note) {
    this.lineFinished = true;
    this.markResponseLearned(this.sessionRoute.responseId);
    saveProgress(this.course.id, this.progress);
    this.showFeedback(note ? `${move.san} — ${note}` : `${move.san}. Correct.`, 'correct');
    this.refresh();
  }

  onUserMove(from, to) {
    if (this.viewPly !== null || this.lineFinished || this.chess.turn() !== this.course.side) return;
    const expected = this.currentExpectedMove();
    const attempted = `${from}${to}`;
    if (!expected?.startsWith(attempted)) {
      this.recordTrainingMistake();
      const expectedNotation = expected ? this.chess.notationFor(expected) : '';
      this.showFeedback(this.mode === 'learn' ? `Not quite. Look for ${expectedNotation}.` : 'Not in the repertoire. Try again.', 'wrong');
      this.board.clearSelection();
      this.refreshBoardState();
      return;
    }

    try {
      const move = this.chess.moveUci(expected);
      const moveIndex = this.ply;
      this.ply += 1;
      this.board.clearSelection();
      const note = this.currentRouteNote(moveIndex);

      if (this.isLearnResponseLesson() && moveIndex === this.sessionRoute.responsePly) {
        this.completeResponseLesson(move, note);
        return;
      }

      this.showFeedback(note ? `${move.san} — ${note}` : `${move.san}. Correct.`, 'correct');
      this.refresh();
      if (this.ply >= this.sessionRoute.moves.length) this.finishLine();
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
      const move = chess.moveUci(this.sessionRoute.moves[i]);
      if (mover !== this.course.side) lastOpponentMove = { from: move.from, to: move.to };
    }
    return { chess, lastOpponentMove };
  }

  finishLine() {
    this.lineFinished = true;
    if (this.mode === 'learn' && this.sessionRoute.kind === 'canonical'
      && !this.progress.discovered.includes(this.line.id)) {
      this.progress.discovered.push(this.line.id);
    }
    this.progress.totalSessions += 1;
    saveProgress(this.course.id, this.progress);

    this.showFeedback(
      this.mistakesThisLine === 0 ? 'Line complete — clean rep.' : `Line complete — ${this.mistakesThisLine} mistake${this.mistakesThisLine === 1 ? '' : 's'}.`,
      this.mistakesThisLine === 0 ? 'correct' : 'neutral'
    );
    this.refresh();
  }

  gradeLine(grade) {
    if (this.practiceCaughtUp || this.isLearnResponseLesson()) return;
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
    if (this.isLearnResponseLesson()) {
      this.returnToLesson();
      return;
    }
    this.lineIndex = (this.lineIndex + 1) % this.course.lines.length;
    this.startLine(this.lineIndex);
  }

  appendOpponentOptionGroup(panel, label, routes) {
    if (!routes.length) return;

    const group = document.createElement('div');
    group.className = 'opponent-options-group';
    const groupLabel = document.createElement('div');
    groupLabel.className = 'opponent-options-group-label';
    groupLabel.textContent = label;
    group.append(groupLabel);

    const list = document.createElement('div');
    list.className = 'opponent-options-list';
    for (const route of routes) {
      const item = document.createElement('div');
      item.className = `opponent-option ${route.coverage}`;
      item.dataset.opponentMove = route.opponentLabel;

      const copy = document.createElement('div');
      copy.className = 'opponent-option-copy';
      const titleRow = document.createElement('div');
      titleRow.className = 'opponent-option-title';
      const title = document.createElement('strong');
      title.textContent = route.opponentLabel;
      const badge = document.createElement('span');
      badge.className = 'coverage-badge';
      badge.textContent = route.coverage === 'new-response' ? 'New response' : 'Covered elsewhere';
      titleRow.append(title, badge);

      const idea = document.createElement('span');
      if (route.coverage === 'new-response') {
        idea.textContent = route.idea;
      } else {
        const extra = route.targetTitles.length > 1 ? ` and ${route.targetTitles.length - 1} more` : '';
        idea.textContent = `Covered in “${route.label}”${extra}. ${route.idea}`;
      }
      copy.append(titleRow, idea);

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'deviation-btn';
      action.dataset.deviationRoute = route.id;
      if (route.coverage === 'new-response') {
        const learned = this.repertoire.isResponseLearned(route, this.progress);
        action.textContent = learned ? 'Review response' : 'Learn response';
        if (learned) {
          const learnedLabel = document.createElement('span');
          learnedLabel.className = 'opponent-option-status';
          learnedLabel.textContent = `Learned · ${route.responseLabel}`;
          copy.append(learnedLabel);
        }
        action.addEventListener('click', () => this.startResponseLesson(route.id));
      } else {
        const discovered = this.repertoire.isCoveredLessonDiscovered(route, this.progress);
        action.textContent = discovered ? 'Review lesson' : 'Learn lesson';
        action.addEventListener('click', () => this.openCoveredLesson(route.id));
      }

      item.append(copy, action);
      list.append(item);
    }
    group.append(list);
    panel.append(group);
  }

  renderOpponentOptions() {
    const panel = this.root.querySelector('#opponent-options');
    const visible = this.mode === 'learn'
      && !this.lineFinished
      && this.sessionRoute.kind === 'canonical'
      && this.learnOpponentOptions.length > 0;
    panel.classList.toggle('hidden', !visible);
    panel.replaceChildren();
    if (!visible) return;

    const heading = document.createElement('div');
    heading.className = 'opponent-options-heading';
    const strong = document.createElement('strong');
    strong.textContent = 'Other good moves for White';
    const small = document.createElement('span');
    small.textContent = 'Learn new responses here; moves already taught elsewhere stay linked to their lesson.';
    heading.append(strong, small);
    panel.append(heading);

    const newResponses = this.learnOpponentOptions.filter(route => route.coverage === 'new-response');
    const coveredElsewhere = this.learnOpponentOptions.filter(route => route.coverage === 'covered-elsewhere');
    this.appendOpponentOptionGroup(panel, 'New responses', newResponses);
    this.appendOpponentOptionGroup(panel, 'Covered elsewhere', coveredElsewhere);
  }

  renderResponseSummary() {
    const panel = this.root.querySelector('#response-summary');
    const responses = this.mode === 'learn' && this.lineFinished && this.sessionRoute.kind === 'canonical'
      ? this.repertoire.newResponsesForLine(this.line)
      : [];
    panel.classList.toggle('hidden', responses.length === 0);
    panel.replaceChildren();
    if (!responses.length) return;

    const learnedCount = responses.filter(route => this.repertoire.isResponseLearned(route, this.progress)).length;
    const heading = document.createElement('div');
    heading.className = 'response-summary-heading';
    const strong = document.createElement('strong');
    strong.textContent = 'Responses to learn';
    const small = document.createElement('span');
    small.textContent = `${learnedCount}/${responses.length} learned · The main lesson is complete; these cover other practical White choices.`;
    heading.append(strong, small);
    panel.append(heading);

    const list = document.createElement('div');
    list.className = 'response-summary-list';
    for (const route of responses) {
      const learned = this.repertoire.isResponseLearned(route, this.progress);
      const item = document.createElement('div');
      item.className = `response-summary-item${learned ? ' learned' : ''}`;

      const copy = document.createElement('div');
      copy.className = 'opponent-option-copy';
      const titleRow = document.createElement('div');
      titleRow.className = 'opponent-option-title';
      const title = document.createElement('strong');
      title.textContent = route.opponentLabel;
      const badge = document.createElement('span');
      badge.className = 'coverage-badge';
      badge.textContent = learned ? 'Learned ✓' : 'New response';
      titleRow.append(title, badge);
      const idea = document.createElement('span');
      idea.textContent = route.idea;
      copy.append(titleRow, idea);
      if (learned) {
        const status = document.createElement('span');
        status.className = 'opponent-option-status';
        status.textContent = `Your response: ${route.responseLabel}`;
        copy.append(status);
      }

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'deviation-btn';
      action.textContent = learned ? 'Review response' : 'Learn response';
      action.addEventListener('click', () => this.startResponseLesson(route.id));
      item.append(copy, action);
      list.append(item);
    }
    panel.append(list);
  }

  refresh() {
    this.root.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === this.mode));
    const practiceOptions = this.root.querySelector('#practice-options');
    practiceOptions.classList.toggle('hidden', this.mode !== 'practice');
    this.root.querySelectorAll('[data-practice-selection]').forEach(button => {
      button.classList.toggle('active', button.dataset.practiceSelection === this.practiceSelection);
    });

    const responseLesson = this.isLearnResponseLesson();
    const hintButton = this.root.querySelector('#hint-toggle');
    hintButton.textContent = `Hint: ${this.hintEnabled ? 'on' : 'off'}`;
    const practiceLabel = this.mode === 'practice' ? ` · ${this.practiceSelection.toUpperCase()}` : '';
    const caughtUpLabel = this.practiceCaughtUp ? ' · CAUGHT UP' : '';
    this.root.querySelector('#line-counter').textContent = this.practiceCaughtUp
      ? `${this.mode.toUpperCase()}${practiceLabel}${caughtUpLabel}`
      : responseLesson
        ? `LEARN · RESPONSE · Line ${this.lineIndex + 1}/${this.course.lines.length}`
        : `${this.mode.toUpperCase()}${practiceLabel} · Line ${this.lineIndex + 1}/${this.course.lines.length}`;

    this.root.querySelector('#line-title').textContent = this.practiceCaughtUp
      ? 'Spaced reviews complete'
      : responseLesson
        ? `Another good move: ${this.sessionRoute.opponentLabel}`
        : this.line.title;

    this.root.querySelector('#line-variation').textContent = this.practiceCaughtUp
      ? 'Nothing else is due right now.'
      : responseLesson
        ? `New response · from ${this.line.title}`
        : this.sessionRoute.kind === 'canonical'
          ? this.line.variation
          : this.sessionRoute.coverage === 'covered-elsewhere'
            ? `${this.line.variation} · ${this.sessionRoute.opponentLabel} routes into ${this.sessionRoute.label}`
            : `${this.line.variation} · ${this.sessionRoute.opponentLabel} response`;

    const prompt = this.root.querySelector('#prompt');
    if (this.practiceCaughtUp) {
      prompt.innerHTML = '<strong>You’re caught up.</strong><span>No spaced reviews are due right now. Switch to Weak for extra practice.</span>';
    } else if (this.viewPly !== null) {
      prompt.innerHTML = `<strong>Reviewing this route.</strong><span>Position ${this.viewPly} of ${this.ply}. Use → to return to the current position.</span>`;
    } else if (responseLesson && this.lineFinished) {
      const example = this.sessionRoute.exampleLabels?.length
        ? ` Typical continuation: ${this.sessionRoute.exampleLabels.join(' ')}.`
        : '';
      prompt.innerHTML = `<strong>Response learned ✓</strong><span>${this.sessionRoute.responseLabel} is your repertoire response. ${this.sessionRoute.idea}${example}</span>`;
    } else if (responseLesson && this.chess.turn() === this.course.side) {
      const expected = this.currentExpectedMove();
      const clue = this.hintEnabled || this.mode === 'learn' ? ` Find ${this.chess.notationFor(expected)}.` : '';
      prompt.innerHTML = `<strong>How should Black respond?</strong><span>${this.sessionRoute.idea}${clue}</span>`;
    } else if (responseLesson) {
      prompt.innerHTML = `<strong>White could also play ${this.sessionRoute.opponentLabel}.</strong><span>This move is not taught in another lesson. Learn the repertoire response here.</span>`;
    } else if (this.lineFinished) {
      prompt.innerHTML = `<strong>Complete.</strong><span>${this.line.summary}</span>`;
    } else if (this.chess.turn() === this.course.side && this.ply < this.sessionRoute.moves.length) {
      const expected = this.currentExpectedMove();
      const clue = this.mode === 'learn' || this.hintEnabled ? ` Find ${this.chess.notationFor(expected)}.` : '';
      const summary = this.sessionRoute.kind === 'canonical' ? this.line.summary : this.sessionRoute.idea;
      prompt.innerHTML = `<strong>Your move as Black.</strong><span>${summary}${clue}</span>`;
    } else {
      prompt.innerHTML = '<strong>Opponent move.</strong><span>Watch White’s choice, then respond from the repertoire.</span>';
    }

    this.root.querySelector('#grading').classList.toggle('hidden', !this.lineFinished || this.practiceCaughtUp || responseLesson);
    const nextLineButton = this.root.querySelector('#next-line');
    nextLineButton.disabled = this.mode === 'practice' || (responseLesson && !this.lineFinished);
    nextLineButton.textContent = this.mode === 'practice'
      ? (this.practiceCaughtUp ? 'Reviews complete' : this.lineFinished ? 'Grade to continue' : 'Practice queue')
      : responseLesson
        ? (this.lineFinished ? 'Return to lesson' : 'Complete response')
        : 'Next line →';
    this.root.querySelector('#prev-line').disabled = responseLesson;
    this.root.querySelector('#reset-line').disabled = this.practiceCaughtUp;

    this.renderOpponentOptions();
    this.renderResponseSummary();
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
    const expected = live && !this.lineFinished && this.chess.turn() === this.course.side ? this.currentExpectedMove() : null;
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
