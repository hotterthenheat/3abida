/*
  THE BOOK (components/layout/footer/parts/book.ts) — Pinpoint's: the strikes down the side, the dealers' exposure
  across (a figure gone to a mark, and a bar under it in its side's ink: the puts warm, the calls cool), the walls bright
  and named, the supreme in its magenta, the flip a grey line of dashes, the spot a line that drifts between the strikes
  with the clock on its tag — and beside it the range into the close: the day so far, and from now to the bell a cone the
  price is expected to keep inside.
*/

import { FONT, PIX, bar, box, clock, frame, keep, rgb, rng, type, walk, type Box, type Frame, type Part, type Pen, type Pill, type Stage } from '../kit';

interface Row {
  y: number;
  put: number;
  call: number;
  cells: { m: number; sign: number; fig: number }[];
  label: string;
  hue: 'supreme' | 'red' | 'blue' | 'muted' | '';
}

export const book = (o: { seed?: number; groups?: string[] } = {}): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let rows: Row[] = [];
  let groups: string[] = [];
  let rh = 13;
  let strikeW = 0;
  /* the GEX column: a spine, the puts' bar to its left, the calls' to its right — the book's horizontal strike bars */
  let gx0 = 0;
  let gx1 = 0;
  let spine = 0;
  let cols: { x: number; w: number }[] = [];
  let flipAt = 0;
  let t = 0;
  const head = 30;
  /** the spot, between which strikes it stands now: it drifts, a strike or two either way */
  const spotY = () => {
    const n = rows.length;
    const base = n * 0.52;
    const drift = Math.sin(t / 5200) * 1.3 + Math.sin(t / 2100 + 1) * 0.45;
    return at.y0 + head + (base + drift) * rh;
  };
  return {
    place(b, st) {
      s = st;
      at = b;
      const w = b.x1 - b.x0;
      groups = st.phone ? [] : (o.groups ?? ['DEX', 'VANNA', 'CHARM']);
      rh = st.phone ? 11 : 13;
      strikeW = w * (st.phone ? 0.22 : 0.15);
      gx0 = b.x0 + strikeW;
      gx1 = st.phone ? b.x1 : b.x0 + w * 0.6;
      spine = (gx0 + gx1) / 2;
      const cw = groups.length ? (b.x1 - gx1 - 8) / groups.length : 0;
      cols = groups.map((_, i) => ({ x: gx1 + 14 + i * cw, w: cw - 14 }));
      const n = Math.max(6, Math.floor((b.y1 - b.y0 - head) / rh));
      const r = rng(o.seed ?? 515);
      const supreme = Math.floor(n * 0.2);
      const putWall = Math.floor(n * 0.66);
      const callWall = Math.floor(n * 0.34);
      const pin = Math.floor(n * 0.8);
      flipAt = Math.floor(n * 0.58);
      rows = Array.from({ length: n }, (_, i) => {
        const near = Math.max(0, 1 - Math.abs(i - n * 0.52) / (n * 0.7));
        const wall = i === supreme || i === putWall || i === callWall;
        const lean = i < n * 0.52 ? 0.75 : 1.25;
        return {
          y: b.y0 + head + i * rh,
          put: Math.min(1, (wall ? 0.75 + r() * 0.25 : near * (0.2 + r() * 0.55)) * (i === callWall ? 0.5 : lean)),
          call: Math.min(1, (wall ? 0.75 + r() * 0.25 : near * (0.2 + r() * 0.55)) * (i === putWall ? 0.5 : 2 - lean)),
          cells: cols.map(() => ({ m: Math.min(1, (wall ? 0.7 : 0) + near * (0.1 + r() * 0.5)), sign: r() < (i < n * 0.52 ? 0.35 : 0.7) ? 1 : -1, fig: 0.4 + r() * 0.6 })),
          label: i === supreme ? 'SUPREME' : i === putWall ? 'PUT WALL' : i === callWall ? 'CALL WALL' : i === pin ? 'PIN' : '',
          hue: i === supreme ? 'supreme' : i === putWall ? 'red' : i === callWall ? 'blue' : i === pin ? 'muted' : '',
        } as Row;
      });
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      /* the heads */
      type(b, 'STRIKE', at.x0, at.y0 + 7, { size: 7.5, hue: ink.muted, share: 0.4 });
      type(b, 'GEX', spine, at.y0 + 7, { size: 8, hue: ink.secondary, share: 0.5, align: 'center' });
      type(b, 'PUT', spine - 8, at.y0 + 19, { size: 6.5, hue: ink.warn, share: 0.35, align: 'right' });
      type(b, 'CALL', spine + 8, at.y0 + 19, { size: 6.5, hue: ink.blue, share: 0.35 });
      groups.forEach((g, i) => {
        const col = cols[i];
        if (sharp && i % 2 === 0) {
          c.fillStyle = rgb(ink.ink, 0.025);
          c.fillRect(col.x - 7, at.y0, col.w + 14, at.y1 - at.y0);
        }
        type(b, g, col.x + col.w, at.y0 + 7, { size: 8, hue: ink.secondary, share: 0.5, align: 'right' });
        type(b, 'NET', col.x + col.w, at.y0 + 19, { size: 6.5, hue: ink.muted, share: 0.3, align: 'right' });
      });
      if (sharp) {
        c.fillStyle = rgb(ink.ink, 0.1);
        c.fillRect(at.x0, at.y0 + head - 4, at.x1 - at.x0, 1);
        c.fillStyle = rgb(ink.ink, 0.12);
        c.fillRect(Math.round(spine), at.y0 + head - 2, 1, at.y1 - at.y0 - head);
      }
      const half = (gx1 - gx0) / 2 - 4;
      rows.forEach((row, i) => {
        const mid = row.y + rh / 2;
        const heavy = !!row.label && row.label !== 'PIN';
        /* the strike's mark, and its name where it has one */
        c.fillStyle = rgb(ink.line, sharp ? 0.6 : 0.7);
        if (keep(b, 0.55)) c.fillRect(at.x0, mid - 1, 12, 2);
        if (row.label && row.hue) type(b, row.label, at.x0 + 18, mid, { size: 6.5, hue: ink[row.hue], share: 0.65 });
        /* THE STRIKE BARS: the puts warm to the left of the spine, the calls cool to its right; a wall bright, the supreme
           in its magenta */
        const h = heavy ? 6 : 4;
        /* broken, a bar is whole or gone (the book's bars are what the picture is of) */
        c.fillStyle = rgb(row.hue === 'supreme' ? ink.supreme : ink.warn, heavy ? 1 : sharp ? 0.75 : 0.72);
        if (keep(b, heavy ? 0.98 : 0.62)) c.fillRect(spine - 2 - half * row.put, mid - h / 2, half * row.put, h);
        c.fillStyle = rgb(row.hue === 'supreme' ? ink.supreme : ink.blue, heavy ? 1 : sharp ? 0.75 : 0.72);
        if (keep(b, heavy ? 0.98 : 0.62)) c.fillRect(spine + 2, mid - h / 2, half * row.call, h);
        /* the other greeks: a net figure gone to a mark, a bar under it in its sign's ink */
        row.cells.forEach((cell, k) => {
          const col = cols[k];
          c.fillStyle = rgb(heavy ? ink.line : ink.secondary, sharp ? 0.7 : 0.6);
          if (keep(b, heavy ? 0.6 : 0.3)) c.fillRect(col.x + col.w * (1 - cell.fig * 0.6), mid - 3, col.w * cell.fig * 0.6, 2);
          c.fillStyle = rgb(cell.sign > 0 ? ink.bull : ink.red, heavy ? 0.9 : sharp ? 0.55 : 0.6);
          bar(b, col.x, mid + 2, col.w * cell.m, 2, heavy ? 0.8 : 0.35);
        });
        /* THE FLIP: a grey line of dashes between two strikes, its word at the side */
        if (i === flipAt) {
          c.fillStyle = rgb(ink.flip, sharp ? 0.75 : 0.8);
          for (let x = at.x0 + strikeW - 8; x < at.x1; x += sharp ? 6 : 9) if (keep(b, 0.6)) c.fillRect(x, row.y - 1, sharp ? 3 : 4, sharp ? 1 : 2);
          type(b, 'flip', at.x0 + 18, row.y - 1, { size: 7, hue: ink.flip, share: 0.65 });
        }
        if (sharp && i % 2) {
          c.fillStyle = rgb(ink.ink, 0.02);
          c.fillRect(at.x0, row.y, at.x1 - at.x0, rh);
        }
      });
      /* the walls run on under the words, faint */
      rows.forEach(row => {
        if (!row.label || row.label === 'PIN' || !row.hue) return;
        const y = row.y + rh / 2;
        c.fillStyle = rgb(ink[row.hue], sharp ? 0.2 : 0.3);
        if (sharp) c.fillRect(0, y, at.x0 - 6, 1);
        else for (let x = b.r() * 30; x < at.x0 - 6; x += 30 + b.r() * 90) if (b.r() < 0.45) c.fillRect(x, y - 0.5, 6 + b.r() * 24, 2);
      });
    },
    tick(f) {
      t = f.t;
    },
    live: () => box(at.x0 - 4, at.y0 + head - 10, at.x1 + 80, at.y1 + 8),
    /* THE SPOT: a line across between the strikes, run out to its tag (the clock) */
    moving(p: Pen, f: Frame) {
      if (!s) return;
      const { c } = p;
      const y = Math.round(spotY());
      c.fillStyle = p.ink(s.ink.line, 0.95);
      c.fillRect(at.x0 + strikeW - 6, y - 1, at.x1 - at.x0 - strikeW + 12, 2);
      if (p.fringe) return;
      const word = clock(f.wall, f.seconds);
      c.font = `600 10px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      const w = c.measureText(word).width + 12;
      c.strokeStyle = rgb(s.ink.line);
      c.lineWidth = 2;
      c.strokeRect(at.x1 + 8, y - 8, w, 16);
      c.fillText(word, at.x1 + 14, y + 0.5);
    },
    sharp(c, f) {
      if (!s) return;
      const y = Math.round(spotY()) + 0.5;
      c.strokeStyle = rgb(s.ink.line, 0.8);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(at.x0 + strikeW - 6, y);
      c.lineTo(at.x1 + 6, y);
      c.stroke();
      const word = clock(f.wall, f.seconds);
      c.font = `500 10.5px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      const w = c.measureText(word).width + 14;
      c.fillStyle = rgb(s.ink.line);
      c.beginPath();
      c.roundRect(at.x1 + 8, y - 9, w, 18, 3);
      c.fill();
      c.fillStyle = rgb(s.ink.panel);
      c.fillText(word, at.x1 + 15, y);
    },
    /* a strike under the pointer: its row lit, and where it stands from the spot */
    read(c, _f, x, y): Pill[] | null {
      if (!s || x < at.x0 || x > at.x1 || y < at.y0 + head || y > at.y1) return null;
      const i = Math.floor((y - at.y0 - head) / rh);
      const row = rows[i];
      if (!row) return null;
      c.fillStyle = rgb(s.ink.ink, 0.08);
      c.fillRect(at.x0 - 4, row.y, at.x1 - at.x0 + 8, rh);
      const from = Math.round((spotY() - (row.y + rh / 2)) / rh);
      const where = from === 0 ? 'at the spot' : `${Math.abs(from)} ${Math.abs(from) === 1 ? 'strike' : 'strikes'} ${from > 0 ? 'above' : 'below'}`;
      return [{ x: at.x0 + strikeW - 4, y: row.y + rh / 2, text: row.label ? `${row.label.toLowerCase()} · ${where}` : where, anchor: 'right' }];
    },
    sights: () => [
      { x: spine - (gx1 - gx0) * 0.2, y: (rows[Math.floor(rows.length * 0.66)]?.y ?? at.y0) + rh / 2 },
      { x: at.x1 - 30, y: spotY() },
    ],
  };
};

/* ---- THE RANGE INTO THE CLOSE: the day so far, and from now to the bell the cone the price is expected to keep in -- */

export const cone = (o: { seed?: number; now?: number } = {}): Part => {
  const wk = walk(o.seed ?? 727, { step: 420, gap: 3, kick: 0.8 });
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let nowX = 0;
  let t = 0;
  const half = () => (at.y1 - at.y0) * 0.42;
  /** the cone's edge at x: from the price now, opening as the square root of the time left */
  const edge = (x: number, sigma: number) => Math.sqrt(Math.max(0, (x - nowX) / (at.x1 - nowX))) * half() * sigma;
  const drawCone = (c: CanvasRenderingContext2D, ink: (h: string, a?: number) => string, sharp: boolean) => {
    if (!s) return;
    const cy = wk.headY(t);
    for (const [sig, a] of [
      [0.95, 0.07],
      [0.55, 0.11],
    ] as const) {
      c.beginPath();
      for (let x = nowX; x <= at.x1; x += 4) c.lineTo(x, cy - edge(x, sig));
      for (let x = at.x1; x >= nowX; x -= 4) c.lineTo(x, cy + edge(x, sig));
      c.closePath();
      if (sharp) {
        c.fillStyle = ink(s.ink.silver, a);
        c.fill();
      }
      /* broken, the cone is its two edges in dashes */
      c.strokeStyle = ink(s.ink.silver, sig > 0.9 ? 0.4 : 0.75);
      c.lineWidth = sharp ? 1 : 2;
      if (!sharp) c.setLineDash([5, 7]);
      c.stroke();
      c.setLineDash([]);
    }
  };
  return {
    place(b, st) {
      s = st;
      at = b;
      nowX = b.x0 + (b.x1 - b.x0) * (o.now ?? 0.42);
      const h = b.y1 - b.y0;
      wk.place(b.x0, nowX, b.y0 + h * 0.3, b.y0 + h * 0.7, t);
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      if (sharp) {
        c.strokeStyle = rgb(ink.ink, 0.1);
        c.lineWidth = 1;
        c.strokeRect(Math.round(at.x0) + 0.5, Math.round(at.y0) + 0.5, Math.round(at.x1 - at.x0), Math.round(at.y1 - at.y0));
      }
      type(b, 'TO THE CLOSE', at.x0 + 8, at.y0 + 9, { size: 7.5, hue: ink.secondary, share: 0.5 });
      /* now, and the bell */
      c.fillStyle = rgb(ink.line, sharp ? 0.35 : 0.45);
      for (let y = at.y0 + 4; y < at.y1 - 4; y += sharp ? 5 : 8) if (keep(b, 0.6)) c.fillRect(nowX, y, sharp ? 1 : 2, sharp ? 2 : 3);
      c.fillStyle = rgb(ink.line, sharp ? 0.5 : 0.6);
      for (let y = at.y0 + 4; y < at.y1 - 4; y += sharp ? 4 : 6) if (keep(b, 0.7)) c.fillRect(at.x1 - 2, y, sharp ? 1 : 2, sharp ? 2 : 3);
      type(b, 'now', nowX + 4, at.y1 - 8, { size: 7.5, hue: ink.muted, share: 0.5 });
      type(b, '16:00', at.x1 - 6, at.y1 - 8, { size: 7.5, hue: ink.line, share: 0.6, align: 'right' });
    },
    tick(f) {
      t = f.t;
      wk.tick(f.t, f.dt);
    },
    live: () => box(at.x0 - 4, at.y0 - 4, at.x1 + 4, at.y1 + 4),
    moving(p: Pen) {
      if (!s) return;
      const { c } = p;
      drawCone(c, p.ink, false);
      c.lineJoin = 'round';
      c.lineWidth = 2.6;
      c.strokeStyle = p.ink(s.ink.line);
      wk.trace(c, t, 0, 0, 1.4);
      c.stroke();
      c.fillStyle = p.ink(s.ink.line);
      c.fillRect(nowX - PIX, wk.headY(t) - PIX, PIX * 2, PIX * 2);
    },
    sharp(c) {
      if (!s) return;
      drawCone(c, (h, a) => rgb(h, a), true);
      c.lineJoin = 'round';
      c.lineWidth = 1.5;
      c.strokeStyle = rgb(s.ink.line);
      wk.trace(c, t, 0, 0, 0);
      c.stroke();
      c.fillStyle = rgb(s.ink.line);
      c.beginPath();
      c.arc(nowX, wk.headY(t), 3, 0, Math.PI * 2);
      c.fill();
    },
    /* the pointer reads the moment ahead: how long until it */
    read(c, f, x, y): Pill[] | null {
      if (!s || x < at.x0 || x > at.x1 || y < at.y0 || y > at.y1) return null;
      c.strokeStyle = rgb(s.ink.ink, 0.38);
      c.lineWidth = 1;
      c.setLineDash([2, 4]);
      c.beginPath();
      c.moveTo(Math.round(x) + 0.5, at.y0);
      c.lineTo(Math.round(x) + 0.5, at.y1);
      c.stroke();
      c.setLineDash([]);
      if (x <= nowX) return [{ x, y: at.y1 - 10, text: clock(f.wall - wk.ago(x) * 6, false), anchor: 'mid' }];
      const left = (x - nowX) / (at.x1 - nowX);
      return [{ x, y: at.y1 - 10, text: left > 0.96 ? 'the bell' : `${Math.round(left * 100)}% of the way to the bell`, anchor: 'mid' }];
    },
    sights: () => [{ x: nowX + (at.x1 - nowX) * 0.5, y: wk.headY(t) }],
  };
};

/* the frame for a book's panel title (kept with the book: its words are the Map's) */
export const bookPanel = (title: string): Part => {
  let at: Box = box(0, 0, 0, 0);
  return {
    place: b => {
      at = b;
    },
    still: b => frame(b, at, { title, grip: false }),
  };
};
