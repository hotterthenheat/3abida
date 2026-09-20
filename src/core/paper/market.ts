/*
==================================================
  SLAYER TERMINAL - THE MARKET STATE (core/paper/market.ts)

  ONE door between the terminal's feed and the
  paper desk. Every price the desk shows, and every
  price the engine fills against, comes through
  here — the chart, the ticket, the position bar and
  the journal never read the feed themselves, so
  they can never disagree about what the market is.

    LIVE MARKET DATA (the terminal's feed)
            ↓
    MARKET STATE (this file: quotes, bars, levels)
            ↓
    the chart · the engine

  WHAT IS OBSERVED AND WHAT IS CALCULATED, said on
  every quote: a stock's last IS the feed's price;
  its bid and ask are a stated model around it. A
  futures price is the index twin the terminal
  already prices for the Pulse strip (ETF × ratio +
  a carry basis fixed for the session), on the
  contract's own tick. An option is priced by the
  SAME estimator, smile and greeks the Weigher's
  chain uses — `side()` in data/weigherDesk, mirrored
  line for line below — so the chain a reader picks
  from and the quote the engine fills at are one
  number. Nothing is invented: a price here is a
  function of the feed and a model the chip names.

  THE FEED TODAY IS THE TERMINAL'S SIMULATED FEED
  (the sidebar says "Sim"). When a real feed
  replaces it, it replaces it here — one file —
  and every quote downstream is live the same
  morning.
==================================================
*/

import Simulator from '../simulator';
import { blackScholesGreeks } from '../greeks';
import { expiryAt, isoDate, sessionsBetween, today } from '../calendar';
import { dayKey, h01 } from '../rng';
import { estimatePremium } from '../../data/compass';
import { contractIvFor } from '../../data/weigherDesk';
import { buildLevelsFor } from '../../data/gex';
import { twinBasis, twinFamilyFor } from '../../data/indexTwins';
import { nearestListedExpiry } from '../../data/optionChain';
import { aggregateCandles, tfMinutes, type Timeframe } from '../../data/timeframe';
import type { Candle } from '../../types/market';
import type { KeyLevels } from '../../types/gex';
import type { OptionRight } from '../../types/compass';
import {
  futureSpec,
  indexFamily,
  roundToTick,
  type Instrument,
  type OptionInstrument,
  type Provenance,
  type SpreadInstrument,
} from './instruments';

export interface OptionGreeks {
  delta: number;
  gamma: number;
  /** Per session day, per contract's unit */
  theta: number;
  /** Per one vol point */
  vega: number;
  /** Percent, e.g. 18.4 */
  iv: number;
}

export interface Quote {
  id: string;
  bid: number;
  ask: number;
  last: number;
  /** The midpoint — what a position is marked at */
  mark: number;
  /** Units resting at the touch — what a fill can take before it walks the book */
  bidSize: number;
  askSize: number;
  time: number;
  provenance: Provenance;
  /** One line saying where the numbers came from */
  note: string;
  /** The feed's price of the thing underneath (the ETF, or the stock itself) */
  underlyingSpot: number;
  greeks?: OptionGreeks;
  /** Options: the session's tape facts, the chain's own */
  volume?: number;
  oi?: number;
  /** A spread's legs, in the strategy's order */
  legs?: Quote[];
}

/* ---- the feed's spot ---------------------------------------------------------------- */

/** The feed's last for a name — null while its history is still walking in */
export function spotOf(symbol: string): number | null {
  const sym = symbol.toUpperCase();
  const cfg = Simulator.TICKERS[sym];
  if (!cfg || !Simulator.isSeeded(sym)) return null;
  return cfg.currentPrice;
}

/* ---- the futures basis, fixed for the session ---------------------------------------------
   data/indexTwins drifts the carry off the ROUNDED ETF spot, so a quote that
   re-read it every tick would step twenty points every time QQQ crossed a
   dollar — a P&L jump nothing in the market did. The desk reads the carry
   once per family and keeps it for the app's life. */
const basisMemo = new Map<string, number>();
export function futuresBasis(etf: string): number {
  const fam = twinFamilyFor(etf);
  if (!fam) return 0;
  const hit = basisMemo.get(fam.etf);
  if (hit != null) return hit;
  const spot = spotOf(fam.etf) ?? Simulator.TICKERS[fam.etf]?.basePrice ?? 0;
  const b = twinBasis(fam, spot);
  basisMemo.set(fam.etf, b);
  return b;
}

/* ---- displayed size: day-stable, breathing every few seconds ---------------------------------- */
const SLOT_MS = 3000;
const breathing = (seed: string, base: number, time: number): number => Math.max(1, Math.round(base * (0.55 + 0.9 * h01(`${seed}-${Math.floor(time / SLOT_MS)}`))));

/* ---- stocks ------------------------------------------------------------------------ */

const ETF_NAMES = new Set(['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK', 'TLT', 'GLD', 'SLV', 'HYG', 'EEM']);

function stockQuote(inst: Instrument & { kind: 'stock' }, time: number): Quote | null {
  const last = spotOf(inst.symbol);
  if (last == null) return null;
  /* A penny-wide ETF; a stock a few cents wide, wider as the price climbs */
  const spread = ETF_NAMES.has(inst.symbol) ? 0.01 : Math.max(0.01, Math.round(last * 0.00025 * 100) / 100);
  const bid = roundToTick(inst, last - spread / 2);
  const ask = roundToTick(inst, bid + spread);
  const seed = `${inst.symbol}-${dayKey()}`;
  const base = 200 + Math.round(h01(`${seed}-size`) * 1800);
  return {
    id: inst.id,
    bid,
    ask,
    last,
    mark: Number(((bid + ask) / 2).toFixed(4)),
    bidSize: breathing(`${seed}-b`, base, time),
    askSize: breathing(`${seed}-a`, base, time),
    time,
    provenance: 'observed',
    note: `Last is the feed's price · bid and ask are a ${spread.toFixed(2)}-wide model around it`,
    underlyingSpot: last,
  };
}

/* ---- futures ------------------------------------------------------------------------- */

function futureQuote(inst: Instrument & { kind: 'future' }, time: number): Quote | null {
  const fam = twinFamilyFor(inst.underlying);
  const etfSpot = spotOf(inst.underlying);
  if (!fam || etfSpot == null) return null;
  const basis = futuresBasis(inst.underlying);
  const last = roundToTick(inst, etfSpot * fam.ratio + basis);
  /* One tick wide — the front month of an index future rarely shows more */
  const bid = last;
  const ask = roundToTick(inst, last + inst.tickSize);
  const seed = `${inst.symbol}-${dayKey()}`;
  const spec = futureSpec(inst.root);
  const base = spec?.micro ? 40 + Math.round(h01(`${seed}-size`) * 120) : 4 + Math.round(h01(`${seed}-size`) * 24);
  return {
    id: inst.id,
    bid,
    ask,
    last,
    mark: Number(((bid + ask) / 2).toFixed(4)),
    bidSize: breathing(`${seed}-b`, base, time),
    askSize: breathing(`${seed}-a`, base, time),
    time,
    provenance: 'calculated',
    note: `${inst.underlying} × ${fam.ratio} + ${basis.toFixed(2)} carry, on the ${inst.tickSize} tick — the terminal's index twin`,
    underlyingSpot: etfSpot,
  };
}

/* ---- options ---------------------------------------------------------------------------
   THE CHAIN'S OWN PRICING (data/weigherDesk `side()`), one contract at a time:
   the estimator on the desk's smile, the moneyness-wide spread, the day-stable
   sizes and tape facts, Black-Scholes greeks with theta stated per session.
   Scaled by the family ratio for an index option. */

/** Years to expiry, floored at half a session — a listed contract has at least that */
export function yearsToExpiry(expiryIso: string): number {
  const [y, m, d] = expiryIso.split('-').map(Number);
  const e = expiryAt(new Date(y, m - 1, d));
  return Math.max(e.sessions, 0.5) / 252;
}

/** Trading sessions left, 0 on the last day, -1 once it has passed */
export function sessionsLeft(expiryIso: string): number {
  const [y, m, d] = expiryIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const t = today();
  if (date < t) return -1;
  return sessionsBetween(t, date);
}

function normalCDF(x: number): number {
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp((-x * x) / 2);
  const p = k * (0.31938153 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  return x >= 0 ? 1 - d * p : d * p;
}

export function optionQuote(inst: OptionInstrument, time: number): Quote | null {
  const spot = spotOf(inst.underlying);
  if (spot == null) return null;
  const ratio = inst.ratio;
  const strikeEtf = inst.strike / ratio;
  const t = yearsToExpiry(inst.expiry);
  const iv = contractIvFor(inst.underlying, strikeEtf, inst.right);
  const markEtf = estimatePremium(spot, strikeEtf, inst.right, iv, t);
  const m = Math.abs(strikeEtf - spot) / spot;
  const seed = `${inst.underlying}-${strikeEtf}-${inst.right}-${dayKey()}`;
  const spreadEtf = Math.max(0.01, markEtf * (0.015 + 0.06 * Math.min(1, m * 5)) * (0.6 + 0.8 * h01(`${seed}-spr`)));
  const mark = Number((markEtf * ratio).toFixed(2));
  const spread = Math.max(inst.tickSize, Number((spreadEtf * ratio).toFixed(2)));
  const bid = Math.max(0, roundToTick(inst, mark - spread / 2));
  const ask = roundToTick(inst, bid + spread);
  const last = roundToTick(inst, bid + (ask - bid) * h01(`${seed}-fill`));
  const near = Math.exp(-Math.abs(strikeEtf - spot) / (spot * 0.03));
  const sizeDecay = Math.exp(-Math.abs(strikeEtf - spot) / (spot * 0.1));
  const bidBase = Math.round(h01(`${seed}-bsz`) * 380 * sizeDecay + 3);
  const askBase = Math.round(h01(`${seed}-asz`) * 380 * sizeDecay + 3);
  const volume = Math.round(h01(`${seed}-dvol`) * 40000 * near + 120 * near);
  const oi = Math.round(h01(`${inst.underlying}-${strikeEtf}-${inst.right}-${dayKey()}-boi`) * 9000 * Math.exp(-Math.abs(strikeEtf - spot) / (spot * 0.08)) + 40);
  const g = blackScholesGreeks(spot, strikeEtf, t, iv);
  const r = 0.05;
  const d1 = (Math.log(spot / strikeEtf) + (r + (iv * iv) / 2) * t) / (iv * Math.sqrt(t));
  const d2 = d1 - iv * Math.sqrt(t);
  const nd2 = normalCDF(d2);
  const pdf = Math.exp((-d1 * d1) / 2) / Math.sqrt(2 * Math.PI);
  const thetaYear =
    -(spot * pdf * iv) / (2 * Math.sqrt(t)) -
    (inst.right === 'C' ? r * strikeEtf * Math.exp(-r * t) * nd2 : -r * strikeEtf * Math.exp(-r * t) * (1 - nd2));
  const greeks: OptionGreeks = {
    delta: Number((inst.right === 'C' ? g.deltaCall : g.deltaPut).toFixed(4)),
    /* per one point of the option's OWN underlying: an index moves `ratio` points per ETF dollar */
    gamma: Number((g.gamma / ratio).toFixed(5)),
    theta: Number(((thetaYear / 252) * ratio).toFixed(4)),
    vega: Number((g.vega * ratio).toFixed(4)),
    iv: Number((iv * 100).toFixed(2)),
  };
  const fam = indexFamily(inst.family);
  return {
    id: inst.id,
    bid,
    ask,
    last,
    mark: Number(((bid + ask) / 2).toFixed(4)),
    bidSize: breathing(`${seed}-b`, bidBase, time),
    askSize: breathing(`${seed}-a`, askBase, time),
    time,
    provenance: 'calculated',
    note: fam
      ? `Priced off the ${inst.underlying} chain × ${ratio} — the Weigher's estimator, smile and greeks`
      : `The Weigher's chain pricing — the desk's estimator, smile and greeks on the feed's spot`,
    underlyingSpot: spot * ratio,
    greeks,
    volume,
    oi,
  };
}

function spreadQuote(inst: SpreadInstrument, time: number): Quote | null {
  const legs: Quote[] = [];
  for (const l of inst.legs) {
    const q = optionQuote(l.option, time);
    if (!q) return null;
    legs.push(q);
  }
  let mark = 0;
  let bid = 0;
  let ask = 0;
  let size = Infinity;
  const greeks: OptionGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0, iv: 0 };
  inst.legs.forEach((l, i) => {
    const q = legs[i];
    mark += l.ratio * q.mark;
    /* Buying the strategy lifts its long legs and hits its short legs; selling it is the reverse */
    ask += l.ratio > 0 ? l.ratio * q.ask : l.ratio * q.bid;
    bid += l.ratio > 0 ? l.ratio * q.bid : l.ratio * q.ask;
    size = Math.min(size, Math.floor(Math.min(q.bidSize, q.askSize) / Math.abs(l.ratio)));
    if (q.greeks) {
      greeks.delta += l.ratio * q.greeks.delta;
      greeks.gamma += l.ratio * q.greeks.gamma;
      greeks.theta += l.ratio * q.greeks.theta;
      greeks.vega += l.ratio * q.greeks.vega;
    }
  });
  greeks.iv = Number((legs.reduce((s, q) => s + (q.greeks?.iv ?? 0), 0) / legs.length).toFixed(2));
  greeks.delta = Number(greeks.delta.toFixed(4));
  greeks.gamma = Number(greeks.gamma.toFixed(5));
  greeks.theta = Number(greeks.theta.toFixed(4));
  greeks.vega = Number(greeks.vega.toFixed(4));
  return {
    id: inst.id,
    bid: Number(bid.toFixed(2)),
    ask: Number(ask.toFixed(2)),
    last: Number(mark.toFixed(2)),
    mark: Number(mark.toFixed(4)),
    bidSize: Math.max(1, size === Infinity ? 1 : size),
    askSize: Math.max(1, size === Infinity ? 1 : size),
    time,
    provenance: 'calculated',
    note: `${inst.legs.length} legs priced one by one on the ${inst.underlying} chain — the net is their sum`,
    underlyingSpot: legs[0].underlyingSpot,
    greeks,
    legs,
  };
}

/* ---- the one door ---------------------------------------------------------------------- */

/** The market for an instrument right now — null while its name is still seeding */
export function quoteFor(inst: Instrument, time: number = Date.now()): Quote | null {
  switch (inst.kind) {
    case 'stock':
      return stockQuote(inst, time);
    case 'future':
      return futureQuote(inst, time);
    case 'option':
      return optionQuote(inst, time);
    case 'spread':
      return spreadQuote(inst, time);
  }
}

/* ---- bars ------------------------------------------------------------------------------ */

const premiumCache = new Map<string, { baseLen: number; lastTime: number; out: Candle[] }>();

/** The underlying's bars on the timeframe — the base every derived tape is folded from */
function baseBars(underlying: string, tf: Timeframe): Candle[] {
  const raw = Simulator.peekCandles(underlying);
  if (!raw || raw.length === 0) return [];
  return aggregateCandles(raw, tfMinutes(tf));
}

/** A contract's premium at a bar's four prices — its true extremes, whichever right (ContractPremiumPane's rule) */
function premiumBar(b: Candle, px: (spot: number) => number, ratio: number): Candle {
  const o = px(b.open) * ratio;
  const c = px(b.close) * ratio;
  const a = px(b.high) * ratio;
  const z = px(b.low) * ratio;
  return {
    time: b.time,
    open: Number(o.toFixed(2)),
    close: Number(c.toFixed(2)),
    high: Number(Math.max(o, c, a, z).toFixed(2)),
    low: Number(Math.min(o, c, a, z).toFixed(2)),
    volume: b.volume,
  };
}

function optionBars(inst: OptionInstrument, tf: Timeframe): Candle[] {
  const base = baseBars(inst.underlying, tf);
  if (base.length === 0) return [];
  const t = yearsToExpiry(inst.expiry);
  const iv = contractIvFor(inst.underlying, inst.strike / inst.ratio, inst.right);
  const px = (spot: number) => estimatePremium(spot, inst.strike / inst.ratio, inst.right, iv, t);
  const key = `${inst.id}|${tf}|${t.toFixed(5)}`;
  const hit = premiumCache.get(key);
  if (hit && hit.baseLen === base.length && hit.lastTime === base[base.length - 1].time) {
    hit.out[hit.out.length - 1] = premiumBar(base[base.length - 1], px, inst.ratio);
    return hit.out;
  }
  const out = base.map(b => premiumBar(b, px, inst.ratio));
  premiumCache.set(key, { baseLen: base.length, lastTime: base[base.length - 1].time, out });
  return out;
}

/* THE STRATEGY IS PRICED AS ONE THING AT EACH OF THE BAR'S FOUR PRICES —
   never as leg extremes added up. A long leg's high and a short leg's low
   never happen at the same instant; summing them drew a spread tape of
   spikes that no spot ever produced. The net at the underlying's open, high,
   low and close is what the strategy was worth at four real moments, and
   the bar's extremes are the most and least of those (the single option's
   own rule, ContractPremiumPane). */
function spreadBars(inst: SpreadInstrument, tf: Timeframe): Candle[] {
  const base = baseBars(inst.underlying, tf);
  if (base.length === 0) return [];
  const legs = inst.legs.map(l => {
    const t = yearsToExpiry(l.option.expiry);
    const strikeEtf = l.option.strike / l.option.ratio;
    const iv = contractIvFor(l.option.underlying, strikeEtf, l.option.right);
    return { ratio: l.ratio * l.option.ratio, px: (spot: number) => estimatePremium(spot, strikeEtf, l.option.right, iv, t) };
  });
  const net = (spot: number) => legs.reduce((s, l) => s + l.ratio * l.px(spot), 0);
  const key = `${inst.id}|${tf}`;
  const bar = (b: Candle): Candle => {
    const o = net(b.open);
    const c = net(b.close);
    const a = net(b.high);
    const z = net(b.low);
    return { time: b.time, open: Number(o.toFixed(2)), close: Number(c.toFixed(2)), high: Number(Math.max(o, c, a, z).toFixed(2)), low: Number(Math.min(o, c, a, z).toFixed(2)), volume: b.volume };
  };
  const hit = premiumCache.get(key);
  if (hit && hit.baseLen === base.length && hit.lastTime === base[base.length - 1].time) {
    hit.out[hit.out.length - 1] = bar(base[base.length - 1]);
    return hit.out;
  }
  const out = base.map(bar);
  premiumCache.set(key, { baseLen: base.length, lastTime: base[base.length - 1].time, out });
  return out;
}

/** The instrument's own tape on the timeframe — empty while its name is still seeding */
export function barsFor(inst: Instrument, tf: Timeframe): Candle[] {
  switch (inst.kind) {
    case 'stock':
      return baseBars(inst.symbol, tf);
    case 'future': {
      const fam = twinFamilyFor(inst.underlying);
      if (!fam) return [];
      const basis = futuresBasis(inst.underlying);
      const base = baseBars(inst.underlying, tf);
      const map = (v: number) => roundToTick(inst, v * fam.ratio + basis);
      return base.map(b => ({ time: b.time, open: map(b.open), high: map(b.high), low: map(b.low), close: map(b.close), volume: b.volume }));
    }
    case 'option':
      return optionBars(inst, tf);
    case 'spread':
      return spreadBars(inst, tf);
  }
}

/** The forming one-minute bar's time on the instrument's tape — a fill is pinned to it */
export function lastBarTime(inst: Instrument): number | null {
  const raw = Simulator.peekCandles(inst.underlying);
  return raw && raw.length ? raw[raw.length - 1].time : null;
}

/* ---- the dealer levels, in the instrument's own units ---------------------------------- */

/**
 * The walls, the flip and the supreme where this instrument trades.
 *
 * A STOCK ONLY. These are read off the name's OWN option chain, so on a stock
 * they are a fact about the thing you are trading.
 *
 * They used to be handed to futures as well, by taking the underlying ETF's
 * chain and mapping every level across with the family ratio and the basis.
 * That is wrong to draw on a futures chart: a call wall is a property of an
 * OPTION CHAIN, and the chain in question is QQQ's, not NQ's. Transposed onto
 * the contract's own tape with no word said, it reads as a level in that
 * contract, which it is not — three anonymous hairlines asserting something
 * about a market they were not measured in.
 *
 * The dealer BAND overlay (core/paper/dealer.ts) does its own transposition
 * knowingly and says so: every band is captioned with the greek and the
 * UNDERLYING'S strike, so the reader can see it is the chain talking. That is
 * a different thing and it stays.
 *
 * Null for an option's premium tape and for a spread, for the same reason:
 * the level lives on the underlying's price, not on a premium.
 */
export function levelsFor(inst: Instrument): KeyLevels | null {
  if (inst.kind !== 'stock') return null;
  if (!Simulator.isSeeded(inst.underlying)) return null;
  return buildLevelsFor(inst.underlying);
}

/* ---- the chain's grid, for a click on the tape ----------------------------------------- */

/** The listed strike nearest a price, on the family's own grid */
export function nearestStrike(family: string, price: number): number {
  const fam = indexFamily(family);
  if (fam) return Math.round(price / fam.strikeStep) * fam.strikeStep;
  const step = Simulator.TICKERS[family.toUpperCase()]?.step ?? (price < 50 ? 0.5 : price < 150 ? 1 : price < 400 ? 2.5 : 5);
  return Number((Math.round(price / step) * step).toFixed(2));
}

/** The strike grid step for a family */
export function strikeStepFor(family: string): number {
  const fam = indexFamily(family);
  if (fam) return fam.strikeStep;
  const sym = family.toUpperCase();
  return Simulator.TICKERS[sym]?.step ?? 1;
}

/** The expiry a fresh option on this family opens on — the nearest listed date about two sessions out, the Weigher's own default */
export function defaultExpiryFor(family: string, dte = 2): string {
  const fam = indexFamily(family);
  const name = fam ? fam.etf : family.toUpperCase();
  return isoDate(nearestListedExpiry(name, dte).date);
}

/** A price in the underlying's own tape — an index option's strike back on the ETF, a future back on its ETF */
export function toUnderlyingPrice(inst: Instrument, price: number): number {
  if (inst.kind === 'stock') return price;
  if (inst.kind === 'future') {
    const fam = twinFamilyFor(inst.underlying);
    return fam ? (price - futuresBasis(inst.underlying)) / fam.ratio : price;
  }
  return price / inst.ratio;
}

export type { OptionRight };
