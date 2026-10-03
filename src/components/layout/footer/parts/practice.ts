/*
  PRACTICE'S PIECES (components/layout/footer/parts/practice.ts) — the Journal's month (every trade on its day, the day
  washed in what it made or lost, the week's sum at the side), the money's curve walking, and Paper's foot: the
  positions, orders and trades, the contract held; its order pad.
*/

import { box, chip, dayWord, frame, keep, prose, rgb, rng, tag, type, walk, type Box, type Part, type Pen, type Pill, type Stage } from '../kit';

/* NEW YORK'S CALENDAR: today's date there, so the month is the market's month */
const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' });
const MONTH = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const today = () => {
  const [m, d, y] = NY.format(Date.now()).split('/').map(Number);
  return { y, m: m - 1, d };
};

/* ---- THE MONTH ---------------------------------------------------------------------------------------------------- */

export const calendar = (o: { seed?: number; week?: boolean } = {}): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let cells: { x: number; y: number; w: number; h: number; day: number; wd: number; made: number; trades: number; note: boolean; ms: number }[] = [];
  let weeks: { y: number; h: number; sum: number }[] = [];
  let title = '';
  let pick = -1;
  let todayIdx = -1;
  let blink = 0;
  const HEAD = 30;
  return {
    place(b, st) {
      s = st;
      at = b;
      const now = today();
      /* early in a month the month gone by is the one with the trades in it */
      const early = now.d < 12;
      const y = early && now.m === 0 ? now.y - 1 : now.y;
      const m = early ? (now.m + 11) % 12 : now.m;
      const d = early ? 31 : now.d;
      title = MONTH.format(Date.UTC(y, m, 1));
      const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
      const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const nrows = Math.ceil((first + days) / 7);
      const week = o.week !== false && !st.phone;
      const cols = week ? 8 : 7;
      const gap = st.phone ? 3 : 5;
      const cw = (b.x1 - b.x0 - gap * (cols - 1)) / cols;
      const ch = (b.y1 - b.y0 - HEAD - gap * (nrows - 1)) / nrows;
      const r = rng(o.seed ?? 99 + m);
      cells = [];
      weeks = Array.from({ length: nrows }, (_, i) => ({ y: b.y0 + HEAD + i * (ch + gap), h: ch, sum: 0 }));
      for (let dd = 1; dd <= days; dd++) {
        const k = first + dd - 1;
        const wd = k % 7;
        const row = Math.floor(k / 7);
        const traded = wd > 0 && wd < 6 && dd <= d && r() < 0.78;
        const made = traded ? (r() - 0.55) * 2 : 0;
        const trades = traded ? 1 + Math.floor(r() * 4) : 0;
        weeks[row].sum += made;
        cells.push({ x: b.x0 + wd * (cw + gap), y: b.y0 + HEAD + row * (ch + gap), w: cw, h: ch, day: dd, wd, made, trades, note: traded && r() < 0.2, ms: Date.UTC(y, m, dd, 16) });
      }
      pick = cells.findIndex((c, i) => i < d - 1 && c.trades > 0 && c.made > 0.2);
      /* the cursor stands in today, or in the day picked when today is in another month */
      todayIdx = early ? pick : now.d - 1;
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      type(b, title, at.x0, at.y0 + 7, { size: 10, share: 0.6 });
      const week = o.week !== false && !s.phone;
      ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', ...(week ? ['WEEK'] : [])].forEach((w, i) => {
        const cw = cells[0]?.w ?? 20;
        type(b, s!.phone ? w[0] : w, at.x0 + i * (cw + (s!.phone ? 3 : 5)) + 3, at.y0 + 22, { size: 6.5, hue: ink.muted, share: 0.35 });
      });
      cells.forEach((cell, i) => {
        const hue = cell.made >= 0 ? ink.bull : ink.red;
        const box2 = box(cell.x, cell.y, cell.x + cell.w, cell.y + cell.h);
        /* a day it traded, washed in what it made or lost */
        if (cell.trades) {
          c.fillStyle = rgb(hue, (sharp ? 0.1 : 0.12) + Math.abs(cell.made) * (sharp ? 0.22 : 0.24));
          if (keep(b, 0.75)) c.fillRect(cell.x, cell.y, cell.w, cell.h);
          c.strokeStyle = rgb(hue, sharp ? 0.45 : 0.6);
          c.lineWidth = 1;
          if (keep(b, 0.5)) c.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.w - 1, cell.h - 1);
          /* its figure gone to a mark, and its trades as ticks */
          c.fillStyle = rgb(hue, 0.95);
          if (cell.h > 26 && keep(b, 0.6)) c.fillRect(cell.x + 5, cell.y + cell.h * 0.5, Math.min(cell.w - 10, 10 + Math.abs(cell.made) * 22), s!.phone ? 2 : 4);
          c.fillStyle = rgb(ink.line, 0.6);
          for (let k = 0; k < cell.trades && cell.h > 34; k++) if (keep(b, 0.5)) c.fillRect(cell.x + 5 + k * 5, cell.y + cell.h - 8, 3, 3);
        } else frame(b, box2, { a: 0.08, radius: 3, grip: false });
        /* its date */
        type(b, String(cell.day), cell.x + 4, cell.y + 7, { size: s!.phone ? 6.5 : 7.5, hue: cell.trades ? ink.line : ink.muted, share: 0.5 });
        if (cell.note && sharp) {
          c.strokeStyle = rgb(ink.secondary, 0.8);
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(cell.x + cell.w - 10, cell.y + 10);
          c.lineTo(cell.x + cell.w - 5, cell.y + 5);
          c.stroke();
        }
        /* the day picked: a silver ring */
        if (i === pick) {
          c.strokeStyle = rgb(ink.silver, sharp ? 0.9 : 0.85);
          c.lineWidth = sharp ? 1.5 : 2;
          c.strokeRect(cell.x - 1, cell.y - 1, cell.w + 2, cell.h + 2);
        }
      });
      /* the week's sum, at the side */
      if (week) {
        const cw = cells[0]?.w ?? 20;
        const wx = at.x0 + 7 * (cw + 5);
        weeks.forEach(wk => {
          if (!wk.sum) return;
          frame(b, box(wx, wk.y, wx + cw, wk.y + wk.h), { a: 0.1, radius: 3, grip: false });
          c.fillStyle = rgb(wk.sum >= 0 ? ink.bull : ink.red, 0.9);
          if (keep(b, 0.6)) c.fillRect(wx + cw - 8 - Math.min(cw - 14, 10 + Math.abs(wk.sum) * 12), wk.y + wk.h * 0.45, Math.min(cw - 14, 10 + Math.abs(wk.sum) * 12), 4);
        });
      }
    },
    tick(f) {
      blink = f.t;
    },
    live: () => {
      const c = cells[todayIdx];
      return c ? box(c.x - 2, c.y - 2, c.x + c.w + 2, c.y + c.h + 2) : null;
    },
    /* today: a cursor in its corner, blinking on the brand's beat while the screen is awake */
    moving(p: Pen) {
      if (!s) return;
      const c = cells[todayIdx];
      if (!c || Math.floor(blink / 530) % 2) return;
      p.c.fillStyle = p.ink(s.ink.line, 0.95);
      p.c.fillRect(c.x + c.w - 8, c.y + 4, 2, Math.min(12, c.h - 8));
    },
    sharp(cx) {
      if (!s) return;
      const c = cells[todayIdx];
      if (!c || Math.floor(blink / 530) % 2) return;
      cx.fillStyle = rgb(s.ink.line);
      cx.fillRect(c.x + c.w - 7, c.y + 4, 1.5, Math.min(12, c.h - 8));
    },
    /* a day under the pointer: its outline, and its own words */
    read(c, _f, x, y): Pill[] | null {
      if (!s) return null;
      const cell = cells.find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!cell) return null;
      c.strokeStyle = rgb(s.ink.line, 0.9);
      c.lineWidth = 1;
      c.strokeRect(cell.x - 0.5, cell.y - 0.5, cell.w + 1, cell.h + 1);
      const words = cell.trades ? `${dayWord(cell.ms)} · ${cell.trades} ${cell.trades === 1 ? 'trade' : 'trades'}` : dayWord(cell.ms);
      return [{ x: cell.x + cell.w / 2, y: cell.y - 10, text: words, anchor: 'mid' }];
    },
    sights: () => {
      const c = cells[pick] ?? cells[0];
      return c ? [{ x: c.x + c.w / 2, y: c.y + c.h / 2 }] : [];
    },
  };
};

/* ---- THE MONEY'S CURVE: what the account made, trade on trade, walking --------------------------------------------- */

export const equity = (o: { seed?: number; title?: string } = {}): Part => {
  const wk = walk(o.seed ?? 1212, { step: 520, gap: 3, kick: 0.8, drift: 0.035, lean: 0.0008 });
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let t = 0;
  const draw = (c: CanvasRenderingContext2D, ink: (h: string, a?: number) => string, sharp: boolean) => {
    if (!s) return;
    const zero = at.y0 + (at.y1 - at.y0) * 0.62;
    c.lineJoin = 'round';
    c.lineWidth = sharp ? 1.6 : 2.6;
    c.strokeStyle = ink(wk.headY(t) <= zero ? s.ink.bull : s.ink.red, 0.95);
    wk.trace(c, t, 0, 0, sharp ? 0 : 1.2);
    c.stroke();
    c.fillStyle = ink(s.ink.line);
    c.fillRect(wk.head() - 2, wk.headY(t) - 2, 4, 4);
  };
  return {
    place(b, st) {
      s = st;
      at = b;
      wk.place(b.x0, b.x1, b.y0 + (b.y1 - b.y0) * 0.22, b.y1 - 6, t);
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      if (o.title) type(b, o.title, at.x0, at.y0 + 6, { size: 7.5, hue: ink.muted, share: 0.45 });
      const zero = at.y0 + (at.y1 - at.y0) * 0.62;
      c.fillStyle = rgb(ink.line, sharp ? 0.25 : 0.35);
      if (sharp) c.fillRect(at.x0, Math.round(zero), at.x1 - at.x0, 1);
      else for (let x = at.x0; x < at.x1; x += 12 + b.r() * 16) c.fillRect(x, zero - 1, 6 + b.r() * 14, 2);
    },
    tick(f) {
      t = f.t;
      wk.tick(f.t, f.dt);
    },
    live: () => box(at.x0 - 4, at.y0 - 4, at.x1 + 6, at.y1 + 4),
    moving: (p: Pen) => draw(p.c, p.ink, false),
    sharp: c => draw(c, (h, a) => rgb(h, a), true),
    sights: () => [{ x: wk.head() - 4, y: wk.headY(t) }],
  };
};

/* ---- STAT ROWS: a word and its figure gone to a mark (the Journal's year, Paper's account) ---------------------------- */

export const stats = (words: string[], o: { seed?: number } = {}): Part => {
  let at: Box = box(0, 0, 0, 0);
  return {
    place: b => {
      at = b;
    },
    still(b) {
      const { c, ink } = b;
      const r = rng(o.seed ?? 3);
      const gap = Math.min(20, (at.y1 - at.y0) / Math.max(1, words.length));
      words.forEach((w, i) => {
        const y = at.y0 + gap / 2 + i * gap;
        if (y > at.y1) return;
        type(b, w, at.x0, y, { size: 7, hue: ink.muted, share: 0.35 });
        const fw = 18 + r() * 34;
        c.fillStyle = rgb(r() < 0.5 ? ink.red : r() < 0.6 ? ink.bull : ink.line, 0.85);
        if (keep(b, 0.55)) c.fillRect(at.x1 - fw, y - 2, fw, b.sharp ? 3 : 4);
      });
    },
  };
};

/* ---- PAPER'S FOOT: positions, orders, trades — the contract held, what it was bought at and is worth, gone to marks --- */

export const positions = (): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  return {
    place(b, st) {
      s = st;
      at = b;
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      const w = at.x1 - at.x0;
      let x = at.x0;
      ['POSITIONS · 1', 'ORDERS · 0', 'TRADES · 0'].forEach((word, i) => {
        const tw = type(b, word, x, at.y0 + 7, { size: 7.5, hue: i ? ink.muted : ink.line, share: 0.5 });
        if (!i) {
          c.fillStyle = rgb(ink.line, 0.9);
          if (keep(b, 0.7)) c.fillRect(x, at.y0 + 14, tw, sharp ? 1 : 2);
        }
        x += tw + 18;
      });
      const y = at.y0 + 30;
      tag(b, at.x0, y, 'SPY call', { edge: rgb(ink.bull, 0.9), fill: rgb(ink.bull, 0.14), wordInk: rgb(ink.bull) });
      for (let k = 0; k < 4; k++) prose(b, at.x0 + w * (0.26 + k * 0.16), y, w * 0.08, { hue: k === 3 ? ink.red : ink.secondary, a: 0.7, seed: 30 + k, h: 3, share: 0.5 });
      if (sharp) {
        c.strokeStyle = rgb(ink.muted, 0.5);
        c.lineWidth = 1;
        c.strokeRect(at.x1 - 44.5, y - 7.5, 40, 15);
        type(b, 'Close', at.x1 - 37, y, { size: 7.5, hue: ink.secondary });
      }
    },
  };
};

/* ---- THE ORDER PAD: how many, and the two doors (to buy at the ask, or at a limit) --------------------------------- */

export const orderPad = (o: { side?: 'BUY' | 'SELL' } = {}): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  return {
    place(b, st) {
      s = st;
      at = b;
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      const side = o.side ?? 'BUY';
      type(b, 'ORDER', at.x0, at.y0 + 6, { size: 7.5, hue: ink.muted, share: 0.45 });
      /* how many: the quick sizes */
      let x = at.x0;
      ['1', '3', '5', '10', '15'].forEach((n, i) => {
        const w = 22;
        if (i === 0) chip(b, x, at.y0 + 26, w, { fill: rgb(ink.line), word: n, wordInk: rgb(ink.panel), h: 16 });
        else chip(b, x, at.y0 + 26, w, { edge: rgb(ink.muted, 0.55), word: n, wordInk: rgb(ink.secondary), h: 16 });
        x += w + 6;
      });
      /* the two doors */
      const bw = (at.x1 - at.x0 - 8) / 2;
      for (let i = 0; i < 2; i++) {
        const bx = at.x0 + i * (bw + 8);
        const by = at.y0 + 44;
        if (sharp) {
          c.strokeStyle = rgb(ink.muted, 0.6);
          c.lineWidth = 1;
          c.beginPath();
          c.roundRect(bx + 0.5, by + 0.5, bw - 1, 24, 4);
          c.stroke();
        } else if (keep(b, 0.4)) {
          c.fillStyle = rgb(ink.line, 0.3);
          c.fillRect(bx, by + 22, bw * 0.6, 2);
        }
        type(b, i ? `${side} LMT` : side, bx + bw / 2, by + 12.5, { size: 8.5, hue: ink.line, share: 0.6, align: 'center' });
      }
    },
  };
};
