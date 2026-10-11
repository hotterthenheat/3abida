/*
==================================================
  SLAYER TERMINAL - THE BOARD'S STAND-IN MAPPING
  (data/compassStandIn.ts)

  THIS IS THE STAND-IN MAPPING, TO BE REPLACED BY THE
  ENGINE. The owner's board (2026-10-11, docs/compass-
  setups-2026-10-11.md: "build this in compass UI NO
  MATH OR BACKEND THIS IS ALL UI") files every setup
  under an expiration category, a kind, an option type
  and its tags. Until the engine and the feed name
  those, this module files the setups the five engine
  lenses already find with plain, deterministic rules —
  the lens, the side, the strike, the days left and a
  stable hash — and nothing here prices or ranks
  anything:

    · LISTINGS — each name's listed expirations, from a
      schedule by kind of name (index products list
      every session for three weeks; most stocks list
      Fridays; a few list monthlies only; SPX's
      third-Friday monthlies are AM-settled). The feed's
      own expiry list replaces this.
    · RE-HOMING — a lens's setup is moved onto one of
      its name's listed dates inside its tenor (0DTE,
      Weekly, Swing or Position, Long-Dated) and made
      again by the engine's own makeSetup on that date.
    · KINDS, STRUCTURES, TAGS — read off the lens, the
      side and a hash of the setup's address.

  The 0DTE rule and the categories are data/expiryClass.ts's — real date logic that stays.
==================================================
*/

import { makeSetup, setupIdOf } from './compass';
import { isTradingDay, isoDate, today as engineToday } from '../core/calendar';
import { boardDay as readBoardDay, daysBetween, readExpiry, sessionAfter, sessionBefore, type BoardDay, type ExpiryRead, type Listing } from './expiryClass';
import type { KindKey, ScannerKey, Setup, SleeveKey, StructureKey, TagKey, UniverseQuote } from '../types/compass';
import { STRUCTURE_TYPE } from '../types/compass';

// ---- a stable hash -----------------------------------------------------------------------------------------------------
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---- which names are which ---------------------------------------------------------------------------------------------
/** Cash-settled index options and their minis */
const INDEX_OPTIONS = new Set(['SPX', 'SPXW', 'XSP', 'NDX', 'RUT']);
/** Index products: the indexes and the liquid index ETFs — the only names Quick Scalps lists */
const INDEX_PRODUCTS = new Set([...INDEX_OPTIONS, 'SPY', 'QQQ', 'IWM', 'DIA']);
export const isIndexProduct = (ticker: string): boolean => INDEX_PRODUCTS.has(ticker.toUpperCase());
/** Names whose premium-selling setups list first: SPX and XSP */
export const isSpxFamily = (ticker: string): boolean => ['SPX', 'SPXW', 'XSP'].includes(ticker.toUpperCase());

// ---- the listing schedule (stand-in until the feed's expiry list) -------------------------------------------------------
const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** A listed Friday that is a holiday expires the session before */
const onSession = (d: Date) => (isTradingDay(d) ? atMidnight(d) : sessionBefore(d));
const thirdFriday = (y: number, m: number): Date => {
  const first = new Date(y, m, 1);
  return new Date(y, m, 1 + ((5 - first.getDay() + 7) % 7) + 14);
};
const lastSessionOfMonth = (y: number, m: number): Date => onSession(new Date(y, m + 1, 0));

type Schedule = 'daily' | 'mwf' | 'weekly' | 'monthly';
function scheduleOf(ticker: string): Schedule {
  const t = ticker.toUpperCase();
  if (INDEX_PRODUCTS.has(t) && t !== 'DIA' && t !== 'NDX' && t !== 'RUT') return 'daily';
  if (t === 'NVDA' || t === 'TSLA') return 'mwf';
  return hash(`${t}-listing`) % 4 === 0 ? 'monthly' : 'weekly';
}

const cache = new Map<string, Listing[]>();

/** The name's listed expirations from the board's session on, ascending — the calendar's lit days come from here */
export function listingsFor(ticker: string, day: BoardDay): Listing[] {
  const key = `${ticker}|${isoDate(day.session)}`;
  const had = cache.get(key);
  if (had) return had;
  const t = ticker.toUpperCase();
  const sched = scheduleOf(t);
  const from = day.session;
  const out = new Map<string, Listing>();
  const add = (expires: Date, series: Listing['series'], am = false) => {
    const exp = onSession(expires);
    const last = am ? sessionBefore(exp) : exp;
    if (last < from) return;
    const k = `${isoDate(exp)}${am ? 'am' : ''}`;
    const prev = out.get(k);
    /* the same date in two series keeps the longer-lived name (a third Friday is a monthly, not a weekly) */
    const rank = { daily: 0, weekly: 1, monthly: 2, quarterly: 3, long: 4 } as const;
    if (!prev || rank[series] > rank[prev.series]) out.set(k, { expires: exp, last, am, series });
  };
  /* the near dates */
  const near = sched === 'daily' ? 21 : sched === 'monthly' ? 0 : 42;
  for (let i = 0; i <= near; i++) {
    const d = addDays(from, i);
    const dow = d.getDay();
    if (!isTradingDay(d) && dow !== 5) continue;
    if (sched === 'daily' && isTradingDay(d)) add(d, 'daily');
    else if (sched === 'mwf' && (dow === 1 || dow === 3 || dow === 5) && i <= 14) add(d, 'weekly');
    else if (dow === 5 && (sched === 'weekly' || sched === 'mwf')) add(d, 'weekly');
  }
  if (sched === 'daily') for (let i = 22; i <= 63; i++) if (addDays(from, i).getDay() === 5) add(addDays(from, i), 'weekly');
  /* the monthlies (third Friday) — SPX's are AM-settled, with SPXW's PM contract on the same day */
  const monthsOut = sched === 'monthly' ? 6 : sched === 'daily' ? 13 : 9;
  for (let k = 0; k <= monthsOut; k++) {
    const y = from.getFullYear();
    const m = from.getMonth() + k;
    const tf = thirdFriday(y, m);
    add(tf, 'monthly');
    if (t === 'SPX') add(tf, 'monthly', true);
  }
  /* the quarterlies (index products: the quarter's last session; stocks: March, June, September and December) */
  for (let k = 0; k <= 24; k++) {
    const y = from.getFullYear();
    const m = from.getMonth() + k;
    if (new Date(y, m, 1).getMonth() % 3 !== 2) continue;
    add(sched === 'daily' ? lastSessionOfMonth(y, m) : thirdFriday(y, m), 'quarterly');
  }
  /* the long-dated series — June and December as well as January, out about two and a half years */
  for (let k = 0; k <= 32; k++) {
    const y = from.getFullYear();
    const m = from.getMonth() + k;
    const mo = new Date(y, m, 1).getMonth();
    if (mo !== 0 && mo !== 5 && mo !== 11) continue;
    if (sched === 'monthly' && mo !== 0) continue;
    add(thirdFriday(y, m), 'long');
    if (t === 'SPX') add(thirdFriday(y, m), 'long', true);
  }
  const list = [...out.values()].sort((a, b) => a.last.getTime() - b.last.getTime() || Number(a.am) - Number(b.am));
  if (cache.size > 400) cache.clear();
  cache.set(key, list);
  return list;
}

// ---- one setup, filed ---------------------------------------------------------------------------------------------------
export interface FiledSetup {
  setup: Setup;
  /** The engine lens that found it */
  lens: ScannerKey;
  listing: Listing;
  exp: ExpiryRead;
  structure: StructureKey;
  /** The structure with its legs, e.g. "Debit call spread 475/480" */
  legs: string;
  /** A single leg in the Steady half (else Big Payoff) */
  steady: boolean;
  /** The kinds it is filed under — Top Setups and All Setups are the board's own */
  kinds: KindKey[];
  tags: TagKey[];
  /** An event falls inside its life */
  event: boolean;
}

const strikeWords = (k: number) => (k % 1 === 0 ? k.toFixed(0) : k.toFixed(2));
/** A spread's width: about one percent of the strike, on the name's grid */
const widthOf = (strike: number, step: number) => Math.max(step, Math.round((strike * 0.01) / step) * step);
const roundTo = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(2));

const STRUCTURE_WORDS: Record<StructureKey, string> = {
  'long-call': 'Long call',
  'long-put': 'Long put',
  'debit-call-spread': 'Debit call spread',
  'debit-put-spread': 'Debit put spread',
  'credit-put-spread': 'Credit put spread',
  'cash-secured-put': 'Cash-secured put',
  'long-straddle': 'Long straddle',
  'long-strangle': 'Long strangle',
};
export const structureWords = (s: StructureKey): string => STRUCTURE_WORDS[s];

/** The structure a lens's setup is shown as — single legs for most, and a share of spreads, premium and straddles */
function structureOf(setup: Setup, lens: ScannerKey): StructureKey {
  const single: StructureKey = setup.right === 'C' ? 'long-call' : 'long-put';
  if (lens === 'quick-scalp') return single;
  const r = hash(`${setup.ticker}-${setup.strike}-${setup.right}-${lens}-${setup.sleeve}-structure`) % 12;
  if (r <= 2) return setup.right === 'C' ? 'debit-call-spread' : 'debit-put-spread';
  if ((r === 3 || r === 4) && setup.right === 'C') return isIndexProduct(setup.ticker) || r === 3 ? 'credit-put-spread' : 'cash-secured-put';
  if (r === 5 || (lens === 'discounted' && r === 6)) return r === 5 ? 'long-straddle' : 'long-strangle';
  return single;
}

function legsOf(structure: StructureKey, strike: number, step: number): string {
  const w = widthOf(strike, step);
  const k = roundTo(strike, step);
  const words = STRUCTURE_WORDS[structure];
  switch (structure) {
    case 'long-call':
    case 'long-put':
    case 'long-straddle':
      return `${words} ${strikeWords(k)}`;
    case 'debit-call-spread':
      return `${words} ${strikeWords(k)}/${strikeWords(k + w)}`;
    case 'debit-put-spread':
      return `${words} ${strikeWords(k)}/${strikeWords(k - w)}`;
    case 'credit-put-spread':
      return `${words} ${strikeWords(k - w)}/${strikeWords(k - 2 * w)}`;
    case 'cash-secured-put':
      return `${words} ${strikeWords(k - w)}`;
    case 'long-strangle':
      return `${words} ${strikeWords(k - w)}/${strikeWords(k + w)}`;
  }
}

/** The single leg's half: Steady at a higher delta (the engine lists strikes from the money outward, so the leg nearest
    it), Big Payoff the rest */
const STEADY_DELTA = 0.5;

/** File one setup — the board's sweep and a setup's own page read the same */
export function fileSetup(setup: Setup, lens: ScannerKey, listing: Listing, day: BoardDay, step: number): FiledSetup | null {
  const exp = readExpiry(listing, day);
  if (!exp) return null;
  const h = hash(`${setup.ticker}-${setup.strike}-${setup.right}-${lens}`);
  const structure = structureOf(setup, lens);
  const type = STRUCTURE_TYPE[structure];
  const index = isIndexProduct(setup.ticker);
  const event = !index ? hash(`${setup.ticker}-${isoDate(listing.last)}-event`) % 5 === 0 : hash(`${setup.ticker}-${isoDate(listing.last)}-fed`) % 6 === 0;
  const kinds = new Set<KindKey>();
  /* Quick Scalps: index products only, on the session's own contracts, as single legs — whichever lens found them */
  if (index && exp.cat === '0dte' && type === 'single' && (lens === 'quick-scalp' || lens === 'top-setups')) kinds.add('quick-scalps');
  else if (lens === 'top-setups' || lens === 'quick-scalp') kinds.add(h % 2 === 0 ? 'trend' : 'breakouts');
  if (lens === 'discounted') kinds.add('cheap');
  if (lens === 'rebounds') kinds.add('bounces');
  if (lens === 'whale-sweeps') kinds.add('flow');
  if (type === 'premium') kinds.add('premium-selling');
  if (type === 'vol' || (lens === 'discounted' && h % 3 === 0)) kinds.add('volatility');
  if (event) {
    kinds.add('events');
    if (type !== 'premium') kinds.add('earnings');
  }
  const tags: TagKey[] = [];
  if (lens === 'whale-sweeps' || h % 7 === 0) tags.push('unusual');
  if (type === 'premium' || (index && h % 4 === 1)) tags.push('penny');
  return {
    setup,
    lens,
    listing,
    exp,
    structure,
    legs: legsOf(structure, setup.strike, step),
    steady: type === 'single' && Math.abs(setup.greeks.delta) >= STEADY_DELTA,
    kinds: [...kinds],
    tags,
    event,
  };
}

/** The listing a setup stands on, read back off the setup (its page has only the address) */
export function listingOfSetup(setup: Setup, am = false): Listing {
  const [y, m, d] = setup.expiryDate.split('-').map(Number);
  const last = new Date(y, m - 1, d);
  return { expires: am ? sessionAfter(last) : last, last, am, series: 'weekly' };
}

// ---- the board's pool ---------------------------------------------------------------------------------------------------
/** Which categories a lens's tenor is re-homed into */
const HOMES: Record<SleeveKey, ExpiryRead['cat'][]> = {
  odte: ['0dte'],
  weekly: ['weekly'],
  swing: ['swing', 'position'],
  leaps: ['long'],
};

/**
 * Every setup the five lenses found on every tenor, each moved onto one of its name's listed dates and filed. `byLens`
 * is the engine's own output, per lens and tenor — the board builds it; this module never runs a sweep.
 */
export function filePool(byLens: { lens: ScannerKey; sleeve: SleeveKey; setups: Setup[] }[], universe: UniverseQuote[], at?: number): FiledSetup[] {
  const day = readBoardDay(at);
  const quotes = new Map(universe.map(q => [q.ticker, q]));
  const engineDay = engineToday();
  const out: FiledSetup[] = [];
  for (const { lens, sleeve, setups } of byLens) {
    for (const s of setups) {
      const q = quotes.get(s.ticker);
      if (!q) continue;
      const homes = HOMES[sleeve];
      const choices = listingsFor(s.ticker, day).filter(l => {
        const r = readExpiry(l, day);
        return !!r && homes.includes(r.cat);
      });
      /* a name with no listed date in the tenor (no 0DTE today, no weekly) is not on that tenor — it still is on the others */
      if (!choices.length) continue;
      /* most land on the standard series (a Friday weekly, a monthly) and a third on any listed day */
      const h = hash(`${s.id}-home`);
      const standard = choices.filter(l => l.series !== 'daily');
      const from = standard.length && h % 3 !== 0 ? standard : choices;
      const listing = from[(h >>> 2) % from.length];
      const lastIso = isoDate(listing.last);
      let setup = s;
      if (lastIso !== s.expiryDate || listing.am) {
        const dte = daysBetween(engineDay, listing.last);
        if (dte < 0) continue;
        const made = makeSetup(s.ticker, q.price, s.strike, s.right, lens, q.iv, sleeve, dte);
        setup = { ...made, id: setupIdOf({ ticker: s.ticker, strike: s.strike, right: s.right, scanner: lens, sleeve, on: lastIso, am: listing.am }) };
      }
      const filed = fileSetup(setup, lens, listing, day, q.step);
      if (filed) out.push(filed);
    }
  }
  return out;
}

export { readBoardDay as boardDay };
