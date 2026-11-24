import { useMemo } from 'react';
import { useStore, dueMistakes } from '../lib/store.js';
import { navigate } from '../lib/router.js';
import { Avatar, Ring, ActivityCalendar, PlayerName } from '../components/ui.jsx';
import { TIME_CLASSES, timeAgo, wdl } from '../lib/stats.js';
import { themeLabel } from '../lib/lichess.js';

export function GameRow({ g, analysis }) {
  const letter = g.outcome === 'win' ? '+' : g.outcome === 'loss' ? '−' : '='
  return (
    <div className="list-row" onClick={() => navigate(`/review/${encodeURIComponent(g.id)}`)}>
      <span className={`result-dot ${g.outcome}`}>{letter}</span>
      <span style={{ fontSize: 13 }} title={g.color}>{g.color === 'white' ? '⚪' : '⚫'}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {g.opp.name} <span className="muted small">({g.opp.rating})</span>
        </div>
        <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {g.opening}
        </div>
      </div>
      {analysis ? (
        <span className="pill" title="Your accuracy">{analysis.accuracy ?? '–'}%</span>
      ) : g.accuracy ? (
        <span className="pill" title="Chess.com accuracy">{Math.round(g.accuracy)}%</span>
      ) : null}
      <span className="tiny muted" style={{ width: 58, textAlign: 'right' }}>
        {timeAgo(g.end * 1000)}
      </span>
    </div>
  );
}

export default function Home() {
  const user = useStore((s) => s.user);
  const progress = useStore((s) => s.progress);
  const games = useStore((s) => s.games);
  const syncing = useStore((s) => s.syncing);
  const analysis = useStore((s) => s.analysis);
  const analyzer = useStore((s) => s.analyzer);
  const myPuzzles = useStore((s) => s.myPuzzles);
  const due = useMemo(() => dueMistakes({ myPuzzles, progress }), [myPuzzles, progress]);
  const { profile, stats } = user;
  const goal = progress.settings.dailyGoal;
  const doneToday = progress.daily.count;
  const recent = games.slice(0, 6);
  const last30 = useMemo(() => wdl(games.filter((g) => g.end * 1000 > Date.now() - 30 * 86400000)), [games]);

  const weak = useMemo(
    () =>
      Object.entries(progress.themes)
        .filter(([k, v]) => v.s + v.f >= 3 && !['short', 'long', 'veryLong', 'oneMove', 'middlegame', 'opening', 'endgame', 'master', 'masterVsMaster', 'crushing', 'advantage', 'equality', 'mate'].includes(k))
        .map(([k, v]) => ({ k, rate: v.s / (v.s + v.f), n: v.s + v.f }))
        .sort((a, b) => a.rate - b.rate)
        .slice(0, 4),
    [progress.themes],
  );

  const firstName = profile.name?.split(' ')[0] || profile.username;
  const ctaText = due.length
    ? `${due.length} position${due.length === 1 ? '' : 's'} from your games waiting`
    : analyzer.running
      ? 'Scanning your games for mistakes…'
      : 'Rated puzzles picked for your level';

  return (
    <>
      <div className="card hero-card" style={{ marginBottom: 16 }}>
        <Avatar src={profile.avatar} name={profile.username} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>Welcome back, {firstName}!</h1>
          <div className="text-2 row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <PlayerName name={profile.username} title={profile.title} />
            {profile.league && <span className="pill">🏆 {profile.league} League</span>}
            {progress.streak.current > 0 && <span className="pill orange">🔥 {progress.streak.current} day streak</span>}
            {syncing && <span className="pill blue">Syncing games…</span>}
          </div>
        </div>
        <Ring value={doneToday} max={goal}>
          <b>
            {Math.min(doneToday, goal)}/{goal}
          </b>
          <span>TODAY</span>
        </Ring>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', marginBottom: 16 }} data-stack>
        <div className="cta-card">
          <div className="glow">♞</div>
          <div className="row">
            <span className="pill green">Personal training</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.15 }}>Ready to train?</div>
          <div className="text-2">{ctaText}</div>
          <button className="btn primary huge" onClick={() => navigate('/train')}>
            ▶ Start Training
          </button>
          <div className="row small text-2" style={{ flexWrap: 'wrap' }}>
            <span>
              🧩 Puzzle rating <b className="green">{progress.rating}</b>
            </span>
            <span>·</span>
            <span>{progress.solved} solved</span>
            <span>·</span>
            <span>Best streak {progress.streak.best}d</span>
          </div>
        </div>
        <div className="grid" style={{ gap: 10 }}>
          <div className="mode-card" onClick={() => navigate('/sprint')}>
            <div className="mi" style={{ background: 'rgba(247,162,59,.18)' }}>⚡</div>
            <div>
              <b>Puzzle Sprint</b>
              <span>3 minutes, 3 lives. Best: {progress.sprint.best || '—'}</span>
            </div>
          </div>
          <div className="mode-card" onClick={() => navigate('/puzzles')}>
            <div className="mi" style={{ background: 'rgba(93,159,232,.18)' }}>🧩</div>
            <div>
              <b>Themed Puzzles</b>
              <span>Forks, pins, mates & more</span>
            </div>
          </div>
          <div className="mode-card" onClick={() => navigate('/mistakes')}>
            <div className="mi" style={{ background: 'rgba(250,65,45,.16)' }}>🔍</div>
            <div>
              <b>My Mistakes</b>
              <span>
                {myPuzzles.length} found in {Object.keys(analysis).length} analyzed games
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        {TIME_CLASSES.map((tc) => {
          const s = stats?.[tc.stat];
          return (
            <div className="rating-tile" key={tc.key}>
              <span className="ico">{tc.icon}</span>
              <div>
                <div className="label">{tc.label}</div>
                <div className="val">{s?.last?.rating ?? '—'}</div>
                {s?.best?.rating && <div className="tiny muted">Best {s.best.rating}</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>
            ♟️ Recent games
            <a className="right" href="#/games">
              View all →
            </a>
          </h3>
          {!recent.length && <div className="empty small">{syncing ? 'Loading your games…' : 'No games found in the last 6 months.'}</div>}
          {recent.map((g) => (
            <GameRow key={g.id} g={g} analysis={analysis[g.id]} />
          ))}
          {last30.total > 0 && (
            <div className="small text-2" style={{ marginTop: 10 }}>
              Last 30 days: <b className="green">{last30.win}W</b> · <b>{last30.draw}D</b> · <b className="red">{last30.loss}L</b> ({last30.score}% score)
            </div>
          )}
        </div>
        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <h3>
              📅 Training activity <span className="right">{Object.values(progress.days).reduce((a, b) => a + b, 0)} total</span>
            </h3>
            <ActivityCalendar days={progress.days} />
          </div>
          <div className="card">
            <h3>🎯 Your weak spots</h3>
            {!weak.length && <div className="small text-2">Solve a few more puzzles and we'll show which tactics trip you up the most.</div>}
            {weak.map((w) => (
              <div key={w.k} className="row" style={{ marginBottom: 10 }}>
                <span className="bold" style={{ width: 150 }}>{themeLabel(w.k)}</span>
                <div className="bar" style={{ flex: 1 }}>
                  <div style={{ width: `${w.rate * 100}%`, background: w.rate < 0.5 ? 'var(--red-soft)' : w.rate < 0.7 ? 'var(--orange)' : 'var(--green)' }} />
                </div>
                <span className="small muted" style={{ width: 44, textAlign: 'right' }}>{Math.round(w.rate * 100)}%</span>
                <button className="btn sm" onClick={() => navigate(`/puzzles/${w.k}`)}>
                  Train
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
