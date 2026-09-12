/*
==================================================
  SLAYER TERMINAL - CONTRACT FACTS (ContractFacts.tsx)
  The contract in dollars — cost, breakeven, time
  value, decay, delta, spread. One pricer, one story:
  every number here comes from the same model that
  minted the mid. Shared by the campaign page and
  the (unrouted) SignalMonitor.
==================================================
*/

import RichRead from '../ui/RichRead';
import { estimatePremium } from '../../data/compass';
import type { Setup } from '../../types/compass';

/** One dollarized contract fact — the number AND the sentence. The sentence
    is a READ, not a label: it wears readable ink (the Dark Pool lesson) and
    RichRead colors its numbers (standing rule, Noah 2026-08-08: important
    numbers draw the eye WITHOUT being asked). The label wears holo silver —
    chrome naming a slot, visually distinct from the gray sentence below. */
export const Fact = ({ label, value, sub, ink = 'text-textPrimary' }: { label: string; value: string; sub: string; ink?: string }) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <span className="font-mono text-[9px] uppercase tracking-wider text-silver">{label}</span>
    <span className={`font-mono text-[14px] font-bold tnum ${ink}`}>{value}</span>
    <span className="font-mono text-[10px] text-textSecondary leading-snug">
      <RichRead text={sub} />
    </span>
  </div>
);

/** Ledger row variant (Noah, 2026-08-17 — the 2-col fact grid read as "open
    spacing and alignment off"): label + sentence left, value on the right
    rail, hairlines between — the same grammar as the greeks ledger, so the
    two sections align into one instrument. */
const LedgerFact = ({ label, value, sub, ink = 'text-textPrimary' }: { label: string; value: string; sub: string; ink?: string }) => (
  <div className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
    <span className="flex flex-col gap-0.5 min-w-0">
      <span className="font-mono text-[9px] uppercase tracking-wider text-silver">{label}</span>
      <span className="font-mono text-[10px] text-textSecondary leading-snug">
        <RichRead text={sub} />
      </span>
    </span>
    <span className={`font-mono text-[13px] font-bold tnum text-right shrink-0 ${ink}`}>{value}</span>
  </div>
);

interface ContractFactsProps {
  setup: Setup;
  /** The underlying, live — the facts speak in its terms. */
  spot: number;
  /** Grid shape — the campaign rail stacks 2-up, the monitor ran 6-up. */
  className?: string;
  /** Render as a hairline ledger (label+sentence left, value right) instead
      of stacked cells — the campaign card's contract tab uses this. */
  ledger?: boolean;
}

const ContractFacts = ({ setup, spot, className = 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-x-6 gap-y-4', ledger = false }: ContractFactsProps) => {
  /* Decay comes from THE pricer (one session less, same spot), not the
     ad-hoc theta field — one model mints every number on this surface. */
  const iv = setup.greeks.iv / 100;
  const sessions = Math.max(setup.sessionsLeft, 0.5);
  const priceAt = (s: number, sess: number) =>
    estimatePremium(s, setup.strike, setup.right, iv, Math.max(sess, 0.05) / 252);
  const cost = setup.mid * 100;
  const breakeven = setup.right === 'C' ? setup.strike + setup.mid : setup.strike - setup.mid;
  const travelPct = spot > 0 ? ((breakeven - spot) / spot) * 100 : 0;
  const decayPerSession = Math.max(0, priceAt(spot, sessions) - priceAt(spot, sessions - 1)) * 100;
  const deltaUsd = Math.abs(setup.greeks.delta) * 100;
  const spreadUsd = (setup.ask - setup.bid) * 100;
  const spreadPct = setup.mid > 0 ? ((setup.ask - setup.bid) / setup.mid) * 100 : 0;
  const intrinsic =
    setup.right === 'C' ? Math.max(spot - setup.strike, 0) : Math.max(setup.strike - spot, 0);
  const timeValuePct = setup.mid > 0 ? Math.max(0, 1 - intrinsic / setup.mid) * 100 : 100;

  const facts = [
    { label: 'Cost', value: `$${cost.toFixed(0)}`, sub: `$${setup.mid.toFixed(2)} mid × 100 · the whole of it is at risk` },
    {
      label: 'Breakeven',
      value: `$${breakeven.toFixed(2)}`,
      sub: `${setup.ticker} has to travel ${Math.abs(travelPct).toFixed(2)}% to reach it`,
      ink: 'text-warn',
    },
    {
      label: 'Time value',
      value: `${Math.round(timeValuePct)}%`,
      sub: timeValuePct >= 99.5 ? 'none of the price is exercise value — all of it expires' : 'of the price expires — the rest is exercise value',
    },
    {
      label: 'Decay',
      value: `$${decayPerSession.toFixed(0)}/session`,
      sub: 'what one session costs at this spot, per the pricer',
      ink: 'text-warn',
    },
    {
      label: 'Delta',
      value: `$${deltaUsd.toFixed(0)}`,
      sub: `per $1 ${setup.right === 'C' ? 'rise' : 'fall'} in ${setup.ticker} · ≈ the market's ITM odds`,
      ink: setup.right === 'C' ? 'text-bull' : 'text-bear',
    },
    {
      label: 'Spread',
      value: `$${spreadUsd.toFixed(0)}`,
      sub: `round trip across the book · ${spreadPct.toFixed(1)}% of mid`,
    },
  ];

  if (ledger) {
    return (
      <div className="divide-y divide-borderSubtle">
        {facts.map(f => (
          <LedgerFact key={f.label} {...f} />
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {facts.map(f => (
        <Fact key={f.label} {...f} />
      ))}
    </div>
  );
};

export default ContractFacts;
