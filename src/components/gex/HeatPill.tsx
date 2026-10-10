import { memo, type ReactNode } from 'react';
import { heatCellStyle, type HeatMode } from './heatmap';

/*
==================================================
  SLAYER TERMINAL - THE HEAT CELL, AS A PILL
  (components/gex/HeatPill.tsx)

  One cell of a heat surface: a rounded capsule
  carrying its own value, floating on the surface
  rather than tiling with its neighbours.

  WHY A PILL AND NOT A TILE. The old cell was the
  table cell — a flat rectangle with a background
  colour, edge to edge, so a row of them read as one
  continuous band and the eye had to find the seams
  before it could count columns. Reading a strike
  across five expiries meant tracking a colour change
  with no boundary to hold on to.

  A capsule with air around it is a COUNTABLE object.
  The gap does the work the borders used to: columns
  separate without a single rule being drawn, and a
  quiet cell reads as a quiet cell rather than as a
  gap in the band.

  THE COLOUR IS UNCHANGED, deliberately. This is the
  same `heatCellStyle` ramp every heat surface has
  used — gold is put-dominant and amplifying, steel
  is call-dominant and absorbing, ink is chosen by
  measured contrast against the fill it lands on.
  Only the SHAPE moved. A form change that also moves
  the colours is two changes wearing one commit, and
  the next person cannot tell which one they are
  looking at.
==================================================
*/

export interface HeatPillProps {
  /** Signed value — decides both the pole and the intensity. */
  value: number;
  /** The scale this surface paints against. */
  maxAbs: number;
  /** What to print inside. Right-aligned, because a column of numbers is read
      down its last digit, not its first. */
  children: ReactNode;
  /**
   * Ringed rather than recoloured.
   *
   * A selected cell cannot be marked by changing its fill: the fill IS the
   * value, and overriding it makes the one cell the reader is looking at the
   * one cell that no longer says what it holds.
   */
  selected?: boolean;
  /** Override the ring's colour — the supreme strike wears the supreme magenta, not the
      selection silver, because it is a property of the BOOK rather than of what
      the reader clicked. */
  ringColor?: string;
  /** A mark at the leading edge — the supreme strike, a held position. Sits in its
      own lane so it never collides with the number. */
  marker?: ReactNode;
  /** Height of the capsule. The row owns its rhythm; this only fills it. */
  className?: string;
  /** The figure's size in px when the row is tall enough to earn more than the 10px default
      (the Ledger's rows share the panel's height — a 40px row prints 13px). */
  fontSize?: number;
  /** Another ramp for THIS surface only (the Ledger's thermal try) — the house ramp otherwise */
  mode?: HeatMode;
  /** Half the side padding — a narrow cell (the Ledger's All at forty columns) keeps its short figure */
  tight?: boolean;
  /** On paper (the light page): the tint ramp, a faint colour on the page's grey — the surface says so, never the pill
      itself, because the surfaces that stay dark islands on the light page keep the dark ramp */
  paper?: boolean;
  title?: string;
  onClick?: () => void;
}

/*
  The ring is the SELECTION voice (the silver accent), not a heat colour, so it cannot be
  mistaken for a value. It is drawn as an inset shadow rather than a border:
  a border would add a pixel to the box and shift every neighbour by half a
  row when one cell is picked.
*/
const SELECTION_INK = 'rgb(var(--select))';
/* Two rings, not one: the accent alone vanishes against the ramp's bright
   platinum pole, so a dark outer ring gives it an edge to sit on at both ends
   of the scale. Same trick the old supreme cell used. */
const ring = (ink: string) => `inset 0 0 0 1.5px ${ink}, inset 0 0 0 3px rgb(var(--panel) / 0.8)`;

/* THE FIGURE LIFTED OFF ITS FILL (the partner, 2026-09-14: "the numbers on the capsules are
   difficult to see"): the ink pair is fixed by the contrast maths in heatmap.ts (≥4.11:1 at the
   crossover, no better pair exists), so the lift comes from WEIGHT — bold, not semibold — and a
   faint halo in the other ink under every glyph, which is what carries a 10px figure across the
   mid-luminance fills where the ratio is at its floor. */
const HALO_UNDER_DARK_INK = '0 0 1.5px rgba(255,255,255,0.45)';
const HALO_UNDER_LIGHT_INK = '0 0 2px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.5)';

const HeatPill = ({
  value,
  maxAbs,
  children,
  selected = false,
  ringColor,
  marker,
  className = '',
  fontSize,
  mode,
  tight = false,
  paper = false,
  title,
  onClick,
}: HeatPillProps) => {
  const heat = heatCellStyle(value, maxAbs, mode, paper);
  const halo = heat.color === '#0a0a0a' ? HALO_UNDER_DARK_INK : HALO_UNDER_LIGHT_INK;
  return (
    <span
      title={title}
      onClick={onClick}
      style={{ ...heat, textShadow: halo, ...(selected ? { boxShadow: ring(ringColor ?? SELECTION_INK) } : null), ...(fontSize ? { fontSize } : null) }}
      className={`flex min-w-0 items-center justify-end gap-1 rounded-full ${tight ? 'px-1' : 'px-2'} font-mono text-[11px] font-bold tnum leading-none transition-colors duration-700 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {marker && <span className="mr-auto flex shrink-0 items-center">{marker}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
};

/* MEMOISED (2026-09-06, the perf sweep): a calendar is eight hundred of these,
   and a tick that changes one column re-rendered every one of them — the
   ramp lookup and the style object for each. A cell whose value, scale and
   words are the same is the same pill. */
export default memo(HeatPill);

