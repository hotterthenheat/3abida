/*
==================================================
  SLAYER TERMINAL - A PICTURE COMING INTO FOCUS
  (pages/landing/pixels.ts)

  The landing's one way of drawing a picture that is not there yet: the terminal acquiring its screen. Born of the
  footer's photograph (components/layout/FooterArt.tsx — the terminal caught on a black screen, broken into pixels), and
  the owner, of the hero's boot (2026-10-03): "i love the little glitch affect i think we should implement that in more
  places". Then the owner's partner, the same day: the glitches were "too gamified" — the coarse blocks read as a game's
  pixels, the red and blue fringe and the torn rows as a game's damage. So on the page's content the picture now
  RESOLVES rather than breaks: a fine grain, without colour, its faintest marks not yet arrived, sharpening and taking its
  colour as it comes in. The fringe and the tear stay the footer's alone (the art piece at the end).

  A PIECE is a picture (or a part of one) made ready: its colours and the strength of every mark, read once at its own
  size. It is drawn at a SHARPNESS from 0 (the coarsest grain, grey, only the stronger marks) to 1 (the picture itself,
  from its source at full resolution); between, eight states — a grain, the weakest mark kept, how grey — each made the
  first time it is asked for and kept. A mark's strength is its light on black and its ink on paper.
==================================================
*/

/** the states a piece passes through as it sharpens: its grain (CSS px of the piece), the weakest mark kept, and how
    much of its colour is still to come (1 grey, 0 its own) */
const STATES: [number, number, number][] = [
  [6, 0.3, 1],
  [5, 0.24, 0.9],
  [4, 0.18, 0.75],
  [3, 0.12, 0.55],
  [3, 0.06, 0.35],
  [2, 0.03, 0.2],
  [2, 0, 0.08],
  [1, 0, 0],
];
export const STATE_COUNT = STATES.length;

/** what a picture is drawn with, read where it stands */
export interface Inks {
  /** the ground's channels, and whether it is black */
  ground: string;
  dark: boolean;
}
export const inksAt = (el: Element): Inks => {
  const ground = getComputedStyle(el).getPropertyValue('--canvas').trim() || '5 5 5';
  const [r, g, b] = ground.split(/\s+/).map(Number);
  return { ground, dark: 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 };
};

export interface Piece {
  /** the piece's own size (CSS px) */
  W: number;
  H: number;
  /** draws the piece into (x, y, w, h) of a context whose transform is in device px — sharpness 0…1 */
  draw(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sharpness: number, o?: { alpha?: number }): void;
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
  const states = new Map<number, HTMLCanvasElement>();
  /* a state, made once: each grain the block's strongest mark — its colour, greyed by how much is still to come, kept
     only if it is strong enough */
  const stateAt = (k: number): HTMLCanvasElement => {
    const hit = states.get(k);
    if (hit) return hit;
    const [step, keep, grey] = STATES[k];
    const w = Math.ceil(W / step);
    const h = Math.ceil(H / step);
    const out = new ImageData(w, h);
    const d = out.data;
    for (let by = 0; by < h; by++) {
      const y0 = by * step;
      const y1 = Math.min(H, y0 + step);
      for (let bx = 0; bx < w; bx++) {
        const x0 = bx * step;
        const x1 = Math.min(W, x0 + step);
        let best = -1;
        let at = 0;
        for (let y = y0; y < y1; y++) {
          const row = y * W;
          for (let x = x0; x < x1; x++) {
            const v = strength[row + x];
            if (v > best) {
              best = v;
              at = row + x;
            }
          }
        }
        const o = (by * w + bx) * 4;
        const r = px[at * 4];
        const g = px[at * 4 + 1];
        const b = px[at * 4 + 2];
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        d[o] = r + (l - r) * grey;
        d[o + 1] = g + (l - g) * grey;
        d[o + 2] = b + (l - b) * grey;
        d[o + 3] = best >= keep ? 255 : 0;
      }
    }
    const marks = canvasOf(w, h);
    marks.getContext('2d')?.putImageData(out, 0, 0);
    states.set(k, marks);
    return marks;
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
      } else {
        c.imageSmoothingEnabled = false;
        c.drawImage(stateAt(Math.min(STATES.length - 1, Math.max(0, Math.floor(sharpness * STATES.length)))), x, y, w, h);
      }
      c.restore();
    },
  };
};
