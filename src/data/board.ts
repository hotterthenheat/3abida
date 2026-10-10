/*
==================================================
  SLAYER TERMINAL - THE BOARD (data/board.ts)

  Every name the desk covers, one row each — the
  actual bird's-eye view (the Pinpoint roadmap,
  2026-09-05). Each row is the same four reads the
  Map makes for one name, made for all of them: the
  regime and how far the flip is, the nearest wall,
  the supreme, the 0DTE book's net, and how much of
  the book dies at the bell. Nothing is invented
  here: the profile builder, the flip gauge and the
  session tape are the ones every other surface
  reads, pointed at each name in turn.

  Built on the scan tier (the page re-runs it every
  ten seconds) — two profiles and a gauge per name,
  a few milliseconds each.
==================================================
*/

import Simulator from '../core/simulator';
import { buildAgenda } from './agenda';
import { aheadClock, type AheadClock } from './ahead';
import { buildBuilding } from './building';
import type { ExposureSurface } from './exposureSurface';
import { buildFlipGauge } from './flipGauge';
import { agendaOf, bookOf, scanOf } from './pinpointBook';
import { bookSureness, type SureLevel, type Sureness } from './levelSureness';
import { spotChangePct } from './gex';
import { readSessionClock } from './sessionClock';
import { getPositions } from './positions';
import type { WallRole } from './wall';
import type { ExposureProfileData } from '../types/gex';
import type { Candle, MarketSnapshot } from '../types/market';

export interface BoardRow {
  ticker: string;
  spot: number;
  changePct: number;
  regime: 'LONG' | 'SHORT' | null;
  flip: number | null;
  /** Signed distance from spot to the flip, percent (+ = the flip is overhead) */
  flipDistPct: number | null;
  crossings: number | null;
  callWall: number;
  putWall: number;
  /** The wall nearer to spot, and how far it is */
  nearest: { kind: 'call' | 'put'; strike: number; distPct: number };
  supreme: number;
  /** Today's book's net gamma, the whole chain — in the house sign positive amplifies, negative absorbs (exposure.ts) */
  netGex: number;
  /** Share of the window's gamma that expires today, percent */
  bellShare: number | null;
  /** The session's closes, thinned for a sparkline */
  spark: number[];
  /** Your positions on the name: contracts owned or sold (0 = none) */
  yours: { positions: number; contracts: number };
  /** What the walls stand on (data/levelSureness.ts) — the "How sure" door on the nearest wall */
  sure?: Record<SureLevel, Sureness> | null;
  /** The agenda's first strike for this name — what to watch first, and why (2026-09-08) */
  watch: { strike: number; role: WallRole; isShelf: boolean; isWall: boolean; reach: number; hold: number; stake: number } | null;
}

const SPARK_POINTS = 48;

/** Share of the surface's gamma that expires today, percent — null without a today column */
export function bellShareOf(surface: ExposureSurface): number | null {
  const todayIdx = surface.expiries.findIndex(e => e.dte === 0);
  if (todayIdx < 0) return null;
  let dies = 0;
  let total = 0;
  for (let e = 0; e < surface.expiries.length; e++)
    for (let s = 0; s < surface.strikes.length; s++) {
      const v = Math.abs(surface.net.gex[e][s] ?? 0);
      total += v;
      if (e === todayIdx) dies += v;
    }
  return total > 0 ? Math.round((100 * dies) / total) : null;
}

/** The agenda's #1 for a name — what to watch first — off the profile already built (the Board and Compare read it) */
export function watchOf(snapshot: MarketSnapshot, today: ExposureProfileData, surface: ExposureSurface | null, bars: readonly Candle[], clock: AheadClock): BoardRow['watch'] {
  try {
    const t = snapshot.ticker;
    const building = buildBuilding(snapshot, Simulator.getGexHistory(t), Simulator.getCandles(t), today, clock);
    const iv = Simulator.TICKERS[t]?.iv ?? 0.2;
    const lead = buildAgenda(snapshot, today, building, surface, bars, clock, iv).first[0];
    return lead ? { strike: lead.strike, role: lead.role, isShelf: lead.isShelf, isWall: lead.isWall, reach: lead.reach, hold: lead.hold, stake: lead.stake } : null;
  } catch {
    return null;
  }
}

/** Thin a series to at most n points, keeping the ends */
const thin = (xs: number[], n: number): number[] => {
  if (xs.length <= n) return xs;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(xs[Math.round((i * (xs.length - 1)) / (n - 1))]);
  return out;
};

export function buildBoardRow(ticker: string, live?: MarketSnapshot | null): BoardRow | null {
  /* ONE BOOK (data/pinpointBook.ts): the scan every Pinpoint page reads for this name, the same profile, calendar and
     agenda — so a name's call wall and its first strike's odds read the same here as on its own pages */
  const scan = scanOf(ticker, live);
  const snapshot = scan?.snap;
  if (!snapshot || !snapshot.chain || snapshot.chain.length === 0) return null;
  const clock = aheadClock(readSessionClock());
  let book;
  try {
    book = bookOf(snapshot, clock);
  } catch {
    return null;
  }
  const today = book.profile;
  const gauge = buildFlipGauge(snapshot);
  const spot = snapshot.spot;
  const { callWall, putWall, supreme } = today.levels;
  const dCall = ((callWall - spot) / spot) * 100;
  const dPut = ((putWall - spot) / spot) * 100;
  const nearest = Math.abs(dCall) <= Math.abs(dPut) ? { kind: 'call' as const, strike: callWall, distPct: dCall } : { kind: 'put' as const, strike: putWall, distPct: dPut };

  /* The bell's share: today's column against every column of the calendar
     surface — the SAME number the Calendar's read line and the Trader's Clock
     print for this name. */
  const surface = book.surface;
  const bellShare = surface ? bellShareOf(surface) : null;

  const bars = book.bars;
  const mine = getPositions(snapshot.ticker);

  /* WHAT TO WATCH FIRST — the agenda's #1 for this name, off the one book (2026-09-08; the book since 2026-10-09) */
  const lead = agendaOf(book).first[0];
  const watch: BoardRow['watch'] = lead ? { strike: lead.strike, role: lead.role, isShelf: lead.isShelf, isWall: lead.isWall, reach: lead.reach, hold: lead.hold, stake: lead.stake } : null;

  return {
    sure: bookSureness(snapshot.chain, spot, snapshot.ticker),
    watch,
    yours: { positions: mine.length, contracts: mine.reduce((s, p) => s + p.contracts, 0) },
    ticker: snapshot.ticker,
    spot,
    changePct: spotChangePct(snapshot.ticker),
    regime: gauge.regime,
    flip: gauge.flip,
    flipDistPct: gauge.distPct,
    crossings: gauge.crossings,
    callWall,
    putWall,
    nearest,
    supreme,
    netGex: today.netGex,
    bellShare,
    spark: thin(bars.map(b => b.close), SPARK_POINTS),
  };
}

