function pieceSvg(type) {
  const shapes = {
    p: `
      <circle cx="50" cy="25" r="13"/>
      <path d="M39 39h22l7 28H32z"/>
      <path d="M27 67h46l6 12H21z"/>
      <path d="M19 79h62v10H19z"/>`,
    n: `
      <path d="M25 79h54v10H21z"/>
      <path d="M30 74c3-14 9-24 18-31l-9-7 10-17c17 4 29 14 34 29l-15 8-9-9-8 8 11 19z"/>
      <path d="M49 19l-2 14 13-9" fill="none"/>
      <circle cx="62" cy="37" r="2.5" fill="var(--piece-stroke)" stroke="none"/>`,
    b: `
      <path d="M28 79h44l7 10H21z"/>
      <path d="M34 68c2-15 8-25 16-31 8 6 14 16 16 31z"/>
      <circle cx="50" cy="26" r="14"/>
      <path d="M57 17L43 35" fill="none"/>`,
    r: `
      <path d="M24 79h52l6 10H18z"/>
      <path d="M31 51h38l5 28H26z"/>
      <path d="M25 20h13v10h12V20h12v10h13v18H25z"/>
      <path d="M31 51h38" fill="none"/>`,
    q: `
      <path d="M22 79h56l5 10H17z"/>
      <path d="M29 70h42l5 9H24z"/>
      <path d="M26 31l13 14 11-23 11 23 13-14-7 37H33z"/>
      <circle cx="25" cy="27" r="5"/><circle cx="50" cy="18" r="5"/><circle cx="75" cy="27" r="5"/>`,
    k: `
      <path d="M23 79h54l6 10H17z"/>
      <path d="M30 69h40l6 10H24z"/>
      <path d="M34 41h32l5 28H29z"/>
      <path d="M50 13v27M39 23h22" fill="none" stroke-width="6"/>
      <path d="M36 41c4-9 9-14 14-14s10 5 14 14z"/>`
  };

  return `<svg class="piece-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <g fill="var(--piece-fill)" stroke="var(--piece-stroke)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
      ${shapes[type]}
    </g>
  </svg>`;
}

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
    this.lastMove = null;
    this.interactive = true;
    this.drag = null;
    this.dragGhost = null;
    this.suppressNextClick = false;

    this.root.addEventListener('pointermove', event => this.handlePointerMove(event));
    this.root.addEventListener('pointerup', event => this.handlePointerUp(event));
    this.root.addEventListener('pointercancel', () => this.cancelDrag());
  }

  setPosition(chess, { lastMove = null, interactive = true } = {}) {
    this.chess = chess;
    this.lastMove = lastMove;
    this.interactive = interactive;
    this.clearSelection();
    this.render();
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
    this.root.className = `chessboard${this.interactive ? '' : ' board-readonly'}`;

    for (const rank of ranks) {
      for (const file of files) {
        const square = `${file}${rank}`;
        const piece = this.chess.get(square);
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `square ${(files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0 ? 'light' : 'dark'}${piece ? ' occupied' : ''}`;
        el.dataset.square = square;
        el.setAttribute('aria-label', `${square}${piece ? ` ${piece.color}${piece.type}` : ''}`);
        el.disabled = !this.interactive;

        if (square === this.selected) el.classList.add('selected');
        if (this.targetSquares.has(square)) el.classList.add('legal-target');
        if (square === this.expectedFrom) el.classList.add('hint-from');
        if (square === this.expectedTo) el.classList.add('hint-to');
        if (this.lastMove && (square === this.lastMove.from || square === this.lastMove.to)) el.classList.add('last-move');

        if (piece) {
          const pieceEl = document.createElement('span');
          pieceEl.className = `piece piece-${piece.color}`;
          pieceEl.dataset.square = square;
          pieceEl.innerHTML = pieceSvg(piece.type);
          pieceEl.addEventListener('pointerdown', event => this.startDrag(event, square, pieceEl));
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

        el.addEventListener('click', () => {
          if (this.suppressNextClick) {
            this.suppressNextClick = false;
            return;
          }
          this.handleSquare(square);
        });
        this.root.appendChild(el);
      }
    }
  }

  syncSelectionClasses() {
    this.root.querySelectorAll('.square').forEach(el => {
      const square = el.dataset.square;
      el.classList.toggle('selected', square === this.selected);
      el.classList.toggle('legal-target', this.targetSquares.has(square));
    });
  }

  startDrag(event, square, pieceEl) {
    if (!this.interactive || (event.button !== undefined && event.button !== 0)) return;
    const piece = this.chess.get(square);
    if (!piece || piece.color !== this.chess.turn()) return;

    this.selected = square;
    this.targetSquares = new Set(this.chess.legalDestinations(square));
    this.syncSelectionClasses();
    this.drag = {
      pointerId: event.pointerId,
      from: square,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      target: null,
      pieceEl
    };
    pieceEl.setPointerCapture?.(event.pointerId);
  }

  handlePointerMove(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const distance = Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY);
    if (!this.drag.moved && distance < 6) return;

    event.preventDefault();
    if (!this.drag.moved) {
      this.drag.moved = true;
      this.drag.pieceEl.classList.add('drag-source');
      this.dragGhost = this.drag.pieceEl.cloneNode(true);
      this.dragGhost.classList.add('drag-ghost');
      const rect = this.drag.pieceEl.closest('.square').getBoundingClientRect();
      this.dragGhost.style.width = `${rect.width * 0.9}px`;
      this.dragGhost.style.height = `${rect.height * 0.9}px`;
      document.body.appendChild(this.dragGhost);
    }

    this.dragGhost.style.left = `${event.clientX}px`;
    this.dragGhost.style.top = `${event.clientY}px`;

    this.root.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    const targetEl = document.elementFromPoint(event.clientX, event.clientY)?.closest('.square');
    const target = targetEl?.dataset.square ?? null;
    this.drag.target = target;
    if (targetEl && this.targetSquares.has(target)) targetEl.classList.add('drag-over');
  }

  handlePointerUp(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const { from, moved } = this.drag;
    const target = this.drag.target;

    if (!moved) {
      this.cleanupDrag(true);
      return;
    }

    event.preventDefault();
    const valid = target && this.targetSquares.has(target);
    this.suppressNextClick = true;
    this.cleanupDrag(false);

    if (valid) {
      this.clearSelection();
      this.callbacks.onMove(from, target);
    } else {
      this.clearSelection();
      this.render();
    }
  }

  cleanupDrag(keepSelection) {
    this.root.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    this.drag?.pieceEl?.classList.remove('drag-source');
    this.dragGhost?.remove();
    this.dragGhost = null;
    this.drag = null;
    if (!keepSelection) this.clearSelection();
  }

  cancelDrag() {
    if (!this.drag) return;
    this.cleanupDrag(false);
    this.render();
  }

  handleSquare(square) {
    if (!this.interactive) return;
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
