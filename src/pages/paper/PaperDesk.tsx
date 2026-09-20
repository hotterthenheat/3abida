/*
==================================================
  SLAYER TERMINAL - THE PAPER DESK (pages/paper/PaperDesk.tsx)

  A trading workstation with the chart as its
  surface (Noah, 2026-09-19: "put this paper trader
  in a tab below weigher"). The Weigher's frame —
  the shell head, a static grid on one screenful,
  the footer one slight scroll below — with four
  boxes: the TABS across the top (each its own
  layout and its own charts, core/paper/workspace),
  the PANES under them (one chart, or four, each
  with its own instrument and interval), the RAIL
  beside them (the compact ticket and the
  instrument's facts), and the BLOTTER under all of
  it (positions · orders · trades · the log).

  The strip over the chart carries the doors: the
  chain, the spread builder, the dealer overlay,
  the journal, HOW THE DESK RUNS (standard, the
  prop firm's evaluation, the free-rein sandbox),
  the tilt watch, the keys and the preferences.
  Every one of those is an INTERCEPTOR on the
  engine, never a branch inside it.

  EVERYTHING HERE IS PAPER, and the desk says so
  wherever an order or a balance lives. Every hand
  on this page — the chart, the ticket, the keys,
  the chain, the blotter — talks to one engine
  (core/paper/engine.ts), which fills against one
  market state (core/paper/market.ts), which reads
  the terminal's feed. The chart never touches the
  account.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CalendarRange, ClipboardPen, Keyboard, Layers, Maximize2, Minimize2, PanelRight, Rows3, Rows4, SlidersHorizontal, Waypoints } from 'lucide-react';
import { TimeframeStrip } from '../../components/gex/ChartToolbar';
import SpotPrice from '../../components/gex/SpotPrice';
import { armPrice, commitArm } from '../../components/gex/alertStore';
import { useSeeded } from '../../components/gex/useSeeded';
import GuideFocus, { GuideDoor } from '../../components/ui/GuideFocus';
import PopoverCard from '../../components/ui/PopoverCard';
import { Fact } from '../../components/trace/TraceBox';
import { useFadeClose } from '../../components/ui/useFadeClose';
import { DOCK_ROOM } from '../../data/editorDock';
import { NAV_INK } from '../../components/layout/nav';
import type { Timeframe } from '../../data/timeframe';
import {
  fmtMoney,
  indexFamily,
  optionInstrument,
  tagWord,
  type Instrument,
  type OptionInstrument,
} from '../../core/paper/instruments';
import { defaultExpiryFor, nearestStrike, quoteFor, spotOf, toUnderlyingPrice } from '../../core/paper/market';
import {
  cancelAll,
  cancelOrder,
  closePosition,
  flattenAll,
  notePaper,
  readAccount,
  resetAccount,
  reversePosition,
  stopToBreakeven,
  submitOrder,
  usePaper,
  watchInstrument,
} from '../../core/paper/engine';
import { DEFAULT_BINDINGS, HOTKEY_ACTIONS, bindHotkey, comboOf, resetHotkeys, updatePaperPrefs, usePaperPrefs, type HotkeyAction } from '../../core/paper/prefs';
import { activePane, activeTab, pickPane, setPaneInstrument, setPaneTimeframe, useWorkspace, type Pane, type PaneLayout } from '../../core/paper/workspace';
import PaperChart, { type PaperChartApi } from './PaperChart';
import WorkspaceBar from './WorkspaceBar';
import AccountPanel from './AccountPanel';
import Ladder from './Ladder';
import ModesDoor, { TiltDoor } from './ModesDoor';
import DealerDoor from './DealerDoor';
import InstrumentPicker from './InstrumentPicker';
import OrderTicket, { InstrumentFacts } from './OrderTicket';
import Blotter from './Blotter';
import ChainDoor from './ChainDoor';
import SpreadBuilder from './SpreadBuilder';
import { useHotkeys } from './useHotkeys';
import { Money, PaperPill, Toggle } from './paperKit';
import type { TradeDraft } from './TradeMenu';

/** What the chart reserves at its top before the strip has been measured */
const STRIP_H = 34;

/* WHERE THE PANES SIT, per layout */
const GRID: Record<PaneLayout, string> = {
  '1': 'grid-cols-1 grid-rows-1',
  '2h': 'grid-cols-2 grid-rows-1',
  '2v': 'grid-cols-1 grid-rows-2',
  '3': 'grid-cols-2 grid-rows-2',
  '4': 'grid-cols-2 grid-rows-2',
};

/** The option family over an instrument: NDX over NQ, SPXW over ES and SPY, a stock's own chain over the stock */
function familyFor(inst: Instrument): string | null {
  if (inst.kind === 'option' || inst.kind === 'spread') return inst.family;
  if (inst.kind === 'future') return inst.underlying === 'SPY' ? 'SPXW' : inst.underlying === 'QQQ' ? 'NDX' : inst.underlying === 'IWM' ? 'RUT' : null;
  return inst.symbol;
}

/*
  ELEVEN BORDERED BOXES READ AS A FENCE, not a toolbar. Each door keeps its
  own hover and its own open state, but the borders and the chip fill go: the
  row is one bar of icons over the tape, the way every charting desk draws it.
*/
const DOOR = 'inline-flex items-center justify-center w-7 h-7 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.09] data-[state=open]:bg-ink/[0.12] data-[state=open]:text-textPrimary transition-colors';
/** The bar they sit in — one surface, one border, over the candles */
const DOOR_BAR = 'inline-flex items-center gap-px p-px rounded-md border border-borderSubtle/70 bg-panel/70 backdrop-blur-md';

/* ---- the hotkeys card ---------------------------------------------------------------------- */
const HotkeysDoor = () => {
  const prefs = usePaperPrefs();
  const [arming, setArming] = useState<HotkeyAction | null>(null);
  const pendingRef = useRef<string[]>([]);
  useEffect(() => {
    if (!arming) return;
    let timer = 0;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setArming(null);
        return;
      }
      if (e.key === 'Backspace' && pendingRef.current.length === 0) {
        bindHotkey(arming, '');
        setArming(null);
        return;
      }
      const combo = comboOf(e);
      if (!combo) return;
      pendingRef.current = [...pendingRef.current, combo].slice(0, 2);
      window.clearTimeout(timer);
      const commit = () => {
        bindHotkey(arming, pendingRef.current.join(' '));
        pendingRef.current = [];
        setArming(null);
      };
      if (pendingRef.current.length >= 2) commit();
      else timer = window.setTimeout(commit, 700);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(timer);
      pendingRef.current = [];
    };
  }, [arming]);
  return (
    <PopoverCard
      title="Hotkeys"
      meta={prefs.hotkeys ? 'live' : 'off'}
      width={340}
      testId="paper-hotkeys"
      trigger={
        <button type="button" title="Hotkeys — every one rebindable" aria-label="Hotkeys" className={DOOR} data-paper-hotkeys>
          <Keyboard className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="px-3 py-2 flex items-center gap-2 border-b border-borderSubtle/70">
        <Toggle checked={prefs.hotkeys} onChange={v => updatePaperPrefs({ hotkeys: v })} label="Hotkeys live" />
        <span className="font-mono text-[10px] text-textPrimary">Keys live on this desk</span>
        <button type="button" onClick={resetHotkeys} className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted hover:text-textPrimary">
          Reset
        </button>
      </div>
      <ul className="py-1">
        {HOTKEY_ACTIONS.map(a => {
          const combo = prefs.bindings[a.key];
          return (
            <li key={a.key} className="flex items-center gap-2 px-3 h-8" data-hotkey-row={a.key}>
              <span className="flex flex-col min-w-0">
                <span className="font-mono text-[10px] text-textPrimary leading-none">{a.label}</span>
                <span className="font-mono text-[8px] text-textMuted leading-none mt-0.5 truncate">{a.hint}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  pendingRef.current = [];
                  setArming(a.key);
                }}
                title="Click, then press the key or two keys"
                className={`ml-auto h-6 min-w-[64px] px-2 rounded border font-mono text-[10px] tnum transition-colors ${arming === a.key ? 'border-select/70 text-select animate-live-breathe' : combo ? 'border-borderSubtle text-textPrimary hover:border-borderMuted' : 'border-borderSubtle text-textMuted'}`}
              >
                {arming === a.key ? 'press…' : combo || 'unbound'}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="px-3 pb-2 font-mono text-[8px] text-textMuted">A key, or two in a row within a moment (B then L). The defaults: {DEFAULT_BINDINGS.buyMarket} buys, {DEFAULT_BINDINGS.sellMarket} sells, {DEFAULT_BINDINGS.closePosition} closes, {DEFAULT_BINDINGS.reverse} reverses.</div>
    </PopoverCard>
  );
};

/* ---- the preferences card ------------------------------------------------------------------ */
const PrefsDoor = ({ onReset }: { onReset: () => void }) => {
  const prefs = usePaperPrefs();
  const [armed, setArmed] = useState(false);
  const [quick, setQuick] = useState(prefs.quickQtys.join(', '));
  const row = 'flex items-center gap-2 px-3 h-8';
  return (
    <PopoverCard
      title="The desk"
      width={320}
      testId="paper-prefs"
      trigger={
        <button type="button" title="How the desk trades" aria-label="Desk preferences" className={DOOR} data-paper-prefs>
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      }
      onOpenChange={o => {
        if (!o) setArmed(false);
      }}
    >
      <ul className="py-1">
        <li className={row}>
          <Toggle checked={prefs.confirmDrag} onChange={v => updatePaperPrefs({ confirmDrag: v })} label="Confirm a dragged order" />
          <span className="font-mono text-[10px] text-textPrimary">Ask before a dragged order moves</span>
        </li>
        <li className={row}>
          <Toggle checked={prefs.confirmOrders} onChange={v => updatePaperPrefs({ confirmOrders: v })} label="Confirm orders" />
          <span className="font-mono text-[10px] text-textPrimary">Ask once more before the ticket sends</span>
        </li>
        <li className={row}>
          <Toggle checked={prefs.levels} onChange={v => updatePaperPrefs({ levels: v })} label="Dealer levels" />
          <span className="font-mono text-[10px] text-textPrimary">The walls and the flip — a stock's own chain only</span>
        </li>
        {/* a real chart trader offers both edges; the default keeps a label
            beside its own price chip rather than a pane away from it */}
        <li className={row}>
          <span className="inline-flex items-center rounded border border-borderSubtle overflow-hidden" data-order-side>
            {(['left', 'right'] as const).map(sd => (
              <button
                key={sd}
                type="button"
                onClick={() => updatePaperPrefs({ orderLabelSide: sd })}
                aria-pressed={prefs.orderLabelSide === sd}
                data-order-side-pick={sd}
                className={`h-5 px-1.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                  prefs.orderLabelSide === sd ? 'bg-ink/[0.12] text-textPrimary' : 'text-textMuted hover:text-textSecondary'
                }`}
              >
                {sd}
              </button>
            ))}
          </span>
          <span className="font-mono text-[10px] text-textPrimary">Which edge the order labels ride</span>
        </li>
        <li className={row}>
          <Toggle checked={prefs.fillMarks} onChange={v => updatePaperPrefs({ fillMarks: v })} label="Fill marks" />
          <span className="font-mono text-[10px] text-textPrimary">Print fills on the bars</span>
        </li>
        <li className={row}>
          <span className="font-mono text-[10px] text-textPrimary">Quick sizes</span>
          <input
            value={quick}
            onChange={e => setQuick(e.target.value)}
            onBlur={() => {
              const n = quick.split(/[,\s]+/).map(Number).filter(v => Number.isFinite(v) && v > 0).slice(0, 6);
              if (n.length) updatePaperPrefs({ quickQtys: n });
              setQuick((n.length ? n : prefs.quickQtys).join(', '));
            }}
            aria-label="Quick sizes"
            className="ml-auto w-[120px] h-6 px-2 rounded border border-borderSubtle bg-inputBg font-mono text-[10px] tnum text-textPrimary outline-none focus:border-silver/60"
          />
        </li>
      </ul>
      <div className="px-3 py-2 border-t border-borderSubtle/70 flex items-center gap-2">
        <span className="font-mono text-[10px] text-textSecondary">Start the paper account over</span>
        <button
          type="button"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            onReset();
            setArmed(false);
          }}
          data-paper-reset
          className={`ml-auto h-6 px-2.5 rounded border font-mono text-[9px] uppercase tracking-widest transition-colors ${armed ? 'border-bear text-bear bg-bear/[0.08]' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
        >
          {armed ? 'Yes, reset' : 'Reset'}
        </button>
      </div>
    </PopoverCard>
  );
};

/* ---- the desk --------------------------------------------------------------------------------- */

const PaperDesk = () => {
  const ws = useWorkspace();
  const tab = activeTab(ws);
  const pane = activePane(ws);
  const instrument = pane.instrument;
  const timeframe = pane.timeframe;
  const split = tab.panes.length > 1;
  const paper = usePaper();
  const prefs = usePaperPrefs();
  const ready = useSeeded(instrument.underlying);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [chain, setChain] = useState<string | null>(null);
  const [spread, setSpread] = useState<{ family: string; legs?: OptionInstrument[] } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [full, setFull] = useState(false);
  const { closing, close } = useFadeClose(() => setFull(false));
  const chartApi = useRef<PaperChartApi | null>(null);
  /* THE STRIP IS MEASURED, NOT ASSUMED (found at 1180px, the narrow render):
     with the ticket rail out, the chart is ~600px and the strip WRAPS to two
     lines — and a constant 34px inset left the legend and the position bar
     sitting on top of the second row's buttons. The chart is told the strip's
     real height, so the legend, the bar and every tag stay clear of it at any
     width. */
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [stripH, setStripH] = useState(STRIP_H);
  const measureStrip = useCallback((el: HTMLDivElement | null) => {
    stripRef.current = el;
    if (el) setStripH(Math.max(STRIP_H, Math.round(el.getBoundingClientRect().height)));
  }, []);
  useEffect(() => {
    const el = stripRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setStripH(h => {
      const next = Math.max(STRIP_H, Math.round(el.getBoundingClientRect().height));
      return Math.abs(next - h) > 1 ? next : h;
    }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, prefs.ticketOpen]);

  /* THE CLOCK QUOTES EVERY PANE, not just the one being traded: a second chart
     on another name is as live as the first, and the watch is refcounted so a
     name on two panes is still quoted once. */
  useEffect(() => {
    const offs = tab.panes.map(p => watchInstrument(p.instrument));
    return () => offs.forEach(off => off());
  }, [tab.panes]);
  useEffect(() => {
    setSelectedOrderId(null);
  }, [instrument.id]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) close();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [full, close]);

  const quote = paper.quotes[instrument.id] ?? (ready ? quoteFor(instrument) : null);
  const position = paper.positions.find(p => p.id === instrument.id && p.qty !== 0) ?? null;
  const acct = useMemo(() => readAccount(paper), [paper]);
  const family = familyFor(instrument);

  const pickInstrument = useCallback(
    (inst: Instrument) => {
      setPaneInstrument(tab.id, tab.activePane, inst);
    },
    [tab.id, tab.activePane]
  );

  /* ---- the keys ---- */
  /* The frame's columns: the tape always, then whichever rails are open. A
     STYLE and not a class, because Tailwind can only see the class names that
     are written out in the source — one built at runtime never reaches the CSS. */
  const deskSpan = 1 + (prefs.ladderOpen ? 1 : 0) + (prefs.ticketOpen ? 1 : 0);
  const deskCols = `minmax(0,1fr)${prefs.ladderOpen ? ' 268px' : ''}${prefs.ticketOpen ? ' 286px' : ''}`;

  const qty = prefs.defaultQty;
  useHotkeys(true, {
    buyMarket: () => submitOrder({ instrument, side: 'buy', qty, type: 'market', source: 'hotkey' }),
    sellMarket: () => submitOrder({ instrument, side: 'sell', qty, type: 'market', source: 'hotkey' }),
    buyLimit: () => chartApi.current?.openCard({ instrument, side: 'buy', type: 'limit', qty, price: chartApi.current.cursorPrice() ?? quote?.bid }),
    sellLimit: () => chartApi.current?.openCard({ instrument, side: 'sell', type: 'limit', qty, price: chartApi.current.cursorPrice() ?? quote?.ask }),
    buyStop: () => chartApi.current?.openCard({ instrument, side: 'buy', type: 'stop', qty, price: chartApi.current.cursorPrice() ?? quote?.ask }),
    sellStop: () => chartApi.current?.openCard({ instrument, side: 'sell', type: 'stop', qty, price: chartApi.current.cursorPrice() ?? quote?.bid }),
    closePosition: () => closePosition(instrument.id, 1, 'hotkey'),
    reverse: () => reversePosition(instrument.id, 'hotkey'),
    cancelSelected: () => {
      if (selectedOrderId) {
        cancelOrder(selectedOrderId, 'hotkey');
        setSelectedOrderId(null);
      }
    },
    cancelAll: () => cancelAll(instrument.id, 'hotkey'),
    flatten: () => flattenAll('hotkey'),
    stopToBreakeven: () => stopToBreakeven(instrument.id, 'hotkey'),
    ticket: () => updatePaperPrefs({ ticketOpen: !prefs.ticketOpen }),
  });

  const strip = (
    /* THE CHROME DOES NOT SWALLOW THE TAPE. The strip lies across the top of the
       chart, and with it catching pointers the whole top band of the tape was
       dead — a drawing's handle up there could not be grabbed. Only its own
       controls take a press now; the gaps between them belong to the chart. */
    <div
      ref={measureStrip}
      className={`z-20 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-2 py-1 select-none pointer-events-none [&>*]:pointer-events-auto ${
        split ? 'relative shrink-0 pr-2 border-b border-borderSubtle/70 bg-panel' : 'absolute top-0 inset-x-0 pr-[76px]'
      }`}
      data-chart-chrome
      data-paper-strip
    >
      <InstrumentPicker instrument={instrument} onPick={pickInstrument} onOpenChain={f => setChain(f)} />
      {quote && (
        <span className="inline-flex items-center gap-2">
          <SpotPrice value={quote.last} className="font-mono text-[11px] font-semibold tnum text-textPrimary" />
          <span className="font-mono text-[10px] tnum text-textSecondary">
            {quote.bid.toLocaleString('en-US', { minimumFractionDigits: 2 })} × {quote.ask.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </span>
      )}
      <TimeframeStrip value={timeframe} onChange={(tf: Timeframe) => setPaneTimeframe(tab.id, tab.activePane, tf)} />
      <span className={`ml-auto ${DOOR_BAR}`}>
        <button type="button" onClick={() => updatePaperPrefs({ levels: !prefs.levels })} title={prefs.levels ? 'Hide the dealer levels' : 'Show the walls and the flip'} aria-pressed={prefs.levels} className={`${DOOR} ${prefs.levels ? 'text-textPrimary border-silver/40' : ''}`} data-paper-levels>
          <Layers className="w-3.5 h-3.5" />
        </button>
        <DealerDoor instrument={instrument} />
        {family && (
          <>
            <button type="button" onClick={() => setChain(family)} title={`${family} option chain`} className={DOOR} data-paper-chain-door>
              <Rows3 className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setSpread({ family })} title="Build a spread" className={DOOR} data-paper-spread-door>
              <Waypoints className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        <Link to="/paper/journal" title="The journal — the calendar, the profit factor, MAE and MFE" aria-label="Journal" className={DOOR} data-paper-journal-door>
          <CalendarRange className="w-3.5 h-3.5" />
        </Link>
        <ModesDoor />
        <TiltDoor />
        <HotkeysDoor />
        <PrefsDoor onReset={() => resetAccount()} />
        <button type="button" onClick={() => updatePaperPrefs({ ladderOpen: !prefs.ladderOpen })} title={prefs.ladderOpen ? 'Hide the ladder' : 'Show the ladder — click a rung to place there'} aria-pressed={prefs.ladderOpen} className={`${DOOR} ${prefs.ladderOpen ? 'text-textPrimary' : ''}`} data-paper-ladder-door>
          <Rows4 className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => updatePaperPrefs({ ticketOpen: !prefs.ticketOpen })} title={prefs.ticketOpen ? 'Hide the ticket (T)' : 'Show the ticket (T)'} aria-pressed={prefs.ticketOpen} className={`${DOOR} ${prefs.ticketOpen ? 'text-textPrimary' : ''}`} data-paper-ticket-door>
          <PanelRight className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => (full ? close() : setFull(true))} title={full ? 'Exit fullscreen (Esc)' : 'Fullscreen'} className={DOOR} data-paper-full>
          {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </span>
    </div>
  );

  /* ONE PANE. The active one carries the ticket, the keys and the chart api;
     the others are live charts in their own right — their own instrument,
     their own interval, their own tags — and clicking one makes it active. */
  const paneBody = (p: Pane, i: number) => {
    const isActive = p.id === tab.activePane;
    const many = tab.panes.length > 1;
    return (
      <div
        key={p.id}
        className={`relative min-w-0 min-h-0 overflow-hidden ${many ? 'rounded border' : ''} ${many ? (isActive ? 'border-silver/45' : 'border-borderSubtle') : 'border-transparent'}`}
        onPointerDownCapture={() => {
          if (!isActive) pickPane(tab.id, p.id);
        }}
        data-paper-pane={p.id}
        data-pane-active={isActive ? '1' : '0'}
        style={tab.layout === '3' && i === 0 ? { gridColumn: 'span 2' } : undefined}
      >
        <PaneChart
          pane={p}
          topInset={split ? 6 : stripH}
          apiRef={isActive ? chartApi : undefined}
          onSelectOrder={setSelectedOrderId}
          selectedOrderId={isActive ? selectedOrderId : null}
          rev={paper.rev}
          onOpenChain={setChain}
          onOpenSpread={f => setSpread({ family: f })}
        />
      </div>
    );
  };

  /* ONE CHART, AND THE STRIP LIES OVER IT (the desk's own look, kept). SPLIT,
     and it cannot: a toolbar drawn across four panes puts its buttons inside
     three of them. It becomes a row of its own above the grid instead. */
  const chartBody = (
    <div className={`relative h-full bg-panel ${split ? 'flex flex-col' : ''}`} data-theme="dark">
      {split && strip}
      <div className={`grid gap-1 ${split ? 'relative flex-1 min-h-0 p-1' : 'absolute inset-0'} ${GRID[tab.layout]}`} data-paper-panes={tab.layout}>
        {tab.panes.map(paneBody)}
      </div>
      {!split && strip}
    </div>
  );

  const rail = (
    <div className="h-full flex flex-col overflow-y-auto overflow-x-hidden rounded-md border border-borderSubtle bg-panel" data-paper-rail>
      <AccountPanel />
      <OrderTicket instrument={instrument} quote={quote} />
      <InstrumentFacts instrument={instrument} quote={quote} position={position} />
    </div>
  );

  return (
    <div className="relative flex-1 min-h-0 flex flex-col" data-paper-desk>
      <header className="shrink-0 flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-paper-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true" style={{ '--ink': NAV_INK.paper } as CSSProperties}>
              <ClipboardPen className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Paper</h1>
            <PaperPill />
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="How to trade the chart" testId="paper-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Trade the chart — futures and options against the live market state, on paper. Right-click a price to start.</p>
        </div>
        {/* THE PANEL KEEPS THE LEDGER (the rail's account card), and the head
            keeps the two that matter ONLY WHILE THE RAIL IS SHUT. Six bare
            numbers strung across the top of the page were a balance sheet
            pretending to be a caption; printing two of them forty pixels from
            the card that prints them bigger is the same fault, smaller. */}
        {!prefs.ticketOpen && (
          <dl className="grid grid-flow-col auto-cols-max gap-x-6" data-shell-facts data-paper-account>
            <Fact label="Equity" testId="equity">{fmtMoney(acct.equity, false)}</Fact>
            <Fact label="Day P&L" testId="day"><Money v={acct.dayPnl} /></Fact>
          </dl>
        )}
      </header>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to trade the chart" testId="paper-guide" viewport>
        <div className="flex flex-col gap-3 text-[12px] leading-relaxed text-textSecondary">
          <p><span className="text-textPrimary font-semibold">Right-click the tape</span> at any price: buy or sell there at the market, or leave a limit or a stop where you clicked. The card that opens inherits the price — set the size, place it.</p>
          <p><span className="text-textPrimary font-semibold">Every order is a line with a tag</span> at the axis. Drag the tag to move the order; × cancels it. A stop is dotted, a target dashed; buys are green, sells red; a partly filled order says how much.</p>
          <p><span className="text-textPrimary font-semibold">The position bar</span> at the top of the tape closes some or all of it, reverses it, puts a stop and a target on it, or moves the stop to breakeven. The same lives in the blotter below.</p>
          <p><span className="text-textPrimary font-semibold">Options ride the same chart.</span> Buy a call or a put at the strike nearest your click, open the chain, or build a spread — one order, one position, the legs underneath.</p>
          <p><span className="text-textPrimary font-semibold">Draw the trade before you take it.</span> Right-click and pick the long or short position tool: two boxes from one entry, the reward over the risk in the middle, and a button that places the whole plan as an entry with its stop and target attached. Nothing reaches the account until that button is pressed.</p>
          <p><span className="text-textPrimary font-semibold">Tabs, panes and what they share.</span> The strip above the chart holds your tabs — each one its own layout and its own charts — and the split beside it. Four panes, four instruments, four intervals; the switches say what travels between them. The whole workspace saves itself and comes back as it was left.</p>
          <p><span className="text-textPrimary font-semibold">How the desk runs.</span> Standard is the desk as it is. <span className="text-warn">Prop firm</span> makes it an evaluation: futures only, a trailing drawdown that liquidates and draws the price it will happen at, flat by the bell. <span className="text-silver">Free rein</span> is a sandbox — set the balance, switch the spread, the slippage and the fees off, and read the numbers knowing you did.</p>
          <p><span className="text-textPrimary font-semibold">Three registers.</span> <span className="text-textPrimary">Observed</span> is the feed's own price. <span className="text-silver">Calculated</span> is derived from it by a model the chip names — a future off its index twin, an option off the chain. <span className="text-warn">Paper execution</span> is the engine filling you: at the touch, walking the book past it, never a free midpoint.</p>
          <p className="text-textMuted">Nothing on this desk reaches a brokerage. There is no door for it to go through.</p>
        </div>
      </GuideFocus>

      <div
        /* THE TAPE TAKES THE ROOM (was 3:2, and the blotter's one row sat over
           three hundred pixels of black). A trading desk gives the chart the
           screen and the book a band under it. The rail widens with it, since
           the account, the ticket and the contract now share it. */
        /* THE THREE-COLUMN WORKSTATION: the tape, the ladder it is traded from,
           and the rail that holds the account and the ticket. Each of the two
           side columns comes and goes on its own door, and the row under them
           always spans whatever is open. */
        className="relative flex-1 min-h-0 mt-3 grid grid-rows-[auto_minmax(0,68fr)_minmax(0,32fr)] gap-2.5"
        style={{ gridTemplateColumns: deskCols }}
        data-paper-frame
      >
        <div className="min-w-0 -mb-1" style={{ gridColumn: `span ${deskSpan}` }}>
          <WorkspaceBar tab={tab} />
        </div>
        <div className="min-h-0 min-w-0">
          <div className="h-full relative overflow-hidden rounded-md border border-borderSubtle bg-panel">{full ? <div className="h-full" /> : chartBody}</div>
        </div>
        {prefs.ladderOpen && <div className="min-h-0 min-w-0">{full ? <div className="h-full" /> : <Ladder instrument={instrument} quote={quote} position={position} />}</div>}
        {prefs.ticketOpen && <div className="min-h-0 min-w-0">{full ? <div className="h-full" /> : rail}</div>}
        <div className="min-h-0 min-w-0" style={{ gridColumn: `span ${deskSpan}` }}>
          <Blotter instrument={instrument} onPick={pickInstrument} selectedOrderId={selectedOrderId} onSelectOrder={setSelectedOrderId} />
        </div>
      </div>

      {chain && <ChainDoor open onClose={() => setChain(null)} family={chain} onChart={pickInstrument} onAddLeg={leg => setSpread(s => ({ family: chain, legs: [...(s?.legs ?? []), leg] }))} />}
      {spread && <SpreadBuilder open onClose={() => setSpread(null)} family={spread.family} seedLegs={spread.legs} onChart={pickInstrument} />}

      {full &&
        createPortal(
          <div className={`fixed inset-0 z-[80] bg-canvas p-3 flex gap-2.5 animate-soft-in transition-opacity duration-200 ease-out ${closing ? 'opacity-0' : ''}`} style={DOCK_ROOM} data-paper-fullscreen>
            <div className="flex-1 min-w-0 relative overflow-hidden rounded-md border border-borderSubtle bg-panel">{chartBody}</div>
            {prefs.ladderOpen && (
              <div className="w-[268px] shrink-0 min-h-0">
                <Ladder instrument={instrument} quote={quote} position={position} />
              </div>
            )}
            {prefs.ticketOpen && <div className="w-[286px] shrink-0 min-h-0">{rail}</div>}
          </div>,
          document.body
        )}
    </div>
  );
};


/* ---- one pane's chart ---------------------------------------------------------------------- */

/*
  EVERY PANE IS A WHOLE CHART. It reads its own instrument's quote and its own
  history, opens its own chain and spread doors, and prices its own options —
  the desk only says which one the ticket and the keys are pointed at. The
  chart api goes to the active pane alone, so a hotkey can never land on a
  chart the reader is not looking at.
*/
const PaneChart = ({
  pane,
  topInset,
  apiRef,
  selectedOrderId,
  onSelectOrder,
  rev,
  onOpenChain,
  onOpenSpread,
}: {
  pane: Pane;
  topInset: number;
  apiRef?: MutableRefObject<PaperChartApi | null>;
  selectedOrderId: string | null;
  onSelectOrder: (id: string | null) => void;
  rev: number;
  onOpenChain: (family: string) => void;
  onOpenSpread: (family: string) => void;
}) => {
  const paper = usePaper();
  const prefs = usePaperPrefs();
  const inst = pane.instrument;
  const ready = useSeeded(inst.underlying);
  const quote = paper.quotes[inst.id] ?? (ready ? quoteFor(inst) : null);
  const family = familyFor(inst);

  const optionDraftAt = useCallback(
    (price: number, right: 'C' | 'P', side: 'buy' | 'sell'): TradeDraft | null => {
      if (!family) return null;
      const fam = indexFamily(family);
      const ratio = fam ? fam.ratio : 1;
      /* an option's own tape is premium — its strike comes off the underlying's spot instead */
      const under = inst.kind === 'option' || inst.kind === 'spread' ? spotOf(inst.underlying) ?? 0 : toUnderlyingPrice(inst, price);
      const strike = nearestStrike(family, under * ratio);
      const expiry = inst.kind === 'option' || inst.kind === 'spread' ? inst.expiry : defaultExpiryFor(family);
      return { instrument: optionInstrument(family, strike, right, expiry), side, type: 'market', qty: prefs.defaultQty };
    },
    [family, inst, prefs.defaultQty]
  );

  const alertAt = useCallback(
    (price: number) => {
      if (inst.kind === 'option' || inst.kind === 'spread') return;
      const spot = spotOf(inst.underlying);
      if (spot == null) return;
      const etfPrice = toUnderlyingPrice(inst, price);
      const a = armPrice(inst.underlying, Number(etfPrice.toFixed(2)), spot);
      if (a) {
        commitArm(inst.underlying, a);
        notePaper(tagWord(inst), `alert set at ${price} (${inst.underlying} ${etfPrice.toFixed(2)})`);
      } else notePaper(tagWord(inst), 'that name already carries its most alerts');
    },
    [inst]
  );

  return (
    <PaperChart
      paneId={pane.id}
      instrument={inst}
      quote={quote}
      timeframe={pane.timeframe}
      revision={rev}
      ready={ready}
      selectedOrderId={selectedOrderId}
      onSelectOrder={onSelectOrder}
      topInset={topInset}
      apiRef={apiRef}
      optionDraftAt={family ? optionDraftAt : undefined}
      onOpenChain={family ? () => onOpenChain(family) : undefined}
      onOpenSpread={family ? () => onOpenSpread(family) : undefined}
      onAlertAt={inst.kind === 'stock' || inst.kind === 'future' ? alertAt : undefined}
      onToast={w => notePaper(tagWord(inst), w)}
    />
  );
};

export default PaperDesk;
