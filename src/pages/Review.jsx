import { useEffect, useMemo, useRef, useState } from 'react';
import Board from '../components/Board.jsx';
import { Avatar, Spinner } from '../components/ui.jsx';
import { replay, uciToSan } from '../lib/analyzer.js';
import { formatScore, winPct } from '../lib/engine.js';
import { startAnalysis, useStore } from '../lib/store.js';
import { playMoveSound } from '../lib/sound.js';
import { navigate } from '../lib/router.js';

const MARK = { blunder: '??', mistake: '?', inaccuracy: '?!', best: '★' };
const MARK_TEXT = { blunder: 'Blunder', mistake: 'Mistake', inaccuracy: 'Inaccuracy', best: 'Best move' };

function EvalBar({ score, height, flip }) {
  // score is from White's point of view; flip = White shown at the top
  const w = winPct(score);
  const label = score ? formatScore(score).replace('+', '') : '0.0';
  const whiteAhead = w >= 50;
  return (
    <div className="evalbar" style={{ height }}>
      <div className="white" style={{ position: 'absolute', left: 0, right: 0, height: `${w}%`, [flip ? 'top' : 'bottom']: 0 }} />
      <div className="lbl" style={{ [whiteAhead !== flip ? 'bottom' : 'top']: 4, color: whiteAhead ? '#333' : '#eee' }}>
        {label}
      </div>
    </div>
  );
}

export default function Review({ gameId }) {
  const games = useStore((s) => s.games);
  const user = useStore((s) => s.user);
  const analysis = useStore((s) => s.analysis[gameId]);
  const analyzer = useStore((s) => s.analyzer);
  const game = games.find((g) => g.id === gameId);
  const [ply, setPly] = useState(0);
  const [boardH, setBoardH] = useState(480);
  const colRef = useRef(null);
  const moveListRef = useRef(null);

  const data = useMemo(() => (game ? replay(game) : null), [game]);

  useEffect(() => {
    if (data) setPly(data.moves.length);
  }, [data]);

  useEffect(() => {
    const el = colRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoardH(el.querySelector('.board-wrap')?.clientWidth || 480));
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  useEffect(() => {
    const onKey = (e) => {
      if (!data) return;
      if (e.key === 'ArrowLeft') go(ply - 1);
      if (e.key === 'ArrowRight') go(ply + 1);
      if (e.key === 'Home') go(0);
      if (e.key === 'End') go(data.moves.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    moveListRef.current?.querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
  }, [ply]);

  if (!game) return <Spinner label="Loading game…" />;

  function go(p) {
    const np = Math.max(0, Math.min(data.moves.length, p));
    if (np === ply + 1) playMoveSound(data.moves[np - 1]);
    setPly(np);
  }

  const me = { name: user.profile.username, rating: game.myRating, avatar: user.profile.avatar };
  const opp = { name: game.opp.name, rating: game.opp.rating };
  const top = opp;
  const bottom = me;
  const fen = data.fens[ply];
  const lastMove = ply > 0 ? [data.moves[ply - 1].from, data.moves[ply - 1].to] : null;

  // Score from white's point of view at this ply.
  let whiteScore = null;
  let bestArrow = [];
  let curMark = null;
  if (analysis) {
    const e = analysis.evals[ply];
    if (e) {
      const stm = fen.split(' ')[1];
      const s = { cp: e[0], mate: e[1] };
      whiteScore = stm === 'w' ? s : { cp: s.cp == null ? null : -s.cp, mate: s.mate == null ? null : -s.mate };
      if (s.mate === 0) whiteScore = { mate: stm === 'w' ? -0.0001 : 0.0001, cp: null };
    }
    if (ply > 0) {
      curMark = analysis.marks[ply - 1];
      const prev = analysis.evals[ply - 1];
      if (curMark && curMark !== 'best' && prev?.[2]) bestArrow = [[prev[2].slice(0, 2), prev[2].slice(2, 4), 'rgba(129,182,76,.85)']];
    }
  }

  const rows = [];
  for (let i = 0; i < data.moves.length; i += 2) rows.push([i, data.moves[i], data.moves[i + 1]]);
  const myColor = game.color[0];
  const resultText = game.outcome === 'win' ? 'You won' : game.outcome === 'loss' ? 'You lost' : 'Draw';
  const isAnalyzing = analyzer.running && analyzer.current === game.id;

  const moveCell = (m, i) =>
    m ? (
      <span className={`mv ${ply === i + 1 ? 'cur' : ''}`} onClick={() => go(i + 1)}>
        {m.san}
        {analysis?.marks[i] && analysis.marks[i] !== 'best' && <span className={`mark ${analysis.marks[i]}`}>{MARK[analysis.marks[i]]}</span>}
      </span>
    ) : null;

  const squareStyles = {};
  if (curMark && ply > 0) {
    const color = { blunder: 'rgba(250,65,45,.55)', mistake: 'rgba(247,162,59,.55)', inaccuracy: 'rgba(246,197,68,.5)', best: 'rgba(129,182,76,.5)' }[curMark];
    if (color) squareStyles[data.moves[ply - 1].to] = { background: color };
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => navigate('/games')}>
          ← Games
        </button>
        <span className={`pill ${game.outcome === 'win' ? 'green' : game.outcome === 'loss' ? 'red' : ''}`}>{resultText}</span>
        <span className="small text-2">
          {game.timeClass} · {game.opening} · {new Date(game.end * 1000).toLocaleDateString()}
        </span>
      </div>
      <div className="review">
        <EvalBar score={whiteScore} height={boardH} flip={game.color === 'black'} />
        <div ref={colRef} className="board-col" style={{ justifySelf: 'stretch' }}>
          <div className="player-strip">
            <Avatar name={top.name} size={28} />
            {top.name} <span className="rt">({top.rating})</span>
          </div>
          <Board id="review" fen={fen} orientation={game.color} interactive={false} lastMove={lastMove} arrows={bestArrow} squareStyles={squareStyles} />
          <div className="player-strip">
            <Avatar src={bottom.avatar} name={bottom.name} size={28} />
            {bottom.name} <span className="rt">({bottom.rating})</span>
          </div>
        </div>
        <div className="side">
          <div className="side-head info">⭐ Game Review</div>
          <div className="side-body">
            {analysis ? (
              <>
                <div className="acc-big">
                  <div>
                    <span className="tiny muted bold">YOU</span>
                    <b className="green">{analysis.accuracy ?? '–'}</b>
                    <span className="tiny muted">accuracy</span>
                  </div>
                  <div>
                    <span className="tiny muted bold">{opp.name.toUpperCase().slice(0, 14)}</span>
                    <b>{analysis.oppAccuracy ?? '–'}</b>
                    <span className="tiny muted">accuracy</span>
                  </div>
                </div>
                <div className="count-grid">
                  <div>
                    <b className="mark inaccuracy" style={{ fontSize: 20 }}>{analysis.counts.inaccuracy}</b>
                    <span className="tiny muted">Inaccuracies</span>
                  </div>
                  <div>
                    <b className="mark mistake" style={{ fontSize: 20 }}>{analysis.counts.mistake}</b>
                    <span className="tiny muted">Mistakes</span>
                  </div>
                  <div>
                    <b className="mark blunder" style={{ fontSize: 20 }}>{analysis.counts.blunder}</b>
                    <span className="tiny muted">Blunders</span>
                  </div>
                </div>
                {curMark && ply > 0 && (
                  <div className="ctx-box">
                    <b>{data.moves[ply - 1].san}</b> is{' '}
                    <span className={`mark ${curMark}`} style={{ fontSize: 14 }}>
                      {curMark === 'best' ? 'the best move' : `a${curMark === 'inaccuracy' ? 'n' : ''} ${MARK_TEXT[curMark].toLowerCase()}`}
                    </span>
                    {curMark !== 'best' && analysis.evals[ply - 1]?.[2] && (
                      <>
                        . Best was <b className="green">{uciToSan(data.fens[ply - 1], analysis.evals[ply - 1][2])}</b>
                      </>
                    )}
                    {whiteScore && <span className="muted"> · eval {formatScore(whiteScore)}</span>}
                  </div>
                )}
              </>
            ) : (
              <div className="ctx-box">
                {isAnalyzing ? (
                  <>🤖 Stockfish is reviewing this game right now…</>
                ) : (
                  <>
                    This game hasn't been analyzed yet.
                    <button className="btn primary block" style={{ marginTop: 10 }} disabled={analyzer.running} onClick={() => startAnalysis([game.id])}>
                      {analyzer.running ? 'Analysis queue busy…' : 'Analyze this game'}
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="moves" ref={moveListRef}>
              <table>
                <tbody>
                  {rows.map(([i, w, b]) => (
                    <tr key={i}>
                      <td className="num">{i / 2 + 1}.</td>
                      <td>{moveCell(w, i)}</td>
                      <td>{moveCell(b, i + 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="side-foot nav-btns">
            <button className="btn" onClick={() => go(0)}>⏮</button>
            <button className="btn" onClick={() => go(ply - 1)}>◀</button>
            <button className="btn" onClick={() => go(ply + 1)}>▶</button>
            <button className="btn" onClick={() => go(data.moves.length)}>⏭</button>
          </div>
          <div className="side-foot" style={{ borderTop: 0, paddingTop: 0 }}>
            <a className="btn sm ghost block" href={game.url} target="_blank" rel="noreferrer">
              Open on Chess.com ↗
            </a>
          </div>
        </div>
      </div>
      <p className="tiny muted center" style={{ marginTop: 10 }}>
        Tip: use ← → arrow keys to step through moves. You play as {myColor === 'w' ? 'White' : 'Black'}.
      </p>
    </>
  );
}
