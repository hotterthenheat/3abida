/*
==================================================
  SLAYER TERMINAL - PAPER INSTRUMENTS (core/paper/instruments.ts)

  What the Paper desk can trade, and how each thing
  is priced, ticked and sized: stocks and ETFs,
  the equity-index futures, and options — single
  legs and spreads. Every instrument is a plain,
  serialisable record so an order or a position
  written to storage tonight still knows what it
  was in the morning.

  THE FUTURES ARE THE TERMINAL'S OWN TWINS. The
  feed quotes the ETFs; data/indexTwins already
  prices the cash index and the futures off them
  (ES = SPX + carry, NQ = NDX + carry) for the
  Pulse strip. This desk trades those same twins,
  on the contract's real tick and multiplier, and
  says so on every quote (market.ts provenance).

  THE INDEX OPTIONS ARE THE ETF CHAIN, SCALED. SPX
  strikes and premiums are SPY's × 10, NDX is
  QQQ's × 41 — the family ratio the twins use — so
  a 6850 SPXW call is priced by the same estimator,
  the same smile and the same greeks as the SPY 685
  call under it. Multiplier 100 like every listed
  option.

  NOTHING HERE IS A PRICE. This file names things;
  market.ts prices them.
==================================================
*/

import type { OptionRight } from '../../types/compass';

export type InstrumentKind = 'stock' | 'future' | 'option' | 'spread';

/** Where a quote's numbers come from — printed beside every price */
export type Provenance = 'observed' | 'calculated';

// ---- futures ---------------------------------------------------------------

export interface FutureSpec {
  root: string;
  name: string;
  /** The ETF the feed quotes, and the twin family behind it */
  etf: string;
  /** Dollars per one full point of the contract */
  pointValue: number;
  tickSize: number;
  /** Reference initial margin per contract — an exchange-style figure, not a broker's */
  initialMargin: number;
  /** Commission per contract per side (reference) */
  fee: number;
  /** Which family root shares the same twin (the micro rides its parent's price) */
  micro?: boolean;
}

export const FUTURES: FutureSpec[] = [
  { root: 'ES', name: 'E-mini S&P 500', etf: 'SPY', pointValue: 50, tickSize: 0.25, initialMargin: 14000, fee: 1.29 },
  { root: 'NQ', name: 'E-mini Nasdaq-100', etf: 'QQQ', pointValue: 20, tickSize: 0.25, initialMargin: 21000, fee: 1.29 },
  { root: 'RTY', name: 'E-mini Russell 2000', etf: 'IWM', pointValue: 50, tickSize: 0.1, initialMargin: 7000, fee: 1.29 },
  { root: 'MES', name: 'Micro E-mini S&P 500', etf: 'SPY', pointValue: 5, tickSize: 0.25, initialMargin: 1400, fee: 0.35, micro: true },
  { root: 'MNQ', name: 'Micro E-mini Nasdaq-100', etf: 'QQQ', pointValue: 2, tickSize: 0.25, initialMargin: 2100, fee: 0.35, micro: true },
  { root: 'M2K', name: 'Micro E-mini Russell 2000', etf: 'IWM', pointValue: 5, tickSize: 0.1, initialMargin: 700, fee: 0.35, micro: true },
];

export const futureSpec = (root: string): FutureSpec | undefined => FUTURES.find(f => f.root === root.toUpperCase());

/** Quarterly month codes — the March/June/September/December cycle */
const QUARTER_CODES: Record<number, string> = { 2: 'H', 5: 'M', 8: 'U', 11: 'Z' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const thirdFriday = (y: number, m: number): Date => {
  const first = new Date(y, m, 1);
  return new Date(y, m, 1 + ((5 - first.getDay() + 7) % 7) + 14);
};

export interface FrontMonth {
  /** e.g. "NQZ6" */
  code: string;
  /** The last trading day — the third Friday of the contract month */
  expiry: Date;
  /** YYYY-MM-DD */
  expiryIso: string;
  /** "Dec 18 '26" */
  label: string;
  /** Calendar days until the last trade */
  daysLeft: number;
}

/** The front quarterly contract, rolled a week before its last trade the way the street rolls */
export function frontMonth(root: string, from: Date = new Date()): FrontMonth {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let y = base.getFullYear();
  let m = base.getMonth();
  for (let i = 0; i < 8; i++) {
    if (QUARTER_CODES[m]) {
      const exp = thirdFriday(y, m);
      const roll = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate() - 7);
      if (base < roll) {
        const iso = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`;
        return {
          code: `${root}${QUARTER_CODES[m]}${String(y).slice(-1)}`,
          expiry: exp,
          expiryIso: iso,
          label: `${MONTHS[exp.getMonth()]} ${exp.getDate()} '${String(exp.getFullYear()).slice(2)}`,
          daysLeft: Math.round((exp.getTime() - base.getTime()) / 86400000),
        };
      }
    }
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  /* unreachable — eight months always hold a quarter */
  const exp = thirdFriday(y, m);
  return { code: `${root}?`, expiry: exp, expiryIso: '', label: '', daysLeft: 0 };
}

// ---- index option families --------------------------------------------------

export interface IndexFamily {
  /** What the option is called on the tape */
  symbol: string;
  name: string;
  /** The ETF whose chain it is priced from */
  etf: string;
  /** Index points per ETF dollar — strikes and premiums scale by this */
  ratio: number;
  /** The strike grid, in index points */
  strikeStep: number;
}

export const INDEX_FAMILIES: IndexFamily[] = [
  { symbol: 'SPXW', name: 'S&P 500 index options (weeklies)', etf: 'SPY', ratio: 10, strikeStep: 5 },
  { symbol: 'SPX', name: 'S&P 500 index options', etf: 'SPY', ratio: 10, strikeStep: 5 },
  { symbol: 'NDX', name: 'Nasdaq-100 index options', etf: 'QQQ', ratio: 41, strikeStep: 25 },
  { symbol: 'RUT', name: 'Russell 2000 index options', etf: 'IWM', ratio: 10, strikeStep: 5 },
];

export const indexFamily = (symbol: string): IndexFamily | undefined => INDEX_FAMILIES.find(f => f.symbol === symbol.toUpperCase());

/** Options commission per contract per side (reference) */
export const OPTION_FEE = 0.65;

// ---- the instrument records --------------------------------------------------

export interface StockInstrument {
  kind: 'stock';
  id: string;
  symbol: string;
  /** The feed name — the symbol itself */
  underlying: string;
  tickSize: number;
  /** Shares per unit */
  multiplier: 1;
  fee: number;
}

export interface FutureInstrument {
  kind: 'future';
  id: string;
  /** e.g. "NQZ6" */
  symbol: string;
  root: string;
  name: string;
  /** The ETF the feed quotes */
  underlying: string;
  tickSize: number;
  /** Dollars per point */
  multiplier: number;
  initialMargin: number;
  fee: number;
  expiry: string;
  expiryLabel: string;
}

export interface OptionInstrument {
  kind: 'option';
  id: string;
  /** e.g. "SPXW 6850C 09/25" — the words the tags print */
  symbol: string;
  /** The family on the tape: SPXW, NDX, or the stock itself */
  family: string;
  /** The ETF/stock the feed quotes and the chain is priced from */
  underlying: string;
  /** Index points per underlying dollar — 1 for a stock's own option */
  ratio: number;
  strike: number;
  right: OptionRight;
  /** YYYY-MM-DD, a real session */
  expiry: string;
  tickSize: number;
  multiplier: 100;
  fee: number;
}

export interface SpreadLeg {
  option: OptionInstrument;
  /** + buys the leg, − sells it, per one unit of the strategy */
  ratio: number;
}

export interface SpreadInstrument {
  kind: 'spread';
  id: string;
  /** e.g. "SPXW 6850/6870 CALL SPREAD 09/25" */
  symbol: string;
  /** vertical, straddle, strangle, condor, custom */
  strategy: string;
  family: string;
  underlying: string;
  ratio: number;
  expiry: string;
  legs: SpreadLeg[];
  tickSize: number;
  multiplier: 100;
  /** Per unit, per side — the legs' fees summed */
  fee: number;
}

export type Instrument = StockInstrument | FutureInstrument | OptionInstrument | SpreadInstrument;

// ---- builders ------------------------------------------------------------------

/** A stock or ETF, by name */
export function stockInstrument(symbol: string): StockInstrument {
  const sym = symbol.toUpperCase();
  return { kind: 'stock', id: `stock:${sym}`, symbol: sym, underlying: sym, tickSize: 0.01, multiplier: 1, fee: 0 };
}

/** The front month of a futures root */
export function futureInstrument(root: string, from: Date = new Date()): FutureInstrument | null {
  const spec = futureSpec(root);
  if (!spec) return null;
  const fm = frontMonth(spec.root, from);
  return {
    kind: 'future',
    id: `fut:${fm.code}`,
    symbol: fm.code,
    root: spec.root,
    name: spec.name,
    underlying: spec.etf,
    tickSize: spec.tickSize,
    multiplier: spec.pointValue,
    initialMargin: spec.initialMargin,
    fee: spec.fee,
    expiry: fm.expiryIso,
    expiryLabel: fm.label,
  };
}

const fmtStrikeWord = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ''));
/** "09/25" from "2026-09-25" */
export const shortExpiry = (iso: string): string => (iso.length >= 10 ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}` : iso);

/** One listed option. `family` is an index family symbol (SPXW, NDX, RUT) or the stock's own name. */
export function optionInstrument(family: string, strike: number, right: OptionRight, expiry: string): OptionInstrument {
  const fam = indexFamily(family);
  const symbol = family.toUpperCase();
  const underlying = fam ? fam.etf : symbol;
  const ratio = fam ? fam.ratio : 1;
  return {
    kind: 'option',
    id: `opt:${symbol}:${expiry}:${fmtStrikeWord(strike)}:${right}`,
    symbol: `${symbol} ${fmtStrikeWord(strike)}${right} ${shortExpiry(expiry)}`,
    family: symbol,
    underlying,
    ratio,
    strike,
    right,
    expiry,
    /* Index options tick in nickels above $3 on the street; a dime under is the
       SPX convention. One cent everywhere keeps the desk's ticks readable. */
    tickSize: 0.01,
    multiplier: 100,
    fee: OPTION_FEE,
  };
}

/** A strategy over several legs — one position, the legs underneath */
export function spreadInstrument(strategy: string, legs: SpreadLeg[], words?: string): SpreadInstrument {
  const first = legs[0].option;
  const sorted = [...legs].sort((a, b) => a.option.strike - b.option.strike || a.option.right.localeCompare(b.option.right));
  const key = sorted.map(l => `${l.ratio > 0 ? '+' : '-'}${Math.abs(l.ratio)}${fmtStrikeWord(l.option.strike)}${l.option.right}`).join('_');
  const symbol = words ?? `${first.family} ${sorted.map(l => fmtStrikeWord(l.option.strike)).join('/')} ${strategy.toUpperCase()} ${shortExpiry(first.expiry)}`;
  return {
    kind: 'spread',
    id: `spread:${first.family}:${first.expiry}:${key}`,
    symbol,
    strategy,
    family: first.family,
    underlying: first.underlying,
    ratio: first.ratio,
    expiry: first.expiry,
    legs: sorted,
    tickSize: 0.01,
    multiplier: 100,
    fee: sorted.reduce((s, l) => s + Math.abs(l.ratio) * l.option.fee, 0),
  };
}

// ---- arithmetic every surface shares ---------------------------------------------

/** Snap a price to the instrument's grid */
export function roundToTick(inst: Pick<Instrument, 'tickSize'>, price: number): number {
  const t = inst.tickSize;
  const decimals = t >= 1 ? 0 : Math.ceil(-Math.log10(t));
  return Number((Math.round(price / t) * t).toFixed(decimals));
}

/** The dollar value of one tick of one unit */
export const tickValue = (inst: Instrument): number => Number((inst.tickSize * inst.multiplier).toFixed(4));

/** Dollars per one unit of price move on one unit of the instrument */
export const unitValue = (inst: Instrument): number => inst.multiplier;

/** Reference margin held per unit — futures by the exchange figure, everything else priced in market.ts */
export const isFuture = (inst: Instrument): inst is FutureInstrument => inst.kind === 'future';
export const isOption = (inst: Instrument): inst is OptionInstrument => inst.kind === 'option';
export const isSpread = (inst: Instrument): inst is SpreadInstrument => inst.kind === 'spread';

/** The word for one unit: contracts for derivatives, shares for stock */
export const unitWord = (inst: Instrument, n = 2): string => (inst.kind === 'stock' ? (n === 1 ? 'share' : 'shares') : n === 1 ? 'contract' : 'contracts');

/** How a price prints for this instrument: futures with thousands and no sign, options and stocks in dollars */
export function fmtPrice(inst: Pick<Instrument, 'kind' | 'tickSize'>, price: number): string {
  const decimals = inst.tickSize >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(inst.tickSize)));
  if (inst.kind === 'future') return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, decimals) });
  const sign = price < 0 ? '-' : '';
  return `${sign}$${Math.abs(price).toFixed(Math.max(2, decimals))}`;
}

/** Dollars, signed, two decimals: "+$975.00" · "-$1,240.50" */
export function fmtMoney(v: number, signed = true): string {
  const sign = v < 0 ? '-' : signed && v > 0 ? '+' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A short instrument word for a tag: NQZ6 · SPXW 6850C · SPY */
export const tagWord = (inst: Instrument): string => (inst.kind === 'option' ? `${inst.family} ${fmtStrikeWord(inst.strike)}${inst.right}` : inst.kind === 'spread' ? inst.symbol.replace(/ \d\d\/\d\d$/, '') : inst.symbol);

/** The fee for `qty` units, one side */
export const feeFor = (inst: Instrument, qty: number): number => Number((inst.fee * qty).toFixed(2));

/** Whether a listed thing has expired as of `now` — a 4pm session close on its last day */
export function expiredAt(inst: Instrument, now: Date): boolean {
  if (inst.kind === 'stock') return false;
  const iso = inst.expiry;
  if (!iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const close = new Date(y, m - 1, d, 16, 0, 0);
  return now > close;
}
