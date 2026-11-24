import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.js';
import { LineChart, WdlBar } from '../components/ui.jsx';
import { TIME_CLASSES, bestWin, openingTable, ratingSeries, streaks, terminationBreakdown, timeTrouble, wdl } from '../lib/stats.js';
import { navigate } from '../lib/router.js';

function WdlCard({ title, r }) {
  return (
    <div className="card">
      <div className="tiny muted bold">{title}</div>
      <div className="stat-big" style={{ margin: '4px 0 8px' }}>
        {r.score}% <span className="small muted">score</span>
      </div>
      <WdlBar win={r.win} draw={r.draw} loss={r.loss} />
      <div className="row small" style={{ marginTop: 8 }}>
        <span className="green bold">{r.win}W</span>
        <span className="muted bold">{r.draw}D</span>
        <span className="red bold">{r.loss}L</span>
        <span className="spacer" />
        <span className="muted">{r.total} games</span>
      </div>
    </div>
  );
}

function OpeningCard({ title, rows }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {!rows.length && <div className="small muted">No games.</div>}
      <div className="table-scroll">
        <table className="table">
          {rows.length > 0 && (
            <thead>
              <tr>
                <th>Opening</th>
                <th>Games</th>
                <th>Result</th>
                <th>Score</th>
              </tr>
            </thead>
          )}
          <tbody>
            {rows.slice(0, 8).map((o) => (
              <tr key={o.key}>
                <td className="bold" style={{ maxWidth: 220 }}>{o.key}</td>
                <td>{o.total}</td>
                <td>
                  <WdlBar win={o.win} draw={o.draw} loss={o.loss} />
                </td>
                <td className={o.score >= 55 ? 'green bold' : o.score < 45 ? 'red bold' : 'bold'}>{o.score}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Insights() {
  const allGames = useStore((s) => s.games);
  const progress = useStore((s) => s.progress);
  const analysis = useStore((s) => s.analysis);
  const myPuzzles = useStore((s) => s.myPuzzles);
  const [tc, setTc] = useState('all');

  const games = useMemo(() => (tc === 'all' ? allGames : allGames.filter((g) => g.timeClass === tc)), [allGames, tc]);
  const overall = useMemo(() => wdl(games), [games]);
  const asWhite = useMemo(() => wdl(games.filter((g) => g.color === 'white')), [games]);
  const asBlack = useMemo(() => wdl(games.filter((g) => g.color === 'black')), [games]);
  const whiteOps = useMemo(() => openingTable(games, 'white'), [games]);
  const blackOps = useMemo(() => openingTable(games, 'black'), [games]);
  const term = useMemo(() => terminationBreakdown(games), [games]);
  const tt = useMemo(() => timeTrouble(games), [games]);
  const best = useMemo(() => bestWin(games), [games]);
  const st = useMemo(() => streaks(games), [games]);
  const chartTc = tc === 'all' ? (TIME_CLASSES.map((t) => t.key).sort((a, b) => allGames.filter((g) => g.timeClass === b).length - allGames.filter((g) => g.timeClass === a).length)[0]) : tc;
  const series = useMemo(() => ratingSeries(allGames, chartTc), [allGames, chartTc]);

  const analyzed = games.filter((g) => analysis[g.id]);
  const avgAcc = analyzed.length ? Math.round((analyzed.reduce((a, g) => a + (analysis[g.id].accuracy || 0), 0) / analyzed.length) * 10) / 10 : null;
  const perGame = analyzed.length
    ? {
        blunder: (analyzed.reduce((a, g) => a + analysis[g.id].counts.blunder, 0) / analyzed.length).toFixed(1),
        mistake: (analyzed.reduce((a, g) => a + analysis[g.id].counts.mistake, 0) / analyzed.length).toFixed(1),
        inaccuracy: (analyzed.reduce((a, g) => a + analysis[g.id].counts.inaccuracy, 0) / analyzed.length).toFixed(1),
      }
    : null;
  const ids = new Set(games.map((g) => g.id));
  const phaseCounts = { opening: 0, middlegame: 0, endgame: 0 };
  myPuzzles.filter((p) => ids.has(p.gameId)).forEach((p) => p.themes.forEach((t) => t in phaseCounts && phaseCounts[t]++));
  const phaseTotal = Object.values(phaseCounts).reduce((a, b) => a + b, 0);
  const worstPhase = phaseTotal ? Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0][0] : null;

  if (!allGames.length) return <div className="empty card">No games loaded yet.</div>;

  return (
    <>
      <h1 className="page-title">Insights</h1>
      <p className="page-sub">Patterns from your last {allGames.length} games.</p>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[['all', 'All games'], ...TIME_CLASSES.map((t) => [t.key, t.label])].map(([k, l]) => (
          <button key={k} className={tc === k ? 'on' : ''} onClick={() => setTc(k)}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <WdlCard title="OVERALL" r={overall} />
        <WdlCard title="AS WHITE" r={asWhite} />
        <WdlCard title="AS BLACK" r={asBlack} />
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>
            📈 {TIME_CLASSES.find((t) => t.key === chartTc)?.label} rating
            <span className="right">{series.length} rated games</span>
          </h3>
          <LineChart points={series} />
        </div>
        <div className="card">
          <h3>
            🧩 Puzzle rating <span className="right">{progress.attempts} attempts</span>
          </h3>
          <LineChart points={progress.ratingHistory} color="#5d9fe8" />
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="tiny muted bold">AVG ACCURACY</div>
          <div className="stat-big green">{avgAcc ?? '—'}</div>
          <div className="tiny muted">{analyzed.length} analyzed games</div>
        </div>
        <div className="card">
          <div className="tiny muted bold">BLUNDERS / GAME</div>
          <div className="stat-big red">{perGame?.blunder ?? '—'}</div>
          <div className="tiny muted">{perGame ? `${perGame.mistake} mistakes, ${perGame.inaccuracy} inaccuracies` : 'analyze games to see'}</div>
        </div>
        <div className="card">
          <div className="tiny muted bold">TIME TROUBLE</div>
          <div className="stat-big orange">{tt != null ? `${tt}%` : '—'}</div>
          <div className="tiny muted">of losses with &lt;10% clock left</div>
        </div>
        <div className="card">
          <div className="tiny muted bold">BEST WIN STREAK</div>
          <div className="stat-big">{st.bestWinStreak}</div>
          <div className="tiny muted">current: {st.currentWinStreak}</div>
        </div>
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <OpeningCard title="⚪ Openings as White" rows={whiteOps} />
        <OpeningCard title="⚫ Openings as Black" rows={blackOps} />
      </div>

      <div className="grid g3">
        <div className="card">
          <h3>💀 How you lose</h3>
          {term.lossBy.map((r) => (
            <div className="row small" key={r.key} style={{ marginBottom: 8 }}>
              <span style={{ width: 110 }}>{r.key}</span>
              <div className="bar" style={{ flex: 1 }}>
                <div style={{ width: `${(r.total / Math.max(1, overall.loss)) * 100}%`, background: 'var(--red-soft)' }} />
              </div>
              <b style={{ width: 30, textAlign: 'right' }}>{r.total}</b>
            </div>
          ))}
          {!term.lossBy.length && <div className="small muted">No losses — nice!</div>}
        </div>
        <div className="card">
          <h3>🏆 How you win</h3>
          {term.winBy.map((r) => (
            <div className="row small" key={r.key} style={{ marginBottom: 8 }}>
              <span style={{ width: 130 }}>{r.key}</span>
              <div className="bar" style={{ flex: 1 }}>
                <div style={{ width: `${(r.total / Math.max(1, overall.win)) * 100}%` }} />
              </div>
              <b style={{ width: 30, textAlign: 'right' }}>{r.total}</b>
            </div>
          ))}
          {best && (
            <div className="ctx-box" style={{ marginTop: 10, cursor: 'pointer' }} onClick={() => navigate(`/review/${encodeURIComponent(best.id)}`)}>
              Best win: <b>{best.opp.name}</b> ({best.opp.rating}) →
            </div>
          )}
        </div>
        <div className="card">
          <h3>🔍 Where mistakes happen</h3>
          {!phaseTotal && <div className="small muted">Analyze some games to see which phase of the game costs you the most.</div>}
          {Object.entries(phaseCounts).map(([k, v]) =>
            phaseTotal ? (
              <div className="row small" key={k} style={{ marginBottom: 8 }}>
                <span style={{ width: 100, textTransform: 'capitalize' }}>{k}</span>
                <div className="bar" style={{ flex: 1 }}>
                  <div style={{ width: `${(v / phaseTotal) * 100}%`, background: 'var(--orange)' }} />
                </div>
                <b style={{ width: 30, textAlign: 'right' }}>{v}</b>
              </div>
            ) : null,
          )}
          {worstPhase && (
            <div className="small text-2" style={{ marginTop: 8 }}>
              Most of your mistakes happen in the <b style={{ color: '#fff' }}>{worstPhase}</b>.{' '}
              <a className="green bold" href="#/mistakes">
                Train them →
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
