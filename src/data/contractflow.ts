/*
==================================================
  SLAYER TERMINAL - CONTRACT FLOW (contractflow.ts)
  Everything behind one print, across whatever
  window the user asks for.

    • the CONTRACT's own prints — time x price, sized
      by contracts, tagged by who paid
    • the UNDERLYING's cumulative net call vs put
      premium, with its price over the top
    • the raw order list, and the volume / open-
      interest history per session

  The window is a parameter: range (1D / 5D / 1M),
  bar interval, and how many sessions back — so the
  same builder answers "what happened today" and
  "what has this contract been doing all month".

  Deterministic per contract + session. On the live
  session the final print is PINNED to the real one
  the user clicked, so the series always ends where
  the tape says it does.
==================================================
*/

import { dayKey, h01, hGauss, hRange } from '../core/rng';
import { now } from '../core/clock';
import { isTradingDay } from '../core/calendar';

export type FlowSide = 'BID' | 'MID' | 'ASK';
/*
  THE RANGE LADDER IS COUNTED IN SESSIONS (Noah, 2026-08-30: "shoudnt this
  section come with more timeframes on the larger scale like 2D 3D 7D").

  2D and 3D earn their place here in a way they never would on a stock chart:
  an option is a short-lived instrument, and a weekly contract's ENTIRE life is
  about five sessions — so the step from yesterday to the day before is a large
  fraction of everything that ever happened to it.

  There is deliberately NO 7D. A trading week is five sessions, so a "7D" chip
  would render exactly what "5D" already renders and the reader would be left
  wondering which one lied. 10D — a fortnight — is the honest next rung up.
*/
export type FlowRange = '1D' | '2D' | '3D' | '5D' | '10D' | '1M';

/** What the drilldown needs to know about the print it was opened from. */
export interface ContractRef {
  ticker: string;
  strike: number;
  right: 'C' | 'P';
  fill: number;
  spot: number;
  size: number;
  side: FlowSide;
  volume: number;
  oi: number;
  iv: number;
  /** Minutes since the open, 0–390 — where this print landed in the session */
  atMinute: number;
}

export interface FlowOptions {
  range: FlowRange;
  /** Bar interval in minutes — how coarsely prints are bucketed */
  intervalMin: number;
  /** Sessions back from today; 0 = the live session */
  dayOffset: number;
  /** Drop multi-leg prints, leaving only outright single-leg risk */
  singleLegOnly: boolean;
}

/* THE WINDOW A CONTRACT OPENS ON (Noah, 2026-08-30: "the default tape
   timeframe whenever a user clicks the strike should be set to 2D and the 1m
   timeframe"). Two sessions at minute resolution: yesterday for context, today
   in full detail — and for a short-dated contract that is a large share of its
   whole life. ~56-120 prints, so the finest bars still render as a tape rather
   than a smear. */
export const DEFAULT_FLOW_OPTIONS: FlowOptions = {
  range: '2D',
  intervalMin: 1,
  dayOffset: 0,
  singleLegOnly: false,
};

export interface ContractPrintPoint {
  /** Minutes from the start of the window */
  min: number;
  price: number;
  size: number;
  side: FlowSide;
  premium: number;
  /** Implied vol at the print, % */
  iv: number;
  /** Volume in this bar vs the window's average — 1.0 = typical */
  relVol: number;
  multiLeg: boolean;
  /** Session index within the window (0 = earliest) */
  session: number;
}

export interface NetPremiumPoint {
  min: number;
  /** Cumulative net CALL premium, >= 0 side */
  netCall: number;
  /** Cumulative net PUT premium, <= 0 side */
  netPut: number;
  price: number;
}

export interface VolOiDay {
  date: string;
  vol: number;
  oi: number;
  oiChangePct: number;
  close: number;
  avg: number;
  /** Share of the day's volume that hit the bid, 0–100 */
  bidPct: number;
  iv: number;
  sweepPct: number;
  multiPct: number;
  totalPrem: number;
  /** Share of the window's total premium, % */
  shareOfTotalPct: number;
  /** Intraday volume shape — the sparkline */
  intraday: number[];
}

export interface FlowOrder {
  id: string;
  time: string;
  session: number;
  price: number;
  size: number;
  side: FlowSide;
  premium: number;
  sweep: boolean;
  multiLeg: boolean;
  iv: number;
}

/** One bucket of the UNDERLYING's option activity — calls vs puts. */
export interface UnderlyingBar {
  min: number;
  callVol: number;
  /** Negative so puts stack below the axis */
  putVol: number;
  callPrem: number;
  putPrem: number;
  price: number;
}

/** Where the day's activity sat on the chain. */
export interface StrikeBucket {
  strike: number;
  callVol: number;
  putVol: number;
  callPrem: number;
  putPrem: number;
  /** True for the strike this drilldown was opened on */
  isFocus: boolean;
}

export interface ContractFlow {
  points: ContractPrintPoint[];
  avg: { min: number; price: number; iv: number; relVol: number }[];
  orders: FlowOrder[];
  volMax: number;
  /** Minutes spanned by the window */
  windowMin: number;
  sessions: number;
  /** The contract's own tape, summarised */
  stats: {
    vol: number;
    oi: number;
    avgPrice: number;
    premium: number;
    otmPct: number;
    volOverOi: number;
    multiPct: number;
    bidCount: number;
    midCount: number;
    askCount: number;
    /** 0–100 share of contracts that lifted the offer */
    askSharePct: number;
  };
  net: {
    series: NetPremiumPoint[];
    callBought: number;
    callSold: number;
    putBought: number;
    putSold: number;
    netPrem: number;
    netCallPrem: number;
    netPutPrem: number;
    underlyingVol: number;
    underlyingPrem: number;
    premAbs: number;
    /** 0–100 share of premium leaning bullish */
    bullishPct: number;
  };
  /** The underlying's whole option tape, bucketed — calls vs puts */
  underlying: {
    bars: UnderlyingBar[];
    callVol: number;
    putVol: number;
    callPrem: number;
    putPrem: number;
    /** 0–100 share of contracts that were puts */
    putSharePct: number;
    /** 0–100 share of premium that was puts */
    putPremSharePct: number;
  };
  /** Activity by strike across the chain */
  strikes: StrikeBucket[];
  history: VolOiDay[];
}

export const SESSION_MIN = 390; // 09:30 -> 16:00
const SESSIONS_FOR: Record<FlowRange, number> = { '1D': 1, '2D': 2, '3D': 3, '5D': 5, '10D': 10, '1M': 21 };

/**
 * Step `n` TRADING sessions back from a date.
 *
 * Everything in this file counts sessions, but the dates were being walked back
 * in calendar days — so a five-session window labelled two of its columns with a
 * Saturday and a Sunday, and the month window claimed three weeks of history it
 * had not drawn. Harmless-looking until the ladder grew; now that windows can be
 * two, three or ten sessions long, it is the difference between a readable axis
 * and a wrong one.
 */
export function sessionsBefore(end: Date, n: number): Date {
  const d = new Date(end.getTime());
  let left = n;
  // Bounded: holidays cluster, but never for 20 days running.
  for (let guard = 0; left > 0 && guard < n + 20; guard++) {
    d.setDate(d.getDate() - 1);
    if (isTradingDay(d)) left--;
  }
  return d;
}

/** Minutes-since-open -> "HH:MM" wall clock (within one session). */
export function flowClock(min: number): string {
  const inSession = ((min % SESSION_MIN) + SESSION_MIN) % SESSION_MIN;
  const total = 9 * 60 + 30 + Math.round(inSession);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Axis label for a window position — clock intraday, date across sessions. */
export function flowAxisLabel(min: number, sessions: number, endDate: Date): string {
  if (sessions <= 1) return flowClock(min);
  const sessionIdx = Math.floor(min / SESSION_MIN);
  const back = sessions - 1 - sessionIdx;
  const d = sessionsBefore(endDate, back);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * The session a window position falls in, as a date.
 *
 * Two fixes over the one-liner this replaces. It reads the ENGINE clock rather
 * than `Date.now()` — a bare wall-clock read in derived data is a replay bug by
 * this codebase's own rule. And it lands on a SESSION: today happened to be a
 * Sunday while this was being built, which anchored the whole window on a day
 * the market was shut and labelled the newest column 8/30. `dayOffset` still
 * means calendar days back, because the date picker that feeds it hands over a
 * calendar date; only the landing is snapped.
 */
export function sessionDate(dayOffset: number): Date {
  const d = new Date(now().getTime() - dayOffset * 86400000);
  return isTradingDay(d) ? d : sessionsBefore(d, 1);
}

const sideFor = (n: number): FlowSide => (n > 0.62 ? 'ASK' : n < 0.3 ? 'BID' : 'MID');
const pad = (n: number) => String(n).padStart(2, '0');

export function buildContractFlow(c: ContractRef, opts: FlowOptions = DEFAULT_FLOW_OPTIONS): ContractFlow {
  const sessions = SESSIONS_FOR[opts.range];
  const windowMin = sessions * SESSION_MIN;
  const live = opts.dayOffset === 0;
  const day = dayKey();
  const key = `${c.ticker}-${c.strike}${c.right}-${day}-o${opts.dayOffset}-${opts.range}-cf`;
  const s = (tag: string) => `${key}-${tag}`;
  const endDate = sessionDate(opts.dayOffset);

  // ---- the contract's own prints -------------------------------------------------
  // Denser windows get more prints, and a finer interval resolves more of them.
  const perSession = 14 + Math.floor(h01(s('n')) * 16);
  const intervalScale = Math.max(0.45, Math.min(2, 5 / Math.max(opts.intervalMin, 1)));
  const count = Math.max(6, Math.round(perSession * sessions * intervalScale));

  const points: ContractPrintPoint[] = [];
  const orders: FlowOrder[] = [];
  let price = Math.max(0.02, c.fill * (0.72 + h01(s('open')) * 0.4));
  const drift = (c.fill - price) / Math.max(count - 1, 1);

  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? i / (count - 1) : 1;
    const rawMin = frac * (live && sessions === 1 ? Math.min(c.atMinute || SESSION_MIN, SESSION_MIN) : windowMin);
    // Snap onto the chosen bar interval so the interval control actually reads
    const min = Math.round(rawMin / opts.intervalMin) * opts.intervalMin;
    price = Math.max(0.02, price + drift + hGauss(s(`p${i}`)) * c.fill * 0.06);
    const size = Math.max(1, Math.round(hRange(s(`z${i}`), 1, Math.max(2, c.size * 0.9))));
    const side = sideFor(h01(s(`s${i}`)));
    const multiLeg = h01(s(`m${i}`)) > 0.72;
    const iv = Math.max(1, c.iv * (0.88 + h01(s(`iv${i}`)) * 0.26));
    const relVol = Number(hRange(s(`rv${i}`), 0.25, 2.6).toFixed(2));
    const session = Math.min(sessions - 1, Math.floor(min / SESSION_MIN));

    if (opts.singleLegOnly && multiLeg) continue;

    points.push({
      min,
      price: Number(price.toFixed(2)),
      size,
      side,
      premium: price * size * 100,
      iv: Number(iv.toFixed(1)),
      relVol,
      multiLeg,
      session,
    });
    orders.push({
      id: `${i}`,
      time: flowClock(min),
      session,
      price: Number(price.toFixed(2)),
      size,
      side,
      premium: price * size * 100,
      sweep: h01(s(`sw${i}`)) > 0.78,
      multiLeg,
      iv: Number(iv.toFixed(1)),
    });
  }

  // On the LIVE session the series must end on the print the user clicked, so
  // the chart can never contradict the row above it.
  if (live && points.length && !(opts.singleLegOnly && false)) {
    const lastMin = sessions === 1 ? Math.min(c.atMinute || SESSION_MIN, SESSION_MIN) : windowMin;
    points[points.length - 1] = {
      ...points[points.length - 1],
      min: lastMin,
      price: Number(c.fill.toFixed(2)),
      size: c.size,
      side: c.side,
      premium: c.fill * c.size * 100,
      session: sessions - 1,
    };
    if (orders.length) {
      orders[orders.length - 1] = {
        ...orders[orders.length - 1],
        time: flowClock(lastMin),
        price: Number(c.fill.toFixed(2)),
        size: c.size,
        side: c.side,
        premium: c.fill * c.size * 100,
      };
    }
  }

  // Running average paid, plus the IV and relative-volume tracks the chart can overlay
  const avg: { min: number; price: number; iv: number; relVol: number }[] = [];
  let cum = 0;
  let cumSize = 0;
  points.forEach((pt, i) => {
    cum += pt.price * pt.size;
    cumSize += pt.size;
    const windowPts = points.slice(Math.max(0, i - 4), i + 1);
    avg.push({
      min: pt.min,
      price: Number((cum / Math.max(cumSize, 1)).toFixed(2)),
      iv: pt.iv,
      relVol: Number((windowPts.reduce((a, p) => a + p.relVol, 0) / windowPts.length).toFixed(2)),
    });
  });

  const volMax = Math.max(...points.map(p => p.size), 1);
  const totalContracts = points.reduce((a, p) => a + p.size, 0);
  const bidCount = points.filter(p => p.side === 'BID').reduce((a, p) => a + p.size, 0);
  const midCount = points.filter(p => p.side === 'MID').reduce((a, p) => a + p.size, 0);
  const askCount = points.filter(p => p.side === 'ASK').reduce((a, p) => a + p.size, 0);
  const multiContracts = points.filter(p => p.multiLeg).reduce((a, p) => a + p.size, 0);
  const premiumTotal = points.reduce((a, p) => a + p.premium, 0);

  const stats = {
    vol: totalContracts,
    oi: c.oi,
    avgPrice: Number((cum / Math.max(cumSize, 1)).toFixed(2)),
    premium: premiumTotal,
    otmPct: Number((((c.right === 'C' ? c.strike - c.spot : c.spot - c.strike) / c.spot) * 100).toFixed(1)),
    volOverOi: Number((totalContracts / Math.max(c.oi, 1)).toFixed(2)),
    multiPct: Math.round((multiContracts / Math.max(totalContracts, 1)) * 100),
    bidCount,
    midCount,
    askCount,
    askSharePct: Math.round((askCount / Math.max(bidCount + midCount + askCount, 1)) * 100),
  };

  // ---- the underlying's cumulative net premium ------------------------------------
  const series: NetPremiumPoint[] = [];
  let callBought = 0;
  let callSold = 0;
  let putBought = 0;
  let putSold = 0;
  let under = c.spot * (0.994 + h01(s('u0')) * 0.012);
  const scale = Math.max(c.spot * 4_000, 250_000);
  const step = Math.max(opts.intervalMin, Math.round(windowMin / 130));
  const tilt = hGauss(s('tilt')) * 0.5;

  for (let m = 0; m <= windowMin; m += step) {
    under = under * (1 + hGauss(s(`u${m}`)) * 0.0016);
    callBought += hRange(s(`cb${m}`), 0, 1) * scale * (1 + tilt);
    callSold += hRange(s(`cs${m}`), 0, 1) * scale;
    putBought += hRange(s(`pb${m}`), 0, 1) * scale * (1 - tilt);
    putSold += hRange(s(`ps${m}`), 0, 1) * scale;
    series.push({
      min: m,
      netCall: callBought - callSold,
      netPut: -(putBought - putSold),
      price: Number(under.toFixed(2)),
    });
  }

  const netCallPrem = callBought - callSold;
  const netPutPrem = putBought - putSold;
  const netPrem = netCallPrem - netPutPrem;
  const premAbs = Math.max(...series.map(n => Math.max(Math.abs(n.netCall), Math.abs(n.netPut))), 1);
  const bullTotal = Math.abs(netCallPrem);
  const bearTotal = Math.abs(netPutPrem);
  const bullishPct = Math.round((bullTotal / Math.max(bullTotal + bearTotal, 1)) * 100);

  // ---- the underlying's whole option tape, bucketed --------------------------------
  // Same window, but every contract on the name rather than just this one: how
  // much of the tape was calls, how much puts, and what price did while it printed.
  const bars: UnderlyingBar[] = [];
  let uCallVol = 0;
  let uPutVol = 0;
  let uCallPrem = 0;
  let uPutPrem = 0;
  const barStep = Math.max(opts.intervalMin, Math.round(windowMin / 78));
  let barPrice = c.spot * (0.995 + h01(s('b0')) * 0.01);
  const putBias = 0.5 + hGauss(s('putbias')) * 0.16;

  for (let m = 0; m <= windowMin; m += barStep) {
    barPrice = barPrice * (1 + hGauss(s(`bp${m}`)) * 0.0016);
    const total = hRange(s(`bv${m}`), 400, 17_000);
    const putShare = Math.min(0.85, Math.max(0.15, putBias + hGauss(s(`bs${m}`)) * 0.18));
    const putVol = Math.round(total * putShare);
    const callVol = Math.round(total * (1 - putShare));
    const callPrem = callVol * barPrice * 0.011;
    const putPrem = putVol * barPrice * 0.011;
    uCallVol += callVol;
    uPutVol += putVol;
    uCallPrem += callPrem;
    uPutPrem += putPrem;
    bars.push({ min: m, callVol, putVol: -putVol, callPrem, putPrem: -putPrem, price: Number(barPrice.toFixed(2)) });
  }

  // ---- activity by strike ----------------------------------------------------------
  // Where on the chain the money actually went, with this contract's strike flagged.
  const strikes: StrikeBucket[] = [];
  const gridStep = Math.max(c.spot * 0.005, 0.5);
  const rounded = Math.round(c.spot / gridStep) * gridStep;
  for (let i = -10; i <= 10; i++) {
    const strike = Number((rounded + i * gridStep).toFixed(2));
    // Activity clusters at the money and thins into the wings
    const distance = Math.abs(strike - c.spot) / c.spot;
    const decay = Math.exp(-distance * 42);
    const cVol = Math.round(hRange(s(`kc${i}`), 200, 9_000) * decay + 40);
    const pVol = Math.round(hRange(s(`kp${i}`), 200, 9_000) * decay + 40);
    strikes.push({
      strike,
      callVol: cVol,
      putVol: -pVol,
      callPrem: cVol * c.spot * 0.011,
      putPrem: -pVol * c.spot * 0.011,
      isFocus: Math.abs(strike - c.strike) < gridStep / 2,
    });
  }

  // ---- volume / open-interest history ---------------------------------------------
  const history: VolOiDay[] = [];
  const histDays = Math.max(6, sessions);
  let oi = c.oi;
  const rows: Omit<VolOiDay, 'shareOfTotalPct'>[] = [];
  for (let d = 0; d < histDays; d++) {
    // Sessions, not calendar days — this table used to list Saturdays.
    const when = sessionsBefore(endDate, d);
    const prevOi = d === 0 ? c.oi : oi;
    const vol = d === 0 && live ? c.volume : Math.round(hRange(s(`hv${d}`), 2, Math.max(4, c.volume * 1.4)));
    const nextOi = Math.max(1, Math.round(prevOi * (1 + hGauss(s(`ho${d}`)) * 0.12)));
    const close = Number((c.fill * (0.7 + h01(s(`hc${d}`)) * 0.7)).toFixed(2));
    rows.push({
      date: `${pad(when.getMonth() + 1)}/${pad(when.getDate())}`,
      vol,
      oi: prevOi,
      oiChangePct: Number((((prevOi - nextOi) / Math.max(nextOi, 1)) * 100).toFixed(1)),
      close,
      avg: Number((close * (0.94 + h01(s(`ha${d}`)) * 0.12)).toFixed(2)),
      bidPct: Math.round(hRange(s(`hb${d}`), 0, 100)),
      iv: Number((c.iv * (0.9 + h01(s(`hi${d}`)) * 0.2)).toFixed(1)),
      sweepPct: Math.round(hRange(s(`hs${d}`), 0, 100)),
      multiPct: Math.round(hRange(s(`hm${d}`), 0, 100)),
      totalPrem: Math.round(vol * close * 100),
      intraday: Array.from({ length: 13 }, (_, k) => hRange(s(`hd${d}-${k}`), 0.05, 1)),
    });
    oi = nextOi;
  }
  const premSum = rows.reduce((a, r) => a + r.totalPrem, 0) || 1;
  rows.forEach(r => history.push({ ...r, shareOfTotalPct: Number(((r.totalPrem / premSum) * 100).toFixed(1)) }));

  return {
    points,
    avg,
    orders: orders.slice().reverse(),
    volMax,
    windowMin,
    sessions,
    stats,
    net: {
      series,
      callBought,
      callSold,
      putBought,
      putSold,
      netPrem,
      netCallPrem,
      netPutPrem,
      underlyingVol: Math.round(hRange(s('uvol'), 120_000, 900_000)),
      underlyingPrem: (callBought + callSold + putBought + putSold) * 1.8,
      premAbs,
      bullishPct,
    },
    underlying: {
      bars,
      callVol: uCallVol,
      putVol: uPutVol,
      callPrem: uCallPrem,
      putPrem: uPutPrem,
      putSharePct: Math.round((uPutVol / Math.max(uCallVol + uPutVol, 1)) * 100),
      putPremSharePct: Math.round((uPutPrem / Math.max(uCallPrem + uPutPrem, 1)) * 100),
    },
    strikes,
    history,
  };
}
