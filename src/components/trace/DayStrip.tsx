/*
==================================================
  SLAYER TERMINAL - DAY STRIP (the Windows page's
  session instrument)

  The day cut into 96 quarter-hours, drawn as ONE
  fixed instrument (Noah, 2026-09-03: "i love the
  idea of the horizontal box bar and how it shows
  the 15 min window and what went down but the ui
  design of it is throwing me off. it looks too
  generic and basic"). The old strip was a row of
  identical grey blocks capped at 14px, so it never
  spanned the page and its hour labels were spread
  across the full width, decoupled from the bars
  they named.

  What it is now:
    · THE SESSION — 09:30 to 16:00 New York, its 26
      quarter hours each at its true x, the future
      empty above the baseline, so the shape never
      changes through the session and a time is
      always in the same place (it ran midnight to
      midnight, on the machine's clock, until
      2026-10-09 — the audit's X2.1);
    · bars on the volume floor's three registers
      (quiet, the loud quintile brighter, the day's
      busiest window magenta), every ink a token;
    · the picked window on a silver column (where
      you are), the live window breathing silver under
      a "now" hairline (status), held = amber;
    · a readout pinned top-right that reads the
      picked window, or the hovered one;
    · the keys: ← → walk the windows, Home and End
      the first and the last; on a phone a slider
      under the strip, a finger's width wide.
==================================================
*/

import { useMemo, useState, type KeyboardEvent } from 'react';
import { WINDOWS_PER_DAY, type IntervalWindow } from '../../data/flowBook';
import { SESSION_LENGTH_MIN } from '../../core/nyTime';
import { earnMarks } from './earnedInk';

const SLOTS = WINDOWS_PER_DAY;
const MIN_PER_SLOT = SESSION_LENGTH_MIN / SLOTS;
const num = (v: number) => v.toLocaleString('en-US');
/** A minute of the SESSION (0 = 09:30) at its x */
const pct = (minute: number) => `${(minute / SESSION_LENGTH_MIN) * 100}%`;

/* Hour marks at their true x, minutes since the open; the open and the close speak louder. */
const TICKS: { min: number; label: string; edge?: boolean }[] = [
  { min: 0, label: '09:30', edge: true },
  { min: 90, label: '11:00' },
  { min: 210, label: '13:00' },
  { min: 330, label: '15:00' },
  { min: 390, label: '16:00', edge: true },
];

/* The volume floor's registers — the secondary ink at two strengths, a token on either ground (the audit's X12) */
const QUIET = 'bg-textSecondary/25 group-hover/slot:bg-textSecondary/50';
const LOUD = 'bg-textSecondary/80 group-hover/slot:bg-textSecondary/95';

const DayStrip = ({
  windows,
  selectedIdx,
  onSelect,
  paused,
}: {
  windows: IntervalWindow[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  paused: boolean;
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const marks = useMemo(() => earnMarks(windows, w => w.totalVol), [windows]);
  const max = Math.max(marks.top === Infinity ? 1 : marks.top, 1);
  /* The height's ceiling is the LOUD bar (the 80th percentile), not the
     champion: measured on a live day, one 160k burst over a 60–80k bulk
     put every ordinary window in the bottom third and the strip read as a
     flat barcode. Against the loud bar the bulk spreads over the height,
     the loud quintile touches the ceiling, and the champion is told by its
     magenta — a magnitude wears one ink; the ink, not the height, crowns it. */
  const ceiling = Math.max(marks.bar === Infinity ? max : marks.bar, 1);
  const live = windows.find(w => w.live);
  const nowMin = live ? (live.idx + 1) * MIN_PER_SLOT : null;
  const shown = windows[hover ?? selectedIdx] ?? windows[selectedIdx];

  const readout = shown
    ? `${shown.label} ET · ${num(shown.totalVol)} contracts${
        shown.totalVol >= max ? ' · busiest of the day' : ''
      }${shown.live ? (paused ? ' · held' : ' · still filling') : ''}`
    : '';

  const last = windows.length - 1;
  const onKeys = (e: KeyboardEvent) => {
    const to = e.key === 'ArrowRight' ? selectedIdx + 1 : e.key === 'ArrowLeft' ? selectedIdx - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (to === null) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(last, to));
    onSelect(next);
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-slot="${next}"]`)?.focus();
  };

  return (
    <div className="relative select-none" onMouseLeave={() => setHover(null)}>
      <div className="relative h-11" role="tablist" aria-label="The session's quarter hours, New York" onKeyDown={onKeys}>
        {/* The session as a faint band, its edges the open and the close. */}
        <div aria-hidden className="absolute inset-0 bg-ink/[0.045] border-x border-borderMuted" />
        {/* Baseline */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-borderMuted" />

        {windows.map(w => {
          const sel = w.idx === selectedIdx;
          const champ = w.totalVol >= max && w.totalVol > 0;
          const loud = w.totalVol >= marks.bar;
          const fill = champ
            ? 'bg-supreme'
            : w.live
              ? paused
                ? 'bg-warn/70'
                : 'bg-select animate-live-breathe'
              : sel
                ? 'bg-silver'
                : loud
                  ? LOUD
                  : QUIET;
          /* LINEAR against the loud bar (see `ceiling`); a floor keeps the
             quietest window visible. */
          const h = w.totalVol > 0 ? 6 + 94 * Math.min(1, w.totalVol / ceiling) : 0;
          return (
            <button
              key={w.idx}
              type="button"
              role="tab"
              aria-selected={sel}
              tabIndex={sel ? 0 : -1}
              data-slot={w.idx}
              aria-label={`${w.label} New York · ${num(w.totalVol)} contracts`}
              onClick={() => onSelect(w.idx)}
              onMouseEnter={() => setHover(w.idx)}
              className={`group/slot absolute inset-y-0 ${sel ? 'bg-silver/[0.10]' : ''}`}
              style={{ left: pct(w.idx * MIN_PER_SLOT), width: pct(MIN_PER_SLOT) }}
            >
              <span
                className={`absolute bottom-0 left-0 right-px rounded-t-[1px] transition-colors ${fill}`}
                style={{ height: `${h}%` }}
              />
            </button>
          );
        })}

        {/* NOW — a hairline at the live window's leading edge. */}
        {nowMin !== null && (
          <div
            aria-hidden
            className={`absolute inset-y-0 w-px ${paused ? 'bg-warn/70' : 'bg-select/80'}`}
            style={{ left: pct(nowMin) }}
          />
        )}

        {/* The readout, pinned — glass enough to whisper over whatever it covers. */}
        {readout && (
          <span className="pointer-events-none absolute top-0.5 right-0 z-10 px-1.5 py-0.5 rounded border border-borderSubtle bg-panel/70 backdrop-blur-sm font-mono text-[11px] tnum whitespace-nowrap text-textSecondary">
            <span className={hover !== null && hover !== selectedIdx ? 'text-textPrimary' : 'text-silver'}>
              {readout}
            </span>
          </span>
        )}
      </div>

      {/* The axis: every mark at its own x, the open and close brighter, "now" in status ink. */}
      <div className="relative h-4 font-mono text-[11px] text-textMuted tnum">
        {TICKS.map(t => {
          // "now" owns its neighbourhood: a fixed mark within a label's width of it steps aside.
          const near = nowMin !== null && Math.abs(t.min - nowMin) < 45;
          if (near) return null;
          return (
            <span
              key={t.min}
              className={`absolute top-0 flex flex-col items-center ${t.edge ? 'text-textSecondary' : ''}`}
              style={{ left: pct(t.min), transform: t.min === 0 ? 'none' : t.min >= SESSION_LENGTH_MIN ? 'translateX(-100%)' : 'translateX(-50%)' }}
            >
              <span className={`w-px h-1 ${t.edge ? 'bg-ink/30' : 'bg-ink/15'}`} />
              <span className="mt-px leading-none">{t.label}</span>
            </span>
          );
        })}
        {nowMin !== null && (
          <span
            className={`absolute top-0 flex flex-col items-center ${paused ? 'text-warn' : 'text-select'}`}
            style={{ left: pct(nowMin), transform: nowMin > SESSION_LENGTH_MIN - 20 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            <span className={`w-px h-1 ${paused ? 'bg-warn/70' : 'bg-select/80'}`} />
            <span className="mt-px leading-none">{paused ? 'held' : 'now'}</span>
          </span>
        )}
      </div>
      {/* ON A PHONE, ONE SLIDER (the audit's TR-51): a quarter hour is a sliver 13px wide there */}
      {windows.length > 1 && (
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={selectedIdx}
          onChange={e => onSelect(Number(e.target.value))}
          aria-label="Pick a quarter hour"
          aria-valuetext={windows[selectedIdx]?.label}
          className="sm:hidden w-full h-11 accent-[rgb(var(--silver))]"
        />
      )}
    </div>
  );
};

export default DayStrip;
