import { useState } from 'react';
import { login, savedAccounts, forgetAccount } from '../lib/store.js';
import { Avatar, PlayerName } from '../components/ui.jsx';

const FEATURES = [
  { i: '🔍', t: 'Puzzles from your own mistakes', d: 'Stockfish scans your Chess.com games and turns every blunder into a puzzle.' },
  { i: '🧠', t: 'Spaced repetition', d: 'Puzzles you miss come back until you nail them for good.' },
  { i: '🧩', t: 'Unlimited themed puzzles', d: 'Forks, pins, mates and more — millions of rated puzzles.' },
  { i: '📊', t: 'Deep insights', d: 'Openings, time trouble, accuracy and rating trends — all free.' },
];

export default function Login() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState(savedAccounts());

  async function go(username) {
    setBusy(username);
    setError(null);
    try {
      await login(username);
    } catch (e) {
      setError(e.message);
      setBusy(null);
    }
  }

  return (
    <div className="login">
      <section className="login-hero">
        <div className="brand" style={{ padding: 0 }}>
          <img src="logo.svg" alt="" style={{ width: 44, height: 44 }} />
          <span style={{ fontSize: 28 }}>
            Knight<b>ly</b>
          </span>
        </div>
        <h1>
          Train on <em>your</em> games.
          <br />
          Get better, faster.
        </h1>
        <p>Connect your Chess.com username and get a personal trainer built from every game you've played. Free, forever.</p>
        <div className="feature-list">
          {FEATURES.map((f) => (
            <div className="feature" key={f.t}>
              <div className="fi">{f.i}</div>
              <div>
                <b>{f.t}</b>
                <span>{f.d}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="login-form">
        <div className="login-box">
          {accounts.length > 0 && (
            <>
              <h2>Welcome back</h2>
              <p className="text-2" style={{ marginTop: 0 }}>Pick your account to continue</p>
              {accounts.map((a) => (
                <div className="account-row" key={a.username} onClick={() => !busy && go(a.username)}>
                  <Avatar src={a.avatar} name={a.username} size={44} />
                  <div>
                    <div className="bold">
                      <PlayerName name={a.username} title={a.title} />
                    </div>
                    {a.name && <div className="small muted">{a.name}</div>}
                  </div>
                  {busy === a.username ? (
                    <div className="spinner" style={{ width: 22, height: 22, borderWidth: 3, margin: '0 0 0 auto' }} />
                  ) : (
                    <button
                      className="x"
                      title="Remove from this device"
                      onClick={(e) => {
                        e.stopPropagation();
                        forgetAccount(a.username);
                        setAccounts(savedAccounts());
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <div className="divider">or add another account</div>
            </>
          )}
          {!accounts.length && (
            <>
              <h2>Log in with Chess.com</h2>
              <p className="text-2" style={{ marginTop: 0 }}>Just your username — no password needed.</p>
            </>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go(name);
            }}
          >
            <input className="input" placeholder="Chess.com username" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!accounts.length} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <button className="btn primary big block" style={{ marginTop: 12 }} disabled={!!busy || !name.trim()}>
              {busy && busy === name ? 'Connecting…' : 'Start Training'}
            </button>
          </form>
          {error && <div className="error-box">{error}</div>}
          <p className="tiny muted" style={{ marginTop: 18, lineHeight: 1.5 }}>
            Knightly reads public game data through Chess.com's official public API. It is an independent fan project, not affiliated with Chess.com. Your progress is saved in this browser.
          </p>
        </div>
      </section>
    </div>
  );
}
