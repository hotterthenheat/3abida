/*
==================================================
  SLAYER TERMINAL - A WINDOW BOOTS
  (pages/landing/Boot.tsx)

  A WINDOW SWITCHES PAGES (2026-10-03 — the owner: "i feel like the landing page is missing something like that snazz",
  then "i love the little glitch affect i think we should implement that in more places"): a window that switches pages
  (the rooms, the reveal) brings each new page in along the way its page moves (`sweep`: Compass dealt a strip at a time,
  Pinpoint opening from the middle, Terrain drawn left to right, Trace printing down — "no two motions should be the
  same", the owner, 2026-10-03).

  It was a resolve out of a grain; refined the same day (the owner's partner: "too gamified"), and NO GRAIN SINCE
  2026-10-06 (the owner's directive: the grain stays on the opening's reveal alone, Opening.tsx). A switch starts from what
  the window showed (TerminalWindow `frameOf`), and the new page comes in over it, sharp, its edge soft; a page that comes
  all at once (`all`) goes down to the window's ground and the new one comes up out of it, never the two over each other.
  With no page before it (the first time a window is seen) the page comes in over the window's own ground. About a third
  of a second on a switch.

  It draws the window's own still (the film's first frame), and the window holds its film on that frame until the canvas
  has gone (`onDone`), so it ends on what is there. Never where less motion is asked for, never in a tab behind, and not
  at all if the still is slow to come: it gives way WAIT in if it has not begun (the window never waits on its own
  entrance).
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { pictureIn } from './pixels';
import { drawFit, isPanel } from './fit';

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
  /** what the window showed the moment it switched (TerminalWindow `frameOf`): the new page comes in over it */
  from?: CanvasImageSource | null;
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

const Boot = ({ src, from = null, onDone, replay = false, run: runMs = RUN, start = START, sweep = 'all' }: Props) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const calm = useReducedMotion();
  const [gone, setGone] = useState(() => (!replay && booted) || calm === true || typeof document === 'undefined' || document.visibilityState !== 'visible');
  const [letGo, setLetGo] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  /* the page it had, as it was when the switch began (read once: the boot is mounted afresh for each page) */
  const had = useRef(from);
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
    const before = had.current;
    const panel = isPanel(src);

    const run = () => {
      started = true;
      window.clearTimeout(giveUp);
      const box = c.getBoundingClientRect();
      const W = Math.max(1, Math.round(box.width));
      const H = Math.max(1, Math.round(box.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      const ground = `rgb(${getComputedStyle(c).getPropertyValue('--canvas').trim() || '5 5 5'})`;
      /* the new page where the sweep has passed, its edge feathered (a layer cut by a gradient, or by a column mask) */
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
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = true;
        /* the page it had, or the window's ground */
        if (before) ctx.drawImage(before, 0, 0, c.width, c.height);
        else {
          ctx.fillStyle = ground;
          ctx.fillRect(0, 0, c.width, c.height);
        }
        const f = t * t * (3 - 2 * t);
        if (sweep === 'all' || !lctx) {
          /* ALL AT ONCE: the page it had goes down to the window's ground and the new one comes up out of it — never the
             two pages over each other (a crossfade of two desks read as a double exposure) */
          if (before) {
            ctx.fillStyle = ground;
            ctx.globalAlpha = Math.min(1, f * 2);
            ctx.fillRect(0, 0, c.width, c.height);
          }
          ctx.globalAlpha = before ? Math.max(0, f * 2 - 1) : f;
          drawFit(ctx, img, c.width, c.height, panel);
          ctx.globalAlpha = 1;
        } else {
          /* THE SWEEP: where its page's motion has passed, the new page is there — a soft edge, not a cut */
          const cw = c.width;
          const ch = c.height;
          lctx.globalCompositeOperation = 'source-over';
          lctx.clearRect(0, 0, cw, ch);
          lctx.imageSmoothingEnabled = true;
          /* a panel comes in whole on the window's ground, so the page it had is swept away round it too (fit.ts) */
          drawFit(lctx, img, cw, ch, panel, ground);
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
