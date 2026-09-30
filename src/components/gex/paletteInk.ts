/*
==================================================
  SLAYER TERMINAL - THE PALETTE, AS TOKENS (components/gex/paletteInk.ts)

  The same names palette.ts exports, as the theme's
  TOKENS for the DOM (2026-09-12): a call wall's
  green, a put wall's red, the flip's grey, the
  supreme's magenta, the alert's orange, spot's
  white — each `rgb(var(--…))`, so the light
  terminal cuts them deep and the dark one keeps
  the originals. Inline styles and SVG attributes
  resolve var(); a canvas and a chart option do not,
  so CHART AND CANVAS CODE KEEPS palette.ts (the
  hexes, which are the dark set the islands wear).
  Never hand one of these a hex-alpha suffix
  (`${ink}1f`) — that is a hex-only trick.
==================================================
*/

import { readToken } from '../../theme/theme';

export const BULL = 'rgb(var(--bull))';
export const LIME = 'rgb(var(--select))';
export const CALL_WALL = BULL;
export const PUT_WALL = 'rgb(var(--bear))';
export const FLIP = 'rgb(var(--flip))';
export const SUPREME = 'rgb(var(--supreme))';
export const SPOT = 'rgb(var(--text-primary))';
export const FOCUS = LIME;
export const SHORT_GAMMA = 'rgb(var(--bear))';
export const LONG_GAMMA = BULL;
export const ALERT = 'rgb(var(--warn))';
/* THE THERMAL RAMP'S POLES AS WORDS (breaks / pushes along · a shelf / pushes
   back) — the same inks heatLaneInks('thermal-yellow', 0.72) computes for the
   capsules on the dark terminal, cut deep on paper (tokens.css) */
export const THERMAL_WARM = 'rgb(var(--thermal-warm))';
export const THERMAL_COOL = 'rgb(var(--thermal-cool))';
/* The clock's pressure pair */
export const EMBER = 'rgb(var(--ember))';
export const GLACIER = 'rgb(var(--glacier))';

/** An ink at an alpha. The hex trick (`${ink}55`) breaks on a token — the
    string becomes `rgb(var(--x))55`, the whole declaration is dropped and the
    wash or the glow silently vanishes (the wall beam's fill, 2026-09-12). A
    token becomes `rgb(var(--x) / a)`; a hex keeps its two-digit suffix. */
export const alpha = (ink: string, a: number): string =>
  ink.startsWith('rgb(var(')
    ? ink.replace(/\)\s*\)$/, `) / ${a})`)
    : ink.startsWith('rgb(')
      ? ink.replace(/\s*\/\s*[\d.]+\s*\)$|\)$/, ` / ${a})`)
      : `${ink}${Math.round(a * 255)
          .toString(16)
          .padStart(2, '0')}`;

/** A token ink resolved for a CANVAS or a CHART OPTION, which cannot read
    var() — handed one, the chart library paints black (the Compare tape's
    leader line, invisible on the dark terminal, 2026-09-12). Read off the
    element whose scope should answer (a dark island resolves to the dark
    set); a hex or a resolved rgb() passes through. Resolve at draw time, not
    at module load: the theme can flip. */
export const resolveInk = (ink: string, from?: Element | null): string => {
  const m = ink.match(/^rgb\(var\((--[\w-]+)\)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  return m ? readToken(m[1], m[2] == null ? undefined : Number(m[2]), from) : ink;
};
