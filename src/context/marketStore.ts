/*
==================================================
  SLAYER TERMINAL - THE MARKET STORE (context/marketStore.ts)

  THE SPEED STORE (2026-10-10, the ideas report's item 14,
  the audit's PP-5 and X1.5). One context used to carry
  the whole feed — the snapshot, the tape, the ledger,
  the name — so every page and panel that read any of it
  rendered again on every tick, whatever it showed. The
  feed lives here now, outside React, and a component
  subscribes to the KEY it reads: a name's quote, the
  active snapshot, the tape, the name, the clock. A
  component whose key did not move does not render.

  THE TICK IS STAGED, THEN PUBLISHED ONCE A FRAME. The
  simulator ticks on its timer; what it produced waits
  in `next` until the next animation frame, when it is
  published and the subscribers are told, so a tick and
  anything else that lands in the same frame are one
  render. A hidden tab has no frames, so nothing renders
  behind it — what has to act on every tick wherever the
  reader is (the alerts, a paper account's orders) hears
  the tick itself (onMarketTick, data/feedTicks.ts).

  TWO WAYS TO READ. A small value (a price, the name, a
  counter) is read through useSyncExternalStore and
  renders at once. A heavy one (the snapshot, the tape)
  arrives as a TRANSITION, as the tick did before (Noah,
  2026-08-30: "some sort of buffer... jolts the entire
  website"): useSyncExternalStore always renders
  synchronously, and the minute-turn redraw of a
  250-row table was a 182 ms task that way.
==================================================
*/

import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Simulator from '../core/simulator';
import Ledger from '../core/ledger';
import { readDeskPrefs } from '../data/deskPrefs';
import { enrichPrint } from '../data/tape';
import { announceFeedTick } from '../data/feedTicks';
import { nyClock } from '../core/nyTime';
import { h01 } from '../core/rng';
import type { FlowPrint } from '../types/trace';
import type { ExecuteResult, LedgerStats, MarketSnapshot, TapeOrder, TickerSymbol, TradeRecord } from '../types/market';

/* THE LIVE TAPE, kept for the desk (ported 2026-08-27).

   Prints arrive a handful per tick and several surfaces want the same
   unfiltered stream — the chart's event markers read the biggest of them,
   the flow overlays bucket them to bars. Holding it here means one tape,
   stamped once, rather than every pane growing its own.

   Aged FIRST, then capped: age alone lets a busy session run unbounded, and
   the count alone keeps yesterday's prints alive on a tab left open. */
export type StampedPrint = FlowPrint & { at: number };
const TAPE_CAP = 5000;
const TAPE_MAX_AGE_MS = 4 * 60 * 60 * 1000;
/** How often the simulator ticks */
export const TICK_MS = 1500;

export interface LedgerState {
  activeTrades: TradeRecord[];
  closedTrades: TradeRecord[];
  stats: LedgerStats;
}

/** A name's price and its day's change, as the feed last published them */
export interface Quote {
  spot: number;
  changePct: number;
}

/** The link groups (the ideas report's item 10): a letter a panel joins to follow and set that group's name */
export const LINK_GROUPS = ['A', 'B', 'C', 'D'] as const;
export type LinkGroup = (typeof LINK_GROUPS)[number];
export const isLinkGroup = (v: unknown): v is LinkGroup => typeof v === 'string' && (LINK_GROUPS as readonly string[]).includes(v);

export interface MarketState {
  /** The terminal's name — the default group, the one every unlinked panel follows */
  active: TickerSymbol;
  /** The active name's latest tick */
  snapshot: MarketSnapshot | null;
  /** Every registered name's price, published with the tick */
  quotes: Record<string, Quote>;
  /** The session's option prints, newest first — aged and capped */
  tape: StampedPrint[];
  ledger: LedgerState;
  /** Counts the published ticks — a key for whatever rebuilds on the tick */
  seq: number;
  /** Each link group's name; null until a panel joins it */
  groups: Record<LinkGroup, string | null>;
}

/* ---- the name, remembered ------------------------------------------------------------------------------------ */

/* THE NAME COMES BACK ON A RELOAD, IN EVERY ROOM (2026-10-10; Pinpoint alone kept its own since the audit's PP-11):
   the terminal keeps the last name the reader chose on this machine and opens on it — unless Settings › The desk ›
   Opens on names one, which always wins. Pinpoint's own key is read once, so a name kept there carries over. */
const NAME_KEY = 'slayer_name';
const OLD_PINPOINT_KEY = 'slayer_pinpoint_name';
const GROUPS_KEY = 'slayer_link_groups';
const NAME_SHAPE = /^[A-Z][A-Z0-9.-]{0,9}$/;

const readKeptName = (): string | null => {
  try {
    const kept = localStorage.getItem(NAME_KEY) ?? localStorage.getItem(OLD_PINPOINT_KEY);
    const up = kept?.trim().toUpperCase() ?? '';
    return NAME_SHAPE.test(up) ? up : null;
  } catch {
    return null;
  }
};
const keepName = (sym: string) => {
  try {
    localStorage.setItem(NAME_KEY, sym);
  } catch {
    /* storage off — the name lives for the session */
  }
};
const readGroups = (): Record<LinkGroup, string | null> => {
  const out = { A: null, B: null, C: null, D: null } as Record<LinkGroup, string | null>;
  try {
    const raw = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '{}') as Record<string, unknown>;
    for (const g of LINK_GROUPS) {
      const v = typeof raw[g] === 'string' ? (raw[g] as string).toUpperCase() : '';
      if (NAME_SHAPE.test(v)) out[g] = v;
    }
  } catch {
    /* a broken blob is no groups */
  }
  return out;
};

/** The name the terminal opens on: Settings' pick, else the last one chosen, else where the simulator starts */
const openingName = (): TickerSymbol => {
  const pick = readDeskPrefs().opensOn.ticker;
  const name = pick ?? readKeptName();
  /* lazy: registered and seeded by the simulator's pump in slices, never one long walk inside the app's first task */
  return name ? Simulator.setActiveTicker(name, { lazy: true }) : Simulator.getActiveTicker();
};

/* ---- the state ----------------------------------------------------------------------------------------------- */

const EMPTY_LEDGER: LedgerState = {
  activeTrades: [],
  closedTrades: [],
  stats: { winRate: 0, profitFactor: 0, avgAccuracy: 0, totalPnL: 0, count: 0 },
};

let state: MarketState = {
  active: openingName(),
  snapshot: null,
  quotes: {},
  tape: [],
  ledger: EMPTY_LEDGER,
  seq: 0,
  groups: readGroups(),
};
/** What the next frame publishes — the tick lands here first */
let next: MarketState = state;

const listeners = new Set<() => void>();
let frame = 0;
/** True while a publish a person is waiting on (a new name) is being told — those render at once, not as a transition */
let urgent = false;

/* The heavy readers' updates of one publish, delivered together — ONE transition a publish, not one a reader */
let queued: (() => void)[] = [];
function tell(): void {
  state = next;
  for (const fn of Array.from(listeners)) fn();
  if (queued.length === 0) return;
  const run = queued;
  queued = [];
  if (urgent) run.forEach(f => f());
  else startTransition(() => run.forEach(f => f()));
}
function flushFrame(): void {
  frame = 0;
  tell();
}
/** Publish what is staged on the next animation frame — one render a frame, however many changes landed in it */
function schedule(): void {
  if (frame || typeof window === 'undefined') return;
  frame = window.requestAnimationFrame(flushFrame);
}
/** Publish what is staged now, as an urgent render (a person picked something) */
function flushNow(): void {
  if (frame) {
    window.cancelAnimationFrame(frame);
    frame = 0;
  }
  urgent = true;
  try {
    tell();
  } finally {
    urgent = false;
  }
}
function stage(patch: Partial<MarketState>): void {
  next = { ...next, ...patch };
}

export const marketStore = {
  /** The published state — what every subscriber has been told */
  get: (): MarketState => state,
  /** The newest state, a tick not yet published included — for what acts on the tick itself (onMarketTick) */
  latest: (): MarketState => next,
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/* ---- the tick ------------------------------------------------------------------------------------------------ */

const tickListeners = new Set<(snap: MarketSnapshot) => void>();
/** Hear every tick as it lands, before any frame — runs while the tab is hidden too. Returns the way to stop. */
export function onMarketTick(fn: (snap: MarketSnapshot) => void): () => void {
  tickListeners.add(fn);
  return () => {
    tickListeners.delete(fn);
  };
}

/* The print id counter never resets: a duplicate id would collapse two prints into one row */
let printId = 0;

const stampTape = (orders: TapeOrder[], at: number): StampedPrint[] =>
  orders.map(o => ({ ...enrichPrint(o, ++printId), at }));

const absorbTape = (fresh: StampedPrint[], now: number) => {
  if (fresh.length === 0) return;
  const merged = [...fresh, ...next.tape];
  const cutoff = now - TAPE_MAX_AGE_MS;
  const aged =
    merged.length > TAPE_CAP || (merged[merged.length - 1]?.at ?? now) < cutoff ? merged.filter(p => p.at >= cutoff) : merged;
  stage({ tape: aged.length > TAPE_CAP ? aged.slice(0, TAPE_CAP) : aged });
};

/* THE TAPE OPENS FULL (the audit's TR-30: Live Tape opened on 8–15 prints and ~120 px of empty table). The first tick
   lays down the half-minute before it — thirty ticks' worth, a few prints a name a tick as the feed prints them, each
   stamped at its own moment — so the tape's first screen is a screen of prints. Drawn from its own hashed stream, never
   Math.random: the landing's session and films seed Math.random and replay it, and the backfill must not move them. */
const BACKFILL_TICKS = 32;
function backfill(now: number): StampedPrint[] {
  const names = Array.from(new Set([state.active, ...Simulator.WATCHLIST]));
  const out: StampedPrint[] = [];
  for (let k = BACKFILL_TICKS; k >= 1; k--) {
    const at = now - k * TICK_MS;
    const orders: TapeOrder[] = [];
    for (const sym of names) {
      const cfg = Simulator.TICKERS[sym];
      if (!cfg) continue;
      const r = (tag: string) => h01(`tape-backfill-${at}-${sym}-${tag}`);
      const count = sym === state.active ? Math.floor(r('n') * 2) + 1 : r('on') > 0.45 ? Math.floor(r('n') * 2) + 1 : 0;
      for (let i = 0; i < count; i++) {
        const q = (tag: string) => r(`${i}-${tag}`);
        const offset = (Math.floor(q('k') * 7) - 3) * cfg.step;
        const strike = Math.round(cfg.currentPrice / cfg.step) * cfg.step + offset;
        orders.push({
          time: '',
          ticker: sym,
          strike: strike.toFixed(2),
          type: q('cp') > 0.5 ? 'C' : 'P',
          size: Math.floor(q('sz') * 250) + 10,
          orderType: q('ot') > 0.65 ? 'SWEEP' : 'BLOCK',
          side: q('sd') > 0.48 ? 'ASK' : 'BID',
        });
      }
    }
    const time = nyClock(at, { seconds: true });
    out.unshift(...stampTape(orders, at).map(p => ({ ...p, time })));
  }
  return out;
}

const readLedger = (): LedgerState => ({
  activeTrades: [...Ledger.getActiveTrades()],
  closedTrades: [...Ledger.getClosedTrades()],
  stats: Ledger.getStats(),
});

const readQuotes = (): Record<string, Quote> => {
  const out: Record<string, Quote> = {};
  for (const sym of Object.keys(Simulator.TICKERS)) {
    if (!Simulator.isSeeded(sym)) continue;
    const prev = next.quotes[sym];
    const spot = Simulator.TICKERS[sym].currentPrice;
    /* the same object while the price stands still, so a reader of an idle name never renders */
    out[sym] = prev && prev.spot === spot ? prev : { spot, changePct: Simulator.dayChangePct(sym) };
  }
  return out;
};

let ready = false;
let opened = false;

/** One tick of the simulator, staged for the next frame */
function processTick(publishNow = false): void {
  Simulator.tick(data => {
    ready = true;
    const now = Date.now();
    // 1. Evaluate open trades — a side effect on the ledger, not a render
    Ledger.updateOpenTrades(Simulator.getActiveTicker(), data.spot);
    if (!opened) {
      opened = true;
      absorbTape(backfill(now), now);
    }
    absorbTape(stampTape(data.tape, now), now);
    stage({
      snapshot: data,
      quotes: readQuotes(),
      seq: next.seq + 1,
      /* the ledger is read only while it holds a trade — an empty one is the same empty one every tick */
      ledger: Ledger.getActiveTrades().length > 0 ? readLedger() : next.ledger,
    });
    // 2. What acts on every tick wherever the reader is, hidden tab or not
    for (const fn of Array.from(tickListeners)) {
      try {
        fn(data);
      } catch (err) {
        console.error(err);
      }
    }
    announceFeedTick();
  });
  if (publishNow) flushNow();
  else schedule();
}

/* ---- the feed's life ----------------------------------------------------------------------------------------- */

let interval: ReturnType<typeof setInterval> | null = null;
let warm: number | null = null;
let starts = 0;

/** Start the feed (the provider's mount). Counted, so a second provider or StrictMode's double mount is harmless. */
export function startFeed(): () => void {
  starts++;
  if (starts === 1) {
    Ledger.loadFromStorage();
    stage({ ledger: readLedger() });
    processTick();
    interval = setInterval(() => processTick(), TICK_MS);
    /* The feed's first tick: the active name seeds in slices at boot (the simulator's pump), and the tick emits
       nothing until it is whole — so the feed asks again every 80 ms until the first snapshot lands, instead of
       waiting out a whole interval with the desk on "Awaiting feed". */
    const again = () => {
      warm = null;
      if (ready) return;
      processTick();
      if (!ready) warm = window.setTimeout(again, 80);
    };
    if (!ready) warm = window.setTimeout(again, 80);
  }
  return () => {
    starts--;
    if (starts > 0) return;
    if (interval) clearInterval(interval);
    interval = null;
    if (warm !== null) window.clearTimeout(warm);
    warm = null;
  };
}

/** Move the terminal to a name — urgent: the reader is waiting on it */
export function changeTicker(ticker: string): void {
  const sym = Simulator.setActiveTicker(ticker);
  keepName(sym);
  stage({ active: sym });
  // An instant tick for a snappy switch, published now
  processTick(true);
  if (!ready) flushNow();
}

export function executeTrade(): ExecuteResult {
  const plan = next.snapshot?.plan;
  if (!plan) return { success: false, message: 'No active plan' };
  const res = Ledger.executePlan(plan);
  stage({ ledger: readLedger() });
  flushNow();
  return res;
}

export function clearLedger(): void {
  Ledger.clearHistory();
  stage({ ledger: readLedger() });
  flushNow();
}

/** Set a link group's name — every panel in the group follows */
export function setLinkGroup(group: LinkGroup, ticker: string): void {
  const sym = ticker.trim().toUpperCase();
  if (!NAME_SHAPE.test(sym) || next.groups[group] === sym) return;
  const groups = { ...next.groups, [group]: sym };
  stage({ groups });
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch {
    /* storage off — the groups live for the session */
  }
  flushNow();
}

/* ---- the hooks ----------------------------------------------------------------------------------------------- */

/**
 * A small value off the store, rendered at once when it moves (useSyncExternalStore). The selector runs on every
 * publish; the component renders only when what it returns is no longer `isEqual` to what it showed.
 */
export function useMarketSelect<T>(select: (s: MarketState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const last = useRef<{ v: T } | null>(null);
  const read = () => {
    const v = select(state);
    if (last.current && isEqual(last.current.v, v)) return last.current.v;
    last.current = { v };
    return v;
  };
  return useSyncExternalStore(marketStore.subscribe, read, read);
}

/**
 * A heavy value off the store, delivered as a transition (see the head of the file): React may render it in slices
 * between frames. A name change a person made is urgent and lands at once. The selector must not close over props —
 * it is read again only when the store publishes.
 */
export function useMarketBackground<T>(select: (s: MarketState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const [value, setValue] = useState(() => select(state));
  const shown = useRef(value);
  const selectRef = useRef(select);
  selectRef.current = select;
  const equalRef = useRef(isEqual);
  equalRef.current = isEqual;
  useEffect(() => {
    const check = () => {
      const v = selectRef.current(state);
      if (equalRef.current(shown.current, v)) return;
      shown.current = v;
      queued.push(() => setValue(() => v));
    };
    /* anything published between the first render and this subscription */
    const v = selectRef.current(state);
    if (!equalRef.current(shown.current, v)) {
      shown.current = v;
      setValue(() => v);
    }
    return marketStore.subscribe(check);
  }, []);
  return value;
}

const sameQuote = (a: Quote | null, b: Quote | null) => a === b || (!!a && !!b && a.spot === b.spot && a.changePct === b.changePct);

/** The terminal's name */
export const useActiveTicker = (): TickerSymbol => useMarketSelect(s => s.active);
/** The active name's latest tick, as a transition */
export const useSnapshot = (): MarketSnapshot | null => useMarketBackground(s => s.snapshot);
/** True once the feed has published its first tick */
export const useFeedReady = (): boolean => useMarketSelect(s => s.snapshot !== null);
/** The session's tape, as a transition */
export const useFlowTape = (): StampedPrint[] => useMarketBackground(s => s.tape);
/** A counter that moves once a published tick — the key for what rebuilds on the tick, as a transition */
export const useTickSeq = (): number => useMarketBackground(s => s.seq);
/** The open trades and the record */
export const useLedger = (): LedgerState => useMarketBackground(s => s.ledger);

/** A name's price and day change — the active name's when `ticker` is left out, nothing for null or '' — rendering
    only when it moves */
export function useQuote(ticker?: string | null): Quote | null {
  return useMarketSelect(s => {
    if (ticker === null || ticker === '') return null;
    const sym = ticker ? ticker.toUpperCase() : s.active;
    return s.quotes[sym] ?? (s.snapshot && s.snapshot.ticker === sym ? { spot: s.snapshot.spot, changePct: s.snapshot.changePercent } : null);
  }, sameQuote);
}
/** A name's price alone */
export const useSpot = (ticker?: string | null): number | null => useQuote(ticker)?.spot ?? null;

/**
 * The active snapshot on a slower cadence — the scan tier of Pulse and the Compass board: a new one only when `ms`
 * have passed since the last, or the name changed (a ticker switch refreshes at once).
 */
export function useScanSnapshot(ms: number): MarketSnapshot | null {
  const taken = useRef(Date.now());
  return useMarketBackground(
    s => s.snapshot,
    (a, b) => {
      if (a === b) return true;
      const now = Date.now();
      if (a && b && a.ticker === b.ticker && now - taken.current < ms) return true;
      taken.current = now;
      return false;
    }
  );
}

const sameGroups = (a: Record<LinkGroup, string | null>, b: Record<LinkGroup, string | null>) => LINK_GROUPS.every(g => a[g] === b[g]);
/** Every link group's name */
export const useLinkGroups = (): Record<LinkGroup, string | null> => useMarketSelect(s => s.groups, sameGroups);

/** A link group's name (null until a panel joins it) */
export const useLinkGroupName = (group: LinkGroup | null | undefined): string | null =>
  useMarketSelect(s => (group ? s.groups[group] : null));

/**
 * The name a panel in `group` reads, and the way it picks one: no group is the terminal's own name (the default —
 * nothing changes for a reader who never picks a letter); a letter is that group's. A group nobody has named yet
 * reads the terminal's name until one of its panels picks.
 */
export function useLinkedName(group: LinkGroup | null | undefined): [string, (ticker: string) => void] {
  const active = useActiveTicker();
  const named = useLinkGroupName(group);
  const set = group ? (t: string) => setLinkGroup(group, t) : changeTicker;
  return [group ? (named ?? active) : active, set];
}

/* ---- the clock ----------------------------------------------------------------------------------------------- */

/* ONE WALL CLOCK FOR THE TERMINAL: every surface that redraws on the second (the rail's clock, the desk's heat) used
   to run its own timer, a render each on its own beat. One timer per period, the readers told together. */
const clocks = new Map<number, { now: number; id: ReturnType<typeof setInterval> | null; fns: Set<() => void>; subscribe: (fn: () => void) => () => void; read: () => number }>();
function clockOf(ms: number) {
  let c = clocks.get(ms);
  if (!c) {
    /* ONE subscribe a period, the same function every render (2026-10-10): an inline one was a new function each render,
       so React unsubscribed and subscribed again on every render — and a period with one reader dropped to none in
       between, stopped its timer, and restarted it with a new `now`, which rendered again: a loop the first time a
       ten-second clock had a single reader (the watchlist drawer) */
    const clock = { now: Date.now(), id: null as ReturnType<typeof setInterval> | null, fns: new Set<() => void>() };
    const subscribe = (fn: () => void) => {
      clock.fns.add(fn);
      if (!clock.id) {
        clock.now = Date.now();
        clock.id = setInterval(() => {
          clock.now = Date.now();
          for (const f of Array.from(clock.fns)) f();
        }, ms);
      }
      return () => {
        clock.fns.delete(fn);
        if (clock.fns.size === 0 && clock.id) {
          clearInterval(clock.id);
          clock.id = null;
        }
      };
    };
    c = Object.assign(clock, { subscribe, read: () => clock.now });
    clocks.set(ms, c);
  }
  return c;
}

/** The wall clock, moved every `ms` (one shared timer per period) */
export function useNow(ms = 1000): number {
  const c = clockOf(ms);
  return useSyncExternalStore(c.subscribe, c.read, c.read);
}
