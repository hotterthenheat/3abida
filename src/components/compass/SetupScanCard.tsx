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
import { recordOf, statusOf } from './campaignStore';
import { processState, PROCESS_META } from './setupProcess';

/* `cased`: the label as written — "1σ move" upper-cased reads "1Σ MOVE", and Σ is a sum (the audit's CO-23) */
const Stat = ({ label, value, ink = 'text-textPrimary', right = false, cased = false }: { label: string; value: string; ink?: string; right?: boolean; cased?: boolean }) => (
  <span className={`flex flex-col gap-0.5 min-w-0 ${right ? 'items-end text-right' : ''}`}>
    <span className={`font-mono text-[9px] tracking-wider text-textMuted ${cased ? '' : 'uppercase'}`}>{label}</span>
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
  /** A card that OPENS its setup's page on the first click (Pulse's Compass widget, which has no rail for a selection to
      point): its tooltip says so, not "Select" (2026-10-01 — it promised a selection the widget never makes). */
  opens?: boolean;
}

const SetupScanCard = ({ setup, rank, selected, onSelect, onAnalysis, expiryChip, opens = false }: SetupScanCardProps) => {
  const state = processState(setup);
  const meta = PROCESS_META[state];
  /* THE ONE DERIVATION (campaignStore): the targets the tape has crossed since the sweep found this setup, and whether a
     close broke its floor — the page head, both charts and the Tracker read the same */
  const status = statusOf(recordOf(setup.id));
  const tpHit = status.hitLevel;
  const retired = status.brk != null;
  const isCall = setup.right === 'C';

  return (
    /* NOT A BUTTON HOLDING A BUTTON (the audit's X6.10: the card was a <button> with a span role="button" inside it, and
       Tab walked card, Open, card, Open). The card is a box a click on selects; its two controls are real buttons — the
       contract selects (pressed while selected), Open opens. */
    <div
      onClick={() => onSelect(setup)}
      title={opens ? "Open the setup's page" : selected ? "Selected — click again for the setup's page" : "Select — the heaviest contracts follow this name"}
      /* Selected = the "where you are" ink — Noah asked for a white border on
         2026-08-19; since the 2026-09-05 doctrine that ink is the holo silver
         everywhere, and the walk (2026-09-11) brought the card in line. One
         click selects and points the rail at this name; a second opens. */
      className={`text-left rounded-md border p-3.5 flex flex-col gap-3 cursor-pointer transition-colors ${
        selected
          ? 'border-silver/60 bg-silver/[0.04]'
          : 'border-borderSubtle bg-ink/[0.015] hover:border-borderMuted hover:bg-ink/[0.03]'
      }`}
      data-compass-card={setup.id}
      data-selected={selected || undefined}
    >
      {/* identity row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] text-textMuted tnum">#{rank}</span>
        {/* the name's mark and the whole contract in its side's ink — one component for every surface (2026-09-13); the
            keys' way to select the card */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onSelect(setup);
          }}
          aria-pressed={opens ? undefined : selected}
          aria-label={opens ? `Open ${setup.contract}` : `${setup.contract}, rank ${rank}${selected ? ', selected' : ''}`}
          className="hit relative inline-flex rounded focus-visible:outline-offset-2"
          data-compass-select
        >
          <ContractLabel contract={setup.contract} right={isCall ? 'C' : 'P'} logo={setup.ticker} />
        </button>
        <span className="font-mono text-[10px] text-textSecondary border border-borderSubtle rounded px-1.5 py-0.5">
          {setup.expiry} · {expiryChip}
        </span>
        {rank === 1 && <SignalBadge tone="crown">Top pick</SignalBadge>}
        <span className="ml-auto flex items-center gap-1.5">
          {tpHit != null && <SignalBadge tone="bull">TP{tpHit} HIT</SignalBadge>}
          {retired ? (
            <SignalBadge tone="bear">Retired</SignalBadge>
          ) : (
            <SignalBadge tone={meta.tone} dot pulse={meta.pulse}>
              {state}
            </SignalBadge>
          )}
        </span>
      </div>

      {/* Stat row — edge-anchored like the rows above and below it (Noah,
          2026-08-17: a half-width cell read as "floating in the middle").
          "Premium", not "Mid": one concept, one name — it's the same number
          the campaign card calls Premium (the bid/ask midpoint). No score or
          health cells: grades are engine-internal (2026-08-16). */}
      <div className="flex items-start justify-between gap-2">
        <Stat label="1σ move" cased value={`±${setup.sigmaMovePct.toFixed(1)}%`} />
        {/* The underlying's REAL session tape (Noah, 2026-08-17 — his
            partner's cards wear zigzag decorations; ours draws the data) */}
        <SessionSpark ticker={setup.ticker} width={96} height={30} />
        <Stat label="Premium now" value={`$${setup.mid.toFixed(2)}`} right />
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
        {/* THE SELECTED CARD SAYS A SECOND PRESS OPENS (CO-10): its Open stands lit */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onAnalysis(setup);
          }}
          title="Open the setup's page"
          aria-label={`Open ${setup.contract}'s page`}
          className={`hit relative ml-auto shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider rounded px-2 py-1 border transition-colors ${
            selected ? 'text-textPrimary border-borderMuted bg-ink/[0.05]' : 'text-textSecondary hover:text-textPrimary border-borderSubtle hover:border-borderMuted'
          }`}
          data-compass-open
        >
          Open
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default SetupScanCard;
