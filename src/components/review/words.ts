/* REVIEW · how a figure is said (one place, so the desk, the report and the journal say it the same way) */

import { clockWords, dayWords } from '../../data/review/tape';
import type { Moment } from '../../data/review/engine';

const MINUS = '−';
export const usd = (v: number, digits = 2): string => `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
/** "+$1,240.50" · "−$310.00" · "$0.00" */
export const usdSigned = (v: number, digits = 2): string => (Math.abs(v) < 0.005 ? usd(0, digits) : `${v > 0 ? '+' : MINUS}${usd(v, digits)}`);
/** "+0.42R" */
export const rWords = (r: number): string => `${r >= 0 ? '+' : MINUS}${Math.abs(r).toFixed(2)}R`;
export const pct = (v: number): string => `${Math.round(v * 100)}%`;
/** The direction's ink for a signed figure — flat money is plain. It carries the direction as a mark too (`dir-up` /
    `dir-down`, theme/tokens.css): under the blue–orange pair the figure wears ▲ or ▼, so a gain and a loss never rest on
    hue alone (Settings › Appearance, 2026-10-10) — every figure inked here gets it, wherever it is printed */
export const dirInk = (v: number): string => (Math.abs(v) < 0.005 ? 'text-textSecondary' : v > 0 ? 'text-bull dir-up' : 'text-bear dir-down');
/** "Mar 14 · 10:42" */
export const momentWords = (m: Moment): string => `${dayWords(m.day)} · ${clockWords(m.minute)}`;
/** Session minutes as a trader would say them. `dayMin`: the minutes in a trading day of that kind — a replayed day's 390, a
    paper account's real 1,440. Days, not "1.0 sessions" (Noah's picture of the journal, 2026-09-20). */
export const heldWords = (min: number, dayMin = 390): string => {
  if (min < 60) return `${Math.max(1, Math.round(min))}m`;
  if (min < dayMin) return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
  const d = min / dayMin;
  const n = d < 10 ? +d.toFixed(1) : Math.round(d);
  return `${n} ${n === 1 ? 'day' : 'days'}`;
};
/** A signed figure with the true minus (U+2212), never a hyphen: "+0.42" · "−0.50" · "−0.3%" with `unit` */
export const numSigned = (v: number, digits = 2, unit = ''): string => `${v > 0 ? '+' : v < 0 ? MINUS : ''}${Math.abs(v).toFixed(digits)}${unit}`;
/** A figure that may be below nothing, with the true minus and no plus: "0.54" · "−0.54" */
export const num = (v: number, digits = 2): string => `${v < 0 ? MINUS : ''}${Math.abs(v).toFixed(digits)}`;
/** WHAT PRACTICE TRADES — one sentence for both desks (the audit's PR-20: Paper said "calls, puts and debit spreads", the
    Backtest "long calls and puts" while its ticket offered a spread) */
export const TRADES_WORDS = 'options only — calls and puts, and debit spreads, paid in cash';
