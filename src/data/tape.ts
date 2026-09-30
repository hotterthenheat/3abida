/*
==================================================
  SLAYER TERMINAL - TAPE ENRICHMENT (tape.ts)
  Expands the simulator's thin TapeOrder into a full
  FlowPrint deterministically. Placeholder — the real
  per-print feed fills the same contract later.
==================================================
*/

import Simulator from '../core/simulator';
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
const STRATS: StratTag[] = ['Vertical', 'Butterfly', 'Ratio', 'Custom'];

export function enrichPrint(order: TapeOrder, id: number): FlowPrint {
  const seed = `${order.ticker}-${order.strike}-${order.side}-${order.size}-${id}`;
  const h = (tag: string) => h01(`${seed}-${tag}`);

  const cfg = Simulator.TICKERS[order.ticker];
  const spot = cfg?.currentPrice ?? 100;
  const baseIv = cfg?.iv ?? 0.2;
  const strike = Number(order.strike);
  const right = order.type;

  // Short-dated skew on expiry selection
  const dte = DTE_POOL[Math.floor(Math.pow(h('dte'), 1.6) * DTE_POOL.length)];
  const expDate = new Date(Date.now() + dte * 86400000);
  const expiry = `${String(expDate.getMonth() + 1).padStart(2, '0')}/${String(expDate.getDate()).padStart(2, '0')}/${expDate.getFullYear()}`;

  // Premium estimate: intrinsic + gaussian time value scaled by DTE
  const intrinsic = right === 'C' ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
  const money = (strike - spot) / spot;
  const timeValue =
    spot * baseIv * 0.08 * Math.exp(-Math.pow(money * 18, 2) / 2) * (0.5 + Math.sqrt((dte + 1) / 30));
  const fill = Number(Math.max(0.05, intrinsic * 0.98 + timeValue).toFixed(2));

  // Fill position within the spread follows the aggressor side
  const spreadW = Math.max(0.02, fill * 0.03 * (0.6 + h('spr')));
  const fillPos = order.side === 'ASK' ? 0.72 + h('pos') * 0.28 : h('pos') * 0.28;
  const mid = order.side === 'ASK' ? fill - spreadW * fillPos : fill + spreadW * (1 - fillPos);
  const bid = Number((mid - spreadW / 2).toFixed(2));
  const ask = Number((mid + spreadW / 2).toFixed(2));

  const isMid = h('mid') > 0.82;
  const side: FlowPrint['side'] = isMid ? 'MID' : order.side;
  const flowScore = isMid
    ? Math.round((h('fs') - 0.5) * 24)
    : Math.round((side === 'ASK' ? 1 : -1) * (48 + h('fs') * 52));

  const ratioBidPct = Math.round(side === 'BID' ? 45 + h('rb') * 50 : side === 'ASK' ? 5 + h('rb') * 50 : 35 + h('rb') * 30);
  const ratioLabel = isMid ? 'MID' : ratioBidPct >= 50 ? `BID ${ratioBidPct}%` : `ASK ${100 - ratioBidPct}%`;

  const volume = Math.round(order.size * (4 + h('vol') * 80));
  const oi = Math.max(1, Math.round(volume * (0.4 + h('oi') * 3.2)));
  const deltaOI = h('doi') > 0.35 ? Math.round((h('doi2') - 0.4) * oi * 0.25) : 0;

  const legs = h('legs') > 0.78 ? 2 + Math.floor(h('legs2') * 3) : 1;
  const strat: StratTag = legs > 1 ? STRATS[Math.floor(h('strat') * STRATS.length)] : h('strat') > 0.9 ? 'Custom' : '—';

  return {
    id,
    time: order.time,
    ticker: order.ticker,
    legs,
    strike,
    right,
    otmPct: Number((money * 100).toFixed(1)),
    expiry,
    dte,
    fill,
    bid,
    ask,
    fillPos: Number(fillPos.toFixed(2)),
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
  const fillPos = side === 'ASK' ? 0.72 + h('pos') * 0.28 : side === 'BID' ? h('pos') * 0.28 : 0.5;
  const mid = side === 'ASK' ? fill - spreadW * fillPos : fill + spreadW * (1 - fillPos);
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
    bid: Number((mid - spreadW / 2).toFixed(2)),
    ask: Number((mid + spreadW / 2).toFixed(2)),
    fillPos: Number(fillPos.toFixed(2)),
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

export function summarizeTape(prints: FlowPrint[]): TapeSummary {
  let bull = 0;
  let bear = 0;
  let callCount = 0;
  let callPremium = 0;
  let putCount = 0;
  let putPremium = 0;
  let sweeps = 0;
  let largest: FlowPrint | null = null;

  for (const p of prints) {
    if (p.right === 'C') {
      callCount++;
      callPremium += p.premium;
    } else {
      putCount++;
      putPremium += p.premium;
    }
    if (p.sweep) sweeps++;
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
    pcRatio: callCount > 0 ? Number((putCount / callCount).toFixed(2)) : 0,
    rvol: Number((0.55 + h01(`rvol-${prints.length}`) * 0.5).toFixed(2)),
    sweeps,
    blocks: prints.length - sweeps,
    largest: largest
      ? { ticker: largest.ticker, strike: largest.strike, right: largest.right, premium: largest.premium }
      : null,
  };
}
