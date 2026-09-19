/*
==================================================
  SLAYER TERMINAL - THE PAPER ENGINE (core/paper/engine.ts)

  PAPER ONLY. There is no broker behind this file
  and no door to one: an order submitted here is
  filled here, against the terminal's market state
  (market.ts), and lands in this file's account.
  Nothing it produces can reach a live account,
  because nothing here knows what one is. Every
  fill carries `provenance: 'PAPER'`.

  ONE ENGINE FOR EVERY HAND. The chart's right-click
  card, the ticket, a hotkey, the chain's Buy/Sell
  and the position bar all build the SAME order
  request and hand it to submitOrder(). The chart
  never touches the account; it asks the engine and
  draws what the engine says.

    USER ACTION (chart · ticket · hotkey · chain)
            ↓
    submitOrder / modifyOrder / cancelOrder
            ↓
    PAPER EXECUTION (onQuotes: the book at the touch,
      the walk past it, partial fills, stops triggering)
            ↓
    PAPER ACCOUNT (cash, margin, equity, the day)
            ↓
    POSITIONS · ORDERS · TRADES (the journal)
            ↓
    the chart, the panels, the journal — readers

  THE LIFECYCLE: new → accepted → working →
  partially filled → filled, or canceled, or
  rejected. Every step is an event on the order.

  THREE SEAMS, AND NOTHING ELSE (the sprint's rule:
  "modular wrappers/interceptors so we do not bloat
  the core order engine"). A GUARD may refuse an
  order with a reason; an OBSERVER may hear what
  happened; a FILL MODEL may narrow how a fill is
  priced. Every mode — the prop firm's evaluation,
  the free-rein sandbox, the tilt watch, the
  microstructure queue — is one of those three and
  lives in its own file. None of them can invent a
  fill or move a balance. See "THE SEAMS" below.

  HOW A FILL IS PRICED, plainly:
    · a market order (or a stop that just triggered)
      takes what rests at the touch — the ask for a
      buy, the bid for a sell — and WALKS one tick
      per block of displayed size past it. Nobody
      gets the midpoint for free.
    · a limit fills when the far side reaches it, at
      the far side's price, up to the size showing;
      the rest stays working (PARTIALLY FILLED) and
      fills as more shows.
    · a stop triggers when the last or the far side
      touches it, then fills as a market order.
  Slippage is recorded per fill as the distance
  from the mark at that instant; fees per unit per
  side, the instrument's own.

  POSITIONS NET PER INSTRUMENT. A fill on the same
  side averages in; a fill the other way closes at
  the average and writes a TRADE to the journal for
  the quantity closed; what is left over opens the
  other way (a reverse). A spread is one position
  on the strategy's own id with its legs kept
  underneath.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { dayKey } from '../rng';
import { expiredAt, feeFor, roundToTick, tagWord, type Instrument, type InstrumentKind } from './instruments';
import { lastBarTime, quoteFor, type Quote } from './market';
import { getPaperPrefs } from './prefs';

export type Side = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';
export type OrderStatus = 'new' | 'accepted' | 'working' | 'partial' | 'filled' | 'canceled' | 'rejected';
export type OrderRole = 'entry' | 'stop' | 'target' | 'exit';
export type OrderSource = 'chart' | 'ticket' | 'hotkey' | 'chain' | 'panel' | 'engine';

export interface OrderEvent {
  at: number;
  kind: OrderStatus | 'modified' | 'triggered' | 'fill';
  note: string;
}

export interface FillLeg {
  instrumentId: string;
  symbol: string;
  /** Signed: + bought, − sold */
  qty: number;
  price: number;
}

export interface Fill {
  id: string;
  orderId: string;
  instrumentId: string;
  at: number;
  side: Side;
  qty: number;
  price: number;
  /** Distance from the mark at the instant, signed adverse: + paid up, − improved */
  slippage: number;
  fee: number;
  provenance: 'PAPER';
  legs?: FillLeg[];
  /** The forming bar on the tape when it filled — where the chart prints the mark */
  barTime?: number;
}

export type BracketSpec = { stopTicks: number; targetTicks: number } | { stopPrice: number; targetPrice: number };

export interface OrderRequest {
  instrument: Instrument;
  side: Side;
  qty: number;
  type: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  role?: OrderRole;
  ocoGroup?: string;
  parentId?: string;
  /** Protective orders to attach once this entry fills */
  bracket?: BracketSpec;
  /** Only ever closes — never opens or flips */
  reduceOnly?: boolean;
  /** For a protective order: the share of the position it covers, 0..1 */
  coverFraction?: number;
  source: OrderSource;
  note?: string;
}

export interface Order {
  id: string;
  createdAt: number;
  updatedAt: number;
  instrument: Instrument;
  instrumentId: string;
  side: Side;
  qty: number;
  filledQty: number;
  avgFill: number | null;
  type: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  status: OrderStatus;
  role: OrderRole;
  ocoGroup?: string;
  parentId?: string;
  bracket?: BracketSpec;
  reduceOnly: boolean;
  /*
    WHAT SHARE OF THE POSITION THIS PROTECTIVE ORDER COVERS, 0..1.

    "Proportionally reduce both working TP and SL when the position is scaled
    out" needs a fraction, not a count: a TP written for the whole position
    and a TP written for half must both survive a 50% close, one going to
    half and the other to a quarter. The fraction is set when a protective
    order is created or resized by hand, and the engine re-sizes off it every
    time the position changes (afterFills).
  */
  coverFraction?: number;
  source: OrderSource;
  note?: string;
  events: OrderEvent[];
  fills: Fill[];
  filledAt?: number;
  canceledAt?: number;
  rejectReason?: string;
  /** A stop that has become a market order */
  triggered?: boolean;
}

export interface PositionLeg {
  instrumentId: string;
  symbol: string;
  /** Signed: + long, − short */
  qty: number;
  avgPrice: number;
}

export interface Position {
  /** The instrument's id */
  id: string;
  instrument: Instrument;
  /** Signed: + long, − short */
  qty: number;
  avgPrice: number;
  /** Realised on this instrument since it was first opened, fees off */
  realized: number;
  /** Fees paid on the open lot — the breakeven carries them */
  entryFees: number;
  /** Adverse slippage paid on the open lot, price units summed per unit */
  entrySlip: number;
  openedAt: number;
  updatedAt: number;
  /* THE HEAT AND THE HIGH WATER (the excursion pair every journal wants):
     the best and the worst this lot has been worth since it opened, in
     dollars, sampled on every quote. MFE says how much was left on the
     table; MAE says how much heat was taken to get the result. */
  mfe: number;
  mae: number;
  legs?: PositionLeg[];
}

export interface Trade {
  id: string;
  openedAt: number;
  closedAt: number;
  instrument: Instrument;
  instrumentId: string;
  kind: InstrumentKind;
  side: 'long' | 'short';
  qty: number;
  entryAvg: number;
  exitAvg: number;
  fees: number;
  /** Adverse slippage over the round trip, dollars */
  slippage: number;
  /** Fees off */
  realized: number;
  returnPct: number;
  holdMs: number;
  /** Maximum favourable excursion — the most this lot was ever worth, dollars */
  mfe: number;
  /** Maximum adverse excursion — the deepest it was ever under, dollars (≤ 0) */
  mae: number;
  legs?: { symbol: string; qty: number; entry: number; exit: number }[];
}

export interface AccountState {
  startingCash: number;
  cash: number;
  feesTotal: number;
  realizedTotal: number;
  dayKey: string;
  dayStartEquity: number;
  /*
    WHAT THE DESK IS LENT AGAINST ITS OWN EQUITY, ×1 unless a sandbox says
    otherwise (Free Rein). It is the one dial outside this file that can widen
    what the margin check allows, and it widens ONLY the allowance — every fill
    still comes from the book, and every dollar still comes from a fill.
  */
  bpMultiple?: number;
}

export interface PaperToast {
  id: string;
  at: number;
  kind: 'fill' | 'reject' | 'cancel' | 'info';
  symbol: string;
  words: string;
}

export interface PaperState {
  account: AccountState;
  orders: Order[];
  positions: Position[];
  trades: Trade[];
  toasts: PaperToast[];
  /** The newest quote per instrument in play — never persisted */
  quotes: Record<string, Quote>;
  /** Bumped on every change */
  rev: number;
}

/*
  ═══ THE SEAMS ═══════════════════════════════════════════════════════════════
  THE MODES DO NOT LIVE IN THIS FILE, and that is the point (the sprint's own
  rule: "modular wrappers/interceptors so we do not bloat the core order
  engine"). The engine keeps one job — the lifecycle of an order — and offers
  three doors that everything else plugs into:

    a GUARD       runs before an order is accepted and may refuse it with a
                  reason. The prop firm's asset lock, its drawdown lock and
                  the tilt manager's cool-off are all guards; none of them is
                  known here.
    an OBSERVER   hears every event the engine emits — submitted, modified,
                  filled, canceled, a position opened, a position closed, a
                  quote tick. The tilt manager watches stops being dragged
                  through this door; the prop firm watches equity.
    a FILL MODEL  may alter HOW a fill is priced: bypass the spread, cap the
                  walk past the touch, refuse a limit fill that has not
                  reached the front of the queue, zero the fee. Free Rein and
                  the microstructure queue are fill models.

  Nothing registered here can invent a fill or move the account — they can
  only refuse, observe, or narrow. The lifecycle below is the one truth.
  ═════════════════════════════════════════════════════════════════════════════
*/

export interface GuardContext {
  state: PaperState;
  quote: Quote;
  account: AccountRead;
  /** The position this order would act on, if any */
  position: Position | null;
  /** Units this order would OPEN (0 when it only closes) */
  opens: number;
}
/** null lets the order through; a string rejects it with that reason */
export type OrderGuard = (req: OrderRequest, ctx: GuardContext) => string | null;

const guards = new Map<string, OrderGuard>();
export function registerGuard(id: string, fn: OrderGuard): () => void {
  guards.set(id, fn);
  return () => {
    guards.delete(id);
  };
}

export type EngineEvent =
  | { kind: 'submitted'; order: Order }
  | { kind: 'rejected'; order: Order; reason: string }
  | { kind: 'modified'; order: Order; before: { limitPrice?: number; stopPrice?: number; qty: number }; source: OrderSource }
  | { kind: 'fill'; order: Order; fill: Fill }
  | { kind: 'canceled'; order: Order; why: string }
  | { kind: 'positionOpened'; position: Position }
  | { kind: 'positionClosed'; trade: Trade; byRole: OrderRole }
  | { kind: 'quotes'; at: number };

type Observer = (e: EngineEvent) => void;
const observers = new Set<Observer>();
export function registerObserver(fn: Observer): () => void {
  observers.add(fn);
  return () => {
    observers.delete(fn);
  };
}
function emit(e: EngineEvent): void {
  for (const fn of observers) {
    try {
      fn(e);
    } catch {
      /* an interceptor must never take the engine down with it */
    }
  }
}

export interface FillModel {
  /** The price a market order starts from — return null to keep the touch */
  touch?(side: Side, q: Quote, inst: Instrument): number | null;
  /** How many ticks a market order may walk past the touch (0 = no slippage) */
  maxWalk?(inst: Instrument): number;
  /** How much of a crossed limit may fill on this quote — the queue's word */
  limitFillQty?(o: Order, q: Quote, want: number, at: number): number;
  /** The fee for this fill — null keeps the instrument's own */
  fee?(inst: Instrument, qty: number): number | null;
}
let fillModel: FillModel | null = null;
export function setFillModel(m: FillModel | null): void {
  fillModel = m;
}

/* ---- storage ---------------------------------------------------------------------------- */

const KEY = 'slayer_paper_v1';
/** A cheap flag the shell reads before it loads this module: is anything alive on the desk? */
export const LIVE_FLAG = 'slayer_paper_live';
const STARTING_CASH = 100_000;
const KEEP_ORDERS = 600;
const KEEP_TRADES = 1500;
const KEEP_TOASTS = 6;
/** How many ticks a market order may walk past the touch before the rest fills at the last level */
const MAX_WALK = 6;

interface Stored {
  account: AccountState;
  orders: Order[];
  positions: Position[];
  trades: Trade[];
  tradeSeq: number;
}

const freshAccount = (): AccountState => ({ startingCash: STARTING_CASH, cash: STARTING_CASH, feesTotal: 0, realizedTotal: 0, dayKey: dayKey(), dayStartEquity: STARTING_CASH });

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Stored>;
      if (v.account && Array.isArray(v.orders) && Array.isArray(v.positions) && Array.isArray(v.trades)) {
        return { account: { ...freshAccount(), ...v.account }, orders: v.orders, positions: v.positions, trades: v.trades, tradeSeq: v.tradeSeq ?? v.trades.length };
      }
    }
  } catch {
    /* a bad record starts the desk fresh */
  }
  return { account: freshAccount(), orders: [], positions: [], trades: [], tradeSeq: 0 };
}

const stored = load();
let state: PaperState = { account: stored.account, orders: stored.orders, positions: stored.positions, trades: stored.trades, toasts: [], quotes: {}, rev: 0 };
let tradeSeq = stored.tradeSeq;
const listeners = new Set<() => void>();
let saveTimer = 0;

function save(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const rec: Stored = { account: state.account, orders: state.orders.slice(-KEEP_ORDERS), positions: state.positions, trades: state.trades.slice(-KEEP_TRADES), tradeSeq };
      localStorage.setItem(KEY, JSON.stringify(rec));
      localStorage.setItem(LIVE_FLAG, hasActivity() ? '1' : '0');
    } catch {
      /* storage full or off — the session keeps its book in memory */
    }
  }, 200);
}

function publish(): void {
  state = { ...state, rev: state.rev + 1 };
  listeners.forEach(fn => fn());
  save();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getPaperState = (): PaperState => state;
export const usePaper = (): PaperState => useSyncExternalStore(subscribe, getPaperState, getPaperState);

/** Working orders or open positions exist */
export const hasActivity = (): boolean => state.positions.some(p => p.qty !== 0) || state.orders.some(o => isLive(o));

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const isLive = (o: Order): boolean => o.status === 'new' || o.status === 'accepted' || o.status === 'working' || o.status === 'partial';
const remaining = (o: Order): number => o.qty - o.filledQty;

/* ---- words --------------------------------------------------------------------------------- */

export const sideWord = (side: Side): string => (side === 'buy' ? 'BUY' : 'SELL');
export const typeWord = (o: Pick<Order, 'type' | 'triggered'>): string => (o.type === 'market' || o.triggered ? 'MKT' : o.type === 'limit' ? 'LMT' : 'STP');
export const STATUS_WORDS: Record<OrderStatus, string> = { new: 'New', accepted: 'Accepted', working: 'Working', partial: 'Partially filled', filled: 'Filled', canceled: 'Canceled', rejected: 'Rejected' };

/* ---- the account, read against the newest quotes --------------------------------------- */

export interface PositionMark {
  mark: number;
  unrealized: number;
  /** Signed market value: long positive, short negative — options and stock; a future's is its notional */
  marketValue: number;
  pnlPct: number;
  /** Where the position stops losing money, fees included */
  breakeven: number;
  /** Margin held for it */
  margin: number;
}

export function markPosition(p: Position, q: Quote | undefined): PositionMark {
  const inst = p.instrument;
  const mult = inst.multiplier;
  const mark = q?.mark ?? p.avgPrice;
  const unrealized = (mark - p.avgPrice) * p.qty * mult;
  const absQty = Math.abs(p.qty);
  const dir = p.qty >= 0 ? 1 : -1;
  const feePerUnitPrice = absQty > 0 ? p.entryFees / (absQty * mult) : 0;
  const breakeven = p.avgPrice + dir * feePerUnitPrice;
  let margin = 0;
  let basis = Math.abs(p.avgPrice) * absQty * mult;
  if (inst.kind === 'future') {
    margin = inst.initialMargin * absQty;
    basis = margin;
  } else if (inst.kind === 'stock') {
    margin = 0.5 * Math.abs(mark) * absQty;
  } else if (inst.kind === 'option') {
    if (p.qty < 0) {
      const spot = q?.underlyingSpot ?? inst.strike;
      const otm = Math.max(0, inst.right === 'C' ? inst.strike - spot : spot - inst.strike);
      margin = Math.max(0.2 * spot * mult * absQty - otm * mult * absQty, 0.1 * inst.strike * mult * absQty) + Math.abs(mark) * mult * absQty;
    }
  } else if (inst.kind === 'spread') {
    const strikes = inst.legs.map(l => l.option.strike);
    const width = Math.max(...strikes) - Math.min(...strikes);
    const short = inst.legs.some(l => (p.qty >= 0 ? l.ratio : -l.ratio) < 0);
    if (short) margin = Math.max(0, width - Math.max(0, -(p.qty >= 0 ? p.avgPrice : -p.avgPrice))) * mult * absQty;
  }
  /* A short option or a credit structure risks its margin, not a premium it never paid */
  if ((inst.kind === 'option' && p.qty < 0) || (inst.kind === 'spread' && (p.qty >= 0 ? p.avgPrice : -p.avgPrice) <= 0)) basis = margin > 0 ? margin : basis;
  const marketValue = mark * p.qty * mult;
  const pnlPct = basis > 0 ? (unrealized / basis) * 100 : 0;
  return { mark, unrealized, marketValue, pnlPct, breakeven, margin };
}

export interface AccountRead {
  equity: number;
  cash: number;
  buyingPower: number;
  marginUsed: number;
  unrealized: number;
  dayPnl: number;
  totalPnl: number;
}

export function readAccount(s: PaperState = state): AccountRead {
  let unrealized = 0;
  let marginUsed = 0;
  let held = 0;
  for (const p of s.positions) {
    if (p.qty === 0) continue;
    const m = markPosition(p, s.quotes[p.id]);
    unrealized += m.unrealized;
    marginUsed += m.margin;
    /* Stock and option positions were paid for out of cash — their value counts back in;
       a future's cash never moved, only its unrealised does */
    if (p.instrument.kind !== 'future') held += m.marketValue;
  }
  const futuresUnreal = s.positions.filter(p => p.instrument.kind === 'future' && p.qty !== 0).reduce((t, p) => t + markPosition(p, s.quotes[p.id]).unrealized, 0);
  const equity = s.account.cash + held + futuresUnreal;
  return {
    equity,
    cash: s.account.cash,
    buyingPower: (equity - marginUsed) * (s.account.bpMultiple ?? 1),
    marginUsed,
    unrealized,
    dayPnl: equity - s.account.dayStartEquity,
    totalPnl: equity - s.account.startingCash,
  };
}

/** What a new order would need held — the check before it is accepted */
function marginNeeded(inst: Instrument, side: Side, qty: number, q: Quote, limit?: number): number {
  const price = Math.abs(limit ?? (side === 'buy' ? q.ask : q.bid));
  if (inst.kind === 'future') return inst.initialMargin * qty;
  if (inst.kind === 'stock') return 0.5 * price * qty;
  if (inst.kind === 'option') {
    if (side === 'buy') return price * inst.multiplier * qty;
    const spot = q.underlyingSpot;
    const otm = Math.max(0, inst.right === 'C' ? inst.strike - spot : spot - inst.strike);
    return Math.max(0.2 * spot * 100 * qty - otm * 100 * qty, 0.1 * inst.strike * 100 * qty);
  }
  const strikes = inst.legs.map(l => l.option.strike);
  const width = Math.max(...strikes) - Math.min(...strikes);
  const net = side === 'buy' ? q.ask : -q.bid;
  return net > 0 ? net * 100 * qty : Math.max(0, width - Math.abs(net)) * 100 * qty;
}

/* ---- the watch list the clock quotes ------------------------------------------------------- */

const watched = new Map<string, { inst: Instrument; n: number }>();
export function watchInstrument(inst: Instrument): () => void {
  const cur = watched.get(inst.id);
  if (cur) cur.n++;
  else watched.set(inst.id, { inst, n: 1 });
  ensureClock();
  return () => {
    const w = watched.get(inst.id);
    if (!w) return;
    w.n--;
    if (w.n <= 0) watched.delete(inst.id);
  };
}

/** Every instrument with a position, a live order, or a reader looking at it */
export function instrumentsInPlay(): Instrument[] {
  const out = new Map<string, Instrument>();
  for (const p of state.positions) if (p.qty !== 0) out.set(p.id, p.instrument);
  for (const o of state.orders) if (isLive(o)) out.set(o.instrumentId, o.instrument);
  for (const w of watched.values()) out.set(w.inst.id, w.inst);
  return [...out.values()];
}

/* ---- the clock: quotes in, fills out ------------------------------------------------------ */

let clock = 0;
/** Quote everything in play and let the engine act — the same call the clock makes, for a hand that cannot wait */
export function pumpOnce(): void {
  const insts = instrumentsInPlay();
  if (insts.length === 0) return;
  const now = Date.now();
  const quotes: Quote[] = [];
  for (const inst of insts) {
    const q = quoteFor(inst, now);
    if (q) quotes.push(q);
  }
  onQuotes(quotes);
}

export function ensureClock(): void {
  if (clock || typeof window === 'undefined') return;
  clock = window.setInterval(() => {
    if (instrumentsInPlay().length === 0) return;
    pumpOnce();
  }, 500);
}

export function stopClock(): void {
  if (clock) window.clearInterval(clock);
  clock = 0;
}

/* ---- events and toasts --------------------------------------------------------------------- */

function event(o: Order, kind: OrderEvent['kind'], note: string, at = Date.now()): void {
  o.events = [...o.events, { at, kind, note }];
  o.updatedAt = at;
}

function toast(kind: PaperToast['kind'], symbol: string, words: string): void {
  state = { ...state, toasts: [...state.toasts, { id: newId('toast'), at: Date.now(), kind, symbol, words }].slice(-KEEP_TOASTS) };
}

/** A word from the desk itself, shown where fills are shown */
export function notePaper(symbol: string, words: string): void {
  toast('info', symbol, words);
  state = { ...state, rev: state.rev + 1 };
  listeners.forEach(fn => fn());
}

export function dismissToasts(before: number): void {
  const next = state.toasts.filter(t => t.at >= before);
  if (next.length === state.toasts.length) return;
  state = { ...state, toasts: next, rev: state.rev + 1 };
  listeners.forEach(fn => fn());
}

/* ---- the one door in ------------------------------------------------------------------------ */

const replaceOrder = (o: Order): void => {
  state = { ...state, orders: state.orders.map(x => (x.id === o.id ? o : x)) };
};

export function submitOrder(req: OrderRequest): Order {
  const at = Date.now();
  const inst = req.instrument;
  const prefs = getPaperPrefs();
  const o: Order = {
    id: newId('ord'),
    createdAt: at,
    updatedAt: at,
    instrument: inst,
    instrumentId: inst.id,
    side: req.side,
    qty: Math.max(0, Math.round(req.qty)),
    filledQty: 0,
    avgFill: null,
    type: req.type,
    limitPrice: req.limitPrice != null ? roundToTick(inst, req.limitPrice) : undefined,
    stopPrice: req.stopPrice != null ? roundToTick(inst, req.stopPrice) : undefined,
    status: 'new',
    role: req.role ?? 'entry',
    ocoGroup: req.ocoGroup,
    parentId: req.parentId,
    bracket: req.bracket ?? (req.role == null && prefs.bracket.on && !req.reduceOnly ? { stopTicks: prefs.bracket.stopTicks, targetTicks: prefs.bracket.targetTicks } : undefined),
    reduceOnly: !!req.reduceOnly,
    coverFraction: req.coverFraction,
    source: req.source,
    note: req.note,
    events: [{ at, kind: 'new', note: `${sideWord(req.side)} ${req.qty} ${tagWord(inst)} ${req.type.toUpperCase()}${req.limitPrice != null ? ` @ ${req.limitPrice}` : ''}${req.stopPrice != null ? ` stop ${req.stopPrice}` : ''} · from the ${req.source}` }],
    fills: [],
  };
  state = { ...state, orders: [...state.orders, o] };

  /* ---- validation → rejected, with the reason on the order ---- */
  const reject = (why: string) => {
    o.status = 'rejected';
    o.rejectReason = why;
    event(o, 'rejected', why, at);
    replaceOrder(o);
    toast('reject', tagWord(inst), `rejected — ${why}`);
    emit({ kind: 'rejected', order: o, reason: why });
    publish();
    return o;
  };
  if (o.qty <= 0) return reject('Quantity must be at least one');
  if (o.type === 'limit' && !(o.limitPrice! > 0) && inst.kind !== 'spread') return reject('A limit needs a price');
  if (o.type === 'stop' && !(o.stopPrice! > 0) && inst.kind !== 'spread') return reject('A stop needs a price');
  if (expiredAt(inst, new Date(at))) return reject(`${tagWord(inst)} has expired`);
  const q = state.quotes[inst.id] ?? quoteFor(inst, at);
  if (!q) return reject('No market data for this instrument yet');
  state = { ...state, quotes: { ...state.quotes, [inst.id]: q } };
  const pos = state.positions.find(p => p.id === inst.id);
  const posQty = pos?.qty ?? 0;
  if (o.reduceOnly) {
    const closes = (o.side === 'buy' && posQty < 0) || (o.side === 'sell' && posQty > 0);
    if (!closes) return reject('Nothing to close on this side');
    if (o.qty > Math.abs(posQty)) o.qty = Math.abs(posQty);
  } else {
    /* Buying power is checked on what the order OPENS, never on what it closes */
    const opens = Math.max(0, o.qty - ((o.side === 'buy' && posQty < 0) || (o.side === 'sell' && posQty > 0) ? Math.abs(posQty) : 0));
    if (opens > 0) {
      const need = marginNeeded(inst, o.side, opens, q, o.type === 'limit' ? o.limitPrice : undefined);
      const bp = readAccount().buyingPower;
      if (need > bp) return reject(`Buying power $${bp.toFixed(0)} is short of the $${need.toFixed(0)} this needs`);
    }
  }

  /* THE GUARDS HAVE THE LAST WORD (the seams above): the prop firm's asset
     lock and drawdown, the tilt manager's cool-off. They run after the
     engine's own checks, so a rejection always names the real reason. */
  const guardCtx: GuardContext = { state, quote: q, account: readAccount(), position: pos ?? null, opens: o.reduceOnly ? 0 : Math.max(0, o.qty - ((o.side === 'buy' && posQty < 0) || (o.side === 'sell' && posQty > 0) ? Math.abs(posQty) : 0)) };
  for (const [, guard] of guards) {
    let verdict: string | null = null;
    try {
      verdict = guard(req, guardCtx);
    } catch {
      verdict = null; /* a broken interceptor never blocks a trade */
    }
    if (verdict) return reject(verdict);
  }

  o.status = 'accepted';
  event(o, 'accepted', 'accepted by the paper engine', at);
  o.status = 'working';
  event(o, 'working', o.type === 'market' ? 'working — filling at the market' : `working — ${o.type} at ${o.type === 'limit' ? o.limitPrice : o.stopPrice}`, at);
  replaceOrder(o);
  emit({ kind: 'submitted', order: o });
  ensureClock();
  /* A market order (or a marketable limit) fills on this same quote */
  tryFill(o, q, at);
  replaceOrder(o);
  afterFills(inst.id, at);
  publish();
  return state.orders.find(x => x.id === o.id) ?? o;
}

export function modifyOrder(id: string, patch: { limitPrice?: number; stopPrice?: number; qty?: number }, source: OrderSource = 'panel'): Order | null {
  const cur = state.orders.find(o => o.id === id);
  if (!cur || !isLive(cur)) return null;
  const o: Order = { ...cur, events: [...cur.events] };
  const at = Date.now();
  const words: string[] = [];
  if (patch.limitPrice != null && o.type === 'limit') {
    const p = roundToTick(o.instrument, patch.limitPrice);
    if (p !== o.limitPrice) {
      words.push(`limit ${o.limitPrice} → ${p}`);
      o.limitPrice = p;
    }
  }
  if (patch.stopPrice != null && o.type === 'stop') {
    const p = roundToTick(o.instrument, patch.stopPrice);
    if (p !== o.stopPrice) {
      words.push(`stop ${o.stopPrice} → ${p}`);
      o.stopPrice = p;
    }
  }
  if (patch.qty != null) {
    const qn = Math.max(o.filledQty, Math.round(patch.qty));
    if (qn !== o.qty) {
      words.push(`size ${o.qty} → ${qn}`);
      o.qty = qn;
      /* resized by hand: it now covers THIS share of the position, and the
         engine will keep that share through every later scale-out */
      if (o.role === 'stop' || o.role === 'target') {
        const pos = state.positions.find(x => x.id === o.instrumentId);
        if (pos && pos.qty !== 0) o.coverFraction = Math.min(1, Math.max(0.01, (qn - o.filledQty) / Math.abs(pos.qty)));
      }
    }
  }
  if (words.length === 0) return cur;
  event(o, 'modified', `${words.join(', ')} · from the ${source}`, at);
  replaceOrder(o);
  /* The tilt manager reads THIS: a stop moved further into the red while the
     position is offside is the first pattern it flags (core/paper/tilt.ts) */
  emit({ kind: 'modified', order: o, before: { limitPrice: cur.limitPrice, stopPrice: cur.stopPrice, qty: cur.qty }, source });
  if (o.qty === o.filledQty) {
    o.status = 'filled';
    o.filledAt = at;
    event(o, 'filled', 'size cut to what had filled', at);
    replaceOrder(o);
  } else {
    const q = state.quotes[o.instrumentId];
    if (q) {
      tryFill(o, q, at);
      replaceOrder(o);
      afterFills(o.instrumentId, at);
    }
  }
  publish();
  return state.orders.find(x => x.id === id) ?? o;
}

export function cancelOrder(id: string, source: OrderSource = 'panel', why = 'canceled'): boolean {
  const cur = state.orders.find(o => o.id === id);
  if (!cur || !isLive(cur)) return false;
  const o: Order = { ...cur, events: [...cur.events] };
  const at = Date.now();
  o.status = 'canceled';
  o.canceledAt = at;
  event(o, 'canceled', `${why} · from the ${source}`, at);
  replaceOrder(o);
  emit({ kind: 'canceled', order: o, why });
  toast('cancel', tagWord(o.instrument), `${sideWord(o.side)} ${remaining(o)} ${typeWord(o)} canceled`);
  publish();
  return true;
}

/** Every live order, or one instrument's */
export function cancelAll(instrumentId?: string, source: OrderSource = 'panel'): number {
  const live = state.orders.filter(o => isLive(o) && (!instrumentId || o.instrumentId === instrumentId));
  const at = Date.now();
  for (const cur of live) {
    const o: Order = { ...cur, events: [...cur.events] };
    o.status = 'canceled';
    o.canceledAt = at;
    event(o, 'canceled', `cancel all · from the ${source}`, at);
    replaceOrder(o);
    emit({ kind: 'canceled', order: o, why: 'cancel all' });
  }
  if (live.length) {
    toast('cancel', live.length === 1 ? tagWord(live[0].instrument) : 'Paper', `${live.length} order${live.length === 1 ? '' : 's'} canceled`);
    publish();
  }
  return live.length;
}

/* ---- positions: the hands that build orders ---------------------------------------------- */

export const positionFor = (instrumentId: string): Position | null => state.positions.find(p => p.id === instrumentId && p.qty !== 0) ?? null;
export const ordersFor = (instrumentId: string): Order[] => state.orders.filter(o => o.instrumentId === instrumentId && isLive(o));
export const stopOrderFor = (instrumentId: string): Order | null => ordersFor(instrumentId).find(o => o.role === 'stop') ?? null;
export const targetOrderFor = (instrumentId: string): Order | null => ordersFor(instrumentId).find(o => o.role === 'target') ?? null;

/** Every working child of a position — its stop, its target, and anything bracketed to it */
export const childOrdersOf = (instrumentId: string): Order[] => state.orders.filter(o => o.instrumentId === instrumentId && isLive(o) && (o.role === 'stop' || o.role === 'target'));

/**
 * Close part or all of a position at the market — fraction 1 is the whole thing.
 *
 * A FULL CLOSE CANCELS THE CHILDREN FIRST, in the same call, before the
 * closing order is ever submitted. Waiting for the close to fill and tidying
 * up afterwards leaves a window — one quote wide, but real — where a stop is
 * still working against a position that is already gone, and on a fast tape
 * that window is a phantom fill. A partial close leaves them, and they are
 * re-sized proportionally once it lands (afterFills).
 */
export function closePosition(instrumentId: string, fraction = 1, source: OrderSource = 'panel'): Order | null {
  const p = positionFor(instrumentId);
  if (!p) return null;
  if (fraction >= 1) for (const c of childOrdersOf(instrumentId)) cancelOrder(c.id, source, 'the position is being closed');
  const qty = Math.max(1, Math.round(Math.abs(p.qty) * Math.min(1, Math.max(0, fraction))));
  return submitOrder({ instrument: p.instrument, side: p.qty > 0 ? 'sell' : 'buy', qty, type: 'market', role: 'exit', reduceOnly: true, source, note: fraction < 1 ? `close ${Math.round(fraction * 100)}%` : 'close' });
}

/** Close and open the other way in one market order */
export function reversePosition(instrumentId: string, source: OrderSource = 'panel'): Order | null {
  const p = positionFor(instrumentId);
  if (!p) return null;
  /* the old side's protection cannot survive the flip — it would be pointing the wrong way */
  cancelAll(instrumentId, 'engine');
  return submitOrder({ instrument: p.instrument, side: p.qty > 0 ? 'sell' : 'buy', qty: Math.abs(p.qty) * 2, type: 'market', source, note: 'reverse' });
}

export function addToPosition(instrumentId: string, qty: number, source: OrderSource = 'panel'): Order | null {
  const p = positionFor(instrumentId);
  if (!p) return null;
  return submitOrder({ instrument: p.instrument, side: p.qty > 0 ? 'buy' : 'sell', qty, type: 'market', source, note: 'add' });
}

export function reducePosition(instrumentId: string, qty: number, source: OrderSource = 'panel'): Order | null {
  const p = positionFor(instrumentId);
  if (!p) return null;
  return submitOrder({ instrument: p.instrument, side: p.qty > 0 ? 'sell' : 'buy', qty: Math.min(qty, Math.abs(p.qty)), type: 'market', role: 'exit', reduceOnly: true, source, note: 'reduce' });
}

/** Put (or move) the position's stop — a reduce-only stop the other way, OCO with the target */
export function setStop(instrumentId: string, price: number, source: OrderSource = 'chart'): Order | null {
  const p = positionFor(instrumentId);
  if (!p) return null;
  const cur = stopOrderFor(instrumentId);
  if (cur) return modifyOrder(cur.id, { stopPrice: price }, source);
  const target = targetOrderFor(instrumentId);
  const group = target?.ocoGroup ?? `oco-${p.id}-${Date.now().toString(36)}`;
  if (target && !target.ocoGroup) modifyGroup(target.id, group);
  return submitOrder({ instrument: p.instrument, side: p.qty > 0 ? 'sell' : 'buy', qty: Math.abs(p.qty), type: 'stop', stopPrice: price, role: 'stop', ocoGroup: group, reduceOnly: true, coverFraction: 1, source, note: 'protective stop' });
}

export function setTarget(instrumentId: string, price: number, source: OrderSource = 'chart'): Order | null {
  const p = positionFor(instrumentId);
  if (!p) return null;
  const cur = targetOrderFor(instrumentId);
  if (cur) return modifyOrder(cur.id, { limitPrice: price }, source);
  const stop = stopOrderFor(instrumentId);
  const group = stop?.ocoGroup ?? `oco-${p.id}-${Date.now().toString(36)}`;
  if (stop && !stop.ocoGroup) modifyGroup(stop.id, group);
  return submitOrder({ instrument: p.instrument, side: p.qty > 0 ? 'sell' : 'buy', qty: Math.abs(p.qty), type: 'limit', limitPrice: price, role: 'target', ocoGroup: group, reduceOnly: true, coverFraction: 1, source, note: 'target' });
}

function modifyGroup(id: string, group: string): void {
  const cur = state.orders.find(o => o.id === id);
  if (!cur) return;
  replaceOrder({ ...cur, ocoGroup: group });
}

/** A stop and a target around the position, in ticks from the average entry —
    or from the MARKET when it has already moved past where the entry would
    put them, so a bracket asked for never fires the moment it is placed */
export function placeBracket(instrumentId: string, stopTicks?: number, targetTicks?: number, source: OrderSource = 'chart'): void {
  const p = positionFor(instrumentId);
  if (!p) return;
  const prefs = getPaperPrefs();
  const t = p.instrument.tickSize;
  const dir = p.qty > 0 ? 1 : -1;
  const s = stopTicks ?? prefs.bracket.stopTicks;
  const g = targetTicks ?? prefs.bracket.targetTicks;
  const mark = state.quotes[p.id]?.mark ?? p.avgPrice;
  const stopFrom = dir > 0 ? Math.min(p.avgPrice, mark) : Math.max(p.avgPrice, mark);
  const targetFrom = dir > 0 ? Math.max(p.avgPrice, mark) : Math.min(p.avgPrice, mark);
  setStop(instrumentId, stopFrom - dir * s * t, source);
  setTarget(instrumentId, targetFrom + dir * g * t, source);
}

/** The stop to the breakeven — the average entry with the fees on it */
export function stopToBreakeven(instrumentId: string, source: OrderSource = 'chart'): Order | null {
  const p = positionFor(instrumentId);
  if (!p) return null;
  const m = markPosition(p, state.quotes[p.id]);
  return setStop(instrumentId, m.breakeven, source);
}

/** Close everything and cancel everything — the orders go first, atomically */
export function flattenAll(source: OrderSource = 'hotkey', why = 'flatten'): void {
  cancelAll(undefined, source);
  for (const p of state.positions.filter(x => x.qty !== 0)) {
    submitOrder({ instrument: p.instrument, side: p.qty > 0 ? 'sell' : 'buy', qty: Math.abs(p.qty), type: 'market', role: 'exit', reduceOnly: true, source, note: why });
  }
}

/*
  THE SANDBOX'S TWO WRITES.

  Free Rein lets the reader set the balance and the leverage on it. Both are
  here, in the engine, because the account is the engine's — nothing outside
  this file may touch a balance (the directive's architecture). Both say what
  they did in the log.

  SETTING THE BALANCE IS NOT A PROFIT: the starting cash and the day's opening
  equity move with it, so the P&L figures keep their own count and a reader
  who tops up to $1,000,000 does not read it as a million made.
*/
export function setPaperCash(cash: number): void {
  const want = Math.max(0, Math.round(cash));
  const delta = want - state.account.cash;
  if (Math.abs(delta) < 0.005) return;
  state = {
    ...state,
    account: { ...state.account, cash: want, startingCash: state.account.startingCash + delta, dayStartEquity: state.account.dayStartEquity + delta },
    rev: state.rev + 1,
  };
  toast('info', 'Paper', `balance set to $${want.toLocaleString('en-US')}`);
  save();
  publish();
}

export function setBuyingPowerMultiple(x: number): void {
  const m = Math.min(50, Math.max(1, Number(x) || 1));
  state = { ...state, account: { ...state.account, bpMultiple: m }, rev: state.rev + 1 };
  toast('info', 'Paper', m === 1 ? 'buying power back to the account' : `buying power at ${m}× the account`);
  save();
  publish();
}

export function resetAccount(startingCash = STARTING_CASH): void {
  stopClock();
  state = { account: { ...freshAccount(), startingCash, cash: startingCash, dayStartEquity: startingCash }, orders: [], positions: [], trades: [], toasts: [], quotes: {}, rev: state.rev + 1 };
  tradeSeq = 0;
  toast('info', 'Paper', `account reset to $${startingCash.toLocaleString('en-US')}`);
  publish();
  ensureClock();
}

/* ---- execution ------------------------------------------------------------------------------- */

/** The clock's hand: the newest quotes, the day's turn, every live order tried */
export function onQuotes(quotes: Quote[]): void {
  const at = Date.now();
  const nextQuotes = { ...state.quotes };
  for (const q of quotes) nextQuotes[q.id] = q;
  state = { ...state, quotes: nextQuotes };
  /* The day turns at midnight: today's P&L measures from the equity the desk woke to */
  const dk = dayKey();
  if (state.account.dayKey !== dk) {
    const eq = readAccount().equity;
    state = { ...state, account: { ...state.account, dayKey: dk, dayStartEquity: eq } };
  }
  /* THE EXCURSION IS SAMPLED HERE, on every quote, because it can only be
     known while the lot is open: the best and the worst it has been worth.
     A trade inherits its share when it closes (settleFill). */
  let excursionMoved = false;
  const marked = state.positions.map(p => {
    if (p.qty === 0) return p;
    const q = nextQuotes[p.id];
    if (!q) return p;
    const un = (q.mark - p.avgPrice) * p.qty * p.instrument.multiplier;
    if (un > p.mfe + 1e-9 || un < p.mae - 1e-9) {
      excursionMoved = true;
      return { ...p, mfe: Math.max(p.mfe, un), mae: Math.min(p.mae, un) };
    }
    return p;
  });
  if (excursionMoved) state = { ...state, positions: marked };

  let touched = false;
  const touchedInstruments = new Set<string>();
  for (const cur of state.orders) {
    if (!isLive(cur)) continue;
    const q = nextQuotes[cur.instrumentId];
    if (!q) continue;
    if (expiredAt(cur.instrument, new Date(at))) {
      cancelOrder(cur.id, 'engine', 'expired');
      continue;
    }
    const o: Order = { ...cur, events: [...cur.events], fills: [...cur.fills] };
    const before = o.filledQty;
    tryFill(o, q, at);
    if (o.filledQty !== before || o.triggered !== cur.triggered) {
      replaceOrder(o);
      touched = true;
      touchedInstruments.add(o.instrumentId);
    }
  }
  for (const id of touchedInstruments) afterFills(id, at);
  /* expired positions settle at their mark */
  for (const p of state.positions) {
    if (p.qty !== 0 && expiredAt(p.instrument, new Date(at))) {
      const q = nextQuotes[p.id];
      if (q) {
        settleFill(p.instrument, p.qty > 0 ? 'sell' : 'buy', Math.abs(p.qty), q.mark, 0, 0, at, null, q);
        toast('info', tagWord(p.instrument), 'expired — settled at the mark');
        touched = true;
      }
    }
  }
  emit({ kind: 'quotes', at });
  if (touched || excursionMoved) publish();
  else {
    state = { ...state, rev: state.rev + 1 };
    listeners.forEach(fn => fn());
  }
}

/** Fill what this quote allows. Mutates `o` in place; the caller replaces it in the state. */
function tryFill(o: Order, q: Quote, at: number): void {
  if (!isLive(o) || remaining(o) <= 0) return;
  const inst = o.instrument;
  /* A reduce-only order can never do more than close what is there */
  if (o.reduceOnly) {
    const p = state.positions.find(x => x.id === inst.id);
    const room = p ? Math.abs(p.qty) : 0;
    const canClose = p && ((o.side === 'sell' && p.qty > 0) || (o.side === 'buy' && p.qty < 0)) ? room : 0;
    if (canClose === 0) {
      o.status = 'canceled';
      o.canceledAt = at;
      event(o, 'canceled', 'nothing left to close', at);
      return;
    }
    if (remaining(o) > canClose) {
      event(o, 'modified', `size ${o.qty} → ${o.filledQty + canClose} to match the position`, at);
      o.qty = o.filledQty + canClose;
    }
  }

  if (o.type === 'stop' && !o.triggered) {
    const hit = o.side === 'buy' ? q.last >= o.stopPrice! || q.ask >= o.stopPrice! : q.last <= o.stopPrice! || q.bid <= o.stopPrice!;
    if (!hit) return;
    o.triggered = true;
    event(o, 'triggered', `stop ${o.stopPrice} touched at ${q.last} — filling at the market`, at);
  }

  const fills: { qty: number; price: number }[] = [];
  const buy = o.side === 'buy';
  if (o.type === 'market' || o.triggered) {
    /* The touch, then the walk: one tick per block of displayed size. A fill
       model may move the touch (Free Rein's spread bypass fills at the mid)
       or cap the walk (its slippage bypass fills the whole size at one
       price) — the seam, never a branch in here. */
    let left = remaining(o);
    const touch = fillModel?.touch?.(o.side, q, inst) ?? (buy ? q.ask : q.bid);
    const size = Math.max(1, buy ? q.askSize : q.bidSize);
    const walk = fillModel?.maxWalk?.(inst) ?? MAX_WALK;
    let level = 0;
    while (left > 0) {
      const take = level >= walk ? left : Math.min(left, size);
      const price = roundToTick(inst, touch + (buy ? 1 : -1) * level * inst.tickSize);
      fills.push({ qty: take, price });
      left -= take;
      level++;
    }
  } else if (o.type === 'limit') {
    const limit = o.limitPrice!;
    const crosses = buy ? q.ask <= limit : q.bid >= limit;
    if (!crosses) return;
    const size = Math.max(1, buy ? q.askSize : q.bidSize);
    let take = Math.min(remaining(o), size);
    /* THE QUEUE HAS A SAY (core/paper/queue.ts): with realistic fills on, a
       limit does not fill because price touched it — it fills once enough
       has traded there to clear the size that was already in front. */
    if (fillModel?.limitFillQty) take = Math.max(0, Math.min(take, fillModel.limitFillQty(o, q, take, at)));
    if (take <= 0) return;
    fills.push({ qty: take, price: buy ? Math.min(limit, q.ask) : Math.max(limit, q.bid) });
  }
  if (fills.length === 0) return;

  for (const f of fills) {
    const fee = fillModel?.fee?.(inst, f.qty) ?? feeFor(inst, f.qty);
    const slip = buy ? f.price - q.mark : q.mark - f.price;
    const legs = inst.kind === 'spread' && q.legs ? legFills(inst, o.side, f.qty, f.price, q) : undefined;
    const fill: Fill = { id: newId('fill'), orderId: o.id, instrumentId: inst.id, at, side: o.side, qty: f.qty, price: f.price, slippage: Number(slip.toFixed(6)), fee, provenance: 'PAPER', legs, barTime: lastBarTime(inst) ?? undefined };
    o.fills.push(fill);
    o.avgFill = Number((((o.avgFill ?? 0) * o.filledQty + f.price * f.qty) / (o.filledQty + f.qty)).toFixed(6));
    o.filledQty += f.qty;
    event(o, 'fill', `${f.qty} @ ${f.price}${slip > 1e-9 ? ` (${slip.toFixed(2)} past the mark)` : ''}`, at);
    settleFill(inst, o.side, f.qty, f.price, fee, slip, at, fill, q, o.role);
    emit({ kind: 'fill', order: o, fill });
  }
  if (o.filledQty >= o.qty) {
    o.status = 'filled';
    o.filledAt = at;
    event(o, 'filled', `filled ${o.filledQty} @ avg ${o.avgFill}`, at);
    toast('fill', tagWord(inst), `${sideWord(o.side)} ${o.filledQty} filled @ ${o.avgFill}`);
  } else {
    o.status = 'partial';
    event(o, 'partial', `${o.filledQty} of ${o.qty} filled — the rest is working`, at);
    toast('fill', tagWord(inst), `${sideWord(o.side)} ${o.filledQty} of ${o.qty} filled @ ${o.avgFill}`);
  }
}

/** A spread's legs each fill at their own touch — the strategy's price is their sum */
function legFills(inst: Instrument & { kind: 'spread' }, side: Side, qty: number, net: number, q: Quote): FillLeg[] {
  const legs = q.legs ?? [];
  const out: FillLeg[] = [];
  let sum = 0;
  inst.legs.forEach((l, i) => {
    const lq = legs[i];
    const signed = (side === 'buy' ? 1 : -1) * l.ratio;
    const price = signed > 0 ? lq.ask : lq.bid;
    sum += l.ratio * price;
    out.push({ instrumentId: l.option.id, symbol: l.option.symbol, qty: signed * qty, price });
  });
  /* The walk past the touch lands on the widest leg so the legs still sum to the net */
  const diff = Number((net - sum).toFixed(4));
  if (Math.abs(diff) > 1e-9 && out.length) {
    const i = out.reduce((best, l, j) => (Math.abs(l.price) > Math.abs(out[best].price) ? j : best), 0);
    const l = inst.legs[i];
    out[i] = { ...out[i], price: Number((out[i].price + diff / l.ratio).toFixed(4)) };
  }
  return out;
}

/** The fill lands on the book: cash, the position, the journal */
function settleFill(inst: Instrument, side: Side, qty: number, price: number, fee: number, slip: number, at: number, fill: Fill | null, q: Quote, byRole: OrderRole = 'exit'): void {
  const mult = inst.multiplier;
  const signed = side === 'buy' ? qty : -qty;
  let cash = state.account.cash - fee;
  let feesTotal = state.account.feesTotal + fee;
  let realizedTotal = state.account.realizedTotal;
  /* Stock and option premium move cash on the fill; a future's cash moves only when P&L is realised */
  if (inst.kind !== 'future') cash -= price * signed * mult;

  const positions = state.positions.map(p => ({ ...p }));
  let p = positions.find(x => x.id === inst.id);
  const trades: Trade[] = [];
  const legs = fill?.legs;
  let opened: Position | null = null;

  const openLot = (lotQty: number, lotPrice: number, lotFee: number, lotSlip: number) => {
    const fresh: Position = {
      id: inst.id,
      instrument: inst,
      qty: lotQty,
      avgPrice: lotPrice,
      realized: p?.realized ?? 0,
      entryFees: lotFee,
      entrySlip: lotSlip,
      openedAt: at,
      updatedAt: at,
      mfe: 0,
      mae: 0,
      /* a leg's sign already carries the side — scale it by the lot's size, never its sign */
      legs: legs ? legs.map(l => ({ instrumentId: l.instrumentId, symbol: l.symbol, qty: (l.qty / qty) * Math.abs(lotQty), avgPrice: l.price })) : undefined,
    };
    const i = positions.findIndex(x => x.id === inst.id);
    if (i >= 0) positions[i] = fresh;
    else positions.push(fresh);
    p = fresh;
    opened = fresh;
  };

  if (!p || p.qty === 0) {
    openLot(signed, price, fee, Math.max(0, slip) * qty);
  } else if (Math.sign(p.qty) === Math.sign(signed)) {
    const total = Math.abs(p.qty) + qty;
    p.avgPrice = Number(((p.avgPrice * Math.abs(p.qty) + price * qty) / total).toFixed(6));
    p.qty += signed;
    p.entryFees += fee;
    p.entrySlip += Math.max(0, slip) * qty;
    p.updatedAt = at;
    if (p.legs && legs) {
      p.legs = p.legs.map(pl => {
        const l = legs.find(x => x.instrumentId === pl.instrumentId);
        if (!l) return pl;
        const n = Math.abs(pl.qty) + Math.abs(l.qty);
        return { ...pl, qty: pl.qty + l.qty, avgPrice: Number(((pl.avgPrice * Math.abs(pl.qty) + l.price * Math.abs(l.qty)) / n).toFixed(6)) };
      });
    }
  } else {
    const closeQty = Math.min(Math.abs(p.qty), qty);
    const dir = p.qty > 0 ? 1 : -1;
    const gross = (price - p.avgPrice) * closeQty * mult * dir;
    const share = closeQty / Math.abs(p.qty);
    const entryFeeShare = p.entryFees * share;
    const entrySlipShare = p.entrySlip * share;
    const exitFee = fee * (closeQty / qty);
    const fees = entryFeeShare + exitFee;
    const basis = inst.kind === 'future' ? inst.initialMargin * closeQty : Math.abs(p.avgPrice) * closeQty * mult;
    const realized = gross - fees;
    tradeSeq += 1;
    trades.push({
      id: `PT-${String(tradeSeq).padStart(5, '0')}`,
      openedAt: p.openedAt,
      closedAt: at,
      instrument: inst,
      instrumentId: inst.id,
      kind: inst.kind,
      side: dir > 0 ? 'long' : 'short',
      qty: closeQty,
      entryAvg: p.avgPrice,
      exitAvg: price,
      fees: Number(fees.toFixed(2)),
      slippage: Number(((entrySlipShare + Math.max(0, slip) * closeQty) * mult).toFixed(2)),
      realized: Number(realized.toFixed(2)),
      returnPct: basis > 0 ? Number(((gross / basis) * 100).toFixed(2)) : 0,
      holdMs: at - p.openedAt,
      /* the heat and the high water this lot saw, shared out with the size closed */
      mfe: Number((p.mfe * share).toFixed(2)),
      mae: Number((p.mae * share).toFixed(2)),
      legs: p.legs && legs ? p.legs.map(pl => ({ symbol: pl.symbol, qty: (pl.qty / Math.abs(p!.qty)) * closeQty, entry: pl.avgPrice, exit: legs.find(x => x.instrumentId === pl.instrumentId)?.price ?? pl.avgPrice })) : undefined,
    });
    if (inst.kind === 'future') cash += gross;
    realizedTotal += gross;
    p.realized += gross;
    p.qty += signed;
    p.entryFees -= entryFeeShare;
    p.entrySlip -= entrySlipShare;
    p.mfe = Number((p.mfe * (1 - share)).toFixed(2));
    p.mae = Number((p.mae * (1 - share)).toFixed(2));
    p.updatedAt = at;
    if (p.legs) p.legs = p.legs.map(pl => ({ ...pl, qty: pl.qty * (1 - share) }));
    const leftover = qty - closeQty;
    if (p.qty === 0 && leftover > 0) {
      /* the reverse: what was not needed to close opens the other way */
      const remainingFee = fee - exitFee;
      openLot(leftover * (signed > 0 ? 1 : -1), price, remainingFee, Math.max(0, slip) * leftover);
    }
  }

  state = {
    ...state,
    account: { ...state.account, cash: Number(cash.toFixed(2)), feesTotal: Number(feesTotal.toFixed(2)), realizedTotal: Number(realizedTotal.toFixed(2)) },
    positions: positions.filter(x => x.qty !== 0),
    trades: trades.length ? [...state.trades, ...trades] : state.trades,
    quotes: { ...state.quotes, [inst.id]: q },
  };
  if (opened) emit({ kind: 'positionOpened', position: opened });
  for (const t of trades) emit({ kind: 'positionClosed', trade: t, byRole });
}

/** Housekeeping once fills have landed on an instrument: brackets attached, protective sizes synced, OCO siblings cleared */
function afterFills(instrumentId: string, at: number): void {
  const pos = state.positions.find(p => p.id === instrumentId);
  const posQty = pos?.qty ?? 0;

  /* Brackets: an entry with a bracket that has filled wants its stop and target */
  for (const o of state.orders) {
    if (o.instrumentId !== instrumentId || !o.bracket || o.filledQty === 0 || o.role !== 'entry') continue;
    if (posQty === 0) continue;
    const hasStop = state.orders.some(x => x.parentId === o.id && x.role === 'stop' && (isLive(x) || x.status === 'filled'));
    const hasTarget = state.orders.some(x => x.parentId === o.id && x.role === 'target' && (isLive(x) || x.status === 'filled'));
    if (hasStop && hasTarget) continue;
    const inst = o.instrument;
    const dir = posQty > 0 ? 1 : -1;
    const b = o.bracket;
    const stopPrice = 'stopPrice' in b ? b.stopPrice : (o.avgFill ?? 0) - dir * b.stopTicks * inst.tickSize;
    const targetPrice = 'targetPrice' in b ? b.targetPrice : (o.avgFill ?? 0) + dir * b.targetTicks * inst.tickSize;
    const group = `oco-${o.id}`;
    const exitSide: Side = posQty > 0 ? 'sell' : 'buy';
    if (!hasStop && stopPrice > 0) submitOrder({ instrument: inst, side: exitSide, qty: Math.abs(posQty), type: 'stop', stopPrice, role: 'stop', ocoGroup: group, parentId: o.id, reduceOnly: true, coverFraction: 1, source: 'engine', note: 'bracket stop' });
    if (!hasTarget && targetPrice > 0) submitOrder({ instrument: inst, side: exitSide, qty: Math.abs(posQty), type: 'limit', limitPrice: targetPrice, role: 'target', ocoGroup: group, parentId: o.id, reduceOnly: true, coverFraction: 1, source: 'engine', note: 'bracket target' });
  }

  /* PROTECTIVE ORDERS FOLLOW THE POSITION, PROPORTIONALLY, AND LEAVE WITH IT.
     Scale out of half and a full-size stop becomes half; a stop written for
     half the position becomes a quarter. The share is the order's own
     (coverFraction) — see the field's note. A position that has gone to zero
     takes every child with it, atomically, so no orphan leg is ever left
     working against nothing. */
  const current = state.positions.find(p => p.id === instrumentId);
  const q = current?.qty ?? 0;
  for (const cur of state.orders) {
    if (cur.instrumentId !== instrumentId || !isLive(cur) || (cur.role !== 'stop' && cur.role !== 'target')) continue;
    if (q === 0) {
      cancelOrder(cur.id, 'engine', 'the position closed — no orphan legs');
      continue;
    }
    const want = Math.max(1, Math.round(Math.abs(q) * (cur.coverFraction ?? 1)));
    if (cur.qty - cur.filledQty !== want) {
      const o: Order = { ...cur, events: [...cur.events] };
      event(o, 'modified', `size ${o.qty - o.filledQty} → ${want}, ${Math.round((cur.coverFraction ?? 1) * 100)}% of the position`, at);
      o.qty = o.filledQty + want;
      replaceOrder(o);
    }
  }

  /* OCO, STRICTLY: the moment one side of a pair takes a fill — the whole
     order or a part of it — the other side is cancelled. A target that fills
     kills the stop; a stop that triggers and fills kills the target. Keyed on
     a fill in THIS pass, not on the order being complete, so a partial fill
     on one leg cannot leave the other leg live against a position that is
     already smaller than it. */
  const groups = new Set<string>();
  for (const o of state.orders) {
    if (o.instrumentId !== instrumentId || !o.ocoGroup) continue;
    if (o.fills.some(f => f.at === at)) groups.add(o.ocoGroup);
  }
  for (const g of groups) {
    const filledSide = state.orders.find(o => o.ocoGroup === g && o.fills.some(f => f.at === at));
    for (const o of state.orders) {
      if (o.ocoGroup !== g || !isLive(o) || o.id === filledSide?.id) continue;
      cancelOrder(o.id, 'engine', `the ${filledSide?.role === 'target' ? 'target' : 'stop'} filled — its OCO sibling is cancelled`);
    }
  }
}

/* ---- the activity feed --------------------------------------------------------------------- */

export interface ActivityRow {
  at: number;
  orderId: string;
  symbol: string;
  kind: OrderEvent['kind'];
  note: string;
}

/** Every order event on the desk, newest first */
export function activityFeed(s: PaperState = state, limit = 300): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const o of s.orders) for (const e of o.events) rows.push({ at: e.at, orderId: o.id, symbol: tagWord(o.instrument), kind: e.kind, note: e.note });
  rows.sort((a, b) => b.at - a.at);
  return rows.slice(0, limit);
}
