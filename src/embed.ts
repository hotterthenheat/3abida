/*
==================================================
  SLAYER TERMINAL - THE TERMINAL IN A WINDOW
  (embed.ts)

  The landing page shows the terminal ITSELF, not a
  drawing of it (Noah, 2026-09-19: "i want the REAL
  thing from our website so it doesnt scream fake").
  It first did so LIVE — one frame on the page loaded
  a route of this same app with `?embed` and drove it
  from tool to tool. The same evening he made the
  window STILLS ("make them static"), so the one that
  holds the terminal this way now is THE PHOTOGRAPHER,
  scripts/make-landing-shots.mjs: it opens each page
  in a frame with `?embed` and photographs it. The
  seam is the same; only who stands outside changed.

  This file is the seam between the two documents.
  A page is EMBEDDED when it runs inside a frame AND
  was asked for with `?embed` — read once, at load,
  into a constant, so it survives every navigation
  inside the frame. (Not sessionStorage: a frame of
  the same origin shares its tab's.)

  WHAT CHANGES WHEN EMBEDDED — as little as can be:
    · the theme comes from the page outside and is
      never written to storage (theme/theme.ts) — the
      frame shares the visitor's storage, and a tour
      must not change their terminal
    · the side rail opens folded, unwritten, for the
      same reason (layout/SideNav.tsx)
    · no sound (core/sound.ts) — a front page never
      plays a chime
    · "/" goes to Pulse, so the landing can never
      load itself inside its own window (App.tsx)
  Everything else is the terminal as it ships, on
  the simulator. At launch this is also the one way
  in without an account: the window stays on
  simulated data whatever the visitor is.

  THE MESSAGES (same origin only, checked both ways):
    out → in   go     { path }    open this page
               theme  { theme }   wear this theme
    in → out   ready  { path }    the bridge listens
               route  { path }    the page changed
               escape { path }    Esc was pressed
==================================================
*/

import type { Theme } from './theme/theme';

const inFrame = (() => {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

/** True for the whole life of a document that was loaded into the landing's window */
export const EMBEDDED: boolean = inFrame && !!params?.has('embed');
/** THE PHOTOGRAPHER'S WINDOW (2026-09-26 — Noah, of the paper still: "the page should be a look of the options
    papertrading not just some image of 2 boxes"): the embedded terminal asked for with `&photo=1` as well, so the paper
    desk can be pictured IN USE — an account started, a contract bought — on a throwaway account that is never read from
    or written to storage (data/paper/store.ts). The landing never asks for it; only scripts/make-landing-shots.mjs does. */
export const PHOTO: boolean = EMBEDDED && !!params?.has('photo');

const asked = params?.get('theme');
/** The theme the page outside asked for at load — the frame's first paint wears it (index.html reads the same parameter) */
export const EMBED_THEME: Theme | null = EMBEDDED && (asked === 'light' || asked === 'dark') ? asked : null;

export type ToEmbed = { slayer: 'landing'; type: 'go'; path: string } | { slayer: 'landing'; type: 'theme'; theme: Theme };
export type FromEmbed = { slayer: 'embed'; type: 'ready' | 'route' | 'escape'; path: string };

/** The address a window loads first */
export const embedSrc = (path: string, theme: Theme): string => `${path}${path.includes('?') ? '&' : '?'}embed=1&theme=${theme}`;
