/*
  REVIEW · WHAT A STRIKE OPENS ONTO (Noah, 2026-09-20, with the Weigher's chain: "isnt that info useful for the backtesting
  so each strike has its own dropdown?"). The Weigher's weigh-up, word for word — Stats, then The Greeks, a silver label
  over a bright figure, the same glossary under the same words — read AS THE CONTRACT STOOD at the clock's minute: the
  day's high and low SO FAR, yesterday's close, what it has traded, what is open in it, where the name has to be at the
  bell for it to pay for itself. (Three columns here, not the Weigher's five: the chain is a side panel.)
*/

import Term from '../ui/Term';
import type { ContractDay, ContractId, Quote } from '../../data/review/quotes';

const count = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

const Stat = ({ label, value, term, ink }: { label: string; value: string; term?: string; ink?: string }) => (
  <span className="flex flex-col gap-0.5 min-w-0">
    <span className="font-mono text-[9px] uppercase tracking-widest text-silver whitespace-nowrap">{term ? <Term k={term as never}>{label}</Term> : label}</span>
    <span className={`font-mono text-[11px] font-semibold tnum ${ink ?? 'text-textPrimary'}`}>{value}</span>
  </span>
);

const ContractDrill = ({ contract, quote: q, day: d }: { contract: ContractId; quote: Quote; day: ContractDay }) => (
  <div className="px-4 py-3 bg-silver/[0.04] border-y border-borderSubtle/70 flex flex-col gap-3 animate-soft-in" data-chain-drill={contract.strike}>
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-textSecondary">Stats</span>
      <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
        <Stat label="Bid" value={`$${q.bid.toFixed(2)}`} />
        <Stat label="Mark" term="Mark" value={`$${q.mark.toFixed(2)}`} />
        <Stat label="Ask" value={`$${q.ask.toFixed(2)}`} />
        <Stat label="High so far" value={`$${d.high.toFixed(2)}`} />
        <Stat label="Low so far" value={`$${d.low.toFixed(2)}`} />
        <Stat label="Last trade" value={`$${d.last.toFixed(2)}`} />
        <Stat label="Prev close" value={`$${d.prevClose.toFixed(2)}`} />
        <Stat label="Volume" term="Volume" value={count(d.volume)} />
        <Stat label="Open interest" term="Open interest" value={count(d.oi)} />
        <Stat label="IV" term="IV" value={`${(q.iv * 100).toFixed(2)}%`} />
        <Stat label="Breakeven" term="Breakeven" value={`$${d.breakeven.toFixed(2)}`} />
        <Stat label="Name must move" value={`${d.toBreakevenPct >= 0 ? '+' : ''}${d.toBreakevenPct.toFixed(1)}%`} ink={d.toBreakevenPct >= 0 ? 'text-bull' : 'text-bear'} />
      </div>
    </div>
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-textSecondary">The Greeks</span>
      <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
        <Stat label="Delta" term="Delta" value={q.delta.toFixed(4)} />
        <Stat label="Gamma" term="Gamma" value={q.gamma.toFixed(4)} />
        <Stat label="Theta / day" term="Theta" value={q.theta.toFixed(4)} />
        <Stat label="Vega" term="Vega" value={q.vega.toFixed(4)} />
        <Stat label="Rho" term="Rho" value={q.rho.toFixed(4)} />
      </div>
    </div>
  </div>
);

export default ContractDrill;
