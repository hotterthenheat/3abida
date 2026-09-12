import type { EarningsEvent } from '../../data/earnings';

/*
  Vol-pricing states — how the market is charging for a print vs what the
  name historically does. States, not orders: the engine's PLAY/FADE/SKIP
  verdicts stay internal; users see the pricing described.
*/

export type VolState = 'RICH' | 'INLINE' | 'CHEAP';

export const stateOf = (e: EarningsEvent): VolState =>
  e.richness >= 1.3 ? 'RICH' : e.richness <= 0.85 ? 'CHEAP' : 'INLINE';

// Plain English only — no trader shorthand in user-facing labels
export const STATE_LABEL: Record<VolState, string> = {
  RICH: 'OVERPRICED',
  INLINE: 'FAIRLY PRICED',
  CHEAP: 'UNDERPRICED',
};

const stateDot: Record<VolState, string> = {
  RICH: 'bg-warn',
  INLINE: 'bg-ink/30',
  CHEAP: 'bg-bull',
};

export const StateTag = ({ state }: { state: VolState }) => (
  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-textPrimary whitespace-nowrap">
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stateDot[state]}`} />
    {STATE_LABEL[state]}
  </span>
);
