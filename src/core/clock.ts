/*
==================================================
  SLAYER TERMINAL - ENGINE CLOCK
  The one place the scoring engine learns what time
  it is. Live, nothing sets it and now() is the wall
  clock — zero behavior change. In a replay, the
  harness pins it to the historical moment before
  calling the engine, and everything downstream
  (dayKey seeding, expiry resolution) follows.

  This exists because a backtest that reads the wall
  clock is quietly scoring 2024's chain against
  2026's calendar. Every engine-path use of
  new Date() must route through here; adding a bare
  new Date() to scoring code is a replay bug.
==================================================
*/

let injected: (() => Date) | null = null;

/** What time the ENGINE thinks it is. Wall clock unless a harness pinned it. */
export function now(): Date {
  return injected ? injected() : new Date();
}

/** Pin the engine clock (replay harness only — never call from UI code). */
export function setEngineClock(fn: (() => Date) | null): void {
  injected = fn;
}

/** Run fn with the clock pinned to `at`, restoring afterwards even on throw. */
export function withEngineClock<T>(at: Date, fn: () => T): T {
  const prev = injected;
  injected = () => at;
  try {
    return fn();
  } finally {
    injected = prev;
  }
}
