/*
==================================================
  SLAYER TERMINAL - WHERE THE WALLS ARE HEADING
  (components/gex/WallHeading.tsx)

  Box 2 of the Building page. First cut was a table
  (level · at the open · now · by the close · words)
  — Noah, 2026-09-07: "i dont like how the bottom
  card looks at all… its generic". Now it is a
  DRAWING on the strike axis, ONE ROW PER LEVEL:

    ── the row's track, spot dotted through every
       row so the four levels read against price
    ○  where it stood at the open (hollow)
    ●  where it is now (filled, the row's ink)
    ◌  where today's pace puts it by the close
       (dashed ring, an arrow at the end when it
       moves)
    ◍  the strike growing fastest on that side,
       tied to the wall by a hairline — the wall
       a day early

  A row per level is what keeps it readable: the
  four levels sit within a few strikes of each
  other near spot, and one shared lane stacked
  their labels on top of one another (measured on
  the first cut). The axis spans only the ground
  the levels actually cover. One fixed read line
  above the drawing speaks for the level under the
  pointer.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import { HeadingGuide } from './BuildingGuide';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';
import { HEADING_AXIS_H, HEADING_M, HEADING_ORDER, HEADING_ROW_H, HEADING_TOP, HEADING_W } from './buildingSkeletons';
import { fmtStrike, type AheadClock } from '../../data/ahead';
import type { Building, WallHeading as Level } from '../../data/building';

const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';
const NAME_INK: Record<Level['name'], string> = { 'Call wall': CALL_WALL, 'Put wall': PUT_WALL, Supreme: SUPREME, Flip: FLIP };
/* The geometry is the skeleton's own (buildingSkeletons.tsx), so the two cannot drift */
const ORDER: readonly Level['name'][] = HEADING_ORDER;
const W0 = HEADING_W;
const M = HEADING_M;
const TOP = HEADING_TOP;
const ROW_H = HEADING_ROW_H;
const AXIS_H = HEADING_AXIS_H;

/** A round tick step for the axis */
const niceStep = (raw: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};

/** One mark in the key, drawn the way the row draws it */
const Key = ({ kind, children }: { kind: 'open' | 'now' | 'close' | 'challenger'; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
    <svg width={12} height={12} aria-hidden>
      {kind === 'now' ? (
        <circle cx={6} cy={6} r={4} fill="#8a909c" />
      ) : kind === 'close' ? (
        <circle cx={6} cy={6} r={4} fill="#0a0a0a" stroke="#8a909c" strokeWidth={1.25} strokeDasharray="2.2 2.2" />
      ) : kind === 'challenger' ? (
        <rect x={2.6} y={2.6} width={6.8} height={6.8} transform="rotate(45 6 6)" fill="#0a0a0a" stroke="#8a909c" strokeWidth={1.25} />
      ) : (
        <circle cx={6} cy={6} r={3} fill="none" stroke="#8a909c" strokeWidth={1.25} />
      )}
    </svg>
    {children}
  </span>
);

interface Props {
  data: Building;
  clock: AheadClock;
  scope?: ReactNode;
  /** On a desk tile the tile head names the box — only the door stays (2026-09-08) */
  headless?: boolean;
  /** Fill the box: the rows spread to the height on hand instead of the drawing's
      fixed aspect (Noah, 2026-09-08: the tile "does not take up the full sizing
      of the box"). The labels keep their size; only the lanes open up. */
  fill?: boolean;
}

const WallHeading = ({ data, clock, scope, headless = false, fill = false }: Props) => {
  const [hover, setHover] = useState<Level['name'] | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!fill) return;
    const el = boxRef.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);
  const { heading, spot, rows } = data;
  const levels = ORDER.map(n => heading.find(l => l.name === n)).filter((l): l is Level => !!l);
  /* In fill mode the viewBox IS the box, pixel for pixel: the rows spread to
     the height on hand and the labels print at their own size, never scaled
     down by a 1200-wide drawing in a 640-wide tile */
  const W = fill && box.w > 0 ? box.w : W0;
  const rowH = fill && box.h > 0 && levels.length ? Math.max(ROW_H, (box.h - TOP - AXIS_H) / levels.length) : ROW_H;
  const H = TOP + levels.length * rowH + AXIS_H;

  /* The axis covers the ground the levels actually cover, never the whole
     window — the four of them live within a few strikes of spot, and a full
     window axis draws one cluster in a field of nothing. */
  const { lo, hi } = useMemo(() => {
    const ks: number[] = [spot];
    for (const l of levels) {
      for (const v of [l.open, l.now, l.close]) if (v != null) ks.push(v);
      if (l.challenger) ks.push(l.challenger.strike);
    }
    const min = Math.min(...ks);
    const max = Math.max(...ks);
    /* Never tighter than a handful of strikes, or two levels a tick apart fill the box */
    const stepGuess = rows.length > 1 ? Math.abs(rows[0].strike - rows[1].strike) : 1;
    const span = Math.max(max - min, stepGuess * 6);
    const mid = (min + max) / 2;
    const pad = span * 0.12;
    return { lo: mid - span / 2 - pad, hi: mid + span / 2 + pad };
  }, [levels, spot, rows]);
  const x = (k: number) => M.l + ((k - lo) / (hi - lo || 1)) * (W - M.l - M.r);
  const step = niceStep((hi - lo) / 8);
  const ticks: number[] = [];
  for (let k = Math.ceil(lo / step) * step; k <= hi + 1e-9; k += step) ticks.push(Number(k.toFixed(4)));

  const read = levels.find(l => l.name === hover) ?? levels[0] ?? null;
  const rowY = (i: number) => TOP + i * rowH + rowH / 2;

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const py = ((e.clientY - r.top) / r.height) * H;
    const i = Math.floor((py - TOP) / rowH);
    setHover(i >= 0 && i < levels.length ? levels[i].name : null);
  };

  return (
    <section className={`relative flex flex-col min-w-0 ${fill ? 'h-full' : ''}`} data-heading-band>
      {/* Its own door (Noah, 2026-09-08): the drawing is explained here, on the box it explains */}
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read where the walls are heading" testId="heading-guide" viewport>
        <HeadingGuide data={data} clock={clock} />
      </GuideFocus>
      <div className={`${headless ? 'px-4 pt-2 pb-1' : 'px-5 pt-4 pb-2'} flex items-start gap-6 flex-wrap`}>
        {headless ? (
          <div className="shrink-0 h-6 flex items-center">
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the dots, the rings and the diamonds mean" testId="heading-guide" />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Where the walls are heading</h3>
              {scope}
              <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the dots, the rings and the diamonds mean" testId="heading-guide" />
            </div>
            <p className="mt-0.5 text-[11px] text-textMuted">
              Each level on the strike axis: where it stood at the open, where it is now, and where {clock.inSession ? "today's pace puts it by the close" : "the last session's pace puts it next session"} · a straight line, not a forecast
            </p>
          </div>
        )}
      </div>

      {/* THE READ LINE — one fixed line for the level under the pointer */}
      <div className="mx-5 px-3 py-2 border-y border-borderSubtle/60 font-mono text-[11px] leading-snug select-none min-h-[34px] flex items-center gap-2" data-heading-read>
        {read ? (
          <>
            <span className="text-[8px] uppercase tracking-widest shrink-0" style={{ color: NAME_INK[read.name] }}>
              {read.name}
            </span>
            <span className="text-textSecondary">{read.words}</span>
          </>
        ) : (
          <span className="text-textMuted">no levels on this book</span>
        )}
      </div>

      {/* THE DRAWING */}
      <div className={`px-3 pt-3 pb-3 ${fill ? 'flex-1 min-h-0 flex flex-col' : ''}`} onPointerLeave={() => setHover(null)}>
        <div ref={boxRef} className={fill ? 'flex-1 min-h-0' : undefined}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={fill ? '100%' : undefined} preserveAspectRatio="xMidYMid meet" className="block" role="img" aria-label="The call wall, supreme, flip and put wall on the strike axis: where each stood at the open, where it is now, and where today's pace puts it" onPointerMove={onMove} data-heading-figure>
          <defs>
            {levels.map(l => (
              <marker key={l.name} id={`wh-arrow-${l.name.replace(/\s/g, '')}`} viewBox="0 0 8 8" refX={6.5} refY={4} markerWidth={5} markerHeight={5} orient="auto">
                <path d="M0,1 L7,4 L0,7 Z" fill={NAME_INK[l.name]} fillOpacity={0.8} />
              </marker>
            ))}
          </defs>

          {/* the axis ticks, behind everything */}
          {ticks.map(k => (
            <g key={k}>
              <line x1={x(k)} x2={x(k)} y1={TOP - 10} y2={H - AXIS_H + 2} stroke="#ffffff" strokeOpacity={0.045} />
              <text x={x(k)} y={H - 6} textAnchor="middle" fontSize={9} fill="#7c8290" fontFamily={MONO}>
                {fmtStrike(k)}
              </text>
            </g>
          ))}

          {/* spot — the dotted white rule through every row */}
          <line x1={x(spot)} x2={x(spot)} y1={TOP - 12} y2={H - AXIS_H + 2} stroke="#ededed" strokeOpacity={0.5} strokeDasharray="1 3" />
          <text x={x(spot)} y={TOP - 16} textAnchor="middle" fontSize={9} fontWeight={600} fill="#ededed" fontFamily={MONO} data-heading-spot>
            {fmtStrike(spot)}
          </text>

          {/* one row per level */}
          {levels.map((l, i) => {
            const y = rowY(i);
            const ink = NAME_INK[l.name];
            const dim = hover != null && hover !== l.name;
            const ch = l.challenger;
            const moves = l.now != null && l.close != null && l.close !== l.now;
            const moved = l.now != null && l.open != null && l.open !== l.now;
            const xs = [l.open, l.now, l.close].filter((v): v is number => v != null).map(x);
            const spanFrom = xs.length ? Math.min(...xs) : 0;
            const spanTo = xs.length ? Math.max(...xs) : 0;
            return (
              <g key={l.name} opacity={dim ? 0.32 : 1} style={{ transition: 'opacity 220ms cubic-bezier(0.16,1,0.3,1)' }} data-level={l.name}>
                {/* the row's own hairline and its name */}
                <line x1={M.l} x2={W - M.r} y1={y} y2={y} stroke="#ffffff" strokeOpacity={0.055} />
                <text x={M.l - 14} y={y + 3.5} textAnchor="end" fontSize={10.5} fontWeight={600} fill={ink} fontFamily={SANS}>
                  {l.name}
                </text>

                {l.now == null ? (
                  <text x={x((lo + hi) / 2)} y={y + 3.5} textAnchor="middle" fontSize={9.5} fill="#7d7d7d" fontFamily={SANS}>
                    none {l.name === 'Call wall' ? 'overhead' : 'underneath'} on this book
                  </text>
                ) : (
                  <>
                    {/* the challenger, tied to the wall — unless it IS where the
                        wall lands, in which case the dashed ring already says so */}
                    {ch && ch.strike !== l.close && (
                      <g data-challenger={ch.strike}>
                        <line x1={x(ch.strike)} x2={x(l.now)} y1={y} y2={y} stroke={ink} strokeOpacity={0.3} strokeDasharray="2 3" />
                        {/* a diamond, so it can never be read as the open's hollow dot */}
                        <rect x={x(ch.strike) - 3.4} y={y - 3.4} width={6.8} height={6.8} transform={`rotate(45 ${x(ch.strike)} ${y})`} fill="#0a0a0a" stroke={ink} strokeOpacity={0.75} strokeWidth={1.25} />
                        <text x={x(ch.strike)} y={y + 15} textAnchor="middle" fontSize={8.5} fill={ink} fillOpacity={0.7} fontFamily={MONO}>
                          {fmtStrike(ch.strike)}
                        </text>
                      </g>
                    )}
                    {/* the travel: open → now → close */}
                    {spanTo - spanFrom > 1 && <line x1={spanFrom} x2={spanTo} y1={y} y2={y} stroke={ink} strokeOpacity={0.35} strokeWidth={1.25} />}
                    {moves && (
                      <line
                        x1={x(l.now)}
                        x2={x(l.close!) + (l.close! > l.now ? -5 : 5)}
                        y1={y}
                        y2={y}
                        stroke={ink}
                        strokeOpacity={0.75}
                        strokeWidth={1.25}
                        strokeDasharray="3 3"
                        markerEnd={`url(#wh-arrow-${l.name.replace(/\s/g, '')})`}
                      />
                    )}
                    {/* at the open — hollow */}
                    {l.open != null && moved && <circle cx={x(l.open)} cy={y} r={3} fill="none" stroke={ink} strokeOpacity={0.65} strokeWidth={1.25} data-mark="open" />}
                    {l.open != null && moved && (
                      <text x={x(l.open)} y={y - 9} textAnchor="middle" fontSize={8.5} fill={ink} fillOpacity={0.7} fontFamily={MONO}>
                        {fmtStrike(l.open)}
                      </text>
                    )}
                    {/* by the close — a dashed ring */}
                    {moves && <circle cx={x(l.close!)} cy={y} r={4} fill="#0a0a0a" stroke={ink} strokeOpacity={0.8} strokeWidth={1.25} strokeDasharray="2.2 2.2" data-mark="close" />}
                    {moves && (
                      <text x={x(l.close!)} y={y - 10} textAnchor="middle" fontSize={9} fontWeight={600} fill={ink} fillOpacity={0.85} fontFamily={MONO}>
                        {fmtStrike(l.close!)}
                      </text>
                    )}
                    {/* now — the filled dot, always the loudest mark on the row */}
                    <circle cx={x(l.now)} cy={y} r={5} fill={ink} data-mark="now" />
                    <text x={x(l.now)} y={y - 11} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#ededed" fontFamily={MONO} data-heading-now>
                      {fmtStrike(l.now)}
                    </text>
                  </>
                )}
              </g>
            );
          })}

        </svg>
        </div>
        {/* THE KEY — its own line, so nothing sits on the axis's prices */}
        <div className="mt-1 pl-2 flex items-center gap-4 flex-wrap text-[9px] text-textMuted" data-heading-key>
          <Key kind="open">at the open</Key>
          <Key kind="now">now</Key>
          <Key kind="close">{clock.inSession ? 'by the close, at this pace' : 'next session, at this pace'}</Key>
          <Key kind="challenger">growing fastest on that side</Key>
        </div>
      </div>
    </section>
  );
};

export default WallHeading;
