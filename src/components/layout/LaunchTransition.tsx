/*
==================================================
  SLAYER TERMINAL - LAUNCH TRANSITION
  One branded gate, three triggers: "Launch terminal"
  CTAs, logo clicks, and every full page load (boot).
  Caret logo + a lime progress line over black, then
  the destination fades in beneath it. Fixed duration
  — when a real boot sequence exists it slots into
  the same hold.
==================================================
*/

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

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

/** Overlay fully visible while the bar fills… */
const HOLD_MS = 1050;
/** …then the destination mounts behind it before the fade-out starts. */
const REVEAL_MS = 300;

const captionFor = (path: string) => (path === '/' ? 'Loading' : 'Entering terminal');

export const LaunchProvider = ({ children }: { children: ReactNode }) => {
  // Boot gate: every full page load (first visit, refresh) opens through it.
  const [active, setActive] = useState(true);
  const [caption, setCaption] = useState(() => captionFor(window.location.pathname));
  const busyRef = useRef(true);
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
    (to: string = '/pulse') => {
      if (busyRef.current) return;
      busyRef.current = true;
      bootRef.current = false;
      setCaption(captionFor(to));
      setActive(true);
      window.setTimeout(() => {
        navigate(to);
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
            className="fixed inset-0 z-[100] bg-canvas flex flex-col items-center justify-center gap-6"
          >
            <span className="font-mono text-xl font-bold tracking-tight select-none">
              <span className="text-textMuted">&gt; </span>
              <span className="holo-text">slayer_terminal</span>
              <span className="inline-block w-[10px] h-[18px] ml-1.5 bg-textPrimary align-middle animate-cursor-blink" />
            </span>
            <div className="w-52 h-[2px] rounded-full bg-ink/[0.08] overflow-hidden">
              {/* CSS transform fill (see .animate-gate-fill) — compositor-driven,
                  so it never stutters while the main thread loads chunks. */}
              <div className="h-full rounded-full holo-bar animate-gate-fill" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-textMuted select-none">
              {caption}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </LaunchCtx.Provider>
  );
};
