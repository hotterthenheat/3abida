/*
  THE FILE ON A NAME (components/layout/footer/parts/world.ts) — the Dossier's: the world as a field of dots, a pin on
  every city a story comes from, New York's open hours a band across it; a story lands — a ring where it broke, its arcs
  out to where it reaches. Beside it the story's card (its name, its lean, its kind, its words, the odds bar), and under
  it the earnings to come, day by day.
*/

import { bar, box, chip, clamp, dayWord, frame, keep, prose, rgb, rng, type, type Box, type Part, type Pen, type Pill, type Stage } from '../kit';

/* THE LAND, 96 × 40, from 76°N to 56°S and 170°W round to 190°E (world-atlas's land, sampled once — the picture never
   needs the atlas itself) */
const LAND = [
  '00080003fe00000807f00000', '10038fc0fd000001effffc04', '7ffe7f30f8007f3ffffffffe', '3fffff31e180effffffffff8',
  '7ffff040c001dffffffffe60', '187ff8780010cfffffffe180', '401ffefc00181fffffffc100', '001ffffc0007fffffffff000',
  '000ffff2000fffffffffe000', '000ffff00007fbdfffffc000', '000fffc0001c5acfffff0000', '0007ff80001817cffff92000',
  '0007ff80000f01fffff86000', '0003ff00001fdffffffc0000', '0000e100003fffdffffc0000', '00016080007fffe1fff80000',
  '00006080007ffef8fbe00000', '00003c90007ffff071c40000', '00000600007fff6061c40000', '00000200007fff8060420000',
  '000001f8003fffe000020000', '0000007e0011ffc000880000', '000000ff0000ff8000380000', '000000ff8000ff0000948000',
  '000000ffe0007f0000403000', '000000fff0007f0000103800', '0000007fe0007f0000000000', '0000007fe0007f2000019000',
  '0000003fe000fe600003f000', '0000001fc0007e40000ff840', '0000001f80007e40000ffc00', '0000003f00003c00000ffc00',
  '0000003f00003800000ffc00', '0000003e0000200000087c00', '0000003c0000000000001800', '000000300000000000000800',
  '000000700000000000000020', '000000700000000000000000', '000000600000000000000000', '000000100000000000000000',
];
const COLS = 96;
const ROWS = 40;
const land = (i: number, j: number) => {
  const row = LAND[j];
  const nib = parseInt(row[i >> 2], 16);
  return (nib >> (3 - (i & 3))) & 1;
};
/** a place on the grid, from its longitude and latitude */
const cell = (lon: number, lat: number) => ({ i: ((lon + 170 + 360) % 360) / (360 / COLS), j: (76 - lat) / (132 / ROWS) });

const CITIES: { name: string; lon: number; lat: number }[] = [
  { name: 'New York', lon: -74, lat: 40.7 },
  { name: 'San Francisco', lon: -122.4, lat: 37.8 },
  { name: 'Chicago', lon: -87.6, lat: 41.9 },
  { name: 'Toronto', lon: -79.4, lat: 43.7 },
  { name: 'London', lon: -0.1, lat: 51.5 },
  { name: 'Frankfurt', lon: 8.7, lat: 50.1 },
  { name: 'Veldhoven', lon: 5.4, lat: 51.4 },
  { name: 'Zurich', lon: 8.5, lat: 47.4 },
  { name: 'Dubai', lon: 55.3, lat: 25.2 },
  { name: 'Mumbai', lon: 72.9, lat: 19.1 },
  { name: 'Shenzhen', lon: 114.1, lat: 22.5 },
  { name: 'Taipei', lon: 121.5, lat: 25 },
  { name: 'Seoul', lon: 127, lat: 37.6 },
  { name: 'Tokyo', lon: 139.7, lat: 35.7 },
  { name: 'Singapore', lon: 103.8, lat: 1.35 },
  { name: 'São Paulo', lon: -46.6, lat: -23.5 },
  { name: 'Sydney', lon: 151.2, lat: -33.9 },
];

/* a story every so often, from city to city round the list; each reaches two or three others */
const STORY = 2600;
const storyOf = (k: number) => {
  const r = rng(k * 131 + 7);
  const from = Math.floor(r() * CITIES.length);
  const to = [1, 2, 3].slice(0, 2 + Math.floor(r() * 2)).map(() => Math.floor(r() * CITIES.length)).filter(c => c !== from);
  return { from, to, lean: r() < 0.55 ? 1 : r() < 0.7 ? 0 : -1 };
};

export const worldMap = (o: { band?: boolean; seed?: number; faint?: number } = {}): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let d = 4;
  let ox = 0;
  let oy = 0;
  let t = 0;
  const faint = o.faint ?? 1;
  const xy = (lon: number, lat: number) => {
    const q = cell(lon, lat);
    return { x: ox + q.i * d, y: oy + q.j * d };
  };
  const leanInk = (st: Stage, lean: number) => (lean > 0 ? st.ink.bull : lean < 0 ? st.ink.red : st.ink.warn);
  /* the story now, how far into it, and its arcs drawn out as far as they have reached */
  const draw = (c: CanvasRenderingContext2D, ink: (h: string, a?: number) => string, sharp: boolean) => {
    if (!s) return;
    const k = Math.floor(t / STORY);
    for (const back of [1, 0]) {
      const st = storyOf(k - back);
      const age = (t % STORY) + back * STORY;
      const from = CITIES[st.from];
      const a = xy(from.lon, from.lat);
      const hue = leanInk(s, st.lean);
      /* the ring where it broke */
      if (age < 1800) {
        const q = age / 1800;
        c.strokeStyle = ink(hue, (1 - q) * 0.95);
        c.lineWidth = sharp ? 1.2 : 2.2;
        c.beginPath();
        c.arc(a.x, a.y, 3 + q * 20, 0, Math.PI * 2);
        c.stroke();
      }
      /* its pin, lit while it is the news */
      const lit = Math.max(0, 1 - age / (STORY * 1.6));
      c.fillStyle = ink(hue, 0.5 + 0.5 * lit);
      c.beginPath();
      c.arc(a.x, a.y, sharp ? 3.5 : 4, 0, Math.PI * 2);
      c.fill();
      /* its arcs, out to where it reaches, then fading */
      const grow = clamp((age - 200) / 1100, 0, 1);
      const fade = clamp(1 - (age - 2600) / 1600, 0, 1);
      if (grow <= 0 || fade <= 0) continue;
      for (const ti of st.to) {
        const to = CITIES[ti];
        const b = xy(to.lon, to.lat);
        const mx = (a.x + b.x) / 2;
        const my = Math.min(a.y, b.y) - Math.abs(b.x - a.x) * 0.22 - 6;
        c.strokeStyle = ink(s.ink.line, 0.55 * fade);
        c.lineWidth = sharp ? 1 : 2;
        c.beginPath();
        const steps = 24;
        for (let i = 0; i <= steps * grow; i++) {
          const u = i / steps;
          const x = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x;
          const y = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * my + u * u * b.y;
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.stroke();
        if (grow >= 1) {
          c.fillStyle = ink(s.ink.line, 0.8 * fade);
          c.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
        }
      }
    }
  };
  return {
    place(b, st) {
      s = st;
      at = b;
      d = Math.min((b.x1 - b.x0) / COLS, (b.y1 - b.y0) / ROWS);
      ox = b.x0 + ((b.x1 - b.x0) - d * COLS) / 2;
      oy = b.y0 + ((b.y1 - b.y0) - d * ROWS) / 2;
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      /* the land, a dot a cell; broken, a share of it */
      for (let j = 0; j < ROWS; j++)
        for (let i = 0; i < COLS; i++) {
          if (!land(i, j)) continue;
          if (!keep(b, 0.62)) continue;
          c.fillStyle = rgb(ink.line, (sharp ? 0.42 : 0.5) * faint);
          const x = ox + i * d + d / 2;
          const y = oy + j * d + d / 2;
          if (sharp) c.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
          else c.fillRect(x - 1, y - 1, 2, 2);
        }
      /* NEW YORK'S HOURS: the open market's band over the Americas */
      if (o.band !== false) {
        const l = xy(-128, 0).x;
        const r = xy(-58, 0).x;
        if (sharp) {
          c.fillStyle = rgb(ink.ink, 0.05);
          c.fillRect(l, oy + d * 4, r - l, d * (ROWS - 8));
          c.fillStyle = rgb(ink.ink, 0.16);
          c.fillRect(l, oy + d * 4, 1, d * (ROWS - 8));
          c.fillRect(r, oy + d * 4, 1, d * (ROWS - 8));
        } else {
          c.fillStyle = rgb(ink.line, 0.28);
          for (let y = oy + d * 4; y < oy + d * (ROWS - 4); y += 7 + b.r() * 12) {
            if (b.r() < 0.5) c.fillRect(l - 1, y, 2, 3 + b.r() * 8);
            if (b.r() < 0.5) c.fillRect(r - 1, y, 2, 3 + b.r() * 8);
          }
        }
        type(b, 'NEW YORK · OPEN', l + 8, oy + d * 9, { size: 7.5, hue: ink.secondary, share: 0.4 });
      }
      /* every city a story comes from: a pin */
      CITIES.forEach((city, i) => {
        if (!keep(b, 0.6)) return;
        const p = xy(city.lon, city.lat);
        c.fillStyle = rgb(i % 3 === 0 ? ink.red : i % 3 === 1 ? ink.bull : ink.warn, sharp ? 0.55 : 0.6);
        c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      });
    },
    tick(f) {
      t = f.t + STORY * 0.55;
    },
    live: () => box(at.x0 - 4, at.y0 - 4, at.x1 + 4, at.y1 + 4),
    moving(p: Pen) {
      draw(p.c, p.ink, false);
    },
    sharp(c) {
      draw(c, (h, a) => rgb(h, a), true);
    },
    /* a city under the pointer says its name */
    read(c, _f, x, y): Pill[] | null {
      if (!s || x < at.x0 || x > at.x1 || y < at.y0 || y > at.y1) return null;
      let best = -1;
      let dist = 18;
      CITIES.forEach((city, i) => {
        const p = xy(city.lon, city.lat);
        const dd = Math.hypot(p.x - x, p.y - y);
        if (dd < dist) {
          dist = dd;
          best = i;
        }
      });
      if (best < 0) return null;
      const p = xy(CITIES[best].lon, CITIES[best].lat);
      c.strokeStyle = rgb(s.ink.line, 0.9);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(p.x, p.y, 6, 0, Math.PI * 2);
      c.stroke();
      return [{ x: p.x + 10, y: p.y, text: CITIES[best].name, anchor: 'left' }];
    },
    sights: () => {
      const st = storyOf(Math.floor(t / STORY));
      const city = CITIES[st.from];
      const p = xy(city.lon, city.lat);
      return [{ x: p.x + 2, y: p.y + 2 }];
    },
  };
};

/* ---- THE STORY'S CARD: its name, its lean and its kind, its words, the odds of the next session, where it lands ---- */

export const story = (): Part => {
  let at: Box = box(0, 0, 0, 0);
  let s: Stage | null = null;
  return {
    place(b, st) {
      at = b;
      s = st;
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      const w = at.x1 - at.x0;
      let y = at.y0 + 8;
      frame(b, at, { a: 0.1, radius: 6, grip: false });
      const x = at.x0 + 10;
      type(b, 'ASML', x, y + 2, { size: 9, share: 0.6 });
      chip(b, x + 34, y + 2, 56, { edge: rgb(ink.red, 0.8), word: 'NEGATIVE', wordInk: rgb(ink.red), h: 12 });
      if (w > 200) chip(b, x + 96, y + 2, 58, { edge: rgb(ink.ember, 0.8), word: 'EARNINGS', wordInk: rgb(ink.ember), h: 12 });
      y += 20;
      /* the headline, then the story */
      for (let i = 0; i < 2; i++) prose(b, x, y + i * 11, (w - 24) * (i ? 0.62 : 1), { hue: ink.line, a: 0.85, h: 3, seed: 40 + i, share: 0.55 });
      y += 30;
      for (let i = 0; i < 3; i++) prose(b, x, y + i * 9, (w - 24) * [1, 0.9, 0.55][i], { hue: ink.secondary, a: 0.55, seed: 50 + i, share: 0.4 });
      y += 34;
      /* the odds of the next session: down and up, one bar */
      type(b, 'ODDS NEXT SESSION', x, y, { size: 7, hue: ink.muted, share: 0.35 });
      y += 10;
      const split = 0.78;
      c.fillStyle = rgb(ink.red, sharp ? 0.85 : 0.8);
      bar(b, x, y, (w - 20) * split, sharp ? 3 : 4, 0.8);
      c.fillStyle = rgb(ink.bull, sharp ? 0.85 : 0.8);
      bar(b, x + (w - 20) * split + 2, y, (w - 20) * (1 - split) - 2, sharp ? 3 : 4, 0.8);
      y += 16;
      /* where it lands */
      if (at.y1 - y > 30) {
        type(b, 'WHERE IT LANDS', x, y, { size: 7, hue: ink.muted, share: 0.35 });
        y += 11;
        for (let i = 0; i < 4 && y < at.y1 - 8; i++, y += 11) {
          prose(b, x, y, w * 0.32, { hue: ink.secondary, a: 0.5, seed: 70 + i, share: 0.35 });
          c.fillStyle = rgb(ink.red, sharp ? 0.8 : 0.75);
          bar(b, x + w * 0.42, y - 1.5, (w * 0.48) * [0.9, 0.62, 0.5, 0.48][i], sharp ? 2 : 3, 0.6);
        }
      }
    },
  };
};

/* ---- THE EARNINGS TO COME: the next two weeks' market days, the reports in each (before the open, after the close) - */

export const strip = (o: { days?: number } = {}): Part => {
  let at: Box = box(0, 0, 0, 0);
  let days: { word: string; marks: number[] }[] = [];
  return {
    place(b, st) {
      at = b;
      const n = o.days ?? (st.phone ? 5 : 10);
      const r = rng(17);
      days = [];
      for (let d = 0, ms = Date.now(); days.length < n; d++) {
        const when = ms + d * 86_400_000;
        const wd = new Date(when).getUTCDay();
        if (wd === 0 || wd === 6) continue;
        days.push({ word: dayWord(when), marks: Array.from({ length: Math.floor(r() * 4) }, () => (r() < 0.5 ? 0 : 1)) });
      }
    },
    still(b) {
      const { c, sharp, ink } = b;
      const n = days.length;
      const gap = 6;
      const cw = (at.x1 - at.x0 - gap * (n - 1)) / n;
      days.forEach((day, i) => {
        const x = at.x0 + i * (cw + gap);
        frame(b, box(x, at.y0, x + cw, at.y1), { a: i ? 0.1 : 0.3, radius: 4, grip: false });
        if (!sharp && keep(b, 0.3)) {
          c.fillStyle = rgb(ink.line, 0.25);
          c.fillRect(x, at.y1 - 2, cw * 0.5, 2);
        }
        type(b, day.word, x + 5, at.y0 + 8, { size: 7.5, hue: i ? ink.secondary : ink.line, share: 0.45 });
        day.marks.forEach((m, k) => {
          c.fillStyle = rgb(m ? ink.moon : ink.ember, sharp ? 0.9 : 0.85);
          if (keep(b, 0.7)) c.fillRect(x + 5 + k * 9, at.y1 - 10, 6, 6);
        });
      });
    },
  };
};

/* ---- THE WIRE: the stories as rows — when, the name, its kind, its lean, its headline -------------------------------- */

const KINDS: [string, 'ember' | 'blue' | 'moon' | 'glacier'][] = [
  ['EARNINGS', 'ember'],
  ['GUIDANCE', 'blue'],
  ['ANALYST', 'moon'],
  ['MACRO', 'glacier'],
];
export const wire = (): Part => {
  let at: Box = box(0, 0, 0, 0);
  return {
    place(b) {
      at = b;
    },
    still(b) {
      const { c, sharp, ink } = b;
      const r = rng(616);
      const gap = 15;
      const w = at.x1 - at.x0;
      for (let i = 0, y = at.y0 + 6; y < at.y1 - 4; i++, y += gap) {
        const [kind, hue] = KINDS[i % KINDS.length];
        const lean = r();
        prose(b, at.x0, y, 22, { hue: ink.muted, a: 0.6, seed: i + 200, share: 0.4 });
        type(b, ['ASML', 'AMZN', 'PG', 'NVDA', 'TSM'][i % 5], at.x0 + 30, y, { size: 8, share: 0.55 });
        type(b, kind, at.x0 + 66, y, { size: 7, hue: ink[hue], share: 0.45 });
        c.fillStyle = rgb(lean < 0.5 ? ink.red : ink.bull, sharp ? 0.85 : 0.8);
        if (keep(b, 0.6)) c.fillRect(at.x0 + 124, y - 2, 30, sharp ? 3 : 4);
        prose(b, at.x0 + 164, y, (w - 170) * (0.6 + r() * 0.4), { hue: ink.secondary, a: 0.55, seed: i + 300, share: 0.4 });
        if (sharp) {
          c.fillStyle = rgb(ink.ink, 0.05);
          c.fillRect(at.x0, y + 7, w, 1);
        }
      }
    },
  };
};
