/*
==================================================
  SLAYER TERMINAL - FOUR CHARTS (/pulse/board)
  A dedicated page of nothing but four live charts,
  opened from the main chart's toolbar. Every cell
  is its own cockpit: its own ticker (the sim
  synthesizes unknowns), its own timeframe, its own
  overlays, the candle picker, and a fullscreen
  takeover — the same controls the main Pulse chart
  carries. Each chart derives its walls/flip/supreme
  and dark-pool prints from its OWN book. The back
  arrow returns to Pulse; the whole layout persists.

  ONE NAME AND THE HOUSE HEAD (2026-10-09, the audit's
  PU-2, PU-3, PU-8, PU-15, PU-16): "Four charts" on
  the tab, the head, the palette and the rail alike;
  the shell head with Pulse's glyph; a cell under
  600px wears the compact strip, so the four charts
  start level; the expanded cell carries its own way
  out.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Minimize2 } from 'lucide-react';
import ShellHead from '../components/layout/ShellHead';
import Simulator from '../core/simulator';
import { useMarketData } from '../context/MarketDataContext';
import { readDeskPrefs } from '../data/deskPrefs';
import { buildLevelsFor, buildPrints } from '../data/gex';
import StrikeChart, { DEFAULT_OVERLAYS, type ChartOverlays } from '../components/gex/StrikeChart';
import ChartToolbar from '../components/gex/ChartToolbar';
import { chartGround, useCandleThemeKey } from '../components/gex/candleTheme';
import { useIsPhone } from '../components/ui/useMediaQuery';
import ScopeChip from '../components/ui/ScopeChip';
import SpotPrice from '../components/gex/SpotPrice';
import { TIMEFRAMES, type Timeframe } from '../data/timeframe';

const BOARD_KEY = 'slayer_pulse_board';

interface BoardCellCfg {
  ticker: string;
  timeframe: Timeframe;
  overlays: ChartOverlays;
}

const TF_VALUES = new Set<string>(TIMEFRAMES.map(t => t.value));

/** Self-healing load — anything malformed falls back to the default slot. */
function loadCells(): BoardCellCfg[] {
  /* a fresh pane opens on the desk's timeframe when the reader set one
     (Settings › The desk); a pane they already set keeps its own */
  const defaults: BoardCellCfg[] = Simulator.WATCHLIST.slice(0, 4).map(ticker => ({
    ticker,
    timeframe: readDeskPrefs().opensOn.timeframe ?? '1m',
    overlays: { ...DEFAULT_OVERLAYS },
  }));
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;
    return defaults.map((def, i) => {
      const c = parsed[i] as Partial<BoardCellCfg> | undefined;
      if (!c || typeof c !== 'object') return def;
      return {
        ticker: typeof c.ticker === 'string' && c.ticker ? c.ticker : def.ticker,
        timeframe: typeof c.timeframe === 'string' && TF_VALUES.has(c.timeframe) ? (c.timeframe as Timeframe) : def.timeframe,
        overlays: { ...DEFAULT_OVERLAYS, ...(c.overlays && typeof c.overlays === 'object' ? c.overlays : {}) },
      };
    });
  } catch {
    return defaults;
  }
}

interface BoardCellProps {
  cfg: BoardCellCfg;
  onCfg: (next: Partial<BoardCellCfg>) => void;
  revision: number;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Cell position — staggers the entrance so the board builds up smoothly */
  index: number;
}

const BoardCell = ({ cfg, onCfg, revision, expanded, onToggleExpand, index }: BoardCellProps) => {
  // Each cell reads its own book — revision keeps levels tracking the live sim
  const levels = useMemo(
    () => buildLevelsFor(cfg.ticker),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg.ticker, revision]
  );
  // Prints are deterministic per ticker — pinned so the lines don't wander
  const prints = useMemo(
    () => buildPrints(cfg.ticker, levels.spot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg.ticker]
  );

  /* Same one-surface contract as the chart widget (Noah, 2026-08-23): the
     candle theme's canvas — or the house inset black — under toolbar AND
     tape, so a cell is one continuous black inside its frame. */
  /* The cell is the panel black — the frame; the tape paints its own theme inside the chart,
     and the taskbar over it wears that theme's GROUND (Noah, 2026-09-13: "change the top
     section to match the chart theme"): the cell stamps it, index.css re-scopes the tokens. */
  const surface = 'rgb(var(--panel))';
  const ground = chartGround(useCandleThemeKey());
  /* The cell — the section its toolbar's menus stay inside (2026-09-13) */
  const cellRef = useRef<HTMLDivElement | null>(null);
  /* On a phone the taskbar wears the compact strip — the interval as one trigger, the icons — instead of four wrapped rows */
  const isPhone = useIsPhone();
  /* a cell under 600px wears the compact strip, so each cell's bar is one row and the four charts start level */
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNarrow(el.getBoundingClientRect().width < 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    // 'contents' keeps the grid slot when docked; expanding lifts the same
    // cell into a viewport takeover without remounting the chart. Expanded
    // goes edge to edge — no padding, no frame, the chart IS the screen.
    <div className={expanded ? 'fixed inset-0 z-[80] flex flex-col' : 'contents'}>
      <div
        ref={cellRef}
        className={`relative flex flex-col min-h-0 overflow-hidden animate-soft-in ${
          expanded ? 'flex-1' : 'border border-borderSubtle rounded-md'
        }`}
        style={{ animationDelay: `${index * 70}ms`, background: surface }}
        /* A dark island on any page (2026-09-12): the chart's cell reads the dark tokens */
        data-theme="dark"
        /* …and its taskbar the ground of the tape's theme (2026-09-13) */
        data-chart-ground={ground}
        /* …and the cell itself too, as a Terrain pane is (index.css [data-chart-frame]): on a light tape its panel is light,
           so a chart built again (a name or a timeframe changed) fades in over light, not over a black flash (2026-10-02) */
        data-chart-frame
      >
        {/* THE TASKBAR, the chart widget's grammar (settled 2026-08-23
            against TradingView's): chrome, not an object — full width, fused
            to the cell's top edge, no container, no border, no glass. Name
            left, actions at the right edge. */}
        <div
          /* bg-panel: the chrome's own panel — the cell's black on a dark tape (no seam), stone
             on a light one, so the flipped inks have their ground under them */
          className="shrink-0 w-full select-none flex items-center gap-2.5 flex-wrap px-2.5 py-1.5 bg-panel"
          /* On the theme's ground — a light theme flips its inks (index.css, 2026-09-11) */
          data-chart-chrome
        >
          {/* Every cell holds its own name by design — the own-name chip, no link */}
          <ScopeChip ticker={cfg.ticker} onPick={t => onCfg({ ticker: t })} />
          <SpotPrice value={levels.spot} />
          <div className="flex-1 min-w-0">
            <ChartToolbar
              minimal
              candles
              spread
              /* Docked, the menus are the small ones, and every menu stays inside the cell (Noah, 2026-09-13) */
              dense={!expanded}
              menuBounds={cellRef}
              compact={isPhone || (narrow && !expanded)}
              timeframe={cfg.timeframe}
              onTimeframe={tf => onCfg({ timeframe: tf })}
              overlays={cfg.overlays}
              onOverlays={o => onCfg({ overlays: o })}
              fullscreen={expanded}
              onToggleFullscreen={onToggleExpand}
            />
          </div>
          {/* the way out, inside the cell that took the screen (the audit's PU-16: it sat under the takeover) */}
          {expanded && (
            <button type="button" onClick={onToggleExpand} title="Back to the four (Esc)" className="hit shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary" data-board-esc>
              <Minimize2 className="w-3.5 h-3.5" /> Esc
            </button>
          )}
        </div>
        <div className={expanded ? 'flex-1 min-h-0' : 'h-[38vh] min-h-[300px]'}>
          <StrikeChart
            ticker={cfg.ticker}
            revision={revision}
            levels={levels}
            timeframe={cfg.timeframe}
            height={expanded ? 300 : 280}
            overlays={cfg.overlays}
            prints={prints}
            frameless
            /* New York's clock (X2), and the tape near the right edge (X11) */
            nyClock
            historyShare={0.88}
          />
        </div>
      </div>
    </div>
  );
};

/** Standalone at /pulse/board (back = Link), or embedded in the desk's quad
    takeover (onBack provided — back = the takeover's fade-close). */
const PulseBoard = ({ onBack }: { onBack?: () => void }) => {
  const { marketData } = useMarketData();
  const revRef = useRef(0);
  const revision = useMemo(() => ++revRef.current, [marketData]);

  const [cells, setCells] = useState<BoardCellCfg[]>(loadCells);
  useEffect(() => {
    try {
      localStorage.setItem(BOARD_KEY, JSON.stringify(cells));
    } catch {
      /* non-fatal */
    }
  }, [cells]);
  const updateCell = (index: number, next: Partial<BoardCellCfg>) =>
    setCells(prev => prev.map((c, i) => (i === index ? { ...c, ...next } : c)));

  // One cell at a time takes the viewport — Esc collapses, scroll locks under
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => {
    if (expanded === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(null);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [expanded]);

  return (
    <>
      {/* THE SHELL HEAD (the audit's PU-2, PU-3): Pulse's glyph, the page's one name, the way back to the desk */}
      <ShellHead
        glyph="pulse"
        title="Four charts"
        line="Four names at once, each with its own timeframe and overlays — every chart reads its own book"
        facts={cells.map((c, i) => ({ label: `Chart ${i + 1}`, value: `${c.ticker} · ${c.timeframe}`, wide: i > 1 }))}
        aside={
          onBack ? (
            <button type="button" onClick={onBack} title="Back to Pulse" aria-label="Back to Pulse" className="hit ml-1 group inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
              <ArrowLeft className="w-3 h-3 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> Pulse
            </button>
          ) : (
            <Link to="/pulse" title="Back to Pulse" aria-label="Back to Pulse" className="hit ml-1 group inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
              <ArrowLeft className="w-3 h-3 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> Pulse
            </Link>
          )
        }
        testId="board-shell"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {cells.map((cfg, i) => (
          <BoardCell
            key={i}
            cfg={cfg}
            onCfg={next => updateCell(i, next)}
            revision={revision}
            expanded={expanded === i}
            onToggleExpand={() => setExpanded(cur => (cur === i ? null : i))}
            index={i}
          />
        ))}
      </div>
    </>
  );
};

export default PulseBoard;
