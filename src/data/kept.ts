/*
==================================================
  SLAYER TERMINAL - WHAT THE BROWSER KEEPS
  (data/kept.ts)

  The two lines every store in here had written for
  itself: read a JSON key, write a JSON key. There
  were copies in the room, on the feedback board and
  in the picture stores, and they had already
  drifted — one swallowed a failed write and carried
  on, one did not distinguish "no storage" from "no
  room left", and neither told its caller which had
  happened.

  A failed WRITE matters: it means a reload will not
  show what the screen is showing. So `writeKey`
  reports it and the caller decides whether that is
  worth saying out loud. A failed READ does not:
  there is nothing to show but the fallback either
  way.
==================================================
*/

/** A stored JSON value, or the fallback when there is none this build can read */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* storage off, or an entry written by a build that shaped it differently */
  }
  return fallback;
}

/** True when it reached storage. False means off, or full — the caller's call. */
export function writeKey(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
