/*
==================================================
  SLAYER TERMINAL - PAPER · THE ACCOUNTS AND THEIR RUNNER
  (data/paper/store.ts)

  The reader's paper accounts, kept on this machine
  (`slayer_paper_v1`) until accounts move to the
  server — the review store's pattern: a module store
  with a subscription, every change through the
  engine's pure functions, this file only holding,
  saving, and RUNNING them:

    THE RUNNER    on every tick of the feed (data/
                  feedTicks.ts), wherever the reader
                  is, every open account's working
                  orders meet the market (engine.ts
                  `tick`) — and what happened is said
                  (the fill alerts, `usePaperToasts`)
    ONE TAB       the accounts are HELD by one tab (a
                  lease renewed every few seconds): a
                  second tab reads them and takes
                  nothing until it takes them over
                  (docs/paper-rules.md, "One tab at a
                  time") — two tabs would be two
                  simulated markets writing one book
    THE PAGE'S    on the simulated feed, a page that
    EDGES         closes flattens what is open at the
                  market it saw, and the next load
                  closes whatever a page could not, at
                  the last price THAT page wrote down
                  (engine.ts `closeStale`)
    THE JOURNAL'S the reader's words and tags on a
    OWN KEY       paper trade (`slayer_paper_journal_
                  v1`) — apart from the book, so words
                  written in a tab that does not hold
                  the account are never lost under the
                  holder's next save

  NEVER IN THE LANDING'S WINDOW: a page EMBEDDED in a
  frame (embed.ts) reads nothing, runs nothing and
  holds nothing — a tour must not trade the visitor's
  account. THE PHOTOGRAPHER'S WINDOW (embed.ts PHOTO)
  is the one exception, and only half of one: it still
  reads nothing and writes nothing, but it may START an
  account and run it in memory, so the desk can be
  pictured in use (2026-09-26).
==================================================
*/

import { useSyncExternalStore } from 'react';
import { EMBEDDED, PHOTO } from '../../embed';
import { chime } from '../../core/sound';
import { onFeedTick } from '../feedTicks';
import { contractKey, type ContractId, type Quote } from '../review/quotes';
import type { DayNote, JournalEntry } from '../review/journal';
import { LIFE, SIM_FEED, barNowOf, candlesOf, futCandles, futNow, isPaperFuture, optionQuote, paperFut, spotForBidNow } from './feed';
import { dayWords, nyAt } from './clock';
import {
  afterHand,
  closeStale,
  endEvaluation,
  flattenAll,
  flattenByHand,
  futAmend,
  futAttach,
  futCancel,
  futClose,
  futPlace,
  futSetBreakeven,
  futSetTrail,
  newAccount,
  optAmend,
  optAttach,
  optCancel,
  optClose,
  optPlace,
  optRebase,
  optSetBreakeven,
  optSetTrail,
  tick,
  type EvalPlan,
  type FutDraft,
  type OptDraft,
  type PaperAccount,
  type PaperEvent,
  type PaperMarket,
} from './engine';

const KEY = 'slayer_paper_v1';
const JOURNAL_KEY = 'slayer_paper_journal_v1';
const LEASE_KEY = 'slayer_paper_lease_v1';
/** A lease is good for this long, and renewed this often */
const LEASE_MS = 8_000;
const RENEW_MS = 2_500;
/** A tick that only moved what is open is written a moment later; a fill, at once */
const SAVE_SOON_MS = 2_000;

/* ================================================================== */
/*  THE LIVE MARKET                                                    */
/* ================================================================== */

/** The market as the feed has it now — what every engine call on this machine is handed. A contract asked for twice in one
    call is priced once. */
export function liveMarket(now = Date.now()): PaperMarket {
  const quotes = new Map<string, Quote>();
  return {
    now,
    life: LIFE,
    optQuote: (c: ContractId) => {
      const k = contractKey(c);
      let q = quotes.get(k);
      if (!q) quotes.set(k, (q = optionQuote(c, now)));
      return q;
    },
    optQuoteAt: (c: ContractId, spot: number) => optionQuote(c, now, spot),
    fut: (symbol: string) => futNow(symbol),
    bar: (ticker: string) => barNowOf(isPaperFuture(ticker) ? paperFut(ticker).fund : ticker),
    candles: (ticker: string) => (isPaperFuture(ticker) ? futCandles(ticker) : candlesOf(ticker)),
    /* THE SIMULATED FEED NEVER SHUTS (the rules page, "The prices") — the real feed's hours come in here */
    open: () => true,
  };
}
/** Where the name would have to stand now for a contract to bid this — the chart's lines, and a pin's level */
export const spotForBid = (c: ContractId, bid: number): number | null => spotForBidNow(c, Date.now(), bid);

/* ================================================================== */
/*  THE ACCOUNTS                                                       */
/* ================================================================== */

export interface PaperState {
  accounts: PaperAccount[];
  /** The account on the desk */
  inHand: string | null;
  /** This tab holds the accounts (and so may trade them) */
  holding: boolean;
  /** …and when it does not, another tab does */
  elsewhere: boolean;
}
const isAccount = (v: unknown): v is PaperAccount => {
  if (typeof v !== 'object' || v === null) return false;
  const a = v as Record<string, unknown>;
  return typeof a.id === 'string' && typeof a.startCash === 'number' && typeof a.opt === 'object' && typeof a.fut === 'object' && typeof a.ledger === 'object';
};
function load(): Pick<PaperState, 'accounts' | 'inHand'> {
  if (typeof localStorage === 'undefined' || EMBEDDED) return { accounts: [], inHand: null };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { accounts?: unknown[]; inHand?: string | null } | null;
    const accounts = Array.isArray(raw?.accounts) ? raw!.accounts.filter(isAccount) : [];
    const inHand = typeof raw?.inHand === 'string' && accounts.some(a => a.id === raw.inHand) ? raw.inHand : (accounts.find(a => a.status === 'open')?.id ?? null);
    return { accounts, inHand };
  } catch {
    return { accounts: [], inHand: null };
  }
}
let state: PaperState = { ...load(), holding: false, elsewhere: false };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

let saveTimer: number | undefined;
let full = false;
const save = () => {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  if (EMBEDDED || typeof localStorage === 'undefined' || !state.holding) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ accounts: state.accounts, inHand: state.inHand }));
    full = false;
  } catch {
    /* full or unavailable: the accounts run on for this visit — said once, not every tick */
    if (!full) console.warn('Paper: the browser’s storage is full — the accounts run on for this visit, unsaved');
    full = true;
  }
};
const commit = (next: Partial<PaperState>, urgent = false) => {
  state = { ...state, ...next };
  notify();
  if (!state.holding) return;
  if (urgent) save();
  /* AT MOST every SAVE_SOON_MS, never "a moment after the last change": the feed changes things every tick and a timer reset
     on each would never come due while anything is open */
  else if (saveTimer === undefined) saveTimer = window.setTimeout(save, SAVE_SOON_MS);
};
const replace = (a: PaperAccount): PaperAccount[] => state.accounts.map(x => (x.id === a.id ? a : x));

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const snapshot = () => state;
/** Every paper account, the one in hand, and whether this tab holds them */
export const usePaper = (): PaperState => useSyncExternalStore(subscribe, snapshot, snapshot);
export const readPaper = (): PaperState => state;
/** The account on the desk (null: none yet) */
export const useInHand = (): PaperAccount | null => {
  const s = usePaper();
  return s.accounts.find(a => a.id === s.inHand) ?? null;
};

/* ================================================================== */
/*  ONE TAB AT A TIME                                                  */
/* ================================================================== */

const TAB = `${Date.now().toString(36)}${Math.floor(Math.random() * 1679616).toString(36)}`;
interface Lease {
  tab: string;
  until: number;
}
const readLease = (): Lease | null => {
  try {
    const l = JSON.parse(localStorage.getItem(LEASE_KEY) ?? 'null') as Lease | null;
    return l && typeof l.tab === 'string' && typeof l.until === 'number' ? l : null;
  } catch {
    return null;
  }
};
/** Hold the accounts if nobody else does (or `force`: take them) — true when this tab holds them after */
function holdLease(force = false): boolean {
  /* the photographer's window holds its throwaway account without a lease — nothing of the visitor's is at stake */
  if (PHOTO) return true;
  if (EMBEDDED || typeof localStorage === 'undefined') return false;
  const l = readLease();
  const now = Date.now();
  if (!force && l && l.tab !== TAB && l.until > now) return false;
  try {
    localStorage.setItem(LEASE_KEY, JSON.stringify({ tab: TAB, until: now + LEASE_MS }));
  } catch {
    /* storage off: this tab runs the accounts for its own visit */
  }
  return true;
}
const releaseLease = () => {
  const l = readLease();
  if (l?.tab !== TAB) return;
  try {
    localStorage.setItem(LEASE_KEY, JSON.stringify({ tab: TAB, until: 0 }));
  } catch {
    /* nothing to release into */
  }
};
/** Take the accounts over from the tab that holds them: what it left open is closed at the last price it saw, on the
    next tick here (its market is not this one) */
export function takeHere(): void {
  if (EMBEDDED) return;
  const fresh = load();
  holdLease(true);
  staleDone = false;
  commit({ ...fresh, holding: true, elsewhere: false }, true);
}

/* ================================================================== */
/*  THE FILL ALERTS                                                    */
/* ================================================================== */

export interface PaperToast {
  id: string;
  at: number;
  kind: PaperEvent['kind'];
  words: string;
  pnl?: number;
  /** The account it happened on — its name, where the reader has more than one */
  account: string;
}
let toasts: PaperToast[] = [];
let toastSeq = 0;
const toastListeners = new Set<() => void>();
const say = (list: PaperToast[]) => {
  if (!list.length) return;
  toasts = [...list, ...toasts].slice(0, 12);
  toastListeners.forEach(fn => fn());
  chime();
};
export const usePaperToasts = (): PaperToast[] =>
  useSyncExternalStore(
    fn => {
      toastListeners.add(fn);
      return () => toastListeners.delete(fn);
    },
    () => toasts,
    () => toasts
  );

/* ================================================================== */
/*  THE RUNNER                                                         */
/* ================================================================== */

let staleDone = false;
/** Every open account, on this tick */
function tickAll(m: PaperMarket): void {
  let changed = false;
  let urgent = false;
  const heard: PaperToast[] = [];
  const many = state.accounts.filter(a => a.status === 'open').length > 1;
  const accounts = state.accounts.map(a => {
    let next = a;
    if (!staleDone && SIM_FEED) next = closeStale(next, m);
    if (next.status !== 'open') return next;
    const r = tick(next, m);
    for (const e of r.events) {
      if (e.kind === 'roll') continue;
      heard.push({ id: `t${++toastSeq}`, at: e.at, kind: e.kind, words: e.words, pnl: e.pnl, account: many ? a.name : '' });
      urgent = true;
    }
    if (r.account !== a) changed = true;
    return r.account;
  });
  if (!staleDone) {
    staleDone = true;
    urgent = true;
  }
  if (changed) commit({ accounts }, urgent);
  say(heard);
}

let started = false;
/** Start the runner — once, from the app's shell. Returns the way to stop it. */
export function startPaperRunner(): () => void {
  if (started || (EMBEDDED && !PHOTO) || typeof window === 'undefined') return () => undefined;
  started = true;
  const holding = holdLease();
  commit({ holding, elsewhere: !holding });
  const offTick = onFeedTick(() => {
    if (!state.holding || !state.accounts.length) return;
    tickAll(liveMarket());
  });
  /* the lease: kept while this tab holds it; a tab that loses it (taken over) stops trading and reads what the other writes */
  const renew = window.setInterval(() => {
    if (state.holding) {
      const l = readLease();
      if (l && l.tab !== TAB && l.until > Date.now()) commit({ holding: false, elsewhere: true, ...load() });
      else holdLease();
    } else if (holdLease()) {
      /* the other tab let go (it closed): this one holds them now — fresh from storage, and what that tab left is closed */
      staleDone = false;
      commit({ ...load(), holding: true, elsewhere: false }, true);
    }
  }, RENEW_MS);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && !state.holding) commit(load());
    if (e.key === JOURNAL_KEY) {
      journal = loadJournal();
      journalListeners.forEach(fn => fn());
    }
  };
  /* THE PAGE CLOSES (the simulated feed): what is open is closed at the market it saw, and the lease is let go */
  const onHide = () => {
    if (!state.holding) return;
    if (SIM_FEED) {
      const m = liveMarket();
      const accounts = state.accounts.map(a => (a.status === 'open' ? afterHand(a, flattenAll(a, m, 'page', 'the page closed'), m) : a));
      state = { ...state, accounts };
    }
    save();
    releaseLease();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('pagehide', onHide);
  return () => {
    offTick();
    window.clearInterval(renew);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pagehide', onHide);
    started = false;
  };
}

/* ================================================================== */
/*  WHAT THE READER DOES                                               */
/* ================================================================== */

/** A change by the reader's hand, through the engine, on the live market — nothing when this tab does not hold the accounts */
function act(id: string, fn: (a: PaperAccount, m: PaperMarket) => PaperAccount): boolean {
  if (!state.holding) return false;
  const a = state.accounts.find(x => x.id === id);
  if (!a) return false;
  const m = liveMarket();
  const next = afterHand(a, fn(a, m), m);
  if (next === a) return false;
  commit({ accounts: replace(next) }, true);
  return true;
}
export const placeOptOrder = (id: string, d: OptDraft) => act(id, (a, m) => optPlace(a, m, d));
export const placeFutOrder = (id: string, d: FutDraft) => act(id, (a, m) => futPlace(a, m, d));
/** EVERY WORKING ORDER AT ONCE — the Order card's Cancel orders (one future's, or one contract's) and Cancel all (the
    account's); what a cancel takes with it (the other side of a group) goes the way a single cancel would take it */
export const cancelWorking = (id: string, only?: { symbol?: string; contract?: string }) =>
  act(id, (a, m) => {
    let x = a;
    for (const o of a.opt.orders) if (o.status === 'working' && (!only || (only.contract != null && contractKey(o.contract) === only.contract))) x = optCancel(x, m, o.id);
    for (const o of a.fut.orders) if (o.status === 'working' && (!only || (only.symbol != null && o.symbol === only.symbol))) x = futCancel(x, m, o.id);
    return x;
  });
/** A working order goes — either book's */
export const cancelOrder = (id: string, orderId: string) => act(id, (a, m) => (a.opt.orders.some(o => o.id === orderId) ? optCancel(a, m, orderId) : futCancel(a, m, orderId)));
export const amendOrder = (id: string, orderId: string, price: number) => act(id, (a, m) => (a.opt.orders.some(o => o.id === orderId) ? optAmend(a, m, orderId, price) : futAmend(a, m, orderId, price)));
export const attachOpt = (id: string, c: ContractId, kind: 'target' | 'stop', price: number, on?: 'name') => act(id, (a, m) => optAttach(a, m, c, kind, price, on));
export const attachFut = (id: string, symbol: string, kind: 'target' | 'stop', price: number) => act(id, (a, m) => futAttach(a, m, symbol, kind, price));
export const trailOrder = (id: string, orderId: string, on: boolean, by?: number) => act(id, (a, m) => (a.opt.orders.some(o => o.id === orderId) ? optSetTrail(a, m, orderId, on, by) : futSetTrail(a, m, orderId, on, by)));
export const breakevenOrder = (id: string, orderId: string, on: boolean) => act(id, (a, m) => (a.opt.orders.some(o => o.id === orderId) ? optSetBreakeven(a, m, orderId, on) : futSetBreakeven(a, m, orderId, on)));
export const rebaseOrder = (id: string, orderId: string, to: 'name' | 'contract') => act(id, (a, m) => optRebase(a, m, orderId, to, (c, bid) => spotForBidNow(c, m.now, bid)));
export const closeOpt = (id: string, c: ContractId, qty: number) => act(id, (a, m) => optClose(a, m, c, qty));
export const closeFut = (id: string, symbol: string) => act(id, (a, m) => futClose(a, m, symbol));
/** Flat, now: everything open closed at the market, everything working cancelled */
export const flattenAccount = (id: string) => act(id, (a, m) => flattenByHand(a, m));
export const endEval = (id: string) => act(id, (a, m) => endEvaluation(a, m));

const newId = () => `a${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
/** A PRACTICE ACCOUNT of the size chosen. One is open at a time: starting another closes the last one (its trades stay in
    the journal under its name). */
export function startPractice(size: number): string | null {
  if (!state.holding) return null;
  const now = Date.now();
  const m = liveMarket(now);
  const accounts = state.accounts.map(a => (a.kind === 'practice' && a.status === 'open' ? { ...flattenAll(a, m, 'rule', 'the account was started over'), status: 'ended' as const, statusAt: now, statusWhy: 'Started over' } : a));
  const a = newAccount({ id: newId(), kind: 'practice', name: `Practice · from ${dayWords(nyAt(now).date).split(', ')[1]}`, startCash: size, now });
  commit({ accounts: [a, ...accounts], inHand: a.id }, true);
  return a.id;
}
/** AN EVALUATION on a plan. One runs at a time — the page asks for the running one to be ended first. */
export function startEvaluation(plan: EvalPlan): string | null {
  if (!state.holding || state.accounts.some(a => a.kind === 'evaluation' && a.status === 'open')) return null;
  const now = Date.now();
  const same = state.accounts.filter(a => a.kind === 'evaluation' && a.plan?.label === plan.label).length;
  const a = newAccount({ id: newId(), kind: 'evaluation', name: `${plan.label} evaluation${same ? ` · ${same + 1}` : ''}`, startCash: plan.size, plan, now });
  commit({ accounts: [a, ...state.accounts], inHand: a.id }, true);
  return a.id;
}
export const setInHand = (id: string) => state.accounts.some(a => a.id === id) && commit({ inHand: id }, true);
export const renameAccount = (id: string, name: string) => state.holding && commit({ accounts: state.accounts.map(a => (a.id === id ? { ...a, name: name.trim() || a.name } : a)) }, true);
/** The sandbox: fees off, futures fill at the price — practice only */
export const setSandbox = (id: string, on: boolean) => state.holding && commit({ accounts: state.accounts.map(a => (a.id === id && a.kind === 'practice' ? { ...a, sandbox: on || undefined } : a)) }, true);

/* ================================================================== */
/*  THE JOURNAL'S OWN KEY                                              */
/* ================================================================== */

export interface PaperJournal {
  /** By account, by trade */
  entries: Record<string, Record<string, JournalEntry>>;
  /** By account, by trading day */
  days: Record<string, Record<string, DayNote>>;
}
function loadJournal(): PaperJournal {
  if (typeof localStorage === 'undefined' || EMBEDDED) return { entries: {}, days: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? 'null') as Partial<PaperJournal> | null;
    return { entries: raw?.entries ?? {}, days: raw?.days ?? {} };
  } catch {
    return { entries: {}, days: {} };
  }
}
let journal: PaperJournal = loadJournal();
const journalListeners = new Set<() => void>();
/** Written straight away, and read back first — another tab may have written since */
const writeJournal = (fn: (j: PaperJournal) => PaperJournal) => {
  if (EMBEDDED) return;
  journal = fn(loadJournal());
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
  } catch {
    /* full: the words last as long as the page */
  }
  journalListeners.forEach(fn2 => fn2());
};
export const usePaperJournal = (): PaperJournal =>
  useSyncExternalStore(
    fn => {
      journalListeners.add(fn);
      return () => journalListeners.delete(fn);
    },
    () => journal,
    () => journal
  );
/** The journal's entry on a closed paper trade — what is given is written over what was there */
export const setPaperEntry = (accountId: string, tradeId: string, patch: Partial<JournalEntry>) =>
  writeJournal(j => ({ ...j, entries: { ...j.entries, [accountId]: { ...j.entries[accountId], [tradeId]: { ...j.entries[accountId]?.[tradeId], ...patch } } } }));
/** A note on one of an account's trading days: the plan before, the review after */
export const setPaperDayNote = (accountId: string, day: string, patch: Partial<DayNote>) =>
  writeJournal(j => ({ ...j, days: { ...j.days, [accountId]: { ...j.days[accountId], [day]: { ...j.days[accountId]?.[day], ...patch } } } }));
