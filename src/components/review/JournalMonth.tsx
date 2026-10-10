/*
==================================================
  SLAYER TERMINAL - THE JOURNAL'S MONTH
  (components/review/JournalMonth.tsx)

  The first thing the journal shows (Noah, 2026-09-25:
  "i love the calendar view as the first thing that
  greets you and thats what i want"; 2026-09-26, on the
  first cut: "the calendar should be the nice curved
  corners … remember my previous say about how i wanted
  to calendar to look"). His reference — the partner's
  journal — laid the month as CARDS: a rounded box a day,
  air between them, Sunday to Saturday, and a column for
  each week's total. This is that, in the house's inks:

    a day        a rounded card; its number top left; a
                 day that closed something wears WHAT IT
                 MADE — its figure in its ink, its ground
                 and edge washed in it, deeper the bigger
                 the day against the month's biggest — and
                 how many closed and won; A SMALL PEN where
                 it has words of its own (a dot at first —
                 Noah, 2026-09-26: "why do some of these
                 have a little circle on them" → "use the
                 pen": a mark that is not a figure has to
                 say what it is)
    today        its edge in silver, and the word
    the open day a silver ring
    the week     its own card at the row's end, the week's
                 total and how many closed

  A day is THE CALENDAR DAY the trade closed on, New
  York's (journalFigures.ts). The arrows walk the months,
  "This month" comes home.
==================================================
*/

import { ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { card } from './DeskShell';
import { dirInk, pct, usdSigned } from './words';
import { monthWeeks, monthWords, shiftMonth, type DayTotal } from '../../data/review/journalFigures';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/* ON A PHONE THE WEEK IS SEVEN COLUMNS ACROSS THE CARD (the audit's PR-6: the month scrolled sideways and a phone saw Sunday
   to Wednesday only) — the week's own card waits for a wider screen */
const GRID = 'grid grid-cols-7 gap-1 lg:grid-cols-[repeat(7,minmax(0,1fr))_minmax(84px,0.85fr)] lg:gap-1.5';
const door = 'hit inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';

/** "+1.2K" · "−84" — a day's figure in a phone's narrow day */
const shortSigned = (v: number): string => {
  const a = Math.abs(v);
  const sign = v > 0.005 ? '+' : v < -0.005 ? '−' : '';
  return `${sign}${a >= 1000 ? `${(a / 1000).toFixed(a >= 10_000 ? 0 : 1)}K` : Math.round(a)}`;
};
/** How deep a day's wash is: a little for any day, most for the month's biggest — eased, so a small day still shows */
const washOf = (net: number, biggest: number): number => (biggest > 0 ? 0.1 + 0.26 * Math.pow(Math.min(1, Math.abs(net) / biggest), 0.6) : 0);

interface Props {
  month: string;
  onMonth: (month: string) => void;
  /** The month the clock is in — "This month" brings it back */
  home: string;
  days: Map<string, DayTotal>;
  today: string;
  /** The day that is open */
  picked: string | null;
  onPick: (day: string | null) => void;
  /** Days with words of their own */
  noted: ReadonlySet<string>;
  /** The word on today's day — the backtest's book says "Clock's day": its today is the replayed one */
  todayWord?: string;
}

const JournalMonth = ({ month, onMonth, home, days, today, picked, onPick, noted, todayWord = 'Today' }: Props) => {
  const weeks = monthWeeks(month);
  const inMonth = [...days.values()].filter(d => d.day.startsWith(month));
  const net = inMonth.reduce((x, d) => x + d.net, 0);
  const trades = inMonth.reduce((x, d) => x + d.n, 0);
  const green = inMonth.filter(d => d.net > 0).length;
  const biggest = Math.max(0, ...inMonth.map(d => Math.abs(d.net)));
  const monthName = monthWords(month).split(' ')[0];

  return (
    <div className={`${card} flex flex-col min-w-0 h-full`} data-journal-month={month}>
      <div className="px-5 pt-3.5 pb-2.5 flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => onMonth(shiftMonth(month, -1))} title="The month before" aria-label="The month before" className={door} data-journal-month-prev>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="min-w-[140px] text-center text-[15px] font-semibold text-textPrimary" data-journal-month-name>
          {monthWords(month)}
        </span>
        <button type="button" onClick={() => onMonth(shiftMonth(month, 1))} title="The month after" aria-label="The month after" className={door} data-journal-month-next>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        {month !== home && (
          <button type="button" onClick={() => onMonth(home)} className="hit h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-journal-month-home>
            This month
          </button>
        )}
        <span className="ml-auto font-mono text-[11px] tnum text-textSecondary whitespace-nowrap" data-journal-month-sum>
          {trades === 0 ? (
            <span className="text-textMuted">Nothing closed this month</span>
          ) : (
            <>
              <span className="text-textMuted">{monthName}</span> <span className={`text-[13px] font-semibold ${dirInk(net)}`}>{usdSigned(net, 0)}</span>
              <span className="text-textMuted">
                {' '}
                · {trades} {trades === 1 ? 'trade' : 'trades'} · {green} of {inMonth.length} {inMonth.length === 1 ? 'day' : 'days'} made money
              </span>
            </>
          )}
        </span>
      </div>
      {/* on a phone the board scrolls sideways inside its box at a readable width (the Earnings board's rule) */}
      <div className="px-2 lg:px-3 pb-3 flex-1 flex flex-col">
        <div className="flex-1 flex flex-col gap-1 lg:gap-1.5">
          <div className={GRID}>
            {[...WEEKDAYS, 'Week'].map(w => (
              <div key={w} className={`px-1 lg:px-2.5 h-6 flex items-center font-mono text-[10px] font-semibold uppercase lg:tracking-widest text-[rgb(var(--grid-head))] ${w === 'Week' ? 'justify-end max-lg:hidden' : ''}`}>
                {w}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => {
            const wk = week.filter((d): d is string => !!d).map(d => days.get(d)).filter((d): d is DayTotal => !!d);
            const wNet = wk.reduce((x, d) => x + d.net, 0);
            const wN = wk.reduce((x, d) => x + d.n, 0);
            return (
              <div key={wi} className={`${GRID} flex-1`} data-journal-week={wi}>
                {week.map((d, di) => {
                  if (!d) return <div key={di} className="min-h-[52px] lg:min-h-[76px]" aria-hidden="true" />;
                  const t = days.get(d);
                  const on = d === picked;
                  const isToday = d === today;
                  const future = d > today;
                  const wash = t ? washOf(t.net, biggest) : 0;
                  const ink = t ? (t.net > 0 ? 'bull' : t.net < 0 ? 'bear' : null) : null;
                  const date = new Date(`${d}T12:00:00`);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onPick(on ? null : d)}
                      aria-pressed={on}
                      title={`${DAYS[date.getDay()]}, ${monthName} ${date.getDate()} — ${t ? `${t.n} closed, ${usdSigned(t.net)}` : future ? 'still to come' : 'nothing closed'} · ${on ? 'close the day' : 'open the day'}`}
                      className={`relative min-w-0 min-h-[52px] lg:min-h-[76px] rounded-md lg:rounded-lg border px-1 lg:px-2.5 py-1 lg:py-1.5 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-silver/60 ${on ? 'ring-2 ring-silver border-transparent' : isToday ? 'border-silver/60' : 'border-borderSubtle hover:border-borderMuted'} ${!t ? 'hover:bg-ink/[0.03]' : ''}`}
                      style={ink ? { background: `rgb(var(--${ink}) / calc(${wash.toFixed(3)} * var(--day-wash)))`, borderColor: on ? undefined : `rgb(var(--${ink}) / ${(0.3 + wash).toFixed(3)})` } : undefined}
                      data-journal-day={d}
                      data-trades={t?.n ?? 0}
                      data-on={on || undefined}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`font-mono text-[11px] font-bold tnum ${isToday || on ? 'text-silver' : t ? 'text-textPrimary' : future ? 'text-textMuted/80' : 'text-textMuted'}`}>{date.getDate()}</span>
                        {isToday && <span className="max-lg:hidden font-mono text-[10px] font-semibold uppercase tracking-widest text-silver">{todayWord}</span>}
                        {noted.has(d) && <PenLine className="ml-auto w-3 h-3 text-silver" strokeWidth={2} aria-label="This day has words of its own" data-journal-day-noted />}
                      </span>
                      {t && (
                        <span className="mt-1.5 block">
                          {/* THE FIGURE IN THE PRIMARY INK, its sign and the day's wash saying the way (the audit's X12: a green or red
                              figure on its own tinted ground stood at 3.5:1) */}
                          <span className="max-lg:hidden block font-mono text-[14px] font-semibold tnum leading-none text-textPrimary">{usdSigned(t.net, 0)}</span>
                          {/* a phone's seventh of the card: the figure short — "+1.2K", "−84" */}
                          <span className="lg:hidden block font-mono text-[11px] font-semibold tnum leading-none text-textPrimary">{shortSigned(t.net)}</span>
                          {/* the two halves wrap as wholes on a narrow month */}
                          <span className="max-lg:hidden mt-1 block font-mono text-[10px] tnum text-textSecondary leading-snug">
                            <span className="whitespace-nowrap">
                              {t.n} {t.n === 1 ? 'trade' : 'trades'} ·
                            </span>{' '}
                            <span className="whitespace-nowrap">{pct(t.wins / t.n)} won</span>
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
                {/* THE WEEK: what its days in this month made, a card of its own */}
                <div className="max-lg:hidden min-h-[76px] rounded-lg border border-borderSubtle bg-ink/[0.025] px-2.5 py-1.5 flex flex-col items-end justify-center text-right" title={`This week's days in ${monthName}`} data-journal-week-sum={wN}>
                  {wN > 0 ? (
                    <>
                      <span className={`font-mono text-[14px] font-semibold tnum leading-none ${dirInk(wNet)}`}>{usdSigned(wNet, 0)}</span>
                      <span className="mt-1.5 font-mono text-[10px] tnum text-textMuted">
                        {wN} {wN === 1 ? 'trade' : 'trades'}
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-[11px] text-textMuted">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default JournalMonth;
