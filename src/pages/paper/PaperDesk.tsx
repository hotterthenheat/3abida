/*
==================================================
  SLAYER TERMINAL - THE PAPER DESK (pages/paper/PaperDesk.tsx)

  A trading workstation with the chart as its
  surface (Noah, 2026-09-19: "put this paper trader
  in a tab below weigher"). The Weigher's frame —
  the shell head, a static grid on one screenful,
  the footer one slight scroll below — with three
  boxes: the CHART (the order ticket you right-click
  on), the RAIL beside it (the compact ticket and
  the instrument's facts), and the BLOTTER under
  both (positions · orders · trades · the log).

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

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardPen, Keyboard, Layers, Maximize2, Minimize2, PanelRight, Rows3, SlidersHorizontal, Waypoints } from 'lucide-react';
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
  futureInstrument,
  indexFamily,
  optionInstrument,
  stockInstrument,
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
import PaperChart, { type PaperChartApi } from './PaperChart';
import InstrumentPicker from './InstrumentPicker';
import OrderTicket, { InstrumentFacts } from './OrderTicket';
import Blotter from './Blotter';
import ChainDoor from './ChainDoor';
import SpreadBuilder from './SpreadBuilder';
import { useHotkeys } from './useHotkeys';
import { Money, PaperPill, Toggle } from './paperKit';
import type { TradeDraft } from './TradeMenu';

const DESK_KEY = 'slayer_paper_desk_v1';
/** What the chart reserves at its top before the strip has been measured */
const STRIP_H = 34;

interface DeskState {
  instrument: Instrument;
  timeframe: Timeframe;
}

const TIMEFRAMES = new Set<string>(['15s', '1m', '5m', '15m', '30m', '1h', '1D', '1W']);

function loadDesk(): DeskState {
  const def: DeskState = { instrument: futureInstrument('NQ') ?? stockInstrument('SPY'), timeframe: '1m' };
  try {
    const raw = localStorage.getItem(DESK_KEY);
    if (!raw) return def;
    const v = JSON.parse(raw) as Partial<DeskState>;
    const inst = v.instrument;
    const ok = inst && typeof inst === 'object' && typeof inst.id === 'string' && typeof inst.kind === 'string' && typeof inst.underlying === 'string';
    /* a stored front month rolls forward with the calendar */
    const instrument: Instrument = ok ? (inst.kind === 'future' ? futureInstrument(inst.root) ?? def.instrument : inst) : def.instrument;
    return { instrument, timeframe: v.timeframe && TIMEFRAMES.has(v.timeframe) ? v.timeframe : '1m' };
  } catch {
    return def;
  }
}

/** The option family over an instrument: NDX over NQ, SPXW over ES and SPY, a stock's own chain over the stock */
function familyFor(inst: Instrument): string | null {
  if (inst.kind === 'option' || inst.kind === 'spread') return inst.family;
  if (inst.kind === 'future') return inst.underlying === 'SPY' ? 'SPXW' : inst.underlying === 'QQQ' ? 'NDX' : inst.underlying === 'IWM' ? 'RUT' : null;
  return inst.symbol;
}

const DOOR = 'inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle bg-chip text-textMuted hover:text-textPrimary hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors';

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
          <span className="font-mono text-[10px] text-textPrimary">The walls and the flip on the tape</span>
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
  const [desk, setDesk] = useState<DeskState>(loadDesk);
  const { instrument, timeframe } = desk;
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

  useEffect(() => {
    try {
      localStorage.setItem(DESK_KEY, JSON.stringify(desk));
    } catch {
      /* never fatal */
    }
  }, [desk]);

  /* the engine's clock quotes what the desk is looking at */
  useEffect(() => watchInstrument(instrument), [instrument]);
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

  const pickInstrument = useCallback((inst: Instrument) => {
    setDesk(d => ({ ...d, instrument: inst }));
  }, []);

  /* an option on this tape, at a clicked price */
  const optionDraftAt = useCallback(
    (price: number, right: 'C' | 'P', side: 'buy' | 'sell'): TradeDraft | null => {
      if (!family) return null;
      const fam = indexFamily(family);
      const ratio = fam ? fam.ratio : 1;
      /* an option's own tape is premium — its strike comes off the underlying's spot instead */
      const under = instrument.kind === 'option' || instrument.kind === 'spread' ? (spotOf(instrument.underlying) ?? 0) : toUnderlyingPrice(instrument, price);
      const strike = nearestStrike(family, under * ratio);
      const expiry = instrument.kind === 'option' || instrument.kind === 'spread' ? instrument.expiry : defaultExpiryFor(family);
      return { instrument: optionInstrument(family, strike, right, expiry), side, type: 'market', qty: prefs.defaultQty };
    },
    [family, instrument, prefs.defaultQty]
  );

  const alertAt = useCallback(
    (price: number) => {
      if (instrument.kind === 'option' || instrument.kind === 'spread') return;
      const spot = spotOf(instrument.underlying);
      if (spot == null) return;
      const etfPrice = toUnderlyingPrice(instrument, price);
      const a = armPrice(instrument.underlying, Number(etfPrice.toFixed(2)), spot);
      if (a) {
        commitArm(instrument.underlying, a);
        notePaper(tagWord(instrument), `alert set at ${price} (${instrument.underlying} ${etfPrice.toFixed(2)})`);
      } else notePaper(tagWord(instrument), 'that name already carries its most alerts');
    },
    [instrument]
  );

  /* ---- the keys ---- */
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
    <div ref={measureStrip} className="absolute top-0 inset-x-0 z-20 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-2 pr-[76px] py-1 select-none" data-chart-chrome data-paper-strip>
      <InstrumentPicker instrument={instrument} onPick={pickInstrument} onOpenChain={f => setChain(f)} />
      {quote && (
        <span className="inline-flex items-center gap-2">
          <SpotPrice value={quote.last} className="font-mono text-[11px] font-semibold tnum text-textPrimary" />
          <span className="font-mono text-[10px] tnum text-textSecondary">
            {quote.bid.toLocaleString('en-US', { minimumFractionDigits: 2 })} × {quote.ask.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </span>
      )}
      <TimeframeStrip value={timeframe} onChange={tf => setDesk(d => ({ ...d, timeframe: tf }))} />
      <span className="ml-auto flex items-center gap-1.5">
        <button type="button" onClick={() => updatePaperPrefs({ levels: !prefs.levels })} title={prefs.levels ? 'Hide the dealer levels' : 'Show the walls and the flip'} aria-pressed={prefs.levels} className={`${DOOR} ${prefs.levels ? 'text-textPrimary border-silver/40' : ''}`} data-paper-levels>
          <Layers className="w-3.5 h-3.5" />
        </button>
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
        <HotkeysDoor />
        <PrefsDoor onReset={() => resetAccount()} />
        <button type="button" onClick={() => updatePaperPrefs({ ticketOpen: !prefs.ticketOpen })} title={prefs.ticketOpen ? 'Hide the ticket (T)' : 'Show the ticket (T)'} aria-pressed={prefs.ticketOpen} className={`${DOOR} ${prefs.ticketOpen ? 'text-textPrimary' : ''}`} data-paper-ticket-door>
          <PanelRight className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => (full ? close() : setFull(true))} title={full ? 'Exit fullscreen (Esc)' : 'Fullscreen'} className={DOOR} data-paper-full>
          {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </span>
    </div>
  );

  const chartBody = (
    <div className="relative h-full bg-panel" data-theme="dark">
      <div className="absolute inset-0">
        <PaperChart
          instrument={instrument}
          quote={quote}
          timeframe={timeframe}
          revision={paper.rev}
          ready={ready}
          selectedOrderId={selectedOrderId}
          onSelectOrder={setSelectedOrderId}
          topInset={stripH}
          apiRef={chartApi}
          optionDraftAt={family ? optionDraftAt : undefined}
          onOpenChain={family ? () => setChain(family) : undefined}
          onOpenSpread={family ? () => setSpread({ family }) : undefined}
          onAlertAt={instrument.kind === 'stock' || instrument.kind === 'future' ? alertAt : undefined}
          onToast={w => notePaper(tagWord(instrument), w)}
        />
      </div>
      {strip}
    </div>
  );

  const rail = (
    <div className="h-full flex flex-col overflow-y-auto overflow-x-hidden rounded-md border border-ink/[0.07] bg-panel" data-paper-rail>
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
        <dl className="grid grid-flow-col auto-cols-max gap-x-6" data-shell-facts data-paper-account>
          <Fact label="Equity" testId="equity">{fmtMoney(acct.equity, false)}</Fact>
          <Fact label="Cash" testId="cash">{fmtMoney(acct.cash, false)}</Fact>
          <Fact label="Buying power" testId="bp">{fmtMoney(acct.buyingPower, false)}</Fact>
          <Fact label="Margin used" testId="margin">{fmtMoney(acct.marginUsed, false)}</Fact>
          <Fact label="Day P&L" testId="day"><Money v={acct.dayPnl} /></Fact>
          <Fact label="Total P&L" testId="total"><Money v={acct.totalPnl} /></Fact>
        </dl>
      </header>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to trade the chart" testId="paper-guide" viewport>
        <div className="flex flex-col gap-3 text-[12px] leading-relaxed text-textSecondary">
          <p><span className="text-textPrimary font-semibold">Right-click the tape</span> at any price: buy or sell there at the market, or leave a limit or a stop where you clicked. The card that opens inherits the price — set the size, place it.</p>
          <p><span className="text-textPrimary font-semibold">Every order is a line with a tag</span> at the axis. Drag the tag to move the order; × cancels it. A stop is dotted, a target dashed; buys are green, sells red; a partly filled order says how much.</p>
          <p><span className="text-textPrimary font-semibold">The position bar</span> at the top of the tape closes some or all of it, reverses it, puts a stop and a target on it, or moves the stop to breakeven. The same lives in the blotter below.</p>
          <p><span className="text-textPrimary font-semibold">Options ride the same chart.</span> Buy a call or a put at the strike nearest your click, open the chain, or build a spread — one order, one position, the legs underneath.</p>
          <p><span className="text-textPrimary font-semibold">Three registers.</span> <span className="text-textPrimary">Observed</span> is the feed's own price. <span className="text-silver">Calculated</span> is derived from it by a model the chip names — a future off its index twin, an option off the chain. <span className="text-warn">Paper execution</span> is the engine filling you: at the touch, walking the book past it, never a free midpoint.</p>
          <p className="text-textMuted">Nothing on this desk reaches a brokerage. There is no door for it to go through.</p>
        </div>
      </GuideFocus>

      <div
        className={`relative flex-1 min-h-0 mt-4 grid grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-2.5 ${prefs.ticketOpen ? 'grid-cols-[minmax(0,1fr)_272px]' : 'grid-cols-[minmax(0,1fr)]'}`}
        data-paper-frame
      >
        <div className="min-h-0 min-w-0">
          <div className="h-full relative overflow-hidden rounded-md border border-ink/[0.07] bg-panel">{full ? <div className="h-full" /> : chartBody}</div>
        </div>
        {prefs.ticketOpen && <div className="min-h-0 min-w-0">{full ? <div className="h-full" /> : rail}</div>}
        <div className={`min-h-0 min-w-0 ${prefs.ticketOpen ? 'col-span-2' : ''}`}>
          <Blotter instrument={instrument} onPick={pickInstrument} selectedOrderId={selectedOrderId} onSelectOrder={setSelectedOrderId} />
        </div>
      </div>

      {chain && <ChainDoor open onClose={() => setChain(null)} family={chain} onChart={pickInstrument} onAddLeg={leg => setSpread(s => ({ family: chain, legs: [...(s?.legs ?? []), leg] }))} />}
      {spread && <SpreadBuilder open onClose={() => setSpread(null)} family={spread.family} seedLegs={spread.legs} onChart={pickInstrument} />}

      {full &&
        createPortal(
          <div className={`fixed inset-0 z-[80] bg-canvas p-3 flex gap-2.5 animate-soft-in transition-opacity duration-200 ease-out ${closing ? 'opacity-0' : ''}`} style={DOCK_ROOM} data-paper-fullscreen>
            <div className="flex-1 min-w-0 relative overflow-hidden rounded-md border border-ink/[0.07] bg-panel">{chartBody}</div>
            {prefs.ticketOpen && <div className="w-[272px] shrink-0 min-h-0">{rail}</div>}
          </div>,
          document.body
        )}
    </div>
  );
};

export default PaperDesk;
