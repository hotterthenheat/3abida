/*
==================================================
  SLAYER TERMINAL - EACH NAME'S LISTED EXPIRIES
  (data/feed/listings.ts)

  THE BOARD FILES ON THE REAL CALENDAR (2026-10-12). With
  UW up, Compass's board reads each name's listed
  expiration dates off GET /api/stock/{ticker}/expiry-
  breakdown — the dates alone (`expires`); its open
  interest, volume and chain count are never shown. The
  setups stay the house's: a listed date is the
  exchange's calendar, the same in any market, as the
  holidays in core/calendar.ts are.

  WHY UW AND NOT MASSIVE (checked live 2026-10-12):
    · UW answers every name in one call, the indices too,
      each ROOT on its own: SPX (the AM-settled third-
      Friday monthlies, 20 dates) and SPXW (the PM
      dailies, 40), NDX and NDXP, RUT and RUTW, VIX and
      VIXW (AM, the Wednesday settlement); XSP is one
      PM root. Massive refuses the indices (403) and
      answers five calls a minute — 23 names would take
      five minutes.
    · UW's list is read off open interest, so a date
      first listed today joins it the session after:
      Massive's contracts carried 2026-10-26 for SPY,
      AAPL and NVDA on the 12th, UW's breakdown did not.
      Every other date agreed (SPY, AAPL, NVDA, TSLA).
    · A ticker UW does not know answers 200 { data: [] }:
      no list, and the house's schedule stays for it.

  ASKED LAZILY: only the names the board shows, two
  calls at a time (UW Basic answers three at once, and
  the rail and other sessions share the key), once a
  name a New York day — kept for the day on this machine
  (slayer_listed_dates), so the next visit asks nothing.
  A refused call is asked again after half a minute; a
  name refused twice keeps the house's schedule until it
  answers.

  AM-SETTLEMENT AND HALF DAYS stay data/expiryClass.ts's
  rules: an AM root's last trading day is the session
  before its date.
==================================================
*/

import { useEffect, useSyncExternalStore } from 'react';
import { uwExpiryBreakdown } from './uw';

/** One listed expiration date of a name: the date the contract is listed under, and whether it settles on the morning */
export interface ListedDate {
  /** YYYY-MM-DD, as the vendor lists it */
  iso: string;
  am: boolean;
}

/** The roots a board name lists under — an index's AM monthlies are a root of their own */
const ROOTS: Record<string, { root: string; am: boolean }[]> = {
  SPX: [
    { root: 'SPXW', am: false },
    { root: 'SPX', am: true },
  ],
  SPXW: [{ root: 'SPXW', am: false }],
  NDX: [
    { root: 'NDXP', am: false },
    { root: 'NDX', am: true },
  ],
  RUT: [
    { root: 'RUTW', am: false },
    { root: 'RUT', am: true },
  ],
  VIX: [
    { root: 'VIX', am: true },
    { root: 'VIXW', am: true },
  ],
};
const rootsOf = (t: string) => ROOTS[t] ?? [{ root: t, am: false }];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STORE_KEY = 'slayer_listed_dates';
const RETRY_MS = 30_000;
const AT_ONCE = 2;

interface Entry {
  /** The list — empty when the vendor lists nothing for the name */
  dates: ListedDate[] | null;
  fails: number;
  /** Not to be asked before */
  waitUntil: number;
  flying: boolean;
}

let day = '';
const entries = new Map<string, Entry>();
const wanted = new Set<string>();
let version = 0;
const fns = new Set<() => void>();
const publish = () => {
  version++;
  for (const f of Array.from(fns)) f();
};

function readStore(d: string) {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw) as { day?: unknown; names?: Record<string, unknown> };
    if (o.day !== d || !o.names || typeof o.names !== 'object') return;
    for (const [t, v] of Object.entries(o.names)) {
      if (!Array.isArray(v)) continue;
      const dates = v.filter((x): x is ListedDate => !!x && typeof x.iso === 'string' && ISO.test(x.iso) && typeof x.am === 'boolean');
      entries.set(t, { dates, fails: 0, waitUntil: 0, flying: false });
    }
  } catch {
    /* no storage here — the lists are asked again */
  }
}

function writeStore() {
  try {
    const names: Record<string, ListedDate[]> = {};
    for (const [t, e] of entries) if (e.dates) names[t] = e.dates;
    localStorage.setItem(STORE_KEY, JSON.stringify({ day, names }));
  } catch {
    /* the lists stand for this visit alone */
  }
}

/** A new New York day starts the lists again */
function onDay(d: string) {
  if (d === day) return;
  day = d;
  entries.clear();
  readStore(d);
  publish();
}

let running = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

async function ask(t: string, e: Entry) {
  e.flying = true;
  running++;
  const answers = await Promise.all(rootsOf(t).map(r => uwExpiryBreakdown(r.root).then(a => ({ a, am: r.am }))));
  running--;
  e.flying = false;
  if (answers.every(x => x.a.ok)) {
    const seen = new Set<string>();
    const dates: ListedDate[] = [];
    for (const { a, am } of answers) {
      if (!a.ok) continue;
      for (const row of a.data) {
        if (!ISO.test(row.expiry) || seen.has(`${row.expiry}${am}`)) continue;
        seen.add(`${row.expiry}${am}`);
        dates.push({ iso: row.expiry, am });
      }
    }
    dates.sort((x, y) => (x.iso < y.iso ? -1 : x.iso > y.iso ? 1 : Number(x.am) - Number(y.am)));
    e.dates = dates;
    e.fails = 0;
    writeStore();
  } else {
    e.fails++;
    e.waitUntil = Date.now() + RETRY_MS;
  }
  publish();
  pump();
}

/** Ask the next wanted names, two at a time, while the tab is visible */
function pump() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const now = Date.now();
  let soonest = Infinity;
  for (const t of wanted) {
    if (running >= AT_ONCE) return;
    let e = entries.get(t);
    if (!e) {
      e = { dates: null, fails: 0, waitUntil: 0, flying: false };
      entries.set(t, e);
    }
    if (e.dates || e.flying) continue;
    if (e.waitUntil > now) {
      soonest = Math.min(soonest, e.waitUntil);
      continue;
    }
    void ask(t, e);
  }
  if (soonest < Infinity) timer = setTimeout(pump, soonest - now);
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => pump());

const subscribe = (fn: () => void) => {
  fns.add(fn);
  return () => fns.delete(fn);
};
const read = () => version;

/** Where the lists stand for a set of names */
export interface ListedDates {
  /** A name's listed dates — null while it is not in (asked, refused, or nothing listed): the house's schedule then */
  of: (ticker: string) => ListedDate[] | null;
  /** Every name has answered or been refused twice — the board can file */
  ready: boolean;
  /** Changes when a list lands */
  version: number;
}

const NONE: ListedDates = { of: () => null, ready: true, version: 0 };

/**
 * The listed dates of `names` on New York's day `nyDay` (YYYY-MM-DD). `on` false asks nothing and reads nothing — the
 * board files on the house's schedule as before.
 */
export function useListedDates(on: boolean, names: string[], nyDay: string): ListedDates {
  const v = useSyncExternalStore(subscribe, read, read);
  const key = names.join(',');
  useEffect(() => {
    if (!on) return;
    onDay(nyDay);
    const mine = key ? key.split(',') : [];
    for (const t of mine) wanted.add(t);
    pump();
    return () => {
      for (const t of mine) wanted.delete(t);
    };
  }, [on, key, nyDay]);
  if (!on) return NONE;
  if (day !== nyDay) return { of: () => null, ready: false, version: v };
  const of = (t: string): ListedDate[] | null => {
    const d = entries.get(t.toUpperCase())?.dates;
    return d && d.length ? d : null;
  };
  const ready = names.every(t => {
    const e = entries.get(t);
    return !!e && (e.dates !== null || e.fails >= 2);
  });
  return { of, ready, version: v };
}
