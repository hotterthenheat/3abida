/*
==================================================
  SLAYER TERMINAL - EXPIRY CALENDAR
  (components/ui/ExpiryCalendar.tsx)

  THE TRACE CALENDAR, for expiries (Noah, 2026-09-12:
  "this is the photo of the calendar in my trace
  page right it looks very nice right. Use this
  calendar in the expiry tab on the board"). The
  same month grid the print drilldown opens
  (DatePicker: the month with its chevrons, the
  S·M·T·W·T·F·S row, the days, one full-width
  button at the foot) — turned to face forward.
  Where the session picker deadens weekends and
  the future, this one deadens EVERY DAY THE NAME
  DOES NOT LIST ("only show the dates that these
  tickers have cause every ticker may have
  different option dates"): a listed expiry is
  bright and clickable, today wears the lime
  marker, the chosen one wears the white
  selection, and the rest cannot be picked.

  The trigger is a card on the line of cards (the
  DropdownSelect grammar) with ‹ › steppers — the
  drilldown's "‹ Sep 11 ›" pill, in the card
  grammar — so an expiry is one click away either
  way: step, or open the month.
==================================================
*/

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { CARD } from './DropdownSelect';
import { isoDate, today, type Expiry } from '../../core/calendar';
import type { ListingPattern } from '../../data/optionChain';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Sep 14 · Mon", or "Today · Sep 14" on the same-day contract */
export const expiryWords = (e: Expiry): string => {
  const day = `${SHORT[e.date.getMonth()]} ${e.date.getDate()}`;
  const year = e.date.getFullYear() === today().getFullYear() ? '' : ` '${String(e.date.getFullYear()).slice(2)}`;
  return e.dte === 0 ? `Today · ${day}` : `${day}${year} · ${e.weekday}`;
};

const PATTERN_WORDS: Record<ListingPattern, string> = {
  daily: 'dailies, Fridays and monthlies',
  weekly: 'Fridays and monthlies',
  monthly: 'monthlies and quarterlies',
};

interface ExpiryCalendarProps {
  /** YYYY-MM-DD of the chosen expiry */
  value: string;
  /** The name's listed expiries, ascending — the only days that can be picked */
  expiries: Expiry[];
  onChange: (e: Expiry) => void;
  /** The card's name, printed small before the date */
  label?: string;
  /** The listing shape, for the foot's one line */
  pattern?: ListingPattern;
  /** A glyph before the label, in the muted ink — the card's own face on a line of cards */
  icon?: LucideIcon;
  /** The glyph's own colour on hover and while open — the sidebar's rule */
  ink?: string;
  align?: 'start' | 'end';
  /** ‹ › on either side of the card — one listed expiry back or forward */
  steppers?: boolean;
  title?: string;
  /** A data-* hook for probes */
  testId?: string;
  /** Given, the calendar can also mean EVERY expiry (the flow pages' cut): the
      foot grows a second button that clears the pick, and the trigger prints
      `anyLabel` while nothing is chosen */
  onClear?: () => void;
  clearLabel?: string;
  anyLabel?: string;
}

const ExpiryCalendar = ({ value, expiries, onChange, label = 'Expiry', pattern, icon: Icon = CalendarDays, ink, align = 'start', steppers = true, title, testId, onClear, clearLabel = 'Every expiry', anyLabel = 'Any' }: ExpiryCalendarProps) => {
  const [open, setOpen] = useState(false);
  const t = useMemo(() => today(), []);
  const byIso = useMemo(() => new Map(expiries.map(e => [isoDate(e.date), e])), [expiries]);
  const selected = byIso.get(value) ?? null;
  const idx = selected ? expiries.findIndex(e => isoDate(e.date) === value) : -1;
  /* The month on screen — the chosen expiry's, re-homed whenever the card opens */
  const [cursor, setCursor] = useState(() => new Date((selected?.date ?? t).getFullYear(), (selected?.date ?? t).getMonth(), 1));
  useEffect(() => {
    if (open) {
      const d = selected?.date ?? t;
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [open, selected, t]);

  const pick = (e: Expiry) => {
    onChange(e);
    setOpen(false);
  };
  const step = (dir: 1 | -1) => {
    const next = expiries[idx < 0 ? 0 : idx + dir];
    if (next) onChange(next);
  };

  // Leading blanks so the 1st lands under the right weekday
  const firstDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ];
  const nearest = expiries[0] ?? null;
  const listedThisMonth = expiries.filter(e => e.date.getFullYear() === cursor.getFullYear() && e.date.getMonth() === cursor.getMonth()).length;

  const stepBtn = 'inline-flex items-center justify-center w-6 h-7 rounded-md border border-borderSubtle bg-chip text-textMuted hover:text-textPrimary hover:border-borderMuted disabled:opacity-30 disabled:hover:text-textMuted disabled:hover:border-borderSubtle transition-colors';

  return (
    <span className="inline-flex items-center gap-1" data-expiry-calendar={testId ?? label}>
      {steppers && (
        <button type="button" onClick={() => step(-1)} disabled={idx <= 0} aria-label="Previous listed expiry" title="Previous expiry" className={stepBtn}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            data-dropdown={testId ?? label}
            data-date-trigger
            title={title}
            aria-label={`${label}: ${selected ? expiryWords(selected) : 'pick a date'}`}
            className="group inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors font-mono select-none"
            style={ink ? ({ '--ink': ink } as CSSProperties) : undefined}
          >
            <Icon
              className={`w-3 h-3 shrink-0 transition-colors duration-200 ${ink ? 'text-textMuted group-hover:text-[color:var(--ink)] group-data-[state=open]:text-[color:var(--ink)]' : 'text-textMuted'}`}
              aria-hidden="true"
              data-dropdown-icon
            />
            <span className="text-[9px] uppercase tracking-widest text-textMuted">{label}</span>
            <span className="text-[11px] font-semibold text-textPrimary tnum whitespace-nowrap">{selected ? expiryWords(selected) : onClear ? anyLabel : 'Pick a date'}</span>
            <ChevronDown className="w-3 h-3 text-textMuted" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align={align} sideOffset={6} collisionPadding={12} className={`${CARD} w-[300px] p-3.5 outline-none`} data-date-picker={testId ?? label}>
            {/* THE MONTH, with its chevrons — the drilldown's calendar, verbatim */}
            <div className="flex items-center justify-between mb-2.5">
              <button
                type="button"
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
                type="button"
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

            {/* THE DAYS: a listed expiry is live, everything else is dead — the
                name does not trade it, so it must not look clickable */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <span key={i} />;
                const listed = byIso.get(isoDate(d));
                const isToday = sameDay(d, t);
                const isSelected = !!selected && sameDay(d, selected.date);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!listed}
                    onClick={() => listed && pick(listed)}
                    title={listed ? `${expiryWords(listed)} · ${listed.dte === 0 ? 'expires at the bell' : `${listed.sessions} ${listed.sessions === 1 ? 'session' : 'sessions'}`}` : undefined}
                    data-expiry-day={listed ? isoDate(d) : undefined}
                    className={`h-8 rounded font-mono text-[12px] tnum transition-colors ${
                      !listed
                        ? 'text-textMuted/25 cursor-not-allowed'
                        : isSelected
                          ? 'bg-textPrimary text-[#0a0a0a] font-semibold'
                          : isToday
                            ? 'text-select font-semibold hover:bg-ink/[0.06]'
                            : 'text-textPrimary hover:bg-ink/[0.06]'
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* THE FOOT: the drilldown's one full-width button — "jump to today"
                turned toward the nearest listed expiry */}
            <div className={`mt-2.5 grid gap-1.5 ${onClear ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button
                type="button"
                disabled={!nearest}
                onClick={() => nearest && pick(nearest)}
                className="w-full py-2 rounded border border-borderSubtle font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors disabled:opacity-40"
                data-expiry-nearest
              >
                {nearest ? (nearest.dte === 0 ? 'Jump to today · 0DTE' : `Jump to nearest · ${SHORT[nearest.date.getMonth()]} ${nearest.date.getDate()}`) : 'Nothing listed'}
              </button>
              {onClear && (
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setOpen(false);
                  }}
                  aria-pressed={!selected}
                  className={`w-full py-2 rounded border font-mono text-[11px] uppercase tracking-wider transition-colors ${!selected ? 'border-silver/50 text-textPrimary bg-silver/[0.06]' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
                  data-expiry-clear
                >
                  {clearLabel}
                </button>
              )}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-textSecondary">
              {expiries.length} listed{pattern ? ` · ${PATTERN_WORDS[pattern]}` : ''}
              {listedThisMonth === 0 && expiries.length > 0 ? ' · nothing this month — step the month' : ''}
            </p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {steppers && (
        <button type="button" onClick={() => step(1)} disabled={idx < 0 ? expiries.length === 0 : idx >= expiries.length - 1} aria-label="Next listed expiry" title="Next expiry" className={stepBtn}>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  );
};

export default ExpiryCalendar;
