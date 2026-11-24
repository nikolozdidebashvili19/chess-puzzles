// Themed puzzles from the Lichess puzzle database (public API, CC0 data).
import { Chess } from 'chess.js';
import { isConcrete } from './explain.js';

export const THEMES = [
  { key: 'mix', label: 'Mate & Material', icon: '🎲', desc: 'Checkmates and winning pieces, mixed' },
  { key: 'mateIn1', label: 'Mate in 1', icon: '♚', desc: 'Deliver checkmate in one move' },
  { key: 'mateIn2', label: 'Mate in 2', icon: '♛', desc: 'Checkmate in two moves' },
  { key: 'mateIn3', label: 'Mate in 3', icon: '♜', desc: 'Checkmate in three moves' },
  { key: 'mateIn4', label: 'Mate in 4', icon: '♝', desc: 'Long forced mating attacks' },
  { key: 'fork', label: 'Forks', icon: '🍴', desc: 'Attack two pieces at once' },
  { key: 'pin', label: 'Pins', icon: '📌', desc: 'Pin a piece to something bigger' },
  { key: 'skewer', label: 'Skewers', icon: '🗡️', desc: 'Attack through a valuable piece' },
  { key: 'discoveredAttack', label: 'Discovered Attack', icon: '💥', desc: 'Move one piece to unleash another' },
  { key: 'hangingPiece', label: 'Hanging Pieces', icon: '🎁', desc: 'Grab undefended material' },
  { key: 'sacrifice', label: 'Sacrifices', icon: '🔥', desc: 'Give material to win big' },
  { key: 'deflection', label: 'Deflection', icon: '↪️', desc: 'Lure a defender away' },
  { key: 'backRankMate', label: 'Back Rank', icon: '🏰', desc: 'Exploit a weak back rank' },
  { key: 'endgame', label: 'Endgames', icon: '♙', desc: 'Convert winning endgames' },
  { key: 'opening', label: 'Opening Traps', icon: '📖', desc: 'Punish early mistakes' },
  { key: 'trappedPiece', label: 'Trapped Pieces', icon: '🪤', desc: 'Hunt down a piece with no escape' },
  { key: 'capturingDefender', label: 'Remove the Defender', icon: '🎯', desc: 'Take the guard, win what it guarded' },
  { key: 'promotion', label: 'Promotion', icon: '👑', desc: 'Push the pawn home' },
];

export function themeLabel(key) {
  return THEMES.find((t) => t.key === key)?.label || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/** Lichess `difficulty` is relative to 1500 for anonymous users. Map our rating onto it. */
export function difficultyFor(rating) {
  if (rating < 1000) return 'easiest';
  if (rating < 1350) return 'easier';
  if (rating < 1700) return 'normal';
  if (rating < 2000) return 'harder';
  return 'hardest';
}

function toPuzzle(p) {
  const c = new Chess();
  const moves = p.game.pgn.split(' ');
  for (const m of moves) c.move(m);
  const hist = c.history({ verbose: true });
  const last = hist[hist.length - 1];
  return {
    id: `li:${p.puzzle.id}`,
    source: 'lichess',
    fen: c.fen(),
    // solution[0] is the player's move, then alternating replies.
    solution: p.puzzle.solution,
    rating: p.puzzle.rating,
    themes: p.puzzle.themes,
    lastMove: last ? [last.from, last.to] : null,
    link: `https://lichess.org/training/${p.puzzle.id}`,
  };
}

// "Mixed" alternates Lichess's varied mix with checkmate-only batches (extra mates).
const MIX_ANGLES = ['mix', 'mate'];
let mixIdx = 0;

/** Fetch puzzles, keeping only clear missions: checkmate or winning at least a piece. */
export async function fetchPuzzleBatch(theme = 'mix', difficulty = 'normal', nb = 20, { concrete = true } = {}) {
  if (theme === 'mix' || theme === 'mixMate') theme = MIX_ANGLES[mixIdx++ % MIX_ANGLES.length];
  const res = await fetch(`https://lichess.org/api/puzzle/batch/${encodeURIComponent(theme)}?nb=${nb}&difficulty=${difficulty}`);
  if (res.status === 429) throw new Error('Puzzle server is busy — wait a minute and try again.');
  if (!res.ok) throw new Error(`Could not load puzzles (${res.status})`);
  const data = await res.json();
  const list = (data.puzzles || []).map(toPuzzle);
  return concrete ? list.filter((p) => isConcrete(p, 3)) : list;
}
