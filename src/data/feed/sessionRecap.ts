/*
==================================================
  SLAYER TERMINAL - THE SESSION RECAP (data/feed/sessionRecap.ts)

  THE OWNER'S ITEM 9 (2026-10-14): "at 4:05 p.m. ET,
  generate flip crossings, wall moves, alerts fired with
  +15/+30 min outcomes, close vs +/-1 and +/-2 sigma, max
  sigma used, the regime path, and a chart image via
  takeScreenshot({ addTopLayer: true }) … Post it to the
  Journal room. Data: snapshot store, alert log.
  Acceptance: the recap's numbers equal the item-2 and
  item-4 rows for that session. Why: closes the review
  loop with almost no new code."

  PURE. The server builds it (server/recap.ts) once the
  session is over, from what the track record and the
  priced move already read, through their own functions:
    · THE ROWS — the store's final rows for the session,
      or the session rebuilt: the scorecard's rule and
      code (server/scorecard.ts loadSession);
    · FLIP CROSSINGS — each minute's close against the
      column's flip that minute, the side carried over a
      minute with no flip: the level alerts' rule (data/
      levelAlerts.ts) at one confirmation minute — every
      crossing, no cooldown;
    · WALL MOVES — the field's chips' rule (trailModel
      wallMovesOf: a new strike held three minutes);
    · THE LEVELS TOUCHED — the track record's own rows for
      the session (trackRecord touchesOf, the scorecard's
      tolerance): every touch of a real level with its
      +15 and +30 minutes, and the strike-matched levels'
      counts the same session beside them — one session
      is never a rate;
    · THE CLOSE AGAINST ±1σ AND ±2σ, AND THE FARTHEST —
      the priced move's row for the day (server/
      pricedMove.ts calibrationDay) through its verdict
      (pricedMove dayVerdict), the one the calibration
      counts;
    · THE REGIME PATH — the net at each half-hour's last
      minute and its percentile against the same half-hour
      over the sessions before (trailModel
      regimeBucketsFor), and the minutes its sign turned.
      The net's sign is not the flip's side, and nothing
      here says it is.
  The browser adds the alerts fired that day with their
  +15 and +30 minutes (data/levelAlerts.ts outcomesOf on
  the recap's bars) and the chart's picture, and posts it
  to the Journal (data/review/recaps.ts).
==================================================
*/

import { LEVEL_KINDS, touchesOf, type LevelKind, type Touch, type TrackBar, type TrackConfig, type TrackSession } from './trackRecord';
import { dayVerdict, type CalibrationDay, type DayVerdict } from './pricedMove';
import { regimeBucketOf, regimePercentile, stickyWallMoves, stickyWalls, wallObsOfRow } from './trailModel';

/** What recap.json holds — a change of what it says is a new number (the server builds it again) */
export const RECAP_FORMAT = 1;

export interface FlipCross {
  /** The minute's start, epoch ms */
  m: number;
  flip: number;
  /** The minute's close */
  spot: number;
  /** 'up': the close above the flip, having stood below it */
  dir: 'up' | 'down';
}
export interface RecapWallMove {
  kind: 'call' | 'put';
  from: number;
  to: number;
  /** The new strike's first minute, epoch ms */
  m: number;
  /** Strikes moved, on the column's own grid */
  strikes: number;
}
/** A row of the track record (trackRecord Touch) but its regime tercile — the recap carries the regime path instead */
export type RecapTouch = Omit<Touch, 'regime'>;
export interface BaselineCount {
  /** Touches of the strike-matched levels the same session */
  n: number;
  /** By horizon: [on the approach side, touches with that horizon inside the session] */
  back: Record<number, [number, number]>;
}
export interface RegimeStep {
  /** The half-hour, 0 for 9:30 am New York */
  b: number;
  /** Its last minute with a column, epoch ms */
  m: number;
  net: number;
  /** Against the same half-hour over the sessions before, 0–100; null without a reference */
  pct: number | null;
}
export interface RecapMove {
  prevClose: number;
  close: number;
  closeFrom: 'official' | 'bar';
  high: number;
  low: number;
  /** 1σ_day in dollars, priced at the prior close */
  sigma: number;
  /** Where the 4:00 pm straddle's price came from (server/pricedMove.ts StraddleFrom) */
  from: string | null;
  at10: CalibrationDay['at10'];
  verdict: DayVerdict;
  /** The minute the session went farthest from the prior close (its high's or its low's), epoch ms */
  farthestAt: number | null;
}
export interface SessionRecap {
  format: number;
  name: string;
  day: string;
  builtAt: number;
  /** A key over every figure — a figure changed is a new version, and the Journal's entry follows it */
  version: string;
  /** A key over what the picture draws (the rows and the bars) — the picture is taken again only when it changes */
  chartKey: string;
  /** The rows read: the store's final rows the recorder wrote, the session rebuilt, or none (`why` says) */
  source: 'final' | 'rebuilt' | null;
  why: string | null;
  rows: number;
  /** The scorecard's parameters the touches were counted under (server/scorecard.config.json) */
  config: string;
  move: RecapMove | null;
  moveWhy: string | null;
  flips: FlipCross[];
  walls: RecapWallMove[];
  touches: RecapTouch[];
  baseline: Record<LevelKind, BaselineCount>;
  /** The path, the sign's turns, and what its percentiles stand on — the sessions before the day, the newest of them
      and how many (regimeReachFor); a percentile is never against the day itself */
  regime: { steps: RegimeStep[]; turns: { m: number; to: 'positive' | 'negative' }[]; through: string | null; sessions: number | null };
  /** The regular session's minute bars, [start (s), open, high, low, close] — the alerts' +15 and +30 are read on them */
  bars: [number, number, number, number, number][];
}

/** FLIP CROSSINGS: the level alerts' side rule (data/levelAlerts.ts) at one confirmation minute — the minute's close
    against the column's flip that minute, against the side the last close stood on; a minute with no flip carries the
    side over; a close on the flip itself decides nothing */
export function flipCrossesOf(rows: readonly { m: number; spot: number; flip: number | null }[]): FlipCross[] {
  const out: FlipCross[] = [];
  let side = 0;
  for (const r of [...rows].sort((a, b) => a.m - b.m)) {
    if (r.flip == null || !Number.isFinite(r.flip)) continue;
    const s = r.spot > r.flip ? 1 : r.spot < r.flip ? -1 : 0;
    if (s === 0) continue;
    if (side !== 0 && s !== side) out.push({ m: r.m, flip: r.flip, spot: r.spot, dir: s > 0 ? 'up' : 'down' });
    side = s;
  }
  return out;
}

/** The strike grid's step: the smallest gap between the column's strikes (the track record's) */
function gridStep(cells: readonly (readonly [number, number, number?])[]): number {
  let step = Infinity;
  for (let i = 1; i < cells.length; i++) {
    const d = cells[i][0] - cells[i - 1][0];
    if (d > 0 && d < step) step = d;
  }
  return Number.isFinite(step) ? step : 1;
}

/** WALL MOVES on the session's rows: the chips' rule — THE WALL WITH HYSTERESIS (trailModel WallStick, the owner's item 13
    of 2026-10-14: a new strike must beat the held wall's |gamma| by 10% and hold three closed minutes; the held wall
    gives way at once once it is no candidate) walked over the rows' raw picks, a change of the wall shown a move — each
    move in strikes of its column's grid */
export function recapWallsOf(rows: readonly { m: number; cw: number | null; pw: number | null; cells: readonly (readonly [number, number, number?])[]; spot?: number }[]): RecapWallMove[] {
  const sorted = [...rows].sort((a, b) => a.m - b.m);
  /* the walls picked afresh off each row's own cells (core/walls.ts, the book's rule since 2026-10-14 — a row's stored
     cw/pw are the pick of the day it was written) and held by the field's one stick */
  const shown = stickyWalls(sorted.map(r => wallObsOfRow({ m: r.m, spot: r.spot ?? NaN, cells: r.cells })));
  return stickyWallMoves(sorted.length, i => ({ cw: shown.cw[i], pw: shown.pw[i], time: sorted[i].m }))
    .map(w => ({ kind: w.kind === 'CW' ? ('call' as const) : ('put' as const), from: w.from, to: w.to, m: w.time, strikes: Math.round(Math.abs(w.to - w.from) / gridStep(sorted[w.i].cells)) }))
    .sort((a, b) => a.m - b.m || a.kind.localeCompare(b.kind));
}

/** THE REGIME PATH: each half-hour's last minute with a column, its net and its percentile against the quantiles a page
    on the day may read (trailModel regimeBucketsFor) */
export function regimePathOf(rows: readonly { m: number; net: number }[], quantiles: readonly (readonly number[] | null)[] | null, minuteOf: (ms: number) => number): RegimeStep[] {
  const last = new Map<number, { m: number; net: number }>();
  for (const r of rows) {
    const b = regimeBucketOf(minuteOf(r.m));
    if (b == null || !Number.isFinite(r.net)) continue;
    const had = last.get(b);
    if (!had || r.m > had.m) last.set(b, r);
  }
  return [...last.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, r]) => {
      const q = quantiles?.[b];
      return { b, m: r.m, net: r.net, pct: q ? regimePercentile(r.net, q) : null };
    });
}
/** The minutes the net's sign turned */
export function signTurnsOf(rows: readonly { m: number; net: number }[]): { m: number; to: 'positive' | 'negative' }[] {
  const out: { m: number; to: 'positive' | 'negative' }[] = [];
  let sign = 0;
  for (const r of [...rows].sort((a, b) => a.m - b.m)) {
    const s = Math.sign(r.net);
    if (!s || !Number.isFinite(r.net)) continue;
    if (sign && s !== sign) out.push({ m: r.m, to: s > 0 ? 'positive' : 'negative' });
    sign = s;
  }
  return out;
}

/** THE LEVELS TOUCHED: the track record's rows for the session at its tolerance — the real levels' every field but the
    tercile, and the strike-matched levels' counts by kind and horizon */
export function recapTouchesOf(s: TrackSession, cfg: TrackConfig): { touches: RecapTouch[]; baseline: Record<LevelKind, BaselineCount> } {
  const all = touchesOf(s, cfg, cfg.tol.default, null, null);
  const touches = all.filter(t => t.base === 'real').map(stripRegime);
  const baseline = {} as Record<LevelKind, BaselineCount>;
  for (const kind of LEVEL_KINDS) {
    const b2 = all.filter(t => t.base === 'B2' && t.kind === kind);
    const back: Record<number, [number, number]> = {};
    for (const h of cfg.horizons) {
      const had = b2.filter(t => t.bounce[h] != null);
      back[h] = [had.filter(t => t.bounce[h]).length, had.length];
    }
    baseline[kind] = { n: b2.length, back };
  }
  return { touches, baseline };
}
export function stripRegime(t: Touch): RecapTouch {
  const { regime: _regime, ...rest } = t;
  void _regime;
  return rest;
}

/** FNV-1a over a value's JSON — the recap's version keys */
export function recapHash(x: unknown): string {
  const s = JSON.stringify(x);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface RecapInput {
  name: string;
  day: string;
  builtAt: number;
  /** The session as the scorecard reads it, or null and why */
  session: TrackSession | null;
  source: 'final' | 'rebuilt' | null;
  why: string | null;
  /** The regular session's minute bars (the session's own when it has rows) */
  bars: readonly TrackBar[];
  cfg: TrackConfig;
  /** The priced move's row for the day (item 4) and where its straddle's price came from; or null and why */
  calib: CalibrationDay | null;
  calibFrom: string | null;
  moveWhy: string | null;
  /** The regime's quantiles a page on the day may read (trailModel regimeBucketsFor) and the reference's reach */
  quantiles: readonly (readonly number[] | null)[] | null;
  ref: { through: string; sessions: number | null } | null;
  minuteOf: (ms: number) => number;
}

export function buildRecap(i: RecapInput): SessionRecap {
  const rows = i.session ? [...i.session.rows].sort((a, b) => a.m - b.m) : [];
  const bars = [...(i.session?.bars ?? i.bars)].sort((a, b) => a.time - b.time);
  const levels = i.session ? recapTouchesOf(i.session, i.cfg) : null;
  const verdict = i.calib ? dayVerdict(i.calib) : null;
  let farthestAt: number | null = null;
  if (i.calib && verdict) {
    const hit = verdict.max >= 0 ? bars.find(b => b.high >= i.calib!.high - 1e-9) : bars.find(b => b.low <= i.calib!.low + 1e-9);
    farthestAt = hit ? hit.time * 1000 : null;
  }
  const move: RecapMove | null =
    i.calib && verdict
      ? { prevClose: i.calib.prevClose, close: i.calib.close, closeFrom: i.calib.closeFrom ?? 'official', high: i.calib.high, low: i.calib.low, sigma: i.calib.sigmaDay, from: i.calibFrom, at10: i.calib.at10 ?? null, verdict, farthestAt }
      : null;
  const emptyBase = () => Object.fromEntries(LEVEL_KINDS.map(k => [k, { n: 0, back: Object.fromEntries(i.cfg.horizons.map(h => [h, [0, 0]])) }])) as Record<LevelKind, BaselineCount>;
  const body = {
    format: RECAP_FORMAT,
    name: i.name,
    day: i.day,
    source: i.source,
    why: i.why,
    rows: rows.length,
    config: i.cfg.version,
    move,
    moveWhy: move ? null : i.moveWhy,
    flips: flipCrossesOf(rows),
    walls: recapWallsOf(rows),
    touches: levels?.touches ?? [],
    baseline: levels?.baseline ?? emptyBase(),
    regime: { steps: regimePathOf(rows, i.quantiles, i.minuteOf), turns: signTurnsOf(rows), through: i.quantiles ? i.ref?.through || null : null, sessions: i.quantiles ? i.ref?.sessions ?? null : null },
    bars: bars.map(b => [b.time, b.open, b.high, b.low, b.close] as [number, number, number, number, number]),
  };
  const chartKey = recapHash([i.source, rows.map(r => [r.m, r.spot, r.net, r.flip, r.cw, r.pw]), body.bars]);
  return { ...body, builtAt: i.builtAt, version: recapHash(body), chartKey };
}
