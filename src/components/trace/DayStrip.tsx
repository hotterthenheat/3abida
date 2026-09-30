/*
==================================================
  SLAYER TERMINAL - DAY STRIP (the Windows page's
  session instrument)

  The day cut into 96 quarter-hours, IN THE TRADER'S
  CLOCK'S CLOTHES (Noah, 2026-09-16: "instead of the
  long rectangles… make it more of the formatting of
  the trader's clock — simpler, concise, straight to
  the point, and it's hoverable"): one row of equal
  blocks, each block's shade the window's volume,
  the day's parts named above the row with a breath
  between them, the hours under it, and the clock's
  card on hover. The 2026-09-03 instrument — bars on
  a baseline with a pinned readout — is gone.

  What a block says:
    · its SHADE is the window's volume against the
      loud bar (the 80th percentile, so the ordinary
      bulk spreads across the shades and one burst
      does not flatten the day);
    · the day's busiest window wears the SUPREME
      magenta — a magnitude wears one ink;
    · the window you have open wears the silver
      (where you are); the live one the lime, held =
      amber; the windows still to come sit quieter;
    · hover a block: its card — the window, its part
      of the day, the contracts, its share of the
      day; click: the page opens that window.
==================================================
*/

import { useMemo, useState } from 'react';
import type { IntervalWindow } from '../../data/flowBook';
import { earnMarks } from './earnedInk';

const SLOTS = 96;
const MIN_PER_SLOT = 1440 / SLOTS;
const num = (v: number) => v.toLocaleString('en-US');
const pct = (minute: number) => (minute / 1440) * 100;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const LIVE = 'rgb(var(--select))';
const SUPREME = 'rgb(var(--supreme))';
const SILVER = 'rgb(var(--silver))';
const WARN = 'rgb(var(--warn))';

/* THE DAY'S PARTS — named above the row, a breath between them (the clock's phases) */
const PARTS: { key: string; from: number; to: number; name: string }[] = [
  { key: 'night', from: 0, to: 240, name: 'Overnight' },
  { key: 'pre', from: 240, to: 570, name: 'Pre-market' },
  { key: 'session', from: 570, to: 960, name: 'The session' },
  { key: 'after', from: 960, to: 1440, name: 'After hours' },
];
const partAt = (min: number) => PARTS.find(p => min >= p.from && min < p.to) ?? PARTS[PARTS.length - 1];

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
  /* The shade's ceiling is the LOUD bar (the 80th percentile), not the champion: one burst over
     the day's bulk would put every ordinary window in the faintest shade — the loud quintile
     reaches the top shade, and the champion is told by its magenta. */
  const ceiling = Math.max(marks.bar === Infinity ? max : marks.bar, 1);
  const dayTotal = useMemo(() => windows.reduce((a, w) => a + w.totalVol, 0), [windows]);
  /* A FIXED DAY — the page hands the strip only the windows up to now; the slots still to come
     stand empty and faint at their own x, so a time is always in the same place and the hours
     under the row name the blocks over them */
  const byIdx = useMemo(() => new Map(windows.map(w => [w.idx, w] as const)), [windows]);
  const live = windows.find(w => w.live);
  const nowMin = live ? (live.idx + 1) * MIN_PER_SLOT : null;
  const liveIdx = live?.idx ?? null;

  /* THE CARD — the hovered window's */
  const shown = hover != null ? windows[hover] : null;
  const cardPct = shown ? ((shown.idx + 0.5) / SLOTS) * 100 : 0;
  const cardOnRight = shown ? shown.idx < SLOTS * 0.6 : true;

  return (
    <div className="relative select-none" data-day-strip>
      {/* THE PARTS — named above the row, each at its part's start; the last at its own start too */}
      <div className="relative h-5" data-strip-parts>
        {PARTS.map(p => {
          const inPart = nowMin != null && nowMin > p.from && nowMin <= p.to;
          return (
            <span
              key={p.key}
              data-part-name={p.key}
              className={`absolute top-0 text-[11px] font-medium whitespace-nowrap ${inPart ? '' : 'text-textMuted'}`}
              style={{ left: `${pct(p.from)}%`, ...(inPart ? { color: SILVER } : {}) }}
              title={`${hhmm(p.from)}–${hhmm(p.to)}`}
            >
              {p.name}
            </span>
          );
        })}
      </div>

      <div className="relative" onPointerLeave={() => setHover(null)}>
        {/* THE ROW — 96 quarter-hour blocks; shade = the window's volume, magenta = the busiest,
            silver = the one open, lime = now */}
        <div className="flex gap-[2px] h-[22px]" role="tablist" aria-label="The day as quarter-hour intervals, shaded by how much traded in each">
          {Array.from({ length: SLOTS }, (_, i) => {
            const min = i * MIN_PER_SLOT;
            const boundary = i > 0 && partAt(min - MIN_PER_SLOT).key !== partAt(min).key;
            const w = byIdx.get(i);
            if (!w)
              return <span key={i} aria-hidden data-window-future={i} className={`flex-1 min-w-0 rounded-[2px] ${boundary ? 'ml-[3px]' : ''}`} style={{ background: 'rgb(var(--text-primary) / 0.08)', opacity: 0.5 }} />;
            const sel = w.idx === selectedIdx;
            const champ = w.totalVol >= max && w.totalVol > 0;
            const isNow = w.idx === liveIdx;
            const future = liveIdx != null && w.idx > liveIdx;
            const hovered = hover === w.idx;
            const dim = hover != null && !hovered;
            /* the shade: the ink's wash, the window's volume against the loud bar; brighter under the pointer */
            const alpha = Math.min(0.85, 0.1 + 0.6 * Math.min(1, w.totalVol / ceiling) + (hovered ? 0.25 : 0));
            const background = isNow ? (paused ? WARN : LIVE) : champ ? SUPREME : sel ? SILVER : `rgb(var(--text-primary) / ${alpha})`;
            return (
              <button
                key={w.idx}
                type="button"
                role="tab"
                aria-selected={sel}
                aria-label={`${w.label} · ${num(w.totalVol)} contracts`}
                data-window={w.idx}
                data-window-role={isNow ? 'now' : champ ? 'busiest' : sel ? 'open' : undefined}
                onPointerEnter={() => setHover(w.idx)}
                onClick={() => onSelect(w.idx)}
                className={`flex-1 min-w-0 rounded-[2px] transition-[opacity,background-color] duration-200 ${boundary ? 'ml-[3px]' : ''} ${isNow && !paused ? 'animate-live-breathe' : ''}`}
                style={{
                  background,
                  opacity: dim ? 0.55 : future ? 0.5 : 1,
                  boxShadow: isNow ? `0 0 0 1px ${paused ? WARN : LIVE}` : sel ? `0 0 0 1px ${SILVER}` : undefined,
                }}
              />
            );
          })}
        </div>

        {/* THE HOURS under the row, the open and the close brighter, "now" in the status ink */}
        <div className="relative h-4 mt-1 font-mono text-[9px] tnum text-textMuted">
          {TICKS.map(t => {
            // "now" owns its neighbourhood: a fixed mark within a label's width of it steps aside.
            if (nowMin !== null && Math.abs(t.min - nowMin) < 45) return null;
            return (
              <span key={t.min} className={`absolute top-0 ${t.edge ? 'text-textSecondary' : ''}`} style={{ left: `${pct(t.min)}%`, transform: t.min === 0 ? undefined : 'translateX(-50%)' }}>
                {t.label}
              </span>
            );
          })}
          {nowMin !== null && (
            <span className="absolute top-0 font-semibold" style={{ left: `${pct(nowMin)}%`, transform: nowMin > 1400 ? 'translateX(-100%)' : 'translateX(-50%)', color: paused ? WARN : LIVE }} data-strip-now>
              {paused ? 'held' : 'now'}
            </span>
          )}
        </div>

        {/* THE CARD — the hovered window: when, which part of the day, how much, its share of the day */}
        {shown && (
          <div
            data-window-card={shown.idx}
            className="absolute z-10 pointer-events-none rounded-lg border border-borderMuted bg-card/95 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)] px-3 py-2 w-[260px] animate-soft-in"
            style={{ left: `${cardPct}%`, bottom: 'calc(100% + 6px)', transform: cardOnRight ? 'translateX(12px)' : 'translateX(calc(-100% - 12px))' }}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[12px] font-semibold tnum" style={{ color: shown.idx === selectedIdx ? SILVER : undefined }}>
                {shown.label}
              </span>
              <span className="text-[11px] font-medium text-textPrimary">{partAt(shown.idx * MIN_PER_SLOT).name}</span>
              {shown.live && (
                <span className="ml-auto font-mono text-[9px] uppercase tracking-widest" style={{ color: paused ? WARN : LIVE }}>
                  {paused ? 'held' : 'still filling'}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-textSecondary">
              <span className="font-mono tnum text-textPrimary">{num(shown.totalVol)}</span> contracts
              {dayTotal > 0 && shown.totalVol > 0 && <> · {((100 * shown.totalVol) / dayTotal).toFixed(1)}% of the day</>}
              {shown.totalVol >= max && shown.totalVol > 0 && (
                <>
                  {' '}
                  · <span style={{ color: SUPREME }}>the busiest of the day</span>
                </>
              )}
            </p>
            <span className="block mt-1 text-[10px] text-textMuted">{shown.idx === selectedIdx ? 'open — its contracts are the table below' : 'click to open this interval'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DayStrip;
