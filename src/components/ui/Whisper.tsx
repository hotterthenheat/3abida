/*
==================================================
  SLAYER TERMINAL - WHISPER (framer-motion build)

  A sentence that slides out of a word on hover or
  keyboard focus and glides back. The Weigher's
  identity wears it (Noah, 2026-08-30: "keep it on
  weigher"); the Trace strip does not — its tabs
  explain themselves with a hover card instead.
==================================================

  WHY THE FIRST BUILD STUTTERED. It tweened `grid-template-columns` 0fr→1fr
  in hand-written CSS. A grid track is a LAYOUT property: every frame of the
  reveal re-laid-out the whole strip on the main thread — the same thread
  the tape reconciles 120 rows on every second — so the motion was smooth
  until a tick landed under it. Measured with scripts/frame-gaps-proof.mjs:
  zero dropped frames idle, dropped frames and a 41.6ms hitch during
  reveals.

  THIS BUILD NEVER ANIMATES LAYOUT. The sentence mounts at its natural width
  in a single step, and the only per-frame work is transform and opacity.
  Neighbours that must glide rather than jump are framer `layout="position"`
  elements; the Weigher needs none (its session pill is absolutely placed).

  CONTRACT. The element the pointer lands on spreads `host` from
  useWhisper(). Focus opens it only when the focus is keyboard-visible, so a
  click never leaves a sentence hanging. Reduced-motion users get the
  sentence without the travel.
*/

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState, type FocusEvent, type ReactNode } from 'react';

export const WHISPER_EASE = [0.16, 1, 0.3, 1] as const;

export const useWhisper = () => {
  const [open, setOpen] = useState(false);
  const host = {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: (e: FocusEvent<HTMLElement>) => e.currentTarget.matches(':focus-visible') && setOpen(true),
    onBlur: () => setOpen(false),
  };
  return { open, host };
};

interface WhisperProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

export const Whisper = ({ open, children, className = '' }: WhisperProps) => {
  const still = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <span key="whisper" className={`inline-block overflow-hidden whitespace-nowrap leading-none ${className}`}>
          <motion.span
            className="block"
            initial={still ? false : { x: -14, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={still ? { opacity: 0 } : { x: -14, opacity: 0 }}
            transition={{ duration: still ? 0 : 0.4, ease: WHISPER_EASE }}
          >
            {children}
          </motion.span>
        </span>
      )}
    </AnimatePresence>
  );
};
