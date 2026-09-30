/*
==================================================
  SLAYER TERMINAL - THE READER'S OWN REASONS
  (data/flowReasons.ts)

  Watchers ships six reasons the DESK watches
  for. This is the door for the reader's own: name
  a set of conditions over the day book, and every
  contract that meets them joins the same feed,
  under the reader's own words.

  ONE BOOK, ONE MORE READER. A reason is a filter
  over `BookContract` — the identical rows the
  screener, the windows and the footprints all
  read. A reader-made reason can no more invent a
  number than a house rule can.

  WHY EVERY TERM MUST HOLD (and there is no "or").
  A reason answers "why is this in front of me" in
  one sentence. Give it branches and the sentence
  stops being answerable — the reader is then
  maintaining a query, not reading a tape. Two
  ideas are two reasons, and the feed says which
  one caught the row.

  INFORMATION, NOT ADVICE. A reason describes the
  contracts it finds. It never scores them, ranks
  them, or suggests a trade — the builder shows how
  many rows it catches today so the reader can see
  whether they have written something loud or
  something rare, and that is the whole verdict.
==================================================
*/

import { useCallback, useSyncExternalStore } from 'react';
import type { BookContract } from '../types/trace';
import { syncAcrossTabs } from './crossTab';

// ---- the vocabulary ---------------------------------------------------------

export type ReasonField =
  | 'premium'
  | 'volume'
  | 'volOverOI'
  | 'deltaOIPct'
  | 'sweepPct'
  | 'multiPct'
  | 'floorPct'
  | 'askPct'
  | 'chgPct'
  | 'ivChg'
  | 'dte'
  | 'otmBy'
  | 'last'
  | 'earnDays'
  | 'oiStreak'
  | 'volGtOiStreak';

export type Comparator = 'atLeast' | 'atMost';

export interface ReasonTerm {
  field: ReasonField;
  cmp: Comparator;
  value: number;
}

export interface UserReason {
  id: string;
  /** The reader's handle for it — the chip label and the Reason column's lead */
  name: string;
  right: 'ANY' | 'C' | 'P';
  terms: ReasonTerm[];
  createdAt: number;
}

interface FieldMeta {
  /** Dropdown label — the fact, named the way the tables name it */
  label: string;
  /** Suffix in the value box */
  unit: string;
  /** Sensible starting value so a fresh term is already a real question */
  preset: number;
  step: number;
  /** How the value reads inside the sentence */
  fmt: (v: number) => string;
  /**
   * The clause this term contributes. Written per comparator because English
   * does not negate cleanly — "under 40% bought at the ask" is a different
   * sentence from "40%+ bought at the ask", not the same one with a "not".
   */
  clause: (cmp: Comparator, v: number) => string;
  /** null = the row cannot answer this question (no earnings date, etc.) */
  read: (r: BookContract) => number | null;
}

const usd = (v: number) =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`
    : v >= 1_000
      ? `$${Math.round(v / 1_000)}K`
      : `$${v}`;
const num = (v: number) => v.toLocaleString('en-US');
const over = (cmp: Comparator) => (cmp === 'atLeast' ? 'over' : 'under');

export const REASON_FIELDS: Record<ReasonField, FieldMeta> = {
  premium: {
    label: 'Money traded today',
    unit: '$',
    preset: 1_000_000,
    step: 250_000,
    fmt: usd,
    clause: (c, v) => `${over(c)} ${usd(v)} traded`,
    read: r => r.premium,
  },
  volume: {
    label: 'Contracts traded',
    unit: '',
    preset: 5000,
    step: 500,
    fmt: num,
    clause: (c, v) => `${over(c)} ${num(v)} contracts traded`,
    read: r => r.volume,
  },
  volOverOI: {
    label: 'Traded vs open interest',
    unit: '×',
    preset: 2,
    step: 0.25,
    fmt: v => `${v}×`,
    clause: (c, v) =>
      c === 'atLeast' ? `traded over ${v}× its open interest` : `traded under ${v}× its open interest`,
    read: r => r.volOverOI,
  },
  deltaOIPct: {
    label: 'Open interest change',
    unit: '%',
    preset: 25,
    step: 5,
    fmt: v => `${v}%`,
    clause: (c, v) =>
      c === 'atLeast' ? `open interest up ${v}% or more` : `open interest change under ${v}%`,
    read: r => r.deltaOIPct,
  },
  sweepPct: {
    label: 'Swept share',
    unit: '%',
    preset: 30,
    step: 5,
    fmt: v => `${v}%`,
    clause: (c, v) => `${over(c)} ${v}% of it swept`,
    read: r => r.sweepPct,
  },
  multiPct: {
    label: 'Multi-leg share',
    unit: '%',
    preset: 40,
    step: 5,
    fmt: v => `${v}%`,
    clause: (c, v) => `${over(c)} ${v}% of it multi-leg`,
    read: r => r.multiPct,
  },
  floorPct: {
    label: 'Floor share',
    unit: '%',
    preset: 20,
    step: 5,
    fmt: v => `${v}%`,
    clause: (c, v) => `${over(c)} ${v}% crossed on the floor`,
    read: r => r.floorPct,
  },
  askPct: {
    label: 'Bought at the ask',
    unit: '%',
    preset: 60,
    step: 5,
    fmt: v => `${v}%`,
    clause: (c, v) => `${over(c)} ${v}% bought at the ask`,
    read: r => r.askPct,
  },
  chgPct: {
    label: 'Contract price change',
    unit: '%',
    preset: 10,
    step: 5,
    fmt: v => `${v}%`,
    clause: (c, v) =>
      c === 'atLeast' ? `the contract up ${v}% or more today` : `the contract under ${v}% today`,
    read: r => r.chgPct,
  },
  ivChg: {
    label: 'Implied volatility change',
    unit: 'pts',
    preset: 2,
    step: 0.5,
    fmt: v => `${v} pts`,
    clause: (c, v) =>
      c === 'atLeast' ? `implied volatility up ${v} points or more` : `implied volatility under ${v} points`,
    read: r => r.ivChg,
  },
  dte: {
    label: 'Days to expiry',
    unit: 'd',
    preset: 7,
    step: 1,
    fmt: v => `${v}d`,
    clause: (c, v) => (c === 'atMost' ? `${v} days or less to expiry` : `${v} days or more to expiry`),
    read: r => r.dte,
  },
  otmBy: {
    label: 'Out of the money by',
    unit: '%',
    preset: 5,
    step: 1,
    fmt: v => `${v}%`,
    clause: (c, v) =>
      c === 'atLeast' ? `at least ${v}% out of the money` : `no more than ${v}% out of the money`,
    /* Right-aware, because the row's raw otmPct is a SIGNED distance from spot:
       +5% is out of the money on a call and in the money on a put. The reader
       asked about moneyness, so the field answers in moneyness. */
    read: r => (r.right === 'C' ? r.otmPct : -r.otmPct),
  },
  last: {
    label: 'Contract price',
    unit: '$',
    preset: 2,
    step: 0.5,
    fmt: v => `$${v.toFixed(2)}`,
    clause: (c, v) => `${over(c)} $${v.toFixed(2)} a contract`,
    read: r => r.last,
  },
  earnDays: {
    label: 'Earnings within',
    unit: 'd',
    preset: 5,
    step: 1,
    fmt: v => `${v}d`,
    clause: (c, v) =>
      c === 'atMost' ? `earnings ${v} days away or less` : `earnings more than ${v} days out`,
    read: r => r.earnDays,
  },
  oiStreak: {
    label: 'Sessions open interest has climbed',
    unit: 'd',
    preset: 3,
    step: 1,
    fmt: v => `${v}d`,
    clause: (c, v) =>
      c === 'atLeast' ? `open interest up ${v} sessions running` : `under ${v} sessions of climbing interest`,
    read: r => r.oiStreak,
  },
  volGtOiStreak: {
    label: 'Sessions trading past its interest',
    unit: 'd',
    preset: 2,
    step: 1,
    fmt: v => `${v}d`,
    clause: (c, v) =>
      c === 'atLeast' ? `trading past its interest ${v} sessions running` : `under ${v} such sessions`,
    read: r => r.volGtOiStreak,
  },
};

/** Dropdown order — the facts a reader reaches for first, first. */
export const REASON_FIELD_ORDER: ReasonField[] = [
  'premium',
  'volume',
  'volOverOI',
  'deltaOIPct',
  'sweepPct',
  'askPct',
  'floorPct',
  'multiPct',
  'chgPct',
  'ivChg',
  'last',
  'dte',
  'otmBy',
  'earnDays',
  'oiStreak',
  'volGtOiStreak',
];

// ---- reading a reason -------------------------------------------------------

/**
 * Every term must hold. A field the row cannot answer (an earnings distance on
 * a name with no date in the window) FAILS rather than passes — silence is not
 * agreement, and a reason that fires on missing data is a reason that lies.
 */
export function reasonMatches(reason: UserReason, r: BookContract): boolean {
  if (reason.right !== 'ANY' && r.right !== reason.right) return false;
  for (const t of reason.terms) {
    const v = REASON_FIELDS[t.field].read(r);
    if (v === null || !Number.isFinite(v)) return false;
    if (t.cmp === 'atLeast' ? v < t.value : v > t.value) return false;
  }
  return true;
}

/** How many of today's contracts this reason catches — the builder's verdict. */
export const reasonMatchCount = (reason: UserReason, rows: BookContract[]): number =>
  rows.reduce((n, r) => n + (reasonMatches(reason, r) ? 1 : 0), 0);

/**
 * The reason's own sentence, composed from its terms — this is what the Reason
 * column prints, exactly like a house rule's phrase. One generator: the reader
 * never writes the explanation, so the words can never drift from the test.
 */
export function reasonSentence(reason: UserReason): string {
  const side = reason.right === 'C' ? 'Calls' : reason.right === 'P' ? 'Puts' : null;
  const parts = reason.terms.map(t => REASON_FIELDS[t.field].clause(t.cmp, t.value));
  if (parts.length === 0) return side ? `Any ${side.toLowerCase().slice(0, -1)} on the book` : 'Anything on the book';
  const body = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  /* The side leads as a subject, not as another comma clause: every clause is
     written to follow a noun ("over $1M traded", "60%+ bought at the ask"), so
     "Calls over $1M traded" reads as a sentence and "Calls, over $1M traded"
     reads as a list with a stray item at the front. */
  return side ? `${side} ${body}` : cap(body);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A short handle for a reason with no name yet — its loudest term. */
export function suggestedName(terms: ReasonTerm[]): string {
  if (terms.length === 0) return 'My reason';
  return REASON_FIELDS[terms[0].field].label;
}

// ---- the store --------------------------------------------------------------

/*
  Module-level, not component state — the same argument the chart's alert store
  makes: the Watchers page, its filter chips and its builder all read this
  list, and a second writer would silently overwrite the first. Persisted with a
  self-healing validator, so a malformed key from an older shape is dropped on
  read rather than taking the page down.
*/

const STORE_KEY = 'slayer_flow_reasons_v1';

/** Past this the feed stops being a feed and the chip row stops being readable. */
export const MAX_REASONS = 10;
/** One sentence's worth. More terms than this and nobody can read the clause. */
export const MAX_TERMS = 5;

const isFin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const readTerm = (t: unknown): ReasonTerm | null => {
  if (typeof t !== 'object' || t === null) return null;
  const c = t as Record<string, unknown>;
  if (typeof c.field !== 'string' || !(c.field in REASON_FIELDS)) return null;
  if (c.cmp !== 'atLeast' && c.cmp !== 'atMost') return null;
  if (!isFin(c.value)) return null;
  return { field: c.field as ReasonField, cmp: c.cmp, value: c.value };
};

const readReason = (a: unknown): UserReason | null => {
  if (typeof a !== 'object' || a === null) return null;
  const c = a as Record<string, unknown>;
  if (typeof c.id !== 'string' || typeof c.name !== 'string') return null;
  const right = c.right === 'C' || c.right === 'P' ? c.right : 'ANY';
  if (!Array.isArray(c.terms)) return null;
  const terms: ReasonTerm[] = [];
  for (const t of c.terms) {
    const term = readTerm(t);
    if (term) terms.push(term);
  }
  if (terms.length === 0) return null; // a reason with no test catches everything
  return {
    id: c.id,
    name: c.name.slice(0, 28),
    right,
    terms: terms.slice(0, MAX_TERMS),
    createdAt: isFin(c.createdAt) ? c.createdAt : 0,
  };
};

const load = (): UserReason[] => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: UserReason[] = [];
    for (const item of parsed) {
      const r = readReason(item);
      if (r) out.push(r);
    }
    return out.slice(0, MAX_REASONS);
  } catch {
    return [];
  }
};

const save = (list: UserReason[]) => {
  try {
    if (list.length === 0) localStorage.removeItem(STORE_KEY);
    else localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    /* storage full, private, or switched off — never fatal */
  }
};

/* The cached array IS the snapshot: useSyncExternalStore compares by identity,
   so a fresh array per read would re-render forever. */
let cache: UserReason[] | null = null;
const subs = new Set<() => void>();
/* ANOTHER TAB'S WRITE IS THIS TAB'S NEWS (data/crossTab.ts). The cache
   above is read once and written whole, so without this a second tab
   silently overwrites the first one's work. */
syncAcrossTabs(STORE_KEY, () => {
  cache = load();
  subs.forEach(fn => fn());
});


export const getReasons = (): UserReason[] => {
  if (!cache) cache = load();
  return cache;
};

const write = (next: UserReason[]) => {
  cache = next;
  save(next);
  subs.forEach(fn => fn());
};

let seq = 0;
const freshId = () => `ur-${Date.now().toString(36)}-${++seq}`;

/** Returns the saved reason, or null when the shelf is full or it tests nothing. */
export function saveReason(draft: Omit<UserReason, 'id' | 'createdAt'> & { id?: string }): UserReason | null {
  if (draft.terms.length === 0) return null;
  const list = getReasons();
  const clean: UserReason = {
    id: draft.id ?? freshId(),
    name: (draft.name.trim() || suggestedName(draft.terms)).slice(0, 28),
    right: draft.right,
    terms: draft.terms.slice(0, MAX_TERMS),
    createdAt: list.find(r => r.id === draft.id)?.createdAt ?? Date.now(),
  };
  const at = list.findIndex(r => r.id === clean.id);
  if (at === -1 && list.length >= MAX_REASONS) return null;
  write(at === -1 ? [...list, clean] : list.map(r => (r.id === clean.id ? clean : r)));
  return clean;
}

export function removeReason(id: string): void {
  const list = getReasons();
  const next = list.filter(r => r.id !== id);
  if (next.length !== list.length) write(next);
}

/**
 * A fingerprint of the whole shelf. The alert builder caches its feed by day and
 * minute; without the reader's reasons in that key, editing one would leave the
 * old feed on screen until the clock ticked.
 */
export const reasonsSignature = (list: UserReason[]): string =>
  list.map(r => `${r.id}:${r.right}:${r.terms.map(t => `${t.field}${t.cmp}${t.value}`).join('|')}`).join(';');

export function useReasons(): UserReason[] {
  const subscribe = useCallback((fn: () => void) => {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  }, []);
  return useSyncExternalStore(subscribe, getReasons, getReasons);
}
