// Stockfish (WASM) running in a Web Worker, with a simple serial job queue.
let worker = null;
let ready = null;
const queue = [];
let current = null;

function boot() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    const script = typeof WebAssembly === 'object' ? 'engine/stockfish.wasm.js' : 'engine/stockfish.js';
    try {
      worker = new Worker(script);
    } catch (e) {
      reject(e);
      return;
    }
    let booted = false;
    worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : '';
      if (!booted) {
        if (line === 'readyok') {
          booted = true;
          resolve();
        }
        return;
      }
      handleLine(line);
    };
    worker.onerror = (err) => reject(err);
    worker.postMessage('uci');
    worker.postMessage('setoption name Hash value 32');
    worker.postMessage('isready');
  });
  return ready;
}

function handleLine(line) {
  if (!current) return;
  if (line.startsWith('info') && line.includes(' pv ')) {
    const mpv = /multipv (\d+)/.exec(line);
    const idx = mpv ? +mpv[1] - 1 : 0;
    const depth = +(/ depth (\d+)/.exec(line)?.[1] || 0);
    const cp = / score cp (-?\d+)/.exec(line);
    const mate = / score mate (-?\d+)/.exec(line);
    const pv = line.split(' pv ')[1].trim().split(' ');
    current.lines[idx] = { depth, cp: cp ? +cp[1] : null, mate: mate ? +mate[1] : null, pv };
  } else if (line.startsWith('bestmove')) {
    const best = line.split(' ')[1];
    const job = current;
    current = null;
    const lines = job.lines.filter(Boolean);
    if (!lines.length) {
      // No legal moves (mate / stalemate) or nothing searched.
      job.resolve({ bestmove: best === '(none)' ? null : best, cp: null, mate: null, pv: [], lines: [] });
    } else {
      job.resolve({ bestmove: best === '(none)' ? null : best, ...lines[0], lines });
    }
    pump();
  }
}

function pump() {
  if (current || !queue.length) return;
  current = queue.shift();
  current.lines = [];
  worker.postMessage(`setoption name MultiPV value ${current.multipv}`);
  worker.postMessage(`position fen ${current.fen}`);
  worker.postMessage(current.movetime ? `go depth ${current.depth} movetime ${current.movetime}` : `go depth ${current.depth}`);
}

/**
 * Evaluate a position. Score is from the side-to-move's point of view.
 * @returns {Promise<{bestmove, cp, mate, pv, lines}>}
 */
export async function analyze(fen, { depth = 12, multipv = 1, movetime = 0, priority = false } = {}) {
  await boot();
  return new Promise((resolve, reject) => {
    const job = { fen, depth, multipv, movetime, resolve, reject };
    if (priority) queue.unshift(job);
    else queue.push(job);
    pump();
  });
}

/** Drop every queued job (the running one finishes quickly). */
export function clearQueue() {
  while (queue.length) queue.pop().resolve(null);
  if (current) worker?.postMessage('stop');
}

/** Win probability (0-100) for the side to move, lichess formula. */
export function winPct(score) {
  if (!score) return 50;
  if (score.mate != null) return score.mate > 0 ? 100 : 0;
  const cp = Math.max(-1000, Math.min(1000, score.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Convert a score to a single comparable number (mates become huge). */
export function scoreValue(score) {
  if (!score) return 0;
  if (score.mate != null) return score.mate > 0 ? 100000 - score.mate * 100 : -100000 - score.mate * 100;
  return score.cp ?? 0;
}

export function formatScore(score, flip = false) {
  if (!score) return '0.0';
  const s = flip ? -1 : 1;
  if (score.mate != null) {
    const n = Math.abs(Math.round(score.mate));
    if (n === 0) return '#';
    return `${score.mate * s > 0 ? '' : '-'}M${n}`;
  }
  const v = ((score.cp ?? 0) * s) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}
