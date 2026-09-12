import { useEffect, useId, useRef, useState } from 'react';
import { ascendingSpotIndex, barGap, labelStride, layoutBand, spotX } from './strikeBand';
import { BULL, CALL_WALL, SUPREME, PUT_WALL, SPOT } from './palette';
import { fmtUsd } from '../../data/gex';
import type { ExposureProfileData } from '../../types/gex';

/*
==================================================
  SLAYER TERMINAL - EXPOSURE BY STRIKE, AS A BAND
  (components/gex/StrikeExposureBand.tsx)

  The reference's "Net Delta Exposure By Strike":
  strike along the bottom, signed exposure diverging
  from a rule through the middle, spot marked where
  it actually falls between two strikes.

  WHY THIS IS NOT A PANE IN THE PRICE CHART, and
  could never be. Every pane lightweight-charts draws
  shares ONE time axis — that is what makes a pane a
  pane rather than a second chart. This band's axis is
  the STRIKE. Forced into the chart's pane stack it
  would have to pretend strikes were timestamps, and
  the crosshair, the pan and the zoom would all then
  be lying about what the reader was pointing at.

  So it docks BELOW the chart instead: the same
  toggle, the same menu, the same persistence, and its
  own axis where it needs one.

  REDRAWN 2026-08-28 (Noah: "just a bunch of blocks
  with slight differences in size"). What was wrong
  was not the shape, it was that height was the ONLY
  voice the band had — flat rects at one opacity, no
  scale, no names, slots so wide a bar became a slab.
  Now magnitude speaks twice (height AND ink: a
  gradient that burns at the tip and cools to the
  rule, opacity scaled to the bar's share of the max),
  bars are capped at a readable width instead of
  swallowing their slot, the two extremes print their
  dollar values at the tip, the scale itself is
  printed in the corners, spot wears the house price
  tag, and the strikes that ARE somebody — supreme, call
  wall, put wall — are named in their own inks on the
  axis. Hover any slot and the header reads it out.

  THE INKS ARE THE HOUSE DIRECTION PAIR — the same
  two the flow band and the drift lines wear. A signed
  exposure bar is a direction, and the reader has
  already learned green-up/red-down twice on this
  screen; a third vocabulary for the same idea is a
  cost with no return. The supreme/wall inks appear only
  on the axis labels, where they mean identity, never
  on the bars, where they would fight direction.
==================================================
*/

/** Which greek the band draws. The same three the exposure matrix carries. */
export type BandMetric = 'gex' | 'dex' | 'vex';

export const BAND_METRICS: { key: BandMetric; label: string; unit: string }[] = [
  { key: 'dex', label: 'Net delta exposure', unit: 'per $1 move' },
  { key: 'gex', label: 'Net gamma exposure', unit: 'per 1% move' },
  { key: 'vex', label: 'Net vega exposure', unit: 'per 1% vol' },
];

export interface StrikeExposureBandProps {
  data: ExposureProfileData;
  metric: BandMetric;
  onMetric?: (m: BandMetric) => void;
  /** Drawing height of the plot itself, excluding the header and axis rows. */
  plotHeight?: number;
  onClose?: () => void;
}

/* Room under the plot for the strike labels, and above it for the header. */
const AXIS_H = 14;
/* The narrowest two strike labels may sit at before they touch. */
const LABEL_MIN_PX = 42;
/* A bar never grows past this, however wide its slot — at desk width a
   90px slot made every bar a slab, and a slab row is a wall, not a
   histogram. The slot keeps its width for hover; only the ink narrows. */
const BAR_MAX_PX = 22;

const NET_KEY: Record<BandMetric, 'netGex' | 'netDex' | 'netVex'> = {
  gex: 'netGex',
  dex: 'netDex',
  vex: 'netVex',
};

const StrikeExposureBand = ({
  data,
  metric,
  onMetric,
  plotHeight = 96,
  onClose,
}: StrikeExposureBandProps) => {
  /*
    The band is laid out in the box's OWN pixels rather than in a fixed
    viewBox stretched to fit. A viewBox would scale the bars and the type
    together, so the strike labels would grow on a wide desk and shrink to
    nothing on a phone — and the 1px floor that keeps a tiny value visible
    would stop being 1px.
  */
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId();
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.max(0, Math.floor(w)));
    });
    ro.observe(el);
    setWidth(Math.max(0, Math.floor(el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);

  /*
    STRIKES ASCEND LEFT TO RIGHT, and the profile hands them down.

    Reversed here rather than at the source: the ladder surfaces read
    top-to-bottom high-to-low, which is right for a vertical rail beside a
    price axis, and the horizontal band reads left-to-right low-to-high, which
    is right for an axis of prices. Both orders are correct for their own
    shape; only one of them can be the array's.
  */
  const rows = [...data.strikes].reverse();
  /* spotAfterIndex counts from the descending end, so it has to be mirrored
     with the rows — in the proved module, because an off-by-one here would put
     the spot rule one strike from the market and look perfectly fine. */
  const spotIndex = ascendingSpotIndex(data.spotAfterIndex, rows.length);

  /* Proportional air, not two fixed pixels — see barGap. Then the width cap,
     applied HERE rather than in the proved module: the layout's slot math is
     still what places labels and hover, only the drawn ink narrows, centred
     in the slot it was given. */
  const bars = layoutBand(
    rows,
    r => (r as (typeof rows)[number])[metric].net,
    data.maxAbs[metric],
    width,
    plotHeight,
    barGap(width, rows.length)
  ).map(b => {
    if (b.w <= BAR_MAX_PX) return b;
    return { ...b, x: b.x + (b.w - BAR_MAX_PX) / 2, w: BAR_MAX_PX };
  });
  const stride = labelStride(rows.length, width, LABEL_MIN_PX);
  const rule = spotX(spotIndex, rows.length, width);
  const net = data[NET_KEY[metric]];
  const meta = BAND_METRICS.find(m => m.key === metric) ?? BAND_METRICS[0];
  const maxAbs = data.maxAbs[metric];
  const mid = plotHeight / 2;
  const slot = rows.length > 0 ? width / rows.length : 0;

  /* The two loudest strikes get their numbers printed — the band's whole job
     is "where is it heaviest", so the answer is written down, not implied. */
  let topPos: (typeof bars)[number] | null = null;
  let topNeg: (typeof bars)[number] | null = null;
  for (const b of bars) {
    if (b.value > 0 && (topPos === null || b.value > topPos.value)) topPos = b;
    if (b.value < 0 && (topNeg === null || b.value < topNeg.value)) topNeg = b;
  }

  /* Identity on the axis: these strikes are SOMEBODY, in their own inks. */
  const nameFor = (strike: number): { ink: string; always: boolean } | null => {
    if (strike === data.levels.supreme) return { ink: SUPREME, always: true };
    if (strike === data.levels.callWall) return { ink: CALL_WALL, always: true };
    if (strike === data.levels.putWall) return { ink: PUT_WALL, always: true };
    return null;
  };

  const hovered = hover !== null ? bars[hover] : null;
  const clampLabelX = (x: number) => Math.min(width - 26, Math.max(26, x));

  return (
    <div className="flex flex-col border-t border-borderSubtle bg-inset/40">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-textSecondary">
          {meta.label}
        </span>
        <span className="font-mono text-[9px] text-textMuted">· {meta.unit}</span>
        <span
          className="font-mono text-[10px] font-semibold tnum"
          style={{ color: net >= 0 ? BULL : PUT_WALL }}
        >
          {fmtUsd(net)}
        </span>
        {/* The hover readout lives in the header the band already has, so
            pointing at a slot costs no extra chrome. */}
        {hovered && (
          <span className="font-mono text-[9px] tnum text-textMuted">
            ·{' '}
            <span className="text-textSecondary">{hovered.strike}</span>{' '}
            <span style={{ color: hovered.positive ? BULL : PUT_WALL }} className="font-semibold">
              {fmtUsd(hovered.value)}
            </span>
            {maxAbs > 0 && ` · ${Math.round((Math.abs(hovered.value) / maxAbs) * 100)}% of max`}
          </span>
        )}
        {/* The other two greeks are one click away — the same three the
            exposure matrix carries, on the surface where they are read live. */}
        {onMetric && (
          <span className="ml-auto flex items-center gap-1">
            {BAND_METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => onMetric(m.key)}
                title={`${m.label} · ${m.unit}`}
                className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest transition-colors ${
                  m.key === metric
                    ? 'bg-ink/[0.10] text-textPrimary'
                    : 'text-textMuted hover:bg-ink/[0.06] hover:text-textSecondary'
                }`}
              >
                {m.key}
              </button>
            ))}
          </span>
        )}
        {onClose && (
          <button
            onClick={onClose}
            title="Hide this band"
            aria-label="Hide the exposure band"
            className={`${onMetric ? '' : 'ml-auto'} rounded px-1 font-mono text-[10px] text-textMuted transition-colors hover:bg-ink/[0.08] hover:text-textPrimary`}
          >
            ✕
          </button>
        )}
      </div>

      <div ref={boxRef} className="w-full">
        {width > 0 && (
          <svg
            width={width}
            height={plotHeight + AXIS_H}
            className="block"
            role="img"
            aria-label={`${meta.label} by strike`}
            onMouseMove={e => {
              if (slot <= 0) return;
              const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
              const i = Math.floor(x / slot);
              setHover(i >= 0 && i < bars.length ? i : null);
            }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              {/* Magnitude's second voice: every bar burns at its tip and
                  cools toward the rule. objectBoundingBox, so each bar's own
                  box orients its fade — up-bars tip-first, down-bars reversed. */}
              <linearGradient id={`${uid}-up`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={BULL} stopOpacity="0.95" />
                <stop offset="1" stopColor={BULL} stopOpacity="0.30" />
              </linearGradient>
              <linearGradient id={`${uid}-dn`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={PUT_WALL} stopOpacity="0.30" />
                <stop offset="1" stopColor={PUT_WALL} stopOpacity="0.95" />
              </linearGradient>
            </defs>

            {/* The hovered SLOT, lit before the bars so it sits under them. */}
            {hover !== null && slot > 0 && (
              <rect x={hover * slot} y={0} width={slot} height={plotHeight} fill="rgba(255,255,255,0.04)" />
            )}

            {/* The zero rule — a solid hairline. Dashes made it read as one
                more piece of noise among the bars it is supposed to anchor. */}
            <line x1={0} x2={width} y1={mid} y2={mid} stroke="rgba(255,255,255,0.14)" />

            {/* The scale, said out loud in the corners: a bar at full height
                IS this number. Without it the heights were just shapes. */}
            {maxAbs > 0 && (
              <>
                <text x={width - 4} y={9} textAnchor="end" className="fill-textMuted font-mono" style={{ fontSize: 8 }}>
                  +{fmtUsd(maxAbs).replace('$', '$')}
                </text>
                <text x={width - 4} y={plotHeight - 3} textAnchor="end" className="fill-textMuted font-mono" style={{ fontSize: 8 }}>
                  -{fmtUsd(maxAbs)}
                </text>
              </>
            )}

            {rule !== null && (
              <line x1={rule} x2={rule} y1={12} y2={plotHeight} stroke={SPOT} strokeOpacity={0.45} strokeDasharray="2 3" />
            )}

            {bars.map((b, i) => {
              const share = maxAbs > 0 ? Math.abs(b.value) / maxAbs : 0;
              return (
                <rect
                  key={b.strike}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={1.5}
                  fill={`url(#${uid}-${b.positive ? 'up' : 'dn'})`}
                  /* Opacity is the bar's SHARE of the max — a whisper stays a
                     whisper even after the gradient, and the supreme glows. */
                  fillOpacity={0.45 + 0.55 * share}
                  stroke={hover === i ? 'rgba(255,255,255,0.5)' : 'none'}
                  strokeWidth={hover === i ? 1 : 0}
                >
                  <title>{`${b.strike} · ${fmtUsd(b.value)}`}</title>
                </rect>
              );
            })}

            {/* The two extremes, named at the tip. */}
            {topPos && topPos.h > 3 && (
              <text
                x={clampLabelX(topPos.x + topPos.w / 2)}
                y={Math.max(9, topPos.y - 3)}
                textAnchor="middle"
                fill={BULL}
                className="font-mono"
                style={{ fontSize: 8, fontWeight: 600 }}
              >
                {fmtUsd(topPos.value)}
              </text>
            )}
            {topNeg && topNeg.h > 3 && (
              <text
                x={clampLabelX(topNeg.x + topNeg.w / 2)}
                y={Math.min(plotHeight - 2, topNeg.y + topNeg.h + 9)}
                textAnchor="middle"
                fill={PUT_WALL}
                className="font-mono"
                style={{ fontSize: 8, fontWeight: 600 }}
              >
                {fmtUsd(topNeg.value)}
              </text>
            )}

            {/* Spot wears the house tag, on its own rule. */}
            {rule !== null && (
              <g>
                <rect
                  x={Math.min(width - 46, Math.max(2, rule - 22))}
                  y={1}
                  width={44}
                  height={11}
                  rx={2.5}
                  fill="rgba(13,14,17,0.92)"
                  stroke="rgba(255,255,255,0.14)"
                />
                <text
                  x={Math.min(width - 24, Math.max(24, rule))}
                  y={9.5}
                  textAnchor="middle"
                  className="fill-textPrimary font-mono"
                  style={{ fontSize: 8, fontWeight: 600 }}
                >
                  {data.levels.spot.toFixed(2)}
                </text>
              </g>
            )}

            {/* The axis: every strideth strike in silver — and the strikes
                that are SOMEBODY (supreme, walls) always, in their own inks. */}
            {bars.map((b, i) => {
              const who = nameFor(b.strike);
              if (!who && i % stride !== 0) return null;
              return (
                <text
                  key={`t${b.strike}`}
                  x={b.x + b.w / 2}
                  y={plotHeight + AXIS_H - 3}
                  textAnchor="middle"
                  fill={who ? who.ink : undefined}
                  className={who ? 'font-mono' : 'fill-textMuted font-mono'}
                  style={{ fontSize: 9, fontWeight: who ? 700 : 400 }}
                >
                  {b.strike}
                </text>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};

export default StrikeExposureBand;
