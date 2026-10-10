/*
==================================================
  SLAYER TERMINAL - LAUNCH TRANSITION
  One branded gate, three triggers: "Launch terminal"
  CTAs, logo clicks, and every full page load (boot)
  — EXCEPT a load of the landing page itself (Noah,
  2026-09-19: "skip it on the landing"). The gate is
  there to cover the terminal assembling; on the front
  page there is nothing under it but a headline that
  is already drawn, and it held a visitor from X back
  a fixed 1.35s for nothing (measured on a slow phone:
  the headline was painted at 3.7s and could not be
  read until 4.5s).
  The living mark in its Loading state (the pan at
  speed, the cursor held), the wordmark typing in at
  28 ms a character, the progress line, and the
  signature under it — the Logo System's loading
  screen (2026-09-30). Then the destination fades in
  beneath it. Fixed duration — when a real boot
  sequence exists it slots into the same hold.

  ONLY INTO THE TERMINAL (2026-10-09, the audit's
  OU-O1): a load of About, Status, a legal page, the
  account forms, an invite or a wrong address opened
  behind "Entering terminal" for 1.35 s — on a wrong
  address over the prompt typing it. The gate stands
  only where a load lands in the terminal (TERMINAL,
  below); everywhere else the page opens bare, as the
  front page does.
==================================================
*/

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EMBEDDED } from '../../embed';
import { isTerminalPath } from '../../core/terminalPath';
import SlayerMark from '../../brand/SlayerMark';
import Wordmark from '../../brand/Wordmark';
import Signature from '../../brand/Signature';
import { warmShell } from './shell';

interface LaunchCtxValue {
  /** Play the gate, then navigate (defaults to the terminal's front door). `replace`: the page the gate leaves is not
      kept in the history — signing in, whose form Back would otherwise reopen filled (the audit's OU-A9) */
  launch: (to?: string, opts?: { replace?: boolean }) => void;
}

const LaunchCtx = createContext<LaunchCtxValue | null>(null);

export const useLaunch = (): LaunchCtxValue => {
  const ctx = useContext(LaunchCtx);
  if (!ctx) throw new Error('useLaunch must be used within LaunchProvider');
  return ctx;
};

/** Overlay fully visible while the bar fills… */
const HOLD_MS = 1050;
/** …then the destination mounts behind it before the fade-out starts. */
const REVEAL_MS = 300;

const captionFor = (path: string) => (path === '/' ? 'Loading' : 'Entering terminal');

/* THE TERMINAL'S ADDRESSES are core/terminalPath.ts (theme.ts reads them too): a full load of anything else opens WITHOUT
   the gate */
export { isTerminalPath };
const bootsBare = (): boolean => EMBEDDED || !isTerminalPath(window.location.pathname);

export const LaunchProvider = ({ children }: { children: ReactNode }) => {
  // Boot gate: every full page load (first visit, refresh) opens through it.
  /* …except the terminal in the landing's window (embed.ts): the page outside has played this gate already and holds
     its own "starting" mark over the window — a second gate inside it was two loaders in a row */
  const [active, setActive] = useState(() => !bootsBare());
  const [caption, setCaption] = useState(() => captionFor(window.location.pathname));
  /* …and with no gate up, the page's own doors answer at once — "Launch terminal" used to be ignored for the gate's 1.35s */
  const busyRef = useRef(!bootsBare());
  /** Boot renders the gate already opaque — a fade-in would flash the page. */
  const bootRef = useRef(true);
  const navigate = useNavigate();

  useEffect(() => {
    const t = window.setTimeout(() => {
      setActive(false);
      busyRef.current = false;
    }, HOLD_MS + REVEAL_MS);
    return () => window.clearTimeout(t);
  }, []);

  const launch = useCallback(
    (to: string = '/pulse', opts?: { replace?: boolean }) => {
      if (busyRef.current) return;
      busyRef.current = true;
      /* the terminal's shell is fetched as the gate goes up (it is its own chunk — shell.ts) */
      warmShell();
      bootRef.current = false;
      setCaption(captionFor(to));
      setActive(true);
      window.setTimeout(() => {
        navigate(to, { replace: !!opts?.replace });
        window.setTimeout(() => {
          setActive(false);
          busyRef.current = false;
        }, REVEAL_MS);
      }, HOLD_MS);
    },
    [navigate]
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
            className="fixed inset-0 z-[100] bg-canvas flex flex-col items-center justify-center gap-5"
            data-launch-gate
          >
            <SlayerMark size={52} bare state="loading" label="" />
            <Wordmark height={20} typing label="Slayer Terminal" />
            <div className="w-52 h-[2px] rounded-full bg-ink/[0.08] overflow-hidden" data-gate-track>
              {/* CSS transform fill (see .animate-gate-fill) — compositor-driven,
                  so it never stutters while the main thread loads chunks. On the light page the bar is the ink
                  (index.css — Noah, 2026-09-26: "esp the bar needs to be more apparent"). */}
              <div className="h-full rounded-full holo-bar animate-gate-fill" />
            </div>
            <span className="sr-only">{caption}</span>
            <Signature rule={false} className="text-[10.5px] select-none" />
          </motion.div>
        )}
      </AnimatePresence>
    </LaunchCtx.Provider>
  );
};
