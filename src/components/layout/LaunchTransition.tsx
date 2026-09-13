/*
==================================================
  SLAYER TERMINAL - LAUNCH TRANSITION
  (components/layout/LaunchTransition.tsx)

  One branded gate, three triggers: "Launch
  terminal" CTAs, logo clicks, and every full page
  load.

  THE ORIGINAL SCREEN, AND NOTHING ADDED TO IT
  (Noah, 2026-09-13: "go back the original ui of
  the loading screen not add stuff"). Three things,
  centred on the canvas: the caret wordmark, a
  hairline bar, one line of small caps. No chart,
  no dial, no percentage, no desk list. Every
  attempt to put something else here has been
  wrong; the screen is the wordmark.

  WHAT DID CHANGE IS UNDER IT, NOT ON IT. The gate
  waits for the terminal instead of for a timer,
  which is where the milliseconds are.

  It used to be a flat 1,050ms hold plus a 300ms
  reveal on EVERY load, with the bar filled by a
  CSS animation of exactly 1,350ms — a bar that
  measured nothing, over a wait that waited for
  nothing. Now the gate drives the simulator's own
  seeding at full speed (nothing is visible behind
  it, so there is no frame budget to protect), and
  it leaves the moment the active name's history is
  whole. A 420ms floor so it cannot flash, a 4s
  ceiling so a slow machine still gets in. The bar
  fills on the real number; it just does not print
  it.

  Measured on the production build, three
  alternating runs of each, mean of /pulse,
  /terrain, /record/stocks and /community, from
  navigation to the last full-screen overlay
  leaving the page:

      before  2,046ms       after  1,377ms

  — 669ms off every page load, a third of it. Read
  the ratio, not the absolutes: the same pair
  re-measured later the same day, on a box under
  more load, came back 2,159ms and 1,523ms. Both
  runs are ~30%.

  Two
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

const captionFor = (path: string) => (path === '/' ? 'Loading' : 'Entering terminal');

export const LaunchProvider = ({ children }: { children: ReactNode }) => {
  // Boot gate: every full page load (first visit, refresh) opens through it.
  const [active, setActive] = useState(true);
  const [caption, setCaption] = useState(() => captionFor(window.location.pathname));
  const busyRef = useRef(true);
  /** Boot renders the gate already opaque — a fade-in would flash the page. */
  const bootRef = useRef(true);
  const navigate = useNavigate();

  /*
    THE BAR IS WRITTEN, NOT RENDERED. The seed loop sets the transform on the
    node directly instead of going through state. That is not housekeeping at
    this moment: the gate covers the one second in the app's life when the main
    thread is fully saturated — requestAnimationFrame fires twice in an entire
    boot, measured — and re-rendering the overlay forty-five times inside it
    cost ~70ms. This screen renders twice now: mount and close.
  */
  const progressRef = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);
  const paint = useCallback((p: number) => {
    progressRef.current = p;
    if (barRef.current) barRef.current.style.transform = `scaleX(${Math.max(0.03, p)})`;
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
      anyway (the wordmark's pan and the caret's blink are both CSS, and the
      bar moves on a transform). setTimeout(0) between 22ms slices keeps the
      loop near fully busy and still yields to the compositor.
    */
    const slice = () => {
      if (stopped) return;
      const elapsed = performance.now() - started;
      const state = Simulator.seedAsync(sym, SLICE_MS);
      paint(Simulator.seedProgress(sym));
      if (state === 'done' || elapsed > CEILING_MS) {
        paint(1);
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
      /* Nothing to build on a CTA — the book is already walked, so the bar
         reads full because it is. */
      setCaption(captionFor(to));
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
            <span className="font-mono text-xl font-bold tracking-tight select-none">
              <span className="text-textMuted">&gt; </span>
              <span className="holo-text">slayer_terminal</span>
              <span className="inline-block w-[10px] h-[18px] ml-1.5 bg-textPrimary align-middle animate-cursor-blink" />
            </span>
            <div className="w-52 h-[2px] rounded-full bg-ink/[0.08] overflow-hidden">
              {/* Still a transform, so the fill runs on the compositor and stays
                  smooth while the main thread seeds — scaled to the real number
                  now instead of a fixed 1,350ms keyframe. */}
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
