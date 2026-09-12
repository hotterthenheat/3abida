/*
==================================================
  SLAYER TERMINAL - THE LADDER CARD'S OWN CONTROLS
  Shared by the Pulse widget and the Pinpoint card so
  the two Strike Pressure Ladder cards are ONE card
  (Noah, 2026-09-05, the Pinpoint copy beside the
  widget: "it does not look like the provided image…
  i see some random 0dte, 1d, 2d, etc outside of the
  card itself"). The controls live INSIDE the card —
  a view strip, the expiry strip, the strike range,
  the fullscreen — and the engine's pattern read
  sits under them as the card's own sentence.
==================================================
*/

import type { ReactNode } from 'react';
import SignalBadge from '../ui/SignalBadge';
import RichRead from '../ui/RichRead';
import type { DropdownOption } from '../ui/DropdownSelect';
import { expiryFor, today } from '../../core/calendar';
import { STRIKE_WINDOWS, type StrikeWindow } from '../../data/exposure';
import type { Tone } from '../ui/tones';
import type { ExposureExpiry, HeatPatternRead } from '../../types/gex';

/** Pattern chip tone follows the read's direction — the engine's verdict
    wears its own color, never the field's. */
export const PATTERN_TONE: Record<HeatPatternRead['direction'], Tone> = {
  BULLISH: 'bull',
  BEARISH: 'bear',
  RANGE: 'neutral',
  VOLATILE: 'warn',
};

/** The time axis, as a control above the ladder — not a grid beside it. */
export const LADDER_EXPIRIES: { value: ExposureExpiry; label: string }[] = [
  { value: '0DTE', label: '0DTE' },
  { value: '1D', label: '1D' },
  { value: '2D', label: '2D' },
  { value: '5D', label: '5D' },
  { value: '7D', label: '7D' },
  { value: 'OPEX', label: 'OPEX' },
  { value: 'ALL', label: 'All' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
/** The monthly expiration: the third Friday of this month, or next month's once it has passed */
const monthlyExpiry = (from: Date): Date => {
  const third = (y: number, m: number) => {
    const d = new Date(y, m, 1);
    const offset = (5 - d.getDay() + 7) % 7;
    return new Date(y, m, 1 + offset + 14);
  };
  const now = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const thisMonth = third(now.getFullYear(), now.getMonth());
  return thisMonth >= now ? thisMonth : third(now.getFullYear(), now.getMonth() + 1);
};

/** THE EXPIRIES AS DATES (Noah, 2026-09-08: "the ladder doesn't have dates for
    exp, it just says 1d 2d 3d") — the same choices, spelled as the day they
    resolve to on the market calendar, with one plain line each. One list for
    the Map's Expiry card and the desk's ladder. */
export function ladderExpiryOptions(): DropdownOption<ExposureExpiry>[] {
  const base = today();
  const day = (dte: number) => expiryFor(dte, base);
  const t0 = day(0);
  const isToday = t0.dte === 0;
  return [
    { value: '0DTE', label: isToday ? `Today · ${fmtDay(t0.date)}` : `Next session · ${fmtDay(t0.date)}`, hint: 'The contracts that expire at the bell — the sharpest hedging' },
    { value: '1D', label: `${fmtDay(day(1).date)} · ${day(1).weekday}`, hint: 'The next expiry out' },
    { value: '2D', label: `${fmtDay(day(2).date)} · ${day(2).weekday}`, hint: 'Two sessions out' },
    { value: '5D', label: `${fmtDay(day(5).date)} · ${day(5).weekday}`, hint: 'The end of this week' },
    { value: '7D', label: `${fmtDay(day(7).date)} · ${day(7).weekday}`, hint: 'A week out' },
    { value: 'OPEX', label: `${fmtDay(monthlyExpiry(base))} · monthly`, hint: 'The monthly expiration — the heaviest structure' },
    { value: 'ALL', label: 'Every expiry', hint: 'Every expiry, weighed together' },
  ];
}

/** ±10 for the day's fight, ±30 for the whole book — the tail hedges live out there */
export const LADDER_RANGES: StrikeWindow[] = STRIKE_WINDOWS;

/** The pattern strip — what the ladder below actually says. */
export const LadderPatternStrip = ({ pattern, after, right }: { pattern: HeatPatternRead; after?: ReactNode; right?: ReactNode }) => (
  <div className="shrink-0 px-2.5 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2">
    <SignalBadge tone={PATTERN_TONE[pattern.direction]} dot>
      {pattern.key}
    </SignalBadge>
    <p className="min-w-0 text-[11px] text-textSecondary leading-snug">
      <RichRead text={pattern.read} />
    </p>
    {/* Two slots a host can fill (the Map, 2026-09-05): `after` sits right
        after the sentence — the thing that changes its words, the instrument
        whose prices it prints; `right` sits at the far end, over whatever
        stands at the right of the surface below. */}
    {after}
    {right && <span className="ml-auto shrink-0 flex items-center gap-2">{right}</span>}
  </div>
);
