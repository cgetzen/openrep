# OpenRep

OpenRep is a local-first chess opening trainer prototype focused on learning and practicing a curated Caro-Kann repertoire.

## Run locally

```bash
npm run serve
```

Then open `http://localhost:4173`.

## Test

```bash
npm test
npm run test:e2e
```

## Notes

- Progress is stored in your browser.
- Stockfish 18 Lite is fetched by `npm run stockfish:fetch` for local serving and PR deploys.
