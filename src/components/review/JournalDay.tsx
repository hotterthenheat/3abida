/*
==================================================
  SLAYER TERMINAL - A DAY OF THE JOURNAL
  (components/review/JournalDay.tsx)

  What opens UNDER the month when a day is pressed (Noah,
  2026-09-25: "when clicking on a certain calendar date
  you should be able to see all of the trades you took
  with accounts etc."; 2026-09-26, on the first cut, whose
  day was a narrow column of crowded rows: "spacing is
  horrible … the inside of the journal when you click on
  a day … is also having similar problems"). Now the day
  takes the page's whole width:

    the head       the date, what it made, how many closed
                   and won, the accounts, its best and its
                   worst trade — and the ×
    the trades     the house's grid, the journal's own
                   columns (when it closed, THE ACCOUNT,
                   the contract, size, in → out, held, how
                   far it went against and for you, how it
                   ended, what it made) — a row opens the
                   trade's own page
    beside them    how the day went — its running total, a
                   point a trade, once there are two — and
                   THE DAY'S WORDS: the plan before, the
                   review after, one pair an account (a tab
                   each when more than one traded the day),
                   kept as they are typed with the house's
                   "Kept" (the trade page's grammar)
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UTCTimestamp } from 'lightweight-charts';
import { Check, X } from 'lucide-react';
import SessionsChart from '../record/SessionsChart';
import CardTabs from '../ui/CardTabs';
import { TraceGrid } from '../trace/TraceBox';
import type { Column } from '../ui/DataTable';
import { card, headWord } from './DeskShell';
import { dirInk, pct, usdSigned } from './words';
import { fmtClockLocal } from '../gex/chartTime';
import { titleOf, type DayNote, type JournalRow } from '../../data/review/journal';
import { runningOf, type DayTotal } from '../../data/review/journalFigures';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDay = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/* ---- a day's note, kept as it is typed ---- */
const NOTES = [
  { key: 'plan', ask: 'The plan, before', hint: 'What you were looking for, and what would have kept you out' },
  { key: 'review', ask: 'The review, after', hint: 'How the day went against the plan — one thing to keep, one to drop' },
] as const;
export const NoteField = ({ ask, hint, value, onKeep, testId }: { ask: string; hint: string; value: string; onKeep: (v: string) => void; testId: string }) => {
  const [mark, setMark] = useState<'empty' | 'keeping' | 'kept'>(value.trim() ? 'kept' : 'empty');
  /* the newest of what it was handed, for a flush after it has gone */
  const latest = useRef({ value, onKeep });
  latest.current = { value, onKeep };
  const pending = useRef<{ timer: number; v: string } | null>(null);
  const keepNow = (v: string) => {
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = null;
    const next = v.trim();
    if (next !== latest.current.value.trim()) latest.current.onKeep(next);
    setMark(next ? 'kept' : 'empty');
  };
  const keepSoon = (v: string) => {
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = { timer: window.setTimeout(() => keepNow(v), 700), v };
    setMark('keeping');
  };
  /* going away with a beat still running: what was typed is kept, on the day it was typed on */
  useEffect(
    () => () => {
      const p = pending.current;
      if (!p) return;
      window.clearTimeout(p.timer);
      const next = p.v.trim();
      if (next !== latest.current.value.trim()) latest.current.onKeep(next);
    },
    []
  );
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-medium text-textPrimary">{ask}</span>
        <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${mark === 'kept' ? 'text-silver' : 'text-textMuted'}`} data-journal-kept={mark} aria-live="polite">
          {mark === 'keeping' && 'Keeping…'}
          {mark === 'kept' && (
            <>
              <Check className="w-3 h-3" /> Kept
            </>
          )}
        </span>
      </span>
      <textarea
        className={`min-h-[80px] px-3 py-2.5 rounded-md border bg-chip text-[12px] leading-relaxed text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/60 transition-colors resize-y ${value.trim() ? 'border-silver/35' : 'border-borderSubtle'}`}
        defaultValue={value}
        onChange={e => keepSoon(e.target.value)}
        onBlur={e => keepNow(e.target.value)}
        placeholder={hint}
        aria-label={ask}
        data-day-note={testId}
      />
    </label>
  );
};

export interface DayHolder {
  id: string;
  name: string;
  note: DayNote;
}
interface Props {
  day: string;
  /** What closed on it (on the page's account, or every one) */
  total: DayTotal | null;
  /** Whose note the day shows: every account it was traded on — or, with none, the one in hand */
  holders: DayHolder[];
  onDayNote: (id: string, day: string, patch: Partial<DayNote>) => void;
  onOpen: (r: JournalRow) => void;
  onClose: () => void;
  today: string;
  /** The journal's columns — the same the period's table wears */
  columns: Column<JournalRow>[];
  testId: string;
}

const JournalDay = ({ day, total, holders, onDayNote, onOpen, onClose, today, columns, testId }: Props) => {
  const rows = total?.rows ?? [];
  const newestFirst = useMemo(() => [...rows].reverse(), [rows]);
  const curve = useMemo(() => runningOf(rows), [rows]);
  const curveBy = useMemo(() => new Map(curve.map(p => [p.time, p])), [curve]);
  /* ONE list, kept (SessionsChart's own note: a fresh array drops the card under the pointer) */
  const points = useMemo(() => curve.map(p => ({ time: p.time, value: p.value })), [curve]);
  const range = useMemo(() => [Math.min(0, ...curve.map(p => p.value)), Math.max(0, ...curve.map(p => p.value))] as const, [curve]);
  const best = rows.length ? Math.max(...rows.map(r => r.t.pnl)) : 0;
  const worst = rows.length ? Math.min(...rows.map(r => r.t.pnl)) : 0;
  const accounts = new Set(rows.map(r => r.s.id)).size;
  /* the notes: one pair an account, a tab each when there are several */
  const [holder, setHolder] = useState(holders[0]?.id ?? '');
  const shown = holders.find(h => h.id === holder) ?? holders[0] ?? null;

  return (
    <div className={`${card} flex flex-col min-w-0 animate-soft-in`} data-journal-open-day={day}>
      <div className="px-5 pt-4 pb-3 flex items-center gap-x-5 gap-y-2 flex-wrap">
        <span className="text-[15px] font-semibold text-textPrimary">{longDay(day)}</span>
        <span className={`font-mono text-[22px] font-semibold tnum leading-none ${rows.length ? dirInk(total!.net) : 'text-textMuted'}`} data-journal-day-net>
          {rows.length ? usdSigned(total!.net) : '$0.00'}
        </span>
        <span className="font-mono text-[11px] tnum text-textSecondary" data-journal-day-sum>
          {rows.length > 0 ? (
            <>
              {total!.n} closed · {total!.wins} won ({pct(total!.wins / total!.n)}){accounts > 1 ? ` · on ${accounts} accounts` : ''}
              <span className="text-textMuted"> · best </span>
              <span className={dirInk(best)}>{usdSigned(best, 0)}</span>
              <span className="text-textMuted"> · worst </span>
              <span className={dirInk(worst)}>{usdSigned(worst, 0)}</span>
            </>
          ) : (
            <span className="text-textMuted">{day > today ? 'Still to come — a plan can be written now' : 'Nothing closed on this day'}</span>
          )}
        </span>
        <button type="button" onClick={onClose} title="Close the day" aria-label="Close the day" className="hit ml-auto -mr-1.5 inline-flex items-center justify-center w-8 h-8 rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" data-journal-day-close>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* the curve and the words beside the trades from xl — at lg the grid had ~350px (the month's row moved the same day) */}
      <div className={`border-t border-borderSubtle/70 grid ${rows.length ? 'xl:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
        {/* EVERY TRADE, with the account it was on — a row opens the trade */}
        {rows.length > 0 && (
          <div className="min-w-0 xl:border-r xl:border-borderSubtle/70" data-journal-day-trades>
            <TraceGrid rows={newestFirst} columns={columns} rowKey={r => r.key} onRowClick={onOpen} autoHeight animate={false} widths={{ qty: 64, held: 96, closed: 96, account: 200, inout: 176 }} emptyText="" testId={`${testId}-day`} />
          </div>
        )}
        <div className="min-w-0 flex flex-col">
          {/* HOW THE DAY WENT — its running total, once there are two trades to run */}
          {rows.length > 1 && (
            <div className="px-5 pt-4 pb-3 border-b border-borderSubtle/70" data-journal-day-curve>
              <div className={headWord}>How the day went</div>
              <div className="mt-3">
                <SessionsChart
                  points={points}
                  kind="baseline"
                  ink="rgb(var(--bull))"
                  inkBelow="rgb(var(--bear))"
                  height={150}
                  clock="clock"
                  range={range}
                  zone="ny"
                  scale="pnl"
                  curved
                  cardW={220}
                  cardH={80}
                  testId="journal-day-curve"
                  card={h => {
                    const p = curveBy.get(h.time);
                    if (!p) return null;
                    if (!p.row) return <div className="font-mono text-[11px] text-textSecondary">Before the day’s first close</div>;
                    return (
                      <div className="font-mono text-[11px] tnum">
                        <div className="text-[10px] text-textMuted">{fmtClockLocal(h.time as UTCTimestamp, 'ny')} New York</div>
                        <div className="mt-0.5 text-textPrimary truncate">{titleOf(p.row)}</div>
                        <div className={`mt-0.5 font-semibold ${dirInk(p.row.t.pnl)}`}>{usdSigned(p.row.t.pnl)} on it</div>
                        <div className="mt-0.5 text-textSecondary">
                          the day then <span className={dirInk(p.value)}>{usdSigned(p.value)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            </div>
          )}
          {/* THE DAY'S WORDS */}
          {shown && (
            <div className="px-5 pt-4 pb-5 flex flex-col gap-4" data-journal-day-notes>
              <div className="flex items-center gap-4 flex-wrap">
                <span className={headWord}>Your words on the day</span>
                {holders.length > 1 && <CardTabs options={holders.map(h => ({ value: h.id, label: h.name }))} value={shown.id} onChange={setHolder} ariaLabel="Whose words" />}
                {holders.length === 1 && rows.length === 0 && <span className="font-mono text-[10px] text-textMuted truncate">{shown.name}</span>}
              </div>
              <div className={`grid gap-4 ${rows.length ? '' : 'sm:grid-cols-2'}`} data-journal-day-holder={shown.id}>
                {NOTES.map(n => (
                  <NoteField key={`${shown.id}:${day}:${n.key}`} ask={n.ask} hint={n.hint} value={shown.note[n.key] ?? ''} onKeep={v => onDayNote(shown.id, day, { [n.key]: v })} testId={n.key} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalDay;
