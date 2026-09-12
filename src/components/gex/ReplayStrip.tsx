/*
==================================================
  SLAYER TERMINAL - THE REPLAY STRIP
  (components/gex/ReplayStrip.tsx)

  One thin line under the Map's head while the page
  is rewound. Two phases, the TradingView way in:

    PICK   "Select a bar on the chart" — the chart's
           cursor is a silver line, a click on a bar
           starts the replay from that minute
    PLAY   play or pause, the pace, the session as a
           track you scrub — the part already played
           in the where-you-are silver, the hours
           ticked beneath — the day and the minute in
           hand, and the one door back to live

  `compact` is the same transport in one short line
  for the calendar's head, so the heatmap under the
  chart carries the position too. Nothing lime while
  it is up: lime is the live voice and a rewound
  screen is not live.
==================================================
*/

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Pause, Play } from 'lucide-react';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import { CLOSE_MIN, OPEN_MIN, hhmm } from '../../data/ahead';
import { replayLabel } from '../../data/replay';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
/** Session seconds per real second */
export const PACES: DropdownOption<number>[] = [
  { value: 60, label: 'A minute a second', hint: 'The whole session in six and a half minutes' },
  { value: 300, label: 'Five minutes a second', hint: 'The whole session in about a minute' },
  { value: 12, label: 'Slow', hint: 'Twelve seconds of the session per second' },
  { value: 1, label: 'Real time', hint: 'As it happened' },
];

interface Props {
  phase: 'pick' | 'play';
  /** Seconds from the open */
  pos: number;
  /** Seconds the session covers */
  length: number;
  /** The day the session is — "Sep 4" */
  day?: string;
  playing: boolean;
  onPlay: (playing: boolean) => void;
  pace: number;
  onPace: (pace: number) => void;
  onSeek: (pos: number) => void;
  onExit: () => void;
  /** One short line for a box's head: the transport and the position, no pace, no exit */
  compact?: boolean;
  /** The moment's own words, when the position is not session seconds (a chart replaying by bars) */
  words?: string;
  /** Marks under the track, 0..1 along it — the session's hours unless given */
  marks?: { u: number; label: string }[];
  /** The pace card's choices — session seconds a second unless given */
  paces?: DropdownOption<number>[];
  className?: string;
}

const ReplayStrip = ({ phase, pos, length, day, playing, onPlay, pace, onPace, onSeek, onExit, compact = false, words, marks, paces, className = '' }: Props) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const seekAt = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
    onSeek(u * length);
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    seekAt(e.clientX);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) seekAt(e.clientX);
  };
  const onUp = () => {
    dragging.current = false;
  };
  const played = length > 0 ? (pos / length) * 100 : 0;
  /* The hours beneath the track — every hour the session covers, on the same scale */
  const spanMin = Math.max(1, length / 60);
  const hours: number[] = [];
  for (let m = Math.ceil(OPEN_MIN / 60) * 60; m <= OPEN_MIN + spanMin && m <= CLOSE_MIN; m += 60) hours.push(m);
  const ticks = marks ?? hours.map(m => ({ u: (m - OPEN_MIN) / spanMin, label: hhmm(m) }));
  const when = words ?? `${day ? `${day} · ` : ''}${replayLabel(pos)}`;

  if (phase === 'pick') {
    return (
      <div className={`shrink-0 flex items-center gap-3 px-3 ${compact ? 'h-7' : 'h-[38px] border-b border-borderSubtle/70 bg-panel'} select-none ${className}`} data-replay-strip="pick">
        <span className="font-mono text-[11px]" style={{ color: SILVER }}>
          Select a bar on the chart <span className="text-[9px] uppercase tracking-widest">· the replay starts there</span>
        </span>
        {!compact && (
          <button onClick={onExit} title="Back to live (Esc)" className="ml-auto shrink-0 inline-flex items-center gap-1.5 border border-borderSubtle hover:border-borderMuted rounded-md px-2.5 py-1 font-mono text-[10px] text-textSecondary hover:text-textPrimary transition-colors" data-replay-exit>
            Back to live
          </button>
        )}
      </div>
    );
  }

  const track = (
    <div className={`relative ${compact ? 'w-[180px]' : 'flex-1 min-w-[160px]'} h-full flex items-center cursor-pointer`} ref={trackRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-replay-track>
      <div className="relative w-full h-[6px] rounded-full bg-ink/[0.07]">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${played}%`, background: SILVER, opacity: 0.85 }} data-replay-played />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[12px] h-[12px] rounded-full border-2 border-panel" style={{ left: `${played}%`, background: SILVER }} data-replay-handle />
      </div>
      {!compact &&
        ticks.map(t => (
          <span key={`${t.u}-${t.label}`} className="absolute bottom-[3px] -translate-x-1/2 font-mono text-[8px] text-textMuted tnum pointer-events-none" style={{ left: `${t.u * 100}%` }}>
            {t.label}
          </span>
        ))}
    </div>
  );
  const playButton = (
    <button onClick={() => onPlay(!playing)} title={playing ? 'Pause' : 'Play'} aria-pressed={playing} className="shrink-0 p-1.5 rounded text-textPrimary hover:bg-ink/[0.06] transition-colors" data-replay-play>
      {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
    </button>
  );
  const time = (
    <span className="shrink-0 font-mono text-[11px] tnum whitespace-nowrap" style={{ color: SILVER }} data-replay-time>
      {when} <span className="text-[9px] uppercase tracking-widest">· replaying</span>
    </span>
  );

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2 h-7" data-replay-strip="compact">
        {playButton}
        {track}
        {time}
      </span>
    );
  }

  return (
    <div className={`shrink-0 flex items-center gap-3 px-3 h-[38px] border-b border-borderSubtle/70 bg-panel select-none ${className}`} data-replay-strip="play">
      {playButton}
      <DropdownSelect label="Pace" value={pace} options={paces ?? PACES} onChange={onPace} title="How fast it plays back" testId="replay-pace" />
      {track}
      {time}
      <button onClick={onExit} title="Back to live (Esc)" className="shrink-0 inline-flex items-center gap-1.5 border border-borderSubtle hover:border-borderMuted rounded-md px-2.5 py-1 font-mono text-[10px] text-textSecondary hover:text-textPrimary transition-colors" data-replay-exit>
        Back to live
      </button>
    </div>
  );
};

export default ReplayStrip;
