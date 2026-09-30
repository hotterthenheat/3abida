/*
==================================================
  SLAYER TERMINAL - REVIEW · THE JOURNAL'S CALENDAR
  (components/review/JournalCalendar.tsx)

  The replayed days, a month at a time: what each day
  made or lost, how many trades closed on it, and a dot
  where a day has words of its own. The grid is the
  Earnings board's (five trading days a week, hairlines
  between the cells, silver for where you are); a day is
  a TRADING day — a future closed on Sunday evening
  belongs to Monday, as it does on the desk.

  A day opens UNDER the month: its trades (each a door
  to its page) and THE DAY'S NOTE — the plan before,
  the review after. A note is a session's (the same
  date replayed in another session is another day), so
  the panel gives one to every session that traded it.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ContractLabel from '../ui/ContractLabel';
import { dirInk, pct, rWords, usdSigned } from './words';
import { ENDED, whenWords, type DayNote, type JournalRow } from '../../data/review/journal';
import { contractWords } from '../../data/review/quotes';
import { setDayNote } from '../../data/review/store';
import { dateOf } from '../../data/review/tape';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const monthOf = (iso: string) => iso.slice(0, 7);
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

interface Props {
  rows: JournalRow[];
  /** A trade's page */
  onOpen: (r: JournalRow) => void;
  /** Where a day's note is kept — the journal's own store (the backtest's sessions by rest; the paper accounts' key) */
  onDayNote?: (id: string, day: string, patch: Partial<DayNote>) => void;
}

const JournalCalendar = ({ rows, onOpen, onDayNote = setDayNote }: Props) => {
  /* the trades of each trading day, and the months that have any */
  const byDay = useMemo(() => {
    const m = new Map<string, JournalRow[]>();
    for (const r of rows) m.set(r.t.closed.day, [...(m.get(r.t.closed.day) ?? []), r]);
    return m;
  }, [rows]);
  const months = useMemo(() => [...new Set([...byDay.keys()].map(monthOf))].sort(), [byDay]);
  const [month, setMonth] = useState(() => months[months.length - 1] ?? monthOf(new Date().toISOString()));
  const [day, setDay] = useState<string | null>(null);
  /* the cut moved under the month in hand: go to the newest month it has */
  useEffect(() => {
    if (months.length && !months.includes(month)) setMonth(months[months.length - 1]);
  }, [months, month]);
  useEffect(() => {
    if (day && monthOf(day) !== month) setDay(null);
  }, [month, day]);

  const [y, m] = month.split('-').map(Number);
  const weeks = useMemo(() => {
    const out: (string | null)[][] = [];
    let week: (string | null)[] = [];
    const last = new Date(y, m, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const wd = new Date(y, m - 1, d).getDay(); // 0 Sunday … 6 Saturday
      if (wd === 0 || wd === 6) continue;
      if (wd === 1 && week.length) {
        out.push(week);
        week = [];
      }
      if (!week.length) for (let i = 1; i < wd; i++) week.push(null);
      week.push(iso(y, m - 1, d));
    }
    if (week.length) {
      while (week.length < 5) week.push(null);
      out.push(week);
    }
    return out;
  }, [y, m]);

  const inMonth = rows.filter(r => monthOf(r.t.closed.day) === month);
  const net = inMonth.reduce((a, r) => a + r.t.pnl, 0);
  const days = [...new Set(inMonth.map(r => r.t.closed.day))];
  const green = days.filter(d => (byDay.get(d) ?? []).reduce((a, r) => a + r.t.pnl, 0) > 0).length;
  const at = months.indexOf(month);
  const door = 'inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

  const open = day ? (byDay.get(day) ?? []) : [];
  /* the day's trades, by the session that made them — a day's note is that session's */
  const bySession = useMemo(() => {
    const m = new Map<string, JournalRow[]>();
    for (const r of open) m.set(r.s.id, [...(m.get(r.s.id) ?? []), r]);
    return [...m.values()];
  }, [open]);

  return (
    <div data-journal-calendar={month}>
      <div className="px-5 py-2.5 flex items-center gap-3 flex-wrap border-t border-borderSubtle">
        <button type="button" onClick={() => setMonth(months[at - 1])} disabled={at <= 0} title="The month before" aria-label="The month before" className={door} data-calendar-prev>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="min-w-[132px] text-center text-[13px] font-semibold text-textPrimary" data-calendar-month>
          {MONTHS[m - 1]} {y}
        </span>
        <button type="button" onClick={() => setMonth(months[at + 1])} disabled={at < 0 || at >= months.length - 1} title="The month after" aria-label="The month after" className={door} data-calendar-next>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <span className="ml-auto font-mono text-[11px] tnum text-textSecondary whitespace-nowrap">
          {inMonth.length} {inMonth.length === 1 ? 'trade' : 'trades'} · <span className={dirInk(net)}>{usdSigned(net, 0)}</span>
          {days.length > 0 && (
            <span className="text-textMuted">
              {' '}
              · {green} of {days.length} {days.length === 1 ? 'day' : 'days'} made money
            </span>
          )}
        </span>
      </div>
      {/* on a phone the five-day board scrolls sideways inside its box at a readable width (the Earnings board's rule) */}
      <div className="border-t border-borderSubtle max-lg:overflow-x-auto">
        <div className="grid grid-cols-5 gap-px bg-borderSubtle/60 max-lg:min-w-[600px]">
          {WEEKDAYS.map(w => (
            <div key={w} className="bg-panel px-3 h-7 flex items-center font-mono text-[9px] font-semibold uppercase tracking-widest text-[rgb(var(--grid-head))]">
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-5 gap-px bg-borderSubtle/60 border-t border-borderSubtle/60 max-lg:min-w-[600px]">
            {week.map((d, di) => {
              if (!d) return <div key={di} className="bg-panel min-h-[66px]" />;
              const trades = byDay.get(d) ?? [];
              const made = trades.reduce((a, r) => a + r.t.pnl, 0);
              const won = trades.filter(r => r.t.pnl > 0).length;
              const noted = trades.some(r => r.s.days?.[d]?.plan || r.s.days?.[d]?.review);
              const on = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(on ? null : d)}
                  disabled={!trades.length}
                  aria-pressed={on}
                  title={trades.length ? `${trades.length} closed · open the day` : 'Nothing closed on this day'}
                  className={`relative bg-panel px-3 py-2 min-h-[66px] text-left transition-colors ${trades.length ? 'hover:bg-ink/[0.03] cursor-pointer' : 'cursor-default'} ${on ? 'bg-silver/[0.06] shadow-[inset_0_2px_0_0_rgb(var(--silver))]' : ''}`}
                  data-calendar-day={d}
                  data-trades={trades.length}
                >
                  <span className={`font-mono text-[11px] font-bold tnum ${on ? 'text-silver' : trades.length ? 'text-textPrimary' : 'text-textMuted'}`}>{Number(d.slice(8))}</span>
                  {noted && <span className="absolute top-2.5 right-3 w-1.5 h-1.5 rounded-full bg-silver" title="This day has words of its own" />}
                  {trades.length > 0 && (
                    <span className="mt-1.5 block">
                      <span className={`block font-mono text-[13px] font-semibold tnum ${dirInk(made)}`}>{usdSigned(made, 0)}</span>
                      <span className="block font-mono text-[9px] tnum text-textMuted">
                        {trades.length} {trades.length === 1 ? 'trade' : 'trades'} · {pct(won / trades.length)} won
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {day && (
        <div key={day} className="border-t border-borderSubtle animate-soft-in" data-calendar-open={day}>
          <div className="px-5 py-2.5 flex items-center gap-3">
            <span className="text-[13px] font-semibold text-textPrimary">{dateOf(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            <span className={`font-mono text-[12px] font-semibold tnum ${dirInk(open.reduce((a, r) => a + r.t.pnl, 0))}`}>{usdSigned(open.reduce((a, r) => a + r.t.pnl, 0))}</span>
          </div>
          {bySession.map(list => {
            const s = list[0].s;
            const note = s.days?.[day] ?? {};
            return (
              <div key={s.id} className="border-t border-borderSubtle/70 px-5 py-3 grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-calendar-session={s.id}>
                <div className="min-w-0">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted truncate">{s.name}</div>
                  <div className="mt-1.5 flex flex-col">
                    {list.map(r => (
                      <button key={r.key} type="button" onClick={() => onOpen(r)} className="group flex items-center gap-3 h-9 border-b border-borderSubtle/60 text-left hover:bg-ink/[0.03] transition-colors" title="Open the trade" data-calendar-trade={r.key}>
                        {r.fut ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="font-semibold text-textPrimary">{r.t.contract}</span>
                            <span className={`font-semibold ${r.t.long ? 'text-bull' : 'text-bear'}`}>{r.t.long ? 'long' : 'short'}</span>
                          </span>
                        ) : (
                          <ContractLabel contract={contractWords(r.t.contract)} right={r.t.contract.right} logo={r.t.contract.ticker} size="sm" />
                        )}
                        <span className="font-mono text-[10px] tnum text-textMuted whitespace-nowrap">
                          {whenWords(r, r.t.closed).split(' · ')[1] ?? ''} · {ENDED[r.t.how]}
                        </span>
                        <span className={`ml-auto font-mono text-[11px] font-semibold tnum whitespace-nowrap ${dirInk(r.t.pnl)}`}>
                          {usdSigned(r.t.pnl)} <span className="text-[10px] font-normal opacity-80">{r.t.r != null ? rWords(r.t.r) : ''}</span>
                        </span>
                        <ChevronRight className="w-3 h-3 text-textMuted group-hover:text-textPrimary transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-w-0 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ['plan', 'The plan, before', 'What you were looking for, and what would have kept you out'],
                      ['review', 'The review, after', 'How the day went against the plan — one thing to keep, one to drop'],
                    ] as const
                  ).map(([key, ask, hint]) => (
                    <label key={key} className="flex flex-col gap-1.5 min-w-0">
                      <span className="text-[12px] font-medium text-textPrimary">{ask}</span>
                      <textarea
                        key={`${s.id}:${day}:${key}`}
                        className="min-h-[84px] px-3 py-2 rounded-md border border-borderSubtle bg-panel text-[12px] leading-relaxed text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/60 transition-colors resize-y"
                        defaultValue={note[key] ?? ''}
                        onBlur={e => {
                          const v = e.target.value.trim();
                          if (v !== (note[key] ?? '')) onDayNote(s.id, day, { [key]: v });
                        }}
                        placeholder={hint}
                        data-day-note={key}
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default JournalCalendar;
