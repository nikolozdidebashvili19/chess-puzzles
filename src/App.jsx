import { useEffect } from 'react';
import { useStore, resume, dueMistakes } from './lib/store.js';
import { useRoute } from './lib/router.js';
import { Avatar, Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Train from './pages/Train.jsx';
import Puzzles from './pages/Puzzles.jsx';
import Sprint from './pages/Sprint.jsx';
import Mistakes from './pages/Mistakes.jsx';
import Games from './pages/Games.jsx';
import Review from './pages/Review.jsx';
import Insights from './pages/Insights.jsx';
import Settings from './pages/Settings.jsx';

const NAV = [
  { to: '/', label: 'Home', ico: '🏠', match: (p) => p.length === 0 },
  { to: '/train', label: 'Train', ico: '🎯', match: (p) => p[0] === 'train' },
  { to: '/puzzles', label: 'Puzzles', ico: '🧩', match: (p) => p[0] === 'puzzles' },
  { to: '/sprint', label: 'Sprint', ico: '⚡', match: (p) => p[0] === 'sprint' },
  { to: '/mistakes', label: 'My Mistakes', ico: '🔍', match: (p) => p[0] === 'mistakes', badge: true },
  { to: '/games', label: 'Games', ico: '♟️', match: (p) => p[0] === 'games' || p[0] === 'review' },
  { to: '/insights', label: 'Insights', ico: '📊', match: (p) => p[0] === 'insights' },
  { to: '/settings', label: 'Settings', ico: '⚙️', match: (p) => p[0] === 'settings' },
];

const MOBILE_NAV = ['/', '/train', '/puzzles', '/games', '/insights'];

function Page({ parts }) {
  switch (parts[0]) {
    case undefined:
      return <Home />;
    case 'train':
      return <Train />;
    case 'puzzles':
      return <Puzzles theme={parts[1]} />;
    case 'sprint':
      return <Sprint />;
    case 'mistakes':
      return <Mistakes />;
    case 'games':
      return <Games />;
    case 'review':
      return <Review gameId={decodeURIComponent(parts[1] || '')} />;
    case 'insights':
      return <Insights />;
    case 'settings':
      return <Settings />;
    default:
      return <Home />;
  }
}

export default function App() {
  const booting = useStore((s) => s.booting);
  const user = useStore((s) => s.user);
  const analyzer = useStore((s) => s.analyzer);
  const dueCount = useStore((s) => (s.progress ? dueMistakes(s).length : 0));
  const { parts } = useRoute();

  useEffect(() => {
    resume();
  }, []);

  if (booting) return <Spinner label="Loading…" />;
  if (!user) return <Login />;

  const { profile } = user;
  const pct = analyzer.total ? Math.round((analyzer.done / analyzer.total) * 100) : 0;

  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#/">
          <img src="logo.svg" alt="" />
          <span>
            Knight<b>ly</b>
          </span>
        </a>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.to} href={`#${n.to}`} className={n.match(parts) ? 'active' : ''}>
              <span className="ico">{n.ico}</span>
              {n.label}
              {n.badge && dueCount > 0 && <span className="badge">{dueCount > 99 ? '99+' : dueCount}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {analyzer.running && (
            <div className="analysis-pill">
              <div className="row">
                <span>🤖 Analyzing games</span>
                <span className="spacer" />
                <b>
                  {analyzer.done}/{analyzer.total}
                </b>
              </div>
              <div className="bar">
                <div style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <a className="me-chip" href="#/settings">
            <Avatar src={profile.avatar} name={profile.username} size={36} />
            <div style={{ minWidth: 0 }}>
              <div className="name">{profile.username}</div>
              <div className="sub">Switch account</div>
            </div>
          </a>
        </div>
      </aside>

      <header className="topbar">
        <a className="brand" href="#/">
          <img src="logo.svg" alt="" />
          <span>
            Knight<b>ly</b>
          </span>
        </a>
        <div className="row">
          {analyzer.running && <span className="pill green">🤖 {pct}%</span>}
          <a href="#/settings">
            <Avatar src={profile.avatar} name={profile.username} size={32} />
          </a>
        </div>
      </header>

      <main className="main">
        <div className="page fade-in" key={parts.join('/')}>
          <Page parts={parts} />
        </div>
      </main>

      <nav className="bottomnav">
        {NAV.filter((n) => MOBILE_NAV.includes(n.to)).map((n) => (
          <a key={n.to} href={`#${n.to}`} className={n.match(parts) ? 'active' : ''}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
