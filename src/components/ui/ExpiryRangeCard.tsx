/*
==================================================
  SLAYER TERMINAL - THE EXPIRY RANGE CARD
  (components/ui/ExpiryRangeCard.tsx)

  The Map's Expiries card (Noah, 2026-09-22: "right
  now it forces you to start from the current date
  and goes through to the date you choose… there
  should be some sort of max you can choose, 7 being
  the max when you are choosing all 5 greeks"). The
  ExpiryCard beside it picks ONE day; this one picks
  a WINDOW — From and Through — on the same calendar,
  with the book's expiries as the only lit days.

  TWO ROWS, ONE GRID. From and Through sit above the
  grid as two rows; the row that is armed takes the
  next day clicked. The card opens with Through armed
  — that is the change a reader makes most — and a
  click on From arms it. A Through day before From
  pulls From down to it; a From day past Through
  pushes Through up to it. Shortcuts at the head do
  both at once: Today only · This week · Next 7.

  THE CEILING is the host's — how many expiries it
  will draw at once (seven with five greeks side by
  side, more with fewer). With Through armed, days
  past From + ceiling stay dim and the foot says why;
  a From moved so far that the window would run over
  drags Through in with it. The note under the grid
  is the host's other cut — what fits at the width.
==================================================
*/

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { CARD } from './DropdownSelect';
import { isoDate, today } from '../../core/calendar';

const SILVER_FILL = 'rgb(var(--silver-fill))';

/** One expiry the book holds: its index (the value), its real day, the words for it */
export interface ExpiryDay {
  value: number;
  date: Date;
  label: string;
  hint?: string;
}
/** A window in one press */
export interface ExpiryShortcut {
  label: string;
  hint?: string;
  from: number;
  through: number;
}

interface ExpiryRangeCardProps {
  label?: string;
  days: ExpiryDay[];
  from: number;
  through: number;
  onChange: (from: number, through: number) => void;
  /** The most expiries the host draws at once */
  ceiling: number;
  /** Why — "7 at most with five greeks" */
  ceilingWhy: string;
  shortcuts: ExpiryShortcut[];
  /** One line the card says about the window right now — what fits */
  note?: string;
  title?: string;
  align?: 'start' | 'end';
  testId?: string;
  /** The card WITHOUT its printed name — for a line that measured itself too short */
  bare?: boolean;
}

type Side = 'from' | 'through';

const ExpiryRangeCard = ({ label = 'Expiries', days, from, through, onChange, ceiling, ceilingWhy, shortcuts, note, title, align = 'start', testId, bare = false }: ExpiryRangeCardProps) => {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<Side>('through');
  const t = today();
  const byDay = new Map<string, ExpiryDay>();
  for (const d of days) if (!byDay.has(isoDate(d.date))) byDay.set(isoDate(d.date), d);
  const at = (i: number) => days[Math.max(0, Math.min(days.length - 1, i))];
  const a = at(from);
  const b = at(through);
  const one = a.value === b.value;
  /* what the trigger prints: "Today" · "Today → Oct 12" · "Sep 23 → Oct 12" */
  const words = one ? a.label : `${a.label} → ${b.label}`;
  const count = Math.max(1, b.value - a.value + 1);

  const commit = (f: number, g: number) => {
    const lo = Math.min(f, g);
    const hi = Math.max(f, g);
    /* the window never runs past the ceiling: Through gives way to From */
    onChange(lo, Math.min(hi, lo + ceiling - 1));
  };
  const pickDay = (d: Date) => {
    const hit = byDay.get(isoDate(d));
    if (!hit) return;
    if (side === 'from') commit(hit.value, Math.max(hit.value, through));
    else commit(Math.min(from, hit.value), hit.value);
  };
  /* with Through armed a day past the ceiling stays dim; From is free (Through follows it) */
  const dim = (d: Date) => {
    const hit = byDay.get(isoDate(d));
    if (!hit) return true;
    if (side === 'through') return hit.value - from + 1 > ceiling && hit.value >= from;
    return false;
  };
  const inWindow = (d: Date) => {
    const hit = byDay.get(isoDate(d));
    return !!hit && hit.value >= from && hit.value <= through;
  };
  const armed = side === 'from' ? a.date : b.date;

  return (
    <Popover.Root
      open={open}
      onOpenChange={o => {
        setOpen(o);
        if (o) setSide('through');
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          data-dropdown={testId ?? label}
          data-expiry-card
          data-expiry-range={`${from}-${through}`}
          aria-label={`${label}: ${words}`}
          title={note ?? (bare ? label : undefined)}
          data-expiry-note={note ? '' : undefined}
          className="hit group inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors font-mono select-none"
        >
          <CalendarDays className="w-3 h-3 shrink-0 text-textMuted" aria-hidden="true" data-dropdown-icon />
          {!bare && <span className="text-[11px] text-textMuted">{label}</span>}
          <span className="text-[11px] font-semibold text-textPrimary whitespace-nowrap">{words}</span>
          <ChevronDown className="w-3 h-3 text-textMuted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={6} collisionPadding={12} className={`${CARD} p-3 outline-none w-[300px]`} data-dropdown-card={testId ?? label} data-date-picker>
          <div className="px-0.5 pb-1 font-mono text-[11px] text-textMuted">{title ?? label}</div>
          {/* the shortcuts: a window in one press */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2" data-range-shortcuts>
            {shortcuts.map(s => {
              const on = s.from === from && s.through === through;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    commit(s.from, s.through);
                    setOpen(false);
                  }}
                  aria-pressed={on}
                  title={s.hint}
                  className="shrink-0 h-6 px-2 rounded-full border text-[11px] font-medium transition-colors"
                  style={on ? { background: SILVER_FILL, color: '#0a0a0a', borderColor: SILVER_FILL } : { color: 'rgb(var(--text-secondary))', borderColor: 'rgb(var(--border-muted))' }}
                  data-range-shortcut={s.label}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {/* the two rows: the armed one takes the next day clicked */}
          <div className="grid grid-cols-2 gap-1.5 pb-2" data-range-rows>
            {(['from', 'through'] as Side[]).map(s => {
              const day = s === 'from' ? a : b;
              const on = side === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  aria-pressed={on}
                  className={`flex items-baseline justify-between gap-2 h-8 px-2.5 rounded-md border font-mono transition-colors ${on ? 'border-silver/60 bg-silver/[0.08]' : 'border-borderSubtle hover:border-borderMuted'}`}
                  data-range-side={s}
                  data-range-armed={on || undefined}
                >
                  <span className="text-[11px] uppercase tracking-widest text-textMuted">{s}</span>
                  <span className={`text-[11px] font-semibold ${on ? 'text-silver' : 'text-textPrimary'}`}>{day.label}</span>
                </button>
              );
            })}
          </div>
          <DayPicker
            mode="single"
            selected={armed}
            onSelect={d => d && pickDay(d)}
            /* the grid opens on From's month — the near expiries first, whichever row is armed (a Through in the next
               month would open there and hide this week) */
            defaultMonth={a.date ?? t}
            disabled={d => d < t || dim(d)}
            modifiers={{ window: inWindow }}
            modifiersClassNames={{ window: '[&>button]:bg-silver/[0.14]' }}
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
            <p className="text-[11px] text-textMuted">
              {count} {count === 1 ? 'expiry' : 'expiries'} · {ceilingWhy}
            </p>
            <p className="text-[11px] text-textMuted whitespace-nowrap">The lit days are the book's expiries.</p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default ExpiryRangeCard;
