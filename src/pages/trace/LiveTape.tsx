/*
==================================================
  SLAYER TERMINAL - LIVE TAPE (pages/trace/LiveTape.tsx)

  Streaming rich options prints in the house
  grammar — the page every other Trace table was
  cut to match, now cut to match THEM.
==================================================

  ONE TABLE, ONE HEAD (Noah, 2026-09-03, holding the Screener beside the
  tape: "live tape is nowhere near the same height as the rest of the
  subpages of trace so it looks offputting. also the formatting of the
  rows is not the same") — and since the walk (2026-09-09) the tape is
  the same house box as every Trace page: the head with the view's
  facts (prints, premium by side, sweeps · blocks · P/C, the 0DTE share)
  and its three whales as champions; one line of cards — the hold, the
  search, Order / Kind / Lean / Premium, the rail door and the column
  chooser; the tape read as the sentence; the AG Grid in its window with
  the rail beside it. What stayed the tape's own: the Stream/Notable/
  Premium/Size order (the Order card, named in the sub line), the mark in
  the time cell, the fill-in-spread and conviction cells, the side rail,
  and the wrapper cache that keeps a row still while its print does not
  move.

  THE SIDE RAIL IS A DOOR (Noah, same day: "the dark pool and the top
  tickers should have the ability to be hidden so you can have more room
  for the actual live tape and then that allows for the width to match the
  other subpages"). A toggle beside Columns; hidden, the grid takes the
  whole window. Remembered.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelRight } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import { printKey, useWatch, watchPrint } from '../../context/WatchContext';
import WatchStar from '../../components/trace/WatchStar';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import { enrichPrint, rankNotable, sentimentOf, summarizeTape } from '../../data/tape';
import { buildGexView, fmtUsd } from '../../data/gex';
import CompanyLogo from '../../components/ui/CompanyLogo';
import type { Column } from '../../components/ui/DataTable';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import RichRead from '../../components/ui/RichRead';
import PrintDrilldown from '../../components/trace/PrintDrilldown';
import ReadDoor from '../../components/trace/ReadDoor';
import FlowSearch from '../../components/trace/FlowSearch';
import ContractCell from '../../components/trace/ContractCell';
import LeanCell from '../../components/trace/LeanCell';
import ColumnChooser, { useHiddenColumns } from '../../components/trace/ColumnChooser';
import TraceBox, { Champion, Fact, TraceGrid } from '../../components/trace/TraceBox';
import { LiveTapeGuide } from '../../components/trace/TraceGuide';
import type { FlowPrint, PrintSentiment, TapeSummary } from '../../types/trace';

const MAX_ROWS = 120;
const READ_INTERVAL_MS = 8_000;
/* The shared chooser stores the HIDDEN set (see ColumnChooser); the old
   key held the visible one, so this is a new key rather than a misread. */
const COLS_KEY = 'slayer_tape_hidden';
const RAIL_KEY = 'slayer_tape_rail';

type FlowFilter = 'ALL' | 'SWEEP' | 'BLOCK';
/** The tape's ordering lens (Noah, 2026-08-19: "quickly switch between newest
    prints, largest premium, largest size, bullish flow, and bearish flow").
    Ordering is this axis; bullish/bearish is the DIRECTION axis (the
    sentiment filter), so the two compose — largest bullish premium is
    Premium + Bullish, not a fifth preset. */
type TapeView = 'STREAM' | 'NOTABLE' | 'PREMIUM' | 'SIZE';

const VIEW_META: Record<TapeView, { label: string; hint: string }> = {
  STREAM: { label: 'Stream', hint: "The clock's order, newest first" },
  NOTABLE: { label: 'Notable', hint: 'Conviction-ranked — the prints that matter most first' },
  PREMIUM: { label: 'Premium', hint: 'Biggest dollars first' },
  SIZE: { label: 'Size', hint: 'Most contracts first' },
};
type SentFilter = 'ALL' | PrintSentiment;
type PremKey = '0' | '100000' | '500000' | '1000000';

const PREM_CHIPS: { value: Exclude<PremKey, '0'>; label: string }[] = [
  { value: '100000', label: '≥$100K' },
  { value: '500000', label: '≥$500K' },
  { value: '1000000', label: '≥$1M' },
];

/* The four cuts as cards on the controls line (the walk, 2026-09-09) */
const ORDER_OPTIONS: DropdownOption<TapeView>[] = (Object.keys(VIEW_META) as TapeView[]).map(v => ({ value: v, label: VIEW_META[v].label, hint: VIEW_META[v].hint }));
const KIND_OPTIONS: DropdownOption<FlowFilter>[] = [
  { value: 'ALL', label: 'Sweeps and blocks', hint: 'Every print' },
  { value: 'SWEEP', label: 'Sweeps', hint: 'Aggressive orders swept across exchanges' },
  { value: 'BLOCK', label: 'Blocks', hint: 'Negotiated size, one print' },
];
const LEAN_OPTIONS: DropdownOption<SentFilter>[] = [
  { value: 'ALL', label: 'Both ways', hint: 'Bullish and bearish prints' },
  { value: 'BULLISH', label: 'Bullish', hint: 'Calls bought, puts sold' },
  { value: 'BEARISH', label: 'Bearish', hint: 'Puts bought, calls sold' },
];
const PREM_OPTIONS: DropdownOption<PremKey>[] = [{ value: '0', label: 'Any', hint: 'No floor' }, ...PREM_CHIPS.map(c => ({ value: c.value, label: c.label, hint: `Only prints ${c.label}` }))];

/** Fixed widths where a header or a cell would otherwise clip; the tag takes the rest */
const WIDTHS: Record<string, number> = { time: 124, ticker: 96, contract: 150, dte: 64, otm: 76, spot: 84, fill: 80, spread: 132, size: 72, prem: 92, flow: 92, dayRatio: 100, sentiment: 96, vol: 76, oi: 76, deltaOi: 84, volOverOi: 80, iv: 64 };
const FLEXES: Record<string, number> = { tag: 1 };
/** What the short headers mean, on hover (the dotted explainers of the old table) */
const TOOLTIPS: Record<string, string> = {
  otm: 'How far the strike sits from the spot, as a share of the spot',
  spread: 'Where the fill landed between the bid and the ask',
  prem: 'Dollars paid — size × fill × 100',
  flow: 'Which side of the spread was hit, and how hard',
  dayRatio: "The day's prints on the ask against the bid, for this contract",
  sentiment: 'Bullish, bearish or neutral — by the side hit and the right',
  deltaOi: 'Open interest change since yesterday',
  volOverOi: "Today's volume against open interest — above 1.5, positions were built today",
  iv: 'Implied volatility of the contract',
  tag: 'A sweep, or the structure the print belongs to',
};

/** The tape's clock speaks the house's 24-hour time (the Screener's "18:16",
    the hold's "as of HH:MM") — the simulator hands prints "6:17:50 PM". */
const to24h = (t: string): string => {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return t;
  let h = Number(m[1]) % 12;
  if (m[4].toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}${m[3] ? `:${m[3]}` : ''}`;
};

/* One formatter, reused: `toLocaleString` builds a new one per call, and a
   tape of 120 rows × several figures each spent 12ms of its open in it. */
const NUM = new Intl.NumberFormat('en-US');
const num = (v: number) => NUM.format(v);

/** One stretch of the read — a plain sentence piece, or a contract door. */
type ReadSeg = string | { print: FlowPrint; label: string };

/** The terminal's read of the tape — same voice as market notes. The largest
    print travels as a DOOR segment: the sentence names a contract, so it
    opens that contract's card (Noah, 2026-08-30). */
function tapeRead(rows: FlowPrint[], summary: TapeSummary): ReadSeg[] {
  if (rows.length === 0) return ['Awaiting prints…'];
  const zdte = rows.filter(r => r.dte === 0).length;
  const segs: ReadSeg[] = [
    `${summary.bullish ? 'Bullish' : 'Bearish'} tape — ${
      summary.bullish ? 'aggressive call buying leads' : 'put premium leads'
    } by ${fmtUsd(Math.abs(summary.netPremium))}`,
  ];
  if (summary.largest) {
    const L = summary.largest;
    const hit = rows.find(r => r.ticker === L.ticker && r.strike === L.strike && r.right === L.right && r.premium === L.premium);
    segs.push(' · largest print ');
    if (hit) segs.push({ print: hit, label: `${L.ticker} ${L.strike}${L.right}` });
    else segs.push(`${L.ticker} ${L.strike}${L.right}`);
    segs.push(` at [[${fmtUsd(L.premium)}]]`);
  }
  if (summary.sweeps > 2) segs.push(` · ${summary.sweeps} sweeps on the tape`);
  if (rows.length >= 20 && zdte / rows.length > 0.25) segs.push(` · 0DTE is ${Math.round((zdte / rows.length) * 100)}% of flow`);
  segs.push('.');
  return segs;
}

// ---- the tape's own cells -----------------------------------------------------
const SpreadCell = ({ print }: { print: FlowPrint }) => {
  const dot = print.side === 'ASK' ? 'bg-bull' : print.side === 'BID' ? 'bg-bear' : 'bg-ink/50';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[9px] tnum text-textMuted">{print.bid.toFixed(2)}</span>
      <span className="relative w-12 h-[3px] rounded-full bg-ink/[0.07]">
        <span
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[6px] h-[6px] rounded-full ${dot}`}
          style={{ left: `${print.fillPos * 100}%` }}
        />
      </span>
      <span className="font-mono text-[9px] tnum text-textMuted">{print.ask.toFixed(2)}</span>
    </span>
  );
};

/** Side + conviction read. BUY = hit the ask, SELL = hit the bid. The flow
    grade itself is engine-internal (Noah, 2026-08-16) — the centered bar's
    reach and side carry the conviction. */
const FlowCell = ({ print }: { print: FlowPrint }) => {
  const score = print.flowScore;
  const bar = score > 15 ? 'bg-bull/90' : score < -15 ? 'bg-bear/80' : 'bg-ink/25';
  const half = Math.abs(score) / 2;
  const sideLabel = print.side === 'ASK' ? 'BUY' : print.side === 'BID' ? 'SELL' : 'MID';
  return (
    /* 14px label + 3 + 3 = the Lean cell's exact height, so a row carrying
       both stays the Screener's 39px (measured 43 with the pill's own
       padding — the one cell that was taller than the table's line). */
    <span className="inline-flex flex-col items-start gap-[3px] w-16">
      <span
        className={`inline-flex w-9 justify-center rounded border px-1 leading-[12px] font-mono text-[9px] font-semibold ${
          print.side === 'ASK'
            ? 'border-bull/30 bg-bull/[0.07] text-bull'
            : print.side === 'BID'
              ? 'border-bear/30 bg-bear/[0.07] text-bear'
              : 'border-borderSubtle text-textMuted'
        }`}
      >
        {sideLabel}
      </span>
      <span className="relative w-16 h-[3px] rounded-full bg-ink/[0.07]">
        <span className="absolute left-1/2 top-0 bottom-0 w-px bg-ink/20" />
        <span
          className={`absolute top-0 bottom-0 rounded-full ${bar}`}
          style={score >= 0 ? { left: '50%', width: `${half}%` } : { right: '50%', width: `${half}%` }}
        />
      </span>
    </span>
  );
};

const SENT_TEXT: Record<PrintSentiment, string> = {
  BULLISH: 'text-bull',
  BEARISH: 'text-bear',
  NEUTRAL: 'text-textMuted',
};

// ---- the row model --------------------------------------------------------------
/* A print in the table, with the rank it holds in a ranked view. Wrappers
   are CACHED per (print, rank): a row whose facts did not move keeps its
   identity, so DataTable's memoised row sits the tick out — the tape's
   smoothness under a print a second (Noah, 2026-08-18: "buffering and
   resizing itself") now lives in the shared table instead of a private
   one. The bookmark is not in here: the star reads the watch store itself,
   so a bookmark flipping redraws one star, not one row. */
interface TapeRow {
  p: FlowPrint;
  rank?: number;
}

type TapeGroup = 'Contract' | 'Execution' | 'Conviction' | 'Activity';
const TAPE_GROUP_ORDER: TapeGroup[] = ['Contract', 'Execution', 'Conviction', 'Activity'];

/** A DataTable column that also knows its plain label and its chooser group. */
interface TapeColumn extends Column<TapeRow> {
  label: string;
  group?: TapeGroup;
}

/** Every row fades in on arrival — the same class the old private rows wore. */
const FADE_ROW = () => 'animate-fade-in';

// ---- search (ticker OR contract) -------------------------------------------------
/** One matcher for the field and the row filter: strip everything but letters
    and digits so "SPY 505C", "spy505c" and "505C" all hit SPY 505C. */
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const matchesTape = (r: FlowPrint, nq: string) =>
  nq === '' || norm(`${r.ticker}${r.strike}${r.right}`).includes(nq);

// ---- the page ---------------------------------------------------------------------
const LiveTape = () => {
  const { marketData, flowTape } = useMarketData();
  /* SEEDED, not empty (Noah, 2026-08-30, the open-time hop). The tape used to
     mount with no rows — one frame of "Awaiting first prints…", then fill
     34ms later and keep growing tick by tick for forty seconds. The provider
     already keeps a rolling buffer of enriched prints for exactly this; the
     first paint now shows it. */
  const [rows, setRows] = useState<FlowPrint[]>(() => flowTape.slice(0, MAX_ROWS));
  // The same hold every Trace page wears (see LiveHold); the tape's own
  // effect below is what actually stops the prints.
  const hold = useHold(marketData);
  const paused = hold.paused;
  /* The bookmarks live in the Trace watch store now (2026-09-03) — they
     survive the page, and the Tracker reads them. */
  const { isWatched, toggle: toggleWatch } = useWatch();
  // The read is seeded from the same buffer, so the strip is its real height
  // on the first frame instead of a one-line placeholder that grows.
  const [read, setRead] = useState<ReadSeg[]>(() => {
    const seed = flowTape.slice(0, MAX_ROWS);
    return seed.length ? tapeRead(seed, summarizeTape(seed)) : ['Awaiting prints…'];
  });
  const [flowFilter, setFlowFilter] = useState<FlowFilter>('ALL');
  const [sentFilter, setSentFilter] = useState<SentFilter>('ALL');
  const [minPremKey, setMinPremKey] = useState<PremKey>('0');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<TapeView>('STREAM');
  /** The print open in the drilldown. Held as the OBJECT, not an id: the tape
      buffer is capped, so a print the user is reading eventually scrolls out of
      it — looking it up by id would silently close the drilldown mid-read. */
  const [openPrint, setOpenPrint] = useState<FlowPrint | null>(null);
  // Continue the seed's ids, never restart at 0 under them (row keys).
  const idRef = useRef(flowTape.reduce((m, p) => Math.max(m, p.id), 0));
  // The tick already folded into the seed — the effect must not append it twice.
  const seededTickRef = useRef(marketData);
  const lastReadRef = useRef(0);

  /* THE RAIL'S TWO STANCES (the Compass board's rule, 2026-09-11): measured
     off the grid's column with a callback ref — a tape taller than the
     screen → the rail sticks; a short cut → it adopts the tape's height. */
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const [gridH, setGridH] = useState(0);
  useEffect(() => {
    if (!gridEl) return;
    const ro = new ResizeObserver(() => setGridH(gridEl.getBoundingClientRect().height));
    ro.observe(gridEl);
    return () => ro.disconnect();
  }, [gridEl]);
  const railSticks = gridH > window.innerHeight - 40;

  /* The side rail's door — shown unless the reader closed it last time. */
  const [rail, setRail] = useState<boolean>(() => {
    try {
      return localStorage.getItem(RAIL_KEY) !== 'hidden';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, rail ? 'shown' : 'hidden');
    } catch {
      /* non-fatal */
    }
  }, [rail]);

  useEffect(() => {
    if (!marketData || paused || marketData === seededTickRef.current) return;
    const fresh = marketData.tape.map(o => enrichPrint(o, ++idRef.current));
    if (fresh.length === 0) return;
    setRows(prev => [...fresh, ...prev].slice(0, MAX_ROWS));
  }, [marketData, paused]);

  const summary = useMemo(() => summarizeTape(rows), [rows]);

  const filtered = useMemo(() => {
    const minPrem = Number(minPremKey);
    const nq = norm(searchQuery);
    return rows.filter(
      r =>
        (flowFilter === 'ALL' || (flowFilter === 'SWEEP' ? r.sweep : !r.sweep)) &&
        (sentFilter === 'ALL' || sentimentOf(r) === sentFilter) &&
        r.premium >= minPrem &&
        matchesTape(r, nq)
    );
  }, [rows, flowFilter, sentFilter, minPremKey, searchQuery]);

  // The strip and the tape read FOLLOW THE ACTIVE VIEW (Noah, 2026-08-18): an
  // NVDA-filtered table under a market-wide verdict and an SPY whale silently
  // answered two different questions. The strip renames itself to its scope so
  // it can never be misread; clearing filters restores the session's truth.
  // What the table actually shows: the filtered view, in the view's order.
  // Ranked views re-sort per tick, but big prints hold their ranks — only the
  // tail churns, and keyed reorders are DOM moves, not re-renders.
  const displayRows = useMemo(() => {
    switch (view) {
      case 'NOTABLE':
        return rankNotable(filtered);
      case 'PREMIUM':
        return [...filtered].sort((a, b) => b.premium - a.premium);
      case 'SIZE':
        return [...filtered].sort((a, b) => b.size - a.size);
      default:
        return filtered;
    }
  }, [view, filtered]);

  /* The wrapper cache (see TapeRow). Rebuilt from the previous map each
     pass so it never outgrows the rows on screen. */
  const wrapRef = useRef(new Map<number, TapeRow>());
  const tableRows = useMemo<TapeRow[]>(() => {
    const prev = wrapRef.current;
    const next = new Map<number, TapeRow>();
    const out = displayRows.map((p, i) => {
      const rank = view === 'STREAM' ? undefined : i + 1;
      const was = prev.get(p.id);
      const w = was && was.p === p && was.rank === rank ? was : { p, rank };
      next.set(p.id, w);
      return w;
    });
    wrapRef.current = next;
    return out;
  }, [displayRows, view]);

  /* How many of the prints on the tape right now are bookmarked. */
  const markedCount = useMemo(() => rows.reduce((n, r) => n + (isWatched(printKey(r)) ? 1 : 0), 0), [rows, isWatched]);

  /* The read still speaks the active SCOPE (the beam is gone — Noah + partner,
     2026-08-23 — but the scoped rows/summary survive it). */
  const scopeActive =
    searchQuery.trim() !== '' || flowFilter !== 'ALL' || sentFilter !== 'ALL' || minPremKey !== '0';
  const beamRows = scopeActive ? filtered : rows;
  const beamSummary = useMemo(
    () => (scopeActive ? summarizeTape(filtered) : summary),
    [scopeActive, filtered, summary]
  );

  /* The whale doors (Noah kept these when the beam went, 2026-08-23):
     largest bullish, largest bearish, and the overall largest — which only
     earns its own pill when it traded mid and is neither of those two. */
  const whales = useMemo(() => {
    let all: FlowPrint | null = null;
    let bull: FlowPrint | null = null;
    let bear: FlowPrint | null = null;
    for (const p of beamRows) {
      if (!all || p.premium > all.premium) all = p;
      const s = sentimentOf(p);
      if (s === 'BULLISH' && (!bull || p.premium > bull.premium)) bull = p;
      if (s === 'BEARISH' && (!bear || p.premium > bear.premium)) bear = p;
    }
    return { all, bull, bear };
  }, [beamRows]);
  /* The one magenta number in the table — the Screener's champion rule, on
     the print the strip already calls the largest. Changes only when a new
     largest lands, so the columns (and every memoised row) hold still. */
  const champId = whales.all?.id ?? -1;

  // 0DTE share of the active view — same-day contracts as a slice of the flow
  const zdteShare = useMemo(() => {
    if (beamRows.length === 0) return 0;
    return beamRows.filter(r => r.dte === 0).length / beamRows.length;
  }, [beamRows]);

  const topTickers = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.ticker, (m.get(r.ticker) ?? 0) + r.premium);
    return [...m.entries()]
      .map(([ticker, premium]) => ({ ticker, premium }))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 6);
  }, [rows]);
  const topMax = topTickers[0]?.premium ?? 1;

  // Dark-pool crosses for the rail — deterministic per ticker, so keyed on the
  // active symbol rather than every tick
  const activeTicker = marketData?.ticker;
  const darkPrints = useMemo(() => {
    if (!marketData) return [];
    return buildGexView(marketData, 'GEX', 10)
      .board.flatMap(t =>
        t.prints.map((p, i) => ({
          key: `${t.ticker}-${i}`,
          ticker: t.ticker,
          size: p.size,
          price: p.price,
          notional: p.notional,
          time: p.time,
          date: p.date,
        }))
      )
      .sort((a, b) => b.notional - a.notional)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicker]);

  // The read speaks the same scope as the strip. A scope CHANGE bypasses the
  // 8s throttle — switching to NVDA and reading a market-wide sentence for
  // eight more seconds would be the same lie the beam just stopped telling.
  const scopeKey = `${searchQuery}|${flowFilter}|${sentFilter}|${minPremKey}`;
  const lastScopeRef = useRef(scopeKey);
  useEffect(() => {
    const now = Date.now();
    const scopeChanged = scopeKey !== lastScopeRef.current;
    if (!scopeChanged && now - lastReadRef.current < READ_INTERVAL_MS && beamRows.length > 3) return;
    lastScopeRef.current = scopeKey;
    lastReadRef.current = now;
    setRead(beamRows.length === 0 ? ['No prints in this view.'] : tapeRead(beamRows, beamSummary));
  }, [beamRows, beamSummary, scopeKey]);

  /* The card's bookmark, by tape id — the card only knows the id, the store
     wants the print; the rows ref keeps this callback stable. */
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const toggleMark = useCallback(
    (id: number) => {
      const p = rowsRef.current.find(r => r.id === id);
      if (p) toggleWatch(watchPrint(p, 'tape'));
    },
    [toggleWatch]
  );
  const keyOf = useCallback((r: TapeRow) => String(r.p.id), []);
  const openRow = useCallback((r: TapeRow) => setOpenPrint(r.p), []);

  // Drilldown navigation — stepping moves through the FILTERED view, so ↑/↓
  // walks exactly the rows the user is looking at. Once the open print has aged
  // out of the buffer it is no longer steerable, but it stays open and readable.
  const openIdx = openPrint ? displayRows.findIndex(r => r.id === openPrint.id) : -1;
  const stepPrint = (dir: -1 | 1) => {
    if (openIdx < 0) return;
    const next = openIdx + dir;
    if (next >= 0 && next < displayRows.length) setOpenPrint(displayRows[next]);
  };

  // ↑/↓ step through prints while the drilldown is open
  useEffect(() => {
    if (openPrint === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      stepPrint(e.key === 'ArrowUp' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPrint, openIdx, displayRows]);

  /* THE COLUMNS, in the siblings' registers. Distance and interest are facts
     in neutral ink (the Screener's BPS rule — this also ends the tape
     colouring OTM % while the Screener did not); signed changes wear
     direction ink; premium has three registers — quiet, bold from $250K,
     and the one magenta champion. Stable across ticks: nothing in here
     reads a value that moves with the clock except the champion's id. */
  const columns = useMemo<TapeColumn[]>(
    () => [
      {
        key: 'time',
        label: 'Time',
        header: 'Time',
        sortValue: r => r.p.id,
        render: r => (
          <span className="inline-flex items-center gap-1.5">
            <WatchStar k={printKey(r.p)} make={() => watchPrint(r.p, 'tape')} noun="print" />
            {r.rank !== undefined && <span className="w-7 shrink-0 text-[10px] font-bold text-textPrimary">#{r.rank}</span>}
            <span className="text-[11px] text-textSecondary">{to24h(r.p.time)}</span>
          </span>
        ),
      },
      {
        key: 'ticker',
        label: 'Ticker',
        group: 'Contract',
        header: 'Ticker',
        sortValue: r => r.p.ticker,
        render: r => (
          <span className="inline-flex items-center gap-1.5">
            <CompanyLogo ticker={r.p.ticker} size={15} />
            <span className="font-bold text-textPrimary">{r.p.ticker}</span>
            {/* White, not lime (Noah, 2026-08-30): a leg count is a fact, not a status. */}
            {r.p.legs > 1 && <span className="text-[9px] text-textPrimary">×{r.p.legs}</span>}
          </span>
        ),
      },
      {
        key: 'contract',
        label: 'Contract',
        group: 'Contract',
        header: 'Contract',
        align: 'right',
        sortValue: r => r.p.strike,
        render: r => <ContractCell strike={r.p.strike} right={r.p.right} expiry={r.p.expiry} />,
      },
      {
        key: 'dte',
        label: 'DTE',
        group: 'Contract',
        header: 'DTE',
        align: 'right',
        sortValue: r => r.p.dte,
        render: r => <span className="text-textPrimary">{r.p.dte}d</span>,
      },
      {
        key: 'otm',
        label: 'OTM %',
        group: 'Contract',
        header: 'OTM %',
        align: 'right',
        sortValue: r => r.p.otmPct,
        render: r => (
          <span className="text-textSecondary">
            {r.p.otmPct >= 0 ? '+' : ''}
            {r.p.otmPct.toFixed(1)}%
          </span>
        ),
      },
      {
        key: 'spot',
        label: 'Spot',
        group: 'Contract',
        header: 'Spot',
        align: 'right',
        sortValue: r => r.p.spot,
        render: r => <span className="text-textSecondary">${r.p.spot.toFixed(2)}</span>,
      },
      {
        key: 'fill',
        label: 'Fill',
        group: 'Execution',
        header: 'Fill',
        align: 'right',
        sortValue: r => r.p.fill,
        render: r => <span className="text-textPrimary">${r.p.fill.toFixed(2)}</span>,
      },
      {
        key: 'spread',
        label: 'Spread',
        group: 'Execution',
        header: 'Spread',
        render: r => <SpreadCell print={r.p} />,
      },
      {
        key: 'size',
        label: 'Size',
        group: 'Execution',
        header: 'Size',
        align: 'right',
        sortValue: r => r.p.size,
        render: r => <span className="text-textPrimary">{num(r.p.size)}</span>,
      },
      {
        key: 'prem',
        label: 'Prem',
        group: 'Execution',
        header: 'Prem',
        align: 'right',
        sortValue: r => r.p.premium,
        render: r => (
          <span
            className={
              r.p.id === champId
                ? 'text-supreme font-bold'
                : r.p.premium >= 250_000
                  ? 'font-bold text-textPrimary'
                  : 'text-textSecondary'
            }
          >
            {fmtUsd(r.p.premium)}
          </span>
        ),
      },
      {
        key: 'flow',
        label: 'Flow',
        group: 'Conviction',
        header: 'Flow',
        sortValue: r => r.p.flowScore,
        render: r => <FlowCell print={r.p} />,
      },
      {
        key: 'dayRatio',
        label: 'Day ratio',
        group: 'Conviction',
        header: 'Day ratio',
        align: 'right',
        sortValue: r => 100 - r.p.ratioBidPct,
        // The Screener's Lean cell IS the tape's old ratio cell, shared.
        render: r => <LeanCell askPct={100 - r.p.ratioBidPct} />,
      },
      {
        key: 'sentiment',
        label: 'Sentiment',
        group: 'Conviction',
        header: 'Sentiment',
        align: 'right',
        sortValue: r => sentimentOf(r.p),
        render: r => {
          const s = sentimentOf(r.p);
          return <span className={`text-[10px] font-semibold ${SENT_TEXT[s]}`}>{s}</span>;
        },
      },
      {
        key: 'vol',
        label: 'Vol',
        group: 'Activity',
        header: 'Vol',
        align: 'right',
        sortValue: r => r.p.volume,
        render: r => <span className="text-textSecondary">{num(r.p.volume)}</span>,
      },
      {
        key: 'oi',
        label: 'OI',
        group: 'Activity',
        header: 'OI',
        align: 'right',
        sortValue: r => r.p.oi,
        render: r => <span className="text-textSecondary">{num(r.p.oi)}</span>,
      },
      {
        key: 'deltaOi',
        label: 'ΔOI',
        group: 'Activity',
        header: 'ΔOI',
        align: 'right',
        sortValue: r => r.p.deltaOI,
        render: r =>
          r.p.deltaOI === 0 ? (
            <span className="text-textMuted">—</span>
          ) : (
            <span className={r.p.deltaOI > 0 ? 'text-bull' : 'text-bear'}>
              {r.p.deltaOI > 0 ? '+' : ''}
              {num(r.p.deltaOI)}
            </span>
          ),
      },
      {
        key: 'volOverOi',
        label: 'Vol/OI',
        group: 'Activity',
        header: 'Vol/OI',
        align: 'right',
        sortValue: r => r.p.volOverOI,
        // ≥1.5 = positions built TODAY — weight carries it, not neon.
        render: r => (
          <span className={r.p.volOverOI >= 1.5 ? 'font-bold text-textPrimary' : 'text-textSecondary'}>
            {r.p.volOverOI.toFixed(2)}
          </span>
        ),
      },
      {
        key: 'iv',
        label: 'IV',
        group: 'Activity',
        header: 'IV',
        align: 'right',
        sortValue: r => r.p.iv,
        render: r => <span className="text-textPrimary">{r.p.iv.toFixed(0)}%</span>,
      },
      {
        key: 'tag',
        label: 'Tag',
        group: 'Activity',
        header: 'Tag',
        sortValue: r => (r.p.sweep ? 'SWEEP' : r.p.strat),
        render: r => (
          <span className="text-[9px] text-textMuted">
            {r.p.sweep ? <span className="text-warn font-semibold">SWEEP</span> : r.p.strat}
          </span>
        ),
      },
    ],
    [champId]
  );

  /* The chooser offers every column but the time rail, which is always on. */
  const { hidden, toggle, showAll, hideAll } = useHiddenColumns(COLS_KEY);
  const chooserCols = useMemo(
    () => columns.filter(c => c.key !== 'time').map(c => ({ key: c.key, label: c.label, group: c.group })),
    [columns]
  );
  const [guideOpen, setGuideOpen] = useState(false);

  const pill = (p: FlowPrint) => (
    <>
      {p.ticker} {p.strike}
      {p.right} · {fmtUsd(p.premium)}
    </>
  );

  const readNode = read.map((seg, i) =>
    typeof seg === 'string' ? (
      <RichRead key={i} text={seg} />
    ) : (
      <ReadDoor key={i} onOpen={() => setOpenPrint(seg.print)}>
        {seg.label}
      </ReadDoor>
    )
  );

  return (
    <>
      <TraceBox
        title="The tape"
        sub={`${VIEW_META[view].label} — ${VIEW_META[view].hint} · a row opens the print's card, the mark at its left keeps it under watch`}
        testId="live-tape"
        data={{ view, prints: filtered.length, rail: rail ? 'shown' : 'hidden' }}
        guide={{ title: 'How to read the tape', door: 'What a print, its fill and its conviction mean', body: <LiveTapeGuide />, testId: 'live-tape-guide', open: guideOpen, onOpen: setGuideOpen }}
        facts={
          <>
            <Fact label="Prints" testId="prints">
              {filtered.length} <span className="text-textMuted">of {rows.length} · {markedCount} marked</span>
            </Fact>
            <Fact label="Premium" testId="premium" title="Call and put premium in this view">
              <span className="text-bull">{beamSummary.callCount}C</span> {fmtUsd(beamSummary.callPremium)} <span className="text-textMuted">/</span> <span className="text-bear">{beamSummary.putCount}P</span> {fmtUsd(beamSummary.putPremium)}
            </Fact>
            <Fact label="Sweeps · blocks · P/C" testId="kinds" title="Sweeps, blocks, and put premium against call premium in this view">
              {beamSummary.sweeps} <span className="text-textMuted">·</span> {beamSummary.blocks} <span className="text-textMuted">·</span> {beamSummary.pcRatio.toFixed(2)}
            </Fact>
            <Fact label="0DTE" testId="odte" title="Share of this view's prints expiring today">
              <span className={zdteShare >= 0.25 ? 'text-warn' : undefined}>{Math.round(zdteShare * 100)}%</span> <span className="text-textMuted">of flow</span>
            </Fact>
            {whales.bull && whales.bull !== whales.all && (
              <Champion label="Top bull" ink="bull" onOpen={() => setOpenPrint(whales.bull)} testId="bull">
                {pill(whales.bull)}
              </Champion>
            )}
            {whales.bear && whales.bear !== whales.all && (
              <Champion label="Top bear" ink="bear" onOpen={() => setOpenPrint(whales.bear)} testId="bear">
                {pill(whales.bear)}
              </Champion>
            )}
            {whales.all && (
              <Champion label="Largest print" ink="supreme" onOpen={() => setOpenPrint(whales.all)} testId="largest">
                {pill(whales.all)}
              </Champion>
            )}
          </>
        }
        controls={
          <>
            <LiveHold paused={paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
            <FlowSearch value={searchQuery} onChange={setSearchQuery} rows={rows} />
            <DropdownSelect label="Order" value={view} options={ORDER_OPTIONS} onChange={setView} title="How the prints are ordered" testId="tape-order" />
            <DropdownSelect label="Kind" value={flowFilter} options={KIND_OPTIONS} onChange={setFlowFilter} title="Sweeps, blocks, or both" testId="tape-kind" />
            <DropdownSelect label="Lean" value={sentFilter} options={LEAN_OPTIONS} onChange={setSentFilter} title="Bullish prints, bearish prints, or both" testId="tape-lean" />
            <DropdownSelect label="Premium" value={minPremKey} options={PREM_OPTIONS} onChange={setMinPremKey} title="The smallest print shown" testId="tape-premium" />
            <span className="ml-auto flex items-center gap-2">
              {/* The side rail's door — silver-white when the rail is up (where you
                  are), quiet when it is away. Not lime: a layout choice is not a
                  status. */}
              <button
                onClick={() => setRail(r => !r)}
                aria-pressed={rail}
                title={rail ? 'Hide the side rail — top names and dark pool' : 'Show the side rail — top names and dark pool'}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  rail ? 'border-borderMuted bg-ink/[0.05] text-textPrimary' : 'border-borderSubtle bg-ink/[0.02] text-textSecondary hover:text-textPrimary'
                }`}
                data-tape-rail-door
              >
                <PanelRight className="w-3 h-3" />
                Rail
              </button>
              <ColumnChooser columns={chooserCols} hidden={hidden} onToggle={toggle} onAll={showAll} onNone={() => hideAll(chooserCols.map(c => c.key))} groupOrder={TAPE_GROUP_ORDER} />
            </span>
          </>
        }
        sentence={<>{readNode}</>}
      >
        {/* The grid in its window and, beside it, the rail. Rail away, the grid takes the whole window. */}
        <div className="flex" data-tape-body>
          <div ref={setGridEl} className="flex-1 min-w-0">
            <TraceGrid
              rows={tableRows}
              columns={columns}
              hidden={hidden}
              widths={WIDTHS}
              flexes={FLEXES}
              tooltips={TOOLTIPS}
              rowKey={keyOf}
              onRowClick={openRow}
              selectedKey={openPrint ? String(openPrint.id) : null}
              rowClass={FADE_ROW}
              animate={false}
              autoHeight
              emptyText={rows.length === 0 ? 'Awaiting first prints…' : 'No prints on this cut'}
              testId="live-tape"
            />
          </div>

          {rail && (
            /* Right rail: the session's top names, then the dark-pool crosses —
               two heads inside the box. THE RAIL'S TWO STANCES (the Compass
               board's rule, 2026-09-11): a tape taller than the screen → the
               rail STICKS a screen tall while the page scrolls; a short cut →
               the rail adopts the tape's height and both end on one line. */
            <aside
              className={`w-[360px] shrink-0 border-t border-l border-borderSubtle flex flex-col overflow-hidden animate-fade-in ${railSticks ? 'self-start sticky top-5 h-[calc(100vh-40px)]' : 'self-stretch'}`}
              data-tape-rail={railSticks ? 'sticks' : 'adopts'}
            >
              <div className="px-4 pt-3 pb-3 border-b border-borderSubtle" data-tape-rail-names>
                <h3 className="text-[11px] font-semibold text-textPrimary leading-tight">Top names</h3>
                <p className="text-[10px] text-textMuted">Session premium by name · one cuts the tape to it</p>
                {/* ALWAYS six slots: the rolling buffer's ticker mix breathes, and
                    a list that gains or loses a row reflows the whole rail. Ghost
                    rows hold the height until the tape fills them. */}
                <div className="mt-2.5 flex flex-col gap-2.5">
                  {topTickers.map((t, i) => (
                    <button
                      key={t.ticker}
                      onClick={() => setSearchQuery(q => (q === t.ticker ? '' : t.ticker))}
                      title={searchQuery === t.ticker ? 'Clear the cut' : `Cut the tape to ${t.ticker}`}
                      className="flex items-center gap-2 group text-left"
                    >
                      <span className={`w-12 shrink-0 font-mono text-[11px] font-semibold transition-colors ${searchQuery === t.ticker ? 'text-select' : i === 0 ? 'text-supreme' : 'text-textPrimary'} group-hover:text-select`}>
                        {t.ticker}
                      </span>
                      <span className="relative flex-1 h-[5px] rounded-full bg-ink/[0.05]">
                        <span className={`absolute inset-y-0 left-0 rounded-full ${searchQuery === t.ticker ? 'bg-select/70' : i === 0 ? 'bg-supreme/70' : 'bg-ink/25'}`} style={{ width: `${(t.premium / topMax) * 100}%` }} />
                      </span>
                      <span className="w-14 shrink-0 text-right font-mono text-[10px] tnum text-textSecondary">{fmtUsd(t.premium)}</span>
                    </button>
                  ))}
                  {Array.from({ length: Math.max(0, 6 - topTickers.length) }, (_, i) => (
                    <div key={`ghost-${i}`} aria-hidden="true" className="flex items-center gap-2 select-none">
                      <span className="w-12 shrink-0 font-mono text-[11px] text-textMuted/40">—</span>
                      <span className="flex-1 h-[5px] rounded-full bg-ink/[0.03]" />
                      <span className="w-14 shrink-0 text-right font-mono text-[10px] text-textMuted/40">—</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col" data-tape-rail-dark>
                <div className="px-4 pt-3 pb-2">
                  <h3 className="text-[11px] font-semibold text-textPrimary leading-tight">Dark pool</h3>
                  <p className="text-[10px] text-textMuted">Off-exchange crosses, largest first</p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {darkPrints.length === 0 ? (
                    <span className="block font-mono text-[10px] text-textMuted uppercase tracking-widest py-6 text-center">Awaiting prints…</span>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-panel">
                          {['Ticker', 'Size', 'Price', 'Notional', 'Time'].map((h, i) => (
                            <th key={h} className={`px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-textSecondary border-y border-borderSubtle ${i === 0 ? 'text-left pl-4' : 'text-right'} ${i === 4 ? 'pr-4' : ''}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {darkPrints.map(p => (
                          <tr key={p.key} title={`${p.date} · ${p.time}`} className="border-b border-borderSubtle/30 last:border-0 hover:bg-ink/[0.02] transition-colors">
                            <td className="px-2 pl-4 py-2 whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-darkpool" />
                                <span className="font-mono text-[11px] font-semibold text-textPrimary">{p.ticker}</span>
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-[11px] tnum text-textSecondary">{p.size.toLocaleString()}</td>
                            <td className="px-2 py-2 text-right font-mono text-[11px] tnum text-textSecondary">${p.price.toFixed(2)}</td>
                            <td className="px-2 py-2 text-right font-mono text-[11px] font-bold tnum text-textPrimary">${p.notional.toFixed(2)}B</td>
                            <td className="px-2 pr-4 py-2 text-right font-mono text-[10px] tnum text-textSecondary whitespace-nowrap">{p.time.slice(0, 5)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </TraceBox>

      {/* Print drilldown — a centred card over the tape, so the rows you are
          comparing against stay visible behind it */}
      <PrintDrilldown
        print={openPrint}
        snapshot={marketData}
        onClose={() => setOpenPrint(null)}
        isMarked={openPrint ? isWatched(printKey(openPrint)) : false}
        onToggleMark={toggleMark}
        onStep={stepPrint}
        hasPrev={openIdx > 0}
        hasNext={openIdx >= 0 && openIdx < displayRows.length - 1}
        tapeRows={rows}
        onOpenPrint={setOpenPrint}
      />
    </>
  );
};

export default LiveTape;
