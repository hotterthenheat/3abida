/*
==================================================
  SLAYER TERMINAL - REVIEW · THE BACKTEST'S ENGINE
  (data/review/engine.ts)

  docs/review-backtest-rules.md, in code — and
  nothing else. Pure functions over a Session: no
  clock of its own, no storage, no React. A session
  is its orders and its fills; everything the desk
  shows (cash, positions, trades, the report) is READ
  off those, so it cannot drift from them.

  FROZEN FACTS: a fill is written once and never
  edited. Version 1 trades LONG calls and puts, paid
  in cash — buy to open, sell to close.

  TWO THINGS A WAY OUT CAN WAIT ON (Noah, 2026-09-20,
  thinking about what options have that futures do not:
  "do those tps and stop losses increase or decrease
  depending on how close you are to expiration?"). A
  target or a stop set on THE CONTRACT'S PRICE keeps its
  dollars — and because the contract decays, the place
  the NAME has to reach for it moves every minute: on a
  same-day contract the stop walks up into a name that
  has not moved, and sells. A target or a stop set on
  THE NAME'S PRICE (`on: 'name'`) is the other way
  round: the level stays where it was put, the dollars
  it will make are whatever the contract bids when the
  name gets there. Both are real ways traders leave;
  the record treats them the same (target · stopped).

  TWO NAMES, ONE CLOCK, ONE ACCOUNT (Noah, 2026-09-20:
  "should a user be able to choose more than one ticker
  during 1 backtesting session? like 2"). Every order
  and fill already carries its contract's name, so a
  session of two names is the same book on the same
  cash — `tickers` holds them (two at most; `ticker`
  stays, the first, so a session saved before this
  still opens).

  A VERTICAL SPREAD, BOUGHT FOR A DEBIT (2026-09-20),
  is one contract with a second strike (quotes.ts): a
  bull call spread, a bear put spread. It is paid for in
  cash and the most it can lose is what it cost, so it
  is the same trade to every rule here — one position,
  one price, one target, one stop, one line at the bell
  (what it is worth in the money, never more than its
  width) — with the fee charged on both legs. Spreads
  SOLD for a credit need cash held against them and are
  not in this version.

  A LADDER OF WAYS OUT (Noah, 2026-09-20: "some people
  have multiple tps and stop losses in place"). The pair
  a position carried — one target, one stop — is now a
  GROUP (the orders that share an `oco`): up to three
  targets and two stops, each for its own contracts.
  When a target fills the stops give up that many, the
  furthest first, and the other way round; flat,
  everything goes; a market sell by hand is never
  "spoken for" — the ladder gives way. Two switches
  ride a stop: BREAKEVEN (the first target's fill moves
  it to what was paid) and TRAILING (it keeps the
  distance it was set at from the best price since,
  checked before it is moved). The ladder's arithmetic
  is data/review/ladder.ts, which Paper shares.

  THE READER'S OWN RULES ARE HARD BLOCKS (his word:
  "build it, hard blocks"). Set when the session
  starts, never after: how many positions may be open
  at once, how much of the account one trade may cost,
  and how far down a day may go before it is over.
  They stop a way IN, in words, and never a way OUT —
  a rule that kept a reader in a losing contract would
  be the opposite of discipline.
==================================================
*/

import { MAX_STOPS, MAX_TARGETS, giveUp, ladderShapeRefusal, nextRung, rungsOf, type LadderBracket } from './ladder';
import { contractKey, dteAt, legsOf, quoteAt, quoteWith, spotForBid, type ContractId, type Quote } from './quotes';
import { LAST_MIN, dayIndex, tapeDays } from './tape';
import type { DayNote, JournalEntry } from './journal';

/** A cursor: the END of minute `minute` (0…389) of a day */
export interface Moment {
  day: string;
  minute: number;
}
export type Side = 'buy' | 'sell';
export type OrderKind = 'market' | 'limit' | 'stop';
export type FillHow = OrderKind | 'expired';

export interface Order {
  id: string;
  placed: Moment;
  contract: ContractId;
  side: Side;
  qty: number;
  kind: OrderKind;
  /** The limit, or the stop's trigger — dollars a share of the CONTRACT; with `on: 'name'`, a price of the NAME */
  price?: number;
  /** 'name': a sell that waits for the NAME to reach `price`, then sells at the bid (see the head note). `kind` still says
      which it is — 'limit' a target, 'stop' a stop. */
  on?: 'name';
  tif: 'day' | 'gtc';
  status: 'working' | 'filled' | 'cancelled' | 'refused';
  /** Why it was refused or cancelled, in plain words */
  why?: string;
  done?: Moment;
  fillPrice?: number;
  /** A target and a stop that ride one buy share this: when one fills the other goes */
  oco?: string;
  /** What rides a buy once it fills — prices of the contract, or (`on: 'name'`) of the name */
  bracket?: Bracket;
  /** What the ticket was for — the trade's tag */
  tag?: string;
  /** A STOP of a ladder: the first target's fill moves it to what was paid (once) */
  breakeven?: boolean;
  /** A TRAILING stop: the distance it keeps from the best price since it was armed (`peak`) — the contract's bid, or the
      name's level where it is pinned to the name */
  trail?: number;
  peak?: number;
  /** When a switch last moved it (breakeven) — the book says so */
  moved?: Moment;
}
/** What rides a buy: a ladder's rungs (or the single target and stop), the two switches — and what they wait on */
export interface Bracket extends LadderBracket {
  on?: 'name';
}
export interface Fill {
  id: string;
  orderId: string | null;
  at: Moment;
  contract: ContractId;
  side: Side;
  qty: number;
  price: number;
  fee: number;
  how: FillHow;
  /** The contract as it stood when it filled — what the report cuts by */
  spot: number;
  delta: number;
  iv: number;
  theta: number;
  tag?: string;
  /** The stop that rode the buy, if one did — the planned risk */
  plannedStop?: number;
}
/** The reader's own rules for a session — hard blocks on a way in, set at its start (see the head note) */
export interface SessionRules {
  /** Positions open at once, across every name */
  maxOpen?: number;
  /** The most one trade may cost (premium + fees, every buy of it), as a share of what the account is worth */
  maxRiskPct?: number;
  /** Down this share of the account since the day's open, the day is over: no new positions until the next one */
  dailyLossPct?: number;
}
/** Ours, not the reader's: past this many open positions a tape cannot be read */
export const OPEN_CEILING = 10;
/** Names a session may trade */
export const MAX_NAMES = 2;

export interface Session {
  id: string;
  name: string;
  /** The first name — kept so a session saved before `tickers` still opens */
  ticker: string;
  /** Every name the session trades: one or two */
  tickers?: string[];
  rules?: SessionRules;
  startCash: number;
  /** Dollars a contract, each way */
  fee: number;
  startDay: string;
  cursor: Moment;
  orders: Order[];
  fills: Fill[];
  /** The reader's words on a trade, by the trade's id */
  notes: Record<string, string>;
  /** The journal's (data/review/journal.ts): the reader's words and tags on a closed trade, and a note on a replayed day.
      The engine never reads them. */
  journal?: Record<string, JournalEntry>;
  days?: Record<string, DayNote>;
  createdAt: number;
  touchedAt: number;
  seq: number;
}

export const DEFAULT_FEE = 0.65;
export const MULT = 100;
/** A moment as one number, for order. 2,000 a day: an option's day is 390 minutes */
export const stampOf = (m: Moment): number => dayIndex(m.day) * 2000 + m.minute;
const cents = (v: number) => Math.round(v * 100) / 100;

/** The names a session trades, first one first */
export const namesOf = (s: Pick<Session, 'ticker' | 'tickers'>): string[] => (s.tickers?.length ? s.tickers : [s.ticker]);

export function newSession(o: { id: string; name: string; ticker: string; tickers?: string[]; rules?: SessionRules; startCash: number; fee?: number; startDay: string; now: number }): Session {
  const names = [...new Set((o.tickers?.length ? o.tickers : [o.ticker]).map(t => t.toUpperCase()))].slice(0, MAX_NAMES);
  return { id: o.id, name: o.name, ticker: names[0], tickers: names, rules: o.rules, startCash: o.startCash, fee: o.fee ?? DEFAULT_FEE, startDay: o.startDay, cursor: { day: o.startDay, minute: 0 }, orders: [], fills: [], notes: {}, createdAt: o.now, touchedAt: o.now, seq: 0 };
}

/* ---- what the fills add up to ---- */
export interface Position {
  key: string;
  contract: ContractId;
  qty: number;
  /** Average price paid, dollars a share */
  avg: number;
  /** Fees paid on the buys still held */
  fees: number;
  opened: Moment;
  /** Where the name stood when it was entered — the chart draws the position there */
  spotIn: number;
  /** The id of the trade this position is — its first fill's */
  tradeId: string;
  tag?: string;
  /** What the pieces already sold have banked: their proceeds less their share of the cost, fees in (the chart's RP&L) */
  banked: number;
}
export interface Trade {
  id: string;
  contract: ContractId;
  /** Contracts bought over the trade's life */
  qty: number;
  avgIn: number;
  avgOut: number;
  /** What was paid for it, fees in — the trade's risk, so 1R */
  cost: number;
  pnl: number;
  r: number;
  opened: Moment;
  closed: Moment;
  /** How it ended — 'scaled': it left in more than one piece (`legs` has each) */
  how: 'sold' | 'target' | 'stopped' | 'expired' | 'scaled';
  /** Every fill of the trade, in order — the ways in, and each piece it left in */
  legs: TradeLeg[];
  dteIn: number;
  deltaIn: number;
  ivIn: number;
  thetaIn: number;
  spotIn: number;
  spotOut: number;
  /** Session minutes the trade was on */
  heldMin: number;
  plannedStop?: number;
  tag?: string;
}

export interface TradeLeg {
  at: Moment;
  side: Side;
  qty: number;
  price: number;
  fee: number;
  /** A piece going out: by a target, a stop, the reader's hand, or the bell */
  out?: 'target' | 'stop' | 'hand' | 'bell';
}

export function cashOf(s: Session): number {
  let cash = s.startCash;
  for (const f of s.fills) cash += (f.side === 'buy' ? -1 : 1) * f.price * MULT * f.qty - f.fee;
  return cents(cash);
}

interface Book {
  positions: Position[];
  trades: Trade[];
}
const heldMinutes = (a: Moment, b: Moment) => Math.max(0, (dayIndex(b.day) - dayIndex(a.day)) * (LAST_MIN + 1) + (b.minute - a.minute));
/** Every fill, in order, folded into the positions still open and the trades that closed */
export function bookOf(s: Session): Book {
  interface Open {
    first: Fill;
    qty: number;
    bought: number;
    paid: number;
    feesIn: number;
    got: number;
    feesOut: number;
    sold: number;
    lastHow: FillHow;
    lastOrder: string | null;
    legs: TradeLeg[];
  }
  const open = new Map<string, Open>();
  const trades: Trade[] = [];
  const targets = new Set(s.orders.filter(o => o.oco && o.kind === 'limit' && o.side === 'sell').map(o => o.id));
  for (const f of s.fills) {
    const key = contractKey(f.contract);
    let o = open.get(key);
    if (f.side === 'buy') {
      if (!o) open.set(key, (o = { first: f, qty: 0, bought: 0, paid: 0, feesIn: 0, got: 0, feesOut: 0, sold: 0, lastHow: f.how, lastOrder: f.orderId, legs: [] }));
      o.legs.push({ at: f.at, side: 'buy', qty: f.qty, price: f.price, fee: f.fee });
      o.qty += f.qty;
      o.bought += f.qty;
      o.paid += f.price * f.qty;
      o.feesIn += f.fee;
      continue;
    }
    if (!o) continue;
    const q = Math.min(f.qty, o.qty);
    o.qty -= q;
    o.sold += q;
    o.got += f.price * q;
    o.feesOut += f.fee;
    o.lastHow = f.how;
    o.lastOrder = f.orderId;
    o.legs.push({ at: f.at, side: 'sell', qty: q, price: f.price, fee: f.fee, out: f.how === 'expired' ? 'bell' : f.how === 'stop' ? 'stop' : f.orderId && targets.has(f.orderId) ? 'target' : 'hand' });
    if (o.qty > 0) continue;
    const cost = o.paid * MULT + o.feesIn;
    const pnl = o.got * MULT - o.feesOut - cost;
    trades.push({
      id: o.first.id,
      contract: f.contract,
      qty: o.bought,
      avgIn: cents(o.paid / o.bought),
      avgOut: cents(o.got / Math.max(1, o.sold)),
      cost: cents(cost),
      pnl: cents(pnl),
      r: cost > 0 ? pnl / cost : 0,
      opened: o.first.at,
      closed: f.at,
      how: o.legs.filter(l => l.side === 'sell').length > 1 ? 'scaled' : f.how === 'expired' ? 'expired' : f.how === 'stop' ? 'stopped' : f.orderId && targets.has(f.orderId) ? 'target' : 'sold',
      legs: o.legs,
      dteIn: dteAt(o.first.at.day, f.contract.expiry),
      deltaIn: o.first.delta,
      ivIn: o.first.iv,
      thetaIn: o.first.theta,
      spotIn: o.first.spot,
      spotOut: f.spot,
      heldMin: heldMinutes(o.first.at, f.at),
      plannedStop: o.first.plannedStop,
      tag: o.first.tag,
    });
    open.delete(key);
  }
  const positions: Position[] = [...open.entries()].map(([key, o]) => ({
    key,
    contract: o.first.contract,
    qty: o.qty,
    avg: cents(o.paid / o.bought),
    fees: cents((o.feesIn * o.qty) / o.bought),
    opened: o.first.at,
    spotIn: o.first.spot,
    tradeId: o.first.id,
    tag: o.first.tag,
    banked: cents(o.got * MULT - o.feesOut - (o.paid * MULT + o.feesIn) * (o.sold / o.bought)),
  }));
  return { positions, trades };
}

/** WHAT A NAME HAS BANKED (the chart's RP&L, 2026-09-22): its closed trades, and what its open ones have sold off in pieces,
    fees in — from the fills of the days before `beforeDay` (none: all of them). The day's share is the whole less that. */
export function bankedOf(s: Session, name: string, beforeDay?: string): number {
  const { positions, trades } = bookOf({ ...s, fills: s.fills.filter(f => f.contract.ticker === name && (beforeDay == null || f.at.day < beforeDay)) });
  return cents(trades.reduce((x, t) => x + t.pnl, 0) + positions.reduce((x, p) => x + p.banked, 0));
}

export interface Account {
  cash: number;
  /** Cash + what the open contracts are marked at */
  equity: number;
  openPnl: number;
  /** Closed trades, and the closed share of the open ones */
  realized: number;
  positions: (Position & { quote: Quote; value: number; pnl: number; r: number })[];
  trades: Trade[];
}
export function accountOf(s: Session): Account {
  const { positions, trades } = bookOf(s);
  const cash = cashOf(s);
  const marked = positions.map(p => {
    const quote = quoteAt(p.contract, s.cursor.day, s.cursor.minute);
    const value = quote.mark * MULT * p.qty;
    const cost = p.avg * MULT * p.qty + p.fees;
    return { ...p, quote, value: cents(value), pnl: cents(value - cost), r: cost > 0 ? (value - cost) / cost : 0 };
  });
  const held = marked.reduce((a, p) => a + p.value, 0);
  const openPnl = marked.reduce((a, p) => a + p.pnl, 0);
  const equity = cents(cash + held);
  return { cash, equity, openPnl: cents(openPnl), realized: cents(equity - s.startCash - openPnl), positions: marked, trades };
}

/* ---- orders ---- */
export interface Draft {
  contract: ContractId;
  side: Side;
  qty: number;
  kind: OrderKind;
  price?: number;
  on?: 'name';
  tif?: 'day' | 'gtc';
  bracket?: Bracket;
  tag?: string;
}
/** A sell that waits on the NAME: which way the name has to go. A target waits on the contract's good side — a call's name
    up, a put's down — and a stop on the other. */
export const nameGoesUp = (kind: OrderKind, right: ContractId['right']): boolean => (kind === 'limit') === (right === 'C');
/** Has the name reached an order's level? The engine sees the name once a minute, at the minute's end. */
const nameHit = (o: { kind: OrderKind; contract: ContractId; price?: number }, spot: number): boolean => (nameGoesUp(o.kind, o.contract.right) ? spot >= o.price! : spot <= o.price!);
const nextId = (s: Session, p: string): [string, Session] => [`${p}${s.seq + 1}`, { ...s, seq: s.seq + 1 }];

/** The planned risk a buy carried: its stop as a price of the contract — for a stop on the name, what the contract would
    have bid with the name there, at the minute of the buy */
function plannedStopOf(o: Order, at: Moment): number | undefined {
  const { stops } = rungsOf(o.bracket, o.qty);
  if (!stops.length) return undefined;
  /* more than one: where they stand on average, by their contracts */
  const asContract = (level: number) => (o.bracket?.on === 'name' ? quoteWith(o.contract, at.day, at.minute, level).bid : level);
  const n = stops.reduce((a, r) => a + r.qty, 0);
  return cents(stops.reduce((a, r) => a + asContract(r.price) * r.qty, 0) / Math.max(1, n));
}

/** How far a working way out stands from the price, as a share of it — what "the furthest rung" is measured by. A rung on
    the contract's price is measured from its bid, one pinned to the name from where the name stands. */
const farness = (o: Order, q: Quote): number => (o.on === 'name' ? Math.abs((o.price ?? 0) - q.spot) / Math.max(0.01, q.spot) : Math.abs((o.price ?? 0) - q.bid) / Math.max(0.01, q.bid));
const workingSells = (s: Session, key: string) => s.orders.filter(o => o.status === 'working' && o.side === 'sell' && contractKey(o.contract) === key);
/** Set working orders' contracts; an order left with none goes, in those words */
const resize = (s: Session, left: Map<string, number>, at: Moment, why: string): Session => ({
  ...s,
  orders: s.orders.map(x => {
    const q = left.get(x.id);
    if (q == null || x.status !== 'working' || q === x.qty) return x;
    return q <= 0 ? { ...x, status: 'cancelled' as const, done: at, why } : { ...x, qty: q };
  }),
});

/** AFTER A SELL: the ladder is made to fit what is still held (the rules page, "A ladder of ways out") */
function afterSell(s: Session, sold: Order, q: Quote, at: Moment): Session {
  const key = contractKey(sold.contract);
  let next = s;
  /* a rung filled: the OTHER side of its group gives up that many contracts, the furthest first */
  if (sold.oco) {
    const other = workingSells(next, key).filter(o => o.oco === sold.oco && o.kind !== sold.kind);
    next = resize(next, giveUp(other, sold.qty, o => farness(o, q)), at, 'its pair filled');
    /* BREAKEVEN: the first target of the group to fill moves its stops to what was paid */
    const firstTarget = sold.kind === 'limit' && !s.orders.some(o => o.oco === sold.oco && o.kind === 'limit' && o.status === 'filled' && o.id !== sold.id);
    const pos = bookOf(next).positions.find(p => p.key === key);
    if (firstTarget && pos) {
      next = {
        ...next,
        orders: next.orders.map(o => {
          if (o.status !== 'working' || o.oco !== sold.oco || o.kind !== 'stop' || !o.breakeven) return o;
          const now = o.on === 'name' ? quoteWith(o.contract, at.day, at.minute, o.price ?? 0).bid : (o.price ?? 0);
          /* only where it would still wait, and never DOWN */
          if (!(q.bid > pos.avg) || pos.avg <= now) return { ...o, breakeven: false };
          return { ...o, on: undefined, price: pos.avg, breakeven: false, moved: at, ...(o.trail != null ? { trail: cents(Math.max(0.01, q.bid - pos.avg)), peak: q.bid } : {}) };
        }),
      };
    }
  }
  const held = bookOf(next).positions.find(p => p.key === key)?.qty ?? 0;
  const mine = workingSells(next, key);
  /* flat: whatever was still waiting to sell it has nothing to sell */
  if (held === 0) return resize(next, new Map(mine.map(o => [o.id, 0])), at, 'the position was closed');
  /* …and what is left never speaks for more than is held: a sell by hand takes its contracts from the furthest rungs */
  const loose = mine.filter(o => !o.oco).reduce((a, o) => a + o.qty, 0);
  const cover = Math.max(0, held - loose);
  for (const kind of ['limit', 'stop'] as const) {
    const side = workingSells(next, key).filter(o => o.oco && o.kind === kind);
    const over = side.reduce((a, o) => a + o.qty, 0) - cover;
    if (over > 0) next = resize(next, giveUp(side, over, o => farness(o, q)), at, 'its contracts were sold');
  }
  return next;
}

function fillNow(s: Session, o: Order, price: number, how: FillHow, q: Quote, at: Moment): Session {
  let [id, next] = nextId(s, 'f');
  const fill: Fill = { id, orderId: o.id || null, at, contract: o.contract, side: o.side, qty: o.qty, price: cents(price), fee: how === 'expired' ? 0 : cents(s.fee * o.qty * legsOf(o.contract)), how, spot: q.spot, delta: q.delta, iv: q.iv, theta: q.theta, tag: o.tag, plannedStop: plannedStopOf(o, at) };
  next = { ...next, fills: [...next.fills, fill], orders: next.orders.map(x => (x.id === o.id ? { ...x, status: 'filled' as const, done: at, fillPrice: fill.price } : x)) };
  /* a sell: the ladder it belongs to — or stands beside — is made to fit what is still held */
  if (o.side === 'sell') next = afterSell(next, o, q, at);
  /* a buy that carried ways out leaves them working, as one group */
  const { targets, stops } = rungsOf(o.side === 'buy' ? o.bracket : undefined, o.qty);
  if (targets.length || stops.length) {
    const [oco, n2] = nextId(next, 'g');
    next = n2;
    const on = o.bracket?.on;
    for (const [kind, rungs] of [['limit', targets], ['stop', stops]] as const) {
      for (const r of rungs) {
        const [oid, n3] = nextId(next, 'o');
        const switches = kind === 'stop' ? { breakeven: o.bracket?.breakeven || undefined, ...(o.bracket?.trail ? (o.bracket.trailBy ? trailAt(o.bracket.trailBy, on, q) : trailFrom(r.price, on, q)) : {}) } : {};
        next = { ...n3, orders: [...n3.orders, { id: oid, placed: at, contract: o.contract, side: 'sell', qty: r.qty, kind, price: r.price, on, tif: 'gtc', status: 'working', oco, tag: o.tag, ...switches }] };
      }
    }
  }
  return next;
}
/** A stop armed to trail, as the quote stands: the distance it keeps, and the best price so far */
const trailFrom = (price: number, on: 'name' | undefined, q: Quote): { trail: number; peak: number } => (on === 'name' ? { trail: cents(Math.max(0.01, Math.abs(q.spot - price))), peak: q.spot } : { trail: cents(Math.max(0.01, q.bid - price)), peak: q.bid });
/** …or by a TYPED distance: the stop stays where it is until the price has run that far past it, then follows */
const trailAt = (by: number, on: 'name' | undefined, q: Quote): { trail: number; peak: number } => ({ trail: cents(Math.max(0.01, by)), peak: on === 'name' ? q.spot : q.bid });

/** Contracts of this one already spoken for by working sells: a loose sell's own, and — for a ladder — the bigger of what
    its targets and its stops speak for (they are the same contracts, waiting on two things) */
const reserved = (s: Session, key: string) => {
  const byGroup = new Map<string, { limit: number; stop: number }>();
  let loose = 0;
  for (const o of workingSells(s, key)) {
    if (!o.oco || o.kind === 'market') loose += o.qty;
    else {
      const g = byGroup.get(o.oco) ?? { limit: 0, stop: 0 };
      g[o.kind] += o.qty;
      byGroup.set(o.oco, g);
    }
  }
  return loose + [...byGroup.values()].reduce((a, g) => a + Math.max(g.limit, g.stop), 0);
};

/* ---- the reader's own rules ---- */
/** What the account was worth at today's open: the book as the fills BEFORE today left it, marked at the open's first minute */
export function equityAtOpen(s: Session): number {
  const before = s.fills.filter(f => f.at.day < s.cursor.day);
  if (!before.length) return s.startCash;
  return accountOf({ ...s, fills: before, cursor: { day: s.cursor.day, minute: 0 } }).equity;
}
export interface DayState {
  /** Today's result so far, as a share of what the account was worth at the open */
  pct: number;
  /** The reader's daily stop has been reached: no new positions until the next open */
  stopped: boolean;
}
export function dayStateOf(s: Session): DayState {
  const open = equityAtOpen(s);
  const pct = open > 0 ? (accountOf(s).equity - open) / open : 0;
  const limit = s.rules?.dailyLossPct;
  return { pct, stopped: limit != null && limit > 0 && pct <= -limit + 1e-9 };
}
/** Contracts a working BUY would open that are not held yet — counted with the open positions, so a resting order can
    never carry the book past the reader's limit on the minute it fills */
const pendingNew = (s: Session, held: Set<string>): Set<string> => {
  const out = new Set<string>();
  for (const o of s.orders) if (o.status === 'working' && o.side === 'buy' && !held.has(contractKey(o.contract))) out.add(contractKey(o.contract));
  return out;
};
const pctWords = (v: number) => `${+(v * 100).toFixed(1)}%`;
const money = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Why the reader's rules (or our ceiling) stop this BUY, or null */
function ruleRefusal(s: Session, d: Draft, cost: number): string | null {
  const positions = bookOf(s).positions;
  const held = new Set(positions.map(p => p.key));
  const key = contractKey(d.contract);
  if (!held.has(key)) {
    const pending = pendingNew(s, held);
    const open = held.size + pending.size - (pending.has(key) ? 1 : 0);
    const cap = s.rules?.maxOpen;
    if (cap != null && cap > 0 && open >= cap) return `Your session’s rule: no more than ${cap} ${cap === 1 ? 'position' : 'positions'} open at once`;
    if (open >= OPEN_CEILING) return `No more than ${OPEN_CEILING} positions open at once — close one first`;
  }
  const risk = s.rules?.maxRiskPct;
  if (risk != null && risk > 0) {
    const worth = accountOf(s).equity;
    const mine = positions.find(p => p.key === key);
    const inIt = (mine ? mine.avg * MULT * mine.qty + mine.fees : 0) + cost;
    if (inIt > worth * risk + 1e-9) return `Your session’s rule: no more than ${pctWords(risk)} of the account on one trade — this would be ${money(inIt)} of ${money(worth * risk)}`;
  }
  const limit = s.rules?.dailyLossPct;
  if (limit != null && limit > 0) {
    const day = dayStateOf(s);
    if (day.stopped) return `Your session’s rule: down ${pctWords(-day.pct)} on the day (the stop is ${pctWords(limit)}) — no new positions until the next open`;
  }
  return null;
}

/** Why a draft cannot be taken, or null. The same words the ticket shows before the press. */
export function refusal(s: Session, d: Draft): string | null {
  if (!Number.isInteger(d.qty) || d.qty < 1) return 'Enter a whole number of contracts';
  if (!namesOf(s).includes(d.contract.ticker.toUpperCase())) return `This session trades ${namesOf(s).join(' and ')}`;
  if (d.contract.expiry < s.cursor.day) return 'That contract has expired';
  if (d.contract.short != null) {
    /* a spread is BOUGHT here: the strike sold is the one further out — a call's above, a put's below */
    const { strike, short, right } = d.contract;
    if (short === strike) return 'A spread needs two different strikes';
    if (right === 'C' ? short < strike : short > strike) return 'A spread here is bought for a debit — the strike you sell has to be further out than the one you buy';
  }
  if (d.kind !== 'market' && !(d.price && d.price > 0)) return 'Enter a price';
  if (d.kind === 'stop' && d.side === 'buy') return 'A stop is a way out — it sells';
  if (d.on === 'name' && (d.side === 'buy' || d.kind === 'market')) return 'Only a sell that waits can be set on the name’s price';
  /* 16:00 HAS RUNG: contracts have no overnight session. Nothing fills at the market until the next open; an order that
     waits (a limit, a stop) is taken and waits for it. */
  if (d.kind === 'market' && s.cursor.minute >= LAST_MIN) return 'The market is shut — 16:00 has rung. Open the next day, or leave a limit that waits for it';
  const q = quoteAt(d.contract, s.cursor.day, s.cursor.minute);
  const name = d.contract.ticker;
  if (d.side === 'buy') {
    const px = d.kind === 'limit' ? Math.min(d.price!, q.ask) : q.ask;
    const need = px * MULT * d.qty + s.fee * d.qty * legsOf(d.contract);
    if (need > cashOf(s) + 1e-9) return `Not enough cash — this needs $${need.toFixed(2)}`;
    if (d.kind === 'market' && q.dead) return 'No market in that contract right now';
    const ruled = ruleRefusal(s, d, need);
    if (ruled) return ruled;
    const shape = ladderShapeRefusal(d.bracket, d.qty);
    if (shape) return shape;
    const { targets, stops } = rungsOf(d.bracket, d.qty);
    const many = (n: number, word: string) => (n > 1 ? `Every ${word}` : `The ${word}`);
    if (d.bracket?.on === 'name') {
      /* on the name: the target on the contract's good side of where the name stands, the stop on the other */
      const up = d.contract.right === 'C';
      if (targets.some(r => (up ? r.price <= q.spot : r.price >= q.spot))) return `${many(targets.length, 'target')} has to be ${up ? 'above' : 'below'} where ${name} stands`;
      if (stops.some(r => (up ? r.price >= q.spot : r.price <= q.spot))) return `${many(stops.length, 'stop')} has to be ${up ? 'below' : 'above'} where ${name} stands`;
      return null;
    }
    if (targets.some(r => r.price <= px)) return `${many(targets.length, 'target')} has to be above what you pay`;
    if (stops.some(r => r.price >= px)) return `${many(stops.length, 'stop')} has to be under what you pay`;
    return null;
  }
  const held = bookOf(s).positions.find(p => p.key === contractKey(d.contract))?.qty ?? 0;
  /* A MARKET SELL BY HAND IS NEVER "SPOKEN FOR": the ladder gives way (afterSell). A sell that WAITS has to find contracts
     nothing else speaks for. */
  if (d.kind === 'market' ? held < d.qty : held - reserved(s, contractKey(d.contract)) < d.qty) return held ? (d.kind === 'market' ? `You hold ${held}` : 'Those contracts are already spoken for by a working order') : 'You do not hold that contract';
  if (d.kind === 'market' && q.dead) return 'No bid to sell into right now';
  if (d.on === 'name' && nameHit(d, q.spot)) return `${name} is already past that — it would sell on the next minute`;
  return null;
}

/** Take an order. A market order fills on the minute the clock stands on; the rest wait for a later one. */
export function place(s: Session, d: Draft, now: number): Session {
  let [id, next] = nextId(s, 'o');
  const base: Order = { id, placed: s.cursor, contract: d.contract, side: d.side, qty: d.qty, kind: d.kind, price: d.kind === 'market' ? undefined : d.price, on: d.kind === 'market' ? undefined : d.on, tif: d.tif ?? (d.kind === 'market' ? 'day' : 'gtc'), status: 'working', bracket: d.side === 'buy' ? d.bracket : undefined, tag: d.tag };
  const why = refusal(s, d);
  next = { ...next, touchedAt: now, orders: [...next.orders, why ? { ...base, status: 'refused', why, done: s.cursor } : base] };
  if (why || d.kind !== 'market') return next;
  const q = quoteAt(d.contract, s.cursor.day, s.cursor.minute);
  return fillNow(next, base, d.side === 'buy' ? q.ask : q.bid, 'market', q, s.cursor);
}

export function cancel(s: Session, orderId: string, now: number): Session {
  return { ...s, touchedAt: now, orders: s.orders.map(o => (o.id === orderId && o.status === 'working' ? { ...o, status: 'cancelled', done: s.cursor, why: 'cancelled by you' } : o)) };
}

/** Move a working order's price — the same order, a new line on the chart. Not taken when the new price would not
    wait: a target at or under the bid, a stop at or over it, would simply fill on the next minute. */
export function amend(s: Session, orderId: string, price: number, now: number): Session {
  const o = s.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || !(price > 0)) return s;
  const q = quoteAt(o.contract, s.cursor.day, s.cursor.minute);
  /* a trailing stop dragged: it keeps its NEW distance from here on (the rules page) */
  const trail = o.kind === 'stop' && o.trail != null ? trailFrom(cents(price), o.on, q) : {};
  if (o.on === 'name') {
    /* a level of the name: not taken where the name already stands past it */
    if (nameHit({ ...o, price }, q.spot)) return s;
    return { ...s, touchedAt: now, orders: s.orders.map(x => (x.id === orderId ? { ...x, price: cents(price), ...trail } : x)) };
  }
  if (o.side === 'sell' && o.kind === 'limit' && price <= q.bid) return s;
  if (o.side === 'sell' && o.kind === 'stop' && price >= q.bid) return s;
  if (o.side === 'buy' && o.kind === 'limit' && price * MULT * o.qty + s.fee * o.qty * legsOf(o.contract) > cashOf(s)) return s;
  return { ...s, touchedAt: now, orders: s.orders.map(x => (x.id === orderId ? { ...x, price: cents(price), ...trail } : x)) };
}

/** What a further pull off a position's chip would do, per kind: 'first' (it speaks for every contract the ladder may),
    'more' (it adds a level), or null — the ladder is full, or no level has two contracts to give */
export function ladderRoom(s: Session, contract: ContractId): Record<'target' | 'stop', 'first' | 'more' | null> {
  const key = contractKey(contract);
  const pos = bookOf(s).positions.find(p => p.key === key);
  const q = quoteAt(contract, s.cursor.day, s.cursor.minute);
  const mine = workingSells(s, key);
  const cover = (pos?.qty ?? 0) - mine.filter(o => !o.oco).reduce((a, o) => a + o.qty, 0);
  const room = (kind: 'limit' | 'stop') => {
    const rungs = mine.filter(o => o.oco && o.kind === kind);
    if (!pos || cover < 1) return null;
    if (!rungs.length) return 'first' as const;
    return nextRung(rungs, cover, kind === 'limit' ? MAX_TARGETS : MAX_STOPS, o => farness(o, q)) ? ('more' as const) : null;
  };
  return { target: room('limit'), stop: room('stop') };
}
/** …and how many contracts that pull would speak for (nothing where it cannot be taken) — what the chart's preview prices */
export function ladderTake(s: Session, contract: ContractId): Record<'target' | 'stop', number> {
  const key = contractKey(contract);
  const pos = bookOf(s).positions.find(p => p.key === key);
  const q = quoteAt(contract, s.cursor.day, s.cursor.minute);
  const mine = workingSells(s, key);
  const cover = (pos?.qty ?? 0) - mine.filter(o => !o.oco).reduce((a, o) => a + o.qty, 0);
  const take = (kind: 'limit' | 'stop') => {
    const rungs = mine.filter(o => o.oco && o.kind === kind);
    if (!pos || cover < 1) return 0;
    return rungs.length ? (nextRung(rungs, cover, kind === 'limit' ? MAX_TARGETS : MAX_STOPS, o => farness(o, q))?.qty ?? 0) : cover;
  };
  return { target: take('limit'), stop: take('stop') };
}

/** A target or a stop put on a position ALREADY OPEN (on the chart: pulled off the position's own chip). THE FIRST of a kind
    speaks for every contract the ladder may (what is held, less what a loose working sell already speaks for); A FURTHER
    PULL ADDS A LEVEL — it takes the contracts no level of that kind covers yet, or else half of the biggest level's. Not
    taken when the ladder is full, when no level has two contracts to give, or when it would not wait (a target at or under
    the bid, a stop at or over it). With `on: 'name'` the price is a level of the NAME. A new stop wears the switches its
    group's stops wear. */
export function attach(s: Session, contract: ContractId, kind: 'target' | 'stop', price: number, now: number, on?: 'name'): Session {
  const key = contractKey(contract);
  const pos = bookOf(s).positions.find(p => p.key === key);
  if (!pos || !(price > 0)) return s;
  const q = quoteAt(contract, s.cursor.day, s.cursor.minute);
  const orderKind: OrderKind = kind === 'target' ? 'limit' : 'stop';
  if (on === 'name' ? nameHit({ kind: orderKind, contract, price }, q.spot) : kind === 'target' ? price <= q.bid : price >= q.bid) return s;
  const mine = workingSells(s, key);
  const group = mine.find(o => o.oco)?.oco;
  const rungs = mine.filter(o => o.oco && o.kind === orderKind);
  const cover = pos.qty - mine.filter(o => !o.oco).reduce((a, o) => a + o.qty, 0);
  if (cover < 1) return s;
  const take = rungs.length ? nextRung(rungs, cover, kind === 'target' ? MAX_TARGETS : MAX_STOPS, o => farness(o, q)) : { qty: cover, from: null };
  if (!take || take.qty < 1) return s;
  let next = s;
  let oco = group;
  if (!oco) [oco, next] = nextId(next, 'g');
  const [oid, n2] = nextId(next, 'o');
  const sibling = mine.find(o => o.oco === oco && o.kind === 'stop');
  const switches = kind === 'stop' ? { breakeven: sibling?.breakeven || undefined, ...(sibling?.trail != null ? trailFrom(cents(price), on, q) : {}) } : {};
  const orders = n2.orders.map(x => (take.from && x.id === take.from.id ? { ...x, qty: x.qty - take.qty } : x));
  return { ...n2, touchedAt: now, orders: [...orders, { id: oid, placed: s.cursor, contract, side: 'sell', qty: take.qty, kind: orderKind, price: cents(price), on, tif: 'gtc', status: 'working', oco, tag: pos.tag, ...switches }] };
}

/** A stop's TRAILING switch: on, it keeps a distance — `by`, where one is typed, else the distance it stands at NOW from
    the contract's bid (or, pinned to the name, from where the name stands) — measured from the best price since; off, it
    stays where it is */
export function setTrail(s: Session, orderId: string, on: boolean, now: number, by?: number): Session {
  const o = s.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || o.side !== 'sell' || o.kind !== 'stop' || o.price == null) return s;
  const q = quoteAt(o.contract, s.cursor.day, s.cursor.minute);
  if (on && by != null && !(by > 0)) return s;
  return { ...s, touchedAt: now, orders: s.orders.map(x => (x.id !== orderId ? x : on ? { ...x, ...(by != null ? trailAt(by, o.on, q) : trailFrom(o.price!, o.on, q)) } : { ...x, trail: undefined, peak: undefined })) };
}
/** BREAKEVEN is the ladder's: every working stop of the order's group is armed, or let go */
export function setBreakeven(s: Session, orderId: string, on: boolean, now: number): Session {
  const o = s.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || o.kind !== 'stop') return s;
  return { ...s, touchedAt: now, orders: s.orders.map(x => (x.status === 'working' && x.kind === 'stop' && (x.id === orderId || (o.oco && x.oco === o.oco)) ? { ...x, breakeven: on || undefined } : x)) };
}

/** THE SAME WAY OUT, WAITING ON THE OTHER THING — without moving its line. To the name: the level the name would have to
    stand at, this minute, for the contract to bid the order's price (from here on the LEVEL holds and the dollars drift).
    To the contract: what the contract would bid, this minute, with the name at the order's level (from here on the DOLLARS
    hold and the level drifts). Not taken when there is nothing to turn it into: a price no level in reach gives, or a
    level where the contract bids nothing. */
export function rebase(s: Session, orderId: string, to: 'name' | 'contract', now: number): Session {
  const o = s.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || o.side !== 'sell' || o.kind === 'market' || o.price == null) return s;
  if ((o.on === 'name') === (to === 'name')) return s;
  const { day, minute } = s.cursor;
  const price = to === 'name' ? spotForBid(o.contract, day, minute, o.price) : cents(quoteWith(o.contract, day, minute, o.price).bid);
  if (price == null || !(price > 0)) return s;
  const basis = to === 'name' ? ('name' as const) : undefined;
  /* a trailing stop keeps trailing — by the distance it stands at now, in what it now waits on */
  const trail = o.trail != null ? trailFrom(price, basis, quoteAt(o.contract, day, minute)) : {};
  return { ...s, touchedAt: now, orders: s.orders.map(x => (x.id === orderId ? { ...x, on: basis, price, ...trail } : x)) };
}

/* ---- the clock ---- */
/** THE EARLIEST THE CLOCK MAY STAND: where it stands now. THE CLOCK ONLY MOVES FORWARD (the audit's PR-2, 2026-10-09: run
    to 15:21, the day seen, back to 09:50 and a buy made $56.70 — the floor was only the last order or fill, so any part of
    the day ahead of the first trade could be looked at and then traded). A minute the clock has stood on is never stood
    on again before it. */
export function floorOf(s: Session): Moment {
  let at: Moment = s.cursor;
  /* a session kept from before the rule: its clock is never behind its own book */
  for (const o of s.orders) if (stampOf(o.placed) > stampOf(at)) at = o.placed;
  for (const f of s.fills) if (stampOf(f.at) > stampOf(at)) at = f.at;
  return at;
}

function minuteOrders(s: Session, at: Moment): Session {
  let next = s;
  for (const o of s.orders) {
    if (o.status !== 'working' || stampOf(o.placed) >= stampOf(at)) continue;
    const live = next.orders.find(x => x.id === o.id);
    if (!live || live.status !== 'working') continue;
    const q = quoteAt(o.contract, at.day, at.minute);
    if (q.dead) continue;
    if (o.on === 'name') {
      /* waits on the NAME: the minute it is there, the contracts are sold at that minute's bid — whatever it is */
      if (o.side === 'sell' && nameHit(o, q.spot)) next = fillNow(next, o, q.bid, o.kind, q, at);
      continue;
    }
    if (o.kind === 'limit' && o.side === 'buy' && q.ask <= o.price!) {
      /* the reader's daily stop was reached while this order rested: it does not open a position on a day that is over */
      if (dayStateOf({ ...next, cursor: at }).stopped) next = { ...next, orders: next.orders.map(x => (x.id === o.id ? { ...x, status: 'cancelled', done: at, why: 'your session’s rule: the day’s stop had been reached' } : x)) };
      else if (o.price! * MULT * o.qty + next.fee * o.qty * legsOf(o.contract) > cashOf(next)) next = { ...next, orders: next.orders.map(x => (x.id === o.id ? { ...x, status: 'cancelled', done: at, why: 'the cash was gone by then' } : x)) };
      else next = fillNow(next, o, Math.min(o.price!, q.ask), 'limit', q, at);
    } else if (o.kind === 'limit' && o.side === 'sell' && q.bid >= o.price!) next = fillNow(next, o, Math.max(o.price!, q.bid), 'limit', q, at);
    else if (o.kind === 'stop' && o.side === 'sell' && q.bid <= o.price!) next = fillNow(next, o, q.bid, 'stop', q, at);
  }
  /* TRAILING STOPS, AFTER THE CHECK: each was tried where it stood; only now is it moved by this minute's price — the good
     part of a minute is never assumed to have come before the bad part */
  if (next.orders.some(o => o.status === 'working' && o.trail != null)) {
    next = {
      ...next,
      orders: next.orders.map(o => {
        if (o.status !== 'working' || o.kind !== 'stop' || o.trail == null || o.price == null || stampOf(o.placed) >= stampOf(at)) return o;
        const q = quoteAt(o.contract, at.day, at.minute);
        if (q.dead) return o;
        if (o.on === 'name') {
          /* a call's stop sits under the name and follows its highs; a put's sits over it and follows its lows */
          const up = o.contract.right === 'C';
          const peak = up ? Math.max(o.peak ?? q.spot, q.spot) : Math.min(o.peak ?? q.spot, q.spot);
          const level = cents(up ? peak - o.trail : peak + o.trail);
          return { ...o, peak, price: up ? Math.max(o.price, level) : Math.min(o.price, level) };
        }
        const peak = Math.max(o.peak ?? q.bid, q.bid);
        return { ...o, peak, price: Math.max(o.price, cents(peak - o.trail)) };
      }),
    };
  }
  return next;
}

/** 16:00: what expires today settles at what it is worth in the money; day orders go */
function bell(s: Session, day: string): Session {
  const at: Moment = { day, minute: LAST_MIN };
  let next: Session = { ...s, orders: s.orders.map(o => (o.status === 'working' && (o.tif === 'day' || o.contract.expiry <= day) ? { ...o, status: 'cancelled' as const, done: at, why: o.contract.expiry <= day ? 'the contract expired' : 'the day ended' } : o)) };
  for (const p of bookOf(next).positions) {
    if (p.contract.expiry > day) continue;
    const q = quoteAt(p.contract, day, LAST_MIN);
    next = fillNow(next, { id: '', placed: at, contract: p.contract, side: 'sell', qty: p.qty, kind: 'market', tif: 'day', status: 'working', tag: p.tag }, q.intrinsic, 'expired', q, at);
  }
  return next;
}

/** Move the clock forward to a moment, running every minute between. A move back is refused: the clock stays (floorOf). */
export function advance(s: Session, to: Moment, now: number): Session {
  const days = tapeDays();
  const from = s.cursor;
  if (stampOf(to) <= stampOf(from)) return s;
  let next = s;
  for (let di = dayIndex(from.day); di <= dayIndex(to.day) && di < days.length; di++) {
    const day = days[di];
    const first = day === from.day ? from.minute + 1 : 0;
    const last = day === to.day ? to.minute : LAST_MIN;
    const busy = next.orders.some(o => o.status === 'working');
    if (busy) for (let m = first; m <= last; m++) next = minuteOrders(next, { day, minute: m });
    if (last === LAST_MIN) next = bell(next, day);
  }
  return { ...next, cursor: to, touchedAt: now };
}

/* ---- the report ---- */
export interface Stats {
  n: number;
  wins: number;
  winRate: number;
  net: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  expectancy: number;
  expectancyR: number;
  maxDrawdown: number;
  losingRun: number;
  avgHeldMin: number;
  best: number;
  worst: number;
}
/** What the report's figures need of a closed trade. A trade with no R is left out of the R figures. */
export interface Scored {
  pnl: number;
  r: number | null;
  /** A replayed moment — or a paper trade's real instant (data/paper/engine.ts), which carries `at` */
  closed: Moment | { at: number };
  heldMin: number;
}
/** A close, as one number for order: the instant where there is one, the replayed stamp where not (a journal is one kind or
    the other, so the two are never compared) */
const closedStamp = (m: Scored['closed']): number => ('at' in m ? m.at : stampOf(m));
export function statsOf(trades: Scored[]): Stats {
  const n = trades.length;
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const sum = (a: Scored[]) => a.reduce((x, t) => x + t.pnl, 0);
  const withR = trades.filter(t => t.r != null);
  let peak = 0;
  let run = 0;
  let dd = 0;
  let lr = 0;
  let cur = 0;
  for (const t of [...trades].sort((a, b) => closedStamp(a.closed) - closedStamp(b.closed))) {
    run += t.pnl;
    peak = Math.max(peak, run);
    dd = Math.max(dd, peak - run);
    cur = t.pnl <= 0 ? cur + 1 : 0;
    lr = Math.max(lr, cur);
  }
  const gw = sum(wins);
  const gl = Math.abs(sum(losses));
  return {
    n,
    wins: wins.length,
    winRate: n ? wins.length / n : 0,
    net: cents(sum(trades)),
    avgWin: wins.length ? cents(gw / wins.length) : 0,
    avgLoss: losses.length ? cents(-gl / losses.length) : 0,
    profitFactor: gl > 0 ? gw / gl : null,
    expectancy: n ? cents(sum(trades) / n) : 0,
    expectancyR: withR.length ? withR.reduce((x, t) => x + (t.r ?? 0), 0) / withR.length : 0,
    maxDrawdown: cents(dd),
    losingRun: lr,
    avgHeldMin: n ? trades.reduce((x, t) => x + t.heldMin, 0) / n : 0,
    best: n ? Math.max(...trades.map(t => t.pnl)) : 0,
    worst: n ? Math.min(...trades.map(t => t.pnl)) : 0,
  };
}

export interface Cut {
  label: string;
  n: number;
  winRate: number;
  net: number;
  avgR: number;
}
const cutBy = (trades: Trade[], groups: [string, (t: Trade) => boolean][]): Cut[] =>
  groups
    .map(([label, pick]) => {
      const g = trades.filter(pick);
      return { label, n: g.length, winRate: g.length ? g.filter(t => t.pnl > 0).length / g.length : 0, net: cents(g.reduce((a, t) => a + t.pnl, 0)), avgR: g.length ? g.reduce((a, t) => a + t.r, 0) / g.length : 0 };
    })
    .filter(c => c.n > 0);
/** The cuts only options have */
export function cutsOf(trades: Trade[]): { title: string; rows: Cut[] }[] {
  const ad = (t: Trade) => Math.abs(t.deltaIn);
  const names = [...new Set(trades.map(t => t.contract.ticker))];
  return [
    /* a session of two names: which one the edge lives in (a single name would be one row saying what the head already does) */
    { title: 'By name', rows: names.length > 1 ? cutBy(trades, names.map(n => [n, (t: Trade) => t.contract.ticker === n] as [string, (t: Trade) => boolean])) : [] },
    { title: 'Single contracts against spreads', rows: trades.some(t => t.contract.short != null) ? cutBy(trades, [['Single contracts', t => t.contract.short == null], ['Spreads', t => t.contract.short != null]]) : [] },
    { title: 'Calls against puts', rows: cutBy(trades, [['Calls', t => t.contract.right === 'C'], ['Puts', t => t.contract.right === 'P']]) },
    { title: 'By days to expiry at entry', rows: cutBy(trades, [['Same day', t => t.dteIn === 0], ['1 to 7 days', t => t.dteIn >= 1 && t.dteIn <= 7], ['8 to 30 days', t => t.dteIn >= 8 && t.dteIn <= 30], ['Over 30 days', t => t.dteIn > 30]]) },
    { title: 'By delta at entry', rows: cutBy(trades, [['Far out · under 0.25', t => ad(t) < 0.25], ['Out · 0.25 to 0.45', t => ad(t) >= 0.25 && ad(t) < 0.45], ['At the money · 0.45 to 0.60', t => ad(t) >= 0.45 && ad(t) <= 0.6], ['In the money · over 0.60', t => ad(t) > 0.6]]) },
    { title: 'How it ended', rows: cutBy(trades, [['Sold by you', t => t.how === 'sold'], ['Target hit', t => t.how === 'target'], ['Stopped out', t => t.how === 'stopped'], ['Held to the bell', t => t.how === 'expired'], ['Scaled out · in pieces', t => t.how === 'scaled']]) },
    { title: 'By the hour it was entered', rows: cutBy(trades, [['09:30 to 10:30', t => t.opened.minute < 60], ['10:30 to 12:00', t => t.opened.minute >= 60 && t.opened.minute < 150], ['12:00 to 14:00', t => t.opened.minute >= 150 && t.opened.minute < 270], ['14:00 to the bell', t => t.opened.minute >= 270]]) },
  ].filter(c => c.rows.length > 0);
}
/** Dollars of decay the trade was charged a day it was held, by the theta it was entered on */
export const decayPerDay = (t: Pick<Trade, 'thetaIn' | 'qty'>) => cents(Math.abs(t.thetaIn) * MULT * t.qty);
