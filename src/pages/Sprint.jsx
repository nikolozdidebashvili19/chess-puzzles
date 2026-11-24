import { useEffect, useMemo, useRef, useState } from 'react';
import { GoalCard } from '../components/Trainer.jsx';
import { explainPuzzle } from '../lib/explain.js';
import Board from '../components/Board.jsx';
import { Confetti, Spinner } from '../components/ui.jsx';
import { usePuzzle } from '../lib/usePuzzle.js';
import { fetchPuzzleBatch } from '../lib/lichess.js';
import { recordSprint, useStore } from '../lib/store.js';
import { sfx } from '../lib/sound.js';

const DURATION = 180;
const LIVES = 3;
const LEVELS = ['easiest', 'easier', 'normal', 'harder', 'hardest'];

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function SprintGame({ pool, onEnd }) {
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState([]);
  const logRef = useRef([]);
  const [left, setLeft] = useState(DURATION);
  const over = useRef(false);
  const strikes = log.filter((l) => !l.ok).length;
  const score = log.filter((l) => l.ok).length;
  const puzzle = pool.current[idx];
  const goal = useMemo(() => (puzzle ? explainPuzzle(puzzle).goal : null), [puzzle?.id]);

  function finish(finalLog) {
    if (over.current) return;
    over.current = true;
    onEnd(finalLog);
  }

  const pz = usePuzzle(puzzle, {
    mode: 'sprint',
    onResult: (solved) => {
      const entry = { ok: solved, rating: puzzle.rating, link: puzzle.link };
      const nl = [...logRef.current, entry];
      logRef.current = nl;
      setLog(nl);
      if (nl.filter((x) => !x.ok).length >= LIVES) setTimeout(() => finish(logRef.current), 700);
      else setTimeout(() => !over.current && setIdx((i) => i + 1), solved ? 350 : 750);
    },
  });

  useEffect(() => {
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        if (s <= 11) sfx.tick();
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (left === 0) finish(logRef.current);
  }, [left]);

  if (!puzzle) return <Spinner label="Loading more puzzles…" />;
  const white = pz.playerColor === 'w';

  return (
    <div className="trainer">
      <div className="board-col">
        <Board id="sprint" fen={pz.fen} orientation={pz.orientation} onMove={pz.onMove} interactive={pz.status === 'playing'} lastMove={pz.lastMove} squareStyles={pz.squareStyles} />
      </div>
      <div className="side">
        <div className={`side-head ${pz.status === 'solved' ? 'ok' : pz.status === 'reverting' || pz.status === 'wrong' ? 'bad' : white ? 'turn-w' : 'turn-b'}`}>
          {pz.status === 'solved' ? '✓ Correct!' : pz.status === 'reverting' || pz.status === 'wrong' ? '✗ Missed' : `${white ? 'White' : 'Black'} to move`}
        </div>
        <div className="side-body">
          <div className="row">
            <div className={`sprint-clock ${left <= 10 ? 'low' : ''}`}>{fmt(left)}</div>
            <span className="spacer" />
            <div className="strikes">
              {Array.from({ length: LIVES }, (_, i) => (
                <div key={i} className={`strike ${i < strikes ? 'hit' : ''}`}>
                  {i < strikes ? '✗' : ''}
                </div>
              ))}
            </div>
          </div>
          {goal && <GoalCard goal={goal} step={pz.step} compact />}
          <div>
            <div className="tiny muted bold">SCORE</div>
            <div className="sprint-score">{score}</div>
          </div>
          <div className="sprint-log">
            {log.map((l, i) => (
              <span key={i} className={l.ok ? 'ok' : 'bad'}>
                {l.rating}
              </span>
            ))}
          </div>
        </div>
        <div className="side-foot">
          <button className="btn" onClick={() => finish(logRef.current)}>
            End run
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sprint() {
  const progress = useStore((s) => s.progress);
  const [phase, setPhase] = useState('lobby'); // lobby | loading | play | done
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const pool = useRef([]);

  async function start() {
    setError(null);
    setPhase('loading');
    pool.current = [];
    try {
      const first = [];
      for (let k = 0; k < 2 && first.length < 8; k++) first.push(...(await fetchPuzzleBatch('mate', LEVELS[0], 40)));
      if (!first.length) throw new Error('Could not load puzzles, try again.');
      pool.current.push(...first.sort((a, b) => a.rating - b.rating));
      sfx.start();
      setPhase('play');
      // Keep loading harder puzzles in the background.
      for (const lvl of LEVELS.slice(1)) {
        await new Promise((r) => setTimeout(r, 1500)); // be gentle with the puzzle server
        const more = await fetchPuzzleBatch('mix', lvl, 40).catch(() => []);
        pool.current.push(...more.sort((a, b) => a.rating - b.rating));
      }
    } catch (e) {
      setError(e.message);
      setPhase('lobby');
    }
  }

  function end(log) {
    const score = log.filter((l) => l.ok).length;
    const isBest = recordSprint(score);
    setResult({ score, isBest, log, fireId: isBest && score > 0 ? Date.now() : 0 });
    setPhase('done');
    if (isBest && score > 0) sfx.correct();
  }

  if (phase === 'loading') return <Spinner label="Warming up…" />;
  if (phase === 'play') return <SprintGame pool={pool} onEnd={end} />;

  const history = progress.sprint.history || [];
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {phase === 'done' && <Confetti fire={result.fireId} />}
      <div className="card center" style={{ padding: 32 }}>
        <div style={{ fontSize: 64 }}>⚡</div>
        <h1 className="page-title">Puzzle Sprint</h1>
        {phase === 'done' ? (
          <>
            <p className="text-2">{result.isBest && result.score > 0 ? '🏆 New personal best!' : 'Run complete'}</p>
            <div className="sprint-score" style={{ fontSize: 88 }}>
              {result.score}
            </div>
            <p className="text-2">
              Personal best: <b>{progress.sprint.best}</b>
            </p>
            <div className="sprint-log" style={{ justifyContent: 'center', margin: '14px 0 22px' }}>
              {result.log.map((l, i) => (
                <a key={i} className={l.ok ? 'ok' : 'bad'} href={l.link} target="_blank" rel="noreferrer" style={{ minWidth: 38, height: 26, borderRadius: 4, fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: l.ok ? 'var(--green)' : 'var(--red-soft)' }}>
                  {l.rating}
                </a>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-2" style={{ fontSize: 17, lineHeight: 1.5 }}>
              Solve as many puzzles as you can in <b>3 minutes</b>. They get harder as you go. Three misses and you're out.
            </p>
            <div className="row" style={{ justifyContent: 'center', gap: 28, margin: '20px 0' }}>
              <div>
                <div className="tiny muted bold">PERSONAL BEST</div>
                <div className="stat-big green">{progress.sprint.best || '—'}</div>
              </div>
              <div>
                <div className="tiny muted bold">RUNS</div>
                <div className="stat-big">{history.length}</div>
              </div>
            </div>
          </>
        )}
        <button className="btn primary huge" onClick={start}>
          {phase === 'done' ? 'Play again' : 'Start'}
        </button>
        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  );
}
