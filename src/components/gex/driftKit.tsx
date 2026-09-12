import type { ReactNode } from 'react';

/*
==================================================
  SLAYER TERMINAL - THE DRIFT CHARTS' SHARED GRAMMAR
  (components/gex/driftKit.tsx)
==================================================

  Wall Drift's grammar, factored once. Four session timelines wear it —
  the walls (WallDrift), the book's total (NetGexDrift), the model audit
  (ErrorDrift) and the basis bands (BasisDrift) — and until this file each
  carried its own copy: its own 100×40 viewBox scaler, its own corner
  min/max labels, its own hover card markup drifting a few pixels from its
  siblings'.

  They render on RECHARTS now (owner, 2026-08-28: "source your charts from
  recharts") — the same library the Trace drilldown and the earnings hub
  already draw with — and this file is what keeps the port ONE grammar
  instead of four: the axis ink and type that ContractFlowChart settled,
  the hover card as a component, the legend key as a component. A drift
  chart that needs a different card is a different product and should look
  like one on purpose, not by copy drift.

  WHAT THE PORT DELIBERATELY KEEPS from the hand-rolled era: the DOM
  legend (recharts' Legend speaks a different type voice), the custom card
  (same reason), the house inks untouched — colour still means what the
  palette says it means, the library only draws the geometry.

  ONE HAZARD EVERY CALLER MUST KNOW: recharts FREEZES the data rows it is
  handed (its state runs on immer). Hand it an array another system still
  mutates — the simulator's live candles, mutated in place per tick — and
  that system starts throwing "Cannot assign to read only property".
  Measured on the pain map's companion chart. Every drift chart must OWN
  its rows: engines that build fresh objects per call are safe as-is;
  live buffers get copied at the chart's edge.
*/

/** Matches textMuted — the settled axis ink (ContractFlowChart). */
export const AXIS_INK = 'rgb(var(--text-muted))';
export const GRID_INK = 'rgba(255,255,255,0.05)';
export const CURSOR_INK = 'rgba(255,255,255,0.2)';

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** Shared axis look: no spines, no tick lines, 9px mono in the muted ink. */
export const AXIS_TICK = { fill: AXIS_INK, fontSize: 9, fontFamily: MONO } as const;

/** HH:MM off a unix-seconds stamp — every drift x-axis speaks this. */
export const timeTick = (t: number): string =>
  new Date(t * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Five evenly-spaced time ticks over a series — the family's x rhythm. */
export const fiveTicks = (times: readonly number[]): number[] =>
  [0, 0.25, 0.5, 0.75, 1].map(f => times[Math.min(times.length - 1, Math.round(f * (times.length - 1)))]);

/** The hover card every drift chart floats — one markup, one voice. */
export const TipCard = ({ title, children }: { title: ReactNode; children: ReactNode }) => (
  <div className="border border-borderSubtle bg-chip/95 rounded-md px-2.5 py-2 shadow-lg min-w-[132px]">
    <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted tnum mb-1.5">{title}</div>
    <div className="flex flex-col gap-1">{children}</div>
  </div>
);

/** One reading in the card: swatch · label · value. */
export const TipRow = ({ ink, label, value, valueInk }: { ink: string; label: ReactNode; value: ReactNode; valueInk?: string }) => (
  <div className="flex items-center gap-2">
    <span className="inline-block w-2 h-[2px] rounded-full shrink-0" style={{ background: ink }} />
    <span className="font-mono text-[9px] uppercase tracking-wider text-textSecondary">{label}</span>
    <span
      className={`ml-auto pl-3 font-mono text-[10px] font-semibold tnum ${valueInk ? '' : 'text-textPrimary'}`}
      style={valueInk ? { color: valueInk } : undefined}
    >
      {value}
    </span>
  </div>
);

/** A legend key — the little rule-and-word pair above every drift chart. */
export const LegendKey = ({ ink, dash = false, swatch = false, children }: { ink: string; dash?: boolean; swatch?: boolean; children: ReactNode }) => (
  <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-textSecondary">
    {swatch ? (
      <span className="inline-block w-3 h-2 rounded-sm" style={{ background: ink, opacity: 0.25 }} />
    ) : (
      <span className="inline-block w-3 h-0" style={{ borderTop: `2px ${dash ? 'dashed' : 'solid'} ${ink}` }} />
    )}
    {children}
  </span>
);

/** The family's empty state — a chart that has nothing yet says so in the
    same words at the same height, instead of collapsing. */
export const AwaitingState = ({ children, tall = true }: { children: ReactNode; tall?: boolean }) => (
  <div className={`${tall ? 'h-40' : 'h-36'} flex items-center justify-center font-mono text-[11px] text-textMuted uppercase tracking-widest`}>
    {children}
  </div>
);
