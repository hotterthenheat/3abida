/*
==================================================
  SLAYER TERMINAL - DEALER POSITIONING, ON THE
  EXECUTION CANVAS (core/paper/dealer.ts)

  The terminal already knows where dealer hedging
  sits — it is the whole of Pinpoint. What it has
  never done is put those levels BEHIND the place
  orders are placed, where a bracket can be laid
  against a wall on purpose instead of by memory.

  TWO SOURCES, one shape:

    NATIVE   the desk's own book (data/exposure.ts)
             for the instrument's underlying: gamma,
             delta and vanna per strike, on the
             expiry the reader picks. Nothing is
             fetched and nothing is invented.
    IMPORTED a CSV or a JSON array the reader pastes
             or drops — strike, gex, dex, vanna —
             for a desk that carries its own vendor
             numbers. Parsed here, kept per
             underlying, and marked as imported
             wherever it is drawn.

  EVERY LEVEL IS TRANSLATED INTO THE INSTRUMENT'S
  OWN PRICE before it is drawn: an NQ chart is
  QQQ × 41 + carry, so a QQQ strike becomes a level
  on the futures tape (market.ts owns that
  arithmetic; this file only calls it). A strike on
  a chart it does not belong to would be worse than
  no overlay at all.
==================================================
*/

import { useSyncExternalStore } from 'react';
import Simulator from '../simulator';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import { twinFamilyFor } from '../../data/indexTwins';
import type { ExposureExpiry } from '../../types/gex';
import { futuresBasis } from './market';
import { roundToTick, type Instrument } from './instruments';

export type DealerGreek = 'gex' | 'dex' | 'vanna';

export const DEALER_GREEKS: { key: DealerGreek; label: string; hint: string }[] = [
  { key: 'gex', label: 'Gamma', hint: 'Where hedging absorbs a move, and where it amplifies one' },
  { key: 'dex', label: 'Delta', hint: 'The directional share risk dealers carry at each strike' },
  { key: 'vanna', label: 'Vanna', hint: 'What a change in vol makes them buy or sell there' },
];

export interface DealerLevel {
  /** The level in the CHART's own price */
  price: number;
  /** The strike it came from, in the underlying's price */
  strike: number;
  /** Signed dollars of the chosen greek */
  value: number;
  /** |value| against the biggest on the board, 0..1 — the heat */
  heat: number;
  /** Contracts outstanding there */
  oi: number;
}

export interface DealerBook {
  underlying: string;
  greek: DealerGreek;
  expiry: ExposureExpiry;
  levels: DealerLevel[];
  /** The biggest |value| on the board — what the heat is scaled by */
  maxAbs: number;
  source: 'native' | 'imported';
  at: number;
}

/* ---- what the reader has imported ----------------------------------------------------------- */

export interface ImportedRow {
  strike: number;
  gex?: number;
  dex?: number;
  vanna?: number;
  oi?: number;
}

const IMPORT_KEY = 'slayer_paper_dealer_v1';

function loadImports(): Record<string, ImportedRow[]> {
  try {
    const raw = localStorage.getItem(IMPORT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ImportedRow[]>) : {};
  } catch {
    return {};
  }
}

let imports: Record<string, ImportedRow[]> = loadImports();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getImports = (): Record<string, ImportedRow[]> => imports;
export const useImports = (): Record<string, ImportedRow[]> => useSyncExternalStore(subscribe, getImports, getImports);

function commitImports(next: Record<string, ImportedRow[]>): void {
  imports = next;
  try {
    localStorage.setItem(IMPORT_KEY, JSON.stringify(next));
  } catch {
    /* the session keeps them */
  }
  listeners.forEach(fn => fn());
}

/**
 * Parse a paste: JSON array, or CSV with a header naming its columns.
 *
 * Accepts `strike,gex,dex,vanna,oi` in any order and any case, and tolerates
 * the two spellings a vendor file usually carries (`gamma`, `delta`). Throws
 * with a readable reason — the door shows it verbatim rather than swallowing
 * a bad file and drawing nothing.
 */
export function parseDealerRows(text: string): ImportedRow[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Nothing to read');
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed: unknown = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : (parsed as { levels?: unknown }).levels;
    if (!Array.isArray(arr)) throw new Error('The JSON must be an array of levels, or an object with a "levels" array');
    const rows = arr.map(r => {
      const o = r as Record<string, unknown>;
      const strike = Number(o.strike ?? o.Strike ?? o.price ?? o.level);
      if (!Number.isFinite(strike)) throw new Error('Every row needs a "strike"');
      return { strike, gex: num(o.gex ?? o.gamma ?? o.GEX), dex: num(o.dex ?? o.delta ?? o.DEX), vanna: num(o.vanna ?? o.Vanna), oi: num(o.oi ?? o.openInterest) };
    });
    if (rows.length === 0) throw new Error('The array is empty');
    return rows;
  }
  const lines = trimmed.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('A CSV needs a header row and at least one level');
  const head = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase());
  const at = (...names: string[]) => head.findIndex(h => names.includes(h));
  const iStrike = at('strike', 'price', 'level');
  if (iStrike < 0) throw new Error('The header needs a "strike" column');
  const iGex = at('gex', 'gamma');
  const iDex = at('dex', 'delta');
  const iVanna = at('vanna');
  const iOi = at('oi', 'openinterest', 'open_interest');
  const rows: ImportedRow[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(/[,;\t]/);
    const strike = Number(c[iStrike]);
    if (!Number.isFinite(strike)) continue;
    rows.push({ strike, gex: num(c[iGex]), dex: num(c[iDex]), vanna: num(c[iVanna]), oi: num(c[iOi]) });
  }
  if (rows.length === 0) throw new Error('No readable levels — check the strike column');
  return rows;
}

const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(String(v).replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

/** Keep a parsed set against an underlying — it is read by every chart on that name */
export function setImport(underlying: string, rows: ImportedRow[]): void {
  commitImports({ ...imports, [underlying.toUpperCase()]: rows });
}
export function clearImport(underlying: string): void {
  const next = { ...imports };
  delete next[underlying.toUpperCase()];
  commitImports(next);
}

/* ---- the book, in the chart's own price ------------------------------------------------------ */

/** A strike on the underlying, as a price on THIS instrument's tape */
function toChartPrice(inst: Instrument, strike: number): number | null {
  if (inst.kind === 'stock') return strike;
  if (inst.kind === 'future') {
    const fam = twinFamilyFor(inst.underlying);
    if (!fam) return null;
    return roundToTick(inst, strike * fam.ratio + futuresBasis(inst.underlying));
  }
  /* an option's tape is premium — a strike is not a level on it */
  return null;
}

/**
 * The dealer book for an instrument, ready to draw.
 *
 * Imported rows win when the reader has pasted some for this name; otherwise
 * the desk's own exposure profile is read at the chosen expiry. Returns null
 * on a premium tape (an option chart), where a strike is not a price.
 */
export function dealerBook(inst: Instrument, greek: DealerGreek, expiry: ExposureExpiry = '0DTE', half: StrikeWindow = 20): DealerBook | null {
  if (inst.kind === 'option' || inst.kind === 'spread') return null;
  const underlying = inst.underlying.toUpperCase();
  const mine = imports[underlying];
  const at = Date.now();

  if (mine && mine.length) {
    const levels: DealerLevel[] = [];
    let maxAbs = 0;
    for (const r of mine) {
      const value = Number(r[greek] ?? 0);
      const price = toChartPrice(inst, r.strike);
      if (price == null) continue;
      maxAbs = Math.max(maxAbs, Math.abs(value));
      levels.push({ price, strike: r.strike, value, heat: 0, oi: r.oi ?? 0 });
    }
    if (!levels.length) return null;
    for (const l of levels) l.heat = maxAbs > 0 ? Math.abs(l.value) / maxAbs : 0;
    return { underlying, greek, expiry, levels, maxAbs, source: 'imported', at };
  }

  if (!Simulator.isSeeded(underlying)) return null;
  const profile = buildExposureProfile(Simulator.snapshotFor(underlying), expiry, half);
  const levels: DealerLevel[] = [];
  let maxAbs = 0;
  for (const s of profile.strikes) {
    const value = s[greek].net;
    const price = toChartPrice(inst, s.strike);
    if (price == null) continue;
    maxAbs = Math.max(maxAbs, Math.abs(value));
    levels.push({ price, strike: s.strike, value, heat: 0, oi: s.oi });
  }
  if (!levels.length) return null;
  for (const l of levels) l.heat = maxAbs > 0 ? Math.abs(l.value) / maxAbs : 0;
  return { underlying, greek, expiry, levels, maxAbs, source: 'native', at };
}

/** The thickness of a band around a level, in the chart's price — half a strike step */
export function bandHalfWidth(levels: DealerLevel[]): number {
  if (levels.length < 2) return 0;
  const sorted = [...levels].map(l => l.price).sort((a, b) => a - b);
  let step = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1];
    if (d > 1e-9) step = Math.min(step, d);
  }
  return Number.isFinite(step) ? step / 2 : 0;
}
