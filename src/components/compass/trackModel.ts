/*
==================================================
  SLAYER TERMINAL - SETUP TRACK MODEL (trackModel.ts)
  The monitor chart's math (docs/compass-redesign-port.md
  §2.6, ported one-pricer): a contract's premium series
  DERIVED, not stored — every past point is the setup
  repriced on a real 1-minute bar with THE model that
  minted its mid (data/compass estimatePremium), so the
  line can never contradict the number printed beside it.

  Past half: TIME is the variable, spot moves (what
  happened). Forward half: SPOT is held at now, only time
  runs (what standing still costs — theta made visible),
  plus the same clock with spot parked at the stop.

  spotForPremium inverts the pricer: a premium target the
  user cannot watch becomes an underlying level they can.

  Value-only module — no component export.
==================================================
*/

import { estimatePremium, PREMIUM_FLOOR } from '../../data/compass';
import type { Candle } from '../../types/market';
import type { Setup } from '../../types/compass';

export const SESSION_BARS = 390;
const PAST_PTS = 90;
const FWD_PTS = 60;
const MAX_HIST_SESSIONS = 5;
/** Headroom reserved per docked rung at the top of the frame. */
const DOCK_HEADROOM = 0.08;

export interface TrackPoint {
  /** Bars from NOW — negative past, positive forward. */
  bar: number;
  premium: number;
}

export interface TrackLevel {
  key: string;
  label: string;
  premium: number;
  /** % from the reference mid. */
  fromRefPct: number;
  /** Spot the underlying must reach, at today's remaining life, to price
      here. null = unreachable inside the search bracket, honestly. */
  spotNeeded: number | null;
  status: 'HIT' | 'IN PROGRESS' | 'PENDING' | 'STOP' | 'REF';
  /** Above the frame — present, labelled, out of scale. */
  docked: boolean;
}

export interface SetupTrack {
  past: TrackPoint[];
  forward: TrackPoint[];
  /** Premium path with spot parked at the stop; null when it just lies on
      the floor (noise, not information). */
  stopCurve: TrackPoint[] | null;
  levels: TrackLevel[];
  ref: number;
  spotNow: number;
  /** Premium change over the shown history, % of the first shown point. */
  sessionChangePct: number;
  yMax: number;
  xMin: number;
  xMax: number;
  pastMinutes: number;
  forwardMinutes: number;
}

/**
 * The spot that prices this setup at `target`, at `sessions` remaining.
 * Premium is monotone in spot per right, so substituting u = ±spot makes it
 * a plain bisection. null when the target lies outside ±60% of spot.
 */
export function spotForPremium(
  target: number,
  right: 'C' | 'P',
  price: (spot: number, sessions: number) => number,
  sessions: number,
  spot0: number
): number | null {
  if (!Number.isFinite(target) || target <= 0 || !(spot0 > 0)) return null;
  const dir = right === 'C' ? 1 : -1;
  let uLo = Math.min(dir * spot0 * 0.4, dir * spot0 * 1.6);
  let uHi = Math.max(dir * spot0 * 0.4, dir * spot0 * 1.6);
  const f = (u: number) => price(dir * u, sessions) - target;
  if (f(uLo) > 0 || f(uHi) < 0) return null;
  for (let i = 0; i < 54; i++) {
    const mid = (uLo + uHi) / 2;
    if (f(mid) < 0) uLo = mid;
    else uHi = mid;
  }
  return dir * ((uLo + uHi) / 2);
}

/** Build the whole series. Every point is a pricer call on a real bar close
    or the real spot — nothing is drawn to look plausible. */
export function buildSetupTrack(setup: Setup, bars: Candle[]): SetupTrack {
  const iv = setup.greeks.iv / 100;
  const priceAt = (spot: number, sessions: number) =>
    estimatePremium(spot, setup.strike, setup.right, iv, Math.max(sessions, 0.05) / 252);

  const n = bars.length;
  const spotNow = n > 0 ? bars[n - 1].close : Number.NaN;
  const sessionsLeft = Math.max(setup.sessionsLeft, 0.5);
  const lifeBars = Math.max(1, Math.round(sessionsLeft * SESSION_BARS));
  const histBars = Math.max(0, Math.min(lifeBars, n - 1, MAX_HIST_SESSIONS * SESSION_BARS));

  // ---- past: real bars, repriced -------------------------------------------
  const past: TrackPoint[] = [];
  if (n > 0) {
    const pts = histBars >= 2 ? PAST_PTS : 0;
    let prev = setup.mid;
    for (let i = 0; i <= pts; i++) {
      const k = Math.round(histBars - (i * histBars) / (pts || 1));
      const bar = bars[n - 1 - k];
      if (!bar) continue;
      const raw = priceAt(bar.close, sessionsLeft + k / SESSION_BARS);
      const premium = Number.isFinite(raw) ? raw : prev;
      prev = premium;
      past.push({ bar: k === 0 ? 0 : -k, premium });
    }
    if (past.length === 0 || past[past.length - 1].bar !== 0) past.push({ bar: 0, premium: setup.mid });
    // The pin: the chart's last point IS the printed mid, enforced.
    past[past.length - 1].premium = setup.mid;
  }

  // ---- forward: spot held, only time elapses -------------------------------
  const forward: TrackPoint[] = [];
  const stopCurve: TrackPoint[] = [];
  let onFloor = 0;
  for (let i = 0; i <= FWD_PTS; i++) {
    const rem = sessionsLeft * (1 - i / FWD_PTS);
    const bar = (sessionsLeft - rem) * SESSION_BARS;
    forward.push({ bar, premium: priceAt(spotNow, rem) });
    const p = priceAt(setup.invalidationPrice, rem);
    stopCurve.push({ bar, premium: p });
    if (p <= PREMIUM_FLOOR + 1e-6) onFloor++;
  }
  if (forward.length) forward[0].premium = setup.mid;
  const stopOk = onFloor <= (FWD_PTS + 1) * (2 / 3);

  // ---- levels --------------------------------------------------------------
  const stopPremium = priceAt(setup.invalidationPrice, sessionsLeft);
  const pctFrom = (p: number) => (setup.mid > 0 ? (p / setup.mid - 1) * 100 : 0);
  const mkLevel = (
    key: string,
    label: string,
    premium: number,
    status: TrackLevel['status'],
    spotNeeded: number | null
  ): TrackLevel => ({
    key,
    label,
    premium,
    fromRefPct: pctFrom(premium),
    spotNeeded,
    status,
    docked: false,
  });

  const levels: TrackLevel[] = [
    mkLevel('ref', 'Reference', setup.mid, 'REF', null),
    /* No rungs, no stop (the 2026-08-30 earned-TPs rule): a thesis that
       earned zero TPs draws no trade furniture on the premium tape. */
    ...(setup.takeProfits.length > 0 ? [mkLevel('stop', 'Stop', stopPremium, 'STOP', setup.invalidationPrice)] : []),
    ...setup.takeProfits.map(tp =>
      mkLevel(
        `tp${tp.level}`,
        `TP${tp.level}`,
        tp.target,
        tp.status === 'HIT' ? 'HIT' : tp.status === 'IN PROGRESS' ? 'IN PROGRESS' : 'PENDING',
        spotForPremium(tp.target, setup.right, priceAt, sessionsLeft, spotNow)
      )
    ),
  ];

  // ---- domains: the ceiling is the load-bearing decision -------------------
  const pathMax = past.length ? Math.max(...past.map(p => p.premium)) : setup.mid;
  const firstTp = setup.takeProfits[0]?.target ?? setup.mid;
  const frameTop = Math.max(pathMax, setup.mid, firstTp, stopPremium, PREMIUM_FLOOR * 2) * 1.12;
  let dockedCount = 0;
  for (const l of levels) {
    if (l.premium > frameTop) {
      l.docked = true;
      dockedCount++;
    }
  }
  const yMax = frameTop * (1 + DOCK_HEADROOM * dockedCount);

  const first = past[0]?.premium ?? setup.mid;
  return {
    past,
    forward,
    stopCurve: stopOk && setup.takeProfits.length > 0 ? stopCurve : null,
    levels,
    ref: setup.mid,
    spotNow,
    sessionChangePct: first > 0 ? (setup.mid / first - 1) * 100 : 0,
    yMax,
    xMin: histBars === 0 ? 0 : -histBars,
    xMax: lifeBars,
    pastMinutes: histBars,
    forwardMinutes: lifeBars,
  };
}

/** Signed span for a cursor readout — "−1h 20m" / "NOW" / "+45m". */
export function barsToOffset(barCount: number): string {
  const r = Math.round(barCount);
  if (r === 0) return 'NOW';
  return `${r < 0 ? '−' : '+'}${barsToSpan(r)}`;
}

/** Relative time only, never a wall clock — the sim's bars have no real
    09:30–16:00 relationship, and this chart's whole argument is honesty. */
export function barsToSpan(barCount: number): string {
  const abs = Math.abs(Math.round(barCount));
  if (abs === 0) return '0m';
  if (abs >= SESSION_BARS) {
    const s = abs / SESSION_BARS;
    return `${s >= 10 ? Math.round(s) : Number(s.toFixed(1))} session${s >= 2 ? 's' : ''}`;
  }
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
