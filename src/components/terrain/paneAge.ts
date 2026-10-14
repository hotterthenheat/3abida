/*
  HOW OLD WHAT THE PANE SHOWS IS (the Terrain UI pass, 2026-10-14 — the header's "Live / data-age" chip): the newest
  moment the pane stands on — the last bar's end, the quote's own time, the field's newest column — against the clock.
  Pure, so the header, the stale state and the tests read one rule.
*/

export interface PaneAge {
  /** 'live': within the window a bar and a poll take; 'old': past it; 'closed': past it with the market shut (the host
      says so — not stale data); 'none': nothing dated yet */
  kind: 'live' | 'old' | 'closed' | 'none';
  /** Milliseconds since the newest moment (0 when none) */
  ageMs: number;
  /** The newest moment, epoch ms (null when none) */
  at: number | null;
  /** "Live" · "3m old" · "1h 12m old" */
  words: string;
}

/** A pane is live while its newest moment is within a bar plus a poll — never under two minutes */
export const liveWithinMs = (barMs: number): number => Math.max(2 * 60_000, barMs + 90_000);

const ageWords = (ms: number): string => {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'under a minute old';
  if (m < 60) return `${m}m old`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m old`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h old`;
};

export function paneAgeOf(nowMs: number, stamps: readonly (number | null | undefined)[], liveMs: number): PaneAge {
  let at: number | null = null;
  for (const s of stamps) if (s != null && Number.isFinite(s) && s > 0 && (at == null || s > at)) at = s;
  if (at == null) return { kind: 'none', ageMs: 0, at: null, words: 'No data yet' };
  const ageMs = Math.max(0, nowMs - at);
  if (ageMs <= liveMs) return { kind: 'live', ageMs, at, words: 'Live' };
  return { kind: 'old', ageMs, at, words: ageWords(ageMs) };
}
