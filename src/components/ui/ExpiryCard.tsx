/*
==================================================
  SLAYER TERMINAL - THE EXPIRY CARD
  (components/ui/ExpiryCard.tsx)

  Every Expiry choice on the terminal opens THE
  CALENDAR (Noah, 2026-09-12: "for every exp
  dropdown on the website i want it to be the
  calendar we already have installed — the board
  of Compass, and so on and so forth"). The trigger
  is the dropdown card's, so a line of cards still
  reads as one line; the card that opens is the
  ExpiryPicker's calendar.

  NOT THE COMPASS BOARD (2026-09-14): its Expiry is
  four named tenors — 0DTE, Weekly, Swing, LEAPS —
  and as lit days only the two inside the month on
  screen showed; Swing and LEAPS were pages away.
  A tenor with a name is a dropdown row, not a day;
  the calendar stays wherever a DAY is the choice.

  TWO KINDS OF HOST. A desk that prices a fixed set
  of expiries (the book's buckets) hands its
  choices with their real dates:
  they sit above the grid as pills and their days
  are the only lit days in the grid — the reader
  sees at once which expiries the desk has. A desk
  that prices any day (the Weigher's chain) opens
  every trading day inside its reach and turns the
  day into its own value. A choice with no date
  ("Every expiry") is a pill alone.
==================================================
*/

import { useState, type CSSProperties } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { CARD, type DropdownOption } from './DropdownSelect';
import { isoDate, isTradingDay, today } from '../../core/calendar';

const SILVER_FILL = 'rgb(var(--silver-fill))';

/** A choice and the real day it resolves to — null for a choice that is not a day */
export interface ExpiryChoice<T extends string | number> extends DropdownOption<T> {
  date: Date | null;
  /** A choice the desk cannot draw right now (the calendar's columns past what fits, 2026-09-14):
      its day stays dim, its pill inert; the hint says why */
  disabled?: boolean;
}

interface ExpiryCardProps<T extends string | number> {
  label?: string;
  value: T;
  choices: ExpiryChoice<T>[];
  onChange: (v: T) => void;
  /** The host prices ANY trading day up to `days` calendar days out, and turns a day into its value */
  free?: { days: number; toValue: (d: Date) => T | null };
  title?: string;
  align?: 'start' | 'end';
  icon?: LucideIcon;
  ink?: string;
  testId?: string;
  /** One line the card says about the choices right now — why some days are dim */
  note?: string;
  /** The trigger's height: 28 by rest; `sm` is 24 — for a rail's head beside its view tabs (2026-09-16) */
  size?: 'md' | 'sm';
  /** The card WITHOUT its printed name — for a line that measured itself too short for four named cards (the Weigher's
      chain head on a laptop, 2026-09-20). The name stays in the tooltip, the aria-label and the open card's heading. */
  bare?: boolean;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const ExpiryCard = <T extends string | number>({ label = 'Expiry', value, choices, onChange, free, title, align = 'start', icon: Icon = CalendarDays, ink, testId, note, size = 'md', bare = false }: ExpiryCardProps<T>) => {
  const [open, setOpen] = useState(false);
  const t = today();
  const current = choices.find(c => c.value === value);
  const byDay = new Map<string, ExpiryChoice<T>>();
  for (const c of choices) if (c.date && !byDay.has(isoDate(c.date))) byDay.set(isoDate(c.date), c);
  const last = free ? addDays(t, free.days) : null;
  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
  };
  const pickDay = (d: Date) => {
    const hit = byDay.get(isoDate(d));
    if (hit) return pick(hit.value);
    if (free) {
      const v = free.toValue(d);
      if (v != null) pick(v);
    }
  };
  const selected = current?.date ?? undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-dropdown={testId ?? label}
          data-expiry-card
          aria-label={`${label}: ${current?.label ?? ''}`}
          title={note ?? (bare ? label : undefined)}
          data-expiry-note={note ? '' : undefined}
          className={`hit group inline-flex items-center gap-1.5 ${size === 'sm' ? 'h-6 px-2' : 'h-7 px-2.5'} rounded-md border border-borderSubtle bg-chip hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors font-mono select-none`}
          style={ink ? ({ '--ink': ink } as CSSProperties) : undefined}
        >
          <Icon
            className={`w-3 h-3 shrink-0 transition-colors duration-200 ${ink ? 'text-textMuted group-hover:text-[color:var(--ink)] group-data-[state=open]:text-[color:var(--ink)]' : 'text-textMuted'}`}
            aria-hidden="true"
            data-dropdown-icon
          />
          {!bare && <span className="text-[11px] text-textMuted">{label}</span>}
          <span className="text-[11px] font-semibold text-textPrimary">{current?.label ?? '—'}</span>
          <ChevronDown className="w-3 h-3 text-textMuted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={6} collisionPadding={12} className={`${CARD} p-3 outline-none w-[300px]`} data-dropdown-card={testId ?? label} data-date-picker>
          {/* JUST THE CALENDAR (Noah, 2026-09-12, on a first cut with the
              choices as pills above the grid: "over complicated, shouldn't it
              just be the calendar, that's it?") — the title, the grid with the
              desk's days lit, one line at the foot */}
          <div className="px-0.5 pb-1 font-mono text-[11px] text-textMuted">{title ?? label}</div>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={d => d && pickDay(d)}
            defaultMonth={selected ?? t}
            /* a day is pickable when it is a session AND the desk prices it */
            disabled={d => d < t || !isTradingDay(d) || (free ? d > last! : !byDay.has(isoDate(d)) || !!byDay.get(isoDate(d))?.disabled)}
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
              selected: '[&>button]:bg-silverFill [&>button]:text-[#0a0a0a] [&>button]:font-semibold [&>button:hover]:bg-silverFill',
              today: '[&>button]:shadow-[inset_0_0_0_1px_rgb(var(--silver)/0.45)]',
              outside: '[&>button]:text-textMuted/40',
              disabled: '[&>button]:text-textMuted/30 [&>button]:cursor-not-allowed [&>button:hover]:bg-transparent',
              hidden: 'invisible',
              focused: '',
            }}
          />
          {note && (
            <p className="mt-2 text-[11px] leading-snug text-textSecondary" data-expiry-card-note>
              {note}
            </p>
          )}
          <div className="mt-2 pt-2 border-t border-borderSubtle/70 flex items-center justify-between gap-3">
            <p className="text-[11px] text-textMuted">{free ? `Any trading day up to ${free.days} days out.` : 'The lit days are the expiries this desk prices.'}</p>
            {/* a choice that is not a day (the book's "Every expiry") sits at the foot, alone */}
            {choices
              .filter(c => !c.date)
              .map(c => {
                const on = c.value === value;
                return (
                  <button
                    key={String(c.value)}
                    type="button"
                    onClick={() => pick(c.value)}
                    aria-pressed={on}
                    disabled={c.disabled}
                    title={c.hint}
                    className="shrink-0 h-6 px-2 rounded-full border text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={on ? { background: SILVER_FILL, color: '#0a0a0a', borderColor: SILVER_FILL } : { color: 'rgb(var(--text-secondary))', borderColor: 'rgb(var(--border-muted))' }}
                    data-expiry-choice={String(c.value)}
                  >
                    {c.label}
                  </button>
                );
              })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default ExpiryCard;
