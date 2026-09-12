import { YEAR_MINUTES } from './measure';
import type { Candle } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - THE EXPECTED-MOVE CONE (data/expectedMove.ts)

  What the options were charging for today, drawn
  on the tape — T-9.
==================================================

  Every other overlay on the chart desk is derived from the TAPE. This one is
  derived from the BOOK, and it is the single most useful thing the options
  side can hand the chart side: a 0DTE reader sizing a move is always asking
  "is this already the whole move the options priced?", and the only place to
  answer that is on the tape itself, in the tape's own units.

  ONE σ, TWO HALVES — because the directive's sketch describes two different
  cones and both are real objects:

  THE ENVELOPE (the session so far). Anchored at the OPEN: at elapsed trading
  time t the options' 1σ claim was S_open · σ · √t. Price can EXIT it — that
  is the point of drawing it — and each crossing of the ±1σ edge is found and
  handed back, because "the move left the implied band at 11:42" is a fact
  worth marking where it happened.

  THE FORWARD CONE (the session still to come). Re-anchored at NOW: from the
  current bar to the close, spot ± spot · σ · √(remaining). This is the half
  that COLLAPSES on 0DTE — by late afternoon the remaining claim is nearly
  nothing, which is correct behaviour and reads as such because the edges
  converge to a point at the bell rather than the object vanishing.

  TRADING TIME THROUGHOUT, in the measure's own year (252 sessions of
  RTH_MINUTES) — the same denominator T-1's annualization divides by, so the
  cone and the measure cannot disagree about what a year is. The clock
  arrives as MINUTES, passed in by the caller exactly as the charm clock is
  (P-0): the engine never reads a wall clock, so a proof and a replay draw
  the same cone.

  σ IS THE FEED'S QUOTED IV for the name — annualized, the same figure every
  other surface quotes. No term structure is invented for it: when the seam
  carries a real front-expiry ATM vol, it drops into the same argument.
*/

export interface ConePastPoint {
  time: number;
  up1: number;
  dn1: number;
  up2: number;
  dn2: number;
}

export interface ConeForwardPoint {
  /** Trading minutes ahead of the last bar. */
  minutesAhead: number;
  up1: number;
  dn1: number;
  up2: number;
  dn2: number;
}

export interface ConeCrossing {
  time: number;
  /** The ±1σ edge price at the moment it was crossed. */
  edge: number;
  dir: 'up' | 'down';
}

export interface ExpectedMoveCone {
  past: ConePastPoint[];
  forward: ConeForwardPoint[];
  crossings: ConeCrossing[];
  openPrice: number;
  openTime: number | null;
}

const EMPTY: ExpectedMoveCone = { past: [], forward: [], crossings: [], openPrice: 0, openTime: null };

/**
 * The cone, from the session's bars and the book's σ.
 *
 * @param sessionBars   today's 1-minute bars, oldest first — the caller cuts
 *                      the session (sessionStarts) so this cannot disagree
 *                      with the session-levels overlay about where today began
 * @param iv            annualized ATM vol, as the feed quotes it (0.2 = 20%)
 * @param minutesToClose remaining trading minutes — 0 after the bell, and 0
 *                      is honest: the forward half collapses to nothing
 *                      because nothing remains implied
 */
export function buildExpectedMoveCone(
  sessionBars: readonly Candle[],
  iv: number,
  minutesToClose: number,
  barMinutes = 1
): ExpectedMoveCone {
  if (sessionBars.length === 0 || !(iv > 0)) return EMPTY;
  const openPrice = sessionBars[0].open;
  const openTime = sessionBars[0].time;
  if (!(openPrice > 0)) return EMPTY;

  /* ── the envelope, per bar since the open ─────────────────────────────── */
  const past: ConePastPoint[] = [];
  const crossings: ConeCrossing[] = [];
  let prevSide: -1 | 0 | 1 = 0;
  for (let i = 0; i < sessionBars.length; i++) {
    const b = sessionBars[i];
    const elapsedMin = ((b.time - openTime) / 60);
    const w1 = openPrice * iv * Math.sqrt(Math.max(0, elapsedMin) / YEAR_MINUTES);
    const p: ConePastPoint = {
      time: b.time,
      up1: openPrice + w1,
      dn1: openPrice - w1,
      up2: openPrice + 2 * w1,
      dn2: openPrice - 2 * w1,
    };
    past.push(p);

    /* Inside/outside the 1σ band, by CLOSE. The first bar ALWAYS counts as
       inside — its band has zero width, so any close off the open would read
       "outside" there, and arming the tracker on that degenerate read would
       swallow the session's real exit (a gap-open day would never mark).
       A crossing is a TRANSITION, and the open cannot be one. Re-entries
       re-arm the edge, so a day that leaves, returns and leaves again marks
       each exit. */
    const side: -1 | 0 | 1 = b.close > p.up1 ? 1 : b.close < p.dn1 ? -1 : 0;
    if (side !== 0 && prevSide === 0 && i > 0) {
      crossings.push({ time: b.time, edge: side === 1 ? p.up1 : p.dn1, dir: side === 1 ? 'up' : 'down' });
    }
    prevSide = i === 0 ? 0 : side;
  }

  /* ── the forward cone, from now to the bell ───────────────────────────── */
  const spot = sessionBars[sessionBars.length - 1].close;
  const forward: ConeForwardPoint[] = [];
  const step = Math.max(1, barMinutes);
  const total = Math.max(0, minutesToClose);
  /* Every bar-step plus the exact close, so the tip lands ON the bell rather
     than one stride short of it. */
  for (let m = 0; m <= total; m += step) {
    const w1 = spot * iv * Math.sqrt(m / YEAR_MINUTES);
    forward.push({ minutesAhead: m, up1: spot + w1, dn1: spot - w1, up2: spot + 2 * w1, dn2: spot - 2 * w1 });
  }
  if (total > 0 && (total % step !== 0 || forward.length === 1)) {
    const w1 = spot * iv * Math.sqrt(total / YEAR_MINUTES);
    forward.push({ minutesAhead: total, up1: spot + w1, dn1: spot - w1, up2: spot + 2 * w1, dn2: spot - 2 * w1 });
  }

  return { past, forward, crossings, openPrice, openTime };
}
