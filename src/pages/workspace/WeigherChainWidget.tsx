/*
==================================================
  SLAYER TERMINAL - PULSE DESK · WEIGHER CHAIN
  (pages/workspace/WeigherChainWidget.tsx)

  The Pulse door to the NEW Weigher (Noah,
  2026-08-26: the add-widget preview still showed
  the old weigh station). The preview is live — it
  mounts whatever the widget renders — so the only
  honest way to change the picture was to change
  the widget: this is the desk's own chain and
  strike weigh-up, the same components the /weigher
  page runs, sized for one Pulse panel.
==================================================
*/

import { useMemo, useState } from 'react';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import { buildDeskChain, type DeskContract } from '../../data/weigherDesk';
import { ChainCard, CHAIN_COLUMNS, type ChainCol } from '../weigher/WeigherDesk';
import type { OptionRight } from '../../types/compass';
import type { WorkspaceCtx } from './registry';

/** A panel is narrower than the desk card — the chain speaks its core four. */
const WIDGET_COLS = ['mark', 'delta', 'iv', 'itm'];

const WIDGET_DTES = [0, 2, 7, 30];
const SIDE_OPTIONS: DropdownOption<OptionRight>[] = [
  { value: 'C', label: 'Calls', hint: 'The right to buy' },
  { value: 'P', label: 'Puts', hint: 'The right to sell' },
];
const DTE_OPTIONS: DropdownOption<number>[] = WIDGET_DTES.map(d => ({ value: d, label: d === 0 ? 'Today' : `${d} days out`, hint: d === 0 ? 'The contracts that expire at the bell' : `Expiring ${d} trading days from now` }));

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

const WeigherChainWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const [right, setRight] = useState<OptionRight>('C');
  const [dte, setDte] = useState(2);
  const [sel, setSel] = useState<number | null>(null);

  // ctx.snapshot is the live tick — the chain re-prices with the desk.
  const chain = useMemo(() => buildDeskChain(ctx.ticker, dte, 40), [ctx.ticker, dte, ctx.snapshot]); // eslint-disable-line react-hooks/exhaustive-deps
  const cols: ChainCol[] = useMemo(() => CHAIN_COLUMNS.filter(c => WIDGET_COLS.includes(c.key)), []);

  const selected: DeskContract | null = useMemo(() => {
    if (sel == null) return null;
    const row = chain.rows.find(r => Math.abs(r.strike - sel) < 1e-9);
    return row ? (right === 'C' ? row.call : row.put) : null;
  }, [chain, sel, right]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 px-2 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2 flex-wrap">
        <DropdownSelect label="Side" value={right} options={SIDE_OPTIONS} onChange={setRight} title="Calls or puts" testId="weigher-side" />
        <DropdownSelect label="Expiry" value={dte} options={DTE_OPTIONS} onChange={setDte} title="How far out the chain runs" testId="weigher-expiry" />
        {selected && sel != null && (
          <span className="ml-auto font-mono text-[10px] font-semibold tnum text-textSecondary whitespace-nowrap">
            {ctx.ticker} {fmtStrike(sel)}
            {right} · {chain.expiry.dte}d
          </span>
        )}
      </div>
      {/* The weigh-up unfolds INLINE under the clicked strike (Noah,
          2026-08-26: "it drops down just right under that strike and not all
          the way at the bottom. keep in mind this is only for the pulse
          page") — the desk page keeps its Strike card; this panel keeps the
          reference's drop-down. */}
      <div className="flex-1 min-h-0">
        <ChainCard
          chain={chain}
          right={right}
          sel={sel}
          onSelect={(strike, clicks) => {
            // The second click of a double is not a second toggle.
            if ((clicks ?? 1) >= 2) return;
            setSel(cur => (cur != null && Math.abs(cur - strike) < 1e-9 ? null : strike));
          }}
          cols={cols}
          centerKey={`${ctx.ticker}:${dte}`}
          inlineDrill
        />
      </div>
    </div>
  );
};

export default WeigherChainWidget;
