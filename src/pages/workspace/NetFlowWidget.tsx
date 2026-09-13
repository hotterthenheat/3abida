/*
==================================================
  SLAYER TERMINAL - PULSE DESK · NET FLOW
  (pages/workspace/NetFlowWidget.tsx)

  The Net Flow page's pane in ticker mode, as a
  panel (the catalog audit, 2026-09-12): which way
  the tile's name's money leans through the
  session — its own candles as the spot line, net
  call and net put premium as the lines, the money
  and clock cards in the pane's own head. Reads the
  same day book the Trace pages read, so the panel
  and the page can never disagree.
==================================================
*/

import { useMemo, useState } from 'react';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import { buildFlowBook, type MoneynessKey } from '../../data/flowBook';
import NetFlowPane from '../../components/trace/NetFlowPane';
import type { SleeveKey } from '../../types/compass';
import type { WorkspaceCtx } from './registry';

const NetFlowWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const { marketData } = useMarketData();
  const [mny, setMny] = useState<MoneynessKey>('all');
  const [tenor, setTenor] = useState<SleeveKey | 'all'>('all');
  const book = useMemo(
    () => buildFlowBook(Simulator.universeQuotes(ctx.ticker)),
    // the book re-reads on the desk's scan clock, not the 1s pulse
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.ticker, ctx.revision]
  );
  return (
    <div className="h-full min-h-0 p-2" data-widget-net-flow={ctx.ticker}>
      <NetFlowPane book={book} seg="all" mny={mny} onSeg={() => undefined} onMny={setMny} tick={marketData} ticker={ctx.ticker} tenor={tenor} onTenor={setTenor} dteMax={Infinity} />
    </div>
  );
};

export default NetFlowWidget;
