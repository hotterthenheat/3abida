/*
==================================================
  SLAYER TERMINAL - SETUP SCAN CARD (SetupScanCard.tsx)
  One ranked contract on the two-axis board. Partner's
  information architecture (docs/compass-redesign-port.md),
  OUR ink: his cards render every datum in neutral gray —
  structure without direction. Here the contract pill and
  score lean with the market, achievement wears bull, and
  process states stay chrome. Labels whisper, numbers never.
==================================================
*/

import { ArrowUpRight, TriangleAlert } from 'lucide-react';
import type { Setup } from '../../types/compass';
import SignalBadge from '../ui/SignalBadge';
import ContractLabel from '../ui/ContractLabel';
import SessionSpark from './SessionSpark';
import { hitLevel } from './setupStage';
import { processState, PROCESS_META } from './setupProcess';

const Stat = ({ label, value, ink = 'text-textPrimary', right = false }: { label: string; value: string; ink?: string; right?: boolean }) => (
  <span className={`flex flex-col gap-0.5 min-w-0 ${right ? 'items-end text-right' : ''}`}>
    <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted">{label}</span>
    <span className={`font-mono text-[13px] font-semibold tnum ${ink}`}>{value}</span>
  </span>
);

interface SetupScanCardProps {
  setup: Setup;
  /** Global scan rank (1-based) — #1 wears the magenta crown. */
  rank: number;
  selected: boolean;
  onSelect: (setup: Setup) => void;
  onAnalysis: (setup: Setup) => void;
  /** MM/DD/YY of the real expiry session, resolved by the page's calendar. */
  expiryChip: string;
}

const SetupScanCard = ({ setup, rank, selected, onSelect, onAnalysis, expiryChip }: SetupScanCardProps) => {
  const state = processState(setup);
  const meta = PROCESS_META[state];
  const tpHit = hitLevel(setup);
  const isCall = setup.right === 'C';

  return (
    <button
      onClick={() => onSelect(setup)}
      aria-pressed={selected}
      title={selected ? "Selected — click again for the setup's page" : "Select — the heaviest contracts follow this name"}
      /* Selected = the "where you are" ink — Noah asked for a white border on
         2026-08-19; since the 2026-09-05 doctrine that ink is the holo silver
         everywhere, and the walk (2026-09-11) brought the card in line. One
         click selects and points the rail at this name; a second opens. */
      className={`flex-1 min-w-0 text-left rounded-md border p-3.5 flex flex-col gap-3 transition-colors ${
        selected
          ? 'border-silver/60 bg-silver/[0.04]'
          : 'border-borderSubtle bg-ink/[0.015] hover:border-borderMuted hover:bg-ink/[0.03]'
      }`}
      data-compass-card={setup.id}
      data-selected={selected || undefined}
    >
      {/* identity row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] text-textSecondary tnum">#{rank}</span>
        {/* The whole contract in its side's ink, with the name's mark (the one rule, components/ui/ContractLabel) */}
        <ContractLabel contract={setup.contract} right={setup.right} logo={setup.ticker} />
        <span className="font-mono text-[10px] text-textSecondary border border-borderSubtle rounded px-1.5 py-0.5">
          {setup.expiry} · {expiryChip}
        </span>
        {rank === 1 && <SignalBadge tone="crown">Top pick</SignalBadge>}
        <span className="ml-auto flex items-center gap-1.5">
          {tpHit != null && <SignalBadge tone="bull">TP{tpHit} HIT</SignalBadge>}
          <SignalBadge tone={meta.tone} dot pulse={meta.pulse}>
            {state}
          </SignalBadge>
        </span>
      </div>

      {/* Stat row — edge-anchored like the rows above and below it (Noah,
          2026-08-17: a half-width cell read as "floating in the middle").
          "Premium", not "Mid": one concept, one name — it's the same number
          the campaign card calls Premium (the bid/ask midpoint). No score or
          health cells: grades are engine-internal (2026-08-16). */}
      <div className="flex items-start justify-between gap-2">
        <Stat label="1σ move" value={`±${setup.sigmaMovePct}%`} />
        {/* The underlying's REAL session tape (Noah, 2026-08-17 — his
            partner's cards wear zigzag decorations; ours draws the data) */}
        <SessionSpark ticker={setup.ticker} width={96} height={30} />
        <Stat label="Premium" value={`$${setup.mid.toFixed(2)}`} right />
      </div>

      {/* Thesis chips removed (Noah, 2026-08-17: "way too redundant and
          doesnt really explain anything") — the whyText prose on the
          campaign page does the explaining. */}

      {/* what kills it + analysis */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-warn min-w-0" title={setup.invalidationReason}>
          <TriangleAlert className="w-3 h-3 shrink-0" />
          <span className="truncate">
            Breaks {isCall ? 'below' : 'above'} <span className="tnum font-semibold">${setup.invalidationPrice.toFixed(2)}</span>
          </span>
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={e => {
            e.stopPropagation();
            onAnalysis(setup);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              e.preventDefault();
              onAnalysis(setup);
            }
          }}
          title="Open the setup's page"
          className="ml-auto shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary border border-borderSubtle hover:border-borderMuted rounded px-2 py-1 transition-colors"
          data-compass-open
        >
          Open
          <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
};

export default SetupScanCard;
