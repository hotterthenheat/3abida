/*
==================================================
  SLAYER TERMINAL - WHAT EACH DAY MADE
  (components/review/JournalDayBars.tsx)

  The period's days as SLIM BARS (Noah, 2026-09-26, on a
  library histogram that painted two days as two slabs:
  "i hate the 'what each day made' looks. try to go for a
  more modern way of visualizing it. this looks old
  school"). A bar a day, rounded, a breath between them,
  green up from the baseline and red down, the tallest
  the period's biggest day; the figure's ceiling and
  floor said at the right, the first and last days and a
  few between named underneath.

  THE POINTER ON A BAR lifts it and says the day in a
  card BESIDE it — never over it (Noah, 2026-09-26: "the
  hover effect on this is covering the actual section
  that is being hovered over"): to the right of a bar in
  the left half, to the left of one in the right half,
  its head at an up bar's tip and its foot at a down
  bar's, kept inside the box — what it made, how many
  closed and won; a press opens the day. The open day's bar stays at
  full strength and wears NO ring or border (Noah,
  2026-09-26: "shouldnt have a click colored border" —
  the day open under the calendar says which it is).
  Drawn in the house's row grammar (the cut cards,
  the Map's net bars), not the chart library: a figure
  of a handful of days is a row of marks, not a tape.
==================================================
*/

import { useState } from 'react';
import { dirInk, pct, usdSigned } from './words';
import type { DayTotal } from '../../data/review/journalFigures';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const short = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
const long = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
/** "+$1.2K" · "−$340" — the scale's words */
const scaleWords = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}K` : `$${Math.round(a)}`;
  return v < 0 ? `−${s}` : `+${s}`;
};
const LABELS_H = 22;
/** The hover card's height (three lines in the mono and its padding) — what keeps it inside the plot */
const CARD_H = 72;
/** The card's breath from the bar's tip */
const CARD_GAP = 10;

interface Props {
  /** The period's days, oldest first */
  days: DayTotal[];
  picked: string | null;
  onPick: (day: string) => void;
  height: number;
}

const JournalDayBars = ({ days, picked, onPick, height }: Props) => {
  const [over, setOver] = useState<string | null>(null);
  const n = days.length;
  const maxUp = Math.max(0, ...days.map(d => d.net));
  const maxDown = Math.max(0, ...days.map(d => -d.net));
  /* where the baseline sits: by the two reaches, never nearer an edge than a quarter of the plot while both sides have something */
  const upShare = maxUp > 0 && maxDown > 0 ? Math.min(0.75, Math.max(0.25, maxUp / (maxUp + maxDown))) : maxUp > 0 ? 0.9 : 0.1;
  const H = height - LABELS_H;
  const base = Math.round(upShare * H);
  const roomUp = Math.max(0, base - 8);
  const roomDown = Math.max(0, H - base - 8);
  /* a handful of days named under the bars: the first, one every `step`, and the last unless it would touch the one before */
  const step = Math.max(1, Math.ceil(n / 8));
  const named = (i: number) => i % step === 0 || (i === n - 1 && (n - 1) % step >= Math.min(2, step));
  /* a handful of days spread a little wider, so every one is named without the names touching */
  const colW = n <= 8 ? 46 : 30;

  return (
    <div className="relative" style={{ height }} data-journal-daybars={n}>
      {/* the scale's three words, at the right */}
      <div className="absolute right-0 top-0 w-11 font-mono text-[10px] tnum text-textMuted text-right pointer-events-none" style={{ height: H }} aria-hidden="true">
        {maxUp > 0 && <span className="absolute right-0 top-0">{scaleWords(maxUp)}</span>}
        <span className="absolute right-0 -translate-y-1/2" style={{ top: base }}>
          $0
        </span>
        {maxDown > 0 && <span className="absolute right-0 bottom-0">{scaleWords(-maxDown)}</span>}
      </div>
      <div className="absolute left-0 right-12 top-0" style={{ height: H }}>
        {/* the baseline */}
        <div className="absolute left-0 right-0 h-px bg-textPrimary/25 pointer-events-none" style={{ top: base }} aria-hidden="true" />
        <div className="absolute inset-0 flex justify-center items-stretch gap-[3px]" onPointerLeave={() => setOver(null)}>
          {days.map((d, i) => {
            const up = d.net >= 0;
            const h = d.net === 0 ? 2 : Math.max(3, Math.round((Math.abs(d.net) / (up ? maxUp : maxDown)) * (up ? roomUp : roomDown)));
            const on = d.day === picked;
            const lit = d.day === over;
            /* THE CARD BESIDE THE BAR, never over it: right of a bar in the left half, left of one in the right half;
               its head at an up bar's tip, its foot at a down bar's, and never past the plot's top or bottom */
            const side = i < n / 2 ? 'left-full ml-1.5' : 'right-full mr-1.5';
            const tip = up ? base - h : base + 1 + h;
            const cardTop = Math.max(0, Math.min(H - CARD_H, up ? tip - CARD_GAP : tip + CARD_GAP - CARD_H));
            return (
              <button
                key={d.day}
                type="button"
                onClick={() => onPick(d.day)}
                onPointerEnter={() => setOver(d.day)}
                onFocus={() => setOver(d.day)}
                onBlur={() => setOver(null)}
                aria-label={`${long(d.day)}: ${usdSigned(d.net)}, ${d.n} closed — open the day`}
                aria-pressed={on}
                className="group relative flex-1 min-w-[2px] h-full focus:outline-none"
                style={{ maxWidth: colW }}
                data-journal-daybar={d.day}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 right-0 rounded-[3px] transition-opacity duration-150 ${d.net === 0 ? 'bg-textMuted' : up ? 'bg-bull' : 'bg-bear'} ${lit || on ? 'opacity-100' : over ? 'opacity-45' : 'opacity-85'}`}
                  style={up ? { bottom: H - base, height: h } : { top: base + 1, height: h }}
                />
                {lit && (
                  <span className={`absolute z-10 ${side} w-max max-w-[200px] rounded-md border border-borderMuted bg-panel px-2.5 py-2 text-left shadow-[0_8px_24px_rgba(0,0,0,0.35)] pointer-events-none animate-soft-in`} style={{ top: cardTop }} data-journal-daybar-card>
                    <span className="block font-mono text-[10px] text-textMuted">{long(d.day)}</span>
                    <span className={`mt-0.5 block font-mono text-[13px] font-semibold tnum ${dirInk(d.net)}`}>{usdSigned(d.net)}</span>
                    <span className="mt-0.5 block font-mono text-[10px] tnum text-textSecondary">
                      {d.n} closed · {d.wins} won ({pct(d.wins / d.n)})
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {/* the days named under the bars — the same columns, so a name stands under its bar */}
      <div className="absolute left-0 right-12 bottom-0 flex justify-center gap-[3px] font-mono text-[10px] tnum text-textMuted" style={{ height: LABELS_H }} aria-hidden="true">
        {days.map((d, i) => (
          <span key={d.day} className="relative flex-1 min-w-[2px] h-full" style={{ maxWidth: colW }}>
            {named(i) && <span className="absolute top-2 left-1/2 -translate-x-1/2 whitespace-nowrap">{short(d.day)}</span>}
          </span>
        ))}
      </div>
    </div>
  );
};

export default JournalDayBars;
