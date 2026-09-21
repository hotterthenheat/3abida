/*
==================================================
  SLAYER TERMINAL - EXPIRY PICKER
  (components/ui/ExpiryPicker.tsx)

  A date control in the house grammar, for the
  browser's own calendar (Noah, 2026-09-05: "does
  it look on par with the rest of the bottom
  section of the page. i think not"). Built on
  react-day-picker — the library under shadcn's
  calendar — with every class ours and none of its
  stylesheet, inside a Radix Popover.

  MADE FOR EXPIRIES: weekends, market holidays and
  past days cannot be picked, and the four dates an
  options trader actually reaches for sit above the
  grid as pills — today, this Friday, next Friday,
  the monthly (third Friday).
==================================================
*/

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { CARD } from './DropdownSelect';
import { isoDate, isTradingDay, nextSession, today } from '../../core/calendar';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const SILVER_FILL = 'rgb(var(--silver-fill))'; /* the silver as a SURFACE — a filled pill with the dark word on it, the holo flat form on either ground */

const parse = (iso: string): Date | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};
const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Back off a holiday to the session before it — a Friday holiday expires Thursday */
const backToSession = (d: Date) => {
  const out = new Date(d);
  for (let i = 0; i < 7 && !isTradingDay(out); i++) out.setDate(out.getDate() - 1);
  return out;
};
const fridayOnOrAfter = (d: Date) => addDays(d, (5 - d.getDay() + 7) % 7);
const thirdFriday = (year: number, month: number) => {
  const first = new Date(year, month, 1);
  return addDays(first, ((5 - first.getDay() + 7) % 7) + 14);
};

/** The four dates a trader reaches for, each a real session */
export function quickExpiries(from: Date = today()): { label: string; date: Date }[] {
  const thisFri = backToSession(fridayOnOrAfter(from));
  const nextFri = backToSession(addDays(fridayOnOrAfter(from), 7));
  let monthly = backToSession(thirdFriday(from.getFullYear(), from.getMonth()));
  if (monthly < from) monthly = backToSession(thirdFriday(from.getFullYear(), from.getMonth() + 1));
  /* On a weekend or a holiday the first pill is the next session, named as such */
  const open = isTradingDay(from);
  const out = [
    { label: open ? 'Today' : 'Next session', date: open ? from : nextSession(from) },
    { label: 'This Friday', date: thisFri },
    { label: 'Next Friday', date: nextFri },
    { label: 'Monthly', date: monthly },
  ];
  // Two picks that land on the same day keep the first name only
  return out.filter((q, i) => out.findIndex(o => isoDate(o.date) === isoDate(q.date)) === i);
}

interface ExpiryPickerProps {
  /** YYYY-MM-DD */
  value: string;
  onChange: (iso: string) => void;
  /** A data-* hook for probes and forms */
  testId?: string;
  width?: number;
}

const ExpiryPicker = ({ value, onChange, testId, width = 150 }: ExpiryPickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const t = today();
  const picks = quickExpiries(t);
  const pick = (d: Date) => {
    onChange(isoDate(d));
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-field={testId}
          data-date-trigger
          className="h-8 px-2 rounded-md border border-borderSubtle bg-panel font-mono text-[12px] tnum text-textPrimary text-left inline-flex items-center gap-2 outline-none focus-visible:border-silver/60 data-[state=open]:border-silver/60 transition-colors"
          style={{ width }}
        >
          <span className="flex-1 min-w-0 truncate">{selected ? fmt(selected) : 'Pick a date'}</span>
          <CalendarDays className="w-3.5 h-3.5 text-textMuted shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={12} className={`${CARD} p-3 outline-none w-[288px]`} data-date-picker>
          {/* THE FOUR DATES A TRADER REACHES FOR */}
          <div className="flex flex-wrap gap-1.5 pb-3 mb-2 border-b border-borderSubtle/70" data-quick-picks>
            {picks.map(q => {
              const on = isoDate(q.date) === value;
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => pick(q.date)}
                  aria-pressed={on}
                  title={fmt(q.date)}
                  className="h-7 px-2.5 rounded-full border text-[11px] font-medium transition-colors"
                  style={on ? { background: SILVER_FILL, color: '#0a0a0a', borderColor: SILVER_FILL } : { color: 'rgb(var(--text-secondary))', borderColor: 'rgb(var(--border-muted))' }}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={d => d && pick(d)}
            defaultMonth={selected ?? t}
            disabled={d => d < t || !isTradingDay(d)}
            showOutsideDays
            weekStartsOn={0}
            components={{
              Chevron: ({ orientation }) => (orientation === 'left' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />),
            }}
            classNames={{
              root: 'relative select-none',
              months: 'flex',
              month: 'w-full',
              month_caption: 'h-8 flex items-center px-1 text-[12px] font-semibold text-textPrimary',
              caption_label: '',
              nav: 'absolute top-0 right-0 h-8 flex items-center gap-1',
              button_previous: 'w-7 h-7 inline-flex items-center justify-center rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors',
              button_next: 'w-7 h-7 inline-flex items-center justify-center rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors',
              chevron: '',
              month_grid: 'w-full border-collapse mt-1',
              weekdays: '',
              weekday: 'h-7 text-[10px] font-normal text-textMuted text-center',
              weeks: '',
              week: '',
              day: 'p-0 text-center',
              day_button: 'w-9 h-8 rounded-md font-mono text-[12px] tnum text-textPrimary hover:bg-ink/[0.06] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-silver/60',
              selected: '[&>button]:bg-silverFill [&>button]:text-[#0a0a0a] [&>button]:font-semibold [&>button:hover]:bg-silverFill',
              today: '[&>button]:shadow-[inset_0_0_0_1px_rgba(199,211,232,0.45)]',
              outside: '[&>button]:text-textMuted/40',
              disabled: '[&>button]:text-textMuted/30 [&>button]:cursor-not-allowed [&>button:hover]:bg-transparent',
              hidden: 'invisible',
              focused: '',
            }}
          />
          <p className="mt-2 pt-2 border-t border-borderSubtle/70 text-[10px] text-textMuted">Only trading days can be picked.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default ExpiryPicker;
