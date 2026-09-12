/*
==================================================
  SLAYER TERMINAL - LEVEL VIEW (levelview.ts)
  What a focused strike is DOING today (Noah,
  2026-08-22: "what purpose does bringing me to
  the chart serve"). Three facts the ranking can't
  show because it ranks from the latest scan only:
    · how far price is from the level, live
    · whether price has tested it this session
    · whether the gamma there is building or
      bleeding since the open
  Read off the simulator's tape and GEX history —
  no new engine, just the chart's own data spoken.
==================================================
*/

import Simulator from '../core/simulator';

export type GexTrend = 'BUILDING' | 'BLEEDING' | 'FLAT' | 'NEW';

export interface LevelRead {
  /** Signed distance from live spot, percent (+ above) */
  distPct: number;
  /** Times price has tested the level this session — a test is a contiguous
      run of bars whose range contains the strike */
  touches: number;
  /** HH:MM of the last bar that touched it, or null if untested */
  lastTouch: string | null;
  /** |net GEX| at the strike now vs at the session open, percent change */
  changePct: number | null;
  trend: GexTrend;
}

/** Bars closer than this are the same session; a wider gap is overnight. */
const SESSION_GAP_S = 90;
/** Under ±15% since the open the gamma at a level is neither building nor bleeding. */
const TREND_THRESHOLD = 15;

const fmtTime = (t: number) =>
  new Date(t * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Today's session: the trailing run of bars with no overnight gap. */
/** The live session's bars — the last contiguous run on the tape. Exported for
    the Wall Report Card (2026-09-05), which grades every level on the same
    session cut the focus chip's touches use. */
export function sessionBars(ticker: string) {
  const bars = Simulator.peekCandles(ticker);
  if (!bars || bars.length === 0) return null;
  let start = bars.length - 1;
  while (start > 0 && bars[start].time - bars[start - 1].time <= SESSION_GAP_S) start--;
  return bars.slice(start);
}

/**
 * Per strike, net gamma at the session OPEN as a ratio of net gamma NOW
 * (the motion ghost's data, Noah 2026-08-22). A ratio under 1 means the
 * strike has built since the open; over 1, bled; negative, the side flipped.
 * Ratios, not dollars, so a ladder sliced to one expiry can apply the
 * strike's own motion to its own scale. Null until a session has two
 * snapshots to compare.
 */
export function netSinceOpenRatio(ticker: string): Map<number, number> | null {
  const session = sessionBars(ticker);
  if (!session) return null;
  const snaps = Simulator.getGexHistory(ticker) ?? [];
  const first = snaps.find(s => s.time >= session[0].time);
  const last = snaps[snaps.length - 1];
  if (!first || !last || first === last) return null;
  const open = new Map(first.levels.map(l => [l.strike, l.value]));
  const out = new Map<number, number>();
  for (const l of last.levels) {
    const o = open.get(l.strike);
    if (o == null || Math.abs(l.value) < 1e-9) continue;
    out.set(l.strike, o / l.value);
  }
  return out;
}

export function buildLevelRead(ticker: string, strike: number): LevelRead | null {
  const session = sessionBars(ticker);
  if (!session) return null;

  let touches = 0;
  let lastTouch: number | null = null;
  let inTouch = false;
  for (const b of session) {
    const hit = b.low <= strike && strike <= b.high;
    if (hit && !inTouch) touches++;
    if (hit) lastTouch = b.time;
    inTouch = hit;
  }

  const spot = Simulator.TICKERS[ticker]?.currentPrice ?? session[session.length - 1].close;
  const distPct = ((strike - spot) / spot) * 100;

  const snaps = Simulator.getGexHistory(ticker) ?? [];
  const at = (s: { levels: { strike: number; value: number }[] }) => s.levels.find(l => l.strike === strike)?.value ?? null;
  const first = snaps.find(s => s.time >= session[0].time);
  const last = snaps[snaps.length - 1];
  const gexOpen = first ? at(first) : null;
  const gexNow = last ? at(last) : null;

  let changePct: number | null = null;
  let trend: GexTrend = 'NEW';
  if (gexOpen != null && gexNow != null && Math.abs(gexOpen) > 0) {
    changePct = ((Math.abs(gexNow) - Math.abs(gexOpen)) / Math.abs(gexOpen)) * 100;
    trend = changePct >= TREND_THRESHOLD ? 'BUILDING' : changePct <= -TREND_THRESHOLD ? 'BLEEDING' : 'FLAT';
  }

  return { distPct, touches, lastTouch: lastTouch != null ? fmtTime(lastTouch) : null, changePct, trend };
}
