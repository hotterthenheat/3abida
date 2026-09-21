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

/*
  ================================================================
  THE TYPE SCALE, and the rule that made one necessary.

  A count of /paper found 163 text-bearing elements of which 98%
  were 11px or smaller and 39% were uppercase. That is not a
  dense terminal, it is one long whisper, and it is the single
  loudest tell that a screen was generated rather than designed.
  A trading desk has a handful of figures you read across the
  room and a great many you go looking for; ours had none of the
  first kind.

  FIVE STEPS, and what each is for:

    HERO    the one number a panel exists to answer. At most ONE
            per panel. If a panel has two, it is two panels.
    VALUE   the figures you read without hunting.
    SUB     supporting figures, read on purpose.
    LABEL   what a value is, when the value cannot say so itself.
            Uppercase is a LABEL device and nothing else: a
            number never wears it, and neither does prose.
    NOTE    the sentences that explain rather than report.

  Every one is tabular-numeral and monospaced where it carries a
  figure, because columns of numbers that do not line up are
  harder to read than small ones.
  ================================================================
*/
export const T = {
  hero: 'font-mono text-[22px] font-semibold tnum leading-none text-textPrimary',
  value: 'font-mono text-[13px] font-semibold tnum leading-tight text-textPrimary',
  sub: 'font-mono text-[11px] tnum leading-tight text-textSecondary',
  label: 'font-mono text-[9px] font-medium uppercase tracking-widest text-textMuted whitespace-nowrap',
  note: 'font-mono text-[10px] leading-snug text-textMuted',
} as const;

/**
 * A LABEL OVER A VALUE — the unit a trading panel is built from, and the
 * shape the desk was missing. The label recedes, the figure carries.
 */
export const Stat = ({
  label,
  children,
  size = 'value',
  title,
  testId,
  onContextMenu,
  className = '',
}: {
  label: string;
  children: ReactNode;
  size?: 'hero' | 'value' | 'sub';
  title?: string;
  testId?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
}) => (
  <div className={`flex flex-col gap-1 min-w-0 ${className}`} title={title} data-stat={testId ?? label} onContextMenu={onContextMenu}>
    <span className={T.label}>{label}</span>
    <span className={`${T[size]} truncate`}>{children}</span>
  </div>
);

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
export const sideFill = (side: Side): string =>
  side === 'buy' ? 'bg-bullSolid text-[#0a0a0a]' : 'bg-bearSolid text-white';

/** The house switch (WatchMenu's) */
export const Toggle = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => (
  <Switch.Root
    checked={checked}
    disabled={disabled}
    onCheckedChange={onChange}
    aria-label={label}
    className="relative shrink-0 w-8 h-[18px] rounded-full border border-borderSubtle bg-ink/[0.06] data-[state=checked]:bg-silver data-[state=checked]:border-silver transition-colors outline-none focus-visible:ring-2 focus-visible:ring-silver/60"
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
