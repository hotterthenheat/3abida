/*
==================================================
  SLAYER TERMINAL - THE SHAPE OF A TRADE, DRAWN
  (components/review/TradeShape.tsx)

  The hexagon (Noah, 2026-09-29: "a cooler hexogram"
  in place of "While you held it"): six axes, one
  polygon for the trade in its own ink — the bull's
  for a win, the bear's for a loss — and the reader's
  USUAL shape behind it in a silver hairline, so the
  trade reads against their own habit. A drawn scale
  is never a still picture: the polygon grows out of
  the centre when the page lands on a trade, the axis
  under the pointer lights with its vertex, and the
  house's pointer card says the axis's figure, its
  sentence, and the usual beside it. Every colour is
  a token, so the figure is part of the page on paper.
==================================================
*/

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PointerFollowCard, CardRow } from '../ui/PointerCard';
import { pct } from './words';
import { SHAPE_ASKS, SHAPE_LABEL, type TradeShape as Shape } from '../../data/review/shape';

const W = 380;
const H = 300;
const CX = 190;
const CY = 150;
const R = 100;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const SANS = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** The i-th axis's angle — the first straight up, then clockwise */
const angleOf = (i: number) => ((-90 + i * 60) * Math.PI) / 180;
const pointAt = (i: number, v: number) => ({ x: CX + Math.cos(angleOf(i)) * R * v, y: CY + Math.sin(angleOf(i)) * R * v });
const polygonOf = (vs: number[]) =>
  vs
    .map((v, i) => {
      const p = pointAt(i, v);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
const ring = (k: number) => polygonOf([k, k, k, k, k, k]);
/** Where an axis's two-line label stands, off the ring's end */
const labelAt = (i: number) => {
  const p = pointAt(i, 1);
  const dx = Math.cos(angleOf(i));
  if (Math.abs(dx) < 0.2) return p.y < CY ? { x: p.x, y1: p.y - 22, y2: p.y - 9, anchor: 'middle' as const } : { x: p.x, y1: p.y + 19, y2: p.y + 32, anchor: 'middle' as const };
  return dx > 0 ? { x: p.x + 11, y1: p.y - 2, y2: p.y + 11, anchor: 'start' as const } : { x: p.x - 11, y1: p.y - 2, y2: p.y + 11, anchor: 'end' as const };
};

interface Props {
  shape: Shape;
  /** The reader's usual, six shares — or nothing to hold it against */
  usual: number[] | null;
  /** The trade's ink: a win, a loss, or flat */
  ink: 'bull' | 'bear' | 'flat';
  /** A new trade re-draws the polygon from the centre */
  rowKey: string;
}

const TradeShapeFigure = ({ shape, usual, ink, rowKey }: Props) => {
  const [hot, setHot] = useState<number | null>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  /* THE DRAW-IN: the polygon grows out of the centre on the house curve when a trade lands */
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setDrawn(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [rowKey]);
  const INK = ink === 'bull' ? 'rgb(var(--bull))' : ink === 'bear' ? 'rgb(var(--bear))' : 'rgb(var(--text-secondary))';
  const vs = shape.axes.map(a => a.value);

  /* the axis under the pointer: by angle from the centre, anywhere within the figure's reach */
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W - CX;
    const y = ((e.clientY - r.top) / r.height) * H - CY;
    if (Math.hypot(x, y) > R + 44) {
      if (hot != null) setHot(null);
      return;
    }
    let a = (Math.atan2(y, x) * 180) / Math.PI + 90;
    a = ((a % 360) + 360) % 360;
    const i = Math.round(a / 60) % 6;
    if (i !== hot) {
      setHot(i);
      setAt({ x: e.clientX, y: e.clientY });
    }
  };
  const axis = hot != null ? shape.axes[hot] : null;

  return (
    <div className="relative select-none" data-trade-shape={ink} data-shape-hot={axis?.key}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" onPointerMove={onMove} onPointerLeave={() => setHot(null)} role="img" aria-label="The shape of the trade: kept, heat, result, entry, plan and words, each from nothing to whole">
        {/* THE WEB — three rings and six spokes, hairlines */}
        {[1 / 3, 2 / 3, 1].map(k => (
          <polygon key={k} points={ring(k)} fill={k === 1 ? 'rgb(var(--ink))' : 'none'} fillOpacity={0.025} stroke="rgb(var(--ink))" strokeOpacity={k === 1 ? 0.16 : 0.09} strokeWidth={1} />
        ))}
        {vs.map((_, i) => {
          const p = pointAt(i, 1);
          const on = hot === i;
          return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={on ? INK : 'rgb(var(--ink))'} strokeOpacity={on ? 0.55 : 0.09} strokeWidth={1} style={{ transition: 'stroke-opacity 160ms ease-out' }} />;
        })}
        {/* THE USUAL, behind — the reader's habit in a silver hairline */}
        {usual && <polygon points={polygonOf(usual)} fill="rgb(var(--silver))" fillOpacity={0.06} stroke="rgb(var(--silver))" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 3" strokeLinejoin="round" data-shape-usual={usual.map(v => v.toFixed(2)).join(' ')} />}
        {/* THIS TRADE — grows out of the centre */}
        <g style={{ transformOrigin: `${CX}px ${CY}px`, transform: drawn ? 'scale(1)' : 'scale(0.1)', opacity: drawn ? 1 : 0, transition: 'transform 640ms cubic-bezier(0.16, 1, 0.3, 1), opacity 360ms ease-out' }} data-shape-drawn={drawn || undefined}>
          {/* a soft glow under the edge, then the edge */}
          <polygon points={polygonOf(vs)} fill="none" stroke={INK} strokeOpacity={0.14} strokeWidth={7} strokeLinejoin="round" />
          <polygon points={polygonOf(vs)} fill={INK} fillOpacity={0.16} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
          {vs.map((v, i) => {
            const p = pointAt(i, v);
            const on = hot === i;
            return <circle key={i} cx={p.x} cy={p.y} r={on ? 5 : 3} fill={on ? INK : 'rgb(var(--panel))'} stroke={INK} strokeWidth={1.5} style={{ transition: 'r 160ms ease-out' }} />;
          })}
        </g>
        {/* THE NAMES and their figures, off each ring's end */}
        {shape.axes.map((a, i) => {
          const l = labelAt(i);
          const on = hot === i;
          return (
            <g key={a.key} data-shape-axis={a.key} data-shape-value={a.value.toFixed(2)}>
              <text x={l.x} y={l.y1} textAnchor={l.anchor} fontSize={10} fontFamily={SANS} fill={on ? 'rgb(var(--text-primary))' : 'rgb(var(--text-secondary))'} style={{ transition: 'fill 160ms ease-out' }}>
                {SHAPE_LABEL[a.key]}
              </text>
              <text x={l.x} y={l.y2} textAnchor={l.anchor} fontSize={10.5} fontWeight={600} fontFamily={MONO} fill="rgb(var(--text-primary))">
                {a.figure}
              </text>
            </g>
          );
        })}
      </svg>
      {axis && at && (
        /* the ask is a whole sentence: it goes under the rows, wrapping — the head's aside never wraps and ran out of the card */
        <PointerFollowCard start={at} width={236} title={SHAPE_LABEL[axis.key]} testId="data-shape-card" testValue={axis.key}>
          <CardRow k="this trade" v={pct(axis.value)} sub={axis.figure !== pct(axis.value) ? axis.figure : undefined} />
          {usual && hot != null && <CardRow k="your usual" v={pct(usual[hot])} ink="rgb(var(--silver))" />}
          <span className="col-span-2 text-[10px] leading-snug text-textSecondary whitespace-normal">{axis.words}</span>
          <span className="col-span-2 text-[9.5px] leading-snug text-textMuted whitespace-normal">{SHAPE_ASKS[axis.key]}</span>
        </PointerFollowCard>
      )}
    </div>
  );
};

export default TradeShapeFigure;
