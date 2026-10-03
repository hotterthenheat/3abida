/*
  WHAT STANDS ON A CHART (components/layout/footer/parts/field.ts) — Terrain's strike field (beads by strike, its walls,
  the flip), Paper's orders (the entry, the take-profit, the stop, each run out to its tag), the alerts' lines (a bell at
  the end of each; the line sounds when the price crosses it), and the backtest's replay (a past day's candles drawn as the
  play head reaches them, and the scrubber under them).
*/

import { FONT, PIX, box, chip, clock, dashes, frame, hair, keep, rgb, rng, type, walk, type Box, type Frame, type Part, type Pen, type Pill, type Stage } from '../kit';
import type { Chart } from './chart';

/* ---- THE STRIKE FIELD (Terrain): a row of beads at each strike, longest where the book is heaviest, in the side's ink;
   the walls bright, the supreme in its magenta, the flip a grey line of dashes — and their chips at the pane's edge -- */

export const field = (ch: Chart, o: { seed?: number; gap?: number } = {}): Part => {
  let s: Stage | null = null;
  let strikes: { y: number; len: number; put: boolean; wall: boolean; supreme: boolean; segs: [number, number][] }[] = [];
  let flipY = 0;
  let flipSegs: [number, number][] = [];
  return {
    place(_b, st) {
      s = st;
      const p = ch.pane();
      const gap = o.gap ?? (st.phone ? 11 : 13);
      const r = rng(o.seed ?? 909);
      const n = Math.floor((p.y1 - p.y0 - 30) / gap);
      const heavy = [Math.floor(n * 0.22), Math.floor(n * 0.71)];
      const supreme = Math.floor(n * 0.46);
      strikes = Array.from({ length: n }, (_, i) => {
        const wall = heavy.includes(i);
        const near = 1 - Math.abs(i - n * 0.48) / (n * 0.6);
        const len = (p.x1 - p.x0) * (wall ? 0.7 + r() * 0.2 : i === supreme ? 0.58 : Math.max(0.06, near * (0.14 + r() * 0.42)));
        return { y: Math.round(p.y0 + 24 + i * gap), len, put: i > n * 0.48, wall, supreme: i === supreme, segs: [] };
      });
      flipY = Math.round(p.y0 + 24 + (n * 0.48 + 0.5) * gap);
      flipSegs = dashes(r, p.x0, p.x1, 10, 4, 8);
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      const p = ch.pane();
      for (const k of strikes) {
        const hue = k.supreme ? ink.supreme : k.put ? ink.warn : ink.glacier;
        /* the beads: a row of them along the strike from the pane's right edge, fading as they reach back — a band of
           light at the strike, as Terrain's chart wears it */
        const from = p.x1 - 4 - k.len;
        const strong = k.wall || k.supreme;
        for (let x = p.x1 - 6; x > from; x -= 5) {
          const fade = 1 - (p.x1 - 6 - x) / (k.len + 1);
          if (!keep(b, strong ? 0.85 : 0.3 + 0.5 * fade)) continue;
          c.fillStyle = rgb(hue, (strong ? 1 : 0.7) * (0.3 + 0.7 * fade));
          c.fillRect(x, k.y - (strong ? 2 : 1), sharp ? 3 : 4, strong ? 4 : 2);
        }
        /* a wall's line runs on under the words, faint */
        if (k.wall) {
          c.fillStyle = rgb(hue, sharp ? 0.22 : 0.3);
          if (sharp) c.fillRect(0, k.y - 0.5, p.x0, 1);
          else for (let x = b.r() * 40; x < p.x0 - 4; x += 30 + b.r() * 90) if (b.r() < 0.5) c.fillRect(x, k.y - 1, 6 + b.r() * 26, 2);
        }
        if ((k.wall || k.supreme) && (p.x1 - p.x0) > 220) {
          const word = k.supreme ? 'supreme' : k.put ? 'put wall' : 'call wall';
          c.font = `600 8.5px ${FONT}`;
          const w = c.measureText(word).width + 14;
          chip(b, p.x1 - w - 8, k.y - 9, w, { fill: rgb(ink.panel, 0.9), edge: rgb(hue, 0.8), word, wordInk: rgb(hue), h: 13 });
        }
      }
      /* the flip: grey dashes across the pane, its word at the right */
      c.fillStyle = rgb(ink.flip, sharp ? 0.7 : 0.75);
      if (sharp) {
        for (let x = p.x0; x < p.x1; x += 6) c.fillRect(x, flipY, 3, 1);
      } else for (const [a, e] of flipSegs) if (b.r() < 0.5) c.fillRect(a, flipY - 1, e - a, 2);
      type(b, 'flip', p.x1 - 26, flipY - 6, { size: 8, hue: ink.flip, share: 0.5 });
    },
  };
};

/* ---- PAPER'S ORDERS: the entry (a held contract, run out to its tag), the take-profit above it, the stop below — and
   the paper money's two chips, the made and the open -------------------------------------------------------------- */

export const orders = (ch: Chart): Part => {
  let s: Stage | null = null;
  let entry = 0;
  let tp = 0;
  let sl = 0;
  let up = true;
  return {
    place(_b, st) {
      s = st;
      const [lt, lb] = ch.band();
      entry = Math.round(lt + (lb - lt) * 0.55);
      tp = Math.round(lt + (lb - lt) * 0.08);
      sl = Math.round(lb + (lb - lt) * 0.18);
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      const p = ch.pane();
      const line = (y: number, hue: string, dotted: boolean, word: string) => {
        c.fillStyle = rgb(hue, sharp ? 0.85 : 0.8);
        if (dotted) {
          for (let xx = p.x0; xx < p.x1; xx += sharp ? 4 : 7) if (keep(b, 0.55)) c.fillRect(xx, y - (sharp ? 0.5 : 1), sharp ? 2 : 3, sharp ? 1 : 2);
        } else hair(b, p.x0, p.x1, y, dashes(rng(y), p.x0, p.x1, 18), 0.6);
        /* its tag at the pane's right edge, and the box that closes it */
        c.font = `600 8.5px ${FONT}`;
        const w = c.measureText(word).width + 12;
        const tx = p.x1 - w - 22;
        if (keep(b, 0.7)) {
          c.fillStyle = rgb(hue, sharp ? 0.9 : 0.85);
          c.fillRect(tx, y - 7, w, 14);
          type(b, word, tx + 6, y + 0.5, { size: 8.5, hue: ink.panel, share: 0.6 });
          c.strokeStyle = rgb(ink.muted, 0.7);
          c.lineWidth = 1;
          if (sharp) c.strokeRect(tx + w + 2.5, y - 6.5, 13, 13);
        }
      };
      line(tp, ink.bull, true, 'TP');
      line(sl, ink.red, true, 'SL');
      line(entry, ink.line, false, '1 × call');
      /* the made and the open: two chips top left (their figures gone to the dark) */
      chip(b, p.x0 + 8, p.y0 + 30, 44, { edge: rgb(ink.muted, 0.7), word: 'RP&L', wordInk: rgb(ink.line, 0.85), h: 14 });
    },
    tick(f) {
      up = ch.headY(f.t) <= entry;
    },
    live: () => {
      const p = ch.pane();
      return box(p.x0 + 56, p.y0 + 20, p.x0 + 110, p.y0 + 40);
    },
    /* the open money's chip: green while the price stands above the entry, red below */
    moving(pen: Pen) {
      if (!s) return;
      const p = ch.pane();
      const { c } = pen;
      c.fillStyle = pen.ink(up ? s.ink.bull : s.ink.red, 0.9);
      c.beginPath();
      c.roundRect(p.x0 + 58, p.y0 + 23, 46, 14, 3);
      c.fill();
      if (pen.fringe) return;
      c.font = `600 8.5px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.fillStyle = rgb(s.ink.panel);
      c.fillText('UP&L', p.x0 + 65, p.y0 + 30.5);
    },
    sharp(c) {
      if (!s) return;
      const p = ch.pane();
      c.fillStyle = rgb(up ? s.ink.bull : s.ink.red);
      c.beginPath();
      c.roundRect(p.x0 + 58, p.y0 + 23, 46, 14, 3);
      c.fill();
      c.font = `600 8.5px ${FONT}`;
      c.textBaseline = 'middle';
      c.fillStyle = rgb(s.ink.panel);
      c.fillText('UP&L', p.x0 + 65, p.y0 + 30.5);
    },
  };
};

/* ---- THE ALERTS' LINES: a dashed line with a bell at its end; when the price crosses one it sounds — a ring where it
   crossed, the line lit, and a card in the corner saying so ------------------------------------------------------- */

export const bell = (c: CanvasRenderingContext2D, x: number, y: number, style: string, sharp: boolean) => {
  c.fillStyle = style;
  c.beginPath();
  c.moveTo(x - 4, y + 3);
  c.quadraticCurveTo(x - 4, y - 5, x, y - 5);
  c.quadraticCurveTo(x + 4, y - 5, x + 4, y + 3);
  c.closePath();
  c.fill();
  c.fillRect(x - 5, y + 3, 10, sharp ? 1.2 : 2);
  c.fillRect(x - 1, y + 4.5, 2, 2);
};

export const alertLines = (ch: Chart, o: { toast?: boolean; count?: number } = {}): Part => {
  let s: Stage | null = null;
  let levels: { y: number; hue: 'warn' | 'silver' | 'moon'; word: string }[] = [];
  let prev = NaN;
  let fired: { y: number; x: number; at: number; i: number } | null = null;
  let now = 0;
  let toastAt: Box = box(0, 0, 0, 0);
  const RING = 1100;
  const TOAST = 2600;
  return {
    place(_b, st) {
      s = st;
      const [lt, lb] = ch.band();
      levels = (
        [
          { y: Math.round(lt + (lb - lt) * (o.count === 1 ? 0.5 : 0.28)), hue: 'warn', word: 'crosses' },
          { y: Math.round(lt + (lb - lt) * 0.6), hue: 'silver', word: 'above' },
          { y: Math.round(lt + (lb - lt) * 0.86), hue: 'moon', word: 'below' },
        ] as const
      ).slice(0, o.count ?? 3).map(l => ({ ...l }));
      const p = ch.pane();
      toastAt = box(p.x1 - 150, p.y0 + 8, p.x1 - 8, p.y0 + 44);
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      const p = ch.pane();
      levels.forEach(l => {
        c.fillStyle = rgb(ink[l.hue], sharp ? 0.75 : 0.8);
        for (let x = p.x0; x < p.x1 - 18; x += sharp ? 7 : 9) if (keep(b, 0.5)) c.fillRect(x, l.y - (sharp ? 0.5 : 1), sharp ? 4 : 5, sharp ? 1 : 2);
        if (keep(b, 0.75)) bell(c, p.x1 - 8, l.y - 1, rgb(ink[l.hue], 0.95), sharp);
        type(b, l.word, p.x0 + 6, l.y - 7, { size: 7.5, hue: ink[l.hue], share: 0.35 });
      });
    },
    tick(f) {
      if (!s) return;
      now = f.t;
      const y = ch.headY(f.t);
      if (!Number.isNaN(prev) && f.dt > 0)
        levels.forEach((l, i) => {
          if ((prev - l.y) * (y - l.y) < 0 && (!fired || now - fired.at > 900)) fired = { y: l.y, x: ch.head(), at: now, i };
        });
      prev = y;
    },
    live: () => {
      const p = ch.pane();
      return box(p.x0, p.y0, p.x1 + 30, p.y1);
    },
    moving(pen: Pen) {
      if (!s || !fired) return;
      const age = now - fired.at;
      const { c } = pen;
      const l = levels[fired.i];
      if (age < RING) {
        /* the ring where it crossed, and the line lit along its length */
        const q = age / RING;
        c.strokeStyle = pen.ink(s.ink.warn, 1 - q);
        c.lineWidth = 2.4;
        c.beginPath();
        c.arc(fired.x, fired.y, 4 + q * 26, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = pen.ink(s.ink[l.hue], (1 - q) * 0.9);
        const p = ch.pane();
        c.fillRect(p.x0, l.y - 1, p.x1 - p.x0 - 18, 2);
      }
      if (o.toast !== false && age < TOAST) {
        /* the card in the corner: a bell, the name and what it did, the moment */
        const a = Math.min(1, age / 160, (TOAST - age) / 300);
        const t = toastAt;
        c.fillStyle = pen.ink(s.ink.panel, 0.92 * a);
        if (!pen.fringe) c.fillRect(t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0);
        c.strokeStyle = pen.ink(s.ink.warn, 0.9 * a);
        c.lineWidth = 2;
        c.strokeRect(t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0);
        bell(c, t.x0 + 14, t.y0 + 18, pen.ink(s.ink.warn, a), false);
        c.fillStyle = pen.ink(s.ink.line, 0.85 * a);
        c.fillRect(t.x0 + 26, t.y0 + 12, 54, 3);
        c.fillStyle = pen.ink(s.ink.secondary, 0.7 * a);
        c.fillRect(t.x0 + 26, t.y0 + 22, 80, 2);
      }
    },
    sharp(c, f) {
      if (!s || !fired) return;
      const age = now - fired.at;
      const l = levels[fired.i];
      if (age < RING) {
        const q = age / RING;
        c.strokeStyle = rgb(s.ink.warn, 1 - q);
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(fired.x, fired.y, 4 + q * 26, 0, Math.PI * 2);
        c.stroke();
      }
      if (o.toast !== false && age < TOAST) {
        const a = Math.min(1, age / 160, (TOAST - age) / 300);
        const t = toastAt;
        c.fillStyle = rgb(s.ink.panel, 0.95 * a);
        c.beginPath();
        c.roundRect(t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0, 6);
        c.fill();
        c.strokeStyle = rgb(s.ink.warn, 0.8 * a);
        c.lineWidth = 1;
        c.stroke();
        bell(c, t.x0 + 14, t.y0 + 18, rgb(s.ink.warn, a), true);
        c.font = `600 9px ${FONT}`;
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        c.fillStyle = rgb(s.ink.line, a);
        c.fillText(`SPY ${l.word}`, t.x0 + 26, t.y0 + 13);
        c.font = `500 8.5px ${FONT}`;
        c.fillStyle = rgb(s.ink.secondary, a);
        c.fillText(`sounded ${clock(f.wall - age, false)}`, t.x0 + 26, t.y0 + 26);
      }
    },
  };
};

/* ---- THE BACKTEST'S REPLAY: a past day's candles, drawn up to the play head as it moves along, a target and a stop on
   it, and the scrubber under it — the day's hours, the head, the replay's own clock ------------------------------- */

const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;
/** a replayed minute's time, as the scrubber says it */
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

export const replay = (o: { seed?: number; cycle?: number } = {}): Part => {
  const wk = walk(o.seed ?? 5150, { step: 1, gap: 4, kick: 1.6 });
  const CYCLE = o.cycle ?? 26000;
  let s: Stage | null = null;
  let pane: Box = box(0, 0, 0, 0);
  let track = { x0: 0, x1: 0, y: 0 };
  let card: Box = box(0, 0, 0, 0);
  let lt = 0;
  let lb = 0;
  let q = 0.42;
  const K = 3;
  const playX = () => pane.x0 + (pane.x1 - pane.x0) * q;
  const minute = () => OPEN_MIN + (CLOSE_MIN - OPEN_MIN) * q;
  /* the day's candles to the head: the walk stands still (a past day), only the head moves */
  const draw = (c: CanvasRenderingContext2D, ink: (h: string, a?: number) => string, sharp: boolean, from = -Infinity, to = Infinity) => {
    if (!s) return;
    const st = wk.steps;
    const hx = playX();
    const bw = Math.floor((K * wk.GAP - 2) / PIX) * PIX;
    for (let j = 0; j + K <= st.length; j += K) {
      const x = pane.x0 + 4 + (j / K) * (K * wk.GAP);
      if (x > hx || x > pane.x1 - 4) break;
      if (x < from - bw || x > to + bw) continue;
      const open = st[j].val;
      const close = st[j + K - 1].val;
      let hi = Math.max(open, close);
      let lo = Math.min(open, close);
      for (let i = j; i < j + K; i++) {
        hi = Math.max(hi, st[i].val + Math.abs(st[i].jit) * 0.5);
        lo = Math.min(lo, st[i].val - Math.abs(st[i].jit) * 0.5);
      }
      const up = close >= open;
      c.fillStyle = ink(up ? s.ink.line : s.ink.blue, up ? 1 : 0.9);
      const cx = sharp ? Math.round(x) : Math.round(x / PIX) * PIX;
      const yh = wk.yOf(hi);
      const yl = wk.yOf(lo);
      c.fillRect(cx - (sharp ? 0.5 : 1), yh, sharp ? 1 : 2, Math.max(1, yl - yh));
      c.fillRect(cx - bw / 2, Math.min(wk.yOf(open), wk.yOf(close)), bw, Math.max(sharp ? 1 : 2, Math.abs(wk.yOf(close) - wk.yOf(open))));
    }
  };
  const headVal = () => {
    const i = Math.min(wk.steps.length - 1, Math.max(0, Math.floor(((playX() - pane.x0 - 4) / (K * wk.GAP)) * K + K - 1)));
    return wk.yOf(wk.steps[i].val);
  };
  return {
    place(b, st) {
      s = st;
      const sh = st.phone ? 46 : 64;
      pane = box(b.x0, b.y0, b.x1 - 64, b.y1 - sh - 10);
      lt = pane.y0 + (pane.y1 - pane.y0) * 0.1;
      lb = pane.y0 + (pane.y1 - pane.y0) * 0.86;
      /* the whole day at once: as many steps as the pane holds (a still walk — the past does not move) */
      wk.place(pane.x0, pane.x0 + (pane.x1 - pane.x0) * 1.0, lt, lb, 0);
      card = box(b.x0 + (b.x1 - b.x0) * (st.phone ? 0 : 0.12), b.y1 - sh, b.x1 - (st.phone ? 0 : (b.x1 - b.x0) * 0.22), b.y1);
      track = { x0: card.x0 + (st.phone ? 60 : 130), x1: card.x1 - (st.phone ? 10 : 50), y: card.y0 + (st.phone ? 14 : 18) };
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      if (sharp) {
        c.strokeStyle = rgb(ink.ink, 0.1);
        c.lineWidth = 1;
        c.strokeRect(Math.round(pane.x0) + 0.5, Math.round(pane.y0) + 0.5, Math.round(pane.x1 - pane.x0), Math.round(pane.y1 - pane.y0));
      }
      type(b, 'SPY  1m', pane.x0 + 8, pane.y0 + 9, { size: 10, share: 0.7 });
      /* the trade's target and its stop */
      const tpY = Math.round(lt + (lb - lt) * 0.15);
      const slY = Math.round(lt + (lb - lt) * 0.78);
      for (const [y, hue, word] of [
        [tpY, ink.bull, 'TP'],
        [slY, ink.red, 'SL'],
      ] as const) {
        c.fillStyle = rgb(hue, sharp ? 0.8 : 0.75);
        for (let x = pane.x0; x < pane.x1; x += sharp ? 5 : 8) if (keep(b, 0.5)) c.fillRect(x, y - (sharp ? 0.5 : 1), sharp ? 2 : 3, sharp ? 1 : 2);
        if (keep(b, 0.7)) {
          c.fillRect(pane.x1 - 52, y - 7, 30, 14);
          type(b, word, pane.x1 - 46, y + 0.5, { size: 8.5, hue: ink.panel });
        }
      }
      /* THE SCRUBBER'S CARD: the replay's day and clock, its track and the day's hours, the controls */
      frame(b, card, { a: 0.16, radius: 8, grip: false });
      if (!sharp && keep(b, 0.5)) {
        c.fillStyle = rgb(ink.line, 0.25);
        c.fillRect(card.x0, card.y0, 10, 2);
      }
      c.fillStyle = rgb(ink.muted, sharp ? 0.5 : 0.6);
      hair(b, track.x0, track.x1, track.y, dashes(rng(5), track.x0, track.x1, 10), 0.6);
      const hours = s.phone ? [10, 12, 14, 16] : [10, 11, 12, 13, 14, 15, 16];
      for (const h of hours) {
        const x = track.x0 + ((h * 60 - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)) * (track.x1 - track.x0);
        c.fillStyle = rgb(ink.muted, 0.7);
        if (keep(b, 0.6)) c.fillRect(x, track.y + 4, 1, 4);
        type(b, `${h}:00`, x, track.y + 13, { size: 7, hue: ink.muted, share: 0.35, align: 'center' });
      }
      /* the controls: back to the start, a step back, play, a step on, to the end */
      const cy = track.y + (s.phone ? 26 : 34);
      const mid = (track.x0 + track.x1) / 2;
      c.fillStyle = rgb(ink.line, sharp ? 0.85 : 0.8);
      const tri = (x: number, dir: number, size: number) => {
        if (!keep(b, 0.6)) return;
        c.beginPath();
        c.moveTo(x - (dir * size) / 2, cy - size / 2);
        c.lineTo(x + (dir * size) / 2, cy);
        c.lineTo(x - (dir * size) / 2, cy + size / 2);
        c.closePath();
        c.fill();
      };
      if (!s.phone) {
        tri(mid - 54, -1, 6);
        c.fillRect(mid - 60, cy - 3, 1.5, 6);
        tri(mid - 26, -1, 6);
        tri(mid + 26, 1, 6);
        tri(mid + 54, 1, 6);
        c.fillRect(mid + 58, cy - 3, 1.5, 6);
        if (sharp) {
          c.strokeStyle = rgb(ink.line, 0.8);
          c.lineWidth = 1;
          c.beginPath();
          c.arc(mid, cy, 9, 0, Math.PI * 2);
          c.stroke();
        }
        tri(mid + 1, 1, 7);
        chip(b, card.x0 + 10, cy, 52, { edge: rgb(ink.muted, 0.6), word: 'PACE 1×', wordInk: rgb(ink.secondary), h: 14 });
      }
    },
    tick(f) {
      q = 0.3 + (((f.t + CYCLE * 0.55) % CYCLE) / CYCLE) * 0.7;
    },
    live: () => grow2(pane, card),
    moving(pen: Pen, f: Frame) {
      if (!s) return;
      const { c } = pen;
      draw(c, pen.ink, false);
      const hx = playX();
      /* the head: a line down the pane, and the knob on the track */
      c.fillStyle = pen.ink(s.ink.line, 0.55);
      for (let y = pane.y0; y < pane.y1; y += 7) c.fillRect(hx, y, 2, 4);
      const kx = track.x0 + (track.x1 - track.x0) * q;
      c.fillStyle = pen.ink(s.ink.line, 0.95);
      c.fillRect(track.x0, track.y - 1, kx - track.x0, 2);
      c.beginPath();
      c.arc(kx, track.y, 4.5, 0, Math.PI * 2);
      c.fill();
      if (pen.fringe) return;
      /* the replay's own clock: the day it plays, the minute it has reached */
      const word = `Jul 2 · ${hhmm(minute())} · NEW YORK`;
      c.font = `600 9px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.fillStyle = rgb(s.ink.line, 0.95);
      c.fillText(word, card.x0 + 10, track.y);
      const hy = headVal();
      c.fillRect(hx, Math.round(hy) - 1, pane.x1 + 6 - hx, 2);
      c.strokeStyle = rgb(s.ink.line);
      c.lineWidth = 2;
      c.font = `600 10px ${FONT}`;
      const tw = c.measureText(hhmm(minute())).width + 12;
      c.strokeRect(pane.x1 + 6, hy - 8, tw, 16);
      c.fillText(hhmm(minute()), pane.x1 + 12, hy + 0.5);
      void f;
    },
    sharp(c, _f, focus) {
      if (!s) return;
      draw(c, (h, a) => rgb(h, a), true, focus.x0, focus.x1);
      const hx = playX();
      c.strokeStyle = rgb(s.ink.line, 0.5);
      c.lineWidth = 1;
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(Math.round(hx) + 0.5, pane.y0);
      c.lineTo(Math.round(hx) + 0.5, pane.y1);
      c.stroke();
      c.setLineDash([]);
      const kx = track.x0 + (track.x1 - track.x0) * q;
      c.fillStyle = rgb(s.ink.line);
      c.fillRect(track.x0, track.y - 1, kx - track.x0, 2);
      c.beginPath();
      c.arc(kx, track.y, 5, 0, Math.PI * 2);
      c.fill();
      c.font = `500 9.5px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.fillStyle = rgb(s.ink.line);
      c.fillText(`Jul 2 · ${hhmm(minute())} · NEW YORK`, card.x0 + 10, track.y);
      const hy = headVal();
      const w = c.measureText(hhmm(minute())).width + 14;
      c.beginPath();
      c.roundRect(pane.x1 + 6, hy - 9, w, 18, 3);
      c.fill();
      c.fillStyle = rgb(s.ink.panel);
      c.fillText(hhmm(minute()), pane.x1 + 13, hy + 0.5);
    },
    /* the scrubber reads the minute under the pointer */
    read(c, _f, x, y): Pill[] | null {
      if (!s) return null;
      if (x >= track.x0 && x <= track.x1 && Math.abs(y - track.y) < 18) {
        const m = OPEN_MIN + ((x - track.x0) / (track.x1 - track.x0)) * (CLOSE_MIN - OPEN_MIN);
        c.fillStyle = rgb(s.ink.line, 0.5);
        c.fillRect(Math.round(x), track.y - 6, 1, 12);
        return [{ x, y: track.y - 16, text: hhmm(m), anchor: 'mid' }];
      }
      if (x >= pane.x0 && x <= Math.min(pane.x1, playX()) && y >= pane.y0 && y <= pane.y1) {
        c.strokeStyle = rgb(s.ink.ink, 0.38);
        c.lineWidth = 1;
        c.setLineDash([2, 4]);
        c.beginPath();
        c.moveTo(Math.round(x) + 0.5, pane.y0);
        c.lineTo(Math.round(x) + 0.5, pane.y1);
        c.stroke();
        c.setLineDash([]);
        const m = OPEN_MIN + ((x - pane.x0) / (pane.x1 - pane.x0)) * (CLOSE_MIN - OPEN_MIN);
        return [{ x, y: pane.y1 - 10, text: hhmm(m), anchor: 'mid' }];
      }
      return null;
    },
    sights: () => [
      { x: playX() - 30, y: (lt + lb) / 2 },
      { x: track.x0 + (track.x1 - track.x0) * q, y: track.y },
    ],
  };
};
const grow2 = (a: Box, b: Box): Box => ({ x0: Math.min(a.x0, b.x0) - 4, y0: Math.min(a.y0, b.y0) - 4, x1: Math.max(a.x1 + 70, b.x1) + 4, y1: Math.max(a.y1, b.y1) + 4 });
