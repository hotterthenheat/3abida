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
    A RELOAD      what is open STAYS open (the audit's
    KEEPS IT      PR-1, 2026-10-09: a reload closed an
                  open AAPL call "with the page" and
                  counted the day toward an evaluation):
                  positions and working orders are saved
                  as they change and when the page hides,
                  and the next load marks them on its own
                  market and keeps working them
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
import { LIFE, barNowOf, candlesOf, isPaperIndex, optionQuote, spotForBidNow } from './feed';
import { buildLevelsFor } from '../gex';
import { dayWords, nyAt, nyClockWords } from './clock';
import {
  afterHand,
  endEvaluation,
  flattenAll,
  flattenByHand,
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
    bar: (ticker: string) => barNowOf(ticker),
    candles: (ticker: string) => candlesOf(ticker),
    /* THE SIMULATED FEED NEVER SHUTS (the rules page, "The prices") — the real feed's hours come in here */
    open: () => true,
    /* WHERE A WAY IN STOOD: the name's own book (an index has none of its own — its fund's is another name's) */
    levels: (ticker: string) => (isPaperIndex(ticker) ? null : buildLevelsFor(ticker)),
  };
}

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
  return typeof a.id === 'string' && typeof a.startCash === 'number' && typeof a.opt === 'object' && typeof a.ledger === 'object';
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
/** Take the accounts over from the tab that holds them: they come here as they stand — what is open stays open and is
    marked on this tab's prices from the next tick. The other tab only reads them from then on. */
export function takeHere(): void {
  if (EMBEDDED) return;
  const fresh = load();
  holdLease(true);
  commit({ ...fresh, holding: true, elsewhere: false }, true);
}
/** Hand the accounts back (the Undo of "Take them here"): this tab lets the lease go and only reads; the tab that had
    them takes them back on its next renewal */
export function handBack(): void {
  if (EMBEDDED || PHOTO || !state.holding) return;
  save();
  releaseLease();
  commit({ holding: false, elsewhere: true });
  handedBackAt = Date.now();
}
/** Just after a hand-back, this tab waits a renewal or two before it takes a free lease itself — the other tab first */
let handedBackAt = 0;

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

/** Every open account, on this tick */
function tickAll(m: PaperMarket): void {
  let changed = false;
  let urgent = false;
  const heard: PaperToast[] = [];
  const many = state.accounts.filter(a => a.status === 'open').length > 1;
  const accounts = state.accounts.map(a => {
    if (a.status !== 'open') return a;
    const r = tick(a, m);
    for (const e of r.events) {
      if (e.kind === 'roll') continue;
      heard.push({ id: `t${++toastSeq}`, at: e.at, kind: e.kind, words: e.words, pnl: e.pnl, account: many ? a.name : '' });
      urgent = true;
    }
    if (r.account !== a) changed = true;
    return r.account;
  });
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
    } else if (Date.now() - handedBackAt > LEASE_MS && holdLease()) {
      /* the other tab let go (it closed): this one holds them now, fresh from storage — what is open stays open */
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
  /* THE PAGE CLOSES: everything is written down as it stands (nothing is closed — the next load carries it on), and the
     lease is let go */
  const onHide = () => {
    if (!state.holding) return;
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
/** EVERY WORKING ORDER AT ONCE — Cancel all (the account's), or one contract's; what a cancel takes with it (the other side
    of a group) goes the way a single cancel would take it */
export const cancelWorking = (id: string, only?: { contract?: string }) =>
  act(id, (a, m) => {
    let x = a;
    for (const o of a.opt.orders) if (o.status === 'working' && (!only || (only.contract != null && contractKey(o.contract) === only.contract))) x = optCancel(x, m, o.id);
    return x;
  });
/** A working order goes */
export const cancelOrder = (id: string, orderId: string) => act(id, (a, m) => optCancel(a, m, orderId));
export const amendOrder = (id: string, orderId: string, price: number) => act(id, (a, m) => optAmend(a, m, orderId, price));
export const attachOpt = (id: string, c: ContractId, kind: 'target' | 'stop', price: number, on?: 'name') => act(id, (a, m) => optAttach(a, m, c, kind, price, on));
export const trailOrder = (id: string, orderId: string, on: boolean, by?: number) => act(id, (a, m) => optSetTrail(a, m, orderId, on, by));
export const breakevenOrder = (id: string, orderId: string, on: boolean) => act(id, (a, m) => optSetBreakeven(a, m, orderId, on));
export const rebaseOrder = (id: string, orderId: string, to: 'name' | 'contract') => act(id, (a, m) => optRebase(a, m, orderId, to, (c, bid) => spotForBidNow(c, m.now, bid)));
export const closeOpt = (id: string, c: ContractId, qty: number) => act(id, (a, m) => optClose(a, m, c, qty));
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
  /* A NAME OF ITS OWN (the audit's PR-18: two accounts both "Practice · from Oct 9"): its size and the minute it began, New
     York's — "Practice $10K · Oct 9 14:05" */
  const t = nyAt(now);
  const a = newAccount({ id: newId(), kind: 'practice', name: `Practice $${Math.round(size / 1000)}K · ${dayWords(t.date).split(', ')[1]} ${nyClockWords(now)}`, startCash: size, now });
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

/* ================================================================== */
/*  THE WAY BACK (ui/undo.tsx — the audit's X5)                        */
/* ================================================================== */

/** What the reader's hand did, as the store saw it: the account before and after — what an Undo puts back */
export interface PaperHandMark {
  id: string;
  before: PaperAccount;
  after: PaperAccount;
}
/** Do `fn` to an account and keep what it was before, for an Undo — null when nothing changed */
export function withMark(id: string, fn: () => unknown): PaperHandMark | null {
  const before = state.accounts.find(a => a.id === id);
  if (!before) return null;
  fn();
  const after = state.accounts.find(a => a.id === id);
  return after && after !== before ? { id, before, after } : null;
}
/** Nothing has happened to the account since the hand acted: no fill, no order, no new day */
const untouchedSince = (cur: PaperAccount, after: PaperAccount): boolean =>
  cur.opt.fills.length === after.opt.fills.length && cur.opt.orders.length === after.opt.orders.length && cur.opt.orders.every((o, i) => o.status === after.opt.orders[i]?.status) && cur.day === after.day && cur.status === after.status;
/** PUT IT BACK: the account as it stood before the hand — only while nothing else has happened to it since (a fill, an order,
    the day rolling); false when it could not be */
export function undoMark(mark: PaperHandMark): boolean {
  if (!state.holding) return false;
  const cur = state.accounts.find(a => a.id === mark.id);
  if (!cur || !untouchedSince(cur, mark.after)) return false;
  commit({ accounts: replace(mark.before) }, true);
  return true;
}
/** UNDO A NEW PRACTICE ACCOUNT: the new one goes (while nothing was traded on it) and the one it closed comes back as it was */
export function undoStartPractice(madeId: string, closed: PaperAccount | null, inHandBefore: string | null): boolean {
  if (!state.holding) return false;
  const made = state.accounts.find(a => a.id === madeId);
  if (!made || made.opt.orders.length) return false;
  const accounts = state.accounts.filter(a => a.id !== madeId).map(a => (closed && a.id === closed.id ? closed : a));
  commit({ accounts, inHand: inHandBefore && accounts.some(a => a.id === inHandBefore) ? inHandBefore : (accounts[0]?.id ?? null) }, true);
  return true;
}

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
