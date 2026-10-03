/*
==================================================
  SLAYER TERMINAL - THE BROKEN PICTURE
  (pages/landing/pixels.ts)

  The footer's photograph as a way of drawing any picture the landing holds: the terminal caught on a black screen,
  only its brightest marks left, broken into coarse pixels with a hair of red on one edge and blue on the other
  (components/layout/FooterArt.tsx). The owner, of the hero's boot (2026-10-03): "i love the little glitch affect i
  think we should implement that in more places" — so it is one thing, drawn one way: the hero's window booting
  (Boot.tsx), the desk falling apart and coming together (Scatter.tsx), a system's window switching.

  A PIECE is a picture (or a part of one) made ready to break: its colours and the strength of every mark, read once at
  its own size. It is drawn at a SHARPNESS from 0 (coarse blocks, only the strongest marks, the widest fringe) to 1 (the
  picture itself, from its source at full resolution). Between, eight states, each a pixel size and how strong a mark
  must be to survive — made the first time they are asked for and kept. A mark's strength is its light on black and its
  ink on paper, so a light picture breaks into its darkest marks.
==================================================
*/

import { inksOf, rgb } from '../../components/layout/footer/kit';

/** the states a piece passes through as it sharpens: its coarse pixel (CSS px of the piece) and the weakest mark kept */
const STATES: [number, number][] = [
  [16, 0.55],
  [12, 0.5],
  [8, 0.42],
  [6, 0.32],
  [4, 0.22],
  [3, 0.12],
  [2, 0.04],
  [1, 0],
];
export const STATE_COUNT = STATES.length;

/** the inks a broken picture is drawn with, read where it stands */
export interface Inks {
  red: string;
  blue: string;
  /** the ground's channels, and whether it is black */
  ground: string;
  dark: boolean;
}
export const inksAt = (el: Element): Inks => {
  const ink = inksOf(el);
  const ground = getComputedStyle(el).getPropertyValue('--canvas').trim() || '5 5 5';
  const [r, g, b] = ground.split(/\s+/).map(Number);
  return { red: ink.red, blue: ink.blue, ground, dark: 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 };
};

interface State {
  /** the surviving marks, one canvas pixel a coarse pixel */
  marks: HTMLCanvasElement;
  red: HTMLCanvasElement;
  blue: HTMLCanvasElement;
  step: number;
}

export interface Piece {
  /** the piece's own size (CSS px) */
  W: number;
  H: number;
  /** draws the piece into (x, y, w, h) of a context whose transform is in device px — sharpness 0…1; `fringe` the colours'
      offset in device px (by default a share of the coarse pixel, closing as it sharpens) */
  draw(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sharpness: number, o?: { alpha?: number; fringe?: number }): void;
}

const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
};

/** A PIECE of a picture: the part (sx, sy, sw, sh) of `img`, read at W × H CSS px */
export const pieceOf = (img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, W: number, H: number, inks: Inks): Piece | null => {
  W = Math.max(1, Math.round(W));
  H = Math.max(1, Math.round(H));
  const base = canvasOf(W, H);
  const bctx = base.getContext('2d', { willReadFrequently: true });
  if (!bctx) return null;
  bctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  const px = bctx.getImageData(0, 0, W, H).data;
  const strength = new Float32Array(W * H);
  for (let i = 0, j = 0; j < strength.length; i += 4, j++) {
    const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    strength[j] = inks.dark ? l : 1 - l;
  }
  const states = new Map<number, State>();
  const tinted = (from: HTMLCanvasElement, hue: string) => {
    const t = canvasOf(from.width, from.height);
    const tc = t.getContext('2d');
    if (!tc) return t;
    tc.drawImage(from, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = rgb(hue, 0.85);
    tc.fillRect(0, 0, t.width, t.height);
    return t;
  };
  /* a state, made once: each coarse pixel the block's strongest mark — its colour, kept only if it is strong enough */
  const stateAt = (k: number): State => {
    const hit = states.get(k);
    if (hit) return hit;
    const [step, keep] = STATES[k];
    const w = Math.ceil(W / step);
    const h = Math.ceil(H / step);
    const out = new ImageData(w, h);
    const d = out.data;
    /* a big block is read every other pixel: its strongest mark is wide enough to be met */
    const stride = step >= 8 ? 2 : 1;
    for (let by = 0; by < h; by++) {
      const y0 = by * step;
      const y1 = Math.min(H, y0 + step);
      for (let bx = 0; bx < w; bx++) {
        const x0 = bx * step;
        const x1 = Math.min(W, x0 + step);
        let best = -1;
        let at = 0;
        for (let y = y0; y < y1; y += stride) {
          const row = y * W;
          for (let x = x0; x < x1; x += stride) {
            const v = strength[row + x];
            if (v > best) {
              best = v;
              at = row + x;
            }
          }
        }
        const o = (by * w + bx) * 4;
        d[o] = px[at * 4];
        d[o + 1] = px[at * 4 + 1];
        d[o + 2] = px[at * 4 + 2];
        d[o + 3] = best >= keep ? 255 : 0;
      }
    }
    const marks = canvasOf(w, h);
    marks.getContext('2d')?.putImageData(out, 0, 0);
    const s: State = { marks, red: tinted(marks, inks.red), blue: tinted(marks, inks.blue), step };
    states.set(k, s);
    return s;
  };
  return {
    W,
    H,
    draw(c, x, y, w, h, sharpness, o = {}) {
      const alpha = o.alpha ?? 1;
      if (alpha <= 0 || w < 1 || h < 1) return;
      c.save();
      c.globalAlpha = alpha;
      if (sharpness >= 1) {
        c.imageSmoothingEnabled = true;
        c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        c.restore();
        return;
      }
      const st = stateAt(Math.min(STATES.length - 1, Math.max(0, Math.floor(sharpness * STATES.length))));
      /* the fringe: a copy of the marks in each colour laid under them, aside by a share of the coarse pixel as drawn */
      const f = o.fringe ?? Math.round(Math.min(st.step, 5) * (w / W) * Math.max(0, 1 - sharpness));
      c.imageSmoothingEnabled = false;
      if (f > 0) {
        c.globalAlpha = alpha * 0.9;
        c.drawImage(st.red, x - f, y, w, h);
        c.drawImage(st.blue, x + f, y, w, h);
        c.globalAlpha = alpha;
      }
      c.drawImage(st.marks, x, y, w, h);
      c.restore();
    },
  };
};

/** THE TEAR: a row or two of what is drawn pushed aside — a new set every 70 ms of `ms`, `amount` 0…1 of the widest push */
export const tear = (c: CanvasRenderingContext2D, canvas: HTMLCanvasElement, ms: number, amount: number, rowH: number, seed = 11) => {
  if (amount <= 0) return;
  let s = (Math.floor(ms / 70) + seed) >>> 0;
  const r = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const rows = 1 + Math.floor(r() * 3);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  for (let k = 0; k < rows; k++) {
    const y = Math.floor(r() * canvas.height);
    const h = Math.max(1, Math.round((1 + Math.floor(r() * 3)) * rowH));
    const dx = Math.round((r() - 0.5) * 2 * 40 * amount * (canvas.width / Math.max(1, canvas.clientWidth)));
    if (dx) c.drawImage(canvas, 0, y, canvas.width, h, dx, y, canvas.width, h);
  }
  c.restore();
};
