import { AutomaticSpacedTrainerApp } from './automatic-spaced-trainer.js?v=history-attempt-parity-v3';
import { createLessonSession, hasParentLesson, responseSessionStartPly } from './lesson-session.js?v=lesson-session-v1';

export class LessonSessionTrainerApp extends AutomaticSpacedTrainerApp {
  constructor(root, course, options = {}) {
    super(root, course, options);
    this.lessonSession = createLessonSession({
      teachingUnit: { kind: 'line', id: this.line.id },
      origin: 'line',
      startPly: 0
    });
  }

  renderShell() {
    super.renderShell();

    // Base Trainer predates first-class teaching units and binds Previous directly
    // to lineIndex. Replace only that control so navigation dispatches through the
    // teaching-unit abstraction. Next already dispatches through advanceLine().
    const oldPrevious = this.root.querySelector('#prev-line');
    if (oldPrevious) {
      const previous = oldPrevious.cloneNode(true);
      oldPrevious.replaceWith(previous);
      previous.addEventListener('click', () => this.navigateLesson(-1));
    }
  }

  hasParentLesson() {
    return hasParentLesson(this.lessonSession);
  }

  beginLessonSession({ lineIndex, route, teachingUnit, origin, startPly = 0, parent = null }) {
    const line = this.course.lines[lineIndex];
    if (!line) throw new Error(`Lesson session references unknown line index ${lineIndex}`);

    this.lineIndex = lineIndex;
    this.line = line;
    this.responseReturn = null;
    this.lessonSession = createLessonSession({ teachingUnit, origin, startPly, parent });
    this.beginRoute(route, startPly);
  }

  startLine(index) {
    const line = this.course.lines[index];
    if (!line) return;
    const route = this.mode === 'practice'
      ? this.repertoire.pickPracticeRoute(line, this.progress, this.random)
      : this.repertoire.canonicalRoute(line);
    this.beginLessonSession({
      lineIndex: index,
      route,
      teachingUnit: { kind: 'line', id: line.id },
      origin: this.mode === 'practice' ? 'practice' : 'line',
      startPly: 0
    });
  }

  snapshotLessonState() {
    return Object.freeze({
      lineIndex: this.lineIndex,
      lineId: this.line.id,
      sessionRoute: this.sessionRoute,
      lessonSession: this.lessonSession,
      ply: this.ply,
      lineFinished: this.lineFinished,
      mistakesThisLine: this.mistakesThisLine,
      learnOpponentOptions: [...this.learnOpponentOptions]
    });
  }

  restoreLessonState(state) {
    const line = this.course.lines[state?.lineIndex];
    if (!line || line.id !== state?.lineId || !state?.sessionRoute || !state?.lessonSession) {
      this.startLine(this.lineIndex);
      return;
    }

    this.lineIndex = state.lineIndex;
    this.line = line;
    this.sessionRoute = state.sessionRoute;
    this.lessonSession = state.lessonSession;
    this.responseReturn = null;
    this.chess.reset();
    for (const move of this.sessionRoute.moves.slice(0, state.ply)) this.chess.moveUci(move);
    this.ply = state.ply;
    this.viewPly = null;
    this.mistakesThisLine = state.mistakesThisLine;
    this.lineFinished = state.lineFinished;
    this.learnOpponentOptions = [...state.learnOpponentOptions];
    this.board.clearSelection();
    this.clearFeedback();
    this.refresh();

    if (!this.lineFinished && this.chess.turn() !== this.course.side) {
      window.setTimeout(() => this.autoPlayIfNeeded(), 75);
    }
  }

  startResponseRoute(route, {
    lineIndex = this.lineIndex,
    origin = 'embedded-response',
    parent = null
  } = {}) {
    if (!route?.responseId) return;
    const startPly = responseSessionStartPly(origin, route.divergencePly);
    this.beginLessonSession({
      lineIndex,
      route,
      teachingUnit: { kind: 'response', id: route.responseId },
      origin,
      startPly,
      parent
    });
  }

  startResponseLesson(routeId) {
    if (this.mode !== 'learn') return;
    const route = this.findNewResponseRoute(routeId);
    if (!route) return;

    this.startResponseRoute(route, {
      lineIndex: this.lineIndex,
      origin: 'embedded-response',
      parent: this.snapshotLessonState()
    });
  }

  returnToLesson() {
    const parent = this.lessonSession?.parent;
    if (!parent) {
      this.navigateLesson(1);
      return;
    }
    this.restoreLessonState(parent);
  }

  restartCurrentRoute() {
    if (this.practiceCaughtUp) return;
    const route = this.sessionRoute ?? this.repertoire.canonicalRoute(this.line);
    this.beginRoute(route, this.lessonSession?.startPly ?? 0);
  }

  navigateLesson(delta) {
    if (this.mode === 'practice') return;
    const nextIndex = (this.lineIndex + delta + this.course.lines.length) % this.course.lines.length;
    this.startLine(nextIndex);
  }

  advanceLine() {
    if (this.mode === 'practice') {
      this.startPracticeQueue();
      return;
    }
    if (this.isLearnResponseLesson() && this.hasParentLesson()) {
      this.returnToLesson();
      return;
    }
    this.navigateLesson(1);
  }

  renderRootResponseBuildPrompt() {
    const rootResponse = this.isLearnResponseLesson() && !this.hasParentLesson();
    const beforeResponseDecision = rootResponse
      && this.viewPly === null
      && !this.lineFinished
      && this.ply <= (this.sessionRoute?.divergencePly ?? 0)
      && this.chess.turn() === this.course.side;
    if (!beforeResponseDecision) return;

    const prompt = this.root.querySelector('#prompt');
    const expected = this.currentExpectedMove();
    const clue = this.hintEnabled && expected ? ` Find ${this.chess.notationFor(expected)}.` : '';
    prompt.replaceChildren();
    const advice = document.createElement('span');
    advice.textContent = `Build the position. Follow your repertoire to reach this lesson.${clue}`;
    prompt.append(advice);
  }

  refresh() {
    super.refresh();
    if (!this.isLearnResponseLesson()) return;

    const parent = this.hasParentLesson();
    const next = this.root.querySelector('#next-line');
    const previous = this.root.querySelector('#prev-line');
    next.disabled = !this.lineFinished;
    next.textContent = this.lineFinished
      ? (parent ? 'Return to lesson' : 'Next lesson →')
      : 'Complete response';
    previous.disabled = parent;
    this.renderRootResponseBuildPrompt();
  }
}
