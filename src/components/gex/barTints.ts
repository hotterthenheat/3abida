/*
==================================================
  SLAYER TERMINAL - A SCRIPT'S BAR COLOURS
  (components/gex/barTints.ts)

  Pine's barcolor() on the chart (the owner's
  approval 13, 2026-10-15: "barcolor(): implement
  it"). Not a series of the script's own: the
  host's candles, coloured point by point with the
  library's per-point color, borderColor and
  wickColor. `barTints` merges the pane's runs
  (the last drawn wins a bar), `tintPoint` dresses
  one bar in its theme's form (a hollow rising
  body stays hollow), `retint` moves the series
  from one set of colours to the next. No DOM, so
  the Pine proof reads it in Node.
==================================================
*/

import type { BarData, CandlestickData, ISeriesApi, ITimeScaleApi, Time, UTCTimestamp } from 'lightweight-charts';
import type { Bar, RunResult } from '../../core/pine';
import type { InkKind } from './indicatorInks';

/** How the price series takes a bar's colour. A candle's body, border and wick; a bar's one stroke; a line, an area or a
    baseline none (TradingView's rule: barcolor() colours bars and candles). `hollowUp` is the body a rising candle keeps
    when the tape draws rising bodies hollow — the colour-vision cut of Neon and Market, Wire, the Hollow candles style —
    so only its border and wick take the colour and a rise keeps its form */
export interface TintForm {
  kind: 'candle' | 'bar' | null;
  hollowUp: string | null;
}
export const NO_TINT: TintForm = { kind: null, hollowUp: null };

/** The form for a series drawn with these candle inks: hollow where the rising body is not the rising border */
export function candleTintForm(upBody: string, upBorder: string): TintForm {
  return { kind: 'candle', hollowUp: upBody !== upBorder ? upBody : null };
}

interface Ohlc {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** One bar in the series' own terms, wearing `ink` (or its theme's colours when there is none) — the library calls a bar
    whose open is at or under its close a rising one */
export function tintPoint(b: Ohlc, ink: string | undefined, form: TintForm): CandlestickData<UTCTimestamp> | BarData<UTCTimestamp> {
  const base = { time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close };
  if (!ink || !form.kind) return base;
  if (form.kind === 'bar') return { ...base, color: ink };
  return { ...base, color: form.hollowUp !== null && b.open <= b.close ? form.hollowUp : ink, borderColor: ink, wickColor: ink };
}

/** The pane's runs merged into one colour a bar time (each run over `bars`, in the order they are drawn): the last run
    to colour a bar wins it, na leaves it to the runs before; every colour through the host's `ink`, as a line's */
export function barTints(runs: RunResult[], bars: Bar[], ink?: (css: string, kind: InkKind) => string): Map<number, string> {
  const out = new Map<number, string>();
  for (const r of runs) {
    const cs = r.barcolors;
    if (!cs) continue;
    const n = Math.min(cs.length, bars.length);
    for (let i = 0; i < n; i++) {
      const c = cs[i];
      if (c) out.set(bars[i].time, ink ? ink(c, 'line') : c);
    }
  }
  return out;
}

/** Past this many bars changed, the series is loaded afresh rather than updated bar by bar (the library's historical
    update is the slower path) */
const RETINT_POINTS = 8;

/**
 * Move a candle or bar series from the colours `prev` to `next` (bar time → ink): the bars whose colour changed, a few
 * through the library's historical update, more by one fresh load of the series' own data (the view holds). `all` asks
 * for every bar either set names — the form changed under them. A time the series does not hold yet is left to the
 * host's next write, which reads the same colours.
 */
export function retint(series: ISeriesApi<'Candlestick'>, ts: ITimeScaleApi<Time>, prev: Map<number, string>, next: Map<number, string>, form: TintForm, all = false): void {
  if (!form.kind) return;
  const changed: number[] = [];
  for (const [t, c] of next) if (all || prev.get(t) !== c) changed.push(t);
  for (const t of prev.keys()) if (!next.has(t)) changed.push(t);
  if (!changed.length) return;
  const asOhlc = (d: unknown): Ohlc | null => {
    const o = d as Partial<Ohlc> | null;
    return o && typeof o.time === 'number' && typeof o.open === 'number' && typeof o.high === 'number' && typeof o.low === 'number' && typeof o.close === 'number' ? (o as Ohlc) : null;
  };
  if (changed.length <= RETINT_POINTS) {
    try {
      for (const t of changed) {
        const i = ts.timeToIndex(t as UTCTimestamp, false);
        if (i == null) continue;
        const d = asOhlc(series.dataByIndex(i));
        if (!d || d.time !== t) continue;
        series.update(tintPoint(d, next.get(t), form) as CandlestickData<Time>, true);
      }
      return;
    } catch {
      /* a point the library would not update in place — the whole series below */
    }
  }
  const rows: (CandlestickData<Time> | BarData<Time>)[] = [];
  for (const d of series.data()) {
    const o = asOhlc(d);
    if (o) rows.push(tintPoint(o, next.get(o.time), form) as CandlestickData<Time>);
  }
  series.setData(rows as CandlestickData<Time>[]);
}
