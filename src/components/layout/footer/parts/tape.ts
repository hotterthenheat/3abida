/*
  THE TAPE (components/layout/footer/parts/tape.ts) — Trace's: prints coming in at the top, the rows below stepping down
  to make room — each its moment (the clock), its name, its side, its fill against the market, its size and money, the
  flow's lean and the word for it; the largest print in the supreme's magenta. And the net flow's lines: the calls'
  money climbing, the puts' falling, the price between them.
*/

import { FONT, box, clock, ease, rgb, rng, type, walk, type Box, type Frame, type Part, type Pen, type Pill, type Stage } from '../kit';
import type { Chart } from './chart';

const NAMES = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'AMD', 'META', 'MSFT', 'AMZN', 'IWM'];

interface Print {
  name: string;
  call: boolean;
  fill: number;
  size: number;
  prem: number;
  flow: number;
  sent: 0 | 1 | 2;
  big: boolean;
  logo: number;
}
const printOf = (k: number, seed: number): Print => {
  const r = rng(k * 7919 + seed);
  const n = Math.floor(r() * NAMES.length);
  const call = r() < 0.56;
  const prem = r() ** 2;
  const lean = r();
  return {
    name: NAMES[n],
    call,
    fill: r(),
    size: 0.15 + r() * 0.85,
    prem,
    flow: (lean - 0.5) * 2,
    sent: lean > 0.62 ? 0 : lean < 0.38 ? 1 : 2,
    big: r() < 0.07,
    logo: n,
  };
};

export const tape = (o: { seed?: number; every?: number } = {}): Part => {
  const EVERY = o.every ?? 640;
  const SEED = o.seed ?? 33;
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let rh = 16;
  let n = 0;
  let cols: number[] = [];
  let narrow = false;
  let t = 0;
  const BASE = 1000;
  const newest = () => BASE + Math.floor(t / EVERY);
  /* where a row stands: the newest slides in from above as the others step down */
  const rowY = (j: number) => {
    const p = ease(Math.min(1, (t % EVERY) / 220));
    return at.y0 + 20 + (j - (1 - p)) * rh;
  };
  const LOGOS = (st: Stage) => [st.ink.line, st.ink.blue, st.ink.red, st.ink.cool, st.ink.warn, st.ink.moon, st.ink.glacier, st.ink.secondary, st.ink.ember, st.ink.darkpool];

  const row = (c: CanvasRenderingContext2D, k: number, y: number, ink: (h: string, a?: number) => string, words: boolean, sharp: boolean, alpha: number, wall: number) => {
    if (!s) return;
    const pr = printOf(k, SEED);
    const I = s.ink;
    const mid = y + rh / 2;
    const bh = sharp ? 3 : 4;
    const side = pr.call ? I.bull : I.red;
    /* its moment */
    if (words) {
      c.font = `${sharp ? 500 : 600} 8.5px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.fillStyle = rgb(I.secondary, 0.9 * alpha);
      c.fillText(clock(wall - (newest() - k) * EVERY - (t % EVERY), true), cols[0], mid);
    }
    /* its name's mark and its name */
    c.fillStyle = ink(LOGOS(s)[pr.logo], 0.9 * alpha);
    c.fillRect(cols[1], mid - 3.5, 7, 7);
    if (words) {
      c.font = `600 8.5px ${FONT}`;
      c.fillStyle = rgb(I.line, alpha);
      c.fillText(pr.name, cols[1] + 11, mid);
      c.fillStyle = rgb(side, alpha);
      c.fillText(pr.call ? 'call' : 'put', cols[2], mid);
    } else {
      c.fillStyle = ink(I.line, 0.8 * alpha);
      c.fillRect(cols[1] + 11, mid - 2, 20, 4);
      c.fillStyle = ink(side, 0.9 * alpha);
      c.fillRect(cols[2], mid - 2, 14, 4);
    }
    if (narrow) {
      /* a phone's tape: the money and the lean */
      const pw = (at.x1 - cols[3]) * 0.55 * (0.2 + pr.prem * 0.8);
      c.fillStyle = ink(pr.big ? I.supreme : I.line, 0.85 * alpha);
      c.fillRect(cols[3], mid - bh / 2, pw, bh);
      c.fillStyle = ink(pr.sent === 0 ? I.bull : pr.sent === 1 ? I.red : I.muted, 0.85 * alpha);
      c.fillRect(at.x1 - 30, mid - bh / 2, 26, bh);
      return;
    }
    /* its fill against the market: a short track and where it filled */
    const fw = cols[4] - cols[3] - 14;
    c.fillStyle = ink(I.muted, 0.5 * alpha);
    c.fillRect(cols[3], mid + 1, fw, sharp ? 1 : 2);
    c.fillStyle = ink(I.line, 0.95 * alpha);
    c.fillRect(cols[3] + fw * pr.fill - 2, mid - 1, 4, 4);
    /* its size, its money (the largest in the supreme's ink) */
    c.fillStyle = ink(I.line, 0.75 * alpha);
    c.fillRect(cols[4], mid - bh / 2, (cols[5] - cols[4] - 12) * pr.size, bh);
    c.fillStyle = ink(pr.big ? I.supreme : I.line, (pr.big ? 1 : 0.9) * alpha);
    c.fillRect(cols[5], mid - bh / 2, (cols[6] - cols[5] - 12) * (0.15 + pr.prem * 0.85), bh);
    /* the flow's lean, either side of its middle */
    const fm = (cols[6] + cols[7] - 12) / 2;
    const lw = ((cols[7] - cols[6] - 12) / 2) * Math.abs(pr.flow);
    c.fillStyle = ink(pr.flow > 0 ? I.bull : I.red, 0.9 * alpha);
    c.fillRect(pr.flow > 0 ? fm : fm - lw, mid - bh / 2, lw, bh);
    /* the word for it */
    const sw = at.x1 - cols[7];
    const hue = pr.sent === 0 ? I.bull : pr.sent === 1 ? I.red : I.muted;
    if (words) {
      c.font = `600 8px ${FONT}`;
      c.fillStyle = rgb(hue, alpha);
      c.fillText(pr.sent === 0 ? 'BULLISH' : pr.sent === 1 ? 'BEARISH' : 'NEUTRAL', cols[7], mid);
    } else {
      c.fillStyle = ink(hue, 0.85 * alpha);
      c.fillRect(cols[7], mid - 2, Math.min(sw - 4, 34), 4);
    }
  };

  return {
    place(b, st) {
      s = st;
      at = b;
      narrow = b.x1 - b.x0 < 380;
      rh = narrow ? 14 : 16;
      n = Math.max(2, Math.floor((b.y1 - b.y0 - 20) / rh));
      const w = b.x1 - b.x0;
      const share = narrow ? [0, 0.2, 0.42, 0.52] : [0, 0.11, 0.24, 0.32, 0.45, 0.57, 0.69, 0.84];
      cols = share.map(q => b.x0 + w * q);
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      /* the column heads */
      const heads = narrow ? ['TIME', 'TICKER', 'SIDE', 'PREM'] : ['TIME', 'TICKER', 'SIDE', 'FILL', 'SIZE', 'PREM', 'FLOW', 'SENTIMENT'];
      heads.forEach((h, i) => type(b, h, cols[i], at.y0 + 7, { size: 7.5, hue: ink.muted, share: 0.4 }));
      if (sharp) {
        c.fillStyle = rgb(ink.ink, 0.1);
        c.fillRect(at.x0, at.y0 + 15, at.x1 - at.x0, 1);
        for (let j = 1; j < n; j++) {
          c.fillStyle = rgb(ink.ink, 0.04);
          c.fillRect(at.x0, Math.round(at.y0 + 20 + j * rh) - 0.5, at.x1 - at.x0, 1);
        }
      }
    },
    /* the still frame catches the tape between two prints, not one half in */
    tick(f) {
      t = f.t + 400;
    },
    live: () => box(at.x0 - 4, at.y0 + 16, at.x1 + 4, at.y1 + 2),
    moving(p: Pen, f: Frame) {
      if (!s) return;
      const { c } = p;
      c.save();
      c.beginPath();
      c.rect(at.x0 - 4, at.y0 + 18, at.x1 - at.x0 + 8, at.y1 - at.y0 - 18);
      c.clip();
      const top = newest();
      const fresh = Math.min(1, (t % EVERY) / 220);
      for (let j = 0; j <= n; j++) {
        const y = rowY(j);
        if (y > at.y1 - rh * 0.6) break;
        /* the newest print comes in bright, and settles */
        if (j === 0 && !p.fringe) {
          c.fillStyle = rgb(s.ink.ink, 0.1 * (1 - ease(Math.min(1, (t % EVERY) / 900))));
          c.fillRect(at.x0, y, at.x1 - at.x0, rh - 2);
        }
        /* broken, a row keeps only some of its marks */
        const keepRow = printOf(top - j, SEED * 3).fill > 0.22;
        if (!keepRow) continue;
        row(c, top - j, y, p.ink, !p.fringe, false, j === 0 ? fresh : 1, f.wall);
      }
      c.restore();
    },
    sharp(c, f, focus) {
      if (!s) return;
      c.save();
      c.beginPath();
      c.rect(at.x0 - 4, at.y0 + 18, at.x1 - at.x0 + 8, at.y1 - at.y0 - 18);
      c.clip();
      const top = newest();
      for (let j = 0; j <= n; j++) {
        const y = rowY(j);
        if (y > at.y1 - rh * 0.6) break;
        if (y + rh < focus.y0 || y > focus.y1) continue;
        row(c, top - j, y, (h, a) => rgb(h, a), true, true, j === 0 ? Math.min(1, (t % EVERY) / 220) : 1, f.wall);
      }
      c.restore();
    },
    /* a row under the pointer: lit, and its moment */
    read(c, f, x, y): Pill[] | null {
      if (!s || x < at.x0 || x > at.x1 || y < at.y0 + 18 || y > at.y1) return null;
      const j = Math.floor((y - rowY(0)) / rh);
      const ry = rowY(j);
      c.fillStyle = rgb(s.ink.ink, 0.08);
      c.fillRect(at.x0 - 4, ry, at.x1 - at.x0 + 8, rh - 1);
      const pr = printOf(newest() - j, SEED);
      return [{ x: at.x1, y: ry - 9, text: `${pr.name} · ${clock(f.wall - j * EVERY - (t % EVERY), true)}`, anchor: 'right' }];
    },
    sights: () => [
      { x: cols[5] + 20, y: rowY(2) + rh / 2 },
      { x: cols[1] + 14, y: rowY(5) + rh / 2 },
    ],
  };
};

/* ---- THE NET FLOW: the calls' money and the puts' on the price's pane, walking with it ---------------------------- */

export const flowLines = (ch: Chart, o: { seed?: number } = {}): Part => {
  const calls = walk((o.seed ?? 61) + 1, { step: ch.walk.STEP, gap: ch.walk.GAP, drift: 0.05, lean: 0.0005, kick: 0.7 });
  const puts = walk((o.seed ?? 61) + 2, { step: ch.walk.STEP, gap: ch.walk.GAP, drift: -0.05, lean: 0.0005, kick: 0.7 });
  let s: Stage | null = null;
  let now = 0;
  return {
    place(_b, st) {
      s = st;
      const p = ch.pane();
      const h = p.y1 - p.y0;
      calls.place(p.x0, p.x1, p.y0 + h * 0.06, p.y0 + h * 0.36, now);
      puts.place(p.x0, p.x1, p.y0 + h * 0.5, p.y0 + h * 0.8, now);
    },
    still(b) {
      if (!s) return;
      const p = ch.pane();
      type(b, 'NET CALLS', p.x1 - 60, p.y0 + 8, { size: 7, hue: b.ink.bull, share: 0.4 });
      type(b, 'NET PUTS', p.x1 - 60, p.y0 + 18, { size: 7, hue: b.ink.red, share: 0.4 });
    },
    tick(f) {
      now = f.t;
      calls.tick(f.t, f.dt);
      puts.tick(f.t, f.dt);
    },
    live: () => ch.pane(),
    moving(p: Pen, f: Frame) {
      if (!s) return;
      const { c } = p;
      c.lineJoin = 'round';
      c.lineWidth = 2.4;
      c.strokeStyle = p.ink(s.ink.bull, 0.95);
      calls.trace(c, f.t, 0, 0, 1.4);
      c.stroke();
      c.strokeStyle = p.ink(s.ink.red, 0.95);
      puts.trace(c, f.t, 0, 0, 1.4);
      c.stroke();
    },
    sharp(c, f) {
      if (!s) return;
      c.lineJoin = 'round';
      c.lineWidth = 1.4;
      c.strokeStyle = rgb(s.ink.bull);
      calls.trace(c, f.t, 0, 0, 0);
      c.stroke();
      c.strokeStyle = rgb(s.ink.red);
      puts.trace(c, f.t, 0, 0, 0);
      c.stroke();
    },
  };
};
