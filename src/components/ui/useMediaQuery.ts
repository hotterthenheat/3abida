import { useEffect, useState } from 'react';

/*
==================================================
  SLAYER TERMINAL - ASKING THE WINDOW ITS SHAPE
  (ui/useMediaQuery.ts)

  A media query read from JavaScript, for the cases
  CSS cannot cover: not "style this differently below
  a width" — Tailwind already does that — but "mount
  something ELSE below a width".

  The distinction matters and it is the reason this
  file exists rather than another `md:hidden`. A
  layout hidden with CSS is still mounted: its charts
  still create canvases, its panels still subscribe to
  the tick, its widgets still compute. On the desk
  that is ten live panels running behind a screen
  nobody can see, on the device least able to afford
  them. A branch in JS never builds the other side.
==================================================
*/

/**
 * A PHONE — the device, not a narrow window.
 *
 * Two clauses, comma-separated (a media query list is an OR, and it is
 * supported everywhere `or` is not):
 *
 * **`(max-width: 767.98px)`** — Tailwind's `md` floor. Any window this narrow
 * gets the one-chart layout whatever it is running on, because a twelve-column
 * desk in 768px is a twelve-column desk nobody can read. 767.98 rather than
 * 767: a window can land on a fractional CSS pixel — a zoomed page, a device
 * pixel ratio that does not divide evenly, a desktop browser dragged slowly —
 * and at exactly 767.5px `(max-width: 767px)` does not match and neither does
 * Tailwind's `md:` (`min-width: 768px`). The JS branch and the CSS would pick
 * opposite sides of the same line. The fractional bound closes the gap.
 *
 * **`(pointer: coarse) and (max-height: 540px)`** — a phone TURNED SIDEWAYS,
 * and the reason this constant is not width alone.
 *
 * That was the bug. Width-only, an iPhone 14 in landscape is 844×390: wider
 * than the `md` floor, so it took the desktop branch and got the full widget
 * desk — four panels, the page header, the desk rail and two buttons, inside
 * 390px of height. Measured: the charts began below the fold. Every portrait
 * check passed the whole time, because the device only fails this test when
 * the reader rotates it.
 *
 * A phone is not "narrow", it is SMALL — its short side is short in either
 * orientation — and the short side is what a desk needs. Height alone would
 * be wrong too (a desktop window dragged short is still a desktop), so the
 * touch clause carries the "this is a handset" half. 540px separates the two
 * populations cleanly and with room on both sides: phones in landscape run
 * 375–440px tall, the smallest tablet in landscape is 744.
 */
export const PHONE_QUERY = '(max-width: 767.98px), (pointer: coarse) and (max-height: 540px)';

/** Whether `query` matches now, kept current as the window changes. */
export function useMediaQuery(query: string): boolean {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

  // Read on the FIRST render, not in an effect. Seeding `false` and correcting
  // afterwards would mount the wide layout for one frame on every phone —
  // and for a layout that builds charts, one frame is a full chart create and
  // destroy before the right one is even asked for.
  const [matches, setMatches] = useState(() => (supported ? window.matchMedia(query).matches : false));

  useEffect(() => {
    if (!supported) return;
    const mql = window.matchMedia(query);
    // Re-read on subscribe rather than trusting the render-time value: the
    // window can be resized between that read and this effect, and the change
    // event only fires for crossings AFTER the listener is attached, so a
    // crossing inside that gap would otherwise be lost until the next one.
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query, supported]);

  return matches;
}

/** A handset, in either orientation — or any window too narrow for a desk. */
export const useIsPhone = (): boolean => useMediaQuery(PHONE_QUERY);

/**
 * Below Tailwind's `lg` — where Terrain stops filling the viewport and becomes
 * a column the page scrolls through.
 *
 * Same fractional bound and the same reason as PHONE_QUERY: `lg:` is
 * `min-width: 1024px`, so anything short of 1024 must match here or the JS
 * branch and the CSS would disagree about a half pixel.
 */
export const BELOW_LG_QUERY = '(max-width: 1023.98px)';
export const useIsBelowLg = (): boolean => useMediaQuery(BELOW_LG_QUERY);
