import { useMemo, useState } from 'react';
import { useStore, refreshGames } from '../lib/store.js';
import { GameRow } from './Home.jsx';
import { TIME_CLASSES } from '../lib/stats.js';

export default function Games() {
  const games = useStore((s) => s.games);
  const analysis = useStore((s) => s.analysis);
  const syncing = useStore((s) => s.syncing);
  const syncProgress = useStore((s) => s.syncProgress);
  const [tc, setTc] = useState('all');
  const [res, setRes] = useState('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(40);

  const list = useMemo(
    () =>
      games.filter(
        (g) =>
          (tc === 'all' || g.timeClass === tc) &&
          (res === 'all' || g.outcome === res) &&
          (!q || g.opp.name.toLowerCase().includes(q.toLowerCase()) || g.opening.toLowerCase().includes(q.toLowerCase())),
      ),
    [games, tc, res, q],
  );

  return (
    <>
      <div className="row" style={{ marginBottom: 4 }}>
        <h1 className="page-title">Games</h1>
        <span className="spacer" />
        <button className="btn sm" onClick={refreshGames} disabled={syncing}>
          {syncing ? `Syncing ${Math.round(syncProgress * 100)}%` : '↻ Sync'}
        </button>
      </div>
      <p className="page-sub">Your last 6 months of Chess.com games. Click any game for a full engine review.</p>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="tabs">
          {[['all', 'All'], ...TIME_CLASSES.map((t) => [t.key, t.label])].map(([k, l]) => (
            <button key={k} className={tc === k ? 'on' : ''} onClick={() => setTc(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="tabs">
          {[
            ['all', 'Any result'],
            ['win', 'Wins'],
            ['loss', 'Losses'],
            ['draw', 'Draws'],
          ].map(([k, l]) => (
            <button key={k} className={res === k ? 'on' : ''} onClick={() => setRes(k)}>
              {l}
            </button>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 260, padding: '8px 12px', fontSize: 14 }} placeholder="Search opponent or opening" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card" style={{ padding: 8 }}>
        {!list.length && <div className="empty">{syncing ? 'Loading games…' : 'No games match.'}</div>}
        {list.slice(0, limit).map((g) => (
          <GameRow key={g.id} g={g} analysis={analysis[g.id]} />
        ))}
      </div>
      {list.length > limit && (
        <div className="center" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => setLimit((l) => l + 40)}>
            Show more
          </button>
        </div>
      )}
    </>
  );
}
