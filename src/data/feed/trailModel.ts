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
  /** Each strike's call and put gamma by expiry partition (partOf), the house's sign — absent on reads before
      2026-10-14 (item 6) */
  parts?: { strike: number; call: number[]; put: number[] }[];
}
/** The 60-day book seen through an expiry window (item 6): each strike's partitions summed to the window's last; 'all'
    the book itself; null for a read without partitions */
export function book60Window(b: FeedBook60, w: ExpiryWindow): FeedBook60 | null {
  if (w === 'all') return b;
  if (!b.parts) return null;
  const top = WINDOW_TOP[w];
  const rows = b.parts.map(p => {
    let call = 0;
    let put = 0;
    for (let q = 0; q <= top; q++) {
      call += p.call[q];
      put += p.put[q];
    }
    return { strike: p.strike, net: call + put, call, put };
  });
  return { at: b.at, spot: b.spot, expiries: b.expiries.filter(e => partOf(e, nyIsoDate(b.at)) <= top), rows };
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
  /** THE DAY'S RATE (the owner's section C, 2026-10-14): a session rebuilt from Theta's quotes is priced — its vols
      inverted and its greeks figured — on the day's own rate (DTB3-derived, server/thetaRebuild.ts); absent, UW's
      fitted 4.15% (UW_VOL_CONVENTION), the only rate UW's vols are right on */
  rate?: number;
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
  /** Each contract's expiry window partition against the day (item 6: 0 the day itself, 1 to its Friday, 2 to monthly
      OPEX, 3 the rest) — partOf */
  part: Uint8Array;
  /** Each contract's observations, oldest first */
  obs: Obs[][];
  /** The chain reads' moments, oldest first — a column's inputs are named by the newest at or before it */
  reads: number[];
  seedDate: string | null;
  /** The rate the universe is priced on (ServerInputs.rate); undefined: UW's convention */
  rate?: number;
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

/* ---- THE EXPIRY WINDOWS (the owner's item 6, 2026-10-14: "pills for 0DTE / To Friday / To monthly OPEX / All 60 days
   (current default). Field, flip, walls, regime strip and p85 reference all follow the selection … partition: the sum
   over disjoint windows equals All per strike per minute") ------------------------------------------------------------ */

/** A window: the expiries settling the session's day, to its Friday, to the monthly OPEX, or all the universe holds */
export type ExpiryWindow = '0dte' | 'fri' | 'opex' | 'all';
export const WINDOWS: readonly ExpiryWindow[] = ['0dte', 'fri', 'opex', 'all'];
/** The disjoint partitions the windows are cumulative sums of */
export const PARTS = 4;
/** A window's last partition: 0DTE the first alone, To Friday the first two, To OPEX three, All four */
export const WINDOW_TOP: Record<ExpiryWindow, number> = { '0dte': 0, fri: 1, opex: 2, all: 3 };
const isoOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
/** The month's third Friday */
function thirdFriday(y: number, m: number): string {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return isoOf(y, m, 1 + ((5 - first + 7) % 7) + 14);
}
/** The window ends for a session's day: the Friday of its week (the day itself on a Friday — a holiday Friday's expiry
    falls the Thursday before, inside it) and the monthly OPEX, the third Friday on or after the day */
export function windowEnds(day: string): { fri: string; opex: string } {
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const fri = isoOf(y, m, d + ((5 - wd + 7) % 7));
  let opex = thirdFriday(y, m);
  if (opex < day) opex = m === 12 ? thirdFriday(y + 1, 1) : thirdFriday(y, m + 1);
  return { fri, opex };
}
/** A contract's partition: 0 its expiry is the day, 1 after it to the Friday, 2 after the Friday to the OPEX, 3 after */
export function partOf(expiry: string, day: string, ends: { fri: string; opex: string } = windowEnds(day)): 0 | 1 | 2 | 3 {
  return expiry <= day ? 0 : expiry <= ends.fri ? 1 : expiry <= ends.opex ? 2 : 3;
}
/** A column's per-strike sums by partition, in the levels' order: gamma, delta, the gamma priced, priced on today's
    vols, and on a vol older than an hour — five quantities × four partitions a strike */
export const PART_STRIDE = 5 * PARTS;

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
    part: (ends => Uint8Array.from(kept.map(c => partOf(c.expiry, day, ends))))(windowEnds(day)),
    obs: kept.map(c => c.obs),
    reads: [...new Set([...reads.map(r => r.receivedAt), ...tickEnds])].sort((a, b) => a - b),
    seedDate: seed?.date ?? null,
    ...(inputs.rate != null && Number.isFinite(inputs.rate) ? { rate: inputs.rate } : {}),
  };
}
/** The rate a universe is priced on: its own (a Theta-rebuilt session's day rate), else UW's fitted convention */
export const rateOf = (u: Pick<Universe, 'rate'>): number => u.rate ?? UW_VOL_CONVENTION.r;

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

/* ---- THE POINT-IN-TIME PROBE (the owner's item 8, 2026-10-14: "the data layer asserts every read <= cursor") ------
   Set by an audit (scripts/replay-proof.ts), every observation a column or a straddle reads reports the moment it became
   knowable — a vol, a count of open interest, a chain read — and the audit counts any past its cursor. Unset in use: one
   branch a read. */
export type PitKind = 'vol' | 'open interest' | 'chain read';
let pitProbe: ((what: PitKind, at: number) => void) | null = null;
export function setPitProbe(fn: ((what: PitKind, at: number) => void) | null): void {
  pitProbe = fn;
}

/** The newest observation knowable by `by`, or null */
function obsAt(list: readonly Obs[], by: number): Obs | null {
  let out: Obs | null = null;
  for (const o of list) {
    if (o.at > by) break;
    out = o;
  }
  if (pitProbe && out) pitProbe('vol', out.at);
  return out;
}

/** The newest count of open interest received by `by`, 0 for none yet */
export function oiAt(list: readonly OiObs[], by: number): number {
  let out = 0;
  let at = 0;
  for (const o of list) {
    if (o.at > by) break;
    out = o.oi;
    at = o.at;
  }
  if (pitProbe && at) pitProbe('open interest', at);
  return out;
}

/** The newest chain read knowable by `by` (its moment), 0 for none */
export function readAt(u: Universe, by: number): number {
  let out = 0;
  for (const r of u.reads) {
    if (r > by) break;
    out = r;
  }
  if (pitProbe && out) pitProbe('chain read', out);
  return out;
}

/* ---- THE CHARM-TO-CLOSE DRIFT (the owner's item 10, 2026-10-14: "per minute, the projected change in aggregate dealer
   delta (naive sign) from t to 3:50 p.m. ET (avoids the expiry discontinuity) at constant spot and IV, for the selected
   window, as $ delta notional … Acceptance: equals model delta at (spot_t, IV_t, 3:50 p.m.) minus model delta at t, by
   full repricing. On screen: one number in How sure, labelled 'mechanical drift, unvalidated'") ------------------------ */

/** The drift's end: 3:50 pm New York, ten minutes before the day's expiry — on a half day ten minutes before its 1:00 pm
    close — so the expiry's own step never enters */
export function driftEndOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const end = Math.min(15 * 60 + 50, closeMinuteOn(new Date(y, m - 1, d)) - 10);
  return nyWallTime(y, m, d, Math.floor(end / 60), end % 60);
}
/** THE DEALERS' DELTA in dollars of the underlying (open interest × 100 × delta × price), the house's sign (each
    contract's delta turned over — the field's delta lens, levels.ts feedStrike on the vendor's book), by expiry
    partition: every contract `only` admits, priced at the bar's close on its vol knowable at the bar's end, its clock at
    `clock` on UW's (today's expiry on the time left, a later one on whole days, the same all session) */
export function dealerDeltaAt(u: Universe, bar: { time: number; close: number }, clock: number, only?: (j: number) => boolean): Float64Array {
  const spot = bar.close;
  const knowBy = (bar.time + 60) * 1000;
  const out = new Float64Array(PARTS);
  for (let i = 0; i < u.strikes.length; i++) {
    const k = u.strikes[i];
    for (let j = u.start[i]; j < u.start[i + 1]; j++) {
      if (only && !only(j)) continue;
      if (u.expires[j] <= clock) continue;
      const o = obsAt(u.obs[j], knowBy);
      if (!o) continue;
      const oi = oiAt(u.oiObs[j], knowBy);
      if (!(oi > 0)) continue;
      const g = blackScholesGreeks(spot, k, u.years[j] > 0 ? u.years[j] : (u.expires[j] - clock) / YEAR_MS, o.iv, rateOf(u), UW_VOL_CONVENTION.q);
      out[u.part[j]] += -oi * 100 * spot * (u.call[j] ? g.deltaCall : g.deltaPut);
    }
  }
  return out;
}
/** THE DRIFT at a minute, by expiry partition: the dealers' delta repriced at the drift's end minus at the minute — the
    price and every vol held. On UW's clock only today's expiry's time moves inside a session (a later one is whole days,
    the same all session, so its repricing returns the same delta — scripts/charm-drift-proof.ts prices every contract
    and checks it), so today's contracts alone are repriced. Null at or past the end, or with none of today's contracts
    standing. */
export function driftToClose(u: Universe, bar: { time: number; close: number }): Float64Array | null {
  const clock = bar.time * 1000 + 30_000;
  const end = driftEndOf(u.day);
  if (clock >= end) return null;
  const today = (j: number) => !(u.years[j] > 0) && u.expires[j] > end;
  let any = false;
  for (let j = 0; j < u.expires.length && !any; j++) any = today(j);
  if (!any) return null;
  const now = dealerDeltaAt(u, bar, clock, today);
  const then = dealerDeltaAt(u, bar, end, today);
  for (let q = 0; q < PARTS; q++) then[q] -= now[q];
  return then;
}
/** A column's drift through an expiry window — the window's partitions summed; null where the column carries none */
export function driftOf(snap: Pick<GexSnapshot, 'drift'>, w: ExpiryWindow): number | null {
  if (!snap.drift) return null;
  let x = 0;
  for (let q = 0; q <= WINDOW_TOP[w]; q++) x += snap.drift[q];
  return x;
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
  /* the strike's sums by expiry partition (item 6) — the window views add them up, so every window is priced in this
     one pass and a switch asks nothing */
  const parts: number[] = [];
  const pv = new Float64Array(PART_STRIDE);
  for (let i = a; i < b; i++) {
    const k = u.strikes[i];
    pv.fill(0);
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
      const g = blackScholesGreeks(spot, k, u.years[j] > 0 ? u.years[j] : (u.expires[j] - clock) / YEAR_MS, o.iv, rateOf(u), UW_VOL_CONVENTION.q);
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
      const q = u.part[j];
      pv[q] += u.call[j] ? -gw : gw;
      pv[PARTS + q] += -w * (u.call[j] ? g.deltaCall : g.deltaPut);
      pv[2 * PARTS + q] += gw;
      if (!o.carried) pv[3 * PARTS + q] += gw;
      if (clock - o.trade > STALE_MS) pv[4 * PARTS + q] += gw;
      if (o.trade < stale) {
        stale = o.trade;
        staleBound = o.bound;
      }
      if (o.trade > newest) newest = o.trade;
      /* on a vol older than an hour at this minute — the hover says how much of the strike stands on one */
      if (clock - o.trade > STALE_MS) old += gw;
    }
    if (all <= 0) continue;
    for (let x = 0; x < PART_STRIDE; x++) parts.push(pv[x]);
    const coverage = fresh / all;
    /* the house's sign (levels.ts feedStrike): the calls' gamma and every delta turned over, the puts' gamma as is */
    /* `gross` (the owner's B3): the calls' and the puts' gamma added without sign — `all`, the strike's size on the map */
    levels.push({ strike: k, value: -gc + gp, gross: all, dex: -dc - dp, prov: coverage >= 0.5 ? 'modeled' : 'carried', staleSince: Number.isFinite(stale) ? stale : undefined, ...(staleBound && Number.isFinite(stale) ? { staleBound: true } : {}), ...(newest > 0 ? { freshAt: newest } : {}), staleShare: old / all, coverage });
  }
  const drift = driftToClose(u, bar);
  return { time: bar.time, levels, spot, rebuilt: true, parts: Float32Array.from(parts), ...(drift ? { drift } : {}) };
}

/** A column seen through an expiry window (item 6): each strike's gamma and delta summed over the window's partitions,
    its provenance and stale share over the window's own contracts; a strike the window holds nothing at is left out.
    The vols' newest and oldest trade times are the strike's over every expiry, so a window view leaves them out rather
    than claim them. 'all', or a column without partitions (the house's field, a book read as it stood), is itself. */
const viewCache: Record<Exclude<ExpiryWindow, 'all'>, WeakMap<GexSnapshot, GexSnapshot>> = { '0dte': new WeakMap(), fri: new WeakMap(), opex: new WeakMap() };
export function windowView(snap: GexSnapshot, w: ExpiryWindow): GexSnapshot {
  const p = snap.parts;
  if (w === 'all' || !p || p.length !== snap.levels.length * PART_STRIDE) return snap;
  const cache = viewCache[w];
  const had = cache.get(snap);
  if (had) return had;
  const top = WINDOW_TOP[w];
  const sum = (base: number) => {
    let x = 0;
    for (let q = 0; q <= top; q++) x += p[base + q];
    return x;
  };
  const levels: GexLevel[] = [];
  snap.levels.forEach((l, i) => {
    const o = i * PART_STRIDE;
    const all = sum(o + 2 * PARTS);
    if (!(all > 0)) return;
    const coverage = sum(o + 3 * PARTS) / all;
    levels.push({ strike: l.strike, value: sum(o), gross: all, dex: sum(o + PARTS), prov: coverage >= 0.5 ? 'modeled' : 'carried', staleShare: sum(o + 4 * PARTS) / all, coverage, ...(l.at != null ? { at: l.at } : {}) });
  });
  /* the drift by partition rides along: driftOf sums it through the window it is asked for */
  const view: GexSnapshot = { time: snap.time, levels, spot: snap.spot, rebuilt: snap.rebuilt, ...(snap.drift ? { drift: snap.drift } : {}) };
  cache.set(snap, view);
  return view;
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
  /** The day's rate (a Theta-rebuilt session); absent, UW's convention */
  rate?: number;
}
/** The positions dated the session are knowable at its open (and stand from 7:00 am, universeOf); no vol comes with them */
export function pastInputs(p: PastInputsLike): ServerInputs {
  const [y, m, d] = p.day.split('-').map(Number);
  const open: ChainRead = { receivedAt: nyWallTime(y, m, d, 9, 30), rows: p.oi.map(([sym, oi]) => [sym, oi, null, null]) };
  return { chains: [open], seed: p.seed, total: p.total ?? null, ticks: p.ticks ?? {}, ...(p.rate != null ? { rate: p.rate } : {}) };
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
  /** `before`'s own reach: its newest session and how many it holds (absent on a file written before 2026-10-14) */
  beforeThrough?: string;
  beforeSessions?: number;
  /** The sessions a reference reaches back over */
  trailing: number;
  /** THE SAME BY EXPIRY WINDOW (item 6): the nets of the window's partitions, over the sessions whose rows carry them —
      absent for a window no session holds yet */
  windows?: Partial<Record<Exclude<ExpiryWindow, 'all'>, Omit<RegimeReference, 'windows'>>>;
}
/** The window's reference, 'all' the reference itself; null where none is kept */
export const regimeForWindow = (ref: RegimeReference | null, w: ExpiryWindow): Omit<RegimeReference, 'windows'> | null => (!ref ? null : w === 'all' ? ref : ref.windows?.[w] ?? null);
/** A row's net in a window: its partitions summed to the window's last, or null for a row without them */
export const windowNet = (r: { net: number; netP?: readonly number[] }, w: ExpiryWindow): number | null => {
  if (w === 'all') return r.net;
  if (!r.netP || r.netP.length !== PARTS) return null;
  let x = 0;
  for (let q = 0; q <= WINDOW_TOP[w]; q++) x += r.netP[q];
  return x;
};
/** The reference off sessions' rows (ascending by day): the trailing N sessions' nets by half-hour bucket */
export function buildRegimeReference(name: string, sessions: readonly { day: string; rows: readonly { m: number; net: number; netP?: readonly number[] }[] }[], trailing = 250, minuteOf: (ms: number) => number): RegimeReference {
  const sorted = [...sessions].sort((a, b) => a.day.localeCompare(b.day));
  const build = (set: readonly { rows: readonly { m: number; net: number }[] }[]): (number[] | null)[] => {
    const by: number[][] = Array.from({ length: REGIME_BUCKETS }, () => []);
    for (const s of set.slice(-trailing)) for (const r of s.rows) {
      const b = regimeBucketOf(minuteOf(r.m));
      if (b != null && Number.isFinite(r.net)) by[b].push(r.net);
    }
    return by.map(regimeQuantiles);
  };
  const base = { name, through: sorted[sorted.length - 1]?.day ?? '', sessions: Math.min(trailing, sorted.length), buckets: build(sorted), before: build(sorted.slice(0, -1)), beforeThrough: sorted[sorted.length - 2]?.day ?? '', beforeSessions: Math.min(trailing, Math.max(0, sorted.length - 1)), trailing };
  /* per window: the sessions whose rows carry their partitions, each row's net the window's */
  const windows: NonNullable<RegimeReference['windows']> = {};
  for (const w of ['0dte', 'fri', 'opex'] as const) {
    const held = sorted
      .filter(s => s.rows.length && s.rows.every(r => windowNet(r, w) != null))
      .map(s => ({ day: s.day, rows: s.rows.map(r => ({ m: r.m, net: windowNet(r, w) as number })) }));
    if (held.length) windows[w] = { name, through: held[held.length - 1].day, sessions: Math.min(trailing, held.length), buckets: build(held), before: build(held.slice(0, -1)), beforeThrough: held[held.length - 2]?.day ?? '', beforeSessions: Math.min(trailing, Math.max(0, held.length - 1)), trailing };
  }
  return Object.keys(windows).length ? { ...base, windows } : base;
}
/** The quantiles a page on `day` may read — never a session at or after it */
export function regimeBucketsFor(ref: RegimeReference, day: string): (number[] | null)[] | null {
  if (!ref.through) return null;
  if (day > ref.through) return ref.buckets;
  if (day === ref.through) return ref.before;
  return null;
}
/** What the quantiles a page on `day` reads reach over — their newest session and how many (regimeBucketsFor's own
    choice); null where they are none, the count null on a file that does not say it */
export function regimeReachFor(ref: RegimeReference, day: string): { through: string; sessions: number | null } | null {
  if (!ref.through) return null;
  if (day > ref.through) return { through: ref.through, sessions: ref.sessions };
  if (day === ref.through) return { through: ref.beforeThrough ?? '', sessions: ref.beforeSessions ?? null };
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

/** A WALL THAT MOVED (the field's wall chips, 2026-10-13): the call or put wall changed strike and the new strike held
    `hold` columns in a row — a wall trading places with its neighbour for a moment is not a move. `time` and `i` are
    the first column of the new strike. One rule for the chart's chips (gexNodesPrimitive) and the session recap. */
export interface WallMove {
  kind: 'CW' | 'PW';
  from: number;
  to: number;
  time: number;
  i: number;
}
export const WALL_HOLD = 3;
export function wallMovesOf(end: number, columnAt: (i: number) => { cw: number | null; pw: number | null; time: number }, hold = WALL_HOLD, start = 0): WallMove[] {
  const moves: WallMove[] = [];
  for (const kind of ['CW', 'PW'] as const) {
    let held: number | null = null;
    let cand: number | null = null;
    let candAt = -1;
    let run = 0;
    for (let ci = start; ci < end; ci++) {
      const c = columnAt(ci);
      const w = kind === 'CW' ? c.cw : c.pw;
      if (w == null) continue;
      if (held == null) {
        held = w;
        continue;
      }
      if (w === held) {
        cand = null;
        run = 0;
        continue;
      }
      if (w !== cand) {
        cand = w;
        candAt = ci;
        run = 1;
      } else run++;
      if (run >= hold && cand != null) {
        moves.push({ kind, from: held, to: cand, time: columnAt(candAt).time, i: candAt });
        held = cand;
        cand = null;
        run = 0;
      }
    }
  }
  return moves;
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
  /** The straddle's own vol: the one vol that prices this straddle at its strike on UW's clock (solved) */
  iv?: number;
  /** Years to the expiry's last trade at the read, UW's clock */
  tau?: number;
  /** The spot it was read at */
  spot?: number;
}
/** The nearest strike to spot holding both legs, within 2% of it */
const ATM_BAND = 0.02;

/** The straddle's price at a strike, UW's carry */
const straddlePrice = (spot: number, k: number, tau: number, iv: number) =>
  blackScholesPrice(spot, k, tau, iv, 'C', UW_VOL_CONVENTION.r, UW_VOL_CONVENTION.q) + blackScholesPrice(spot, k, tau, iv, 'P', UW_VOL_CONVENTION.r, UW_VOL_CONVENTION.q);
/** The vol that prices a straddle at `value` (bisection, 0.1% to 500%); NaN where no vol reaches it (under intrinsic) */
export function straddleVol(spot: number, k: number, tau: number, value: number): number {
  if (!(tau > 0) || !(value > 0)) return NaN;
  let lo = 0.001;
  let hi = 5;
  if (straddlePrice(spot, k, tau, lo) > value || straddlePrice(spot, k, tau, hi) < value) return NaN;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (straddlePrice(spot, k, tau, mid) < value) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** THE PRICED MOVE IN DOLLARS (the owner's item 4): 1σ = spot × the straddle's own vol × √τ — the nearest strike's
    straddle solved for its vol and applied at the money. It is straddle ÷ 0.798 when spot sits on a strike, and it
    reaches 0 at the expiry's close (a nearest-strike mid ÷ 0.798 would keep up to half a strike of intrinsic and never
    reach 0 — the plan's acceptance (i)) */
export const sigmaOf = (r: StraddleRead | null | undefined): number | null =>
  r && r.iv != null && Number.isFinite(r.iv) && r.tau != null && r.tau > 0 && r.spot != null ? r.spot * r.iv * Math.sqrt(r.tau) : r && r.tau != null && r.tau <= 0 ? 0 : null;

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
    let tau = 0;
    for (let j = u.start[i]; j < u.start[i + 1]; j++) {
      if (u.expiry[j] !== expiry || u.expires[j] <= clock) continue;
      const o = obsAt(u.obs[j], knowBy);
      if (!o || !(o.iv > 0)) continue;
      const t = u.years[j] > 0 ? u.years[j] : (u.expires[j] - clock) / YEAR_MS;
      const px = blackScholesPrice(spot, u.strikes[i], t, o.iv, u.call[j] ? 'C' : 'P', rateOf(u), UW_VOL_CONVENTION.q);
      if (!Number.isFinite(px)) continue;
      tau = t;
      if (u.call[j]) {
        c = px;
        civ = o.iv;
      } else {
        p = px;
        piv = o.iv;
      }
    }
    if (c != null && p != null) return { expiry, strike: u.strikes[i], value: c + p, src: 'model', call: civ, put: piv, iv: straddleVol(spot, u.strikes[i], tau, c + p), tau, spot };
  }
  return null;
}
/**
 * THE STRADDLE AT A MINUTE — one rule for the recorder's shown rows, the rebuild's final rows and the replay (the owner's
 * item 8: the replay's frame is the live frame). 'shown': the NBBO mids of a chain read received inside the minute, its
 * vol solved on UW's clock at the minute's middle, else the model's price at the minute; 'final': the model's price alone.
 */
export function straddleOfMinute(u: Universe, chains: readonly { receivedAt: number; rows: readonly ChainRow[] }[], day: string, bar: { time: number; close: number }, expiry: string, kind: 'shown' | 'final'): StraddleRead | null {
  if (kind === 'final') return straddleAt(u, bar, expiry);
  const m = bar.time * 1000;
  const end = m + 60_000;
  const read = chains.find(c => c.receivedAt >= m && c.receivedAt < end) ?? null;
  if (read && pitProbe) pitProbe('chain read', read.receivedAt);
  const tau = expiry === day ? Math.max(0, (lastTradeOf(expiry) - (m + 30_000)) / YEAR_MS) : uwYears(m + 30_000, lastTradeOf(expiry), expiry, day);
  return (read ? straddleFromChain(read.rows, expiry, bar.close, tau) : null) ?? straddleAt(u, bar, expiry);
}
/** The at-the-money straddle off a chain read's NBBOs: the strike nearest spot whose call and put both carry a bid and
    an ask; null where the read carries none (a read before 2026-10-13, or outside quoting hours). `tau` — the years to
    the expiry's last trade at the read on UW's clock — solves its vol */
export function straddleFromChain(rows: readonly ChainRow[], expiry: string, spot: number, tau?: number): StraddleRead | null {
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
  if (best && tau != null) {
    best.tau = tau;
    best.spot = spot;
    best.iv = straddleVol(spot, best.strike, tau, best.value);
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
export function fieldResidual(field: readonly GexSnapshot[], books60: readonly FeedBook60[], universe = 'within 60 days'): string | null {
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
  return `The field is modeled, never rescaled to the vendor. Against Unusual Whales' book on the same strikes and expiries (${universe}, ${books} read today): strike by strike it differs by ${(med(gaps) * 100).toFixed(1)}% of the book's size at the median; summed over those strikes it has the same sign in ${same} of ${n}, at ${med(ratios).toFixed(2)}× the book's size at the median.`;
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

/* ---- THE REGIME'S WORDS (the Terrain UI pass, 2026-10-14) ----------------------------------------------------------
   One reading for the strip's chip and the decision strip's box, so the two can never disagree: the meaning, never the
   bare sign (the owner: "Labels say the meaning, not the bare sign ('calls absorb −$2.1B')"), the percentile against the
   same half-hour over the reference's sessions, and the attribution against UW's directional series. */

export interface RegimeRead {
  /** The column's net in the house's sign (puts positive) */
  net: number;
  /** Its percentile within the half-hour's reference, null without one */
  pct: number | null;
  /** The sessions the percentile stands on */
  refSessions: number;
  /** Whether a reference exists for the day at all (the chip says which "no reference" it is) */
  hasReference: boolean;
  attribution: 'robust' | 'dependent' | 'unchecked';
  /** The bar's time (epoch s) when it lies outside the regular session's half-hours, else null */
  outsideAt: number | null;
}

/** "puts amplify" where the net is positive in the house's sign, "calls absorb" where it is negative */
export const regimeSide = (net: number): 'puts amplify' | 'calls absorb' => (net < 0 ? 'calls absorb' : 'puts amplify');

/** The reading of one column against the reference: `nyMinute` is the column's minute of New York's day, `today` its
    New York date, `dir` UW's directional sign in the house's sign (null: unchecked) */
export function regimeReadOf(net: number, nyMinute: number, today: string, ref: RegimeReference | null, dir: 1 | -1 | 0 | null, at: number): RegimeRead {
  const buckets = ref ? regimeBucketsFor(ref, today) : null;
  const k = regimeBucketOf(nyMinute);
  const q = buckets && k != null ? buckets[k] : null;
  const pct = q ? regimePercentile(net, q) : null;
  const refSessions = ref ? (today === ref.through ? Math.max(0, ref.sessions - 1) : ref.sessions) : 0;
  const attribution: RegimeRead['attribution'] = dir == null ? 'unchecked' : Math.sign(net) === dir ? 'robust' : 'dependent';
  return { net, pct, refSessions, hasReference: !!buckets, attribution, outsideAt: k == null ? at : null };
}

/** The chip's words: "puts amplify +$13.9B, 96th pct of 12 sessions · attribution-dependent" (`money` prints the net,
    `clock` a bar's time on the reader's clock) */
export function regimeWordsOf(r: RegimeRead, money: (v: number) => string, clock: (ms: number) => string): string {
  const sign = `${regimeSide(r.net)} ${money(r.net)}`;
  const pctWords = (r.pct == null ? (r.hasReference ? 'no reference for this half-hour' : 'no reference yet') : `${ordinal(r.pct)} pct of ${r.refSessions} session${r.refSessions === 1 ? '' : 's'}`) + (r.outsideAt != null ? ` at the ${clock(r.outsideAt * 1000)} bar` : '');
  const attribution = r.attribution === 'unchecked' ? 'attribution unchecked' : r.attribution === 'robust' ? 'attribution-robust' : 'attribution-dependent';
  return `${sign}, ${pctWords} · ${attribution}`;
}
