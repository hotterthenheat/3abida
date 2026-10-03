/*
  THE DESK'S SMALLER PANELS (components/layout/footer/parts/desk.ts) — Pulse's setup cards and its earnings rows, and
  Compass's board of contract cards and its heaviest contracts: a card is a contract's tag edged in its side's ink, a
  sparkline that walks, the line it breaks at, its state.
*/

import {
  FONT,
  bar,
  box,
  chip,
  clock,
  frame,
  keep,
  prose,
  rgb,
  rng,
  sparkline,
  tag,
  type,
  type Box,
  type Brush,
  type Frame,
  type Ink,
  type Part,
  type Pen,
  type Pill,
  type Stage,
} from '../kit';

const NAMES = ['NVDA', 'AVGO', 'AAPL', 'MU', 'QQQ', 'ORCL', 'CRM', 'SPY', 'MSFT', 'GOOGL', 'META', 'AMD', 'TSLA', 'AMZN'];
const STATES = ['MOVING', 'ACTIVE', 'WATCH', 'MOVING', 'ACTIVE', 'FADING'];

/** a warning's small triangle (the break line's mark) */
const warnMark = (c: CanvasRenderingContext2D, x: number, y: number, style: string) => {
  c.fillStyle = style;
  c.beginPath();
  c.moveTo(x, y - 4);
  c.lineTo(x + 4.5, y + 3.5);
  c.lineTo(x - 4.5, y + 3.5);
  c.closePath();
  c.fill();
};

/* ---- CONTRACT CARDS: Pulse's setups, Compass's board ------------------------------------------------------------ */

interface Card {
  at: Box;
  name: string;
  put: boolean;
  state: string;
  tp: boolean;
  top: boolean;
  spark: ReturnType<typeof sparkline>;
  breakY: number;
}
export const cards = (o: { cols: number; rows: number; phoneCols?: number; phoneRows?: number; seed?: number; first?: number }): Part => {
  let s: Stage | null = null;
  let list: Card[] = [];
  let now = 0;
  const made = new Map<number, ReturnType<typeof sparkline>>();
  const sparkOf = (i: number) => {
    let sp = made.get(i);
    if (!sp) {
      sp = sparkline((o.seed ?? 400) + i * 97, { step: 520 + (i % 3) * 90, gap: 3 });
      made.set(i, sp);
    }
    return sp;
  };
  return {
    place(b, st) {
      s = st;
      const cols = st.phone ? (o.phoneCols ?? o.cols) : o.cols;
      const rows = st.phone ? (o.phoneRows ?? o.rows) : o.rows;
      const gx = 10;
      const gy = 10;
      const cw = (b.x1 - b.x0 - gx * (cols - 1)) / cols;
      const ch = (b.y1 - b.y0 - gy * (rows - 1)) / rows;
      const r = rng(o.seed ?? 400);
      list = [];
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const n = j * cols + i;
          const at = box(b.x0 + i * (cw + gx), b.y0 + j * (ch + gy), b.x0 + i * (cw + gx) + cw, b.y0 + j * (ch + gy) + ch);
          const sp = sparkOf(n);
          const sw = Math.min(110, (at.x1 - at.x0) * 0.42);
          const sx = at.x0 + (at.x1 - at.x0) * 0.4;
          sp.place(box(sx, at.y0 + ch * 0.38, sx + sw, at.y0 + ch * 0.7), now);
          list.push({
            at,
            name: NAMES[(n + (o.first ?? 0)) % NAMES.length],
            put: r() < 0.4,
            state: STATES[n % STATES.length],
            tp: r() < 0.45,
            top: n === 0,
            spark: sp,
            breakY: at.y0 + ch * (0.42 + r() * 0.24),
          });
        }
    },
    still(b) {
      const { c, sharp, ink } = b;
      for (const k of list) {
        const { at } = k;
        const w = at.x1 - at.x0;
        const h = at.y1 - at.y0;
        frame(b, at, { a: k.top ? 0.4 : 0.12, radius: 6, grip: false });
        const hue = k.put ? ink.red : ink.bull;
        const x = at.x0 + 8;
        const y = at.y0 + 13;
        type(b, `#${list.indexOf(k) + 1}`, x, y, { size: 8, hue: ink.muted, share: 0.4 });
        const tw = tag(b, x + 16, y, `${k.name} ${k.put ? 'put' : 'call'}`, { edge: rgb(hue, sharp ? 0.9 : 1), fill: rgb(hue, 0.14), wordInk: rgb(hue) });
        if (w > 150) tag(b, x + 22 + tw, y, '0DTE', { edge: rgb(ink.muted, 0.6), wordInk: rgb(ink.muted), size: 7.5, share: 0.4 });
        /* its state, top right; the first card the board's top pick */
        if (k.top && w > 190) chip(b, at.x1 - 64, y, 56, { edge: rgb(ink.supreme, 0.9), word: 'TOP PICK', wordInk: rgb(ink.supreme), h: 12 });
        else if (w > 150) chip(b, at.x1 - 58, y, 50, { fill: k.state === 'ACTIVE' ? rgb(ink.line) : null, edge: k.state === 'ACTIVE' ? null : rgb(ink.muted, 0.8), word: k.state, wordInk: k.state === 'ACTIVE' ? rgb(ink.panel) : rgb(ink.line, 0.85), h: 12 });
        if (k.tp && w > 190 && h > 64) chip(b, at.x1 - 58 - 50, y + 16, 44, { edge: rgb(ink.bull, 0.9), word: 'TP1', wordInk: rgb(ink.bull), h: 12 });
        /* the move it is priced for: a word and a figure gone to a block */
        if (h > 56) {
          type(b, '1σ MOVE', x, at.y0 + h * 0.5, { size: 7, hue: ink.muted, share: 0.35 });
          c.fillStyle = rgb(ink.line, 0.85);
          bar(b, x, at.y0 + h * 0.5 + 8, 26, 5, 0.5);
        }
        /* the line it breaks at: a warning and its words */
        if (h > 70) {
          const by = at.y1 - 12;
          if (keep(b, 0.5)) warnMark(c, x + 4, by, rgb(ink.warn, 0.9));
          prose(b, x + 14, by, Math.min(110, w * 0.45), { hue: ink.warn, a: 0.75, seed: list.indexOf(k) * 13 + 5, share: 0.45 });
          if (sharp) {
            c.strokeStyle = rgb(ink.muted, 0.5);
            c.lineWidth = 1;
            c.strokeRect(at.x1 - 46.5, by - 7.5, 38, 15);
            type(b, 'OPEN', at.x1 - 40, by, { size: 7.5, hue: ink.secondary });
          }
        }
        /* the break line across the sparkline: the warn ink, dashed */
        const sb = k.spark.box();
        c.fillStyle = rgb(ink.warn, sharp ? 0.55 : 0.7);
        for (let xx = sb.x0; xx < sb.x1; xx += 6) if (keep(b, 0.55)) c.fillRect(xx, Math.round((sb.y0 + sb.y1) / 2 + (k.breakY - at.y0) * 0.08), 3, sharp ? 1 : 2);
      }
    },
    tick(f) {
      now = f.t;
      for (const k of list) k.spark.tick(f);
    },
    live: () => (list.length ? { x0: list[0].at.x0, y0: list[0].at.y0, x1: list[list.length - 1].at.x1, y1: list[list.length - 1].at.y1 } : null),
    moving(p: Pen, f: Frame) {
      for (const k of list) k.spark.draw(p.c, f.t, p.ink(k.spark.up(f.t) ? s!.ink.bull : s!.ink.red, 0.95), 2.4, 1.2);
    },
    sharp(c, f) {
      for (const k of list) k.spark.draw(c, f.t, rgb(k.spark.up(f.t) ? s!.ink.bull : s!.ink.red), 1.3, 0);
    },
    /* a card under the pointer: its ring, and when it was found */
    read(c, f, x, y): Pill[] | null {
      const k = list.find(q => x >= q.at.x0 && x <= q.at.x1 && y >= q.at.y0 && y <= q.at.y1);
      if (!k || !s) return null;
      c.strokeStyle = rgb(s.ink.silver, 0.9);
      c.lineWidth = 1.5;
      c.beginPath();
      c.roundRect(k.at.x0 - 2, k.at.y0 - 2, k.at.x1 - k.at.x0 + 4, k.at.y1 - k.at.y0 + 4, 7);
      c.stroke();
      return [{ x: k.at.x1, y: k.at.y0 - 2, text: `found ${clock(f.wall - (list.indexOf(k) + 1) * 47_000, false)}`, anchor: 'right' }];
    },
    sights: f => list.slice(0, 2).map(k => ({ x: k.spark.box().x1 - 6, y: k.spark.wk.headY(f.t) })),
  };
};

/* ---- ROWS: Pulse's earnings calendar, Compass's heaviest contracts ----------------------------------------------- */

const LOGO = (ink: Ink, i: number) => [ink.red, ink.blue, ink.moon, ink.warn, ink.cool, ink.line][i % 6];

export const rows = (o: { kind: 'earnings' | 'heaviest'; seed?: number; gap?: number }): Part => {
  let at: Box = box(0, 0, 0, 0);
  let s: Stage | null = null;
  let list: { y: number; name: string; w: number; side: boolean; fill: number }[] = [];
  return {
    place(b, st) {
      at = b;
      s = st;
      const gap = o.gap ?? 22;
      const r = rng(o.seed ?? 71);
      const n = Math.max(1, Math.floor((b.y1 - b.y0) / gap));
      list = Array.from({ length: n }, (_, i) => ({
        y: b.y0 + gap / 2 + i * gap,
        name: NAMES[(i * 3 + 2) % NAMES.length],
        w: 0.25 + r() * 0.6,
        side: r() < 0.5,
        fill: 0.2 + r() * 0.75,
      }));
    },
    still(b) {
      const { c, sharp, ink } = b;
      const w = at.x1 - at.x0;
      /* the column heads, in focus */
      if (sharp) {
        c.fillStyle = rgb(ink.ink, 0.08);
        c.fillRect(at.x0, at.y0 - 2, w, 1);
      }
      list.forEach((row, i) => {
        if (o.kind === 'earnings') {
          /* a name's mark, its name, when it reports, the move it is priced for */
          c.fillStyle = rgb(LOGO(ink, i), sharp ? 0.9 : 0.85);
          if (keep(b, 0.6)) c.fillRect(at.x0, row.y - 4, 8, 8);
          type(b, row.name, at.x0 + 14, row.y - 2, { size: 8.5, share: 0.5 });
          prose(b, at.x0 + 14, row.y + 6, 34, { hue: ink.muted, a: 0.5, seed: i + 3, h: 1.5, share: 0.3 });
          prose(b, at.x0 + w * 0.42, row.y, w * 0.2, { hue: ink.secondary, a: 0.55, seed: i + 9, share: 0.35 });
          c.fillStyle = rgb(ink.line, 0.85);
          bar(b, at.x0 + w * 0.72, row.y - 3, w * 0.1, 5, 0.5);
          c.fillStyle = rgb(row.side ? ink.warn : ink.ember, 0.85);
          bar(b, at.x1 - w * 0.12, row.y - 3, w * 0.1, 5, 0.5);
        } else {
          /* the heaviest contracts: its rank, a contract tag, the share it holds as a bar */
          type(b, `#${i + 1}`, at.x0, row.y - 4, { size: 7.5, hue: ink.muted, share: 0.35 });
          const hue = row.side ? ink.red : ink.bull;
          tag(b, at.x0 + 20, row.y - 4, `${row.name} ${row.side ? 'put' : 'call'}`, { edge: rgb(hue, 0.9), fill: rgb(hue, 0.12), wordInk: rgb(hue), size: 8 });
          c.fillStyle = rgb(hue, sharp ? 0.85 : 0.8);
          bar(b, at.x0, row.y + 7, (w * 0.42) * row.fill, 2, 0.55);
          prose(b, at.x0 + w * 0.55, row.y - 2, w * 0.18, { hue: ink.secondary, a: 0.5, seed: i * 7 + 1, share: 0.3 });
          c.fillStyle = rgb(row.side ? ink.red : ink.bull, 0.8);
          bar(b, at.x1 - w * 0.16, row.y - 4, w * 0.14, 5, 0.5);
        }
        if (sharp && i < list.length - 1) {
          c.fillStyle = rgb(ink.ink, 0.05);
          c.fillRect(at.x0, row.y + 11, w, 1);
        }
      });
    },
    read(c, _f, x, y) {
      if (!s || !(x >= at.x0 && x <= at.x1 && y >= at.y0 && y <= at.y1)) return null;
      const row = list.find(q => Math.abs(q.y - y) <= 11);
      if (!row) return null;
      c.fillStyle = rgb(s.ink.ink, 0.07);
      c.fillRect(at.x0 - 4, row.y - 11, at.x1 - at.x0 + 8, 22);
      return null;
    },
  };
};

/* ---- A PANEL'S TITLE ROW: the desk's own words (unused by broken pieces, kept for the sharp) ---------------------- */
export const label = (text: string, o: { size?: number; hue?: keyof Omit<Ink, 'hues'>; share?: number } = {}): Part => {
  let x = 0;
  let y = 0;
  return {
    place(b) {
      x = b.x0;
      y = (b.y0 + b.y1) / 2;
    },
    still(b: Brush) {
      b.c.font = `600 ${o.size ?? 8.5}px ${FONT}`;
      type(b, text, x, y, { size: o.size ?? 8.5, hue: b.ink[o.hue ?? 'muted'], share: o.share ?? 0.4 });
    },
  };
};
