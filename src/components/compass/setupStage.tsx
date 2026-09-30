/*
==================================================
  SLAYER TERMINAL - SETUP LIFECYCLE
  The verdict says what the engine thinks RIGHT NOW.
  This says how far along the setup actually is.

  "ACTIVE" was doing two jobs: a setup that merely
  qualified, and one where a target is printing this
  second. Those are not the same thing to look at,
  so they get their own words:

    FORMING — scoring, no trigger yet
    PRIMED  — qualified and working, nothing banked
    LIVE    — a take-profit has actually been hit
    FADED   — the thesis degraded, engine stepped aside

  LIVE keys off a target being HIT, not "in progress":
  the first target is in progress on essentially every
  open setup, so it separates nothing. A target that
  has been reached is the real event.

  Derived entirely from the verdict and the take-profit
  ladder we already carry — no new math, and the rank
  doubles as a sort key so the hottest float up.
==================================================
*/

import type { Setup } from '../../types/compass';

/** Highest banked rung, or null when nothing has hit. */
export function hitLevel(setup: Setup): number | null {
  const hits = setup.takeProfits.filter(tp => tp.status === 'HIT').map(tp => tp.level);
  return hits.length ? Math.max(...hits) : null;
}

