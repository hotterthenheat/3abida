/*
  SPX'S PRICE FROM ITS OPTIONS, ON THE PAGE (the owner's SPX overnight field, 2026-10-15: "Price the overnight field off
  the forward implied by at-the-money SPX options … Label it 'price from options (overnight)'"). The recorder hands SPX's
  minutes with a flag where the price is the forward its options imply (server/overnightReader.ts); data/feed/levels.ts
  notes them here as they land, and the price hook (price.ts), the pane and the rail read them. The recorder's Theta
  state says why an overnight session is empty on this machine.
*/
export interface OptionsMinute {
  /** the minute's start, seconds */
  time: number;
  close: number;
}
const priced = new Map<string, Set<number>>();
const newest = new Map<string, OptionsMinute>();
const source = new Map<string, { thetaKey: boolean; state: string | null; at: number }>();

/** A minute (its start, seconds) priced from the name's options */
export function noteOptionsMinute(ticker: string, m: OptionsMinute): void {
  const t = ticker.toUpperCase();
  const set = priced.get(t) ?? new Set<number>();
  set.add(m.time);
  priced.set(t, set);
  const had = newest.get(t);
  if (!had || m.time >= had.time) newest.set(t, m);
}
/** A minute the index printed (its own level stands over any forward the same minute held) */
export function noteIndexMinute(ticker: string, time: number): void {
  priced.get(ticker.toUpperCase())?.delete(time);
}
export const pricedFromOptions = (ticker: string, timeSec: number): boolean => priced.get(ticker.toUpperCase())?.has(timeSec) ?? false;
/** The newest minute priced from the name's options, or null */
export const newestOptionsMinute = (ticker: string): OptionsMinute | null => newest.get(ticker.toUpperCase()) ?? null;
export function noteOvernightSource(ticker: string, s: { thetaKey: boolean; state: string | null; at: number }): void {
  source.set(ticker.toUpperCase(), s);
}
/** The recorder's overnight source for a name: whether this machine's server holds Theta's key, and its newest answer */
export const overnightSourceOf = (ticker: string) => source.get(ticker.toUpperCase()) ?? null;
