/*
==================================================
  SLAYER TERMINAL - REVIEW › BACKTEST · THE DESK'S SHELL
  (components/review/DeskShell.tsx)

  ONE SHELL, TWO DESKS (Noah, 2026-09-20: "lift it into
  one place") — the backtest's options desk (pages/review/
  Desk.tsx) and Paper's live one (pages/paper/Desk.tsx).
  A desk only says WHAT IT IS: the names on it with their
  tapes and what is drawn over them, its clock, its
  account's figures, the cards at its right, and its
  book's rows. Everything Noah ruled on lives here, for
  both:

  THE HOUSE CHART, AND ITS TOP ROW ("my prev terrain and
  pulse top bar look is not the same… i cant see my
  toolbar"). The tape is StrikeChart, fed the desk's own
  tape, with the house toolbar in the house order — the
  intervals at the left, then Indicators · Candles │
  Overlays · Theme — and the drawing rail down its left
  edge. KEPT: the intervals the tape can make, the script
  library, the chart styles, the price scales, PNG export,
  the candle themes, the drawing tools, the overlays that
  read BARS. LEFT OUT: what needs the book, price alerts
  (nothing rings in the past), the chart's own Replay (the
  desk IS one), compares. ADDED, at the row's right end:
  Go to a day · the desk's own jumps · Next day, then the
  split, the panel's door and the fullscreen door, last —
  where the house puts it. The position, its target and
  its stop are a LAYER over that chart (PositionLayer).

  THE TOP ROW KNOWS ITS ROOM. Its widths are measured
  (HEAD_FULL_PX and its kin): under them the toolbar sheds
  its words (its own `compact`), the takeover's account
  gives up its cash first, and — because constants cannot
  know a pair of five-letter names — the row remembers the
  width it was seen to WRAP at and sheds at or under it. A
  second name's capsule is paid for by words, not by the
  toolbar (`tight`): the name not on the desk drops its
  price, Go to its label, Next day its word.

  THE DESK FILLS THE SCREEN, AND ITS TWO COLUMNS END ON
  ONE LINE ("the chart should be taking up more space and
  push the bottom box… down more to fill the empty gap").
  The desk has ONE height, measured: what the screen
  leaves under the account strip — or, when the ticket is
  tall, what the card above it (never under `sideMinPx`)
  and the ticket need. At the left the chart takes
  everything the book's floor does not; at the right the
  cards sit in a box laid OVER their cell, so they ask
  the grid for nothing. Below `lg` the four stack.

  THE BOOK GROWS WITH ITS ROWS ("this bottom box should
  grow with its children boxes not have a scroll inside of
  it"): BOOK_PX is its FLOOR; the chart keeps the height
  the screen gave it and the page scrolls.

  THE TAKEOVER ("full screen with the options chain being
  a side panel the way the strike gex is a side panel for
  the terrain page"): the Weigher's portal grammar — Esc,
  a fade, the page locked behind it — holds the tape with
  the desk's cards AS A PANEL at its right, which folds.
  One chart, wherever it is: the page's cell is empty
  while the takeover is up.

  THE SCRIPT EDITOR HAS ITS ROOM ("it gets in the way of
  the side panel"): the takeover reads the dock's variable
  (DOCK_ROOM) — chart · panel · editor — and where that
  would leave the chart under TAPE_FLOOR_PX the panel
  folds itself while the editor is open and comes back
  when it shuts.

  TWO CHARTS, ONE PANEL ("2 charts side by side does seem
  tempting… if you can figure a way for it to look
  beautiful"). In the takeover a session of two names can
  stand its tapes SIDE BY SIDE, and the panel FOLLOWS THE
  CHART LAST TOUCHED — Terrain's grammar. THE CHART ON THE
  DESK IS UNMISTAKABLE ("the highlighted border chart is
  practically invisible"): a 2px frame at full strength in
  the chart's own ink, a bar of it across the top, and the
  other chart steps back under a veil of the tape's own
  ground. Both share the one toolbar and the ONE clock,
  whose bar lies across their seam. Each says whose it is
  at its top-left.

  THE CLOCK'S BAR SITS AT THE FOOT OF THE PRICE PANE
  (PaneFoot), so an indicator given a pane of its own is
  never covered. IT SPEAKS NEW YORK — the tape asks the
  chart for New York's clock whatever Settings says.

  THE DESK ANSWERS TO THE KEYBOARD: Space plays and
  pauses, → and ← step a minute (Shift: five), End runs to
  the day's last minute, N opens the next day, F is the
  full screen, D the pencil, T the ticket's size, 1 and 2
  the two names, \ the panel — plus a desk's own (`keys`).
  Never while a field has the caret, a menu or a card is
  open; every key is on Settings › Keyboard.

  THE CLOCK ONLY MOVES FORWARD (the rules pages): the bar
  can be pulled back as far as the last order and no
  further — the desk's `move` is the engine's, and refuses
  the rest.

  A THIRD DESK, ON TODAY'S CLOCK (2026-09-22, Paper —
  docs/paper-rules.md). The live paper desk is this same
  shell with NO CLOCK of its own: without `clock` there is
  no replay bar, no Go to and no Next day, the clock's
  keys are not bound, and a name without a `tape` is the
  live chart (the simulator's, as Terrain draws it), moved
  by `revision`. A desk may bring its OWN account strip
  (`strip`) — the live account's figures are not a
  session's — and its own footnote (`foot`), and a picker
  in place of the head's single name (`picker`).

  ONE TO FOUR CHARTS (2026-09-22, Paper's round two — the
  partner's layouts, which Noah liked: "multiple charts…
  1,2,3 or 4 pane layout"). A desk may hand the shell a
  GRID (`grid`): one to four panes, each its own name and
  its own interval, laid out 1 · 2 across · 2 down · 3 (one
  tall at the left) · 4. The pane on the desk is the one the
  toolbar and the cards at the right speak for — a press on
  another puts it there — and wears the split's grammar: the
  silver frame, the others a step back. Each says whose it is
  at its top-left. The crosshair can travel between them
  (`crosshair`, Terrain's rule: only the moment travels, never
  a price). The two-name split above is the backtest's and
  stays as it is.

  A CHART THE WAY TRADERS KNOW ONE (2026-09-22, Noah, with a
  picture of TopstepX: "nice simple tradingview like charts
  you can change timeframes easily"). The intervals stay a
  row of buttons in the toolbar however tight the row gets
  (`keepIntervals`), one press from any other; every chart's
  top left is its RP&L and UP&L (a pane among several says
  whose it is first) — the TradingView open-high-low-close
  line that stood there for an evening was taken out at his
  word ("i want the circled area to be removed and have that
  be replaced with the pr and l and ip and l"); and the
  book's tabs are named as every platform names them —
  Positions · Orders · Trades.

  THE FULL SCREEN CAN GO EDGE TO EDGE (`fullBleed`, the Live
  Chart's, 2026-09-22: "make the chart pull the entire page
  … i meant when it full screen"): no padding round it, and
  the chart and the panel's cards meet on hairlines — the
  takeover's own ground shows through one-pixel gaps, and
  every desk card inside it (`desk-card`) drops its border
  and its corners (index.css).
==================================================
*/

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SayPage } from '../layout/PageMeta';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Columns2, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, SkipForward } from 'lucide-react';
import ChartToolbar from '../gex/ChartToolbar';
import PaneFoot from '../gex/PaneFoot';
import ReplayStrip from '../gex/ReplayStrip';
import StrikeChart, { DEFAULT_INDICATORS, DEFAULT_OVERLAYS, type ChartIndicators, type ChartLayerApi, type ChartOverlays, type ChartStyle, type ChartTape, type CrosshairSync, type PriceScale, type TradeMark } from '../gex/StrikeChart';
import { chartGround, useCandleThemeKey } from '../gex/candleTheme';
import { Fact } from '../trace/TraceBox';
import CardTabs from '../ui/CardTabs';
import CompanyLogo from '../ui/CompanyLogo';
import { useFadeClose } from '../ui/useFadeClose';
import DayCard from './DayCard';
import PositionLayer, { type PositionLayerProps } from './PositionLayer';
import RenameDoor from './RenameDoor';
import { dirInk, usd, usdSigned } from './words';
import { DOCK_ROOM, useEditorDock } from '../../data/editorDock';
import { dayIndex } from '../../data/review/tape';
import type { OpeningRange } from '../../data/sessionLevels';
import { tfMinutes, type Timeframe } from '../../data/timeframe';
import type { KeyLevels } from '../../types/gex';

/* ---- the desk's looks, shared with the cards a desk brings ---- */
export const card = 'desk-card border border-borderSubtle rounded-md bg-panel overflow-clip';
export const head = 'h-9 px-4 flex items-center gap-3 border-b border-borderSubtle/70';
export const headWord = 'font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary';
export const smallDoor = 'inline-flex items-center leading-normal align-middle h-6 px-2 rounded-md border border-borderSubtle font-mono text-[10px] text-textSecondary hover:text-textPrimary hover:border-borderMuted disabled:opacity-30 disabled:cursor-not-allowed transition-colors';
/** A door in the chart's top row — the house toolbar's own button, so the desk's doors and the toolbar's read as one row */
export const barDoor = 'inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider text-textMuted hover:text-textPrimary hover:bg-ink/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

/* THE DESK'S HEIGHTS. The book is never shorter than BOOK_PX — its tabs, its column names and three rows — and grows with
   its rows; the desk is never shorter than a two-line top row, the chart's own floor, and the book. */
const BOOK_PX = 200;
const DESK_MIN_PX = 730;
const DESK_FOOT_PX = 12;
/** The takeover's panel, and the least the chart is left with beside it and the script editor */
const PANEL_PX = 440;
const TAPE_FLOOR_PX = 760;
/** The least each chart keeps for the two to stand side by side */
const SPLIT_PANE_PX = 560;
/** A grid's shapes (Paper's layouts): how its panes are laid out, as the grid's classes */
export type GridLayout = '1' | '2h' | '2v' | '3' | '4';
export const GRID_PANES: Record<GridLayout, number> = { '1': 1, '2h': 2, '2v': 2, '3': 3, '4': 4 };
const GRID_CLASS: Record<GridLayout, string> = { '1': 'grid-cols-1 grid-rows-1', '2h': 'grid-cols-2 grid-rows-1', '2v': 'grid-cols-1 grid-rows-2', '3': 'grid-cols-2 grid-rows-2', '4': 'grid-cols-2 grid-rows-2' };
/** One pane of a grid: whose chart, at what interval — and what floats at its foot (a position's bar) */
export interface GridPane {
  key: string;
  name: DeskName;
  timeframe: Timeframe;
  foot?: ReactNode;
}
/* THE TOP ROW'S WIDTHS, MEASURED (2026-09-20, at 1905): the name, the toolbar with its words and the desk's doors need
   1,113px in one row; the takeover's account figures add 215, and the third figure (the cash) 115 more. */
const HEAD_FULL_PX = 1130;
const HEAD_ACCOUNT_PX = 215;
const HEAD_CASH_PX = 135;
/** What a second name's capsule still costs the row once the row has given it room (`tight`) */
const HEAD_NAME_PX = 15;
/** The RP&L and UP&L badges, which ride the takeover's strip after the intervals (a hairline and two badges) */
const HEAD_PNL_PX = 230;

/* ---- the chart's settings: the reader's, kept from one session to the next, a set per kind of desk ---- */
interface ChartPrefs {
  timeframe: Timeframe;
  chartStyle: ChartStyle;
  indicators: ChartIndicators;
  overlays: ChartOverlays;
  priceScale: PriceScale;
  sessionOr: OpeningRange;
  /** Two names in the takeover: their charts side by side */
  split: boolean;
}
/** Every overlay off but the volume: the rest are the reader's to switch on */
const overlaysAtRest = (): ChartOverlays => ({ ...(Object.fromEntries(Object.keys(DEFAULT_OVERLAYS).map(k => [k, false])) as unknown as ChartOverlays), volume: true });
function readPrefs(key: string, timeframes: Timeframe[], overlayKeys: (keyof ChartOverlays)[]): ChartPrefs {
  const rest: ChartPrefs = { timeframe: '1m', chartStyle: 'candles', indicators: DEFAULT_INDICATORS, overlays: overlaysAtRest(), priceScale: 'normal', sessionOr: 15, split: true };
  try {
    const kept = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<ChartPrefs> | null;
    if (!kept) return rest;
    const overlays = overlaysAtRest();
    for (const k of overlayKeys) if (typeof kept.overlays?.[k] === 'boolean') overlays[k] = kept.overlays[k];
    return { ...rest, ...kept, timeframe: kept.timeframe && timeframes.includes(kept.timeframe) ? kept.timeframe : '1m', indicators: { ...DEFAULT_INDICATORS, ...kept.indicators }, overlays };
  } catch {
    return rest;
  }
}

/** One of the session's names (two at most), as the clock stands */
export interface DeskName {
  symbol: string;
  /** Its long name — a tooltip's */
  title: string;
  /** What it is called where it stands alone: the ticker */
  label: string;
  priceWords: string;
  /** Since the day's open, in percent */
  dayPct: number;
  /** Positions open in it */
  held: number;
  /** What the chart draws — none: the live chart of `symbol` (a desk with no clock) */
  tape?: ChartTape;
  levels: KeyLevels;
  /** What is drawn over its chart: the fills, the position, its ways out — and what a drag or a × does */
  layer: Omit<PositionLayerProps, 'api' | 'ticker' | 'minutes'>;
  /** A long or a short drawn on its chart, placed (StrikeChart `onTradeMark`) */
  onTradeMark?: (mark: TradeMark) => void;
  /** What its chart says at its top left, after its name — the RP&L and UP&L badges (PnlBadges); IN THE FULL
      SCREEN they ride the top strip after the intervals instead (Noah, 2026-09-22), the chart's own name borderless at its
      left wall */
  corner?: ReactNode;
}

/** The desk's hands, as this render has them — what a desk's own doors, keys and notices reach for */
export interface DeskHands {
  /** Stop the clock and put it there (clamped to the day) */
  seek: (minute: number, day?: string) => void;
  /** The top row has shed its words */
  compact: boolean;
  /** …or a second name's capsule is being paid for by words */
  tight: boolean;
  headW: number;
}

export interface DeskFact {
  label: string;
  testId: string;
  node: ReactNode;
}

interface DeskShellProps {
  session: { id: string; name: string; startDay?: string };
  kind?: 'paper';
  onRename?: (name: string) => void;
  /** The line under the session's name */
  subline?: string;
  /** The account strip's figures, in order */
  facts?: DeskFact[];
  /** A desk's OWN account strip, in place of the session's (the live paper desk's) */
  strip?: ReactNode;
  /** What stands where the head's single name would (a picker of the name on the desk) */
  picker?: ReactNode;
  /** The line under the desk */
  foot?: string;
  /** THE LIVE CHART'S heartbeat — bumped every tick of the feed, where there is no `clock` */
  revision?: number;
  /** ONE TO FOUR CHARTS (see the head note) — in place of the names' own charts */
  grid?: {
    layout: GridLayout;
    panes: GridPane[];
    active: number;
    onActive: (i: number) => void;
    onTimeframe: (i: number, tf: Timeframe) => void;
    /** The crosshair travels between the panes */
    crosshair: boolean;
  };
  /** The takeover's head: what the account is worth, what is open — and a third figure while there is room */
  account: { equity: number; openPnl: number; third?: { label: string; value: string } };

  names: DeskName[];
  active: string;
  onSwitch: (symbol: string) => void;
  /** What the name switch is, for a screen reader */
  switchLabel: string;

  /** THE CHART: where its settings are kept, and what this kind of tape can make */
  prefsKey: string;
  paneIds: [string, string];
  timeframes: Timeframe[];
  overlayKeys: (keyof ChartOverlays)[];

  /** THE CLOCK — none on a live desk: no replay bar, no jumps, no clock keys */
  clock?: {
    day: string;
    minute: number;
    /** The last minute the clock can stand on, and the minutes in the day */
    lastMin: number;
    dayMin: number;
    /** No further back than this, and the day after this one (none at the tape's end) */
    floorDay: string;
    tomorrow: string | null;
    /** The moment, and a minute's clock */
    words: string;
    wordsAt: (minute: number) => string;
    /** The day's marks on the bar, where an hour a mark is too many */
    marks?: { u: number; label: string }[];
    /** The engine's: it refuses what the rules refuse */
    move: (to: { day: string; minute: number }) => void;
  };
  goToTitle?: string;
  nextDayTitle?: string;
  /** The desk's own jumps, between Go to and Next day */
  doors?: (hands: DeskHands) => ReactNode;
  /** The desk's own keys, by `KeyboardEvent.key` */
  keys?: Record<string, (hands: DeskHands) => void>;
  /** Over the tape: what this kind of day has to say (an option's bell) */
  notice?: (hands: DeskHands) => ReactNode;

  /** THE CARDS AT THE RIGHT — the takeover's panel. `sideMinPx`: the least the card above the ticket keeps */
  full: boolean;
  /** The full screen fills the screen EDGE TO EDGE: no padding round it, its chart and cards on hairlines (see the head note) */
  fullBleed?: boolean;
  /** The right column's width — the Live Chart widens it for a name's options chain (2026-09-22: "build it with the wider
      column"); the takeover's panel takes the same */
  sideWidth?: number;
  onFull: (full: boolean) => void;
  side: ReactNode;
  sideMinPx: number;
  /** What the panel is called on its doors ("the chain follows the chart you touch"), and what it holds */
  panelWord: string;
  panelTitle: string;

  /** THE BOOK */
  tab: 'open' | 'orders' | 'closed';
  onTab: (tab: 'open' | 'orders' | 'closed') => void;
  counts: { open: number; working: number; closed: number };
  /** The rows of the tab in hand */
  book: ReactNode;
}

/** That address holds no session of this browser's */
export const DeskMissing = () => (
  <div className={`${card} px-6 py-14 text-center`} data-review-desk="missing">
    <p className="text-[13px] text-textPrimary">That session is not on this machine.</p>
    <p className="mt-1 text-[11px] text-textMuted">Sessions are kept in this browser until accounts carry them.</p>
    <Link to="/practice/backtest" className="mt-4 inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
      Your sessions <ArrowRight className="w-3 h-3" />
    </Link>
  </div>
);

const DeskShell = ({ session, kind, onRename, subline = '', facts = [], strip: ownStrip, picker, foot, revision, grid, account, names, active, onSwitch, switchLabel, prefsKey, paneIds, timeframes, overlayKeys, clock, goToTitle = '', nextDayTitle = '', doors, keys: ownKeys, notice, full, onFull, fullBleed = false, sideWidth = PANEL_PX, side, sideMinPx, panelWord, panelTitle, tab, onTab, counts, book }: DeskShellProps) => {
  const navigate = useNavigate();
  const themeKey = useCandleThemeKey();
  const [playing, setPlaying] = useState(false);
  const [pace, setPace] = useState(60);
  const [prefs, setPrefs] = useState<ChartPrefs>(() => readPrefs(prefsKey, timeframes, overlayKeys));
  const setPref = <K extends keyof ChartPrefs>(k: K, v: ChartPrefs[K]) =>
    setPrefs(p => {
      const next = { ...p, [k]: v };
      try {
        localStorage.setItem(prefsKey, JSON.stringify(next));
      } catch {
        /* a private window: the settings last as long as the page */
      }
      return next;
    });
  /** The name whose chart has the pencil in hand (two charts, one pencil) */
  const [drawingName, setDrawingName] = useState<string | null>(null);
  /** Each chart's hands, by name — the clock's bar across two charts reads the first one's price pane */
  const apis = useRef<Record<string, ChartLayerApi>>({});
  const exportRefA = useRef<(() => void) | null>(null);
  const exportRefB = useRef<(() => void) | null>(null);
  /* a grid's panes: an exporter each, and the crosshair's sinks (Terrain's rule — only the moment travels) */
  const gridExports = useRef<Record<string, { current: (() => void) | null }>>({});
  const gridExport = (key: string) => (gridExports.current[key] ??= { current: null });
  const sinks = useRef(new Map<string, CrosshairSync>()).current;
  const crossFrom = useRef<string | null>(null);
  const emitCross = (key: string, time: Parameters<CrosshairSync>[0]) => {
    /* a leave from a pane that is not the source is stale: the pointer went straight onto the next one */
    if (time === null && crossFrom.current !== key) return;
    crossFrom.current = time === null ? null : key;
    for (const [k, apply] of sinks) if (k !== key) apply(time);
  };
  /* the top row sheds its words when the tape is too narrow for them — measured, not typed */
  const headRef = useRef<HTMLDivElement | null>(null);
  const [headW, setHeadW] = useState(1400);
  /** The widest the row has been seen to WRAP at with its words on: at or under it, the toolbar sheds them */
  const [wrapW, setWrapW] = useState(0);

  /* THE TAKEOVER: the tape is the screen, the desk's cards a panel at its right */
  const [panelOpen, setPanelOpen] = useState(true);
  const { closing, close } = useFadeClose(() => onFull(false));
  /* the script editor takes the takeover's right edge; where that leaves the chart too little, the panel steps aside for it */
  const dock = useEditorDock();
  const panelStoodDown = useRef(false);
  useEffect(() => {
    if (!full) return;
    if (dock.open && window.innerWidth - dock.width - PANEL_PX < TAPE_FLOOR_PX) {
      setPanelOpen(open => {
        if (open) panelStoodDown.current = true;
        return false;
      });
    } else if (!dock.open && panelStoodDown.current) {
      panelStoodDown.current = false;
      setPanelOpen(true);
    }
  }, [full, dock.open, dock.width]);
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

  /* THE CLOCK: session seconds a real second (the replay bar's paces), spent a whole minute at a time */
  const live = useRef({ clock, pace });
  live.current = { clock, pace };
  useEffect(() => {
    if (!playing || !live.current.clock) return;
    let owed = 0;
    const t = window.setInterval(() => {
      const { clock: c, pace: p } = live.current;
      if (!c) return;
      owed += p * 0.25;
      const mins = Math.floor(owed / 60);
      if (mins < 1) return;
      owed -= mins * 60;
      const to = Math.min(c.lastMin, c.minute + mins);
      c.move({ day: c.day, minute: to });
      if (to >= c.lastMin) setPlaying(false);
    }, 250);
    return () => window.clearInterval(t);
  }, [playing]);
  const seek = (minute: number, day = clock?.day ?? '') => {
    setPlaying(false);
    if (clock) clock.move({ day, minute: Math.max(0, Math.min(clock.lastMin, minute)) });
  };

  /* THE DESK'S ONE HEIGHT, measured: what the page's scroller leaves under whatever is above the grid — or what the side
     card's floor and the ticket need, when that is more. Read again when the window, the account strip or the ticket
     changes size. */
  const gridRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const main = grid?.closest('main');
    if (!grid || !main || full) return;
    const ro = new ResizeObserver(() => set());
    const set = () => {
      const ticketEl = grid.querySelector<HTMLElement>('[data-review-ticket-card]');
      const top = grid.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
      const fit = main.clientHeight - top - DESK_FOOT_PX;
      const right = sideMinPx + 10 + (ticketEl ? ticketEl.offsetHeight : 0);
      /* the TAPE's height: the desk's, less the book's floor. The book may grow past its floor; the tape does not shrink. */
      grid.style.setProperty('--tape-h', `${Math.round(Math.max(DESK_MIN_PX, fit, right)) - 10 - BOOK_PX}px`);
    };
    set();
    ro.observe(main);
    const ticketEl = grid.querySelector<HTMLElement>('[data-review-ticket-card]');
    if (ticketEl) ro.observe(ticketEl);
    const above = grid.previousElementSibling;
    if (above) ro.observe(above);
    return () => ro.disconnect();
  }, [full, session.id, sideMinPx]);
  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const set = () => setHeadW(el.clientWidth);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, session.id]);
  const two = names.length > 1;
  const gridOn = grid?.panes[Math.min(grid.active, grid.panes.length - 1)];
  /* THE FULL SCREEN'S RP&L · UP&L, in the strip between the intervals and the indicators — the chart on the desk's */
  const stripCorner = full ? (gridOn ? gridOn.name.corner : (names.find(n => n.symbol === active) ?? names[0])?.corner) : undefined;
  const headBase = HEAD_FULL_PX + (full ? HEAD_ACCOUNT_PX : 0) + (two ? HEAD_NAME_PX : 0) + (stripCorner ? HEAD_PNL_PX : 0);
  /* the row wrapped with its words on: remember the width, and shed them at or under it (a wider row tries again) */
  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    if (headW > wrapW && headW >= headBase && el.offsetHeight > 44) setWrapW(headW);
  });
  const nameKey = names.map(n => n.symbol).join('+');
  useEffect(() => setWrapW(0), [nameKey, full, prefs.split]);

  const on = names.find(n => n.symbol === active) ?? names[0];
  const compact = headW <= wrapW || headW < headBase;
  const tight = two && !compact;
  /* TWO CHARTS SIDE BY SIDE: the takeover, two names, the reader's switch on, and room for both (never over a desk's own grid) */
  const split = !grid && full && two && prefs.split && headW >= SPLIT_PANE_PX * 2;
  const shown = split ? names : [on];
  const paneIdOf = (n: DeskName) => paneIds[names.indexOf(n) <= 0 ? 0 : 1];
  const exportOf = (n: DeskName) => (names.indexOf(n) <= 0 ? exportRefA : exportRefB);
  const hands: DeskHands = { seek, compact, tight, headW };

  /* THE KEYS. Read through a ref so the listener is bound once and always sees this render's hands. */
  const keyHands = useRef<Record<string, (shift: boolean) => void>>({});
  keyHands.current = {
    ...(clock
      ? {
          ' ': () => setPlaying(p => !p && clock.minute < clock.lastMin),
          ArrowRight: (shift: boolean) => seek(clock.minute + (shift ? 5 : 1)),
          ArrowLeft: (shift: boolean) => seek(clock.minute - (shift ? 5 : 1)),
          End: () => seek(clock.lastMin),
          n: () => clock.tomorrow && seek(0, clock.tomorrow),
        }
      : {}),
    f: () => (full ? close() : onFull(true)),
    d: () => setDrawingName(n => (n ? null : gridOn ? gridOn.key : on.symbol)),
    t: () => document.querySelector<HTMLInputElement>('[data-ticket-field="qty"]')?.select(),
    '1': () => (grid ? grid.onActive(0) : names[0] && onSwitch(names[0].symbol)),
    '2': () => (grid ? grid.panes[1] && grid.onActive(1) : names[1] && onSwitch(names[1].symbol)),
    ...(grid ? { '3': () => grid.panes[2] && grid.onActive(2), '4': () => grid.panes[3] && grid.onActive(3) } : {}),
    '\\': () => full && setPanelOpen(v => !v),
    ...Object.fromEntries(Object.entries(ownKeys ?? {}).map(([k, fn]) => [k, () => fn(hands)])),
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      /* a field has the caret, or something is open over the desk (a menu, a card, the script library): the keys are theirs */
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.getAttribute('role') === 'slider')) return;
      if (document.querySelector('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')) return;
      const fn = keyHands.current[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!fn) return;
      e.preventDefault();
      /* a button that still has the focus would take Space for itself on the way up */
      if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
      fn(e.shiftKey);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* the session's clock, as a bar — one of it, wherever it floats (a live desk has none) */
  const strip = clock && (
    <ReplayStrip
      phase="play"
      pos={(clock.minute + 1) * 60}
      length={clock.dayMin * 60}
      marks={clock.marks}
      words={clock.words}
      wordsAt={p => clock.wordsAt(Math.max(0, Math.round(p / 60) - 1))}
      counter={`day ${dayIndex(clock.day) - dayIndex(session.startDay ?? clock.day) + 1}`}
      stateWord="New York"
      exitWords="Your sessions"
      playing={playing}
      onPlay={p => setPlaying(p && clock.minute < clock.lastMin)}
      pace={pace}
      onPace={setPace}
      /* the pace's words are said in the candles THIS chart draws: 1× is a candle a second on 1m, one every five on 5m */
      candleMin={tfMinutes(prefs.timeframe)}
      onSeek={p => seek(Math.round(p / 60) - 1)}
      onExit={() => navigate('/practice/backtest')}
      step={60}
    />
  );
  const dayInk = (pct: number) => (pct >= 0 ? 'text-bull' : 'text-bear');
  const dayWordsOf = (pct: number) => `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  const said = notice?.(hands);

  /* ---- THE TAPE ---- */
  const tape = (
    <div className={`${card} flex flex-col min-w-0 ${full ? 'flex-1 min-h-0' : 'lg:h-full'}`} data-review-tape={full ? 'full' : 'page'}>
      <div ref={headRef} className={`${head} flex-wrap h-auto min-h-9 py-1 gap-x-2 gap-y-1`} data-review-head>
        {two ? (
          /* THE SWITCH — both names with their price and their day; silver is where you are, a mark says what is open there */
          <span role="tablist" aria-label={switchLabel} className="inline-flex items-center gap-1" data-review-names>
            {names.map(n => {
              const here = n === on;
              return (
                <button key={n.symbol} type="button" role="tab" aria-selected={here} onClick={() => onSwitch(n.symbol)} title={here ? `${n.title} — on the desk` : `Put ${n.title} on the desk — ${on.symbol} keeps running`} className={`inline-flex items-center gap-1.5 h-6 pl-1.5 pr-2 rounded-md border font-mono text-[11px] tnum transition-colors ${here ? 'border-silver/50 bg-silver/[0.10]' : 'border-borderSubtle hover:border-borderMuted'}`} data-review-name={n.symbol} data-on={here ? '' : undefined}>
                  {/* side by side each chart says its own price and day: here the switch is the name and what is open in it */}
                  {(here || compact) && !split && <CompanyLogo ticker={n.symbol} size={13} />}
                  <span className={`font-bold ${here ? 'text-silver' : 'text-textSecondary'}`}>{n.symbol}</span>
                  {(here || compact) && !split && <span className={here ? 'text-textPrimary' : 'text-textSecondary'}>{n.priceWords}</span>}
                  {!split && <span className={`text-[10px] font-semibold ${dayInk(n.dayPct)}`}>{dayWordsOf(n.dayPct)}</span>}
                  {n.held > 0 && (
                    <span className="min-w-[14px] h-[14px] px-1 rounded-full bg-silver/[0.15] text-silver text-[8px] font-bold leading-[14px] text-center" title={`${n.held} open in ${n.symbol}`}>
                      {n.held}
                    </span>
                  )}
                </button>
              );
            })}
          </span>
        ) : picker ? (
          picker
        ) : (
          <span className="inline-flex items-center gap-2 font-mono text-[12px] tnum">
            <span className="font-bold text-textPrimary">{on.label}</span>
            <span className="text-textPrimary">{on.priceWords}</span>
            <span className={`text-[11px] font-semibold ${dayInk(on.dayPct)}`}>
              {on.dayPct >= 0 ? '▲ +' : '▼ '}
              {on.dayPct.toFixed(2)}%
            </span>
          </span>
        )}
        {/* in the takeover the account rides the tape's head: the strip it lives in is behind the screen */}
        {full && (
          <span className="inline-flex items-center gap-3 pl-3 ml-1 border-l border-borderSubtle font-mono text-[11px] tnum whitespace-nowrap">
            {/* a tight row keeps the figure that moves while a trade is on — what is open, up or down */}
            {!compact && (
              <span>
                <span className="text-textMuted">worth</span> <span className="text-textPrimary">{usd(account.equity)}</span>
              </span>
            )}
            <span>
              <span className="text-textMuted">open</span> <span className={dirInk(account.openPnl)}>{usdSigned(account.openPnl)}</span>
            </span>
            {/* the third figure goes first when the row is tight: the ticket says it under every order */}
            {account.third && headW >= HEAD_FULL_PX + HEAD_ACCOUNT_PX + HEAD_CASH_PX && (
              <span>
                <span className="text-textMuted">{account.third.label}</span> <span className="text-textPrimary">{account.third.value}</span>
              </span>
            )}
          </span>
        )}
        <span className="w-px h-4 bg-borderSubtle shrink-0" aria-hidden />
        {/* THE HOUSE TOOLBAR, in the house order: the intervals at the left, the rest pushed right. Its floor is its own
            row (`min-w-fit`): on a narrow tape it wraps under the name whole, never into a pile. */}
        <div className="flex-1 min-w-fit" data-review-toolbar>
          <ChartToolbar
            minimal
            candles
            spread
            compact={compact}
            keepIntervals={headW >= 560}
            dense={!full}
            timeframes={timeframes}
            timeframe={gridOn ? gridOn.timeframe : prefs.timeframe}
            onTimeframe={tf => (grid && gridOn ? grid.onTimeframe(grid.active, tf) : setPref('timeframe', tf))}
            overlays={prefs.overlays}
            onOverlays={o => setPref('overlays', o)}
            overlayKeys={overlayKeys}
            indicators={prefs.indicators}
            onIndicators={i => setPref('indicators', i)}
            paneId={gridOn ? `${paneIds[0]}:${gridOn.key}` : paneIdOf(on)}
            fullscreen={full}
            chartStyle={prefs.chartStyle}
            onChartStyle={s => setPref('chartStyle', s)}
            priceScale={prefs.priceScale}
            onPriceScale={s => setPref('priceScale', s)}
            onExportPng={() => (gridOn ? gridExport(gridOn.key).current?.() : exportOf(on).current?.())}
            sessionOr={prefs.sessionOr}
            onSessionOr={o => setPref('sessionOr', o)}
            /* flat in the strip: the lift they wear floating over a chart is dropped */
            afterIntervals={stripCorner ? <span className="inline-flex items-center [&_*]:shadow-none" data-desk-strip-pnl>{stripCorner}</span> : undefined}
          />
        </div>
        {/* THE DESK'S OWN DOORS, at the row's end: the clock's jumps, then the split, the panel and the fullscreen door —
            last, where the house puts it */}
        <span className="w-px h-4 bg-borderSubtle shrink-0" aria-hidden />
        {/* `ml-auto`: should the row ever wrap, the doors stay at the right edge, where they are looked for */}
        <span className="ml-auto flex items-center gap-1">
          {clock && <DayCard label={compact || tight ? '' : 'Go to'} value={clock.day} onChange={d => seek(d === clock.day ? clock.minute : 0, d)} min={clock.floorDay} title={goToTitle} testId="review-goto" size="sm" />}
          {doors?.(hands)}
          {clock && (
            <button type="button" onClick={() => clock.tomorrow && seek(0, clock.tomorrow)} disabled={!clock.tomorrow} title={nextDayTitle} className={barDoor} data-review-next-day>
              <SkipForward className="w-3 h-3" />
              {!compact && !tight && 'Next day'}
            </button>
          )}
          {full && two && (
            <button type="button" onClick={() => setPref('split', !prefs.split)} disabled={headW < SPLIT_PANE_PX * 2} title={headW < SPLIT_PANE_PX * 2 ? 'No room for two charts side by side here' : prefs.split ? `One chart — ${on.symbol} alone` : `${names.map(n => n.symbol).join(' and ')} side by side — the ${panelWord} follows the chart you touch`} aria-label={prefs.split ? 'One chart' : 'Two charts side by side'} aria-pressed={split} className={`${barDoor} ${split ? 'text-silver' : ''}`} data-review-split={split ? 'on' : 'off'}>
              <Columns2 className="w-3.5 h-3.5" />
            </button>
          )}
          {full && (
            <button type="button" onClick={() => setPanelOpen(v => !v)} title={panelOpen ? `Fold the ${panelWord} away` : panelTitle} aria-label={panelOpen ? `Fold the ${panelWord} away` : `Open the ${panelWord}`} aria-pressed={panelOpen} className={barDoor} data-review-panel-door={panelOpen ? 'open' : 'folded'}>
              {panelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            </button>
          )}
          <button type="button" onClick={() => (full ? close() : onFull(true))} title={full ? 'Exit fullscreen (Esc)' : `Fullscreen — the chart, with the ${panelWord} as a panel beside it`} aria-label={full ? 'Exit fullscreen' : 'Fullscreen'} className={barDoor} data-review-full={full ? 'on' : 'off'}>
            {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </span>
      </div>
      {/* the chart */}
      <div className="flex-1 min-h-[430px] lg:min-h-0 flex min-w-0">
      <div className="relative flex-1 min-w-0 flex flex-col bg-panel" data-theme="dark" data-chart-ground={chartGround(themeKey)}>
        {/* ONE CHART — OR, IN THE TAKEOVER, THE SESSION'S TWO SIDE BY SIDE. Keyed by the name: the other name's tape is a
            chart of its own, and breathes in (the house's browse grammar). A press anywhere on a chart puts ITS name on
            the desk — the panel at the right follows — and the chart on the desk wears a silver edge. */}
        {grid ? (
          <div className={`flex-1 min-h-0 grid gap-px bg-borderSubtle ${GRID_CLASS[grid.layout]}`} data-desk-grid={grid.layout}>
            {grid.panes.map((p, i) => {
              const here = i === grid.active;
              const many = grid.panes.length > 1;
              return (
                <div key={p.key} className={`relative min-w-0 min-h-0 bg-panel animate-soft-in-slow ${grid.layout === '3' && i === 0 ? 'row-span-2' : ''}`} onPointerDownCapture={() => !here && grid.onActive(i)} data-desk-pane={i} data-desk-pane-name={p.name.symbol} data-on={here ? '' : undefined}>
                  <StrikeChart
                    ticker={p.name.symbol}
                    paneId={`${paneIds[0]}:${p.key}`}
                    revision={clock ? dayIndex(clock.day) * 2000 + clock.minute : (revision ?? 0)}
                    levels={p.name.levels}
                    timeframe={p.timeframe}
                    tape={p.name.tape}
                    overlays={prefs.overlays}
                    indicators={prefs.indicators}
                    chartStyle={prefs.chartStyle}
                    priceScale={prefs.priceScale}
                    sessionOr={prefs.sessionOr}
                    drawing={drawingName === p.key}
                    onEnterDraw={() => {
                      setDrawingName(p.key);
                      if (!here) grid.onActive(i);
                    }}
                    onExitDraw={() => setDrawingName(null)}
                    railTopOk={full && !many}
                    exportRef={gridExport(p.key)}
                    /* a floor, not a size: four panes share the tape's height */
                    height={many ? 160 : full ? 430 : 400}
                    frameless
                    onTradeMark={p.name.onTradeMark}
                    onCrosshair={grid.crosshair && many ? t => emitCross(p.key, t) : undefined}
                    syncRegister={grid.crosshair && many ? apply => (apply ? sinks.set(p.key, apply) : sinks.delete(p.key)) : undefined}
                    layer={api => {
                      apis.current[p.key] = api;
                      return (
                        <>
                          <PositionLayer api={api} ticker={p.name.symbol} minutes={tfMinutes(p.timeframe)} {...p.name.layer} />
                          {/* EVERY PANE SAYS WHOSE IT IS AND AT WHAT INTERVAL, at its top left against the wall: "ES · 1m", no box
                              round it (Noah, 2026-09-22, with a picture of one: "the timeframe one should look like this at all times
                              minus the ticker price") — among several, the one on the desk in silver; then, on the page, its corner
                              (RP&L · UP&L) — in the full screen those ride the strip */}
                          <span className="absolute left-2 top-2 z-10 flex items-center gap-2 pointer-events-none" data-chart-chrome>
                            <span className="inline-flex items-center gap-1.5 h-6 font-mono text-[11px] tnum whitespace-nowrap" data-chart-chrome data-desk-pane-chip={p.name.symbol}>
                              <span className={`font-bold ${!many ? 'text-textPrimary' : here ? 'text-silver' : 'text-textSecondary'}`}>{p.name.label}</span>
                              <span className="text-textMuted">·</span>
                              <span className="text-textMuted">{p.timeframe}</span>
                            </span>
                            {!full && p.name.corner}
                          </span>
                          {p.foot && (
                            <PaneFoot chart={api.chart} className="pl-14">
                              {p.foot}
                            </PaneFoot>
                          )}
                        </>
                      );
                    }}
                  />
                  {many && here && (
                    <span className="absolute inset-0 z-20 pointer-events-none ring-2 ring-inset ring-silver" aria-hidden="true" data-chart-ink data-desk-pane-edge>
                      <span className="absolute inset-x-0 top-0 h-[3px] bg-silver" />
                    </span>
                  )}
                  {many && !here && <span className="absolute inset-0 z-20 pointer-events-none" style={{ background: `rgb(var(--canvas) / ${grid.panes.length > 2 ? 0.16 : 0.3})` }} aria-hidden="true" data-chart-ink data-desk-pane-rest />}
                </div>
              );
            })}
          </div>
        ) : (
        <div className="flex-1 min-h-0 flex">
          {shown.map((n, i) => {
            const here = n === on;
            return (
              <div key={n.symbol} className={`relative flex-1 min-w-0 min-h-0 animate-soft-in-slow ${i > 0 ? 'border-l border-borderSubtle' : ''}`} onPointerDownCapture={() => !here && onSwitch(n.symbol)} data-review-pane={n.symbol} data-on={here ? '' : undefined}>
                <StrikeChart
                  ticker={n.symbol}
                  paneId={paneIdOf(n)}
                  revision={clock ? dayIndex(clock.day) * 2000 + clock.minute : (revision ?? 0)}
                  levels={n.levels}
                  timeframe={prefs.timeframe}
                  tape={n.tape}
                  overlays={prefs.overlays}
                  indicators={prefs.indicators}
                  chartStyle={prefs.chartStyle}
                  priceScale={prefs.priceScale}
                  sessionOr={prefs.sessionOr}
                  drawing={drawingName === n.symbol}
                  onEnterDraw={() => setDrawingName(n.symbol)}
                  onExitDraw={() => setDrawingName(null)}
                  /* only the takeover has a top band to spare — and only one chart can take it */
                  railTopOk={full && !split}
                  exportRef={exportOf(n)}
                  /* a floor, not a size: on the desk the chart takes what the book leaves (see DESK_MIN_PX) */
                  height={full ? 430 : 400}
                  frameless
                  onTradeMark={n.onTradeMark}
                  layer={api => {
                    apis.current[n.symbol] = api;
                    return (
                      <>
                        <PositionLayer api={api} ticker={n.symbol} minutes={tfMinutes(prefs.timeframe)} {...n.layer} />
                        {/* every chart says whose it is and at what interval at its top left, "ES · 1m" with no box round it — side
                            by side, the one on the desk in silver — then, on the page, its corner (RP&L · UP&L; in the full screen those
                            ride the strip); the chrome stamp sends the scripts' legend under it */}
                        <span className="absolute left-2 top-2 z-10 flex items-center gap-2 pointer-events-none" data-chart-chrome>
                          <span className="inline-flex items-center gap-1.5 h-6 font-mono text-[11px] tnum whitespace-nowrap" data-chart-chrome data-review-pane-name={n.symbol}>
                            <span className={`font-bold ${!split ? 'text-textPrimary' : here ? 'text-silver' : 'text-textSecondary'}`}>{n.label}</span>
                            <span className="text-textMuted">·</span>
                            <span className="text-textMuted">{prefs.timeframe}</span>
                          </span>
                          {!full && n.corner}
                        </span>
                        {/* THE CLOCK'S BAR, AT THE FOOT OF THE PRICE PANE — hung off the time axis, an indicator given a pane of
                            its own had the bar lying across it. `pl-14` clears the drawing rail. Side by side it is ONE bar
                            across both charts (below), not one in each. */}
                        {!split && strip && (
                          <PaneFoot chart={api.chart} className="pl-14">
                            {strip}
                          </PaneFoot>
                        )}
                      </>
                    );
                  }}
                />
                {/* THE CHART ON THE DESK IS UNMISTAKABLE: a 2px frame at full strength, in the chart's own ink (pale silver on
                    a dark tape, deep steel on Stone), a bar of it across the top — and the chart that is NOT on the desk
                    steps back a little, so the eye has one place to go. */}
                {split && here && (
                  <span className="absolute inset-0 z-20 pointer-events-none ring-2 ring-inset ring-silver" aria-hidden="true" data-chart-ink data-review-pane-edge>
                    <span className="absolute inset-x-0 top-0 h-[3px] bg-silver" />
                  </span>
                )}
                {/* a veil of the tape's own ground (an inline wash: the `bg-canvas/25` CLASS is made solid over a light tape by index.css) */}
                {split && !here && <span className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'rgb(var(--canvas) / 0.3)' }} aria-hidden="true" data-chart-ink data-review-pane-rest />}
              </div>
            );
          })}
        </div>
        )}
        {/* …the ONE bar of a split desk: across the seam, over the left chart's empty runway and the right chart's oldest bars */}
        {split && strip && (
          <PaneFoot chart={() => apis.current[names[0].symbol]?.chart() ?? null} className="px-14" axisPad={false}>
            {strip}
          </PaneFoot>
        )}
        {said && <div className="absolute inset-x-0 top-3 z-30 flex justify-center px-3 pointer-events-none">{said}</div>}
      </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5" data-review-desk={session.id} data-review-kind={kind} data-review-clock={clock ? `${clock.day} ${clock.minute}` : undefined}>
      {/* THE ACCOUNT — what the session is worth as the clock stands (a desk's own strip, where it brings one) */}
      {ownStrip ?? (
      <div className={`${card} px-5 py-3 flex items-start gap-6 flex-wrap`} data-review-account>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5">
            {/* side by side: stacked, a dark badge and a four-colour mark bled into each other (Noah, with a picture) */}
            <span className="inline-flex items-center gap-1.5 shrink-0">
              {names.map(n => (
                <CompanyLogo key={n.symbol} ticker={n.symbol} size={18} />
              ))}
            </span>
            {/* the tab carries the session's name, never its id (layout/PageMeta) */}
            <SayPage words={session.name} />
            <h2 className="text-[15px] font-semibold leading-tight text-textPrimary truncate">{session.name}</h2>
            {onRename && <RenameDoor name={session.name} onSave={onRename} className="w-5 h-5 shrink-0" />}
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{subline}</p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {facts.map(f => (
            <Fact key={f.testId} label={f.label} testId={f.testId}>
              {f.node}
            </Fact>
          ))}
          <div className="min-w-0 self-end">
            <Link to={`/practice/backtest/${session.id}/report`} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-borderSubtle bg-chip font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-review-report-door>
              The report <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </dl>
      </div>
      )}

      {/* while the takeover is up the tape and the desk's cards live THERE — one chart, one ticket, wherever they are */}
      {/* THE TAPE AND THE BOOK AT THE LEFT, THE DESK'S CARDS AT THE RIGHT — two columns that do not push each other (the right
          one spans both rows). In the source the order is tape · cards · book, which is the order a phone stacks them in. */}
      <div ref={gridRef} className={`grid gap-2.5 ${full ? 'items-start' : 'items-start lg:items-stretch lg:grid-cols-[minmax(0,1fr)_var(--desk-side)] lg:grid-rows-[var(--tape-h)_auto]'}`} style={{ '--desk-side': `${sideWidth}px` } as CSSProperties} data-review-desk-grid>
        {!full && <div className="min-w-0 lg:min-h-0 lg:col-start-1 lg:row-start-1">{tape}</div>}
        {!full && (
          /* THE RIGHT COLUMN IS AS TALL AS THE LEFT ONE, and never the other way round: its cards sit in a box laid OVER the
             cell (`absolute inset-0`), so a chain — which would otherwise ask for the height of every strike it holds —
             asks the grid for nothing, and takes what the tape and the book make */
          <div className="min-w-0 lg:relative lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div className="flex flex-col gap-2.5 lg:absolute lg:inset-0">{side}</div>
          </div>
        )}
        <div className={`min-w-0 ${full ? '' : 'lg:col-start-1 lg:row-start-2'}`}>
          {/* POSITIONS · ORDERS · TRADES — the working orders counted on their tab, the closed trades on theirs */}
          <div className={`${card} min-w-0`} style={{ minHeight: BOOK_PX }} data-review-blotter={tab}>
            <div className="px-4 pt-1 border-b border-borderSubtle/70">
              <CardTabs
                ariaLabel="Positions, orders and trades"
                value={tab}
                onChange={onTab}
                options={[
                  { value: 'open', label: `Positions · ${counts.open}` },
                  { value: 'orders', label: `Orders · ${counts.working}` },
                  { value: 'closed', label: `Trades · ${counts.closed}` },
                ]}
              />
            </div>
            {/* the book grows with its rows (BOOK_PX is its floor): the chart above keeps its size, the page scrolls */}
            <div data-review-book-rows>{book}</div>
          </div>
        </div>
      </div>

      {full &&
        createPortal(
          <div className={`fixed inset-0 z-[80] flex animate-soft-in transition-opacity duration-200 ease-out ${fullBleed ? 'bg-borderSubtle gap-px' : 'bg-canvas p-2.5 gap-2.5'} ${closing ? 'opacity-0' : ''}`} style={DOCK_ROOM} data-review-takeover data-desk-flush={fullBleed ? '' : undefined}>
            {tape}
            {/* THE PANEL — the desk's cards beside the tape, the way the strike rail sits beside Terrain's chart */}
            {panelOpen && (
              <div className={`max-w-[46vw] shrink-0 min-h-0 flex flex-col ${fullBleed ? 'gap-px' : 'gap-2.5'} animate-soft-in`} style={{ width: sideWidth }} data-review-panel>
                {side}
              </div>
            )}
          </div>,
          document.body
        )}
      <p className="px-1 font-mono text-[10px] text-textMuted">{foot ?? 'Simulated prices on a seeded tape — practice, not advice. Past results, real or pretend, promise nothing.'}</p>
    </div>
  );
};

export default DeskShell;
