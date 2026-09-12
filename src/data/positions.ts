/*
==================================================
  SLAYER TERMINAL - YOUR POSITIONS (data/positions.ts)

  The book made personal (the Pinpoint roadmap,
  2026-09-05, step 6 beside the Board). A position
  is a contract the reader owns or sold: a strike, a
  call or a put, how many, when it expires. The
  store keeps them per name in localStorage; the
  READ puts each one on the dealer map and says, in
  plain English, what the hedging does to it:

    "Your 5 SPY 455 calls sit on the put wall,
     0.2% below spot. Hedging works against you —
     above the flip at 457.50 dealers sell into
     rallies. Expires today at 4:00."

  NOTHING HERE IS A FORECAST OF PRICE. It is the
  same map every other surface reads (the 0DTE
  profile: walls, flip, pin, supreme, the net gamma
  at each strike) pointed at the reader's own
  strikes. The words follow the house convention:
  net gamma ABOVE zero at a strike amplifies a move
  through it, BELOW zero absorbs it; spot above the
  flip = dealers absorb (they sell rallies and buy
  dips), below it = they amplify.

  Positions can also come from the Tracker — a
  contract tracked on Compass is one the reader
  cares about, so the box offers to bring those in.
==================================================
*/

import { useMemo, useSyncExternalStore } from 'react';
import { expiryFor, isoDate, sessionsBetween, today } from '../core/calendar';
import { SLEEVE_BY_KEY } from '../types/compass';
import type { ExposureProfileData } from '../types/gex';
import type { TrackedSetup } from '../types/tracker';

export type Right = 'C' | 'P';
export type Side = 'long' | 'short';

export interface Position {
  id: string;
  ticker: string;
  strike: number;
  right: Right;
  /** long = you own it, short = you sold it */
  side: Side;
  contracts: number;
  /** YYYY-MM-DD */
  expiry: string;
  /** What you paid (or collected) per contract, in premium points — optional;
      without it the card measures profit against today's value */
  entry?: number;
  source: 'you' | 'tracker';
  addedAt: number;
}

const KEY = 'slayer_positions_v1';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function isPosition(x: unknown): x is Position {
  if (typeof x !== 'object' || x === null) return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.ticker === 'string' &&
    typeof p.strike === 'number' &&
    Number.isFinite(p.strike) &&
    (p.right === 'C' || p.right === 'P') &&
    (p.side === 'long' || p.side === 'short') &&
    typeof p.contracts === 'number' &&
    typeof p.expiry === 'string' &&
    ISO.test(p.expiry) &&
    (p.entry === undefined || (typeof p.entry === 'number' && Number.isFinite(p.entry) && p.entry >= 0)) &&
    (p.source === 'you' || p.source === 'tracker') &&
    typeof p.addedAt === 'number'
  );
}

function load(): Position[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isPosition) : [];
  } catch {
    return [];
  }
}

let positions: Position[] = load();
const listeners = new Set<() => void>();

function commit(next: Position[]): void {
  positions = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable — the session keeps its list in memory */
  }
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => positions;

/** Every position, or one name's — stable identity until something changes */
export function getPositions(ticker?: string): Position[] {
  return ticker ? positions.filter(p => p.ticker === ticker) : positions;
}

export function usePositions(ticker: string | null | undefined): Position[] {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(() => (ticker ? all.filter(p => p.ticker === ticker) : []), [all, ticker]);
}

let seq = 0;
const newId = () => `pos-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function addPosition(p: Omit<Position, 'id' | 'addedAt' | 'source'> & { source?: Position['source'] }): Position {
  const pos: Position = { ...p, source: p.source ?? 'you', id: newId(), addedAt: Date.now() };
  commit([...positions, pos]);
  return pos;
}

export function updatePosition(id: string, patch: Partial<Pick<Position, 'strike' | 'right' | 'side' | 'contracts' | 'expiry' | 'entry'>>): void {
  commit(
    positions.map(p => {
      if (p.id !== id) return p;
      const next = { ...p, ...patch };
      if (patch.entry === undefined && 'entry' in patch) delete next.entry;
      return next;
    })
  );
}

export function removePosition(id: string): void {
  commit(positions.filter(p => p.id !== id));
}

/** A tracked Compass contract as a position: one long contract on the sleeve's expiry */
export function positionFromTracked(t: TrackedSetup): Omit<Position, 'id' | 'addedAt'> {
  const dte = SLEEVE_BY_KEY[t.sleeve ?? 'odte']?.dte ?? 0;
  return { ticker: t.ticker, strike: t.strike, right: t.right, side: 'long', contracts: 1, expiry: isoDate(expiryFor(dte).date), source: 'tracker' };
}

/** Tracked contracts on this name that are not in the list yet (by strike and right) */
export function trackedNotIn(tracked: TrackedSetup[], ticker: string, have: Position[]): TrackedSetup[] {
  return tracked.filter(t => t.ticker === ticker && !have.some(p => p.strike === t.strike && p.right === t.right));
}

/** Today's session as an expiry string — the default for a new position */
export const todayExpiry = (): string => isoDate(expiryFor(0).date);

// ---- THE READ: the position on the dealer map, in words --------------------------

export type Verdict = 'with' | 'against' | 'mixed';

export interface PositionRead {
  /** "on the put wall · the supreme · 0.20% below spot" */
  sits: string;
  verdict: Verdict;
  /** The hedging sentence, no subject: "hedging works against you — …" */
  hedging: string;
  /** Net gamma at the strike, $ per 1% move; 0 when the strike is outside the window */
  gammaHere: number;
  /** What that gamma does to a move through the strike */
  through: 'slows it' | 'speeds it up' | null;
  /** "today at 4:00" · "next trading day" · "in 5 trading days" · "expired" */
  expires: string;
  /** Trading sessions until expiry; -1 once it has passed */
  sessions: number;
  /** The whole thing, subject included — the line the gutter chip and the box print */
  sentence: string;
}

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** "5 calls" / "1 put" */
export function contractWords(p: Position): string {
  const kind = p.right === 'C' ? 'call' : 'put';
  return `${p.contracts} ${kind}${p.contracts === 1 ? '' : 's'}`;
}

/** "Your 5 455 calls" · "Your 455 call" · "The 2 455 puts you sold" · "The 455 put you sold" */
export function subjectWords(p: Position): string {
  const one = p.contracts === 1;
  const kind = `${fmtStrike(p.strike)} ${p.right === 'C' ? 'call' : 'put'}${one ? '' : 's'}`;
  const count = one ? '' : `${p.contracts} `;
  return p.side === 'long' ? `Your ${count}${kind}` : `The ${count}${kind} you sold`;
}

function expiryWords(expiry: string): { expires: string; sessions: number } {
  const [y, m, d] = expiry.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const t = today();
  if (date < t) return { expires: 'expired', sessions: -1 };
  const sessions = sessionsBetween(t, date);
  if (sessions === 0) return { expires: 'today at 4:00', sessions };
  if (sessions === 1) return { expires: 'next trading day', sessions };
  return { expires: `in ${sessions} trading days`, sessions };
}

export function readPosition(p: Position, profile: ExposureProfileData): PositionRead {
  const L = profile.levels;
  const spot = L.spot;
  const wantsUp = (p.right === 'C') === (p.side === 'long');
  const row = profile.strikes.find(s => eq(s.strike, p.strike));
  const gammaHere = row ? row.gex.net : 0;
  const big = profile.maxAbs.gex > 0 && Math.abs(gammaHere) >= 0.35 * profile.maxAbs.gex;
  const through: PositionRead['through'] = !row || !big ? null : gammaHere > 0 ? 'speeds it up' : 'slows it';

  /* Where it sits — the named level it is on, else where against spot and the walls */
  const on: string[] = [];
  if (eq(p.strike, L.callWall)) on.push('on the call wall');
  if (eq(p.strike, L.putWall)) on.push('on the put wall');
  if (eq(p.strike, L.pin)) on.push('on the gamma pin');
  if (eq(p.strike, L.supreme)) on.push('the supreme strike');
  const d = ((p.strike - spot) / spot) * 100;
  const rel = Math.abs(d) < 0.05 ? 'at spot' : `${Math.abs(d).toFixed(2)}% ${d > 0 ? 'above' : 'below'} spot`;
  const zone = p.strike > L.callWall ? 'past the call wall' : p.strike < L.putWall ? 'under the put wall' : 'between the walls';
  const sits = on.length ? `${on.join(' · ')} · ${rel}` : `${rel} · ${zone}`;

  /* What the hedging does to it — which side of the flip spot is on decides
     whether dealers lean against a move or chase it; a wall between spot and
     the strike is the thing in the way */
  const absorbing = spot > L.flip;
  const flip = fmtStrike(L.flip);
  let verdict: Verdict;
  let hedging: string;
  if (wantsUp) {
    const wallInWay = p.strike > L.callWall && L.callWall > spot;
    if (absorbing) {
      verdict = 'against';
      hedging = `hedging works against you — above the flip at ${flip} dealers sell into rallies`;
      if (wallInWay) hedging += `, and the call wall at ${fmtStrike(L.callWall)} stands between spot and your strike`;
    } else if (wallInWay) {
      verdict = 'mixed';
      hedging = `hedging works with you under the flip at ${flip} — dealers chase rallies — but the call wall at ${fmtStrike(L.callWall)} stands between spot and your strike`;
    } else {
      verdict = 'with';
      hedging = `hedging works with you while price is under the flip at ${flip} — dealers chase rallies; above it they sell into them`;
    }
  } else {
    const wallInWay = p.strike < L.putWall && L.putWall < spot;
    if (!absorbing) {
      if (wallInWay) {
        verdict = 'mixed';
        hedging = `hedging works with you under the flip at ${flip} — dealers chase the move down — but the put wall at ${fmtStrike(L.putWall)} stands between spot and your strike`;
      } else {
        verdict = 'with';
        hedging = `hedging works with you while price is under the flip at ${flip} — dealers chase the move down`;
      }
    } else {
      verdict = 'against';
      hedging = `hedging works against you until price is under the flip at ${flip} — dealers buy the dips; below it they chase them`;
      if (wallInWay) hedging += `, and the put wall at ${fmtStrike(L.putWall)} stands between spot and your strike`;
    }
  }

  const { expires, sessions } = expiryWords(p.expiry);
  const sentence = `${subjectWords(p)} sit${p.contracts === 1 ? 's' : ''} ${sits}. ${hedging[0].toUpperCase()}${hedging.slice(1)}. ${sessions < 0 ? 'Expired.' : `Expires ${expires}.`}`;
  return { sits, verdict, hedging, gammaHere, through, expires, sessions, sentence };
}

/** The one line for the box: the tally, then the position nearest spot in full */
export function positionsLine(ticker: string, positions: Position[], reads: ReadonlyMap<string, PositionRead>, spot: number): string | null {
  if (!positions.length) return null;
  const tally = { with: 0, against: 0, mixed: 0 };
  for (const p of positions) {
    const r = reads.get(p.id);
    if (r) tally[r.verdict]++;
  }
  const lead = [...positions].sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))[0];
  const leadRead = reads.get(lead.id);
  const n = positions.length;
  const head = n === 1 ? '' : `${n} positions on ${ticker} — hedging works with ${tally.with}, against ${tally.against}${tally.mixed ? `, both ways for ${tally.mixed}` : ''}. Nearest spot: `;
  return leadRead ? `${head}${leadRead.sentence}` : head;
}
