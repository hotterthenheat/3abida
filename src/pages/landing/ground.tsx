/*
==================================================
  SLAYER TERMINAL - THE LANDING'S GROUND
  (pages/landing/ground.tsx)

  THE PAGE TRAVELS TO THE OTHER THEME AND HOME AGAIN,
  SLOWLY. It opens on the visitor's own ground
  ('a'), and part way down the tour it turns into
  the other ('b') over about a screen and a half of
  scrolling — a painted gradient through steel, never
  a cut (Noah, 2026-09-19, of the first cut: "i meant
  more like a smooth transition not black one moment
  then white in the very next section"). The
  terminal in the window turns with it (the same
  page's picture, in the other theme). After the last tool it turns
  HOME the same slow way, so a page ends on the theme
  it began on (Noah, the same day: "the light theme
  should begin but also end as a light theme and the
  dark theme should begin but end as a dark theme"):
  the prices, the questions and the footer stand on
  'a'. There and back — one journey, not a zebra.

  HOW:
  · a block of the page is STAMPED with its ground
    (`data-theme`), so every token inside it is right
    with no per-element colour transition;
  · the turn itself is ONE CSS gradient painted
    behind the tour (index.css `.landing-dawn`) —
    nothing is tied to the scroll frame by frame, so
    a phone does not stutter;
  · the visitor's own ground is their stored choice,
    else their machine's. The toggle flips it for the
    whole site and crossfades the page as ONE picture
    (View Transitions), at once where the browser
    cannot or the visitor asked for less motion.

  THE FOIL TRAP. Tokens follow the nearest stamp, but
  the house's foil and paper rules in index.css are
  written against the ROOT's stamp, so a block on the
  other ground would wear the wrong foil. A child
  that needs the foil, or a solid button, asks
  `useBlockGround()` instead of trusting a class.
==================================================
*/

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { THEME_KEY, getResolvedTheme, setThemeChoice, subscribeTheme, type Theme } from '../../theme/theme';

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
/** The visitor's ground: the choice they once made, else what their machine says */
const readBase = (): Ground => (hasStoredChoice() ? getResolvedTheme() : media && !media.matches ? 'light' : 'dark');

interface GroundValue {
  /** The ground the page opens on — the visitor's own */
  a: Ground;
  /** The ground it turns into */
  b: Ground;
  /** Flip the visitor's ground, for the whole site */
  flip: () => void;
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

  const flip = useCallback(() => {
    const next = other(a);
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
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === 'function' && !calm?.matches) doc.startViewTransition(() => flushSync(run));
    else run();
  }, [a]);

  const value = useMemo<GroundValue>(() => ({ a, b: other(a), flip }), [a, flip]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

interface BlockProps {
  /** Which end of the journey this block stands on */
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
    <Tag id={id} aria-label={label} data-theme={ground} data-ground={ground} className={`relative bg-canvas text-textPrimary ${className}`}>
      <BlockCtx.Provider value={ground}>{children}</BlockCtx.Provider>
    </Tag>
  );
};

/** For a subtree that is not a painted block but stands on a known ground (the tour's halves, the floating bar) */
export const OnGround = ({ ground, children }: { ground: Ground; children: ReactNode }) => <BlockCtx.Provider value={ground}>{children}</BlockCtx.Provider>;
