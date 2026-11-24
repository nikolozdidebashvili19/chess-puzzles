import { useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import Trainer from '../components/Trainer.jsx';
import { BOARD_THEMES } from '../components/Board.jsx';
import { Bar } from '../components/ui.jsx';
import { startAnalysis, stopAnalysis, updateSettings, useStore } from '../lib/store.js';

const PAGE = 12;

function srsLabel(card) {
  if (!card) return { t: 'New', c: 'blue' };
  if (card.due <= Date.now()) return { t: card.box === 0 ? 'Missed — retry' : 'Review due', c: card.box === 0 ? 'red' : 'orange' };
  return { t: card.box >= 4 ? 'Mastered' : `Learning ${card.box}/4`, c: 'green' };
}

export default function Mistakes() {
  const myPuzzles = useStore((s) => s.myPuzzles);
  const progress = useStore((s) => s.progress);
  const analyzer = useStore((s) => s.analyzer);
  const analysis = useStore((s) => s.analysis);
  const games = useStore((s) => s.games);
  const [filter, setFilter] = useState('all');
  const [phase, setPhase] = useState('all');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(null);
  const theme = BOARD_THEMES[progress.settings.boardTheme] || BOARD_THEMES.green;

  const list = useMemo(
    () =>
      myPuzzles
        .filter((p) => filter === 'all' || (filter === 'missedMate' ? p.themes.includes('missedMate') : p.kind === filter))
        .filter((p) => phase === 'all' || p.themes.includes(phase))
        .sort((a, b) => b.date - a.date || a.moveNumber - b.moveNumber),
    [myPuzzles, filter, phase],
  );

  const analyzedCount = Object.keys(analysis).length;
  const unanalyzed = games.filter((g) => !analysis[g.id]).length;
  const counts = useMemo(() => {
    const c = { blunder: 0, mistake: 0, missedMate: 0, mastered: 0 };
    for (const p of myPuzzles) {
      c[p.kind]++;
      if (p.themes.includes('missedMate')) c.missedMate++;
      if ((progress.srs[p.id]?.box || 0) >= 4) c.mastered++;
    }
    return c;
  }, [myPuzzles, progress.srs]);

  if (active) {
    const i = list.findIndex((p) => p.id === active);
    const p = list[i];
    return (
      <>
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn sm" onClick={() => setActive(null)}>
            ← Back to list
          </button>
          <span className="muted small">
            {i + 1} of {list.length}
          </span>
        </div>
        <Trainer puzzle={p} label="🔍 Your game" onNext={() => setActive(list[(i + 1) % list.length].id)} />
      </>
    );
  }

  const shown = list.slice(0, page * PAGE);

  return (
    <>
      <h1 className="page-title">My Mistakes</h1>
      <p className="page-sub">Every serious mistake from your analyzed games, turned into a puzzle. Missed ones come back until you master them.</p>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>🤖 Game analysis</h3>
          {analyzer.running ? (
            <>
              <div className="row small text-2" style={{ marginBottom: 8 }}>
                Analyzing game {analyzer.done + 1} of {analyzer.total}… (keeps running while you browse)
              </div>
              <Bar value={analyzer.done} max={analyzer.total} />
              <button className="btn sm" style={{ marginTop: 12 }} onClick={stopAnalysis}>
                Pause
              </button>
            </>
          ) : (
            <>
              <div className="small text-2" style={{ marginBottom: 12 }}>
                <b style={{ color: '#fff' }}>{analyzedCount}</b> games analyzed · {unanalyzed} not yet analyzed
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className="btn primary sm" disabled={!unanalyzed} onClick={() => startAnalysis()}>
                  Analyze latest {progress.settings.analyzeCount}
                </button>
                <button
                  className="btn sm"
                  disabled={!unanalyzed}
                  onClick={() => {
                    updateSettings({ analyzeCount: progress.settings.analyzeCount + 25 });
                    setTimeout(() => startAnalysis(), 0);
                  }}
                >
                  + 25 more games
                </button>
              </div>
            </>
          )}
        </div>
        <div className="card">
          <h3>📋 Summary</h3>
          <div className="count-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div>
              <b className="red">{counts.blunder}</b>
              <span className="tiny muted">Blunders</span>
            </div>
            <div>
              <b className="orange">{counts.mistake}</b>
              <span className="tiny muted">Mistakes</span>
            </div>
            <div>
              <b style={{ color: 'var(--purple)' }}>{counts.missedMate}</b>
              <span className="tiny muted">Missed mates</span>
            </div>
            <div>
              <b className="green">{counts.mastered}</b>
              <span className="tiny muted">Mastered</span>
            </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="tabs">
          {[
            ['all', 'All'],
            ['blunder', 'Blunders'],
            ['mistake', 'Mistakes'],
            ['missedMate', 'Missed mates'],
          ].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="tabs">
          {[
            ['all', 'Any phase'],
            ['opening', 'Opening'],
            ['middlegame', 'Middlegame'],
            ['endgame', 'Endgame'],
          ].map(([k, l]) => (
            <button key={k} className={phase === k ? 'on' : ''} onClick={() => setPhase(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {!list.length && (
        <div className="card empty">
          <div className="big-ico">{analyzer.running ? '🤖' : '✨'}</div>
          <p>{analyzer.running ? 'Stockfish is looking through your games — mistakes will appear here as they are found.' : myPuzzles.length ? 'Nothing matches this filter.' : 'No mistakes found yet. Analyze some games to get started!'}</p>
        </div>
      )}

      <div className="theme-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {shown.map((p) => {
          const lbl = srsLabel(progress.srs[p.id]);
          return (
            <div className="theme-card" key={p.id} onClick={() => setActive(p.id)} style={{ padding: 10 }}>
              <div style={{ pointerEvents: 'none' }}>
                <Chessboard
                  id={`thumb-${p.id}`}
                  position={p.fen}
                  boardOrientation={p.color}
                  arePiecesDraggable={false}
                  showBoardNotation={false}
                  animationDuration={0}
                  customDarkSquareStyle={{ backgroundColor: theme.dark }}
                  customLightSquareStyle={{ backgroundColor: theme.light }}
                  customSquareStyles={p.lastMove ? { [p.lastMove[0]]: { background: 'rgba(255,255,51,.42)' }, [p.lastMove[1]]: { background: 'rgba(255,255,51,.42)' } } : {}}
                />
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <span className={`pill ${p.kind === 'blunder' ? 'red' : 'orange'}`}>
                  {p.playedSan}
                  {p.kind === 'blunder' ? '??' : '?'}
                </span>
                <span className="spacer" />
                <span className={`pill ${lbl.c}`}>{lbl.t}</span>
              </div>
              <div className="tiny muted" style={{ marginTop: 6 }}>
                vs {p.opp.name} · move {p.moveNumber} · {new Date(p.date * 1000).toLocaleDateString()}
              </div>
            </div>
          );
        })}
      </div>
      {shown.length < list.length && (
        <div className="center" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => setPage((n) => n + 1)}>
            Show more ({list.length - shown.length} left)
          </button>
        </div>
      )}
    </>
  );
}
