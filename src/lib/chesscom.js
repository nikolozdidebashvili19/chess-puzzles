// Chess.com Published-Data API (public, read-only, no auth).
import { kvGet, kvSet } from './kv.js';

const BASE = 'https://api.chess.com/pub';

async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (res.status === 404) {
      const err = new Error('not-found');
      err.code = 404;
      throw err;
    }
    if (!res.ok) throw new Error(`Chess.com API error ${res.status}`);
    return res.json();
  }
  throw new Error('Chess.com is rate limiting requests, try again in a minute.');
}

export async function fetchProfile(username) {
  const u = username.trim().toLowerCase();
  const [profile, stats] = await Promise.all([
    getJson(`${BASE}/player/${encodeURIComponent(u)}`),
    getJson(`${BASE}/player/${encodeURIComponent(u)}/stats`).catch(() => ({})),
  ]);
  return { profile, stats };
}

/** Light-weight game record extracted from the API payload. */
function slimGame(g, me) {
  const meLower = me.toLowerCase();
  const color = g.white.username.toLowerCase() === meLower ? 'white' : 'black';
  const mine = g[color];
  const opp = g[color === 'white' ? 'black' : 'white'];
  let outcome = 'draw';
  if (mine.result === 'win') outcome = 'win';
  else if (['checkmated', 'resigned', 'timeout', 'abandoned', 'lose', 'kingofthehill', 'threecheck', 'bughousepartnerlose'].includes(mine.result)) outcome = 'loss';
  // Strip clock comments to save space, but keep clock times for time analysis.
  const pgn = g.pgn || '';
  const clocks = [...pgn.matchAll(/%clk (\d+):(\d+):(\d+(?:\.\d+)?)/g)].map((m) => +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]));
  const movesText = pgn.split(/\n\n/).slice(1).join(' ').replace(/\{[^}]*\}/g, '').replace(/\d+\.\.\./g, '').replace(/\s+/g, ' ').trim();
  return {
    id: g.uuid || g.url,
    url: g.url,
    end: g.end_time,
    timeClass: g.time_class,
    timeControl: g.time_control,
    rated: g.rated,
    rules: g.rules,
    color,
    outcome,
    myResult: mine.result,
    oppResult: opp.result,
    myRating: mine.rating,
    opp: { name: opp.username, rating: opp.rating },
    accuracy: g.accuracies ? g.accuracies[color] : null,
    opening: openingName(g.eco),
    initialFen: g.initial_setup,
    moves: movesText,
    clocks,
  };
}

export function openingName(ecoUrl) {
  if (!ecoUrl) return 'Unknown opening';
  const slug = decodeURIComponent(ecoUrl.split('/openings/')[1] || '');
  const name = slug.split(/\.\.\.|-\d/)[0].replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  return name || 'Unknown opening';
}

/**
 * Sync games for the last `months` months. Past months are cached forever,
 * the current month is always refreshed.
 */
export async function syncGames(username, { months = 6, onProgress } = {}) {
  const u = username.toLowerCase();
  const { archives = [] } = await getJson(`${BASE}/player/${encodeURIComponent(u)}/games/archives`);
  const wanted = archives.slice(-months);
  const all = [];
  for (let i = 0; i < wanted.length; i++) {
    const url = wanted[i];
    const isCurrent = i === wanted.length - 1;
    const cacheKey = `archive:${u}:${url.slice(-7)}`;
    let games = isCurrent ? null : await kvGet(cacheKey);
    if (!games) {
      const data = await getJson(url);
      games = (data.games || [])
        .filter((g) => g.rules === 'chess' && g.pgn)
        .map((g) => slimGame(g, u));
      await kvSet(cacheKey, games);
    }
    all.push(...games);
    onProgress?.((i + 1) / wanted.length);
  }
  all.sort((a, b) => b.end - a.end);
  return all;
}
