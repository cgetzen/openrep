# Third-party notices

## Cburnett chess pieces

The SVG chess pieces under `src/pieces/cburnett/` are by Colin M. L. Burnett (Cburnett), sourced from the Lichess `public/piece/cburnett` set.

Lichess identifies this piece set as GPL-2.0-or-later. Source: https://github.com/lichess-org/lila/tree/master/public/piece/cburnett

No changes to the piece geometry are intended in OpenRep; the files are vendored so the browser app has no runtime dependency on an external asset host.

## Stockfish.js

OpenRep uses the Stockfish 18 lite single-threaded WebAssembly build from `nmrugg/stockfish.js` for in-browser position evaluation. The deploy workflow fetches the pinned v18.0.0 release assets `stockfish-18-lite-single.js` and `stockfish-18-lite-single.wasm`.

Stockfish.js is licensed under GPL-3.0. Source and license: https://github.com/nmrugg/stockfish.js/tree/v18.0.0
