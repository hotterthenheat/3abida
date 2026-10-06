/*
==================================================
  SLAYER TERMINAL - THE LANDING'S SCALE
  (pages/landing/scale.ts)

  ONE PIECE ON EVERY SCREEN (2026-10-06 — the owner, of
  the landing on an ultrawide monitor: "it looked so bad
  i need you to ensure all monitor screen sizes auto
  adjust to this"). The landing is drawn for a 1920 ×
  950 screen, and a bigger screen gets the same page,
  bigger: the root's font size (index.css
  html[data-landing-scale]) is the design's 16 px times
  how much bigger the screen is — its width over 1920 or
  its height over 950, whichever is less, so the moments
  the size of the screen still stand whole on it — and
  never less than the reader's own size. Every size on
  the landing is in rem, so all of it grows together; a
  laptop's screen and a phone's are drawn as before.

  What the landing lays out in its scripts (the opening,
  the session, the rooms) reads the same scale here: one
  of the design's pixels, in CSS px.
==================================================
*/

import { useLayoutEffect, useSyncExternalStore } from 'react';
import { BELOW_LG_QUERY, useMediaQuery } from '../../components/ui/useMediaQuery';

/** the screen the landing is drawn for */
export const DESIGN_W = 1920;
export const DESIGN_H = 950;

let reader = 0;
/** the reader's own font size (the browser's setting), read once */
const readerPx = (): number => {
  if (reader) return reader;
  if (typeof document === 'undefined' || !document.body) return 16;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:medium';
  document.body.appendChild(probe);
  reader = parseFloat(getComputedStyle(probe).fontSize) || 16;
  probe.remove();
  return reader;
};

/** ONE OF THE DESIGN'S PIXELS on this screen, in CSS px — the root's font size over 16, worked out as index.css works it
    (100vw is the window's width, 100svh its height on a desk) */
export const unit = (): number => {
  if (typeof window === 'undefined') return 1;
  const root = Math.max(readerPx(), Math.min((window.innerWidth / DESIGN_W) * 16, (window.innerHeight / DESIGN_H) * 16));
  return root / 16;
};

const subscribe = (on: () => void) => {
  window.addEventListener('resize', on);
  return () => window.removeEventListener('resize', on);
};

/** THE ROOT WEARS THE SCALE while the landing is up (index.html puts it on before the first paint of "/"; leaving, the
    terminal's pages are drawn at the reader's own size) */
export const SCALE_ATTR = 'data-landing-scale';
export const useLandingScale = (): void => {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute(SCALE_ATTR, '');
    return () => root.removeAttribute(SCALE_ATTR);
  }, []);
};

/** the scale, for a size a component sets in px (the wordmark, the mark): read again when the window changes */
export const useUnit = (): number => useSyncExternalStore(subscribe, unit, () => 1);

/** THE PAGE STACKED: below lg, and on a screen taller than it is wide (a monitor stood on end, a large tablet held
    upright). The stages the scroll plays lay their words beside the terminal for a landscape screen; on a portrait one
    the terminal stood small at the top of an empty screen — there the page is the tablet's, one thing under another. */
export const STACKED_QUERY = `${BELOW_LG_QUERY}, (orientation: portrait)`;
export const useStacked = (): boolean => useMediaQuery(STACKED_QUERY);
