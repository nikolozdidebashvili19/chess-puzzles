import { useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useStore } from '../lib/store.js';

export const BOARD_THEMES = {
  green: { dark: '#739552', light: '#ebecd0', name: 'Green' },
  brown: { dark: '#b58863', light: '#f0d9b5', name: 'Wood' },
  blue: { dark: '#8ca2ad', light: '#dee3e6', name: 'Ice' },
  purple: { dark: '#8877b7', light: '#efefef', name: 'Purple' },
  night: { dark: '#4b648a', light: '#9fb0c8', name: 'Night' },
};

const LAST = 'rgba(255, 255, 51, 0.42)';
const SELECT = 'rgba(255, 255, 51, 0.55)';

/**
 * Board with drag + click-to-move, legal move dots, last move / check highlights.
 * onMove(from, to) should return true if the move was accepted.
 */
export default function Board({
  fen,
  orientation = 'white',
  onMove,
  interactive = true,
  lastMove = null,
  squareStyles = {},
  arrows = [],
  id = 'board',
  maxWidth = 720,
}) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(480);
  const [selected, setSelected] = useState(null);
  const settings = useStore((s) => s.progress?.settings);
  const theme = BOARD_THEMES[settings?.boardTheme] || BOARD_THEMES.green;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.floor(Math.min(el.clientWidth, maxWidth));
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxWidth]);

  useEffect(() => setSelected(null), [fen]);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);

  const turn = chess?.turn();

  const targets = useMemo(() => {
    if (!chess || !selected) return [];
    return chess.moves({ square: selected, verbose: true });
  }, [chess, selected]);

  const styles = useMemo(() => {
    const s = {};
    if (lastMove) {
      s[lastMove[0]] = { background: LAST };
      s[lastMove[1]] = { background: LAST };
    }
    if (chess?.inCheck()) {
      const king = chess
        .board()
        .flat()
        .find((p) => p && p.type === 'k' && p.color === chess.turn());
      if (king) s[king.square] = { background: 'radial-gradient(circle, rgba(255,0,0,.85) 0%, rgba(231,0,0,.5) 45%, rgba(169,0,0,0) 75%)' };
    }
    if (selected) s[selected] = { ...(s[selected] || {}), background: SELECT };
    for (const m of targets) {
      s[m.to] = {
        ...(s[m.to] || {}),
        backgroundImage: m.captured
          ? 'radial-gradient(circle, transparent 0%, transparent 79%, rgba(0,0,0,.16) 80%)'
          : 'radial-gradient(circle, rgba(0,0,0,.16) 0%, rgba(0,0,0,.16) 24%, transparent 26%)',
        cursor: 'pointer',
      };
    }
    for (const [sq, st] of Object.entries(squareStyles)) s[sq] = { ...(s[sq] || {}), ...st };
    return s;
  }, [lastMove, chess, selected, targets, squareStyles]);

  function tryMove(from, to) {
    if (!interactive || !onMove) return false;
    const ok = onMove(from, to);
    setSelected(null);
    return !!ok;
  }

  function onSquareClick(square) {
    if (!interactive || !chess) return;
    const piece = chess.get(square);
    if (selected) {
      if (targets.some((m) => m.to === square)) {
        tryMove(selected, square);
        return;
      }
      if (piece && piece.color === turn && square !== selected) {
        setSelected(square);
        return;
      }
      setSelected(null);
      return;
    }
    if (piece && piece.color === turn) setSelected(square);
  }

  return (
    <div className="board-wrap" ref={wrap}>
      <Chessboard
        id={id}
        position={fen}
        boardWidth={width}
        boardOrientation={orientation}
        arePiecesDraggable={interactive}
        isDraggablePiece={({ piece }) => interactive && piece[0] === turn}
        onPieceDragBegin={(_, sq) => setSelected(sq)}
        onPieceDrop={(from, to) => tryMove(from, to)}
        onSquareClick={onSquareClick}
        autoPromoteToQueen
        customSquareStyles={styles}
        customArrows={arrows}
        customArrowColor="rgba(255,170,0,0.8)"
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        customLightSquareStyle={{ backgroundColor: theme.light }}
        customBoardStyle={{ borderRadius: '4px', boxShadow: '0 6px 24px rgba(0,0,0,.45)' }}
        showBoardNotation={settings?.showCoords !== false}
        animationDuration={180}
      />
    </div>
  );
}
