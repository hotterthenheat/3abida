/*
==================================================
  SLAYER TERMINAL - WORKSPACE EARNINGS CALENDAR
  The next two weeks of reports on the desk (Noah,
  2026-08-22). The same calendar the Earnings page
  builds, as a dense list: who, when, the move the
  market is charging, and whether that price is rich
  or cheap against the name's own history. A click
  opens the company's dossier page.
==================================================
*/

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import CompanyLogo from '../../components/ui/CompanyLogo';
import Term from '../../components/ui/Term';
import { StateTag, stateOf, type VolState } from '../../components/earnings/volState';
import { buildEarningsCalendar } from '../../data/earnings';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';

type Filter = 'ALL' | VolState;

const FILTERS: DropdownOption<Filter>[] = [
  { value: 'ALL', label: 'Every report', hint: 'The next two weeks' },
  { value: 'RICH', label: 'Priced rich', hint: 'The market charges more than the name usually moves' },
  { value: 'INLINE', label: 'Priced fair', hint: 'About what the name usually moves' },
  { value: 'CHEAP', label: 'Priced cheap', hint: 'Less than the name usually moves' },
];

const EarningsWidget = () => {
  const navigate = useNavigate();
  // Soonest first — a calendar on a desk is a countdown
  const events = useMemo(() => [...buildEarningsCalendar()].sort((a, b) => a.daysOut - b.daysOut), []);
  const [filter, setFilter] = useState<Filter>('ALL');
  const rows = useMemo(() => (filter === 'ALL' ? events : events.filter(e => stateOf(e) === filter)), [events, filter]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Controls sit in the body — the header is the drag handle. */}
      <div className="shrink-0 px-2 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2">
        <DropdownSelect label="Priced" value={filter} options={FILTERS} onChange={setFilter} title="What the market charges for the move" testId="earnings-priced" />
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted tnum">
          {rows.length} reports · two weeks
        </span>
      </div>
      <div className="shrink-0 grid grid-cols-[22px_minmax(0,1fr)_96px_52px_52px_16px] items-center gap-x-2.5 px-2.5 h-6 border-b border-borderSubtle bg-chip select-none font-mono text-[9px] uppercase tracking-widest text-textSecondary">
        <span />
        <span>Name</span>
        <span>Reports</span>
        <span className="text-right">
          <Term k="Expected move">Move</Term>
        </span>
        <span className="text-right">
          <Term k="Priced vs typical">Priced</Term>
        </span>
        <span />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {rows.map(e => {
          const state = stateOf(e);
          return (
            <button
              key={e.ticker}
              // `from: desk` — the dossier offers a Desk door home (Noah, 2026-08-22)
              onClick={() => navigate(`/record/earnings/${e.ticker}`, { state: { from: 'desk' } })}
              title={`Open the ${e.ticker} earnings dossier`}
              className="group w-full grid grid-cols-[22px_minmax(0,1fr)_96px_52px_52px_16px] items-center gap-x-2.5 px-2.5 h-11 border-b border-borderSubtle/30 text-left transition-colors hover:bg-ink/[0.03]"
            >
              <CompanyLogo ticker={e.ticker} size={22} />
              <span className="flex flex-col min-w-0">
                <span className="font-mono text-[11px] font-bold text-textPrimary leading-tight">{e.ticker}</span>
                <span className="text-[10px] text-textSecondary truncate leading-tight">{e.name}</span>
              </span>
              <span className="flex flex-col min-w-0">
                <span className="font-mono text-[11px] text-textPrimary tnum leading-tight">{e.dateLabel}</span>
                <span className="font-mono text-[9px] leading-tight">
                  <span className={e.slot === 'BMO' ? 'text-warn' : 'text-flip'}>{e.slot === 'BMO' ? 'before open' : 'after close'}</span>
                  <span className="text-textSecondary"> · {e.daysOut === 0 ? 'today' : `${e.daysOut}d`}</span>
                </span>
              </span>
              <span className="text-right font-mono text-[11px] font-semibold tnum text-textPrimary">±{e.impliedMovePct.toFixed(1)}%</span>
              {/* The pricing state as ink on the figure, the word on hover */}
              <span
                className={`text-right font-mono text-[11px] font-semibold tnum ${state === 'RICH' ? 'text-warn' : state === 'CHEAP' ? 'text-bull' : 'text-textPrimary'}`}
                title={undefined}
              >
                <span className="sr-only">
                  <StateTag state={state} />
                </span>
                {e.richness.toFixed(2)}×
              </span>
              <ArrowUpRight className="w-3 h-3 text-textMuted opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EarningsWidget;
