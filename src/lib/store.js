// App-wide state for the signed-in user (a tiny external store + React hook).
import { useSyncExternalStore } from 'react';
import { fetchProfile, syncGames } from './chesscom.js';
import { analyzeGame, ANALYSIS_VERSION } from './analyzer.js';
import { clearQueue } from './engine.js';
import { kvGet, kvSet, kvDel, lsGet, lsSet } from './kv.js';
import { updateRating } from './rating.js';

const SRS_DAYS = [0, 1, 3, 7, 14, 30, 60];

export const DEFAULT_SETTINGS = {
  dailyGoal: 10,
  analyzeCount: 30,
  sound: true,
  boardTheme: 'green',
  autoAnalyze: true,
  showCoords: true,
};

const initial = {
  user: null, // { username, profile, stats }
  games: [],
  syncing: false,
  syncProgress: 0,
  progress: null,
  myPuzzles: [],
  analysis: {},
  analyzer: { running: false, done: 0, total: 0, current: null },
  error: null,
  booting: true,
};

let state = initial;
const listeners = new Set();

function set(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
  );
}

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function freshProgress(stats) {
  const tactics = stats?.tactics?.highest?.rating;
  const rapid = stats?.chess_rapid?.last?.rating;
  const seed = tactics ? Math.max(600, tactics - 150) : rapid ? Math.max(600, rapid) : 1200;
  return {
    rating: seed,
    ratingHistory: [{ t: Date.now(), r: seed }],
    attempts: 0,
    solved: 0,
    failed: 0,
    streak: { current: 0, best: 0, lastDay: null },
    daily: { day: todayKey(), count: 0 },
    days: {}, // day -> puzzles done (for the activity calendar)
    srs: {}, // puzzleId -> { box, due, solved, failed, last }
    themes: {}, // theme -> { s, f }
    sprint: { best: 0, history: [] },
    settings: { ...DEFAULT_SETTINGS },
    createdAt: Date.now(),
  };
}

const key = (k) => `${k}:${state.user.username}`;

async function saveProgress() {
  if (state.user && state.progress) await kvSet(key('progress'), state.progress);
}

// ---------- accounts ----------

export function savedAccounts() {
  return lsGet('knightly.accounts', []);
}

function rememberAccount(profile) {
  const list = savedAccounts().filter((a) => a.username !== profile.username);
  list.unshift({ username: profile.username, avatar: profile.avatar || null, name: profile.name || null, title: profile.title || null, lastUsed: Date.now() });
  lsSet('knightly.accounts', list.slice(0, 12));
  lsSet('knightly.lastUser', profile.username);
}

export function forgetAccount(username) {
  lsSet('knightly.accounts', savedAccounts().filter((a) => a.username !== username));
  if (lsGet('knightly.lastUser') === username) lsSet('knightly.lastUser', null);
}

export async function login(rawUsername) {
  const username = rawUsername.trim().toLowerCase();
  if (!username) throw new Error('Enter your Chess.com username');
  let data;
  try {
    data = await fetchProfile(username);
  } catch (e) {
    if (e.code === 404) throw new Error(`No Chess.com account called "${rawUsername.trim()}"`);
    throw new Error('Could not reach Chess.com. Check your connection and try again.');
  }
  const { profile, stats } = data;
  stopAnalysis();
  const [progress, myPuzzles, analysis] = await Promise.all([
    kvGet(`progress:${username}`),
    kvGet(`puzzles:${username}`),
    kvGet(`analysis:${username}`),
  ]);
  const prog = progress || freshProgress(stats);
  prog.settings = { ...DEFAULT_SETTINGS, ...(prog.settings || {}) };
  rollDay(prog);
  rememberAccount(profile);
  set({
    user: { username, profile, stats },
    progress: prog,
    // Older analysis versions made weaker puzzles: drop them so games get re-analyzed.
    myPuzzles: (myPuzzles || []).filter((p) => p.v === ANALYSIS_VERSION),
    analysis: Object.fromEntries(Object.entries(analysis || {}).filter(([, a]) => a.v === ANALYSIS_VERSION)),
    games: [],
    error: null,
    booting: false,
  });
  await kvSet(`progress:${username}`, prog);
  refreshGames();
}

export function logout() {
  stopAnalysis();
  lsSet('knightly.lastUser', null);
  set({ ...initial, booting: false });
}

export async function resume() {
  const last = lsGet('knightly.lastUser', null);
  if (!last) {
    set({ booting: false });
    return;
  }
  try {
    await login(last);
  } catch {
    set({ booting: false });
  }
}

export async function resetProgress() {
  const fresh = freshProgress(state.user.stats);
  fresh.settings = state.progress.settings;
  set({ progress: fresh });
  await saveProgress();
}

export async function clearAnalysis() {
  stopAnalysis();
  set({ analysis: {}, myPuzzles: [] });
  await Promise.all([kvDel(key('analysis')), kvDel(key('puzzles'))]);
}

// ---------- games ----------

export async function refreshGames() {
  if (!state.user || state.syncing) return;
  const username = state.user.username;
  set({ syncing: true, syncProgress: 0 });
  try {
    const [games, fresh] = await Promise.all([
      syncGames(username, { months: 6, onProgress: (p) => set({ syncProgress: p }) }),
      fetchProfile(username).catch(() => null),
    ]);
    if (state.user?.username !== username) return;
    set((s) => ({ games, syncing: false, user: fresh ? { ...s.user, ...fresh } : s.user }));
    if (state.progress.settings.autoAnalyze) startAnalysis();
  } catch (e) {
    set({ syncing: false, error: e.message });
  }
}

// ---------- background analysis ----------

let runId = 0;

export async function startAnalysis(gameIds = null) {
  if (!state.user || state.analyzer.running) return;
  const username = state.user.username;
  const count = state.progress.settings.analyzeCount;
  const todo = gameIds
    ? state.games.filter((g) => gameIds.includes(g.id) && !state.analysis[g.id])
    : state.games.slice(0, count).filter((g) => !state.analysis[g.id]);
  if (!todo.length) return;
  const myRun = ++runId;
  const cancelled = () => myRun !== runId || state.user?.username !== username;
  set({ analyzer: { running: true, done: 0, total: todo.length, current: todo[0].id } });
  for (let i = 0; i < todo.length; i++) {
    const g = todo[i];
    set((s) => ({ analyzer: { ...s.analyzer, done: i, current: g.id } }));
    let result = null;
    try {
      result = await analyzeGame(g, { shouldStop: cancelled });
    } catch (e) {
      console.warn('analysis failed', g.url, e);
    }
    if (cancelled()) return;
    if (!result) continue;
    const { puzzles, ...summary } = result;
    const known = new Set(state.myPuzzles.map((p) => p.id));
    const myPuzzles = [...state.myPuzzles, ...puzzles.filter((p) => !known.has(p.id))];
    const analysis = { ...state.analysis, [g.id]: summary };
    set({ analysis, myPuzzles });
    await Promise.all([kvSet(`analysis:${username}`, analysis), kvSet(`puzzles:${username}`, myPuzzles)]);
  }
  set((s) => ({ analyzer: { ...s.analyzer, running: false, done: s.analyzer.total, current: null } }));
}

export function stopAnalysis() {
  if (!state.analyzer.running) return;
  runId++;
  clearQueue();
  set((s) => ({ analyzer: { ...s.analyzer, running: false, current: null } }));
}

// ---------- training progress ----------

function rollDay(prog) {
  const today = todayKey();
  if (prog.daily.day !== today) prog.daily = { day: today, count: 0 };
  // Break the streak if a full day was skipped.
  if (prog.streak.lastDay) {
    const diff = Math.round((new Date(today) - new Date(prog.streak.lastDay)) / 86400000);
    if (diff > 1) prog.streak = { ...prog.streak, current: 0 };
  }
}

/** Record a puzzle attempt. Returns the rating delta. */
export function recordAttempt(puzzle, solved, { rated = true } = {}) {
  const prog = structuredClone(state.progress);
  rollDay(prog);
  const today = todayKey();
  let delta = 0;
  if (rated) {
    const r = updateRating(prog.rating, puzzle.rating || prog.rating, solved, prog.attempts);
    delta = r.delta;
    prog.rating = r.rating;
    prog.ratingHistory.push({ t: Date.now(), r: r.rating });
    if (prog.ratingHistory.length > 500) prog.ratingHistory = prog.ratingHistory.slice(-500);
  }
  prog.attempts++;
  solved ? prog.solved++ : prog.failed++;
  prog.daily.count++;
  prog.days[today] = (prog.days[today] || 0) + 1;
  if (prog.streak.lastDay !== today) {
    prog.streak.current = (prog.streak.current || 0) + 1;
    prog.streak.best = Math.max(prog.streak.best, prog.streak.current);
    prog.streak.lastDay = today;
  }
  for (const t of puzzle.themes || []) {
    const ts = prog.themes[t] || { s: 0, f: 0 };
    solved ? ts.s++ : ts.f++;
    prog.themes[t] = ts;
  }
  if (puzzle.source === 'mine') {
    const card = prog.srs[puzzle.id] || { box: 0, solved: 0, failed: 0 };
    if (solved) {
      card.box = Math.min(SRS_DAYS.length - 1, card.box + 1);
      card.solved++;
    } else {
      card.box = 0;
      card.failed++;
    }
    card.last = Date.now();
    card.due = Date.now() + (solved ? SRS_DAYS[card.box] * 86400000 : 10 * 60000);
    prog.srs[puzzle.id] = card;
  }
  set({ progress: prog });
  saveProgress();
  return delta;
}

export function recordSprint(score) {
  const prog = structuredClone(state.progress);
  const isBest = score > (prog.sprint.best || 0);
  prog.sprint.best = Math.max(prog.sprint.best || 0, score);
  prog.sprint.history = [...(prog.sprint.history || []), { t: Date.now(), score }].slice(-100);
  set({ progress: prog });
  saveProgress();
  return isBest;
}

export function updateSettings(patch) {
  const prog = { ...state.progress, settings: { ...state.progress.settings, ...patch } };
  set({ progress: prog });
  saveProgress();
}

/** Puzzles from your games that are due for review, most urgent first. */
export function dueMistakes(s = state) {
  const now = Date.now();
  return s.myPuzzles
    .filter((p) => {
      const c = s.progress?.srs[p.id];
      return !c || c.due <= now;
    })
    .sort((a, b) => {
      const ca = s.progress.srs[a.id];
      const cb = s.progress.srs[b.id];
      // Failed-before first, then never seen (newest games first), then the rest.
      const rank = (c) => (!c ? 1 : c.box === 0 ? 0 : 2);
      return rank(ca) - rank(cb) || b.date - a.date;
    });
}
