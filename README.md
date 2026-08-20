# OpenRep

A static, browser-only chess opening trainer inspired by the core training loop of Chessreps: curated opening lines, move-by-move learning, hints, targeted practice, and spaced repetition.

## Proven-out course

The repository ships one complete sample course: a **12-line Caro-Kann repertoire for Black** covering Advance structures, Classical, Exchange, Panov, Two Knights, Fantasy, Hillbilly, and quiet sidelines.

- No API, server application, account system, or database.
- No frontend framework and no build step.
- Opening content is plain JavaScript data bundled in the repository.
- Progress and spaced-repetition scheduling live only in `localStorage`.
- A small in-repo chess rules layer validates moves and drives the board.
- Learn mode teaches lines sequentially; Practice mode can select either spaced-review or weak material.
- Node tests validate every move in all 12 opening lines.
- A headless Chromium E2E test proves all 12 branches through real board interactions, plus incorrect-move handling, grading, persistence, and both training modes.
- GitHub Pages workflow is included for static deployment.

## Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Validate

```bash
npm test
npm run test:e2e
```

The E2E harness uses Python Playwright and Chromium. Install it with `python3 -m pip install -r e2e/requirements.txt && python3 -m playwright install chromium`. It saves a proof screenshot to `e2e/proof.png`. In locked-down Chromium environments that block localhost, it falls back to injecting the same source into `about:blank`.

## Architecture

- `src/openings/caro-kann.js` — course data: lines, UCI moves, and teaching notes.
- `src/mini-chess.js` — dependency-free browser chess rules used to validate and execute moves.
- `src/trainer.js` — training state machine: opponent auto-play, repertoire prompts, grading, and Learn/Practice interaction.
- `src/practice-selection.js` — pure Practice queue policy for spaced-review and weak-line selection.
- `src/progress.js` — localStorage persistence and an SM-2-style scheduling heuristic.
- `src/chess-board.js` — dependency-free interactive board.

## Scope

This implementation recreates the product interaction pattern without copying Chessreps branding, proprietary course text, or gated content. The natural next layers are PGN import/export, richer move annotations, tactics derived from repertoire positions, and additional opening packs.
