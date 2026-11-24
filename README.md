# Knightly — free personal chess trainer

Log in with a Chess.com username and get a training dashboard built from your own games:

- **Train**: smart queue that mixes puzzles from your own mistakes (spaced repetition) with rated puzzles at your level
- **My Mistakes**: Stockfish scans your games in the browser and turns missed checkmates and missed material wins into multi-move puzzles, explaining what went wrong
- **Puzzles**: themed puzzles from the free Lichess puzzle database. Every puzzle has a concrete mission with a move count ("Checkmate in 3", "Win a piece in 2 moves") and a move-by-move explanation afterwards; vague positional puzzles are filtered out
- **Sprint**: 3 minutes, 3 lives, puzzles get harder as you go
- **Games / Review**: every game with eval bar, accuracy, and blunder/mistake marks
- **Insights**: openings, results by color, how you win and lose, time trouble, rating charts

Everything runs in the browser. Game data comes from Chess.com's official public API (no password), puzzles from Lichess (CC0), and progress is saved in each person's own browser.

## Run locally

```bash
npm install
npm run dev
```

## Build & host for free

```bash
npm run build      # output goes to dist/
```

`dist/` is a plain static site, so any static host works:

- **Vercel**: import the folder or repo, framework preset "Vite", build command `npm run build`, output `dist`.
- **Netlify**: drag the `dist` folder onto https://app.netlify.com/drop.
- **GitHub Pages**: push `dist` to a `gh-pages` branch (all paths are relative, so sub-folders work).

No server, database or API keys are needed.

## Notes

- Progress is per browser. Friends each open the link and log in with their own Chess.com username.
- Knightly is an independent fan project and is not affiliated with Chess.com.
