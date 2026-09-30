/*
==================================================
  SLAYER TERMINAL - REVIEW · THE FUTURES ENGINE
  (data/review/futuresEngine.ts)

  docs/review-futures-rules.md, in code — and nothing
  else. The options engine's twin (engine.ts): pure
  functions over a session that is its orders and its
  fills; everything the desk shows is READ off those.
  Kept apart from it because almost every rule differs:

    LONG AND SHORT      a position has a direction; an
                        order against it is a way OUT,
                        and never takes it past flat
    MARGIN, NOT CASH    a contract sets its day margin
                        aside; what is made or lost is
                        points × the point's worth
    ONE PRICE, A BAR    no bid and ask: a minute is an
                        open, a high, a low, a close —
                        so every fill LEANS AGAINST THE
                        READER where the bar cannot say
                        what happened inside it: a market
                        order a tick worse than the
                        close, a limit only when traded
                        THROUGH, a stop a tick worse than
                        its price (or the open, on a
                        gap), and A TARGET AND A STOP IN
                        ONE MINUTE = THE STOP
    THE ROLL            a position is not carried into
                        the next contract month: it is
                        closed at the old one's last
                        minute, and says so
    1R IS THE PLANNED RISK  entry to stop. A trade with
                        no stop has no R — the record
                        says so rather than invent one.

  The reader's own rules are the same three hard blocks
  (engine.ts SessionRules), on a way in only.
==================================================
*/

import { MAX_NAMES, OPEN_CEILING, stampOf, type Moment, type OrderKind, type SessionRules, type Side } from './engine';
import { FUT_DAY_MIN, FUT_LAST_MIN, frontContract, futBarAt, futPrice, futPriceAt, futProduct, isFutSymbol, onTick } from './futuresTape';
import { MAX_STOPS, MAX_TARGETS, giveUp, ladderShapeRefusal, nextRung, rungsOf, type LadderBracket } from './ladder';
import { dayIndex, tapeDays } from './tape';
import type { DayNote, JournalEntry } from './journal';

export type FutFillHow = OrderKind | 'roll';
/** What rides an entry: a ladder's rungs (or the single target and stop) and its two switches — data/review/ladder.ts */
export type FutBracket = LadderBracket;
export interface FutOrder {
  id: string;
  placed: Moment;
  symbol: string;
  /** The contract month it was for — "ESM6" */
  contract: string;
  side: Side;
  qty: number;
  kind: OrderKind;
  price?: number;
  /** A way OUT: it only ever reduces the position it was placed against */
  exit: boolean;
  tif: 'day' | 'gtc';
  status: 'working' | 'filled' | 'cancelled' | 'refused';
  why?: string;
  done?: Moment;
  fillPrice?: number;
  oco?: string;
  bracket?: FutBracket;
  tag?: string;
  /** A STOP of a ladder: the first target's fill moves it to the average entry (once) */
  breakeven?: boolean;
  /** A TRAILING stop: the points it keeps from the best price since it was armed (`peak`) */
  trail?: number;
  peak?: number;
  /** When a switch last moved it (breakeven) */
  moved?: Moment;
}
export interface FutFill {
  id: string;
  orderId: string | null;
  at: Moment;
  symbol: string;
  contract: string;
  side: Side;
  qty: number;
  price: number;
  fee: number;
  how: FutFillHow;
  exit: boolean;
  /** The stop that rode the entry, if one did — the planned risk */
  plannedStop?: number;
  tag?: string;
}
export interface FutSession {
  kind: 'futures';
  id: string;
  name: string;
  /** The first product — the same field the options session has, so the store can hold both */
  ticker: string;
  tickers: string[];
  rules?: SessionRules;
  startCash: number;
  /** Dollars a contract each way; null = each product's usual fee */
  fee: number | null;
  startDay: string;
  cursor: Moment;
  orders: FutOrder[];
  fills: FutFill[];
  notes: Record<string, string>;
  /** The journal's (data/review/journal.ts): the reader's words and tags on a closed trade, and a note on a replayed day.
      The engine never reads them. */
  journal?: Record<string, JournalEntry>;
  days?: Record<string, DayNote>;
  createdAt: number;
  touchedAt: number;
  seq: number;
}

const cents = (v: number) => Math.round(v * 100) / 100;
export const futNamesOf = (s: Pick<FutSession, 'ticker' | 'tickers'>): string[] => (s.tickers?.length ? s.tickers : [s.ticker]);
export const feeOf = (s: Pick<FutSession, 'fee'>, symbol: string): number => s.fee ?? futProduct(symbol).fee;
export const marginOf = (symbol: string): number => futProduct(symbol).margin;

export function newFutSession(o: { id: string; name: string; tickers: string[]; rules?: SessionRules; startCash: number; fee?: number | null; startDay: string; now: number }): FutSession {
  const names = [...new Set(o.tickers.map(t => t.toUpperCase()).filter(isFutSymbol))].slice(0, MAX_NAMES);
  const tickers = names.length ? names : ['ES'];
  return { kind: 'futures', id: o.id, name: o.name, ticker: tickers[0], tickers, rules: o.rules, startCash: o.startCash, fee: o.fee ?? null, startDay: o.startDay, cursor: { day: o.startDay, minute: 0 }, orders: [], fills: [], notes: {}, createdAt: o.now, touchedAt: o.now, seq: 0 };
}

/* ---- what the fills add up to ---- */
export interface FutPosition {
  key: string;
  symbol: string;
  contract: string;
  long: boolean;
  qty: number;
  /** The average price of what is still held */
  avg: number;
  /** Fees paid on the way in, for what is still held */
  fees: number;
  opened: Moment;
  tradeId: string;
  plannedStop?: number;
  tag?: string;
  /** What the pieces already closed have banked, fees in — their own, and the entry's share of them (the chart's RP&L) */
  banked: number;
}
export interface FutTrade {
  id: string;
  symbol: string;
  contract: string;
  long: boolean;
  /** Contracts entered over the trade's life */
  qty: number;
  avgIn: number;
  avgOut: number;
  pnl: number;
  /** Entry to the stop that rode it, in dollars — null when it rode none */
  risk: number | null;
  r: number | null;
  opened: Moment;
  closed: Moment;
  /** How it ended — 'scaled': it left in more than one piece (`legs` has each) */
  how: 'closed' | 'target' | 'stopped' | 'rolled' | 'scaled';
  /** Every fill of the trade, in order — the ways in, and each piece it left in */
  legs: FutLeg[];
  heldMin: number;
  tag?: string;
}
export interface FutLeg {
  at: Moment;
  side: Side;
  qty: number;
  price: number;
  fee: number;
  exit: boolean;
  /** A piece going out: by a target, a stop, the reader's hand, or the roll */
  out?: 'target' | 'stop' | 'hand' | 'roll';
}
const heldMinutes = (a: Moment, b: Moment) => Math.max(0, (dayIndex(b.day) - dayIndex(a.day)) * FUT_DAY_MIN + (b.minute - a.minute));

interface Book {
  positions: FutPosition[];
  trades: FutTrade[];
  /** Made or lost on what has been closed, before fees */
  realized: number;
  feesPaid: number;
}
export function futBookOf(s: FutSession): Book {
  interface Open {
    first: FutFill;
    dir: 1 | -1;
    qty: number;
    basis: number;
    entered: number;
    inSum: number;
    exited: number;
    outSum: number;
    made: number;
    fees: number;
    feesIn: number;
    legs: FutLeg[];
  }
  const open = new Map<string, Open>();
  const trades: FutTrade[] = [];
  const targets = new Set(s.orders.filter(o => o.oco && o.kind === 'limit' && o.exit).map(o => o.id));
  let realized = 0;
  let feesPaid = 0;
  for (const f of s.fills) {
    const pv = futProduct(f.symbol).pointValue;
    feesPaid += f.fee;
    let o = open.get(f.symbol);
    if (!f.exit) {
      if (!o) open.set(f.symbol, (o = { first: f, dir: f.side === 'buy' ? 1 : -1, qty: 0, basis: 0, entered: 0, inSum: 0, exited: 0, outSum: 0, made: 0, fees: 0, feesIn: 0, legs: [] }));
      o.legs.push({ at: f.at, side: f.side, qty: f.qty, price: f.price, fee: f.fee, exit: false });
      o.basis = (o.basis * o.qty + f.price * f.qty) / (o.qty + f.qty);
      o.qty += f.qty;
      o.entered += f.qty;
      o.inSum += f.price * f.qty;
      o.fees += f.fee;
      o.feesIn += f.fee;
      continue;
    }
    if (!o) continue;
    const q = Math.min(f.qty, o.qty);
    const made = (f.price - o.basis) * o.dir * pv * q;
    realized += made;
    o.made += made;
    o.qty -= q;
    o.exited += q;
    o.outSum += f.price * q;
    o.fees += f.fee;
    o.legs.push({ at: f.at, side: f.side, qty: q, price: f.price, fee: f.fee, exit: true, out: f.how === 'roll' ? 'roll' : f.how === 'stop' ? 'stop' : f.orderId && targets.has(f.orderId) ? 'target' : 'hand' });
    if (o.qty > 0) continue;
    const stop = o.first.plannedStop;
    const risk = stop != null ? cents(Math.abs(o.first.price - stop) * pv * o.first.qty) : null;
    const pnl = cents(o.made - o.fees);
    trades.push({
      id: o.first.id,
      symbol: f.symbol,
      contract: o.first.contract,
      long: o.dir === 1,
      qty: o.entered,
      avgIn: o.inSum / o.entered,
      avgOut: o.outSum / Math.max(1, o.exited),
      pnl,
      risk,
      r: risk && risk > 0 ? pnl / risk : null,
      opened: o.first.at,
      closed: f.at,
      how: o.legs.filter(l => l.exit).length > 1 ? 'scaled' : f.how === 'roll' ? 'rolled' : f.how === 'stop' ? 'stopped' : f.orderId && targets.has(f.orderId) ? 'target' : 'closed',
      legs: o.legs,
      heldMin: heldMinutes(o.first.at, f.at),
      tag: o.first.tag,
    });
    open.delete(f.symbol);
  }
  const positions: FutPosition[] = [...open.entries()].map(([symbol, o]) => ({
    key: symbol,
    symbol,
    contract: o.first.contract,
    long: o.dir === 1,
    qty: o.qty,
    avg: o.basis,
    fees: cents((o.feesIn * o.qty) / o.entered),
    opened: o.first.at,
    tradeId: o.first.id,
    plannedStop: o.first.plannedStop,
    tag: o.first.tag,
    banked: cents(o.made - o.fees + (o.feesIn * o.qty) / o.entered),
  }));
  return { positions, trades, realized: cents(realized), feesPaid: cents(feesPaid) };
}

/** WHAT A NAME HAS BANKED (the chart's RP&L, 2026-09-22): its closed trades, and what its open ones have closed in pieces,
    fees in — from the fills of the days before `beforeDay` (none: all of them). The day's share is the whole less that. */
export function futBankedOf(s: FutSession, name: string, beforeDay?: string): number {
  const { positions, trades } = futBookOf({ ...s, fills: s.fills.filter(f => f.symbol === name && (beforeDay == null || f.at.day < beforeDay)) });
  return cents(trades.reduce((x, t) => x + t.pnl, 0) + positions.reduce((x, p) => x + p.banked, 0));
}

export interface FutAccount {
  /** What is in the account with nothing open counted: the start, what has been made or lost and closed, less every fee */
  cash: number;
  /** Cash + what is open, up or down */
  equity: number;
  openPnl: number;
  /** Set aside against what is open */
  marginHeld: number;
  /** What a new entry can be margined from */
  free: number;
  positions: (FutPosition & { last: number; pnl: number; r: number | null })[];
  trades: FutTrade[];
}
export function futAccountOf(s: FutSession): FutAccount {
  const { positions, trades, realized, feesPaid } = futBookOf(s);
  const cash = cents(s.startCash + realized - feesPaid);
  let gross = 0;
  let marginHeld = 0;
  const marked = positions.map(p => {
    const prod = futProduct(p.symbol);
    const last = futPriceAt(p.symbol, s.cursor.day, s.cursor.minute);
    const up = (last - p.avg) * (p.long ? 1 : -1) * prod.pointValue * p.qty;
    gross += up;
    marginHeld += marginOf(p.symbol) * p.qty;
    const risk = p.plannedStop != null ? Math.abs(p.avg - p.plannedStop) * prod.pointValue * p.qty : null;
    const pnl = cents(up - p.fees);
    return { ...p, last, pnl, r: risk && risk > 0 ? pnl / risk : null };
  });
  const equity = cents(cash + gross);
  return { cash, equity, openPnl: cents(marked.reduce((a, p) => a + p.pnl, 0)), marginHeld, free: cents(equity - marginHeld), positions: marked, trades };
}

/* ---- the reader's own rules ---- */
export function futEquityAtOpen(s: FutSession): number {
  const before = s.fills.filter(f => f.at.day < s.cursor.day);
  if (!before.length) return s.startCash;
  return futAccountOf({ ...s, fills: before, cursor: { day: s.cursor.day, minute: 0 } }).equity;
}
export function futDayStateOf(s: FutSession): { pct: number; stopped: boolean } {
  const open = futEquityAtOpen(s);
  const pct = open > 0 ? (futAccountOf(s).equity - open) / open : 0;
  const limit = s.rules?.dailyLossPct;
  return { pct, stopped: limit != null && limit > 0 && pct <= -limit + 1e-9 };
}
const pctWords = (v: number) => `${+(v * 100).toFixed(1)}%`;
const money = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ---- orders ---- */
export interface FutDraft {
  symbol: string;
  side: Side;
  qty: number;
  kind: OrderKind;
  price?: number;
  tif?: 'day' | 'gtc';
  bracket?: FutBracket;
  tag?: string;
}
const nextId = (s: FutSession, p: string): [string, FutSession] => [`${p}${s.seq + 1}`, { ...s, seq: s.seq + 1 }];

const workingExits = (s: FutSession, symbol: string) => s.orders.filter(o => o.status === 'working' && o.exit && o.symbol === symbol);
/** Contracts of a position already spoken for by working ways out: a loose one's own, and — for a ladder — the bigger of what
    its targets and its stops speak for (the same contracts, waiting on two things) */
const reserved = (s: FutSession, symbol: string) => {
  const byGroup = new Map<string, { limit: number; stop: number }>();
  let loose = 0;
  for (const o of workingExits(s, symbol)) {
    if (!o.oco || o.kind === 'market') loose += o.qty;
    else {
      const g = byGroup.get(o.oco) ?? { limit: 0, stop: 0 };
      g[o.kind] += o.qty;
      byGroup.set(o.oco, g);
    }
  }
  return loose + [...byGroup.values()].reduce((a, g) => a + Math.max(g.limit, g.stop), 0);
};
/** How far a working way out stands from the price, in points — what "the furthest rung" is measured by */
const farness = (o: FutOrder, last: number) => Math.abs((o.price ?? last) - last);
const resize = (s: FutSession, left: Map<string, number>, at: Moment, why: string): FutSession => ({
  ...s,
  orders: s.orders.map(x => {
    const q = left.get(x.id);
    if (q == null || x.status !== 'working' || q === x.qty) return x;
    return q <= 0 ? { ...x, status: 'cancelled' as const, done: at, why } : { ...x, qty: q };
  }),
});
/** A stop armed to trail: the points it keeps, and the best price so far */
const trailFrom = (price: number, ref: number): { trail: number; peak: number } => ({ trail: Math.abs(ref - price), peak: ref });

/** AFTER A WAY OUT FILLS: the ladder is made to fit what is still held (the rules page, "A ladder of ways out") */
function afterExit(s: FutSession, out: FutOrder, price: number, at: Moment): FutSession {
  let next = s;
  if (out.oco) {
    /* a rung filled: the OTHER side of its group gives up that many contracts, the furthest first */
    const other = workingExits(next, out.symbol).filter(o => o.oco === out.oco && o.kind !== out.kind);
    next = resize(next, giveUp(other, out.qty, o => farness(o, price)), at, 'its pair filled');
    /* BREAKEVEN: the first target of the group to fill moves its stops to the average entry — never further off */
    const firstTarget = out.kind === 'limit' && !s.orders.some(o => o.oco === out.oco && o.kind === 'limit' && o.status === 'filled' && o.id !== out.id);
    const pos = futBookOf(next).positions.find(p => p.symbol === out.symbol);
    if (firstTarget && pos) {
      const prod = futProduct(out.symbol);
      const cost = onTick(prod, pos.avg);
      next = {
        ...next,
        orders: next.orders.map(o => {
          if (o.status !== 'working' || o.oco !== out.oco || o.kind !== 'stop' || !o.breakeven || o.price == null) return o;
          const tighter = pos.long ? cost > o.price && cost < price : cost < o.price && cost > price;
          return tighter ? { ...o, price: cost, breakeven: false, moved: at, ...(o.trail != null ? trailFrom(cost, price) : {}) } : { ...o, breakeven: false };
        }),
      };
    }
  }
  const held = futBookOf(next).positions.find(p => p.symbol === out.symbol)?.qty ?? 0;
  const mine = workingExits(next, out.symbol);
  /* flat: whatever was still waiting to take it out has nothing to take out */
  if (held === 0) return resize(next, new Map(mine.map(o => [o.id, 0])), at, 'the position was closed');
  /* …and what is left never speaks for more than is held: a way out by hand takes its contracts from the furthest rungs */
  const loose = mine.filter(o => !o.oco).reduce((a, o) => a + o.qty, 0);
  const cover = Math.max(0, held - loose);
  for (const kind of ['limit', 'stop'] as const) {
    const side = workingExits(next, out.symbol).filter(o => o.oco && o.kind === kind);
    const over = side.reduce((a, o) => a + o.qty, 0) - cover;
    if (over > 0) next = resize(next, giveUp(side, over, o => farness(o, price)), at, 'its contracts were taken out');
  }
  return next;
}

/** Why a draft cannot be taken, or null — the words the ticket shows before the press */
export function futRefusal(s: FutSession, d: FutDraft): string | null {
  if (!Number.isInteger(d.qty) || d.qty < 1) return 'Enter a whole number of contracts';
  const names = futNamesOf(s);
  if (!names.includes(d.symbol.toUpperCase())) return `This session trades ${names.join(' and ')}`;
  if (d.kind !== 'market' && !(d.price && d.price > 0)) return 'Enter a price';
  if (d.kind === 'market' && s.cursor.minute >= FUT_LAST_MIN) return 'The market is shut until 18:00 — open the next day, or leave an order that waits for it';
  const prod = futProduct(d.symbol);
  const last = futPriceAt(d.symbol, s.cursor.day, s.cursor.minute);
  const { positions } = futBookOf(s);
  const pos = positions.find(p => p.symbol === d.symbol);
  const buy = d.side === 'buy';
  /* A STOP WAITS ON THE FAR SIDE OF THE PRICE, whichever way it is used: a sell stop under it (a long's way out, or a
     short's way in), a buy stop over it — where it already stands past the price it would go at once */
  const against = !!pos && pos.long !== buy;
  if (d.kind === 'stop' && (buy ? d.price! <= last : d.price! >= last)) return against ? `The stop has to be ${buy ? 'over' : 'under'} where it trades — it would go at once` : `A ${buy ? 'buy' : 'sell'} stop waits ${buy ? 'above' : 'under'} the price — it ${buy ? 'buys the break' : 'sells the breakdown'}`;
  /* AGAINST THE POSITION IT IS A WAY OUT — or, past flat, A REVERSAL: the close, then the rest the other way */
  let qtyIn = d.qty;
  let freed = 0;
  const reversal = against && d.qty > pos!.qty;
  if (against) {
    /* a way out AT THE MARKET is never "spoken for" — the ladder gives way (afterExit); one that WAITS has to find contracts
       nothing else speaks for — every one of them, for a reversal */
    const free = pos!.qty - reserved(s, d.symbol);
    if (d.kind !== 'market' && Math.min(d.qty, pos!.qty) > free) return reversal ? 'Those contracts are already spoken for by a working order — a reversal that waits needs every one of them free' : 'Those contracts are already spoken for by a working order';
    if (!reversal) return null;
    qtyIn = d.qty - pos!.qty;
    freed = marginOf(d.symbol) * pos!.qty;
  }
  /* A WAY IN — for a reversal, the part that opens the other way */
  const ref = d.kind === 'market' ? last : d.price!;
  const shape = ladderShapeRefusal(d.bracket, qtyIn);
  if (shape) return shape;
  const { targets, stops } = rungsOf(d.bracket, qtyIn);
  const many = (n: number, word: string) => (n > 1 ? `Every ${word}` : `The ${word}`);
  if (targets.some(r => (buy ? r.price <= ref : r.price >= ref))) return `${many(targets.length, 'target')} has to be ${buy ? 'above' : 'below'} where you get in`;
  if (stops.some(r => (buy ? r.price >= ref : r.price <= ref))) return `${many(stops.length, 'stop')} has to be ${buy ? 'below' : 'above'} where you get in`;
  const acct = futAccountOf(s);
  const need = marginOf(d.symbol) * qtyIn;
  if (need > acct.free + freed + 1e-9) return `Not enough free money to margin this — it needs ${money(need)}, and ${money(Math.max(0, acct.free + freed))} is free${reversal ? ' once the other side is closed' : ''}`;
  /* the reader's own rules, and our ceiling (a reversal closes one position as it opens one: the count does not move) */
  if (!pos) {
    const held = new Set(positions.map(p => p.symbol));
    const pending = new Set(s.orders.filter(o => o.status === 'working' && !o.exit && !held.has(o.symbol)).map(o => o.symbol));
    const open = held.size + pending.size - (pending.has(d.symbol) ? 1 : 0);
    const cap = s.rules?.maxOpen;
    if (cap != null && cap > 0 && open >= cap) return `Your session’s rule: no more than ${cap} ${cap === 1 ? 'position' : 'positions'} open at once`;
    if (open >= OPEN_CEILING) return `No more than ${OPEN_CEILING} positions open at once — close one first`;
  }
  const risk = s.rules?.maxRiskPct;
  if (risk != null && risk > 0) {
    /* the stops have to cover EVERY contract of the order (an add to a position may lean on the stop it already has) */
    const covered = stops.reduce((a, r) => a + r.qty, 0);
    const lean = reversal ? undefined : pos?.plannedStop;
    if (covered < qtyIn && lean == null) return `Your session’s rule: a trade may risk no more than ${pctWords(risk)} of the account — that needs ${stops.length ? 'the stops to cover every contract' : 'a stop on the order'}`;
    const atRisk = stops.reduce((a, r) => a + Math.abs(ref - r.price) * prod.pointValue * r.qty, 0) + (lean != null ? Math.abs(ref - lean) * prod.pointValue * (qtyIn - covered) + Math.abs((pos?.avg ?? ref) - lean) * prod.pointValue * (pos?.qty ?? 0) : 0);
    if (atRisk > acct.equity * risk + 1e-9) return `Your session’s rule: no more than ${pctWords(risk)} of the account at risk on one trade — this would be ${money(atRisk)} of ${money(acct.equity * risk)}`;
  }
  const limit = s.rules?.dailyLossPct;
  if (limit != null && limit > 0) {
    const day = futDayStateOf(s);
    if (day.stopped) return `Your session’s rule: down ${pctWords(-day.pct)} on the day (the stop is ${pctWords(limit)}) — no new positions until the next open`;
  }
  return null;
}

function fillNow(s: FutSession, o: FutOrder, price: number, how: FutFillHow, at: Moment): FutSession {
  const prod = futProduct(o.symbol);
  let [id, next] = nextId(s, 'f');
  const { targets, stops } = rungsOf(o.exit ? undefined : o.bracket, o.qty);
  /* THE PLANNED RISK: where the stops stand on average, by their contracts — and only where they cover every contract */
  const covered = stops.reduce((a, r) => a + r.qty, 0);
  const plannedStop = stops.length && covered === o.qty ? stops.reduce((a, r) => a + r.price * r.qty, 0) / covered : undefined;
  const fill: FutFill = { id, orderId: o.id || null, at, symbol: o.symbol, contract: o.contract, side: o.side, qty: o.qty, price: onTick(prod, price), fee: cents(feeOf(s, o.symbol) * o.qty), how, exit: o.exit, plannedStop, tag: o.tag };
  next = { ...next, fills: [...next.fills, fill], orders: next.orders.map(x => (x.id === o.id ? { ...x, status: 'filled' as const, done: at, fillPrice: fill.price } : x)) };
  /* a way out: the ladder it belongs to — or stands beside — is made to fit what is still held */
  if (o.exit) next = afterExit(next, o, fill.price, at);
  /* an entry that carried ways out leaves them working, on the other side, as one group */
  if (targets.length || stops.length) {
    const [oco, n2] = nextId(next, 'g');
    next = n2;
    for (const [kind, rungs] of [['limit', targets], ['stop', stops]] as const) {
      for (const r of rungs) {
        const [oid, n3] = nextId(next, 'o');
        const px = onTick(prod, r.price);
        const switches = kind === 'stop' ? { breakeven: o.bracket?.breakeven || undefined, ...(o.bracket?.trail ? (o.bracket.trailBy ? { trail: o.bracket.trailBy, peak: fill.price } : trailFrom(px, fill.price)) : {}) } : {};
        next = { ...n3, orders: [...n3.orders, { id: oid, placed: at, symbol: o.symbol, contract: o.contract, side: o.side === 'buy' ? 'sell' : 'buy', qty: r.qty, kind, price: px, exit: true, tif: 'gtc', status: 'working', oco, tag: o.tag, ...switches }] };
      }
    }
  }
  return next;
}

/** Take an order. A market order fills on the minute the clock stands on, a tick against you; the rest wait. */
export function futPlace(s: FutSession, d: FutDraft, now: number): FutSession {
  const prod = futProduct(d.symbol);
  const pos = futBookOf(s).positions.find(p => p.symbol === d.symbol);
  const exit = !!pos && pos.long !== (d.side === 'buy');
  const why = futRefusal(s, d);
  const order = (next: FutSession, qty: number, out: boolean, bracket: FutBracket | undefined): [FutOrder, FutSession] => {
    const [id, n2] = nextId(next, 'o');
    return [{ id, placed: s.cursor, symbol: d.symbol.toUpperCase(), contract: frontContract(d.symbol, s.cursor.day), side: d.side, qty, kind: d.kind, price: d.kind === 'market' || d.price == null ? undefined : onTick(prod, d.price), exit: out, tif: d.tif ?? (d.kind === 'market' ? 'day' : 'gtc'), status: 'working', bracket: out ? undefined : bracket, tag: d.tag }, n2];
  };
  const last = futPriceAt(d.symbol, s.cursor.day, s.cursor.minute);
  const px = last + (d.side === 'buy' ? prod.tick : -prod.tick);
  /* A REVERSAL (the rules page): two orders — the close, then the rest the other way — at the same price and kind */
  if (!why && exit && pos && d.qty > pos.qty) {
    let next = s;
    const [out, n1] = order(next, pos.qty, true, undefined);
    const [inn, n2] = order(n1, d.qty - pos.qty, false, d.bracket);
    next = { ...n2, touchedAt: now, orders: [...n2.orders, out, inn] };
    if (d.kind !== 'market') return next;
    return fillNow(fillNow(next, out, px, 'market', s.cursor), inn, px, 'market', s.cursor);
  }
  const [base, next] = order(s, d.qty, exit, d.bracket);
  const placed = { ...next, touchedAt: now, orders: [...next.orders, why ? { ...base, status: 'refused' as const, why, done: s.cursor } : base] };
  if (why || d.kind !== 'market') return placed;
  return fillNow(placed, base, px, 'market', s.cursor);
}

export function futCancel(s: FutSession, orderId: string, now: number): FutSession {
  return { ...s, touchedAt: now, orders: s.orders.map(o => (o.id === orderId && o.status === 'working' ? { ...o, status: 'cancelled', done: s.cursor, why: 'cancelled by you' } : o)) };
}

/** Move a working order's price. Not taken when it would not wait: a stop already behind the price. */
export function futAmend(s: FutSession, orderId: string, price: number, now: number): FutSession {
  const o = s.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || !(price > 0)) return s;
  const last = futPriceAt(o.symbol, s.cursor.day, s.cursor.minute);
  if (o.kind === 'stop' && (o.side === 'sell' ? price >= last : price <= last)) return s;
  if (o.kind === 'limit' && o.exit && (o.side === 'sell' ? price <= last : price >= last)) return s;
  const px = onTick(futProduct(o.symbol), price);
  /* a trailing stop dragged: it keeps its NEW distance from here on (the rules page) */
  const trail = o.exit && o.kind === 'stop' && o.trail != null ? trailFrom(px, last) : {};
  return { ...s, touchedAt: now, orders: s.orders.map(x => (x.id === orderId ? { ...x, price: px, ...trail } : x)) };
}

/** What a further pull off a position's chip would do, per kind: 'first', 'more' (it adds a level), or null — the ladder is
    full, or no level has two contracts to give */
export function futLadderRoom(s: FutSession, symbol: string): Record<'target' | 'stop', 'first' | 'more' | null> {
  const pos = futBookOf(s).positions.find(p => p.symbol === symbol);
  const last = futPriceAt(symbol, s.cursor.day, s.cursor.minute);
  const mine = workingExits(s, symbol);
  const cover = (pos?.qty ?? 0) - mine.filter(o => !o.oco).reduce((a, o) => a + o.qty, 0);
  const room = (kind: 'limit' | 'stop') => {
    const rungs = mine.filter(o => o.oco && o.kind === kind);
    if (!pos || cover < 1) return null;
    if (!rungs.length) return 'first' as const;
    return nextRung(rungs, cover, kind === 'limit' ? MAX_TARGETS : MAX_STOPS, o => farness(o, last)) ? ('more' as const) : null;
  };
  return { target: room('limit'), stop: room('stop') };
}
/** …and how many contracts that pull would speak for (nothing where it cannot be taken) — what the chart's preview prices */
export function futLadderTake(s: FutSession, symbol: string): Record<'target' | 'stop', number> {
  const pos = futBookOf(s).positions.find(p => p.symbol === symbol);
  const last = futPriceAt(symbol, s.cursor.day, s.cursor.minute);
  const mine = workingExits(s, symbol);
  const cover = (pos?.qty ?? 0) - mine.filter(o => !o.oco).reduce((a, o) => a + o.qty, 0);
  const take = (kind: 'limit' | 'stop') => {
    const rungs = mine.filter(o => o.oco && o.kind === kind);
    if (!pos || cover < 1) return 0;
    return rungs.length ? (nextRung(rungs, cover, kind === 'limit' ? MAX_TARGETS : MAX_STOPS, o => farness(o, last))?.qty ?? 0) : cover;
  };
  return { target: take('limit'), stop: take('stop') };
}

/** A target or a stop put on a position already open (on the chart: pulled off its chip). THE FIRST of a kind speaks for every
    contract the ladder may; A FURTHER PULL ADDS A LEVEL — the contracts no level of that kind covers yet, or else half of the
    biggest level's. Not taken when the ladder is full, or no level has two contracts to give. A new stop wears the switches
    its group's stops wear. */
export function futAttach(s: FutSession, symbol: string, kind: 'target' | 'stop', price: number, now: number): FutSession {
  const pos = futBookOf(s).positions.find(p => p.symbol === symbol);
  if (!pos || !(price > 0)) return s;
  const last = futPriceAt(symbol, s.cursor.day, s.cursor.minute);
  const above = price > last;
  if (kind === 'target' ? above !== pos.long : above === pos.long) return s;
  const orderKind: OrderKind = kind === 'target' ? 'limit' : 'stop';
  const mine = workingExits(s, symbol);
  const group = mine.find(o => o.oco)?.oco;
  const rungs = mine.filter(o => o.oco && o.kind === orderKind);
  const cover = pos.qty - mine.filter(o => !o.oco).reduce((a, o) => a + o.qty, 0);
  if (cover < 1) return s;
  const take = rungs.length ? nextRung(rungs, cover, kind === 'target' ? MAX_TARGETS : MAX_STOPS, o => farness(o, last)) : { qty: cover, from: null };
  if (!take || take.qty < 1) return s;
  let next = s;
  let oco = group;
  if (!oco) [oco, next] = nextId(next, 'g');
  const [oid, n2] = nextId(next, 'o');
  const px = onTick(futProduct(symbol), price);
  const sibling = mine.find(o => o.oco === oco && o.kind === 'stop');
  const switches = kind === 'stop' ? { breakeven: sibling?.breakeven || undefined, ...(sibling?.trail != null ? trailFrom(px, last) : {}) } : {};
  const orders = n2.orders.map(x => (take.from && x.id === take.from.id ? { ...x, qty: x.qty - take.qty } : x));
  return { ...n2, touchedAt: now, orders: [...orders, { id: oid, placed: s.cursor, symbol, contract: pos.contract, side: pos.long ? 'sell' : 'buy', qty: take.qty, kind: orderKind, price: px, exit: true, tif: 'gtc', status: 'working', oco, tag: pos.tag, ...switches }] };
}

/** A stop's TRAILING switch: on, it keeps a distance in points — `by`, where one is typed, else the points it stands at
    NOW from the price — measured from the best price since */
export function futSetTrail(s: FutSession, orderId: string, on: boolean, now: number, by?: number): FutSession {
  const o = s.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || !o.exit || o.kind !== 'stop' || o.price == null) return s;
  const last = futPriceAt(o.symbol, s.cursor.day, s.cursor.minute);
  if (on && by != null && !(by > 0)) return s;
  return { ...s, touchedAt: now, orders: s.orders.map(x => (x.id !== orderId ? x : on ? { ...x, ...(by != null ? { trail: by, peak: last } : trailFrom(o.price!, last)) } : { ...x, trail: undefined, peak: undefined })) };
}
/** BREAKEVEN is the ladder's: every working stop of the order's group is armed, or let go */
export function futSetBreakeven(s: FutSession, orderId: string, on: boolean, now: number): FutSession {
  const o = s.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || o.kind !== 'stop') return s;
  return { ...s, touchedAt: now, orders: s.orders.map(x => (x.status === 'working' && x.kind === 'stop' && x.exit && (x.id === orderId || (o.oco && x.oco === o.oco)) ? { ...x, breakeven: on || undefined } : x)) };
}

/* ---- the clock ---- */
export function futFloorOf(s: FutSession): Moment {
  let at: Moment = { day: s.startDay, minute: 0 };
  for (const o of s.orders) if (stampOf(o.placed) > stampOf(at)) at = o.placed;
  for (const f of s.fills) if (stampOf(f.at) > stampOf(at)) at = f.at;
  return at;
}

function minuteOrders(s: FutSession, at: Moment): FutSession {
  let next = s;
  /* STOPS FIRST: a bar cannot say whether its high or its low came first, so where both a target and a stop are inside it
     the stop is the one taken */
  for (const pass of ['stop', 'limit'] as const) {
    for (const o of s.orders) {
      if (o.kind !== pass || o.status !== 'working' || stampOf(o.placed) >= stampOf(at)) continue;
      const live = next.orders.find(x => x.id === o.id);
      if (!live || live.status !== 'working') continue;
      const bar = futBarAt(o.symbol, at.day, at.minute);
      if (!bar) continue;
      const prod = futProduct(o.symbol);
      const price = live.price!;
      const buy = o.side === 'buy';
      let px: number | null = null;
      if (pass === 'stop') {
        if (buy ? bar.high >= price : bar.low <= price) px = (buy ? Math.max(price, bar.open) : Math.min(price, bar.open)) + (buy ? prod.tick : -prod.tick);
      } else if (buy ? bar.low <= price - prod.tick + 1e-9 : bar.high >= price + prod.tick - 1e-9) px = price;
      if (px == null) continue;
      if (o.exit) {
        const pos = futBookOf(next).positions.find(p => p.symbol === o.symbol);
        if (!pos || pos.long === buy) {
          next = { ...next, orders: next.orders.map(x => (x.id === o.id ? { ...x, status: 'cancelled', done: at, why: 'the position was closed' } : x)) };
          continue;
        }
        next = fillNow(next, { ...live, qty: Math.min(live.qty, pos.qty) }, px, pass, at);
        continue;
      }
      /* a resting way in: the margin and the day's stop are asked again on the minute it would fill */
      const acct = futAccountOf({ ...next, cursor: at });
      const why = futDayStateOf({ ...next, cursor: at }).stopped ? 'your session’s rule: the day’s stop had been reached' : marginOf(o.symbol) * o.qty > acct.free ? 'the free money was gone by then' : null;
      if (why) next = { ...next, orders: next.orders.map(x => (x.id === o.id ? { ...x, status: 'cancelled', done: at, why } : x)) };
      else next = fillNow(next, live, px, pass, at);
    }
  }
  /* TRAILING STOPS, AFTER THE CHECK: each was tried where it stood, against the whole bar; only now is it moved — by the bar's
     HIGH for a long, its LOW for a short. A bar cannot say which came first, so the good part is never assumed to have. */
  if (next.orders.some(o => o.status === 'working' && o.trail != null)) {
    next = {
      ...next,
      orders: next.orders.map(o => {
        if (o.status !== 'working' || o.kind !== 'stop' || o.trail == null || o.price == null || stampOf(o.placed) >= stampOf(at)) return o;
        const bar = futBarAt(o.symbol, at.day, at.minute);
        if (!bar) return o;
        const prod = futProduct(o.symbol);
        /* a sell stop guards a long: it follows the highs; a buy stop guards a short: the lows */
        const long = o.side === 'sell';
        const peak = long ? Math.max(o.peak ?? bar.high, bar.high) : Math.min(o.peak ?? bar.low, bar.low);
        const level = onTick(prod, long ? peak - o.trail : peak + o.trail);
        return { ...o, peak, price: long ? Math.max(o.price, level) : Math.min(o.price, level) };
      }),
    };
  }
  return next;
}

/** 17:00: day orders go; and where tomorrow's front month is a new one, what is open in the old one is closed in its last
    minute and what was working on it goes */
function endOfDay(s: FutSession, day: string, tomorrow: string | null): FutSession {
  const at: Moment = { day, minute: FUT_LAST_MIN };
  const rolls = (symbol: string) => tomorrow != null && frontContract(symbol, tomorrow) !== frontContract(symbol, day);
  let next: FutSession = { ...s, orders: s.orders.map(o => (o.status === 'working' && (o.tif === 'day' || rolls(o.symbol)) ? { ...o, status: 'cancelled' as const, done: at, why: rolls(o.symbol) ? 'the contract rolled' : 'the day ended' } : o)) };
  for (const p of futBookOf(next).positions) {
    if (!rolls(p.symbol)) continue;
    next = fillNow(next, { id: '', placed: at, symbol: p.symbol, contract: p.contract, side: p.long ? 'sell' : 'buy', qty: p.qty, kind: 'market', exit: true, tif: 'day', status: 'working', tag: p.tag }, futPriceAt(p.symbol, day, FUT_LAST_MIN), 'roll', at);
  }
  return next;
}

/** Move the clock forward to a moment, running every minute between. Backward moves never touch the book. */
export function futAdvance(s: FutSession, to: Moment, now: number): FutSession {
  const days = tapeDays();
  const from = s.cursor;
  if (stampOf(to) <= stampOf(from)) {
    const floor = futFloorOf(s);
    return { ...s, touchedAt: now, cursor: stampOf(to) < stampOf(floor) ? floor : to };
  }
  let next = s;
  for (let di = dayIndex(from.day); di <= dayIndex(to.day) && di < days.length; di++) {
    const day = days[di];
    const first = day === from.day ? from.minute + 1 : 0;
    const last = day === to.day ? to.minute : FUT_LAST_MIN;
    for (let m = first; m <= last; m++) if (next.orders.some(o => o.status === 'working')) next = minuteOrders(next, { day, minute: m });
    if (last === FUT_LAST_MIN) next = endOfDay(next, day, days[di + 1] ?? null);
  }
  return { ...next, cursor: to, touchedAt: now };
}

/* ---- the report's cuts ---- */
export interface FutCut {
  label: string;
  n: number;
  winRate: number;
  net: number;
  /** Over the trades that had a stop — null when none did */
  avgR: number | null;
}
const cutBy = (trades: FutTrade[], groups: [string, (t: FutTrade) => boolean][]): FutCut[] =>
  groups
    .map(([label, pick]) => {
      const g = trades.filter(pick);
      const withR = g.filter(t => t.r != null);
      return { label, n: g.length, winRate: g.length ? g.filter(t => t.pnl > 0).length / g.length : 0, net: cents(g.reduce((a, t) => a + t.pnl, 0)), avgR: withR.length ? withR.reduce((a, t) => a + (t.r ?? 0), 0) / withR.length : null };
    })
    .filter(c => c.n > 0);
/** The cuts that matter for futures */
export function futCutsOf(trades: FutTrade[]): { title: string; rows: FutCut[] }[] {
  const symbols = [...new Set(trades.map(t => t.symbol))];
  /* the minute of the trading day: 0 is 18:00, 930 is 09:30, 1320 is 16:00 */
  return [
    { title: 'By product', rows: symbols.length > 1 ? cutBy(trades, symbols.map(sym => [sym, (t: FutTrade) => t.symbol === sym] as [string, (t: FutTrade) => boolean])) : [] },
    { title: 'Long against short', rows: cutBy(trades, [['Long', t => t.long], ['Short', t => !t.long]]) },
    { title: 'By when it was entered', rows: cutBy(trades, [['Overnight · 18:00 to 09:30', t => t.opened.minute < 930], ['The day session · 09:30 to 16:00', t => t.opened.minute >= 930 && t.opened.minute < 1320], ['The last hour · 16:00 to 17:00', t => t.opened.minute >= 1320]]) },
    { title: 'How it ended', rows: cutBy(trades, [['Closed by you', t => t.how === 'closed'], ['Target hit', t => t.how === 'target'], ['Stopped out', t => t.how === 'stopped'], ['Closed at the roll', t => t.how === 'rolled'], ['Scaled out · in pieces', t => t.how === 'scaled']]) },
    { title: 'With a stop against without', rows: cutBy(trades, [['A stop rode it', t => t.risk != null], ['No stop', t => t.risk == null]]) },
  ].filter(c => c.rows.length > 0);
}
export { futPrice };
