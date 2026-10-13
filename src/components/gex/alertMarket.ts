/*
==================================================
  SLAYER TERMINAL - WHICH MARKET THE ALERTS WATCH
  (components/gex/alertMarket.ts)

  ALERTS WATCH THE REAL PRICE (2026-10-12). While
  Unusual Whales answers, the shell's watcher
  (components/alerts/AlertWatcher.tsx) judges every
  alert on the market's own price — UW's day state for
  a name, the book's price for a cash index, UW's
  minute bars, book, prints and headlines — and the
  house's simulator is not asked. With the feed down
  the alerts watch the house's price, as before.

  ONE MARKET A FIRING: this module says which market
  the watcher reads (`alertMarket`), keeps the last real
  price it read for each name (`realPrice`), and an
  alert armed while the alerts watch the feed takes its
  side (above or below) from that price, whatever page
  armed it (`spotForArm`) — so "SPY alert 480" set off
  a house figure cannot ring at once on the real one. A
  chart that judges alerts on its own tape (StrikeChart)
  stands aside while the watcher reads the feed.

  No imports: the store and the proof (scripts/
  alerts-proof.ts) read it without the feed's client.
==================================================
*/

export type AlertMarket = 'feed' | 'house';

let market: AlertMarket = 'house';
const prices = new Map<string, { price: number; at: number }>();
const subs = new Set<() => void>();

/** A real price older than this is not the market's now — the alert waits for the next answer */
export const REAL_PRICE_STALE_MS = 5 * 60_000;

/** The market the alerts watch now */
export const alertMarket = (): AlertMarket => market;

/** The watcher says which market it reads — the feed while UW answers, the house's otherwise */
export function setAlertMarket(m: AlertMarket): void {
  if (m === market) return;
  market = m;
  subs.forEach(fn => fn());
}

/** A real price read for a name (UW's day state, or an index book's price) */
export function noteRealPrice(ticker: string, price: number, at = Date.now()): void {
  if (!(price > 0) || !Number.isFinite(price)) return;
  const t = ticker.toUpperCase();
  const had = prices.get(t);
  if (had && had.at > at) return;
  prices.set(t, { price, at });
}

/** The last real price for a name, while the alerts watch the feed and it is fresh — else null */
export function realPrice(ticker: string, now = Date.now()): number | null {
  if (market !== 'feed') return null;
  const p = prices.get(ticker.toUpperCase());
  return p && now - p.at <= REAL_PRICE_STALE_MS ? p.price : null;
}

/** The price an alert's side is armed from: the real one while the alerts watch the feed, else the page's own */
export function spotForArm(ticker: string, pageSpot: number): number {
  return realPrice(ticker) ?? pageSpot;
}

/** Told when the market the alerts watch changes */
export function onAlertMarket(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** For the proof: forget every real price and go back to the house */
export function resetAlertMarket(): void {
  market = 'house';
  prices.clear();
}
