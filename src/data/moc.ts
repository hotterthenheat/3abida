/*
==================================================
  SLAYER TERMINAL - CLOSING AUCTION ENGINE (moc.ts)
  The day's one SCHEDULED forced-flow event. Funds,
  index trackers and rebalancers all have to print at
  the closing cross, and the exchange publishes what
  they can't fill from 3:50pm. This reads that book:
  how lopsided it is, how much the resting depth can
  swallow, how far the cross would drag price, and
  whether the pull is still building or already being
  absorbed.

  Deterministic per ticker + session day, derived from
  the same dark-pool posture and trend the rest of the
  desk reads — swaps for a real auction feed without
  touching the page.

  ONE quiet gate: a close is either worth reading or it
  isn't, and every field agrees with that call. When the
  book is ordinary the direction, the size and the score
  all stand down together — no "nothing to read" sitting
  next to a confident arrow.
==================================================
*/

import { MARKET_HOLIDAYS } from '../core/calendar';
import { dayKey, h01, hGauss, hRange } from '../core/rng';
import { buildDarkPoolView } from './darkpool';
import type { MarketSnapshot } from '../types/market';

/** Internal shape of the auction — never surfaced as an instruction. */
export type MocClass = 'CONTINUATION' | 'ABSORPTION_FADE' | 'DISLOCATION_REVERSAL' | 'NO_TRADE';

/** User-facing state. QUIET is its own thing — an ordinary close is not a warning. */
export type MocState = 'ACTIVE' | 'WATCH' | 'FADING' | 'QUIET';

/** One exchange publication of the imbalance, 3:50 → 3:58. */
export interface MocPublication {
  time: string;
  /** Signed dollars — positive = more to buy */
  imbalanceUsd: number;
}

export interface MocRead {
  ticker: string;
  spot: number;
  /** Signed dollars at the latest publication — positive = more to buy */
  imbalanceUsd: number;
  /** Which way the auction book leans (internal sign vocabulary) */
  side: 'BUY' | 'SELL' | 'BALANCED';
  /** How many times bigger than an ordinary close's leftover — a real multiple */
  unusualness: number;
  /** % of the imbalance the resting book can swallow without moving */
  absorbedPct: number;
  /** How far the cross would drag price from here, % */
  displacementPct: number;
  /** 0–100 — how much of the move the cross makes tends to come back */
  reversalRiskPct: number;
  /** −100…+100 — signed pull into the close; 0 when the close is ordinary */
  score: number;
  classification: MocClass;
  state: MocState;
  /** Plain-English name for what the book is doing */
  headline: string;
  /** The read, in the house voice */
  note: string;
  /** Is the imbalance still growing into the cross? */
  building: boolean;
  /** Five publications; the LAST one always equals imbalanceUsd */
  publications: MocPublication[];
}

const PUBLICATION_TIMES = ['15:50', '15:52', '15:54', '15:56', '15:58'];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const safe = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);

/** Compact dollars — $1.4B / $320M / $18M. Guards junk input. */
export function fmtImbalance(usd: number): string {
  if (!Number.isFinite(usd)) return '—';
  const a = Math.abs(usd);
  if (a >= 1e9) return `$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(a / 1e6).toFixed(0)}M`;
  if (a >= 1e5) return `$${(a / 1e3).toFixed(0)}K`;
  return 'under $100K';
}

/**
 * Read the closing auction for one name.
 *
 * The direction is inherited from the dark-pool posture (institutions building
 * a position all session are the ones who print at the close) with the session
 * trend confirming; the size, depth and growth shape are seeded per ticker+day.
 */
export function buildMocRead(snapshot: MarketSnapshot): MocRead {
  const { ticker, spot, indicators } = snapshot;
  const day = dayKey();
  const s = (tag: string) => `${ticker}-${day}-moc-${tag}`;
  const dp = buildDarkPoolView(snapshot);

  // ---- direction --------------------------------------------------------------
  // Off-exchange posture leads (that's the institution), the trend confirms.
  // The posture is QUANTIZED so the read doesn't drift with every price tick —
  // the auction book is a scan-tier fact, not a per-tick one.
  const postureQuantized = Math.round(safe(dp.netPosturePct) / 5) * 5;
  const postureLean = clamp(postureQuantized / 100, -1, 1);
  const trendLean = indicators.ema9 >= indicators.ema21 ? 1 : -1;
  const bias = clamp(safe(postureLean) * 0.62 + trendLean * 0.24 + hGauss(s('bias')) * 0.34, -1, 1);

  // ---- size -------------------------------------------------------------------
  // Scale off the session's off-exchange notional so a mega-cap's auction dwarfs
  // a mid-cap's. `typical` is what an ORDINARY close leaves over for this name —
  // it's the yardstick the "vs a typical close" figure is measured against, so
  // that figure is a real multiple rather than a re-skinned random number.
  const scale = Math.max(safe(dp.totalNotional) * 0.06, 4e7);
  const typical = scale * 0.6;
  const rawImbalance = bias * scale * hRange(s('size'), 0.55, 1.9);

  // ---- one quiet gate ----------------------------------------------------------
  // A close is worth reading when it leans AND it is bigger than this name's
  // ordinary leftover. Both tests come off the same numbers, so the verdict can
  // never contradict the size or the arrow the panel draws.
  // Compared on the ROUNDED value the panel actually prints, so the figure and
  // the verdict can never disagree: anything showing "1.0×" reads as ordinary,
  // and the first close called interesting shows "1.1×".
  const unusualness = Number((Math.abs(rawImbalance) / typical).toFixed(1));
  const leaning = Math.abs(bias) >= 0.12;
  const ordinary = !leaning || unusualness <= 1.0;

  // ---- depth vs pressure -------------------------------------------------------
  // Deeper books eat more of the imbalance; a lopsided book eats less of it.
  const depth = clamp(hRange(s('depth'), 0.3, 0.86) - Math.abs(bias) * 0.22, 0.08, 0.92);
  const absorbedPct = Math.round(depth * 100);
  // Whatever the book can't swallow has to move price to find the other side.
  const unabsorbed = 1 - depth;
  const displacementPct = Number((unabsorbed * Math.abs(bias) * hRange(s('disp'), 0.35, 1.5)).toFixed(2));

  // ---- growth shape ------------------------------------------------------------
  // The 3:50 headline is NOT the number that clears — it either builds into the
  // cross (real demand arriving late) or bleeds away (it was being worked all
  // along). Shapes are normalised so the LAST publication is the headline number,
  // and the jitter stays far smaller than the step-to-step move so the direction
  // of travel is always legible in the bars.
  const building = h01(s('grow')) > 0.42;
  const shape = PUBLICATION_TIMES.map((_, i) => {
    const frac = (i + 1) / PUBLICATION_TIMES.length;
    return building ? Math.pow(frac, 1.5) : 1.9 - frac * 0.9;
  });
  const anchor = shape[shape.length - 1] || 1;
  const publications: MocPublication[] = PUBLICATION_TIMES.map((time, i) => {
    const jitter = 0.97 + h01(s(`pub-${i}`)) * 0.06; // ±3%, well under the step delta
    const isLast = i === PUBLICATION_TIMES.length - 1;
    return {
      time,
      // The last bar IS the headline number — no jitter on the one we quote.
      imbalanceUsd: isLast ? rawImbalance : (rawImbalance * shape[i] * jitter) / anchor,
    };
  });

  // ---- reversal risk -----------------------------------------------------------
  // A heavily-absorbed imbalance snaps back; a fading one had no conviction; a
  // big mechanical displacement with no flow behind it round-trips overnight.
  const reversalRiskPct = Math.round(
    clamp(depth * 58 + (building ? 0 : 22) + displacementPct * 12 + hRange(s('rev'), -6, 8), 4, 96)
  );

  // ---- classification ----------------------------------------------------------
  const classification: MocClass = ordinary
    ? 'NO_TRADE'
    : absorbedPct >= 66
      ? 'ABSORPTION_FADE'
      : displacementPct >= 0.4 && reversalRiskPct >= 55
        ? 'DISLOCATION_REVERSAL'
        : 'CONTINUATION';

  // When the close is ordinary EVERYTHING stands down together: no side, no
  // score, no arrow. That is the whole point of the single gate.
  const side: MocRead['side'] = ordinary ? 'BALANCED' : bias > 0 ? 'BUY' : 'SELL';
  const imbalanceUsd = rawImbalance;

  // ---- score -------------------------------------------------------------------
  // Signed pull into the close: direction × how much of it actually has to move
  // price, discounted by the odds it unwinds. Tuned so an ordinary lopsided close
  // lands in the 20–60 band and only a genuinely extreme book approaches ±100 —
  // a gauge that pins constantly reports nothing.
  const conviction = Math.abs(bias) * unabsorbed * (building ? 1.15 : 0.62);
  const score = ordinary
    ? 0
    : Math.round(clamp(Math.sign(bias) * conviction * 105 * (1 - reversalRiskPct / 220), -100, 100));

  const state: MocState =
    classification === 'NO_TRADE'
      ? 'QUIET'
      : classification === 'CONTINUATION'
        ? 'ACTIVE'
        : classification === 'ABSORPTION_FADE'
          ? 'FADING'
          : 'WATCH';

  const dirWord = side === 'BUY' ? 'Buyers' : 'Sellers';
  const headline =
    classification === 'CONTINUATION'
      ? `${dirWord} lead into the close`
      : classification === 'ABSORPTION_FADE'
        ? 'The book is swallowing it'
        : classification === 'DISLOCATION_REVERSAL'
          ? 'Mechanical — likely to snap back'
          : 'An ordinary close';

  const sizeStr = fmtImbalance(imbalanceUsd);
  const buyOrSell = side === 'BUY' ? 'to buy' : 'to sell';
  const note =
    classification === 'NO_TRADE'
      ? `At ${sizeStr} left over this close is about ${unusualness.toFixed(1)}× an ordinary one for ${ticker} — too close to routine to read anything into.`
      : classification === 'ABSORPTION_FADE'
        ? `${sizeStr} more ${buyOrSell} at the cross, but resting orders can take ${absorbedPct}% of it — the pressure gets eaten rather than paid for, and ${building ? 'even the late growth is not enough to clear the book' : 'the imbalance is already bleeding away'}.`
        : classification === 'DISLOCATION_REVERSAL'
          ? `${sizeStr} more ${buyOrSell} would drag price about ${displacementPct.toFixed(2)}%, but this is a rebalance printing on a schedule, not conviction — about ${reversalRiskPct}% of that move typically comes back.`
          : `${sizeStr} more ${buyOrSell} at the close and the book can only take ${absorbedPct}% of it — the rest has to move price, about ${displacementPct.toFixed(2)}% from here${building ? ', and the imbalance is still growing with each publication' : ''}.`;

  return {
    ticker,
    spot,
    imbalanceUsd,
    side,
    unusualness,
    absorbedPct,
    displacementPct,
    reversalRiskPct,
    score,
    classification,
    state,
    headline,
    note,
    building,
    publications,
  };
}

// ---- the session clock ----------------------------------------------------------

export type SessionPhase = 'PREMARKET' | 'OPEN' | 'AUCTION' | 'AFTERHOURS' | 'CLOSED';

/** Whether the auction book is actually publishing right now. */
export type AuctionStatus = 'PUBLISHING' | 'PROJECTED' | 'CLOSED';

export interface SessionClock {
  /** Wall clock in New York, HH:MM:SS */
  etTime: string;
  phase: SessionPhase;
  /** Plain label for the phase */
  label: string;
  /** Seconds until the 16:00 cross — 0 when there is no cross left today */
  secondsToClose: number;
  /** H:MM:SS until the cross, or null when there isn't one coming */
  countdown: string | null;
  /** True from 15:50 — when the book actually starts publishing */
  auctionOpen: boolean;
  auctionStatus: AuctionStatus;
  /** True on weekends and market holidays */
  marketClosedToday: boolean;
}

/*
  US market holidays now live in core/calendar.ts — the weigher needed the same
  list to stop naming Saturday expiries, and two copies of a calendar is how
  they drift. Replace with the exchange calendar when the real feed lands.
*/

// One formatter, reused — this runs once a second.
const NY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  hour12: false,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Where the New York session is right now — timezone-correct for any viewer. */
export function readSessionClock(now: Date = new Date()): SessionClock {
  const parts = Object.fromEntries(NY_FMT.formatToParts(now).map(p => [p.type, p.value]));
  const weekday = String(parts.weekday ?? '');
  // Intl can hand back "24" at midnight
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const isoDay = `${parts.year}-${parts.month}-${parts.day}`;

  const mins = hour * 60 + minute;
  const closeMins = 16 * 60;
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const isHoliday = MARKET_HOLIDAYS.has(isoDay);
  const marketClosedToday = isWeekend || isHoliday;
  const etTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

  let phase: SessionPhase;
  if (marketClosedToday) phase = 'CLOSED';
  else if (mins < 9 * 60 + 30) phase = 'PREMARKET';
  else if (mins >= closeMins) phase = 'AFTERHOURS';
  else if (mins >= 15 * 60 + 50) phase = 'AUCTION';
  else phase = 'OPEN';

  // Only a live session has a cross still ahead of it.
  const tradingNow = phase === 'OPEN' || phase === 'AUCTION';
  const secondsToClose = tradingNow ? Math.max(0, (closeMins - mins) * 60 - second) : 0;
  const hh = Math.floor(secondsToClose / 3600);
  const mm = Math.floor((secondsToClose % 3600) / 60);
  const ss = secondsToClose % 60;

  const label = isHoliday
    ? 'Market closed — holiday'
    : isWeekend
      ? 'Market closed for the weekend'
      : phase === 'PREMARKET'
        ? 'Before the open'
        : phase === 'AFTERHOURS'
          ? weekday === 'Fri'
            ? 'Closed — next session Monday'
            : 'After the close'
          : phase === 'AUCTION'
            ? 'Closing auction — the book is publishing'
            : 'Market open';

  return {
    etTime,
    phase,
    label,
    secondsToClose,
    countdown: tradingNow ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : null,
    auctionOpen: phase === 'AUCTION',
    auctionStatus: phase === 'AUCTION' ? 'PUBLISHING' : phase === 'OPEN' ? 'PROJECTED' : 'CLOSED',
    marketClosedToday,
  };
}
