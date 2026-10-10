/*
==================================================
  SLAYER TERMINAL - THE LANDING'S GROUND
  (pages/landing/ground.tsx)

  THE PAGE STANDS ON THE VISITOR'S OWN GROUND ('a')
  from top to foot. The tour's turn to the other theme
  and home again was cut (2026-10-06 — the owner's
  directive: its two screens, "Dark for the night
  session." and "Paper for a bright room.", made the
  page long); the other theme ('b') is still known
  here, for the one room whose window plays in it
  (Rooms.tsx `other`).

  HOW:
  · a block of the page is STAMPED with its ground
    (`data-theme`), so every token inside it is right
    with no per-element colour transition;
  · the visitor's own ground is their stored choice,
    else their machine's. The toggle sets the ground
    under the bar to its other, for the whole site, and
    crossfades the page as ONE picture (View
    Transitions), at once where the browser cannot or
    the visitor asked for less motion. A ground PICKED
    here is the whole page's from then on, and no
    window shows the other theme (2026-10-03 audit:
    picked on the turned stretch, the toggle stored the
    opposite of what the reader asked for).

  THE FOIL TRAP. Tokens follow the nearest stamp, but
  the house's foil and paper rules in index.css are
  written against the ROOT's stamp, so a block on the
  other ground would wear the wrong foil. A child
  that needs the foil, or a solid button, asks
  `useBlockGround()` instead of trusting a class.
==================================================
*/

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { THEME_KEY, getResolvedTheme, setThemeChoice, stampRoot, subscribeTheme, type Theme } from '../../theme/theme';

export type Ground = Theme;
export const other = (g: Ground): Ground => (g === 'dark' ? 'light' : 'dark');

const media = typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const calm = typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const hasStoredChoice = (): boolean => {
  try {
    return localStorage.getItem(THEME_KEY) != null;
  } catch {
    return false;
  }
};
/** The visitor's ground: the choice they once made, else what their machine says. THE PAGES OUTSIDE THE TERMINAL STAND
    ON IT TOO (2026-10-09, the audit's OU-T1: a light machine's landing sent its "Sign up free" to a black form) — they
    wear this provider (pages/outside/OutsideFrame.tsx), and App.tsx stamps the root with it before the first paint of one */
export const readBase = (): Ground => (hasStoredChoice() ? getResolvedTheme() : media && !media.matches ? 'light' : 'dark');

interface GroundValue {
  /** The ground the page opens on — the visitor's own */
  a: Ground;
  /** The other theme, for the one room whose window plays in it (Rooms.tsx `other`) — the page's own once a ground is
      picked */
  b: Ground;
  /** The visitor picks a ground, for the whole site — from then on the whole page, and every window on it, is that */
  choose: (g: Ground) => void;
}

const Ctx = createContext<GroundValue | null>(null);
const BlockCtx = createContext<Ground>('dark');

export const useGround = (): GroundValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGround outside the landing');
  return v;
};
/** The ground of the block a component stands in (see THE FOIL TRAP) */
export const useBlockGround = (): Ground => useContext(BlockCtx);

export const GroundProvider = ({ children }: { children: ReactNode }) => {
  const [a, setA] = useState<Ground>(readBase);
  /* a ground picked on this page: from then on the page is all of it */
  const [picked, setPicked] = useState(false);

  /* the terminal's own toggle, or the machine's, moving under us */
  useEffect(() => {
    const sync = () => setA(readBase());
    const off = subscribeTheme(sync);
    media?.addEventListener('change', sync);
    return () => {
      off();
      media?.removeEventListener('change', sync);
    };
  }, []);

  const choose = useCallback((next: Ground) => {
    const run = () => {
      /* the store returns early when the choice did not change (a first visit on a light machine
         "choosing" the default dark), so the key is written here and the ground set directly */
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* non-fatal */
      }
      setThemeChoice(next);
      setA(next);
      setPicked(true);
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === 'function' && !calm?.matches) doc.startViewTransition(() => flushSync(run));
    else run();
  }, []);

  /* the root stands on the page's ground while the landing is up (theme.ts stampRoot): on a first visit on a light machine
     the reader's choice is still the terminal's dark, and the root went on wearing it under a light page */
  useLayoutEffect(() => {
    stampRoot(a);
  }, [a]);
  useLayoutEffect(() => () => stampRoot(null), []);

  const value = useMemo<GroundValue>(() => ({ a, b: picked ? a : other(a), choose }), [a, picked, choose]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

interface BlockProps {
  /** Which ground this block stands on: the page's own ('a') or the other ('b') */
  on: 'a' | 'b';
  as?: 'section' | 'div' | 'header' | 'footer';
  id?: string;
  label?: string;
  className?: string;
  children: ReactNode;
}

/** A stretch of the page on one ground: stamped, painted, and known to its children */
export const Block = ({ on, as: Tag = 'section', id, label, className = '', children }: BlockProps) => {
  const { a, b } = useGround();
  const ground = on === 'a' ? a : b;
  return (
    <Tag id={id} aria-label={label} data-theme={ground} data-ground={ground} data-landing-section className={`relative bg-canvas text-textPrimary ${className}`}>
      <BlockCtx.Provider value={ground}>{children}</BlockCtx.Provider>
    </Tag>
  );
};

/** For a subtree that is not a painted block but stands on a known ground (the tour's halves, the floating bar) */
export const OnGround = ({ ground, children }: { ground: Ground; children: ReactNode }) => <BlockCtx.Provider value={ground}>{children}</BlockCtx.Provider>;
