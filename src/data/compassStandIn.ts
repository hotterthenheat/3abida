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
      side and a hash of the setup's address. A STRUCTURE
      FOLLOWS THE SETUP'S DIRECTION (2026-10-11, the
      owner's review): a call (bullish) may be shown as a
      long call, a debit call spread, a credit put spread
      or a cash-secured put; a put (bearish) as a long put
      or a debit put spread; a long straddle or strangle
      comes only from the Volatility kind's own setups
      (cheap options, for expansion), never from a
      directional one. Penny Precision is a put sale's tag
      alone.
    · THE STRUCTURE'S FIGURES — plain arithmetic of its
      legs, each leg priced by the engine's own per-
      contract premium (data/compass estimatePremium, the
      pricer that mints every setup's mid): a spread's net
      and width, a sale's credit and cash, breakevens. No
      model of its own. NO NAME IS SORTED FIRST for being
      that name (the owner, 2026-10-11: "never put any
      tickers first").

  The 0DTE rule and the categories are data/expiryClass.ts's — real date logic that stays.
==================================================
*/

import { estimatePremium, makeSetup, setupIdOf } from './compass';
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
/** Which way a structure leans — the chip's ink: bull, bear, or the plain ink for a move either way */
export type StructureBias = 'bull' | 'bear' | 'neutral';

/** One leg of a structure: bought or sold, its side and strike, and the engine's premium for it (per share) */
export interface StructureLeg {
  side: 'buy' | 'sell';
  right: 'C' | 'P';
  strike: number;
  /** The engine's per-contract premium for this leg, per share; null when the data carries none */
  premium: number | null;
}

/** A structure's own figures, per share as a premium is quoted (cash set aside is per contract, 100 shares) — plain
    arithmetic of its legs, never a model */
export type StructureFigures =
  | { kind: 'debit-spread'; debit: number; width: number; maxLoss: number; maxGain: number; breakevens: [number] }
  | { kind: 'credit-spread'; credit: number; width: number; maxLoss: number; breakevens: [number] }
  | { kind: 'cash-secured'; credit: number; cash: number; breakevens: [number] }
  | { kind: 'long-vol'; cost: number; breakevens: [number, number] };

export interface FiledSetup {
  setup: Setup;
  /** The engine lens that found it */
  lens: ScannerKey;
  listing: Listing;
  exp: ExpiryRead;
  structure: StructureKey;
  /** The structure with its legs, e.g. "Debit call spread 475/480" */
  legs: string;
  /** The structure on its name — the card's chip: "SPY 475C" for a single leg, "SPY 470/465 put spread", "AVGO 167.50
      put", "SPY 475 straddle" */
  name: string;
  /** Which way it leans — a credit put spread is bullish, a straddle neither */
  bias: StructureBias;
  /** The legs, each with the engine's premium */
  legList: StructureLeg[];
  /** The structure's own figures; null for a single leg (its premium is the setup's), or when a leg has no premium */
  figures: StructureFigures | null;
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
const cents = (v: number) => Number(v.toFixed(2));

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

const BIAS: Record<StructureKey, StructureBias> = {
  'long-call': 'bull',
  'debit-call-spread': 'bull',
  'credit-put-spread': 'bull',
  'cash-secured-put': 'bull',
  'long-put': 'bear',
  'debit-put-spread': 'bear',
  'long-straddle': 'neutral',
  'long-strangle': 'neutral',
};
export const biasOf = (s: StructureKey): StructureBias => BIAS[s];

/**
 * The structure a lens's setup is shown as. IT FOLLOWS THE SETUP'S DIRECTION: a call (bullish) is a long call, a debit
 * call spread, a credit put spread or a cash-secured put; a put (bearish) is a long put or a debit put spread. A long
 * straddle or strangle is the Volatility kind's own setup (`vol`) and nothing else's. Quick Scalps stay single legs.
 */
function structureOf(setup: Setup, lens: ScannerKey, vol: boolean): StructureKey {
  const h = hash(`${setup.ticker}-${setup.strike}-${setup.right}-${lens}-${setup.sleeve}-structure`);
  if (vol) return h % 3 === 0 ? 'long-strangle' : 'long-straddle';
  const single: StructureKey = setup.right === 'C' ? 'long-call' : 'long-put';
  if (lens === 'quick-scalp') return single;
  const r = h % 12;
  if (r <= 2) return setup.right === 'C' ? 'debit-call-spread' : 'debit-put-spread';
  if ((r === 3 || r === 4) && setup.right === 'C') return isIndexProduct(setup.ticker) || r === 3 ? 'credit-put-spread' : 'cash-secured-put';
  return single;
}

/** The legs, bought and sold, round the setup's strike on the name's grid */
function legSet(structure: StructureKey, strike: number, step: number, right: 'C' | 'P'): StructureLeg[] {
  const w = widthOf(strike, step);
  const k = roundTo(strike, step);
  const leg = (side: 'buy' | 'sell', r: 'C' | 'P', at: number): StructureLeg => ({ side, right: r, strike: roundTo(at, step), premium: null });
  switch (structure) {
    case 'long-call':
    case 'long-put':
      return [leg('buy', right, k)];
    case 'debit-call-spread':
      return [leg('buy', 'C', k), leg('sell', 'C', k + w)];
    case 'debit-put-spread':
      return [leg('buy', 'P', k), leg('sell', 'P', k - w)];
    case 'credit-put-spread':
      return [leg('sell', 'P', k - w), leg('buy', 'P', k - 2 * w)];
    case 'cash-secured-put':
      return [leg('sell', 'P', k - w)];
    case 'long-straddle':
      return [leg('buy', 'C', k), leg('buy', 'P', k)];
    case 'long-strangle':
      return [leg('buy', 'P', k - w), leg('buy', 'C', k + w)];
  }
}

function legsWords(structure: StructureKey, legs: StructureLeg[]): string {
  const words = STRUCTURE_WORDS[structure];
  const ks = legs.map(l => strikeWords(l.strike));
  return structure === 'long-call' || structure === 'long-put' || structure === 'long-straddle' || structure === 'cash-secured-put' ? `${words} ${ks[0]}` : `${words} ${ks.join('/')}`;
}

/** The chip: the structure on its name */
function nameWords(setup: Setup, structure: StructureKey, legs: StructureLeg[]): string {
  const t = setup.ticker;
  const ks = legs.map(l => strikeWords(l.strike));
  switch (structure) {
    case 'long-call':
    case 'long-put':
      return setup.contract;
    case 'debit-call-spread':
      return `${t} ${ks[0]}/${ks[1]} call spread`;
    case 'debit-put-spread':
    case 'credit-put-spread':
      return `${t} ${ks[0]}/${ks[1]} put spread`;
    case 'cash-secured-put':
      return `${t} ${ks[0]} put`;
    case 'long-straddle':
      return `${t} ${ks[0]} straddle`;
    case 'long-strangle':
      return `${t} ${ks[0]}/${ks[1]} strangle`;
  }
}

/**
 * Each leg priced by the engine's own per-contract premium — the pricer that minted the setup's mid, on the same spot,
 * IV and time left, rounded to the cent as the mid is — and the structure's figures as plain sums of them. A structure
 * whose legs net nothing (both at the pricer's floor) has no figures: its legs are shown without invented numbers.
 */
function priceLegs(legs: StructureLeg[], setup: Setup, quote: { spot: number; iv: number } | null): StructureLeg[] {
  if (!quote || !(quote.spot > 0) || !(quote.iv > 0)) return legs;
  const t = Math.max(setup.sessionsLeft, 0.5) / 252;
  return legs.map(l => ({ ...l, premium: l.strike === setup.strike && l.right === setup.right ? setup.mid : cents(estimatePremium(quote.spot, l.strike, l.right, quote.iv, t)) }));
}

function figuresOf(structure: StructureKey, legs: StructureLeg[]): StructureFigures | null {
  if (legs.length < 2 && structure !== 'cash-secured-put') return null;
  if (legs.some(l => l.premium == null)) return null;
  const p = (i: number) => legs[i].premium as number;
  switch (structure) {
    case 'debit-call-spread':
    case 'debit-put-spread': {
      const debit = cents(p(0) - p(1));
      const width = cents(Math.abs(legs[1].strike - legs[0].strike));
      if (!(debit > 0) || debit >= width) return null;
      const be = structure === 'debit-call-spread' ? legs[0].strike + debit : legs[0].strike - debit;
      return { kind: 'debit-spread', debit, width, maxLoss: debit, maxGain: cents(width - debit), breakevens: [cents(be)] };
    }
    case 'credit-put-spread': {
      const credit = cents(p(0) - p(1));
      const width = cents(legs[0].strike - legs[1].strike);
      if (!(credit > 0) || credit >= width) return null;
      return { kind: 'credit-spread', credit, width, maxLoss: cents(width - credit), breakevens: [cents(legs[0].strike - credit)] };
    }
    case 'cash-secured-put': {
      const credit = p(0);
      if (!(credit > 0)) return null;
      return { kind: 'cash-secured', credit, cash: Math.round(legs[0].strike * 100), breakevens: [cents(legs[0].strike - credit)] };
    }
    case 'long-straddle':
    case 'long-strangle': {
      const cost = cents(p(0) + p(1));
      const put = legs.find(l => l.right === 'P') as StructureLeg;
      const call = legs.find(l => l.right === 'C') as StructureLeg;
      return { kind: 'long-vol', cost, breakevens: [cents(put.strike - cost), cents(call.strike + cost)] };
    }
    default:
      return null;
  }
}

/** The single leg's half: Steady at a higher delta (the engine lists strikes from the money outward, so the leg nearest
    it), Big Payoff the rest */
const STEADY_DELTA = 0.5;

/** File one setup — the board's sweep and a setup's own page read the same. `quote` is the name's spot and IV, which
    price the structure's other legs as the engine priced the setup's own. */
export function fileSetup(setup: Setup, lens: ScannerKey, listing: Listing, day: BoardDay, step: number, quote: { spot: number; iv: number } | null = null): FiledSetup | null {
  const exp = readExpiry(listing, day);
  if (!exp) return null;
  const h = hash(`${setup.ticker}-${setup.strike}-${setup.right}-${lens}`);
  /* THE VOLATILITY KIND'S OWN SETUPS: a share of the cheap options, read as cheap for a move either way — the only
     setups a straddle or a strangle comes from */
  const vol = lens === 'discounted' && h % 3 === 0;
  const structure = structureOf(setup, lens, vol);
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
  /* Volatility: options cheap against their history (the long straddles and strangles) or rich (the put sales) */
  if (vol || type === 'premium') kinds.add('volatility');
  if (event) {
    kinds.add('events');
    if (type !== 'premium') kinds.add('earnings');
  }
  const tags: TagKey[] = [];
  if (lens === 'whale-sweeps' || h % 7 === 0) tags.push('unusual');
  /* PENNY PRECISION IS A PUT SALE'S (2026-10-11): its line is about short-strike levels, so only a structure with a short
     strike to place wears it */
  if (type === 'premium' && h % 3 !== 0) tags.push('penny');
  const legList = priceLegs(legSet(structure, setup.strike, step, setup.right), setup, quote);
  return {
    setup,
    lens,
    listing,
    exp,
    structure,
    legs: legsWords(structure, legList),
    name: nameWords(setup, structure, legList),
    bias: BIAS[structure],
    legList,
    figures: figuresOf(structure, legList),
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
      const filed = fileSetup(setup, lens, listing, day, q.step, { spot: q.price, iv: q.iv });
      if (filed) out.push(filed);
    }
  }
  return out;
}

export { readBoardDay as boardDay };
