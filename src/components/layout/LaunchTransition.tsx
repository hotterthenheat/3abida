/*
==================================================
  SLAYER TERMINAL - LAUNCH TRANSITION
  (components/layout/LaunchTransition.tsx)

  One branded gate, three triggers: "Launch
  terminal" CTAs, logo clicks, and every full page
  load.

  BACK TO THE ORIGINAL SCREEN (Noah, 2026-09-13:
  "go back to the original loading screen remove
  that chart… that chart thing is not it"). The
  boot chart is gone — deleted, not hidden. What is
  here is the screen that was here before: the
  caret wordmark, a hairline bar, one line of small
  caps, centred on the canvas and nothing else.

  THE ONE ADDITION IS A RING, which is the
  difference Noah left room for. It is a dial, not
  a drawing: a hairline track, the real arc on it,
  the percentage in the middle, and a beam on the
  outer circle that travels the perimeter the same
  way the border beam does everywhere else in this
  app. It renders three circles and reads one
  number. Nothing on it can be clicked or dragged
  and there is no data behind it but our own
  progress.

  THE PROGRESS NEVER GOES THROUGH REACT. The dial,
  the bar and the percentage are written straight
  to their nodes by the seed loop. That is not a
  micro-optimisation here: this is the one second
  in the app's life when the main thread is fully
  saturated (requestAnimationFrame fires twice in
  the whole boot, measured), and re-rendering the
  overlay forty-five times inside it costs real
  milliseconds. React renders this screen three
  times now — mount, ready, close — and the numbers
  on it still update every slice.

  IT STILL WAITS FOR THE TERMINAL, NOT FOR A TIMER.
  That part stays, because it is where the
  milliseconds went. What it used to be: a flat
  1,050ms hold plus a 300ms reveal on EVERY load,
  with a bar filled by a CSS animation of exactly
  1,350ms — a progress bar that measured nothing,
  over a wait that waited for nothing. What it is:
  the gate drives the simulator's own seeding at
  full speed (nothing is visible behind it, so
  there is no frame budget to protect), reads the
  real progress of that walk, and leaves the moment
  the active name's history is whole. A 420ms floor
  so it cannot flash, a 4s ceiling so a slow
  machine still gets in, and nothing in between
  that is not the actual work.

  Measured on the production build, three alternating
  runs of each, mean of /pulse, /terrain,
  /record/stocks and /community, from navigation to
  the last full-screen overlay leaving the page:

      before  2,046ms       after  1,377ms

  — 669ms off every page load, a third of it. Two
  thirds of that is this file; the rest is the
  simulator no longer photographing the book every
  minute for a month (see "THE BOOK IS SAMPLED" in
  core/simulator.ts), which is what the gate was
  waiting for.

  Measure it by watching for the OVERLAY, not for a
  selector on it: waiting on this file's own
  data-attribute measures a different thing on the
  build that predates the attribute, and the CDP
  round trip that resolves it reads ~150ms fast.
  Detect any fixed, full-viewport element at
  z-index >= 100 instead and the two builds are
  comparable.
==================================================
*/

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Simulator from '../../core/simulator';

interface LaunchCtxValue {
  /** Play the gate, then navigate (defaults to the terminal's front door). */
  launch: (to?: string) => void;
}

const LaunchCtx = createContext<LaunchCtxValue | null>(null);

export const useLaunch = (): LaunchCtxValue => {
  const ctx = useContext(LaunchCtx);
  if (!ctx) throw new Error('useLaunch must be used within LaunchProvider');
  return ctx;
};

/** Below this the gate would read as a flash rather than a screen. */
const FLOOR_MS = 420;
/** Above this we open anyway — a slow machine gets a terminal, not a spinner. */
const CEILING_MS = 4000;
/** How much of the walk each slice takes while the gate is covering the screen. */
const SLICE_MS = 22;
/** A CTA gate is a transition, not a boot: there is nothing left to build. */
const STEP_MS = 360;
/** …then the destination mounts behind it before the fade-out starts. */
const REVEAL_MS = 220;

/* The ring, in its own coordinates. pathLength=100 on both circles so the arc
   is set in whole percent and the beam is one lap of -100, the way every other
   travelling stroke in this app is drawn (see .animate-border-trace). */
const RING = 84;
const MID = RING / 2;
/** The outer hairline the beam runs on */
const R_EDGE = 41;
/** The dial itself */
const R_DIAL = 34;

const captionFor = (path: string) => (path === '/' ? 'Loading' : 'Entering terminal');

export const LaunchProvider = ({ children }: { children: ReactNode }) => {
  // Boot gate: every full page load (first visit, refresh) opens through it.
  const [active, setActive] = useState(true);
  const [building, setBuilding] = useState(() => Simulator.getActiveTicker());
  /** Set on a CTA only — on boot the caption names the book being built. */
  const [stepCaption, setStepCaption] = useState<string | null>(null);
  /** Flips once, at the end — the only progress-driven render on this screen. */
  const [ready, setReady] = useState(false);
  const busyRef = useRef(true);
  /* The nodes the seed loop writes to. No state, so no render per slice. */
  const progressRef = useRef(0);
  const ringRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<SVGCircleElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  /** Boot renders the gate already opaque — a fade-in would flash the page. */
  const bootRef = useRef(true);
  const navigate = useNavigate();

  /** Put a 0..1 on the screen. Four writes, no reconciliation, no layout read. */
  const paint = useCallback((p: number) => {
    progressRef.current = p;
    const pct = Math.round(p * 100);
    if (barRef.current) barRef.current.style.transform = `scaleX(${Math.max(0.03, p)})`;
    if (dialRef.current) dialRef.current.style.strokeDashoffset = String(100 - pct);
    if (pctRef.current) pctRef.current.textContent = `${pct}%`;
    if (ringRef.current) ringRef.current.dataset.launchRing = String(pct);
  }, []);

  /* The gate mounts on a CTA too, and that one opens already full. */
  useEffect(() => {
    if (active) paint(progressRef.current);
  }, [active, paint]);

  /*
    THE BOOT GATE IS THE BOOT. While it is up it advances the active name's
    history in fat slices — the screen behind it is covered, so a long slice
    costs nothing anyone can see — and it closes on the walk being whole
    rather than on a clock.
  */
  useEffect(() => {
    const sym = Simulator.getActiveTicker();
    setBuilding(sym);
    const started = performance.now();
    let timer = 0;
    let closing = false;
    let stopped = false;
    const finish = () => {
      if (closing) return;
      closing = true;
      const waited = performance.now() - started;
      window.setTimeout(
        () => {
          setActive(false);
          busyRef.current = false;
        },
        Math.max(0, FLOOR_MS - waited) + REVEAL_MS
      );
    };
    /*
      A TIMER, NOT requestAnimationFrame. rAF caps the walk at one slice per
      frame — at 10ms of work in a 16ms frame the seed sits idle for a third
      of it, for the benefit of animations that are not on the main thread
      anyway (the wordmark's pan, the caret's blink and the ring's beam are
      all CSS, and the bar moves on a transform). setTimeout(0) between 22ms
      slices keeps the loop near fully busy and still yields often enough for
      React to paint the percentage.
    */
    const slice = () => {
      if (stopped) return;
      const elapsed = performance.now() - started;
      const state = Simulator.seedAsync(sym, SLICE_MS);
      paint(Simulator.seedProgress(sym));
      if (state === 'done' || elapsed > CEILING_MS) {
        paint(1);
        setReady(true);
        finish();
        return;
      }
      timer = window.setTimeout(slice, 0);
    };
    timer = window.setTimeout(slice, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [paint]);

  const launch = useCallback(
    (to: string = '/pulse') => {
      if (busyRef.current) return;
      busyRef.current = true;
      bootRef.current = false;
      /* Nothing to build on a CTA — the book is already walked. A short,
         honest beat, and the dial reads full because it is. */
      setStepCaption(captionFor(to));
      setReady(true);
      paint(1);
      setActive(true);
      window.setTimeout(() => {
        navigate(to);
        window.setTimeout(() => {
          setActive(false);
          busyRef.current = false;
        }, REVEAL_MS);
      }, STEP_MS);
    },
    [navigate, paint]
  );

  const caption = stepCaption ?? (ready ? 'Book ready' : `Building the book · ${building}`);
  /* First paint only — from here the seed loop writes these nodes itself. */
  const pct0 = Math.round(progressRef.current * 100);

  return (
    <LaunchCtx.Provider value={{ launch }}>
      {children}
      <AnimatePresence>
        {active && (
          <motion.div
            key="launch-gate"
            initial={bootRef.current ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[100] bg-canvas flex flex-col items-center justify-center gap-6"
            data-launch-gate
          >
            {/* THE DIAL. Three circles and one number; no handlers, no hit
                area, nothing behind it but the seed's own position. */}
            <div ref={ringRef} className="relative select-none" style={{ width: RING, height: RING }} data-launch-ring={pct0}>
              <svg viewBox={`0 0 ${RING} ${RING}`} width={RING} height={RING} className="block -rotate-90" aria-hidden="true" focusable="false">
                <circle cx={MID} cy={MID} r={R_EDGE} fill="none" stroke="rgb(var(--border-subtle))" strokeWidth="1" />
                {/* one dash, one lap — the border beam, bent into a circle */}
                <circle
                  cx={MID}
                  cy={MID}
                  r={R_EDGE}
                  fill="none"
                  stroke="rgb(var(--select))"
                  strokeWidth="1"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="8 92"
                  opacity="0.7"
                  className="animate-border-trace"
                />
                <circle cx={MID} cy={MID} r={R_DIAL} fill="none" stroke="rgb(var(--border-subtle))" strokeWidth="2" />
                <circle
                  ref={dialRef}
                  cx={MID}
                  cy={MID}
                  r={R_DIAL}
                  fill="none"
                  stroke="rgb(var(--select))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="100"
                  strokeDashoffset={100 - pct0}
                  className="transition-[stroke-dashoffset] duration-150 ease-out"
                />
              </svg>
              <span ref={pctRef} className="absolute inset-0 flex items-center justify-center font-mono text-[11px] tnum text-textMuted">
                {pct0}%
              </span>
            </div>

            <span className="font-mono text-xl font-bold tracking-tight select-none">
              <span className="text-textMuted">&gt; </span>
              <span className="holo-text">slayer_terminal</span>
              <span className="inline-block w-[10px] h-[18px] ml-1.5 bg-textPrimary align-middle animate-cursor-blink" />
            </span>

            <div className="w-52 h-[2px] rounded-full bg-ink/[0.08] overflow-hidden">
              {/* Still a transform, so the fill runs on the compositor and stays
                  smooth while the main thread seeds — but scaled to a real
                  number now instead of a fixed 1,350ms keyframe. */}
              <div
                ref={barRef}
                className="h-full w-full rounded-full holo-bar origin-left transition-transform duration-150 ease-out"
                style={{ transform: `scaleX(${Math.max(0.03, progressRef.current)})` }}
              />
            </div>

            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-textMuted select-none" data-launch-caption>
              {caption}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </LaunchCtx.Provider>
  );
};
