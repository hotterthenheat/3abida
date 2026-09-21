/*
==================================================
  SLAYER TERMINAL - THE CALENDAR
  (pages/record/Catalysts.tsx)

  What is coming, and what it lands on.
==================================================

  THE CALENDAR EXISTED AND HAD NOWHERE TO BE READ. The macro schedule and
  the earnings engine both shipped months ago and were drawn only as marks
  along the bottom edge of a chart, which answers "is anything near this
  bar" and never answers "what is coming". A reader who wanted the week
  ahead opened one name's dossier at a time and held the Fed's dates in
  their head alongside.

  ONE STREAM, SORTED BY WHEN, and macro before a report on the same day —
  because the useful fact is rarely that NVDA reports on Wednesday, it is
  that NVDA reports the morning after a CPI print.

  THE ACTIVE NAME IS THE LENS, not a filter. A reader on NVDA still needs to
  know the Fed meets on Wednesday; what they do not need is to hunt for
  their own name in the list. So the stream stays whole and the rows that
  touch the desk's name are MARKED, with a cut for the ones who want only
  those.
*/

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, Landmark } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import { buildCatalysts, catalystDays, catalystRead, whenWords, type Catalyst } from '../../data/catalysts';
import { useWatchlists } from '../../data/watchlists';
import CompanyLogo from '../../components/ui/CompanyLogo';
import { Name } from '../../components/ui/Name';
import RichRead from '../../components/ui/RichRead';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DataState from '../../components/ui/DataState';
import Term from '../../components/ui/Term';

/** The calendar does not move tick by tick — a day is the resolution. */
const REFRESH_MS = 60_000;

type Cut = 'all' | 'macro' | 'name' | 'watchlist';

const CUTS: DropdownOption<Cut>[] = [
  { value: 'all', label: 'Everything', hint: 'Every release and every report in the window' },
  { value: 'macro', label: 'Macro only', hint: 'The releases that land on the whole tape' },
  { value: 'name', label: 'This name', hint: "The desk's name, and the macro that lands on it too" },
  { value: 'watchlist', label: 'My watchlist', hint: 'Reports from the names on the active list, and the macro' },
];

const Box = ({ title, line, right, children }: { title: string; line?: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <section className="border border-borderSubtle rounded-md bg-panel">
    <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h3>
        {line && <p className="mt-0.5 text-[11px] text-textSecondary">{line}</p>}
      </div>
      {right}
    </div>
    <div className="border-t border-borderSubtle">{children}</div>
  </section>
);

/** Rich or cheap, against what the name usually does — the one judgement an
    earnings row can carry without a second page. */
const pricedWord = (implied?: number, hist?: number): { word: string; ink: string } | null => {
  if (!implied || !hist || hist <= 0) return null;
  const r = implied / hist;
  if (r >= 1.15) return { word: 'rich', ink: 'text-warn' };
  if (r <= 0.85) return { word: 'cheap', ink: 'text-bull' };
  return { word: 'fair', ink: 'text-textPrimary' };
};

const Catalysts = () => {
  const { activeTicker, changeTicker } = useMarketData();
  const navigate = useNavigate();
  const [beat, setBeat] = useState(0);
  const [cut, setCut] = useState<Cut>('all');
  const { lists, activeId } = useWatchlists();

  useEffect(() => {
    const id = window.setInterval(() => setBeat(b => b + 1), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const all = useMemo(() => buildCatalysts(), [beat]); // eslint-disable-line react-hooks/exhaustive-deps
  const watched = useMemo(() => new Set(lists.find(l => l.id === activeId)?.symbols ?? []), [lists, activeId]);

  const rows = useMemo(() => {
    if (cut === 'macro') return all.filter(r => r.kind === 'macro');
    /* A cut on a NAME keeps the macro: the Fed meeting is context for that
       name's report, not a different subject, and dropping it would leave a
       reader thinking their week was empty. */
    if (cut === 'name') return all.filter(r => r.kind === 'macro' || r.ticker === activeTicker);
    if (cut === 'watchlist') return all.filter(r => r.kind === 'macro' || (r.ticker && watched.has(r.ticker)));
    return all;
  }, [all, cut, activeTicker, watched]);

  const days = useMemo(() => catalystDays(rows), [rows]);
  const ahead = useMemo(() => rows.filter(r => r.sessionsOut >= 0), [rows]);

  const open = (c: Catalyst) => {
    if (!c.ticker) return;
    changeTicker(c.ticker);
    navigate(`/record/earnings/${c.ticker}`);
  };

  return (
    <div className="flex flex-col gap-4 pb-8" data-page="catalysts">
      <Box
        title="The week ahead"
        line="Sorted by when, macro first on a shared day — a report is read inside the release it lands beside"
        right={
          <span className="flex items-center gap-2">
            <DropdownSelect label="Cut" value={cut} options={CUTS} onChange={setCut} title="Which catalysts the list carries" testId="catalysts-cut" align="end" />
          </span>
        }
      >
        {/* THE STRIP IS ONLY THE DAYS THAT CARRY SOMETHING. A calendar padded
            with empty Tuesdays is mostly empty boxes, and the reader's
            question — when is the next thing — is answered slowly by them. */}
        {days.length === 0 ? (
          <DataState kind="empty" title="Nothing on the calendar" body="No release or report falls inside the window on this cut." pad="sm" />
        ) : (
          <div className="flex gap-2 overflow-x-auto px-5 py-3" data-catalyst-strip>
            {days.slice(0, 14).map(d => (
              <div
                key={d.iso}
                className={`shrink-0 w-[112px] rounded-md border px-2.5 py-2 ${d.sessionsOut === 0 ? 'border-select/50 bg-select/[0.05]' : 'border-borderSubtle'}`}
                data-catalyst-day={d.iso}
              >
                <span className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-textPrimary">{d.weekday}</span>
                  <span className="font-mono text-[9px] tnum text-textSecondary">{d.dayLabel}</span>
                </span>
                <span className="block mt-1 font-mono text-[9px] uppercase tracking-widest text-textSecondary">{whenWords(d.sessionsOut)}</span>
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {d.macro.map(m => (
                    <span key={m.id} className="inline-flex items-center rounded bg-warn/[0.12] border border-warn/30 px-1 font-mono text-[9px] font-semibold text-warn" title={m.detail}>
                      {m.label.split(' ')[0]}
                    </span>
                  ))}
                  {d.earnings.slice(0, 4).map(e => (
                    <span key={e.id} title={e.detail}>
                      <CompanyLogo ticker={e.ticker!} size={14} />
                    </span>
                  ))}
                  {d.earnings.length > 4 && (
                    <span className="font-mono text-[9px] tnum text-textSecondary">+{d.earnings.length - 4}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-3 border-t border-borderSubtle text-[11.5px] leading-snug text-textSecondary" data-catalyst-read>
          <RichRead text={catalystRead(rows, activeTicker)} />
        </div>
      </Box>

      <Box title="Every catalyst" line="What it is, when it lands, what it touches, and what the options are charging for it">
        <div
          className="grid grid-cols-[104px_24px_minmax(0,1fr)_120px_92px] items-center gap-x-3 px-5 h-7 border-b border-borderSubtle bg-chip select-none font-mono text-[9px] uppercase tracking-widest text-textSecondary"
        >
          <span>When</span>
          <span />
          <span>What</span>
          <span>Touches</span>
          <span className="text-right">
            <Term k="Expected move">Priced for</Term>
          </span>
        </div>
        {ahead.length === 0 ? (
          <DataState kind="empty" title="Nothing ahead" body="Widen the cut, or the window is genuinely quiet." pad="sm" />
        ) : (
          ahead.map(c => {
            const mine = c.ticker === activeTicker;
            const priced = pricedWord(c.impliedMovePct, c.histAvgMovePct);
            return (
              <div
                key={c.id}
                /* The desk's own name is MARKED, not filtered to. A lens, not
                   a cut — see the file's head. */
                className={`grid grid-cols-[104px_24px_minmax(0,1fr)_120px_92px] items-center gap-x-3 px-5 h-10 border-b border-borderSubtle/40 last:border-0 ${
                  mine ? 'bg-select/[0.05]' : ''
                } ${c.ticker ? 'hover:bg-ink/[0.03] cursor-pointer' : ''} transition-colors`}
                onClick={c.ticker ? () => open(c) : undefined}
                data-catalyst={c.id}
                data-catalyst-mine={mine ? 'yes' : undefined}
              >
                <span className="font-mono text-[10px] tnum text-textPrimary">
                  {whenWords(c.sessionsOut)}
                  <span className="block text-[9px] text-textSecondary">{c.iso}</span>
                </span>
                <span className="flex items-center justify-center">
                  {c.kind === 'macro' ? (
                    <Landmark className="w-3.5 h-3.5 text-warn" aria-label="Macro release" />
                  ) : (
                    <CalendarClock className="w-3.5 h-3.5 text-textSecondary" aria-label="Earnings report" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] text-textPrimary">{c.label}</span>
                  <span className="block truncate text-[10px] text-textSecondary">{c.detail}</span>
                </span>
                {/* WHAT IT LANDS ON, not the ticker again — the label already
                    names it. A release carries the whole tape; a report
                    carries a name AND the part of the market it sits in,
                    which is what a reader scanning the week is sorting by. */}
                <span className="min-w-0 font-mono text-[10px] leading-none">
                  {c.ticker ? (
                    <>
                      <span className="block truncate">
                        <Name t={c.ticker} size={13} />
                      </span>
                      {c.sector && <span className="block mt-0.5 truncate text-[9px] text-textSecondary">{c.sector}</span>}
                    </>
                  ) : (
                    <span className="text-textSecondary">the whole tape</span>
                  )}
                </span>
                <span className="text-right font-mono text-[11px] tnum">
                  {c.impliedMovePct ? (
                    <>
                      <span className="font-semibold text-textPrimary">±{c.impliedMovePct.toFixed(1)}%</span>
                      {priced && <span className={`block text-[9px] uppercase tracking-wider ${priced.ink}`}>{priced.word}</span>}
                    </>
                  ) : (
                    <span className="text-textSecondary">—</span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </Box>

      {/* WHAT THIS PAGE DOES NOT CARRY, said out loud. Dividends, splits,
          product events and guidance dates are on the wishlist and are
          modelled nowhere in this build; a row invented for them would be
          the fake functionality the house rule exists to keep out. */}
      <p className="px-1 text-[10.5px] leading-snug text-textSecondary">
        The calendar carries the Fed's published decision days, payrolls on its first-Friday rule, CPI at its usual second
        Wednesday — named as an approximation until the release feed lands — and the earnings dates the engine prices.
        Dividends, splits and company events join when their feeds do.{' '}
        <button type="button" onClick={() => navigate('/settings/data-sources')} className="text-select hover:underline underline-offset-2 inline-flex items-center gap-0.5">
          What each key unlocks <ArrowUpRight className="w-3 h-3" />
        </button>
      </p>
    </div>
  );
};

export default Catalysts;
