/*
==================================================
  SLAYER TERMINAL - THE HERO'S WINDOW BOOTS
  (pages/landing/Boot.tsx)

  "i feel like the landing page is missing something like that snazz" (the owner, 2026-10-03). Once, as the page
  opens, the hero's window comes up out of the footer's photograph — the terminal caught on a black screen, only its
  brightest marks left, broken into coarse pixels with a hair of red on one edge and blue on the other (components/
  layout/FooterArt.tsx) — and in about a second it sharpens into the desk: the pixels halve stage by stage, the dim
  marks come in under the bright ones, the fringe closes, and a row or two tears aside on the way. Then the canvas lets
  go and the window is the window.

  It draws the window's own still (the film's first frame), and the window holds its film on that frame until the canvas
  has gone (`onDone`), so it ends on what is there. On paper the marks that
  survive are the darkest (ink), as the footer prints on paper. Once a visit — a return to the landing within the
  terminal does not boot it again — never where less motion is asked for, never in a tab behind, and not at all if the
  still is slow to come (the window does not wait on its own entrance).
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { inksOf, rgb, rng } from '../../components/layout/footer/kit';

/** the coarse pixel at each stage (CSS px) and when, as a share of the run, it comes in — it halves faster as it goes */
const STAGES: [number, number][] = [
  [0, 16],
  [0.14, 12],
  [0.26, 8],
  [0.37, 6],
  [0.48, 4],
  [0.58, 3],
  [0.68, 2],
  [0.77, 1],
];
/** the run, the canvas letting go after it, and the most the still may take to arrive before the boot gives way (ms); it
    starts no sooner than START after the window mounts, so its coarsest stages land once the window has risen into view
    (the hero's rise, index.css .landing-rise, begins 260 ms in) */
const RUN = 1100;
const LET_GO = 300;
const WAIT = 1200;
const START = 320;

let booted = false;

/** the picture in coarse pixels: each pixel the block's strongest mark (the brightest on black, the darkest on paper),
    its colour and how strong it is */
interface Coarse {
  w: number;
  h: number;
  rgba: Uint8ClampedArray;
  mark: Float32Array;
}

const Boot = ({ src, onDone }: { src: string; /** the canvas is gone (or never came): the window may play its film */ onDone?: () => void }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const calm = useReducedMotion();
  const [gone, setGone] = useState(() => booted || calm === true || typeof document === 'undefined' || document.visibilityState !== 'visible');
  const [letGo, setLetGo] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (gone) done.current?.();
  }, [gone]);

  useEffect(() => {
    if (gone) return;
    booted = true;
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) {
      setGone(true);
      return;
    }
    let alive = true;
    let raf = 0;
    let timer = 0;
    let started = false;
    const born = performance.now();
    /* a still slow to come, or one that never comes: the boot gives way and the window shows what it has */
    const giveUp = window.setTimeout(() => alive && !started && setGone(true), WAIT);
    const img = new Image();
    img.src = src;

    const run = () => {
      started = true;
      window.clearTimeout(giveUp);
      const box = c.getBoundingClientRect();
      const W = Math.max(1, Math.round(box.width));
      const H = Math.max(1, Math.round(box.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      const ink = inksOf(c);
      const groundCh = getComputedStyle(c).getPropertyValue('--canvas').trim() || '5 5 5';
      const [gr, gg, gb] = groundCh.split(/\s+/).map(Number);
      const dark = 0.2126 * gr + 0.7152 * gg + 0.0722 * gb < 128;
      const ground = rgb(groundCh);

      /* the still at the screen's own size, once: its colours and the strength of every mark */
      const base = document.createElement('canvas');
      base.width = W;
      base.height = H;
      const bctx = base.getContext('2d', { willReadFrequently: true });
      if (!bctx) return setGone(true);
      bctx.drawImage(img, 0, 0, W, H);
      const px = bctx.getImageData(0, 0, W, H).data;
      const strength = new Float32Array(W * H);
      for (let i = 0, j = 0; j < strength.length; i += 4, j++) {
        const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
        strength[j] = dark ? l : 1 - l;
      }
      const coarse = new Map<number, Coarse>();
      const coarseAt = (s: number): Coarse => {
        const hit = coarse.get(s);
        if (hit) return hit;
        const w = Math.ceil(W / s);
        const h = Math.ceil(H / s);
        const rgba = new Uint8ClampedArray(w * h * 4);
        const mark = new Float32Array(w * h);
        /* a big block is read every other pixel: its strongest mark is wide enough to be met */
        const stride = s >= 8 ? 2 : 1;
        for (let by = 0; by < h; by++) {
          const y0 = by * s;
          const y1 = Math.min(H, y0 + s);
          for (let bx = 0; bx < w; bx++) {
            const x0 = bx * s;
            const x1 = Math.min(W, x0 + s);
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
            rgba[o] = px[at * 4];
            rgba[o + 1] = px[at * 4 + 1];
            rgba[o + 2] = px[at * 4 + 2];
            rgba[o + 3] = 255;
            mark[by * w + bx] = best;
          }
        }
        const out = { w, h, rgba, mark };
        coarse.set(s, out);
        return out;
      };

      const sm = document.createElement('canvas');
      const smc = sm.getContext('2d');
      const tint = document.createElement('canvas');
      const tc = tint.getContext('2d');
      if (!smc || !tc) return setGone(true);
      const tinted = (hue: string) => {
        tint.width = sm.width;
        tint.height = sm.height;
        tc.globalCompositeOperation = 'source-over';
        tc.drawImage(sm, 0, 0);
        tc.globalCompositeOperation = 'source-in';
        tc.fillStyle = rgb(hue, 0.85);
        tc.fillRect(0, 0, tint.width, tint.height);
        return tint;
      };

      const frame = (now: number) => {
        if (!alive) return;
        const ms = now - t0;
        const t = Math.min(1, ms / RUN);
        let step = STAGES[0][1];
        for (const [at, s] of STAGES) if (t >= at) step = s;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, c.width, c.height);
        if (step > 1) {
          /* the marks that survive: only the strongest at first, the dim ones coming in under them */
          const keep = 0.58 * Math.max(0, 1 - t / 0.62);
          const g = coarseAt(step);
          const out = new ImageData(g.w, g.h);
          out.data.set(g.rgba);
          if (keep > 0) for (let k = 0; k < g.mark.length; k++) if (g.mark[k] < keep) out.data[k * 4 + 3] = 0;
          sm.width = g.w;
          sm.height = g.h;
          smc.putImageData(out, 0, 0);
          const sx = step * dpr;
          const dw = g.w * sx;
          const dh = g.h * sx;
          /* the fringe, a copy of the marks in each colour laid under them a pixel aside, closing as the picture sharpens */
          const f = Math.round(Math.min(step, 5) * dpr * Math.max(0, 1 - t / 0.82));
          ctx.imageSmoothingEnabled = false;
          if (f > 0) {
            ctx.globalAlpha = 0.9;
            ctx.drawImage(tinted(ink.red), -f, 0, dw, dh);
            ctx.drawImage(tinted(ink.blue), f, 0, dw, dh);
            ctx.globalAlpha = 1;
          }
          ctx.drawImage(sm, 0, 0, dw, dh);
        } else {
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, 0, 0, c.width, c.height);
        }
        /* THE TEAR: a row or two pushed aside, a new pair every 70 ms, quieter as it goes */
        if (t < 0.55) {
          const r = rng(Math.floor(ms / 70) + 11);
          const rows = 1 + Math.floor(r() * 3);
          for (let k = 0; k < rows; k++) {
            const y = Math.floor(r() * c.height);
            const h = Math.max(1, Math.round((1 + Math.floor(r() * 3)) * step * dpr * 0.5));
            const dx = Math.round((r() - 0.5) * 2 * 40 * dpr * (1 - t / 0.55));
            if (dx) ctx.drawImage(c, 0, y, c.width, h, dx, y, c.width, h);
          }
        }
        if (t < 1) raf = requestAnimationFrame(frame);
        else {
          setLetGo(true);
          timer = window.setTimeout(() => alive && setGone(true), LET_GO + 40);
        }
      };
      const t0 = performance.now();
      raf = requestAnimationFrame(frame);
    };

    img.decode().then(
      () => {
        if (!alive) return;
        const since = performance.now() - born;
        if (since > WAIT || document.visibilityState !== 'visible') return setGone(true);
        timer = window.setTimeout(() => alive && run(), Math.max(0, START - since));
      },
      () => alive && setGone(true)
    );
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearTimeout(giveUp);
    };
  }, [gone, src]);

  if (gone) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full bg-canvas pointer-events-none transition-opacity ease-out"
      style={{ opacity: letGo ? 0 : 1, transitionDuration: `${LET_GO}ms` }}
      data-window-boot-art
    />
  );
};

export default Boot;
