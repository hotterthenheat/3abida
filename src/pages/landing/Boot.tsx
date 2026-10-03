/*
==================================================
  SLAYER TERMINAL - A WINDOW BOOTS
  (pages/landing/Boot.tsx)

  "i feel like the landing page is missing something like that snazz" (the owner, 2026-10-03). Once, as the page
  opens, the hero's window comes up out of the footer's photograph — the terminal caught on a black screen, only its
  brightest marks left, broken into coarse pixels with a hair of red on one edge and blue on the other (pixels.ts, the
  footer's own language) — and in about a second it sharpens into the desk: the pixels halve stage by stage, the dim
  marks come in under the bright ones, the fringe closes, and a row or two tears aside on the way. Then the canvas lets
  go and the window is the window. Then: "i love the little glitch affect i think we should implement that in more
  places" — so a window that switches pages (the four systems' stage) boots each new page the same way, quicker
  (`replay`, `run`), the picture coming back sharp along the way its page moves (`sweep`: Compass dealt a strip at a
  time, Pinpoint opening from the middle, Terrain drawn left to right, Trace printing down — "no two motions should be
  the same", the owner of the systems' arrivals, 2026-10-03).

  It draws the window's own still (the film's first frame), and the window holds its film on that frame until the canvas
  has gone (`onDone`), so it ends on what is there. On paper the marks that survive are the darkest (ink), as the
  footer prints on paper. The hero's boot is once a visit — a return to the landing within the terminal does not boot
  it again; never where less motion is asked for, never in a tab behind, and not at all if the still is slow to come:
  it gives way WAIT in if it has not begun (the window never waits on its own entrance).
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { inksAt, pieceOf, STATE_COUNT, tear } from './pixels';
import { rgb } from '../../components/layout/footer/kit';

/** when, as a share of the run, each sharper state comes in — it halves faster as it goes; past the last, the picture */
const AT = [0, 0.14, 0.26, 0.37, 0.48, 0.58, 0.68, 0.77];
/** the coarse pixel of each state (pixels.ts STATES), for the tear's rows and the fringe */
const STEP = [16, 12, 8, 6, 4, 3, 2, 1];
/** the hero's run, the canvas letting go after it, and the most the still may take before the boot gives way (ms); the
    hero's starts no sooner than 320 ms after the window mounts, so its coarsest stages land once the window has risen
    into view (the hero's rise, index.css .landing-rise, begins 260 ms in) */
const RUN = 1100;
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
      const piece = pieceOf(img, 0, 0, img.naturalWidth, img.naturalHeight, W, H, inks);
      if (!piece) return setGone(true);
      const ground = rgb(inks.ground);
      const t0 = performance.now();
      const frame = (now: number) => {
        if (!alive) return;
        const ms = now - t0;
        const t = Math.min(1, ms / runMs);
        let k = 0;
        for (let i = 0; i < AT.length; i++) if (t >= AT[i]) k = i;
        const step = STEP[k];
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, c.width, c.height);
        /* the last state is the picture itself */
        const sharp = k >= AT.length - 1 ? 1 : k / STATE_COUNT;
        piece.draw(ctx, 0, 0, c.width, c.height, sharp, { fringe: Math.round(Math.min(step, 5) * dpr * Math.max(0, 1 - t / 0.82)) });
        /* THE SWEEP: where its page's motion has passed, the picture is already itself */
        if (sweep !== 'all' && sharp < 1) {
          const f = Math.max(0, Math.min(1, (t - 0.12) / 0.66));
          const cw = c.width;
          const ch = c.height;
          ctx.save();
          ctx.beginPath();
          if (sweep === 'right') ctx.rect(0, 0, cw * f, ch);
          else if (sweep === 'down') ctx.rect(0, 0, cw, ch * f);
          else if (sweep === 'out') ctx.arc(cw / 2, ch / 2, Math.hypot(cw, ch) * 0.5 * f, 0, Math.PI * 2);
          else {
            /* dealt: four strips, each laid as the one before it lands */
            for (let i = 0; i < 4; i++) {
              const g = Math.max(0, Math.min(1, f * 4 - i));
              if (g > 0) ctx.rect((cw / 4) * i, 0, cw / 4, ch * g);
            }
          }
          ctx.clip();
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, 0, 0, cw, ch);
          ctx.restore();
        }
        /* THE TEAR: a row or two pushed aside, a new pair every 70 ms, quieter as it goes */
        if (t < 0.55) tear(ctx, c, ms, 1 - t / 0.55, step * dpr * 0.5);
        if (t < 1) raf = requestAnimationFrame(frame);
        else {
          setLetGo(true);
          timer = window.setTimeout(() => alive && setGone(true), LET_GO + 40);
        }
      };
      raf = requestAnimationFrame(frame);
    };

    img.decode().then(
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
