// Turns a game into per-move evaluations, move classifications and puzzles.
import { Chess } from 'chess.js';
import { analyze, scoreValue, winPct } from './engine.js';

export const ANALYSIS_VERSION = 3;

const SCAN_DEPTH = 12;
const VERIFY_DEPTH = 15;

export function replay(game) {
  const chess = new Chess(game.initialFen || undefined);
  const fens = [chess.fen()];
  const moves = [];
  for (const tok of game.moves.split(' ')) {
    if (!tok || /^\d+\.$/.test(tok) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
    let m;
    try {
      m = chess.move(tok.replace(/[?!]+$/, ''));
    } catch {
      break;
    }
    moves.push({ san: m.san, uci: m.from + m.to + (m.promotion || ''), from: m.from, to: m.to, color: m.color, captured: m.captured, piece: m.piece });
    fens.push(chess.fen());
  }
  return { fens, moves };
}

export function classify(drop) {
  if (drop >= 30) return 'blunder';
  if (drop >= 20) return 'mistake';
  if (drop >= 10) return 'inaccuracy';
  return null;
}

function terminalScore(fen) {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { cp: null, mate: 0, bestmove: null, pv: [] };
  if (c.isGameOver()) return { cp: 0, mate: null, bestmove: null, pv: [] };
  return null;
}

function phaseOf(fen, ply) {
  const board = fen.split(' ')[0];
  const majorsMinors = (board.match(/[qrbnQRBN]/g) || []).length;
  const queens = (board.match(/[qQ]/g) || []).length;
  if (ply < 20 && majorsMinors >= 12) return 'opening';
  if (majorsMinors <= 6 || (queens === 0 && majorsMinors <= 8)) return 'endgame';
  return 'middlegame';
}

function uciToSan(fen, uci) {
  try {
    const c = new Chess(fen);
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' }).san;
  } catch {
    return uci;
  }
}

/** Accuracy formula (lichess style) from per-move win% drops. */
function accuracyFromDrops(drops) {
  if (!drops.length) return null;
  const accs = drops.map((d) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * d) - 3.1669)));
  return Math.round((accs.reduce((a, b) => a + b, 0) / accs.length) * 10) / 10;
}

/**
 * Full analysis of one game.
 * @param shouldStop () => boolean — lets the caller cancel mid-game.
 */
export async function analyzeGame(game, { shouldStop = () => false } = {}) {
  const { fens, moves } = replay(game);
  const evals = [];
  for (let i = 0; i < fens.length; i++) {
    if (shouldStop()) return null;
    const term = terminalScore(fens[i]);
    if (term) {
      evals.push(term);
      continue;
    }
    const r = await analyze(fens[i], { depth: SCAN_DEPTH, movetime: 220 });
    if (!r) return null; // queue was cleared
    evals.push({ cp: r.cp, mate: r.mate, bestmove: r.bestmove, pv: r.pv.slice(0, 6) });
  }

  const myColor = game.color[0];
  const marks = [];
  const myDrops = [];
  const oppDrops = [];
  for (let i = 0; i < moves.length; i++) {
    const before = winPct(evals[i]);
    const after = 100 - winPct(evals[i + 1]);
    const drop = Math.max(0, before - after);
    const best = evals[i].bestmove;
    const isBest = best === moves[i].uci;
    (moves[i].color === myColor ? myDrops : oppDrops).push(isBest ? 0 : drop);
    let kind = isBest ? 'best' : classify(drop);
    // Missed a forced mate but still winning → call it a mistake, not a blunder.
    if (kind === 'blunder' && after > 80) kind = 'mistake';
    marks.push(kind);
  }

  // Build puzzles from moments where you missed a checkmate or a chance to win material.
  const puzzles = [];
  for (let i = 0; i < moves.length; i++) {
    if (shouldStop()) return null;
    if (moves[i].color !== myColor || i < 6) continue;
    const bestS = evals[i];
    const afterS = invert(evals[i + 1]);
    if (!bestS.bestmove || bestS.bestmove === moves[i].uci) continue;
    const missedMate = bestS.mate != null && bestS.mate > 0 && !(afterS?.mate > 0);
    const cpLoss = scoreValue(bestS) - scoreValue(afterS);
    const serious = marks[i] === 'blunder' || marks[i] === 'mistake';
    // Missing a free piece while already winning barely moves win%, so also check raw centipawns.
    if (!(missedMate || serious || cpLoss >= 250)) continue;
    const before = winPct(bestS);
    if (before < 30 && !missedMate) continue; // already lost, not instructive

    const deep = await analyze(fens[i], { depth: VERIFY_DEPTH, multipv: 2, movetime: 1500 });
    if (!deep || !deep.bestmove || deep.bestmove === moves[i].uci) continue;
    const deepMissedMate = deep.mate != null && deep.mate > 0 && !(afterS?.mate > 0);
    if (!deepMissedMate && scoreValue(deep) - scoreValue(afterS) < 200) continue; // deeper search says it was fine

    const line = await buildLine(fens[i], deep, shouldStop);
    if (!line) return null;
    const { solution, stepScores, mated, finalFen } = line;

    // Net material won: after the line AND the opponent's best answer (so recaptures count),
    // measured from before the opponent's last move (so a simple recapture isn't "winning a piece").
    let netGain = 0;
    if (!mated) {
      const r = await analyze(finalFen, { depth: 12, movetime: 500 });
      const tail = r?.pv?.slice(0, 2) || [];
      const end = Math.min(materialAfter(finalFen, [], myColor), materialAfter(finalFen, tail, myColor));
      netGain = end - materialAfter(fens[i - 1], [], myColor);
    }
    const goalKind = mated ? 'mate' : netGain >= 2 ? 'material' : null;
    if (!goalKind) continue; // no clear mission: skip it

    const refutePv = evals[i + 1].pv || [];
    const prev = moves[i - 1];
    const themes = [phaseOf(fens[i], i), goalKind === 'mate' ? 'missedMate' : 'missedMaterial'];
    puzzles.push({
      v: ANALYSIS_VERSION,
      id: `my:${game.id}:${i}`,
      source: 'mine',
      fen: fens[i],
      solution,
      stepScores,
      goalKind,
      netGain: mated ? undefined : netGain,
      refutation: sanLine(fens[i + 1], refutePv.slice(0, 3)),
      lostByPlayed: -(materialAfter(fens[i + 1], refutePv.slice(0, 4), myColor) - materialAfter(fens[i], [], myColor)),
      scoreBefore: { cp: deep.cp, mate: deep.mate },
      scoreAfter: afterS,
      lastMove: prev ? [prev.from, prev.to] : null,
      played: moves[i].uci,
      playedSan: moves[i].san,
      bestSan: uciToSan(fens[i], deep.bestmove),
      kind: marks[i] === 'blunder' ? 'blunder' : 'mistake',
      bestScore: { cp: deep.cp, mate: deep.mate },
      rating: Math.max(600, Math.min(2600, (game.myRating || 1200) + solution.length * 40)),
      themes,
      gameId: game.id,
      gameUrl: game.url,
      opp: game.opp,
      date: game.end,
      moveNumber: Math.floor(i / 2) + 1,
      color: game.color,
    });
  }

  return {
    v: ANALYSIS_VERSION,
    evals: evals.map((e) => [e.cp, e.mate, e.bestmove]),
    marks,
    accuracy: accuracyFromDrops(myDrops),
    oppAccuracy: accuracyFromDrops(oppDrops),
    counts: countMarks(marks, moves, myColor),
    puzzles,
  };
}

const MAT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function applyUci(chess, uci) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
}

/** Material balance for `color` after playing `ucis` from `fen`. */
function materialAfter(fen, ucis, color) {
  const c = new Chess(fen);
  try {
    for (const u of ucis) applyUci(c, u);
  } catch {
    /* PV may be cut short */
  }
  let s = 0;
  for (const row of c.board()) for (const p of row) if (p) s += (p.color === color[0] ? 1 : -1) * MAT[p.type];
  return s;
}

function sanLine(fen, ucis) {
  const c = new Chess(fen);
  const out = [];
  try {
    for (const u of ucis) out.push(applyUci(c, u).san);
  } catch {
    /* ignore */
  }
  return out;
}

function invert(e) {
  if (!e) return null;
  return { cp: e.cp == null ? null : -e.cp, mate: e.mate == null ? null : e.mate === 0 ? 0.0001 : -e.mate };
}

/**
 * Follow the engine's line while it stays forcing and the player's move is clearly
 * the only good one, so puzzles are 1–3 moves long like real tactics.
 */
async function buildLine(startFen, deep, shouldStop) {
  // Forced mate: use the whole mating line.
  if (deep.mate != null && deep.mate > 0 && deep.mate <= 5 && deep.pv.length >= deep.mate * 2 - 1) {
    const line = deep.pv.slice(0, deep.mate * 2 - 1);
    const c = new Chess(startFen);
    try {
      line.forEach((u) => applyUci(c, u));
      if (c.isCheckmate()) {
        return { solution: line, stepScores: line.filter((_, k) => k % 2 === 0).map((_, k) => ({ cp: null, mate: deep.mate - k })), mated: true, finalFen: c.fen() };
      }
    } catch {
      /* fall through */
    }
  }

  let chess = new Chess(startFen);
  const me = chess.turn();
  const startMat = materialAfter(startFen, [], me);
  const solution = [];
  const stepScores = [];
  let info = deep;
  for (let step = 0; step < 3; step++) {
    if (shouldStop()) return null;
    const best = info.bestmove;
    if (!best) break;
    solution.push(best);
    stepScores.push({ cp: info.cp, mate: info.mate });
    applyUci(chess, best);
    if (chess.isGameOver() || step === 2) break;

    const rep = await analyze(chess.fen(), { depth: 14, movetime: 700 });
    if (!rep?.bestmove) break;
    const afterReply = new Chess(chess.fen());
    applyUci(afterReply, rep.bestmove);
    if (afterReply.isGameOver()) break;
    const next = await analyze(afterReply.fen(), { depth: 14, multipv: 2, movetime: 1000 });
    if (!next?.bestmove) break;

    const gainNow = materialAfter(chess.fen(), [], me) - startMat;
    const nextSan = uciToSan(afterReply.fen(), next.bestmove);
    const forcing = /[x+#=]/.test(nextSan);
    const unique = (next.mate != null && next.mate > 0) || next.lines.length < 2 || winPct(next.lines[0]) - winPct(next.lines[1]) >= 15;
    // Continue only with a clearly-best follow-up that is forcing, or
    // when nothing has been won yet after a quiet first move.
    if (!unique || !(forcing || (gainNow < 1 && step === 0))) break;
    solution.push(rep.bestmove);
    chess = afterReply;
    info = next;
  }
  return { solution, stepScores, mated: chess.isCheckmate(), finalFen: chess.fen() };
}

function countMarks(marks, moves, myColor) {
  const out = { blunder: 0, mistake: 0, inaccuracy: 0, best: 0 };
  marks.forEach((m, i) => {
    if (moves[i].color === myColor && m && out[m] != null) out[m]++;
  });
  return out;
}

export { phaseOf, uciToSan };
