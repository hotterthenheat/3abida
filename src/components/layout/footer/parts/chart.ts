/*
  THE CHART AND ITS NEIGHBOURS (components/layout/footer/parts/chart.ts) — the photograph's own pieces, made parts so
  every picture can stand them where its page does: the chart pane (its line walking — or its candles — its last price
  run out to a tag that is the clock, its volume, its time axis, its levels broken into coloured dashes), a panel's
  frame, the breadcrumb, the strike ladder and the row of chips.
*/

import {
  FONT,
  PIX,
  bar,
  box,
  chip,
  clamp,
  clock,
  dashes,
  frame,
  gridlines,
  keep,
  rgb,
  rng,
  type,
  walk,
  type Box,
  type Brush,
  type Frame,
  type Ink,
  type Part,
  type Pen,
  type Pill,
  type Stage,
} from '../kit';

/* ---- A PANEL'S FRAME AND ITS TITLE: only in focus, a corner of it broken ---------------------------------------- */

export const panel = (title?: string, o: { grip?: boolean; radius?: number } = {}): Part => {
  let at: Box = box(0, 0, 0, 0);
  return {
    place: b => {
      at = b;
    },
    still: b => frame(b, at, { title, grip: o.grip ?? true, radius: o.radius }),
  };
};

/* ---- THE BREADCRUMB, top left: the photograph's row of small dim marks, the page's own address ------------------ */

export const crumb = (text: string): Part => {
  let x = 0;
  let y = 0;
  return {
    place: b => {
      x = b.x0;
      y = b.y0 + 7;
    },
    still: b => {
      type(b, text, x, y, { size: 9.5, hue: b.ink.muted, a: b.sharp ? 0.9 : 0.6, share: 0.45 });
    },
  };
};

/* ---- THE CHART PANE --------------------------------------------------------------------------------------------- */

interface Level {
  y: number;
  hue: string;
  segs: [number, number][];
  wide: [number, number][] | null;
}
export interface ChartOpts {
  seed?: number;
  /** the name and the timeframe, boxed, top left */
  legend?: string;
  /** steps a candle (0: a line) */
  candles?: number;
  /** the candles' two inks (keys of Ink) */
  up?: keyof Omit<Ink, 'hues'>;
  down?: keyof Omit<Ink, 'hues'>;
  volume?: boolean;
  tag?: boolean;
  axis?: boolean;
  /** coloured levels across the pane, broken into dashes; every other one runs on across the screen when `wide` */
  levels?: number;
  wide?: boolean;
  /** where the line runs in the pane (shares of its height) */
  band?: [number, number];
  volTop?: number;
  step?: number;
  gap?: number;
  ticks?: number;
  /** how hard the walk is pushed each step (candles want a body) */
  kick?: number;
}
export type Chart = ReturnType<typeof chart>;

export const chart = (o: ChartOpts = {}) => {
  const wk = walk(o.seed ?? 20261002, { step: o.step ?? 300, gap: o.gap ?? 3, kick: o.kick });
  const band = o.band ?? [0.12, 0.58];
  let pane: Box = box(0, 0, 0, 0);
  let s: Stage | null = null;
  let lineTop = 0;
  let lineBot = 0;
  let volTop = 0;
  let axisY = 0;
  let tagX = 0;
  let ticks = 6;
  let levels: Level[] = [];
  let now = 0;
  const k = o.candles ?? 0;

  const volume = (c: CanvasRenderingContext2D, t: number, style: string, from: number, to: number, skipJit: boolean) => {
    if (o.volume === false) return;
    const vh = pane.y1 - volTop;
    c.fillStyle = style;
    for (let i = wk.first(t); i < wk.steps.length; i++) {
      const x = wk.xOf(i, t);
      if (x < pane.x0 || x < from || x > to || (skipJit && wk.steps[i].jit > 0.55)) continue;
      const h = wk.steps[i].vol * vh;
      c.fillRect(x, pane.y1 - h, 2, h);
    }
  };
  /* THE CANDLES: `k` steps each, the last one still forming; drawn on whole coarse pixels so a body keeps its width */
  const candles = (c: CanvasRenderingContext2D, t: number, ink: (hue: string, a?: number) => string, sharp: boolean, from = -Infinity, to = Infinity) => {
    const st = wk.steps;
    const first = Math.floor(wk.first(t) / k) * k;
    const bw = Math.max(2, Math.floor((k * wk.GAP - 2) / PIX) * PIX);
    const ink2 = s!.ink;
    for (let j = first; j < st.length; j += k) {
      const last = Math.min(st.length - 1, j + k - 1);
      const x = wk.xOf((j + last) / 2, t);
      if (x < pane.x0 + bw / 2 || x < from - bw || x > to + bw) continue;
      const open = j > 0 ? st[j - 1].val : st[j].val;
      const close = last === st.length - 1 ? wk.valAt(t) : st[last].val;
      let hi = Math.max(open, close);
      let lo = Math.min(open, close);
      for (let i = j; i <= last; i++) {
        hi = Math.max(hi, st[i].val + Math.abs(st[i].jit) * 0.6);
        lo = Math.min(lo, st[i].val - Math.abs(st[i].jit) * 0.6);
      }
      const up = close >= open;
      const hue = up ? ink2[o.up ?? 'line'] : ink2[o.down ?? 'blue'];
      c.fillStyle = ink(hue, up ? 1 : 0.9);
      const yh = wk.yOf(hi);
      const yl = wk.yOf(lo);
      const yo = wk.yOf(open);
      const yc = wk.yOf(close);
      const cx = sharp ? Math.round(x) : Math.round(x / PIX) * PIX;
      c.fillRect(cx - (sharp ? 0.5 : 1), yh, sharp ? 1 : 2, Math.max(1, yl - yh));
      c.fillRect(cx - bw / 2, Math.min(yo, yc), bw, Math.max(sharp ? 1 : 2, Math.abs(yc - yo)));
    }
  };

  const part = {
    walk: wk,
    pane: () => pane,
    tagX: () => tagX,
    axisY: () => axisY,
    volTop: () => volTop,
    band: () => [lineTop, lineBot] as const,
    /** the line's height at x, now */
    yAt: (x: number, t = now) => wk.yAt(x, t),
    headY: (t = now) => wk.headY(t),
    head: () => wk.head(),
    place(b: Box, st: Stage) {
      s = st;
      pane = b;
      const ph = b.y1 - b.y0;
      lineTop = b.y0 + ph * band[0];
      lineBot = b.y0 + ph * band[1];
      volTop = b.y0 + ph * (o.volTop ?? 0.7);
      axisY = b.y1 + 14;
      tagX = b.x1 + 8;
      ticks = o.ticks ?? (st.phone ? 3 : 6);
      wk.place(b.x0, b.x1, lineTop, lineBot, now);
      /* the levels across the pane: each a coloured line broken into dashes (the photograph's), the same every time */
      const r = rng(77 + (o.seed ?? 0));
      const count = o.levels ?? 0;
      levels = Array.from({ length: count }, (_, i) => {
        const y = lineTop + ((i + 0.5) / count) * (lineBot - lineTop + ph * 0.1) + (r() - 0.5) * 6;
        return {
          y: Math.round(y),
          hue: st.ink.hues[i % st.ink.hues.length],
          segs: dashes(r, b.x0, b.x1, 26),
          wide: o.wide && i % 2 ? dashes(r, 0, st.W, 120) : null,
        };
      });
    },
    still(b: Brush) {
      const { c, sharp, ink } = b;
      /* the pane's frame and its gridlines: only in focus */
      if (sharp) {
        c.strokeStyle = rgb(ink.ink, 0.1);
        c.lineWidth = 1;
        c.strokeRect(Math.round(pane.x0) + 0.5, Math.round(pane.y0) + 0.5, Math.round(pane.x1 - pane.x0), Math.round(pane.y1 - pane.y0));
      }
      gridlines(b, pane, 5);
      /* the legend: the name and the timeframe, boxed */
      if (o.legend) {
        const lw = type(b, o.legend, pane.x0 + 8, pane.y0 + 9, { size: 10, share: 0.7 });
        if (sharp) {
          c.strokeStyle = rgb(ink.ink, 0.3);
          c.lineWidth = 1;
          c.strokeRect(pane.x0 + 4.5, pane.y0 + 2.5, lw + 8, 13);
        }
      }
      /* the levels: dashes in the terminal's colours, a small mark at each end of the pane — and the ones that run on
         across the screen, faint, under the words */
      for (const l of levels) {
        if (l.wide) {
          c.fillStyle = rgb(l.hue, sharp ? 0.3 : 0.32);
          if (sharp) c.fillRect(0, l.y - 0.5, b.W, 1);
          else for (const [a, e] of l.wide) if ((a < pane.x0 - 4 || a > pane.x1 + 4) && b.r() < 0.3) c.fillRect(a, l.y - 1, e - a, 2);
        }
        c.fillStyle = rgb(l.hue, sharp ? 0.75 : 0.62);
        if (sharp) c.fillRect(pane.x0 + 1, l.y - 0.5, pane.x1 - pane.x0 - 2, 1);
        else for (const [a, e] of l.segs) if (b.r() < 0.4) c.fillRect(a, l.y - 1, e - a, 2);
        if (keep(b, 0.5)) c.fillRect(pane.x0 + 2, l.y - 3, 7, 6);
        if (keep(b, 0.5)) c.fillRect(pane.x1 - 9, l.y - 3, 7, 6);
      }
    },
    tick(f: Frame) {
      now = f.t;
      wk.tick(f.t, f.dt);
    },
    live: (): Box => ({ x0: pane.x0 - 6, x1: o.tag === false ? pane.x1 + 6 : tagX + 76, y0: pane.y0 - 6, y1: o.axis === false ? pane.y1 + 6 : axisY + 12 }),
    moving(p: Pen, f: Frame) {
      const { c } = p;
      const ink = s!.ink;
      const t = f.t;
      /* the volume, a bar a step, denser than the pixels can hold — a block of white like the photograph's */
      volume(c, t, p.ink(ink.line, 0.95), -Infinity, Infinity, true);
      if (k) candles(c, t, p.ink, false);
      else {
        /* the price line: rough, thick, fringed */
        c.lineJoin = 'round';
        c.lineWidth = 2.6;
        c.strokeStyle = p.ink(ink.line);
        wk.trace(c, t, 0, 0, 1.6);
        c.stroke();
      }
      if (p.fringe) return;
      const head = wk.head();
      const headY = wk.headY(t);
      /* the last price run out to its tag; the tag is the clock */
      if (o.tag !== false) {
        const word = clock(f.wall, f.seconds);
        c.fillStyle = rgb(ink.line, 0.95);
        c.fillRect(head, Math.round(headY) - 1, tagX - head, 2);
        c.font = `600 10px ${FONT}`;
        const tw = c.measureText(word).width + 12;
        c.strokeStyle = rgb(ink.line);
        c.lineWidth = 2;
        c.strokeRect(tagX, headY - 8, tw, 16);
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        c.fillText(word, tagX + 6, headY + 0.5);
      }
      /* the time axis: the day's own times, on through the empty space ahead as a chart's axis runs — in seconds: the pane
         holds under a minute, so its minutes were one number over and over (2026-10-03 audit) */
      if (o.axis !== false) {
        const gap = ((tagX - pane.x0) * 0.95) / ticks;
        c.font = `600 8.5px ${FONT}`;
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        for (let i = 0; i < ticks; i++) {
          const x = pane.x0 + 14 + i * gap;
          c.fillStyle = rgb(ink.line, 0.9);
          c.fillText(clock(f.wall - wk.ago(x), true), x, axisY);
          c.fillRect(x - 2, axisY + 7, 30, 2);
        }
      }
    },
    sharp(c: CanvasRenderingContext2D, f: Frame, focus: Box) {
      const ink = s!.ink;
      const t = f.t;
      /* its volume and its line, clean */
      volume(c, t, rgb(ink.ink, 0.5), focus.x0 - 3, focus.x1, false);
      if (k) candles(c, t, (hue, a) => rgb(hue, a), true, focus.x0, focus.x1);
      else {
        c.lineJoin = 'round';
        c.lineWidth = 1.6;
        c.strokeStyle = rgb(ink.line);
        wk.trace(c, t, 0, 0, 0);
        c.stroke();
      }
      const head = wk.head();
      const headY = wk.headY(t);
      if (o.tag !== false) {
        /* the last price: a dashed line to a filled tag, the terminal's own */
        const word = clock(f.wall, f.seconds);
        c.strokeStyle = rgb(ink.line, 0.55);
        c.lineWidth = 1;
        c.setLineDash([3, 3]);
        c.beginPath();
        c.moveTo(head, Math.round(headY) + 0.5);
        c.lineTo(tagX, Math.round(headY) + 0.5);
        c.stroke();
        c.setLineDash([]);
        c.font = `500 10.5px ${FONT}`;
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        const w = c.measureText(word).width + 14;
        c.fillStyle = rgb(ink.line);
        c.beginPath();
        c.roundRect(tagX, headY - 9, w, 18, 3);
        c.fill();
        c.fillStyle = rgb(ink.panel);
        c.fillText(word, tagX + 7, headY + 0.5);
      }
      if (o.axis !== false) {
        const gap = ((tagX - pane.x0) * 0.95) / ticks;
        c.font = `500 10px ${FONT}`;
        c.fillStyle = rgb(ink.muted);
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        for (let i = 0; i < ticks; i++) {
          const x = pane.x0 + 14 + i * gap;
          c.fillText(clock(f.wall - wk.ago(x), true), x, axisY);
        }
      }
    },
    /* THE CROSSHAIR: in the pane, the pointer reads the line — its lines and its dot in the focus, the moment under it on
       the axis and on the tag */
    read(c: CanvasRenderingContext2D, f: Frame, x: number, y: number): Pill[] | null {
      const bottom = o.axis === false ? pane.y1 + 4 : axisY + 10;
      if (!(x > pane.x0 && x < pane.x1 && y > pane.y0 - 10 && y < bottom)) return null;
      const ink = s!.ink;
      const cx = Math.round(clamp(x, pane.x0 + 1, wk.head())) + 0.5;
      const cy = wk.yAt(cx, f.t);
      c.strokeStyle = rgb(ink.ink, 0.38);
      c.lineWidth = 1;
      c.setLineDash([2, 4]);
      c.beginPath();
      c.moveTo(cx, pane.y0);
      c.lineTo(cx, pane.y1);
      c.moveTo(pane.x0, Math.round(cy) + 0.5);
      c.lineTo(o.tag === false ? pane.x1 : tagX, Math.round(cy) + 0.5);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = rgb(ink.line);
      c.beginPath();
      c.arc(cx, cy, 3, 0, Math.PI * 2);
      c.fill();
      const when = clock(f.wall - wk.ago(cx), true);
      const pills: Pill[] = [];
      if (o.axis !== false) pills.push({ x: cx, y: axisY, text: when, anchor: 'mid' });
      if (o.tag !== false) pills.push({ x: tagX, y: cy, text: when, anchor: 'left' });
      return pills.length ? pills : [{ x: cx, y: pane.y1 - 10, text: when, anchor: 'mid' }];
    },
    /* the arrow reads along the line, the last price's tag, the volume */
    sights: (f: Frame) => {
      const pw = pane.x1 - pane.x0;
      return [
        { x: pane.x0 + pw * 0.3, y: wk.yAt(pane.x0 + pw * 0.3, f.t) },
        { x: pane.x0 + pw * 0.72, y: wk.yAt(pane.x0 + pw * 0.72, f.t) },
        ...(o.tag !== false ? [{ x: tagX + 18, y: wk.headY(f.t) }] : []),
        ...(o.volume !== false ? [{ x: pane.x0 + pw * 0.55, y: volTop + (pane.y1 - volTop) * 0.4 }] : []),
      ];
    },
  };
  return part;
};

/* ---- THE STRIKE LADDER: a strike's bars either side of a spine, longest in the middle (the photograph's diamond), its
   marks down the left, and the spot's line run out to the right ---------------------------------------------------- */

export const ladder = (o: { seed?: number; gap?: number; curve?: boolean; share?: number; run?: boolean; warm?: boolean; marks?: boolean; solid?: boolean } = {}): Part & { spotY: () => number } => {
  let at: Box = box(0, 0, 0, 0);
  let cx = 0;
  let w = 0;
  let rows: { y: number; left: number; right: number }[] = [];
  let spot = 0;
  let narrow = false;
  return {
    spotY: () => spot,
    place(b, st) {
      at = b;
      narrow = st.phone;
      w = (b.x1 - b.x0) * (o.share ?? 0.62);
      cx = b.x0 + 22 + w / 2;
      const gap = o.gap ?? 5;
      const n = Math.max(3, Math.floor((b.y1 - b.y0) / gap));
      const r = rng(o.seed ?? 31);
      rows = Array.from({ length: n }, (_, i) => {
        const e = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2 + 0.001);
        return {
          y: Math.round(b.y0 + i * gap),
          left: (w / 2) * e * (0.35 + 0.65 * r()),
          right: (w / 2) * e * (0.25 + 0.75 * r()),
        };
      });
      spot = Math.round((b.y0 + b.y1) / 2 + 2);
    },
    still(b) {
      const { c, sharp, ink } = b;
      /* broken, a bar is a piece or two of itself and many rows are gone — or, `solid`, a bar is whole or gone */
      const put = (x: number, y: number, w: number) => {
        if (!o.solid) return bar(b, x, y, w, sharp ? 3 : 2);
        if (keep(b, 0.7)) c.fillRect(x, y, w, 3);
      };
      rows.forEach((row, i) => {
        /* the two sides: on Terrain's rail the puts warm on the left and the calls cool on the right */
        c.fillStyle = rgb(o.warm ? (i % 3 ? ink.warn : ink.ember) : i % 3 ? ink.hues[0] : ink.hues[1], sharp ? 0.8 : o.solid ? 0.8 : 0.7);
        put(cx - 2 - row.left, row.y, row.left);
        c.fillStyle = rgb(o.warm ? (i % 4 ? ink.blue : ink.glacier) : i % 4 ? ink.red : ink.hues[3], sharp ? 0.8 : o.solid ? 0.8 : 0.7);
        put(cx + 2, row.y, row.right);
        if (i % 3 === 0 && keep(b, 0.4)) {
          c.fillStyle = rgb(ink.line, sharp ? 0.55 : 0.75);
          c.fillRect(cx - w / 2 - 18, row.y, 10, 3);
        }
      });
      /* TERRAIN'S CURVE: the net, a line snaking down through the bars */
      if (o.curve) {
        c.strokeStyle = rgb(ink.line, sharp ? 0.85 : 0.95);
        c.lineWidth = sharp ? 1.2 : 2.6;
        c.beginPath();
        rows.forEach((row, i) => {
          const x = cx + (row.right - row.left) * 0.5;
          if (i) c.lineTo(x, row.y + 1);
          else c.moveTo(x, row.y + 1);
        });
        if (sharp) c.stroke();
        else {
          c.setLineDash([12, 6]);
          c.stroke();
          c.setLineDash([]);
        }
      }
      /* THE BOOK'S OWN MARKS: the supreme's row in its magenta, a wall named either side, the flip a grey line of dashes */
      if (o.marks && rows.length > 8) {
        const n = rows.length;
        const named: [number, string, string][] = [
          [Math.floor(n * 0.3), 'call wall', ink.blue],
          [Math.floor(n * 0.42), 'supreme', ink.supreme],
          [Math.floor(n * 0.7), 'put wall', ink.red],
        ];
        for (const [i, word, hue] of named) {
          const row = rows[i];
          c.fillStyle = rgb(hue, sharp ? 0.95 : 0.9);
          bar(b, cx - 2 - row.left * 1.25, row.y, row.left * 1.25 + row.right * 1.25 + 4, sharp ? 3 : 3, 0.9);
          if (!narrow) type(b, word, cx + w / 2 + 6, row.y + 1.5, { size: 7, hue, share: 0.6 });
        }
        const fy = rows[Math.floor(n * 0.56)].y + 2;
        c.fillStyle = rgb(ink.flip, sharp ? 0.75 : 0.8);
        for (let x = cx - w / 2 - 18; x < cx + w / 2; x += sharp ? 6 : 9) if (keep(b, 0.6)) c.fillRect(x, fy, sharp ? 3 : 4, sharp ? 1 : 2);
        if (!narrow) type(b, 'flip', cx + w / 2 + 6, fy + 1, { size: 7, hue: ink.flip, share: 0.6 });
      }
      if (o.run === false) return;
      c.fillStyle = rgb(ink.line, sharp ? 0.8 : 0.95);
      if (sharp) c.fillRect(cx - w / 2, spot, at.x1 - (cx - w / 2), 1);
      else for (let x = cx - w / 2; x < at.x1; x += 18 + b.r() * 30) c.fillRect(x, spot, Math.min(at.x1 - x, 10 + b.r() * 40), 2);
      c.fillRect(at.x1 - 7, spot - 3, 7, 7);
    },
    sights: () => [{ x: cx + w * 0.12, y: (at.y0 + at.y1) / 2 - (at.y1 - at.y0) * 0.12 }],
  };
};

/* ---- THE CHIPS: a ring, words, a solid pill, a yellow pill edged in red, a green edge (the setup cards') ----------- */

export const chips = (o: { few?: boolean } = {}): Part => {
  let x0 = 0;
  let y = 0;
  let few = false;
  return {
    place(b, s) {
      x0 = b.x0;
      y = (b.y0 + b.y1) / 2;
      few = o.few ?? s.phone;
    },
    still(b) {
      const { c, ink } = b;
      let x = x0;
      const ring = () => {
        c.strokeStyle = rgb(ink.line, 0.9);
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(x + 5, y, 4.5, 0, Math.PI * 2);
        c.stroke();
        x += 16;
      };
      const put = (w: number, fill: string | null, edge: string | null, word: string, wordInk: string) => {
        chip(b, x, y, w, { fill, edge, word, wordInk });
        x += w + 10;
      };
      ring();
      put(58, null, rgb(ink.bull, 0.9), 'WATCH', rgb(ink.line, 0.85));
      put(52, rgb(ink.line), null, 'ACTIVE', rgb(ink.panel));
      if (few) return;
      ring();
      put(62, rgb(ink.ember), rgb(ink.red), 'TP1 HIT', rgb(ink.panel));
      put(58, null, rgb(ink.hues[0], 0.9), 'MOVING', rgb(ink.line, 0.85));
      put(56, null, rgb(ink.muted, 0.8), 'FADING', rgb(ink.muted));
    },
    sights: () => [{ x: x0 + 84, y }],
  };
};
