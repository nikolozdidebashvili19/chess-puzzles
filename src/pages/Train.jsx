import { useEffect, useRef, useState } from 'react';
import Trainer from '../components/Trainer.jsx';
import { Spinner } from '../components/ui.jsx';
import { dueMistakes, getState, useStore } from '../lib/store.js';
import { difficultyFor, fetchPuzzleBatch } from '../lib/lichess.js';
import { sfx } from '../lib/sound.js';

/** Shared buffered loader for Lichess puzzles. */
export function useLichessFeed(theme = 'mix') {
  const buffer = useRef([]);
  const loading = useRef(null);
  const seen = useRef(new Set());

  async function fill() {
    if (loading.current) return loading.current;
    loading.current = fetchPuzzleBatch(theme, difficultyFor(getState().progress.rating), 40)
      .then((list) => {
        buffer.current.push(...list.filter((p) => !seen.current.has(p.id) && (p.solution.length >= 3 || p.themes.includes('mateIn1'))));
        // Shuffle so themes and mates interleave.
        const b = buffer.current;
        for (let k = b.length - 1; k > 0; k--) {
          const j = Math.floor(Math.random() * (k + 1));
          [b[k], b[j]] = [b[j], b[k]];
        }
      })
      .finally(() => {
        loading.current = null;
      });
    return loading.current;
  }

  async function take() {
    for (let k = 0; k < 3 && !buffer.current.length; k++) await fill();
    const p = buffer.current.shift();
    if (p) seen.current.add(p.id);
    if (buffer.current.length < 5) fill().catch(() => {});
    return p;
  }

  return { take, reset: () => (buffer.current = []) };
}

export default function Train() {
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState(null);
  const [session, setSession] = useState([]);
  const seen = useRef(new Set());
  const feed = useLichessFeed('mix');
  const analyzer = useStore((s) => s.analyzer);

  async function next() {
    setError(null);
    const s = getState();
    const due = dueMistakes(s).filter((p) => !seen.current.has(p.id));
    const n = seen.current.size;
    let pick = null;
    // Mostly your own mistakes, with a fresh rated puzzle every 4th.
    if (due.length && n % 4 !== 3) pick = due[0];
    if (!pick) {
      try {
        pick = await feed.take();
      } catch (e) {
        if (due.length) pick = due[0];
        else {
          setError(e.message);
          return;
        }
      }
    }
    if (!pick) {
      setError('No puzzles available right now.');
      return;
    }
    seen.current.add(pick.id);
    setCurrent(pick);
  }

  useEffect(() => {
    sfx.start();
    next();
  }, []);

  const solvedCount = session.filter((s) => s.solved).length;
  const dueLeft = dueMistakes(getState()).filter((p) => !seen.current.has(p.id)).length;

  const extra = (
    <div>
      <div className="row small text-2">
        <span>
          This session: <b className="green">{solvedCount}</b> / {session.length}
        </span>
        <span className="spacer" />
        <span>{dueLeft > 0 ? `${dueLeft} from your games left` : analyzer.running ? '🤖 finding more…' : ''}</span>
      </div>
      {session.length > 0 && (
        <div className="sprint-log" style={{ marginTop: 8 }}>
          {session.slice(-16).map((s, i) => (
            <span key={i} className={s.solved ? 'ok' : 'bad'} style={{ minWidth: 14, height: 14, padding: 0 }} />
          ))}
        </div>
      )}
    </div>
  );

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
  if (!current) return <Spinner label="Picking your puzzles…" />;
  return <Trainer puzzle={current} onNext={next} label={current.source === 'mine' ? '🔍 Your game' : '🧩 Rated'} extra={extra} onResult={(solved, p) => setSession((s) => [...s, { id: p.id, solved }])} />;
}
