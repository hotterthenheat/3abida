/*
==================================================
  SLAYER TERMINAL - THE FOOTER, ONE PIECE
  (components/layout/FooterArt.tsx)

  THE TERMINAL IN THE DARK (2026-10-02 — the owner, with
  a photograph of the terminal caught on a black screen,
  only its brightest marks left and broken into pixels:
  "make it super cool like a live footer make some sort
  of artistic thing from the photo"). From 2026-10-02 it
  was a band at the footer's foot; then (2026-10-03 — the
  owner: "i want that glitchy thing and the footer to be
  ONE not the art work and then the footer i want it as
  one art piece") it is THE WHOLE FOOTER: one screen, and
  the footer's words are on it.

  The screen is the photograph, made live: a chart pane —
  its price line walking, its last-price line run out to
  a tag, its volume, its time axis, its levels broken into
  coloured dashes — a strike ladder beside it, a row of
  chips under it, specks; every mark in coarse pixels with
  a hair of red on one edge and blue on the other, most of
  the screen gone to the ground. The chart stands where
  the footer marks its place ([data-footer-scene]); its
  levels run on across the whole screen, under the words,
  and the specks lie everywhere. THE WORDS ARE THE
  SCREEN'S BRIGHTEST MARKS ([data-footer-lit], index.css
  .footer-word): the same hair of red and blue at rest.

  THE POINTER BRINGS IT BACK, anywhere on the footer:
  around it the screen comes into focus — the pixels give
  way to the terminal, sharp; the frames of its panels
  come back round the words ([data-footer-panel]); the
  words under it go bright and lose their fringe; in the
  chart a crosshair reads the line, the moment under it on
  the tag and the axis. A pointer that moves fast tears
  the rows it crosses, words and all. Where it has been
  goes dark again in about a second. With no pointer on it
  an arrow of its own — the photograph's — drifts over the
  chart and rests on what it reads (it lights no words).

  Art, not data: no figure on it is a price — the tags are
  the clock, the axis the day's own times. Every ink is a
  token read off the footer's own ground, read again when
  the theme turns: on paper the photograph is printed in
  ink. THE COST: one canvas under the footer; the screen's
  still parts drawn once (again on a resize or a turn of
  theme), the moving ones about thirty times a second
  (sixty under the pointer), only while the footer is on
  screen with the tab in front; a word's light and slip
  are two custom properties, written only when they
  change. Under reduced motion one still frame, the
  pointer's focus drawn where it stands, the clock moved
  on once a minute.
==================================================
*/

import { useEffect, useRef, type ReactNode } from 'react';
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
/** the depth the footer's screen fades up over, out of the page (CSS px) */
const FADE = 110;
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

const FooterArt = ({ children, className = '' }: { children: ReactNode; className?: string }) => {
  const box = useRef<HTMLDivElement | null>(null);
  const layerA = useRef<HTMLCanvasElement | null>(null);
  const layerB = useRef<HTMLCanvasElement | null>(null);
  const layerC = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = box.current;
    const cvsA = layerA.current;
    const cvsB = layerB.current;
    const cvsC = layerC.current;
    if (!host || !cvsA || !cvsB || !cvsC) return;
    /* THREE LAYERS, so a frame touches only what moves (2026-10-03: one canvas over the whole footer cost a long task a
       frame): A, the broken screen's still parts, in coarse pixels, drawn once; B, the moving parts in the chart's box,
       coarse too; C, the focus round the pointer, the arrow — sharp, and only where they are. A and B are drawn a coarse
       pixel to a canvas pixel and shown pixelated, so the browser does the enlarging. */
    const aCtx = cvsA.getContext('2d');
    const bCtx = cvsB.getContext('2d');
    const cCtx = cvsC.getContext('2d');
    if (!aCtx || !bCtx || !cCtx) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    /* and off the page: the still parts broken (coarse) and sharp, and the two the focus is made in */
    const brokenStill = document.createElement('canvas');
    const sharpStill = document.createElement('canvas');
    const focus = document.createElement('canvas');
    const mask = document.createElement('canvas');
    const brkCtx = brokenStill.getContext('2d');
    const sctx = sharpStill.getContext('2d');
    const fctx = focus.getContext('2d');
    const mctx = mask.getContext('2d');
    if (!brkCtx || !sctx || !fctx || !mctx) return;

    /* what was drawn out of place last frame — a focus, a tear, the arrow — to be put back */
    let wasA: Box[] = [];
    let wasC: Box[] = [];
    /* a box in CSS px, as whole coarse pixels (a pixel's margin round it) */
    const toLo = (r: Box) => {
      const x = Math.max(0, Math.floor(r.x0 / PIX) - 1);
      const y = Math.max(0, Math.floor(r.y0 / PIX) - 1);
      return { x, y, w: Math.min(LW, Math.ceil(r.x1 / PIX) + 1) - x, h: Math.min(LH, Math.ceil(r.y1 / PIX) + 1) - y };
    };
    /* the still screen put back in a box, from its own copy */
    const restoreA = (r: Box) => {
      const q = toLo(r);
      if (q.w <= 0 || q.h <= 0) return;
      aCtx.setTransform(1, 0, 0, 1, 0, 0);
      aCtx.globalCompositeOperation = 'source-over';
      aCtx.clearRect(q.x, q.y, q.w, q.h);
      aCtx.drawImage(brokenStill, q.x, q.y, q.w, q.h, q.x, q.y, q.w, q.h);
    };
    /* the sharp layer cleared in a box */
    const clearC = (r: Box) => {
      const x = Math.max(0, Math.floor(r.x0) - 2);
      const y = Math.max(0, Math.floor(r.y0) - 2);
      const w = Math.min(W, Math.ceil(r.x1) + 2) - x;
      const h = Math.min(H, Math.ceil(r.y1) + 2) - y;
      if (w <= 0 || h <= 0) return;
      cCtx.setTransform(1, 0, 0, 1, 0, 0);
      cCtx.clearRect(x * dpr, y * dpr, w * dpr, h * dpr);
    };


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
    /* THE SCREEN'S LAYOUT, in CSS px, measured off the footer: the chart in the box it marks for it, the frames of its
       panels, and its words */
    let scene: Box = { x0: 0, x1: 0, y0: 0, y1: 0 };
    let pane: Box = { x0: 0, x1: 0, y0: 0, y1: 0 };
    let lineTop = 0;
    let lineBot = 0;
    let volTop = 0;
    let axisY = 0;
    let tagX = 0;
    let lad = { cx: 0, cy: 0, w: 0, h: 0 };
    let chipsY = 0;
    let levels: { y: number; hue: string; segs: [number, number][]; wide: [number, number][] | null }[] = [];
    let panels: Box[] = [];
    let words: { el: HTMLElement; box: Box; lit: number; slip: number }[] = [];
    const cap = () => Math.ceil((pane.x1 - pane.x0) / GAP) + 6;
    const rel = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      return { x0: r.left - h.left, x1: r.right - h.left, y0: r.top - h.top, y1: r.bottom - h.top };
    };

    const layout = () => {
      const marked = host.querySelector('[data-footer-scene]');
      const inset = W >= 1440 ? (W - 1440) / 2 + 40 : W >= 1024 ? 40 : W >= 640 ? 24 : 16;
      scene = marked ? rel(marked) : { x0: inset, x1: W - inset, y0: 0, y1: H };
      const sw = scene.x1 - scene.x0;
      const sh = scene.y1 - scene.y0;
      phone = sw < 560;
      pane = { x0: scene.x0, x1: scene.x0 + sw * 0.6, y0: scene.y0 + 24, y1: scene.y1 - 48 };
      const ph = pane.y1 - pane.y0;
      lineTop = pane.y0 + ph * 0.12;
      lineBot = pane.y0 + ph * 0.58;
      volTop = pane.y0 + ph * 0.7;
      axisY = pane.y1 + 14;
      tagX = pane.x1 + 8;
      lad = { cx: scene.x0 + sw * (phone ? 0.89 : 0.86), cy: scene.y0 + sh * 0.44, w: sw * (phone ? 0.18 : 0.2), h: sh * 0.62 };
      chipsY = scene.y1 - 9;
      panels = Array.from(host.querySelectorAll('[data-footer-panel]'), rel);
      /* a word's light and slip start from nothing again, so its box is measured where it stands */
      for (const w of words) {
        w.el.style.removeProperty('--lit');
        w.el.style.removeProperty('--slip');
      }
      words = Array.from(host.querySelectorAll<HTMLElement>('[data-footer-lit]'), el => ({ el, box: rel(el), lit: 0, slip: 0 }));
      /* the levels across the pane: each a coloured line broken into dashes (the photograph's), the same every time — and
         every other one runs on across the whole screen, under the words, all but gone */
      const r = rng(77);
      const count = phone ? 4 : 6;
      levels = Array.from({ length: count }, (_, i) => {
        const y = lineTop + ((i + 0.5) / count) * (lineBot - lineTop + ph * 0.1) + (r() - 0.5) * 6;
        const dash = (from: number, to: number, gap: number) => {
          const out: [number, number][] = [];
          for (let x = from + r() * 20; x < to; ) {
            const len = 5 + r() * 34;
            out.push([x, Math.min(to, x + len)]);
            x += len + 4 + r() * gap;
          }
          return out;
        };
        return { y: Math.round(y), hue: ink.hues[i % ink.hues.length], segs: dash(pane.x0, pane.x1, 26), wide: i % 2 ? dash(0, W, 120) : null };
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
      letters(c, 'terminal  /  pulse', scene.x0, scene.y0 + 7, 9.5, keep(0.45));
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
      /* the levels: dashes in the terminal's colours, a small mark at each end of the pane — and the ones that run on across
         the screen, faint, under the words */
      for (const l of levels) {
        if (l.wide) {
          c.fillStyle = rgb(l.hue, sharp ? 0.3 : 0.32);
          if (sharp) c.fillRect(0, l.y - 0.5, W, 1);
          else for (const [a, b] of l.wide) if ((a < pane.x0 - 4 || a > pane.x1 + 4) && r() < 0.3) c.fillRect(a, l.y - 1, b - a, 2);
        }
        c.fillStyle = rgb(l.hue, sharp ? 0.75 : 0.62);
        if (sharp) c.fillRect(pane.x0 + 1, l.y - 0.5, pane.x1 - pane.x0 - 2, 1);
        else for (const [a, b] of l.segs) if (r() < 0.4) c.fillRect(a, l.y - 1, b - a, 2);
        if (keep(0.5)()) c.fillRect(pane.x0 + 2, l.y - 3, 7, 6);
        if (keep(0.5)()) c.fillRect(pane.x1 - 9, l.y - 3, 7, 6);
      }
      /* THE PANELS round the words: only in focus — the screen's own frames come back round what the pointer reads */
      if (sharp) {
        c.strokeStyle = rgb(ink.ink, 0.14);
        c.lineWidth = 1;
        for (const b of panels) {
          c.beginPath();
          c.roundRect(Math.round(b.x0 - 12) + 0.5, Math.round(b.y0 - 10) + 0.5, Math.round(b.x1 - b.x0 + 24), Math.round(b.y1 - b.y0 + 20), 6);
          c.stroke();
          /* a tick at the frame's head, like a panel's title rule */
          c.fillStyle = rgb(ink.ink, 0.22);
          c.fillRect(Math.round(b.x0 - 12), Math.round(b.y0 - 10), 14, 1);
        }
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
      if (sharp) c.fillRect(lad.cx - lad.w / 2, sy, scene.x1 - (lad.cx - lad.w / 2), 1);
      else for (let x = lad.cx - lad.w / 2; x < scene.x1; x += 18 + r() * 30) c.fillRect(x, sy, 10 + r() * 40, 2);
      c.fillRect(scene.x1 - 7, sy - 3, 7, 7);
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
        for (let i = 0; i < Math.round((W * H) / 60000); i++) {
          const cx = r() * W;
          const cy = H * (0.06 + r() * 0.88);
          c.fillStyle = rgb(ink.line, 0.22);
          c.fillRect(cx, cy, 6 + r() * 10, 2);
          c.fillRect(cx, cy, 2, 6);
        }
      }
    };

    /* THE FOOTER COMES UP OUT OF THE PAGE: its first lines fade in from nothing (a canvas, cut by a gradient, once) */
    const rise = (c: CanvasRenderingContext2D, width: number, depth: number) => {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'destination-out';
      const g = c.createLinearGradient(0, 0, 0, depth);
      g.addColorStop(0, 'rgb(0 0 0 / 1)');
      g.addColorStop(1, 'rgb(0 0 0 / 0)');
      c.fillStyle = g;
      c.fillRect(0, 0, width, depth);
      c.restore();
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
      brkCtx.clearRect(0, 0, LW, LH);
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
      brkCtx.drawImage(tint(ink.red), -1, 0);
      brkCtx.drawImage(tint(ink.blue), 1, 0);
      brkCtx.drawImage(raw, 0, 0);
      rise(brkCtx, LW, FADE / PIX);
      rise(sctx, W * dpr, FADE * dpr);
      /* layer A is the broken still whole; B and C start empty */
      aCtx.setTransform(1, 0, 0, 1, 0, 0);
      aCtx.globalCompositeOperation = 'source-over';
      aCtx.clearRect(0, 0, LW, LH);
      aCtx.drawImage(brokenStill, 0, 0);
      bCtx.setTransform(1, 0, 0, 1, 0, 0);
      bCtx.clearRect(0, 0, LW, LH);
      cCtx.setTransform(1, 0, 0, 1, 0, 0);
      cCtx.clearRect(0, 0, cvsC.width, cvsC.height);
      wasA = [];
      wasC = [];
    };

    const size = () => {
      W = host.clientWidth;
      H = host.clientHeight;
      LW = Math.max(1, Math.ceil(W / PIX));
      LH = Math.max(1, Math.ceil(H / PIX));
      for (const c of [cvsC, focus]) {
        c.width = Math.max(1, Math.round(W * dpr));
        c.height = Math.max(1, Math.round(H * dpr));
      }
      cvsC.style.width = `${W}px`;
      cvsC.style.height = `${H}px`;
      for (const c of [cvsA, cvsB, mask]) {
        c.width = LW;
        c.height = LH;
      }
      for (const c of [cvsA, cvsB]) {
        c.style.width = `${LW * PIX}px`;
        c.style.height = `${LH * PIX}px`;
      }
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
    const lit: { x: number; y: number; t: number; r: number; hand: boolean }[] = [];
    let tears: { y: number; h: number; dx: number; x0: number; x1: number; until: number; hand: boolean }[] = [];
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
    let wordsAt = 0;
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
          lit.push({ x: fx, y: fy, t: now, r: (hand.on ? REACH : REACH * 0.82) * (phone ? 0.7 : 1), hand: hand.on });
      }
      while (lit.length && (lit.length > 40 || now - lit[0].t > LINGER)) lit.shift();
      tears = tears.filter(t => t.until > now);

      /* WHAT IS OUT OF PLACE THIS FRAME: the focus's box (snapped to the coarse grid), the rows torn, the arrow */
      let focusBox: Box | null = null;
      if (lit.length) {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const l of lit) {
          if (now - l.t >= LINGER) continue;
          x0 = Math.min(x0, l.x - l.r);
          y0 = Math.min(y0, l.y - l.r);
          x1 = Math.max(x1, l.x + l.r);
          y1 = Math.max(y1, l.y + l.r);
        }
        x0 = Math.max(0, Math.floor(x0 / PIX) * PIX);
        y0 = Math.max(0, Math.floor(y0 / PIX) * PIX);
        x1 = Math.min(LW * PIX, Math.ceil(x1 / PIX) * PIX);
        y1 = Math.min(LH * PIX, Math.ceil(y1 / PIX) * PIX);
        if (x1 > x0 && y1 > y0) focusBox = { x0, y0, x1, y1 };
      }
      const tearBoxes = tears.map(t => ({ x0: Math.max(0, Math.min(t.x0, t.x0 + t.dx)), x1: Math.min(W, Math.max(t.x1, t.x1 + t.dx)), y0: t.y, y1: t.y + t.h }));

      /* 1 · THE STILL SCREEN (layer A): what was drawn over last frame is put back, and the rows torn now slip */
      for (const r of wasA) restoreA(r);
      for (const r of tearBoxes) restoreA(r);
      if (focusBox) restoreA(focusBox);
      aCtx.imageSmoothingEnabled = false;
      for (const t of tears) {
        const q = toLo({ x0: Math.max(0, t.x0), x1: Math.min(W, t.x1), y0: t.y, y1: t.y + t.h });
        if (q.w > 0 && q.h > 0) aCtx.drawImage(brokenStill, q.x, q.y, q.w, q.h, q.x + Math.round(t.dx / PIX), q.y, q.w, q.h);
      }

      /* 2 · THE MOVING PARTS (layer B), in the chart's box only: the volume, the line, its last price and the axis */
      const sb = toLo({ x0: scene.x0 - 24, x1: scene.x1 + 24, y0: scene.y0 - 8, y1: scene.y1 + 8 });
      bCtx.setTransform(1, 0, 0, 1, 0, 0);
      bCtx.globalCompositeOperation = 'source-over';
      bCtx.clearRect(sb.x, sb.y, sb.w, sb.h);
      bCtx.setTransform(1 / PIX, 0, 0, 1 / PIX, 0, 0);
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
        bCtx.fillStyle = rgb(hue, a);
        for (let i = first; i < n; i++) {
          const x = xOf(i);
          if (x < pane.x0 || steps[i].jit > 0.55) continue;
          const h = steps[i].vol * vh;
          bCtx.fillRect(x + dx, vb - h, 2, h);
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
      bCtx.lineJoin = 'round';
      bCtx.lineWidth = 2.6;
      bCtx.strokeStyle = rgb(ink.red, 0.6);
      trace(bCtx, -PIX, 0, 1.6);
      bCtx.stroke();
      bCtx.strokeStyle = rgb(ink.blue, 0.6);
      trace(bCtx, PIX, 1, 1.6);
      bCtx.stroke();
      bCtx.strokeStyle = rgb(ink.line);
      trace(bCtx, 0, 0, 1.6);
      bCtx.stroke();
      /* the last price run out to its tag; the tag is the clock */
      const word = clock(wall, !calm);
      bCtx.fillStyle = rgb(ink.line, 0.95);
      bCtx.fillRect(head, Math.round(headY) - 1, tagX - head, 2);
      bCtx.font = `600 10px ${FONT_SANS}`;
      const tw = bCtx.measureText(word).width + 12;
      bCtx.strokeStyle = rgb(ink.line);
      bCtx.lineWidth = 2;
      bCtx.strokeRect(tagX, headY - 8, tw, 16);
      bCtx.textBaseline = 'middle';
      bCtx.textAlign = 'left';
      bCtx.fillText(word, tagX + 6, headY + 0.5);
      /* the time axis: the day's own times, on through the empty space ahead as a chart's axis runs */
      const ticks = phone ? 3 : 6;
      const tickGap = ((tagX - pane.x0) * 0.95) / ticks;
      bCtx.font = `600 8.5px ${FONT_SANS}`;
      for (let i = 0; i < ticks; i++) {
        const x = pane.x0 + 14 + i * tickGap;
        bCtx.fillStyle = rgb(ink.line, 0.9);
        bCtx.fillText(clock(momentAt(x), false), x, axisY);
        bCtx.fillRect(x - 2, axisY + 7, 30, 2);
      }
      /* the moving parts tear with the rest */
      bCtx.setTransform(1, 0, 0, 1, 0, 0);
      bCtx.imageSmoothingEnabled = false;
      for (const t of tears) {
        const q = toLo({ x0: Math.max(scene.x0 - 24, t.x0), x1: Math.min(scene.x1 + 24, t.x1), y0: t.y, y1: t.y + t.h });
        if (q.w > 0 && q.h > 0) bCtx.drawImage(cvsB, q.x, q.y, q.w, q.h, q.x + Math.round(t.dx / PIX), q.y, q.w, q.h);
      }
      /* the screen's own glitch: now and then a row slips sideways for a moment */
      if (!calm && rand() < dt / 2200) {
        const y = Math.floor(rand() * LH);
        tears.push({ y: y * PIX, h: (1 + Math.floor(rand() * 3)) * PIX, dx: (rand() - 0.5) * 40, x0: 0, x1: W, until: now + 110, hand: false });
      }

      /* 3 · THE FOCUS (layer C): where the pointer (or the arrow) is and has been, the broken screen gives way and the
         terminal comes back, sharp — only in the focus's own box */
      for (const r of wasC) clearC(r);
      if (focusBox) {
        const { x0: bx0, y0: by0, x1: bx1, y1: by1 } = focusBox;
        const bw = bx1 - bx0;
        const bh = by1 - by0;
        const lx = bx0 / PIX;
        const ly = by0 / PIX;
        const lw = bw / PIX;
        const lh = bh / PIX;
        clearC(focusBox);
        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.clearRect(lx, ly, lw, lh);
        for (const l of lit) {
          const s = Math.max(0, 1 - (now - l.t) / LINGER);
          if (s <= 0) continue;
          const g = mctx.createRadialGradient(l.x / PIX, l.y / PIX, 0, l.x / PIX, l.y / PIX, l.r / PIX);
          g.addColorStop(0, `rgb(0 0 0 / ${s})`);
          g.addColorStop(0.45, `rgb(0 0 0 / ${s * 0.9})`);
          g.addColorStop(1, 'rgb(0 0 0 / 0)');
          mctx.fillStyle = g;
          mctx.fillRect((l.x - l.r) / PIX, (l.y - l.r) / PIX, (2 * l.r) / PIX, (2 * l.r) / PIX);
        }
        /* the broken screen gives way under it (A and B, cut by the mask) */
        for (const c of [aCtx, bCtx]) {
          c.setTransform(1, 0, 0, 1, 0, 0);
          c.globalCompositeOperation = 'destination-out';
          c.drawImage(mask, lx, ly, lw, lh, lx, ly, lw, lh);
          c.globalCompositeOperation = 'source-over';
        }
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
        /* only what is lit: the focus cut to the mask, and laid in */
        fctx.setTransform(1, 0, 0, 1, 0, 0);
        fctx.globalCompositeOperation = 'destination-in';
        fctx.imageSmoothingEnabled = true;
        fctx.drawImage(mask, lx, ly, lw, lh, bx0 * dpr, by0 * dpr, bw * dpr, bh * dpr);
        fctx.globalCompositeOperation = 'source-over';
        cCtx.setTransform(1, 0, 0, 1, 0, 0);
        cCtx.drawImage(focus, bx0 * dpr, by0 * dpr, bw * dpr, bh * dpr, bx0 * dpr, by0 * dpr, bw * dpr, bh * dpr);
      }

      /* 4 · THE ARROW of its own, while no pointer is on the screen */
      let arrowBox: Box | null = null;
      if (!calm && ghost.show > 0.02) {
        arrowBox = { x0: ghost.x - 3, y0: ghost.y - 3, x1: ghost.x + 15, y1: ghost.y + 22 };
        clearC(arrowBox);
        cCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cCtx.globalAlpha = ghost.show;
        cCtx.beginPath();
        ARROW.forEach(([ax, ay], i) => (i ? cCtx.lineTo(ghost.x + ax, ghost.y + ay) : cCtx.moveTo(ghost.x + ax, ghost.y + ay)));
        cCtx.closePath();
        cCtx.fillStyle = rgb(ink.line);
        cCtx.fill();
        cCtx.strokeStyle = rgb(ink.panel);
        cCtx.lineWidth = 1;
        cCtx.stroke();
        cCtx.globalAlpha = 1;
        cCtx.setTransform(1, 0, 0, 1, 0, 0);
      }
      /* what is out of place now, to be put back next frame */
      wasA = focusBox ? [focusBox, ...tearBoxes] : tearBoxes;
      wasC = [focusBox, arrowBox].filter((b): b is Box => !!b);

      /* 6 · THE WORDS: lit where the reader's pointer is and has been (the arrow of its own lights none), and torn with the
         rows a fast pointer tears — thirty times a second at most, in twelfths, each written only when it changes (a word
         drawn again is its text and its fringe painted again) */
      if (now - wordsAt < 30 && hand.on) return;
      wordsAt = now;
      for (const w of words) {
        let v = 0;
        for (const l of lit) {
          if (!l.hand) continue;
          const s = 1 - (now - l.t) / LINGER;
          if (s <= 0) continue;
          const dx = l.x < w.box.x0 ? w.box.x0 - l.x : l.x > w.box.x1 ? l.x - w.box.x1 : 0;
          const dy = l.y < w.box.y0 ? w.box.y0 - l.y : l.y > w.box.y1 ? l.y - w.box.y1 : 0;
          const near = 1 - Math.hypot(dx, dy) / (l.r * 0.85);
          if (near > 0) v = Math.max(v, s * ease(Math.min(1, near * 1.4)));
        }
        let slip = 0;
        for (const t of tears) if (t.hand && t.y < w.box.y1 && t.y + t.h > w.box.y0 && t.x1 > w.box.x0 && t.x0 < w.box.x1) slip += t.dx * 0.3;
        slip = Math.round(Math.max(-9, Math.min(9, slip)));
        v = Math.round(v * 12) / 12;
        if (v !== w.lit) {
          w.lit = v;
          if (w.lit) w.el.style.setProperty('--lit', w.lit.toFixed(2));
          else w.el.style.removeProperty('--lit');
        }
        if (slip !== w.slip) {
          w.slip = slip;
          if (slip) w.el.style.setProperty('--slip', `${slip}px`);
          else w.el.style.removeProperty('--slip');
        }
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
      const r = host.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const now = performance.now();
      /* a pointer that moves fast tears the rows it crosses */
      if (hand.on && !calm) {
        const sp = Math.hypot(x - hand.x, y - hand.y) / Math.max(1, now - hand.at);
        if (sp > 0.9) {
          const dir = Math.sign(x - hand.x) || 1;
          for (let i = 0; i < 3; i++)
            tears.push({ y: Math.round(y + (rand() - 0.5) * 70), h: 2 + Math.floor(rand() * 7), dx: dir * (6 + rand() * 22) * Math.min(2, sp), x0: x - 150, x1: x + 150, until: now + 140 + rand() * 90, hand: true });
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
    /* the pointer is read over the whole footer — the words and the links are on the screen, not over it */
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerdown', move);
    host.addEventListener('pointerleave', leave);
    host.addEventListener('pointercancel', leave);
    host.addEventListener('pointerup', up);

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
    /* the words are measured where they stand: once the type is in, again (a word's box moves when its font arrives) */
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      layout();
      build();
      redraw();
    });
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
      alive = false;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(themed);
      window.clearTimeout(tick);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', go);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerdown', move);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('pointercancel', leave);
      host.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <div ref={box} className={`relative isolate w-full ${className}`} data-footer-art>
      {/* under everything the footer holds (its fade up out of the page is drawn into the still parts: a mask over the layers
          made the browser lay the whole footer again each frame) */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <canvas ref={layerA} className="absolute left-0 top-0 block [image-rendering:pixelated]" />
        <canvas ref={layerB} className="absolute left-0 top-0 block [image-rendering:pixelated]" />
        <canvas ref={layerC} className="absolute left-0 top-0 block" />
      </div>
      {children}
    </div>
  );
};

export default FooterArt;
