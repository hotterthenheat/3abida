/*
==================================================
  SLAYER TERMINAL - LIVE / PAUSED (one hold for every Trace page)

  The tape had the only pause on Trace. Every other
  flow page re-ranks its book once a real minute
  and every in-depth card moves on the 1.5s tick —
  silently, with no way to stop it (Noah,
  2026-08-30: "go build it, one shared live/paused
  for all of them").
==================================================

  THE HOLD. useHold(live) hands back `live` while playing and the LAST value
  it saw while paused. A page passes the whole snapshot it renders from —
  { book, tick } — so rows, facts, read, pills and any open card freeze on
  the SAME moment; nothing derived can drift. A ticker change releases the
  hold: an old book must never wear a new name.

  THE BUTTON. The tape's exact control — LIVE breathes silver (the house's one
  "this is live" signal; the lime until 2026-10-02), PAUSED holds amber — plus one honesty rule: a held
  page says "as of HH:MM" beside the button, so a frozen table can never
  pass for a live one.
*/

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { clock } from '../../core/nyTime';

export interface Hold<T> {
  paused: boolean;
  toggle: () => void;
  /** `live` while playing; the last live value while paused */
  value: T;
  /** When the hold began — null while live */
  heldAt: Date | null;
}

export function useHold<T>(live: T, resetKey?: unknown): Hold<T> {
  const [paused, setPaused] = useState(false);
  const [heldAt, setHeldAt] = useState<Date | null>(null);
  const held = useRef(live);
  if (!paused) held.current = live;

  // A new key (the active ticker) releases the hold.
  useEffect(() => {
    setPaused(false);
    setHeldAt(null);
  }, [resetKey]);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    setHeldAt(next ? new Date() : null);
  };

  return { paused, toggle, value: paused ? held.current : live, heldAt };
}

export const LiveHold = ({ paused, onToggle, heldAt }: { paused: boolean; onToggle: () => void; heldAt?: Date | null }) => (
  <span className="inline-flex items-center gap-2 shrink-0">
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={paused}
      title={paused ? 'Resume — the page follows the book again' : 'Hold the page — nothing moves under you until you resume'}
      className={`hit inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
        paused
          ? 'border-warn/40 bg-warn/[0.06] text-warn hover:bg-warn/[0.1]'
          : /* the live signal's own form per theme: a silver glow on the dark terminal, a silver highlighter on paper (tokens.css --live-*) */
            'tone-live hover:opacity-90 animate-live-breathe'
      }`}
    >
      {paused ? (
        <>
          <Play className="w-3 h-3" /> Paused
        </>
      ) : (
        <>
          <Pause className="w-3 h-3" /> Live
        </>
      )}
    </button>
    {/* on the reader's clock, 12-hour like every clock on Trace ("2:03 pm" — core/nyTime clock, 2026-10-13) */}
    {paused && heldAt && (
      <span className="font-mono text-[11px] text-textMuted uppercase tracking-wider whitespace-nowrap tnum">as of <span className="normal-case">{clock(heldAt)}</span></span>
    )}
  </span>
);
