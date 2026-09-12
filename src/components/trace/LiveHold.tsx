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

  THE BUTTON. The tape's exact control — LIVE breathes lime (the house's one
  "this is live" signal), PAUSED holds amber — plus one honesty rule: a held
  page says "as of HH:MM" beside the button, so a frozen table can never
  pass for a live one.
*/

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

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

// 24-hour, like every clock on Trace ("18:03"), never "06:03 PM".
const clock = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export const LiveHold = ({ paused, onToggle, heldAt }: { paused: boolean; onToggle: () => void; heldAt?: Date | null }) => (
  <span className="inline-flex items-center gap-2 shrink-0">
    <button
      onClick={onToggle}
      aria-pressed={paused}
      title={paused ? 'Resume — the page follows the book again' : 'Hold the page — nothing moves under you until you resume'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
        paused
          ? 'border-warn/40 bg-warn/[0.06] text-warn hover:bg-warn/[0.1]'
          : /* the live signal's own form per theme: a lime glow on the dark terminal, a lime highlighter on paper (tokens.css --live-*) */
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
    {paused && heldAt && (
      <span className="font-mono text-[10px] text-textMuted uppercase tracking-wider whitespace-nowrap tnum">as of {clock(heldAt)}</span>
    )}
  </span>
);
