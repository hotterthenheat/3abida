/*
  REVIEW · THE DAY CARD — a labelled card like every other on a line (DropdownSelect's clothes), opening the house
  calendar (ExpiryPicker's) on the TAPE'S days: a day the tape does not hold cannot be picked, nor one before `min`
  (the desk's clock only moves forward).
  REAL DAYS (2026-10-12): handed `days` (the sessions on the market's record — Theta Data's, data/feed/backtest.ts) it offers those
  instead, each marked with a small silver dot — the market's own sessions — and says so under the month.
*/

import { useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { CARD } from '../ui/DropdownSelect';
import { isoDate } from '../../core/calendar';
import { dateOf, dayWords, tapeDays } from '../../data/review/tape';

interface Props {
  label: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (iso: string) => void;
  /** The earliest day that may be picked */
  min?: string;
  title?: string;
  testId?: string;
  size?: 'md' | 'sm';
  /** The days that may be picked — the market's own record; absent, the house's tape */
  days?: string[];
  /** What the line under the month says, for those days */
  foot?: ReactNode;
}

const DayCard = ({ label, value, onChange, min, title, testId, size = 'md', days: own, foot }: Props) => {
  const [open, setOpen] = useState(false);
  const tape = tapeDays();
  const days = own?.length ? own : tape;
  const real = !!own;
  const held = new Set(days);
  const floor = min ?? days[0];
  const selected = dateOf(value);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title={title}
          data-dropdown={testId ?? label}
          className={`hit group inline-flex items-center gap-1.5 ${size === 'sm' ? 'h-6 px-2' : 'h-7 px-2.5'} rounded-md border border-borderSubtle bg-chip hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors font-mono select-none`}
        >
          <CalendarDays className="w-3 h-3 shrink-0 text-textMuted" aria-hidden="true" />
          {label && <span className="shrink-0 text-[11px] text-textMuted">{label}</span>}
          <span className="text-[11px] font-semibold text-textPrimary whitespace-nowrap">{dayWords(value, true).replace(/, \d{4}$/, '')}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={12} className={`${CARD} p-3 outline-none w-[288px]`} data-day-card={testId ?? label}>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={d => {
              if (!d) return;
              onChange(isoDate(d));
              setOpen(false);
            }}
            defaultMonth={selected}
            startMonth={dateOf(days[0])}
            endMonth={dateOf(days[days.length - 1])}
            disabled={d => {
              const iso = isoDate(d);
              return !held.has(iso) || iso < floor;
            }}
            showOutsideDays
            weekStartsOn={0}
            modifiers={real ? { record: d => held.has(isoDate(d)) } : undefined}
            modifiersClassNames={real ? { record: 'day-record' } : undefined}
            components={{ Chevron: ({ orientation }) => (orientation === 'left' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) }}
            classNames={{
              root: 'relative select-none',
              months: 'flex',
              month: 'w-full',
              month_caption: 'h-8 flex items-center px-1 text-[12px] font-semibold text-textPrimary',
              caption_label: '',
              nav: 'absolute top-0 right-0 h-8 flex items-center gap-1',
              button_previous: 'w-7 h-7 inline-flex items-center justify-center rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors disabled:opacity-30',
              button_next: 'w-7 h-7 inline-flex items-center justify-center rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors disabled:opacity-30',
              chevron: '',
              month_grid: 'w-full border-collapse mt-1',
              weekdays: '',
              weekday: 'h-7 text-[11px] font-normal text-textMuted text-center',
              weeks: '',
              week: '',
              day: 'p-0 text-center',
              day_button: 'w-9 h-8 rounded-md font-mono text-[12px] tnum text-textPrimary hover:bg-ink/[0.06] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-silver/60',
              selected: '[&>button]:bg-silverFill [&>button]:text-[rgb(var(--night))] [&>button]:font-semibold [&>button:hover]:bg-silverFill',
              today: '',
              outside: '[&>button]:text-textMuted/40',
              disabled: '[&>button]:text-textMuted/30 [&>button]:cursor-not-allowed [&>button:hover]:bg-transparent',
              hidden: 'invisible',
              focused: '',
            }}
          />
          <p className="mt-2 pt-2 border-t border-borderSubtle/70 text-[11px] text-textMuted" data-day-card-foot={real ? 'record' : 'tape'}>
            {real ? (foot ?? <>Sessions on the market’s record{min ? ', from where the clock stands' : ''}.</>) : <>Trading days on the tape{min ? ', from where the clock stands' : ''}.</>}
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default DayCard;
