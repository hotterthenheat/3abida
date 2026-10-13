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
import { nyIsoDate, nyWallTime } from '../../core/nyTime';
import type { Candle, GexSnapshot } from '../../types/market';
import type { FeedBook, FeedBook60 } from './levels';
import { TRAIL_MODEL, oiPublishedAt, universeOf, readAt, modelColumn, fieldResidual, residualFigures } from './trailModel';
import type { ServerInputs, Universe } from './trailModel';

export * from './trailModel';

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
        /* a minute is modeled once per set of inputs knowable at it: a new chain read moves only the minutes after it —
           but the day's published count, received late, moves every column from the publication (the owner, 2026-10-13) */
        const oiTag = b.time * 1000 >= oiPublishedAt(day) ? u.oiTodayFrom : 'prior';
        const inputs = `${b.close}|${r}|${oiTag}|${u.seedDate ?? ''}|${inp.version}`;
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
