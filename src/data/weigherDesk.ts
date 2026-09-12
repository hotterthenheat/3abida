/*
==================================================
  SLAYER TERMINAL - WEIGHER DESK DATA (data/weigherDesk.ts)

  The chain, the scanner and the market mood behind
  the Weigher's workstation (Noah, 2026-08-25 — the
  Legend-shaped redesign). Facts only, priced by the
  SAME machinery every other surface uses:
  estimatePremium for marks, blackScholesGreeks for
  greeks, the simulator's chain for open interest,
  expiryFor for real session dates. No orders, no
  sides, no advice — we are not a broker.
==================================================
*/

import Simulator from '../core/simulator';
import { expiryFor, type Expiry } from '../core/calendar';
import { estimatePremium } from './compass';
import { spotChangePct } from './gex';
import { blackScholesGreeks } from '../core/greeks';
import type { OptionRight } from '../types/compass';

// ---- deterministic hash noise (the house pattern) ---------------------------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const h01 = (s: string) => hash(s) / 4294967295;

/** Today's key, so day-stable noise rolls at midnight like the sim's quotes.
    Remembered for a second at a time: it is asked ten times per contract,
    and a whole book of chains asked it ninety thousand times per build —
    a Date and an ISO string each (5ms of every Ledger open, profiled). */
let dayKeyAt = 0;
let dayKeyMemo = '';
const dayKey = () => {
  const t = Date.now();
  if (t - dayKeyAt > 1000) {
    dayKeyAt = t;
    dayKeyMemo = new Date(t).toISOString().slice(0, 10);
  }
  return dayKeyMemo;
};

// ---- the chain --------------------------------------------------------------

export interface DeskContract {
  strike: number;
  right: OptionRight;
  /** Modeled mid, the same estimator every Compass surface prices with */
  mark: number;
  delta: number;
  gamma: number;
  /** Per DAY, the convention every retail chain prints */
  theta: number;
  vega: number;
  iv: number;
  /** Risk-neutral odds the contract finishes in the money — N(d2) family */
  itmOdds: number;
  rho: number;
  /** The quote around the mark — bid under, ask over, by a moneyness-wide spread */
  bid: number;
  ask: number;
  /** Session extremes and reference prints for the drilldown */
  high: number;
  low: number;
  prevClose: number;
  last: number;
  volume: number;
  oi: number;
  breakeven: number;
  /** Strike distance from spot, signed percent */
  fromSpotPct: number;
  /* The column-catalog facts (Noah, 2026-08-26, the customize-columns ask):
     everything below is derived from the same pricing above — no new model,
     just more of its faces. */
  /** Day-stable resting size on each side of the quote, contracts */
  bidSize: number;
  askSize: number;
  /** Last print against yesterday's close — dollars, then percent */
  netChange: number;
  netChangePct: number;
  /** The move the stock needs to reach this contract's breakeven, signed % */
  toBreakevenPct: number;
  /** The mark split at parity: already-in-the-money value, and the rest */
  intrinsic: number;
  extrinsic: number;
  /** Odds the tape touches this strike before expiry (2× the finish odds) */
  touchOdds: number;
  /** Odds the contract closes past its breakeven (long) — short is the rest */
  profitOddsLong: number;
  profitOddsShort: number;
}

export interface DeskChainRow {
  strike: number;
  call: DeskContract;
  put: DeskContract;
}

export interface DeskChain {
  ticker: string;
  spot: number;
  step: number;
  rows: DeskChainRow[];
  expiry: Expiry;
  /** The move the options are charging for by this expiry, ± percent */
  expectedMovePct: number;
}

/** Abramowitz–Stegun N(x) — same approximation core/greeks uses. */
function normalCDF(x: number): number {
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp((-x * x) / 2);
  const p = k * (0.31938153 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  return x >= 0 ? 1 - d * p : d * p;
}

/** Contract IV off the name's base vol: a gentle smile plus put skew, all
    deterministic so the chain doesn't shimmer between renders. */
function contractIv(baseIv: number, spot: number, strike: number, right: OptionRight): number {
  const m = (strike - spot) / spot;
  const smile = 1 + 2.2 * m * m;
  const skew = right === 'P' ? 1 + Math.max(0, -m) * 0.35 : 1 + Math.max(0, -m) * 0.15;
  return baseIv * smile * skew;
}

/** The expiry rail: requested horizons resolved to REAL sessions, deduped —
    two horizons that land on the same Friday are one door, not two. */
export const DESK_DTES = [0, 2, 4, 7, 14, 21, 30, 45] as const;

export function deskExpiries(): Expiry[] {
  const seen = new Set<string>();
  const out: Expiry[] = [];
  for (const dte of DESK_DTES) {
    const e = expiryFor(dte);
    const key = e.date.toISOString().slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** A single contract's IV on the same smile the chain prices with —
    exported so the premium pane and the chain can never disagree. */
export function contractIvFor(ticker: string, strike: number, right: OptionRight): number {
  const sym = Simulator.ensureTicker(ticker);
  const spot = Simulator.TICKERS[sym].currentPrice;
  return contractIv(Simulator.TICKERS[sym].iv, spot, strike, right);
}

export function buildDeskChain(ticker: string, dte: number, depth = 10): DeskChain {
  const snapshot = Simulator.snapshotFor(ticker);
  const { spot, chain } = snapshot;
  const expiry = expiryFor(dte);
  // Sessions, floored at half a day — a listed contract has at least that
  const t = Math.max(expiry.sessions, 0.5) / 252;
  const baseIv = Simulator.TICKERS[Simulator.ensureTicker(ticker)].iv;

  /* Yesterday's close for every contract comes from yesterday's SPOT run
     through the same estimator — a real relationship, not a random offset. */
  const prevSpot = spot / (1 + spotChangePct(ticker) / 100);

  const sorted = [...chain].sort((a, b) => a.strike - b.strike);
  const spotIdx = Math.max(0, sorted.findIndex(n => n.strike >= spot));
  let step = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i].strike - sorted[i - 1].strike;
    if (d > 1e-9) step = Math.min(step, d);
  }
  if (!Number.isFinite(step) || step <= 0) step = 1;

  /*
    THE LADDER IS NOT CAPPED BY THE BOOK (Noah, 2026-08-25: "there should be
    way more strikes"). The sim maintains ~30 strikes a side for the GEX
    machinery; a quote table reaches further. Strikes are laid on the chain's
    own grid centred at the book's spot strike, real nodes hand over their
    open interest, and the wings past the book get a deterministic, day-stable
    OI that decays with distance — priced by the same estimator either way.
  */
  const byStrike = new Map(sorted.map(n => [n.strike, n]));
  const center = sorted[spotIdx]?.strike ?? Math.round(spot / step) * step;
  const wingOI = (strike: number, right: OptionRight): number => {
    const decay = Math.exp(-Math.abs(strike - spot) / (spot * 0.08));
    return Math.round(h01(`${ticker}-${strike}-${right}-${dayKey()}-boi`) * 9000 * decay + 40);
  };
  const window: { strike: number; callOI: number; putOI: number }[] = [];
  for (let i = -depth; i <= depth; i++) {
    const strike = Number((center + i * step).toFixed(2));
    if (strike <= 0) continue;
    const node = byStrike.get(strike);
    window.push({
      strike,
      callOI: node ? node.callOI : wingOI(strike, 'C'),
      putOI: node ? node.putOI : wingOI(strike, 'P'),
    });
  }

  const side = (strike: number, right: OptionRight, oi: number): DeskContract => {
    const iv = contractIv(baseIv, spot, strike, right);
    const mark = Number(estimatePremium(spot, strike, right, iv, t).toFixed(2));
    const g = blackScholesGreeks(spot, strike, t, iv);
    const r = 0.05;
    const d1 = (Math.log(spot / strike) + (r + (iv * iv) / 2) * t) / (iv * Math.sqrt(t));
    const d2 = d1 - iv * Math.sqrt(t);
    const nd2 = normalCDF(d2);
    // Black-Scholes theta, stated per SESSION day
    const pdf = Math.exp((-d1 * d1) / 2) / Math.sqrt(2 * Math.PI);
    const thetaYear =
      -(spot * pdf * iv) / (2 * Math.sqrt(t)) -
      (right === 'C' ? r * strike * Math.exp(-r * t) * nd2 : -r * strike * Math.exp(-r * t) * (1 - nd2));
    // Day-stable, contract-deterministic volume that leans toward the money
    const near = Math.exp(-Math.abs(strike - spot) / (spot * 0.03));
    const seed = `${ticker}-${strike}-${right}-${dayKey()}`;
    const volume = Math.round(h01(`${seed}-dvol`) * 40000 * near + 120 * near);
    /* The spread widens as the contract leaves the money — a $12 ATM name is
       penny-wide, a lotto is not. Floored at a cent. */
    const m = Math.abs(strike - spot) / spot;
    const spread = Math.max(0.01, mark * (0.015 + 0.06 * Math.min(1, m * 5)) * (0.6 + 0.8 * h01(`${seed}-spr`)));
    const bid = Math.max(0, Number((mark - spread / 2).toFixed(2)));
    const ask = Number((mark + spread / 2).toFixed(2));
    const last = Number((bid + (ask - bid) * h01(`${seed}-fill`)).toFixed(2));
    const prevClose = Math.max(0.01, Number(estimatePremium(prevSpot, strike, right, iv, t + 1 / 252).toFixed(2)));
    const high = Number((Math.max(mark, last, prevClose) * (1 + 0.04 + 0.09 * h01(`${seed}-hi`))).toFixed(2));
    const low = Math.max(0.01, Number((Math.min(mark, last) * (1 - 0.04 - 0.09 * h01(`${seed}-lo`))).toFixed(2)));
    const rho = Number(
      (((right === 'C' ? 1 : -1) * strike * t * Math.exp(-r * t) * (right === 'C' ? nd2 : 1 - nd2)) / 100).toFixed(4)
    );

    // ---- the column-catalog facts, all from the machinery already here ----
    const itm = (right === 'C' ? nd2 : 1 - nd2) * 100;
    const breakeven = Number((right === 'C' ? strike + mark : strike - mark).toFixed(2));
    // Size leans toward the money like volume does, on its own hash lane
    const sizeDecay = Math.exp(-Math.abs(strike - spot) / (spot * 0.1));
    const bidSize = Math.round(h01(`${seed}-bsz`) * 380 * sizeDecay + 3);
    const askSize = Math.round(h01(`${seed}-asz`) * 380 * sizeDecay + 3);
    const netChange = Number((last - prevClose).toFixed(2));
    const netChangePct = prevClose > 0 ? Number(((netChange / prevClose) * 100).toFixed(1)) : 0;
    const intrinsic = Number(Math.max(0, right === 'C' ? spot - strike : strike - spot).toFixed(2));
    const extrinsic = Number(Math.max(0, mark - intrinsic).toFixed(2));
    /* Touch: the classic first-passage approximation — an OTM strike gets
       touched about twice as often as it gets finished beyond; a strike the
       tape is already past has been touched by definition. */
    const touchOdds = (right === 'C' ? spot >= strike : spot <= strike) ? 100 : Number(Math.min(99, 2 * itm).toFixed(2));
    /* Profit odds: the same N(d2) read, taken at the BREAKEVEN instead of the
       strike — the odds the contract closes worth more than its mark. A put
       whose breakeven falls through zero can never get there. */
    let profitOddsLong = 0;
    if (breakeven > 0) {
      const dBe1 = (Math.log(spot / breakeven) + (r + (iv * iv) / 2) * t) / (iv * Math.sqrt(t));
      const pBeyond = normalCDF(dBe1 - iv * Math.sqrt(t));
      profitOddsLong = Number(((right === 'C' ? pBeyond : 1 - pBeyond) * 100).toFixed(2));
    }
    const profitOddsShort = Number((100 - profitOddsLong).toFixed(2));

    return {
      strike,
      right,
      mark,
      delta: Number((right === 'C' ? g.deltaCall : g.deltaPut).toFixed(4)),
      gamma: Number(g.gamma.toFixed(4)),
      theta: Number((thetaYear / 252).toFixed(4)),
      vega: Number(g.vega.toFixed(4)),
      iv: Number((iv * 100).toFixed(2)),
      itmOdds: Number(((right === 'C' ? nd2 : 1 - nd2) * 100).toFixed(2)),
      rho,
      bid,
      ask,
      high,
      low,
      prevClose,
      last,
      volume,
      oi,
      breakeven,
      fromSpotPct: Number((((strike - spot) / spot) * 100).toFixed(2)),
      bidSize,
      askSize,
      netChange,
      netChangePct,
      toBreakevenPct: Number((((breakeven - spot) / spot) * 100).toFixed(2)),
      intrinsic,
      extrinsic,
      touchOdds,
      profitOddsLong,
      profitOddsShort,
    };
  };

  const rows: DeskChainRow[] = window.map(node => ({
    strike: node.strike,
    call: side(node.strike, 'C', node.callOI),
    put: side(node.strike, 'P', node.putOI),
  }));

  return {
    ticker,
    spot,
    step,
    rows,
    expiry,
    expectedMovePct: Number((baseIv * Math.sqrt(t) * 100).toFixed(2)),
  };
}

// ---- the scanner ------------------------------------------------------------

export type ScanPreset = 'gainers' | 'losers' | 'voliv';

export const SCAN_PRESETS: { key: ScanPreset; label: string; hint: string }[] = [
  { key: 'gainers', label: 'Daily gainers', hint: 'Largest session gains first' },
  { key: 'losers', label: 'Daily losers', hint: 'Largest session losses first' },
  { key: 'voliv', label: 'Options volume · IV', hint: 'Busiest option tapes, priciest vol first' },
];

export interface ScanRow {
  ticker: string;
  last: number;
  changePct: number;
  /** Contracts traded today across the name's chain */
  optVolume: number;
  ivPct: number;
}

export function buildScan(preset: ScanPreset, active: string): ScanRow[] {
  const quotes = Simulator.universeQuotes(active);
  const rows: ScanRow[] = quotes.map(q => {
    /* SEEDED MEANS THE HISTORY EXISTS, not the config (2026-09-06, the perf
       sweep): a roster name the Compass pump had registered and walked
       halfway counted as seeded here, and spotChangePct then finished its
       walk synchronously — 110ms inside the Weigher's open, profiled. */
    const seeded = Simulator.isSeeded(q.ticker);
    /* Seeded names report their real simulated session; roster names not yet
       clicked awake get a day-stable read, the same contract their scan
       quote already keeps. */
    const changePct = seeded
      ? Number(spotChangePct(q.ticker).toFixed(2))
      : Number(((h01(`${q.ticker}-${dayKey()}-chg`) - 0.5) * 6.4).toFixed(2));
    const optVolume = Math.round(
      (h01(`${q.ticker}-${dayKey()}-ovol`) * 0.7 + q.iv * 0.9) * 900_000 + 40_000
    );
    return {
      ticker: q.ticker,
      last: Number(q.price.toFixed(2)),
      changePct,
      optVolume,
      ivPct: Number((q.iv * 100).toFixed(1)),
    };
  });

  switch (preset) {
    case 'gainers':
      return rows.filter(r => r.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 14);
    case 'losers':
      return rows.filter(r => r.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 14);
    case 'voliv':
      return [...rows].sort((a, b) => b.optVolume * b.ivPct - a.optVolume * a.ivPct).slice(0, 14);
  }
}

// ---- the market's mood ------------------------------------------------------

export type MarketMood = 'up' | 'down' | 'flat';

/** The FLAT BAND keeps the tone honest: without it the tone would flip
    up/down all day on noise. ±0.15% is a genuinely mixed tape. (The desk's
    background wash that wore this tone is gone, 2026-09-03; the desk's head
    reads only `changePct` now. The tone stays for any future consumer.) */
export const MOOD_BAND_PCT = 0.15;

/** The Nasdaq's session, read from QQQ — the name the twins already map to
    NDX. Returns the tone and the number it was read from. */
/** Whether New York is trading right now — 9:30 to 16:00 ET on a weekday.
    Everything else is the overnight session. */
export function marketSession(): 'open' | 'overnight' {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(x => x.type === t)?.value ?? '';
  const mins = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
  const weekday = !['Sat', 'Sun'].includes(get('weekday'));
  return weekday && mins >= 570 && mins < 960 ? 'open' : 'overnight';
}

export function marketMood(): { mood: MarketMood; changePct: number } {
  const changePct = Number(spotChangePct('QQQ').toFixed(2));
  const mood: MarketMood = changePct > MOOD_BAND_PCT ? 'up' : changePct < -MOOD_BAND_PCT ? 'down' : 'flat';
  return { mood, changePct };
}
