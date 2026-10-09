/*
==================================================
  SLAYER TERMINAL - PAPER · THE LIVE ACCOUNT'S ENGINE
  (data/paper/engine.ts)

  docs/paper-rules.md, in code — and nothing else.
  Pure functions over an ACCOUNT that is its orders and
  its fills, the way the backtest's two engines are:
  everything the desk shows is READ off those, so it
  cannot drift from them. What is new is the clock. Not
  a replayed minute but THE MARKET AS IT STANDS: every
  function that needs a price is handed one
  (`PaperMarket`), so the proof hands it any market it
  likes and the feed (feed.ts) hands it the live one.
  Nothing here reads the simulator, the clock on the
  wall, or storage.

  OPTIONS, AND ONLY OPTIONS (2026-09-30: "on the paper
  trading remove all the futures and make it strictly
  Options trading"). Long calls and puts and verticals
  bought for a debit, paid in cash — the backtest's
  contracts, on its rules (review/engine.ts). A way in
  is paid for from what is FREE, which is cash: nothing
  is margined, so nothing is held back from it.

  THE LADDER OF WAYS OUT is data/review/ladder.ts, the
  backtest's, unchanged: three targets and two stops a
  position, one group, breakeven and trailing on a stop.

  TICKS, NOT MINUTES. A working order is looked at on
  every tick of the feed (`tick`), where a backtest
  looks once a minute. An order is never looked at on
  the tick it was placed on.

  AN EVALUATION is this account with a plan — options,
  a floor that trails the account's high mark, a day's
  limit, a cap on the contracts open at once, flat a
  minute before the 16:00 bell, a target that passes it.
  Its rules are HARD BLOCKS on a way in and HARD STOPS
  on the account; none of them ever refuses a way out.

  WHAT A TRADE WAS, WRITTEN DOWN AS IT HAPPENS. A
  simulated market cannot be walked again, so the
  engine keeps, while a position is open, what it was
  worth on the ticks (`held`), and when it closes, the
  candles it was on (`paths`) — what the journal draws.
==================================================
*/

import { MULT, nameGoesUp, type Bracket, type OrderKind, type Side } from '../review/engine';
import type { DayNote, JournalEntry } from '../review/journal';
import { MAX_STOPS, MAX_TARGETS, giveUp, ladderShapeRefusal, nextRung, rungsOf } from '../review/ladder';
import { contractKey, contractWords, dteAt, legsOf, type ContractId, type Quote } from '../review/quotes';
import type { Candle } from '../../types/market';
import { bellOf, dayEndsAt, flatByOf, nyAt, tradingDayOf } from './clock';

/* ================================================================== */
/*  TYPES                                                              */
/* ================================================================== */

/** An instant, and the trading day it belongs to (clock.ts: the 16:00 bell to the next, New York) */
export interface PaperMoment {
  at: number;
  day: string;
}

/** THE MARKET AS IT STANDS — all the engine knows of it (feed.ts builds the live one) */
export interface PaperMarket {
  now: number;
  /** This page load's name (feed.ts LIFE) — written on every fill */
  life: string;
  optQuote: (c: ContractId) => Quote;
  /** The same contract with the name at `spot`, now */
  optQuoteAt: (c: ContractId, spot: number) => Quote;
  /** The chart's moment (seconds) for what a chart of this name draws */
  bar: (ticker: string) => number;
  /** The candles a closed trade's chart is written down from — its name's */
  candles: (ticker: string) => Candle[];
  /** Does the market take an order now (the simulated feed always does; the real one, 09:30 to 16:00) */
  open: () => boolean;
  /** The name's levels as the book reads them now — what a way in is stamped with (WHERE THE TRADE STOOD); none: no stamp */
  levels?: (ticker: string) => FillLevels | null;
}
/** WHERE A WAY IN STOOD (the ideas' "where the trade stood", 2026-10-09): the flip and the nearest walls of the name's book at
    the moment of the fill — the journal cuts the reader's own trades by it ("entries above the flip against below") */
export interface FillLevels {
  flip: number;
  callWall: number;
  putWall: number;
}

/* ---- options ---- */
export interface OptOrder {
  id: string;
  placed: PaperMoment;
  contract: ContractId;
  side: Side;
  qty: number;
  kind: OrderKind;
  price?: number;
  on?: 'name';
  tif: 'day' | 'gtc';
  status: 'working' | 'filled' | 'cancelled' | 'refused';
  why?: string;
  done?: PaperMoment;
  fillPrice?: number;
  oco?: string;
  bracket?: Bracket;
  tag?: string;
  breakeven?: boolean;
  trail?: number;
  peak?: number;
  moved?: PaperMoment;
  /** The page load it was placed in — a later one cancels what an earlier one left working (the simulated feed) */
  life: string;
}
/** How a fill came: an order's kind — or the market's (the bell), the rules' (an evaluation), the page's (it closed) */
export type OptFillHow = OrderKind | 'expired' | 'rule' | 'page';
export interface OptFill {
  id: string;
  orderId: string | null;
  at: PaperMoment;
  contract: ContractId;
  side: Side;
  qty: number;
  price: number;
  fee: number;
  how: OptFillHow;
  spot: number;
  delta: number;
  iv: number;
  theta: number;
  tag?: string;
  plannedStop?: number;
  /** The chart's moment it happened at (feed.ts barNowOf) — where its arrow is drawn */
  bar: number;
  /** The page load it happened in */
  life: string;
  /** Why, where it was not the reader's doing ("the floor", "15:59", "the page closed") */
  note?: string;
  /** A way in: where the name stood against its book at the fill */
  lv?: FillLevels;
}

/* ---- the account ---- */
export type AccountKind = 'practice' | 'evaluation';
export type EvalTrailing = 'eod' | 'intraday';
export interface EvalPlan {
  label: string;
  size: number;
  target: number;
  /** The most it may lose, measured from the high mark (the floor trails it) */
  maxLoss: number;
  /** The most a day may lose, from the day's start */
  dayLoss: number;
  /** Option contracts open at once — a spread counts once a spread, as it is bought */
  contracts: number;
  trailing: EvalTrailing;
  /** Trading days with a closed trade before the target counts */
  minDays: number;
  /** The best day's profit at most this share of the whole — null: the rule is off */
  bestDayShare: number | null;
}
/** The rules page's table */
export const EVAL_PLANS: EvalPlan[] = [
  { label: '50K', size: 50_000, target: 3_000, maxLoss: 2_000, dayLoss: 1_000, contracts: 5, trailing: 'eod', minDays: 2, bestDayShare: 0.5 },
  { label: '100K', size: 100_000, target: 6_000, maxLoss: 3_000, dayLoss: 2_000, contracts: 10, trailing: 'eod', minDays: 2, bestDayShare: 0.5 },
  { label: '150K', size: 150_000, target: 9_000, maxLoss: 4_500, dayLoss: 3_000, contracts: 15, trailing: 'eod', minDays: 2, bestDayShare: 0.5 },
];
export const PRACTICE_SIZES = [10_000, 25_000, 50_000, 100_000];

/** One trading day of the account: what it was worth when the day began, when it ended, and its high and low */
export interface PaperDay {
  open: number;
  close?: number;
  hi: number;
  lo: number;
}
/** While a trade was held: what it was worth on the ticks (at most HELD_POINTS points, thinned evenly), its best and worst */
export interface HeldRecord {
  /** [instant ms, what it was up or down (fees in), the contract's bid, the name's price] */
  pts: [number, number, number, number][];
  best: number;
  bestAt: number;
  worst: number;
  worstAt: number;
}
/** The candles a closed trade was on, written down at its close — cents over a base, to keep them small */
export interface TradePath {
  /** The first candle's time (the chart's clock, seconds), and the seconds a candle */
  t0: number;
  step: number;
  base: number;
  /** A unit is this much of the price */
  unit: number;
  o: number[];
  h: number[];
  l: number[];
  c: number[];
}
export interface PaperLogLine {
  at: number;
  words: string;
  kind: 'rule' | 'pass' | 'fail' | 'day' | 'page' | 'info';
}
export interface PaperAccount {
  id: string;
  kind: AccountKind;
  name: string;
  startCash: number;
  createdAt: number;
  touchedAt: number;
  seq: number;
  plan?: EvalPlan;
  status: 'open' | 'passed' | 'failed' | 'ended';
  statusAt?: number;
  statusWhy?: string;
  /** The trading day the account last rolled into, and every day it has been on */
  day: string;
  ledger: Record<string, PaperDay>;
  /** The high mark an evaluation's floor trails */
  peak: number;
  /** The day's limit was reached: no way in until the day rolls */
  dayOver?: { day: string; why: string };
  /** Options' fee, a contract each way */
  fee: number;
  /** Practice only: fees off (the rules page, "The sandbox") */
  sandbox?: boolean;
  opt: { orders: OptOrder[]; fills: OptFill[] };
  /** The last price seen for each thing held — what a position left open by a page that could not close it is closed at */
  marks: Record<string, number>;
  /** By trade id: while it was held (open trades are kept up on every tick; closed ones stay) */
  held: Record<string, HeldRecord>;
  /** By trade id: the candles it was on */
  paths: Record<string, TradePath>;
  /** What the account did by itself, newest first */
  log: PaperLogLine[];
  /** The journal's (data/review/journal.ts): the reader's words and tags on a closed trade, and a note on a day */
  notes: Record<string, string>;
  journal?: Record<string, JournalEntry>;
  days?: Record<string, DayNote>;
}

/* ================================================================== */
/*  SMALL THINGS                                                       */
/* ================================================================== */

const cents = (v: number) => Math.round(v * 100) / 100;
export const money = (v: number, dp = 2) => `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const momentAt = (ms: number): PaperMoment => ({ at: ms, day: tradingDayOf(ms) });
/** Ours, not the reader's: past this many positions a desk cannot be read */
export const OPEN_CEILING = 10;
/** At most this many points of a held trade are kept */
export const HELD_POINTS = 240;
/** A point is written at most this often */
const HELD_EVERY_MS = 5_000;
/** At most this many candles of a closed trade are kept, and at most this many trades' candles */
export const PATH_BARS = 150;
export const PATHS_KEPT = 200;
/** A closed trade keeps at most this many of its held points — enough to draw it, small enough to keep hundreds */
export const HELD_KEPT = 80;
/** What the account's own log keeps */
const LOG_KEPT = 60;

const nextId = (a: PaperAccount, p: string): [string, PaperAccount] => [`${p}${a.seq + 1}`, { ...a, seq: a.seq + 1 }];
const logged = (a: PaperAccount, at: number, words: string, kind: PaperLogLine['kind']): PaperAccount => ({ ...a, log: [{ at, words, kind }, ...a.log].slice(0, LOG_KEPT) });
const optFee = (a: PaperAccount, c: ContractId, qty: number) => (a.sandbox ? 0 : cents(a.fee * qty * legsOf(c)));

export function newAccount(o: { id: string; kind: AccountKind; name: string; startCash: number; plan?: EvalPlan; now: number; fee?: number; sandbox?: boolean }): PaperAccount {
  const day = tradingDayOf(o.now);
  const start = o.plan ? o.plan.size : o.startCash;
  return {
    id: o.id,
    kind: o.kind,
    name: o.name,
    startCash: start,
    createdAt: o.now,
    touchedAt: o.now,
    seq: 0,
    plan: o.plan,
    status: 'open',
    day,
    ledger: { [day]: { open: start, hi: start, lo: start } },
    peak: start,
    fee: o.fee ?? 0.65,
    sandbox: o.kind === 'practice' ? o.sandbox || undefined : undefined,
    opt: { orders: [], fills: [] },
    marks: {},
    held: {},
    paths: {},
    log: [{ at: o.now, words: o.plan ? `The ${o.plan.label} evaluation began at ${money(start, 0)}` : `The account began at ${money(start, 0)}`, kind: 'info' }],
    notes: {},
  };
}

/* ================================================================== */
/*  THE OPTIONS BOOK                                                   */
/* ================================================================== */

export interface OptLeg {
  /** The fill it was */
  id: string;
  at: PaperMoment;
  side: Side;
  qty: number;
  price: number;
  fee: number;
  /** A piece going out: a target, a stop, the reader's hand, the bell, the rules, the page closing */
  out?: 'target' | 'stop' | 'hand' | 'bell' | 'rule' | 'page';
  bar: number;
}
export interface OptPosition {
  key: string;
  contract: ContractId;
  qty: number;
  avg: number;
  fees: number;
  opened: PaperMoment;
  spotIn: number;
  tradeId: string;
  tag?: string;
  /** The page load it was opened in */
  life: string;
  /** What has come in and gone out on it so far, fees in — with `qty` at the bid, what the trade is up or down */
  flow: number;
  /** What the pieces already sold have banked: their proceeds less their share of the cost, fees in (the chart's RP&L) */
  banked: number;
}
export type OptTradeHow = 'sold' | 'target' | 'stopped' | 'expired' | 'scaled' | 'rule' | 'page';
export interface OptTrade {
  id: string;
  contract: ContractId;
  qty: number;
  avgIn: number;
  avgOut: number;
  cost: number;
  pnl: number;
  r: number;
  opened: PaperMoment;
  closed: PaperMoment;
  how: OptTradeHow;
  legs: OptLeg[];
  dteIn: number;
  deltaIn: number;
  ivIn: number;
  thetaIn: number;
  spotIn: number;
  spotOut: number;
  /** Real minutes it was on */
  heldMin: number;
  plannedStop?: number;
  tag?: string;
  /** Why the rules or the page closed it */
  note?: string;
  /** Where the name stood against its book when it was opened (a fill from before the stamp: none) */
  lvIn?: FillLevels;
}
const outOf = (how: OptFillHow, target: boolean): OptLeg['out'] => (how === 'expired' ? 'bell' : how === 'rule' ? 'rule' : how === 'page' ? 'page' : how === 'stop' ? 'stop' : target ? 'target' : 'hand');

type OptBook = { positions: OptPosition[]; trades: OptTrade[] };
/* THE BOOK, ONCE PER CHANGE (2026-09-30, the perf pass). The book is a pure read of the account's fills and orders, and a
   tick asks for it five or six times (the view, the held and closed trades' drawings, the events, the bell) — every time
   walking every fill again. An account is never changed in place (a change is a new fills or orders array), so the book
   is kept against the arrays it was read from and handed back until one of them changes. What it hands back is shared:
   a reader that wants it in another order copies it first. */
const books = new WeakMap<OptFill[], { orders: OptOrder[]; book: OptBook }>();
export function optBookOf(a: PaperAccount): OptBook {
  const kept = books.get(a.opt.fills);
  if (kept && kept.orders === a.opt.orders) return kept.book;
  const book = readOptBook(a);
  books.set(a.opt.fills, { orders: a.opt.orders, book });
  return book;
}
function readOptBook(a: PaperAccount): OptBook {
  interface Open {
    first: OptFill;
    qty: number;
    bought: number;
    paid: number;
    feesIn: number;
    got: number;
    feesOut: number;
    sold: number;
    flow: number;
    legs: OptLeg[];
  }
  const open = new Map<string, Open>();
  const trades: OptTrade[] = [];
  const targets = new Set(a.opt.orders.filter(o => o.oco && o.kind === 'limit' && o.side === 'sell').map(o => o.id));
  for (const f of a.opt.fills) {
    const key = contractKey(f.contract);
    let o = open.get(key);
    if (f.side === 'buy') {
      if (!o) open.set(key, (o = { first: f, qty: 0, bought: 0, paid: 0, feesIn: 0, got: 0, feesOut: 0, sold: 0, flow: 0, legs: [] }));
      o.legs.push({ id: f.id, at: f.at, side: 'buy', qty: f.qty, price: f.price, fee: f.fee, bar: f.bar });
      o.qty += f.qty;
      o.bought += f.qty;
      o.paid += f.price * f.qty;
      o.feesIn += f.fee;
      o.flow -= f.price * MULT * f.qty + f.fee;
      continue;
    }
    if (!o) continue;
    const q = Math.min(f.qty, o.qty);
    o.qty -= q;
    o.sold += q;
    o.got += f.price * q;
    o.feesOut += f.fee;
    o.flow += f.price * MULT * q - f.fee;
    o.legs.push({ id: f.id, at: f.at, side: 'sell', qty: q, price: f.price, fee: f.fee, out: outOf(f.how, !!f.orderId && targets.has(f.orderId)), bar: f.bar });
    if (o.qty > 0) continue;
    const cost = o.paid * MULT + o.feesIn;
    const pnl = o.got * MULT - o.feesOut - cost;
    const outs = o.legs.filter(l => l.side === 'sell');
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
      how: outs.length > 1 ? 'scaled' : f.how === 'expired' ? 'expired' : f.how === 'rule' ? 'rule' : f.how === 'page' ? 'page' : f.how === 'stop' ? 'stopped' : f.orderId && targets.has(f.orderId) ? 'target' : 'sold',
      legs: o.legs,
      dteIn: dteAt(nyAt(o.first.at.at).date, f.contract.expiry),
      deltaIn: o.first.delta,
      ivIn: o.first.iv,
      thetaIn: o.first.theta,
      spotIn: o.first.spot,
      spotOut: f.spot,
      heldMin: Math.max(0, Math.round((f.at.at - o.first.at.at) / 60_000)),
      plannedStop: o.first.plannedStop,
      tag: o.first.tag,
      note: f.note,
      lvIn: o.first.lv,
    });
    open.delete(key);
  }
  const positions: OptPosition[] = [...open.entries()].map(([key, o]) => ({
    key,
    contract: o.first.contract,
    qty: o.qty,
    avg: cents(o.paid / o.bought),
    fees: cents((o.feesIn * o.qty) / o.bought),
    opened: o.first.at,
    spotIn: o.first.spot,
    tradeId: o.first.id,
    tag: o.first.tag,
    life: o.first.life,
    flow: o.flow,
    banked: cents(o.got * MULT - o.feesOut - (o.paid * MULT + o.feesIn) * (o.sold / o.bought)),
  }));
  return { positions, trades };
}

/** WHAT A NAME HAS BANKED (the chart's RP&L, 2026-09-22): its closed trades, and what its open ones have taken off in
    pieces, fees in — from the fills before `before` (an instant; none: all of them). The day's share is now's, less the
    day's start's: a trade held over the roll counts its pieces on the day each was sold. */
export function bankedOf(a: PaperAccount, name: string, before = Infinity): number {
  const ob = optBookOf({ ...a, opt: { ...a.opt, fills: a.opt.fills.filter(f => f.contract.ticker === name && f.at.at < before) } });
  let x = 0;
  for (const t of ob.trades) x += t.pnl;
  for (const p of ob.positions) x += p.banked;
  return cents(x);
}

/* ================================================================== */
/*  WHAT THE ACCOUNT IS WORTH                                          */
/* ================================================================== */

export type MarkedOpt = OptPosition & { quote: Quote; value: number; pnl: number; r: number };
export interface PaperView {
  /** The start, plus everything closed, less every fee — with an option's price paid out of it */
  cash: number;
  /** Cash + the options at the mark */
  equity: number;
  /** What is open, up or down */
  openPnl: number;
  optValue: number;
  /** What can pay for an option: the cash — an option is paid for, never margined, so nothing is held back from it */
  free: number;
  /** What the trading day began at, and the account against it */
  dayOpen: number;
  today: number;
  allTime: number;
  opt: MarkedOpt[];
  optTrades: OptTrade[];
  /** Every closed trade's result, added up */
  closed: number;
}
export function viewOf(a: PaperAccount, m: PaperMarket): PaperView {
  const ob = optBookOf(a);
  let cash = a.startCash;
  for (const f of a.opt.fills) cash += (f.side === 'buy' ? -1 : 1) * f.price * MULT * f.qty - f.fee;
  cash = cents(cash);
  const opt = ob.positions.map(p => {
    const quote = m.optQuote(p.contract);
    const value = cents(quote.mark * MULT * p.qty);
    const cost = p.avg * MULT * p.qty + p.fees;
    return { ...p, quote, value, pnl: cents(value - cost), r: cost > 0 ? (value - cost) / cost : 0 };
  });
  const optValue = cents(opt.reduce((x, p) => x + p.value, 0));
  const equity = cents(cash + optValue);
  const dayOpen = a.ledger[a.day]?.open ?? a.startCash;
  const closed = cents(ob.trades.reduce((x, t) => x + t.pnl, 0));
  return {
    cash,
    equity,
    openPnl: cents(opt.reduce((x, p) => x + p.pnl, 0)),
    optValue,
    free: cash,
    dayOpen,
    today: cents(equity - dayOpen),
    allTime: cents(equity - a.startCash),
    opt,
    optTrades: ob.trades,
    closed,
  };
}

/* ================================================================== */
/*  AN EVALUATION                                                      */
/* ================================================================== */

export interface EvalRead {
  plan: EvalPlan;
  /** The floor, and what is between the account and it */
  floor: number;
  room: number;
  /** The high mark the floor trails — and whether the floor has reached the start and stopped */
  high: number;
  floorStopped: boolean;
  /** The day's own floor, and the room to it */
  dayFloor: number;
  dayRoom: number;
  /** The level the target is, and how far off it stands */
  targetAt: number;
  toTarget: number;
  /** Option contracts open, of the plan's */
  contractsOpen: number;
  /** Trading days with a closed trade, the best of them, and the whole profit so far (closed days) */
  daysTraded: number;
  bestDay: number;
  profit: number;
  /** The best-day rule holds (or is off) */
  bestDayOk: boolean;
  /** Where the best-day rule would put the target in effect: the whole profit it needs for the best day to be the share */
  targetNeeded: number;
  dayOver: string | null;
  flatBy: number;
  inFlatWindow: boolean;
}
/** The floor: the high mark less the allowance — never above the starting balance, where it stops */
export const floorOf = (a: PaperAccount): number => (a.plan ? Math.min(a.peak - a.plan.maxLoss, a.plan.size) : -Infinity);
/** Trading days with a closed trade on them — what "days traded" counts */
export function daysTradedOf(a: PaperAccount): string[] {
  const days = new Set<string>();
  /* a close the page made as it shut (before 2026-10-09 a reload closed what was open) is not the reader's trading day */
  for (const f of a.opt.fills) if (f.side === 'sell' && f.how !== 'page') days.add(f.at.day);
  return [...days].sort();
}
/** A closed day's result: its close less its open */
const dayResult = (d: PaperDay | undefined): number | null => (d && d.close != null ? d.close - d.open : null);
export function evalRead(a: PaperAccount, v: PaperView, now: number): EvalRead | null {
  const plan = a.plan;
  if (a.kind !== 'evaluation' || !plan) return null;
  const floor = floorOf(a);
  const dayFloor = (a.ledger[a.day]?.open ?? plan.size) - plan.dayLoss;
  const days = daysTradedOf(a);
  const results = Object.values(a.ledger).map(dayResult).filter((x): x is number => x != null);
  /* today counts too, as it stands — the rule is judged at the day's close, but the page says where it is heading */
  const today = v.equity - (a.ledger[a.day]?.open ?? plan.size);
  const bestDay = Math.max(0, today, ...results);
  const profit = v.equity - plan.size;
  const share = plan.bestDayShare;
  const bestDayOk = share == null || profit <= 0 || bestDay <= share * profit + 1e-9;
  const flatBy = flatByOf(a.day);
  return {
    plan,
    floor,
    room: cents(v.equity - floor),
    high: a.peak,
    floorStopped: a.peak - plan.maxLoss >= plan.size,
    dayFloor,
    dayRoom: cents(v.equity - dayFloor),
    targetAt: plan.size + plan.target,
    toTarget: cents(plan.size + plan.target - v.equity),
    contractsOpen: v.opt.reduce((x, p) => x + p.qty, 0),
    daysTraded: days.length,
    bestDay: cents(bestDay),
    profit: cents(profit),
    bestDayOk,
    targetNeeded: share == null ? plan.target : Math.max(plan.target, cents(bestDay / share)),
    dayOver: a.dayOver && a.dayOver.day === a.day ? a.dayOver.why : null,
    flatBy,
    inFlatWindow: now >= flatBy && now < dayEndsAt(a.day),
  };
}

/** Why an evaluation (or an account that is over) refuses a WAY IN — `adding` more contracts — before the option's own
    rules, or null. None of it ever refuses a way out. */
function accountRefusal(a: PaperAccount, now: number, adding: number, v: () => PaperView): string | null {
  if (a.status !== 'open') return a.kind === 'evaluation' ? `This evaluation is over — it ${a.status === 'passed' ? 'passed' : a.status === 'failed' ? 'failed' : 'was ended'}` : 'This account is closed';
  if (a.kind !== 'evaluation' || !a.plan) return null;
  if (a.dayOver && a.dayOver.day === a.day) return `The day’s limit was reached (${a.dayOver.why}) — no new positions until the day rolls at the 16:00 bell, New York`;
  if (now >= flatByOf(a.day) && now < dayEndsAt(a.day)) return 'It is past 15:59 New York — an evaluation is flat into the bell; the next trading day begins at 16:00';
  /* THE CAP COUNTS CONTRACTS AS THEY ARE BOUGHT: a call is one, and a spread is one — its sold leg is the bought leg's
     cover, not a second position */
  const open = v().opt.reduce((x, p) => x + p.qty, 0);
  if (open + adding > a.plan.contracts) return `No more than ${a.plan.contracts} contracts open at once in this evaluation — this would be ${open + adding}`;
  return null;
}

/* ================================================================== */
/*  OPTIONS: ORDERS                                                    */
/* ================================================================== */

export interface OptDraft {
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
const nameHit = (o: { kind: OrderKind; contract: ContractId; price?: number }, spot: number): boolean => (nameGoesUp(o.kind, o.contract.right) ? spot >= o.price! : spot <= o.price!);
const workingSells = (a: PaperAccount, key: string) => a.opt.orders.filter(o => o.status === 'working' && o.side === 'sell' && contractKey(o.contract) === key);
const optReserved = (a: PaperAccount, key: string) => {
  const byGroup = new Map<string, { limit: number; stop: number }>();
  let loose = 0;
  for (const o of workingSells(a, key)) {
    if (!o.oco || o.kind === 'market') loose += o.qty;
    else {
      const g = byGroup.get(o.oco) ?? { limit: 0, stop: 0 };
      g[o.kind] += o.qty;
      byGroup.set(o.oco, g);
    }
  }
  return loose + [...byGroup.values()].reduce((x, g) => x + Math.max(g.limit, g.stop), 0);
};
const optFarness = (o: OptOrder, q: Quote): number => (o.on === 'name' ? Math.abs((o.price ?? 0) - q.spot) / Math.max(0.01, q.spot) : Math.abs((o.price ?? 0) - q.bid) / Math.max(0.01, q.bid));
const setOpt = (a: PaperAccount, orders: OptOrder[], fills = a.opt.fills): PaperAccount => ({ ...a, opt: { orders, fills } });
const optResize = (a: PaperAccount, left: Map<string, number>, at: PaperMoment, why: string): PaperAccount =>
  setOpt(
    a,
    a.opt.orders.map(x => {
      const q = left.get(x.id);
      if (q == null || x.status !== 'working' || q === x.qty) return x;
      return q <= 0 ? { ...x, status: 'cancelled' as const, done: at, why } : { ...x, qty: q };
    })
  );

/** Why an option draft cannot be taken, or null — the words the ticket shows before the press */
export function optRefusal(a: PaperAccount, m: PaperMarket, d: OptDraft): string | null {
  if (!Number.isInteger(d.qty) || d.qty < 1) return 'Enter a whole number of contracts';
  const bell = bellOf(d.contract.expiry);
  if (bell <= m.now) return 'That contract has expired';
  if (d.contract.short != null) {
    const { strike, short, right } = d.contract;
    if (short === strike) return 'A spread needs two different strikes';
    if (right === 'C' ? short < strike : short > strike) return 'A spread here is bought for a debit — the strike you sell has to be further out than the one you buy';
  }
  if (d.kind !== 'market' && !(d.price && d.price > 0)) return 'Enter a price';
  if (d.kind === 'stop' && d.side === 'buy') return 'A stop is a way out — it sells';
  if (d.on === 'name' && (d.side === 'buy' || d.kind === 'market')) return 'Only a sell that waits can be set on the name’s price';
  if (d.kind === 'market' && !m.open()) return 'The market is shut — options trade 09:30 to 16:00 New York. Leave a limit that waits for the open';
  const q = m.optQuote(d.contract);
  const name = d.contract.ticker;
  if (d.side === 'buy') {
    const ruled = accountRefusal(a, m.now, d.qty, () => viewOf(a, m));
    if (ruled) return ruled;
    /* A BUY LIMIT IS PAID FOR AT ITS LIMIT (the audit's PR-3: a limit at 99999 was taken, then cancelled "the free money was
       gone by then"): it may fill at any price up to its own, so the money it needs is the limit's, said up front */
    const px = d.kind === 'limit' ? d.price! : q.ask;
    const need = px * MULT * d.qty + optFee(a, d.contract, d.qty);
    const v = viewOf(a, m);
    if (need > v.free + 1e-9) return d.kind === 'limit' && d.price! > q.ask ? `Not enough free money at that limit — ${d.price!.toFixed(2)} needs ${money(need)}, and ${money(Math.max(0, v.free))} is free (the ask is ${q.ask.toFixed(2)})` : `Not enough free money — this needs ${money(need)}, and ${money(Math.max(0, v.free))} is free`;
    if (d.kind === 'market' && q.dead) return 'No market in that contract right now';
    /* our ceiling (a buy of a contract already held adds to it) */
    const held = new Set(v.opt.map(p => p.key));
    if (!held.has(contractKey(d.contract))) {
      const pending = new Set(a.opt.orders.filter(o => o.status === 'working' && o.side === 'buy' && !held.has(contractKey(o.contract))).map(o => contractKey(o.contract)));
      const open = held.size + pending.size - (pending.has(contractKey(d.contract)) ? 1 : 0);
      if (open >= OPEN_CEILING) return `No more than ${OPEN_CEILING} positions open at once — close one first`;
    }
    const shape = ladderShapeRefusal(d.bracket, d.qty);
    if (shape) return shape;
    const { targets, stops } = rungsOf(d.bracket, d.qty);
    const many = (n: number, word: string) => (n > 1 ? `Every ${word}` : `The ${word}`);
    if (d.bracket?.on === 'name') {
      const up = d.contract.right === 'C';
      if (targets.some(r => (up ? r.price <= q.spot : r.price >= q.spot))) return `${many(targets.length, 'target')} has to be ${up ? 'above' : 'below'} where ${name} stands`;
      if (stops.some(r => (up ? r.price >= q.spot : r.price <= q.spot))) return `${many(stops.length, 'stop')} has to be ${up ? 'below' : 'above'} where ${name} stands`;
      return null;
    }
    if (targets.some(r => r.price <= px)) return `${many(targets.length, 'target')} has to be above what you pay`;
    if (stops.some(r => r.price >= px)) return `${many(stops.length, 'stop')} has to be under what you pay`;
    return null;
  }
  const held = optBookOf(a).positions.find(p => p.key === contractKey(d.contract))?.qty ?? 0;
  if (d.kind === 'market' ? held < d.qty : held - optReserved(a, contractKey(d.contract)) < d.qty) return held ? (d.kind === 'market' ? `You hold ${held}` : 'Those contracts are already spoken for by a working order') : 'You do not hold that contract';
  if (d.kind === 'market' && q.dead) return 'No bid to sell into right now';
  if (d.on === 'name' && nameHit(d, q.spot)) return `${name} is already past that — it would sell on the next tick`;
  return null;
}

/** The planned risk a buy carried: its stops as a price of the contract, on average by their contracts */
function plannedStopOf(o: OptOrder, m: PaperMarket): number | undefined {
  const { stops } = rungsOf(o.bracket, o.qty);
  if (!stops.length) return undefined;
  const asContract = (level: number) => (o.bracket?.on === 'name' ? m.optQuoteAt(o.contract, level).bid : level);
  const n = stops.reduce((x, r) => x + r.qty, 0);
  return cents(stops.reduce((x, r) => x + asContract(r.price) * r.qty, 0) / Math.max(1, n));
}
const trailFrom = (price: number, on: 'name' | undefined, q: Quote): { trail: number; peak: number } => (on === 'name' ? { trail: cents(Math.max(0.01, Math.abs(q.spot - price))), peak: q.spot } : { trail: cents(Math.max(0.01, q.bid - price)), peak: q.bid });
const trailAt = (by: number, on: 'name' | undefined, q: Quote): { trail: number; peak: number } => ({ trail: cents(Math.max(0.01, by)), peak: on === 'name' ? q.spot : q.bid });

/** AFTER A SELL: the ladder is made to fit what is still held (the backtest's rule, engine.ts afterSell) */
function afterSell(a: PaperAccount, sold: OptOrder, q: Quote, at: PaperMoment, m: PaperMarket): PaperAccount {
  const key = contractKey(sold.contract);
  let next = a;
  if (sold.oco) {
    const other = workingSells(next, key).filter(o => o.oco === sold.oco && o.kind !== sold.kind);
    next = optResize(next, giveUp(other, sold.qty, o => optFarness(o, q)), at, 'its pair filled');
    const firstTarget = sold.kind === 'limit' && !a.opt.orders.some(o => o.oco === sold.oco && o.kind === 'limit' && o.status === 'filled' && o.id !== sold.id);
    const pos = optBookOf(next).positions.find(p => p.key === key);
    if (firstTarget && pos) {
      next = setOpt(
        next,
        next.opt.orders.map(o => {
          if (o.status !== 'working' || o.oco !== sold.oco || o.kind !== 'stop' || !o.breakeven) return o;
          const now = o.on === 'name' ? m.optQuoteAt(o.contract, o.price ?? 0).bid : (o.price ?? 0);
          if (!(q.bid > pos.avg) || pos.avg <= now) return { ...o, breakeven: false };
          return { ...o, on: undefined, price: pos.avg, breakeven: false, moved: at, ...(o.trail != null ? { trail: cents(Math.max(0.01, q.bid - pos.avg)), peak: q.bid } : {}) };
        })
      );
    }
  }
  const held = optBookOf(next).positions.find(p => p.key === key)?.qty ?? 0;
  const mine = workingSells(next, key);
  if (held === 0) return optResize(next, new Map(mine.map(o => [o.id, 0])), at, 'the position was closed');
  const loose = mine.filter(o => !o.oco).reduce((x, o) => x + o.qty, 0);
  const cover = Math.max(0, held - loose);
  for (const kind of ['limit', 'stop'] as const) {
    const side = workingSells(next, key).filter(o => o.oco && o.kind === kind);
    const over = side.reduce((x, o) => x + o.qty, 0) - cover;
    if (over > 0) next = optResize(next, giveUp(side, over, o => optFarness(o, q)), at, 'its contracts were sold');
  }
  return next;
}

/** The way in's stamp: the name's flip and walls as the book reads them now — only real numbers are kept */
function stampOf(m: PaperMarket, ticker: string): { lv?: FillLevels } {
  const l = m.levels?.(ticker);
  if (!l || ![l.flip, l.callWall, l.putWall].every(Number.isFinite)) return {};
  return { lv: { flip: cents(l.flip), callWall: cents(l.callWall), putWall: cents(l.putWall) } };
}
function optFillNow(a: PaperAccount, o: OptOrder, price: number, how: OptFillHow, q: Quote, m: PaperMarket, note?: string): PaperAccount {
  const at = momentAt(m.now);
  let [id, next] = nextId(a, 'f');
  const fill: OptFill = { id, orderId: o.id || null, at, contract: o.contract, side: o.side, qty: o.qty, price: cents(price), fee: how === 'expired' ? 0 : optFee(a, o.contract, o.qty), how, spot: q.spot, delta: q.delta, iv: q.iv, theta: q.theta, tag: o.tag, plannedStop: o.side === 'buy' ? plannedStopOf(o, m) : undefined, bar: m.bar(o.contract.ticker), life: m.life, note, ...(o.side === 'buy' ? stampOf(m, o.contract.ticker) : {}) };
  next = setOpt(next, next.opt.orders.map(x => (x.id === o.id ? { ...x, status: 'filled' as const, done: at, fillPrice: fill.price } : x)), [...next.opt.fills, fill]);
  if (o.side === 'sell') next = afterSell(next, o, q, at, m);
  const { targets, stops } = rungsOf(o.side === 'buy' ? o.bracket : undefined, o.qty);
  if (targets.length || stops.length) {
    const [oco, n2] = nextId(next, 'g');
    next = n2;
    const on = o.bracket?.on;
    for (const [kind, rungs] of [['limit', targets], ['stop', stops]] as const) {
      for (const r of rungs) {
        const [oid, n3] = nextId(next, 'o');
        const switches = kind === 'stop' ? { breakeven: o.bracket?.breakeven || undefined, ...(o.bracket?.trail ? (o.bracket.trailBy ? trailAt(o.bracket.trailBy, on, q) : trailFrom(r.price, on, q)) : {}) } : {};
        next = setOpt(n3, [...n3.opt.orders, { id: oid, placed: at, contract: o.contract, side: 'sell', qty: r.qty, kind, price: r.price, on, tif: 'gtc', status: 'working', oco, tag: o.tag, life: m.life, ...switches }]);
      }
    }
  }
  return next;
}

/** Take an option order. A market order fills now; the rest wait for a later tick. */
export function optPlace(a: PaperAccount, m: PaperMarket, d: OptDraft): PaperAccount {
  const at = momentAt(m.now);
  let [id, next] = nextId(a, 'o');
  const base: OptOrder = { id, placed: at, contract: d.contract, side: d.side, qty: d.qty, kind: d.kind, price: d.kind === 'market' ? undefined : d.price, on: d.kind === 'market' ? undefined : d.on, tif: d.tif ?? (d.kind === 'market' ? 'day' : 'gtc'), status: 'working', bracket: d.side === 'buy' ? d.bracket : undefined, tag: d.tag, life: m.life };
  const why = optRefusal(a, m, d);
  next = { ...setOpt(next, [...next.opt.orders, why ? { ...base, status: 'refused', why, done: at } : base]), touchedAt: m.now };
  if (why || d.kind !== 'market') return next;
  const q = m.optQuote(d.contract);
  return optFillNow(next, base, d.side === 'buy' ? q.ask : q.bid, 'market', q, m);
}

export function optCancel(a: PaperAccount, m: PaperMarket, orderId: string, why = 'cancelled by you'): PaperAccount {
  const at = momentAt(m.now);
  return { ...setOpt(a, a.opt.orders.map(o => (o.id === orderId && o.status === 'working' ? { ...o, status: 'cancelled', done: at, why } : o))), touchedAt: m.now };
}
/** Move a working option order's price — not taken where it would not wait */
export function optAmend(a: PaperAccount, m: PaperMarket, orderId: string, price: number): PaperAccount {
  const o = a.opt.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || !(price > 0)) return a;
  const q = m.optQuote(o.contract);
  const trail = o.kind === 'stop' && o.trail != null ? trailFrom(cents(price), o.on, q) : {};
  if (o.on === 'name') {
    if (nameHit({ ...o, price }, q.spot)) return a;
  } else {
    if (o.side === 'sell' && o.kind === 'limit' && price <= q.bid) return a;
    if (o.side === 'sell' && o.kind === 'stop' && price >= q.bid) return a;
    if (o.side === 'buy' && o.kind === 'limit' && price * MULT * o.qty + optFee(a, o.contract, o.qty) > viewOf(a, m).free) return a;
  }
  return { ...setOpt(a, a.opt.orders.map(x => (x.id === orderId ? { ...x, price: cents(price), ...trail } : x))), touchedAt: m.now };
}
export function optLadderRoom(a: PaperAccount, m: PaperMarket, c: ContractId): Record<'target' | 'stop', 'first' | 'more' | null> {
  const key = contractKey(c);
  const pos = optBookOf(a).positions.find(p => p.key === key);
  const q = m.optQuote(c);
  const mine = workingSells(a, key);
  const cover = (pos?.qty ?? 0) - mine.filter(o => !o.oco).reduce((x, o) => x + o.qty, 0);
  const room = (kind: 'limit' | 'stop') => {
    const rungs = mine.filter(o => o.oco && o.kind === kind);
    if (!pos || cover < 1) return null;
    if (!rungs.length) return 'first' as const;
    return nextRung(rungs, cover, kind === 'limit' ? MAX_TARGETS : MAX_STOPS, o => optFarness(o, q)) ? ('more' as const) : null;
  };
  return { target: room('limit'), stop: room('stop') };
}
export function optLadderTake(a: PaperAccount, m: PaperMarket, c: ContractId): Record<'target' | 'stop', number> {
  const key = contractKey(c);
  const pos = optBookOf(a).positions.find(p => p.key === key);
  const q = m.optQuote(c);
  const mine = workingSells(a, key);
  const cover = (pos?.qty ?? 0) - mine.filter(o => !o.oco).reduce((x, o) => x + o.qty, 0);
  const take = (kind: 'limit' | 'stop') => {
    const rungs = mine.filter(o => o.oco && o.kind === kind);
    if (!pos || cover < 1) return 0;
    return rungs.length ? (nextRung(rungs, cover, kind === 'limit' ? MAX_TARGETS : MAX_STOPS, o => optFarness(o, q))?.qty ?? 0) : cover;
  };
  return { target: take('limit'), stop: take('stop') };
}
/** A target or a stop put on an open position (pulled off its chip) — the backtest's `attach` */
export function optAttach(a: PaperAccount, m: PaperMarket, c: ContractId, kind: 'target' | 'stop', price: number, on?: 'name'): PaperAccount {
  const key = contractKey(c);
  const pos = optBookOf(a).positions.find(p => p.key === key);
  if (!pos || !(price > 0)) return a;
  const q = m.optQuote(c);
  const orderKind: OrderKind = kind === 'target' ? 'limit' : 'stop';
  if (on === 'name' ? nameHit({ kind: orderKind, contract: c, price }, q.spot) : kind === 'target' ? price <= q.bid : price >= q.bid) return a;
  const mine = workingSells(a, key);
  const group = mine.find(o => o.oco)?.oco;
  const rungs = mine.filter(o => o.oco && o.kind === orderKind);
  const cover = pos.qty - mine.filter(o => !o.oco).reduce((x, o) => x + o.qty, 0);
  if (cover < 1) return a;
  const take = rungs.length ? nextRung(rungs, cover, kind === 'target' ? MAX_TARGETS : MAX_STOPS, o => optFarness(o, q)) : { qty: cover, from: null };
  if (!take || take.qty < 1) return a;
  let next = a;
  let oco = group;
  if (!oco) [oco, next] = nextId(next, 'g');
  const [oid, n2] = nextId(next, 'o');
  const sibling = mine.find(o => o.oco === oco && o.kind === 'stop');
  const switches = kind === 'stop' ? { breakeven: sibling?.breakeven || undefined, ...(sibling?.trail != null ? trailFrom(cents(price), on, q) : {}) } : {};
  const orders = n2.opt.orders.map(x => (take.from && x.id === take.from.id ? { ...x, qty: x.qty - take.qty } : x));
  return { ...setOpt(n2, [...orders, { id: oid, placed: momentAt(m.now), contract: c, side: 'sell', qty: take.qty, kind: orderKind, price: cents(price), on, tif: 'gtc', status: 'working', oco, tag: pos.tag, life: m.life, ...switches }]), touchedAt: m.now };
}
export function optSetTrail(a: PaperAccount, m: PaperMarket, orderId: string, on: boolean, by?: number): PaperAccount {
  const o = a.opt.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || o.side !== 'sell' || o.kind !== 'stop' || o.price == null) return a;
  if (on && by != null && !(by > 0)) return a;
  const q = m.optQuote(o.contract);
  return { ...setOpt(a, a.opt.orders.map(x => (x.id !== orderId ? x : on ? { ...x, ...(by != null ? trailAt(by, o.on, q) : trailFrom(o.price!, o.on, q)) } : { ...x, trail: undefined, peak: undefined }))), touchedAt: m.now };
}
export function optSetBreakeven(a: PaperAccount, m: PaperMarket, orderId: string, on: boolean): PaperAccount {
  const o = a.opt.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || o.kind !== 'stop') return a;
  return { ...setOpt(a, a.opt.orders.map(x => (x.status === 'working' && x.kind === 'stop' && (x.id === orderId || (o.oco && x.oco === o.oco)) ? { ...x, breakeven: on || undefined } : x))), touchedAt: m.now };
}
/** The same way out, waiting on the other thing — without moving its line (the backtest's `rebase`) */
export function optRebase(a: PaperAccount, m: PaperMarket, orderId: string, to: 'name' | 'contract', spotForBid: (c: ContractId, bid: number) => number | null): PaperAccount {
  const o = a.opt.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'working' || o.side !== 'sell' || o.kind === 'market' || o.price == null) return a;
  if ((o.on === 'name') === (to === 'name')) return a;
  const price = to === 'name' ? spotForBid(o.contract, o.price) : cents(m.optQuoteAt(o.contract, o.price).bid);
  if (price == null || !(price > 0)) return a;
  const basis = to === 'name' ? ('name' as const) : undefined;
  const trail = o.trail != null ? trailFrom(price, basis, m.optQuote(o.contract)) : {};
  return { ...setOpt(a, a.opt.orders.map(x => (x.id === orderId ? { ...x, on: basis, price, ...trail } : x))), touchedAt: m.now };
}
/** Out of a contract now: what is working on it goes first, then the lot is sold at the bid */
export function optClose(a: PaperAccount, m: PaperMarket, c: ContractId, qty: number): PaperAccount {
  const key = contractKey(c);
  let next = a;
  for (const o of a.opt.orders) if (o.status === 'working' && o.side === 'sell' && contractKey(o.contract) === key) next = optCancel(next, m, o.id);
  return optPlace(next, m, { contract: c, side: 'sell', qty, kind: 'market' });
}

/* ================================================================== */
/*  EVERYTHING AT ONCE: THE RULES' HAND AND THE PAGE'S                 */
/* ================================================================== */

/** Close everything open at the market and cancel everything working — the rules' hand (`rule`) or the page's (`page`).
    `at`: a price to close each at in place of the market's (a page that did not get to close its own: its last marks). */
export function flattenAll(a: PaperAccount, m: PaperMarket, how: 'rule' | 'page', note: string, at?: (key: string) => number | undefined): PaperAccount {
  let next = a;
  const when = momentAt(m.now);
  const cancelled = (why: string) => ({ status: 'cancelled' as const, done: when, why });
  next = setOpt(next, next.opt.orders.map(o => (o.status === 'working' ? { ...o, ...cancelled(note) } : o)));
  for (const p of optBookOf(next).positions) {
    const live = m.optQuote(p.contract);
    const px = at?.(p.key) ?? live.bid;
    next = optFillNow(next, { id: '', placed: when, contract: p.contract, side: 'sell', qty: p.qty, kind: 'market', tif: 'day', status: 'working', tag: p.tag, life: m.life }, px, how, at ? { ...live, bid: px, spot: p.spotIn } : live, m, note);
  }
  return { ...next, touchedAt: m.now };
}

/** FLAT BY THE READER'S HAND, at once: everything working cancelled, then every position out at the market — the reader's own
    closes (a trade ends "Sold by you" / "Closed by you"), never the rules' */
export function flattenByHand(a: PaperAccount, m: PaperMarket): PaperAccount {
  let next = a;
  for (const o of a.opt.orders) if (o.status === 'working') next = optCancel(next, m, o.id);
  for (const p of optBookOf(next).positions) next = optPlace(next, m, { contract: p.contract, side: 'sell', qty: p.qty, kind: 'market' });
  return next;
}

/** An evaluation the reader ends: everything closed, and it is written down as ended */
export function endEvaluation(a: PaperAccount, m: PaperMarket): PaperAccount {
  if (a.status !== 'open') return a;
  const next = flattenAll(a, m, 'rule', 'the evaluation was ended');
  return logged({ ...next, status: 'ended', statusAt: m.now, statusWhy: 'Ended by you' }, m.now, 'The evaluation was ended by you', 'info');
}

/** What was left open by a page that did not get to close it (the simulated feed: a new market every load) — closed at the
    last price THAT page saw, in its words */
export function closeStale(a: PaperAccount, m: PaperMarket): PaperAccount {
  const stale = optBookOf(a).positions.filter(p => p.life !== m.life);
  const staleOrders = a.opt.orders.some(o => o.status === 'working' && o.life !== m.life);
  if (!stale.length && !staleOrders) return a;
  const keys = new Set(stale.map(p => p.key));
  const avgOf = (key: string) => optBookOf(a).positions.find(p => p.key === key)?.avg;
  let next = flattenAll(a, m, 'page', 'the page closed before it could close this — at the last price it saw', key => (keys.has(key) ? (a.marks[key] ?? avgOf(key)) : undefined));
  next = logged(next, m.now, `${stale.length} ${stale.length === 1 ? 'position' : 'positions'} left open by a closed page ${stale.length === 1 ? 'was' : 'were'} closed at the last price it saw`, 'page');
  return next;
}

/* ================================================================== */
/*  THE HEARTBEAT                                                      */
/* ================================================================== */

export interface PaperEvent {
  kind: 'fill' | 'expired' | 'rule' | 'failed' | 'passed' | 'day-over' | 'flat' | 'roll';
  at: number;
  /** What happened, in the house's words */
  words: string;
  /** What it made or lost, where it closed something */
  pnl?: number;
  /** What it was about: a contract's key */
  key?: string;
}

/** Is an option position's expiry past: 16:00 New York on its date */
const expired = (c: ContractId, now: number) => bellOf(c.expiry) <= now;

/** THE DAY ROLLS at the 16:00 bell: day orders go, the day that was is written down, an evaluation's high mark and its
    pass are judged on its close, and the new day begins from what the account is worth */
function roll(a: PaperAccount, m: PaperMarket, events: PaperEvent[]): PaperAccount {
  const day = tradingDayOf(m.now);
  if (day === a.day) return a;
  const v = viewOf(a, m);
  const was = a.day;
  const ledger = { ...a.ledger };
  if (ledger[was]) ledger[was] = { ...ledger[was], close: v.equity };
  let next: PaperAccount = { ...a, ledger };
  const when = momentAt(m.now);
  next = setOpt(next, next.opt.orders.map(o => (o.status === 'working' && o.tif === 'day' ? { ...o, status: 'cancelled' as const, done: when, why: 'the day ended' } : o)));
  if (next.kind === 'evaluation' && next.plan && next.status === 'open' && ledger[was]) {
    const plan = next.plan;
    const close = v.equity;
    if (plan.trailing === 'eod') next = { ...next, peak: Math.max(next.peak, close) };
    const days = daysTradedOf(next).length;
    const results = Object.values(ledger).map(dayResult).filter((x): x is number => x != null);
    const best = Math.max(0, ...results);
    const profit = close - plan.size;
    const bestOk = plan.bestDayShare == null || best <= plan.bestDayShare * profit + 1e-9;
    if (profit >= plan.target - 1e-9 && days >= plan.minDays && bestOk) {
      next = logged({ ...next, status: 'passed', statusAt: m.now, statusWhy: `Closed ${money(close, 0)} — ${money(profit, 0)} made over ${days} trading ${days === 1 ? 'day' : 'days'}` }, m.now, `Passed — closed the day at ${money(close, 0)}, the target was ${money(plan.size + plan.target, 0)}`, 'pass');
      events.push({ kind: 'passed', at: m.now, words: `The ${plan.label} evaluation passed — ${money(profit, 0)} made` });
    }
  }
  next = { ...next, day, dayOver: undefined, ledger: { ...next.ledger, [day]: next.ledger[day] ?? { open: v.equity, hi: v.equity, lo: v.equity } } };
  events.push({ kind: 'roll', at: m.now, words: `A new trading day began at ${money(v.equity, 0)}` });
  return next;
}

/** A working order's moment to be looked at: never the tick it was placed on */
const lookable = (placed: PaperMoment, now: number) => placed.at < now;

function optTickOrders(a: PaperAccount, m: PaperMarket): PaperAccount {
  let next = a;
  for (const o of a.opt.orders) {
    if (o.status !== 'working' || !lookable(o.placed, m.now)) continue;
    const live = next.opt.orders.find(x => x.id === o.id);
    if (!live || live.status !== 'working') continue;
    const q = m.optQuote(live.contract);
    if (q.dead) continue;
    if (live.on === 'name') {
      if (live.side === 'sell' && nameHit(live, q.spot)) next = optFillNow(next, live, q.bid, live.kind, q, m);
      continue;
    }
    if (live.kind === 'limit' && live.side === 'buy' && q.ask <= live.price!) {
      const blocked = accountRefusal(next, m.now, live.qty, () => viewOf(next, m));
      if (blocked) next = optCancel(next, m, live.id, blocked);
      else if (live.price! * MULT * live.qty + optFee(next, live.contract, live.qty) > viewOf(next, m).free + 1e-9) next = optCancel(next, m, live.id, 'the free money was gone by then');
      else next = optFillNow(next, live, Math.min(live.price!, q.ask), 'limit', q, m);
    } else if (live.kind === 'limit' && live.side === 'sell' && q.bid >= live.price!) next = optFillNow(next, live, Math.max(live.price!, q.bid), 'limit', q, m);
    else if (live.kind === 'stop' && live.side === 'sell' && q.bid <= live.price!) next = optFillNow(next, live, q.bid, 'stop', q, m);
  }
  /* TRAILING STOPS, AFTER THE CHECK: each was tried where it stood; only now is it moved by this tick's price */
  if (next.opt.orders.some(o => o.status === 'working' && o.trail != null)) {
    next = setOpt(
      next,
      next.opt.orders.map(o => {
        if (o.status !== 'working' || o.kind !== 'stop' || o.trail == null || o.price == null || !lookable(o.placed, m.now)) return o;
        const q = m.optQuote(o.contract);
        if (q.dead) return o;
        if (o.on === 'name') {
          const up = o.contract.right === 'C';
          const peak = up ? Math.max(o.peak ?? q.spot, q.spot) : Math.min(o.peak ?? q.spot, q.spot);
          const level = cents(up ? peak - o.trail : peak + o.trail);
          return { ...o, peak, price: up ? Math.max(o.price, level) : Math.min(o.price, level) };
        }
        const peak = Math.max(o.peak ?? q.bid, q.bid);
        return { ...o, peak, price: Math.max(o.price, cents(peak - o.trail)) };
      })
    );
  }
  return next;
}

/** WHILE IT IS HELD: what each open trade is worth on this tick — its best and worst every tick, a point every few seconds */
function keepHeld(a: PaperAccount, m: PaperMarket): PaperAccount {
  const ob = optBookOf(a).positions;
  if (!ob.length) return a;
  const held = { ...a.held };
  const marks = { ...a.marks };
  const note = (tradeId: string, pnl: number, value: number, name: number) => {
    const h = held[tradeId] ?? { pts: [], best: pnl, bestAt: m.now, worst: pnl, worstAt: m.now };
    const last = h.pts[h.pts.length - 1];
    let pts = h.pts;
    if (!last || m.now - last[0] >= HELD_EVERY_MS) {
      pts = [...pts, [m.now, cents(pnl), value, name]];
      /* full: every other point goes, so the whole of it is still drawn, a coarser grain */
      if (pts.length > HELD_POINTS) pts = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
    }
    held[tradeId] = { pts, best: pnl > h.best ? pnl : h.best, bestAt: pnl > h.best ? m.now : h.bestAt, worst: pnl < h.worst ? pnl : h.worst, worstAt: pnl < h.worst ? m.now : h.worstAt };
  };
  for (const p of ob) {
    const q = m.optQuote(p.contract);
    /* at the bid it could be sold into, less the fee to sell it — "fees in", the backtest's walk */
    note(p.tradeId, p.flow + q.bid * MULT * p.qty - optFee(a, p.contract, p.qty), q.bid, q.spot);
    marks[p.key] = q.bid;
  }
  return { ...a, held, marks };
}

/** THE CANDLES A TRADE WAS ON, written down as it closes: an hour before the way in to the way out, at a coarser candle
    when that is more than PATH_BARS of them — in whole units over a base, to keep a journal of hundreds small */
export function pathOf(bars: Candle[], fromSec: number, toSec: number, unit: number): TradePath | null {
  const inside = bars.filter(b => b.time >= fromSec && b.time <= toSec);
  if (!inside.length) return null;
  const minutes = Math.max(1, Math.ceil(inside.length / PATH_BARS));
  const step = 60 * minutes;
  const out: Candle[] = [];
  for (const b of inside) {
    const t = b.time - (b.time % step);
    const last = out[out.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
    } else out.push({ ...b, time: t });
  }
  const base = out[0].open;
  const u = (v: number) => Math.round((v - base) / unit);
  return { t0: out[0].time, step, base, unit, o: out.map(b => u(b.open)), h: out.map(b => u(b.high)), l: out.map(b => u(b.low)), c: out.map(b => u(b.close)) };
}
/** …and back into candles, for the chart */
export const candlesOfPath = (p: TradePath): Candle[] => p.o.map((_, i) => ({ time: p.t0 + i * p.step, open: p.base + p.o[i] * p.unit, high: p.base + p.h[i] * p.unit, low: p.base + p.l[i] * p.unit, close: p.base + p.c[i] * p.unit, volume: 0 }));

/** Every trade that closed between two states of the account: its candles written down, its last point added */
function keepClosed(before: PaperAccount, after: PaperAccount, m: PaperMarket): PaperAccount {
  const had = new Set(optBookOf(before).trades.map(t => t.id));
  const ot = optBookOf(after).trades.filter(t => !had.has(t.id));
  if (!ot.length) return after;
  const paths = { ...after.paths };
  const held = { ...after.held };
  const write = (id: string, ticker: string, unit: number, barIn: number, barOut: number, pnl: number, value: number, name: number) => {
    const p = pathOf(m.candles(ticker), barIn - 3600, barOut, unit);
    if (p) paths[id] = p;
    const h = held[id] ?? { pts: [], best: pnl, bestAt: m.now, worst: pnl, worstAt: m.now };
    /* what was taken is part of the trade: its last point is the result, to the cent — and a closed trade keeps HELD_KEPT
       points, evenly, its first and its last among them */
    const all = [...h.pts, [m.now, pnl, value, name] as [number, number, number, number]];
    const every = Math.max(1, Math.ceil(all.length / HELD_KEPT));
    const pts = all.filter((_, i) => i % every === 0 || i === all.length - 1);
    held[id] = { ...h, pts, best: Math.max(h.best, pnl), bestAt: pnl > h.best ? m.now : h.bestAt, worst: Math.min(h.worst, pnl), worstAt: pnl < h.worst ? m.now : h.worstAt };
  };
  for (const t of ot) write(t.id, t.contract.ticker, 0.01, t.legs[0].bar, t.legs[t.legs.length - 1].bar, t.pnl, t.avgOut, t.spotOut);
  /* at most PATHS_KEPT trades' candles: the oldest go first */
  const ids = Object.keys(paths);
  if (ids.length > PATHS_KEPT) {
    const order = [...optBookOf(after).trades].sort((x, y) => x.closed.at - y.closed.at).map(t => t.id);
    for (const id of order.slice(0, ids.length - PATHS_KEPT)) {
      delete paths[id];
      delete held[id];
    }
  }
  return { ...after, paths, held };
}

/** Say each new fill, in the house's words */
function fillEvents(before: PaperAccount, after: PaperAccount, events: PaperEvent[]): void {
  const hadO = new Set(before.opt.fills.map(f => f.id));
  /* the trade a fill closed: the one whose last leg it is */
  const closedBy = new Map<string, number>(optBookOf(after).trades.map(t => [t.legs[t.legs.length - 1].id, t.pnl]));
  const targetIds = new Set(after.opt.orders.filter(o => o.oco && o.kind === 'limit').map(o => o.id));
  for (const f of after.opt.fills) {
    if (hadO.has(f.id)) continue;
    const what = f.how === 'expired' ? 'Expired' : f.how === 'stop' ? 'Stop filled' : f.orderId && targetIds.has(f.orderId) ? 'Target filled' : f.how === 'limit' ? 'Limit filled' : f.how === 'rule' ? 'Closed by the rules' : f.how === 'page' ? 'Closed' : 'Filled';
    events.push({ kind: f.how === 'expired' ? 'expired' : f.how === 'rule' ? 'rule' : 'fill', at: f.at.at, words: `${what} · ${f.side === 'buy' ? 'bought' : 'sold'} ${f.qty} ${contractWords(f.contract)} at ${f.price.toFixed(2)}`, pnl: closedBy.get(f.id), key: contractKey(f.contract) });
  }
}

/**
 * WHAT EXPIRED, SETTLED — at what it is worth in the money, ON ITS OWN DAY.
 *
 * The day rolls at the same 16:00 bell a contract expires at, so a settlement written at the instant the tick saw it
 * would belong to the NEXT day: a contract that lapsed on Friday would be dated Monday in the journal, banked in Monday's
 * RP&L and counted as a Monday traded. So the fill is written at the bell's last instant — on the day it expired,
 * whenever the tick that saw it came (scripts/paper-proof.ts walks both). It is settled before the roll, too, so the
 * day that closes already holds it when an evaluation's days traded are counted at that close.
 */
function settleExpired(a: PaperAccount, m: PaperMarket): PaperAccount {
  let next = a;
  for (const p of optBookOf(a).positions) {
    if (!expired(p.contract, m.now)) continue;
    const bell = bellOf(p.contract.expiry);
    const atBell: PaperMarket = { ...m, now: Math.min(m.now, bell - 1) };
    const when = momentAt(atBell.now);
    next = setOpt(next, next.opt.orders.map(o => (o.status === 'working' && contractKey(o.contract) === p.key ? { ...o, status: 'cancelled' as const, done: when, why: 'the contract expired' } : o)));
    const q = m.optQuote(p.contract);
    next = optFillNow(next, { id: '', placed: when, contract: p.contract, side: 'sell', qty: p.qty, kind: 'market', tif: 'day', status: 'working', tag: p.tag, life: m.life }, q.intrinsic, 'expired', q, atBell);
  }
  return next;
}

/** ONE TICK OF THE FEED: what expired settles, the day rolls at the bell, an evaluation is flat a minute before it, working
    orders meet the price, trailing stops follow it, an evaluation's floor and day are kept, and every open trade is written
    down as it stands. */
export function tick(a: PaperAccount, m: PaperMarket): { account: PaperAccount; events: PaperEvent[] } {
  const events: PaperEvent[] = [];
  const before = a;
  /* nothing open, nothing working, the same day: nothing to do — the same account back */
  if (a.day === tradingDayOf(m.now) && !optBookOf(a).positions.length && !a.opt.orders.some(o => o.status === 'working')) return { account: a, events };
  let next = a.status === 'open' ? settleExpired(a, m) : a;
  next = roll(next, m, events);
  if (next.status === 'open') {
    /* an evaluation is flat a minute before the bell */
    if (next.kind === 'evaluation' && m.now >= flatByOf(next.day) && m.now < dayEndsAt(next.day)) {
      const open = optBookOf(next).positions.length;
      const working = next.opt.orders.some(o => o.status === 'working');
      if (open || working) {
        next = flattenAll(next, m, 'rule', `15:59 — an evaluation holds nothing into the bell`);
        if (open) {
          next = logged(next, m.now, `15:59 New York — ${open} ${open === 1 ? 'position' : 'positions'} closed; nothing is held into the bell`, 'rule');
          events.push({ kind: 'flat', at: m.now, words: `15:59 — ${open} ${open === 1 ? 'position' : 'positions'} closed. An evaluation holds nothing into the bell` });
        }
      }
    }
    next = optTickOrders(next, m);
    /* THE EVALUATION'S FLOOR AND ITS DAY, as it happens */
    if (next.kind === 'evaluation' && next.plan && next.status === 'open') {
      const plan = next.plan;
      const v = viewOf(next, m);
      if (plan.trailing === 'intraday' && v.equity > next.peak) next = { ...next, peak: v.equity };
      const floor = floorOf(next);
      const dayFloor = (next.ledger[next.day]?.open ?? plan.size) - plan.dayLoss;
      if (v.equity <= floor + 1e-9) {
        const why = `worth ${money(v.equity, 0)} reached the floor at ${money(floor, 0)}`;
        next = flattenAll(next, m, 'rule', 'the floor was reached');
        next = logged({ ...next, status: 'failed', statusAt: m.now, statusWhy: why.charAt(0).toUpperCase() + why.slice(1) }, m.now, `Failed — ${why}`, 'fail');
        events.push({ kind: 'failed', at: m.now, words: `The ${plan.label} evaluation failed — ${why}` });
      } else if (!next.dayOver && v.equity <= dayFloor + 1e-9) {
        const why = `down ${money(v.dayOpen - v.equity, 0)} on the day, the limit is ${money(plan.dayLoss, 0)}`;
        next = flattenAll(next, m, 'rule', 'the day’s limit was reached');
        next = logged({ ...next, dayOver: { day: next.day, why } }, m.now, `The day is over — ${why}`, 'rule');
        events.push({ kind: 'day-over', at: m.now, words: `The day is over — ${why}. No new positions until the day rolls at the 16:00 bell` });
      }
    }
  }
  next = keepHeld(next, m);
  next = keepClosed(before, next, m);
  /* the day's high and low of what the account is worth */
  const d = next.ledger[next.day];
  if (d && optBookOf(next).positions.length) {
    const eq = viewOf(next, m).equity;
    if (eq > d.hi || eq < d.lo) next = { ...next, ledger: { ...next.ledger, [next.day]: { ...d, hi: Math.max(d.hi, eq), lo: Math.min(d.lo, eq) } } };
  }
  fillEvents(before, next, events);
  return { account: next, events };
}

/** A change the reader made (an order, a close): the trades it closed are written down the way a tick's are */
export function afterHand(before: PaperAccount, after: PaperAccount, m: PaperMarket): PaperAccount {
  return keepClosed(before, keepHeld(after, m), m);
}

