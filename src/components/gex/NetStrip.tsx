/*
==================================================
  SLAYER TERMINAL - THE NET STRIP
  (components/gex/NetStrip.tsx)

  One figure per strike — the chosen greek's net —
  with a tiny dashed put/call bar under it, the
  walls, the pin and the supreme tagged on their
  strikes, a solid rule at the spot and dashed
  rules at the walls; a hover card with the read
  (which leg is heavy, what the sign means for
  dealers, whether the exposure is building or
  draining, the legs, the other greeks, the sum
  from spot to the strike) and a sparkline of the
  strike over the host's window — the chart's
  timeframe on Terrain, the Map's on Pinpoint.

  TWO HOSTS, ONE DRAWING (Noah, 2026-09-12 and
  2026-09-13): the Terrain pane's second face, and
  the Pinpoint board under the Map — five of these
  side by side, one greek each, "where you just
  see the gex/dex/vex/vanna/charm easily because
  its an information thing". Pulled out of the
  Terrain panel so the two can never drift.

  IT NEVER BECOMES BLOBS. The strip counts the rows
  its height can hold at a readable pitch and shows
  THAT many, the nearest to spot (or to the strike
  in focus), with the rest counted at the edges —
  a small host shows fewer strikes, not smaller
  ones. Nothing re-measures per tick: the series is
  rebuilt on the host's revision and the rows are
  keyed by strike.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import Simulator from '../../core/simulator';
import { fmtUsd } from '../../data/gex';
import { tfMinutes, type Timeframe } from '../../data/timeframe';
import { GREEK_LABEL, GREEK_WORDS, type Greek } from '../../data/compare';
import { CALL_SIDE, PUT_SIDE } from './palette';
import { CALL_WALL, PUT_WALL, SUPREME, alpha } from './paletteInk';
import HoverReadout from '../ui/HoverReadout';
import SpotRule from '../ui/SpotRule';
import type { ExposureProfileData, StrikeExposure } from '../../types/gex';

export type PanelGreek = Greek;

/* ---- the strip's words ------------------------------------------------------------- */

export const NET_NAME: Record<PanelGreek, string> = { gex: 'Net gamma', dex: 'Net delta', vex: 'Net vega', vanna: 'Net vanna', charm: 'Net charm' };
/** What the sign means for dealers, in the strip's caps — gamma's push, delta's lean, the rest their own (data/compare's words, said of dealers) */
export const SIGN_WORDS: Record<PanelGreek, { pos: string; neg: string }> = {
  gex: { pos: 'Dealer long gamma · dips absorbed', neg: 'Dealer short gamma · moves amplified' },
  dex: { pos: 'Dealers lean long · they sell a rise', neg: 'Dealers lean short · they buy a fall' },
  vex: { pos: 'Dealers long vol · gain if vol rises', neg: 'Dealers short vol · gain if vol falls' },
  vanna: { pos: 'A vol drop makes them buy', neg: 'A vol drop makes them sell' },
  charm: { pos: 'The clock makes them sell', neg: 'The clock makes them buy' },
};
export const legOf = (s: StrikeExposure, g: PanelGreek) => s[g];
/** The greek's unit — what one bar of it is per (the board's foot, 2026-09-13) */
export const UNIT_WORDS: Record<PanelGreek, string> = { gex: 'per 1% move', dex: 'per 1σ move', vex: 'per 1% vol', vanna: 'per 1% vol', charm: 'per 1 day' };
export const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const tfWords = (tf: Timeframe) => tf;

/* ---- the strip's series — the chart's timeframe, off the same history the chart draws --- */

interface StripSeries {
  /** strike → the greek's net, oldest first, over the chart's timeframe */
  byStrike: Map<number, number[]>;
  /** How far back the first point sits, in the reader's words */
  agoWords: string;
  /** The history carries this greek — every snapshot since 2026-09-13 does; an older fold may not */
  hasHistory: boolean;
}

const LEVEL_KEY: Record<PanelGreek, 'value' | 'dex' | 'vex' | 'vanna' | 'charm'> = { gex: 'value', dex: 'dex', vex: 'vex', vanna: 'vanna', charm: 'charm' };

export function seriesFor(sym: string, greek: PanelGreek, tf: Timeframe): StripSeries {
  const key = LEVEL_KEY[greek];
  const snaps = Simulator.getGexHistory(sym) ?? [];
  /* the greek has a history when the latest snapshot carries it — the
     simulator records all five per minute; a fold from before it did reads
     as no history rather than as a flat line of zeros */
  const hasHistory = snaps.length > 0 && snaps[snaps.length - 1].levels.some(l => typeof l[key] === 'number');
  const empty: StripSeries = { byStrike: new Map(), agoWords: `${tfWords(tf)} ago`, hasHistory };
  if (!hasHistory) return empty;
  const latest = snaps[snaps.length - 1];
  if (!latest) return empty;
  const windowSec = tf === '1W' ? Number.POSITIVE_INFINITY : tfMinutes(tf) * 60;
  const from = latest.time - windowSec;
  let slice = snaps.filter(s => s.time >= from);
  /* at least two points, or there is no line to draw */
  if (slice.length < 2) slice = snaps.slice(-2);
  /* at most forty points — the card's line is 240px wide */
  if (slice.length > 40) {
    const step = (slice.length - 1) / 39;
    slice = Array.from({ length: 40 }, (_, i) => slice[Math.round(i * step)]);
  }
  const byStrike = new Map<number, number[]>();
  for (const snap of slice) {
    for (const l of snap.levels) {
      const v = l[key] ?? 0;
      const arr = byStrike.get(l.strike);
      if (arr) arr.push(v);
      else byStrike.set(l.strike, [v]);
    }
  }
  const spanSec = latest.time - (slice[0]?.time ?? latest.time);
  const agoWords = spanSec >= 86400 * 2 ? `${Math.round(spanSec / 86400)}d ago` : spanSec >= 3600 * 2 ? `${Math.round(spanSec / 3600)}h ago` : spanSec >= 60 ? `${Math.round(spanSec / 60)}m ago` : `${Math.round(spanSec)}s ago`;
  return { byStrike, agoWords, hasHistory };
}

/** A strike's line over the window — 240 × 40, the card's own sparkline */
const Spark = ({ values }: { values: number[] }) => {
  const W = 240;
  const H = 40;
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (W - 2) + 1).toFixed(1)},${(H - 3 - ((v - lo) / span) * (H - 6)).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" aria-hidden>
      <polyline points={pts} fill="none" stroke="rgba(237,237,237,0.8)" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

/* ---- the strip ------------------------------------------------------------------------ */

/** A row must have this much — the figure and its bar */
const PITCH_MIN = 22;
/** More than this and the rows are just spread out */
const PITCH_MAX = 42;
/** The bar folds under a row this short; the figure stays */
const BAR_BELOW = 27;
const RULE_H = 18;
const EDGE_BAND = 14;

export interface NetStripProps {
  sym: string;
  profile: ExposureProfileData;
  greek: PanelGreek;
  timeframe: Timeframe;
  revision: number;
  width: number;
  focusPrice?: number | null;
  onSelect?: (price: number) => void;
  /** The window centres on the strike in focus instead of the spot (the board's Focus, 2026-09-13) */
  centreOnFocus?: boolean;
  /** The strike column's unit: the price, its distance in %, in ATRs, or in expected-move σ (the board's $ % ATR σ) */
  strikeAs?: 'price' | 'pct' | 'atr' | 'sigma';
  /** One σ and one ATR in dollars, for the σ and ATR units */
  sigma?: number;
  atr?: number;
}

const NetStrip = ({ sym, profile, greek, timeframe, revision, width, focusPrice, onSelect, centreOnFocus = false, strikeAs = 'price', sigma, atr }: NetStripProps) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [listH, setListH] = useState(0);
  const [hover, setHover] = useState<{ row: StrikeExposure; x: number; y: number } | null>(null);
  const { strikes, levels, spotAfterIndex } = profile;
  const maxAbs = Math.max(1, profile.maxAbs[greek]);

  /* The list's height — read on resize, never per tick */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const read = () => setListH(el.clientHeight);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* The series over the chart's timeframe — rebuilt on the desk's revision, so
     a timeframe switch swaps lines without a single re-measure */
  const series = useMemo(() => seriesFor(sym, greek, timeframe), [sym, greek, timeframe, revision]); // eslint-disable-line react-hooks/exhaustive-deps

  /* HOW MANY ROWS FIT: the nearest to spot, the rest counted at the edges */
  const spotInside = spotAfterIndex >= 0 && spotAfterIndex < strikes.length - 1;
  const rulesH = spotInside ? RULE_H : 0;
  const room = Math.max(0, listH - rulesH - EDGE_BAND * 2);
  const fit = Math.max(3, Math.floor(room / PITCH_MIN));
  const { shown, above, below, first } = useMemo(() => {
    if (strikes.length <= fit) return { shown: strikes, above: 0, below: 0, first: 0 };
    /* centre on the spot's gap: half above, half below — or on the strike in focus */
    const focusIdx = centreOnFocus && focusPrice != null ? strikes.findIndex(s => Math.abs(s.strike - focusPrice) < 1e-9) : -1;
    const centre = focusIdx >= 0 ? focusIdx : Math.max(0, Math.min(strikes.length - 1, spotAfterIndex >= 0 ? spotAfterIndex + 0.5 : strikes.length / 2));
    let start = Math.round(centre - fit / 2);
    start = Math.max(0, Math.min(strikes.length - fit, start));
    return { shown: strikes.slice(start, start + fit), above: start, below: strikes.length - (start + fit), first: start };
  }, [strikes, fit, spotAfterIndex, centreOnFocus, focusPrice]);
  const pitch = shown.length ? Math.max(PITCH_MIN, Math.min(PITCH_MAX, Math.floor(room / shown.length))) : PITCH_MIN;
  const showBar = pitch >= BAR_BELOW && width >= 200;

  const totalAbs = useMemo(() => strikes.reduce((a, s) => a + Math.abs(legOf(s, greek).net), 0) || 1, [strikes, greek]);
  /* The sum of the nets between the spot and a strike — what a move there crosses */
  const fromSpot = (idx: number): number => {
    const s = spotAfterIndex;
    let sum = 0;
    if (idx <= s) for (let i = idx; i <= s; i++) sum += legOf(strikes[i], greek).net;
    else for (let i = s + 1; i <= idx; i++) sum += legOf(strikes[i], greek).net;
    return sum;
  };
  const tagsOf = (s: StrikeExposure): { word: string; ink: string; star?: boolean }[] => {
    const out: { word: string; ink: string; star?: boolean }[] = [];
    if (s.strike === levels.callWall) out.push({ word: 'CW', ink: CALL_WALL });
    if (s.strike === levels.putWall) out.push({ word: 'PW', ink: PUT_WALL });
    if (s.strike === levels.pin) out.push({ word: 'PIN', ink: '#C7D3E8' });
    if (s.strike === levels.supreme) out.push({ word: 'SUP', ink: SUPREME, star: true });
    return out;
  };
  const inkOf = (v: number) => (v < 0 ? CALL_SIDE : v > 0 ? PUT_SIDE : '#ededed');
  /** The strike in the chosen unit — the price, or its distance from spot */
  const strikeLabel = (strike: number): string => {
    const d = strike - levels.spot;
    if (strikeAs === 'pct') return `${d >= 0 ? '+' : ''}${((d / levels.spot) * 100).toFixed(2)}%`;
    if (strikeAs === 'atr' && atr) return `${d >= 0 ? '+' : ''}${(d / atr).toFixed(2)} ATR`;
    if (strikeAs === 'sigma' && sigma) return `${d >= 0 ? '+' : ''}${(d / sigma).toFixed(2)}σ`;
    return fmtStrike(strike);
  };

  const focusRow = focusPrice != null ? strikes.find(s => Math.abs(s.strike - focusPrice) < 1e-9) ?? null : null;
  const footRow = hover?.row ?? focusRow ?? strikes.find(s => s.strike === levels.supreme) ?? null;
  const tfLabel = tfWords(timeframe);

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ ['--strike-col' as string]: strikeAs === 'price' ? '64px' : '84px' }} data-net-strip data-greek={greek} data-timeframe={timeframe} data-strike-as={strikeAs}>
      {/* THE CAPTION — the photo's one line: STRIKE | NET GEX · the chart's timeframe */}
      <div className="shrink-0 grid grid-cols-[var(--strike-col)_1fr] items-center h-6 px-2 border-b border-borderSubtle bg-chip select-none font-mono text-[9px] uppercase tracking-widest text-textSecondary">
        <span>Strike</span>
        <span className="pl-2 border-l border-borderSubtle">
          {NET_NAME[greek].replace('Net ', 'Net ')}
          <span className="ml-1.5 text-textMuted normal-case tracking-normal">{tfLabel} → now</span>
        </span>
      </div>
      <div ref={listRef} className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* the rows above the window, counted */}
        <div className="shrink-0 flex items-center justify-center font-mono text-[9px] text-textSecondary tnum" style={{ height: EDGE_BAND }}>
          {above > 0 ? `▲ ${above}` : ''}
        </div>
        {shown.map((s, k) => {
          const idx = first + k;
          const leg = legOf(s, greek);
          const v = leg.net;
          const put = Math.abs(leg.put);
          const call = Math.abs(leg.call);
          const gross = put + call || 1;
          const len = 24 + Math.round((Math.abs(v) / maxAbs) * Math.max(40, Math.min(140, width - 130)));
          const tags = tagsOf(s);
          const isSpotRow = spotInside && idx === spotAfterIndex;
          const dashedBelow = s.strike === levels.callWall && !isSpotRow;
          const dashedAbove = s.strike === levels.putWall && idx > 0 && !(spotInside && idx === spotAfterIndex + 1);
          const focused = focusRow?.strike === s.strike;
          return (
            <div key={s.strike} className="shrink-0 flex flex-col">
              <div
                className={`grid grid-cols-[var(--strike-col)_1fr] items-center px-2 transition-colors ${focused ? 'bg-silver/[0.08]' : hover?.row.strike === s.strike ? 'bg-ink/[0.04]' : s.strike === levels.supreme ? 'bg-supreme/[0.08]' : ''} ${
                  dashedAbove ? 'border-t border-dashed border-ink/25' : ''
                } ${dashedBelow ? 'border-b border-dashed border-ink/25' : ''}`}
                style={{ height: pitch, cursor: onSelect ? 'pointer' : undefined }}
                data-strip-strike={s.strike}
                onMouseEnter={e => setHover({ row: s, x: e.clientX, y: e.clientY })}
                onMouseMove={e => setHover({ row: s, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(s.strike)}
              >
                <span className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-[11px] font-semibold tnum text-textPrimary whitespace-nowrap" title={strikeAs === 'price' ? undefined : fmtStrike(s.strike)}>{strikeLabel(s.strike)}</span>
                  {tags.slice(0, 1).map(t => (
                    <span key={t.word} className="font-mono text-[8px] font-bold tracking-wider whitespace-nowrap" style={{ color: t.ink }}>
                      {t.word}
                      {t.star ? ' ★' : ''}
                    </span>
                  ))}
                </span>
                <span className="flex flex-col justify-center gap-[3px] pl-2 border-l border-borderSubtle min-w-0">
                  <span className="font-mono text-[11px] font-semibold tnum whitespace-nowrap" style={{ color: inkOf(v) }}>
                    {fmtUsd(v)}
                  </span>
                  {showBar && (
                    /* the tiny dashed bar: the put share then the call share of the legs */
                    <span className="flex h-[3px]" style={{ width: len }} aria-hidden>
                      <span style={{ width: `${(put / gross) * 100}%`, background: `repeating-linear-gradient(90deg, ${PUT_SIDE} 0 5px, transparent 5px 8px)` }} />
                      <span style={{ width: `${(call / gross) * 100}%`, background: `repeating-linear-gradient(90deg, ${CALL_SIDE} 0 5px, transparent 5px 8px)` }} />
                    </span>
                  )}
                </span>
              </div>
              {isSpotRow && (
                <div className="shrink-0 px-2 flex items-center" style={{ height: RULE_H }}>
                  <SpotRule ticker={sym} price={levels.spot} />
                </div>
              )}
            </div>
          );
        })}
        <div className="shrink-0 flex items-center justify-center font-mono text-[9px] text-textSecondary tnum" style={{ height: EDGE_BAND }}>
          {below > 0 ? `▼ ${below}` : ''}
        </div>
      </div>
      {/* THE FOOT — the strike in hand: its legs and its share of the window */}
      <div className="shrink-0 flex items-center gap-3 px-2 h-6 border-t border-borderSubtle font-mono text-[9px] tnum whitespace-nowrap overflow-hidden" data-strip-foot>
        {footRow ? (
          <>
            <span className="text-[10px] font-bold text-textPrimary">{fmtStrike(footRow.strike)}</span>
            <span className="text-textSecondary">
              PUT <span style={{ color: PUT_SIDE }}>{fmtUsd(legOf(footRow, greek).put)}</span>
            </span>
            <span className="text-textSecondary">
              CALL <span style={{ color: CALL_SIDE }}>{fmtUsd(legOf(footRow, greek).call)}</span>
            </span>
            <span className="text-textSecondary">
              SHARE <span className="text-textPrimary">{((Math.abs(legOf(footRow, greek).net) / totalAbs) * 100).toFixed(1)}%</span>
            </span>
          </>
        ) : (
          <span className="text-textSecondary">
            FULL BAR <span className="text-textPrimary">{fmtUsd(maxAbs)}</span> {UNIT_WORDS[greek]}
          </span>
        )}
      </div>

      {hover && (
        <HoverReadout x={hover.x} y={hover.y}>
          {(() => {
            const s = hover.row;
            const idx = strikes.indexOf(s);
            const leg = legOf(s, greek);
            const v = leg.net;
            const callHeavy = Math.abs(leg.call) >= Math.abs(leg.put);
            const line = series.byStrike.get(s.strike) ?? [];
            const a0 = Math.abs(line[0] ?? v);
            const a1 = Math.abs(line[line.length - 1] ?? v);
            const trend = a0 === 0 ? 'holding' : a1 > a0 * 1.05 ? 'building' : a1 < a0 * 0.95 ? 'draining' : 'holding';
            const cum = fromSpot(idx);
            const others = (['gex', 'dex', 'vex'] as PanelGreek[]).filter(g => g !== greek).slice(0, 2);
            return (
              <div className="w-[264px] font-mono" data-strip-card={s.strike}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-textPrimary">Strike {fmtStrike(s.strike)}</span>
                  <span
                    className="inline-flex items-center rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: callHeavy ? CALL_SIDE : PUT_SIDE, borderColor: alpha(callHeavy ? CALL_SIDE : PUT_SIDE, 0.5), background: alpha(callHeavy ? CALL_SIDE : PUT_SIDE, 0.08) }}
                  >
                    {callHeavy ? 'Call-heavy' : 'Put-heavy'}
                  </span>
                </div>
                <div className="mt-2 text-[9px] uppercase tracking-widest text-textSecondary">{NET_NAME[greek]}</div>
                <div className="text-[18px] font-bold tnum leading-tight" style={{ color: inkOf(v) }}>
                  {fmtUsd(v)}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-textPrimary">{v >= 0 ? SIGN_WORDS[greek].pos : SIGN_WORDS[greek].neg}</div>
                <div className="text-[10px] uppercase tracking-wider text-textSecondary">
                  {trend === 'building' ? '↗ exposure building' : trend === 'draining' ? '↘ exposure draining' : '→ exposure holding'}
                </div>
                <div className="mt-2 grid grid-cols-4 gap-x-2 text-[10px] tnum">
                  <span className="text-textSecondary">C</span>
                  <span className="text-textSecondary">P</span>
                  {others.map(g => (
                    <span key={g} className="text-textSecondary">
                      {GREEK_LABEL[g]}
                    </span>
                  ))}
                  <span style={{ color: CALL_SIDE }}>{fmtUsd(leg.call)}</span>
                  <span style={{ color: PUT_SIDE }}>{fmtUsd(leg.put)}</span>
                  {others.map(g => (
                    <span key={g} className="text-textPrimary">
                      {fmtUsd(legOf(s, g).net)}
                    </span>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-borderSubtle text-[9px] uppercase tracking-wider text-textSecondary whitespace-nowrap">
                  From spot to {fmtStrike(s.strike)} · <span style={{ color: inkOf(cum) }}>{fmtUsd(cum)}</span> · {cum >= 0 ? GREEK_WORDS[greek].pos : GREEK_WORDS[greek].neg}
                </div>
                <div className="mt-2">
                  {series.hasHistory && line.length >= 2 ? (
                    <>
                      <Spark values={line} />
                      <div className="flex items-center justify-between text-[9px] text-textSecondary">
                        <span>{series.agoWords}</span>
                        <span>latest</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-[9px] text-textSecondary">{series.hasHistory ? 'no history on this timeframe yet' : `${GREEK_LABEL[greek]} has no history in this fold yet — the figure is the latest read`}</div>
                  )}
                </div>
              </div>
            );
          })()}
        </HoverReadout>
      )}
    </div>
  );
};


export default NetStrip;
