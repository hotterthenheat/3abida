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
  them the gap, a stepped band in the leader's
  ink, so who is ahead and by how much reads at a
  glance. The chart library draws it; the read line
  in the foot speaks the minute under the pointer.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { BaselineSeries, createChart, LineSeries, LineStyle, LineType, type IChartApi, type ISeriesApi, type LineData, type Time, type UTCTimestamp } from 'lightweight-charts';
import { sessionBars } from '../../data/levelview';
import { DARK_FIGURE_SURFACE } from './candleTheme';
import { readToken, useResolvedTheme } from '../../theme/theme';
import { alpha, resolveInk } from './paletteInk';
import { nyClock, nyTickMarks, nyTimeFormatter } from '../../core/nyTime';
/* The session's minutes are New York's (X2): the axis said 08:00 → 14:20 beside a clock reading 09:30 to 16:00 */
const fmtClockNy = (t: UTCTimestamp) => nyClock(t * 1000);
import { TAPES_H, TAPES_READ_H } from './compareSkeletons';
import { FONT_SANS } from '../../theme/fonts';

const signedPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`;

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
  const gapRef = useRef<ISeriesApi<'Baseline'> | null>(null);
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
  /* ON PAPER THE CHART IS PART OF THE PAGE (the light sweep, 2026-09-19): it has no Theme menu, so on the light page it does
     not wear the candle theme's grey — it sits on the page's soft inset with the page's inks, one grey with the box that
     holds it. On the dark terminal it is the dark island on the panel, whatever candle theme is picked (2026-09-20: it
     took the candle theme's ground, and a Stone pick made it a grey box on the dark page). */
  const paper = appTheme === 'light';
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const surface = paper
      ? { bg: readToken('--inset', undefined, host), text: readToken('--text-secondary', undefined, host), line: readToken('--ink', 0.16, host), crosshair: readToken('--ink', 0.4, host), label: readToken('--text-primary', undefined, host) }
      : DARK_FIGURE_SURFACE; /* the page, never the candle pick (candleTheme.ts: a figure is not a tape) */
    const chart = createChart(host, {
      autoSize: true,
      layout: { background: { color: surface.bg === 'transparent' ? readToken('--panel', undefined, host) : surface.bg }, textColor: surface.text, fontFamily: FONT_SANS, fontSize: 10, attributionLogo: false },
      localization: { timeFormatter: nyTimeFormatter },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      /* Room above the lines: at 0.08 the leader's live chip sat over the top axis
         figure and hid half of it (the lock walk, 2026-09-09) */
      rightPriceScale: { borderColor: surface.line, scaleMargins: { top: 0.16, bottom: 0.28 } },
      timeScale: { borderColor: surface.line, timeVisible: true, secondsVisible: false, rightOffset: 4, tickMarkFormatter: nyTickMarks },
      crosshair: {
        vertLine: { color: surface.crosshair, labelBackgroundColor: surface.label },
        horzLine: { color: surface.crosshair, labelBackgroundColor: surface.label },
      },
      handleScroll: false,
      handleScale: false,
    });
    const pctFormat = { type: 'custom' as const, formatter: (v: number) => signedPct(v), minMove: 0.01 };
    /* THE INKS ON THE CANVAS ARE RESOLVED off the plot's own box — a token
       string handed to the library painted the leader's line black, invisible
       on the dark terminal (Noah, 2026-09-12); the box is a dark island, so
       the leader's "text-primary" is the island's white on either theme */
    const lineA = chart.addSeries(LineSeries, { color: resolveInk(aInk, host), lineWidth: 2, priceLineVisible: false, lastValueVisible: true, priceFormat: pctFormat, crosshairMarkerRadius: 3 });
    const lineB = chart.addSeries(LineSeries, { color: resolveInk(bInk, host), lineWidth: 2, priceLineVisible: false, lastValueVisible: true, priceFormat: pctFormat, crosshairMarkerRadius: 3 });
    lineA.createPriceLine({ price: 0, color: paper ? readToken('--ink', 0.32, host) : 'rgba(255,255,255,0.22)', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
    /* THE GAP AS A STEPPED BAND, not a bar a minute (2026-09-29): four hundred one-pixel bars read as a barcode — the house
       rule for a minute-spaced figure is the stepped baseline, filled in the leader's ink on each side of level */
    const gapInkA = resolveInk(aInk, host);
    const gapInkB = resolveInk(bInk, host);
    const gap = chart.addSeries(BaselineSeries, {
      priceScaleId: 'gap',
      baseValue: { type: 'price', price: 0 },
      topLineColor: gapInkA,
      topFillColor1: alpha(gapInkA, 0.34),
      topFillColor2: alpha(gapInkA, 0.04),
      bottomLineColor: gapInkB,
      bottomFillColor1: alpha(gapInkB, 0.04),
      bottomFillColor2: alpha(gapInkB, 0.34),
      lineWidth: 1,
      lineType: LineType.WithSteps,
      priceFormat: pctFormat,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
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
    const host = hostRef.current;
    const ia = resolveInk(aInk, host);
    const ib = resolveInk(bInk, host);
    lineARef.current?.applyOptions({ color: ia });
    lineBRef.current?.applyOptions({ color: ib });
    gapRef.current?.applyOptions({ topLineColor: ia, topFillColor1: alpha(ia, 0.34), topFillColor2: alpha(ia, 0.04), bottomLineColor: ib, bottomFillColor1: alpha(ib, 0.04), bottomFillColor2: alpha(ib, 0.34) });
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
    const dg: LineData<Time>[] = [];
    for (const p of today.points) {
      const t = p.time as UTCTimestamp;
      if (p.a != null) da.push({ time: t, value: p.a });
      if (p.b != null) db.push({ time: t, value: p.b });
      if (p.a != null && p.b != null) dg.push({ time: t, value: p.a - p.b });
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
            <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">Since the open</h2>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted">
            Today, both as percent from their own open · <span style={{ color: aInk }}>{a}</span> and <span style={{ color: bInk }}>{b}</span>, the same line each · the band beneath is the gap, in the leader's ink
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6">
          <div>
            <dt className="text-[11px] text-textMuted">Since the open</dt>
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
            <dt className="text-[11px] text-textMuted">Ahead now</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-tapes-ahead>
              {today.lastA == null || today.lastB == null ? '—' : Math.abs(today.lastA - today.lastB) < 0.005 ? 'level' : `${today.lastA > today.lastB ? a : b} by ${Math.abs(today.lastA - today.lastB).toFixed(2)}%`}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-textMuted">The gap today</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-tapes-gap>
              {today.gap ? `${signedPct(today.gap.min)} to ${signedPct(today.gap.max)}` : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* THE CHART, and the card over it */}
      <div className={`relative border-t border-borderSubtle/60 ${paper ? 'bg-inset' : 'bg-panel'}`} style={{ height: TAPES_H }} data-chart-ink={paper ? undefined : ''} data-theme={paper ? 'light' : 'dark'} data-chart-ground={paper ? undefined : 'dark'}>
        <div ref={hostRef} className="absolute inset-0" data-tapes-chart />
        {hp && hover && (
          <div
            className="absolute z-10 pointer-events-none rounded-md border border-borderSubtle px-2.5 py-2 flex flex-col gap-1 text-[11px] text-textSecondary"
            style={{ left: hover.left, top: hover.top, width: CARD_W, background: 'rgba(8,8,10,0.88)', backdropFilter: 'blur(3px)' }}
            /* THE CARD IS ITS OWN DARK GLASS: its ground is typed dark, so its words must be the dark set — over a light
               ground (paper, or a Stone tape on either page) they were the box's dark ink on the dark card, unreadable */
            data-theme="dark"
            data-chart-glass
            data-tapes-card
          >
            <span className="font-mono text-[11px] font-bold tnum text-textPrimary">{fmtClockNy(hp.time as UTCTimestamp)}</span>
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
      <div className="px-5 border-t border-ink/[0.06] flex items-center gap-3 whitespace-nowrap overflow-hidden text-[11px] text-textSecondary" style={{ height: TAPES_READ_H }} data-tapes-read>
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
            <span className="ml-auto text-textMuted">hover the chart for any minute · times New York</span>
          </>
        ) : (
          <span className="text-textMuted">no session on the tape yet</span>
        )}
      </div>
      {/* THE LIBRARY'S CREDIT, under the chart rather than on it (PP-33: its mark sat over the gap band) */}
      <p className="px-5 pb-3 -mt-1 text-[11px] text-textMuted">
        Chart by{' '}
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-textPrimary">
          TradingView Lightweight Charts
        </a>
      </p>
    </section>
  );
};

export default CompareTapes;
