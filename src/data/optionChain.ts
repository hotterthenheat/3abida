import { blackScholesGreeks, blackScholesPrice } from '../core/greeks';
import { expiryAt, expiryFor, isTradingDay, today, type Expiry } from '../core/calendar';
import { UNIVERSE } from './universe';
import { getCarry } from '../core/carry';
import { h01, hRange } from '../core/rng';

/*
==================================================
  SLAYER TERMINAL - THE OPTION CHAIN (data/optionChain.ts)

  Real expiries, real time-to-expiry, and a skew —
  the multi-expiry book §3 asks for.
==================================================

  WHAT WAS WRONG WITH ONE EXPIRY. The simulator publishes a single synthetic
  surface at t = 0.003 — a 0DTE horizon — and every "0DTE / 1D / 5D / OPEX /
  ALL" control on the desk is a scalar re-weighting of that one book. The
  arithmetic is honest about itself, but the SHAPE is a lie: a 30-day option
  is not a 0DTE option scaled down. Its gamma is flatter, its theta is
  smaller per day, its vega is far larger, and no weighting of a same-day
  surface produces those.

  So this builds a chain PER EXPIRY, each at its own τ, priced through the
  same Black-Scholes the rest of the desk uses and the same carry seam. A
  30-day strike here has 30 days of vega because it was priced with 30 days
  in it.

  THE LISTED SET IS A REAL LISTING PATTERN, not a range: today and the next
  four sessions (the dailies every index carries), then the next three
  Fridays, then the monthly OPEX beyond them, then two quarterlies. That
  matters because the Expiry Ladder's whole question — "is this wall 0DTE or
  is it structure?" — is unanswerable when the dates are evenly spaced.

  SKEW IS A CURVE, NOT A CONSTANT. One IV per ticker is what makes every
  greek on the desk approximately wrong in the same direction. Here each
  strike gets its own vol from a smile that steepens as expiry approaches:
  downside strikes bid over ATM (the put bid every equity index carries),
  upside softer, and the whole curve flatter at 90 days than at 0DTE. It is
  a MODEL of a skew, not a measurement — the chip says so — but it moves the
  greeks the way a real one does, which is what the surfaces reading it need
  in order to be built and looked at now.

  DETERMINISTIC PER (TICKER, EXPIRY, STRIKE) so a reader can compare two
  panes, scrub, and come back to the same book. The seeded-hash technique is
  the one every other simulated surface here uses.
*/

export type Right = 'C' | 'P';

/** One side of one strike. */
export interface ChainLeg {
  bid: number;
  ask: number;
  mark: number;
  last: number;
  volume: number;
  oi: number;
  /** Percent, e.g. 18.4 */
  iv: number;
  delta: number;
  gamma: number;
  /** Per DAY, the number a reader actually spends. */
  theta: number;
  /** Per 1 vol point. */
  vega: number;
  vanna: number;
  charm: number;
  /** True when this side is in the money at the current spot. */
  itm: boolean;
}

export interface ChainRow {
  strike: number;
  call: ChainLeg;
  put: ChainLeg;
  /** The strike nearest spot on this chain. */
  atm: boolean;
}

export interface ChainView {
  ticker: string;
  spot: number;
  expiry: Expiry;
  /** Years to expiry, the τ everything here was priced with. */
  t: number;
  rows: ChainRow[];
  /** ATM implied vol for this expiry, percent — the term-structure point. */
  atmIv: number;
}

/** Strike spacing a book of this price would actually list. */
export function strikeStep(spot: number): number {
  if (spot >= 500) return 5;
  if (spot >= 100) return 2.5;
  if (spot >= 25) return 1;
  return 0.5;
}

/**
 * The listed expiry set — dailies, then Fridays, then monthlies.
 *
 * Not an even spread: a real board is dense at the front and sparse behind
 * it, and the Expiry Ladder's question depends on that shape.
 */
export function listExpiries(from: Date = new Date()): Expiry[] {
  const out: Expiry[] = [];
  const seen = new Set<string>();
  const push = (dte: number) => {
    const e = expiryFor(dte, from);
    if (!seen.has(e.label)) {
      seen.add(e.label);
      out.push(e);
    }
  };
  for (let d = 0; d <= 4; d++) push(d); // the dailies
  for (let w = 1; w <= 3; w++) push(w * 7); // the next Fridays
  push(30);  // monthly OPEX
  push(60);
  push(90);  // quarterlies
  push(180);
  return out.sort((a, b) => a.dte - b.dte);
}

/**
 * Implied vol for one strike on one expiry — a smile, not a constant.
 *
 * IN AND OUT IN DECIMAL, like `blackScholesGreeks` — 0.18, not 18. This
 * codebase carries both conventions (the simulator's `TICKERS[].iv` is
 * decimal; a tape print's `iv` field is percent for display) and feeding a
 * percent to the greeks engine is not a small error: v = 18 makes v²/2 =
 * 162, d1 explodes, N'(d1) underflows, and every far-dated gamma and vega
 * comes back as a clean, plausible-looking ZERO. Caught by the proof
 * asserting that vega must RISE with time to expiry.
 *
 * `base` is the ticker's ATM level. The term shape lifts the front end
 * (0DTE always trades over the back), and the smile steepens as τ shrinks,
 * which is the behaviour that makes a near-dated wing look expensive.
 *
 * THE SHAPE IS A SMIRK, NOT A SYMMETRIC SMILE, because that is what equity
 * indices actually trade: the downside is bid well over the money, the
 * near-money upside sits at or slightly BELOW it, and only the far upside
 * wing turns back up. A symmetric smile is a currency's shape, not SPY's.
 */
export function skewIv(base: number, spot: number, strike: number, t: number): number {
  const m = Math.log(strike / spot); // log-moneyness: symmetric in ratio
  /* Front-month lift: +35% at 0DTE decaying out to nothing by ~60 days. */
  const term = 1 + 0.35 * Math.exp(-t * 12);
  /* Steepness scales with 1/sqrt(t) the way a real smile does — capped so
     the 0DTE wings stay finite rather than going vertical. */
  const steep = Math.min(3.2, 0.55 / Math.sqrt(Math.max(t, 0.0015)));
  /* Downside bid over upside — the equity-index put skew. */
  const wing = m < 0 ? 1.35 : 0.75;
  const smile = steep * wing * m * m - 0.18 * steep * m;
  /* Floored in DECIMAL vol — 2% is the lowest anything realistically trades. */
  return Math.max(0.02, base * term * (1 + smile));
}

/** One expiry's chain, `half` strikes each side of spot. */
/** `baseIv` is DECIMAL (0.18), matching Simulator.TICKERS[].iv. */
export function buildChain(ticker: string, spot: number, baseIv: number, expiry: Expiry, half = 14): ChainView {
  const step = strikeStep(spot);
  const atmStrike = Math.round(spot / step) * step;
  /* Sessions, not calendar days: a contract decays over trading time, and
     the desk's own year is 252 sessions (T-1, T-9, T-19 all divide by it). */
  const t = Math.max(expiry.sessions, 0.35) / 252;
  const carry = getCarry();
  const rows: ChainRow[] = [];

  for (let i = -half; i <= half; i++) {
    const strike = Number((atmStrike + i * step).toFixed(2));
    if (strike <= 0) continue;
    const iv = skewIv(baseIv, spot, strike, t);
    const g = blackScholesGreeks(spot, strike, t, iv, carry.r, carry.q);

    const leg = (right: Right): ChainLeg => {
      const seed = `${ticker}|${expiry.label}|${strike}|${right}`;
      const theo = blackScholesPrice(spot, strike, t, iv, right, carry.r, carry.q);
      /* Spread widens with distance from the money and narrows with size —
         a wing on a back month is the widest thing on any board. */
      const moneyness = Math.abs(strike - spot) / spot;
      const relSpread = Math.min(0.42, 0.03 + moneyness * 1.9 + (t > 0.15 ? 0.03 : 0));
      const width = Math.max(0.01, theo * relSpread);
      const bid = Math.max(0, Number((theo - width / 2).toFixed(2)));
      const ask = Number((theo + width / 2).toFixed(2));
      /* Volume and OI concentrate near the money and at round strikes — the
         shape that makes a wall visible on the ladder. */
      const near = Math.exp(-(((strike - spot) / (spot * 0.045)) ** 2));
      const round = strike % (step * 4) === 0 ? 1.6 : 1;
      const oi = Math.round(hRange(`${seed}|oi`, 50, 9_000) * near * round * (1 + 2 / (1 + expiry.dte)));
      const volume = Math.round(oi * hRange(`${seed}|v`, 0.05, 1.4) * (expiry.dte <= 1 ? 2.2 : 1));
      const itm = right === 'C' ? strike < spot : strike > spot;
      /* Theta's dominant term: −½·S²·Γ·σ² per year, then per session. */
      const thetaYear = -(spot * spot * g.gamma * iv * iv) / 2;
      return {
        bid,
        ask,
        mark: Number(((bid + ask) / 2).toFixed(2)),
        last: Number(Math.max(0, theo * (1 + (h01(`${seed}|l`) - 0.5) * relSpread)).toFixed(2)),
        volume,
        oi,
        iv: Number((iv * 100).toFixed(1)), // percent, for display only
        delta: Number((right === 'C' ? g.deltaCall : g.deltaPut).toFixed(4)),
        gamma: Number(g.gamma.toFixed(5)),
        theta: Number((thetaYear / 252).toFixed(3)),
        vega: Number(g.vega.toFixed(3)),
        vanna: Number(g.vanna.toFixed(4)),
        charm: Number(((right === 'C' ? g.charmCall : g.charmPut) / 252).toFixed(5)),
        itm,
      };
    };

    rows.push({ strike, call: leg('C'), put: leg('P'), atm: strike === atmStrike });
  }

  return { ticker, spot, expiry, t, rows, atmIv: Number((skewIv(baseIv, spot, atmStrike, t) * 100).toFixed(1)) };
}

/*
  ONE EXPIRY, SUMMED — §6's per-expiry row.

  The ladder answers "which expiry owns this strike"; this answers the
  question underneath it: how big is each expiry in the first place. A
  strike can look dominant on the heat grid while sitting on an expiry that
  carries two percent of the book's open interest, and the grid alone cannot
  say so.

  NET PREMIUM IS CALL LESS PUT DOLLARS AT THE MARK — the same sign
  convention the tape's own drift uses, so a reader moving between them is
  not re-learning which way up it goes.
*/
export interface ExpirySummary {
  expiry: Expiry;
  t: number;
  atmIv: number;
  callOi: number;
  putOi: number;
  totalOi: number;
  callVolume: number;
  putVolume: number;
  totalVolume: number;
  /** Dollars, call marks less put marks across the drawn strikes. */
  netPremium: number;
  /** Sum of |gamma| x OI — the expiry's weight on the map. */
  gammaWeight: number;
  /** Share of the whole board's open interest, 0-100. */
  oiSharePct: number;
}

/** Every listed expiry, summed. `oiSharePct` is filled across the set. */
export function summariseExpiries(ticker: string, spot: number, baseIv: number, expiries: readonly Expiry[], half = 12): ExpirySummary[] {
  const rows = expiries.map(e => {
    const chain = buildChain(ticker, spot, baseIv, e, half);
    let callOi = 0, putOi = 0, cv = 0, pv = 0, net = 0, gw = 0;
    for (const r of chain.rows) {
      callOi += r.call.oi; putOi += r.put.oi;
      cv += r.call.volume; pv += r.put.volume;
      net += (r.call.mark * r.call.volume - r.put.mark * r.put.volume) * 100;
      gw += r.call.gamma * r.call.oi + r.put.gamma * r.put.oi;
    }
    return {
      expiry: e, t: chain.t, atmIv: chain.atmIv,
      callOi, putOi, totalOi: callOi + putOi,
      callVolume: cv, putVolume: pv, totalVolume: cv + pv,
      netPremium: net, gammaWeight: gw, oiSharePct: 0,
    };
  });
  const board = rows.reduce((a, r) => a + r.totalOi, 0);
  for (const r of rows) r.oiSharePct = board > 0 ? (r.totalOi / board) * 100 : 0;
  return rows;
}

/*
  ══ WHAT A NAME ACTUALLY LISTS ═══════════════════════════════════════════════

  "only show the dates that these tickers have cause every ticker may have
  different option dates" (Noah, 2026-09-12). The exchanges list three shapes:

    daily    the index complex — SPY, QQQ, IWM and their kin — carries an
             expiry EVERY session, then the Fridays, then the monthlies;
    weekly   the liquid large caps carry the Fridays and the monthlies;
    monthly  everything else carries only the third Fridays and the
             quarterlies.

  One function names the shape, one lists the dates — resolved to real
  sessions (a Friday holiday expires Thursday), deduped, ascending. Every
  expiry calendar on the terminal reads THIS list for the name it is on, so a
  Compass sweep, the Weigher's chain and a Trace cut can never offer a date the
  name does not trade.
*/
export type ListingPattern = 'daily' | 'weekly' | 'monthly';

const DAILY_NAMES = new Set(['SPY', 'QQQ', 'IWM', 'DIA', 'SPX', 'NDX', 'XSP', 'RUT', 'VIX', 'TLT', 'GLD', 'SLV', 'USO', 'HYG', 'TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'UVXY', 'XLF', 'XLE', 'XLK', 'EEM', 'FXI', 'KRE', 'SMH']);
/* The weekly-listed large caps beyond the research universe — the sim's own
   roster and the sector board's names (data/darkpool.ts SECTOR_UNIVERSE),
   written out rather than imported so this module keeps its pure imports. */
const WEEKLY_EXTRA = new Set([
  'COIN', 'PLTR', 'UBER', 'MU', 'DIS', 'INTC', 'ORCL', 'MSTR', 'SMCI', 'ARM', 'SHOP', 'SQ', 'PYPL', 'ROKU', 'SNAP', 'RIVN', 'LCID', 'F', 'GM', 'NKE', 'SBUX', 'MCD', 'LOW', 'TJX', 'BABA', 'EBAY',
  'MS', 'SCHW', 'BLK', 'V', 'MA', 'C', 'WFC', 'AXP', 'PFE', 'ABBV', 'MRK', 'TMO', 'CVS', 'ABT', 'ZTS', 'HON', 'UNP', 'DE', 'LMT', 'UPS', 'ETN', 'CSX', 'T', 'VZ', 'CMCSA', 'SPOT', 'TMUS', 'CHTR',
  'KO', 'PEP', 'PM', 'MDLZ', 'CL', 'MNST', 'KMB', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'LNG', 'SHW', 'FCX', 'NEM', 'APD', 'NUE', 'DOW', 'ECL', 'ALB', 'EMN', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'SRE', 'XEL', 'PCG', 'CEG',
  'PLD', 'AMT', 'EQIX', 'SPG', 'O', 'PSA', 'CCI', 'DLR', 'VICI', 'IRT', 'TSM', 'ASML',
]);
const WEEKLY_NAMES = new Set([...UNIVERSE.map(u => u.ticker), ...WEEKLY_EXTRA]);

/** The listing shape a name trades — daily, weekly or monthly expiries. */
export function listingPatternFor(ticker: string): ListingPattern {
  const sym = ticker.toUpperCase();
  if (DAILY_NAMES.has(sym)) return 'daily';
  if (WEEKLY_NAMES.has(sym)) return 'weekly';
  return 'monthly';
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fridayOnOrAfter = (d: Date) => addDays(d, (5 - d.getDay() + 7) % 7);
const thirdFriday = (y: number, m: number) => {
  const first = new Date(y, m, 1);
  return addDays(first, ((5 - first.getDay() + 7) % 7) + 14);
};
/** Back a listed date off a holiday to the session before it */
const toSession = (d: Date) => {
  const out = new Date(d);
  for (let i = 0; i < 7 && !isTradingDay(out); i++) out.setDate(out.getDate() - 1);
  return out;
};

/**
 * Every expiry this name lists, from `from` forward — real sessions only,
 * deduped and ascending. The shape follows `listingPatternFor`.
 */
export function listExpiriesFor(ticker: string, from: Date = today()): Expiry[] {
  const pattern = listingPatternFor(ticker);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const dates: Date[] = [];

  if (pattern === 'daily') {
    /* Every session from today through the next four */
    let d = new Date(base);
    let n = 0;
    while (n < 5) {
      if (isTradingDay(d)) {
        dates.push(new Date(d));
        n++;
      }
      d = addDays(d, 1);
    }
  }
  if (pattern !== 'monthly') {
    /* The next six Fridays */
    let fri = fridayOnOrAfter(base);
    for (let i = 0; i < 6; i++) {
      dates.push(toSession(fri));
      fri = addDays(fri, 7);
    }
  }
  /* The monthlies: the next four third Fridays */
  for (let i = 0; i < 5; i++) {
    const m = thirdFriday(base.getFullYear(), base.getMonth() + i);
    if (m >= base) dates.push(toSession(m));
  }
  /* Two quarterlies (Mar · Jun · Sep · Dec) beyond the monthlies */
  let q = 0;
  for (let i = 1; i <= 14 && q < 2; i++) {
    const m = base.getMonth() + i;
    const y = base.getFullYear() + Math.floor(m / 12);
    if ([2, 5, 8, 11].includes(m % 12) && i > 4) {
      dates.push(toSession(thirdFriday(y, m % 12)));
      q++;
    }
  }
  /* The January LEAPS a year out */
  dates.push(toSession(thirdFriday(base.getFullYear() + 1, 0)));

  const seen = new Set<string>();
  const out: Expiry[] = [];
  for (const d of dates.sort((a, b) => a.getTime() - b.getTime())) {
    if (d < base) continue;
    const e = expiryAt(d, base);
    if (seen.has(e.label)) continue;
    seen.add(e.label);
    out.push(e);
  }
  return out;
}

/** The listed expiry nearest a wanted horizon — what a saved "5 days out"
    preference lands on for a name that only lists monthlies. */
export function nearestListedExpiry(ticker: string, dte: number, from: Date = today()): Expiry {
  const list = listExpiriesFor(ticker, from);
  if (list.length === 0) return expiryFor(dte, from);
  return list.reduce((best, e) => (Math.abs(e.dte - dte) < Math.abs(best.dte - dte) ? e : best), list[0]);
}
