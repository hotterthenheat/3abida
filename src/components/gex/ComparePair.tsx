/*
==================================================
  SLAYER TERMINAL - THE PAIR
  (components/gex/ComparePair.tsx)

  Is today's gap between the two names normal, or
  stretched? One name's close over the other's,
  session by session over what the tape holds, as
  a drawing (2026-09-09, Noah on the first cut:
  "just a white line with nothing to see"):

    the USUAL BAND   a shaded band, the average
                     through it, both named on the
                     right with their values
    the SESSIONS     a dot each on the line — the
                     ones that closed outside the
                     band lit warm, so how often it
                     leaves the band is visible
    TODAY            the silver point at the end,
                     its value and its distance from
                     the average in a chip beside it
    the DIRECTION    "SPY ahead" up, "QQQ ahead"
                     down, in the margins — so the
                     line's slope has a meaning

  Hover a session and the read line names it.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { buildPair, type Pair } from '../../data/compare';
import { THERMAL_WARM } from './paletteInk';
import { PAIR_H, PAIR_M, PAIR_READ_H } from './compareSkeletons';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const INK = 'rgb(var(--text-primary))';
const INK_2 = 'rgb(var(--text-secondary))';
const INK_3 = 'rgb(var(--text-muted))';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const WARM = THERMAL_WARM;

const fmtRatio = (v: number) => v.toFixed(v >= 10 ? 2 : 3);
const signedSd = (z: number) => (Math.abs(z) < 0.05 ? '0.0σ' : `${z > 0 ? '+' : '−'}${Math.abs(z).toFixed(1)}σ`);
const dayWords = (t: number) => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

interface Props {
  a: string;
  b: string;
  aInk: string;
  bInk: string;
  /** Bumped on the scan cadence — the pair does not need every tick */
  nonce: number;
}

const ComparePair = ({ a, b, aInk, bInk, nonce }: Props) => {
  const pair: Pair = useMemo(() => buildPair(a, b), [a, b, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(1200);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setW(host.clientWidth || 1200);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setW(Math.max(320, Math.round(e.contentRect.width)));
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  const [hover, setHover] = useState<number | null>(null);

  /* THE GEOMETRY — every completed session on an even step, today one step past the last */
  const done = pair.sessions.length > 1 ? pair.sessions.slice(0, -1) : pair.sessions;
  const hasNow = pair.now != null;
  const n = done.length + (hasNow ? 1 : 0);
  const M = PAIR_M;
  const H = PAIR_H;
  const x0 = M.l;
  const x1 = W - M.r;
  const xOf = (i: number) => (n <= 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1));
  const values = [...done.map(p => p.ratio), ...(hasNow ? [pair.now as number] : [])];
  if (pair.mean != null && pair.sd != null) values.push(pair.mean + pair.sd * 1.25, pair.mean - pair.sd * 1.25);
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : 1;
  if (!(hi > lo)) {
    lo -= 0.01;
    hi += 0.01;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const yOf = (v: number) => M.t + ((hi - v) / (hi - lo)) * (H - M.t - M.b);
  const zOf = (v: number) => (pair.mean != null && pair.sd ? (v - pair.mean) / pair.sd : null);
  const outside = (v: number) => {
    const z = zOf(v);
    return z != null && Math.abs(z) > 1;
  };
  const path = done.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)} ${yOf(p.ratio).toFixed(1)}`).join(' ');
  const nowX = xOf(n - 1);
  const nowY = hasNow ? yOf(pair.now as number) : 0;
  const lastX = done.length ? xOf(done.length - 1) : nowX;
  const lastY = done.length ? yOf(done[done.length - 1].ratio) : nowY;
  const nowZ = hasNow ? zOf(pair.now as number) : null;
  /* Date ticks: about eight across, the first and the last always */
  const step = Math.max(1, Math.ceil(done.length / 8));
  const ticks = done.map((p, i) => ({ i, t: p.time })).filter((d, k, arr) => k % step === 0 || k === arr.length - 1);

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xOf(i) - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0 || bestD > 40) {
      if (hover != null) setHover(null);
      return;
    }
    if (hover !== best) setHover(best);
  };
  const onLeave = () => setHover(null);

  const band = pair.mean != null && pair.sd != null ? `${fmtRatio(pair.mean - pair.sd)} – ${fmtRatio(pair.mean + pair.sd)}` : '—';
  const sits = pair.z == null ? '—' : `${signedSd(pair.z)} · ${Math.abs(pair.z) > 1 ? 'outside the band' : 'inside the band'}`;
  const hovered = hover == null ? null : hover < done.length ? { time: done[hover].time, ratio: done[hover].ratio, today: false } : hasNow ? { time: pair.today[pair.today.length - 1]?.time ?? pair.sessions[pair.sessions.length - 1]?.time ?? 0, ratio: pair.now as number, today: true } : null;
  const readZ = hovered ? zOf(hovered.ratio) : null;
  const outsideCount = done.filter(p => outside(p.ratio)).length;
  /* The now chip must not cover the average's label: step it off when the two would meet */
  const chipY = hasNow && pair.mean != null && Math.abs(nowY - yOf(pair.mean)) < 14 ? nowY + (nowY >= yOf(pair.mean) ? 14 : -14) : nowY;

  return (
    <section className="flex flex-col min-w-0" data-compare-pair data-z={pair.z?.toFixed(2)}>
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The pair</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
            {a} over {b}, close by close · up is <span style={{ color: aInk }}>{a}</span> ahead, down is <span style={{ color: bInk }}>{b}</span> ahead · the band is the usual range · sessions outside it lit <span style={{ color: WARM }}>warm</span> · today in <span style={{ color: SILVER }}>silver</span>
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6">
          <div>
            <dt className="text-[10px] text-textMuted">Now</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-pair-now>
              {pair.now == null ? '—' : fmtRatio(pair.now)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Usual band · {done.length} sessions</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-pair-band>
              {band}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Today sits</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: pair.z != null && Math.abs(pair.z) > 1 ? SILVER : INK }} data-pair-sits>
              {sits}
            </dd>
          </div>
        </dl>
      </div>

      {/* THE DRAWING */}
      <div ref={hostRef} className="relative border-t border-borderSubtle/60 select-none" style={{ height: PAIR_H }} data-pair-chart>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" onPointerMove={onMove} onPointerLeave={onLeave} role="img" aria-label={`${a} over ${b}, session by session, against its usual band`}>
          {/* the usual band and the average, named on the right */}
          {pair.mean != null && pair.sd != null && (
            <g data-pair-band-shape>
              <rect x={x0} y={yOf(pair.mean + pair.sd)} width={Math.max(0, x1 - x0)} height={Math.max(1, yOf(pair.mean - pair.sd) - yOf(pair.mean + pair.sd))} fill={SILVER} fillOpacity={0.09} />
              <line x1={x0} x2={x1} y1={yOf(pair.mean + pair.sd)} y2={yOf(pair.mean + pair.sd)} stroke={SILVER} strokeOpacity={0.35} strokeDasharray="3 3" />
              <line x1={x0} x2={x1} y1={yOf(pair.mean - pair.sd)} y2={yOf(pair.mean - pair.sd)} stroke={SILVER} strokeOpacity={0.35} strokeDasharray="3 3" />
              <line x1={x0} x2={x1} y1={yOf(pair.mean)} y2={yOf(pair.mean)} stroke={SILVER} strokeOpacity={0.7} strokeDasharray="1 3" />
              {/* The band's edges and the average, 10px: the figures the read hangs on (the lock walk, 2026-09-09) */}
              <text x={x1 + 6} y={yOf(pair.mean + pair.sd)} fontFamily={MONO} fontSize="10" fill={INK_2} dominantBaseline="middle">
                {fmtRatio(pair.mean + pair.sd)}
              </text>
              <text x={x1 + 6} y={yOf(pair.mean - pair.sd)} fontFamily={MONO} fontSize="10" fill={INK_2} dominantBaseline="middle">
                {fmtRatio(pair.mean - pair.sd)}
              </text>
              <text x={x1 + 6} y={yOf(pair.mean)} fontFamily={MONO} fontSize="10" fill={SILVER} fillOpacity={0.9} dominantBaseline="middle">
                avg {fmtRatio(pair.mean)}
              </text>
            </g>
          )}
          {/* which way is which */}
          <text x={x0 + 4} y={M.t - 8} fontFamily={SANS} fontSize="9" fill={aInk} fillOpacity={0.9} letterSpacing="0.08em">
            ▲ {a.toUpperCase()} AHEAD
          </text>
          <text x={x0 + 4} y={H - M.b + 2} fontFamily={SANS} fontSize="9" fill={bInk} fillOpacity={0.9} letterSpacing="0.08em" dominantBaseline="hanging">
            ▼ {b.toUpperCase()} AHEAD
          </text>
          {/* the sessions */}
          {path && <path d={path} fill="none" stroke={INK} strokeOpacity={0.85} strokeWidth={1.5} strokeLinejoin="round" data-pair-line />}
          {done.map((p, i) => {
            const out = outside(p.ratio);
            const hot = hover === i;
            return (
              <g key={p.time} data-pair-session={i} data-outside={out || undefined}>
                <circle cx={xOf(i)} cy={yOf(p.ratio)} r={hot ? 4.5 : out ? 3.5 : 2.6} fill={out ? WARM : 'rgb(var(--panel))'} stroke={out ? WARM : INK_2} strokeWidth={1.2} />
                {hot && <line x1={xOf(i)} x2={xOf(i)} y1={M.t} y2={H - M.b} stroke={SILVER} strokeOpacity={0.4} />}
              </g>
            );
          })}
          {/* today */}
          {hasNow && (
            <g data-pair-today>
              {done.length > 0 && <line x1={lastX} y1={lastY} x2={nowX} y2={nowY} stroke={SILVER} strokeWidth={2} strokeLinecap="round" />}
              <circle cx={nowX} cy={nowY} r={hover === n - 1 ? 6 : 5} fill={SILVER} stroke="#0a0a0a" strokeWidth={1.5} />
              {hover === n - 1 && <line x1={nowX} x2={nowX} y1={M.t} y2={H - M.b} stroke={SILVER} strokeOpacity={0.4} />}
              <rect x={x1 + 4} y={chipY - 9} width={M.r - 10} height={18} rx={4} fill={SILVER} />
              <text x={x1 + 4 + (M.r - 10) / 2} y={chipY + 0.5} fontFamily={MONO} fontSize="10" fontWeight="700" fill="#0a0a0a" textAnchor="middle" dominantBaseline="middle">
                {fmtRatio(pair.now as number)}
                {nowZ != null ? ` ${signedSd(nowZ)}` : ''}
              </text>
            </g>
          )}
          {/* the dates */}
          {ticks.map(d => (
            <text key={d.t} x={xOf(d.i)} y={H - 8} fontFamily={MONO} fontSize="9" fill={INK_3} textAnchor="middle">
              {dayWords(d.t)}
            </text>
          ))}
          {hasNow && (
            <text x={nowX} y={H - 8} fontFamily={MONO} fontSize="9" fontWeight="700" fill={SILVER} textAnchor="middle">
              now
            </text>
          )}
        </svg>
      </div>

      {/* THE READ LINE */}
      <div className="px-5 border-t border-ink/[0.06] flex items-center gap-3 whitespace-nowrap overflow-hidden text-[10.5px] text-textSecondary" style={{ height: PAIR_READ_H }} data-pair-read>
        {hovered ? (
          <>
            <span className="font-mono text-[11px] font-bold tnum text-textPrimary">{hovered.today ? 'now' : dayWords(hovered.time)}</span>
            <span className="font-mono tnum text-textPrimary">
              {a} / {b} {fmtRatio(hovered.ratio)}
            </span>
            {readZ != null && (
              <span>
                <span className="font-mono tnum text-textPrimary">{signedSd(readZ)}</span> from the average · {Math.abs(readZ) > 1 ? <span style={{ color: WARM }}>outside the usual band</span> : 'inside the usual band'}
              </span>
            )}
            <span>{hovered.ratio >= (pair.mean ?? hovered.ratio) ? `${a} ahead of usual` : `${b} ahead of usual`}</span>
            <span className="ml-auto text-textMuted">{hovered.today ? 'today' : 'the session under the pointer'}</span>
          </>
        ) : pair.now != null ? (
          <>
            <span className="font-mono text-[11px] font-bold tnum text-textPrimary">now</span>
            <span className="font-mono tnum text-textPrimary">
              {a} / {b} {fmtRatio(pair.now)}
            </span>
            {pair.z != null && (
              <span>
                <span className="font-mono tnum text-textPrimary">{signedSd(pair.z)}</span> from the average · {Math.abs(pair.z) > 1 ? <span style={{ color: WARM }}>outside the usual band</span> : 'inside the usual band'}
              </span>
            )}
            <span className="text-textMuted">
              {outsideCount} of {done.length} sessions closed outside it
            </span>
            <span className="ml-auto text-textMuted">hover a session</span>
          </>
        ) : (
          <span className="text-textMuted">not enough sessions on the tape yet</span>
        )}
      </div>

      <p className="px-5 pb-4 pt-2 min-h-[44px] text-[12px] leading-relaxed text-textSecondary" data-pair-sentence>
        {pair.sentence}
      </p>
    </section>
  );
};

export default ComparePair;
