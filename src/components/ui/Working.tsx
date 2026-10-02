/*
==================================================
  SLAYER TERMINAL - "IT IS WORKING"
  (components/ui/Working.tsx)

  The small mark for a wait where THE BOX IS ALREADY
  ON SCREEN and only what is in it is pending (Noah,
  2026-09-19: "a little loading component that i
  dont think should take away from the skeleton
  load"). Two jobs that never overlap:

    a SKELETON   what SHAPE is coming — a page's code
                 is on its way (the route skeletons)
    THIS         the thing you are looking at is
                 WORKING — the window is booting, the
                 name you picked is arriving, the
                 button you pressed is doing it

  So it is never used on a route change, and never
  for a wait the reader cannot see: it appears only
  once the wait has lasted `delay` (300ms), so a fast
  one never flickers it. No wait is ever invented to
  show it off.

  THE MARK is loading-ui's Morphing Infinity — a line
  that goes circle → infinity → circle (loading-ui.com
  /docs/components/morphing-infinity; their words:
  "the installed files are yours"). Adapted: it rides
  the motion library we already have (framer-motion is
  the same package under its old name), it holds still
  as the infinity where the reader asked for less
  motion, and it takes its colour from the text around
  it. COLOUR: leave it the quiet ink. It is not live
  or where-you-are (the silver accent), not the supreme
  (magenta) and not a direction.

  WHAT IS HERE:
    <MorphingInfinity />   the mark alone
    <Working />            the mark after the delay,
                           with an optional line, as
                           a polite status
    useWorking(active)     the delay, for a surface
                           that places the mark itself
    useBusy()              for a button: run an action,
                           and if it returns a promise
                           the button is busy until it
                           settles. Today's actions are
                           instant and never show it;
                           at launch the same handlers
                           return the request.
==================================================
*/

import { useCallback, useEffect, useRef, useState, type SVGProps } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const CIRCLE_A = 'M 12 8 C 14.21 8 16 9.79 16 12 C 16 14.21 14.21 16 12 16 C 9.79 16 8 14.21 8 12 C 8 9.79 9.79 8 12 8 Z';
const INFINITY_PATH = 'M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z';
const CIRCLE_B = 'M 12 16 C 14.21 16 16 14.21 16 12 C 16 9.79 14.21 8 12 8 C 9.79 8 8 9.79 8 12 C 8 14.21 9.79 16 12 16 Z';

/** How long a wait must last before the mark appears */
export const WORKING_DELAY = 300;

/** The mark alone. Decorative by default — `Working` carries the words for a screen reader. */
export const MorphingInfinity = ({ className = 'w-4 h-4', ...rest }: SVGProps<SVGSVGElement>) => {
  const calm = useReducedMotion();
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...rest}>
      {calm ? (
        <path d={INFINITY_PATH} />
      ) : (
        <motion.path
          initial={{ d: CIRCLE_A }}
          animate={{ d: [CIRCLE_A, INFINITY_PATH, CIRCLE_B, INFINITY_PATH, CIRCLE_A] }}
          transition={{ d: { duration: 5, ease: 'easeInOut', repeat: Infinity, times: [0, 0.25, 0.5, 0.75, 1] } }}
        />
      )}
    </svg>
  );
};

/** True once `active` has lasted `delay`; false the moment it ends */
export function useWorking(active: boolean, delay: number = WORKING_DELAY): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const t = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(t);
  }, [active, delay]);
  return active && shown;
}

/** Run an action; while a promise it returned is unsettled, `busy` is true. One action at a time. */
export function useBusy(): [boolean, (action: () => void | Promise<unknown>) => void] {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    []
  );
  const run = useCallback(
    (action: () => void | Promise<unknown>) => {
      if (busy) return;
      const out = action();
      if (!out || typeof (out as Promise<unknown>).then !== 'function') return;
      setBusy(true);
      void (out as Promise<unknown>)
        .catch(() => undefined)
        .then(() => {
          if (alive.current) setBusy(false);
        });
    },
    [busy]
  );
  return [busy, run];
}

interface WorkingProps {
  /** The wait is on. Default true — mount it while waiting, unmount it when done. */
  active?: boolean;
  delay?: number;
  /** One short line beside the mark. Without it a screen reader still hears "Working". */
  label?: string;
  /** Stack the mark over the line (a box's centre) or set them in a row (a head, a status line) */
  stacked?: boolean;
  /** The mark's size classes */
  mark?: string;
  className?: string;
}

const Working = ({ active = true, delay, label, stacked = false, mark, className = '' }: WorkingProps) => {
  const shown = useWorking(active, delay);
  if (!shown) return null;
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center text-textMuted animate-fade-in ${stacked ? 'flex-col gap-3' : 'gap-2'} ${className}`} data-working>
      <MorphingInfinity className={mark ?? (stacked ? 'w-12 h-12' : 'w-4 h-4')} />
      {label ? <span className="font-mono text-[10.5px] uppercase tracking-[0.2em]">{label}</span> : <span className="sr-only">Working</span>}
    </span>
  );
};

export default Working;
