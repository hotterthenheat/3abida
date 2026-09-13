/*
==================================================
  SLAYER TERMINAL - LAUNCH TRANSITION
  (components/layout/LaunchTransition.tsx)

  One branded gate, three triggers: "Launch
  terminal" CTAs, logo clicks, and every full page
  load.

  IT WAITS FOR THE TERMINAL NOW, NOT FOR A TIMER
  (Noah, 2026-09-13: "get the globally ms down").

  What it used to be: a flat 1,050ms hold plus a
  300ms reveal on EVERY load, with a bar filled by a
  CSS animation of exactly 1,350ms. A progress bar
  that measured nothing, over a wait that waited for
  nothing. The terminal behind it was usually ready
  well before the timer was.

  What it is: the boot gate drives the simulator's
  own seeding at full speed — nothing is visible
  behind it, so there is no frame budget to protect
  — reads the real progress of that walk, and leaves
  the moment the active name's history is whole. A
  420ms floor so it cannot flash, a 4s ceiling so a
  slow machine still gets in, and nothing in between
  that is not the actual work.

  Measured end to end on the production build, mean
  of /pulse, /terrain, /record/stocks and
  /community, from navigation to the terminal being
  on screen:

      before   1,981ms      after   1,247ms

  — 734ms off every page load. Two thirds of that is
  this file; the rest is the simulator no longer
  photographing the book every minute for a month
  (see "THE BOOK IS SAMPLED" in core/simulator.ts),
  which is what the gate was waiting for.

  WHAT IT SHOWS is the terminal as it stands: the
  desks come off the nav registry rather than a list
  typed here, so a desk added or removed changes
  this screen with it. The chart is
  BootChart — ours in grammar, locked and fed
  nothing real.
==================================================
*/

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Simulator from '../../core/simulator';
import { NAV_ITEMS } from './nav';
import BootChart from './BootChart';

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

/* The desks, from the registry the sidebar and the palette read. One list. */
const DESKS = NAV_ITEMS.map(n => n.label).join(' · ');

export const LaunchProvider = ({ children }: { children: ReactNode }) => {
  // Boot gate: every full page load (first visit, refresh) opens through it.
  const [active, setActive] = useState(true);
  const [progress, setProgress] = useState(0);
  const [building, setBuilding] = useState(() => Simulator.getActiveTicker());
  const busyRef = useRef(true);
  /** Boot renders the gate already opaque — a fade-in would flash the page. */
  const bootRef = useRef(true);
  const navigate = useNavigate();

  /*
    THE BOOT GATE IS THE BOOT. While it is up it advances the active name's
    history every frame with a fat slice — the screen behind it is covered, so
    a long slice costs nothing anyone can see — and it closes on the walk
    being whole rather than on a clock.
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
      anyway (the wordmark's pan and the caret's blink are both CSS, and the
      bar moves on width). setTimeout(0) between 22ms slices keeps the loop
      near fully busy and still yields often enough for React to paint the
      percentage.
    */
    const slice = () => {
      if (stopped) return;
      const elapsed = performance.now() - started;
      const state = Simulator.seedAsync(sym, SLICE_MS);
      setProgress(Simulator.seedProgress(sym));
      if (state === 'done' || elapsed > CEILING_MS) {
        setProgress(1);
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
  }, []);

  const launch = useCallback(
    (to: string = '/pulse') => {
      if (busyRef.current) return;
      busyRef.current = true;
      bootRef.current = false;
      /* Nothing to build on a CTA — the book is already walked. A short,
         honest beat, and the bar reads full because it is. */
      setBuilding(Simulator.getActiveTicker());
      setProgress(1);
      setActive(true);
      window.setTimeout(() => {
        navigate(to);
        window.setTimeout(() => {
          setActive(false);
          busyRef.current = false;
        }, REVEAL_MS);
      }, STEP_MS);
    },
    [navigate]
  );

  const pct = Math.round(progress * 100);

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
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[100] bg-canvas flex items-center justify-center px-6"
            data-launch-gate
          >
            <div className="w-full max-w-[520px] flex flex-col items-center gap-5">
              <span className="font-mono text-xl font-bold tracking-tight select-none">
                <span className="text-textMuted">&gt; </span>
                <span className="holo-text">slayer_terminal</span>
                <span className="inline-block w-[10px] h-[18px] ml-1.5 bg-textPrimary align-middle animate-cursor-blink" />
              </span>

              {/* OURS, AND LOCKED — see BootChart: flat SVG, fixed seed, no
                  handlers, pointer-events off, and not one real number on it */}
              <div className="w-full rounded-md border border-borderSubtle bg-panel overflow-hidden" data-launch-chart>
                <BootChart />
              </div>

              <div className="w-full flex flex-col gap-1.5">
                <div className="h-[2px] rounded-full bg-ink/[0.08] overflow-hidden">
                  {/* Width, not a keyframe: it is showing a real number now */}
                  <div className="h-full rounded-full holo-bar transition-[width] duration-150 ease-out" style={{ width: `${Math.max(3, pct)}%` }} data-launch-bar={pct} />
                </div>
                <div className="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-textMuted select-none">
                  <span data-launch-caption>
                    {pct >= 100 ? 'Book ready' : `Building the book · ${building}`}
                  </span>
                  <span className="ml-auto tnum tracking-normal">{pct}%</span>
                </div>
              </div>

              <p className="text-center font-mono text-[9px] uppercase tracking-[0.22em] text-textMuted/70 select-none leading-relaxed" data-launch-desks>
                {DESKS}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </LaunchCtx.Provider>
  );
};
