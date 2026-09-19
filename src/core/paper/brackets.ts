/*
==================================================
  SLAYER TERMINAL - WHAT A BRACKET IS WORTH
  (core/paper/brackets.ts)

  The arithmetic behind the tags on the chart and
  the HUD in the position tool, in one place so the
  two can never disagree: how far a level is from
  the entry in TICKS, what it is worth in DOLLARS
  if it fills, and the reward against the risk.

  IT LIVES OUTSIDE THE ENGINE on purpose (the
  sprint's rule): nothing here mutates anything. It
  reads a position and a price and returns words
  and numbers.

  THE MULTIPLIER IS NOT OPTIONAL. A point of NQ is
  $20 and a point of ES is $50; the same 40-tick
  stop is $200 on one and $500 on the other. Every
  figure below goes through the instrument's own
  multiplier (instruments.ts), so a tag never
  prints a futures P&L in share money.
==================================================
*/

import { fmtMoney, type Instrument } from './instruments';
import type { Position, Side } from './engine';

export interface LevelRead {
  /** Distance from the reference, in the instrument's own ticks */
  ticks: number;
  /** Dollars if it fills at this price, signed against the position */
  pnl: number;
  /** "+$975.00" */
  money: string;
  /** "39 ticks" */
  tickWords: string;
}

/** Ticks between two prices — always positive */
export const ticksBetween = (inst: Instrument, a: number, b: number): number => Math.round(Math.abs(a - b) / inst.tickSize);

/** What `qty` units of this instrument make between two prices, signed by the side */
export function pnlBetween(inst: Instrument, entry: number, exit: number, qty: number): number {
  return (exit - entry) * qty * inst.multiplier;
}

/**
 * A protective level read against an open position: how far it sits from the
 * average entry and what it pays or costs if the tape gets there.
 *
 * `qty` is SIGNED (long +, short −), so a target above a long and a target
 * below a short both come back positive without the caller doing the algebra.
 */
export function readLevel(inst: Instrument, position: Pick<Position, 'avgPrice' | 'qty'>, price: number): LevelRead {
  const ticks = ticksBetween(inst, price, position.avgPrice);
  const pnl = pnlBetween(inst, position.avgPrice, price, position.qty);
  return { ticks, pnl, money: fmtMoney(pnl), tickWords: `${ticks} ${ticks === 1 ? 'tick' : 'ticks'}` };
}

/** The same read for an order that has not been filled yet — measured off a planned entry */
export function readPlanned(inst: Instrument, entry: number, price: number, qty: number, side: Side): LevelRead {
  const signed = side === 'buy' ? qty : -qty;
  const ticks = ticksBetween(inst, price, entry);
  const pnl = pnlBetween(inst, entry, price, signed);
  return { ticks, pnl, money: fmtMoney(pnl), tickWords: `${ticks} ${ticks === 1 ? 'tick' : 'ticks'}` };
}

export interface PlanRead {
  entry: number;
  target: number;
  stop: number;
  qty: number;
  side: Side;
  reward: LevelRead;
  risk: LevelRead;
  /** Reward over risk — Infinity when the stop sits on the entry */
  rr: number;
  /** "2.4 R" · "—" */
  rrWords: string;
}

/** A whole plan — entry, target, stop — as the HUD prints it */
export function readPlan(inst: Instrument, entry: number, target: number, stop: number, qty: number, side: Side): PlanRead {
  const reward = readPlanned(inst, entry, target, qty, side);
  const risk = readPlanned(inst, entry, stop, qty, side);
  const rr = Math.abs(risk.pnl) < 1e-9 ? Infinity : Math.abs(reward.pnl) / Math.abs(risk.pnl);
  return { entry, target, stop, qty, side, reward, risk, rr, rrWords: Number.isFinite(rr) ? `${rr.toFixed(2)} R` : '—' };
}

/** Which way a protective level must sit for a position: a long's stop is under it */
export const stopSideFor = (qty: number): 'below' | 'above' => (qty > 0 ? 'below' : 'above');
export const targetSideFor = (qty: number): 'below' | 'above' => (qty > 0 ? 'above' : 'below');

/** True when a price is on the right side of the entry to BE a stop for this position */
export const isStopSide = (qty: number, entry: number, price: number): boolean => (qty > 0 ? price < entry : price > entry);
export const isTargetSide = (qty: number, entry: number, price: number): boolean => (qty > 0 ? price > entry : price < entry);
