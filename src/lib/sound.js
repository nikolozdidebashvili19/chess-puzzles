// Synthesised UI sounds (no audio files needed).
import { getState } from './store.js';

let ctx = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function enabled() {
  return getState().progress?.settings?.sound !== false;
}

function knock(freq, dur, gain = 0.35, type = 'triangle', when = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, gain = 0.25, when = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1800;
  const g = a.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  move() {
    if (!enabled()) return;
    knock(420, 0.07, 0.3);
    noise(0.04, 0.2);
  },
  capture() {
    if (!enabled()) return;
    knock(300, 0.09, 0.4);
    noise(0.06, 0.35);
    noise(0.04, 0.2, 0.05);
  },
  check() {
    if (!enabled()) return;
    knock(660, 0.12, 0.25, 'square');
  },
  correct() {
    if (!enabled()) return;
    [523, 659, 784].forEach((f, i) => knock(f, 0.18, 0.18, 'sine', i * 0.07));
  },
  wrong() {
    if (!enabled()) return;
    knock(220, 0.25, 0.25, 'sawtooth');
    knock(180, 0.3, 0.2, 'sawtooth', 0.08);
  },
  start() {
    if (!enabled()) return;
    knock(392, 0.12, 0.2, 'sine');
    knock(587, 0.16, 0.2, 'sine', 0.09);
  },
  tick() {
    if (!enabled()) return;
    knock(1200, 0.03, 0.08, 'square');
  },
};

export function playMoveSound(move) {
  if (!move) return;
  if (move.san?.includes('+') || move.san?.includes('#')) sfx.check();
  else if (move.captured) sfx.capture();
  else sfx.move();
}
