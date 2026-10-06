/*
==================================================
  SLAYER TERMINAL - A WINDOW BOOTS
  (pages/landing/Boot.tsx)

  "i feel like the landing page is missing something like that snazz" (the owner, 2026-10-03). Once, as the page
  opens, the hero's window comes up out of the footer's photograph — the terminal acquiring its screen — and resolves
  into the desk: the grain finer stage by stage, the faint marks coming in under the strong ones, the colour arriving
  last. Then the canvas lets go and the window is the window. Then: "i love the little glitch affect i think we should implement that in more
  places" — so a window that switches pages (the four systems' stage) boots each new page the same way, quicker
  (`replay`, `run`), the picture coming back sharp along the way its page moves (`sweep`: Compass dealt a strip at a
  time, Pinpoint opening from the middle, Terrain drawn left to right, Trace printing down — "no two motions should be
  the same", the owner of the systems' arrivals, 2026-10-03).

  REFINED THE SAME DAY (the owner's partner: "too gamified"): no coarse blocks, no red and blue fringe, no torn rows — the
  page comes in as a fine grain without its colour and resolves into itself (pixels.ts), in 900 ms on the hero and about
  half a second on a switch, the sweeps with a soft edge.

  It draws the window's own still (the film's first frame), and the window holds its film on that frame until the canvas
  has gone (`onDone`), so it ends on what is there. On paper the marks that survive are the darkest (ink), as the
  footer prints on paper. The hero's boot is once a visit — a return to the landing within the terminal does not boot
  it again; never where less motion is asked for, never in a tab behind, and not at all if the still is slow to come:
  it gives way WAIT in if it has not begun (the window never waits on its own entrance).
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { inksAt, pictureIn, pieceOf, STATE_COUNT } from './pixels';
import { rgb } from '../../components/layout/footer/kit';
import { unit } from './scale';

/** when, as a share of the run, each sharper state comes in; past the last, the picture itself */
const AT = [0, 0.1, 0.2, 0.3, 0.42, 0.54, 0.66, 0.78];
/** the hero's run, the canvas letting go after it, and the most the still may take before the boot gives way (ms); the
    hero's starts no sooner than 320 ms after the window mounts, so its coarsest stages land once the window has risen
    into view (the hero's rise, index.css .landing-rise, begins 260 ms in) */
const RUN = 900;
const LET_GO = 300;
const WAIT = 1200;
const START = 320;

let booted = false;

/** the way the picture comes back sharp: all at once, or along its page's own motion */
export type Sweep = 'all' | 'deal' | 'out' | 'right' | 'down';

interface Props {
  src: string;
  sweep?: Sweep;
  /** the canvas is gone (or never came): the window may play its film */
  onDone?: () => void;
  /** boots every time it is mounted (a window switching pages), not once a visit */
  replay?: boolean;
  /** the run, ms */
  run?: number;
  /** the soonest it starts after mounting, ms */
  start?: number;
}

const Boot = ({ src, onDone, replay = false, run: runMs = RUN, start = START, sweep = 'all' }: Props) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const calm = useReducedMotion();
  const [gone, setGone] = useState(() => (!replay && booted) || calm === true || typeof document === 'undefined' || document.visibilityState !== 'visible');
  const [letGo, setLetGo] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (gone) done.current?.();
  }, [gone]);

  useEffect(() => {
    if (gone) return;
    if (!replay) booted = true;
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
      const inks = inksAt(c);
      /* read in the design's px (scale.ts): the grain the same on every screen */
      const u = unit();
      const piece = pieceOf(img, 0, 0, img.naturalWidth, img.naturalHeight, W / u, H / u, inks);
      if (!piece) return setGone(true);
      const ground = rgb(inks.ground);
      /* the picture where the sweep has passed, its edge feathered (a layer cut by a gradient, or by a column mask) */
      const layer = document.createElement('canvas');
      layer.width = c.width;
      layer.height = c.height;
      const lctx = layer.getContext('2d');
      const cols = document.createElement('canvas');
      cols.width = 4;
      cols.height = 1;
      const kctx = cols.getContext('2d');
      const t0 = performance.now();
      const frame = (now: number) => {
        if (!alive) return;
        const ms = now - t0;
        const t = Math.min(1, ms / runMs);
        let k = 0;
        for (let i = 0; i < AT.length; i++) if (t >= AT[i]) k = i;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, c.width, c.height);
        /* the last state is the picture itself */
        const sharp = k >= AT.length - 1 ? 1 : k / STATE_COUNT;
        piece.draw(ctx, 0, 0, c.width, c.height, sharp);
        /* THE SWEEP: where its page's motion has passed, the picture is already itself — a soft edge, not a cut */
        if (sweep !== 'all' && sharp < 1 && lctx) {
          const f = Math.max(0, Math.min(1, (t - 0.08) / 0.7));
          const cw = c.width;
          const ch = c.height;
          lctx.globalCompositeOperation = 'source-over';
          lctx.clearRect(0, 0, cw, ch);
          lctx.imageSmoothingEnabled = true;
          lctx.drawImage(img, 0, 0, cw, ch);
          lctx.globalCompositeOperation = 'destination-in';
          if (sweep === 'deal' && kctx) {
            /* dealt: four columns, each coming in as the one before it lands */
            kctx.clearRect(0, 0, 4, 1);
            for (let i = 0; i < 4; i++) {
              kctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(1, f * 4 - i))})`;
              kctx.fillRect(i, 0, 1, 1);
            }
            lctx.imageSmoothingEnabled = false;
            lctx.drawImage(cols, 0, 0, cw, ch);
          } else {
            const soft = 0.22;
            let g: CanvasGradient;
            if (sweep === 'right') {
              const x = cw * (1 + soft) * f;
              g = lctx.createLinearGradient(x - cw * soft, 0, x, 0);
            } else if (sweep === 'down') {
              const y = ch * (1 + soft) * f;
              g = lctx.createLinearGradient(0, y - ch * soft, 0, y);
            } else {
              const R = Math.hypot(cw, ch) * 0.5;
              const r = R * (1 + soft) * f;
              g = lctx.createRadialGradient(cw / 2, ch / 2, Math.max(0, r - R * soft), cw / 2, ch / 2, Math.max(1, r));
            }
            g.addColorStop(0, 'rgba(0, 0, 0, 1)');
            g.addColorStop(1, 'rgba(0, 0, 0, 0)');
            lctx.fillStyle = g;
            lctx.fillRect(0, 0, cw, ch);
          }
          ctx.drawImage(layer, 0, 0);
        }
        if (t < 1) raf = requestAnimationFrame(frame);
        else {
          setLetGo(true);
          timer = window.setTimeout(() => alive && setGone(true), LET_GO + 40);
        }
      };
      raf = requestAnimationFrame(frame);
    };

    pictureIn(img).then(
      () => {
        if (!alive) return;
        const since = performance.now() - born;
        if (since > WAIT || document.visibilityState !== 'visible') return setGone(true);
        timer = window.setTimeout(() => alive && run(), Math.max(0, start - since));
      },
      () => alive && setGone(true)
    );
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearTimeout(giveUp);
    };
  }, [gone, src, replay, runMs, start, sweep]);

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
