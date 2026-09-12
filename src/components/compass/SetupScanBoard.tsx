/*
==================================================
  SLAYER TERMINAL - THE BOARD'S BODY (SetupScanBoard.tsx)
  The ranked setups under the box's head: the cards
  two across, or the same rows as THE GRID (the
  Trace walk's AG Grid). The box GROWS with what
  the sweep found and the page scrolls (Noah,
  2026-09-11: "the board box should be a box that
  can be lengthened when new cards are added") —
  the rail beside it sticks, the page carries its
  own door home.

  The walk (2026-09-11): the old Panel head, its
  Cards/Table tabs, the fixed window and the
  20-a-page pager are gone — the head is the box's
  (TraceBox), the layout is a card on the box's line.
==================================================
*/

import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Setup } from '../../types/compass';
import { SCANNERS } from '../../types/compass';
import type { Column } from '../ui/DataTable';
import SignalBadge from '../ui/SignalBadge';
import CompanyLogo from '../ui/CompanyLogo';
import { TraceGrid } from '../trace/TraceBox';
import SetupScanCard from './SetupScanCard';
import { processState, PROCESS_META } from './setupProcess';

export type ScanLayout = 'cards' | 'table';

type Ranked = Setup & { rank: number };

/** Which kind found a setup — the id carries it (`TICKER-strike-R-kind-sleeve`) */
const kindOf = (s: Setup): string => {
  const m = s.id.match(/-[CP]-(.+)-(odte|weekly|swing|leaps)(?:-\d+d)?$/);
  const key = m?.[1];
  return SCANNERS.find(k => k.key === key)?.label ?? '';
};

interface SetupScanBoardProps {
  /** Flat, already-ranked (rank = index + 1). */
  setups: Setup[];
  layout: ScanLayout;
  selectedId: string | null;
  onSelect: (setup: Setup) => void;
  onAnalysis: (setup: Setup) => void;
  /** Real-date chip for the active sleeve, e.g. "08/04/26". */
  expiryChip: string;
  /** Under All kinds the grid says which kind found each row */
  showKind?: boolean;
}

const WIDTHS: Record<string, number> = { rank: 56, expiry: 150, state: 110, sigma: 96, premium: 96, breaks: 110, kind: 120, open: 72 };
const TOOLTIPS: Record<string, string> = {
  sigma: 'The one-sigma move of the stock to expiry — what the options price in',
  premium: 'The contract at the bid/ask midpoint',
  breaks: 'The stock price that retires the setup — a close through it and the thesis is gone',
  state: 'Watch · proving itself. Active · the structure is in place. Moving · the contract trades like its trade. Fading · retiring',
};

/* A chip inside a grid cell keeps its OWN line height — the cell's is the
   row's 39px, and a chip that inherits it stands taller than its row (Noah,
   2026-09-11: "boxes bleeding into each other") */
const Chip = ({ children }: { children: React.ReactNode }) => <span className="inline-flex leading-normal">{children}</span>;

const SetupScanBoard = ({ setups, layout, selectedId, onSelect, onAnalysis, expiryChip, showKind = false }: SetupScanBoardProps) => {
  const ranked = useMemo<Ranked[]>(() => setups.map((s, i) => ({ ...s, rank: i + 1 })), [setups]);

  const columns = useMemo<Column<Ranked>[]>(() => {
    const cols: Column<Ranked>[] = [
      { key: 'rank', header: '#', sortValue: r => r.rank, render: r => <span className="font-mono text-[10px] text-textMuted tnum">{r.rank}</span> },
      {
        key: 'contract',
        header: 'Contract',
        sortValue: r => r.ticker,
        render: r => (
          <span className="inline-flex items-center gap-2 min-w-0">
            <CompanyLogo ticker={r.ticker} size={16} />
            <span className={`font-mono text-[12px] font-semibold ${r.right === 'C' ? 'text-bull' : 'text-bear'}`}>{r.contract}</span>
            {r.rank === 1 && (
              <Chip>
                <SignalBadge tone="crown">Top pick</SignalBadge>
              </Chip>
            )}
          </span>
        ),
      },
      { key: 'expiry', header: 'Expiry', render: r => <span className="font-mono text-[11px] text-textSecondary">{r.expiry} · {expiryChip}</span> },
      {
        key: 'state',
        header: 'State',
        sortValue: r => processState(r),
        render: r => {
          const state = processState(r);
          const meta = PROCESS_META[state];
          return (
            <Chip>
              <SignalBadge tone={meta.tone} dot pulse={meta.pulse}>
                {state}
              </SignalBadge>
            </Chip>
          );
        },
      },
      { key: 'sigma', header: '1σ move', align: 'right', sortValue: r => r.sigmaMovePct, render: r => <span className="font-mono text-[11px] tnum text-textPrimary">±{r.sigmaMovePct}%</span> },
      { key: 'premium', header: 'Premium', align: 'right', sortValue: r => r.mid, render: r => <span className="font-mono text-[11px] tnum text-textPrimary">${r.mid.toFixed(2)}</span> },
      { key: 'breaks', header: 'Breaks at', align: 'right', sortValue: r => r.invalidationPrice, render: r => <span className="font-mono text-[11px] tnum text-warn">${r.invalidationPrice.toFixed(2)}</span> },
    ];
    if (showKind) cols.push({ key: 'kind', header: 'Kind', sortValue: r => kindOf(r), render: r => <span className="text-[11px] text-textSecondary">{kindOf(r)}</span> });
    cols.push({
      key: 'open',
      header: '',
      align: 'right',
      render: r => (
        <button
          type="button"
          onClick={() => onAnalysis(r)}
          title="Open the setup's page"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors"
        >
          Open <ArrowUpRight className="w-3 h-3" />
        </button>
      ),
    });
    return cols;
  }, [expiryChip, showKind, onAnalysis]);

  if (setups.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] border-t border-borderSubtle" data-compass-board="empty">
        <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing cleared the bar on this sweep</span>
      </div>
    );
  }

  if (layout === 'table') {
    return (
      <div data-compass-board="table">
        <TraceGrid
          rows={ranked}
          columns={columns}
          widths={WIDTHS}
          tooltips={TOOLTIPS}
          rowKey={r => r.id}
          onRowClick={onSelect}
          selectedKey={selectedId}
          autoHeight
          initialSort={{ key: 'rank', dir: 'asc' }}
          emptyText="Nothing cleared the bar on this sweep"
          testId="compass-board"
        />
      </div>
    );
  }

  /* The cards, two across — the box grows with them */
  return (
    <div key="cards" className="border-t border-borderSubtle px-5 pt-4 pb-5 animate-soft-in" data-compass-board="cards">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {ranked.map(s => (
          <SetupScanCard key={s.id} setup={s} rank={s.rank} selected={s.id === selectedId} onSelect={onSelect} onAnalysis={onAnalysis} expiryChip={expiryChip} />
        ))}
      </div>
    </div>
  );
};

export default SetupScanBoard;
