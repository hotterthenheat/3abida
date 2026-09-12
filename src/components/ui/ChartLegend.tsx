import React from 'react';

/** How a key is drawn. Every legend in the app is one of these five. */
export type SwatchKind = 'square' | 'line' | 'dot' | 'dashed' | 'gradient';

export interface LegendEntry {
  label: React.ReactNode;
  /** Swatch color as a CSS color (applied inline) — for chart/series colors. */
  color?: string;
  /** OR a Tailwind background class for the swatch (e.g. `bg-bull/60`). */
  swatchClass?: string;
  /** Per-item override of the row's `variant` — a real legend mixes kinds. */
  kind?: SwatchKind;
  /** CSS gradient, for `kind: 'gradient'` (a diverging ramp chip). */
  gradient?: string;
}

interface ChartLegendProps {
  items: LegendEntry[];
  className?: string;
  /** Default swatch kind: `square` = area/band fills · `line` = series/level rules */
  variant?: 'square' | 'line';
}

const SWATCH: Record<SwatchKind, string> = {
  square: 'w-2.5 h-2 rounded-sm',
  line: 'w-3 h-0.5 rounded-full',
  dot: 'w-1 h-1 rounded-full',
  dashed: 'w-3 h-0 border-t border-dashed',
  gradient: 'w-4 h-2 rounded-sm',
};

/**
 * The house chart legend.
 *
 * Two label grammars: `line` (thin rule + sentence-case secondary label) for
 * chart toolbars, and `square` (small filled block + uppercase muted label)
 * for area and band fills.
 *
 * Individual keys can override the swatch with `kind`, because a real legend
 * mixes shapes — the positioning map carries two filled blocks, a solid rule
 * and a dashed rule in one row.
 *
 * Pass `color` for a raw chart color, `swatchClass` for a token background, or
 * `gradient` with `kind: 'gradient'` for a diverging ramp chip.
 */
const ChartLegend = ({ items, className = '', variant = 'square' }: ChartLegendProps) => {
  const line = variant === 'line';
  return (
    <div className={`flex flex-wrap items-center ${line ? 'gap-x-3.5' : 'gap-x-3'} gap-y-1 select-none ${className}`}>
      {items.map((it, i) => {
        const kind: SwatchKind = it.kind ?? (line ? 'line' : 'square');
        const style: React.CSSProperties | undefined =
          kind === 'gradient'
            ? { backgroundImage: it.gradient }
            : kind === 'dashed'
              ? it.color
                ? { borderColor: it.color }
                : undefined
              : it.color
                ? { background: it.color }
                : undefined;
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-1.5 font-mono text-[10px] ${
              line ? 'text-textSecondary' : 'uppercase tracking-wider text-textMuted'
            }`}
          >
            <span className={`inline-block shrink-0 ${SWATCH[kind]} ${it.swatchClass ?? ''}`} style={style} />
            {it.label}
          </span>
        );
      })}
    </div>
  );
};

export default ChartLegend;
