/*
==================================================
  SLAYER TERMINAL - THE CONTRACTS AROUND A SETUP
  (components/compass/SetupDrivers.tsx)

  "Top contracts driving the setup" (Mo,
  2026-08-19), placed where the phrase is TRUE —
  one setup, one name. Each row is a contract and
  the PART it plays; the four facts say why it
  carries weight. Walked (2026-09-11): the house
  box with the grid in a window that grows with
  its rows; the setup's own row selected in the
  where-you-are ink; any other row opens that
  contract's page.
==================================================
*/

import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import Term from '../ui/Term';
import ContractLabel from '../ui/ContractLabel';
import type { Column } from '../ui/DataTable';
import { TraceGrid } from '../trace/TraceBox';
import { fmtUsd } from '../../data/gex';
import type { DriverRow, OptionRight } from '../../types/compass';

interface SetupDriversProps {
  ticker: string;
  rows: DriverRow[];
  /** Open another contract on the same name. Absent = rows are facts only. */
  onOpen?: (strike: number, right: OptionRight) => void;
}

/** Signed distance; at the money reads 0.0%, never "-0.0%". */
const fmtDist = (v: number) => {
  const d = Math.abs(v) < 0.05 ? 0 : v;
  return `${d > 0 ? '+' : ''}${d.toFixed(1)}%`;
};

const WIDTHS: Record<string, number> = { role: 150, gamma: 110, voloi: 100, dist: 110, exposure: 120, open: 72 };
const TOOLTIPS: Record<string, string> = {
  role: 'The part the contract plays in the hedging around this setup',
  gamma: "Its share of the whole book's gamma",
  voloi: "Today's volume over open interest — above 1×, more traded today than existed this morning",
  dist: 'How far the strike sits from spot, + above and − below',
  exposure: 'Its dealer gamma in dollars — negative absorbs moves, positive amplifies them',
};

const keyOf = (r: DriverRow) => `${r.strike}${r.right}`;

const SetupDrivers = ({ ticker, rows, onOpen }: SetupDriversProps) => {
  const current = rows.find(r => r.role === 'This contract');
  const columns = useMemo<Column<DriverRow>[]>(() => {
    const cols: Column<DriverRow>[] = [
      {
        key: 'role',
        header: 'Role',
        render: r =>
          r.role === 'This contract' ? (
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-silver">{r.role}</span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider text-textSecondary">
              <Term k={r.role}>{r.role}</Term>
            </span>
          ),
      },
      {
        key: 'contract',
        header: 'Contract',
        sortValue: r => r.strike,
        /* THE WHOLE CONTRACT IN ITS SIDE'S INK (Noah, 2026-09-12: the contracts
           around it "have the green c and red p which I don't like") — the
           board card's pill, one rule (components/ui/ContractLabel) */
        render: r => (
          <span className="inline-flex items-center gap-2 min-w-0">
            <ContractLabel contract={r.contract} right={r.right} logo={ticker} size="sm" />
            <span className="font-mono text-[9px] text-textSecondary tnum">{r.expiry}</span>
          </span>
        ),
      },
      { key: 'gamma', header: 'Gamma', align: 'right', sortValue: r => r.gamma, render: r => <span className="font-mono text-[11px] tnum text-textPrimary">{r.gamma.toFixed(1)}%</span> },
      { key: 'voloi', header: 'Vol/OI', align: 'right', sortValue: r => r.volOi, render: r => <span className="font-mono text-[11px] tnum text-textPrimary">{r.volOi.toFixed(2)}×</span> },
      /* Above the market green, below it red — the sign is the information (no grey, Noah 2026-09-12) */
      { key: 'dist', header: 'From spot', align: 'right', sortValue: r => r.distPct, render: r => <span className={`font-mono text-[11px] tnum ${Math.abs(r.distPct) < 0.05 ? 'text-textPrimary' : r.distPct > 0 ? 'text-bull' : 'text-bear'}`}>{fmtDist(r.distPct)}</span> },
      {
        key: 'exposure',
        header: 'Exposure',
        align: 'right',
        sortValue: r => r.exposureUsd,
        /* Sim side-coding: negative = dealers absorb (bull), positive = amplify (bear) */
        render: r => <span className={`font-mono text-[11px] font-semibold tnum ${r.exposureUsd < 0 ? 'text-bull' : 'text-bear'}`}>{fmtUsd(r.exposureUsd)}</span>,
      },
    ];
    if (onOpen) {
      cols.push({
        key: 'open',
        header: '',
        align: 'right',
        render: r =>
          r.role === 'This contract' ? null : (
            <button type="button" onClick={() => onOpen(r.strike, r.right)} title={`Open ${r.contract} ${r.expiry}`} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors">
              Open <ArrowUpRight className="w-3 h-3" />
            </button>
          ),
      });
    }
    return cols;
  }, [onOpen, ticker]);

  if (!rows.length) return null;
  const expiry = rows[0].expiry;
  return (
    <div className="border border-borderSubtle rounded-md bg-panel overflow-hidden" data-setup-drivers={ticker}>
      <div className="px-5 pt-4 pb-3">
        <div className="h-6 flex items-center gap-3">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The contracts around it</h3>
        </div>
        <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
          on {ticker} · {expiry} · the hedging this setup trades through{onOpen ? ' · a row opens that contract' : ''}
        </p>
      </div>
      <TraceGrid
        rows={rows}
        columns={columns}
        widths={WIDTHS}
        tooltips={TOOLTIPS}
        rowKey={keyOf}
        onRowClick={onOpen ? r => (r.role === 'This contract' ? undefined : onOpen(r.strike, r.right)) : undefined}
        selectedKey={current ? keyOf(current) : null}
        autoHeight
        animate={false}
        testId="setup-drivers"
      />
    </div>
  );
};

export default SetupDrivers;
