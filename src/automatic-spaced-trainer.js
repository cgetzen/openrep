import { OpenRepTrainerApp } from './practice-trainer.js?v=recent-attempt-mastery-v1';
import { CoachingTrainerApp } from './coaching-trainer.js?v=history-advice-v2';
import { classifyMoveQuality } from './evaluation.js?v=move-quality-v1';
import { miniChessToFen } from './position-fen.js';
import { normalizePositionKey } from './repertoire-moves.js?v=response-learning-v2';

const ANALYSIS_MAX_PLIES = 6;

function historicalFeedbackRoot(root) {
  return {
    querySelector(selector) {
      if (selector === '#feedback') return root.querySelector('#history-feedback');
      return root.querySelector(selector);
    }
  };
}

export class AnalysisVariation {
  constructor({ anchorPly, chess, lastMove = null, maxPlies = ANALYSIS_MAX_PLIES }) {
    if (!Number.isInteger(anchorPly) || anchorPly < 0) {
      throw new Error('Analysis variation requires a valid history anchor ply');
    }
    if (!chess?.clone || !Number.isInteger(maxPlies) || maxPlies < 1) {
      throw new Error('Analysis variation requires a clonable position and positive ply limit');
    }

    this.anchorPly = anchorPly;
    this.anchorChess = chess.clone();
    this.anchorLastMove = lastMove ? { ...lastMove } : null;
    this.maxPlies = maxPlies;
    this.entries = [];
    this.cursor = 0;
  }

  currentChess() {
    const chess = this.anchorChess.clone();
    for (const entry of this.entries.slice(0, this.cursor)) chess.moveUci(entry.uci);
    return chess;
  }

  currentEntry() {
    return this.cursor > 0 ? this.entries[this.cursor - 1] ?? null : null;
  }

  currentLastMove() {
    const entry = this.currentEntry();
    if (!entry) return this.anchorLastMove;
    return { from: entry.uci.slice(0, 2), to: entry.uci.slice(2, 4) };
  }

  canPlay() {
    return this.cursor < this.maxPlies;
  }

  play(uci) {
    if (!this.canPlay()) throw new Error('Analysis variation reached its ply limit');

    const chess = this.currentChess();
    const mover = chess.turn();
    const notation = chess.notationFor(uci);
    const move = chess.moveUci(uci);

    if (this.cursor < this.entries.length) this.entries = this.entries.slice(0, this.cursor);
    const entry = {
      uci,
      mover,
      notation: move?.san ?? notation,
      evaluationState: 'pending',
      quality: null
    };
    this.entries.push(entry);
    this.cursor += 1;
    return { entry, chess, index: this.cursor - 1 };
  }

  navigate(delta) {
    if (!Number.isInteger(delta) || delta === 0) return false;
    const next = Math.max(0, Math.min(this.entries.length, this.cursor + delta));
    if (next === this.cursor) return false;
    this.cursor = next;
    return true;
  }

  setEvaluation(entry, quality) {
    if (!this.entries.includes(entry)) return false;
    entry.quality = quality ?? null;
    entry.evaluationState = quality ? 'ready' : 'unavailable';
    return true;
  }

  setEvaluationUnavailable(entry) {
    if (!this.entries.includes(entry)) return false;
    entry.quality = null;
    entry.evaluationState = 'unavailable';
    return true;
  }
}

export class AutomaticSpacedTrainerApp extends OpenRepTrainerApp {
  constructor(root, course, options = {}) {
    super(root, course, options);
    this.analysisVariation = null;
    this.analysisGeneration = 0;
  }

  beginRoute(route, startPly = 0) {
    this.discardAnalysisVariation();
    super.beginRoute(route, startPly);
  }

  renderShell() {
    super.renderShell();
    const grading = this.root.querySelector('#grading');
    if (grading) grading.replaceChildren();
    this.hideManualGrading();

    const forward = this.root.querySelector('#history-forward');
    if (forward && !this.root.querySelector('#analysis-return')) {
      const returnButton = document.createElement('button');
      returnButton.id = 'analysis-return';
      returnButton.className = 'history-btn';
      returnButton.type = 'button';
      returnButton.textContent = 'Return to line';
      returnButton.hidden = true;
      returnButton.setAttribute('aria-label', 'Return to lesson history');
      returnButton.addEventListener('click', () => this.returnToAnalysisAnchor());
      forward.after(returnButton);
    }
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

  discardAnalysisVariation() {
    if (!this.analysisVariation) return false;
    this.analysisVariation = null;
    this.analysisGeneration += 1;
    return true;
  }

  returnToAnalysisAnchor() {
    if (!this.discardAnalysisVariation()) return;
    this.board.clearSelection();
    this.refreshHistoryView();
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
    // Opponent turns can start an analysis-only branch: any legal move can be
    // explored without becoming part of the lesson route or learner progress.
    return {
      ...replay,
      playedMove: replay.expected,
      expected,
      interactive,
      analysisSide: repertoireTurn ? null : displayedTurn
    };
  }

  displayedDecisionContext() {
    if (this.analysisVariation) return null;

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

  displayedOpponentOptions() {
    if (this.analysisVariation) return [];
    return super.displayedOpponentOptions();
  }

  analysisKnownPosition(chess = this.analysisVariation?.currentChess()) {
    if (!chess || !this.repertoire?.movesByPosition) return null;
    const key = normalizePositionKey(miniChessToFen(chess));
    if (!key) return null;

    const byMove = this.repertoire.movesByPosition.get(key);
    const responses = this.repertoire.responsesByPosition?.get(key) ?? [];
    if (!byMove && responses.length === 0) return null;

    const occurrences = [];
    if (byMove) {
      for (const entries of byMove.values()) occurrences.push(...entries);
    }
    for (const response of responses) {
      if (response?.resolvedLine) {
        occurrences.push({ line: response.resolvedLine, ply: response.resolvedPly, uci: response.move });
      }
    }

    const lines = [];
    const seen = new Set();
    for (const occurrence of occurrences) {
      const line = occurrence?.line;
      const identity = line?.id ?? line?.title;
      if (!line || !identity || seen.has(identity)) continue;
      seen.add(identity);
      lines.push(line);
    }

    const repertoireMoves = chess.turn() === this.course.side && byMove
      ? [...byMove.entries()]
      : [];
    const expected = repertoireMoves.length === 1
      ? repertoireMoves[0][1]?.[0]?.uci ?? repertoireMoves[0][0]
      : null;
    const cue = expected
      ? this.moveTheory?.cueAt?.(miniChessToFen(chess), expected) ?? null
      : null;

    return { key, lines, expected, cue, responses };
  }

  analysisPositionTitle(known) {
    const titles = known?.lines?.map(line => line.title).filter(Boolean) ?? [];
    if (titles.length === 0) return 'Known repertoire position';
    if (titles.length === 1) return `Known repertoire position · ${titles[0]}`;
    return `Known repertoire position · ${titles[0]} and ${titles.length - 1} more`;
  }

  renderDecisionPrompt() {
    if (!this.analysisVariation) {
      super.renderDecisionPrompt();
      return;
    }

    const prompt = this.root.querySelector('#prompt');
    if (!prompt) return;
    prompt.replaceChildren();

    const chess = this.analysisVariation.currentChess();
    const known = this.analysisKnownPosition(chess);
    const text = document.createElement('span');
    if (known) {
      const cue = known.cue ? ` ${known.cue}` : ' Authored repertoire coverage exists from here.';
      const clue = known.expected && this.hintEnabled ? ` Find ${chess.notationFor(known.expected)}.` : '';
      text.textContent = `${this.analysisPositionTitle(known)}.${cue}${clue}`;
    } else if (!this.analysisVariation.canPlay()) {
      text.textContent = 'Analysis limit reached. Use ← to back up or Return to line.';
    } else {
      text.textContent = 'Exploring from history. Moves here are scored but do not change lesson progress.';
    }
    prompt.append(text);
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

  renderAnalysisFeedback() {
    if (!this.analysisVariation) return;
    const entry = this.analysisVariation.currentEntry();
    if (!entry) {
      const liveFeedback = this.root.querySelector('#feedback');
      const historyFeedback = this.root.querySelector('#history-feedback');
      if (liveFeedback) liveFeedback.hidden = true;
      if (historyFeedback) {
        historyFeedback.hidden = true;
        historyFeedback.className = 'feedback';
        historyFeedback.textContent = '';
        historyFeedback.setAttribute('aria-hidden', 'true');
      }
      return;
    }

    if (entry.evaluationState === 'ready') {
      this.showHistoricalOpponentMoveScore(entry.notation, entry.quality);
    } else if (entry.evaluationState === 'unavailable') {
      this.showHistoricalReplayFeedback(`${entry.notation}. Evaluation unavailable.`, 'neutral');
    } else {
      this.showHistoricalReplayFeedback(`${entry.notation}. Evaluating…`, 'neutral');
    }
  }

  renderDisplayedFeedback() {
    if (this.analysisVariation) {
      this.renderAnalysisFeedback();
      return;
    }
    super.renderDisplayedFeedback();
  }

  refreshAnalysisView() {
    if (!this.analysisVariation) return;
    if (this.root.querySelector('#prompt')) this.renderDecisionPrompt();
    if (this.root.querySelector('#opponent-options')) this.renderOpponentOptions();
    if (this.root.querySelector('#response-summary')) this.renderResponseSummary();
    this.renderAnalysisFeedback();
    if (this.root.querySelector('#completion-theory')) this.renderCompletionTheory();
    this.refreshBoardState();
    if (this.root.querySelector('#history-back')) this.refreshHistoryControls();
  }

  refreshHistoryView() {
    if (this.analysisVariation) {
      this.refreshAnalysisView();
      return;
    }
    super.refreshHistoryView();
  }

  refreshBoardState() {
    if (!this.analysisVariation) {
      super.refreshBoardState();
      return;
    }

    const chess = this.analysisVariation.currentChess();
    const known = this.analysisKnownPosition(chess);
    const expected = known?.expected ?? null;
    this.board.setPosition(chess, {
      lastMove: this.analysisVariation.currentLastMove(),
      interactive: this.analysisVariation.canPlay()
    });
    this.board.setExpectedMove(expected, Boolean(expected && this.hintEnabled));
    this.refreshEvaluation(chess);
  }

  refreshHistoryControls() {
    if (!this.analysisVariation) {
      super.refreshHistoryControls();
      const returnButton = this.root.querySelector('#analysis-return');
      if (returnButton) returnButton.hidden = true;
      return;
    }

    const variation = this.analysisVariation;
    const back = this.root.querySelector('#history-back');
    const forward = this.root.querySelector('#history-forward');
    const status = this.root.querySelector('#history-status');
    const returnButton = this.root.querySelector('#analysis-return');
    if (back) back.disabled = variation.cursor === 0 && variation.anchorPly === 0;
    if (forward) forward.disabled = variation.cursor >= variation.entries.length;
    if (status) {
      status.textContent = `Analysis ${variation.cursor}/${variation.maxPlies} · from position ${variation.anchorPly} / ${this.ply}`;
    }
    if (returnButton) returnButton.hidden = false;
  }

  navigateHistory(delta) {
    const variation = this.analysisVariation;
    if (!variation) {
      super.navigateHistory(delta);
      return;
    }

    if (delta < 0 && variation.cursor === 0) {
      const anchorPly = variation.anchorPly;
      this.discardAnalysisVariation();
      this.viewPly = anchorPly;
      super.navigateHistory(-1);
      return;
    }

    if (variation.navigate(delta < 0 ? -1 : 1)) {
      this.board.clearSelection();
      this.refreshAnalysisView();
    }
  }

  beginAnalysisVariation(replay, attempted) {
    const variation = new AnalysisVariation({
      anchorPly: this.viewPly,
      chess: replay.chess,
      lastMove: replay.lastOpponentMove,
      maxPlies: ANALYSIS_MAX_PLIES
    });
    this.analysisVariation = variation;
    this.analysisGeneration += 1;
    this.playAnalysisMove(attempted);
  }

  playAnalysisMove(attempted) {
    const variation = this.analysisVariation;
    if (!variation?.canPlay()) return;

    const before = variation.currentChess();
    let played;
    try {
      played = variation.play(attempted);
    } catch {
      return;
    }

    this.board.clearSelection();
    this.refreshAnalysisView();

    if (!this.evaluator?.evaluateMove) {
      variation.setEvaluationUnavailable(played.entry);
      this.renderAnalysisFeedback();
      return;
    }

    const generation = this.analysisGeneration;
    Promise.resolve(this.evaluator.evaluateMove(before, attempted)).then(result => {
      if (this.analysisVariation !== variation || generation !== this.analysisGeneration) return;
      if (!result) {
        variation.setEvaluationUnavailable(played.entry);
      } else {
        const quality = classifyMoveQuality(result.before, result.move, played.entry.mover);
        if (!variation.setEvaluation(played.entry, quality)) return;
      }
      if (variation.currentEntry() === played.entry) this.renderAnalysisFeedback();
    }).catch(() => {
      if (this.analysisVariation !== variation || generation !== this.analysisGeneration) return;
      if (!variation.setEvaluationUnavailable(played.entry)) return;
      if (variation.currentEntry() === played.entry) this.renderAnalysisFeedback();
    });
  }

  replayHistoricalMove(from, to) {
    const attempted = `${from}${to}`;
    if (this.analysisVariation) {
      this.playAnalysisMove(attempted);
      return;
    }

    const replay = this.historicalReplayContext();
    if (!replay?.interactive) return;

    if (replay.analysisSide) {
      this.beginAnalysisVariation(replay, attempted);
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
