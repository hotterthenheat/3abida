/*
==================================================
  SLAYER TERMINAL - THE PAPER DESK'S SMALL PARTS
  (pages/paper/paperKit.tsx)

  The pieces every surface on the desk shares: the
  PAPER pill (the sidebar's "Sim" pill's grammar —
  the one orange that means "not real"), the
  provenance chip that says where a number came
  from, signed money, the house switch, a clock and
  a holding time in words.
==================================================
*/

import * as Switch from '@radix-ui/react-switch';
import type { ReactNode } from 'react';
import type { Quote } from '../../core/paper/market';
import { fmtMoney } from '../../core/paper/instruments';
import type { Side } from '../../core/paper/engine';

/** THE PAPER MARK — unmistakable, everywhere an order or a balance lives */
export const PaperPill = ({ className = '' }: { className?: string }) => (
  <span className={`font-mono text-[9px] font-bold uppercase tracking-wider text-warn border border-warn/60 rounded px-1.5 py-0.5 select-none whitespace-nowrap ${className}`} title="Paper trading — simulated orders against the live market state. Nothing here reaches a brokerage." data-paper-pill>
    Paper
  </span>
);

/** OBSERVED · CALCULATED · PAPER EXECUTION — the three registers, said plainly */
export const ProvenanceChip = ({ quote, kind, className = '' }: { quote?: Quote | null; kind?: 'observed' | 'calculated' | 'paper'; className?: string }) => {
  const k = kind ?? quote?.provenance ?? 'observed';
  const words = k === 'paper' ? 'Paper execution' : k === 'observed' ? 'Observed' : 'Calculated';
  const title = kind === 'paper' ? 'Filled by the paper engine — not a market print' : quote?.note ?? (k === 'observed' ? "From the feed" : 'Derived from the feed by a stated model');
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[8px] font-semibold uppercase tracking-widest rounded px-1 py-[1px] border select-none whitespace-nowrap ${
        k === 'paper' ? 'text-warn border-warn/40 bg-warn/[0.06]' : k === 'observed' ? 'text-textSecondary border-borderMuted bg-ink/[0.03]' : 'text-silver border-silver/30 bg-silver/[0.05]'
      } ${className}`}
      title={title}
      data-provenance={k}
    >
      {words}
    </span>
  );
};

/** Signed dollars in the direction inks; zero stays quiet */
export const Money = ({ v, className = '', signed = true, dim = false }: { v: number; className?: string; signed?: boolean; dim?: boolean }) => (
  <span className={`font-mono tnum ${Math.abs(v) < 0.005 ? (dim ? 'text-textMuted' : 'text-textPrimary') : v > 0 ? 'text-bull' : 'text-bear'} ${className}`}>{fmtMoney(v, signed)}</span>
);

export const sideInk = (side: Side): string => (side === 'buy' ? 'text-bull' : 'text-bear');
export const sideFill = (side: Side): string => (side === 'buy' ? 'bg-bull text-[#0a0a0a]' : 'bg-bear text-white');

/** The house switch (WatchMenu's) */
export const Toggle = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => (
  <Switch.Root
    checked={checked}
    disabled={disabled}
    onCheckedChange={onChange}
    aria-label={label}
    className="relative shrink-0 w-8 h-[18px] rounded-full border border-borderSubtle bg-ink/[0.06] data-[state=checked]:bg-silver data-[state=checked]:border-silver disabled:opacity-40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-silver/60"
  >
    <Switch.Thumb className="block w-3 h-3 rounded-full bg-textPrimary translate-x-[2px] data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-panel transition-transform" />
  </Switch.Root>
);

/** A rail's small uppercase label */
export const RailLabel = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <span className={`font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap ${className}`}>{children}</span>
);

/** One fact in a rail: the label at the left, the value at the right */
export const FactRow = ({ label, children, title, testId }: { label: ReactNode; children: ReactNode; title?: string; testId?: string }) => (
  <div className="flex items-center justify-between gap-3 h-[22px]" title={title} data-fact={testId}>
    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap">{label}</span>
    <span className="font-mono text-[11px] tnum text-textPrimary whitespace-nowrap min-w-0 truncate">{children}</span>
  </div>
);

const two = (n: number) => String(n).padStart(2, '0');
/** "14:50:07" — the reader's clock */
export const fmtClock = (at: number): string => {
  const d = new Date(at);
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
};
/** "Sep 19 14:50" */
export const fmtStamp = (at: number): string => {
  const d = new Date(at);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** "38s" · "12m 04s" · "2h 14m" · "3d 5h" */
export const fmtHold = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${two(s % 60)}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${two(m % 60)}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
};

/** The chart's own inks for a side (palette.ts hexes — a canvas cannot read a token) */
export const BUY_HEX = '#30D158';
export const SELL_HEX = '#FF3B30';
export const LEVEL_HEX = '#EDEDED';
