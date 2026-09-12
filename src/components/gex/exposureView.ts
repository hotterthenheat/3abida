/*
  The Ledger's pointer contract: a cell is one strike at one expiry, and
  the wrapper turns it into the house readout card.

  THE GREEK PICK (Noah, 2026-09-10: "the greek choosing button … you can
  either choose 1 or 2 or 3 or 4 or all"): the calendar and the ladder draw
  any set of the five greeks. The pick is a list of values for the house's
  DropdownMulti — the greeks ticked, or the one word 'all'. Nothing ticked
  reads as all five. Ticking 'all' clears the greeks; ticking a greek clears
  'all'. `pickGreeks` turns the list into the greeks drawn, in the book's
  own order.
*/
import { GREEKS, type Greek } from '../../data/exposureSurface';
import type { MultiOption } from '../ui/DropdownMulti';

export type ViewGreek = Greek | 'all';

export interface SurfaceCell {
  strike: number;
  /** Index into surface.expiries */
  e: number;
}

export const GREEK_PICK_OPTIONS: MultiOption[] = [
  { value: 'all', label: 'All five', hint: 'GEX, DEX, VEX, vanna and charm side by side' },
  { value: 'gex', label: 'GEX', hint: 'Gamma — how hard dealers must hedge a move' },
  { value: 'dex', label: 'DEX', hint: 'Delta — which way dealers are leaning' },
  { value: 'vex', label: 'VEX', hint: 'Vega — how a change in volatility moves them' },
  { value: 'vanna', label: 'VANNA', hint: 'How their hedges re-price when vol moves — the stock a vol drop makes them buy or sell' },
  { value: 'charm', label: 'CHARM', hint: "The clock's pull on their hedges — the stock the passing day makes them buy or sell" },
];

const isGreek = (v: string): v is Greek => (GREEKS as string[]).includes(v);

/** The greeks drawn for a pick — the book's order, all five for 'all' or nothing */
export function pickGreeks(values: readonly string[]): Greek[] {
  const ticked = GREEKS.filter(g => values.includes(g));
  return values.includes('all') || ticked.length === 0 ? GREEKS : ticked;
}

/** The pick after the reader ticks or unticks — 'all' and the greeks never stand together */
export function nextGreekPick(prev: readonly string[], next: readonly string[]): string[] {
  const hadAll = prev.includes('all');
  const hasAll = next.includes('all');
  if (hasAll && !hadAll) return ['all'];
  const greeks = next.filter(isGreek);
  if (greeks.length === 0 || greeks.length === GREEKS.length) return ['all'];
  return GREEKS.filter(g => greeks.includes(g));
}
