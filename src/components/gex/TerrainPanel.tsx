/*
==================================================
  SLAYER TERMINAL - THE TERRAIN PANEL
  (components/gex/TerrainPanel.tsx)

  The strike panel beside a Terrain chart, redrawn
  (Noah, 2026-09-12: "the side strike panel should
  be deleted because the current design should
  look more a bit like this" — two photos). Two
  faces on one panel, a tab apart:

  THE LADDER — the Strike Pressure Ladder, the
  desk's own: every strike a row, put and call
  hedging as bars from a centre line with the
  figures riding their ends, net, open interest,
  volume and the part the strike plays; the spine
  contour over the bars, its ghost at the open;
  the spot and the flip as pills centred on their
  rules; one hover card. It folds as the pane
  narrows — four charts up, the net, OI and volume
  go and the bars stay ("depending if someone has
  4 charts or 1 you can remove the net old volume
  and xyz") — and it never shrinks into slivers.

  THE NET STRIP — the second photo: one figure per
  strike, the chosen greek's net, a tiny dashed
  put/call bar under it, the walls, the pin and the
  supreme tagged on their strikes, a solid rule at
  the spot and dashed rules at the walls; a hover
  card with the read (which leg is heavy, what the
  sign means for dealers, whether the exposure is
  building or draining, the legs, the other greeks,
  the sum from spot to the strike) and a sparkline
  of the strike over the CHART'S OWN TIMEFRAME —
  15m on a 15m chart, an hour on an hourly ("make
  sure it syncs with whatever time frame the person
  has their chart on"). GEX, DEX, VEX, vanna and
  charm interchange on one card.

  IT NEVER BECOMES BLOBS. The strip counts the rows
  its height can hold at a readable pitch and shows
  THAT many, the nearest to spot, with the rest
  counted at the edges — a small panel shows fewer
  strikes, not smaller ones. The width is clamped
  between a floor the columns can live at and a
  share of the pane, on a grip at the left edge.

  Nothing here re-measures per tick: the profile is
  rebuilt on the desk's revision, the rows are
  keyed by strike, and a timeframe change swaps the
  series without touching the layout — no jitter.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { X } from 'lucide-react';
import Simulator from '../../core/simulator';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import { netSinceOpenRatio } from '../../data/levelview';
import { fmtUsd } from '../../data/gex';
import { tfMinutes, type Timeframe } from '../../data/timeframe';
import { GREEK_LABEL, GREEK_OPTIONS, GREEK_WORDS, type Greek } from '../../data/compare';
import StrikePressureLadder from './StrikePressureLadder';
import { ladderExpiryOptions, LADDER_RANGES } from './ladderControls';
import { CALL_SIDE, PUT_SIDE } from './palette';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME, alpha } from './paletteInk';
import CardTabs from '../ui/CardTabs';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import HoverReadout from '../ui/HoverReadout';
import SpotRule from '../ui/SpotRule';
import type { ExposureExpiry, ExposureProfileData, StrikeExposure } from '../../types/gex';

export type PanelMode = 'ladder' | 'strip';
export type PanelGreek = Greek;

/** The narrowest the panel is drawn — the strip's two columns, the ladder's strike and bars */
export const PANEL_MIN_W = 240;
/** A fresh pane's panel — the ladder with its figures, the strip with room for its bars */
export const PANEL_DEFAULT_W = 400;
/** The widest — a share of the pane, so the panel can never swallow its own chart */
export const PANEL_MAX_SHARE = 0.6;
/** THE DEFAULT FOLLOWS THE DESK (Noah, 2026-09-12: "depending if someone has
    4 charts or 1"): one chart carries the whole ladder, two carry the bars
    with their figures, three or four carry the strike and the bars — the
    chart keeps most of its pane whatever the count. */
export const panelDefaultW = (paneCount: number): number => (paneCount <= 1 ? PANEL_DEFAULT_W : paneCount === 2 ? 340 : 280);

const MODE_OPTIONS = [
  { value: 'ladder', label: 'Ladder' },
  { value: 'strip', label: 'Net' },
] as const;
const GREEK_DROP: DropdownOption<PanelGreek>[] = GREEK_OPTIONS.map(g => ({ value: g.value, label: g.label, hint: g.hint }));
const RANGE_OPTIONS: DropdownOption<StrikeWindow>[] = LADDER_RANGES.map(r => ({ value: r, label: `${r} each side`, hint: r === 30 ? 'The whole book' : `${r} strikes above spot and ${r} below` }));

/* ---- the strip's words ------------------------------------------------------------- */

const NET_NAME: Record<PanelGreek, string> = { gex: 'Net gamma', dex: 'Net delta', vex: 'Net vega', vanna: 'Net vanna', charm: 'Net charm' };
/** What the sign means for dealers, in the strip's caps — gamma's push, delta's lean, the rest their own (data/compare's words, said of dealers) */
const SIGN_WORDS: Record<PanelGreek, { pos: string; neg: string }> = {
  gex: { pos: 'Dealer long gamma · dips absorbed', neg: 'Dealer short gamma · moves amplified' },
  dex: { pos: 'Dealers lean long · they sell a rise', neg: 'Dealers lean short · they buy a fall' },
  vex: { pos: 'Dealers long vol · gain if vol rises', neg: 'Dealers short vol · gain if vol falls' },
  vanna: { pos: 'A vol drop makes them buy', neg: 'A vol drop makes them sell' },
  charm: { pos: 'The clock makes them sell', neg: 'The clock makes them buy' },
};
const legOf = (s: StrikeExposure, g: PanelGreek) => s[g];
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const tfWords = (tf: Timeframe) => tf;

/* ---- the strip's series — the chart's timeframe, off the same history the chart draws --- */

interface StripSeries {
  /** strike → the greek's net, oldest first, over the chart's timeframe */
  byStrike: Map<number, number[]>;
  /** How far back the first point sits, in the reader's words */
  agoWords: string;
  /** The greek keeps a history at all (gamma, delta and vega do) */
  hasHistory: boolean;
}

function seriesFor(sym: string, greek: PanelGreek, tf: Timeframe): StripSeries {
  const hasHistory = greek === 'gex' || greek === 'dex' || greek === 'vex';
  const empty: StripSeries = { byStrike: new Map(), agoWords: `${tfWords(tf)} ago`, hasHistory };
  if (!hasHistory) return empty;
  const snaps = Simulator.getGexHistory(sym) ?? [];
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
      const v = greek === 'gex' ? l.value : greek === 'dex' ? (l.dex ?? 0) : (l.vex ?? 0);
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

interface StripProps {
  sym: string;
  profile: ExposureProfileData;
  greek: PanelGreek;
  timeframe: Timeframe;
  revision: number;
  width: number;
  focusPrice?: number | null;
  onSelect?: (price: number) => void;
}

const NetStrip = ({ sym, profile, greek, timeframe, revision, width, focusPrice, onSelect }: StripProps) => {
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
    /* centre on the spot's gap: half above, half below */
    const centre = Math.max(0, Math.min(strikes.length - 1, spotAfterIndex >= 0 ? spotAfterIndex + 0.5 : strikes.length / 2));
    let start = Math.round(centre - fit / 2);
    start = Math.max(0, Math.min(strikes.length - fit, start));
    return { shown: strikes.slice(start, start + fit), above: start, below: strikes.length - (start + fit), first: start };
  }, [strikes, fit, spotAfterIndex]);
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

  const focusRow = focusPrice != null ? strikes.find(s => Math.abs(s.strike - focusPrice) < 1e-9) ?? null : null;
  const footRow = hover?.row ?? focusRow ?? strikes.find(s => s.strike === levels.supreme) ?? null;
  const tfLabel = tfWords(timeframe);

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-net-strip data-greek={greek} data-timeframe={timeframe}>
      {/* THE CAPTION — the photo's one line: STRIKE | NET GEX · the chart's timeframe */}
      <div className="shrink-0 grid grid-cols-[64px_1fr] items-center h-6 px-2 border-b border-borderSubtle bg-chip select-none font-mono text-[9px] uppercase tracking-widest text-textSecondary">
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
                className={`grid grid-cols-[64px_1fr] items-center px-2 transition-colors ${focused ? 'bg-silver/[0.08]' : hover?.row.strike === s.strike ? 'bg-ink/[0.04]' : s.strike === levels.supreme ? 'bg-supreme/[0.08]' : ''} ${
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
                  <span className="font-mono text-[11px] font-semibold tnum text-textPrimary">{fmtStrike(s.strike)}</span>
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
          <span className="text-textSecondary">hover a strike</span>
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
                    <div className="text-[9px] text-textSecondary">{series.hasHistory ? 'no history on this timeframe yet' : `${GREEK_LABEL[greek]} keeps no history yet — the figure is the latest read`}</div>
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

/* ---- the panel ---------------------------------------------------------------------- */

interface TerrainPanelProps {
  ticker: string;
  /** The desk's scan clock — the profile and the series rebuild on it */
  revision: number;
  /** The chart's timeframe beside this panel — the strip's window */
  timeframe: Timeframe;
  mode: PanelMode;
  onMode: (m: PanelMode) => void;
  greek: PanelGreek;
  onGreek: (g: PanelGreek) => void;
  expiry: ExposureExpiry;
  onExpiry: (e: ExposureExpiry) => void;
  range: StrikeWindow;
  onRange: (r: StrikeWindow) => void;
  /** Drawn at this width, with a grip on the left edge reporting the new width on release; 0 = a share of the pane */
  width: number;
  onWidth: (px: number) => void;
  onClose: () => void;
  closeHint?: string;
  focusPrice?: number | null;
  onSelect?: (price: number) => void;
  className?: string;
}

const TerrainPanel = ({ ticker, revision, timeframe, mode, onMode, greek, onGreek, expiry, onExpiry, range, onRange, width, onWidth, onClose, closeHint = 'Hide this panel', focusPrice, onSelect, className = '' }: TerrainPanelProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sym = useMemo(() => Simulator.ensureTicker(ticker), [ticker]);
  const snapshot = useMemo(() => Simulator.snapshotFor(ticker), [ticker, revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const profile = useMemo(() => {
    try {
      return buildExposureProfile(snapshot, expiry, range);
    } catch {
      return null;
    }
  }, [snapshot, expiry, range]);
  const openRatio = useMemo(() => netSinceOpenRatio(ticker), [ticker, revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const expiryOptions = useMemo(() => ladderExpiryOptions(), []);

  /* THE GRIP — the ProfilePanel's: local while held, committed on release,
     the ceiling re-applied on every render so a panel widened in the
     fullscreen pane cannot swallow its chart when the pane collapses */
  const [dragW, setDragW] = useState<number | null>(null);
  const [hostW, setHostW] = useState(0);
  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host) return;
    setHostW(host.getBoundingClientRect().width);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setHostW(e.contentRect.width);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  const maxW = hostW > 0 ? Math.max(PANEL_MIN_W, Math.round(hostW * PANEL_MAX_SHARE)) : Number.POSITIVE_INFINITY;
  /* No width set (a fresh pane): a share of the pane's REAL width, floored
     at the columns' minimum and capped at the whole ladder — three charts on
     a laptop get the narrow rail, one chart on a wide screen the full one */
  const autoW = hostW > 0 ? Math.round(Math.max(PANEL_MIN_W, Math.min(PANEL_DEFAULT_W, hostW * 0.38))) : width > 0 ? width : PANEL_MIN_W;
  const shownW = Math.max(PANEL_MIN_W, Math.min(dragW ?? (width > 0 ? width : autoW), maxW));
  const onGripDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const root = rootRef.current;
    if (!root) return;
    const startX = e.clientX;
    const startW = root.getBoundingClientRect().width;
    const host = root.parentElement?.getBoundingClientRect().width ?? startW * 3;
    const max = Math.max(PANEL_MIN_W, Math.round(host * PANEL_MAX_SHARE));
    let last = startW;
    const move = (ev: PointerEvent) => {
      last = Math.round(Math.min(max, Math.max(PANEL_MIN_W, startW + (startX - ev.clientX))));
      setDragW(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      setDragW(null);
      onWidth(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const roomy = shownW >= 440;
  const mid = shownW >= 340;

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 flex flex-col border-l border-borderSubtle bg-panel/40 select-none ${className}`}
      style={{ width: shownW }}
      data-terrain-panel={mode}
      data-panel-greek={greek}
      aria-label={`${ticker} strikes`}
    >
      <span
        onPointerDown={onGripDown}
        onDoubleClick={() => onWidth(PANEL_DEFAULT_W)}
        role="separator"
        aria-orientation="vertical"
        aria-label="Drag to resize the panel — double-click to reset"
        title="Drag to resize · double-click to reset"
        className="absolute left-0 inset-y-0 -ml-1 w-2 z-30 cursor-col-resize hover:bg-ink/[0.10] transition-colors"
        data-panel-grip
      />
      {/* THE HEAD — the two faces, the strip's greek, the ladder's expiry and window, the way out */}
      <div className="shrink-0 flex items-center gap-2 px-2 min-h-9 py-1 border-b border-borderSubtle flex-wrap" data-panel-head>
        <CardTabs options={MODE_OPTIONS} value={mode} onChange={onMode} ariaLabel="Panel face" />
        {mode === 'strip' && <DropdownSelect label="Greek" value={greek} options={GREEK_DROP} onChange={onGreek} title="What the strip measures" testId="panel-greek" />}
        {mid && <DropdownSelect label="Expiry" value={expiry} options={expiryOptions} onChange={onExpiry} title="Which contracts the panel weighs" testId="panel-expiry" />}
        {roomy && <DropdownSelect label="Strikes" value={range} options={RANGE_OPTIONS} onChange={onRange} title="How many strikes around spot" testId="panel-strikes" />}
        <button
          type="button"
          onClick={onClose}
          title={closeHint}
          aria-label={closeHint}
          className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
          data-panel-close
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {profile ? (
        mode === 'ladder' ? (
          <div className="flex-1 min-h-0 flex flex-col" data-panel-ladder>
            <StrikePressureLadder data={profile} openRatio={openRatio} fill onPointer={() => undefined} />
          </div>
        ) : (
          <NetStrip sym={sym} profile={profile} greek={greek} timeframe={timeframe} revision={revision} width={shownW} focusPrice={focusPrice} onSelect={onSelect} />
        )
      ) : (
        <div className="flex-1 grid place-items-center font-mono text-[11px] text-textSecondary">No exposure for {ticker}</div>
      )}
    </div>
  );
};

export default TerrainPanel;
