import { RTH_MINUTES, isTradingDay } from '../core/calendar';
import { sessionStarts } from './indicators';
import { buildEarningsCalendar, type EarningsEvent } from './earnings';
import type { Candle } from '../types/market';
import type { FlowPrint } from '../types/trace';

/*
==================================================
  SLAYER TERMINAL - EVENT MARKERS (data/events.ts)

  The calendar, on the tape — T-11.
==================================================

  A chart with no event context makes the reader hold the calendar in their
  head. This engine turns three sources the terminal already carries into
  marks along the tape's bottom edge:

    EARNINGS   this name's next report, from the earnings engine — BMO at
               that session's open, AMC at its close, with the implied move
               the options are charging riding in the card
    MACRO      FOMC · CPI · NFP, from the schedule below
    PRINTS     the session's largest option prints over a premium floor —
               the tape's own record of when size arrived

  TWO TIME SHAPES, ONE SEAM. An event already on the tape carries a bar
  TIME; one still ahead carries TRADING MINUTES past the last bar — the same
  runway arithmetic the expected-move cone draws with, so the two cannot
  disagree about where "three sessions out" lands. The bridge between the
  real-world calendar and the simulator's tape is SESSIONS: an event n
  trading days away sits n sessions ahead, whatever dates the synthetic tape
  believes in. When the live feed replaces the simulator the same bridge
  degenerates to the identity.

  THE SCHEDULE'S HONESTY, kind by kind. The FOMC table is the Fed's own
  published 2026 calendar (decision days). NFP is a RULE — first Friday of
  the month — applied to the real calendar. CPI is APPROXIMATED at the
  second Wednesday: BLS publishes exact dates and the calendar feed will
  carry them; until then the approximation is named in the card rather than
  dressed as a confirmed date. Dividends, splits and congress/insider
  filings are in the directive and NOT here: the simulator models none of
  them, and a marker invented for a modelled filing would be exactly the
  fake functionality rule 1 exists to keep out. They join when their feeds
  do.
*/

export type MarketEventKind = 'earnings' | 'macro' | 'print';

export interface MarketEvent {
  kind: MarketEventKind;
  /** The card's first line. */
  label: string;
  /** The card's second line — basis, sizes, caveats. */
  detail: string;
  /** Bar-anchored time — events already on the tape. */
  time?: number;
  /** Trading minutes past the last bar — events still ahead. */
  minutesAhead?: number;
  /** Prints only: which right, for the glyph's SHAPE (never its colour). */
  side?: 'C' | 'P';
}

/** Below this premium a print is tape texture, not an event. */
export const PRINT_PREMIUM_FLOOR = 1_000_000;
/** The largest N prints get marks — a busy session over the floor is still
    a readable tape, not a picket fence. */
export const PRINT_CAP = 12;

export interface MacroDate {
  iso: string; // YYYY-MM-DD, real calendar
  label: string;
  detail: string;
}

/* The Fed's published 2026 meeting calendar — decision days. */
const FOMC_2026 = ['2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09'];

const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** First Friday of a month — the NFP rule. */
export function firstFriday(year: number, month0: number): string {
  const d = new Date(year, month0, 1);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  return isoOf(d);
}

/** Second Wednesday — the CPI approximation (see the header). */
export function secondWednesday(year: number, month0: number): string {
  const d = new Date(year, month0, 1);
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7);
  return isoOf(d);
}

/** The macro calendar inside a ± window around `today`, real dates. */
export function macroWindow(today: Date, daysBack = 45, daysAhead = 45): MacroDate[] {
  const lo = new Date(today);
  lo.setDate(lo.getDate() - daysBack);
  const hi = new Date(today);
  hi.setDate(hi.getDate() + daysAhead);
  const inWindow = (iso: string) => iso >= isoOf(lo) && iso <= isoOf(hi);

  const out: MacroDate[] = [];
  for (const iso of FOMC_2026) {
    if (inWindow(iso)) out.push({ iso, label: 'FOMC decision', detail: `${iso} · rate decision & presser` });
  }
  for (let m = -2; m <= 2; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const nfp = firstFriday(d.getFullYear(), d.getMonth());
    if (inWindow(nfp)) out.push({ iso: nfp, label: 'NFP release', detail: `${nfp} · payrolls, first Friday` });
    const cpi = secondWednesday(d.getFullYear(), d.getMonth());
    if (inWindow(cpi)) out.push({ iso: cpi, label: 'CPI release', detail: `${cpi} · approximated — exact BLS date arrives with the calendar feed` });
  }
  return out.sort((a, b) => (a.iso < b.iso ? -1 : 1));
}

/** Signed trading-day distance from `fromIso` to `toIso` (negative = past). */
export function tradingDaysSigned(fromIso: string, toIso: string): number {
  const parse = (iso: string) => new Date(`${iso}T12:00:00`);
  const a = parse(fromIso < toIso ? fromIso : toIso);
  const b = parse(fromIso < toIso ? toIso : fromIso);
  let n = 0;
  const cur = new Date(a);
  while (cur < b) {
    cur.setDate(cur.getDate() + 1);
    if (isTradingDay(cur)) n++;
  }
  return fromIso <= toIso ? n : -n;
}

export interface TapeEventsInput {
  /** 1-minute base bars, oldest first. */
  bars: readonly Candle[];
  /** The session's option prints, stamped with their bar time. */
  prints: readonly (FlowPrint & { at: number })[];
  /** This name's next report, or null. */
  earnings: EarningsEvent | null;
  macro: readonly MacroDate[];
  /** Real calendar "today", ISO — injected, so the engine reads no clock. */
  todayIso: string;
}

/**
 * Every marker the tape carries, past ones first (by time), future ones after
 * (by minutes ahead).
 */
export function buildTapeEvents(input: TapeEventsInput): MarketEvent[] {
  const { bars, prints, earnings, macro, todayIso } = input;
  if (bars.length === 0) return [];
  const starts = sessionStarts(bars, 1);
  const todayStart = bars[starts[starts.length - 1]].time;
  const last = bars[bars.length - 1];
  /* Through the last bar — a bar covers its interval (the cone's rule). */
  const elapsed = (last.time - todayStart) / 60 + 1;

  /* Minute m of the session k sessions ahead, as trading minutes past the
     last bar. k = 0 is today. */
  const aheadAt = (k: number, m: number): number => (k === 0 ? m - elapsed : RTH_MINUTES - elapsed + (k - 1) * RTH_MINUTES + m);

  const past: MarketEvent[] = [];
  const future: MarketEvent[] = [];
  const place = (e: Omit<MarketEvent, 'time' | 'minutesAhead'>, k: number, m: number) => {
    const ahead = aheadAt(k, m);
    if (ahead > 0) {
      future.push({ ...e, minutesAhead: ahead });
      return;
    }
    /* Already on the tape: k sessions back on the grid (the seeded sessions
       are one calendar day apart), m minutes into that session. Dropped if
       it predates the buffer — a mark with no bar under it points at
       nothing. */
    const t = todayStart + k * 86400 + m * 60;
    if (t >= bars[0].time && t <= last.time) past.push({ ...e, time: t });
  };

  if (earnings) {
    const m = earnings.slot === 'AMC' ? RTH_MINUTES : 0;
    place(
      {
        kind: 'earnings',
        label: `${earnings.ticker} earnings · ${earnings.slot}`,
        detail: `${earnings.confirmed ? 'confirmed' : 'estimated'} · options price ±${earnings.impliedMovePct.toFixed(1)}% vs ±${earnings.histAvgMovePct.toFixed(1)}% typical`,
      },
      earnings.daysOut,
      m
    );
  }

  for (const ev of macro) {
    const k = tradingDaysSigned(todayIso, ev.iso);
    place({ kind: 'macro', label: ev.label, detail: ev.detail }, k, 0);
  }

  const big = prints
    .filter(p => p.premium >= PRINT_PREMIUM_FLOOR && p.at >= bars[0].time && p.at <= last.time)
    .sort((a, b) => b.premium - a.premium)
    .slice(0, PRINT_CAP);
  for (const p of big) {
    past.push({
      kind: 'print',
      side: p.right,
      time: p.at,
      label: `$${(p.premium / 1e6).toFixed(1)}M ${p.right === 'C' ? 'call' : 'put'} print`,
      detail: `${p.size.toLocaleString()}× ${p.strike} ${p.right} · ${p.dte}dte · ${p.side} side`,
    });
  }

  past.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  future.sort((a, b) => (a.minutesAhead ?? 0) - (b.minutesAhead ?? 0));
  return [...past, ...future];
}

/** The chart-side wrapper: same stores every other surface reads. */
export function tapeEventsFor(
  ticker: string,
  bars: readonly Candle[],
  prints: readonly (FlowPrint & { at: number })[],
  now: Date = new Date()
): MarketEvent[] {
  return buildTapeEvents({
    bars,
    prints,
    earnings: buildEarningsCalendar().find(e => e.ticker === ticker.toUpperCase()) ?? null,
    macro: macroWindow(now),
    todayIso: isoOf(now),
  });
}
