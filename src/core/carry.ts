/*
==================================================
  SLAYER TERMINAL - THE CARRY SEAM (core/carry.ts)

  The risk-free rate and the dividend yield every
  greek is priced against — P-24A.
==================================================

  WHY THIS FILE EXISTS. `blackScholesGreeks` hardcoded `r = 0.05` and had no
  dividend yield AT ALL. Both are wrong in ways that matter and in ways that
  compound: 5% has not been the front-end rate for most of the terminal's
  life, and a q of zero prices SPY's ~1.2% yield as zero carry — which puts
  every index delta out by roughly q·t and every charm out by the whole
  q-term. The directive's P-24A is explicit that P-11 through P-14 cannot be
  built on that, because third-order greeks amplify first-order error.

  WHAT IS AND IS NOT SOURCED, stated plainly rather than implied.

  NEITHER FIGURE IS LIVE TODAY. The entitlements this terminal is actually
  paid up for are options, stocks and the three index feeds; a rate curve
  needs the economic-indicators add-on, and dividend yields need a corporate
  actions feed. Neither is on the account. So both arrive here as NAMED
  ASSUMPTIONS with their basis written down.

  THE SEAM IS THE POINT. When a live rate and yield land, `getCarry` hands
  them out and nothing downstream changes: the greeks already read r and q
  through here.

  WHY THESE DEFAULTS. `DEFAULT_R` is the front-end Treasury yield's
  neighbourhood as of this file's writing, not a number chosen to be round;
  `DEFAULT_Q` is roughly the S&P 500's trailing yield, which is the right
  order for the index ETFs this desk trades and a deliberate OVERSTATEMENT
  for a zero-yield name — better to be explicit and wrong in a documented
  direction than silently zero.
*/

export interface Carry {
  /** Continuously-compounded risk-free rate, annualized (0.042 = 4.2%). */
  r: number;
  /** Continuous dividend yield, annualized (0.012 = 1.2%). */
  q: number;
}

/* The neighbourhood of the front-end Treasury yield. Not live — see above. */
export const DEFAULT_R = 0.042;
/* Roughly the S&P 500's trailing yield — right for the index ETFs, an
   overstatement for a name that pays nothing. */
export const DEFAULT_Q = 0.012;

const current: Carry = { r: DEFAULT_R, q: DEFAULT_Q };

/** The rate and yield every greek is priced against. */
export function getCarry(): Carry {
  return current;
}

