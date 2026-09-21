/*
==================================================
  SLAYER TERMINAL - THE GREEK BOARD
  (components/gex/GreekBoard.tsx)

  The board under the Pinpoint Map, redrawn to the
  rough draft (Noah, 2026-09-13: "the board below it
  … you just see the gex/dex/vex/vanna/charm or
  whatever else we have easily because its an
  information thing"). Up to five Net strips side
  by side, ONE GREEK EACH — the same strip the
  Terrain pane wears (components/gex/NetStrip.tsx),
  so a figure here is the figure there.

  EVERY PANEL IS ITS OWN: its name (the frame's
  until its chip unlinks it), its greek, its expiry,
  its strike window, and two faces — BARS, the
  strip; INFO, what the greek is and what the book
  says of it in plain rows. One NET line over each:
  the sum, which side dominates, what the sign does.

  THE FOOT is the board's own transport: how many
  panels (1–5), Focus (every strip centres on the
  strike in focus), Link (the panels move together —
  one expiry or window set on any of them sets all,
  and their names follow the frame), CSV (the rows
  out), the name's quote and the clock, the ruler
  the strikes are read in ($ · % · ATR · σ — the
  desk's own ruler, one choice for the whole desk),
  and the key: put-dominant, call-dominant.

  NOTHING RE-MEASURES PER TICK: the books rebuild
  on the scan snapshot, the strips size themselves
  once per resize, the clock is its own component.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Download, Link2, Link2Off, X } from 'lucide-react';
import Simulator from '../../core/simulator';
import { useFocus } from '../../context/FocusContext';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import { fmtUsd } from '../../data/gex';
import { GREEK_LABEL, GREEK_OPTIONS, GREEK_WORDS, type Greek } from '../../data/compare';
import { impliedDaySigma, sessionAtr, type DistanceUnit } from '../../data/atr';
import { setDistanceUnit, useDistanceUnit } from '../../data/distanceUnits';
import type { Timeframe } from '../../data/timeframe';
import type { ExposureExpiry, ExposureProfileData } from '../../types/gex';
import type { MarketSnapshot } from '../../types/market';
import { CALL_SIDE, PUT_SIDE } from './palette';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';
import NetStrip, { NET_NAME, SIGN_WORDS, UNIT_WORDS, fmtStrike, legOf, type PanelGreek } from './NetStrip';
import { ladderExpiryOptions } from './ladderControls';
import CardTabs from '../ui/CardTabs';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import ScopeChip from '../ui/ScopeChip';
import { Name } from '../ui/Name';

/* ---- the panels' words ------------------------------------------------------------ */

/** What the greek IS — the information face's first line */
const DEFINITION: Record<PanelGreek, string> = {
  gex: 'Gamma exposure — the dealer hedging weight at a strike. Negative is call-heavy: dealers absorb moves there. Positive is put-heavy: they amplify them.',
  dex: 'Delta exposure — the directional share risk dealers carry from the options at a strike. Positive leans long, so they sell a rise; negative leans short, so they buy a fall.',
  vex: 'Vega exposure — how much dealer books swing as implied volatility moves. Positive gains if vol rises; negative gains if vol falls.',
  vanna: 'Vanna — how dealer hedges re-price when implied volatility moves. Positive: a one-point vol drop makes them buy stock there. Negative: it makes them sell.',
  charm: 'Charm — the pull of the clock on dealer hedges. Positive: each passing day makes them sell stock there. Negative: it makes them buy.',
};
/** What the sum's sign does, in one word or two — the NET line's last words */
const SUM_WORDS: Record<PanelGreek, { pos: string; neg: string }> = {
  gex: { pos: 'damping', neg: 'amplifying' },
  dex: { pos: 'leaning long', neg: 'leaning short' },
  vex: { pos: 'long vol', neg: 'short vol' },
  vanna: { pos: 'buys on a vol drop', neg: 'sells on a vol drop' },
  charm: { pos: 'sells into the close', neg: 'buys into the close' },
};

const GREEK_DROP: DropdownOption<PanelGreek>[] = GREEK_OPTIONS.map(g => ({ value: g.value, label: g.label, hint: g.hint }));
const RANGE_DROP: DropdownOption<StrikeWindow>[] = [
  { value: 30, label: 'ALL', hint: 'The whole book — thirty strikes each side' },
  { value: 20, label: '±20', hint: 'Twenty strikes above spot and twenty below' },
  { value: 15, label: '±15', hint: 'Fifteen each side' },
  { value: 10, label: '±10', hint: 'Ten each side — the strikes in play today' },
];
const FACE_OPTIONS = [
  { value: 'bars', label: 'Bars' },
  { value: 'info', label: 'Info' },
] as const;
/** The desk's ruler as the strike column's unit */
const STRIKE_AS: Record<DistanceUnit, 'price' | 'pct' | 'atr' | 'sigma'> = { $: 'price', '%': 'pct', ATR: 'atr', σ: 'sigma' };
const UNITS: DistanceUnit[] = ['$', '%', 'ATR', 'σ'];
const GREEK_ORDER: PanelGreek[] = ['gex', 'dex', 'vex', 'vanna', 'charm'];
/** A strip is drawn no narrower than this — the two columns and the bar */
const PANEL_MIN_W = 236;

/* ---- the panels' state, held across route changes within a session ------------------ */

export type PanelFace = 'bars' | 'info';
export interface BoardPanel {
  id: number;
  greek: PanelGreek;
  expiry: ExposureExpiry;
  range: StrikeWindow;
  /** The panel's own name once its chip unlinks it from the frame */
  own?: string;
  face: PanelFace;
}
interface BoardMemory {
  panels: BoardPanel[];
  count: number;
  linked: boolean;
  focus: boolean;
}
let memory: BoardMemory | null = null;
let nextId = 1;
const freshPanel = (greek: PanelGreek, expiry: ExposureExpiry): BoardPanel => ({ id: nextId++, greek, expiry, range: 30, face: 'bars' });
const freshBoard = (expiry: ExposureExpiry): BoardMemory => ({ panels: GREEK_ORDER.map(g => freshPanel(g, expiry)), count: 5, linked: true, focus: false });

/* ---- the sums --------------------------------------------------------------------- */

interface Sums {
  net: number;
  put: number;
  call: number;
  dominant: 'put' | 'call';
  heaviest: { strike: number; net: number } | null;
  above: number;
  below: number;
}
const sumOf = (p: ExposureProfileData, greek: PanelGreek): Sums => {
  let net = 0;
  let put = 0;
  let call = 0;
  let above = 0;
  let below = 0;
  let heaviest: Sums['heaviest'] = null;
  p.strikes.forEach((s, i) => {
    const leg = legOf(s, greek);
    net += leg.net;
    put += leg.put;
    call += leg.call;
    if (i <= p.spotAfterIndex) above += leg.net;
    else below += leg.net;
    if (!heaviest || Math.abs(leg.net) > Math.abs(heaviest.net)) heaviest = { strike: s.strike, net: leg.net };
  });
  return { net, put, call, dominant: Math.abs(put) >= Math.abs(call) ? 'put' : 'call', heaviest, above, below };
};
const inkOf = (v: number) => (v < 0 ? CALL_SIDE : v > 0 ? PUT_SIDE : '#ededed');

/* ---- the clock in the foot — its own component, so only it ticks -------------------- */

const FootClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="tnum text-textSecondary">{now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' })}</span>;
};

/* ---- one panel -------------------------------------------------------------------- */

interface PanelViewProps {
  panel: BoardPanel;
  snapshot: MarketSnapshot;
  profile: ExposureProfileData | null;
  width: number;
  timeframe: Timeframe;
  revision: number;
  linked: boolean;
  centreOnFocus: boolean;
  strikeAs: 'price' | 'pct' | 'atr' | 'sigma';
  expiryOptions: DropdownOption<ExposureExpiry>[];
  onChange: (next: Partial<BoardPanel>) => void;
  onClose: () => void;
  onPickName: (t: string) => void;
}

const PanelView = ({ panel, snapshot, profile, width, timeframe, revision, linked, centreOnFocus, strikeAs, expiryOptions, onChange, onClose, onPickName }: PanelViewProps) => {
  const { focus, toggleFocus } = useFocus();
  const sym = snapshot.ticker;
  const focusPrice = focus && focus.ticker === sym ? focus.price : null;
  const scales = useMemo(
    () => ({ atr: sessionAtr(Simulator.getCandles(sym) ?? []) ?? undefined, sigma: impliedDaySigma(snapshot.spot, Simulator.TICKERS[sym]?.iv ?? 0) ?? undefined }),
    [sym, snapshot.spot]
  );
  const sums = useMemo(() => (profile ? sumOf(profile, panel.greek) : null), [profile, panel.greek]);
  const greek = panel.greek;
  return (
    <div className="relative shrink-0 flex flex-col border-r border-borderSubtle last:border-r-0 min-h-0" style={{ width }} data-board-panel={panel.id} data-panel-greek={greek} data-panel-ticker={sym}>
      {/* THE HEAD — the name, the greek, the expiry, the window, the two faces, the way out */}
      <div className="shrink-0 flex items-center gap-1 flex-wrap px-1.5 py-1 border-b border-borderSubtle" data-panel-head>
        <ScopeChip ticker={sym} linked={panel.own === undefined} onToggleLink={() => onChange({ own: panel.own === undefined ? sym : undefined })} onPick={onPickName} />
        <DropdownSelect label="Greek" value={greek} options={GREEK_DROP} onChange={g => onChange({ greek: g })} title="What this panel measures" testId={`panel-${panel.id}-greek`} />
        <DropdownSelect label="Exp" value={panel.expiry} options={expiryOptions} onChange={e => onChange({ expiry: e })} title={linked ? 'Which contracts every panel weighs (linked)' : 'Which contracts this panel weighs'} testId={`panel-${panel.id}-expiry`} />
        <DropdownSelect label="Strikes" value={panel.range} options={RANGE_DROP} onChange={r => onChange({ range: r })} title={linked ? 'How many strikes every panel shows (linked)' : 'How many strikes this panel shows'} testId={`panel-${panel.id}-range`} />
        <span className="ml-auto inline-flex items-center gap-2">
          <CardTabs options={FACE_OPTIONS} value={panel.face} onChange={f => onChange({ face: f })} ariaLabel="Panel face" />
          <button type="button" onClick={onClose} title="Close this panel" aria-label="Close this panel" className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" data-panel-close>
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      </div>
      {/* THE NET LINE — the sum, the side that dominates, what the sign does */}
      <div className="shrink-0 flex items-center gap-2 px-2 h-6 border-b border-borderSubtle/70 font-mono text-[10px] tnum whitespace-nowrap overflow-hidden" data-panel-net>
        <span className="uppercase tracking-widest text-textSecondary">Net</span>
        {sums ? (
          <>
            <span className="font-semibold" style={{ color: inkOf(sums.net) }}>
              {fmtUsd(sums.net)}
            </span>
            <span style={{ color: sums.dominant === 'put' ? PUT_SIDE : CALL_SIDE }}>{sums.dominant}-dominant</span>
            <span className="text-textSecondary">· {sums.net >= 0 ? SUM_WORDS[greek].pos : SUM_WORDS[greek].neg}</span>
          </>
        ) : (
          <span className="text-textSecondary">no book</span>
        )}
      </div>
      {!profile ? (
        <div className="flex-1 grid place-items-center px-3 text-center font-mono text-[11px] text-textSecondary">
          <span>
            No exposure for <Name t={sym} size={12} />
          </span>
        </div>
      ) : panel.face === 'bars' ? (
        <NetStrip
          sym={sym}
          profile={profile}
          greek={greek}
          timeframe={timeframe}
          revision={revision}
          width={width}
          focusPrice={focusPrice}
          onSelect={price => toggleFocus(price, sym)}
          centreOnFocus={centreOnFocus}
          strikeAs={strikeAs}
          sigma={scales.sigma}
          atr={scales.atr}
        />
      ) : (
        <PanelInfo profile={profile} greek={greek} sums={sums!} sym={sym} />
      )}
    </div>
  );
};

/* ---- the information face ------------------------------------------------------------ */

const Row = ({ label, children, ink }: { label: string; children: React.ReactNode; ink?: string }) => (
  <>
    <dt className="text-textSecondary whitespace-nowrap">{label}</dt>
    <dd className="text-textPrimary tnum min-w-0 truncate" style={ink ? { color: ink } : undefined}>
      {children}
    </dd>
  </>
);

const PanelInfo = ({ profile, greek, sums, sym }: { profile: ExposureProfileData; greek: PanelGreek; sums: Sums; sym: string }) => {
  const { levels } = profile;
  const words = GREEK_WORDS[greek];
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 text-[11px] leading-snug" data-panel-info>
      <div className="font-semibold text-textPrimary">
        {GREEK_LABEL[greek]} · {NET_NAME[greek]} on <Name t={sym} size={12} />
      </div>
      <p className="mt-1 text-textPrimary">{DEFINITION[greek]}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[10px]" data-panel-facts>
        <Row label="Net" ink={inkOf(sums.net)}>
          {fmtUsd(sums.net)} · {sums.net >= 0 ? SUM_WORDS[greek].pos : SUM_WORDS[greek].neg}
        </Row>
        <Row label="Put side" ink={PUT_SIDE}>
          {fmtUsd(sums.put)}
        </Row>
        <Row label="Call side" ink={CALL_SIDE}>
          {fmtUsd(sums.call)}
        </Row>
        <Row label="Dominant" ink={sums.dominant === 'put' ? PUT_SIDE : CALL_SIDE}>
          {sums.dominant}-dominant
        </Row>
        <Row label="Above spot" ink={inkOf(sums.above)}>
          {fmtUsd(sums.above)} · {sums.above >= 0 ? words.pos : words.neg}
        </Row>
        <Row label="Below spot" ink={inkOf(sums.below)}>
          {fmtUsd(sums.below)} · {sums.below >= 0 ? words.pos : words.neg}
        </Row>
        {sums.heaviest && (
          <Row label="Heaviest" ink={inkOf(sums.heaviest.net)}>
            {fmtStrike(sums.heaviest.strike)} · {fmtUsd(sums.heaviest.net)}
          </Row>
        )}
        <Row label="Unit">one bar {UNIT_WORDS[greek]}</Row>
        <Row label="Spot">{fmtStrike(levels.spot)}</Row>
        <Row label="Call wall" ink={CALL_WALL}>
          {fmtStrike(levels.callWall)}
        </Row>
        <Row label="Put wall" ink={PUT_WALL}>
          {fmtStrike(levels.putWall)}
        </Row>
        <Row label="Flip" ink={FLIP}>
          {fmtStrike(levels.flip)}
        </Row>
        <Row label="Pin">{fmtStrike(levels.pin)}</Row>
        <Row label="Supreme" ink={SUPREME}>
          {fmtStrike(levels.supreme)}
        </Row>
      </dl>
      <div className="mt-3 text-[9px] uppercase tracking-widest text-textSecondary">What the sign means</div>
      <ul className="mt-1 space-y-1 text-textPrimary">
        <li>
          <span style={{ color: PUT_SIDE }}>Positive</span> — {SIGN_WORDS[greek].pos.toLowerCase()}
        </li>
        <li>
          <span style={{ color: CALL_SIDE }}>Negative</span> — {SIGN_WORDS[greek].neg.toLowerCase()}
        </li>
      </ul>
      <div className="mt-3 text-[9px] uppercase tracking-widest text-textSecondary">How to read the bars</div>
      <ul className="mt-1 space-y-1 text-textPrimary">
        <li>The figure is the strike's net {NET_NAME[greek].replace('Net ', '').toLowerCase()} in dollars.</li>
        <li>The dashed bar is its size against the window's largest — the put share first, the call share after it.</li>
        <li>CW, PW, PIN and SUP ★ tag the walls, the pin and the supreme; the rule is the spot; the dashed lines are the walls.</li>
        <li>Hover a strike for its legs, the other greeks, the sum from spot, and its line over the chart's timeframe.</li>
      </ul>
    </div>
  );
};

/* ---- the board ------------------------------------------------------------------------ */

export interface GreekBoardProps {
  /** The frame's book — rewound while the Map replays */
  snapshot: MarketSnapshot;
  frameTicker: string;
  onFrameTicker: (t: string) => void;
  revision: number;
  /** The Map's timeframe — the strips' sparkline window follows it */
  timeframe: Timeframe;
  /** The Map's expiry — linked panels follow it */
  expiry: ExposureExpiry;
}

const GreekBoard = ({ snapshot, frameTicker, onFrameTicker, revision, timeframe, expiry }: GreekBoardProps) => {
  const [board, setBoard] = useState<BoardMemory>(() => memory ?? (memory = freshBoard(expiry)));
  const update = (fn: (b: BoardMemory) => BoardMemory) =>
    setBoard(prev => {
      const next = fn(prev);
      memory = next;
      return next;
    });
  const { panels, count, linked, focus: centreOnFocus } = board;
  const shown = panels.slice(0, count);
  /* The expiry as a date alone on the panel's head — the long form rides in the hint */
  const expiryOptions = useMemo<DropdownOption<ExposureExpiry>[]>(
    () =>
      ladderExpiryOptions().map(o => ({
        value: o.value,
        label: o.value === 'ALL' ? 'All' : o.value === '0DTE' ? (o.label.split(' · ')[1] ?? o.label) : o.label.split(' · ')[0],
        hint: `${o.label} — ${o.hint ?? ''}`.replace(/ — $/, ''),
      })),
    []
  );
  const unit = useDistanceUnit();
  const strikeAs = STRIKE_AS[unit];
  const { focus } = useFocus();

  /* Linked panels follow the Map's expiry */
  useEffect(() => {
    if (!linked) return;
    update(b => (b.panels.every(p => p.expiry === expiry) ? b : { ...b, panels: b.panels.map(p => ({ ...p, expiry })) }));
  }, [expiry, linked]); // eslint-disable-line react-hooks/exhaustive-deps

  /* THE BOOKS — one per shown panel, rebuilt on the scan snapshot, cached by
     name · expiry · window so a greek change on one panel rebuilds nothing */
  const cacheRef = useRef<{ snap: MarketSnapshot | null; books: Map<string, ExposureProfileData | null>; own: Map<string, MarketSnapshot> }>({ snap: null, books: new Map(), own: new Map() });
  const books = useMemo(() => {
    const c = cacheRef.current;
    if (c.snap !== snapshot) {
      c.snap = snapshot;
      c.books.clear();
      c.own.clear();
    }
    return shown.map(p => {
      let snap = snapshot;
      if (p.own && p.own !== snapshot.ticker) {
        const held = c.own.get(p.own);
        if (held) snap = held;
        else {
          try {
            snap = Simulator.snapshotFor(p.own);
            c.own.set(p.own, snap);
          } catch {
            snap = snapshot;
          }
        }
      }
      const key = `${snap.ticker}|${p.expiry}|${p.range}`;
      let profile = c.books.get(key);
      if (profile === undefined) {
        try {
          profile = buildExposureProfile(snap, p.expiry, p.range);
        } catch {
          profile = null;
        }
        c.books.set(key, profile);
      }
      return { panel: p, snap, profile };
    });
  }, [shown, snapshot]);

  /* THE WIDTH — read on resize, never per tick; the strips share it evenly and never shrink under their floor */
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [rowW, setRowW] = useState(0);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const read = () => setRowW(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const panelW = shown.length ? Math.max(PANEL_MIN_W, Math.floor(rowW / shown.length)) : rowW;

  const setCount = (n: number) =>
    update(b => {
      const panels = [...b.panels];
      while (panels.length < n) {
        const used = new Set(panels.map(p => p.greek));
        const greek = GREEK_ORDER.find(g => !used.has(g)) ?? GREEK_ORDER[panels.length % GREEK_ORDER.length];
        panels.push(freshPanel(greek, b.linked ? expiry : panels[panels.length - 1]?.expiry ?? expiry));
      }
      return { ...b, panels, count: n };
    });
  const changePanel = (id: number, next: Partial<BoardPanel>) =>
    update(b => ({
      ...b,
      panels: b.panels.map(p => {
        if (p.id === id) return { ...p, ...next };
        /* linked: an expiry or a window set on one panel is set on all */
        if (b.linked) {
          const shared: Partial<BoardPanel> = {};
          if (next.expiry !== undefined) shared.expiry = next.expiry;
          if (next.range !== undefined) shared.range = next.range;
          return Object.keys(shared).length ? { ...p, ...shared } : p;
        }
        return p;
      }),
    }));
  const closePanel = (id: number) => update(b => ({ ...b, panels: b.panels.filter(p => p.id !== id), count: Math.max(0, Math.min(b.count - 1, b.panels.length - 1)) }));
  const pickName = (p: BoardPanel, t: string) => {
    if (p.own === undefined) onFrameTicker(t);
    else changePanel(p.id, { own: t });
  };

  /* CSV — every shown panel's rows, one section each */
  const exportCsv = () => {
    const lines = ['panel,ticker,greek,expiry,strike,put,call,net'];
    books.forEach(({ panel, snap, profile }, i) => {
      if (!profile) return;
      for (const s of profile.strikes) {
        const leg = legOf(s, panel.greek);
        lines.push([i + 1, snap.ticker, GREEK_LABEL[panel.greek], panel.expiry, s.strike, Math.round(leg.put), Math.round(leg.call), Math.round(leg.net)].join(','));
      }
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${frameTicker}-greek-board.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const spot = snapshot.ticker === frameTicker ? snapshot.spot : Simulator.TICKERS[frameTicker]?.currentPrice ?? snapshot.spot;
  const chg = snapshot.ticker === frameTicker ? snapshot.changePercent : 0;
  const footBtn = 'inline-flex items-center gap-1 h-6 px-2 rounded border border-borderSubtle text-[10px] font-semibold text-textSecondary hover:text-textPrimary hover:border-borderMuted aria-pressed:border-silver/50 aria-pressed:text-textPrimary aria-pressed:bg-silver/[0.06] transition-colors';

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-greek-board data-panels={shown.length} data-linked={linked} data-focus={centreOnFocus}>
      <div ref={rowRef} className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden" data-board-row>
        {shown.length === 0 ? (
          <div className="flex-1 grid place-items-center font-mono text-[11px] text-textSecondary">
            <span>No panels open — pick a count below</span>
          </div>
        ) : (
          books.map(({ panel, snap, profile }) => (
            <PanelView
              key={panel.id}
              panel={panel}
              snapshot={snap}
              profile={profile}
              width={panelW}
              timeframe={timeframe}
              revision={revision}
              linked={linked}
              centreOnFocus={centreOnFocus}
              strikeAs={strikeAs}
              expiryOptions={expiryOptions}
              onChange={next => changePanel(panel.id, next)}
              onClose={() => closePanel(panel.id)}
              onPickName={t => pickName(panel, t)}
            />
          ))
        )}
      </div>
      {/* THE FOOT — the board's transport */}
      <div className="shrink-0 flex items-center gap-x-3 gap-y-1 flex-wrap px-3 py-1.5 border-t border-borderSubtle font-mono text-[10px]" data-board-foot>
        <span className="uppercase tracking-widest text-textSecondary">Panels</span>
        <span className="inline-flex rounded border border-borderSubtle overflow-hidden" role="group" aria-label="How many panels">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              aria-pressed={count === n}
              onClick={() => setCount(n)}
              className="w-7 h-6 text-[10px] font-semibold text-textSecondary hover:text-textPrimary aria-pressed:bg-silver/[0.12] aria-pressed:text-textPrimary transition-colors"
              data-board-count={n}
            >
              {n}
            </button>
          ))}
        </span>
        <button type="button" className={footBtn} aria-pressed={centreOnFocus} disabled={!focus} onClick={() => update(b => ({ ...b, focus: !b.focus }))} title={focus ? 'Centre every panel on the strike in focus' : 'Click a strike to put it in focus first'} data-board-focus>
          <Crosshair className="w-3 h-3" /> Focus
        </button>
        <button type="button" className={footBtn} aria-pressed={linked} onClick={() => update(b => ({ ...b, linked: !b.linked }))} title={linked ? 'Linked — the panels move together; click to let each keep its own' : 'Unlinked — each panel keeps its own; click to move them together'} data-board-link>
          {linked ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />} Link
        </button>
        <button type="button" className={footBtn} onClick={exportCsv} title="Every panel's rows, as a file" data-board-csv>
          <Download className="w-3 h-3" /> CSV
        </button>
        <span className="ml-auto inline-flex items-center gap-2 tnum">
          <Name t={frameTicker} size={12} className="font-semibold text-textPrimary" />
          <span className="text-textPrimary">${spot.toFixed(2)}</span>
          <span className={chg >= 0 ? 'text-bull' : 'text-bear'}>
            {chg >= 0 ? '+' : ''}
            {chg.toFixed(2)}%
          </span>
          <FootClock />
        </span>
        <span className="inline-flex rounded border border-borderSubtle overflow-hidden" role="group" aria-label="The ruler the strikes are read in">
          {UNITS.map(u => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setDistanceUnit(u)} className="px-2 h-6 text-[10px] font-semibold text-textSecondary hover:text-textPrimary aria-pressed:bg-silver/[0.12] aria-pressed:text-textPrimary transition-colors" data-board-unit={u}>
              {u}
            </button>
          ))}
        </span>
        <span className="inline-flex items-center gap-3 text-textSecondary" data-board-key>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[2px] rounded" style={{ background: PUT_SIDE }} /> put-dominant
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[2px] rounded" style={{ background: CALL_SIDE }} /> call-dominant
          </span>
        </span>
      </div>
    </div>
  );
};

export type { Greek as BoardGreek };
export default GreekBoard;
