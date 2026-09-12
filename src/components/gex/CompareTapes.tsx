/*
==================================================
  SLAYER TERMINAL - SINCE THE OPEN
  (components/gex/CompareTapes.tsx)

  The third box of Compare, rebuilt (Noah,
  2026-09-09: the first cut reused one name's chart
  with the other crossed over it — one name had
  candles, its levels, its hedging trails and its
  volume, the other a bare line; "not to my
  standards"). A comparison gives both names the
  same thing: today's session, each as ONE line of
  percent from its own open, the same weight, in
  its own ink, nothing else on the plot — and under
  them the gap, a bar per minute in the leader's
  ink, so who is ahead and by how much reads at a
  glance. The chart library draws it; the read line
  in the foot speaks the minute under the pointer.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, HistogramSeries, LineSeries, LineStyle, type IChartApi, type ISeriesApi, type LineData, type Time, type UTCTimestamp } from 'lightweight-charts';
import { sessionBars } from '../../data/levelview';
import { CANDLE_THEMES, chartSurface, getCandleThemeKey } from './candleTheme';
import { readToken, useResolvedTheme } from '../../theme/theme';
import { fmtClockLocal, localTickMarks } from './chartTime';
import { TAPES_H, TAPES_READ_H } from './compareSkeletons';

const signedPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`;
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

interface Props {
  a: string;
  b: string;
  aInk: string;
  bInk: string;
  /** Bumped on every tick, so the lines fold in the newest minute */
  revision: number;
}

interface Point {
  time: number;
  a: number | null;
  b: number | null;
  /** The two prices at that minute, for the hover card */
  ca: number | null;
  cb: number | null;
}

/** Both sessions as percent from each name's own open, on the union of their minutes */
function buildToday(a: string, b: string): { points: Point[]; lastA: number | null; lastB: number | null; gap: { min: number; max: number } | null } {
  const ba = sessionBars(a) ?? [];
  const bb = sessionBars(b) ?? [];
  const pct = (bars: typeof ba) => {
    const m = new Map<number, { p: number; c: number }>();
    const open0 = bars[0]?.open;
    if (!open0) return m;
    for (const bar of bars) m.set(bar.time, { p: (bar.close / open0 - 1) * 100, c: bar.close });
    return m;
  };
  const pa = pct(ba);
  const pb = pct(bb);
  const times = [...new Set([...pa.keys(), ...pb.keys()])].sort((x, y) => x - y);
  const points: Point[] = times.map(t => ({ time: t, a: pa.get(t)?.p ?? null, b: pb.get(t)?.p ?? null, ca: pa.get(t)?.c ?? null, cb: pb.get(t)?.c ?? null }));
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.a == null || p.b == null) continue;
    const g = p.a - p.b;
    min = Math.min(min, g);
    max = Math.max(max, g);
  }
  const lastA = ba.length ? pa.get(ba[ba.length - 1].time)?.p ?? null : null;
  const lastB = bb.length ? pb.get(bb[bb.length - 1].time)?.p ?? null : null;
  return { points, lastA, lastB, gap: Number.isFinite(min) ? { min, max } : null };
}

/** The hover card's footprint — placed beside the pointer, kept inside the plot */
const CARD_W = 196;
const CARD_H = 100;

const CompareTapes = ({ a, b, aInk, bInk, revision }: Props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineARef = useRef<ISeriesApi<'Line'> | null>(null);
  const lineBRef = useRef<ISeriesApi<'Line'> | null>(null);
  const gapRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  /* THE HOVER CARD (Noah, 2026-09-09: "i like the chart now but its not
     informational i should have a translucent hover card on hover"): the minute
     under the pointer, both prices and both percents, and the gap — beside the
     pointer, flipping to its other side near the right edge, never off the plot */
  const [hover, setHover] = useState<{ point: Point; left: number; top: number } | null>(null);
  const today = useMemo(() => buildToday(a, b), [a, b, revision]);
  const pointsRef = useRef(today.points);
  pointsRef.current = today.points;

  /* Mount once — and again on a theme flip: the tapes read their inks at creation (2026-09-12) */
  const appTheme = useResolvedTheme();
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const surface = chartSurface(CANDLE_THEMES[getCandleThemeKey()]);
    const chart = createChart(host, {
      autoSize: true,
      layout: { background: { color: surface.bg === 'transparent' ? readToken('--panel', undefined, host) : surface.bg }, textColor: surface.text, fontFamily: "'SF Pro', sans-serif", fontSize: 10, attributionLogo: true },
      localization: { timeFormatter: fmtClockLocal },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      /* Room above the lines: at 0.08 the leader's live chip sat over the top axis
         figure and hid half of it (the lock walk, 2026-09-09) */
      rightPriceScale: { borderColor: surface.line, scaleMargins: { top: 0.16, bottom: 0.28 } },
      timeScale: { borderColor: surface.line, timeVisible: true, secondsVisible: false, rightOffset: 4, tickMarkFormatter: localTickMarks },
      crosshair: {
        vertLine: { color: surface.crosshair, labelBackgroundColor: surface.label },
        horzLine: { color: surface.crosshair, labelBackgroundColor: surface.label },
      },
      handleScroll: false,
      handleScale: false,
    });
    const pctFormat = { type: 'custom' as const, formatter: (v: number) => signedPct(v), minMove: 0.01 };
    const lineA = chart.addSeries(LineSeries, { color: aInk, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, priceFormat: pctFormat, crosshairMarkerRadius: 3 });
    const lineB = chart.addSeries(LineSeries, { color: bInk, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, priceFormat: pctFormat, crosshairMarkerRadius: 3 });
    lineA.createPriceLine({ price: 0, color: 'rgba(255,255,255,0.22)', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
    const gap = chart.addSeries(HistogramSeries, { priceScaleId: 'gap', priceFormat: pctFormat, priceLineVisible: false, lastValueVisible: false, base: 0 });
    chart.priceScale('gap').applyOptions({ scaleMargins: { top: 0.76, bottom: 0.02 }, visible: false });
    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.point) {
        setHover(null);
        return;
      }
      const t = param.time as number;
      const p = pointsRef.current.find(q => q.time === t);
      if (!p) {
        setHover(null);
        return;
      }
      const W = host.clientWidth;
      const H = host.clientHeight;
      const left = param.point.x + 16 + CARD_W <= W - 8 ? param.point.x + 16 : Math.max(8, param.point.x - 16 - CARD_W);
      const top = Math.max(8, Math.min(H - CARD_H - 8, param.point.y - CARD_H / 2));
      setHover({ point: p, left, top });
    });
    chartRef.current = chart;
    lineARef.current = lineA;
    lineBRef.current = lineB;
    gapRef.current = gap;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The inks follow the names */
  useEffect(() => {
    lineARef.current?.applyOptions({ color: aInk });
    lineBRef.current?.applyOptions({ color: bInk });
  }, [aInk, bInk]);

  /* The data, every tick */
  useEffect(() => {
    const lineA = lineARef.current;
    const lineB = lineBRef.current;
    const gap = gapRef.current;
    const chart = chartRef.current;
    if (!lineA || !lineB || !gap || !chart) return;
    const da: LineData<Time>[] = [];
    const db: LineData<Time>[] = [];
    const dg: { time: Time; value: number; color: string }[] = [];
    for (const p of today.points) {
      const t = p.time as UTCTimestamp;
      if (p.a != null) da.push({ time: t, value: p.a });
      if (p.b != null) db.push({ time: t, value: p.b });
      if (p.a != null && p.b != null) dg.push({ time: t, value: p.a - p.b, color: rgba(p.a >= p.b ? aInk : bInk, 0.55) });
    }
    lineA.setData(da);
    lineB.setData(db);
    gap.setData(dg);
    chart.timeScale().fitContent();
  }, [today, aInk, bInk]);

  /* The read line speaks NOW; the card speaks the minute under the pointer */
  const at = today.points.length ? { a: today.lastA, b: today.lastB } : null;
  const gapNow = at && at.a != null && at.b != null ? at.a - at.b : null;
  const leader = gapNow == null ? null : Math.abs(gapNow) < 0.005 ? 'level' : gapNow > 0 ? a : b;
  const hp = hover?.point ?? null;
  const hoverGap = hp && hp.a != null && hp.b != null ? hp.a - hp.b : null;

  return (
    <section className="flex flex-col min-w-0" data-compare-tapes-band data-since-a={today.lastA?.toFixed(2)} data-since-b={today.lastB?.toFixed(2)}>
      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Since the open</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap">
            Today, both as percent from their own open · <span style={{ color: aInk }}>{a}</span> and <span style={{ color: bInk }}>{b}</span>, the same line each · the bars beneath are the gap, in the leader's ink
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6">
          <div>
            <dt className="text-[10px] text-textMuted">Since the open</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" data-tapes-since>
              <span style={{ color: aInk }}>
                {a} {today.lastA == null ? '—' : signedPct(today.lastA)}
              </span>
              <span className="text-textMuted"> · </span>
              <span style={{ color: bInk }}>
                {b} {today.lastB == null ? '—' : signedPct(today.lastB)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Ahead now</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-tapes-ahead>
              {today.lastA == null || today.lastB == null ? '—' : Math.abs(today.lastA - today.lastB) < 0.005 ? 'level' : `${today.lastA > today.lastB ? a : b} by ${Math.abs(today.lastA - today.lastB).toFixed(2)}%`}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">The gap today</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-tapes-gap>
              {today.gap ? `${signedPct(today.gap.min)} to ${signedPct(today.gap.max)}` : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* THE CHART, and the card over it */}
      <div className="relative border-t border-borderSubtle/60 bg-panel" style={{ height: TAPES_H }} data-chart-ink data-theme="dark">
        <div ref={hostRef} className="absolute inset-0" data-tapes-chart />
        {hp && hover && (
          <div
            className="absolute z-10 pointer-events-none rounded-md border border-borderSubtle px-2.5 py-2 flex flex-col gap-1 text-[10.5px] text-textSecondary"
            style={{ left: hover.left, top: hover.top, width: CARD_W, background: 'rgba(8,8,10,0.88)', backdropFilter: 'blur(3px)' }}
            data-tapes-card
          >
            <span className="font-mono text-[11px] font-bold tnum text-textPrimary">{fmtClockLocal(hp.time as UTCTimestamp)}</span>
            <span className="flex items-center gap-1.5 font-mono tnum">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: aInk }} aria-hidden />
              <span className="font-semibold text-textPrimary">{a}</span>
              <span className="text-textSecondary">{hp.ca == null ? '—' : hp.ca.toFixed(2)}</span>
              <span className="ml-auto" style={{ color: aInk }}>
                {hp.a == null ? '—' : signedPct(hp.a)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 font-mono tnum">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: bInk }} aria-hidden />
              <span className="font-semibold text-textPrimary">{b}</span>
              <span className="text-textSecondary">{hp.cb == null ? '—' : hp.cb.toFixed(2)}</span>
              <span className="ml-auto" style={{ color: bInk }}>
                {hp.b == null ? '—' : signedPct(hp.b)}
              </span>
            </span>
            <span className="border-t border-borderSubtle/60 pt-1 whitespace-nowrap">
              {hoverGap == null ? (
                <span className="text-textMuted">one of them has no bar here</span>
              ) : Math.abs(hoverGap) < 0.005 ? (
                'level'
              ) : (
                <>
                  <span className="text-textPrimary" style={{ color: hoverGap > 0 ? aInk : bInk }}>
                    {hoverGap > 0 ? a : b}
                  </span>{' '}
                  ahead by <span className="font-mono tnum text-textPrimary">{Math.abs(hoverGap).toFixed(2)}%</span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* THE READ LINE — now */}
      <div className="px-5 border-t border-ink/[0.06] flex items-center gap-3 whitespace-nowrap overflow-hidden text-[10.5px] text-textSecondary" style={{ height: TAPES_READ_H }} data-tapes-read>
        {at ? (
          <>
            <span className="font-mono text-[11px] font-bold tnum text-textPrimary">now</span>
            <span className="font-mono tnum" style={{ color: aInk }}>
              {a} {at.a == null ? '—' : signedPct(at.a)}
            </span>
            <span className="font-mono tnum" style={{ color: bInk }}>
              {b} {at.b == null ? '—' : signedPct(at.b)}
            </span>
            {leader && (
              <span>
                {leader === 'level' ? 'level' : (
                  <>
                    <span className="text-textPrimary">{leader}</span> ahead by <span className="font-mono tnum text-textPrimary">{Math.abs(gapNow ?? 0).toFixed(2)}%</span>
                  </>
                )}
              </span>
            )}
            <span className="ml-auto text-textMuted">hover the chart for any minute</span>
          </>
        ) : (
          <span className="text-textMuted">no session on the tape yet</span>
        )}
      </div>
    </section>
  );
};

export default CompareTapes;
