/*
==================================================
  SLAYER TERMINAL - THE STRIKE FIELD, MODELED
  (data/feed/trailField.ts)

  TERRAIN'S TRAIL ON THE FEED, FULL (2026-10-13 — the
  owner: "whats wrong with the exposure trails on
  terrian, why doesnt it look like the UI mockup?").
  The house's field is the book a minute across the
  session (core/simulator.ts keeps one a bar). UW
  answers a name's book by strike as it stands now and
  never for an earlier minute, so the field showed only
  what had been read: a few columns, or one after hours.

  So every minute of today is MODELED from real inputs
  with the house's own pricer — estimated dealer gamma
  under an assumed sign — under the rules of the
  research (reports/Dealer exposure reconstruction.md
  §5, §8): no cell uses anything that was not knowable
  at its minute.

  THIS FILE IS THE ONE PLACE THE MODEL LIVES. Every
  choice is named in TRAIL_MODEL and its version
  travels with every column (trailMeta); a change of
  method is a change here and a new version.

  THE INPUTS (recorded by the local server as they are
  received — server/fieldRecorder.ts):
    · THE UNIVERSE AND THE OPEN INTEREST: the name's
      contracts listed within 60 days with open
      interest, from UW's /option-contracts — today's
      count (the row dated today, the positions at the
      session before's close), static all day.
    · THE VOL, AS OF EACH MINUTE: per contract, the vol
      of the newest chain read the server RECEIVED at
      or before the minute's end (a read every ten
      minutes through the session); before the day's
      first read, the session before's close vol
      (/option-chains?date=, the vol knowable at the
      open) — CARRIED, fixed-strike (each contract keeps
      its own vol between observations: the
      sticky-strike assumption, stated). A vol read in
      its expiry's last hour is not used (UW figures it
      on the minutes left; a far strike reads 500% and
      more) — the contract's earlier observation stands.
      A contract with no observation stays out of the
      sum and its strike's coverage drops; nothing is
      zero-filled or borrowed from a neighbour.
    · THE PRICE: the minute bar's close (UW's 1-minute
      bars). A column is knowable at its bar's end.
  THE PRICER: core/greeks.ts blackScholesGreeks at the
  bar's close, ON THE CLOCK AND CARRY UW SOLVED ITS
  VOLS UNDER (UW_VOL_CONVENTION — measured 2026-10-13
  on 8,096 in-session prints of six names, docs/
  research-2026-10-13/uw-vol-convention.md): a vol is
  only right on the τ it was inverted with, and UW's
  is European Black–Scholes at r 4.15% and no dividend,
  a contract expiring today on the calendar time from
  the bar's middle to its last-trading instant (16:00
  New York, 13:00 on a half day — data/expiryClass.ts
  closeMinuteOn), a later one on WHOLE calendar days
  (its date less today's) over 365, the same all
  session. Priced so, a contract's gamma at UW's vol is
  UW's own (median 0.002–0.04% through 60 days); on
  calendar time to the close with the house's carry it
  was 2–4% off the day after tomorrow's and nearer
  contracts', 8% at the open. A contract past its
  last-trading instant holds nothing.
  THE UNITS: open interest × greek × price² — dollars
  per 1% (× 100 shares × 1% of the price), UW's own
  /spot-exposures/strike units. THE SIGN (assumed —
  open interest does not say who holds what): the
  house's, the calls' gamma negative, the puts'
  positive, every delta turned over (levels.ts
  feedStrike). 30 strikes each side of the bar's price.

  NO CALIBRATION. The modeled magnitudes are never
  rescaled to UW's readings: the books the server
  captured are a MEASURED REFERENCE beside the field
  (the hover's readout) and the residual against UW's
  book on the model's own universe — the expiries
  within 60 days, summed per strike, read every five
  minutes (books60) — strike by strike and summed over
  the strikes both hold, is said in "How sure"
  (fieldResidual), never blended in. UW's whole-book
  series and its every-expiry book are kept and shown,
  never measured against: a different universe.

  EVERY CELL CARRIES ITS PROVENANCE (GexLevel.prov):
  'modeled' (at least half its gamma priced on a vol
  read today), 'carried' (most of it on the session
  before's close vol); a strike no contract could be
  priced at is MISSING — left out, a gap; and
  `staleSince`, the oldest trade a vol it used came from.

  AN EXPIRY CUT (the pane's expiry card on one listed
  date): the same model on that date's contracts alone.

  THE SESSIONS BEFORE TODAY (2026-10-13 — the owner:
  "we need to plug it in"): the server rebuilds each
  from UW's dated history (server/fieldBackfill.ts) —
  the open interest dated the session, the session
  before's close vols, and every contract's vols minute
  by minute as it traded (`ticks`, each knowable at its
  minute's end) — and the SAME model prices it on the
  chart's own minutes, its regular session alone. UW
  serves no book by strike for a past minute, so a past
  session has no measured reference beside it.

  DISCRETE: a bead is one strike at one minute — no
  smoothing between strikes or minutes; a minute with
  no bar is a gap. THE SCALE (gexNodesPrimitive): each
  column's beads are measured against the columns at or
  before it, so nothing to its right changes it.

  OFF THE MAIN FRAME: minutes are priced in slices of
  8 ms, one task apart, each minute once per set of
  inputs, and nothing runs while the tab is hidden. An
  index has no bars on these plans: nothing is asked.
==================================================
*/

import { useEffect, useSyncExternalStore } from 'react';
import { blackScholesGreeks } from '../../core/greeks';
import { nyIsoDate, nyWallTime } from '../../core/nyTime';
import { closeMinuteOn } from '../expiryClass';
import type { Candle, GexLevel, GexSnapshot } from '../../types/market';
import type { FeedBook, FeedBook60 } from './levels';

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
  version: 'trail-2026-10-13.3',
  what: 'estimated dealer gamma (assumed sign)',
  openInterest: "today's count — UW's row dated today, the positions at the session before's close; static all day",
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
export type ChainRow = [string, number, number | null, number | null];
export interface ChainRead {
  receivedAt: number;
  rows: ChainRow[];
}
/** The session before's close: [OCC symbol, vol or null, its trade's time (ms) or null] */
export interface SeedRead {
  date: string;
  receivedAt: number;
  rows: [string, number | null, number | null][];
}
export interface TotalRead {
  receivedAt: number;
  rows: [number, number | null, number][];
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
  oi: Float64Array;
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

/**
 * The universe of a name for a day from what the server recorded: the contracts the chain reads list (its own root
 * only — an adjusted root is another deliverable), open interest from the newest read (it is the same count all day),
 * and every vol observation with the moment it became knowable.
 */
export function universeOf(ticker: string, day: string, inputs: ServerInputs, cut: string | null = null): Universe {
  const t = ticker.toUpperCase();
  type C = { strike: number; expiry: string; call: boolean; oi: number; obs: Obs[] };
  const bySym = new Map<string, C>();
  const reads = [...inputs.chains].sort((a, b) => a.receivedAt - b.receivedAt);
  for (const read of reads) {
    for (const [sym, oi, iv, trade] of read.rows) {
      const p = parseOcc(sym);
      if (!p || p.root !== t || p.expiry < day || (cut && p.expiry !== cut) || !(p.strike > 0)) continue;
      let c = bySym.get(sym);
      if (!c) bySym.set(sym, (c = { strike: p.strike, expiry: p.expiry, call: p.right === 'C', oi, obs: [] }));
      c.oi = oi;
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
    for (const [sym, iv, trade] of seed.rows) {
      const c = bySym.get(sym);
      if (!c || iv == null || !(iv > 0) || lastTradeOf(c.expiry) - knowable < LAST_HOUR_MS) continue;
      c.obs.unshift({ at: knowable, iv, ...tradeTimeOf(trade, knowable), carried: true });
    }
  }
  const kept = [...bySym.values()].filter(c => c.oi > 0).sort((a, b) => a.strike - b.strike);
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
    oi: Float64Array.from(kept.map(c => c.oi)),
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
      const g = blackScholesGreeks(spot, k, u.years[j] > 0 ? u.years[j] : (u.expires[j] - clock) / YEAR_MS, o.iv, UW_VOL_CONVENTION.r, UW_VOL_CONVENTION.q);
      const w = u.oi[j] * s2;
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
export interface TrailMeta {
  kind: 'modeled';
  model: string;
  /** The newest chain read its vols could come from (epoch ms), 0 when every vol was the session before's close */
  readAt: number;
  seedDate: string | null;
}
const metas = new WeakMap<GexSnapshot, TrailMeta>();
/** How a column of the field was made — null for the house's own field */
export const trailMeta = (snap: GexSnapshot): TrailMeta | null => metas.get(snap) ?? null;

/* ---- the store: a name's field, built in slices -------------------------------------------------------------- */

/** What the server recorded or rebuilt for a name, by New York date — today's as it comes, a past session's whole */
const inputsByName = new Map<string, Map<string, { inputs: ServerInputs; version: number }>>();
const subs = new Map<string, Set<() => void>>();
const daysOf = (t: string) => {
  let m = inputsByName.get(t);
  if (!m) inputsByName.set(t, (m = new Map()));
  return m;
};

/** levels.ts hands in what the server recorded today (its chain reads, its seed, UW's whole-book series) */
export function takeServerInputs(ticker: string, day: string, part: Partial<ServerInputs>): void {
  const t = ticker.toUpperCase();
  const days = daysOf(t);
  let cur = days.get(day);
  if (!cur) days.set(day, (cur = { inputs: { chains: [], seed: null, total: null }, version: 0 }));
  let changed = false;
  for (const c of part.chains ?? [])
    if (!cur.inputs.chains.some(x => x.receivedAt === c.receivedAt)) {
      cur.inputs.chains = [...cur.inputs.chains, c].sort((a, b) => a.receivedAt - b.receivedAt);
      changed = true;
    }
  if (part.seed && part.seed.receivedAt !== cur.inputs.seed?.receivedAt) {
    cur.inputs.seed = part.seed;
    changed = true;
  }
  if (part.total && part.total.receivedAt !== cur.inputs.total?.receivedAt) {
    cur.inputs.total = part.total;
    for (const s of trails.values()) if (s.t === t && s.out.length) publish(s);
  }
  if (!changed) return;
  cur.version++;
  for (const s of trails.values()) if (s.t === t) schedule();
}

/** levels.ts hands in a past session the server rebuilt (server/fieldBackfill.ts), whole and final */
export function takePastSession(ticker: string, day: string, inputs: ServerInputs): void {
  const t = ticker.toUpperCase();
  const days = daysOf(t);
  if (days.has(day)) return;
  days.set(day, { inputs, version: 1 });
  for (const s of trails.values()) if (s.t === t) schedule();
}

/** The sessions whose inputs are in for a name, New York dates */
export const sessionsIn = (ticker: string): string[] => [...(inputsByName.get(ticker.toUpperCase())?.keys() ?? [])];

/** The books read today for a name — the measured reference (levels.ts hands them in): UW's per-strike book, every
    expiry, read a minute; and its book on the model's universe (the expiries within 60 days), read every five minutes */
let booksOf: (t: string) => readonly FeedBook[] = () => [];
let books60Of: (t: string) => readonly FeedBook60[] = () => [];
export function setMeasuredSource(fn: (t: string) => readonly FeedBook[], fn60: (t: string) => readonly FeedBook60[] = () => []): void {
  booksOf = fn;
  books60Of = fn60;
}

/** How near a 60-day book must stand to a minute to be its reference, before the every-expiry book is shown instead */
const MEASURED_60_WITHIN_MS = 10 * 60_000;

/** The measured reference at a cell: UW's own figure for the strike in the newest book read at or before the minute's
    end, with the moment UW figured that strike and which universe the book spans — the model's own (the expiries
    within 60 days) when one was read within ten minutes, else UW's book on every expiry. Null with no such book */
export function measuredAt(ticker: string, strike: number, timeSec: number): { value: number; at: number; universe: '60 days' | 'every expiry' } | null {
  const by = (timeSec + 60) * 1000;
  const t = ticker.toUpperCase();
  let b60: FeedBook60 | null = null;
  for (const b of books60Of(t)) {
    if (b.at > by) break;
    b60 = b;
  }
  if (b60 && by - b60.at <= MEASURED_60_WITHIN_MS) {
    const row = b60.rows.find(r => r.strike === strike);
    if (row) return { value: row.net, at: b60.at, universe: '60 days' };
  }
  let book: FeedBook | null = null;
  for (const b of booksOf(t)) {
    if (b.at > by) break;
    book = b;
  }
  const row = book?.rows.find(r => r.strike === strike);
  return book && row ? { value: row.gex.net, at: row.time ?? book.at, universe: 'every expiry' } : null;
}

interface NameTrail {
  key: string;
  t: string;
  day: string;
  cut: string | null;
  bars: readonly Candle[];
  /** Each session's universe, with the inputs' version it was built on */
  us: Map<string, { u: Universe; version: number }>;
  /** The columns, every session's, by bar time, with the inputs they were made on */
  cols: Map<number, { snap: GexSnapshot; inputs: string }>;
  out: GexSnapshot[];
  residual: string | null;
  cost: { ms: number; minutes: number };
}

const trails = new Map<string, NameTrail>();
const ring = (key: string) => subs.get(key)?.forEach(f => f());
const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

let timer: ReturnType<typeof setTimeout> | null = null;
const SLICE_MS = 8;
function schedule() {
  if (timer != null || typeof window === 'undefined') return;
  timer = setTimeout(work, 0);
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => !hidden() && schedule());

/* New York's date of a bar, fast: the offset never changes inside an hour */
const hourDay = new Map<number, string>();
function barDay(timeSec: number): string {
  const h = Math.floor(timeSec / 3600);
  let d = hourDay.get(h);
  if (!d) {
    d = nyIsoDate(h * 3600_000);
    if (hourDay.size > 20000) hourDay.clear();
    hourDay.set(h, d);
  }
  return d;
}
/** Every bar of one New York date, oldest first */
export function dayBars(bars: readonly Candle[], day: string): Candle[] {
  const out: Candle[] = [];
  for (let i = bars.length - 1; i >= 0; i--) {
    const d = barDay(bars[i].time);
    if (d === day) out.push(bars[i]);
    else if (d < day) break;
  }
  return out.reverse();
}

function work() {
  timer = null;
  if (hidden()) return;
  const t0 = performance.now();
  let more = false;
  for (const s of trails.values()) {
    if (!subs.get(s.key)?.size) continue;
    const days = inputsByName.get(s.t);
    if (!days) continue;
    let did = false;
    /* today first, then the sessions before, newest first */
    for (const day of [...days.keys()].sort().reverse()) {
      if (day > s.day) continue;
      const inp = days.get(day)!;
      if (!inp.inputs.chains.length) continue;
      let built = s.us.get(day);
      if (!built || built.version !== inp.version) {
        const tS = performance.now();
        built = { u: universeOf(s.t, day, inp.inputs, s.cut), version: inp.version };
        s.us.set(day, built);
        s.cost.ms += performance.now() - tS;
      }
      const u = built.u;
      /* a past session draws its regular minutes alone (09:30–16:00): its hours outside them would hold only the
         session before's close vols, and ten sessions of every minute weigh too much */
      const [y, m, d] = day.split('-').map(Number);
      const from = day === s.day ? -Infinity : nyWallTime(y, m, d, 9, 30) / 1000;
      const to = day === s.day ? Infinity : nyWallTime(y, m, d, 16, 0) / 1000;
      for (const b of dayBars(s.bars, day)) {
        if (b.time < from || b.time >= to) continue;
        const r = readAt(u, (b.time + 60) * 1000);
        /* a minute is modeled once per set of inputs knowable at it: a new chain read moves only the minutes after it */
        const inputs = `${b.close}|${r}|${u.seedDate ?? ''}|${inp.version}`;
        if (s.cols.get(b.time)?.inputs === inputs) continue;
        const tS = performance.now();
        const snap = modelColumn(u, b);
        metas.set(snap, { kind: 'modeled', model: TRAIL_MODEL.version, readAt: r, seedDate: u.seedDate });
        s.cols.set(b.time, { snap, inputs });
        s.cost.minutes++;
        s.cost.ms += performance.now() - tS;
        did = true;
        if (performance.now() - t0 > SLICE_MS) {
          more = true;
          break;
        }
      }
      if (more) break;
    }
    if (did) publish(s);
    if (more) break;
  }
  if (more) schedule();
}

function publish(s: NameTrail) {
  s.out = [...s.cols.values()].map(c => c.snap).sort((a, b) => a.time - b.time);
  const t0 = performance.now();
  /* the residual is today's: UW's 60-day books read today against today's columns, on the strikes both hold */
  const todays = s.out.filter(c => barDay(c.time) === s.day);
  s.residual = s.cut ? null : fieldResidual(todays, books60Of(s.t));
  s.cost.ms += performance.now() - t0;
  ring(s.key);
}

function stateOf(t: string, cut: string | null): NameTrail {
  const day = nyIsoDate();
  const key = `${t}|${cut ?? 'all'}`;
  let s = trails.get(key);
  if (!s || s.day !== day) {
    s = { key, t, day, cut, bars: [], us: new Map(), cols: new Map(), out: [], residual: null, cost: { ms: 0, minutes: 0 } };
    trails.set(key, s);
  }
  return s;
}

const EMPTY: GexSnapshot[] = [];

export interface TrailField {
  snaps: GexSnapshot[];
  /** Today's minutes are modeled (the sessions before may be, while today's are not yet) */
  full: boolean;
  /** One line for "How sure": the field against UW's own figures, or null */
  residual: string | null;
}

/**
 * Terrain's strike field on the feed: today's minutes modeled from what was knowable at each (this file's header).
 * `cut` is one listed date, or null for every expiry; `reads` are the books read — the measured reference (their
 * residual moves when they do, never the field). `on` false (the house's market, an index) asks nothing.
 */
export function useFeedTrailField(on: boolean, ticker: string, bars: readonly Candle[] | null, reads: readonly GexSnapshot[], cut: string | null = null): TrailField {
  const t = ticker.toUpperCase();
  const live = on && !!t && !!bars;
  const key = `${t}|${cut ?? 'all'}`;
  useEffect(() => {
    if (!live || !bars) return;
    const s = stateOf(t, cut);
    if (s.bars !== bars) {
      s.bars = bars;
      schedule();
    }
  }, [live, t, cut, bars]);
  /* a new book read moves the residual, never the field */
  useEffect(() => {
    const s = trails.get(key);
    if (live && s && s.out.length) publish(s);
  }, [live, key, reads]);
  const snaps = useSyncExternalStore(
    fn => {
      const set = subs.get(key) ?? new Set();
      set.add(fn);
      subs.set(key, set);
      if (live) schedule();
      return () => set.delete(fn);
    },
    () => (live ? trails.get(key)?.out ?? EMPTY : EMPTY)
  );
  const s = live ? trails.get(key) : undefined;
  const day = s?.day ?? '';
  const full = snaps.length > 0 && barDay(snaps[snaps.length - 1].time) === day;
  return { snaps, full, residual: s?.residual ?? null };
}

if (typeof window !== 'undefined')
  (window as unknown as { __slayerTrail?: unknown }).__slayerTrail = {
    cost: (t: string, cut: string | null = null) => trails.get(`${t.toUpperCase()}|${cut ?? 'all'}`)?.cost ?? null,
    size: (t: string) => trails.get(`${t.toUpperCase()}|all`)?.out.length ?? 0,
    residual: (t: string) => trails.get(`${t.toUpperCase()}|all`)?.residual ?? null,
    /* the residual's figures: per 60-day book, the per-strike gap and the summed ratio on the strikes both hold */
    figures: (t: string) => {
      const s = trails.get(`${t.toUpperCase()}|all`);
      return s ? residualFigures(s.out.filter(c => barDay(c.time) === s.day), books60Of(s.t)) : null;
    },
    books60: (t: string) => books60Of(t.toUpperCase()).map(b => ({ at: b.at, spot: b.spot, expiries: b.expiries.length, rows: b.rows.length, sum: b.rows.reduce((x, r) => x + r.net, 0) })),
    prov: (t: string) => {
      const n: Record<string, number> = {};
      for (const s of trails.get(`${t.toUpperCase()}|all`)?.out ?? []) for (const l of s.levels) n[l.prov ?? 'house'] = (n[l.prov ?? 'house'] ?? 0) + 1;
      return n;
    },
    model: TRAIL_MODEL,
  };
