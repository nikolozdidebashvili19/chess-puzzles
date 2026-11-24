import { useEffect, useState } from 'react';
import Trainer from '../components/Trainer.jsx';
import { Spinner, Bar } from '../components/ui.jsx';
import { THEMES, themeLabel } from '../lib/lichess.js';
import { useStore } from '../lib/store.js';
import { navigate } from '../lib/router.js';
import { useLichessFeed } from './Train.jsx';

function ThemeTrainer({ theme }) {
  const feed = useLichessFeed(theme);
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState(null);
  const [streak, setStreak] = useState(0);

  async function next() {
    setError(null);
    try {
      const p = await feed.take();
      if (!p) throw new Error('No puzzles found for this theme.');
      setCurrent(p);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    next();
  }, [theme]);

  if (error)
    return (
      <div className="empty">
        <div className="big-ico">😕</div>
        <p>{error}</p>
        <button className="btn primary" onClick={next}>
          Try again
        </button>
      </div>
    );
  if (!current) return <Spinner label="Loading puzzles…" />;
  return (
    <Trainer
      puzzle={current}
      onNext={next}
      label={themeLabel(theme)}
      onResult={(solved) => setStreak((s) => (solved ? s + 1 : 0))}
      extra={
        <div className="row small text-2">
          <a href="#/puzzles" className="text-2">
            ← All themes
          </a>
          <span className="spacer" />
          {streak > 1 && <span className="pill orange">🔥 {streak} in a row</span>}
        </div>
      }
    />
  );
}

export default function Puzzles({ theme }) {
  const themes = useStore((s) => s.progress.themes);
  if (theme) return <ThemeTrainer theme={theme} />;
  return (
    <>
      <h1 className="page-title">Puzzles</h1>
      <p className="page-sub">Pick a theme. Puzzles adapt to your rating, and every attempt updates your weak-spot tracker.</p>
      <div className="theme-grid">
        {THEMES.map((t) => {
          const st = themes[t.key];
          const n = st ? st.s + st.f : 0;
          return (
            <div className="theme-card" key={t.key} onClick={() => navigate(`/puzzles/${t.key}`)}>
              <div className="ti">{t.icon}</div>
              <b>{t.label}</b>
              <span>{t.desc}</span>
              {n > 0 && (
                <div className="acc">
                  <div className="row tiny muted" style={{ marginBottom: 4 }}>
                    <span>{n} played</span>
                    <span className="spacer" />
                    <span>{Math.round((st.s / n) * 100)}%</span>
                  </div>
                  <Bar value={st.s} max={n} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
