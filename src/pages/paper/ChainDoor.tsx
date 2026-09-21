/*
==================================================
  SLAYER TERMINAL - THE CHAIN, FOR TRADING
  (pages/paper/ChainDoor.tsx)

  The Weigher's own chain (ChainCard — the house
  grid, the market's hairline, the reach) opened
  over the desk as a card, with a foot that trades
  what is picked: Buy at the ask, Sell at the bid,
  or Chart it. An index family's chain is the ETF's
  scaled by the family ratio (instruments.ts), so
  the strikes and premiums read in SPX points.
  Lazy: the Weigher's module travels only when the
  door is opened.
==================================================
*/

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import ExpiryCalendar from '../../components/ui/ExpiryCalendar';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { isoDate } from '../../core/calendar';
import { listExpiriesFor, listingPatternFor, nearestListedExpiry } from '../../data/optionChain';
import { buildDeskChain, type DeskChain, type DeskContract } from '../../data/weigherDesk';
import { fmtPrice, indexFamily, optionInstrument, type Instrument, type OptionInstrument } from '../../core/paper/instruments';
import { quoteFor } from '../../core/paper/market';
import { submitOrder } from '../../core/paper/engine';
import { usePaperPrefs } from '../../core/paper/prefs';
import type { OptionRight } from '../../types/compass';
import { PaperPill, ProvenanceChip, sideFill } from './paperKit';

const ChainCard = lazy(() => import('../weigher/WeigherDesk').then(m => ({ default: m.ChainCard })));
import { CHAIN_COLUMNS, type ChainCol } from '../../data/chainColumns';

const SIDE_OPTIONS: DropdownOption<OptionRight>[] = [
  { value: 'C', label: 'Calls', hint: 'The right to buy' },
  { value: 'P', label: 'Puts', hint: 'The right to sell' },
];
const REACH_OPTIONS: DropdownOption<number>[] = [20, 40, 80].map(d => ({ value: d, label: `±${d}`, hint: `${d} strikes each side of the market` }));

/** The chain in the family's own points — SPY's × 10 for SPX, untouched for a stock */
function scaleChain(chain: DeskChain, ratio: number): DeskChain {
  if (ratio === 1) return chain;
  const side = (c: DeskContract): DeskContract => ({
    ...c,
    strike: Number((c.strike * ratio).toFixed(2)),
    mark: Number((c.mark * ratio).toFixed(2)),
    bid: Number((c.bid * ratio).toFixed(2)),
    ask: Number((c.ask * ratio).toFixed(2)),
    last: Number((c.last * ratio).toFixed(2)),
    high: Number((c.high * ratio).toFixed(2)),
    low: Number((c.low * ratio).toFixed(2)),
    prevClose: Number((c.prevClose * ratio).toFixed(2)),
    netChange: Number((c.netChange * ratio).toFixed(2)),
    breakeven: Number((c.breakeven * ratio).toFixed(2)),
    intrinsic: Number((c.intrinsic * ratio).toFixed(2)),
    extrinsic: Number((c.extrinsic * ratio).toFixed(2)),
    gamma: Number((c.gamma / ratio).toFixed(5)),
    theta: Number((c.theta * ratio).toFixed(4)),
    vega: Number((c.vega * ratio).toFixed(4)),
  });
  return { ...chain, spot: Number((chain.spot * ratio).toFixed(2)), step: chain.step * ratio, rows: chain.rows.map(r => ({ strike: Number((r.strike * ratio).toFixed(2)), call: side(r.call), put: side(r.put) })) };
}

interface ChainDoorProps {
  open: boolean;
  onClose: () => void;
  /** An index family (SPXW, NDX, RUT) or a stock's own name */
  family: string;
  /** Put the picked contract on the chart */
  onChart: (inst: Instrument) => void;
  /** A leg for the spread builder */
  onAddLeg?: (inst: OptionInstrument) => void;
}

const ChainDoor = ({ open, onClose, family, onChart, onAddLeg }: ChainDoorProps) => {
  const prefs = usePaperPrefs();
  const fam = indexFamily(family);
  const underlying = fam ? fam.etf : family.toUpperCase();
  const ratio = fam ? fam.ratio : 1;
  const [right, setRight] = useState<OptionRight>('C');
  const [dte, setDte] = useState(() => nearestListedExpiry(underlying, 2).dte);
  const [depth, setDepth] = useState(40);
  const [sel, setSel] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSel(null);
    setDte(nearestListedExpiry(underlying, 2).dte);
    const id = window.setInterval(() => setTick(t => t + 1), 3000);
    return () => window.clearInterval(id);
  }, [open, underlying]);

  const expiries = useMemo(() => listExpiriesFor(underlying), [underlying, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const chain = useMemo(() => (open ? scaleChain(buildDeskChain(underlying, dte, depth), ratio) : null), [open, underlying, dte, depth, ratio, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  /* THE DOOR'S CHAIN IS THE DESK'S CHAIN, NARROWED. It used to re-declare its
     own bid/ask/mark/delta/IV/vol/OI and so sat out every improvement the
     Weigher's catalog got — it was still printing volume and open interest as
     bare numbers after the chain grew bars behind them. Picked by key now, in
     the door's own order, off the one catalog. */
  const cols = useMemo<ChainCol[]>(
    () => ['bid', 'ask', 'mark', 'delta', 'iv', 'vol', 'oi'].flatMap(k => CHAIN_COLUMNS.filter(c => c.key === k)),
    []
  );

  const expiryIso = chain ? isoDate(chain.expiry.date) : '';
  const picked: OptionInstrument | null = sel != null && expiryIso ? optionInstrument(family, sel, right, expiryIso) : null;
  const quote = picked ? quoteFor(picked) : null;

  const trade = (side: 'buy' | 'sell') => {
    if (!picked) return;
    const o = submitOrder({ instrument: picked, side, qty: prefs.defaultQty, type: 'market', source: 'chain' });
    setSaid(o.status === 'rejected' ? `Rejected — ${o.rejectReason}` : `${side === 'buy' ? 'Bought' : 'Sold'} ${o.filledQty} ${picked.symbol} @ ${o.avgFill}`);
    window.setTimeout(() => setSaid(null), 2400);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={`${family} option chain`}
      widthClass="max-w-[1180px]"
      header={
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[15px] font-semibold leading-tight text-textPrimary">{family} chain</span>
          <span className="text-[11px] text-textMuted truncate">{fam ? `${fam.name} — the ${fam.etf} chain × ${fam.ratio}` : `${family}'s listed contracts`}</span>
          <PaperPill />
        </div>
      }
      headerActions={
        <span className="inline-flex items-center gap-1.5">
          <DropdownSelect label="Side" value={right} options={SIDE_OPTIONS} onChange={setRight} title="Calls or puts" testId="paper-chain-side" />
          <ExpiryCalendar value={expiryIso} expiries={expiries} onChange={e => setDte(e.dte)} pattern={listingPatternFor(underlying)} title="Which contracts the chain lists" testId="paper-chain-expiry" />
          <DropdownSelect label="Reach" value={depth} options={REACH_OPTIONS} onChange={setDepth} title="How many strikes each side of the market" testId="paper-chain-reach" align="end" />
        </span>
      }
    >
      <div className="h-[52vh] min-h-[320px] rounded-md border border-borderSubtle overflow-hidden bg-panel" data-paper-chain>
        {chain && (
          <Suspense fallback={<TableSkeleton rows={10} />}>
            <ChainCard chain={chain} right={right} sel={sel} onSelect={(strike, clicks) => { setSel(strike); if ((clicks ?? 1) >= 2 && expiryIso) { onChart(optionInstrument(family, strike, right, expiryIso)); onClose(); } }} cols={cols} centerKey={`${family}:${dte}:${depth}`} />
          </Suspense>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap" data-paper-chain-foot>
        {picked && quote ? (
          <>
            <span className="font-mono text-[12px] font-semibold text-textPrimary">{picked.symbol}</span>
            <span className="font-mono text-[11px] tnum text-textSecondary">
              bid {fmtPrice(picked, quote.bid)} × {quote.bidSize} · ask {fmtPrice(picked, quote.ask)} × {quote.askSize}
              {quote.greeks && ` · Δ ${quote.greeks.delta.toFixed(2)} · IV ${quote.greeks.iv.toFixed(0)}%`}
            </span>
            <ProvenanceChip quote={quote} />
            <span className="ml-auto inline-flex items-center gap-1.5">
              <button type="button" onClick={() => trade('buy')} data-chain-buy className={`h-8 px-3.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider ${sideFill('buy')}`}>
                Buy {prefs.defaultQty} @ {fmtPrice(picked, quote.ask)}
              </button>
              <button type="button" onClick={() => trade('sell')} data-chain-sell className={`h-8 px-3.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider ${sideFill('sell')}`}>
                Sell {prefs.defaultQty} @ {fmtPrice(picked, quote.bid)}
              </button>
              <button type="button" onClick={() => { onChart(picked); onClose(); }} data-chain-chart className="h-8 px-3.5 rounded-md border border-borderMuted font-mono text-[11px] font-semibold uppercase tracking-wider text-textPrimary hover:bg-ink/[0.05] transition-colors">
                Chart it
              </button>
              {onAddLeg && (
                <button type="button" onClick={() => onAddLeg(picked)} data-chain-leg className="h-8 px-3 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
                  + leg
                </button>
              )}
            </span>
          </>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted">Click a strike to weigh it — double-click puts it on the chart</span>
        )}
        {said && <span className="w-full font-mono text-[10px] text-textSecondary animate-fade-in">{said}</span>}
      </div>
    </Modal>
  );
};

export default ChainDoor;
