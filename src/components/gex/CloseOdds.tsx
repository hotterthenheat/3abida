/*
==================================================
  SLAYER TERMINAL - WHERE IT CLOSES
  (components/gex/CloseOdds.tsx)

  Band 2 of the Ahead page, redrawn (2026-09-09,
  Noah: the range above "gives a rough estimate…
  in a nice and distinct way, then we get to where
  it closes and the design just isn't it"). The
  first cut was a list of twenty strike rows with a
  bar each. This is a DRAWING in the range's own
  hand, on the same price axis, in the same margins,
  so the two boxes read as one story — the range
  says where price can go by the bell, this says
  where on that ruler the close lands:

    THE BANDS      two runs of strikes around the
                   likeliest, shaded like the
                   range's bands — a 50% chance it
                   closes inside the silver one, an
                   80% chance inside the fainter one
                   (said as odds since 2026-09-09:
                   "half the time" and "four times
                   in five" made no sense to Noah)
    THE SHAPE      the odds as one silhouette
                   hugging the axis, a bulge at
                   every strike the book pulls the
                   close toward; the dashed outline
                   behind it is the expected move
                   alone, so the strikes' pull is
                   the gap between the two
    THE STRIKES    the likeliest lit silver with its
                   odds, the next two figured, the
                   walls, the flip and the pin as
                   the same dashed hairlines the
                   range draws, named at the left

  Hover a strike and the read line speaks it; click
  keeps it as the shared strike. Under it THE READS:
  three labelled lines — most likely · the bands ·
  the pull — where one paragraph used to run
  (Noah, 2026-09-09: "not intuitive at all in terms
  of readability and understanding").
==================================================
*/

import { Fragment, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';

/** A read with every figure lit — the strikes and the odds in the primary ink, the words around them quiet */
const lit = (text: string): ReactNode[] =>
  text.split(/(\d[\d.,]*%?)/).map((part, i) =>
    /^\d[\d.,]*%?$/.test(part) ? (
      <span key={i} className="font-mono tnum text-textPrimary">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
import { CloseGuide } from './AheadGuide';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';
import { fmtPrice, fmtStrike, type AheadClock, type CloseOdds as CloseOddsData } from '../../data/ahead';
import type { ExposureLevels } from '../../types/gex';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';
/* The range's own geometry: the same width and margins, so the two price axes sit on one line */
const W = 1200;
const M = { l: 12, r: 74 };
const H = 300;
const PM = { t: 20, b: 14 };
/** How much of the width the silhouette may take — the level names live at the left */
const SPAN = 0.6;
const PIN_INK = '#8a909c';

const niceStep = (range: number): number => {
  const steps = [0.1, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  const want = range / 9;
  return steps.find(s => s >= want) ?? steps[steps.length - 1];
};
const untilWords = (clock: AheadClock) => {
  if (!clock.inSession) return 'a full session';
  const h = Math.floor(clock.minutesLeft / 60);
  const m = clock.minutesLeft % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};
interface Props {
  odds: CloseOddsData;
  spot: number;
  ticker: string;
  clock: AheadClock;
  /** The day's levels — the same hairlines the range draws. Omitted, the rows' own roles name them. */
  levels?: ExposureLevels;
  /** Strikes you hold contracts on — marked at the axis */
  yours?: Set<number>;
  focus?: number | null;
  onPick?: (price: number) => void;
  scope?: ReactNode;
  /** On a desk tile the tile head names the box — only the door and the facts stay (2026-09-08) */
  headless?: boolean;
}

const CloseOdds = ({ odds, spot, ticker, clock, levels, yours, focus, onPick, scope, headless = false }: Props) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { rows, top, gravity, half, most } = odds;
  const pullWords = gravity < 0.5 ? 'light' : gravity < 0.75 ? 'building' : 'strong';

  /* THE GEOMETRY — the strikes on the price axis, the odds growing left from it */
  const asc = useMemo(() => [...rows].sort((a, b) => a.strike - b.strike), [rows]);
  const step = asc.length > 1 ? Math.abs(asc[1].strike - asc[0].strike) || 1 : 1;
  const { lo, hi } = useMemo(() => {
    if (!asc.length) return { lo: spot - 1, hi: spot + 1 };
    let lo = asc[0].strike - step / 2;
    let hi = asc[asc.length - 1].strike + step / 2;
    lo = Math.min(lo, spot - step / 2);
    hi = Math.max(hi, spot + step / 2);
    const pad = (hi - lo) * 0.03;
    return { lo: lo - pad, hi: hi + pad };
  }, [asc, spot, step]);
  const ih = H - PM.t - PM.b;
  const y = (p: number) => PM.t + (1 - (p - lo) / (hi - lo)) * ih;
  const axisX = W - M.r;
  const span = (axisX - M.l) * SPAN;
  const maxOdds = Math.max(1, ...rows.map(r => r.odds), ...rows.map(r => r.plain));
  const xOf = (v: number) => axisX - (v / maxOdds) * span;
  /* The silhouette: a STEPPED profile, one step per strike the height of its
     row, hugging the axis — the volume profile's grammar. A smoothed curve
     turned a one-point lead into a needle and hid the shape inside the band;
     steps say exactly what each strike holds (2026-09-09). */
  const pitch = (step / (hi - lo)) * ih;
  const shapeOf = (pick: (r: (typeof asc)[number]) => number, closed: boolean) => {
    if (!asc.length) return '';
    const desc = [...asc].reverse();
    let d = `M${axisX},${(y(desc[0].strike) - pitch / 2).toFixed(1)}`;
    for (const r of desc) {
      const x = xOf(pick(r)).toFixed(1);
      d += ` L${x},${(y(r.strike) - pitch / 2).toFixed(1)} L${x},${(y(r.strike) + pitch / 2).toFixed(1)}`;
    }
    d += ` L${axisX},${(y(desc[desc.length - 1].strike) + pitch / 2).toFixed(1)}`;
    return closed ? `${d} Z` : d;
  };
  const pulledD = shapeOf(r => r.odds, true);
  const plainD = shapeOf(r => r.plain, false);
  const rank = new Map(top.map((t, i) => [t.strike, i]));
  const lead = top[0];
  /* The next two are figured only when their label has room of its own */
  const figured = top.filter((t, i) => i === 0 || top.slice(0, i).every(o => Math.abs(y(o.strike) - y(t.strike)) >= 12));

  /* The levels that shape it — the range's hairlines, named at the left end */
  const named = useMemo(() => {
    const out: { price: number; name: string; ink: string }[] = [];
    if (levels) {
      out.push({ price: levels.callWall, name: 'call wall', ink: CALL_WALL }, { price: levels.putWall, name: 'put wall', ink: PUT_WALL }, { price: levels.flip, name: 'flip', ink: FLIP });
      if (![levels.callWall, levels.putWall].some(k => Math.abs(k - levels.supreme) < 1e-9)) out.push({ price: levels.supreme, name: 'supreme', ink: SUPREME });
      if (![levels.callWall, levels.putWall, levels.supreme].some(k => Math.abs(k - levels.pin) < 1e-9)) out.push({ price: levels.pin, name: 'pin', ink: PIN_INK });
    } else {
      for (const r of rows) if (r.role) out.push({ price: r.strike, name: r.role, ink: r.role === 'call wall' ? CALL_WALL : r.role === 'put wall' ? PUT_WALL : r.role === 'supreme' ? SUPREME : PIN_INK });
    }
    return out.filter(l => l.price > lo && l.price < hi);
  }, [levels, rows, lo, hi]);
  /* Every word at the left end — the levels' names and the bands' — in one
     stack pushed apart, so nothing prints over anything */
  const tags = [
    ...named.map(l => ({ name: l.name, ty: y(l.price) - 4 })),
    ...(most.strikes ? [{ name: 'most', ty: y(most.high + step / 2) - 4 }] : []),
    ...(half.strikes ? [{ name: 'half', ty: y(half.high + step / 2) - 4 }] : []),
  ].sort((a, b) => a.ty - b.ty);
  for (let i = 1; i < tags.length; i++) if (tags[i].ty - tags[i - 1].ty < 11) tags[i].ty = tags[i - 1].ty + 11;
  const tagY = (name: string) => tags.find(t => t.name === name)?.ty ?? 0;

  /* The axis: regular ticks, giving way to the readouts */
  const tick = niceStep(hi - lo);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / tick) * tick; v <= hi; v += tick) ticks.push(Number(v.toFixed(4)));
  const hoverRow = hover != null ? rows.find(r => Math.abs(r.strike - hover) < 1e-9) ?? null : null;
  const keptRow = focus != null ? rows.find(r => Math.abs(r.strike - focus) < 1e-9) ?? null : null;
  const readouts = [{ y: y(spot) }, ...(hoverRow ? [{ y: y(hoverRow.strike) }] : []), ...(lead ? [{ y: y(lead.strike) }] : [])];
  const tickShown = (v: number) => readouts.every(r => Math.abs(r.y - y(v)) > 9);
  const rightX = axisX + 6;

  /* The pointer → the nearest strike by height */
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !asc.length) return;
    const r = svg.getBoundingClientRect();
    const py = ((e.clientY - r.top) / r.height) * H;
    let best: number | null = null;
    let bestD = Infinity;
    for (const row of asc) {
      const d = Math.abs(y(row.strike) - py);
      if (d < bestD) {
        bestD = d;
        best = row.strike;
      }
    }
    if (best != null && bestD <= 14) {
      if (hover !== best) setHover(best);
    } else if (hover != null) setHover(null);
  };
  const readRow = hoverRow ?? keptRow;
  const readLine = readRow
    ? `${fmtStrike(readRow.strike)} · a ${readRow.odds.toFixed(readRow.odds >= 10 ? 0 : 1)}% chance the close lands here · the expected move alone says ${readRow.plain.toFixed(1)}% · the strikes ${readRow.pull > 1.02 ? 'pull the close toward it' : readRow.pull < 0.98 ? 'push the close off it' : 'leave it alone'}${readRow.role ? ` · ${readRow.role}` : ''}${yours?.has(readRow.strike) ? ' · you own contracts here' : ''}${hoverRow ? (focus === readRow.strike ? ' · kept, click to let go' : ' · click to keep') : ' · kept'}`
    : 'hover a strike · each step is one strike, its length the chance the close lands there · the dashed outline is the expected move alone';

  return (
    <section className="relative flex flex-col min-w-0" data-close-band>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the odds" testId="close-guide" viewport>
        <CloseGuide odds={odds} spot={spot} clock={clock} />
      </GuideFocus>
      <div className={`${headless ? 'px-4 pt-3 pb-1' : 'px-5 pt-4 pb-2'} flex items-start gap-6 flex-wrap`}>
        {headless ? (
          <div className="shrink-0 h-[35px] flex items-center">
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the bands, the silhouette and the outline mean" testId="close-guide" />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Where it closes</h3>
              {scope}
              <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the bands, the silhouette and the outline mean" testId="close-guide" />
            </div>
            <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Where on the range's ruler the 4:00 print lands · the profile is the odds, the dashed outline the expected move alone</p>
          </div>
        )}
        <dl className={`grid grid-cols-4 gap-x-6 ${headless ? 'ml-auto' : ''}`}>
          <div>
            <dt className="text-[10px] text-textMuted">Most likely</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: SILVER }} data-close-top>
              {lead ? `${fmtStrike(lead.strike)} · ${lead.odds.toFixed(0)}%` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">50% chance</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-close-half>
              {half.strikes ? `${fmtStrike(half.low)} – ${fmtStrike(half.high)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">80% chance</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-close-most>
              {most.strikes ? `${fmtStrike(most.low)} – ${fmtStrike(most.high)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">The strikes' pull</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-close-pull>
              {pullWords} <span className="text-textMuted">· {Math.round(gravity * 100)}% · {untilWords(clock)} left</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* THE DRAWING */}
      <div className="relative px-3" onPointerLeave={() => setHover(null)}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="The odds the close lands on each strike, as a silhouette on the price axis, with the bands it most often lands inside" onPointerMove={onMove} onClick={() => hover != null && onPick?.(hover)} style={{ cursor: onPick && hover != null ? 'pointer' : undefined }} data-close-svg>
          {/* the price grid */}
          {ticks.map(v => (
            <g key={v}>
              <line x1={M.l} x2={axisX} y1={y(v)} y2={y(v)} stroke="#ffffff" strokeOpacity={0.05} />
              {tickShown(v) && (
                <text x={rightX} y={y(v) + 3} fontSize={9} fill="#7c8290" fontFamily={MONO} data-axis-tick>
                  {fmtStrike(v)}
                </text>
              )}
            </g>
          ))}
          {/* THE BANDS — the 80% band faint, the 50% band silver, the range's own two shades */}
          {most.strikes > 0 && (
            <g data-close-band-most>
              <rect x={M.l} y={y(most.high + step / 2)} width={axisX - M.l} height={Math.max(1, y(most.low - step / 2) - y(most.high + step / 2))} fill="#ffffff" fillOpacity={0.025} />
              <line x1={M.l} x2={axisX} y1={y(most.high + step / 2)} y2={y(most.high + step / 2)} stroke="#ffffff" strokeOpacity={0.14} strokeDasharray="2 4" />
              <line x1={M.l} x2={axisX} y1={y(most.low - step / 2)} y2={y(most.low - step / 2)} stroke="#ffffff" strokeOpacity={0.14} strokeDasharray="2 4" />
              <text x={M.l + 6} y={tagY('most')} fontSize={9} fill="#8a909c" fontFamily={SANS}>
                80% chance · {fmtStrike(most.low)} – {fmtStrike(most.high)}
              </text>
            </g>
          )}
          {half.strikes > 0 && (
            <g data-close-band-half>
              <rect x={M.l} y={y(half.high + step / 2)} width={axisX - M.l} height={Math.max(1, y(half.low - step / 2) - y(half.high + step / 2))} fill={SILVER} fillOpacity={0.05} />
              <line x1={M.l} x2={axisX} y1={y(half.high + step / 2)} y2={y(half.high + step / 2)} stroke={SILVER} strokeOpacity={0.5} />
              <line x1={M.l} x2={axisX} y1={y(half.low - step / 2)} y2={y(half.low - step / 2)} stroke={SILVER} strokeOpacity={0.5} />
              <text x={M.l + 6} y={tagY('half')} fontSize={9} fontWeight={500} fill={SILVER} fillOpacity={0.95} fontFamily={SANS}>
                50% chance · {fmtStrike(half.low)} – {fmtStrike(half.high)}
              </text>
            </g>
          )}
          {/* the levels that shape it — the range's hairlines, named at the left end */}
          {named.map(l => (
            <g key={l.name} onClick={e => { e.stopPropagation(); onPick?.(l.price); }} style={{ cursor: onPick ? 'pointer' : undefined }} data-level={l.name}>
              <line x1={M.l} x2={axisX} y1={y(l.price)} y2={y(l.price)} stroke={l.ink} strokeOpacity={focus === l.price ? 0.9 : 0.4} strokeWidth={1} strokeDasharray="3 4" />
              <text x={M.l + 6} y={tagY(l.name)} fontSize={9} fontWeight={500} fill={l.ink} fillOpacity={0.9} fontFamily={SANS} data-level-label>
                {l.name} {fmtStrike(l.price)}
              </text>
            </g>
          ))}
          {/* the expected move alone, as a dashed outline; the odds as the silhouette over it */}
          {pulledD && <path d={pulledD} fill={SILVER} fillOpacity={0.26} stroke={SILVER} strokeOpacity={0.85} strokeWidth={1} strokeLinejoin="round" data-close-shape />}
          {plainD && <path d={plainD} fill="none" stroke="#ffffff" strokeOpacity={0.38} strokeWidth={1} strokeDasharray="3 3" strokeLinejoin="round" data-close-plain />}
          {/* the likeliest, its whole step lit, and the next two figured when they have room */}
          {figured.map(t => {
            const isLead = t === lead;
            const xe = xOf(t.odds);
            return (
              <g key={t.strike} data-close-top-strike={rank.get(t.strike)}>
                {isLead && <rect x={xe} y={y(t.strike) - pitch / 2 + 1} width={axisX - xe} height={Math.max(2, pitch - 2)} fill={SILVER} fillOpacity={0.9} />}
                <text x={xe - 8} y={y(t.strike) + 3.5} textAnchor="end" fontSize={isLead ? 10.5 : 9} fontWeight={isLead ? 700 : 500} fill={isLead ? SILVER : 'rgb(var(--text-primary))'} fontFamily={MONO}>
                  {fmtStrike(t.strike)} · {t.odds.toFixed(0)}%
                </text>
              </g>
            );
          })}
          {/* spot: the same dotted hairline and readout the range draws */}
          <line x1={M.l} x2={axisX} y1={y(spot)} y2={y(spot)} stroke="#ededed" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="1.5 3" />
          <text x={rightX} y={y(spot) + 3.5} fontSize={9.5} fontWeight={600} fill="#ededed" fontFamily={MONO} data-close-spot>
            {fmtPrice(spot)}
          </text>
          {/* the likeliest on the axis too — unless spot's readout already sits there */}
          {lead && Math.abs(y(lead.strike) - y(spot)) >= 10 && (
            <text x={rightX} y={y(lead.strike) + 3.5} fontSize={9.5} fontWeight={700} fill={SILVER} fontFamily={MONO} data-close-lead-axis>
              {fmtStrike(lead.strike)}
            </text>
          )}
          {/* your strikes, at the axis */}
          {yours && asc.filter(r => yours.has(r.strike)).map(r => <rect key={`y-${r.strike}`} x={axisX - 3} y={y(r.strike) - 3} width={6} height={6} rx={1} fill={SILVER} data-yours />)}
          {/* the kept strike and the pointer */}
          {keptRow && !hoverRow && <line x1={M.l} x2={axisX} y1={y(keptRow.strike)} y2={y(keptRow.strike)} stroke={SILVER} strokeOpacity={0.7} strokeWidth={1} />}
          {hoverRow && (
            <g data-close-cursor>
              <line x1={M.l} x2={axisX} y1={y(hoverRow.strike)} y2={y(hoverRow.strike)} stroke={SILVER} strokeOpacity={0.45} strokeWidth={1} />
              <circle cx={xOf(hoverRow.odds)} cy={y(hoverRow.strike)} r={3} fill="#0e0e0f" stroke={SILVER} strokeWidth={1.5} />
              {rank.get(hoverRow.strike) == null && (
                <text x={xOf(hoverRow.odds) - 8} y={y(hoverRow.strike) + 3.5} textAnchor="end" fontSize={9} fill={SILVER} fontFamily={MONO}>
                  {fmtStrike(hoverRow.strike)} · {hoverRow.odds.toFixed(hoverRow.odds >= 10 ? 0 : 1)}%
                </text>
              )}
              {(!lead || Math.abs(lead.strike - hoverRow.strike) > 1e-9) && (
                <text x={rightX} y={y(hoverRow.strike) + 3.5} fontSize={9.5} fontWeight={600} fill={SILVER} fontFamily={MONO}>
                  {fmtStrike(hoverRow.strike)}
                </text>
              )}
            </g>
          )}
        </svg>
      </div>
      {/* ONE FIXED READ LINE */}
      <div className="px-5 h-[18px] font-mono text-[10px] text-textSecondary truncate" data-close-read>
        {readLine}
      </div>
      {/* THE READS — one line each, the figures lit, where one paragraph ran */}
      {odds.reads ? (
        <dl className="px-5 pb-4 pt-2 grid gap-x-4 gap-y-1.5 text-[12px] leading-[17px] text-textSecondary" style={{ gridTemplateColumns: '84px minmax(0, 1fr)' }} data-close-reads>
          {(
            [
              ['Most likely', odds.reads.likely, 'likely'],
              ['The bands', odds.reads.bands, 'bands'],
              ['The pull', odds.reads.pull, 'pull'],
            ] as const
          ).map(([label, words, key]) => (
            <Fragment key={key}>
              <dt className="text-[10px] text-textMuted leading-[17px] whitespace-nowrap">{label}</dt>
              <dd className="min-w-0" data-close-read-line={key}>
                {lit(words)}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <p className="px-5 pb-4 pt-2 text-[12px] leading-[17px] text-textSecondary" data-close-reads>
          {odds.sentence}
        </p>
      )}
    </section>
  );
};

export default CloseOdds;
