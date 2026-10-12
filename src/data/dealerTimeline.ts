/*
==================================================
  SLAYER TERMINAL - DEALERS THROUGH THE SESSION
  (data/dealerTimeline.ts)

  The ideas report's item 2, its second half
  (2026-10-10): where the dealers' book stood minute
  by minute — the whole book's net GEX and price's
  distance from the flip — read off the same book
  the Map's replay rewinds (data/replay.ts: one
  snapshot a minute bar, the session's own bars).

  THE HOUSE SIGN (data/exposure.ts, the Board's
  PP-3): net GEX positive is put-heavy, where dealer
  hedging amplifies a move; negative is call-heavy,
  where it absorbs one. The flip is core/walls.ts's
  `pickFlip` at each minute's own close — the flip
  as it stood then, never today's laid over the day.

  Nothing here is a forecast: it is the session so
  far (or the last one, whole, outside it).
==================================================
*/

import { pickFlip } from '../core/walls';
import { nyDay, nyMinutes } from '../core/nyTime';
import { replayDay, replayRange } from './replay';
import { bookMarket, type BookMinute } from './bookMarket';
import type { GexSnapshot } from '../types/market';

export interface TimelinePoint {
  /** New York's minute of the day at the session's first bar, counted on from there — 570 is 09:30, and a tape that runs
      past midnight keeps counting (1450 is 00:10), so the line never folds back on itself */
  minute: number;
  /** The bar's close */
  spot: number;
  /** The whole book's net GEX, the house's sign */
  netGex: number;
  /** The flip at that minute — null when the book never changed sign */
  flip: number | null;
  /** Price's distance from the flip, percent of price: positive above it. Null with no flip */
  flipPct: number | null;
}

export interface DealerTimeline {
  ticker: string;
  /** "Oct 9" — the session's day */
  day: string;
  points: TimelinePoint[];
  /** Net GEX at the first and the last minute */
  first: TimelinePoint;
  last: TimelinePoint;
  /** Minutes the book read put-heavy (net GEX above nothing) */
  putHeavyMin: number;
  /** Minutes price stood above the flip, of those with a flip */
  aboveFlipMin: number;
  flipMin: number;
  /** Times price crossed the flip as it stood each minute */
  crossings: number;
}

const memo = new Map<string, DealerTimeline | null>();

/** The session's dealer book, minute by minute — null until the session has two bars and a book kept for them */
export function dealerTimeline(ticker: string): DealerTimeline | null {
  /* THE VENDOR'S MINUTES (2026-10-12): where the market keeps the whole book a minute (UW's /spot-exposures — net gamma
     and the price it was figured at), the line is read off them; the flip each minute is the book by strike as it stood
     then (the history), where it was read — else that minute has no flip */
  const market = bookMarket();
  const minutes = market.bookMinutes(ticker);
  if (minutes) return fromMinutes(ticker, minutes, market.getGexHistory(ticker));
  const range = replayRange(ticker);
  if (!range) return null;
  const key = `${market.src}|${ticker}|${range.bars.length}|${range.bars[range.bars.length - 1].time}`;
  if (memo.has(key)) return memo.get(key) ?? null;

  const points: TimelinePoint[] = [];
  const t0 = range.bars[0].time;
  const m0 = nyMinutes(t0 * 1000);
  for (const bar of range.bars) {
    const snap = range.snaps.get(bar.time);
    if (!snap || snap.levels.length === 0) continue;
    let net = 0;
    for (const l of snap.levels) net += l.value;
    const flip = pickFlip(snap.levels, bar.close, l => l.value);
    points.push({
      minute: m0 + Math.round((bar.time - t0) / 60),
      spot: bar.close,
      netGex: net,
      flip,
      flipPct: flip == null || bar.close === 0 ? null : ((bar.close - flip) / bar.close) * 100,
    });
  }
  const out = summarise(ticker, points, () => replayDay(range));
  if (memo.size > 24) memo.clear();
  memo.set(key, out);
  return out;
}

/** The line off the market's own minutes — the flip from the book by strike kept at or before each minute */
function fromMinutes(ticker: string, minutes: readonly BookMinute[], history: readonly GexSnapshot[]): DealerTimeline | null {
  if (minutes.length < 2) return null;
  const key = `feed|${ticker}|${minutes.length}|${minutes[minutes.length - 1].time}|${history.length}`;
  if (memo.has(key)) return memo.get(key) ?? null;
  const t0 = minutes[0].time;
  const m0 = nyMinutes(t0 * 1000);
  const points: TimelinePoint[] = [];
  let k = -1;
  for (const m of minutes) {
    while (k + 1 < history.length && history[k + 1].time <= m.time) k++;
    /* a book older than the session's start is another day's — no flip from it */
    const snap = k >= 0 && history[k].time >= t0 - 60 ? history[k] : null;
    const flip = snap && snap.levels.length ? pickFlip(snap.levels, m.spot, l => l.value) : null;
    points.push({ minute: m0 + Math.round((m.time - t0) / 60), spot: m.spot, netGex: m.netGex, flip, flipPct: flip == null || m.spot === 0 ? null : ((m.spot - flip) / m.spot) * 100 });
  }
  const out = summarise(ticker, points, () => nyDay(t0 * 1000));
  if (memo.size > 24) memo.clear();
  memo.set(key, out);
  return out;
}

function summarise(ticker: string, points: TimelinePoint[], dayOf: () => string): DealerTimeline | null {
  let out: DealerTimeline | null = null;
  if (points.length >= 2) {
    let putHeavyMin = 0;
    let aboveFlipMin = 0;
    let flipMin = 0;
    let crossings = 0;
    let side = 0;
    for (const p of points) {
      if (p.netGex > 0) putHeavyMin++;
      if (p.flipPct == null) {
        side = 0;
        continue;
      }
      flipMin++;
      if (p.flipPct > 0) aboveFlipMin++;
      const s = Math.sign(p.flipPct);
      if (s !== 0 && side !== 0 && s !== side) crossings++;
      if (s !== 0) side = s;
    }
    out = { ticker, day: dayOf(), points, first: points[0], last: points[points.length - 1], putHeavyMin, aboveFlipMin, flipMin, crossings };
  }
  return out;
}
