/*
==================================================
  SLAYER TERMINAL - THE QUEUE (core/paper/queue.ts)

  WHY PAPER TRADING TEACHES BAD HABITS: a limit
  order in a simulator fills the instant price
  touches it. In the book it does not. Your order
  joins the back of a line at that price, and it
  only trades once everything in front of it has
  traded — which, at a level price merely touches
  and leaves, is never.

  So with REALISTIC FILLS on, a resting limit is
  given a QUEUE POSITION when it is placed: the
  size already showing at its price. Every quote
  after that, whatever traded at that level is
  taken off the front of the line. The order fills
  only once the line is clear, and then only for
  what is left of that bar's trade.

  HOW MUCH TRADED AT THE LEVEL, honestly: the tape
  this desk reads publishes a bar's volume, not a
  print-by-print ladder. So the emulation takes the
  volume that arrived since the last quote and
  counts the share of it that belongs to this price
  — all of it when the bar is trading through the
  level, a fraction when the level is merely at the
  edge of the bar's range. It is an EMULATION and
  the chip on the order says so; what it buys is
  the habit: a limit at the back of a busy level
  does not fill because price kissed it.
==================================================
*/

import type { Instrument } from './instruments';
import type { Order } from './engine';
import type { Quote } from './market';
import Simulator from '../simulator';

interface QueueEntry {
  /** Contracts that were in front when the order was placed */
  ahead: number;
  /** What is left of them */
  left: number;
  /** The bar volume reading the last time this order was looked at */
  lastVolume: number;
  /** The bar that reading belongs to */
  lastBarTime: number;
  placedAt: number;
  price: number;
}

const queues = new Map<string, QueueEntry>();
/* A line is kept per ORDER, and the engine never tells this file when one is
   done with — so the oldest go when the map gets long. A place in a queue that
   was taken hours ago is worthless anyway. */
const KEEP_LINES = 200;
function prune(): void {
  if (queues.size <= KEEP_LINES) return;
  const oldest = [...queues.entries()].sort((a, b) => a[1].placedAt - b[1].placedAt).slice(0, queues.size - KEEP_LINES);
  for (const [id] of oldest) queues.delete(id);
}

/** What a reader sees on the order: how much of the line is left */
export interface QueueRead {
  ahead: number;
  left: number;
  /** 0..1 — how far through the line the order has come */
  progress: number;
}
export function readQueue(orderId: string): QueueRead | null {
  const e = queues.get(orderId);
  if (!e) return null;
  return { ahead: e.ahead, left: e.left, progress: e.ahead <= 0 ? 1 : Math.min(1, 1 - e.left / e.ahead) };
}

export function forgetQueue(orderId: string): void {
  queues.delete(orderId);
}

/** The traded volume on the underlying's newest bar, and which bar it is */
function tapeAt(inst: Instrument): { volume: number; time: number; high: number; low: number } | null {
  const bars = Simulator.peekCandles(inst.underlying);
  if (!bars || bars.length === 0) return null;
  const b = bars[bars.length - 1];
  return { volume: b.volume, time: b.time, high: b.high, low: b.low };
}

/**
 * How much of a crossed limit may fill on this quote.
 *
 * The first call for an order LINES IT UP behind the size showing at its
 * price. Later calls take whatever traded since off the front. Nothing fills
 * until the line is clear, and then only what is left of the trade.
 */
export function limitFillQty(o: Order, q: Quote, want: number, at: number): number {
  const price = o.limitPrice ?? 0;
  let e = queues.get(o.id);
  if (!e || Math.abs(e.price - price) > 1e-9) {
    /* placed, or moved — a moved order goes to the back of the new level's line */
    const showing = o.side === 'buy' ? q.bidSize : q.askSize;
    const tape = tapeAt(o.instrument);
    e = { ahead: Math.max(1, showing), left: Math.max(1, showing), lastVolume: tape?.volume ?? 0, lastBarTime: tape?.time ?? 0, placedAt: at, price };
    queues.set(o.id, e);
    prune();
    return 0;
  }

  const tape = tapeAt(o.instrument);
  if (!tape) return want;
  /* the volume that arrived since the last look — a new bar starts from its own */
  const traded = tape.time === e.lastBarTime ? Math.max(0, tape.volume - e.lastVolume) : tape.volume;
  e.lastVolume = tape.volume;
  e.lastBarTime = tape.time;
  if (traded <= 0) return 0;

  /*
    THE SHARE THAT BELONGS TO THIS PRICE. A bar that trades clean through the
    level gives it everything; a bar that only reaches it gives a slice, since
    the level saw part of the bar's activity. Scaled to contracts by the
    underlying's own step, so a 20,000-share minute on QQQ is not read as
    20,000 futures contracts standing in front of you.
  */
  const span = Math.max(1e-9, tape.high - tape.low);
  const under = price >= tape.low && price <= tape.high;
  const share = under ? Math.min(1, (o.instrument.tickSize * 4) / span) : 0;
  const cleared = Math.floor(traded * share * 0.02);
  if (cleared <= 0) return 0;

  if (e.left > 0) {
    e.left = Math.max(0, e.left - cleared);
    if (e.left > 0) return 0;
    /* the line cleared inside this bar — whatever is left of the trade is yours */
    return Math.min(want, Math.max(1, cleared - e.ahead));
  }
  return Math.min(want, Math.max(1, cleared));
}

/** Drop every line — a reset, or the toggle going off */
export function clearQueues(): void {
  queues.clear();
}
