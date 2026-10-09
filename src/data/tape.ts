/*
==================================================
  SLAYER TERMINAL - TAPE ENRICHMENT (tape.ts)
  Expands the feed's thin TapeOrder into a full
  FlowPrint deterministically; the per-print feed
  fills the same contract.
==================================================
*/

import Simulator from '../core/simulator';
import { now } from '../core/clock';
import { nyClock, nyParts } from '../core/nyTime';
import type { TapeOrder } from '../types/market';
import type { BookContract, FlowPrint, PrintSentiment, StratTag, TapeSummary } from '../types/trace';

// ---- deterministic RNG ------------------------------------------------------
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function h01(seed: string): number {
  return (hash(seed) % 1000) / 1000;
}

const DTE_POOL = [0, 1, 2, 5, 9, 16, 30, 44, 72, 102, 254];

/* THE MARKET A FILL CROSSED INTO, with the fill INSIDE it (the audit's TR-8: "filled $0.36" beside a 0.37 × 0.39 market).
   The bid sits the fill's share of the spread below it and the ask a spread above the bid; rounding to the cent can push
   either past the fill, so they are widened back round it and the position read again off what is printed. */
function marketAround(fill: number, spreadW: number, pos: number): { bid: number; ask: number; fillPos: number } {
  let bid = Number(Math.max(0.01, fill - spreadW * pos).toFixed(2));
  let ask = Number((bid + spreadW).toFixed(2));
  bid = Math.min(bid, fill);
  ask = Math.max(ask, fill, bid + 0.01);
  return { bid, ask, fillPos: Number(((fill - bid) / Math.max(0.01, ask - bid)).toFixed(2)) };
}
const STRATS: StratTag[] = ['Vertical', 'Butterfly', 'Ratio', 'Custom'];

export function enrichPrint(order: TapeOrder, id: number): FlowPrint {
  const seed = `${order.ticker}-${order.strike}-${order.side}-${order.size}-${id}`;
  const h = (tag: string) => h01(`${seed}-${tag}`);

  const cfg = Simulator.TICKERS[order.ticker];
  const spot = cfg?.currentPrice ?? 100;
  const baseIv = cfg?.iv ?? 0.2;
  const strike = Number(order.strike);
  const right = order.type;

  // Short-dated skew on expiry selection — counted from New York's date, the market's (the audit's X2)
  const dte = DTE_POOL[Math.floor(Math.pow(h('dte'), 1.6) * DTE_POOL.length)];
  const at = now();
  const ny = nyParts(at);
  const expDate = new Date(ny.year, ny.month - 1, ny.day + dte);
  const expiry = `${String(expDate.getMonth() + 1).padStart(2, '0')}/${String(expDate.getDate()).padStart(2, '0')}/${expDate.getFullYear()}`;

  // Premium estimate: intrinsic + gaussian time value scaled by DTE
  const intrinsic = right === 'C' ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
  const money = (strike - spot) / spot;
  const timeValue =
    spot * baseIv * 0.08 * Math.exp(-Math.pow(money * 18, 2) / 2) * (0.5 + Math.sqrt((dte + 1) / 30));
  const fill = Number(Math.max(0.05, intrinsic * 0.98 + timeValue).toFixed(2));

  const isMid = h('mid') > 0.82;
  const side: FlowPrint['side'] = isMid ? 'MID' : order.side;
  const flowScore = isMid
    ? Math.round((h('fs') - 0.5) * 24)
    : Math.round((side === 'ASK' ? 1 : -1) * (48 + h('fs') * 52));

  // Fill position within the spread follows the side it crossed on
  const spreadW = Math.max(0.02, fill * 0.03 * (0.6 + h('spr')));
  const quote = marketAround(fill, spreadW, side === 'ASK' ? 0.72 + h('pos') * 0.28 : side === 'BID' ? h('pos') * 0.28 : 0.4 + h('pos') * 0.2);

  const ratioBidPct = Math.round(side === 'BID' ? 45 + h('rb') * 50 : side === 'ASK' ? 5 + h('rb') * 50 : 35 + h('rb') * 30);
  const ratioLabel = isMid ? 'MID' : ratioBidPct >= 50 ? `BID ${ratioBidPct}%` : `ASK ${100 - ratioBidPct}%`;

  const volume = Math.round(order.size * (4 + h('vol') * 80));
  const oi = Math.max(1, Math.round(volume * (0.4 + h('oi') * 3.2)));
  const deltaOI = h('doi') > 0.35 ? Math.round((h('doi2') - 0.4) * oi * 0.25) : 0;

  const legs = h('legs') > 0.78 ? 2 + Math.floor(h('legs2') * 3) : 1;
  const strat: StratTag = legs > 1 ? STRATS[Math.floor(h('strat') * STRATS.length)] : h('strat') > 0.9 ? 'Custom' : '—';

  return {
    id,
    /* NEW YORK'S CLOCK, 24-hour (the audit's X2.3 and X2.8): the feed stamps a print in the machine's own zone and
       12-hour words ("6:17:50 PM"); the tape, the card and the books speak New York's "14:03:42" */
    time: nyClock(at, { seconds: true }),
    ticker: order.ticker,
    legs,
    strike,
    right,
    otmPct: Number((money * 100).toFixed(1)),
    expiry,
    dte,
    fill,
    bid: quote.bid,
    ask: quote.ask,
    fillPos: quote.fillPos,
    side,
    flowScore,
    ratioLabel,
    ratioBidPct,
    size: order.size,
    premium: Math.round(fill * order.size * 100),
    volume,
    oi,
    deltaOI,
    spot: Number(spot.toFixed(2)),
    iv: Number((baseIv * 100 * (0.8 + h('iv') * 0.6)).toFixed(2)),
    volOverOI: Number((volume / oi).toFixed(2)),
    strat,
    sweep: order.orderType === 'SWEEP',
  };
}

/** The day book's row, spoken as its LATEST print — so every flow surface
    opens THE tape's drilldown, not a lesser card (Noah, 2026-08-30: one card
    for a contract, everywhere). Day facts (volume, OI, ΔOI, IV) ride through
    unchanged so the card and the table can never disagree; the anchor print
    itself is the contract's most recent fill — or the exact clip a flow
    alert fired on, when the caller passes one. */
export function bookRowToPrint(
  row: BookContract,
  clip?: { size: number; fill: number; side: 'ASK' | 'BID'; time: string }
): FlowPrint {
  const h = (tag: string) => h01(`${row.key}-brp-${tag}`);
  const fill = clip?.fill ?? row.last;
  const side: FlowPrint['side'] = clip?.side ?? (row.askPct >= 55 ? 'ASK' : row.askPct <= 45 ? 'BID' : 'MID');
  const spreadW = Math.max(0.02, fill * 0.03 * (0.6 + h('spr')));
  const quote = marketAround(fill, spreadW, side === 'ASK' ? 0.72 + h('pos') * 0.28 : side === 'BID' ? h('pos') * 0.28 : 0.5);
  const size = clip?.size ?? Math.max(5, Math.round(row.volume * (0.01 + h('sz') * 0.05)));
  const bidPct = 100 - row.askPct;

  return {
    id: hash(`${row.key}-anchor`),
    time: clip?.time ?? row.lastAt,
    ticker: row.ticker,
    legs: row.multiPct >= 30 ? 2 : 1,
    strike: row.strike,
    right: row.right,
    otmPct: row.otmPct,
    expiry: row.expiry,
    dte: row.dte,
    fill,
    bid: quote.bid,
    ask: quote.ask,
    fillPos: quote.fillPos,
    side,
    flowScore:
      side === 'MID' ? Math.round((h('fs') - 0.5) * 24) : Math.round((side === 'ASK' ? 1 : -1) * (48 + h('fs') * 52)),
    ratioLabel: side === 'MID' ? 'MID' : bidPct >= 50 ? `BID ${bidPct}%` : `ASK ${row.askPct}%`,
    ratioBidPct: bidPct,
    size,
    premium: Math.round(fill * size * 100),
    volume: row.volume,
    oi: row.oi,
    deltaOI: row.deltaOI,
    spot: row.spot,
    iv: row.iv,
    volOverOI: row.volOverOI,
    strat: row.multiPct >= 30 ? 'Custom' : '—',
    sweep: row.sweepPct >= 40,
  };
}

/** Aggressive call buys / put sells read bullish; the inverse reads bearish. */
export function sentimentOf(p: FlowPrint): PrintSentiment {
  if (p.side === 'MID') return 'NEUTRAL';
  return (p.right === 'C' && p.side === 'ASK') || (p.right === 'P' && p.side === 'BID') ? 'BULLISH' : 'BEARISH';
}

/**
 * Notable flow — conviction-ranked ordering for the tape's Notable view
 * (Noah, 2026-08-19: "premium, size, OTM %, and aggressiveness rather than
 * just premium"). The composite is ENGINE-INTERNAL per the scores rule: it
 * orders the list and is never displayed — the user sees ranks, and the
 * row's own columns are the why. Components normalize against the buffer
 * itself so the ranking adapts to the session's scale: premium leads,
 * aggression next (a sweep crossing the spread is the loudest thing on a
 * tape), then size, then how far out-of-the-money the bet was placed
 * (ITM prints earn nothing on that axis — conviction lives OTM).
 */
export function rankNotable(prints: FlowPrint[]): FlowPrint[] {
  let maxPrem = 1;
  let maxSize = 1;
  let maxOtm = 1;
  for (const p of prints) {
    maxPrem = Math.max(maxPrem, p.premium);
    maxSize = Math.max(maxSize, p.size);
    maxOtm = Math.max(maxOtm, Math.max(0, p.otmPct));
  }
  const score = (p: FlowPrint) => {
    const aggression = p.sweep ? 1 : p.side !== 'MID' ? 0.55 : 0.15;
    const otm = Math.max(0, p.otmPct) / maxOtm;
    return 0.35 * (p.premium / maxPrem) + 0.25 * aggression + 0.2 * (p.size / maxSize) + 0.2 * otm;
  };
  return prints
    .map(p => [score(p), p] as const)
    .sort((a, b) => b[0] - a[0])
    .map(([, p]) => p);
}

/* ── WHAT KIND OF PRINT ─────────────────────────────────────────────────────────────────────────────────────────────
   THE AUDIT'S TR-26 (2026-10-09): every print that was not a sweep was called a block, so a 17-lot custom spread read
   "negotiated size, one print". A block is SIZE in one print — one leg, at least BLOCK_MIN_SIZE contracts or
   BLOCK_MIN_PREMIUM dollars. A print with legs is a multi-leg print, whatever its size; the rest are single prints. */
export type PrintKind = 'SWEEP' | 'BLOCK' | 'MULTI' | 'SINGLE';
export const BLOCK_MIN_SIZE = 100;
export const BLOCK_MIN_PREMIUM = 250_000;
export function printKind(p: Pick<FlowPrint, 'sweep' | 'legs' | 'strat' | 'size' | 'premium'>): PrintKind {
  if (p.sweep) return 'SWEEP';
  if (p.legs > 1 || p.strat !== '—') return 'MULTI';
  if (p.size >= BLOCK_MIN_SIZE || p.premium >= BLOCK_MIN_PREMIUM) return 'BLOCK';
  return 'SINGLE';
}

export function summarizeTape(prints: FlowPrint[]): TapeSummary {
  let bull = 0;
  let bear = 0;
  let callCount = 0;
  let callPremium = 0;
  let putCount = 0;
  let putPremium = 0;
  let sweeps = 0;
  let blocks = 0;
  let multi = 0;
  let largest: FlowPrint | null = null;

  for (const p of prints) {
    if (p.right === 'C') {
      callCount++;
      callPremium += p.premium;
    } else {
      putCount++;
      putPremium += p.premium;
    }
    const kind = printKind(p);
    if (kind === 'SWEEP') sweeps++;
    else if (kind === 'BLOCK') blocks++;
    else if (kind === 'MULTI') multi++;
    if (!largest || p.premium > largest.premium) largest = p;
    const s = sentimentOf(p);
    if (s === 'BULLISH') bull += p.premium;
    else if (s === 'BEARISH') bear += p.premium;
  }

  const netPremium = bull - bear;
  return {
    totalPremium: callPremium + putPremium,
    netPremium,
    bullish: netPremium >= 0,
    bullPremium: bull,
    bearPremium: bear,
    callCount,
    callPremium,
    putCount,
    putPremium,
    /* PUT PREMIUM AGAINST CALL PREMIUM, as its label says (the audit's TR-25: it divided the COUNTS, so "4C $169.3K /
       4P $464.5K" read P/C 1.00) */
    pcRatio: callPremium > 0 ? Number((putPremium / callPremium).toFixed(2)) : 0,
    rvol: Number((0.55 + h01(`rvol-${prints.length}`) * 0.5).toFixed(2)),
    sweeps,
    blocks,
    multi,
    other: prints.length - sweeps - blocks - multi,
    largest: largest
      ? { ticker: largest.ticker, strike: largest.strike, right: largest.right, premium: largest.premium }
      : null,
  };
}
