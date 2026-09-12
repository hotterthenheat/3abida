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
    · a FIXED DAY — midnight to midnight, every slot
      at its true x, the future empty above the
      baseline, so the shape never changes through
      the session and a time is always in the same
      place;
    · the regular session as a faint band between
      the open and the close, so pre-market, hours
      and after-hours read at a glance;
    · bars on the volume floor's three registers
      (quiet cool grey, the loud quintile brighter,
      the day's busiest window magenta), on a
      square-root scale so the quiet bulk still
      shows;
    · the picked window on a silver column (where
      you are), the live window breathing lime under
      a "now" hairline (status), held = amber;
    · a readout pinned top-right that reads the
      picked window, or the hovered one.
==================================================
*/

import { useMemo, useState } from 'react';
import type { IntervalWindow } from '../../data/flowBook';
import { earnMarks } from './earnedInk';

const SLOTS = 96;
const MIN_PER_SLOT = 1440 / SLOTS;
const num = (v: number) => v.toLocaleString('en-US');
const pct = (minute: number) => `${(minute / 1440) * 100}%`;

/* Hour marks at their true x; the open and the close speak louder. */
const TICKS: { min: number; label: string; edge?: boolean }[] = [
  { min: 0, label: '00:00' },
  { min: 240, label: '04:00' },
  { min: 480, label: '08:00' },
  { min: 570, label: '09:30', edge: true },
  { min: 720, label: '12:00' },
  { min: 960, label: '16:00', edge: true },
  { min: 1200, label: '20:00' },
];
const OPEN = 570;
const CLOSE = 960;

/* The volume floor's registers (NetFlowPane's VOL_RGB 150,168,196). */
const QUIET = 'bg-[rgba(150,168,196,0.24)] group-hover/slot:bg-[rgba(150,168,196,0.5)]';
const LOUD = 'bg-[rgba(150,168,196,0.82)] group-hover/slot:bg-[rgba(150,168,196,0.95)]';

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
    ? `${shown.label} · ${num(shown.totalVol)} contracts${
        shown.totalVol >= max ? ' · busiest of the day' : ''
      }${shown.live ? (paused ? ' · held' : ' · still filling') : ''}`
    : '';

  return (
    <div className="relative select-none" onMouseLeave={() => setHover(null)}>
      <div className="relative h-11" role="tablist" aria-label="Session windows">
        {/* The room: regular hours as a faint band, its edges the open and the close. */}
        <div
          aria-hidden
          className="absolute inset-y-0 bg-ink/[0.045] border-x border-ink/[0.12]"
          style={{ left: pct(OPEN), width: pct(CLOSE - OPEN) }}
        />
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
              role="tab"
              aria-selected={sel}
              aria-label={`${w.label} · ${num(w.totalVol)} contracts`}
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
          <span className="pointer-events-none absolute top-0.5 right-0 z-10 px-1.5 py-0.5 rounded border border-borderSubtle bg-panel/70 backdrop-blur-sm font-mono text-[9px] tnum whitespace-nowrap text-textSecondary">
            <span className={hover !== null && hover !== selectedIdx ? 'text-textPrimary' : 'text-silver'}>
              {readout}
            </span>
          </span>
        )}
      </div>

      {/* The axis: every mark at its own x, the open and close brighter, "now" in status ink. */}
      <div className="relative h-4 font-mono text-[8px] uppercase tracking-widest text-textMuted tnum">
        {TICKS.map(t => {
          // "now" owns its neighbourhood: a fixed mark within a label's width of it steps aside.
          const near = nowMin !== null && Math.abs(t.min - nowMin) < 45;
          if (near) return null;
          return (
            <span
              key={t.min}
              className={`absolute top-0 flex flex-col items-center ${t.edge ? 'text-textSecondary' : ''}`}
              style={{ left: pct(t.min), transform: t.min === 0 ? 'none' : 'translateX(-50%)' }}
            >
              <span className={`w-px h-1 ${t.edge ? 'bg-ink/30' : 'bg-ink/15'}`} />
              <span className="mt-px leading-none">{t.label}</span>
            </span>
          );
        })}
        {nowMin !== null && (
          <span
            className={`absolute top-0 flex flex-col items-center ${paused ? 'text-warn' : 'text-select'}`}
            style={{ left: pct(nowMin), transform: nowMin > 1400 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            <span className={`w-px h-1 ${paused ? 'bg-warn/70' : 'bg-select/80'}`} />
            <span className="mt-px leading-none">{paused ? 'held' : 'now'}</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default DayStrip;
