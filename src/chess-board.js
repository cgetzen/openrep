function pieceSvg(type) {
  // Original, deliberately simple Staunton-inspired silhouettes: familiar at a
  // glance without decorative flourishes or relying on platform chess glyphs.
  const shapes = {
    p: `
      <circle cx="50" cy="25" r="10"/>
      <path d="M42 36h16c-1 9 3 17 10 27H32c7-10 11-18 10-27z"/>
      <path d="M29 64h42l4 9H25z"/>
      <path d="M22 75h56v10H22z"/>`,
    n: `
      <path d="M24 76h54v10H20z"/>
      <path d="M30 68c4-14 12-24 23-31l-8-8 9-13c15 5 26 15 30 29l-17 9-8-9-7 6 9 17z"/>
      <path d="M53 18l1 14 11-7" fill="none"/>
      <circle cx="65" cy="36" r="2.2" class="piece-detail" stroke="none"/>`,
    b: `
      <path d="M25 76h50l5 10H20z"/>
      <path d="M32 67h36l5 9H27z"/>
      <path d="M36 61c1-12 7-22 14-29 7 7 13 17 14 29z"/>
      <path d="M50 14c10 0 16 7 16 15 0 7-6 13-16 18-10-5-16-11-16-18 0-8 6-15 16-15z"/>
      <path d="M57 19L43 38" fill="none"/>`,
    r: `
      <path d="M23 76h54l5 10H18z"/>
      <path d="M29 68h42l5 8H24z"/>
      <path d="M33 38h34l4 30H29z"/>
      <path d="M27 18h12v9h11v-9h11v9h12v13H27z"/>`,
    q: `
      <path d="M22 76h56l5 10H17z"/>
      <path d="M28 67h44l5 9H23z"/>
      <path d="M28 31l11 22 11-27 11 27 11-22-6 36H34z"/>
      <circle cx="27" cy="26" r="4"/><circle cx="50" cy="20" r="4"/><circle cx="73" cy="26" r="4"/>`,
    k: `
      <path d="M22 76h56l5 10H17z"/>
      <path d="M28 67h44l5 9H23z"/>
      <path d="M34 42h32l5 25H29z"/>
      <path d="M37 42c3-8 8-13 13-13s10 5 13 13z"/>
      <path d="M50 10v22M40 19h20" fill="none" stroke-width="5"/>`
  };

  return `<svg class="piece-svg piece-svg-classic" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <g fill="var(--piece-fill)" stroke="var(--piece-stroke)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
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
    this.explanationArrow = null;
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
    this.explanationArrow = null;
    this.interactive = interactive;
    this.clearSelection();
    this.render();
  }

  setExpectedMove(uci, showHint) {
    this.expectedFrom = showHint && uci ? uci.slice(0, 2) : null;
    this.expectedTo = showHint && uci ? uci.slice(2, 4) : null;
    this.render();
  }

  setExplanationArrow(arrow) {
    this.explanationArrow = arrow;
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
          pieceEl.dataset.pieceSquare = square;
          pieceEl.dataset.pieceStyle = 'classic';
          pieceEl.innerHTML = pieceSvg(piece.type);
          pieceEl.addEventListener('pointerdown', event => this.startDrag(event, square, pieceEl));
          el.appendChild(pieceEl);
        }

        if (square === this.expectedTo) {
          const indicator = document.createElement('span');
          indicator.className = 'hint-target-indicator';
          indicator.setAttribute('aria-hidden', 'true');
          indicator.innerHTML = '<span class="hint-option-dot"></span>';
          el.appendChild(indicator);
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

    if (this.explanationArrow) this.renderExplanationArrow();
  }

  renderExplanationArrow() {
    const { from, to } = this.explanationArrow ?? {};
    const fromEl = from ? this.root.querySelector(`.square[data-square="${from}"]`) : null;
    const toEl = to ? this.root.querySelector(`.square[data-square="${to}"]`) : null;
    if (!fromEl || !toEl) return;

    const boardRect = this.root.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const x1 = fromRect.left + fromRect.width / 2 - boardRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - boardRect.top;
    const x2 = toRect.left + toRect.width / 2 - boardRect.left;
    const y2 = toRect.top + toRect.height / 2 - boardRect.top;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'explanation-arrow-layer');
    svg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <defs>
        <marker id="explanation-arrow-head" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L7,3.5 L0,7 z" class="explanation-arrow-head"></path>
        </marker>
      </defs>
      <line class="explanation-arrow" data-from="${from}" data-to="${to}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#explanation-arrow-head)"></line>`;
    this.root.appendChild(svg);
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
    window.setTimeout(() => { this.suppressNextClick = false; }, 0);
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
    if (this.explanationArrow) this.explanationArrow = null;
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
