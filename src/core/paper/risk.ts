import { blackScholesPrice } from '../greeks';
import { markPosition, type Position, type PaperState } from './engine';
import { quoteFor, yearsToExpiry, spotOf, type Quote } from './market';
import type { Instrument, InstrumentKind, OptionInstrument } from './instruments';

/*
==================================================
  SLAYER TERMINAL - BOOK RISK (core/paper/risk.ts)

  What the open book is worth, what it is exposed
  to, and what it becomes if the market moves.
==================================================

  THE CONVENTIONS ARE THE WHOLE FILE. Every greek the chain publishes is in
  the OPTION'S OWN units, not the ETF's, and the ratio between an index and
  the ETF the feed quotes is what makes that distinction matter. From
  market.ts's optionQuote, per one contract:

    delta   dimensionless, per 1 point of the option's own underlying
    gamma   per 1 point of the option's own underlying  (g.gamma / ratio)
    vega    the option's own price units, per 1 VOL POINT  (g.vega × ratio)
    theta   the option's own price units, per SESSION DAY  ((θ/252) × ratio)

  So a position's exposure multiplies by qty × multiplier and nothing else.
  Scaling by the ETF spot here would double-scale an SPXW position by ~10×
  and produce a number that looks plausible and is wrong — the failure the
  greeks header already warns about, one layer up.

  DELTA DOLLARS is delta × the option's own underlying spot, which for an
  index option is the index, not the ETF. GAMMA DOLLARS is the delta-dollars
  a 1% move ADDS: γ·S²·0.01 per unit. Both are stated per name rather than
  summed blind across names, because adding SPX delta dollars to NVDA delta
  dollars without a beta is a number with no referent — the desk reports
  them per underlying and totals only the dollar risk, which does add.

  SCENARIOS reprice rather than extrapolate. A second-order Taylor walk on
  delta and gamma is wrong exactly where a book is most at risk — a wide
  move, a short gamma wing — so every option in the grid is re-solved
  through Black-Scholes at the shocked spot, the shocked vol and the aged
  clock. Futures and shares are linear and take the shock directly.
*/

export interface LegRisk {
  id: string;
  symbol: string;
  underlying: string;
  kind: InstrumentKind;
  /** Signed: + long, − short */
  qty: number;
  mark: number;
  marketValue: number;
  unrealized: number;
  /** Share-equivalents of the option's OWN underlying */
  delta: number;
  deltaDollars: number;
  /** Delta-dollars a 1% move in the underlying adds */
  gammaDollars: number;
  /** Dollars per one vol point */
  vega: number;
  /** Dollars per session day */
  theta: number;
  iv: number | null;
  expiry: string | null;
  dte: number | null;
  /** The option's own underlying price — the index, not the ETF */
  spot: number;
}

export interface UnderlyingRisk {
  underlying: string;
  legs: number;
  marketValue: number;
  unrealized: number;
  delta: number;
  deltaDollars: number;
  gammaDollars: number;
  vega: number;
  theta: number;
  /** Share of the book's gross dollar risk, 0..1 */
  share: number;
}

export interface ExpiryBucket {
  /** YYYY-MM-DD, or null for the legs that never expire (shares) */
  expiry: string | null;
  label: string;
  dte: number | null;
  legs: number;
  marketValue: number;
  deltaDollars: number;
  vega: number;
  theta: number;
}

export interface ScenarioCell {
  /** Underlying move, as a fraction: −0.05 is down 5% */
  move: number;
  /** Vol shock in POINTS: +5 adds five points of IV to every leg */
  vol: number;
  /** Sessions aged forward */
  days: number;
  /** Book value at the shock */
  value: number;
  /** Change from the book's value now */
  pnl: number;
}

export interface BookRisk {
  legs: LegRisk[];
  byUnderlying: UnderlyingRisk[];
  byExpiry: ExpiryBucket[];
  totals: {
    marketValue: number;
    unrealized: number;
    realized: number;
    /** Dollars per one vol point, across the book */
    vega: number;
    /** Dollars per session day, across the book */
    theta: number;
    /** Gross dollar risk — |delta dollars| summed, the concentration base */
    grossExposure: number;
    /** Net delta dollars, signed, summed across names without a beta */
    netDeltaDollars: number;
    gammaDollars: number;
  };
  concentration: {
    top: string | null;
    topShare: number;
    /** Herfindahl on gross exposure: 1 is one name, → 0 is spread wide */
    herfindahl: number;
    names: number;
  };
  /** Rows are vol shocks, columns price moves */
  grid: ScenarioCell[][];
  moves: number[];
  vols: number[];
}

const MOVES = [-0.1, -0.05, -0.02, 0, 0.02, 0.05, 0.1];
const VOLS = [-5, 0, 5];

const dteOf = (expiryIso: string): number =>
  Math.max(0, Math.round((new Date(`${expiryIso}T16:00:00-04:00`).getTime() - Date.now()) / 86_400_000));

const expiryOf = (inst: Instrument): string | null =>
  inst.kind === 'option' || inst.kind === 'spread' || inst.kind === 'future' ? inst.expiry : null;

/** Every option under a position — a spread contributes its legs, scaled by ratio. */
function optionLegsOf(inst: Instrument): { option: OptionInstrument; ratio: number }[] {
  if (inst.kind === 'option') return [{ option: inst, ratio: 1 }];
  if (inst.kind === 'spread') return inst.legs.map(l => ({ option: l.option, ratio: l.ratio }));
  return [];
}

function legRiskOf(p: Position, q: Quote | undefined): LegRisk | null {
  if (p.qty === 0) return null;
  const m = markPosition(p, q);
  const inst = p.instrument;
  const mult = inst.kind === 'stock' ? 1 : inst.multiplier;
  const units = p.qty * mult;
  const expiry = expiryOf(inst);

  // Shares and futures: delta is the position itself, and nothing else moves.
  if (inst.kind === 'stock' || inst.kind === 'future') {
    const spot = m.mark;
    return {
      id: p.id, symbol: inst.symbol, underlying: inst.underlying, kind: inst.kind,
      qty: p.qty, mark: m.mark, marketValue: m.marketValue, unrealized: m.unrealized,
      delta: units, deltaDollars: units * spot, gammaDollars: 0, vega: 0, theta: 0,
      iv: null, expiry, dte: expiry ? dteOf(expiry) : null, spot,
    };
  }

  const g = q?.greeks;
  const spot = q?.underlyingSpot ?? 0;
  if (!g) {
    return {
      id: p.id, symbol: inst.symbol, underlying: inst.underlying, kind: inst.kind,
      qty: p.qty, mark: m.mark, marketValue: m.marketValue, unrealized: m.unrealized,
      delta: 0, deltaDollars: 0, gammaDollars: 0, vega: 0, theta: 0,
      iv: null, expiry, dte: expiry ? dteOf(expiry) : null, spot,
    };
  }
  const delta = units * g.delta;
  return {
    id: p.id, symbol: inst.symbol, underlying: inst.underlying, kind: inst.kind,
    qty: p.qty, mark: m.mark, marketValue: m.marketValue, unrealized: m.unrealized,
    delta,
    deltaDollars: delta * spot,
    // What a 1% move adds to delta dollars: γ·S·(0.01·S) per unit
    gammaDollars: units * g.gamma * spot * spot * 0.01,
    vega: units * g.vega,
    theta: units * g.theta,
    iv: g.iv,
    expiry,
    dte: expiry ? dteOf(expiry) : null,
    spot,
  };
}

/** One position's value at a shocked spot, vol and clock. */
function shockedValue(
  p: Position,
  q: Quote | undefined,
  move: number,
  volPts: number,
  days: number,
  legQuotes?: Record<string, Quote>
): number {
  const inst = p.instrument;
  const mult = inst.kind === 'stock' ? 1 : inst.multiplier;
  const units = p.qty * mult;

  if (inst.kind === 'stock' || inst.kind === 'future') {
    const mark = q?.mark ?? p.avgPrice;
    return units * mark * (1 + move);
  }

  const options = optionLegsOf(inst);
  if (options.length === 0 || !q) return units * (q?.mark ?? p.avgPrice);

  // A spread's legs each carry their own IV; a single option reads the quote's.
  let per = 0;
  for (const { option, ratio } of options) {
    const legQuote = options.length === 1 ? q : legQuotes?.[option.id] ?? quoteFor(option) ?? undefined;
    const iv0 = (legQuote?.greeks?.iv ?? 20) / 100;
    const iv = Math.max(0.0001, iv0 + volPts / 100);
    const base = spotOf(option.underlying);
    if (base == null) return units * q.mark;
    // Black-Scholes in the ETF's units, then back to the option's own.
    const S = base * (1 + move);
    const K = option.strike / option.ratio;
    const t = Math.max(0.0001, yearsToExpiry(option.expiry) - days / 252);
    per += ratio * blackScholesPrice(S, K, t, iv, option.right) * option.ratio;
  }
  return units * per;
}

export function bookRisk(state: PaperState): BookRisk {
  const open = state.positions.filter(p => p.qty !== 0);
  /* THE ENGINE'S OWN MARKS COME FIRST, and the fallback is the fallback.
     Re-deriving a quote here produced a book that disagreed with the desk by
     the whole futures basis: `futuresBasis` memoises for the app's life and
     seeds from the ETF's base price when the feed has not seeded yet, so a
     cold load of THIS page alone memoised a basis the desk never used and
     marked NQ 219 points light. The engine already marks every position from
     one quote stream; this page reads that, exactly as the desk does. */
  const quoteOf = (p: Position): Quote | undefined =>
    state.quotes[p.id] ?? quoteFor(p.instrument) ?? undefined;

  const legs = open.map(p => legRiskOf(p, quoteOf(p))).filter((l): l is LegRisk => l !== null);

  // ---- by underlying ------------------------------------------------------
  const byName = new Map<string, UnderlyingRisk>();
  for (const l of legs) {
    const row = byName.get(l.underlying) ?? {
      underlying: l.underlying, legs: 0, marketValue: 0, unrealized: 0,
      delta: 0, deltaDollars: 0, gammaDollars: 0, vega: 0, theta: 0, share: 0,
    };
    row.legs += 1;
    row.marketValue += l.marketValue;
    row.unrealized += l.unrealized;
    row.delta += l.delta;
    row.deltaDollars += l.deltaDollars;
    row.gammaDollars += l.gammaDollars;
    row.vega += l.vega;
    row.theta += l.theta;
    byName.set(l.underlying, row);
  }
  const gross = [...byName.values()].reduce((a, r) => a + Math.abs(r.deltaDollars), 0);
  for (const r of byName.values()) r.share = gross > 0 ? Math.abs(r.deltaDollars) / gross : 0;
  const byUnderlying = [...byName.values()].sort((a, b) => Math.abs(b.deltaDollars) - Math.abs(a.deltaDollars));

  // ---- by expiry ----------------------------------------------------------
  const byDate = new Map<string, ExpiryBucket>();
  for (const l of legs) {
    const key = l.expiry ?? 'none';
    const row = byDate.get(key) ?? {
      expiry: l.expiry,
      label: l.expiry ? new Date(`${l.expiry}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No expiry',
      dte: l.dte, legs: 0, marketValue: 0, deltaDollars: 0, vega: 0, theta: 0,
    };
    row.legs += 1;
    row.marketValue += l.marketValue;
    row.deltaDollars += l.deltaDollars;
    row.vega += l.vega;
    row.theta += l.theta;
    byDate.set(key, row);
  }
  const byExpiry = [...byDate.values()].sort((a, b) => {
    if (a.expiry === null) return 1;
    if (b.expiry === null) return -1;
    return a.expiry.localeCompare(b.expiry);
  });

  // ---- totals -------------------------------------------------------------
  const totals = {
    marketValue: legs.reduce((a, l) => a + l.marketValue, 0),
    unrealized: legs.reduce((a, l) => a + l.unrealized, 0),
    realized: state.account.realizedTotal,
    vega: legs.reduce((a, l) => a + l.vega, 0),
    theta: legs.reduce((a, l) => a + l.theta, 0),
    grossExposure: gross,
    netDeltaDollars: legs.reduce((a, l) => a + l.deltaDollars, 0),
    gammaDollars: legs.reduce((a, l) => a + l.gammaDollars, 0),
  };

  const top = byUnderlying[0] ?? null;
  const concentration = {
    top: top?.underlying ?? null,
    topShare: top?.share ?? 0,
    herfindahl: [...byName.values()].reduce((a, r) => a + r.share * r.share, 0),
    names: byName.size,
  };

  // ---- the scenario grid --------------------------------------------------
  const now = open.reduce((a, p) => a + shockedValue(p, quoteOf(p), 0, 0, 0, state.quotes), 0);
  const grid = VOLS.map(vol =>
    MOVES.map(move => {
      const value = open.reduce((a, p) => a + shockedValue(p, quoteOf(p), move, vol, 0, state.quotes), 0);
      return { move, vol, days: 0, value, pnl: value - now };
    })
  );

  return { legs, byUnderlying, byExpiry, totals, concentration, grid, moves: MOVES, vols: VOLS };
}
