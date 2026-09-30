/*
==================================================
  SLAYER TERMINAL - REVIEW · WHILE YOU HELD IT
  (data/review/excursion.ts)

  The one thing a report cannot say about a trade:
  what it did BETWEEN the way in and the way out. The
  tape is seeded and stays put, so a closed trade can
  be walked again, minute by minute, for as long as
  the session is kept:

    the path     what the trade was worth at each
                 minute it was on, in dollars, fees in
                 — at the BID it could have been sold
                 into (so decay is in it)
    the best     the most it was up, and when
    the worst    the most it was down, and when
    kept         what was taken of the best

  and the ways out that rode it — the target and the
  stop as they last stood — so the page can draw them.

  HONEST ABOUT WHAT A MINUTE CANNOT SAY. An option has
  one quote a minute, so its best is the best bid a
  minute showed.

  AT ITS TRUE SIZE (2026-09-20, the ladder): a trade
  that scaled in or out is walked from its LEGS — every
  fill, in order — so each minute is worth what had
  been taken out by then plus what was still on, at
  the size that was still on. The walk ends, to the
  cent, on what the trade made.

  Walked once, kept by the trade's key: a closed trade
  never changes.

  A PAPER TRADE CANNOT BE WALKED AGAIN (2026-09-22): its
  market was the simulator's, and that market is gone.
  So the paper account WROTE IT DOWN while it was held
  (data/paper/engine.ts `held`): what it was worth on the
  ticks, its best and its worst on every tick — read here
  into the same shape. A trade older than the journal
  keeps drawings for has its figures and no path.
==================================================
*/

import { MULT, stampOf, type Session, type Trade } from './engine';
import { instantOf, type JournalRow } from './journal';
import { contractKey, quoteAt } from './quotes';
import { LAST_MIN, barTime, nextDay, spotAt } from './tape';

export interface PathPoint {
  /** A real New York instant, in seconds */
  time: number;
  /** Contracts still on at the end of that minute */
  held: number;
  /** What the trade was worth against its cost, in dollars, fees in */
  pnl: number;
  /** The contract's bid */
  value: number;
  /** Where the NAME stood (the option's underlying) */
  name: number;
}
export interface WayOut {
  price: number;
  /** The contracts it spoke for when it was last seen */
  qty: number;
  /** It trailed; it was moved to what was paid */
  trailed?: boolean;
  movedToCost?: boolean;
  /** What the price is a price OF: the contract, or the name (a way out pinned to it) */
  of: 'contract' | 'name';
  /** What it would have made, in dollars — null where that depends on the minute it is reached (a pin on the name) */
  pnl: number | null;
}
export interface Excursion {
  points: PathPoint[];
  best: { pnl: number; time: number };
  worst: { pnl: number; time: number };
  /** Taken of the best, as a share of it — null when it never was up */
  kept: number | null;
  /** The one target and the one stop that rode the whole of it — null where there was none, or a ladder of them */
  target: WayOut | null;
  stop: WayOut | null;
  /** Every level that rode it, nearest first — a ladder's rungs */
  targets: WayOut[];
  stops: WayOut[];
}

/** At most this many minutes are walked one by one; a longer hold is stepped so the walk stays under it */
const WALK_MAX = 6000;
const cache = new Map<string, Excursion>();

/** Every (day, minute) the trade was on, first to last, stepped if it is long */
function minutesOf(opened: Trade['opened'], closed: Trade['closed'], lastMin: number): { day: string; minute: number }[] {
  const out: { day: string; minute: number }[] = [];
  let day: string | null = opened.day;
  let guard = 0;
  while (day && guard++ < 400) {
    const from = day === opened.day ? opened.minute : 0;
    const to = day === closed.day ? closed.minute : lastMin;
    for (let m = from; m <= to; m++) out.push({ day, minute: m });
    if (day === closed.day) break;
    day = nextDay(day);
  }
  if (out.length <= WALK_MAX) return out;
  const step = Math.ceil(out.length / WALK_MAX);
  return out.filter((_, i) => i % step === 0 || i === out.length - 1);
}

const within = (placed: Trade['opened'], a: Trade['opened'], b: Trade['closed']) => stampOf(placed) >= stampOf(a) && stampOf(placed) <= stampOf(b);

/** A leg's moment among the walk's minutes */
const at = (m: { day: string; minute: number }) => stampOf(m);

function ofOption(s: Session, t: Trade): Excursion {
  /* what selling a contract cost, off the trade's own legs — what is still on is charged it, so the walk is "fees in" */
  const sells = t.legs.filter(l => l.side === 'sell');
  const feeOut = sells.reduce((a, l) => a + l.fee, 0) / Math.max(1, sells.reduce((a, l) => a + l.qty, 0));
  const walk = minutesOf(t.opened, t.closed, LAST_MIN);
  let cash = 0;
  let held = 0;
  let li = 0;
  const points: PathPoint[] = walk.map(({ day, minute }, i) => {
    const last = i === walk.length - 1;
    /* every fill up to the end of this minute: what it paid or took, and the size it left on */
    while (li < t.legs.length && at(t.legs[li].at) <= at({ day, minute })) {
      const l = t.legs[li++];
      cash += (l.side === 'sell' ? 1 : -1) * l.price * MULT * l.qty - l.fee;
      held += l.side === 'sell' ? -l.qty : l.qty;
    }
    const bid = last ? t.avgOut : quoteAt(t.contract, day, minute).bid;
    /* the END of the minute, as the desk's clock names it (journal.ts `instantOf`) */
    return { time: barTime(day, minute) + 60, held, pnl: last ? t.pnl : cash + bid * MULT * held - feeOut * held, value: bid, name: last ? t.spotOut : spotAt(t.contract.ticker, day, minute) };
  });
  const key = contractKey(t.contract);
  const rode = s.orders.filter(o => o.side === 'sell' && o.kind !== 'market' && o.price != null && o.status !== 'refused' && contractKey(o.contract) === key && within(o.placed, t.opened, t.closed));
  const worth = (price: number, qty: number) => (price - t.avgIn) * MULT * qty - (s.fee * qty * 2);
  const waysOut = (kind: 'limit' | 'stop'): WayOut[] =>
    rode
      .filter(o => o.kind === kind)
      .map<WayOut>(o => (o.on === 'name' ? { price: o.price!, qty: o.qty, of: 'name', pnl: null, trailed: o.trail != null || undefined, movedToCost: !!o.moved || undefined } : { price: o.price!, qty: o.qty, of: 'contract', pnl: worth(o.price!, o.qty), trailed: o.trail != null || undefined, movedToCost: !!o.moved || undefined }))
      .sort((a, b) => (kind === 'limit' ? a.price - b.price : b.price - a.price));
  return finish(points, t.pnl, t.qty, waysOut('limit'), waysOut('stop'));
}

function finish(points: PathPoint[], made: number, size: number, targets: WayOut[], stops: WayOut[], bestIn?: { pnl: number; time: number }, worstIn?: { pnl: number; time: number }): Excursion {
  let best = bestIn ?? { pnl: -Infinity, time: 0 };
  let worst = worstIn ?? { pnl: Infinity, time: 0 };
  if (!bestIn || !worstIn)
    for (const p of points) {
      if (p.pnl > best.pnl) best = { pnl: p.pnl, time: p.time };
      if (p.pnl < worst.pnl) worst = { pnl: p.pnl, time: p.time };
    }
  const end = points[points.length - 1]?.time ?? 0;
  /* what was taken is part of the trade: the best is never less than it, the worst never more — and a trade left AT its
     best (a target) or at its worst (a stop) marks its way out, not an earlier minute that tied it */
  if (made >= best.pnl) best = { pnl: made, time: end };
  if (made <= worst.pnl) worst = { pnl: made, time: end };
  /* ONE target / ONE stop for the whole of it is a line on the figure; a ladder's rungs are listed, not drawn in dollars */
  const whole = (w: WayOut[]) => (w.length === 1 && w[0].qty >= size ? w[0] : null);
  return { points, best, worst, kept: best.pnl > 0 ? Math.max(-1, Math.min(1, made / best.pnl)) : null, target: whole(targets), stop: whole(stops), targets, stops };
}

/** A paper trade, read off what its account wrote down while it was held */
function ofPaper(r: Extract<JournalRow, { paper: true }>): Excursion {
  const t = r.t;
  const h = r.s.held[t.id];
  /* a point a moment, and never two in one second: a figure's times have to rise */
  const points: PathPoint[] = [];
  for (const [ms, pnl, value, name] of h?.pts ?? []) {
    const time = Math.floor(ms / 1000);
    if (points.length && points[points.length - 1].time >= time) points.pop();
    points.push({ time, held: t.qty, pnl, value, name });
  }
  const inWindow = (at: number) => at >= t.opened.at && at <= t.closed.at;
  const key = contractKey(t.contract);
  const rode = r.s.opt.orders.filter(o => o.side === 'sell' && o.kind !== 'market' && o.price != null && o.status !== 'refused' && contractKey(o.contract) === key && inWindow(o.placed.at));
  const worth = (price: number, qty: number) => (price - t.avgIn) * MULT * qty - r.s.fee * qty * 2;
  const ways = (kind: 'limit' | 'stop') => rode.filter(o => o.kind === kind).map<WayOut>(o => (o.on === 'name' ? { price: o.price!, qty: o.qty, of: 'name', pnl: null, trailed: o.trail != null || undefined, movedToCost: !!o.moved || undefined } : { price: o.price!, qty: o.qty, of: 'contract', pnl: worth(o.price!, o.qty), trailed: o.trail != null || undefined, movedToCost: !!o.moved || undefined })).sort((a, b) => (kind === 'limit' ? a.price - b.price : b.price - a.price));
  const targets = ways('limit');
  const stops = ways('stop');
  const best = h ? { pnl: h.best, time: Math.floor(h.bestAt / 1000) } : undefined;
  const worst = h ? { pnl: h.worst, time: Math.floor(h.worstAt / 1000) } : undefined;
  return finish(points, t.pnl, t.qty, targets, stops, best, worst);
}

/** The trade, walked again — once */
export function excursionOf(r: JournalRow): Excursion {
  const key = `${r.key}:${instantOf(r, r.t.closed)}:${r.t.pnl}`;
  let e = cache.get(key);
  if (!e) {
    e = r.paper ? ofPaper(r) : ofOption(r.s, r.t);
    cache.set(key, e);
  }
  return e;
}

/** Across a cut: of everything the trades were up at their best, what was taken */
export function keptOf(rows: JournalRow[]): { best: number; made: number; share: number | null } {
  let best = 0;
  let made = 0;
  for (const r of rows) {
    const e = excursionOf(r);
    if (e.best.pnl <= 0) continue;
    best += e.best.pnl;
    made += Math.max(0, r.t.pnl);
  }
  return { best, made, share: best > 0 ? made / best : null };
}
