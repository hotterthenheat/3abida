/*
==================================================
  SLAYER TERMINAL - THE LIVE FOOTER
  (components/layout/FooterArt.tsx)

  THE TERMINAL IN THE DARK (2026-10-02 — the owner, with
  a photograph of the terminal caught on a black screen,
  only its brightest marks left and broken into pixels:
  "make it super cool like a live footer make some sort
  of artistic thing from the photo", and of the line drawn
  in its place: "i wanted a cool cursor interactive that
  looks like this photo in the footer not a new footer
  please"). The band IS the photograph, made live: a
  chart pane — its price line walking, its last-price line
  run out to a tag, its volume, its time axis, its levels
  broken into coloured dashes — a strike ladder beside it,
  a row of chips under it, specks; every mark in coarse
  pixels with a hair of red on one edge and blue on the
  other, most of the screen gone to the ground.

  THE POINTER BRINGS IT BACK: around the pointer the screen
  comes into focus — the pixels give way to the terminal,
  sharp — and in the chart a crosshair reads the line where
  the pointer is: the moment under it on the tag and the
  axis. A pointer that moves fast tears the rows it
  crosses. Where it has been goes dark again in about a
  second. With no pointer on it (a phone, or a desk whose
  pointer is elsewhere) an arrow of its own — the one in
  the photograph — drifts over the screen and rests on
  what it reads.

  Art, not data: no figure on it is a price — the tags are
  the clock, the axis the day's own times. Every ink is a
  token read off the band's own ground, read again when the
  theme turns: on paper the photograph is printed in ink.
  THE COST: one canvas; the screen's still parts drawn once
  (again on a resize or a turn of theme), the moving ones
  about thirty times a second (sixty under the pointer),
  only while the band is on screen with the tab in front.
  Under reduced motion one still frame, the pointer's focus
  drawn where it stands, the clock moved on once a minute.
==================================================
*/

import { useEffect, useRef } from 'react';
import { FONT_SANS } from '../../theme/fonts';

/** a seeded walk, so the screen opens on the same picture every time */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

/** the line takes a step this often (ms)… */
const STEP = 300;
/** …and its steps stand this far apart (CSS px): ten pixels a second, a bar of volume a step */
const GAP = 3;
/** the broken screen's pixel, in CSS px */
const PIX = 2;
/** the focus round the pointer (CSS px), and how long a place stays lit after the pointer has gone (ms) */
const REACH = 118;
const LINGER = 950;
/** the arrow's own pace: a glide from one thing to the next, then a rest on it (ms) */
const GLIDE = 1500;
const REST = 1700;

/** a token's channels ("237 237 237"), read where the band stands */
const chan = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;
const rgb = (c: string, a?: number) => (a == null ? `rgb(${c})` : `rgb(${c} / ${a})`);

interface Ink {
  line: string;
  muted: string;
  ink: string;
  panel: string;
  /** the photograph's colours, the terminal's own: the levels, the ladder's two sides, the chips */
  hues: string[];
  red: string;
  blue: string;
  bull: string;
  ember: string;
}
const inksOf = (el: Element): Ink => {
  const red = chan(el, '--bear', '255 59 48');
  const blue = chan(el, '--compare', '91 156 246');
  return {
    line: chan(el, '--text-primary', '237 237 237'),
    muted: chan(el, '--text-muted', '125 125 125'),
    ink: chan(el, '--ink', '255 255 255'),
    panel: chan(el, '--panel', '10 10 10'),
    hues: [blue, chan(el, '--moon', '185 169 244'), red, chan(el, '--warn', '255 149 0'), chan(el, '--thermal-cool', '88 139 192'), chan(el, '--supreme', '234 0 255')],
    red,
    blue,
    bull: chan(el, '--bull', '48 209 88'),
    ember: chan(el, '--ember', '245 197 66'),
  };
};

const two = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number, seconds: boolean) => {
  const d = new Date(ms);
  return `${two(d.getHours())}:${two(d.getMinutes())}${seconds ? `:${two(d.getSeconds())}` : ''}`;
};
/** smoothstep */
const ease = (t: number) => t * t * (3 - 2 * t);

/** the arrow — the photograph's own pointer */
const ARROW: [number, number][] = [
  [0, 0],
  [0, 15.5],
  [3.7, 12],
  [6.3, 17.8],
  [8.9, 16.7],
  [6.3, 11.1],
  [11.2, 11.1],
];

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
interface Step {
  val: number;
  vol: number;
  jit: number;
}

const FooterArt = ({ className = 'h-[220px] md:h-[300px]' }: { className?: string }) => {
  const box = useRef<HTMLDivElement | null>(null);
  const cvs = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = box.current;
    const canvas = cvs.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    /* the layers: the broken screen's still parts (coarse), the same parts sharp, and the two the focus is made in */
    const brokenStill = document.createElement('canvas');
    const sharpStill = document.createElement('canvas');
    const lo = document.createElement('canvas');
    const focus = document.createElement('canvas');
    const mask = document.createElement('canvas');
    const bctx = brokenStill.getContext('2d');
    const sctx = sharpStill.getContext('2d');
    const lctx = lo.getContext('2d');
    const fctx = focus.getContext('2d');
    const mctx = mask.getContext('2d');
    if (!bctx || !sctx || !lctx || !fctx || !mctx) return;

    /* THE WALK: the price line with momentum, leaning back to where it began, and a bar of volume a step */
    const rand = rng(20261002);
    let p = 0;
    let v = 0;
    const next = (): Step => {
      v = v * 0.86 + (rand() - 0.5) * 0.9 - p * 0.003;
      p += v;
      const spike = rand() < 0.08 ? 0.55 + rand() * 0.45 : 0;
      return { val: p, vol: Math.max(0.12, Math.min(1, 0.22 + rand() * 0.5 + spike)), jit: (rand() - 0.5) * 2 };
    };
    const steps: Step[] = [];
    let t0 = performance.now();
    let pending = next();

    let W = 0;
    let H = 0;
    let LW = 0;
    let LH = 0;
    let phone = false;
    let ink = inksOf(host);
    /* THE SCREEN'S LAYOUT, in CSS px: the scene keeps to the page's column though the band runs edge to edge */
    let col: Box = { x0: 0, x1: 0, y0: 0, y1: 0 };
    let pane: Box = { x0: 0, x1: 0, y0: 0, y1: 0 };
    let lineTop = 0;
    let lineBot = 0;
    let volTop = 0;
    let axisY = 0;
    let tagX = 0;
    let lad = { cx: 0, cy: 0, w: 0, h: 0 };
    let chipsY = 0;
    let levels: { y: number; hue: string; segs: [number, number][] }[] = [];
    const cap = () => Math.ceil((pane.x1 - pane.x0) / GAP) + 6;

    const layout = () => {
      phone = W < 640;
      const inset = W >= 1440 ? (W - 1440) / 2 + 40 : W >= 1024 ? 40 : W >= 640 ? 24 : 16;
      col = { x0: inset, x1: W - inset, y0: 0, y1: H };
      const cw = col.x1 - col.x0;
      pane = { x0: col.x0, x1: col.x0 + cw * (phone ? 0.62 : 0.4), y0: H * 0.15, y1: H * 0.76 };
      const ph = pane.y1 - pane.y0;
      lineTop = pane.y0 + ph * 0.12;
      lineBot = pane.y0 + ph * 0.58;
      volTop = pane.y0 + ph * 0.7;
      axisY = pane.y1 + Math.max(10, H * 0.06);
      tagX = phone ? pane.x1 + 8 : col.x0 + cw * 0.5;
      lad = phone ? { cx: col.x0 + cw * 0.88, cy: H * 0.46, w: cw * 0.2, h: H * 0.5 } : { cx: col.x0 + cw * 0.76, cy: H * 0.46, w: cw * 0.24, h: H * 0.6 };
      chipsY = H * 0.92;
      /* the levels across the pane: each a coloured line broken into dashes (the photograph's), the same every time */
      const r = rng(77);
      const count = phone ? 4 : 6;
      levels = Array.from({ length: count }, (_, i) => {
        const y = lineTop + ((i + 0.5) / count) * (lineBot - lineTop + ph * 0.1) + (r() - 0.5) * 6;
        const segs: [number, number][] = [];
        for (let x = pane.x0 + r() * 20; x < pane.x1; ) {
          const len = 5 + r() * 34;
          segs.push([x, Math.min(pane.x1, x + len)]);
          x += len + 4 + r() * 26;
        }
        return { y: Math.round(y), hue: ink.hues[i % ink.hues.length], segs };
      });
    };

    /* the line's height: the band's own range, eased after it so the line never jumps */
    let rlo = 0;
    let rhi = 1;

    /* ---- THE SCREEN'S STILL PARTS ---------------------------------------------------------------------------------- */

    /* text in the screen's own small type, letter by letter — so the broken copy can lose some of them */
    const letters = (c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, keep: () => boolean) => {
      c.font = `600 ${size}px ${FONT_SANS}`;
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      let at = x;
      for (const ch of text) {
        if (keep()) c.fillText(ch, at, y);
        at += c.measureText(ch).width;
      }
      return at - x;
    };
    /* every still part, drawn once sharp (everything) and once broken (a share of each part survives) */
    const still = (c: CanvasRenderingContext2D, sharp: boolean) => {
      const r = rng(sharp ? 11 : 12);
      const keep = (share: number) => () => sharp || r() < share;
      const line = ink.line;
      c.lineCap = 'butt';
      /* the breadcrumb, top left (the photograph's row of small dim marks) */
      c.fillStyle = rgb(ink.muted, sharp ? 0.9 : 0.6);
      letters(c, 'terminal  /  pulse', col.x0, H * 0.05, 9.5, keep(0.45));
      /* the pane's frame and its gridlines: only in focus */
      if (sharp) {
        c.strokeStyle = rgb(ink.ink, 0.1);
        c.lineWidth = 1;
        c.strokeRect(Math.round(pane.x0) + 0.5, Math.round(pane.y0) + 0.5, Math.round(pane.x1 - pane.x0), Math.round(pane.y1 - pane.y0));
        c.strokeStyle = rgb(ink.ink, 0.06);
        for (let k = 1; k < 5; k++) {
          const y = Math.round(pane.y0 + ((pane.y1 - pane.y0) * k) / 5) + 0.5;
          c.beginPath();
          c.moveTo(pane.x0, y);
          c.lineTo(pane.x1, y);
          c.stroke();
        }
      }
      /* the legend: the name and the timeframe, boxed */
      c.fillStyle = rgb(line);
      const lw = letters(c, 'SPY  5m', pane.x0 + 8, pane.y0 + 9, 10, keep(0.7));
      if (sharp) {
        c.strokeStyle = rgb(ink.ink, 0.3);
        c.lineWidth = 1;
        c.strokeRect(pane.x0 + 4.5, pane.y0 + 2.5, lw + 8, 13);
      }
      /* the levels: dashes in the terminal's colours, a small mark at each end of the pane */
      for (const l of levels) {
        c.fillStyle = rgb(l.hue, sharp ? 0.75 : 0.62);
        if (sharp) c.fillRect(pane.x0 + 1, l.y - 0.5, pane.x1 - pane.x0 - 2, 1);
        else for (const [a, b] of l.segs) if (r() < 0.4) c.fillRect(a, l.y - 1, b - a, 2);
        if (keep(0.5)()) c.fillRect(pane.x0 + 2, l.y - 3, 7, 6);
        if (keep(0.5)()) c.fillRect(pane.x1 - 9, l.y - 3, 7, 6);
      }
      /* THE LADDER: a strike's bars either side of a spine, longest in the middle (the photograph's diamond), its marks
         down the left, and the spot's line run out to the right */
      const rows = Math.max(3, Math.floor(lad.h / 5));
      for (let i = 0; i < rows; i++) {
        const y = Math.round(lad.cy - lad.h / 2 + i * 5);
        const e = 1 - Math.abs(i - (rows - 1) / 2) / ((rows - 1) / 2 + 0.001);
        const left = (lad.w / 2) * e * (0.35 + 0.65 * r());
        const right = (lad.w / 2) * e * (0.25 + 0.75 * r());
        /* broken, a bar is a piece or two of itself, and many rows are gone */
        const bar = (x0: number, w: number) => {
          if (sharp) return c.fillRect(x0, y, w, 3);
          if (r() > 0.45) return;
          const a = x0 + r() * w * 0.6;
          c.fillRect(a, y, Math.max(4, w * (0.2 + r() * 0.35)), 2);
        };
        c.fillStyle = rgb(i % 3 ? ink.hues[0] : ink.hues[1], sharp ? 0.8 : 0.7);
        bar(lad.cx - 2 - left, left);
        c.fillStyle = rgb(i % 4 ? ink.red : ink.hues[3], sharp ? 0.8 : 0.7);
        bar(lad.cx + 2, right);
        if (i % 3 === 0 && keep(0.4)()) {
          c.fillStyle = rgb(line, sharp ? 0.55 : 0.75);
          c.fillRect(lad.cx - lad.w / 2 - 18, y, 10, 3);
        }
      }
      c.fillStyle = rgb(line, sharp ? 0.8 : 0.95);
      const sy = Math.round(lad.cy + 2);
      if (sharp) c.fillRect(lad.cx - lad.w / 2, sy, col.x1 - (lad.cx - lad.w / 2), 1);
      else for (let x = lad.cx - lad.w / 2; x < col.x1; x += 18 + r() * 30) c.fillRect(x, sy, 10 + r() * 40, 2);
      c.fillRect(col.x1 - 7, sy - 3, 7, 7);
      /* THE CHIPS under the pane: a ring, words, a solid pill, a yellow pill edged in red, a green edge (the setup cards') */
      let x = pane.x0 + 6;
      const chip = (w: number, fill: string | null, edge: string | null, word: string, wordInk: string) => {
        if (!keep(0.65)()) {
          x += w + 10;
          return;
        }
        if (fill) {
          c.fillStyle = fill;
          c.beginPath();
          c.roundRect(x, chipsY - 7, w, 14, 7);
          c.fill();
        }
        if (edge) {
          c.strokeStyle = edge;
          c.lineWidth = 1.5;
          c.beginPath();
          c.roundRect(x + 0.75, chipsY - 6.25, w - 1.5, 12.5, 6);
          c.stroke();
        }
        c.fillStyle = wordInk;
        letters(c, word, x + 7, chipsY + 0.5, 8.5, keep(0.55));
        x += w + 10;
      };
      const ring = () => {
        c.strokeStyle = rgb(line, 0.9);
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(x + 5, chipsY, 4.5, 0, Math.PI * 2);
        c.stroke();
        x += 16;
      };
      ring();
      chip(58, null, rgb(ink.bull, 0.9), 'WATCH', rgb(line, 0.85));
      chip(52, rgb(line), null, 'ACTIVE', rgb(ink.panel));
      if (!phone) {
        ring();
        chip(62, rgb(ink.ember), rgb(ink.red), 'TP1 HIT', rgb(ink.panel));
        chip(58, null, rgb(ink.hues[0], 0.9), 'MOVING', rgb(line, 0.85));
        chip(56, null, rgb(ink.muted, 0.8), 'FADING', rgb(ink.muted));
      }
      /* SPECKS: the photograph's grain — a few pixels and dashes over the whole screen, some in colour */
      if (!sharp) {
        const count = Math.round((W * H) / 1400);
        for (let i = 0; i < count; i++) {
          const sx = r() * W;
          const sy2 = r() * H;
          const hue = r() < 0.18 ? ink.hues[Math.floor(r() * ink.hues.length)] : ink.line;
          c.fillStyle = rgb(hue, 0.12 + r() * 0.4);
          c.fillRect(sx, sy2, r() < 0.3 ? 2 + r() * 8 : 2, 2);
        }
        /* and the screen's other cards, all but gone: a corner here and there */
        for (let i = 0; i < 9; i++) {
          const cx = col.x0 + r() * (col.x1 - col.x0);
          const cy = H * (0.12 + r() * 0.75);
          c.fillStyle = rgb(ink.line, 0.22);
          c.fillRect(cx, cy, 6 + r() * 10, 2);
          c.fillRect(cx, cy, 2, 6);
        }
      }
    };

    /* the still parts, built: sharp at the screen's own resolution; broken in coarse pixels, a hair of red on the left of
       each mark and blue on the right (each colour a copy of the marks, laid under them a pixel aside) */
    const build = () => {
      sharpStill.width = Math.round(W * dpr);
      sharpStill.height = Math.round(H * dpr);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.clearRect(0, 0, W, H);
      still(sctx, true);

      const raw = document.createElement('canvas');
      raw.width = LW;
      raw.height = LH;
      const rctx = raw.getContext('2d');
      if (!rctx) return;
      rctx.setTransform(1 / PIX, 0, 0, 1 / PIX, 0, 0);
      still(rctx, false);
      brokenStill.width = LW;
      brokenStill.height = LH;
      bctx.clearRect(0, 0, LW, LH);
      const tint = (hue: string) => {
        const t = document.createElement('canvas');
        t.width = LW;
        t.height = LH;
        const tc = t.getContext('2d');
        if (!tc) return t;
        tc.drawImage(raw, 0, 0);
        tc.globalCompositeOperation = 'source-in';
        tc.fillStyle = rgb(hue, 0.85);
        tc.fillRect(0, 0, LW, LH);
        return t;
      };
      bctx.drawImage(tint(ink.red), -1, 0);
      bctx.drawImage(tint(ink.blue), 1, 0);
      bctx.drawImage(raw, 0, 0);
    };

    const size = () => {
      W = host.clientWidth;
      H = host.clientHeight;
      LW = Math.max(1, Math.ceil(W / PIX));
      LH = Math.max(1, Math.ceil(H / PIX));
      for (const c of [canvas, focus]) {
        c.width = Math.max(1, Math.round(W * dpr));
        c.height = Math.max(1, Math.round(H * dpr));
      }
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      lo.width = LW;
      lo.height = LH;
      mask.width = LW;
      mask.height = LH;
      layout();
      build();
    };
    size();
    /* the screen opens full: the line already runs the pane's width, its last step just taken */
    while (steps.length < cap()) steps.push(next());
    t0 = performance.now() - (steps.length - 1) * STEP;
    rlo = Math.min(...steps.map(s => s.val));
    rhi = Math.max(...steps.map(s => s.val));

    /* ---- THE HAND AND THE ARROW --------------------------------------------------------------------------------------- */

    /* the reader's pointer, and the places it has lit (each goes dark over LINGER) */
    const hand = { x: 0, y: 0, on: false, at: 0 };
    const lit: { x: number; y: number; t: number; r: number }[] = [];
    let tears: { y: number; h: number; dx: number; x0: number; x1: number; until: number }[] = [];
    /* the arrow of its own: where it is, where it set off from, which sight it is on, and when it may set off again */
    const ghost = { x: 0, y: 0, fx: 0, fy: 0, t: 0, leg: 0, show: 0, rest: false, back: 0 };
    /* what it reads, in turn: along the line, the last price's tag, the ladder, the volume, the chips */
    const sights = () => [
      { x: pane.x0 + (pane.x1 - pane.x0) * 0.3, y: 0, on: 'line' },
      { x: pane.x0 + (pane.x1 - pane.x0) * 0.72, y: 0, on: 'line' },
      { x: tagX + 18, y: 0, on: 'tag' },
      { x: lad.cx + lad.w * 0.12, y: lad.cy - lad.h * 0.12, on: '' },
      { x: pane.x0 + (pane.x1 - pane.x0) * 0.55, y: volTop + (pane.y1 - volTop) * 0.4, on: '' },
      { x: pane.x0 + 90, y: chipsY, on: '' },
    ];
    ghost.x = ghost.fx = pane.x0 + (pane.x1 - pane.x0) * 0.6;
    ghost.y = ghost.fy = H * 0.4;

    /* ---- A FRAME ----------------------------------------------------------------------------------------------------- */

    let last = 0;
    const draw = (now: number) => {
      const dt = last ? Math.min(100, now - last) : 16;
      last = now;
      /* the steps that came due */
      while (now - (t0 + (steps.length - 1) * STEP) >= STEP) {
        steps.push(pending);
        pending = next();
      }
      while (steps.length > cap()) {
        steps.shift();
        t0 += STEP;
      }
      const n = steps.length;
      const head = pane.x1 - 2;
      const valAt = (t: number) => {
        const f = (t - t0) / STEP;
        const j = Math.max(0, Math.min(n - 1, Math.floor(f)));
        const a = steps[j].val;
        const b = j + 1 < n ? steps[j + 1].val : pending.val;
        return a + (b - a) * ease(Math.max(0, Math.min(1, f - j)));
      };
      let tlo = Infinity;
      let thi = -Infinity;
      for (const s of steps) {
        if (s.val < tlo) tlo = s.val;
        if (s.val > thi) thi = s.val;
      }
      const pad = (thi - tlo) * 0.12 + 0.5;
      const k = 1 - Math.exp(-dt / 900);
      rlo += (tlo - pad - rlo) * k;
      rhi += (thi + pad - rhi) * k;
      const span = Math.max(1e-6, rhi - rlo);
      const yOf = (val: number) => lineTop + (1 - (val - rlo) / span) * (lineBot - lineTop);
      const xOf = (i: number) => head - ((now - (t0 + i * STEP)) / STEP) * GAP;
      const headY = yOf(valAt(now));
      /* the moment a point of the pane was drawn — on the frame's clock for the line, on the wall's for its tags — and the
         line's height there */
      const ago = (x: number) => ((head - x) / GAP) * STEP;
      const wall = Date.now();
      const momentAt = (x: number) => wall - ago(x);
      const lineYAt = (x: number) => yOf(valAt(now - ago(x)));

      /* THE ARROW: glides to the next thing, rests on it (on the line, it rides the line), and gives way to a pointer */
      if (!calm) {
        ghost.show += ((hand.on ? 0 : 1) - ghost.show) * (1 - Math.exp(-dt / (hand.on ? 120 : 400)));
        if (!hand.on && now > ghost.back) {
          const list = sights();
          const s = list[ghost.leg % list.length];
          const sy = s.on === 'line' ? lineYAt(s.x) : s.on === 'tag' ? headY : s.y;
          if (!ghost.rest) {
            const q = Math.min(1, Math.max(0, (now - ghost.t) / GLIDE));
            const e = q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2;
            ghost.x = ghost.fx + (s.x - ghost.fx) * e;
            ghost.y = ghost.fy + (sy - ghost.fy) * e;
            if (q >= 1) {
              ghost.rest = true;
              ghost.t = now;
            }
          } else {
            ghost.x = s.x;
            ghost.y = sy;
            if (now - ghost.t > REST) {
              ghost.rest = false;
              ghost.leg++;
              ghost.fx = ghost.x;
              ghost.fy = ghost.y;
              ghost.t = now;
            }
          }
        }
      }
      /* the place in focus now: the pointer's, or the arrow's */
      const showing = hand.on || (!calm && ghost.show > 0.05);
      const fx = hand.on ? hand.x : ghost.x;
      const fy = hand.on ? hand.y : ghost.y;
      if (showing) {
        const lastLit = lit[lit.length - 1];
        if (!lastLit || Math.hypot(lastLit.x - fx, lastLit.y - fy) > 6 || now - lastLit.t > 60)
          lit.push({ x: fx, y: fy, t: now, r: (hand.on ? REACH : REACH * 0.82) * (phone ? 0.7 : 1) });
      }
      while (lit.length && (lit.length > 40 || now - lit[0].t > LINGER)) lit.shift();
      tears = tears.filter(t => t.until > now);

      /* 1 · THE BROKEN SCREEN, in coarse pixels: the still parts, then the line, its volume, its last price and the axis */
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, LW, LH);
      lctx.drawImage(brokenStill, 0, 0);
      lctx.setTransform(1 / PIX, 0, 0, 1 / PIX, 0, 0);
      const first = Math.max(0, Math.floor((now - t0) / STEP - (head - pane.x0) / GAP) - 1);
      /* the volume, a bar a step, denser than the pixels can hold — a block of white like the photograph's */
      const vb = pane.y1;
      const vh = pane.y1 - volTop;
      const fringes: [string, number, number][] = [
        [ink.red, -PIX, 0.7],
        [ink.blue, PIX, 0.7],
        [ink.line, 0, 0.95],
      ];
      for (const [hue, dx, a] of fringes) {
        lctx.fillStyle = rgb(hue, a);
        for (let i = first; i < n; i++) {
          const x = xOf(i);
          if (x < pane.x0 || steps[i].jit > 0.55) continue;
          const h = steps[i].vol * vh;
          lctx.fillRect(x + dx, vb - h, 2, h);
        }
      }
      /* the price line: rough, thick, fringed */
      const trace = (c: CanvasRenderingContext2D, dx: number, dy: number, rough: number) => {
        c.beginPath();
        let started = false;
        for (let i = first; i < n; i++) {
          const x = xOf(i);
          if (x < pane.x0) continue;
          const y = yOf(steps[i].val) + steps[i].jit * rough;
          if (started) c.lineTo(x + dx, y + dy);
          else {
            c.moveTo(x + dx, y + dy);
            started = true;
          }
        }
        c.lineTo(head + dx, headY + dy);
      };
      lctx.lineJoin = 'round';
      lctx.lineWidth = 2.6;
      lctx.strokeStyle = rgb(ink.red, 0.6);
      trace(lctx, -PIX, 0, 1.6);
      lctx.stroke();
      lctx.strokeStyle = rgb(ink.blue, 0.6);
      trace(lctx, PIX, 1, 1.6);
      lctx.stroke();
      lctx.strokeStyle = rgb(ink.line);
      trace(lctx, 0, 0, 1.6);
      lctx.stroke();
      /* the last price run out to its tag; the tag is the clock */
      const word = clock(wall, !calm);
      lctx.fillStyle = rgb(ink.line, 0.95);
      lctx.fillRect(head, Math.round(headY) - 1, tagX - head, 2);
      lctx.font = `600 10px ${FONT_SANS}`;
      const tw = lctx.measureText(word).width + 12;
      lctx.strokeStyle = rgb(ink.line);
      lctx.lineWidth = 2;
      lctx.strokeRect(tagX, headY - 8, tw, 16);
      lctx.textBaseline = 'middle';
      lctx.textAlign = 'left';
      lctx.fillText(word, tagX + 6, headY + 0.5);
      /* the time axis: the day's own times, on through the empty space ahead as a chart's axis runs */
      const ticks = phone ? 3 : 6;
      const tickGap = ((tagX - pane.x0) * 0.95) / ticks;
      lctx.font = `600 8.5px ${FONT_SANS}`;
      for (let i = 0; i < ticks; i++) {
        const x = pane.x0 + 14 + i * tickGap;
        lctx.fillStyle = rgb(ink.line, 0.9);
        lctx.fillText(clock(momentAt(x), false), x, axisY);
        lctx.fillRect(x - 2, axisY + 7, 30, 2);
      }
      /* the screen's own glitch: now and then a row slips sideways for a moment */
      if (!calm && rand() < dt / 2200) {
        const y = Math.floor(rand() * LH);
        tears.push({ y: y * PIX, h: (1 + Math.floor(rand() * 3)) * PIX, dx: (rand() - 0.5) * 40, x0: 0, x1: W, until: now + 110 });
      }

      /* 2 · ONTO THE BAND, pixel for pixel */
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(lo, 0, 0, LW * PIX * dpr, LH * PIX * dpr);
      ctx.imageSmoothingEnabled = true;

      /* 3 · THE FOCUS: where the pointer (or the arrow) is and has been, the terminal comes back, sharp */
      if (lit.length) {
        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.clearRect(0, 0, LW, LH);
        let bx0 = Infinity;
        let by0 = Infinity;
        let bx1 = -Infinity;
        let by1 = -Infinity;
        for (const l of lit) {
          const s = Math.max(0, 1 - (now - l.t) / LINGER);
          if (s <= 0) continue;
          const g = mctx.createRadialGradient(l.x / PIX, l.y / PIX, 0, l.x / PIX, l.y / PIX, l.r / PIX);
          g.addColorStop(0, `rgb(0 0 0 / ${s})`);
          g.addColorStop(0.45, `rgb(0 0 0 / ${s * 0.9})`);
          g.addColorStop(1, 'rgb(0 0 0 / 0)');
          mctx.fillStyle = g;
          mctx.fillRect((l.x - l.r) / PIX, (l.y - l.r) / PIX, (2 * l.r) / PIX, (2 * l.r) / PIX);
          bx0 = Math.min(bx0, l.x - l.r);
          by0 = Math.min(by0, l.y - l.r);
          bx1 = Math.max(bx1, l.x + l.r);
          by1 = Math.max(by1, l.y + l.r);
        }
        bx0 = Math.max(0, Math.floor(bx0));
        by0 = Math.max(0, Math.floor(by0));
        bx1 = Math.min(W, Math.ceil(bx1));
        by1 = Math.min(H, Math.ceil(by1));
        if (bx1 > bx0 && by1 > by0) {
          const bw = bx1 - bx0;
          const bh = by1 - by0;
          /* the sharp terminal in the lit box */
          fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          fctx.globalCompositeOperation = 'source-over';
          fctx.clearRect(bx0, by0, bw, bh);
          fctx.save();
          fctx.beginPath();
          fctx.rect(bx0, by0, bw, bh);
          fctx.clip();
          fctx.drawImage(sharpStill, bx0 * dpr, by0 * dpr, bw * dpr, bh * dpr, bx0, by0, bw, bh);
          /* its volume and its line, clean */
          fctx.fillStyle = rgb(ink.ink, 0.5);
          for (let i = first; i < n; i++) {
            const x = xOf(i);
            if (x < pane.x0 || x < bx0 - 3 || x > bx1) continue;
            const h = steps[i].vol * vh;
            fctx.fillRect(x, vb - h, 2, h);
          }
          fctx.lineJoin = 'round';
          fctx.lineWidth = 1.6;
          fctx.strokeStyle = rgb(ink.line);
          trace(fctx, 0, 0, 0);
          fctx.stroke();
          /* the last price: a dashed line to a filled tag, the terminal's own */
          fctx.strokeStyle = rgb(ink.line, 0.55);
          fctx.lineWidth = 1;
          fctx.setLineDash([3, 3]);
          fctx.beginPath();
          fctx.moveTo(head, Math.round(headY) + 0.5);
          fctx.lineTo(tagX, Math.round(headY) + 0.5);
          fctx.stroke();
          fctx.setLineDash([]);
          fctx.font = `500 10.5px ${FONT_SANS}`;
          fctx.textBaseline = 'middle';
          fctx.textAlign = 'left';
          const ftw = fctx.measureText(word).width + 14;
          fctx.fillStyle = rgb(ink.line);
          fctx.beginPath();
          fctx.roundRect(tagX, headY - 9, ftw, 18, 3);
          fctx.fill();
          fctx.fillStyle = rgb(ink.panel);
          fctx.fillText(word, tagX + 7, headY + 0.5);
          /* the axis */
          fctx.font = `500 10px ${FONT_SANS}`;
          fctx.fillStyle = rgb(ink.muted);
          for (let i = 0; i < ticks; i++) {
            const x = pane.x0 + 14 + i * tickGap;
            fctx.fillText(clock(momentAt(x), false), x, axisY);
          }
          /* THE CROSSHAIR: in the pane, the pointer (or the arrow) reads the line — the moment under it on the tag and the
             axis */
          if (fx > pane.x0 && fx < pane.x1 && fy > pane.y0 - 10 && fy < axisY + 10) {
            const cx = Math.round(Math.max(pane.x0 + 1, Math.min(head, fx))) + 0.5;
            const cy = lineYAt(cx);
            fctx.strokeStyle = rgb(ink.ink, 0.38);
            fctx.setLineDash([2, 4]);
            fctx.beginPath();
            fctx.moveTo(cx, pane.y0);
            fctx.lineTo(cx, pane.y1);
            fctx.moveTo(pane.x0, Math.round(cy) + 0.5);
            fctx.lineTo(tagX, Math.round(cy) + 0.5);
            fctx.stroke();
            fctx.setLineDash([]);
            fctx.fillStyle = rgb(ink.line);
            fctx.beginPath();
            fctx.arc(cx, cy, 3, 0, Math.PI * 2);
            fctx.fill();
            const when = clock(momentAt(cx), true);
            fctx.font = `500 10.5px ${FONT_SANS}`;
            const ww = fctx.measureText(when).width + 14;
            fctx.beginPath();
            fctx.roundRect(cx - ww / 2, axisY - 9, ww, 18, 3);
            fctx.fill();
            fctx.beginPath();
            fctx.roundRect(tagX, cy - 9, ww, 18, 3);
            fctx.fill();
            fctx.fillStyle = rgb(ink.panel);
            fctx.textAlign = 'center';
            fctx.fillText(when, cx, axisY + 0.5);
            fctx.fillText(when, tagX + ww / 2, cy + 0.5);
            fctx.textAlign = 'left';
          }
          fctx.restore();
          /* only what is lit: the focus cut to the mask */
          fctx.setTransform(1, 0, 0, 1, 0, 0);
          fctx.globalCompositeOperation = 'destination-in';
          fctx.drawImage(mask, 0, 0, focus.width, focus.height);
          fctx.globalCompositeOperation = 'source-over';
          /* the broken screen gives way under it, and the sharp one is laid in */
          ctx.globalCompositeOperation = 'destination-out';
          ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(focus, bx0 * dpr, by0 * dpr, bw * dpr, bh * dpr, bx0 * dpr, by0 * dpr, bw * dpr, bh * dpr);
        }
      }

      /* 4 · TEARS: rows the pointer crossed fast, and the screen's own slips, pushed sideways for a moment */
      for (const t of tears) {
        const sx = Math.max(0, t.x0);
        const sw = Math.min(W, t.x1) - sx;
        const sh = Math.min(t.h, H - t.y);
        if (sw <= 0 || sh <= 0 || t.y < 0) continue;
        ctx.drawImage(canvas, sx * dpr, t.y * dpr, sw * dpr, sh * dpr, (sx + t.dx) * dpr, t.y * dpr, sw * dpr, sh * dpr);
      }

      /* 5 · THE ARROW of its own, while no pointer is on the screen */
      if (!calm && ghost.show > 0.02) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = ghost.show;
        ctx.beginPath();
        ARROW.forEach(([ax, ay], i) => (i ? ctx.lineTo(ghost.x + ax, ghost.y + ay) : ctx.moveTo(ghost.x + ax, ghost.y + ay)));
        ctx.closePath();
        ctx.fillStyle = rgb(ink.line);
        ctx.fill();
        ctx.strokeStyle = rgb(ink.panel);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    /* ---- WHEN IT DRAWS ----------------------------------------------------------------------------------------------- */

    let raf = 0;
    let seen = false;
    let drawn = 0;
    const loop = (now: number) => {
      raf = 0;
      if (!seen || document.visibilityState !== 'visible') return;
      if (now - drawn >= (hand.on ? 15 : 32)) {
        drawn = now;
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };
    const go = () => {
      if (calm || raf || !seen || document.visibilityState !== 'visible') return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    /* under reduced motion the frame stands still; its clock moves on once a minute while it is seen */
    let tick = 0;
    const minute = () => {
      window.clearTimeout(tick);
      if (!calm || !seen) return;
      draw(performance.now());
      tick = window.setTimeout(minute, 60_000 - (Date.now() % 60_000) + 50);
    };
    const redraw = () => {
      if (calm || !raf) draw(performance.now());
    };

    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const now = performance.now();
      /* a pointer that moves fast tears the rows it crosses */
      if (hand.on && !calm) {
        const sp = Math.hypot(x - hand.x, y - hand.y) / Math.max(1, now - hand.at);
        if (sp > 0.9) {
          const dir = Math.sign(x - hand.x) || 1;
          for (let i = 0; i < 3; i++)
            tears.push({ y: Math.round(y + (rand() - 0.5) * 70), h: 2 + Math.floor(rand() * 7), dx: dir * (6 + rand() * 22) * Math.min(2, sp), x0: x - 150, x1: x + 150, until: now + 140 + rand() * 90 });
        }
      }
      hand.x = x;
      hand.y = y;
      hand.at = now;
      hand.on = true;
      go();
      if (calm) {
        lit.length = 0;
        draw(now);
      }
    };
    const leave = () => {
      if (!hand.on) return;
      hand.on = false;
      /* the arrow takes over from where the pointer left, after a moment */
      const now = performance.now();
      ghost.x = ghost.fx = hand.x;
      ghost.y = ghost.fy = hand.y;
      ghost.rest = false;
      ghost.t = now + 1200;
      ghost.back = now + 1200;
      go();
      if (calm) {
        lit.length = 0;
        draw(now);
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') leave();
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', move);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointercancel', leave);
    canvas.addEventListener('pointerup', up);

    draw(performance.now());
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (calm) minute();
      else go();
    });
    io.observe(host);
    const ro = new ResizeObserver(() => {
      size();
      while (steps.length < cap()) {
        steps.unshift({ val: steps[0]?.val ?? 0, vol: 0.3, jit: 0 });
        t0 -= STEP;
      }
      redraw();
    });
    ro.observe(host);
    /* a theme turn: every ink read again once the new ground is on the page, the still parts drawn again */
    let themed = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(themed);
      themed = requestAnimationFrame(() => {
        ink = inksOf(host);
        layout();
        build();
        redraw();
      });
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'], subtree: true });
    document.addEventListener('visibilitychange', go);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(themed);
      window.clearTimeout(tick);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', go);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerdown', move);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointercancel', leave);
      canvas.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <div ref={box} className={`relative w-full ${className}`} data-footer-art>
      <canvas ref={cvs} aria-hidden="true" className="absolute inset-0 block touch-pan-y" />
    </div>
  );
};

export default FooterArt;
