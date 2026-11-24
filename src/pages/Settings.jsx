import { useState } from 'react';
import { useStore, updateSettings, logout, resetProgress, clearAnalysis, refreshGames, login, savedAccounts } from '../lib/store.js';
import { BOARD_THEMES } from '../components/Board.jsx';
import { Avatar, PlayerName } from '../components/ui.jsx';
import { navigate } from '../lib/router.js';

function Toggle({ on, onChange }) {
  return <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />;
}

export default function Settings() {
  const user = useStore((s) => s.user);
  const settings = useStore((s) => s.progress.settings);
  const [confirm, setConfirm] = useState(null);
  const others = savedAccounts().filter((a) => a.username !== user.username);

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Saved in this browser for {user.profile.username}.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>👤 Account</h3>
        <div className="row">
          <Avatar src={user.profile.avatar} name={user.username} size={52} />
          <div>
            <div className="bold">
              <PlayerName name={user.profile.username} title={user.profile.title} />
            </div>
            <a className="small muted" href={user.profile.url} target="_blank" rel="noreferrer">
              View Chess.com profile ↗
            </a>
          </div>
          <span className="spacer" />
          <button className="btn sm" onClick={refreshGames}>
            ↻ Sync games
          </button>
          <button
            className="btn sm"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            Switch / log out
          </button>
        </div>
        {others.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="tiny muted bold" style={{ marginBottom: 6 }}>
              OTHER ACCOUNTS ON THIS DEVICE
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {others.map((a) => (
                <button
                  key={a.username}
                  className="btn sm"
                  onClick={() => {
                    navigate('/');
                    login(a.username);
                  }}
                >
                  <Avatar src={a.avatar} name={a.username} size={20} /> {a.username}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>🎯 Training</h3>
        <div className="setting">
          <div className="lbl">
            <b>Daily goal</b>
            <span>Puzzles per day to keep your streak glowing</span>
          </div>
          <select className="input" style={{ width: 110, marginLeft: 'auto' }} value={settings.dailyGoal} onChange={(e) => updateSettings({ dailyGoal: +e.target.value })}>
            {[5, 10, 15, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="setting">
          <div className="lbl">
            <b>Games to analyze</b>
            <span>How many of your latest games Stockfish scans for mistakes</span>
          </div>
          <select className="input" style={{ width: 110, marginLeft: 'auto' }} value={settings.analyzeCount} onChange={(e) => updateSettings({ analyzeCount: +e.target.value })}>
            {[10, 20, 30, 50, 75, 100, 150].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="setting">
          <div className="lbl">
            <b>Auto-analyze new games</b>
            <span>Scan new games in the background when you log in</span>
          </div>
          <Toggle on={settings.autoAnalyze} onChange={(v) => updateSettings({ autoAnalyze: v })} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>🎨 Board & sound</h3>
        <div className="setting">
          <div className="lbl">
            <b>Board theme</b>
          </div>
          <div className="swatches">
            {Object.entries(BOARD_THEMES).map(([k, t]) => (
              <button key={k} className={`swatch ${settings.boardTheme === k ? 'on' : ''}`} title={t.name} onClick={() => updateSettings({ boardTheme: k })}>
                <span style={{ background: t.light }} />
                <span style={{ background: t.dark }} />
                <span style={{ background: t.dark }} />
                <span style={{ background: t.light }} />
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div className="lbl">
            <b>Coordinates</b>
            <span>Show a–h and 1–8 on the board</span>
          </div>
          <Toggle on={settings.showCoords} onChange={(v) => updateSettings({ showCoords: v })} />
        </div>
        <div className="setting">
          <div className="lbl">
            <b>Sounds</b>
            <span>Move, capture and puzzle sounds</span>
          </div>
          <Toggle on={settings.sound} onChange={(v) => updateSettings({ sound: v })} />
        </div>
      </div>

      <div className="card">
        <h3>⚠️ Danger zone</h3>
        <div className="setting">
          <div className="lbl">
            <b>Re-analyze games</b>
            <span>Clears engine results and puzzles from your games</span>
          </div>
          {confirm === 'analysis' ? (
            <button
              className="btn sm danger"
              style={{ marginLeft: 'auto' }}
              onClick={async () => {
                await clearAnalysis();
                setConfirm(null);
              }}
            >
              Yes, clear
            </button>
          ) : (
            <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setConfirm('analysis')}>
              Clear analysis
            </button>
          )}
        </div>
        <div className="setting">
          <div className="lbl">
            <b>Reset training progress</b>
            <span>Puzzle rating, streaks and history start over</span>
          </div>
          {confirm === 'progress' ? (
            <button
              className="btn sm danger"
              style={{ marginLeft: 'auto' }}
              onClick={async () => {
                await resetProgress();
                setConfirm(null);
              }}
            >
              Yes, reset
            </button>
          ) : (
            <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setConfirm('progress')}>
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
