/*
==================================================
  SLAYER TERMINAL - DEALERS THROUGH THE SESSION
  (components/levels/DealerTimeline.tsx)

  Box 4 of the Building page (the ideas report's
  item 2, 2026-10-10). Two quiet lines on New York's
  session, 09:30 to 16:00:

    NET GEX         the whole book's net hedging each
                    minute, the house's sign — above
                    the middle line put-heavy (dealer
                    hedging amplifies a move), below
                    it call-heavy (it absorbs one)
    FROM THE FLIP   price's distance from the flip as
                    it stood that minute — above the
                    line price is over it, below under

  The pointer (or ← → once the drawing has the keys)
  reads a minute. Drawn in pixels off its own width,
  so its words stand at the floor on any screen.
  data/dealerTimeline.ts holds the arithmetic.
==================================================
*/

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import { FLIP, LONG_GAMMA, SHORT_GAMMA } from '../gex/paletteInk';
import { SESSION_CLOSE_MIN, SESSION_OPEN_MIN, minuteLabel } from '../../core/nyTime';
import { pct, pctSigned, usdCompact, usdCompactSigned } from '../../core/format';
import { FONT_SANS } from '../../theme/fonts';
import type { DealerTimeline as Timeline, TimelinePoint } from '../../data/dealerTimeline';

const MUTED = 'rgb(var(--text-muted))';
const INK = 'rgb(var(--text-primary))';
const LINE = 'rgb(var(--text-secondary))';
const WASH = 'rgb(var(--ink))';
/* the rows, in pixels: the GEX pane, its gap, the flip pane, the hours */
const M = { l: 8, r: 72, t: 8 };
const GEX_H = 64;
const GAP = 22;
const FLIP_H = 52;
const AXIS_H = 20;
const H = M.t + GEX_H + GAP + FLIP_H + AXIS_H;

const leanOf = (v: number) => (v > 0 ? 'put-heavy — hedging amplifies a move' : v < 0 ? 'call-heavy — hedging absorbs one' : 'flat');
const spanWords = (min: number) => (min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`);

interface Props {
  data: Timeline | null;
  ticker: string;
  scope?: ReactNode;
}

const DealerTimeline = ({ data, ticker, scope }: Props) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  const clip = useId().replace(/:/g, '');
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setW(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = data?.points ?? [];
  /* THE CLOCK ACROSS: New York's cash session when the tape is inside it (the line grows toward 16:00); a tape read
     outside it (the run the simulator holds before the bell) spans its own minutes */
  const inCash = !!data && data.first.minute >= SESSION_OPEN_MIN && data.last.minute <= SESSION_CLOSE_MIN;
  const lo = !data || inCash ? SESSION_OPEN_MIN : data.first.minute;
  const hi = !data || inCash ? SESSION_CLOSE_MIN : Math.max(data.last.minute, lo + 60);
  const x = (m: number) => M.l + ((m - lo) / (hi - lo)) * Math.max(1, w - M.l - M.r);
  const hours: number[] = [];
  for (let m = Math.ceil((lo + 1) / 60) * 60; m <= hi; m += 60) hours.push(m);
  const gexMax = Math.max(1, ...pts.map(p => Math.abs(p.netGex)));
  const gexMid = M.t + GEX_H / 2;
  const yGex = (v: number) => gexMid - (v / gexMax) * (GEX_H / 2 - 2);
  const flipMax = Math.max(0.05, ...pts.map(p => Math.abs(p.flipPct ?? 0)));
  const flipTop = M.t + GEX_H + GAP;
  const flipMid = flipTop + FLIP_H / 2;
  const yFlip = (v: number) => flipMid - (v / flipMax) * (FLIP_H / 2 - 2);

  /* the GEX line and its fill to the middle */
  const gexPath = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.minute).toFixed(1)},${yGex(p.netGex).toFixed(1)}`).join('');
  const gexArea = pts.length ? `${gexPath}L${x(pts[pts.length - 1].minute).toFixed(1)},${gexMid}L${x(pts[0].minute).toFixed(1)},${gexMid}Z` : '';
  /* the flip line, broken where the book had no flip */
  let flipPath = '';
  let pen = false;
  for (const p of pts) {
    if (p.flipPct == null) {
      pen = false;
      continue;
    }
    flipPath += `${pen ? 'L' : 'M'}${x(p.minute).toFixed(1)},${yFlip(p.flipPct).toFixed(1)}`;
    pen = true;
  }

  const read: TimelinePoint | null = at != null ? pts[at] ?? null : null;
  const pointAt = (clientX: number) => {
    const el = box.current;
    if (!el || pts.length === 0) return;
    const px = clientX - el.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(x(pts[i].minute) - px) < Math.abs(x(pts[best].minute) - px)) best = i;
    setAt(best);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (pts.length === 0) return;
    const step = e.shiftKey ? 30 : 1;
    if (e.key === 'ArrowRight') setAt(i => Math.min(pts.length - 1, (i ?? pts.length - 1) + step));
    else if (e.key === 'ArrowLeft') setAt(i => Math.max(0, (i ?? pts.length - 1) - step));
    else if (e.key === 'Home') setAt(0);
    else if (e.key === 'End') setAt(pts.length - 1);
    else if (e.key === 'Escape') setAt(null);
    else return;
    e.preventDefault();
  };

  const change = data ? data.last.netGex - data.first.netGex : 0;
  const sentence = data
    ? `Net GEX read put-heavy for ${spanWords(data.putHeavyMin)} of the ${spanWords(data.points.length)} on the tape and stands at ${usdCompact(data.last.netGex)} at ${minuteLabel(data.last.minute)}, ${usdCompactSigned(change)} since ${minuteLabel(data.first.minute)}.${
        data.flipMin ? ` Price stood above the flip for ${spanWords(data.aboveFlipMin)} of ${spanWords(data.flipMin)} and crossed it ${data.crossings} ${data.crossings === 1 ? 'time' : 'times'}.` : ' The book had no flip on this session.'
      }`
    : '';

  return (
    <section className="relative flex flex-col min-w-0" data-dealer-timeline>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the dealers through the session" testId="timeline-guide" viewport>
        <div className="space-y-3 text-[13px] leading-relaxed text-textSecondary">
          <p>
            The terminal keeps the dealers' book once a minute. The <span className="text-textPrimary">top line</span> is the whole book's net GEX each minute, in
            the house's sign: above the middle line the book is <span style={{ color: SHORT_GAMMA }}>put-heavy</span>, where dealer hedging tends to amplify a move;
            below it <span style={{ color: LONG_GAMMA }}>call-heavy</span>, where the hedging tends to absorb one. The further from the line, the bigger the book.
          </p>
          <p>
            The <span className="text-textPrimary">lower line</span> is how far price stood from the flip, as the flip stood that minute — above the dashed line price
            was over the flip, below it under. A line that hugs the dashed one is a session spent at the flip, where the hedging changes sides.
          </p>
          <p>
            What it does not say: who holds the positions or which way they lean. The open interest under the book is counted once a day, after the close, so the
            book moves through the session with price and time, not with new positions.
          </p>
        </div>
      </GuideFocus>

      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">Dealers through the session</h2>
            {scope}
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the two lines mean" testId="timeline-guide" />
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-textMuted">
            How to read: the top line is the book's net GEX minute by minute — above the middle put-heavy, below it call-heavy; the lower line is price's distance
            from the flip, above the dashed line over it{data ? ` · ${data.day}` : ''}
          </p>
        </div>
        {data && (
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <dt className="text-[11px] text-textMuted">Net GEX now</dt>
              <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: data.last.netGex > 0 ? SHORT_GAMMA : data.last.netGex < 0 ? LONG_GAMMA : INK }}>
                {usdCompact(data.last.netGex)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-textMuted">Since {minuteLabel(data.first.minute)}</dt>
              <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{usdCompactSigned(change)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-textMuted">Flip crossed</dt>
              <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">
                {data.flipMin ? `${data.crossings} ${data.crossings === 1 ? 'time' : 'times'}` : '—'}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {!data ? (
        <p className="px-5 pb-5 text-[12px] text-textMuted">The tape does not hold a session's book for {ticker} yet, so there is no day to draw.</p>
      ) : (
        <>
          <div className="mx-5 px-3 py-2 border-y border-borderSubtle/60 font-mono text-[11px] leading-snug min-h-[34px] flex items-center" data-timeline-read>
            {read ? (
              <span className="text-textSecondary">
                <span className="font-bold text-[12px] text-textPrimary tnum">{minuteLabel(read.minute)}</span>
                <span className="text-textMuted"> · </span>
                net GEX <span style={{ color: read.netGex > 0 ? SHORT_GAMMA : read.netGex < 0 ? LONG_GAMMA : INK }}>{usdCompact(read.netGex)}</span>, {leanOf(read.netGex)}
                <span className="text-textMuted"> · </span>
                {read.flipPct == null || read.flip == null ? 'no flip on the book' : `price ${pct(Math.abs(read.flipPct))} ${read.flipPct >= 0 ? 'above' : 'below'} the flip at ${read.flip.toFixed(2)}`}
              </span>
            ) : (
              <span className="text-textMuted">Point at a minute for the book as it stood</span>
            )}
          </div>
          <div
            ref={box}
            className="relative mx-5 mt-2 mb-1 outline-none focus-visible:ring-2 focus-visible:ring-silver/60 rounded-sm"
            tabIndex={0}
            role="group"
            aria-label={`The dealers' book through the session for ${ticker}: ${sentence} Left and right arrows read a minute.`}
            onPointerMove={e => pointAt(e.clientX)}
            onPointerLeave={() => setAt(null)}
            onKeyDown={onKey}
            onBlur={() => setAt(null)}
            data-timeline-points={pts.length}
          >
            {w > 0 && (
              <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="block" aria-hidden>
                <defs>
                  <clipPath id={`${clip}-up`}>
                    <rect x={0} y={0} width={w} height={gexMid} />
                  </clipPath>
                  <clipPath id={`${clip}-dn`}>
                    <rect x={0} y={gexMid} width={w} height={H} />
                  </clipPath>
                  <clipPath id={`${clip}-fup`}>
                    <rect x={0} y={0} width={w} height={flipMid} />
                  </clipPath>
                  <clipPath id={`${clip}-fdn`}>
                    <rect x={0} y={flipMid} width={w} height={H} />
                  </clipPath>
                </defs>
                {/* the hours */}
                {hours.map(m => (
                  <g key={m}>
                    <line x1={x(m)} x2={x(m)} y1={M.t} y2={flipTop + FLIP_H} stroke={WASH} strokeOpacity={0.05} />
                    <text x={x(m)} y={H - 5} textAnchor="middle" fontSize={10} fill={MUTED} fontFamily={FONT_SANS}>
                      {minuteLabel(m)}
                    </text>
                  </g>
                ))}
                {/* NET GEX — the middle line is nothing; put-heavy above in the amplifying ink, call-heavy below in the absorbing */}
                <line x1={M.l} x2={w - M.r} y1={gexMid} y2={gexMid} stroke={WASH} strokeOpacity={0.18} />
                <path d={gexArea} fill={SHORT_GAMMA} fillOpacity={0.16} clipPath={`url(#${clip}-up)`} />
                <path d={gexArea} fill={LONG_GAMMA} fillOpacity={0.16} clipPath={`url(#${clip}-dn)`} />
                <path d={gexPath} fill="none" stroke={LINE} strokeWidth={1.25} strokeLinejoin="round" />
                <text x={w - M.r + 8} y={M.t + 10} fontSize={11} fill={MUTED} fontFamily={FONT_SANS}>
                  net GEX
                </text>
                <text x={w - M.r + 8} y={gexMid + 4} fontSize={11} fill={INK} fontFamily={FONT_SANS} className="tnum">
                  {usdCompact(data.last.netGex)}
                </text>
                {/* FROM THE FLIP — the dashed line is the flip itself */}
                <line x1={M.l} x2={w - M.r} y1={flipMid} y2={flipMid} stroke={FLIP} strokeOpacity={0.7} strokeDasharray="3 3" />
                <path d={flipPath} fill="none" stroke={LONG_GAMMA} strokeOpacity={0.9} strokeWidth={1.25} strokeLinejoin="round" clipPath={`url(#${clip}-fup)`} />
                <path d={flipPath} fill="none" stroke={SHORT_GAMMA} strokeOpacity={0.9} strokeWidth={1.25} strokeLinejoin="round" clipPath={`url(#${clip}-fdn)`} />
                <text x={w - M.r + 8} y={flipTop + 10} fontSize={11} fill={MUTED} fontFamily={FONT_SANS}>
                  from flip
                </text>
                <text x={w - M.r + 8} y={flipMid + 4} fontSize={11} fill={INK} fontFamily={FONT_SANS} className="tnum">
                  {data.last.flipPct == null ? '—' : pctSigned(data.last.flipPct)}
                </text>
                {/* the minute in hand */}
                {read && (
                  <g>
                    <line x1={x(read.minute)} x2={x(read.minute)} y1={M.t} y2={flipTop + FLIP_H} stroke={INK} strokeOpacity={0.4} />
                    <circle cx={x(read.minute)} cy={yGex(read.netGex)} r={3} fill={INK} />
                    {read.flipPct != null && <circle cx={x(read.minute)} cy={yFlip(read.flipPct)} r={3} fill={INK} />}
                  </g>
                )}
              </svg>
            )}
          </div>
          <p className="px-5 pt-1 pb-4 text-[12px] leading-relaxed text-textSecondary" data-timeline-sentence>
            {sentence}
          </p>
        </>
      )}
    </section>
  );
};

export default DealerTimeline;
