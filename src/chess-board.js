const pieces = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚'
};

export class ChessBoard {
  constructor(root, chess, orientation, callbacks) {
    this.root = root;
    this.chess = chess;
    this.orientation = orientation;
    this.callbacks = callbacks;
    this.selected = null;
    this.targetSquares = new Set();
    this.expectedFrom = null;
    this.expectedTo = null;
  }

  setExpectedMove(uci, showHint) {
    this.expectedFrom = showHint && uci ? uci.slice(0, 2) : null;
    this.expectedTo = showHint && uci ? uci.slice(2, 4) : null;
    this.render();
  }

  clearSelection() {
    this.selected = null;
    this.targetSquares.clear();
  }

  render() {
    const files = this.orientation === 'w' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a'];
    const ranks = this.orientation === 'w' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
    this.root.innerHTML = '';
    this.root.className = 'chessboard';

    for (const rank of ranks) {
      for (const file of files) {
        const square = `${file}${rank}`;
        const piece = this.chess.get(square);
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `square ${(files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0 ? 'light' : 'dark'}`;
        el.dataset.square = square;
        el.setAttribute('aria-label', `${square}${piece ? ` ${piece.color}${piece.type}` : ''}`);

        if (square === this.selected) el.classList.add('selected');
        if (this.targetSquares.has(square)) el.classList.add('legal-target');
        if (square === this.expectedFrom) el.classList.add('hint-from');
        if (square === this.expectedTo) el.classList.add('hint-to');

        if (piece) {
          const pieceEl = document.createElement('span');
          pieceEl.className = `piece piece-${piece.color}`;
          pieceEl.textContent = pieces[`${piece.color}${piece.type}`];
          el.appendChild(pieceEl);
        }

        if (file === files[0]) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'rank-label';
          rankLabel.textContent = String(rank);
          el.appendChild(rankLabel);
        }
        if (rank === ranks[ranks.length - 1]) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'file-label';
          fileLabel.textContent = file;
          el.appendChild(fileLabel);
        }

        el.addEventListener('click', () => this.handleSquare(square));
        this.root.appendChild(el);
      }
    }
  }

  handleSquare(square) {
    if (this.selected && this.targetSquares.has(square)) {
      const from = this.selected;
      this.clearSelection();
      this.callbacks.onMove(from, square);
      return;
    }

    const piece = this.chess.get(square);
    if (!piece || piece.color !== this.chess.turn()) {
      this.clearSelection();
      this.render();
      return;
    }

    this.selected = square;
    this.targetSquares = new Set(this.chess.legalDestinations(square));
    this.render();
  }
}
