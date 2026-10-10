/*
==================================================
  SLAYER TERMINAL - THE VOL VIEW (components/weigher/VolCurves.tsx)

  The Weigher chart card's third view (the ideas report,
  2026-10-09: "an IV smile for the chosen expiry beside
  an ATM-IV term line"): two small charts side by side.

    THE SMILE   IV by strike for the chain's name and
                expiry — the calls' line and the puts',
                the market's price on a hairline, the
                picked strike marked
    THE TERM    the at-the-money IV at every expiry on
                the rail, with the one-sigma move each
                prices under its point — the expiry the
                chain is on marked

  Read off the chain's own pricer (data/weigherDesk:
  the chain's rows, contractIvFor), so a figure here
  is the figure in the chain's IV column. SVG at the
  card's size, tokens for every ink, no animation.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { contractIvFor, deskExpiries, type DeskChain } from '../../data/weigherDesk';
import { FONT_SANS } from '../../theme/fonts';
import { useColourVision } from '../../theme/theme';

const CALL = 'rgb(var(--bull))';
const PUT = 'rgb(var(--bear))';
const SILVER = 'rgb(var(--silver))';
const MUTED = 'rgb(var(--text-muted))';
const INK = 'rgb(var(--text-primary))';
const GRID = 'rgb(var(--ink) / 0.07)';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

/* drawn at the box's own pixels (one unit a pixel), so its words are the sizes written here at any card width */
const H = 220;
const M = { l: 40, r: 12, t: 30, b: 34 };

interface Props {
  ticker: string;
  chain: DeskChain;
  /** The picked strike, marked on the smile */
  sel: number | null;
}

const VolCurves = ({ ticker, chain, sel }: Props) => {
  /* THE SMILE — the strikes within 12% of the market (the chain reaches far wider; the wings flatten the read) */
  const smile = useMemo(() => {
    const rows = chain.rows.filter(r => Math.abs(r.strike / chain.spot - 1) <= 0.12);
    return rows.map(r => ({ k: r.strike, c: r.call.iv, p: r.put.iv }));
  }, [chain]);
  /* THE TERM — the at-the-money contract at every expiry on the rail, priced by the chain's own vol */
  const term = useMemo(() => {
    const spot = chain.spot;
    return deskExpiries().map(e => {
      const iv = contractIvFor(ticker, spot, 'C') * 100;
      const years = Math.max(e.sessions, 0.5) / 252;
      return { e, iv, move: (iv / 100) * Math.sqrt(years) * spot };
    });
  }, [ticker, chain]);

  /* the box's width decides one column or two — the card is half a desk wide on a laptop */
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(Math.round(el.clientWidth)));
    ro.observe(el);
    setBoxW(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);
  const two = boxW >= 720;
  const figW = Math.max(240, Math.floor((two ? (boxW - 24 - 12) / 2 : boxW - 24) - 18));
  return (
    <div ref={boxRef} className={`h-full w-full overflow-auto px-3 pt-14 pb-3 grid gap-3 content-start ${two ? 'grid-cols-2' : 'grid-cols-1'}`} data-vol-view>
      {boxW > 0 && (
        <>
          <Smile W={figW} pts={smile} spot={chain.spot} sel={sel} expiryWord={`${MONTHS[chain.expiry.date.getMonth()]} ${chain.expiry.date.getDate()}`} />
          <Term W={figW} pts={term} on={chain.expiry.dte} />
        </>
      )}
    </div>
  );
};

/* ---- the smile ---------------------------------------------------------------------------------------------------- */

const Smile = ({ W, pts, spot, sel, expiryWord }: { W: number; pts: { k: number; c: number; p: number }[]; spot: number; sel: number | null; expiryWord: string }) => {
  /* under either colour-vision choice the puts' curve is dashed, so the two never differ by ink alone (the ideas' 13) */
  const dashed = useColourVision() !== 'standard';
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (pts.length < 2) return <Empty words="Too few strikes near the market for a smile" />;
  const lo = pts[0].k;
  const hi = pts[pts.length - 1].k;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const p of pts) {
    vMin = Math.min(vMin, p.c, p.p);
    vMax = Math.max(vMax, p.c, p.p);
  }
  const pad = Math.max(0.5, (vMax - vMin) * 0.12);
  vMin -= pad;
  vMax += pad;
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const x = (k: number) => M.l + ((k - lo) / (hi - lo || 1)) * iw;
  const y = (v: number) => M.t + (1 - (v - vMin) / (vMax - vMin || 1)) * ih;
  const line = (key: 'c' | 'p') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.k).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const yTicks = [vMin + pad, (vMin + vMax) / 2, vMax - pad];
  const xTicks = [lo, (lo + hi) / 2, hi];
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const u = ((e.clientX - r.left) / r.width) * W;
    const k = lo + ((u - M.l) / iw) * (hi - lo);
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].k - k) < Math.abs(pts[best].k - k)) best = i;
    setHover(best);
  };
  const h = hover != null ? pts[hover] : null;
  return (
    <figure className="relative min-w-0 rounded-md border border-borderSubtle/60 bg-ink/[0.015] p-2" data-vol-smile>
      <figcaption className="flex items-baseline gap-2 px-1">
        <span className="text-[12px] font-semibold text-textPrimary">The smile</span>
        <span className="text-[11px] text-textMuted">IV by strike · {expiryWord}</span>
        <span className="ml-auto inline-flex items-center gap-2.5 text-[11px] text-textMuted">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-[2px] rounded-full" style={{ background: CALL }} aria-hidden /> calls
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-[2px] rounded-full" style={dashed ? { backgroundImage: `linear-gradient(90deg, ${PUT} 60%, transparent 60%)`, backgroundSize: '4px 2px' } : { background: PUT }} aria-hidden /> puts
          </span>
        </span>
      </figcaption>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Implied volatility by strike for the ${expiryWord} expiry — calls and puts, the market's price marked`} style={{ display: 'block', touchAction: 'none' }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke={GRID} />
            <text x={M.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill={MUTED} fontFamily={FONT_SANS}>
              {v.toFixed(1)}%
            </text>
          </g>
        ))}
        {xTicks.map((k, i) => (
          <text key={i} x={x(k)} y={H - M.b + 16} textAnchor={k === lo ? 'start' : k === hi ? 'end' : 'middle'} fontSize={10} fill={MUTED} fontFamily={FONT_SANS}>
            {fmtStrike(Math.round(k * 2) / 2)}
          </text>
        ))}
        {spot >= lo && spot <= hi && (
          <g>
            <line x1={x(spot)} x2={x(spot)} y1={M.t} y2={H - M.b} stroke={SILVER} strokeOpacity={0.45} />
            <text x={x(spot)} y={M.t - 8} textAnchor="middle" fontSize={10} fontWeight={600} fill={SILVER} fontFamily={FONT_SANS}>
              now {spot.toFixed(2)}
            </text>
          </g>
        )}
        {sel != null && sel >= lo && sel <= hi && <path d={`M${x(sel)},${H - M.b + 2} l-4,6 h8 z`} fill={INK} fillOpacity={0.7} data-vol-picked />}
        <path d={line('c')} fill="none" stroke={CALL} strokeWidth={1.5} />
        <path d={line('p')} fill="none" stroke={PUT} strokeWidth={1.5} strokeDasharray={dashed ? '4 3' : undefined} />
        {h && (
          <g>
            <line x1={x(h.k)} x2={x(h.k)} y1={M.t} y2={H - M.b} stroke="rgb(var(--ink))" strokeOpacity={0.3} />
            <circle cx={x(h.k)} cy={y(h.c)} r={3} fill={CALL} stroke="rgb(var(--panel))" strokeWidth={1.5} />
            <circle cx={x(h.k)} cy={y(h.p)} r={3} fill={PUT} stroke="rgb(var(--panel))" strokeWidth={1.5} />
          </g>
        )}
      </svg>
      <p className="px-1 min-h-[16px] font-mono text-[11px] tnum text-textSecondary" aria-live="polite" data-vol-read>
        {h ? (
          <>
            {fmtStrike(h.k)} · calls <span style={{ color: CALL }}>{h.c.toFixed(1)}%</span> · puts <span style={{ color: PUT }}>{h.p.toFixed(1)}%</span>
          </>
        ) : (
          <span className="text-textMuted">Hover a strike for its IV</span>
        )}
      </p>
    </figure>
  );
};

/* ---- the term ----------------------------------------------------------------------------------------------------- */

const Term = ({ W, pts, on }: { W: number; pts: { e: { dte: number; sessions: number; date: Date }; iv: number; move: number }[]; on: number }) => {
  if (pts.length < 2) return <Empty words="One expiry on the rail — no term to draw" />;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const p of pts) {
    vMin = Math.min(vMin, p.iv);
    vMax = Math.max(vMax, p.iv);
  }
  const pad = Math.max(1, (vMax - vMin) * 0.25);
  vMin -= pad;
  vMax += pad;
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  /* the expiries spaced by their order on the rail, not their days — eight doors read as eight steps */
  const x = (i: number) => M.l + 10 + (i / (pts.length - 1)) * (iw - 20);
  const y = (v: number) => M.t + (1 - (v - vMin) / (vMax - vMin || 1)) * ih;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.iv).toFixed(1)}`).join(' ');
  /* one tick when the term is flat — two labels on one line read as a stutter */
  const yTicks = vMax - pad - (vMin + pad) < 0.05 ? [vMin + pad] : [vMin + pad, vMax - pad];
  return (
    <figure className="min-w-0 rounded-md border border-borderSubtle/60 bg-ink/[0.015] p-2" data-vol-term>
      <figcaption className="flex items-baseline gap-2 px-1">
        <span className="text-[12px] font-semibold text-textPrimary">The term</span>
        <span className="text-[11px] text-textMuted">at-the-money IV by expiry · the 1σ move each prices</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`At-the-money implied volatility at each of ${pts.length} expiries, with the one-sigma move each prices`} style={{ display: 'block' }}>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke={GRID} />
            <text x={M.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill={MUTED} fontFamily={FONT_SANS}>
              {v.toFixed(1)}%
            </text>
          </g>
        ))}
        <path d={line} fill="none" stroke={SILVER} strokeWidth={1.5} />
        {pts.map((p, i) => {
          const here = p.e.dte === on;
          return (
            <g key={p.e.dte} data-vol-term-point={p.e.dte}>
              <circle cx={x(i)} cy={y(p.iv)} r={here ? 4 : 2.5} fill={here ? INK : SILVER} stroke="rgb(var(--panel))" strokeWidth={1.5} />
              <text x={x(i)} y={H - M.b + 14} textAnchor="middle" fontSize={10} fontWeight={here ? 700 : 400} fill={here ? INK : MUTED} fontFamily={FONT_SANS}>
                {p.e.dte === 0 ? 'Today' : `${MONTHS[p.e.date.getMonth()]} ${p.e.date.getDate()}`}
              </text>
              <text x={x(i)} y={H - M.b + 27} textAnchor="middle" fontSize={10} fill={MUTED} fontFamily={FONT_SANS}>
                ±{p.move.toFixed(2)}
              </text>
              {here && (
                <text x={x(i)} y={y(p.iv) - 9} textAnchor="middle" fontSize={10} fontWeight={600} fill={INK} fontFamily={FONT_SANS}>
                  {p.iv.toFixed(1)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
};

const Empty = ({ words }: { words: string }) => (
  <div className="min-h-[160px] flex items-center justify-center rounded-md border border-borderSubtle/60 text-[12px] text-textMuted">{words}</div>
);

export default VolCurves;
