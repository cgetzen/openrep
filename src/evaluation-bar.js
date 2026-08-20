import { formatCompactEvaluation, formatEvaluation, scoreToWhiteShare } from './evaluation.js';

export class EvaluationBar {
  constructor(element, orientation = 'w') {
    this.element = element;
    this.orientation = orientation;
    this.element.className = 'evaluation-bar';
    this.element.dataset.orientation = orientation;
    this.element.setAttribute('role', 'meter');
    this.element.setAttribute('aria-label', 'Stockfish evaluation');
    this.element.setAttribute('aria-valuemin', '0');
    this.element.setAttribute('aria-valuemax', '100');
    this.element.innerHTML = '<span class="evaluation-white"></span><span class="evaluation-midline"></span><span class="evaluation-score" aria-hidden="true"></span>';
    this.scoreElement = this.element.querySelector('.evaluation-score');
    this.setLoading();
  }

  setLoading() {
    this.element.dataset.state = 'loading';
    delete this.element.dataset.scoreSide;
    this.scoreElement.textContent = '';
    this.setShare(50);
    this.element.setAttribute('aria-valuetext', 'Stockfish loading');
    this.element.title = 'Stockfish loading';
  }

  setUnavailable() {
    this.element.dataset.state = 'unavailable';
    delete this.element.dataset.scoreSide;
    this.scoreElement.textContent = '';
    this.setShare(50);
    this.element.setAttribute('aria-valuetext', 'Evaluation unavailable');
    this.element.title = 'Evaluation unavailable';
  }

  setEvaluation(score) {
    const share = scoreToWhiteShare(score);
    const text = formatEvaluation(score);
    this.element.dataset.state = 'ready';
    this.element.dataset.scoreSide = score.value < 0 ? 'black' : 'white';
    this.scoreElement.textContent = formatCompactEvaluation(score);
    this.setShare(share);
    this.element.setAttribute('aria-valuetext', text);
    this.element.title = `Stockfish · ${text}`;
  }

  setShare(share) {
    const rounded = Number(share.toFixed(1));
    this.element.style.setProperty('--white-share', `${rounded}%`);
    this.element.setAttribute('aria-valuenow', String(rounded));
  }
}
