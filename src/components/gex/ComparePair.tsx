/*
==================================================
  SLAYER TERMINAL - THE PAIR
  (components/gex/ComparePair.tsx)

  WHICH OF THE TWO HAS BEEN STRONGER — and is today's
  gap between them normal, or stretched? One name's
  price divided by the other's, one point a day.

  REBUILT 2026-09-20 (Noah, with the box in front of
  him: "it has no interactivity at all and i dont
  know what it does") onto the house's small chart —
  the library's crosshair, a card under the pointer,
  words a person can picture ("62% of the way to the
  top of the usual range"), never a sigma.

  REDRAWN 2026-09-29 (the partner: "hard to read and
  not visually appealing"; Noah: "hes not wrong").
  What was wrong, measured at 1440: the head wrapped
  — three facts beside the title pushed the two
  subtitle lines onto each other; the line changed
  ink at its average, which read as two lines; the
  days outside the range floated ABOVE the line as
  red dots; three wide named tags ("usual high
  1.267") collided on the price scale. So:

    ONE LINE     silver, one ink end to end
    THE RANGE    a soft band across the plot with the
                 average dashed through it — a room
                 the line lives in, not three more
                 lines; its names inside the plot at
                 the left, the figures alone on the
                 axis
    THE DAYS     a day that closed outside the range
                 is a small warm mark ON the line;
                 today a silver one, named
    THE HEAD     the title and one line of words; the
                 three facts live in the read line
                 under the chart, which already said
                 them
==================================================
*/

import { useMemo } from 'react';
import { buildPair, pairPlace, type Pair } from '../../data/compare';
import SessionsChart, { type ChartBand, type ChartLine, type ChartMark, type ChartPoint } from '../record/SessionsChart';
import { GuideDoor } from '../ui/GuideFocus';
import { THERMAL_WARM } from './paletteInk';
import { PAIR_H, PAIR_READ_H } from './compareSkeletons';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const WARM = THERMAL_WARM;

const fmtRatio = (v: number) => v.toFixed(v >= 10 ? 2 : 3);
const fmtClose = (v: number) => v.toFixed(2);
const dayWords = (t: number) => new Date(t * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

interface Props {
  a: string;
  b: string;
  aInk: string;
  bInk: string;
  /** Bumped on the scan cadence — the pair does not need every tick */
  nonce: number;
  /** The page's guide, from this box's head */
  guideOpen?: boolean;
  onGuide?: () => void;
}

const ComparePair = ({ a, b, aInk, bInk, nonce, guideOpen = false, onGuide }: Props) => {
  const pair: Pair = useMemo(() => buildPair(a, b), [a, b, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  /* every completed session, and today's point one step past the last */
  const done = pair.sessions.length > 1 ? pair.sessions.slice(0, -1) : pair.sessions;
  const last = pair.sessions[pair.sessions.length - 1];
  const todayAt = pair.today[pair.today.length - 1] ?? (pair.sessions.length > 1 ? last : undefined);
  const hasBand = pair.mean != null && pair.sd != null && pair.sd > 0;
  const top = hasBand ? (pair.mean as number) + (pair.sd as number) : null;
  const bottom = hasBand ? (pair.mean as number) - (pair.sd as number) : null;
  const isOutside = (v: number) => top != null && bottom != null && (v > top || v < bottom);

  const byTime = useMemo(() => {
    const m = new Map<number, { ratio: number; closeA: number; closeB: number; today: boolean }>();
    for (const p of done) m.set(p.time, { ...p, today: false });
    if (todayAt && pair.now != null) m.set(todayAt.time, { ratio: pair.now, closeA: todayAt.closeA, closeB: todayAt.closeB, today: true });
    return m;
  }, [done, todayAt, pair.now]);
  const points: ChartPoint[] = useMemo(() => [...byTime.entries()].sort((x, y) => x[0] - y[0]).map(([time, p]) => ({ time, value: p.ratio })), [byTime]);
  /* the usual range: its edges named inside the plot with the figure alone on the axis, the average dashed through it */
  const lines: ChartLine[] = useMemo(
    () =>
      top != null && bottom != null && pair.mean != null
        ? [
            { price: top, color: SILVER, title: 'usual high', style: 'solid', name: 'plot', line: false },
            { price: pair.mean, color: SILVER, title: 'average', style: 'dashed', name: 'plot' },
            { price: bottom, color: SILVER, title: 'usual low', style: 'solid', name: 'plot', line: false },
          ]
        : [],
    [top, bottom, pair.mean]
  );
  const bands: ChartBand[] = useMemo(() => (top != null && bottom != null ? [{ from: bottom, to: top, color: SILVER }] : []), [top, bottom]);
  /* the marks sit ON the line: a warm one for a day that closed outside the range, a silver one for today */
  const marks: ChartMark[] = useMemo(() => {
    const out: ChartMark[] = [];
    for (const [time, p] of byTime) {
      if (p.today) out.push({ time, color: SILVER, shape: 'circle', on: true, size: 0.45, word: 'today', text: 'today, still moving' });
      else if (isOutside(p.ratio)) out.push({ time, color: WARM, shape: 'circle', on: true, size: 0.32, text: 'closed outside the usual range' });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byTime, top, bottom]);

  /* the scale holds the line AND the usual range, with a little air — the library's own fit left the line a flat thread */
  const range = useMemo<readonly [number, number] | undefined>(() => {
    if (!points.length) return undefined;
    const vs = points.map(p => p.value);
    if (top != null && bottom != null) vs.push(top, bottom);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const air = Math.max((hi - lo) * 0.06, 1e-4);
    return [lo - air, hi + air];
  }, [points, top, bottom]);
  const outsideCount = done.filter(p => isOutside(p.ratio)).length;
  const nowPlace = pair.now != null ? pairPlace(pair.now, pair.mean, pair.sd) : null;
  const band = top != null && bottom != null ? `${fmtRatio(bottom)} – ${fmtRatio(top)}` : '—';

  return (
    <section className="flex flex-col min-w-0" data-compare-pair data-place={nowPlace?.where}>
      {/* THE HEAD — the title, what the line is, and the guide's door; the figures are the read line's */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3 min-w-0">
            <h3 className="shrink-0 text-[15px] font-semibold leading-tight text-textPrimary">The pair</h3>
            <span className="min-w-0 truncate text-[11px] text-textSecondary">which of the two has been stronger, and whether today's gap is normal</span>
            {onGuide && <GuideDoor open={guideOpen} onClick={onGuide} title="What the line, the range and the marks mean" testId="pair-guide" />}
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
            {a}'s price divided by {b}'s, one point a day · up, <span style={{ color: aInk }}>{a}</span> is gaining · down, <span style={{ color: bInk }}>{b}</span> is gaining · the band is the usual range · hover any day
          </p>
        </div>
      </div>

      {/* THE CHART — the library's, with its crosshair and a card under the pointer */}
      <div className="relative border-t border-borderSubtle/60 px-3 pt-3 pb-2" style={{ height: PAIR_H }} data-pair-chart data-points={points.length}>
        {points.length > 1 ? (
          <SessionsChart
            /* the average and the range's lines are read when the chart is made: a new pair is a new chart */
            key={`${a}|${b}|${pair.mean?.toFixed(4) ?? 'none'}`}
            points={points}
            kind="line"
            ink={SILVER}
            lines={lines}
            bands={bands}
            marks={marks}
            height={PAIR_H - 20}
            clock="day"
            scale="ratio"
            range={range}
            cardW={244}
            cardH={96}
            testId="pair"
            card={h => {
              const p = byTime.get(h.time);
              if (!p) return <span className="text-textMuted">no session here</span>;
              const place = pairPlace(p.ratio, pair.mean, pair.sd);
              return (
                <>
                  <span className="font-mono text-[11px] font-bold tnum text-textPrimary">
                    {p.today ? 'Today' : dayWords(h.time)}
                    {p.today && <span className="ml-1.5 font-normal text-[9px] uppercase tracking-widest" style={{ color: SILVER }}>still moving</span>}
                  </span>
                  <span className="font-mono text-[10.5px] tnum text-textSecondary">
                    {a} <span className="text-textPrimary">{fmtClose(p.closeA)}</span> ÷ {b} <span className="text-textPrimary">{fmtClose(p.closeB)}</span> = <span className="font-bold text-textPrimary">{fmtRatio(p.ratio)}</span>
                  </span>
                  {place && (
                    <span className="text-[10.5px] leading-snug" style={{ color: place.where === 'inside' ? undefined : WARM }}>
                      {place.words}
                    </span>
                  )}
                  {place && <span className="text-[10px] text-textMuted">{place.ahead === 'a' ? `${a} further ahead of ${b} than on an average day` : place.ahead === 'b' ? `${b} further ahead of ${a} than on an average day` : 'right where the two usually sit'}</span>}
                </>
              );
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-[11px] text-textMuted">not enough sessions on the tape yet</div>
        )}
      </div>

      {/* THE READ LINE — where today stands, at rest: the ratio, the usual range, where today sits, the days outside;
          the day under the pointer is the card's */}
      <div className="px-5 border-t border-ink/[0.06] flex items-center gap-3 whitespace-nowrap overflow-hidden text-[10.5px] text-textSecondary" style={{ height: PAIR_READ_H }} data-pair-read>
        {pair.now != null ? (
          <>
            <span className="font-mono text-[11px] font-bold tnum text-textPrimary">now</span>
            <span className="font-mono tnum text-textPrimary" data-pair-now>
              {a} ÷ {b} {fmtRatio(pair.now)}
            </span>
            {hasBand && (
              <span className="font-mono tnum text-textMuted" data-pair-band>
                usual {band} · {done.length} sessions
              </span>
            )}
            {nowPlace && (
              <span style={{ color: nowPlace.where === 'inside' ? undefined : WARM }} data-pair-sits>
                {nowPlace.words}
              </span>
            )}
            {/* the two marks, named where their count is said */}
            {hasBand && (
              <span className="inline-flex items-center gap-1.5 text-textMuted">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: WARM }} aria-hidden />
                {outsideCount} of {done.length} days closed outside
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-textMuted">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SILVER }} aria-hidden />
              today
            </span>
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
