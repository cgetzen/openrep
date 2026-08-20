import { formatEvaluation, scoreToWhiteShare } from './evaluation.js';

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
    this.element.innerHTML = '<span class="evaluation-white"></span><span class="evaluation-midline"></span>';
    this.setLoading();
  }

  setLoading() {
    this.element.dataset.state = 'loading';
    this.setShare(50);
    this.element.setAttribute('aria-valuetext', 'Stockfish loading');
    this.element.title = 'Stockfish loading';
  }

  setUnavailable() {
    this.element.dataset.state = 'unavailable';
    this.setShare(50);
    this.element.setAttribute('aria-valuetext', 'Evaluation unavailable');
    this.element.title = 'Evaluation unavailable';
  }

  setEvaluation(score) {
    const share = scoreToWhiteShare(score);
    const text = formatEvaluation(score);
    this.element.dataset.state = 'ready';
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
