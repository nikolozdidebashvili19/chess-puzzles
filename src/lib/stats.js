// Aggregate insights from a list of games.
export function wdl(games) {
  const r = { win: 0, draw: 0, loss: 0, total: games.length };
  games.forEach((g) => r[g.outcome]++);
  r.score = r.total ? Math.round(((r.win + r.draw / 2) / r.total) * 100) : 0;
  return r;
}

export function byKey(games, keyFn) {
  const map = new Map();
  for (const g of games) {
    const k = keyFn(g);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(g);
  }
  return [...map.entries()].map(([k, list]) => ({ key: k, ...wdl(list), games: list }));
}

export function openingTable(games, color) {
  return byKey(games.filter((g) => !color || g.color === color), (g) => g.opening)
    .filter((o) => o.key !== 'Unknown opening')
    .sort((a, b) => b.total - a.total);
}

export function terminationBreakdown(games) {
  const lost = games.filter((g) => g.outcome === 'loss');
  const won = games.filter((g) => g.outcome === 'win');
  const label = {
    checkmated: 'Checkmated',
    resigned: 'Resigned',
    timeout: 'Lost on time',
    abandoned: 'Abandoned',
  };
  const lossBy = byKey(lost, (g) => label[g.myResult] || 'Other').sort((a, b) => b.total - a.total);
  const winBy = byKey(won, (g) => label[g.oppResult]?.replace('Lost on time', 'Won on time').replace('Checkmated', 'Checkmate').replace('Resigned', 'Opponent resigned') || 'Other').sort((a, b) => b.total - a.total);
  return { lossBy, winBy };
}

export function ratingSeries(games, timeClass) {
  return games
    .filter((g) => g.timeClass === timeClass && g.rated)
    .map((g) => ({ t: g.end * 1000, r: g.myRating }))
    .sort((a, b) => a.t - b.t);
}

export function bestWin(games) {
  return games.filter((g) => g.outcome === 'win' && g.rated).sort((a, b) => b.opp.rating - a.opp.rating)[0] || null;
}

export function streaks(games) {
  const sorted = [...games].sort((a, b) => a.end - b.end);
  let best = 0;
  let cur = 0;
  for (const g of sorted) {
    if (g.outcome === 'win') best = Math.max(best, ++cur);
    else cur = 0;
  }
  return { bestWinStreak: best, currentWinStreak: cur };
}

/** Low-time behaviour: % of losses where you had under 10% of your starting clock. */
export function timeTrouble(games) {
  const losses = games.filter((g) => g.outcome === 'loss' && g.clocks?.length > 4);
  if (!losses.length) return null;
  let low = 0;
  for (const g of losses) {
    const start = g.clocks[0];
    const mine = g.clocks.filter((_, i) => (i % 2 === 0) === (g.color === 'white'));
    const last = mine[mine.length - 1];
    if (start && last != null && last < start * 0.1) low++;
  }
  return Math.round((low / losses.length) * 100);
}

export const TIME_CLASSES = [
  { key: 'rapid', label: 'Rapid', stat: 'chess_rapid', icon: '⏱️' },
  { key: 'blitz', label: 'Blitz', stat: 'chess_blitz', icon: '⚡' },
  { key: 'bullet', label: 'Bullet', stat: 'chess_bullet', icon: '🔫' },
  { key: 'daily', label: 'Daily', stat: 'chess_daily', icon: '☀️' },
];

export function timeAgo(ms) {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.round(mo / 12)}y ago`;
}
