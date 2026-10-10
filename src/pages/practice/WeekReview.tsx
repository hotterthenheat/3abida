/*
==================================================
  SLAYER TERMINAL - PRACTICE · THE WEEK, REVIEWED
  (pages/practice/WeekReview.tsx)

  The week rolled up (the ideas of 2026-10-09, with the
  morning brief and the evening recap): a row a trading
  day — what it made, how many closed, whether a plan
  was written and whether the recap said it was kept —
  and under it what the week's own tags say: the plan
  followed or not, what each mistake cost, the pace
  against the usual. The reader's own numbers about
  their own trades; never a score, never a streak.
  A week back and a week on from the arrows.
==================================================
*/

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { card, headWord } from '../../components/review/DeskShell';
import { dirInk, usdSigned } from '../../components/review/words';
import { entryOf, type DayNote } from '../../data/review/journal';
import { byMistake, calendarDayOf, shiftDay } from '../../data/review/journalFigures';
import { useJournalSource } from '../../data/review/journalSource';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayWord = (d: string) => `${DAYS[new Date(`${d}T12:00:00`).getDay()]} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
const FOLLOWED: Record<NonNullable<DayNote['followed']>, string> = { yes: 'kept to it', partly: 'partly', no: 'left it' };

const WeekReview = ({ account }: { account: string | null }) => {
  const source = useJournalSource('paper');
  const sundayOf = (d: string) => shiftDay(d, -new Date(`${d}T12:00:00`).getDay());
  /* the week in hand — or, when nothing has closed in it, the latest week that has a trade (the Journal's own rule) */
  const [from, setFrom] = useState(() => {
    const home = sundayOf(source.today);
    const latest = source.rows.find(r => !account || r.s.id === account);
    return latest && calendarDayOf(latest) < home ? sundayOf(calendarDayOf(latest)) : home;
  });
  const days = Array.from({ length: 5 }, (_, i) => shiftDay(from, i + 1));
  const to = shiftDay(from, 6);
  const ids = account ? [account] : source.containers.map(c => c.id);
  const rows = useMemo(() => source.rows.filter(r => (!account || r.s.id === account) && calendarDayOf(r) >= from && calendarDayOf(r) <= to), [source.rows, account, from, to]);
  const noteOf = (d: string): DayNote => ids.reduce<DayNote>((x, id) => ({ ...source.notesOf(id)[d], ...x }), {});
  const net = rows.reduce((x, r) => x + r.t.pnl, 0);
  const answered = rows.filter(r => entryOf(r).plan);
  const kept = answered.filter(r => entryOf(r).plan === 'yes' && !(entryOf(r).mistakes ?? []).length).length;
  const costs = byMistake(rows).slice(0, 4);
  const byDay = days.map(d => {
    const list = rows.filter(r => calendarDayOf(r) === d);
    return { d, n: list.length, net: list.reduce((x, r) => x + r.t.pnl, 0), note: noteOf(d) };
  });
  const traded = byDay.filter(x => x.n > 0);
  const best = traded.length ? traded.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  const worst = traded.length ? traded.reduce((a, b) => (b.net < a.net ? b : a)) : null;
  const planned = byDay.filter(x => x.note.plan?.trim()).length;
  const door = 'hit inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';

  return (
    <section className={`${card} flex flex-col min-w-0`} data-week-review={from}>
      <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => setFrom(shiftDay(from, -7))} aria-label="The week before" title="The week before" className={door} data-week-prev>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <h2 className="text-[15px] font-semibold text-textPrimary min-w-[180px] text-center">
          The week of {dayWord(days[0]).slice(4)}
        </h2>
        <button type="button" onClick={() => setFrom(shiftDay(from, 7))} aria-label="The week after" title="The week after" className={door} data-week-next>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <span className="ml-auto font-mono text-[12px] tnum text-textSecondary">
          {rows.length ? (
            <>
              <span className={`font-semibold ${dirInk(net)}`}>{usdSigned(net)}</span> · {rows.length} {rows.length === 1 ? 'trade' : 'trades'} · {traded.length} of 5 days traded · a plan on {planned}
            </>
          ) : (
            'Nothing closed this week'
          )}
        </span>
      </div>
      {/* A ROW A TRADING DAY */}
      <div className="border-t border-borderSubtle" role="table" aria-label="The week, day by day">
        <div role="row" className="hidden sm:grid grid-cols-[120px_110px_80px_minmax(0,1fr)_120px] gap-x-4 px-5 h-8 items-center font-mono text-[10px] uppercase tracking-widest text-textMuted border-b border-borderSubtle/60">
          <span role="columnheader">Day</span>
          <span role="columnheader" className="text-right">P&amp;L</span>
          <span role="columnheader" className="text-right">Closed</span>
          <span role="columnheader">The plan</span>
          <span role="columnheader">Kept to it?</span>
        </div>
        {byDay.map(x => (
          <div key={x.d} role="row" className="grid grid-cols-2 sm:grid-cols-[120px_110px_80px_minmax(0,1fr)_120px] gap-x-4 gap-y-1 px-5 py-2.5 items-baseline border-b border-borderSubtle/40 last:border-0 text-[12px]" data-week-day={x.d}>
            <span role="cell">
              <Link to={`/practice/journal?day=${x.d}`} className="hit font-mono tnum text-textPrimary hover:text-silver transition-colors">
                {dayWord(x.d)}
              </Link>
            </span>
            <span role="cell" className={`font-mono tnum sm:text-right ${x.n ? `font-semibold ${dirInk(x.net)}` : 'text-textMuted'}`}>
              {x.n ? usdSigned(x.net) : '—'}
            </span>
            <span role="cell" className="font-mono tnum sm:text-right text-textSecondary">
              {x.n ? `${x.n} ${x.n === 1 ? 'trade' : 'trades'}` : 'none'}
            </span>
            <span role="cell" className="min-w-0 truncate text-textSecondary" title={x.note.plan}>
              {x.note.plan?.trim() || <span className="text-textMuted">no plan written</span>}
            </span>
            <span role="cell" className={x.note.followed ? 'text-textPrimary' : 'text-textMuted'}>
              {x.note.followed ? FOLLOWED[x.note.followed] : 'not said'}
            </span>
          </div>
        ))}
      </div>
      {/* WHAT THE WEEK'S OWN TAGS SAY */}
      <div className="px-5 py-4 border-t border-borderSubtle grid gap-4 md:grid-cols-3">
        <div>
          <div className={headWord}>The plan, as tagged</div>
          <p className="mt-1.5 text-[12px] text-textSecondary">{answered.length ? `${kept} of ${answered.length} answered trades followed the plan with no mistake tagged.` : 'No trade this week was answered on the plan.'}</p>
        </div>
        <div>
          <div className={headWord}>What the mistakes cost</div>
          {costs.length ? (
            <ul className="mt-1.5 flex flex-col gap-0.5 text-[12px] text-textSecondary">
              {costs.map(c => (
                <li key={c.key}>{c.hint}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[12px] text-textSecondary">No mistake tagged this week.</p>
          )}
        </div>
        <div>
          <div className={headWord}>The best and the worst day</div>
          <p className="mt-1.5 text-[12px] text-textSecondary">
            {best && worst ? (
              <>
                {dayWord(best.d)} <span className={dirInk(best.net)}>{usdSigned(best.net, 0)}</span> · {dayWord(worst.d)} <span className={dirInk(worst.net)}>{usdSigned(worst.net, 0)}</span>
              </>
            ) : (
              'No day traded this week.'
            )}
          </p>
        </div>
      </div>
    </section>
  );
};

export default WeekReview;
