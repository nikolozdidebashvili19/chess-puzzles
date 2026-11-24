// Turns a puzzle (fen + solution line) into a human explanation:
// a goal to show before solving, and a move-by-move breakdown afterwards.
import { Chess } from 'chess.js';

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const FILES = 'abcdefgh';

export const THEME_INFO = {
  fork: ['Fork', 'One piece attacks two (or more) enemy pieces at the same time. Your opponent can only save one of them.'],
  pin: ['Pin', 'A piece can\'t move because a more valuable piece (often the king) is standing behind it on the same line.'],
  skewer: ['Skewer', 'Like a pin in reverse: a valuable piece is attacked, and when it moves away, the piece behind it falls.'],
  discoveredAttack: ['Discovered attack', 'Moving one piece out of the way unleashes an attack from the piece behind it — two threats in one move.'],
  discoveredCheck: ['Discovered check', 'A piece steps aside and reveals check from the piece behind it, so it can go anywhere — even attack something else.'],
  doubleCheck: ['Double check', 'Two pieces give check at once. The only legal reply is to move the king.'],
  hangingPiece: ['Hanging piece', 'An enemy piece is undefended (or not defended enough) — just take it.'],
  sacrifice: ['Sacrifice', 'You deliberately give up material to get something bigger: a mating attack or more material back.'],
  deflection: ['Deflection', 'Force a defending piece away from the square or piece it is guarding.'],
  attraction: ['Attraction', 'Lure an enemy piece (often the king) onto a bad square where it can be attacked.'],
  clearance: ['Clearance', 'Move a piece out of the way to open a line or square for another piece.'],
  interference: ['Interference', 'Put a piece between an enemy piece and what it is defending.'],
  intermezzo: ['In-between move', 'Instead of the expected recapture, first play a stronger forcing move.'],
  trappedPiece: ['Trapped piece', 'An enemy piece has no safe squares — attack it and it\'s lost.'],
  xRayAttack: ['X-ray', 'A piece attacks or defends through another piece on the same line.'],
  zugzwang: ['Zugzwang', 'Your opponent would love to pass, but every move makes their position worse.'],
  quietMove: ['Quiet move', 'A calm move without check or capture that sets up an unstoppable threat.'],
  defensiveMove: ['Defensive move', 'The only move that keeps you from losing material or getting mated.'],
  backRankMate: ['Back-rank mate', 'The king is trapped on its back rank by its own pawns, and a rook or queen delivers mate.'],
  smotheredMate: ['Smothered mate', 'A knight mates a king that is surrounded by its own pieces.'],
  promotion: ['Promotion', 'Push a pawn to the last rank to make a new queen (or another piece).'],
  advancedPawn: ['Advanced pawn', 'A far-advanced pawn is the key — it\'s about to promote or ties down defenders.'],
  exposedKing: ['Exposed king', 'The enemy king has little shelter, so checks and attacks come quickly.'],
  kingsideAttack: ['Kingside attack', 'An attack against a king that has castled short.'],
  queensideAttack: ['Queenside attack', 'An attack against a king that has castled long.'],
  capturingDefender: ['Remove the defender', 'Capture the piece that protects something important — then win what it was guarding.'],
  mate: ['Checkmate', 'The king is attacked and has no way to escape.'],
};

const sqName = (f, r) => `${FILES[f]}${r + 1}`;

function material(chess, color) {
  let s = 0;
  for (const row of chess.board()) for (const p of row) if (p) s += (p.color === color ? 1 : -1) * VAL[p.type];
  return s;
}

/** Enemy pieces attacked by the piece standing on `sq`. */
function targetsOf(chess, sq) {
  const me = chess.get(sq);
  if (!me) return [];
  const out = [];
  for (const row of chess.board())
    for (const p of row) {
      if (!p || p.color === me.color) continue;
      if (chess.attackers(p.square, me.color).includes(sq)) out.push(p);
    }
  return out;
}

function isDefended(chess, sq, color) {
  return chess.attackers(sq, color).length > 0;
}

/** Pin / skewer along the lines of a slider on `sq`. */
function lineTactic(chess, sq) {
  const piece = chess.get(sq);
  if (!piece || !'brq'.includes(piece.type)) return null;
  const dirs = [];
  if (piece.type !== 'b') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
  if (piece.type !== 'r') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  const f0 = FILES.indexOf(sq[0]);
  const r0 = +sq[1] - 1;
  for (const [df, dr] of dirs) {
    let f = f0 + df;
    let r = r0 + dr;
    let first = null;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const here = sqName(f, r);
      const got = chess.get(here);
      const p = got ? { ...got, square: here } : null;
      if (p) {
        if (p.color === piece.color) break;
        if (!first) first = p;
        else {
          const v1 = first.type === 'k' ? 100 : VAL[first.type];
          const v2 = p.type === 'k' ? 100 : VAL[p.type];
          if (first.type !== 'p' && v2 > v1 && v2 > VAL[piece.type] - 1) return { kind: 'pin', front: first, back: p };
          if (v1 > v2 && first.type !== 'p' && p.type !== 'p') return { kind: 'skewer', front: first, back: p };
          break;
        }
      }
      f += df;
      r += dr;
    }
  }
  return null;
}

const pn = (p) => `${NAME[p.type]} on ${p.square}`;

/** What would this side do next if the opponent passed? (mate threat or a big capture) */
function threatAfter(chess, side) {
  const parts = chess.fen().split(' ');
  if (parts[1] === side) return null;
  parts[1] = side;
  parts[3] = '-';
  let c;
  try {
    c = new Chess(parts.join(' '));
  } catch {
    return null;
  }
  const moves = c.moves({ verbose: true });
  for (const m of moves) {
    c.move(m);
    const mate = c.isCheckmate();
    c.undo();
    if (mate) return { kind: 'mate', san: m.san };
  }
  const opp = side === 'w' ? 'b' : 'w';
  let best = null;
  for (const m of moves) {
    if (!m.captured) continue;
    const gain = VAL[m.captured] - (isDefended(c, m.to, opp) ? VAL[m.piece] : 0);
    if (gain >= 3 && (!best || gain > best.gain)) best = { kind: 'win', san: m.san, gain, piece: m.captured };
  }
  return best;
}

/** Main entry: returns { goal, steps, motifs, summary, gain }. */
export function explainPuzzle(puzzle) {
  const chess = new Chess(puzzle.fen);
  const me = chess.turn();
  const sideName = me === 'w' ? 'White' : 'Black';
  const startMat = material(chess, me);
  const steps = [];
  const motifs = new Set();
  let mated = false;
  let userMoves = 0;

  puzzle.solution.forEach((uci, idx) => {
    const mover = chess.turn();
    const mine = mover === me;
    const legalBefore = chess.moves().length;
    const moveNo = +chess.fen().split(' ')[5];
    let m;
    try {
      m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    } catch {
      return;
    }
    const notes = [];
    if (mine) {
      userMoves++;
      if (chess.isCheckmate()) {
        notes.push('checkmate!');
        mated = true;
        motifs.add('mate');
      } else {
        const opp = mover === 'w' ? 'b' : 'w';
        const kingSq = chess.board().flat().find((p) => p && p.type === 'k' && p.color === opp)?.square;
        const checkers = kingSq ? chess.attackers(kingSq, mover) : [];
        if (checkers.length >= 2) {
          notes.push('double check — the king must move');
          motifs.add('doubleCheck');
        } else if (checkers.length === 1 && checkers[0] !== m.to) {
          notes.push(`discovered check from the ${NAME[chess.get(checkers[0]).type]} on ${checkers[0]}`);
          motifs.add('discoveredCheck');
        } else if (checkers.length === 1) notes.push('check');

        const targets = targetsOf(chess, m.to).filter((p) => p.type === 'k' || VAL[p.type] >= 3);
        const valuable = targets.filter((p) => p.type === 'k' || VAL[p.type] > VAL[m.piece] || !isDefended(chess, p.square, opp));
        if (targets.length >= 2 && valuable.length >= 1) {
          notes.push(`the ${NAME[m.piece]} attacks the ${targets.map(pn).join(' and the ')} at once (fork)`);
          motifs.add('fork');
        }
        const line = lineTactic(chess, m.to);
        if (line?.kind === 'pin') {
          notes.push(`pins the ${pn(line.front)} to the ${NAME[line.back.type]}`);
          motifs.add('pin');
        } else if (line?.kind === 'skewer' && checkers.length) {
          notes.push(`skewer: the ${NAME[line.front.type]} must move and the ${pn(line.back)} falls`);
          motifs.add('skewer');
        }
        if (m.captured) {
          const defended = isDefended(chess, m.to, opp);
          if (!defended) {
            notes.push(`wins the ${NAME[m.captured]} for free`);
            if (idx === 0) motifs.add('hangingPiece');
          } else if (VAL[m.captured] > VAL[m.piece]) notes.push(`wins the ${NAME[m.captured]} for a ${NAME[m.piece]}`);
          else notes.push(`takes the ${NAME[m.captured]}`);
        }
        // Sacrifice: the moved piece can be taken and it's worth more than what was captured.
        const reply = puzzle.solution[idx + 1];
        const follow = puzzle.solution[idx + 2];
        const takenBack = reply && reply.slice(2, 4) === m.to;
        const recapture = follow && follow.slice(2, 4) === m.to;
        if (!chess.isCheckmate() && m.piece !== 'p' && takenBack && !recapture && VAL[m.piece] > (VAL[m.captured] || 0) + 1) {
          notes.push(`a ${NAME[m.piece]} sacrifice`);
          motifs.add('sacrifice');
        }
        if (m.promotion) {
          notes.push(`promotes to a ${NAME[m.promotion]}`);
          motifs.add('promotion');
        }
        if (checkers.length === 0 && !chess.isCheckmate()) {
          const threat = threatAfter(chess, mover);
          if (threat?.kind === 'mate') {
            notes.push(`threatens ${threat.san} checkmate — your opponent must deal with it`);
            motifs.add('quietMove');
          } else if (threat?.kind === 'win' && !m.captured) {
            notes.push(`threatens ${threat.san}, winning the ${NAME[threat.piece]}`);
          }
        }
        if (!notes.length) notes.push(idx === 0 ? 'sets up the winning idea' : 'continuing the attack');
      }
    } else {
      // opponent reply
      if (legalBefore === 1) notes.push('forced — the only legal move');
      else if (m.captured) notes.push(`takes the ${NAME[m.captured]}`);
      else notes.push('the best defence');
    }
    steps.push({ san: m.san, mine, moveNo, white: mover === 'w', notes });
  });

  // Puzzles from your games carry the net gain after the opponent's best recapture.
  const gain = puzzle.netGain ?? material(chess, me) - startMat;
  const themes = new Set(puzzle.themes || []);
  for (const k of ['deflection', 'attraction', 'clearance', 'interference', 'intermezzo', 'trappedPiece', 'xRayAttack', 'zugzwang', 'quietMove', 'defensiveMove', 'backRankMate', 'smotheredMate', 'capturingDefender', 'discoveredAttack', 'exposedKing', 'advancedPawn']) {
    if (themes.has(k)) motifs.add(k);
  }
  for (const k of ['fork', 'pin', 'skewer', 'sacrifice', 'hangingPiece']) if (themes.has(k)) motifs.add(k);

  // ---- goal (shown before solving) ----
  let goal;
  const mateN = [...themes].find((t) => /^mateIn\d$/.test(t));
  const n = mated ? userMoves : mateN ? +mateN.slice(-1) : userMoves;
  const inN = `in ${n} move${n > 1 ? 's' : ''}`;
  const howTo =
    n > 1
      ? `You have ${n} moves; your opponent's best replies are played for you. Start with forcing moves: checks, captures and threats.`
      : 'One move does it. Look at every check and capture first.';
  if (mated || mateN) {
    goal = { kind: 'mate', icon: '♚', title: `Checkmate in ${n}`, text: `${sideName} to play and force checkmate ${inN}. ${howTo}` };
  } else if (gain >= 8) {
    goal = { kind: 'queen', icon: '💎', title: `Win the queen ${inN}`, text: `${sideName} to play and win the enemy queen. ${howTo}` };
  } else if (gain >= 5) {
    goal = { kind: 'rook', icon: '🏰', title: `Win a rook ${inN}`, text: `${sideName} to play and win a whole rook. ${howTo}` };
  } else if (gain >= 3) {
    goal = { kind: 'piece', icon: '⚔️', title: `Win a piece ${inN}`, text: `${sideName} to play and win a knight or bishop (or more). ${howTo}` };
  } else if (gain === 2) {
    goal = { kind: 'exchange', icon: '⚖️', title: `Win the exchange ${inN}`, text: `${sideName} to play and win a rook for a knight or bishop. ${howTo}` };
  } else if (gain === 1) {
    goal = { kind: 'pawn', icon: '♟', title: `Win a pawn ${inN}`, text: `${sideName} to play and win a pawn safely. ${howTo}` };
  } else {
    goal = { kind: 'other', icon: '🎯', title: `Find the best move`, text: `${sideName} to play.` };
  }
  goal.moves = n;

  // ---- summary (after solving) ----
  let summary;
  if (mated) summary = `Mission accomplished: forced checkmate in ${userMoves}.`;
  else if (gain >= 1) summary = `Mission accomplished: ${sideName} ends up ${gain} point${gain > 1 ? 's' : ''} of material ahead (pawn = 1, knight/bishop = 3, rook = 5, queen = 9).`;
  else if (motifs.has('sacrifice')) summary = 'The material you give up is worth it — the attack is decisive.';
  else summary = 'This keeps a big advantage.';

  return { goal, steps, motifs: [...motifs].filter((k) => THEME_INFO[k]), summary, gain, userMoves };
}

/** True for puzzles with a clear, concrete mission (mate or winning real material). */
export function isConcrete(puzzle, minGain = 3) {
  const ex = explainPuzzle(puzzle);
  return ex.goal.kind === 'mate' || ex.gain >= minGain;
}
