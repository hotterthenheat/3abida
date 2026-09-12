/*
==================================================
  SLAYER TERMINAL - CHART TOOLBAR
  The big chart's control strip: timeframes, an
  Overlays multi-select (every layer independent),
  the candle theme, and fullscreen takeover. Compact
  dropdowns, terminal grammar.
==================================================
*/

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Simulator from '../../core/simulator';
import ThemePreview from './ThemePreview';
import { createPortal } from 'react-dom';
import { useAnchoredMenu } from '../ui/useAnchoredMenu';
import { motion } from 'framer-motion';
import {
  Activity,
  CandlestickChart,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Fullscreen,
  Grid2x2,
  Layers,
  Maximize2,
  Minimize2,
  Palette,
  Play,
} from 'lucide-react';
import { TIMEFRAMES, type Timeframe } from '../../data/timeframe';
import {
  CANDLE_THEMES,
  CANDLE_THEME_OPTIONS,
  setCandleTheme,
  useCandleThemeKey,
  type CandleTheme,
  type CandleThemeKey,
} from './candleTheme';
import {
  CHART_STYLES,
  INDICATOR_INKS,
  MAX_SUB_PANES,
  PRICE_SCALES,
  SUB_PANE_ORDER,
  type ChartIndicators,
  type ChartOverlays,
  type ChartStyle,
  type PriceScale,
} from './StrikeChart';
import { INDICATOR_ITEMS } from './indicatorItems';
import ScriptLibrary from '../scripts/ScriptLibrary';
import { usePaneScripts } from '../../data/paneScripts';
import { closeEditor, useEditorDock } from '../../data/editorDock';
import AlertsMenu from './AlertsMenu';
import { useAlerts } from './alertStore';
import JingleBell from '../ui/JingleBell';
import { BAR_CLOCKS } from '../../data/altBars';
import { type MenuSide } from '../ui/menuPlacement';
import { OPENING_RANGES, type OpeningRange } from '../../data/sessionLevels';

interface ChartToolbarProps {
  timeframe: Timeframe;
  onTimeframe: (tf: Timeframe) => void;
  overlays: ChartOverlays;
  onOverlays: (next: ChartOverlays) => void;
  /** Minimal mode: timeframes + overlays only (expanded flow-board charts). */
  minimal?: boolean;
  /** Adds the candle-theme dropdown back in minimal mode (4-way board cells). */
  candles?: boolean;
  /** Restrict the Overlays menu to these keys — a chart that can't draw a
      layer must not offer its toggle (campaign map: levels + volume only). */
  overlayKeys?: (keyof ChartOverlays)[];
  /** Span the full width: timeframes pinned left, every other control pushed
      right (fullscreen stays last, so it lands furthest right). The divider
      becomes the invisible spacer that does the pushing. */
  spread?: boolean;
  /**
   * EVERY CONTROL AT ITS SMALLEST — for a strip that has to fit a phone.
   *
   * Two changes, and both are about line count rather than taste. The seven
   * timeframe buttons collapse into one trigger that opens them as a menu:
   * they need 251px laid out, which is most of a 390px screen and the single
   * biggest reason the strip wrapped. And every dropdown drops its word for
   * its icon, keeping the word as the hover/AT name — the same trade
   * `vertical` already makes for a side-docked toolbox.
   *
   * Measured at 390px: a 218px strip before, 75px after. (The phone host then
   * spends some of that back on 40px touch targets, landing at 105px — still
   * an eighth of the screen where the first attempt took a quarter.)
   */
  compact?: boolean;
  /** Stack the strip top-to-bottom — the floating toolbox docked to a side
      edge (Noah, 2026-08-23). Ignores `spread`. */
  vertical?: boolean;
  /** Which side the dropdown menus open toward — a side-docked toolbox has
      no room below itself. */
  menuSide?: MenuSide;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  replay?: boolean;
  onToggleReplay?: () => void;
  /** The tape's SHAPE (candles/bars/line/…) — TradingView's picker, distinct
      from the color theme (Noah, 2026-08-23) */
  chartStyle?: ChartStyle;
  onChartStyle?: (s: ChartStyle) => void;
  /** Indicator overlays — EMAs, VWAP */
  indicators?: ChartIndicators;
  onIndicators?: (next: ChartIndicators) => void;
  /** THE SCRIPT LIBRARY'S DOOR (2026-09-10): the pane this toolbar drives.
      Given, the Indicators control opens the library — the Slayer scripts,
      the technicals in Pine, the chart's own tools and the reader's scripts,
      with a count of what is on this pane. Absent, the old menu of built-ins. */
  paneId?: string;
  /** The main price scale's mode — linear / log / percent / indexed (T-7) */
  priceScale?: PriceScale;
  onPriceScale?: (s: PriceScale) => void;
  /*
    SOMETHING ELSE ON THE TAPE IS HOLDING THE AXIS, and what.

    A `%` comparison rides the main right scale, so the axis has to be in
    percent for the two lines to be comparable at all — the reader's pick
    cannot win while one is up. Handed in rather than inferred here, from the
    ONE place that decides it (`priceScaleLockedBy`), so this menu can never
    report a mode the chart is not actually drawing.

    A control that silently does nothing is the thing this desk keeps ruling
    out; a control that SAYS why it is held is the alternative.
  */
  priceScaleLock?: { mode: PriceScale; reason: string } | null;
  /** Which opening range the session-levels overlay draws — T-6. Rendered as
      a choice ON that overlay's own row, so it is where the thing it changes
      is rather than in a menu of its own. */
  sessionOr?: OpeningRange;
  onSessionOr?: (o: OpeningRange) => void;
  /* Shows the Alerts menu. Both are needed: the symbol the alerts belong to,
     and where the market is — which fixes the side a new alert has to be
     crossed from, and seeds the box near the price rather than at zero. */
  /* The Alerts door, WIRED (Noah, 2026-08-28 — the blank-shell rule is
     retired; the cooking is done). It takes the symbol and the spot so an
     alert it arms is bound to a real name at a real price. The bell wears a
     count of firings not yet looked at; opening the menu clears it. */
  alertTicker?: string;
  alertSpot?: number;
  /** Mode 3 (Noah, 2026-08-23): TOTAL fullscreen — the taskbar itself goes
      away and only Esc brings it back. TradingView's corner-bracket icon. */
  onTotalFullscreen?: () => void;
  /** Opens the 4-way board page — four charts, each with its own controls. */
  /** T-23 — export this pane as a PNG (levels, drawings, watermark). Lives
      in the Candles menu: a menu row costs no toolbar width, and the strip's
      one-row budget is measured to the pixel. */
  onExportPng?: () => void;
  /** T-15 — the bar CLOCK: 'time', or a range/volume key from
      data/altBars.ts's BAR_CLOCKS. Same width budget as T-23: a section in
      the Candles menu, not a trigger of its own. */
  barClock?: string;
  onBarClock?: (key: string) => void;
  /* PER-PANE CANDLE THEME (Noah, 2026-08-25: "if i change the theme for 1
     chart it should NOT change for all the others"). Ours, kept through the
     port — unwired callers keep following the app-wide store. */
  themeKey?: CandleThemeKey;
  onThemeKey?: (key: CandleThemeKey) => void;
}

const TIMEFRAME_OPTIONS = TIMEFRAMES.map(t => ({ value: t.value, label: t.label }));

/** Bare timeframe strip — floating labels, no box, no dividers. The active
    one earns a BUBBLE (Noah, 2026-08-23): a fully-round chip that springs
    from timeframe to timeframe as one continuous piece, stretching to each
    label's width on the way. layoutId is namespaced per strip — the 4-way
    board mounts four of these and the bubbles must not jump between cells. */
export const TimeframeStrip = ({
  value,
  onChange,
  vertical = false,
}: {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
  vertical?: boolean;
}) => {
  const uid = useId();
  return (
    <div
      role="group"
      aria-label="Timeframe"
      /* flex-wrap: a flex ITEM wider than its line does not split, it SPILLS,
         and the page starts scrolling sideways. Seven timeframes need 251px
         and a 390px screen gives the rail 213 once Terrain's layout picker is
         beside it. Wrapping changes nothing at any width where they already
         fit. */
      className={`inline-flex gap-0.5 ${vertical ? 'flex-col items-stretch' : 'flex-wrap items-center'}`}
    >
      {TIMEFRAME_OPTIONS.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`relative px-2 py-1 rounded-full font-mono text-[11px] transition-colors ${
              active
                ? 'text-textPrimary font-semibold'
                : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.03]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`tf-bubble-${uid}`}
                className="absolute inset-0 rounded-full bg-ink/[0.10]"
                transition={{ type: 'spring', stiffness: 480, damping: 28 }}
                aria-hidden
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

/* TradingView-style glyphs beside each chart-style row (Noah, 2026-08-23) —
   hand-drawn 14px marks, all in the house white via currentColor. */
const STYLE_GLYPHS: Record<ChartStyle, ReactNode> = {
  bars: (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M4 2v9M2.5 5H4M4 8h1.5M10 3v9M8.5 10H10M10 5h1.5" />
    </svg>
  ),
  candles: (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="currentColor" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
      <path fill="none" d="M4 1.5v2M4 8.5v2.5M10 2.5v2M10 10v1.5" />
      <rect x="2.9" y="3.5" width="2.2" height="5" rx="0.4" />
      <rect x="8.9" y="4.5" width="2.2" height="5.5" rx="0.4" />
    </svg>
  ),
  hollow: (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
      <path d="M4 1.5v2M4 8.5v2.5M10 2.5v2M10 10v1.5" />
      <rect x="2.9" y="3.5" width="2.2" height="5" rx="0.4" />
      <rect x="8.9" y="4.5" width="2.2" height="5.5" rx="0.4" />
    </svg>
  ),
  line: (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 10L5 6.5l3 2 4.5-5" />
    </svg>
  ),
  step: (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 10.5h3V7h3V3.5h4" />
    </svg>
  ),
  area: (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 10L5 6.5l3 2 4.5-5V12h-11Z" fill="currentColor" opacity="0.25" stroke="none" />
      <path d="M1.5 10L5 6.5l3 2 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  baseline: (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 7h11" strokeWidth="1" strokeDasharray="2 1.6" opacity="0.55" />
      <path d="M1.5 9.5L5 4.5l3 4 4.5-5" strokeWidth="1.2" />
    </svg>
  ),
};

/* Two sections, because the two families cost the reader differently: an
   overlay rides the tape, a sub-pane takes height OFF it — which is also why
   the sub-panes carry T-3's cap (MAX_SUB_PANES, refused in place with the
   reason printed rather than a row that silently does nothing). */
/* The rows themselves live in indicatorItems.ts, shared with the script library. */

const OVERLAY_ITEMS: { key: keyof ChartOverlays; label: string; hint: string }[] = [
  { key: 'trails', label: 'Exposure trails', hint: 'LED strike bands — strength & fade' },
  { key: 'levels', label: 'Key levels', hint: 'Call & put walls, flip and supreme, marked on the field' },
  { key: 'darkpool', label: 'Dark pool', hint: 'Off-exchange print lines' },
  { key: 'volume', label: 'Volume', hint: 'Session bars along the floor' },
  { key: 'flow', label: 'Flow', hint: 'Option premium from the tape — calls up, puts down' },
  { key: 'netDrift', label: 'Net drift', hint: "Running call & put premium totals — the session's lean" },
  { key: 'volDrift', label: 'Vol drift', hint: 'Realised vol off these bars against the implied the feed reports' },
  { key: 'dexStrike', label: 'Exposure by strike', hint: 'Delta, gamma or vega across the chain — docked under the tape' },
  { key: 'session', label: 'Session levels', hint: "Yesterday's high, low & close, the opening range and the first hour" },
  { key: 'cone', label: 'Expected move', hint: "The ±1σ/±2σ band the options priced for today, and what's left of it" },
  { key: 'events', label: 'Events', hint: 'Earnings, FOMC/CPI/NFP and the biggest option prints, marked on the tape' },
  { key: 'alerts', label: 'Alert lines', hint: 'A dotted line where each price alert waits — the bell tells you either way' },
];

/* T-15 — the overlays a rule clock holds: each assumes a fixed bar interval
   (bucketing, runway arithmetic or a time-anchored texture) that range and
   volume bars do not have. StrikeChart gates the drawing; this set keeps the
   MENU honest about it, and the two agree by construction because the chart
   gates on the same idea — no interval, no interval-based layer. */
const CLOCK_HELD_OVERLAYS = new Set<keyof ChartOverlays>([
  'trails', 'flow', 'netDrift', 'volDrift', 'session', 'cone', 'events',
]);

/* Re-exported so every consumer keeps importing its menu vocabulary from the
   toolbar rather than reaching past it into the placement module. */
export type { MenuSide };

/* The caret points where the menu will pop (Noah, 2026-08-23) — down when it
   drops below, sideways when a side-docked toolbox throws it left or right. */
const MENU_SIDE_CARET = {
  bottom: ChevronDown,
  top: ChevronUp,
  left: ChevronLeft,
  right: ChevronRight,
} as const;

const Dropdown = ({
  label,
  icon,
  open,
  onToggle,
  menuSide = 'bottom',
  title,
  children,
}: {
  label: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  menuSide?: MenuSide;
  /** Hover name — carries the words when a compact trigger drops its label. */
  title?: string;
  children: ReactNode;
}) => {
  /* The placement plumbing lives in useAnchoredMenu now — the symbol
     quick-pick and the compare '+' need the same thing, and this was the only
     copy that had it. */
  const { anchorRef, placed, menuRef } = useAnchoredMenu<HTMLButtonElement>(open, menuSide);

  const Caret = MENU_SIDE_CARET[placed?.side ?? menuSide];
  return (
  <div className="relative">
    <button
      ref={anchorRef}
      onClick={onToggle}
      title={title}
      /* A trigger that drops a menu has to say so, and say whether it is
         already open — otherwise the only cue is the caret, which is a
         rotation nobody can hear. In `compact` and `vertical` the label is
         dropped for the icon, so `title` becomes the accessible name too;
         without this those triggers announce as an empty button. */
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={label ? undefined : title}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors ${
        open
          ? 'bg-ink/[0.07] text-textPrimary'
          : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.03]'
      }`}
    >
      {icon}
      {label}
      <Caret className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && placed && createPortal(
      /*
        THE MENU IS A PORTAL, and that is a correctness fix rather than a
        preference.

        It used to be `position: absolute` inside the toolbar. On Terrain the
        toolbar floats inside a pane whose box is `overflow-hidden` — which it
        has to be, for its rounded corners and to contain the chart — so the
        menu was CLIPPED at the pane's bottom edge. Measured at 1440x900 with
        four panes: the Overlays menu ran to y=696 against a pane clipping at
        y=475, and three of its eight rows were rendered, invisible and
        unclickable. The candle theme menu lost four of eleven. Turning a pane
        into a bigger one is not a fix; any ancestor with a scroll or a clip
        anywhere in the app would do the same thing again.

        Out at the body there is no ancestor left to clip it, so the only bound
        is the window — and the window is a bound the placement already knows
        how to respect: it caps the height to the room actually available and
        FLIPS to the other side when that room is not worth using.

        `overflow-x-hidden` keeps the rounded corners clipping the way the plain
        `overflow-hidden` did; `overscroll-contain` stops a flick that reaches
        the end of the list from scrolling the page underneath it.
      */
      <div
        ref={menuRef}
        data-toolbar-menu=""
        style={{
          position: 'fixed',
          left: placed.box.left,
          right: placed.box.right,
          top: placed.box.top,
          bottom: placed.box.bottom,
          maxHeight: placed.box.maxHeight,
        }}
        className="z-[120] min-w-[210px] overflow-y-auto overflow-x-hidden overscroll-contain border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/60 animate-slide-in"
      >
        {children}
      </div>,
      document.body
    )}
  </div>
  );
};

const ChartToolbar = ({
  timeframe,
  onTimeframe,
  overlays,
  onOverlays,
  minimal = false,
  candles = false,
  overlayKeys,
  spread = false,
  compact = false,
  vertical = false,
  menuSide = 'bottom',
  fullscreen = false,
  onToggleFullscreen,
  replay = false,
  onToggleReplay,
  chartStyle = 'candles',
  onChartStyle,
  indicators,
  onIndicators,
  paneId,
  priceScale = 'normal',
  onPriceScale,
  barClock,
  onBarClock,
  themeKey: themeKeyProp,
  onThemeKey,
  priceScaleLock,
  onExportPng,
  sessionOr = 15,
  onSessionOr,
  alertTicker,
  alertSpot = 0,
  onTotalFullscreen,
}: ChartToolbarProps) => {
  const storeThemeKey = useCandleThemeKey();
  const themeKey = themeKeyProp ?? storeThemeKey;
  const [openMenu, setOpenMenu] = useState<
    'overlays' | 'candles' | 'style' | 'indicators' | 'alerts' | 'timeframe' | null
  >(null);
  /* How many are set on this name — the bell jingles when it rises. The
     unseen count and its badge left this bell for the sidebar's (the alerts
     rule, 2026-09-10: one inbox). */
  const armedHere = useAlerts(alertTicker ?? '').filter(a => !a.firedAt).length;
  const rootRef = useRef<HTMLDivElement | null>(null);
  /* The library, and what is on the pane for its count on the door */
  const [libraryOpen, setLibraryOpen] = useState(false);
  const paneScripts = usePaneScripts(paneId);
  const onPaneCount = paneScripts.filter(p => p.chart.visible).length + (indicators ? INDICATOR_ITEMS.filter(i => indicators[i.key]).length : 0);
  /* The editor sits beside a full-screen chart only: this pane leaving full screen closes its dock (the draft stays) */
  const dock = useEditorDock();
  useEffect(() => {
    if (paneId && dock.open && dock.paneId === paneId && !fullscreen) closeEditor();
  }, [paneId, dock.open, dock.paneId, fullscreen]);

  // Outside click closes whichever menu is open
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (rootRef.current?.contains(t)) return;
      /*
        THE MENU IS NO LONGER INSIDE THE TOOLBAR IN THE DOM.

        It portals to the body so a clipping ancestor cannot cut it off, which
        means a containment test against the toolbar alone now calls every
        click on a menu row an OUTSIDE click — the menu would close before the
        row it was clicked on could act. Every portalled panel carries
        `data-toolbar-menu`, so the test asks whether the click landed in one.
      */
      if (t instanceof Element && t.closest('[data-toolbar-menu]')) return;
      if (t instanceof Node && t.parentElement?.closest('[data-toolbar-menu]')) return;
      setOpenMenu(null);
    };
    /*
      ESCAPE CLOSES THE MENU, AND ONLY THE MENU.

      There was no Escape handler here at all, so the only thing listening was
      Terrain's — `window` keydown, bubble phase, which collapses the expanded
      pane (Terrain.tsx:855). Open a menu inside an expanded pane, press the
      key every reader presses to dismiss a menu, and the whole pane came down
      with it: the reader loses the pane to close a dropdown they could
      otherwise only dismiss by clicking elsewhere.

      CAPTURE PHASE, and it has to be. Terrain's listener is on the same
      target, so a bubble-phase handler here would fire alongside it rather
      than instead of it and the pane would still collapse.
      `stopImmediatePropagation` is the one that holds when both are on
      `window` — plain `stopPropagation` does not stop a second listener
      already attached to the same node.
    */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpenMenu(null);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [openMenu]);

  const activeCandleLabel = CANDLE_THEME_OPTIONS.find(o => o.value === themeKey)?.label ?? 'Chrome';
  /* The Theme menu's live preview: the theme under the pointer (the current
     one until the pointer moves), drawn on the chart's own name — the alerts'
     name where the host gave one, the desk's active name otherwise */
  const [themePreview, setThemePreview] = useState<CandleThemeKey | null>(null);
  useEffect(() => {
    if (openMenu !== 'candles') setThemePreview(null);
  }, [openMenu]);
  const shownTheme = CANDLE_THEME_OPTIONS.find(o => o.value === (themePreview ?? themeKey)) ?? CANDLE_THEME_OPTIONS[0];
  const previewTicker = alertTicker ?? Simulator.getActiveTicker();
  const pickTheme = (key: CandleThemeKey) => {
    if (onThemeKey) onThemeKey(key);
    else setCandleTheme(key);
    setOpenMenu(null);
  };
  const overlayItems = overlayKeys ? OVERLAY_ITEMS.filter(i => overlayKeys.includes(i.key)) : OVERLAY_ITEMS;
  const activeOverlayCount = overlayItems.filter(i => overlays[i.key]).length;

  return (
    <div
      ref={rootRef}
      className={`flex ${
        vertical
          ? 'flex-col items-stretch gap-1'
          : `items-center gap-2 flex-wrap ${spread && !compact ? 'w-full' : ''}`
      }`}
    >
      {compact ? (
        /* The current interval IS the trigger, the way every mobile charting
           app does it — the label is the answer to "what am I looking at" and
           the menu is the answer to "what else can I look at". */
        <Dropdown
          label={TIMEFRAME_OPTIONS.find(o => o.value === timeframe)?.label ?? String(timeframe)}
          open={openMenu === 'timeframe'}
          onToggle={() => setOpenMenu(m => (m === 'timeframe' ? null : 'timeframe'))}
          menuSide={menuSide}
          title="Timeframe"
        >
          <div role="group" aria-label="Timeframe">
            {TIMEFRAME_OPTIONS.map(opt => {
              const active = opt.value === timeframe;
              return (
                <button
                  key={opt.value}
                  aria-pressed={active}
                  onClick={() => {
                    onTimeframe(opt.value);
                    setOpenMenu(null);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[11px] transition-colors ${
                    active ? 'bg-ink/[0.06] text-textPrimary' : 'text-textSecondary hover:bg-ink/[0.03]'
                  }`}
                >
                  <Check className={`w-3 h-3 shrink-0 ${active ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Dropdown>
      ) : (
        <TimeframeStrip value={timeframe} onChange={onTimeframe} vertical={vertical} />
      )}

      {/* Spread mode: the divider stops being a line and becomes the spacer
          that shoves every following control to the right edge — the
          timeframes get the whole left side to breathe (Noah, 2026-08-23).
          Vertical turns it back into a line, lying flat. */}
      <span
        className={
          vertical
            ? 'h-px w-4 self-center bg-borderSubtle'
            : spread && !compact
              ? /* it fills the gap rather than pushing from it (ml-auto), so it
                   has a width — the chart's top-docked drawing rail centres
                   itself in this box (StrikeChart useToolbarGap, 2026-09-12) */
                'flex-1 min-w-0'
              : 'w-px h-4 shrink-0 bg-borderSubtle'
        }
        data-toolbar-gap={spread && !compact && !vertical ? '' : undefined}
        aria-hidden
      />

      {/* The TradingView quartet (Noah, 2026-08-23), his order: Replay ·
          Indicators · Alerts · Candles — leading the right cluster, away
          from the timeframes. Candles here is the tape's SHAPE
          (bars/line/area…), not the color theme; Alerts is live since
          2026-08-28 — armed watches, the fired log, and the bell's count. */}
      {(onToggleReplay || onIndicators || alertTicker || onChartStyle || onPriceScale) && (
        <span
          className={`flex gap-1 ${
            vertical ? 'flex-col items-stretch' : 'flex-wrap items-center justify-end'
          }`}
        >
          {/*
            SHED IN COMPACT — the strip could afford one more control, not two.

            Measured at 1280 with two panes, where the toolbar's column is
            399px: the compact strip was 387 with T-1's pencil in it and 420
            once this joined, so it took a second row over the tape at a width
            this file records as won. Both new buttons are MODES rather than
            settings, and only one of them can stay.

            This is the one that goes, because it is the one with another door:
            `p` toggles it on the active pane and announces, and a replaying
            pane wears a REPLAY badge in its identity row that is never shed —
            so the state stays visible even where the control is not. Draw mode
            has no key at all; shedding the pencil would make the whole drawing
            layer unreachable again at those widths.

            The same rule the identity row and the heaviest read already
            follow: when the column cannot pay, the strip sheds, and what it
            sheds is what is still reachable another way.

            Pulse only wires this in FULLSCREEN, where the strip is never
            compact, so nothing there changes.
          */}
          {onToggleReplay && !compact && (
            <button
              onClick={onToggleReplay}
              title={replay ? 'Exit replay — P' : 'Replay session history — P'}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors ${
                /* Armed = the holo silver, never the live lime (Noah, 2026-09-08) */
                replay ? 'bg-silver/[0.12] text-silver' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.03]'
              }`}
            >
              <Play className="w-3 h-3" />
              {/* COMPACT DROPS THE WORD, like every other control in this
                  strip. It read `!vertical` alone, so Replay was the one
                  trigger here that kept its label at the size where the strip
                  has none to spare — measured: with Terrain wiring both the
                  pencil and this, the compact strip ran 418px into a 399px
                  column at 1280 with two panes and took a second row over the
                  tape. The `title` carries the word, as it does for
                  Indicators, Alerts and Candles. */}
              {!vertical && !compact && 'Replay'}
            </button>
          )}
          {onIndicators && indicators && paneId && (
            <>
              <button
                onClick={() => setLibraryOpen(true)}
                title="Indicators and scripts"
                aria-haspopup="dialog"
                aria-expanded={libraryOpen}
                aria-label={vertical || compact ? 'Indicators and scripts' : undefined}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  libraryOpen ? 'bg-ink/[0.07] text-textPrimary' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.03]'
                }`}
                data-scripts-door
              >
                <Activity className="w-3 h-3 text-bear" />
                {!(vertical || compact) && 'Indicators'}
                {onPaneCount > 0 && (
                  /* how many draw on this pane — silver, a where-you-are count, not a status */
                  <span className="min-w-[14px] h-[14px] px-1 rounded-full bg-silver/[0.15] text-silver font-mono text-[8px] font-bold leading-[14px] text-center" data-scripts-count>
                    {onPaneCount}
                  </span>
                )}
              </button>
              <ScriptLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} paneId={paneId} indicators={indicators} onIndicators={onIndicators} fullscreen={fullscreen} />
            </>
          )}
          {onIndicators && indicators && !paneId && (
            <Dropdown
              label={vertical || compact ? '' : 'Indicators'}
              /* Signature inks on the tool icons (Noah, 2026-08-23) —
                 categorical identity, no house meaning: indicators wear the
                 blue their EMA lines lead with */
              icon={<Activity className="w-3 h-3 text-bear" />}
              title="Indicators"
              open={openMenu === 'indicators'}
              onToggle={() => setOpenMenu(m => (m === 'indicators' ? null : 'indicators'))}
              menuSide={menuSide}
            >
              <div className="p-1.5 flex flex-col gap-0.5">
                {INDICATOR_ITEMS.map((item, idx) => {
                  const on = indicators[item.key];
                  const subsOn = SUB_PANE_ORDER.filter(k => indicators[k]).length;
                  /* The third sub-pane is refused, not shrunk into — the same
                     budget rule that caps Terrain at four panes. The row says
                     so instead of silently ignoring the click. */
                  /* T-15 — session-anchored VWAP has no session cuts to
                     find on a rule clock; the chart skips it and this row
                     says why instead of ticking a line that is not there. */
                  const heldByClock = (barClock ?? 'time') !== 'time' && (item.key === 'vwap' || item.key === 'vwapBands');
                  const capped = (!!item.sub && !on && subsOn >= MAX_SUB_PANES) || heldByClock;
                  const firstSub = INDICATOR_ITEMS.findIndex(i => i.sub);
                  return (
                    <div key={item.key} className="contents">
                    {idx === 0 && (
                      <div className="px-2.5 pt-1 font-mono text-[9px] uppercase tracking-widest text-textMuted">On the tape</div>
                    )}
                    {idx === firstSub && (
                      <div className="px-2.5 pt-2 font-mono text-[9px] uppercase tracking-widest text-textMuted">
                        Own pane — two at most{capped ? '' : ''}
                      </div>
                    )}
                    <button
                      role="checkbox"
                      aria-checked={on}
                      disabled={capped}
                      title={
                        heldByClock
                          ? 'Needs time bars — the pane is on a rule clock'
                          : capped
                            ? 'Two sub-panes are the cap — turn one off first, or the tape shrinks past its floor'
                            : undefined
                      }
                      onClick={() => !capped && onIndicators({ ...indicators, [item.key]: !on })}
                      className={`flex items-start gap-2.5 px-2.5 py-2 rounded text-left transition-colors ${
                        capped ? 'opacity-40 cursor-default' : 'hover:bg-ink/[0.03]'
                      }`}
                    >
                      <span
                        className={`mt-px inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
                          on ? 'bg-silverFill border-silverFill' : 'border-borderMuted'
                        }`}
                      >
                        {on && <Check className="w-2.5 h-2.5 text-[#0a0a0a]" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-2 h-[3px] rounded-full"
                            style={{ background: INDICATOR_INKS[item.key] }}
                            aria-hidden
                          />
                          <span className={`font-mono text-[11px] font-semibold ${on ? 'text-textPrimary' : 'text-textSecondary'}`}>
                            {item.label}
                          </span>
                        </span>
                        <span className="block text-[10px] text-textSecondary leading-snug">{item.hint}</span>
                      </span>
                    </button>
                    </div>
                  );
                })}
              </div>
            </Dropdown>
          )}
          {alertTicker && (
            <Dropdown
              label={vertical || compact ? '' : 'Alerts'}
              icon={
                <span className="relative inline-flex">
                  {/* always in the alert ink here (the toolbar's own rule); it jingles when one is set (Noah, 2026-09-10) */}
                  <JingleBell count={armedHere} lit className="w-3 h-3" />
                </span>
              }
              title="Alerts"
              open={openMenu === 'alerts'}
              onToggle={() => setOpenMenu(m => (m === 'alerts' ? null : 'alerts'))}
              menuSide={menuSide}
            >
              <AlertsMenu ticker={alertTicker} spot={alertSpot} tf={timeframe} />
            </Dropdown>
          )}
          {(onChartStyle || onPriceScale) && (
            <Dropdown
              label={vertical || compact ? '' : 'Candles'}
              icon={<CandlestickChart className="w-3 h-3 text-textPrimary" />}
              title={onPriceScale ? 'Chart style & price scale' : 'Chart style'}
              open={openMenu === 'style'}
              onToggle={() => setOpenMenu(m => (m === 'style' ? null : 'style'))}
              menuSide={menuSide}
            >
              {/*
                TWO SECTIONS, ONE TRIGGER — the tape's SHAPE and the AXIS it
                is drawn on. T-7's price scale lives here rather than in a
                trigger of its own, and that was measured rather than chosen.

                The compact strip is 346px of controls, and the narrowest
                column it has to survive is 349 — three pixels of headroom, at
                1180 in every layout and at 1760 in the three-up. A trigger of
                its own is 69px with an icon and a caret and 39 stripped to
                its label alone; both put the theme button onto a second row
                over the tape at widths this file records as won ("four rows
                become one at 1180/1280 in every layout"). Nothing in the
                strip could pay for it without restyling controls that were
                not part of this work.

                It reads right here anyway: one menu for how this chart is
                drawn. And nothing is hidden by folding it in — a percent axis
                prints percentages on its own ticks and an indexed one prints
                100, so the chart states its own mode without a chip repeating
                it, which is the same rule that keeps names off the price axis.
              */}
              <div className="p-1.5 flex flex-col gap-0.5">
                {onChartStyle && CHART_STYLES.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChartStyle(opt.value);
                      setOpenMenu(null);
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded font-mono text-[11px] transition-colors ${
                      opt.value === chartStyle
                        ? 'bg-ink/[0.06] text-textPrimary font-semibold'
                        : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.03]'
                    }`}
                  >
                    {/* The glyph stays house white whatever the row state */}
                    <span className="text-textPrimary shrink-0 inline-flex" aria-hidden>
                      {STYLE_GLYPHS[opt.value]}
                    </span>
                    {opt.label}
                    {opt.value === chartStyle && <Check className="w-3 h-3 ml-auto text-select" />}
                  </button>
                ))}
                {onPriceScale && (
                  <>
                    <span className="mt-1 mb-0.5 px-2.5 pt-1.5 border-t border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textMuted">
                      Price scale
                    </span>
                    {PRICE_SCALES.map(opt => {
                      /* LIVE is what the axis is drawing; CHOSEN is what the
                         reader picked. They differ only while a lock is up,
                         and then both are shown — a lock that silently
                         replaced their pick would read as the app forgetting
                         it. */
                      const live = (priceScaleLock?.mode ?? priceScale) === opt.value;
                      const chosen = priceScale === opt.value;
                      return (
                        <button
                          key={opt.value}
                          disabled={!!priceScaleLock}
                          onClick={() => {
                            onPriceScale(opt.value);
                            setOpenMenu(null);
                          }}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded font-mono text-[11px] text-left transition-colors ${
                            priceScaleLock ? 'cursor-not-allowed opacity-60' : ''
                          } ${
                            live
                              ? 'bg-ink/[0.06] text-textPrimary font-semibold'
                              : `text-textSecondary ${priceScaleLock ? '' : 'hover:text-textPrimary hover:bg-ink/[0.03]'}`
                          }`}
                        >
                          <span className="shrink-0 w-8 text-textPrimary tnum" aria-hidden>
                            {opt.short}
                          </span>
                          <span className="flex flex-col min-w-0">
                            <span className="truncate">{opt.label}</span>
                            <span className="text-[9px] text-textMuted truncate">{opt.blurb}</span>
                          </span>
                          {live && <Check className="w-3 h-3 ml-auto shrink-0 text-select" />}
                          {!live && chosen && (
                            <span className="ml-auto shrink-0 font-mono text-[8px] uppercase tracking-wider text-textMuted">yours</span>
                          )}
                        </button>
                      );
                    })}
                    {priceScaleLock && (
                      <p className="px-2.5 pt-1.5 mt-0.5 border-t border-borderSubtle font-mono text-[9px] leading-relaxed text-textMuted">
                        {priceScaleLock.reason}, so the axis is held in{' '}
                        {(PRICE_SCALES.find(o => o.value === priceScaleLock.mode) ?? PRICE_SCALES[0]).label.toLowerCase()}. Remove
                        it and your pick comes back.
                      </p>
                    )}
                  </>
                )}
                {onBarClock && (
                  <>
                    <span className="mt-1 mb-0.5 px-2.5 pt-1.5 border-t border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textMuted">
                      Bar clock
                    </span>
                    {BAR_CLOCKS.map(opt => {
                      const on = (barClock ?? 'time') === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => {
                            onBarClock(opt.key);
                            setOpenMenu(null);
                          }}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded font-mono text-[11px] text-left transition-colors ${
                            on
                              ? 'bg-ink/[0.06] text-textPrimary font-semibold'
                              : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.03]'
                          }`}
                        >
                          <span className="flex flex-col min-w-0">
                            <span className="truncate">{opt.label}</span>
                            <span className="text-[9px] text-textMuted truncate">{opt.blurb}</span>
                          </span>
                          {on && <Check className="w-3 h-3 ml-auto shrink-0 text-select" />}
                        </button>
                      );
                    })}
                    {(barClock ?? 'time') !== 'time' && (
                      <p className="px-2.5 pt-1 font-mono text-[9px] leading-relaxed text-textMuted">
                        Rule bars fold the live seconds tape — no history before
                        connect, and the interval-based overlays sit out.
                      </p>
                    )}
                  </>
                )}
                {onExportPng && (
                  <>
                    <div className="mt-1 pt-1 border-t border-borderSubtle" />
                    <button
                      onClick={onExportPng}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded font-mono text-[11px] text-left text-textSecondary hover:text-textPrimary hover:bg-ink/[0.03] transition-colors"
                    >
                      <span className="flex flex-col min-w-0">
                        <span>Export PNG</span>
                        <span className="text-[9px] text-textMuted">This pane as an image — levels, drawings, watermark</span>
                      </span>
                    </button>
                  </>
                )}
              </div>
            </Dropdown>
          )}
        </span>
      )}

      {/* A hairline between the quartet and the standing controls */}
      {(onToggleReplay || onIndicators || alertTicker || onChartStyle || onPriceScale) && (
        <span className={vertical ? 'h-px w-4 self-center bg-borderSubtle' : 'w-px h-4 bg-borderSubtle'} aria-hidden />
      )}

      {/* Vertical compresses the trigger to icon + count — the full word was
          what set the upright toolbox's width (Noah, 2026-08-23: "too wide");
          the hover title keeps the name. */}
      <Dropdown
        label={vertical || compact ? String(activeOverlayCount) : `Overlays ${activeOverlayCount}`}
        icon={<Layers className="w-3 h-3" />}
        title="Overlays"
        open={openMenu === 'overlays'}
        onToggle={() => setOpenMenu(m => (m === 'overlays' ? null : 'overlays'))}
        menuSide={menuSide}
      >
        <div className="p-1.5 flex flex-col gap-0.5">
          {overlayItems.map(item => {
            const on = overlays[item.key];
            /* T-15 — these read a fixed bar interval and the rule clock has
               none; the chart gates them, and this row says so instead of
               offering a toggle that would silently draw nothing. */
            const heldByClock = (barClock ?? 'time') !== 'time' && CLOCK_HELD_OVERLAYS.has(item.key);
            return (
              <button
                key={item.key}
                /* The checkbox is drawn in PIXELS — a bordered square that
                   fills and takes a tick. A screen reader saw a plain button
                   and could not tell an overlay that is on from one that is
                   off, which is the only thing this row says. role/aria-checked
                   is the pairing that matches what is already drawn. */
                role="checkbox"
                aria-checked={on}
                aria-disabled={heldByClock}
                disabled={heldByClock}
                title={heldByClock ? 'Needs time bars — the pane is on a rule clock' : undefined}
                onClick={() => !heldByClock && onOverlays({ ...overlays, [item.key]: !on })}
                className={`flex items-start gap-2.5 px-2.5 py-2 rounded text-left transition-colors ${
                  heldByClock ? 'opacity-40 cursor-default' : 'hover:bg-ink/[0.03]'
                }`}
              >
                <span
                  className={`mt-px inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
                    on && !heldByClock ? 'bg-silverFill border-silverFill' : 'border-borderMuted'
                  }`}
                >
                  {on && !heldByClock && <Check className="w-2.5 h-2.5 text-[#0a0a0a]" />}
                </span>
                <span className="min-w-0">
                  <span className={`block font-mono text-[11px] font-semibold ${on && !heldByClock ? 'text-textPrimary' : 'text-textSecondary'}`}>
                    {item.label}
                  </span>
                  <span className="block text-[10px] text-textSecondary leading-snug">
                    {heldByClock ? 'Needs time bars — held while the rule clock is on' : item.hint}
                  </span>
                </span>
              </button>
            );
          })}
          {/*
            THE OPENING RANGE, on the row of the overlay it belongs to.

            Not a trigger of its own: it is one setting of one overlay, and it
            means nothing at all while that overlay is off. Here it is where
            the thing it changes is, and it costs the control strip no width —
            which the strip cannot spare (see Terrain's TOOLBAR_FULL_PX).

            Rendered only when the overlay is ON, and disabled would be worse:
            a live control that does nothing teaches a reader the desk is
            broken, and this one has nothing to do until there are lines to
            change.
          */}
          {onSessionOr && overlays.session && overlayItems.some(i => i.key === 'session') && (
            <div className="flex items-center gap-2 pl-[26px] pr-2.5 pb-2 -mt-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted shrink-0">Opening range</span>
              <span role="group" aria-label="Opening range minutes" className="inline-flex items-center gap-0.5 rounded border border-borderMuted p-0.5">
                {OPENING_RANGES.map(m => (
                  <button
                    key={m}
                    onClick={() => onSessionOr(m)}
                    aria-pressed={sessionOr === m}
                    title={`The session's first ${m} minutes`}
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] tnum transition-colors ${
                      sessionOr === m
                        ? 'bg-ink/[0.16] text-textPrimary font-semibold'
                        : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06]'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </span>
            </div>
          )}
        </div>
      </Dropdown>

      {(!minimal || candles) && (
      <Dropdown
        /* Minimal surfaces (desk widgets) drop the theme name from the
           trigger — at panel width the long label wrapped Expand off the
           row's right edge; the menu itself still shows the active theme. */
        /* "Theme", no longer "Candles" — that name now belongs to the chart
           STYLE picker beside the timeframes (Noah, 2026-08-23) */
        label={vertical || compact ? '' : minimal ? 'Theme' : `Theme · ${activeCandleLabel}`}
        title={`Candle theme · ${activeCandleLabel}`}
        icon={<Palette className="w-3 h-3 text-[#BBB2E8]" />}
        open={openMenu === 'candles'}
        onToggle={() => setOpenMenu(m => (m === 'candles' ? null : 'candles'))}
        menuSide={menuSide}
      >
        {/* THE CHART ITSELF IN EVERY THEME (Noah, 2026-09-11: "an actual high
            quality image of the layout on the chart like how we have it for
            the add widgets on pulse") — the Pulse widget-preview grammar: the
            names down the left, the hovered theme drawn on the right by the
            chart engine on today's bars for this name, one CTA under it. The
            swatch stays on each row as its mark. */}
        <div className="w-[620px] flex" data-theme-menu>
          <div className="w-[212px] shrink-0 max-h-[380px] overflow-y-auto border-r border-borderSubtle">
            {CANDLE_THEME_OPTIONS.map(opt => {
              const t: CandleTheme = CANDLE_THEMES[opt.value];
              const hollowUp = t.borderUp !== undefined && t.borderUp !== t.up;
              const shown = (themePreview ?? themeKey) === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => pickTheme(opt.value)}
                  onMouseEnter={() => setThemePreview(opt.value)}
                  onFocus={() => setThemePreview(opt.value)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 border-b border-borderSubtle/40 last:border-0 transition-colors ${shown ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.03]'}`}
                  data-theme-option={opt.value}
                >
                  <span className="inline-flex h-4 w-7 shrink-0 items-center justify-center gap-[3px] rounded-[3px] border border-ink/10" style={{ background: t.canvas?.bg ?? '#111214' }}>
                    <span className="w-[5px] h-[10px] rounded-[1px]" style={hollowUp ? { boxShadow: `inset 0 0 0 1px ${t.borderUp}` } : { background: t.up }} />
                    <span className="w-[5px] h-[10px] rounded-[1px]" style={{ background: t.down }} />
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className={`text-[12px] font-semibold ${opt.value === themeKey ? 'text-silver' : 'text-textPrimary'}`}>{opt.label}</span>
                    <span className="text-[10px] text-textMuted truncate">{opt.hint}</span>
                  </span>
                  {opt.value === themeKey && <Check className="w-3 h-3 ml-auto shrink-0 text-silver" />}
                </button>
              );
            })}
          </div>
          <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
            <ThemePreview ticker={previewTicker} timeframe={timeframe} themeKey={themePreview ?? themeKey} width={352} height={200} />
            <span className="text-[12px] font-semibold text-textPrimary">{shownTheme.label}</span>
            <span className="text-[10px] text-textSecondary leading-snug">
              {shownTheme.hint} · today's bars on {previewTicker}, drawn by the chart itself
            </span>
            <button
              onClick={() => pickTheme(shownTheme.value)}
              className="mt-auto w-full py-1.5 rounded holo-bg text-[#0a0a0a] hover:brightness-105 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all"
              data-theme-use
            >
              {shownTheme.value === themeKey ? `${shownTheme.label} is on` : `Use ${shownTheme.label}`}
            </button>
          </div>
        </div>
      </Dropdown>
      )}

      {/*
        GATED ON BEING WIRED, not on `minimal` — and shed in compact.

        It read `!minimal`, and NOTHING in the app passed `onToggleDrawing` —
        so the button never rendered anywhere, and the drawing layer under it
        (trendlines, levels, and T-1's measure) had no door at all. A mode flag
        was standing in for "did the host ask for this", which is what every
        other optional control here already tests directly.

        SHED IN COMPACT, with Replay. The two of them are the strip's only
        MODES, they were the only things T-1 and T-13 added to it, and
        together they took the compact strip from 350px to 420 against columns
        as narrow as 379 — a second row of chrome over the tape at ordinary
        laptop widths. Shedding both puts it back at exactly the 350 it was
        before either feature, so neither cost the narrow desk a pixel.

        BOTH KEEP A DOOR, which is what makes shedding them honest rather than
        hiding them: `d` toggles draw mode and `p` toggles replay, both on the
        active pane, both announced. And both modes are VISIBLE once on — draw
        mode raises its own tool strip, replay wears a badge in the identity
        row that is never shed.

        Terrain wires both per pane. The desks that pass no handler are
        unchanged, because the button was not reaching them either way.
      */}
      {onToggleFullscreen && (
        <button
          onClick={onToggleFullscreen}
          title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen chart'}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider text-textMuted hover:text-textPrimary hover:bg-ink/[0.03] transition-colors"
        >
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      )}

      {onTotalFullscreen && (
        <button
          onClick={onTotalFullscreen}
          title="Total fullscreen — the taskbar goes too; Esc brings it back"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider text-textMuted hover:text-textPrimary hover:bg-ink/[0.03] transition-colors"
        >
          <Fullscreen className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default ChartToolbar;
