/*
==================================================
  SLAYER TERMINAL - DATE PICKER
  A compact month grid for jumping to a session.
  Weekends and future dates are dead — the market
  did not print on them, so they should not look
  clickable. Today wears the lime marker; the chosen
  day wears the white selection.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

interface DatePickerProps {
  /** The session on screen */
  selected: Date;
  /** Called with the number of days back from today */
  onPick: (dayOffset: number) => void;
  onClose: () => void;
}

const DatePicker = ({ selected, onPick, onClose }: DatePickerProps) => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  // Leading blanks so the 1st lands under the right weekday
  const firstDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ];

  const pick = (d: Date) => {
    const offset = Math.round((today.getTime() - startOfDay(d).getTime()) / 86400000);
    onPick(Math.max(0, offset));
    onClose();
  };

  return (
    <div
      ref={ref}
      // Centred with a margin, NOT -translate-x-1/2: the entrance animation
      // drives `transform`, so a translate-based offset gets clobbered mid-flight.
      // Keep the offset at half the width — 150px = half of w-[300px].
      className="absolute left-1/2 -ml-[150px] top-full mt-1 z-50 w-[300px] border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/70 p-3.5 animate-slide-in"
    >
      <div className="flex items-center justify-between mb-2.5">
        <button
          onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          className="p-1.5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-mono text-[13px] font-semibold text-textPrimary">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </span>
        <button
          onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          className="p-1.5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {DOW.map((d, i) => (
          <span key={i} className="text-center font-mono text-[10px] uppercase text-textMuted">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          const future = startOfDay(d).getTime() > today.getTime();
          const disabled = weekend || future;
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selected);
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => pick(d)}
              className={`h-8 rounded font-mono text-[12px] tnum transition-colors ${
                disabled
                  ? 'text-textMuted/25 cursor-not-allowed'
                  : isSelected
                    ? 'bg-textPrimary text-[#0a0a0a] font-semibold'
                    : isToday
                      ? 'text-select font-semibold hover:bg-ink/[0.06]'
                      : 'text-textSecondary hover:bg-ink/[0.06] hover:text-textPrimary'
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => {
          onPick(0);
          onClose();
        }}
        className="mt-2.5 w-full py-2 rounded border border-borderSubtle font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
      >
        Jump to today
      </button>
    </div>
  );
};

export default DatePicker;
