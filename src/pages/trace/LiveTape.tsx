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
  and its three whales as champions; one line of cards — the search,
  Order / Kind / Lean / Premium / Expiry and the column chooser; the tape
  read as the sentence; the AG Grid in its window. What stayed the tape's
  own: the Stream/Notable/Premium/Size order (the Order card, named in the
  sub line), the mark in the time cell, the fill-in-spread and conviction
  cells, and the wrapper cache that keeps a row still while its print does
  not move.

  THE TAPE IS THE WHOLE WINDOW (Noah, 2026-09-12: "completely remove the
  live/pause button because its a live tape why are people pausing it and
  then also remove the top names and darkpool panels we have on it"). No
  hold — a live tape runs; the side rail and its door are gone, the grid
  takes the box edge to edge, and the dark pool has its own page under
  Trace (pages/trace/DarkPool.tsx). What the tape gained the same day: an
  Expiry card on the controls line, the calendar cut to the dates the
  prints in the buffer actually carry, "every expiry" where it opens.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import { printKey, useWatch, watchPrint } from '../../context/WatchContext';
import WatchStar from '../../components/trace/WatchStar';
import { enrichPrint, rankNotable, sentimentOf, summarizeTape } from '../../data/tape';
import { fmtUsd } from '../../data/gex';
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
import { SavedCutsControl, SavedCutsList, useSavedCuts } from '../../components/trace/SavedCuts';
import { createViewStore } from '../../data/savedViews';
import TraceBox, { Champion, Fact, TraceGrid } from '../../components/trace/TraceBox';
import ExpiryCalendar from '../../components/ui/ExpiryCalendar';
import { useExpiryCut } from '../../components/trace/bookExpiry';
import { isoDate } from '../../core/calendar';
import { LiveTapeGuide } from '../../components/trace/TraceGuide';
import type { FlowPrint, PrintSentiment, TapeSummary } from '../../types/trace';

const MAX_ROWS = 120;
const READ_INTERVAL_MS = 8_000;
/* The shared chooser stores the HIDDEN set (see ColumnChooser); the old
   key held the visible one, so this is a new key rather than a misread. */
const COLS_KEY = 'slayer_tape_hidden';

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

/* THE CUT IS THE ADDRESS, on the tape too (data/savedViews). The screener
   learned this and kept it; the tape — the surface a trader most wants to
   hand someone, because what is on it right now is the whole point — had no
   way to send or save a thing. Only what DIFFERS from the default tape is
   written, so an untouched tape has a clean URL and a shared one carries
   exactly the decisions that were made. */
const TAPE_CUTS = createViewStore('slayer_tape_cuts_v1');
interface TapeCut {
  view: TapeView;
  kind: FlowFilter;
  lean: SentFilter;
  prem: PremKey;
  expiry: string | null;
  q: string;
}
const TAPE_CUT_DEFAULT: TapeCut = { view: 'STREAM', kind: 'ALL', lean: 'ALL', prem: '0', expiry: null, q: '' };
const PREM_KEYS: PremKey[] = ['0', '100000', '500000', '1000000'];
const LEAN_KEYS: SentFilter[] = ['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'];

function cutToQuery(c: TapeCut): string {
  const p = new URLSearchParams();
  if (c.view !== TAPE_CUT_DEFAULT.view) p.set('order', c.view.toLowerCase());
  if (c.kind !== TAPE_CUT_DEFAULT.kind) p.set('kind', c.kind.toLowerCase());
  if (c.lean !== TAPE_CUT_DEFAULT.lean) p.set('lean', c.lean.toLowerCase());
  if (c.prem !== TAPE_CUT_DEFAULT.prem) p.set('prem', c.prem);
  if (c.expiry) p.set('exp', c.expiry);
  if (c.q.trim()) p.set('q', c.q.trim());
  return p.toString();
}

/** A URL is user input, so every field is validated rather than trusted — a
    value the tape does not know falls back to the default rather than
    filtering the whole tape away and leaving a reader staring at nothing. */
function queryToCut(p: URLSearchParams): { cut: TapeCut; any: boolean } {
  const up = (k: string) => (p.get(k) ?? '').toUpperCase();
  const view = up('order');
  const kind = up('kind');
  const lean = up('lean');
  const prem = p.get('prem') ?? '';
  const exp = p.get('exp');
  return {
    cut: {
      view: view in VIEW_META ? (view as TapeView) : TAPE_CUT_DEFAULT.view,
      kind: kind === 'SWEEP' || kind === 'BLOCK' ? (kind as FlowFilter) : TAPE_CUT_DEFAULT.kind,
      lean: (LEAN_KEYS as string[]).includes(lean) ? (lean as SentFilter) : TAPE_CUT_DEFAULT.lean,
      prem: (PREM_KEYS as string[]).includes(prem) ? (prem as PremKey) : TAPE_CUT_DEFAULT.prem,
      expiry: exp && /^\d{4}-\d{2}-\d{2}$/.test(exp) ? exp : null,
      q: (p.get('q') ?? '').slice(0, 40),
    },
    any: ['order', 'kind', 'lean', 'prem', 'exp', 'q'].some(k => p.has(k)),
  };
}

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
/* A COLUMN NARROWER THAN ITS CELL PAINTS A CLIPPED ELLIPSIS — a single stray
   dot at the cell's edge that reads like a rendering fault, because that is
   what it is. Every width here clears its widest cell; the probe in
   docs/build-lessons checks it rather than trusting the arithmetic. */
const WIDTHS: Record<string, number> = { time: 124, ticker: 104, contract: 196, dte: 64, otm: 76, quote: 136, size: 152, prem: 92, flow: 92, dayRatio: 100, sentiment: 96, vol: 76, oi: 76, deltaOi: 84, volOverOi: 80, iv: 64 };
/* THE TAPE OPENS ON ELEVEN COLUMNS, NOT EIGHTEEN. Everything below still
   exists and still sorts — it is folded into a compound cell, so showing it
   twice by default would be the clutter the compounding was for. */
const TAPE_CLOSED = ['dte', 'otm', 'vol', 'oi'];
const FLEXES: Record<string, number> = { tag: 1 };
/** What the short headers mean, on hover (the dotted explainers of the old table) */
const TOOLTIPS: Record<string, string> = {
  otm: 'How far the strike sits from the spot, as a share of the spot',
  contract: 'The contract, the days it has left, and where the market was when the print crossed',
  quote: 'What was paid, which side of the market it crossed, and the bid and ask it crossed into',
  size: 'Contracts on this print, over the day\'s volume and the standing open interest',
  prem: 'Dollars paid — size × fill × 100',
  flow: 'How hard the aggressor pressed — right of centre lifted offers, left of centre hit bids',
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
/* THE SIDE CALL TRAVELS WITH ITS EVIDENCE. "BUY" is a CONCLUSION — it means
   the print crossed at the offer — and the tape used to state it in one
   column, show the fill price in a second, and draw the bid-ask rail in a
   third, leaving the reader to carry a number three columns to check the
   claim. They are one fact and they belong in one cell: the fill on top with
   the side as a WORD beside it, and the market it crossed into underneath.
   A print at 2.30 into a 2.10 × 2.30 market argues for itself.

   NO BULL/BEAR INK ON THE SIDE. In this row, green already means CALL two
   columns left and BULLISH two columns right; a third green meaning "lifted
   the offer" is the reading that makes a bought put look bullish at a
   glance. The dot's POSITION on the rail and the word carry the side; the
   colour stays where it is information. */
const SIDE_WORD: Record<FlowPrint['side'], string> = { ASK: 'ask', BID: 'bid', MID: 'mid' };
const QuoteCell = ({ print }: { print: FlowPrint }) => (
  <span className="inline-flex flex-col items-end gap-[2px] leading-none align-middle">
    <span className="inline-flex items-baseline gap-1">
      <span className="font-mono text-[11px] font-bold tnum text-textPrimary">${print.fill.toFixed(2)}</span>
      <span className="font-mono text-[9px] font-semibold uppercase tracking-wide text-textPrimary">{SIDE_WORD[print.side]}</span>
    </span>
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-[9px] tnum text-textSecondary">{print.bid.toFixed(2)}</span>
      <span className="relative w-10 h-[3px] rounded-full bg-ink/[0.07]">
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[6px] h-[6px] rounded-full bg-textPrimary"
          style={{ left: `${print.fillPos * 100}%` }}
        />
      </span>
      <span className="font-mono text-[9px] tnum text-textSecondary">{print.ask.toFixed(2)}</span>
    </span>
  </span>
);

/* SIZE, AND WHAT THE SIZE MEANS. A thousand contracts is enormous against an
   open interest of eight hundred and unremarkable against forty thousand —
   the number alone cannot be read, which is why the three travel together on
   every serious tape. Size leads; the day's volume and the standing open
   interest sit under it as the scale it is read against. */
const SizeCell = ({ print }: { print: FlowPrint }) => (
  <span className="inline-flex flex-col items-end gap-[2px] leading-none align-middle">
    <span className="font-mono text-[11px] font-bold tnum text-textPrimary">{num(print.size)}</span>
    <span className="font-mono text-[9px] tnum text-textSecondary whitespace-nowrap">
      vol {num(print.volume)} <span aria-hidden>·</span> oi {num(print.oi)}
    </span>
  </span>
);

/** The aggressor read. The flow grade itself is engine-internal (Noah,
    2026-08-16) — the centred bar's reach and side carry the conviction. The
    BUY/SELL chip that used to sit above it is gone: it restated the side the
    Quote cell now says in a word, beside the fill that proves it, and its
    green fought the green on "call" in the same row. */
const FlowCell = ({ print }: { print: FlowPrint }) => {
  const score = print.flowScore;
  const bar = score > 15 ? 'bg-bull/90' : score < -15 ? 'bg-bear/80' : 'bg-ink/25';
  const half = Math.abs(score) / 2;
  return (
    <span className="inline-flex flex-col items-start gap-[3px] w-16">
      <span className="relative w-16 h-[5px] rounded-full bg-ink/[0.07]">
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

  /* A live tape RUNS (Noah, 2026-09-12) — every tick lands, nothing holds it. */
  useEffect(() => {
    if (!marketData || marketData === seededTickRef.current) return;
    const fresh = marketData.tape.map(o => enrichPrint(o, ++idRef.current));
    if (fresh.length === 0) return;
    setRows(prev => [...fresh, ...prev].slice(0, MAX_ROWS));
  }, [marketData]);

  const summary = useMemo(() => summarizeTape(rows), [rows]);

  /* THE EXPIRY CUT — the dates the prints in the buffer actually carry, as
     a calendar; every expiry where the page opens (see bookExpiry). */
  const { expiry, setExpiry, expiries: tapeExpiries, cut: cutExpiry, chosen: chosenExpiry } = useExpiryCut(rows, r => r.expiry);

  /* ---- the cut in the address ---------------------------------------------
     THE URL WINS, always: a link someone was SENT is a more specific
     instruction than whatever that reader last had open. The tape writes its
     cut back on every change (replace, never push — a filter is not a page,
     and six of them would bury the back button). */
  const [params, setParams] = useSearchParams();
  const cuts = useSavedCuts();
  const cut: TapeCut = { view, kind: flowFilter, lean: sentFilter, prem: minPremKey, expiry, q: searchQuery };
  const cutQuery = cutToQuery(cut);
  const applyCut = useCallback(
    (c: TapeCut) => {
      setView(c.view);
      setFlowFilter(c.kind);
      setSentFilter(c.lean);
      setMinPremKey(c.prem);
      setSearchQuery(c.q);
      setExpiry(c.expiry);
    },
    [setExpiry]
  );
  /* Read in on arrival and whenever the address changes under us (a saved cut
     opened, the back button). Written out from the state, so the two can
     never drift: whichever moved last, the other follows.

     THE HANDSHAKE IS THE WHOLE TRICK, and getting it wrong is silent. React
     runs both effects in the same pass, and on the pass that READS a link the
     state has not caught up yet — so the writer looks at a still-default cut,
     decides the address is wrong, and erases the link it was just handed. The
     reader therefore hands the writer a beat: applied, but not yet settled,
     so sit this one out. */
  const appliedRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  useEffect(() => {
    const incoming = params.toString();
    if (appliedRef.current === incoming) {
      settledRef.current = true;
      return;
    }
    appliedRef.current = incoming;
    const { cut: c, any } = queryToCut(params);
    if (any) applyCut(c);
    settledRef.current = !any;
  }, [params, applyCut]);
  useEffect(() => {
    if (!settledRef.current) {
      settledRef.current = true;
      return;
    }
    if (cutQuery === appliedRef.current) return;
    appliedRef.current = cutQuery;
    setParams(new URLSearchParams(cutQuery), { replace: true });
  }, [cutQuery, setParams]);

  const filtered = useMemo(() => {
    const minPrem = Number(minPremKey);
    const nq = norm(searchQuery);
    return cutExpiry(rows).filter(
      r =>
        (flowFilter === 'ALL' || (flowFilter === 'SWEEP' ? r.sweep : !r.sweep)) &&
        (sentFilter === 'ALL' || sentimentOf(r) === sentFilter) &&
        r.premium >= minPrem &&
        matchesTape(r, nq)
    );
  }, [rows, flowFilter, sentFilter, minPremKey, searchQuery, cutExpiry]);

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
    searchQuery.trim() !== '' || flowFilter !== 'ALL' || sentFilter !== 'ALL' || minPremKey !== '0' || expiry !== null;
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

  // The read speaks the same scope as the strip. A scope CHANGE bypasses the
  // 8s throttle — switching to NVDA and reading a market-wide sentence for
  // eight more seconds would be the same lie the beam just stopped telling.
  const scopeKey = `${searchQuery}|${flowFilter}|${sentFilter}|${minPremKey}|${expiry ?? ''}`;
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
            <span className="text-[11px] text-textPrimary">{to24h(r.p.time)}</span>
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
        render: r => (
          <ContractCell strike={r.p.strike} right={r.p.right} expiry={r.p.expiry} dte={r.p.dte} spot={r.p.spot} otmPct={r.p.otmPct} />
        ),
      },
      /* DTE, OTM % and Spot are IN the contract cell now; they keep their own
         columns only because a reader sorts by them, and they open closed. */
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
          <span className="text-textPrimary">
            {r.p.otmPct >= 0 ? '+' : ''}
            {r.p.otmPct.toFixed(1)}%
          </span>
        ),
      },
      {
        key: 'quote',
        label: 'Fill & market',
        group: 'Execution',
        header: 'Fill & market',
        align: 'right',
        sortValue: r => r.p.fillPos,
        render: r => <QuoteCell print={r.p} />,
      },
      {
        key: 'size',
        label: 'Size, vol & OI',
        group: 'Execution',
        header: 'Size, vol & OI',
        align: 'right',
        sortValue: r => r.p.size,
        render: r => <SizeCell print={r.p} />,
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
                  : 'text-textPrimary'
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
      /* Volume and open interest ride in the Size cell; the columns survive
         for sorting, closed until a reader opens them. */
      {
        key: 'vol',
        label: 'Vol',
        group: 'Activity',
        header: 'Vol',
        align: 'right',
        sortValue: r => r.p.volume,
        render: r => <span className="text-textPrimary">{num(r.p.volume)}</span>,
      },
      {
        key: 'oi',
        label: 'OI',
        group: 'Activity',
        header: 'OI',
        align: 'right',
        sortValue: r => r.p.oi,
        render: r => <span className="text-textPrimary">{num(r.p.oi)}</span>,
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
          <span className={r.p.volOverOI >= 1.5 ? 'font-bold text-textPrimary' : 'text-textPrimary'}>
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
          <span className="text-[9px] text-textSecondary">
            {r.p.sweep ? <span className="text-warn font-semibold">SWEEP</span> : r.p.strat}
          </span>
        ),
      },
    ],
    [champId]
  );

  /* The chooser offers every column but the time rail, which is always on. */
  const { hidden, toggle, showAll, hideAll } = useHiddenColumns(COLS_KEY, TAPE_CLOSED);
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
        data={{ view, prints: filtered.length, expiry: expiry ?? 'all' }}
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
            <FlowSearch value={searchQuery} onChange={setSearchQuery} rows={rows} />
            <DropdownSelect label="Order" value={view} options={ORDER_OPTIONS} onChange={setView} title="How the prints are ordered" testId="tape-order" />
            <DropdownSelect label="Kind" value={flowFilter} options={KIND_OPTIONS} onChange={setFlowFilter} title="Sweeps, blocks, or both" testId="tape-kind" />
            <DropdownSelect label="Lean" value={sentFilter} options={LEAN_OPTIONS} onChange={setSentFilter} title="Bullish prints, bearish prints, or both" testId="tape-lean" />
            <DropdownSelect label="Premium" value={minPremKey} options={PREM_OPTIONS} onChange={setMinPremKey} title="The smallest print shown" testId="tape-premium" />
            {/* The expiry cut — only the dates the prints on the tape carry (Noah, 2026-09-12) */}
            <ExpiryCalendar
              value={chosenExpiry ? isoDate(chosenExpiry.date) : ''}
              expiries={tapeExpiries}
              onChange={e => setExpiry(isoDate(e.date))}
              onClear={() => setExpiry(null)}
              label="Expiry"
              icon={CalendarDays}
              steppers={false}
              title="Only prints on one expiry — or every expiry"
              testId="tape-expiry"
            />
            <SavedCutsControl
              store={TAPE_CUTS}
              query={cutQuery}
              onOpen={q => setParams(new URLSearchParams(q), { replace: true })}
              noun="cut"
              testId="tape"
              onSay={cuts.say}
              open={cuts.open}
              onToggleOpen={cuts.toggle}
            />
            <span className="ml-auto flex items-center gap-2">
              <ColumnChooser columns={chooserCols} hidden={hidden} onToggle={toggle} onAll={showAll} onNone={() => hideAll(chooserCols.map(c => c.key))} groupOrder={TAPE_GROUP_ORDER} />
            </span>
          </>
        }
        sentence={
          <>
            <SavedCutsList store={TAPE_CUTS} query="" onOpen={q => setParams(new URLSearchParams(q), { replace: true })} noun="cut" testId="tape" onSay={cuts.say} open={cuts.open} />
            {cuts.said && (
              <p role="status" className="mb-2 font-mono text-[10px] text-textSecondary" data-tape-said>
                {cuts.said}
              </p>
            )}
            {readNode}
          </>
        }
      >
        {/* The grid takes the whole window — the rail and its door are gone (2026-09-12). */}
        <div data-tape-body>
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
