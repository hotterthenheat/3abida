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
import ExpiryCard, { type ExpiryChoice } from '../../components/ui/ExpiryCard';
import { buildDeskChain, dteForDate, type DeskContract } from '../../data/weigherDesk';
import { expiryFor, isoDate } from '../../core/calendar';
import { ChainCard, CHAIN_COLUMNS, type ChainCol } from '../../components/weigher/ChainGrid';
import type { OptionRight } from '../../types/compass';
import type { WorkspaceCtx } from './registry';

/** A panel is narrower than the desk card — the chain speaks its core four. */
const WIDGET_COLS = ['mark', 'delta', 'iv', 'itm'];

const WIDGET_DTES = [0, 2, 7, 30];
const SIDE_OPTIONS: DropdownOption<OptionRight>[] = [
  { value: 'C', label: 'Calls', hint: 'The right to buy', tone: 'bull' },
  { value: 'P', label: 'Puts', hint: 'The right to sell', tone: 'bear' },
];
/* the four horizons as the days they land on — the calendar card lights them,
   and any other trading day inside ninety is the chain's too (2026-09-12) */
const dteChoices = (): ExpiryChoice<number>[] =>
  WIDGET_DTES.map(d => {
    const e = expiryFor(d);
    return { value: e.dte, label: d === 0 ? `Today · ${fmtDay(e.date)}` : `${fmtDay(e.date)} · ${e.weekday}`, hint: d === 0 ? 'The contracts that expire at the bell' : `${e.sessions} sessions out`, date: e.date };
  });
const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

const WeigherChainWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const [right, setRight] = useState<OptionRight>('C');
  const [dte, setDte] = useState(() => expiryFor(2).dte);
  const [sel, setSel] = useState<number | null>(null);
  const choices = useMemo(() => {
    const base = dteChoices();
    /* a day picked off the rail joins the list, so the trigger can name it */
    return base.some(c => c.value === dte) ? base : [...base, (e => ({ value: e.dte, label: `${fmtDay(e.date)} · ${e.weekday}`, hint: `${e.sessions} sessions out`, date: e.date }))(expiryFor(dte))].sort((a, b) => a.value - b.value);
  }, [dte]);

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
        <ExpiryCard label="Expiry" value={dte} choices={choices} onChange={setDte} free={{ days: 90, toValue: d => dteForDate(isoDate(d)) }} title="How far out the chain runs" testId="weigher-expiry" />
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
