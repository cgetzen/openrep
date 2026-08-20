#!/usr/bin/env bash
set -euo pipefail

version="v18.0.0"
base="https://github.com/nmrugg/stockfish.js/releases/download/${version}"
out="vendor/stockfish"
mkdir -p "$out"

for asset in stockfish-18-lite-single.js stockfish-18-lite-single.wasm; do
  if [[ ! -s "$out/$asset" ]]; then
    curl --fail --location --retry 3 --output "$out/$asset" "$base/$asset"
  fi
done
