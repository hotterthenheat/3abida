/*
  THE QUIETER PICTURES (components/layout/footer/parts/quiet.ts) — for the pages that are not a market: the alerts'
  list, Settings (the two grounds, the switches), the room (other readers' pointers resting on one chart), Status (the
  services, the market's thirty days, a heartbeat), About (the scattered marks gathered into one terminal), the legal
  pages (a document, a line being read), the account forms (a card being filled in), an invite (a dot on its way from one
  screen to another), maintenance (the screen's test card).
*/

import { ARROW, FONT, PIX, box, chip, clamp, clock, dashedCard, dayWord, ease, frame, hash01, keep, lerp, prose, rgb, rng, type, walk, type Box, type Part, type Pen, type Pill, type Stage } from '../kit';
import { bell } from './field';

/* ---- THE ALERTS' LIST: every alert in one place — its bell, its name, what it waits for, its switch --------------- */

const NAMES = ['SPY', 'NVDA', 'QQQ', 'TSLA', 'AAPL', 'META', 'AMD', 'MSFT'];
const WHAT = ['crosses', 'above', 'below', 'crosses', 'above', 'below'];

const toggle = (c: CanvasRenderingContext2D, x: number, y: number, on: number, ink: (h: string, a?: number) => string, s: Stage, sharp: boolean) => {
  const w = 22;
  const h = 12;
  c.fillStyle = ink(on > 0.5 ? s.ink.line : s.ink.muted, on > 0.5 ? 0.9 : 0.4);
  c.beginPath();
  c.roundRect(x, y - h / 2, w, h, h / 2);
  c.fill();
  c.fillStyle = ink(on > 0.5 ? s.ink.panel : s.ink.line, 0.95);
  c.beginPath();
  c.arc(x + 6 + (w - 12) * on, y, sharp ? 4 : 4.5, 0, Math.PI * 2);
  c.fill();
};

export const alertList = (): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let rows: { y: number; name: string; what: string; on: boolean }[] = [];
  return {
    place(b, st) {
      s = st;
      at = b;
      const gap = 24;
      rows = Array.from({ length: Math.max(1, Math.floor((b.y1 - b.y0 - 18) / gap)) }, (_, i) => ({ y: b.y0 + 26 + i * gap, name: NAMES[i % NAMES.length], what: WHAT[i % WHAT.length], on: i % 4 !== 2 }));
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      type(b, 'EVERY ALERT', at.x0, at.y0 + 7, { size: 7.5, hue: ink.muted, share: 0.45 });
      rows.forEach((r, i) => {
        if (keep(b, 0.7)) bell(c, at.x0 + 6, r.y, rgb(r.on ? ink.warn : ink.muted, 0.9), sharp);
        type(b, r.name, at.x0 + 18, r.y - 3, { size: 8.5, share: 0.55 });
        type(b, r.what, at.x0 + 18, r.y + 7, { size: 7, hue: ink.secondary, share: 0.35 });
        if (keep(b, 0.6)) toggle(c, at.x1 - 24, r.y, r.on ? 1 : 0, (h, a) => rgb(h, a), s!, sharp);
        if (sharp && i) {
          c.fillStyle = rgb(ink.ink, 0.05);
          c.fillRect(at.x0, r.y - 12, at.x1 - at.x0, 1);
        }
      });
    },
  };
};

/* ---- SETTINGS: the two grounds side by side (the one in use ringed in silver), the switches, a slider, the candles'
   palettes --------------------------------------------------------------------------------------------------------- */

export const settingsPart = (): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let screens: Box[] = [];
  let rowsY: number[] = [];
  let t = 0;
  const mini = walk(4242, { step: 700, gap: 4, kick: 0.9 });
  const flipOf = () => {
    const q = (t % 4400) / 4400;
    return q < 0.5 ? ease(clamp((q - 0.4) / 0.08, 0, 1)) : 1 - ease(clamp((q - 0.9) / 0.08, 0, 1));
  };
  return {
    place(b, st) {
      s = st;
      at = b;
      const sw = Math.min(150, (b.x1 - b.x0 - 16) / (st.phone ? 2 : 3));
      const sh = sw * 0.58;
      screens = [box(b.x0, b.y0 + 22, b.x0 + sw, b.y0 + 22 + sh), box(b.x0 + sw + 12, b.y0 + 22, b.x0 + 2 * sw + 12, b.y0 + 22 + sh)];
      mini.place(screens[0].x0 + 8, screens[0].x1 - 8, screens[0].y0 + 14, screens[0].y1 - 10, t);
      const top = screens[0].y1 + 34;
      rowsY = [];
      const gap = Math.max(22, Math.min(34, (b.y1 - 8 - top) / 7));
      for (let y = top; y < b.y1 - 8 && rowsY.length < 8; y += gap) rowsY.push(y);
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      const dark = ink.panel.split(' ').map(Number).reduce((a, v) => a + v, 0) < 384;
      type(b, 'APPEARANCE', at.x0, at.y0 + 7, { size: 7.5, hue: ink.muted, share: 0.45 });
      /* the ground in use: its own screen, ringed */
      const [a, z] = screens;
      if (sharp) {
        c.strokeStyle = rgb(ink.line, 0.5);
        c.lineWidth = 1;
        c.beginPath();
        c.roundRect(a.x0 + 0.5, a.y0 + 0.5, a.x1 - a.x0, a.y1 - a.y0, 5);
        c.stroke();
      } else if (keep(b, 0.6)) {
        c.fillStyle = rgb(ink.line, 0.35);
        c.fillRect(a.x0, a.y0, (a.x1 - a.x0) * 0.4, 2);
        c.fillRect(a.x0, a.y0, 2, (a.y1 - a.y0) * 0.5);
      }
      c.strokeStyle = rgb(ink.silver, sharp ? 0.95 : 0.9);
      c.lineWidth = sharp ? 1.5 : 2;
      c.beginPath();
      c.roundRect(a.x0 - 3, a.y0 - 3, a.x1 - a.x0 + 6, a.y1 - a.y0 + 6, 7);
      if (sharp || keep(b, 0.7)) c.stroke();
      /* the other ground: the screen turned over, its marks in the ground's own ink */
      c.fillStyle = rgb(ink.line, sharp ? 0.92 : 0.8);
      if (sharp) {
        c.beginPath();
        c.roundRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0, 5);
        c.fill();
      } else for (let y = z.y0; y < z.y1; y += 4) if (b.r() < 0.55) c.fillRect(z.x0 + b.r() * 20, y, (z.x1 - z.x0) * (0.4 + b.r() * 0.6) - 10, 2);
      c.strokeStyle = rgb(ink.panel, 0.95);
      c.lineWidth = sharp ? 1.2 : 2;
      c.beginPath();
      const r = rng(5);
      for (let x = z.x0 + 8, y = (z.y0 + z.y1) / 2; x < z.x1 - 8; x += 5) {
        y = clamp(y + (r() - 0.5) * 6, z.y0 + 12, z.y1 - 8);
        c.lineTo(x, y);
      }
      c.stroke();
      type(b, dark ? 'Dark' : 'Light', a.x0, a.y1 + 12, { size: 8.5, share: 0.6 });
      type(b, dark ? 'Light' : 'Dark', z.x0, z.y1 + 12, { size: 8.5, hue: ink.secondary, share: 0.5 });
      if (!s.phone) type(b, 'Follow the system', z.x1 + 16, a.y0 + 12, { size: 8.5, hue: ink.secondary, share: 0.5 });
      /* the switches and the slider, by their words */
      const words = ['Sounds at the bell', 'Hover a strike to read it', 'Candles', 'Speak the alerts', 'Rail folded', 'Open on', 'Ruler', 'Seconds on the clock'];
      rowsY.forEach((y, i) => {
        prose(b, at.x0, y, Math.min(140, (at.x1 - at.x0) * 0.4), { hue: ink.secondary, a: 0.65, seed: 300 + i, share: 0.4 });
        if (sharp) type(b, words[i], at.x0, y - 9, { size: 7, hue: ink.muted });
        if (i === 2) {
          /* the candles' palettes: pairs of a rise and a fall */
          const pals: [string, string][] = [
            [ink.line, ink.blue],
            [ink.bull, ink.red],
            [ink.glacier, ink.cool],
            [ink.ember, ink.moon],
          ];
          pals.forEach(([up, down], k) => {
            const x = at.x1 - 150 + k * 38;
            for (let j = 0; j < 4; j++) {
              c.fillStyle = rgb(j % 2 ? down : up, 0.9);
              if (keep(b, 0.6)) c.fillRect(x + j * 6, y - 5 + (j % 2 ? 3 : 0), 3, 8 - (j % 2 ? 2 : 0));
            }
            if (k === 0 && sharp) {
              c.strokeStyle = rgb(ink.silver, 0.9);
              c.lineWidth = 1;
              c.strokeRect(x - 3.5, y - 8.5, 28, 17);
            }
          });
        } else if (i === 3) {
          /* a slider */
          const x0 = at.x1 - 150;
          c.fillStyle = rgb(ink.muted, 0.5);
          c.fillRect(x0, y - 1, 120, sharp ? 1 : 2);
          c.fillStyle = rgb(ink.line, 0.9);
          c.fillRect(x0, y - 1, 74, 2);
          if (keep(b, 0.8)) c.fillRect(x0 + 72, y - 5, 5, 10);
        } else if (i === 5 && !s!.phone) {
          /* a choice of three, the first picked */
          ['Pulse', 'Terrain', 'Trace'].forEach((w, k) => chip(b, at.x1 - 170 + k * 56, y, 50, { fill: k ? null : rgb(ink.line), edge: k ? rgb(ink.muted, 0.6) : null, word: w, wordInk: k ? rgb(ink.secondary) : rgb(ink.panel), h: 14 }));
        } else if (i !== 0 && keep(b, 0.65)) toggle(c, at.x1 - 30, y, i === 4 || i === 7 ? 0 : 1, (h, a2) => rgb(h, a2), s!, sharp);
      });
    },
    tick(f) {
      t = f.t;
      mini.tick(f.t, f.dt);
    },
    live: () => (screens.length && rowsY.length ? box(screens[0].x0, screens[0].y0, at.x1 + 2, rowsY[0] + 10) : null),
    /* the first switch turns over now and then; the ground in use shows a line walking */
    moving(p: Pen) {
      if (!s || !rowsY.length) return;
      toggle(p.c, at.x1 - 30, rowsY[0], flipOf(), p.ink, s, false);
      p.c.lineJoin = 'round';
      p.c.lineWidth = 2.2;
      p.c.strokeStyle = p.ink(s.ink.line, 0.95);
      mini.trace(p.c, t, 0, 0, 1);
      p.c.stroke();
    },
    sharp(c) {
      if (!s || !rowsY.length) return;
      toggle(c, at.x1 - 30, rowsY[0], flipOf(), (h, a) => rgb(h, a), s, true);
      c.lineJoin = 'round';
      c.lineWidth = 1.3;
      c.strokeStyle = rgb(s.ink.line);
      mini.trace(c, t, 0, 0, 0);
      c.stroke();
    },
  };
};

/* ---- THE ROOM: one chart, and the pointers of the others reading it — each with its letters, now and then one goes to
   another place on the line and marks it --------------------------------------------------------------------------- */

export const room = (pane: () => Box, yAt: (x: number, t: number) => number): Part => {
  let s: Stage | null = null;
  let t = 0;
  const who = ['JD', 'MK', 'AL', 'SR', 'TB'];
  const HOP = 3200;
  /* where reader i is at a moment: resting on the line at a share of the pane, gliding to the next every so often */
  const at = (i: number) => {
    const p = pane();
    const k = Math.floor((t + i * 800) / (HOP * 1.6));
    const q = clamp(((t + i * 800) % (HOP * 1.6)) / 900, 0, 1);
    const r0 = hash01(k * 7919 + i * 104729 + 17);
    const r1 = hash01((k + 1) * 7919 + i * 104729 + 17);
    const sh = lerp(0.12 + r0 * 0.76, 0.12 + r1 * 0.76, ease(q));
    const x = p.x0 + (p.x1 - p.x0) * sh;
    return { x, y: yAt(x, t) - 2, q, mark: q >= 1 ? ((t + i * 800) % (HOP * 1.6)) - 900 : -1 };
  };
  const inkOf = (st: Stage, i: number) => [st.ink.moon, st.ink.warn, st.ink.glacier, st.ink.ember, st.ink.blue][i % 5];
  const draw = (c: CanvasRenderingContext2D, ink: (h: string, a?: number) => string, sharp: boolean, words: boolean) => {
    if (!s) return;
    who.forEach((name, i) => {
      const { x, y, mark } = at(i);
      const hue = inkOf(s!, i);
      /* the mark it made where it stopped */
      if (mark >= 0 && mark < 1400) {
        const q = mark / 1400;
        c.strokeStyle = ink(hue, 1 - q);
        c.lineWidth = sharp ? 1.2 : 2;
        c.beginPath();
        c.arc(x, y + 2, 3 + q * 10, 0, Math.PI * 2);
        c.stroke();
      }
      c.beginPath();
      ARROW.forEach(([ax, ay], k) => (k ? c.lineTo(x + ax, y + ay) : c.moveTo(x + ax, y + ay)));
      c.closePath();
      c.fillStyle = ink(hue, 0.95);
      c.fill();
      if (sharp) {
        c.strokeStyle = rgb(s!.ink.panel);
        c.lineWidth = 1;
        c.stroke();
      }
      if (!words) return;
      c.font = `600 8px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      const w = c.measureText(name).width + 8;
      c.fillStyle = rgb(hue, 0.95);
      c.fillRect(x + 11, y + 15, w, 12);
      c.fillStyle = rgb(s!.ink.panel);
      c.fillText(name, x + 15, y + 21.5);
    });
  };
  return {
    place(_b, st) {
      s = st;
    },
    still() {},
    tick(f) {
      t = f.t;
    },
    live: () => {
      const p = pane();
      return box(p.x0 - 4, p.y0 - 30, p.x1 + 40, p.y1 + 30);
    },
    moving: (p: Pen) => draw(p.c, p.ink, false, !p.fringe),
    sharp: c => draw(c, (h, a) => rgb(h, a), true, true),
    sights: () => [{ x: at(0).x + 30, y: at(0).y - 20 }],
  };
};

/* ---- STATUS: the services and their word, the market's thirty days, a heartbeat --------------------------------- */

export const status = (): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let beatY = 0;
  let svcY = 0;
  let blockY = 0;
  let logY = 0;
  let blocks: { x: number; w: number; open: boolean; ms: number }[] = [];
  let t = 0;
  const BEAT = 1300;
  /* the trace's height at a moment: flat, then a blip each beat */
  const pulse = (ms: number) => {
    const q = ((ms % BEAT) + BEAT) % BEAT / BEAT;
    if (q < 0.06) return Math.sin((q / 0.06) * Math.PI) * 0.25;
    if (q < 0.1) return -Math.sin(((q - 0.06) / 0.04) * Math.PI) * 0.35;
    if (q < 0.14) return Math.sin(((q - 0.1) / 0.04) * Math.PI) * 1;
    if (q < 0.19) return -Math.sin(((q - 0.14) / 0.05) * Math.PI) * 0.45;
    return 0;
  };
  const trace = (c: CanvasRenderingContext2D, ink: (h: string, a?: number) => string, sharp: boolean) => {
    if (!s) return;
    const amp = s.phone ? 14 : 22;
    const span = at.x1 - at.x0;
    c.lineJoin = 'round';
    c.lineWidth = sharp ? 1.4 : 2.4;
    /* the line fades behind its head */
    const segs = 6;
    for (let k = 0; k < segs; k++) {
      c.beginPath();
      for (let x = at.x0 + (span * k) / segs; x <= at.x0 + (span * (k + 1)) / segs + 1; x += 2) {
        const ms = t - ((at.x1 - x) / span) * BEAT * 3.2;
        const y = beatY - pulse(ms) * amp;
        if (x === at.x0 + (span * k) / segs) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.strokeStyle = ink(s.ink.line, 0.2 + (0.8 * (k + 1)) / segs);
      c.stroke();
    }
    c.fillStyle = ink(s.ink.line);
    c.fillRect(at.x1 - 2, beatY - pulse(t) * amp - 2, 4, 4);
  };
  return {
    place(b, st) {
      s = st;
      at = b;
      const h = b.y1 - b.y0;
      beatY = b.y0 + (st.phone ? 34 : h * 0.16);
      svcY = b.y0 + h * 0.33;
      blockY = st.phone ? b.y0 + h * 0.52 : svcY + 4 * 22 + 6;
      logY = blockY + 52;
      const n = 30;
      const gap = st.phone ? 2 : 4;
      const w = (b.x1 - b.x0 - gap * (n - 1)) / n;
      blocks = Array.from({ length: n }, (_, i) => {
        const ms = Date.now() - (n - 1 - i) * 86_400_000;
        const wd = new Date(ms).getUTCDay();
        return { x: b.x0 + i * (w + gap), w, open: wd > 0 && wd < 6, ms };
      });
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      type(b, 'all systems normal', at.x0, at.y0 + 7, { size: 8, hue: ink.secondary, share: 0.5 });
      if (!s.phone)
        ['Website', 'Terminal', 'Market data', 'Alerts'].forEach((w, i) => {
          const y = svcY + i * 22;
          type(b, w, at.x0, y, { size: 9, share: 0.55 });
          type(b, 'Normal', at.x1, y, { size: 9, hue: ink.secondary, share: 0.5, align: 'right' });
          if (sharp) {
            c.fillStyle = rgb(ink.ink, 0.07);
            c.fillRect(at.x0, y + 11, at.x1 - at.x0, 1);
          }
        });
      /* the market's last thirty days: a block a day, the closed ones dim */
      const bh = 22;
      blocks.forEach(k => {
        c.fillStyle = rgb(k.open ? ink.silver : ink.muted, k.open ? (sharp ? 0.55 : 0.6) : sharp ? 0.16 : 0.2);
        if (keep(b, k.open ? 0.75 : 0.5)) {
          if (sharp) {
            c.beginPath();
            c.roundRect(k.x, blockY, k.w, bh, 2);
            c.fill();
          } else c.fillRect(k.x, blockY + (b.r() < 0.3 ? bh * 0.4 : 0), k.w, bh * (b.r() < 0.3 ? 0.6 : 1));
        }
      });
      type(b, "the market's last 30 days · gray is a closed market day", at.x0, blockY + bh + 10, { size: 7.5, hue: ink.muted, share: 0.4 });
      /* the changelog under it: a version, the room it touched, what changed */
      if (s.phone) return;
      type(b, 'Changelog', at.x0, logY, { size: 10, share: 0.6 });
      for (let i = 0, y = logY + 20; y < at.y1 - 4; i++, y += 20) {
        prose(b, at.x0, y, 40, { hue: ink.muted, a: 0.6, seed: 500 + i, share: 0.45 });
        c.fillStyle = rgb(ink.line, sharp ? 0.85 : 0.8);
        if (keep(b, 0.6)) c.fillRect(at.x0 + (at.x1 - at.x0) * 0.2, y - 4, 8, 8);
        prose(b, at.x0 + (at.x1 - at.x0) * 0.2 + 16, y, (at.x1 - at.x0) * (0.4 + ((i * 37) % 30) / 100), { hue: ink.secondary, a: 0.6, seed: 600 + i, share: 0.4 });
        if (sharp) {
          c.fillStyle = rgb(ink.ink, 0.06);
          c.fillRect(at.x0, y + 10, at.x1 - at.x0, 1);
        }
      }
    },
    tick(f) {
      t = f.t;
    },
    live: () => box(at.x0 - 4, beatY - 28, at.x1 + 6, beatY + 28),
    moving: (p: Pen) => trace(p.c, p.ink, false),
    sharp: c => trace(c, (h, a) => rgb(h, a), true),
    /* a day's block under the pointer says its day */
    read(c, _f, x, y): Pill[] | null {
      if (!s || y < blockY - 4 || y > blockY + 26) return null;
      const k = blocks.find(q => x >= q.x && x <= q.x + q.w + 3);
      if (!k) return null;
      c.strokeStyle = rgb(s.ink.line, 0.9);
      c.lineWidth = 1;
      c.strokeRect(k.x - 1.5, blockY - 1.5, k.w + 3, 25);
      return [{ x: k.x + k.w / 2, y: blockY - 12, text: `${dayWord(k.ms)} · ${k.open ? 'open' : 'closed'}`, anchor: 'mid' }];
    },
  };
};

/* ---- ABOUT: what moves a price is public, just scattered — the marks drift apart, then gather into one terminal --- */

export const gather = (o: { count?: number } = {}): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let marks: { sx: number; sy: number; tx: number; ty: number; w: number; h: number; hue: number; ph: number }[] = [];
  let t = 0;
  const CYCLE = 11000;
  /** how gathered the marks are now: whole at the cycle's start (the still frame is the terminal), apart in its middle */
  const g = () => {
    const q = (t % CYCLE) / CYCLE;
    if (q < 0.28) return 1;
    if (q < 0.42) return 1 - ease((q - 0.28) / 0.14);
    if (q < 0.62) return 0;
    if (q < 0.84) return ease((q - 0.62) / 0.22);
    return 1;
  };
  const pane = () => box(at.x0 + (at.x1 - at.x0) * 0.18, at.y0 + 20, at.x1 - (at.x1 - at.x0) * 0.12, at.y1 - 14);
  const draw = (c: CanvasRenderingContext2D, ink: (h: string, a?: number) => string, sharp: boolean) => {
    if (!s) return;
    const k = g();
    const hues = [s.ink.line, s.ink.blue, s.ink.red, s.ink.warn, s.ink.moon, s.ink.bull, s.ink.glacier];
    for (const m of marks) {
      const drift = (1 - k) * 6;
      const x = lerp(m.sx + Math.sin(t / 1300 + m.ph) * drift, m.tx, k);
      const y = lerp(m.sy + Math.cos(t / 1700 + m.ph) * drift, m.ty, k);
      c.fillStyle = ink(hues[m.hue], 0.9);
      c.fillRect(sharp ? x : Math.round(x / PIX) * PIX, y, m.w, m.h);
    }
  };
  return {
    place(b, st) {
      s = st;
      at = b;
      const p = pane();
      const r = rng(2026);
      const n = o.count ?? (st.phone ? 90 : 170);
      const wk = walk(77, { step: 300, gap: 3 });
      wk.place(p.x0 + 6, p.x1 - 6, p.y0 + (p.y1 - p.y0) * 0.14, p.y0 + (p.y1 - p.y0) * 0.56, 0);
      marks = Array.from({ length: n }, (_, i) => {
        const kind = i / n;
        let tx: number;
        let ty: number;
        let w = 2;
        let h = 2;
        let hue = 0;
        if (kind < 0.55) {
          /* the line */
          tx = p.x0 + 6 + (i / (n * 0.55)) * (p.x1 - p.x0 - 12);
          ty = wk.yAt(tx, 0);
          w = 3;
          h = 2;
        } else if (kind < 0.8) {
          /* the volume */
          const j = i - n * 0.55;
          tx = p.x0 + 6 + (j / (n * 0.25)) * (p.x1 - p.x0 - 12);
          h = 4 + r() * ((p.y1 - p.y0) * 0.22);
          ty = p.y1 - 4 - h;
          w = 2;
        } else {
          /* the levels */
          const j = i - n * 0.8;
          const row = j % 3;
          tx = p.x0 + 6 + r() * (p.x1 - p.x0 - 40);
          ty = p.y0 + (p.y1 - p.y0) * (0.22 + row * 0.13);
          w = 6 + r() * 18;
          h = 2;
          hue = 1 + row;
        }
        /* where it lies scattered: anywhere on the screen's band */
        return { sx: r() * s!.W, sy: at.y0 + r() * (at.y1 - at.y0), tx, ty, w, h, hue, ph: r() * 6.28 };
      });
    },
    still(b) {
      if (!s) return;
      const p = pane();
      frame(b, p, { a: 0.12, title: 'one terminal', grip: false });
      type(b, 'public · scattered', at.x0, at.y0 + 7, { size: 7.5, hue: b.ink.muted, share: 0.4 });
    },
    tick(f) {
      t = f.t;
    },
    live: () => box(0, at.y0 - 4, s ? s.W : at.x1, at.y1 + 4),
    moving: (p: Pen) => draw(p.c, p.ink, false),
    sharp: c => draw(c, (h, a) => rgb(h, a), true),
    sights: () => {
      const p = pane();
      return [{ x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2 }];
    },
  };
};

/* ---- THE LEGAL PAGES: a document — its title, its sections and their numbers in the margin, the line being read ----- */

export const doc = (): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let lines: { y: number; w: number; kind: 0 | 1 | 2; n: number }[] = [];
  let t = 0;
  const LH = 11;
  const readY = () => {
    const span = lines.length * LH;
    return at.y0 + 24 + ((t / 90) % Math.max(1, span));
  };
  return {
    place(b, st) {
      s = st;
      at = b;
      const r = rng(1789);
      lines = [];
      let y = b.y0 + 24;
      let sec = 0;
      while (y < b.y1 - 8) {
        if (lines.length === 0 || r() < 0.16) {
          sec++;
          if (lines.length) y += 6;
          lines.push({ y, w: 0.25 + r() * 0.2, kind: lines.length ? 1 : 0, n: sec });
        } else lines.push({ y, w: r() < 0.2 ? 0.3 + r() * 0.4 : 0.82 + r() * 0.18, kind: 2, n: sec });
        y += LH;
      }
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      const x = at.x0 + 26;
      const w = at.x1 - x - 10;
      type(b, 'Terms · Privacy · Risk · Refunds · Data', at.x0, at.y0 + 7, { size: 7.5, hue: ink.muted, share: 0.4 });
      c.fillStyle = rgb(ink.line, sharp ? 0.12 : 0.25);
      if (sharp) c.fillRect(at.x0 + 16, at.y0 + 20, 1, at.y1 - at.y0 - 24);
      lines.forEach((l, i) => {
        if (l.kind === 0) prose(b, x, l.y, w * 0.5, { hue: ink.line, a: 0.95, h: 4, seed: i, share: 0.7 });
        else if (l.kind === 1) {
          type(b, String(l.n), at.x0, l.y, { size: 7.5, hue: ink.line, share: 0.7 });
          prose(b, x, l.y, w * l.w, { hue: ink.line, a: 0.8, h: 3, seed: i, share: 0.6 });
        } else prose(b, x, l.y, w * l.w, { hue: ink.secondary, a: 0.5, h: 2, seed: i, share: 0.35 });
      });
    },
    tick(f) {
      t = f.t;
    },
    live: () => box(at.x0 + 20, at.y0 + 16, at.x1, at.y1 + 4),
    /* the line being read: a band down the page, and a caret at its end */
    moving(p: Pen) {
      if (!s) return;
      const y = readY();
      const l = lines.reduce((best, q) => (Math.abs(q.y - y) < Math.abs(best.y - y) ? q : best), lines[0]);
      if (!l) return;
      const x = at.x0 + 26;
      const w = (at.x1 - x - 10) * (l.kind === 0 ? 0.5 : l.w);
      if (!p.fringe) {
        p.c.fillStyle = p.ink(s.ink.silver, 0.12);
        p.c.fillRect(x - 4, l.y - 5, w + 8, 10);
      }
      p.c.fillStyle = p.ink(s.ink.line, 0.95);
      p.c.fillRect(x + w + 3, l.y - 5, 2, 10);
    },
    sharp(c) {
      if (!s) return;
      const y = readY();
      const l = lines.reduce((best, q) => (Math.abs(q.y - y) < Math.abs(best.y - y) ? q : best), lines[0]);
      if (!l) return;
      const x = at.x0 + 26;
      const w = (at.x1 - x - 10) * (l.kind === 0 ? 0.5 : l.w);
      c.fillStyle = rgb(s.ink.silver, 0.14);
      c.fillRect(x - 4, l.y - 5, w + 8, 10);
      c.fillStyle = rgb(s.ink.line);
      c.fillRect(x + w + 3, l.y - 5, 1.5, 10);
    },
    read(c, _f, x, y): Pill[] | null {
      if (!s || x < at.x0 || x > at.x1 || y < at.y0 + 18 || y > at.y1) return null;
      const l = lines.find(q => Math.abs(q.y - y) <= LH / 2);
      if (!l) return null;
      c.fillStyle = rgb(s.ink.ink, 0.07);
      c.fillRect(at.x0 + 22, l.y - 5, at.x1 - at.x0 - 22, 10);
      return [{ x: at.x0 + 12, y: l.y, text: `§ ${l.n}`, anchor: 'right' }];
    },
  };
};

/* ---- THE ACCOUNT FORMS: a card being filled in — an address typed, a password's dots, the door lit, again --------- */

export const account = (): Part => {
  let s: Stage | null = null;
  let card: Box = box(0, 0, 0, 0);
  let t = 0;
  const CYCLE = 7000;
  const fields = () => {
    const x0 = card.x0 + 16;
    const x1 = card.x1 - 16;
    const y = card.y0 + (card.y1 - card.y0) * 0.36;
    return [box(x0, y, x1, y + 22), box(x0, y + 40, x1, y + 62)];
  };
  const door = () => {
    const f = fields();
    return box(card.x0 + 16, f[1].y1 + 14, card.x1 - 16, f[1].y1 + 38);
  };
  const draw = (c: CanvasRenderingContext2D, ink: (h: string, a?: number) => string, sharp: boolean, fringe: boolean) => {
    if (!s) return;
    const q = (t % CYCLE) / CYCLE;
    const [e, pw] = fields();
    const typed = clamp(q / 0.35, 0, 1);
    const dots = clamp((q - 0.4) / 0.25, 0, 1);
    const press = q > 0.72 && q < 0.86;
    /* the address, a letter at a time */
    c.fillStyle = ink(s.ink.line, 0.9);
    const n = Math.floor(typed * 18);
    for (let i = 0; i < n; i++) c.fillRect(e.x0 + 8 + i * 6, e.y0 + 8, i === 6 ? 5 : 4, sharp ? 6 : 6);
    /* the password's dots */
    const m = Math.floor(dots * 10);
    for (let i = 0; i < m; i++) {
      c.beginPath();
      c.arc(pw.x0 + 11 + i * 9, (pw.y0 + pw.y1) / 2, sharp ? 2.5 : 3, 0, Math.PI * 2);
      c.fill();
    }
    /* the caret where the typing is */
    if (Math.floor(t / 530) % 2 === 0 && q < 0.7) {
      const cx = dots > 0 ? pw.x0 + 9 + m * 9 : e.x0 + 8 + n * 6;
      const cy = dots > 0 ? pw.y0 + 5 : e.y0 + 5;
      c.fillRect(cx, cy, sharp ? 1.5 : 2, 12);
    }
    /* the door, lit as it is pressed */
    if (press && !fringe) {
      const d = door();
      c.fillStyle = ink(s.ink.silver, 0.35);
      c.beginPath();
      c.roundRect(d.x0 - 2, d.y0 - 2, d.x1 - d.x0 + 4, d.y1 - d.y0 + 4, 14);
      c.fill();
    }
  };
  return {
    place(b, st) {
      s = st;
      const w = Math.min(260, b.x1 - b.x0);
      const h = Math.min(300, b.y1 - b.y0 - 8);
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      card = box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      if (sharp) frame(b, card, { a: 0.18, radius: 16, grip: false });
      else {
        c.strokeStyle = rgb(ink.line, 0.32);
        dashedCard(b, card, 16, 0.95);
      }
      type(b, 'slayer:~ $', card.x0 + 16, card.y0 + 16, { size: 8, share: 0.6 });
      c.fillStyle = rgb(ink.muted, 0.8);
      if (keep(b, 0.7)) c.fillRect(card.x0 + 66, card.y0 + 14, 4, 4);
      prose(b, card.x0 + 76, card.y0 + 16, 30, { hue: ink.muted, a: 0.7, seed: 4, share: 0.5 });
      prose(b, card.x0 + 16, card.y0 + 40, (card.x1 - card.x0) * 0.62, { hue: ink.line, a: 0.95, h: 5, seed: 8, share: 0.65 });
      prose(b, card.x0 + 16, card.y0 + 54, (card.x1 - card.x0) * 0.72, { hue: ink.secondary, a: 0.6, seed: 9, share: 0.45 });
      const [e, pw] = fields();
      ['Email', 'Password'].forEach((word, i) => {
        const f = i ? pw : e;
        type(b, word, f.x0, f.y0 - 7, { size: 7.5, hue: ink.secondary, share: 0.5 });
        if (sharp) {
          c.strokeStyle = rgb(ink.muted, 0.5);
          c.lineWidth = 1;
          c.beginPath();
          c.roundRect(f.x0 + 0.5, f.y0 + 0.5, f.x1 - f.x0 - 1, f.y1 - f.y0 - 1, 6);
          c.stroke();
        } else {
          c.strokeStyle = rgb(ink.line, 0.4);
          dashedCard(b, f, 6, 0.9);
        }
      });
      /* the door: the plain ink pill, an arrow on it */
      const d = door();
      c.fillStyle = rgb(ink.line, sharp ? 0.95 : 0.85);
      if (sharp) {
        c.beginPath();
        c.roundRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0, 12);
        c.fill();
      } else for (let y = d.y0 + 2; y < d.y1 - 2; y += 3) if (b.r() < 0.55) c.fillRect(d.x0 + 6 + b.r() * 20, y, (d.x1 - d.x0) * (0.5 + b.r() * 0.4), 2);
      c.strokeStyle = rgb(ink.panel, 0.95);
      c.lineWidth = sharp ? 1.4 : 2;
      const mx = (d.x0 + d.x1) / 2;
      const my = (d.y0 + d.y1) / 2;
      c.beginPath();
      c.moveTo(mx - 7, my);
      c.lineTo(mx + 6, my);
      c.moveTo(mx + 2, my - 4);
      c.lineTo(mx + 6, my);
      c.lineTo(mx + 2, my + 4);
      c.stroke();
    },
    /* the still frame is the card half filled in: the address typed, the password begun */
    tick(f) {
      t = f.t + CYCLE * 0.52;
    },
    live: () => box(card.x0, card.y0 + (card.y1 - card.y0) * 0.3, card.x1, card.y1),
    moving: (p: Pen) => draw(p.c, p.ink, false, p.fringe),
    sharp: c => draw(c, (h, a) => rgb(h, a), true, false),
  };
};

/* ---- AN INVITE: a dot on its way from the one who asked to the terminal, a line of dashes behind it; the terminal's
   screen lit when it lands ------------------------------------------------------------------------------------------- */

export const invite = (): Part => {
  let s: Stage | null = null;
  let a: Box = box(0, 0, 0, 0);
  let z: Box = box(0, 0, 0, 0);
  let t = 0;
  const CYCLE = 5200;
  const point = (u: number) => {
    const ax = a.x1 + 6;
    const ay = (a.y0 + a.y1) / 2;
    const zx = z.x0 - 6;
    const zy = (z.y0 + z.y1) / 2;
    const mx = (ax + zx) / 2;
    const my = Math.min(ay, zy) - (zx - ax) * 0.25;
    return { x: (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * zx, y: (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * zy };
  };
  const draw = (c: CanvasRenderingContext2D, ink: (h: string, a2?: number) => string, sharp: boolean) => {
    if (!s) return;
    const q = (t % CYCLE) / CYCLE;
    const u = ease(clamp(q / 0.62, 0, 1));
    c.fillStyle = ink(s.ink.line, 0.7);
    for (let k = 0; k <= u * 30; k++) {
      const p = point(k / 30);
      c.fillRect(p.x - 1, p.y - 1, sharp ? 2 : 2, 2);
    }
    const p = point(u);
    c.fillStyle = ink(s.ink.line);
    c.beginPath();
    c.arc(p.x, p.y, sharp ? 3.5 : 4, 0, Math.PI * 2);
    c.fill();
    if (q > 0.62 && q < 0.95) {
      const l = 1 - (q - 0.62) / 0.33;
      c.strokeStyle = ink(s.ink.silver, l);
      c.lineWidth = sharp ? 1.5 : 2.4;
      c.beginPath();
      c.roundRect(z.x0 - 4, z.y0 - 4, z.x1 - z.x0 + 8, z.y1 - z.y0 + 8, 9);
      c.stroke();
    }
  };
  return {
    place(b, st) {
      s = st;
      const h = Math.min(170, (b.y1 - b.y0) * 0.62);
      const cy = (b.y0 + b.y1) / 2 + 8;
      const w = Math.min(230, (b.x1 - b.x0) * 0.34);
      a = box(b.x0 + 4, cy - h / 2, b.x0 + 4 + w * 0.7, cy + h / 2);
      z = box(b.x1 - w - 4, cy - h / 2, b.x1 - 4, cy + h / 2);
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      if (sharp) {
        frame(b, a, { a: 0.18, radius: 10, grip: false });
        frame(b, z, { a: 0.18, radius: 10, grip: false });
      } else {
        c.strokeStyle = rgb(ink.line, 0.38);
        dashedCard(b, a, 10, 0.95);
        dashedCard(b, z, 10, 0.95);
      }
      /* the one who asked: a ring and a letter's place */
      c.strokeStyle = rgb(ink.moon, sharp ? 0.9 : 0.9);
      c.lineWidth = sharp ? 1.5 : 2.4;
      c.beginPath();
      c.arc((a.x0 + a.x1) / 2, a.y0 + (a.y1 - a.y0) * 0.38, 13, 0, Math.PI * 2);
      if (sharp || keep(b, 0.8)) c.stroke();
      prose(b, a.x0 + 12, a.y1 - 18, (a.x1 - a.x0) - 24, { hue: ink.secondary, a: 0.6, seed: 21, share: 0.5 });
      /* the terminal: a small chart in its screen */
      c.strokeStyle = rgb(ink.line, 0.9);
      c.lineWidth = sharp ? 1.2 : 2.2;
      c.beginPath();
      const r = rng(9);
      for (let x = z.x0 + 10, y = (z.y0 + z.y1) / 2; x < z.x1 - 10; x += 5) {
        y = clamp(y + (r() - 0.48) * 8, z.y0 + 16, z.y1 - 14);
        c.lineTo(x, y);
      }
      if (sharp) c.stroke();
      else {
        c.setLineDash([7, 5]);
        c.stroke();
        c.setLineDash([]);
      }
      type(b, 'slayer_terminal', z.x0 + 10, z.y0 + 10, { size: 7.5, hue: ink.secondary, share: 0.5 });
      /* the door under it */
      const mid = (a.x1 + z.x0) / 2;
      chip(b, mid - 42, z.y1 + 2, 84, { fill: rgb(ink.line), word: 'Sign up free', wordInk: rgb(ink.panel), h: 16, share: 1 });
    },
    tick(f) {
      t = f.t + CYCLE * 0.7;
    },
    live: () => box(a.x0 - 8, Math.min(a.y0, z.y0) - 60, z.x1 + 8, Math.max(a.y1, z.y1) + 8),
    moving: (p: Pen) => draw(p.c, p.ink, false),
    sharp: c => draw(c, (h, a2) => rgb(h, a2), true),
  };
};

/* ---- MAINTENANCE: the screen's test card — its colour bars, a line gone flat, a band sweeping down; back at a time -- */

export const testCard = (): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let t = 0;
  const bars = (st: Stage) => [st.ink.line, st.ink.ember, st.ink.glacier, st.ink.moon, st.ink.supreme, st.ink.warn, st.ink.blue];
  return {
    place(b, st) {
      s = st;
      at = b;
    },
    still(b) {
      if (!s) return;
      const { c, sharp } = b;
      const list = bars(s);
      const w = (at.x1 - at.x0) / list.length;
      const h = (at.y1 - at.y0) * 0.56;
      list.forEach((hue, i) => {
        c.fillStyle = rgb(hue, sharp ? 0.8 : 0.62);
        if (sharp) c.fillRect(at.x0 + i * w, at.y0 + 18, w, h);
        else for (let y = at.y0 + 18; y < at.y0 + 18 + h; y += 4) if (b.r() < 0.3) c.fillRect(at.x0 + i * w + b.r() * w * 0.4, y, w * (0.2 + b.r() * 0.5), 2);
      });
      /* under them the castellations, the order turned over */
      list
        .slice()
        .reverse()
        .forEach((hue, i) => {
          c.fillStyle = rgb(hue, sharp ? 0.6 : 0.6);
          if (keep(b, 0.6)) c.fillRect(at.x0 + i * w, at.y0 + 22 + h, w, 8);
        });
      /* the line gone flat */
      const y = at.y0 + 44 + h;
      c.fillStyle = rgb(b.ink.line, sharp ? 0.8 : 0.85);
      if (sharp) c.fillRect(at.x0, y, at.x1 - at.x0, 1.5);
      else for (let x = at.x0; x < at.x1; x += 10 + b.r() * 20) if (b.r() < 0.6) c.fillRect(x, y - 1, 6 + b.r() * 24, 2);
      type(b, 'back at 06:00 ET', at.x0, at.y0 + 7, { size: 8, hue: b.ink.secondary, share: 0.5 });
    },
    tick(f) {
      t = f.t;
    },
    live: () => box(at.x0, at.y0 + 14, at.x1, at.y1),
    /* the sweep, and the work's progress */
    moving(p: Pen) {
      if (!s) return;
      const h = (at.y1 - at.y0) * 0.56;
      const q = ((t + 1200) % 3600) / 3600;
      const y = at.y0 + 18 + q * h;
      p.c.fillStyle = p.ink(s.ink.ink, 0.12);
      if (!p.fringe) p.c.fillRect(at.x0, y, at.x1 - at.x0, 6);
      const prog = 0.25 + 0.6 * ((t % 16000) / 16000);
      p.c.fillStyle = p.ink(s.ink.line, 0.9);
      p.c.fillRect(at.x0, at.y1 - 4, (at.x1 - at.x0) * prog, 3);
    },
    sharp(c) {
      if (!s) return;
      const h = (at.y1 - at.y0) * 0.56;
      const q = ((t + 1200) % 3600) / 3600;
      c.fillStyle = rgb(s.ink.ink, 0.14);
      c.fillRect(at.x0, at.y0 + 18 + q * h, at.x1 - at.x0, 4);
      const prog = 0.25 + 0.6 * ((t % 16000) / 16000);
      c.fillStyle = rgb(s.ink.line);
      c.fillRect(at.x0, at.y1 - 4, (at.x1 - at.x0) * prog, 2);
    },
    read(_c, f, x, y): Pill[] | null {
      if (!s || x < at.x0 || x > at.x1 || y < at.y0 || y > at.y1) return null;
      return [{ x, y: at.y1 - 16, text: `now ${clock(f.wall, false)} ET`, anchor: 'mid' }];
    },
  };
};
