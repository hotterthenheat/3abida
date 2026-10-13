/*
  THE TRAIL'S MODEL, PURE (data/feed/trailModel.ts, split out of trailField.ts on 2026-10-13 so the server's store and
  backfill and the browser's trail run ONE code path — the owner: "Final rows must equal the rebuild exactly (same code
  path)"). No React, no window, no document: the universe, the column, the summary, the straddles, the residual.
  trailField.ts re-exports everything here and adds the browser's state and hook; see its header for the model's rules.
*/
import { pickFlip, pickWalls } from '../../core/walls';
import { blackScholesGreeks, blackScholesPrice } from '../../core/greeks';
import { nyIsoDate, nyWallTime } from '../../core/nyTime';
import { closeMinuteOn } from '../expiryClass';
import type { GexLevel, GexSnapshot } from '../../types/market';

/** UW's book on the expiries within 60 days, per strike — the field's like-for-like reference (levels.ts reads it off
    the recorder's books60, the server's store and the agree check off the same rows) */
export interface FeedBook60 {
  /** When UW figured it (the newest row's time), epoch ms */
  at: number;
  spot: number;
  expiries: string[];
  /** Ascending; the house's sign */
  rows: { strike: number; net: number; call: number; put: number }[];
}

/* ---- the model, named --------------------------------------------------------------------------------------------- */

/** Strikes kept each side of the price — the house's book (pinpointBook BOOK_WINDOW, levels.ts FEED_HALF) */
export const TRAIL_HALF = 30;
/** Days of expiries in the universe */
export const CHAIN_MAX_DTE = 60;
/** A vol read this close to its expiry is not used */
const LAST_HOUR_MS = 3600_000;
/** A vol older than this at the column's clock counts as old in the cell's `staleShare` */
const STALE_MS = 3600_000;
const YEAR_MS = 365 * 864e5;

/** UW's carry: the rate and yield its vols are solved under (fitted on six names, one figure for all of them) */
export const UW_VOL_CONVENTION = { r: 0.0415, q: 0 } as const;

/** UW's clock for a contract, in years: today's expiry on the calendar time to its last-trading instant, a later one on
    whole calendar days — its date less `today` (New York's) — over 365, the same all session */
export function uwYears(clock: number, expires: number, expiry: string, today: string): number {
  if (expiry <= today) return (expires - clock) / YEAR_MS;
  const ymd = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return (ymd(expiry) - ymd(today)) / YEAR_MS;
}

/** The last print a regular session can hold on a New York date: 16:15 (index and fund options trade to it; a stock's
    to 16:00, so this is a bound, never early) */
const tapeEndOn = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return nyWallTime(y, m, d, 16, 15);
};
/** A vol's trade time as UW stamps it (`last_tape_time`): after the close it is a later batch stamp, not the print's
    (2026-10-13: 16 of 16 SPY contracts carried their last print's vol under a stamp of 17:10–17:42 New York, the print
    itself 10:40–16:14) — then the print's time is known only to be at or before the close, and is kept as that bound */
function tradeTimeOf(tape: number | null, fallback: number): { trade: number; bound: boolean } {
  const t = tape ?? fallback;
  const end = tapeEndOn(nyIsoDate(t));
  return t > end ? { trade: end, bound: true } : { trade: t, bound: tape == null };
}

/** The field's model — its version is kept with every column (trailMeta) */
export const TRAIL_MODEL = {
  version: 'trail-2026-10-13.5',
  what: 'estimated dealer gamma (assumed sign)',
  openInterest: "the day's published count — UW's count dated today, the positions at the session before's close — for every column from its publication (07:00 New York, a conservative time until the recorder's days from 04:00 measure it; UW's lands about 06:45), WHATEVER THE HOUR the recorder received it, so a live day and a rebuilt one stand on the same positions; before the publication, the prior count (the seed's, dated the session before, or a chain read before it); never a count published after the minute",
  vol: "as of each minute: today, the newest chain read received at or before the minute's end; a past session, each contract's own minute vols as it traded (UW's per-contract minutes, the middle of the minute's range, knowable at the minute's end, kept when it moved a tenth of a vol point); before either, the session before's close (carried, fixed-strike); a vol read in its expiry's last hour is not used; no observation, no contract",
  price: "the minute bar's close; a column is knowable at its bar's end",
  pricer: "core/greeks.ts blackScholesGreeks on UW's convention (measured): European, r 4.15%, q 0; today's expiry on calendar time from the bar middle to its last-trading instant (16:00 New York, 13:00 on a half day), a later one on whole calendar days / 365",
  universe: `contracts listed within ${CHAIN_MAX_DTE} days with open interest, 30 strikes each side of the price`,
  units: 'open interest × greek × price² (dollars per 1%, UW /spot-exposures/strike units)',
  sign: "assumed: the house's — the calls' gamma negative, the puts' positive, delta turned over",
  calibration: 'none — the captured books are a reference, their residual said in How sure',
  scale: 'each column against the columns at or before it (the 85th percentile of their maxima)',
} as const;

/* ---- the recorded inputs, as the server hands them ---------------------------------------------------------------- */

/** One read of the chain: [OCC symbol, open interest, vol or null, its trade's time (ms) or null] */
/** One read of the chain: [OCC symbol, open interest, vol of the last trade or null, that trade's time (ms) or null,
    NBBO bid or null, NBBO ask or null, the day's volume] — the last three since 2026-10-13, for the store's straddles
    (server/fieldStore.ts); a row without them is read as before */
export type ChainRow = [string, number, number | null, number | null, (number | null)?, (number | null)?, number?];
export interface ChainRead {
  receivedAt: number;
  rows: ChainRow[];
}
/** The session before's close: [OCC symbol, vol or null, its trade's time (ms) or null, open interest dated that
    session (the count after the session before IT closed) — the count the pre-market stands on until today's lands] */
export type SeedRow = [string, number | null, number | null, number?];
export interface SeedRead {
  date: string;
  receivedAt: number;
  rows: SeedRow[];
}
export interface TotalRead {
  receivedAt: number;
  /** [minute's start (ms), UW's price, the whole book's gamma per 1% by open interest, by volume, directionalized —
      the last two since 2026-10-13 (UW's `_vol` and `_dir`, the attribution check of item 3); UW's sign] */
  rows: [number, number | null, number, number?, number?][];
}
export interface ServerInputs {
  chains: ChainRead[];
  seed: SeedRead | null;
  total: TotalRead | null;
  /** A past session's vols as each contract traded (server/fieldBackfill.ts): flattened [minute start (ms), vol, …] —
      a minute's vol knowable at the minute's end */
  ticks?: Record<string, number[]>;
}

/* ---- the pure part ---------------------------------------------------------------------------------------------- */

/** An OCC symbol's parts — "SPY261012P00777000" → SPY, 2026-10-12, P, 777 */
export function parseOcc(sym: string): { root: string; expiry: string; right: 'C' | 'P'; strike: number } | null {
  const m = /^(.*?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(sym);
  if (!m) return null;
  return { root: m[1], expiry: `20${m[2]}-${m[3]}-${m[4]}`, right: m[5] as 'C' | 'P', strike: Number(m[6]) / 1000 };
}

const lastTrade = new Map<string, number>();
/** A contract's last-trading instant: its date's close in New York — 16:00, or 13:00 on a half day */
export function lastTradeOf(iso: string): number {
  let t = lastTrade.get(iso);
  if (t === undefined) {
    const [y, m, d] = iso.split('-').map(Number);
    const close = closeMinuteOn(new Date(y, m - 1, d));
    t = nyWallTime(y, m, d, Math.floor(close / 60), close % 60);
    lastTrade.set(iso, t);
  }
  return t;
}

/** One vol observation: knowable at `at`, from a trade at `trade` (`bound`: at or before it, the print's own time not
    known), `carried` when it is the session before's close */
interface Obs {
  at: number;
  iv: number;
  trade: number;
  bound: boolean;
  carried: boolean;
}

/** The universe priced: strikes ascending, each strike's contracts in one packed run, each contract's observations */
export interface Universe {
  day: string;
  strikes: number[];
  /** Contracts [start[i], start[i+1]) belong to strikes[i] */
  start: Int32Array;
  call: Uint8Array;
  /** Each contract's open interest as it became knowable, oldest first — a column takes the newest at or before its end */
  oiObs: OiObs[][];
  /** The receipt of the first chain read carrying the day's published count, 0 while none has come */
  oiTodayFrom: number;
  expires: Float64Array;
  /** UW's whole-day clock for a later expiry, in years; 0 for today's (priced on the minutes left) */
  years: Float64Array;
  expiry: string[];
  /** Each contract's observations, oldest first */
  obs: Obs[][];
  /** The chain reads' moments, oldest first — a column's inputs are named by the newest at or before it */
  reads: number[];
  seedDate: string | null;
}

/** A count of open interest and the moment it became knowable: the day's published count from its publication, the
    prior count from the session before's close */
export interface OiObs {
  at: number;
  oi: number;
}

/** When UW publishes the day's open-interest count, New York minutes after midnight — a fixed conservative time (the
    owner, 2026-10-13: "until then use a fixed conservative time, e.g. 7:00 am ET") until the recorder's days from 04:00
    measure it; it lands about 06:45. The recorder notes each day's switch (oi.json) so it can be measured. */
export const OI_PUBLISH_NY_MIN = 7 * 60;
/** The instant the day's count is public, epoch ms */
export function oiPublishedAt(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return nyWallTime(y, m, d, Math.floor(OI_PUBLISH_NY_MIN / 60), OI_PUBLISH_NY_MIN % 60);
}

/**
 * The universe of a name for a day from what the server recorded: the contracts the chain reads list (its own root
 * only — an adjusted root is another deliverable), each contract's open interest AS IT BECAME KNOWABLE (the owner,
 * 2026-10-13: "a column's open interest must switch to today's count based on when UW publishes it, not when our
 * server happened to read it … every RTH column uses today's dated count; pre-market columns use the prior count until
 * UW's publish time"): a chain read received at or after the publication carries the day's count, knowable from the
 * publication whatever the hour it was received; a read before it, and the seed, carry the prior count, knowable from
 * the session before's close. So a live day and one rebuilt from history stand on the same positions. And every vol
 * observation with the moment it became knowable.
 */
export function universeOf(ticker: string, day: string, inputs: ServerInputs, cut: string | null = null): Universe {
  const t = ticker.toUpperCase();
  type C = { strike: number; expiry: string; call: boolean; oiObs: OiObs[]; obs: Obs[] };
  const bySym = new Map<string, C>();
  const reads = [...inputs.chains].sort((a, b) => a.receivedAt - b.receivedAt);
  const publish = oiPublishedAt(day);
  /* the prior count is knowable from the session before's close (the seed's instant); with no seed, from the day's start */
  const [dy, dm, dd] = day.split('-').map(Number);
  const priorAt = inputs.seed ? (([y, m, d]) => nyWallTime(y, m, d, 16, 0))(inputs.seed.date.split('-').map(Number)) : nyWallTime(dy, dm, dd, 0, 0);
  let oiTodayFrom = 0;
  for (const read of reads) {
    const todays = read.receivedAt >= publish;
    if (todays && !oiTodayFrom) oiTodayFrom = read.receivedAt;
    const at = todays ? publish : priorAt;
    for (const [sym, oi, iv, trade] of read.rows) {
      const p = parseOcc(sym);
      if (!p || p.root !== t || p.expiry < day || (cut && p.expiry !== cut) || !(p.strike > 0)) continue;
      let c = bySym.get(sym);
      if (!c) bySym.set(sym, (c = { strike: p.strike, expiry: p.expiry, call: p.right === 'C', oiObs: [], obs: [] }));
      /* a count is noted when it changes — the same count read again is the same knowledge; the newest read of a kind
         (prior or published) is the count of that kind */
      if (!c.oiObs.length || c.oiObs[c.oiObs.length - 1].oi !== oi) c.oiObs.push({ at, oi });
      if (iv != null && iv > 0 && lastTradeOf(p.expiry) - read.receivedAt >= LAST_HOUR_MS) c.obs.push({ at: read.receivedAt, iv, ...tradeTimeOf(trade, read.receivedAt), carried: false });
    }
  }
  /* a past session's vols minute by minute: each knowable at its minute's end, its print within the minute */
  const tickEnds = new Set<number>();
  for (const [sym, arr] of Object.entries(inputs.ticks ?? {})) {
    const c = bySym.get(sym);
    if (!c) continue;
    const last = lastTradeOf(c.expiry);
    for (let i = 0; i + 1 < arr.length; i += 2) {
      const at = arr[i] + 60_000;
      const iv = arr[i + 1];
      if (!(iv > 0) || last - at < LAST_HOUR_MS) continue;
      c.obs.push({ at, iv, trade: arr[i], bound: false, carried: false });
      tickEnds.add(at);
    }
  }
  if (tickEnds.size) for (const c of bySym.values()) c.obs.sort((a, b) => a.at - b.at);
  /* the session before's close: knowable from that close on (before today's open), carried */
  const seed = inputs.seed;
  if (seed) {
    const [y, m, d] = seed.date.split('-').map(Number);
    const knowable = nyWallTime(y, m, d, 16, 0);
    for (const [sym, iv, trade, oi] of seed.rows) {
      const c = bySym.get(sym);
      if (!c) continue;
      /* the seed's count — dated the session before, public through it — stands before the day's publication, unless a
         read before the publication already carried the prior count */
      if (oi != null && Number.isFinite(oi) && (!c.oiObs.length || c.oiObs[0].at > knowable)) c.oiObs.unshift({ at: knowable, oi });
      if (iv == null || !(iv > 0) || lastTradeOf(c.expiry) - knowable < LAST_HOUR_MS) continue;
      c.obs.unshift({ at: knowable, iv, ...tradeTimeOf(trade, knowable), carried: true });
    }
  }
  const kept = [...bySym.values()].filter(c => c.oiObs.some(o => o.oi > 0)).sort((a, b) => a.strike - b.strike);
  const strikes: number[] = [];
  const start: number[] = [];
  kept.forEach((c, i) => {
    if (!strikes.length || c.strike !== strikes[strikes.length - 1]) {
      strikes.push(c.strike);
      start.push(i);
    }
  });
  start.push(kept.length);
  return {
    day,
    strikes,
    start: Int32Array.from(start),
    call: Uint8Array.from(kept.map(c => (c.call ? 1 : 0))),
    oiObs: kept.map(c => c.oiObs),
    oiTodayFrom,
    expires: Float64Array.from(kept.map(c => lastTradeOf(c.expiry))),
    years: Float64Array.from(kept.map(c => (c.expiry > day ? uwYears(0, 0, c.expiry, day) : 0))),
    expiry: kept.map(c => c.expiry),
    obs: kept.map(c => c.obs),
    reads: [...new Set([...reads.map(r => r.receivedAt), ...tickEnds])].sort((a, b) => a - b),
    seedDate: seed?.date ?? null,
  };
}

/** The index of the first of `half` strikes each side of a price — levels.ts aroundPrice's window */
function windowAt(strikes: readonly number[], price: number, half: number): [number, number] {
  let lo = 0;
  let hi = strikes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (strikes[mid] > price) hi = mid;
    else lo = mid + 1;
  }
  return [Math.max(0, lo - half), Math.min(strikes.length, lo + half)];
}

/** The newest observation knowable by `by`, or null */
function obsAt(list: readonly Obs[], by: number): Obs | null {
  let out: Obs | null = null;
  for (const o of list) {
    if (o.at > by) break;
    out = o;
  }
  return out;
}

/** The newest count of open interest received by `by`, 0 for none yet */
export function oiAt(list: readonly OiObs[], by: number): number {
  let out = 0;
  for (const o of list) {
    if (o.at > by) break;
    out = o.oi;
  }
  return out;
}

/** The newest chain read knowable by `by` (its moment), 0 for none */
export function readAt(u: Universe, by: number): number {
  let out = 0;
  for (const r of u.reads) {
    if (r > by) break;
    out = r;
  }
  return out;
}

/**
 * One minute of the field: every strike round the bar's close, each contract priced on the vol knowable at the bar's end
 * and its own clock from the bar's middle. A strike no contract could be priced at is left out (a gap).
 */
export function modelColumn(u: Universe, bar: { time: number; close: number }, half = TRAIL_HALF): GexSnapshot {
  const spot = bar.close;
  const knowBy = (bar.time + 60) * 1000;
  const clock = bar.time * 1000 + 30_000;
  const s2 = spot * spot;
  const [a, b] = windowAt(u.strikes, spot, half);
  const levels: GexLevel[] = [];
  for (let i = a; i < b; i++) {
    const k = u.strikes[i];
    let gc = 0;
    let gp = 0;
    let dc = 0;
    let dp = 0;
    let fresh = 0;
    let all = 0;
    let stale = Infinity;
    let staleBound = false;
    let newest = 0;
    let old = 0;
    for (let j = u.start[i]; j < u.start[i + 1]; j++) {
      if (u.expires[j] <= clock) continue;
      const o = obsAt(u.obs[j], knowBy);
      if (!o) continue;
      /* the count knowable at the bar's end — never one received after it */
      const oi = oiAt(u.oiObs[j], knowBy);
      if (!(oi > 0)) continue;
      const g = blackScholesGreeks(spot, k, u.years[j] > 0 ? u.years[j] : (u.expires[j] - clock) / YEAR_MS, o.iv, UW_VOL_CONVENTION.r, UW_VOL_CONVENTION.q);
      const w = oi * s2;
      const gw = w * g.gamma;
      if (u.call[j]) {
        gc += gw;
        dc += w * g.deltaCall;
      } else {
        gp += gw;
        dp += w * g.deltaPut;
      }
      all += gw;
      if (!o.carried) fresh += gw;
      if (o.trade < stale) {
        stale = o.trade;
        staleBound = o.bound;
      }
      if (o.trade > newest) newest = o.trade;
      /* on a vol older than an hour at this minute — the hover says how much of the strike stands on one */
      if (clock - o.trade > STALE_MS) old += gw;
    }
    if (all <= 0) continue;
    const coverage = fresh / all;
    /* the house's sign (levels.ts feedStrike): the calls' gamma and every delta turned over, the puts' gamma as is */
    levels.push({ strike: k, value: -gc + gp, dex: -dc - dp, prov: coverage >= 0.5 ? 'modeled' : 'carried', staleSince: Number.isFinite(stale) ? stale : undefined, ...(staleBound && Number.isFinite(stale) ? { staleBound: true } : {}), ...(newest > 0 ? { freshAt: newest } : {}), staleShare: old / all, coverage });
  }
  return { time: bar.time, levels, spot, rebuilt: true };
}

/* ---- a rebuilt session as the model's inputs — ONE mapping for the server's store, the pages' trail and Pinpoint ------ */

/** What a rebuilt session carries (server/fieldBackfill.ts PastDay, served by /feed/field/<NAME>/day/<D>) */
export interface PastInputsLike {
  day: string;
  /** [OCC symbol, open interest dated the session] */
  oi: [string, number][];
  seed: SeedRead | null;
  ticks?: Record<string, number[]>;
  total?: TotalRead | null;
}
/** The positions dated the session are knowable at its open (and stand from 7:00 am, universeOf); no vol comes with them */
export function pastInputs(p: PastInputsLike): ServerInputs {
  const [y, m, d] = p.day.split('-').map(Number);
  const open: ChainRead = { receivedAt: nyWallTime(y, m, d, 9, 30), rows: p.oi.map(([sym, oi]) => [sym, oi, null, null]) };
  return { chains: [open], seed: p.seed, total: p.total ?? null, ticks: p.ticks ?? {} };
}
/** A past session's book AT ITS OPEN: the rebuilt field's column on the opening bar — the day's published count, the
    session before's close vols and the first minute's prints, nothing knowable later (the owner, 2026-10-13: UW's
    greek-exposure/strike?date=D is the day's END state, so Pinpoint's history no longer reads it as the open) */
export function openColumn(name: string, p: PastInputsLike, bar: { time: number; close: number }): GexSnapshot {
  return modelColumn(universeOf(name, p.day, pastInputs(p)), bar);
}

/* ---- THE REGIME (the owner's item 3, 2026-10-13): the column's net a minute, read against the same half-hour over
   the trailing sessions — never the flip's side (the two agreed in 46% of 330 live columns) ------------------------ */

/** The column's net: every strike summed, the house's sign — estimated dealer gamma, assumed sign */
export const netOf = (levels: readonly { value: number }[]): number => {
  let s = 0;
  for (const l of levels) s += l.value;
  return s;
};
/** Thirteen half-hours from 9:30 am New York; the minute's bucket, or null outside the session */
export const REGIME_BUCKETS = 13;
export function regimeBucketOf(nyMinute: number): number | null {
  const b = Math.floor((nyMinute - (9 * 60 + 30)) / 30);
  return b >= 0 && b < REGIME_BUCKETS ? b : null;
}
/** The 101 quantiles (0 to 100) of a bucket's nets, ascending; null with nothing in it */
export function regimeQuantiles(nets: readonly number[]): number[] | null {
  if (!nets.length) return null;
  const s = [...nets].sort((a, b) => a - b);
  const out: number[] = [];
  for (let q = 0; q <= 100; q++) out.push(s[Math.min(s.length - 1, Math.round((q / 100) * (s.length - 1)))]);
  return out;
}
/** Where a value stands among a bucket's quantiles, 0 to 100 — the MIDRANK: on a run of equal quantiles the middle
    of the run (a value equal to the median of five reads 50, not 60), between two quantiles the straight line */
export function regimePercentile(value: number, quantiles: readonly number[]): number {
  const n = quantiles.length - 1;
  if (value < quantiles[0]) return 0;
  if (value > quantiles[n]) return 100;
  /* the last index at or below the value, and the first at or above it */
  let a = 0;
  let lo = 0;
  let hi = n;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (quantiles[mid] <= value) {
      a = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  let b = n;
  lo = 0;
  hi = n;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (quantiles[mid] >= value) {
      b = mid;
      hi = mid - 1;
    } else lo = mid + 1;
  }
  if (b <= a) return (a + b) / 2;
  const span = quantiles[b] - quantiles[a];
  return span > 0 ? a + ((value - quantiles[a]) / span) * (b - a) : a;
}
/** The reference the strip reads: per bucket the quantiles over the sessions before the day */
export interface RegimeReference {
  name: string;
  /** The newest session in `buckets`; `before` leaves it out, for a page read on that very day */
  through: string;
  sessions: number;
  buckets: (number[] | null)[];
  before: (number[] | null)[];
  /** The sessions a reference reaches back over */
  trailing: number;
}
/** The reference off sessions' rows (ascending by day): the trailing N sessions' nets by half-hour bucket */
export function buildRegimeReference(name: string, sessions: readonly { day: string; rows: readonly { m: number; net: number }[] }[], trailing = 250, minuteOf: (ms: number) => number): RegimeReference {
  const sorted = [...sessions].sort((a, b) => a.day.localeCompare(b.day));
  const build = (set: readonly { rows: readonly { m: number; net: number }[] }[]): (number[] | null)[] => {
    const by: number[][] = Array.from({ length: REGIME_BUCKETS }, () => []);
    for (const s of set.slice(-trailing)) for (const r of s.rows) {
      const b = regimeBucketOf(minuteOf(r.m));
      if (b != null && Number.isFinite(r.net)) by[b].push(r.net);
    }
    return by.map(regimeQuantiles);
  };
  return { name, through: sorted[sorted.length - 1]?.day ?? '', sessions: Math.min(trailing, sorted.length), buckets: build(sorted), before: build(sorted.slice(0, -1)), trailing };
}
/** The quantiles a page on `day` may read — never a session at or after it */
export function regimeBucketsFor(ref: RegimeReference, day: string): (number[] | null)[] | null {
  if (!ref.through) return null;
  if (day > ref.through) return ref.buckets;
  if (day === ref.through) return ref.before;
  return null;
}
/** "12th" */
export const ordinal = (n: number): string => {
  const v = Math.round(n);
  const s = v % 100 >= 11 && v % 100 <= 13 ? 'th' : v % 10 === 1 ? 'st' : v % 10 === 2 ? 'nd' : v % 10 === 3 ? 'rd' : 'th';
  return `${v}${s}`;
};

/* ---- the store's reading of a column (server/fieldStore.ts, 2026-10-13) --------------------------------------- */

/** The heaviest strikes a store row keeps */
export const TOP_STRIKES = 5;
export interface ColumnSummary {
  /** The zero crossing nearest spot (core/walls.ts pickFlip), null where the column never changes sign */
  flip: number | null;
  cw: number | null;
  pw: number | null;
  /** The heaviest strikes, [strike, value] in the house's sign, |value| descending */
  top: [number, number][];
  /** The column's net — every strike it holds summed (estimated dealer gamma, assumed sign). NOT the flip's side:
      measured 2026-10-13 on 330 live SPY columns the two agreed in 46% (the owner: "Regime and flip stay separate") */
  net: number;
  cells: number;
  /** The share of the column's strikes on carried vols */
  carried: number;
}
export function columnSummary(snap: GexSnapshot, spot = snap.spot ?? NaN): ColumnSummary {
  const walls = pickWalls(snap.levels, spot, l => l.value);
  const flip = snap.levels.length > 1 ? pickFlip(snap.levels, spot, l => l.value) : null;
  const top = [...snap.levels]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, TOP_STRIKES)
    .map(l => [l.strike, l.value] as [number, number]);
  let net = 0;
  let carried = 0;
  for (const l of snap.levels) {
    net += l.value;
    if (l.prov === 'carried') carried++;
  }
  return { flip, cw: walls.callWall, pw: walls.putWall, top, net, cells: snap.levels.length, carried: snap.levels.length ? carried / snap.levels.length : 0 };
}

/** The expiries the store's straddles stand on: the one settling today (null when none is listed) and the weekly — the
    first listed Friday after today, else the first listed date after today */
export function straddleExpiries(expiries: Iterable<string>, day: string): { today: string | null; weekly: string | null } {
  const listed = [...new Set(expiries)].sort();
  const today = listed.includes(day) ? day : null;
  const after = listed.filter(e => e > day);
  const friday = after.find(e => new Date(`${e}T12:00:00Z`).getUTCDay() === 5) ?? null;
  return { today, weekly: friday ?? after[0] ?? null };
}

export interface StraddleRead {
  expiry: string;
  strike: number;
  /** Call plus put, dollars a share */
  value: number;
  /** 'nbbo': the two legs' NBBO mids at a chain read; 'model': each leg priced by the model at the minute on the vol
      knowable at its end (the owner, 2026-10-13: "the NBBO mid at each chain read, and the model price between reads,
      labelled") */
  src: 'nbbo' | 'model';
  /** The legs' vols the model priced on (model), else the legs' mids (nbbo) */
  call: number;
  put: number;
}
/** The nearest strike to spot holding both legs, within 2% of it */
const ATM_BAND = 0.02;
/** The at-the-money straddle for an expiry, priced by the model at the minute; null with no strike holding both legs */
export function straddleAt(u: Universe, bar: { time: number; close: number }, expiry: string): StraddleRead | null {
  const spot = bar.close;
  const knowBy = (bar.time + 60) * 1000;
  const clock = bar.time * 1000 + 30_000;
  const order = u.strikes.map((_, i) => i).sort((a, b) => Math.abs(u.strikes[a] - spot) - Math.abs(u.strikes[b] - spot));
  for (const i of order) {
    if (Math.abs(u.strikes[i] - spot) > spot * ATM_BAND) break;
    let c: number | null = null;
    let p: number | null = null;
    let civ = 0;
    let piv = 0;
    for (let j = u.start[i]; j < u.start[i + 1]; j++) {
      if (u.expiry[j] !== expiry || u.expires[j] <= clock) continue;
      const o = obsAt(u.obs[j], knowBy);
      if (!o || !(o.iv > 0)) continue;
      const t = u.years[j] > 0 ? u.years[j] : (u.expires[j] - clock) / YEAR_MS;
      const px = blackScholesPrice(spot, u.strikes[i], t, o.iv, u.call[j] ? 'C' : 'P', UW_VOL_CONVENTION.r, UW_VOL_CONVENTION.q);
      if (!Number.isFinite(px)) continue;
      if (u.call[j]) {
        c = px;
        civ = o.iv;
      } else {
        p = px;
        piv = o.iv;
      }
    }
    if (c != null && p != null) return { expiry, strike: u.strikes[i], value: c + p, src: 'model', call: civ, put: piv };
  }
  return null;
}
/** The at-the-money straddle off a chain read's NBBOs: the strike nearest spot whose call and put both carry a bid and
    an ask; null where the read carries none (a read before 2026-10-13, or outside quoting hours) */
export function straddleFromChain(rows: readonly ChainRow[], expiry: string, spot: number): StraddleRead | null {
  const by = new Map<number, { c?: number; p?: number }>();
  for (const r of rows) {
    const bid = r[4];
    const ask = r[5];
    if (bid == null || ask == null || !(bid > 0) || !(ask > 0) || ask < bid) continue;
    const o = parseOcc(r[0]);
    if (!o || o.expiry !== expiry || Math.abs(o.strike - spot) > spot * ATM_BAND) continue;
    const cur = by.get(o.strike) ?? {};
    if (o.right === 'C') cur.c = (bid + ask) / 2;
    else cur.p = (bid + ask) / 2;
    by.set(o.strike, cur);
  }
  let best: StraddleRead | null = null;
  for (const [k, v] of by) {
    if (v.c == null || v.p == null) continue;
    if (!best || Math.abs(k - spot) < Math.abs(best.strike - spot)) best = { expiry, strike: k, value: v.c + v.p, src: 'nbbo', call: v.c, put: v.p };
  }
  return best;
}

/* ---- the reference: the residual against UW's own figures -------------------------------------------------------- */

/** How far the field stands from UW's own figures today, in one line for "How sure" — null with nothing to set it
    against yet. LIKE FOR LIKE (the Terrain audit of 2026-10-13, row 41): the reference is UW's book on the model's own
    universe — the expiries within 60 days summed per strike (levels.ts FeedBook60, read every five minutes through
    the session) — and the comparison is made over the strikes both hold, strike by strike and summed. UW's whole-book
    series (every expiry, every strike) and its per-strike book (every expiry) are not the model's universe, so neither
    is a measure of it: the same sign 13% of the time at −1.99× was the universe, not a sign. */
export function fieldResidual(field: readonly GexSnapshot[], books60: readonly FeedBook60[]): string | null {
  const byMinute = new Map<number, GexSnapshot>();
  for (const s of field) byMinute.set(Math.floor(s.time / 60), s);
  const gaps: number[] = [];
  const ratios: number[] = [];
  let same = 0;
  for (const b of books60) {
    const col = byMinute.get(Math.floor(b.at / 60_000));
    if (!col) continue;
    const mine = new Map(col.levels.map(l => [l.strike, l.value]));
    let gap = 0;
    let size = 0;
    let sumMine = 0;
    let sumTheirs = 0;
    let n = 0;
    for (const r of b.rows) {
      const m = mine.get(r.strike);
      if (m === undefined || !Number.isFinite(m)) continue;
      n++;
      gap += Math.abs(m - r.net);
      size += Math.abs(r.net);
      sumMine += m;
      sumTheirs += r.net;
    }
    if (n < 8 || size <= 0 || !sumTheirs) continue;
    gaps.push(gap / size);
    if (Math.sign(sumMine) === Math.sign(sumTheirs)) same++;
    ratios.push(sumMine / sumTheirs);
  }
  if (!gaps.length) return null;
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const n = gaps.length;
  const books = `${n} book${n === 1 ? '' : 's'}`;
  return `The field is modeled, never rescaled to the vendor. Against Unusual Whales' book on the same strikes and expiries (within 60 days, ${books} read today): strike by strike it differs by ${(med(gaps) * 100).toFixed(1)}% of the book's size at the median; summed over those strikes it has the same sign in ${same} of ${n}, at ${med(ratios).toFixed(2)}× the book's size at the median.`;
}

/** The residual's figures, for a check (window.__slayerTrail) */
export function residualFigures(field: readonly GexSnapshot[], books60: readonly FeedBook60[]): { books: number; gaps: number[]; ratios: number[]; same: number; sums: { at: number; strikes: number; mine: number; theirs: number; size: number }[] } {
  const byMinute = new Map<number, GexSnapshot>();
  for (const s of field) byMinute.set(Math.floor(s.time / 60), s);
  const out = { books: 0, gaps: [] as number[], ratios: [] as number[], same: 0, sums: [] as { at: number; strikes: number; mine: number; theirs: number; size: number }[] };
  for (const b of books60) {
    const col = byMinute.get(Math.floor(b.at / 60_000));
    if (!col) continue;
    const mine = new Map(col.levels.map(l => [l.strike, l.value]));
    let gap = 0, size = 0, sm = 0, st = 0, n = 0;
    for (const r of b.rows) {
      const m = mine.get(r.strike);
      if (m === undefined || !Number.isFinite(m)) continue;
      n++;
      gap += Math.abs(m - r.net);
      size += Math.abs(r.net);
      sm += m;
      st += r.net;
    }
    if (n < 8 || size <= 0 || !st) continue;
    out.books++;
    out.gaps.push(gap / size);
    out.ratios.push(sm / st);
    out.sums.push({ at: b.at, strikes: n, mine: sm, theirs: st, size });
    if (Math.sign(sm) === Math.sign(st)) out.same++;
  }
  return out;
}

/* ---- the column's record -------------------------------------------------------------------------------------- */

/** How a column of the field was made */
