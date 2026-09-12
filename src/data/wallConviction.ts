import { sessionStarts } from './indicators';
import { pickWalls } from '../core/walls';
import type { Candle, GexSnapshot } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - WALL CONVICTION (data/wallConviction.ts)

  A level, or a guess — P-6.
==================================================

  THE PROBLEM. The terminal presents a wall at 5,880 identically whether it
  is a 2.4× dominant shelf that has held the title for a week or a marginal
  winner that flips at the next tick. Those are different objects. Everything
  below turns the same stores every other surface reads into the four facts
  that separate them:

    MARGIN     this shelf's |gamma| over the RUNNER-UP on its own side. The
               single most telling number: 2.4× is a level, 1.05× is a
               coin-toss that will have a different answer in a minute.
    HELD       consecutive completed sessions this strike has carried the
               title, counted backwards from the last completed session. A
               wall that has been the wall for four days is structure.
    TOUCHES    times price reached the strike today — a level nobody visits
               is untested, whatever its gamma says.
    BREAKS     times price CLOSED through it after touching. A wall touched
               three times with no break is holding; one broken twice is a
               level in name only.

  TOUCH AND BREAK ARE DEFINED ONCE, HERE, and the definitions are the fussy
  part. A touch is a bar whose HIGH/LOW range contains the strike — the
  wick counts, because hedging happens where price traded, not where it
  settled. A break is a bar that CLOSES on the far side after a touch, and a
  break re-arms only when price closes back on the original side: a level
  that price oscillates across on ten consecutive bars broke once, not ten
  times, and counting ten would make every choppy afternoon look like a
  collapse.

  PERSISTENCE READS COMPLETED SESSIONS ONLY. The session still printing has
  not held anything yet, and letting it count would let a wall claim a day
  it is three minutes into.

  NULL IS A REAL ANSWER throughout: no history, no persistence; no runner-up
  on that side, no margin. Every consumer renders absence.
*/

export interface WallConviction {
  strike: number;
  side: 'call' | 'put';
  /** |gamma| of this shelf over the runner-up on the same side. Null when
      the side has no second shelf to be measured against. */
  margin: number | null;
  /** Consecutive COMPLETED sessions this strike held the title. Null with
      no session history behind today. */
  heldSessions: number | null;
  touches: number;
  breaks: number;
}

/** A bar's range contains the strike — the wick counts. */
const touched = (b: Candle, strike: number): boolean => b.low <= strike && b.high >= strike;

/**
 * Touches and breaks against one level, over one session's bars.
 *
 * `side` is which way the level is meant to hold FROM: a call wall is
 * resistance (a break is a close above), a put wall support (a close below).
 */
export function touchesAndBreaks(bars: readonly Candle[], strike: number, side: 'call' | 'put'): { touches: number; breaks: number } {
  let touches = 0;
  let breaks = 0;
  let broken = false;
  for (const b of bars) {
    if (touched(b, strike)) touches++;
    const beyond = side === 'call' ? b.close > strike : b.close < strike;
    if (beyond && !broken) {
      /* A break needs the level to have been REACHED — a session that opens
         beyond it never broke anything, it started there. */
      if (touches > 0) breaks++;
      broken = true;
    } else if (!beyond) {
      broken = false; // back on the original side: the next cross is new
    }
  }
  return { touches, breaks };
}

/** The two heaviest shelves on one side, by |value|, nearest-to-spot first. */
function sideRanked(levels: readonly { strike: number; value: number }[], spot: number, side: 'call' | 'put') {
  return levels
    .filter(l => (side === 'call' ? l.strike > spot : l.strike < spot))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/**
 * Conviction for one side's wall.
 *
 * @param snaps  the ticker's GEX snapshot history, oldest first
 * @param bars   the ticker's 1-minute bars, oldest first
 */
export function buildWallConviction(
  snaps: readonly GexSnapshot[],
  bars: readonly Candle[],
  spot: number,
  side: 'call' | 'put'
): WallConviction | null {
  if (snaps.length === 0) return null;
  const now = snaps[snaps.length - 1];
  const ranked = sideRanked(now.levels, spot, side);
  if (ranked.length === 0) return null;
  const strike = ranked[0].strike;
  const margin = ranked.length > 1 && Math.abs(ranked[1].value) > 0 ? Math.abs(ranked[0].value) / Math.abs(ranked[1].value) : null;

  /* Persistence: walk back through COMPLETED sessions asking each one's LAST
     snapshot whether this strike held the title then. Sessions come from the
     bars' own gap cut, so this cannot disagree with any other session
     feature about where a day began. */
  let heldSessions: number | null = null;
  const starts = sessionStarts(bars, 1);
  if (starts.length > 1 && bars.length > 0) {
    heldSessions = 0;
    /* starts[last] opens the session still printing — the one before it is
       the last COMPLETED session's open. */
    for (let s = starts.length - 2; s >= 0; s--) {
      const from = bars[starts[s]].time;
      const to = s + 1 < starts.length ? bars[starts[s + 1]].time : Infinity;
      /* That session's closing snapshot. */
      let close: GexSnapshot | null = null;
      for (const snap of snaps) {
        if (snap.time >= from && snap.time < to) close = snap;
      }
      if (!close) break;
      const thenRanked = sideRanked(close.levels, spot, side);
      if (thenRanked.length === 0 || thenRanked[0].strike !== strike) break;
      heldSessions++;
    }
  }

  /* Today's tape only — a touch count spanning the buffer would be a
     different fact wearing the same word. */
  const today = starts.length > 0 ? bars.slice(starts[starts.length - 1]) : bars;
  const { touches, breaks } = touchesAndBreaks(today, strike, side);

  return { strike, side, margin, heldSessions, touches, breaks };
}

/** The conviction line, in the desk's voice. */
export function convictionWords(c: WallConviction): string {
  const parts: string[] = [];
  parts.push(c.margin === null ? 'no runner-up on this side' : `${c.margin.toFixed(1)}× the runner-up`);
  if (c.heldSessions !== null) parts.push(c.heldSessions === 0 ? 'new today' : `held ${c.heldSessions} session${c.heldSessions === 1 ? '' : 's'}`);
  parts.push(`tested ${c.touches}×`);
  parts.push(`${c.breaks} break${c.breaks === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/**
 * One word for how much the level deserves to be leaned on.
 *
 * The bar is deliberately high for STRONG: the whole point of the score is
 * that a marginal winner should not read like a shelf, so dominance AND an
 * unbroken record are both required.
 */
export function convictionGrade(c: WallConviction): 'STRONG' | 'HOLDING' | 'THIN' {
  const dominant = (c.margin ?? 1) >= 1.8;
  if (dominant && c.breaks === 0) return 'STRONG';
  if (c.breaks === 0 || (c.margin ?? 1) >= 1.3) return 'HOLDING';
  return 'THIN';
}
