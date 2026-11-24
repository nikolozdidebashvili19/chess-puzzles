import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { analyze, winPct } from './engine.js';
import { playMoveSound, sfx } from './sound.js';

const GREEN = 'rgba(129, 182, 76, 0.75)';
const RED = 'rgba(236, 72, 72, 0.75)';
const HINT = 'rgba(80, 160, 255, 0.6)';

function applyUci(chess, uci) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
}

/**
 * Drives one puzzle.
 * status: 'playing' | 'opponent' | 'checking' | 'reverting' | 'wrong' | 'solved' | 'showing' | 'revealed'
 * onResult(solved, info) fires once — on the first miss or on solving.
 */
export function usePuzzle(puzzle, { onResult, mode = 'normal' } = {}) {
  const [fen, setFen] = useState(puzzle?.fen);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('playing');
  const [lastMove, setLastMove] = useState(puzzle?.lastMove || null);
  const [squareStyles, setSquareStyles] = useState({});
  const [arrows, setArrows] = useState([]);
  const [note, setNote] = useState(null);
  const reported = useRef(false);
  const timers = useRef([]);
  const chessRef = useRef(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    clearTimers();
    if (!puzzle) return;
    chessRef.current = new Chess(puzzle.fen);
    reported.current = false;
    setFen(puzzle.fen);
    setStep(0);
    setStatus('playing');
    setLastMove(puzzle.lastMove || null);
    setSquareStyles({});
    setArrows([]);
    setNote(null);
    return clearTimers;
  }, [puzzle?.id]);

  const report = useCallback((solved, info = {}) => {
    if (reported.current) return;
    reported.current = true;
    cbRef.current?.(solved, info);
  }, []);

  const playerColor = puzzle ? new Chess(puzzle.fen).turn() : 'w';
  const orientation = playerColor === 'w' ? 'white' : 'black';

  function finishSolved(extraNote) {
    setStatus('solved');
    setNote(extraNote || null);
    sfx.correct();
    report(true);
  }

  function opponentReply(nextStep) {
    const reply = puzzle.solution[nextStep];
    if (!reply) {
      finishSolved();
      return;
    }
    setStatus('opponent');
    later(() => {
      const m = applyUci(chessRef.current, reply);
      playMoveSound(m);
      setFen(chessRef.current.fen());
      setLastMove([m.from, m.to]);
      setSquareStyles({});
      setStep(nextStep + 1);
      if (nextStep + 1 >= puzzle.solution.length) finishSolved();
      else setStatus('playing');
    }, mode === 'sprint' ? 250 : 450);
  }

  function markWrong(m) {
    sfx.wrong();
    setSquareStyles({ [m.from]: { background: RED }, [m.to]: { background: RED } });
    setStatus('reverting');
    report(false);
    later(() => {
      chessRef.current.undo();
      setFen(chessRef.current.fen());
      setSquareStyles({});
      setStatus('wrong');
    }, 650);
  }

  const onMove = (from, to) => {
    if (!puzzle || (status !== 'playing' && status !== 'wrong')) return false;
    const chess = chessRef.current;
    const expected = puzzle.solution[step];
    const piece = chess.get(from);
    let promotion;
    if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
      promotion = expected && expected.slice(0, 4) === from + to ? expected[4] || 'q' : 'q';
    }
    const preFen = chess.fen();
    let m;
    try {
      m = chess.move({ from, to, promotion });
    } catch {
      return false;
    }
    playMoveSound(m);
    setFen(chess.fen());
    setLastMove([m.from, m.to]);
    const uci = m.from + m.to + (m.promotion || '');

    if (uci === expected || chess.isCheckmate()) {
      setSquareStyles({ [m.to]: { background: GREEN } });
      if (chess.isCheckmate() || step + 1 >= puzzle.solution.length) {
        finishSolved();
      } else {
        if (mode !== 'sprint') sfx.correct();
        opponentReply(step + 1);
      }
      return true;
    }

    // Puzzles from your own games: accept an equally good alternative at any step.
    const target = puzzle.stepScores?.[Math.floor(step / 2)] || (step === 0 ? puzzle.bestScore : null);
    if (puzzle.source === 'mine' && target && status === 'playing' && !(step === 0 && uci === puzzle.played)) {
      const expectedSan = (() => {
        try {
          const c = new Chess(preFen);
          return c.move({ from: expected.slice(0, 2), to: expected.slice(2, 4), promotion: expected[4] }).san;
        } catch {
          return expected;
        }
      })();
      setStatus('checking');
      analyze(chess.fen(), { depth: 13, priority: true }).then((r) => {
        const best = winPct(target);
        const alt = 100 - winPct(r);
        if (r && best - alt <= 6) {
          setSquareStyles({ [m.to]: { background: GREEN } });
          finishSolved(`That works too! The engine's top choice was ${expectedSan}.`);
        } else {
          markWrong(m);
        }
      });
      return true;
    }

    markWrong(m);
    return true;
  };

  const hint = () => {
    if (!puzzle || status === 'solved' || status === 'showing') return;
    const expected = puzzle.solution[step];
    if (!expected) return;
    report(false, { hint: true });
    setSquareStyles({ [expected.slice(0, 2)]: { background: HINT } });
  };

  const retry = () => {
    clearTimers();
    chessRef.current = new Chess(puzzle.fen);
    setFen(puzzle.fen);
    setStep(0);
    setLastMove(puzzle.lastMove || null);
    setSquareStyles({});
    setArrows([]);
    setNote(null);
    setStatus('playing');
  };

  const showSolution = () => {
    if (!puzzle) return;
    clearTimers();
    report(false, { revealed: true });
    const chess = new Chess(puzzle.fen);
    chessRef.current = chess;
    setFen(puzzle.fen);
    setLastMove(puzzle.lastMove || null);
    setSquareStyles({});
    setStatus('showing');
    puzzle.solution.forEach((uci, i) => {
      later(() => setArrows([[uci.slice(0, 2), uci.slice(2, 4), i % 2 === 0 ? 'rgba(129,182,76,.9)' : 'rgba(255,170,0,.8)']]), i * 1000 + 300);
      later(() => {
        const m = applyUci(chess, uci);
        playMoveSound(m);
        setFen(chess.fen());
        setLastMove([m.from, m.to]);
        setArrows([]);
        if (i === puzzle.solution.length - 1) setStatus('revealed');
      }, i * 1000 + 900);
    });
  };

  return { fen, orientation, playerColor, onMove, lastMove, squareStyles, arrows, status, note, hint, retry, showSolution, step };
}
