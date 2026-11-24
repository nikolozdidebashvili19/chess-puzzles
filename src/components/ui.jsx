import { useEffect, useMemo, useState } from 'react';

export function Avatar({ src, name = '?', size = 40 }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img className="avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} onError={() => setBroken(true)} />;
  }
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {name[0]?.toUpperCase()}
    </span>
  );
}

export function PlayerName({ name, title }) {
  return (
    <span>
      {title && <span className="title-tag">{title}</span>}
      {name}
    </span>
  );
}

export function Ring({ value, max, size = 92, stroke = 9, color = 'var(--green)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#3a3835" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .6s' }}
        />
      </svg>
      <div className="inner">{children}</div>
    </div>
  );
}

export function Bar({ value, max = 1, color }) {
  return (
    <div className="bar">
      <div style={{ width: `${Math.max(0, Math.min(100, (value / (max || 1)) * 100))}%`, background: color }} />
    </div>
  );
}

export function WdlBar({ win, draw, loss }) {
  const t = win + draw + loss || 1;
  return (
    <div className="wdl-bar" title={`${win}W / ${draw}D / ${loss}L`}>
      <div className="w" style={{ width: `${(win / t) * 100}%` }} />
      <div className="d" style={{ width: `${(draw / t) * 100}%` }} />
      <div className="l" style={{ width: `${(loss / t) * 100}%` }} />
    </div>
  );
}

/** Minimal responsive line chart. points: [{t, r}] */
export function LineChart({ points, height = 170, color = '#81b64c' }) {
  const data = useMemo(() => points.filter((p) => p.r != null), [points]);
  const [hover, setHover] = useState(null);
  if (data.length < 2) return <div className="empty small">Not enough data yet</div>;
  const W = 600;
  const H = height;
  const pad = { l: 38, r: 8, t: 10, b: 20 };
  const minR = Math.min(...data.map((p) => p.r));
  const maxR = Math.max(...data.map((p) => p.r));
  const lo = Math.floor((minR - 20) / 50) * 50;
  const hi = Math.ceil((maxR + 20) / 50) * 50;
  const t0 = data[0].t;
  const t1 = data[data.length - 1].t || t0 + 1;
  const x = (t) => pad.l + ((t - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r);
  const y = (r) => pad.t + (1 - (r - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const path = data.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.r).toFixed(1)}`).join(' ');
  const area = `${path} L${x(t1)},${H - pad.b} L${x(t0)},${H - pad.b} Z`;
  const ticks = [];
  const step = Math.max(50, Math.round((hi - lo) / 4 / 50) * 50);
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const fmt = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const tx = t0 + (((e.clientX - rect.left) / rect.width) * W - pad.l) / (W - pad.l - pad.r) * (t1 - t0);
          let best = data[0];
          for (const p of data) if (Math.abs(p.t - tx) < Math.abs(best.t - tx)) best = p;
          setHover(best);
        }}
      >
        <defs>
          <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.06)" vectorEffect="non-scaling-stroke" />
            <text x={pad.l - 6} y={y(v) + 4} fill="#8b8987" fontSize="11" textAnchor="end">{v}</text>
          </g>
        ))}
        <path d={area} fill="url(#lc-fill)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover && <circle cx={x(hover.t)} cy={y(hover.r)} r="4" fill="#fff" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        <text x={pad.l} y={H - 4} fill="#8b8987" fontSize="11">{fmt(t0)}</text>
        <text x={W - pad.r} y={H - 4} fill="#8b8987" fontSize="11" textAnchor="end">{fmt(t1)}</text>
      </svg>
      {hover && (
        <div className="pill" style={{ position: 'absolute', top: 0, right: 0 }}>
          {hover.r} · {fmt(hover.t)}
        </div>
      )}
    </div>
  );
}

/** GitHub-style activity grid for the last ~20 weeks. */
export function ActivityCalendar({ days, weeks = 20 }) {
  const cells = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1) - ((today.getDay() + 6) % 7 === 6 ? 0 : 0));
  // align to Monday
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const n = days[k] || 0;
    const bg = n === 0 ? '#3a3835' : n < 5 ? '#4a6a2f' : n < 10 ? '#6a9a3e' : n < 20 ? '#81b64c' : '#a3d160';
    cells.push(<div key={k} style={{ background: bg }} title={`${k}: ${n} puzzles`} />);
  }
  return <div className="calendar">{cells}</div>;
}

export function Confetti({ fire }) {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!fire) return;
    const colors = ['#81b64c', '#f6c544', '#5d9fe8', '#fa412d', '#b089e8', '#fff'];
    setPieces(
      Array.from({ length: 90 }, (_, i) => ({
        id: `${fire}-${i}`,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2 + Math.random() * 1.8,
        color: colors[i % colors.length],
        rot: Math.random() * 360,
      })),
    );
    const t = setTimeout(() => setPieces([]), 4500);
    return () => clearTimeout(t);
  }, [fire]);
  if (!pieces.length) return null;
  return (
    <div className="confetti">
      {pieces.map((p) => (
        <i key={p.id} style={{ left: `${p.left}%`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}

export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message]);
  return message ? <div className="toast">{message}</div> : null;
}

export function Spinner({ label }) {
  return (
    <div className="empty">
      <div className="spinner" />
      {label && <p>{label}</p>}
    </div>
  );
}
