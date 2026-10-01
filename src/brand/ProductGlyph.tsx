/*
==================================================
  SLAYER TERMINAL - A PRODUCT'S GLYPH (brand/ProductGlyph.tsx)

  "One tile. Thirteen glyphs. One part in color." (Slayer Logo System, 04 · Product icons.) Each glyph sits where the
  S sits, cut at the S's weight; the foil is silver on the dark tile and graphite on paper; the one coloured part is
  the desk's own ink (nav.ts NAV_INK), "the one bright thing, like the cursor".

  Three forms, as the proof sheet draws them:
    tile, 64 px and up   the whole tile — corner brackets and the ">" (menus on the landing, a product's card)
    tile, under 64       no ">", no brackets: the glyph centred on its tile (16, 24 and 32 px)
    bare                 the glyph alone, filling its box — the rail and every list that sits on its own ground

  The gaps a glyph cuts (round a dot, under a pencil) are cut through with a mask, not painted in the tile's colour,
  so a bare glyph is right on any ground. Nothing here moves: the glyphs are still; only the mark's S pans.
==================================================
*/

import { useId, type CSSProperties, type ReactNode } from 'react';
import { GLYPH_DRAW, MARK, type GlyphName, type GlyphPart } from './paths';
import { NAV_INK } from '../components/layout/nav';

/** Each glyph's ink — the desk's own (the Logo System's desk inks are nav.ts's, to the hex) */
export const GLYPH_INK: Record<GlyphName, string> = {
  terminal: 'rgb(var(--wordmark))',
  pulse: NAV_INK.pulse,
  terrain: NAV_INK.terrain,
  trace: NAV_INK.trace,
  dossier: NAV_INK.record,
  pinpoint: NAV_INK.pinpoint,
  compass: NAV_INK.compass,
  weigher: NAV_INK.weigher,
  practice: NAV_INK.paperDesk,
  paper: NAV_INK.paperDesk,
  backtest: NAV_INK.backtest,
  journal: NAV_INK.journal,
  community: NAV_INK.community,
  alerts: NAV_INK.alerts,
};

const TONE: Record<NonNullable<GlyphPart['t']>, number> = { dim: 0.5, mid: 0.78, shade: 0.22 };

interface ProductGlyphProps {
  name: GlyphName;
  /** the box's side, px */
  size: number;
  /** the glyph alone, no tile */
  bare?: boolean;
  /** the coloured part's ink — the desk's own when left out */
  ink?: string;
  className?: string;
  style?: CSSProperties;
  /** an accessible name; decorative when left out */
  label?: string;
}

const ProductGlyph = ({ name, size, bare = false, ink, className, style, label }: ProductGlyphProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const draw = GLYPH_DRAW[name];
  const [bx0, by0, bx1, by1] = draw.box;
  const full = !bare && size >= 64;
  let vx = 0;
  let vy = 0;
  let side = 64;
  if (!full) {
    side = Math.max(bx1 - bx0, by1 - by0) * (bare ? 1.04 : 1.5);
    vx = (bx0 + bx1) / 2 - side / 2;
    vy = (by0 + by1) / 2 - side / 2;
  }
  const colour = ink ?? GLYPH_INK[name];
  const foil = `${uid}f`;

  /* THE CUTS: a gap cuts what was drawn BEFORE it, never what comes after (a dot laid over its own cut-out ring). So the
     parts are drawn in runs; each run of cuts masks everything drawn up to it. */
  type Run = { parts: GlyphPart[]; cuts: GlyphPart[] };
  const runs: Run[] = [{ parts: [], cuts: [] }];
  for (const p of draw.parts) {
    if (p.r === 'c' && !full) continue;
    const last = runs[runs.length - 1];
    if (p.r === 'x') last.cuts.push(p);
    else if (last.cuts.length) runs.push({ parts: [p], cuts: [] });
    else last.parts.push(p);
  }

  const paint = (p: GlyphPart, i: number) => {
    const fill =
      p.r === 's' ? `url(#${foil})` : p.r === 'i' ? colour : p.r === 'c' ? 'rgb(var(--chevron))' : p.r === 'b' ? 'rgb(var(--wordmark))' : '#000';
    const opacity = p.t ? TONE[p.t] : undefined;
    return p.w != null ? (
      <path key={i} d={p.d} fill="none" stroke={fill} strokeWidth={p.w} strokeLinejoin={p.j ?? 'miter'} strokeLinecap={p.cap ?? 'butt'} opacity={opacity} />
    ) : (
      <path key={i} d={p.d} fill={fill} opacity={opacity} />
    );
  };
  const cutPaint = (p: GlyphPart, i: number) =>
    p.w != null ? (
      <path key={i} d={p.d} fill="none" stroke="#000" strokeWidth={p.w} strokeLinejoin={p.j ?? 'miter'} strokeLinecap={p.cap ?? 'butt'} />
    ) : (
      <path key={i} d={p.d} fill="#000" />
    );

  /* fold the runs from the first: each run's cuts wrap everything before them in a mask */
  let body: ReactNode = null;
  const masks: ReactNode[] = [];
  runs.forEach((run, ri) => {
    const drawn = (
      <>
        {body}
        {run.parts.map(paint)}
      </>
    );
    if (run.cuts.length) {
      const id = `${uid}m${ri}`;
      masks.push(
        <mask key={id} id={id} maskUnits="userSpaceOnUse" x={vx} y={vy} width={side} height={side}>
          <rect x={vx} y={vy} width={side} height={side} fill="#fff" />
          {run.cuts.map(cutPaint)}
        </mask>
      );
      body = <g mask={`url(#${id})`}>{drawn}</g>;
    } else {
      body = drawn;
    }
  });

  const radius = full ? 3 : side * 0.075;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${vx} ${vy} ${side} ${side}`}
      className={className}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-glyph={name}
    >
      <defs>
        <linearGradient id={foil} gradientUnits="userSpaceOnUse" x1={bx0} y1={by0} x2={bx1} y2={by1}>
          <stop offset="0" style={{ stopColor: 'rgb(var(--foil-1))' }} />
          <stop offset="0.3" style={{ stopColor: 'rgb(var(--foil-2))' }} />
          <stop offset="0.55" style={{ stopColor: 'rgb(var(--foil-3))' }} />
          <stop offset="0.75" style={{ stopColor: 'rgb(var(--foil-4))' }} />
          <stop offset="1" style={{ stopColor: 'rgb(var(--foil-5))' }} />
        </linearGradient>
        {masks}
      </defs>
      {!bare && (
        <>
          <rect x={vx} y={vy} width={side} height={side} rx={radius} style={{ fill: 'rgb(var(--tile))' }} />
          <rect x={vx + 0.4} y={vy + 0.4} width={side - 0.8} height={side - 0.8} rx={Math.max(0, radius - 0.4)} style={{ fill: 'none', stroke: 'rgb(var(--tile-edge))', strokeWidth: 0.8 }} />
        </>
      )}
      {full && <path d={MARK.brackets} style={{ fill: 'none', stroke: 'rgb(var(--bracket))', strokeWidth: 0.7 }} />}
      {body}
    </svg>
  );
};

export default ProductGlyph;
