/*
  REVIEW · WHAT A STRIKE OPENS ONTO (Noah, 2026-09-20, with the Weigher's chain: "isnt that info useful for the backtesting
  so each strike has its own dropdown?"). The Weigher's weigh-up, word for word — Stats, then The Greeks, a silver label
  over a bright figure, the same glossary under the same words — read AS THE CONTRACT STOOD at the clock's minute: the
  day's high and low SO FAR, yesterday's close, what it has traded, what is open in it, where the name has to be at the
  bell for it to pay for itself. (Three columns here, not the Weigher's five: the chain is a side panel.)
  ON A REAL DAY (2026-10-12) the stats are the contract's own trades so far that day; a price that is estimated wears ≈,
  and a figure the record does not carry (open interest; the day's range before a trade) is "—" and says why.
*/

import Term from '../ui/Term';
import type { ContractDay, ContractId, Quote } from '../../data/review/quotes';

const count = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));
/** A figure, or "—" where the record has none */
const or = (v: number, show: (v: number) => string): string => (Number.isFinite(v) ? show(v) : '—');

const Stat = ({ label, value, term, ink, why }: { label: string; value: string; term?: string; ink?: string; why?: string }) => (
  <span className="flex flex-col gap-0.5 min-w-0">
    <span className="font-mono text-[11px] uppercase tracking-widest text-silver whitespace-nowrap">{term ? <Term k={term as never}>{label}</Term> : label}</span>
    <span className={`font-mono text-[11px] font-semibold tnum ${value === '—' ? 'text-textMuted' : (ink ?? 'text-textPrimary')}`} title={value === '—' ? why : undefined}>
      {value}
    </span>
  </span>
);

const ContractDrill = ({ contract, quote: q, day: d }: { contract: ContractId; quote: Quote; day: ContractDay }) => {
  const est = q.src === 'estimate' || q.src === 'coming' ? '≈' : '';
  const noTrade = q.src === 'coming' ? 'Its trades are still coming in' : 'No trade in it yet today';
  return (
  <div className="px-4 py-3 bg-silver/[0.04] border-y border-borderSubtle/70 flex flex-col gap-3 animate-soft-in" data-chain-drill={contract.strike}>
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-textSecondary">Stats</span>
      <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
        <Stat label="Bid" value={`${est}$${q.bid.toFixed(2)}`} />
        <Stat label="Mark" term="Mark" value={`${est}$${q.mark.toFixed(2)}`} />
        <Stat label="Ask" value={`${est}$${q.ask.toFixed(2)}`} />
        <Stat label="High so far" value={or(d.high, v => `$${v.toFixed(2)}`)} why={noTrade} />
        <Stat label="Low so far" value={or(d.low, v => `$${v.toFixed(2)}`)} why={noTrade} />
        <Stat label="Last trade" value={or(d.last, v => `$${v.toFixed(2)}`)} why={noTrade} />
        <Stat label="Prev close" value={or(d.prevClose, v => `$${v.toFixed(2)}`)} why="No trade in it on the session before, on the record this session holds" />
        <Stat label="Volume" term="Volume" value={or(d.volume, count)} why={noTrade} />
        <Stat label="Open interest" term="Open interest" value={or(d.oi, count)} why="Not in the record — Massive's minute bars carry trades, not open interest" />
        <Stat label="IV" term="IV" value={or(q.iv, v => `${est}${(v * 100).toFixed(2)}%`)} />
        <Stat label="Breakeven" term="Breakeven" value={or(d.breakeven, v => `$${v.toFixed(2)}`)} />
        <Stat label="Name must move" value={or(d.toBreakevenPct, v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)} ink={d.toBreakevenPct >= 0 ? 'text-bull' : 'text-bear'} />
      </div>
    </div>
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-textSecondary">The Greeks</span>
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
};

export default ContractDrill;
