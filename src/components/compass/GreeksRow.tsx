import AnimatedNumber from '../ui/AnimatedNumber';
import Term from '../ui/Term';
import { TERMS, type TermKey } from '../../data/terms';
import type { SetupGreeks } from '../../types/compass';

interface GreeksRowProps {
  greeks: SetupGreeks;
  /** show vega (monitor) vs iv (compact card) in the 4th slot */
  fourth?: 'vega' | 'iv';
  /** Robinhood change stamp on value swaps (browse card wants it; monitor doesn't) */
  flash?: boolean;
}

interface RowProps {
  label: string;
  value: number;
  format: (v: number) => string;
  arrow?: 'up' | 'down' | null;
  tone?: string;
  flash?: boolean;
}

/* A LEDGER, not a tile strip (Noah, 2026-08-09 — the boxed 4-cell greek grid
   is "the first AI-generated thing I always see"): full-width rows, label
   left in muted caps, value right in bright tabular figures, hairlines the
   only chrome. AnimatedNumber, not toFixed strings — this ledger lives on
   persistent cards (the meters-glide doctrine: values ROLL, never snap). */
const Row = ({ label, value, format, arrow = null, tone = 'text-textPrimary', flash = false }: RowProps) => (
  <div className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">
      {label in TERMS ? <Term k={label as TermKey} /> : label}
    </span>
    <span className={`font-mono text-[12px] font-semibold tnum inline-flex items-center gap-1 ${tone}`}>
      {arrow === 'up' && <span className="text-bull text-[9px]">▲</span>}
      {arrow === 'down' && <span className="text-bear text-[9px]">▼</span>}
      <AnimatedNumber value={value} format={format} flash={flash} />
    </span>
  </div>
);

const GreeksRow = ({ greeks, fourth = 'vega', flash = false }: GreeksRowProps) => {
  return (
    <div className="divide-y divide-borderSubtle">
      <Row label="Delta" value={greeks.delta} format={v => v.toFixed(2)} arrow={greeks.delta >= 0 ? 'up' : 'down'} flash={flash} />
      <Row label="Gamma" value={greeks.gamma} format={v => v.toFixed(4)} flash={flash} />
      <Row label="Theta" value={greeks.theta} format={v => v.toFixed(2)} tone="text-warn" flash={flash} />
      {fourth === 'vega' ? (
        // No arrow, no lime: vega is a magnitude, not a direction — the old
        // hardcoded bull-green ▲ beside a neon-lime number was two greens
        // saying nothing (lime is the interface's voice, never data).
        <Row label="Vega" value={greeks.vega} format={v => v.toFixed(2)} flash={flash} />
      ) : (
        <Row label="IV" value={greeks.iv} format={v => `${v.toFixed(1)}%`} flash={flash} />
      )}
    </div>
  );
};

export default GreeksRow;
