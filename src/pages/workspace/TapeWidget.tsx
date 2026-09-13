/*
==================================================
  SLAYER TERMINAL - PULSE DESK · THE TAPE
  (pages/workspace/TapeWidget.tsx)

  The Live Tape cut to the tile's name, as a panel
  (the catalog audit, 2026-09-12): its rich prints
  as they land — the contract in its side's ink,
  the size at the fill, the dollars, which side of
  the spread was hit, a sweep marked. The same
  buffer the tape page seeds from, so a print here
  is a print there.
==================================================
*/

import { useMemo } from 'react';
import { useMarketData } from '../../context/MarketDataContext';
import { fmtUsd } from '../../data/gex';
import ContractLabel from '../../components/ui/ContractLabel';
import type { WorkspaceCtx } from './registry';

const num = (v: number) => v.toLocaleString('en-US');
const to24h = (t: string): string => {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return t;
  let h = Number(m[1]) % 12;
  if (m[4].toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

const TapeWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const { flowTape } = useMarketData();
  const rows = useMemo(() => flowTape.filter(p => p.ticker === ctx.ticker).slice(0, 60), [flowTape, ctx.ticker]);
  const prem = rows.reduce((a, p) => a + p.premium, 0);
  const sweeps = rows.filter(p => p.sweep).length;
  return (
    <div className="h-full min-h-0 flex flex-col" data-widget-tape={ctx.ticker}>
      <div className="shrink-0 flex items-center gap-4 px-3 py-1.5 border-b border-borderSubtle/60 font-mono text-[10px] tnum">
        <span className="text-textSecondary">
          <span className="uppercase tracking-wider">Prints</span> <span className="text-textPrimary">{rows.length}</span>
        </span>
        <span className="text-textSecondary">
          <span className="uppercase tracking-wider">Premium</span> <span className="text-textPrimary">{fmtUsd(prem)}</span>
        </span>
        <span className="text-textSecondary">
          <span className="uppercase tracking-wider">Sweeps</span> <span className="text-textPrimary">{sweeps}</span>
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="h-full grid place-items-center px-4 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">No rich prints on {ctx.ticker} yet</div>
        ) : (
          rows.map(p => (
            <div key={p.id} className="flex items-center gap-2 px-3 h-8 border-b border-borderSubtle/40 font-mono text-[10px] tnum animate-fade-in" data-widget-print={p.id}>
              <span className="text-textPrimary w-10 shrink-0">{to24h(p.time)}</span>
              <ContractLabel contract={`${p.ticker} ${p.strike}${p.right}`} right={p.right} logo={p.ticker} size="sm" />
              <span className="text-textPrimary whitespace-nowrap">
                {num(p.size)} @ ${p.fill.toFixed(2)}
              </span>
              <span className="ml-auto font-semibold text-textPrimary">{fmtUsd(p.premium)}</span>
              <span className={`inline-flex w-9 justify-center rounded border px-1 leading-[12px] text-[9px] font-semibold ${p.side === 'ASK' ? 'border-bull/30 bg-bull/[0.07] text-bull' : p.side === 'BID' ? 'border-bear/30 bg-bear/[0.07] text-bear' : 'border-borderSubtle text-textSecondary'}`}>
                {p.side === 'ASK' ? 'BUY' : p.side === 'BID' ? 'SELL' : 'MID'}
              </span>
              {p.sweep && <span className="text-[9px] font-semibold text-warn">SWEEP</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TapeWidget;
