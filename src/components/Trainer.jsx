import { useEffect, useMemo, useState } from 'react';
import Board from './Board.jsx';
import { usePuzzle } from '../lib/usePuzzle.js';
import { recordAttempt, useStore } from '../lib/store.js';
import { themeLabel } from '../lib/lichess.js';
import { navigate } from '../lib/router.js';
import { THEME_INFO, explainPuzzle } from '../lib/explain.js';

const HIDDEN_THEMES = new Set(['short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM']);

export function GoalCard({ goal, step = 0, compact = false }) {
  const done = Math.ceil(step / 2);
  const current = Math.min(goal.moves, done + 1);
  return (
    <div className="goal-card">
      <span className="goal-ico">{goal.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tiny muted bold">YOUR MISSION</div>
        <b>{goal.title}</b>
        {!compact && <div className="small text-2">{goal.text}</div>}
        {goal.moves > 1 && (
          <div className="move-track">
            {Array.from({ length: goal.moves }, (_, k) => (
              <span key={k} className={k < done ? 'done' : k === done ? 'now' : ''} />
            ))}
            <em>
              Move {current} of {goal.moves}
            </em>
          </div>
        )}
      </div>
    </div>
  );
}

function Explanation({ ex }) {
  return (
    <div className="explain">
      {ex.motifs.length > 0 && (
        <div className="explain-motifs">
          {ex.motifs.map((k) => (
            <div key={k} className="motif">
              <b>{THEME_INFO[k][0]}</b>
              <span>{THEME_INFO[k][1]}</span>
            </div>
          ))}
        </div>
      )}
      <div className="tiny muted bold" style={{ marginTop: 4 }}>
        HOW IT WORKS
      </div>
      <ol className="explain-steps">
        {ex.steps.map((s, i) => (
          <li key={i} className={s.mine ? 'mine' : 'opp'}>
            <span className="mv-num">
              {s.moveNo}
              {s.white ? '.' : '…'}
            </span>
            <b>{s.san}</b>
            {s.mine && i === 0 ? '!' : ''} <span className="why">— {s.notes.join('; ')}</span>
          </li>
        ))}
      </ol>
      <div className="small text-2">{ex.summary}</div>
    </div>
  );
}

function stillWinning(score) {
  if (!score) return false;
  if (score.mate != null) return score.mate > 0;
  return (score.cp || 0) >= 200;
}

function fmtEval(score) {
  if (!score) return '0.0';
  if (score.mate != null) return Math.abs(Math.round(score.mate)) === 0 ? '#' : `${score.mate > 0 ? '' : '-'}M${Math.abs(Math.round(score.mate))}`;
  const v = (score.cp || 0) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

function MistakeContext({ p, revealed }) {
  const date = new Date(p.date * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div className="ctx-box">
      <div>
        From your game vs <b>{p.opp.name}</b> ({p.opp.rating}) · {date}
      </div>
      <div style={{ marginTop: 6 }}>
        On move {p.moveNumber} you played{' '}
        <b className={p.kind === 'blunder' ? 'red' : 'orange'}>
          {p.playedSan}
          {p.kind === 'blunder' ? '??' : '?'}
        </b>
        {revealed ? (
          <>
            {' '}
            — the best move was <b className="green">{p.bestSan}</b>.
          </>
        ) : (
          <>. Find the move you missed!</>
        )}
      </div>
      {revealed && p.scoreAfter && (
        <div style={{ marginTop: 8 }}>
          <b>What went wrong: </b>
          {stillWinning(p.scoreAfter) ? (
            <>
              your move kept you ahead (<b>{fmtEval(p.scoreAfter)}</b>), but you missed {p.goalKind === 'mate' ? <b>a forced checkmate</b> : <b>a chance to win material</b>} and gave your opponent time to fight back.
            </>
          ) : (
            <>
              your move changed the evaluation from <b>{fmtEval(p.scoreBefore)}</b> to <b className="red">{fmtEval(p.scoreAfter)}</b>
              {p.refutation?.length > 0 && (
                <>
                  . Your opponent could punish it with <b>{p.refutation.join(' ')}</b>
                  {p.lostByPlayed >= 1 && <> — losing about {p.lostByPlayed} point{p.lostByPlayed > 1 ? 's' : ''} of material</>}
                </>
              )}
              .
            </>
          )}
        </div>
      )}
      {revealed && (
        <div className="row" style={{ marginTop: 8, gap: 12 }}>
          <a className="small green bold" href={`#/review/${encodeURIComponent(p.gameId)}`}>
            Review game →
          </a>
          <a className="small text-2" href={p.gameUrl} target="_blank" rel="noreferrer">
            Open on Chess.com ↗
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Board + side panel for solving one puzzle at a time.
 * props: puzzle, onNext(), title, extra (node under the header), autoNext
 */
export default function Trainer({ puzzle, onNext, label = 'Puzzle', extra = null, onResult }) {
  const rating = useStore((s) => s.progress.rating);
  const [result, setResult] = useState(null); // { solved, delta, hint }

  useEffect(() => setResult(null), [puzzle?.id]);
  const ex = useMemo(() => (puzzle ? explainPuzzle(puzzle) : null), [puzzle?.id]);

  const pz = usePuzzle(puzzle, {
    onResult: (solved, info) => {
      const delta = recordAttempt(puzzle, solved);
      setResult({ solved, delta, ...info });
      onResult?.(solved, puzzle);
    },
  });

  // Keyboard: Enter/→ next, H hint
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const finished = ['solved', 'revealed'].includes(pz.status) || (pz.status === 'wrong' && result);
      if ((e.key === 'Enter' || e.key === 'ArrowRight') && finished) onNext();
      if (e.key.toLowerCase() === 'h' && pz.status === 'playing') pz.hint();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!puzzle) return null;
  const white = pz.playerColor === 'w';
  const done = pz.status === 'solved' || pz.status === 'revealed';
  const revealed = done || pz.status === 'showing';

  let head;
  if (pz.status === 'solved') {
    head = (
      <div className="side-head ok">
        ✓ {result && !result.solved ? 'Solved (after a miss)' : 'Correct!'}
      </div>
    );
  } else if (pz.status === 'wrong' || pz.status === 'reverting') {
    head = <div className="side-head bad">✗ Incorrect — try again</div>;
  } else if (pz.status === 'showing' || pz.status === 'revealed') {
    head = <div className="side-head info">💡 Solution</div>;
  } else if (pz.status === 'checking') {
    head = <div className="side-head info">🤖 Checking your move…</div>;
  } else {
    head = (
      <div className={`side-head ${white ? 'turn-w' : 'turn-b'}`}>
        <span className="sq" style={{ background: white ? '#fff' : '#000' }} />
        {white ? 'White' : 'Black'} to move
      </div>
    );
  }

  const themes = (puzzle.themes || []).filter((t) => !HIDDEN_THEMES.has(t));

  return (
    <div className="trainer">
      <div className="board-col">
        <Board
          id="trainer"
          fen={pz.fen}
          orientation={pz.orientation}
          onMove={pz.onMove}
          interactive={pz.status === 'playing' || pz.status === 'wrong'}
          lastMove={pz.lastMove}
          squareStyles={pz.squareStyles}
          arrows={pz.arrows}
        />
      </div>
      <div className="side">
        {head}
        <div className="side-body">
          <div className="row">
            <div>
              <div className="tiny muted bold">YOUR PUZZLE RATING</div>
              <div className="big-rating">
                {rating}
                {result && result.delta !== 0 && <span className={`delta ${result.delta > 0 ? 'up' : 'down'}`}>{result.delta > 0 ? `+${result.delta}` : result.delta}</span>}
              </div>
            </div>
            <span className="spacer" />
            <span className="pill">{label}</span>
          </div>
          {extra}
          {!revealed && ex && <GoalCard goal={ex.goal} step={pz.step} />}
          {puzzle.source === 'mine' && <MistakeContext p={puzzle} revealed={revealed} />}
          {pz.note && <div className="feedback green bold">{pz.note}</div>}
          {revealed && ex && pz.status !== 'showing' && <Explanation ex={ex} />}
          {pz.status === 'wrong' && <div className="feedback">That's not it. Keep trying, or show the solution. Using a hint or missing counts as a fail for your rating.</div>}
          {revealed && (
            <div className="row small text-2" style={{ flexWrap: 'wrap' }}>
              Puzzle rating <b style={{ color: '#fff' }}>{puzzle.rating}</b>
              {puzzle.link && (
                <a href={puzzle.link} target="_blank" rel="noreferrer" className="muted">
                  · source ↗
                </a>
              )}
            </div>
          )}
          {revealed && themes.length > 0 && (
            <div className="theme-tags">
              {themes.map((t) => (
                <span className="pill" key={t} style={{ cursor: 'pointer' }} onClick={() => navigate(`/puzzles/${t}`)}>
                  {themeLabel(t)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="side-foot">
          {done ? (
            <>
              {pz.status === 'revealed' && (
                <button className="btn" onClick={pz.retry}>
                  ↺ Retry
                </button>
              )}
              <button className="btn primary" onClick={onNext}>
                Next puzzle →
              </button>
            </>
          ) : pz.status === 'wrong' ? (
            <>
              <button className="btn" onClick={pz.showSolution}>
                Solution
              </button>
              <button className="btn primary" onClick={onNext}>
                Skip →
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={pz.hint} disabled={pz.status !== 'playing'}>
                💡 Hint
              </button>
              <button className="btn" onClick={pz.showSolution} disabled={pz.status !== 'playing'}>
                Solution
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
