/*
==================================================
  SLAYER TERMINAL - OPEN INTEREST OVERNIGHT
  (components/levels/OiChange.tsx)

  Box 3 of the Building page (the ideas' rank 6,
  2026-10-09). One row per strike, mirrored: the
  puts' change grows left of the strike, the calls'
  right. Added is the bull ink, closed out the bear
  ink — the change's direction, the one thing the
  pair means on Pinpoint (PP-23); which leg it is
  says the side of the strike. The figure beside
  each bar is the contracts. A row keeps the strike
  for every box on the page, by mouse or the keys.
  data/oiChange.ts holds the arithmetic.
==================================================
*/

import { useState, type ReactNode } from 'react';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import SpotRule from '../ui/SpotRule';
import { rowProps } from '../ui/rowKeys';
import { BULL, PUT_WALL } from '../gex/paletteInk';
import { inWindow } from '../../data/pinpointBook';
import type { OiChange as OiChangeData, OiChangeRow } from '../../data/oiChange';

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const fmtN = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const ROW_H = 22;

interface Props {
  data: OiChangeData | null;
  ticker: string;
  /** The room's strike window — which rows are drawn */
  window: number;
  focus?: number | null;
  onPick?: (strike: number) => void;
  scope?: ReactNode;
}

/** One leg's change as a bar from the strike outward — left for the puts, right for the calls */
const Leg = ({ v, max, side }: { v: number; max: number; side: 'left' | 'right' }) => {
  const w = Math.min(1, Math.abs(v) / max);
  const ink = v >= 0 ? BULL : PUT_WALL;
  /* the figure hugs the bar's end, out from the strike */
  const bar = v !== 0 && <span className="h-[10px] rounded-sm shrink-0" style={{ width: `calc((100% - 72px) * ${w.toFixed(4)})`, background: ink, opacity: 0.85 }} />;
  const fig = (
    <span className="shrink-0 font-mono text-[11px] tnum text-textSecondary whitespace-nowrap">
      {v === 0 ? '0' : fmtN(v)}
    </span>
  );
  return <div className={`h-full flex items-center gap-1.5 min-w-0 ${side === 'left' ? 'justify-end' : 'justify-start'}`}>{side === 'left' ? [<span key="f" className="contents">{fig}</span>, <span key="b" className="contents">{bar}</span>] : [<span key="b" className="contents">{bar}</span>, <span key="f" className="contents">{fig}</span>]}</div>;
};

const OiChange = ({ data, ticker, window, focus, onPick, scope }: Props) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const rows: OiChangeRow[] = data ? inWindow(data.rows, data.spot, window).sort((a, b) => b.strike - a.strike) : [];
  /* the bars' scale is the rows on screen */
  const max = Math.max(1, ...rows.map(r => Math.max(Math.abs(r.dCalls), Math.abs(r.dPuts))));
  const spotAfter = data ? rows.findIndex(r => r.strike < data.spot) : -1;
  const read = rows.find(r => r.strike === (focus ?? hover)) ?? null;

  return (
    <section className="relative flex flex-col min-w-0" data-oi-band>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read open interest overnight" testId="oi-guide" viewport>
        <div className="space-y-3 text-[13px] leading-relaxed text-textSecondary">
          <p>
            Open interest is the number of contracts still open at a strike. The exchanges count it once a day, after the close, so it moves overnight, not
            during the session.
          </p>
          <p>
            Each row is one strike. The bar to the <span className="text-textPrimary">left</span> is the change in its puts between the two last counts, the bar
            to the <span className="text-textPrimary">right</span> the change in its calls. <span style={{ color: BULL }}>Green</span> is contracts added,{' '}
            <span style={{ color: PUT_WALL }}>red</span> contracts closed out. The figure beside each bar is the contracts.
          </p>
          <p>
            What it says: where positions were opened and where they were taken off since the close before. The hedging the Map reads is built on these counts, so
            a strike that gained a lot of them overnight can stand as a wall before the day's trading shows it. It does not say who opened them or which way —
            the same contract can be a bet, a hedge or one leg of a spread.
          </p>
        </div>
      </GuideFocus>

      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">Open interest overnight</h2>
            {scope}
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the mirrored bars mean" testId="oi-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted">
            {data ? `Contracts at ${data.last}'s close against ${data.before}'s, strike by strike — puts left, calls right` : 'Contracts at the last close against the close before, strike by strike'}
          </p>
        </div>
        {data && (
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <dt className="text-[11px] text-textMuted">Calls added</dt>
              <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{fmtN(data.addedCalls)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-textMuted">Puts added</dt>
              <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{fmtN(data.addedPuts)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-textMuted">Most added</dt>
              <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{data.most ? `${fmtStrike(data.most.strike)} ${data.most.side} · ${fmtN(data.most.contracts)}` : '—'}</dd>
            </div>
          </dl>
        )}
      </div>

      {!data ? (
        <p className="px-5 pb-5 text-[12px] text-textMuted">The tape does not hold two closes for {ticker} yet, so there is no overnight change to read.</p>
      ) : (
        <>
          <div className="mx-5 px-3 py-2 border-y border-borderSubtle/60 font-mono text-[11px] leading-snug min-h-[34px] flex items-center" data-oi-read>
            {read ? (
              <span className="text-textSecondary">
                <span className="font-bold text-[12px] text-textPrimary tnum">{fmtStrike(read.strike)}</span>
                <span className="text-textMuted"> · </span>
                {read.calls.toLocaleString('en-US')} calls ({fmtN(read.dCalls)}) · {read.puts.toLocaleString('en-US')} puts ({fmtN(read.dPuts)}) open at {data.last}'s close
              </span>
            ) : (
              <span className="text-textMuted">Point at a strike for its counts</span>
            )}
          </div>
          <div className="px-5 pt-2 pb-2" onPointerLeave={() => setHover(null)}>
            <div className="grid items-center gap-x-3 font-mono text-[11px] text-textMuted" style={{ gridTemplateColumns: 'minmax(0,1fr) 72px minmax(0,1fr)' }}>
              <div className="h-[22px] flex items-center justify-end">Puts</div>
              <div className="h-[22px] flex items-center justify-center">Strike</div>
              <div className="h-[22px] flex items-center">Calls</div>
            </div>
            <div className="flex flex-col" data-oi-rows={rows.length}>
              {rows.map((r, i) => {
                const kept = focus != null && Math.abs(focus - r.strike) < 1e-9;
                return (
                  <div key={r.strike}>
                    {i === spotAfter && (
                      <div className="h-[18px] flex items-center px-1">
                        <SpotRule ticker={ticker} price={data.spot} />
                      </div>
                    )}
                    <div
                      {...rowProps(() => onPick?.(r.strike), `${fmtStrike(r.strike)}: calls ${fmtN(r.dCalls)}, puts ${fmtN(r.dPuts)} since ${data.before}'s close`)}
                      aria-pressed={kept}
                      onPointerEnter={() => setHover(r.strike)}
                      className={`grid items-center gap-x-3 rounded cursor-pointer focus-visible:outline-offset-[-2px] ${kept || hover === r.strike ? 'bg-silver/[0.06]' : ''}`}
                      style={{ gridTemplateColumns: 'minmax(0,1fr) 72px minmax(0,1fr)', height: ROW_H, boxShadow: kept ? 'inset 2px 0 0 0 rgb(var(--silver))' : undefined }}
                      data-oi-row={r.strike}
                    >
                      <Leg v={r.dPuts} max={max} side="left" />
                      <span className={`text-center font-mono text-[12px] font-semibold tnum ${kept ? 'text-silver' : 'text-textPrimary'}`}>{fmtStrike(r.strike)}</span>
                      <Leg v={r.dCalls} max={max} side="right" />
                    </div>
                  </div>
                );
              })}
              {spotAfter < 0 && (
                <div className="h-[18px] flex items-center px-1">
                  <SpotRule ticker={ticker} price={data.spot} />
                </div>
              )}
            </div>
          </div>
          <p className="px-5 pb-4 pt-2 text-[12px] leading-relaxed text-textSecondary" data-oi-sentence>
            {data.sentence}
          </p>
        </>
      )}
    </section>
  );
};

export default OiChange;
