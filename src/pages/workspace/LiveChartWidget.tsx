/*
==================================================
  SLAYER TERMINAL - WORKSPACE LIVE CHART
  The chart widget owns its own window. Each copy on
  the desk keeps its own timeframe and overlays, so
  two live charts side by side can watch the same
  name on different clocks — which is most of the
  reason to put two of them on a desk.

  State lives HERE rather than in the registry so
  every instance gets its own, for free.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DOCK_ROOM } from '../../data/editorDock';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import ChartToolbar from '../../components/gex/ChartToolbar';
import CompareControl from '../../components/gex/CompareControl';
import { CANDLE_THEMES, chartSurface, useCandleThemeKey } from '../../components/gex/candleTheme';
import StrikeChart, {
  DEFAULT_INDICATORS,
  DEFAULT_OVERLAYS,
  type ChartIndicators,
  type ChartOverlays,
  type ChartStyle,
  type CompareEntry,
  type CompareMode,
} from '../../components/gex/StrikeChart';
import { FOCUS, SUPREME, alpha } from '../../components/gex/paletteInk';
import { buildLevelRead } from '../../data/levelview';

const fmtFocus = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
import TickerQuickPick from '../../components/gex/TickerQuickPick';
import SpotPrice from '../../components/gex/SpotPrice';
import { buildPrints } from '../../data/gex';
import { buildExposureProfile } from '../../data/exposure';
import StrikeExposureBand, { type BandMetric } from '../../components/gex/StrikeExposureBand';
import { twinFamilyFor, twinPrice, fmtTwin } from '../../data/indexTwins';
import { useFadeClose } from '../../components/ui/useFadeClose';
import type { Timeframe } from '../../data/timeframe';
import type { WorkspaceCtx } from './registry';

/* Compare-line inks, blue leading like TradingView's; four slots. None of
   these collide with the field (gold/steel), the levels (magenta/green/red/
   baby-blue), or the voices (lime/mint). */
const COMPARE_INKS = ['#5B9CF6', '#BBB2E8', '#EDE4CD', '#6BD3C7'];

export interface LiveChartWidgetProps {
  ctx: WorkspaceCtx;
  /**
   * This chart is the ONLY thing on the screen — the phone's Pulse, where
   * there is no desk around it.
   *
   * Two things follow, and they are the two the docked chart gets from its
   * surroundings rather than from itself. The symbol picker: docked, the name
   * is changed from the panel header the desk draws above this component, and
   * with no desk there is no header and the chart would be stuck on whatever
   * name it opened with. The style and indicator menus: docked they are held
   * back because a 12-column panel has no room for them, which is not true of
   * a chart holding the whole window.
   *
   * It is NOT a second fullscreen. `full` is a portal that covers the app;
   * this is a chart laid out normally inside a host that happens to be the
   * viewport, so the terminal's own nav stays reachable above it.
   */
  soleChart?: boolean;
}

const LiveChartWidget = ({ ctx, soleChart = false }: LiveChartWidgetProps) => {
  const { flowTape } = useMarketData();
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [overlays, setOverlays] = useState<ChartOverlays>(DEFAULT_OVERLAYS);
  const [compares, setCompares] = useState<CompareEntry[]>([]);
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candles');
  const [indicators, setIndicators] = useState<ChartIndicators>(DEFAULT_INDICATORS);
  const [replay, setReplay] = useState(false);
  /* Draw mode (Noah, 2026-08-28: "make sure pulse live charts also have this
     same toolbar including the functionality") — the rail, the marks, and the
     floating mark bar all live inside StrikeChart; the host only holds the
     mode. Marks are stored per ticker, so a line drawn here IS the line drawn
     on Terrain. Phone mode (compact) keeps the rail off — same rule as
     everywhere else. */
  const [drawing, setDrawing] = useState(false);
  /* Which greek the docked strike band draws. Per instance, like the timeframe
     and the overlays: two charts on one desk can watch the same name through
     different greeks, which is most of the reason to have two of them. */
  const [bandMetric, setBandMetric] = useState<BandMetric>('dex');
  const [full, setFull] = useState(false);
  /* Mode 3 of 3 (Noah, 2026-08-23: "the full full screen one") — the
     taskbar itself disappears and the tape IS the screen; Esc steps back
     down to fullscreen. Only reachable FROM fullscreen. */
  const [superFull, setSuperFull] = useState(false);
  /* The 4-way board opens as a TAKEOVER over the desk, not a route (Noah,
     2026-08-17: the route's Back remounted the whole desk — a hard cut).
     The /pulse/board route survives for direct links. */
  /* Leaving fullscreen by any road (Esc, the arrows) also takes the reader back
     to the page a focus arrived from, when it did (ctx.focusReturn) */
  const { closing: fullClosing, close: closeFull } = useFadeClose(() => {
    setFull(false);
    setDrawing(false);
    ctx.focusReturn?.();
  });

  /* ONE surface for the whole window (Noah, 2026-08-23: "different layers of
     black... the top toolbar is a different color black than the actual
     chart"): the candle theme's own canvas when it carries one, the house
     inset black otherwise. Toolbar and tape both sit on it — no second black,
     no seam. */
  const addCompare = (t: string, mode: CompareMode) =>
    setCompares(cs => {
      if (cs.length >= 4 || cs.some(c => c.ticker === t) || t === ctx.ticker) return cs;
      const ink = COMPARE_INKS.find(i => !cs.some(c => c.ink === i)) ?? COMPARE_INKS[0];
      return [...cs, { ticker: t, mode, ink }];
    });
  const removeCompare = (t: string, mode: CompareMode) =>
    setCompares(cs => cs.filter(c => !(c.ticker === t && c.mode === mode)));

  const themeKey = useCandleThemeKey();
  const themeBg = chartSurface(CANDLE_THEMES[themeKey]).bg;
  /* Panel black, not inset — the desk widget's chrome is #0a0a0a, and a
     #070707 body against it read as a second shade (Noah, 2026-08-23:
     "i see 2 different shades"). One black, header to tape. */
  const surface = themeBg === 'transparent' ? 'rgb(var(--panel))' : themeBg;
  /* The strip's 55% wash of that surface — the token cannot take a hex alpha suffix */
  const strip = themeBg === 'transparent' ? 'rgb(var(--panel) / 0.55)' : `${themeBg}8C`;

  // Dark-pool prints for the DP overlay. Deterministic per ticker and pinned to
  // it (PulseBoard's contract), so the lines don't wander with the 1s pulse —
  // without this prop the toolbar's Dark pool toggle drew nothing (Noah,
  // 2026-08-18).
  const prints = useMemo(
    () => buildPrints(ctx.ticker, ctx.gex.levels.spot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.ticker]
  );

  /*
    THE DOCKED BAND'S BOOK, rebuilt per tick from the desk's own snapshot.

    0DTE and ten strikes each side — the window the desk's other exposure
    surfaces already use, so a reader comparing the band to the ladder beside
    it is comparing the same book rather than two different slices of it.

    Built only while the band is actually drawn. `buildExposureProfile` walks
    the whole chain, and doing that every tick for a panel nobody opened is the
    kind of cost that only shows up on the desk with four charts on it.
  */
  const bandData = useMemo(
    () => (overlays.dexStrike ? buildExposureProfile(ctx.snapshot, '0DTE', 10) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlays.dexStrike, ctx.snapshot, ctx.revision]
  );

  /* A strike ARRIVES (Noah, 2026-08-22: "why does it take me to the default
     pulse page") — the chart comes to you: the takeover opens on the arrival
     token, the FOCUS line already on the tape, so the destination is
     unmistakable. One-shot: closing it leaves the docked chart focused. */
  useEffect(() => {
    if (!ctx.focusOpen) return;
    setFull(true);
    // The level view needs the trails on — the focused band IS the level's
    // history, and it can't lead a field that isn't drawn.
    setOverlays(o => (o.trails ? o : { ...o, trails: true }));
  }, [ctx.focusOpen]);

  /* THE ONE FULLSCREEN BUTTON is the tile head's (Noah, 2026-09-12): the desk
     hands this chart a one-shot token and the chart lifts its own fullscreen —
     the quartet, the editor dock, total fullscreen and Esc's ladder all ride
     on it. The toolbar's own button only shows the way back once up. */
  useEffect(() => {
    if (ctx.fullOpen) setFull(true);
  }, [ctx.fullOpen]);

  /* What the focused level is doing today — distance, tests, gamma trend —
     re-read per revision so the distance walks with the tape. */
  const levelRead = useMemo(
    () => (ctx.focusPrice != null ? buildLevelRead(ctx.ticker, ctx.focusPrice) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.focusPrice, ctx.ticker, ctx.revision]
  );

  // Same takeover contract as the heatmap widget: Esc exits (fading), page
  // scroll locks underneath. The z-[80] guard hands Esc to a board cell's
  // own fullscreen first.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      // A modal over the takeover took the key already (Modal marks it)
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Esc steps DOWN the ladder: total fullscreen → fullscreen → desk
      if (superFull) {
        setSuperFull(false);
        return;
      }
      closeFull();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [full, superFull, closeFull]);

  // Leaving fullscreen by any road also leaves total fullscreen
  useEffect(() => {
    if (!full) setSuperFull(false);
  }, [full]);

  const body = (
    /*
      A COLUMN when this chart owns the screen, so the control strip can take
      a row of its own beneath the tape instead of floating over it. Docked
      and fullscreen keep the plain relative box the floating bar needs.
    */
    <div
      className={`relative h-full min-h-0 ${soleChart ? 'flex flex-col' : ''}`}
      style={{ background: surface }}
      /* A DARK ISLAND on any page (2026-09-12): the tape, its strip and its legend read the dark tokens */
      data-theme="dark"
    >
      {/* Controls sit in the body, not the header — the header is the drag
          handle, and a click there would start dragging the panel. The 4-way
          button is the door to /pulse/board — it moved here when the desk
          became the Pulse page (2026-08-17); the old page carried it before. */}
      {/* THE TASKBAR (settled 2026-08-23 against TradingView's): chrome, not
          an object — full width, fused to the top edge, no container, no
          border, TradingView's spread. TRANSLUCENT TRIAL (Noah, 2026-08-23:
          "try making the taskbar translucent i want to see something"): the
          tape runs full-bleed underneath and the bar is a veil over it —
          55% of the surface color plus a soft blur. */}
      {/* Mode 3 — the tape is the screen (Noah, 2026-08-23, TradingView's
          total fullscreen). The taskbar is NOT gone: it rests invisible at the
          top edge and comes up when the pointer reaches it, TradingView's own
          move, and an Esc chip stays in the corner at rest-dim (Noah,
          2026-09-12: "my toolbar inside the charts keeps disappearing... like
          cant even see anything at all" — a screen with no way back is a
          trap, and the total-fullscreen door sits one icon from fullscreen). */}
      {(
      <div
        /*
          The roomier spread when this chart owns the screen — and on a phone
          it is not a preference: the tight set is built for a pointer, and its
          controls land under the 44px a fingertip actually covers.

          ONE LINE THAT SCROLLS, never a block that wraps, in `soleChart`.
          Wrapping is the right answer for a bar that is merely snug; it is the
          wrong one for a bar that does not remotely fit. Measured at 390px
          with `flex-wrap`: the strip became a ~600px vertical column pinned to
          the right edge, over the price axis, hiding most of the tape — while
          the chart underneath was full height with a correctly sized canvas
          and the page had no sideways scroll. Nothing that measures the CHART
          can see this; it is entirely inside the overlay.
        */
        className={`z-10 w-full select-none flex flex-wrap items-center backdrop-blur-md backdrop-saturate-150 ${
          soleChart
            ? /* 40px on every control in the strip AND in the menus it opens.
                 The toolbar's own buttons are sized for a cursor and measure
                 20–23px tall, which is half what a fingertip actually covers —
                 fine under a mouse, a mis-tap generator on the device this
                 layout exists for. Applied from the host rather than threaded
                 through the shared toolbar: it is a property of being touched,
                 not of being compact, and the desk's charts are not touched. */
              'order-last shrink-0 border-t border-borderSubtle px-3 py-2 gap-3 [&_button]:min-h-[40px]'
            : `absolute top-0 inset-x-0 ${full ? 'px-3 py-2 gap-3' : 'px-2 py-1.5 gap-2'}`
        }${superFull ? ' opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200' : ''}`}
        data-taskbar-rest={superFull ? 'hidden' : undefined}
        style={{ background: strip }}
        /* Floating chrome the chart's scripts legend measures and sits under (2026-09-10) */
        data-chart-chrome
      >
        {/* Fullscreen earns the TradingView move (Noah, 2026-08-17): change
            the name without leaving the takeover — same quick-pick the 4-way
            cells carry, wired to this panel's pin. Docked keeps the header
            picker. */}
        {(full || soleChart) && ctx.pickTicker && (
          <>
            <span className="inline-flex items-center gap-2">
              <TickerQuickPick ticker={ctx.ticker} onPick={ctx.pickTicker} />
              {/* TV's "+" beside the symbol capsule — compare symbols */}
              <CompareControl
                current={ctx.ticker}
                compares={compares}
                onAdd={addCompare}
                onRemove={removeCompare}
              />
              {/* No price here (Noah, 2026-08-23: "too redundant") — the
                  chart legend below carries the live tick now. The twins
                  stay: they are prices the legend does NOT show. */}
              {/* The price twins on index names (Noah, 2026-08-18) — the
                  cash index and the futures beside the ETF, no TradingView
                  detour. */}
              {(() => {
                /* Not on the phone strip. The twins are a useful third and
                   fourth price on a desk that has room for them; on 390px they
                   are ~180px of text sitting between the symbol and the
                   timeframes, pushing the control a reader reaches for most
                   off the end of a strip they then have to scroll back. The
                   name's own price is in the legend on the tape either way. */
                if (soleChart) return null;
                const fam = twinFamilyFor(ctx.ticker);
                if (!fam) return null;
                const s = Simulator.TICKERS[ctx.ticker]?.currentPrice ?? ctx.gex.levels.spot;
                /* Our indexTwins prices a twin from the ETF price and the
                   ETF spot; his tree measures the basis off the tape instead
                   (T-17). Not ported with this pass — the signature change
                   reaches every twin reader on the desk. */
                return (
                  <span className="font-mono text-[10px] text-textMuted tnum">
                    {fam.index} {fmtTwin(twinPrice(fam, 'index', s, s))} · {fam.futures}{' '}
                    {fmtTwin(twinPrice(fam, 'futures', s, s))}
                  </span>
                );
              })()}
            </span>
            <span className="w-px h-4 bg-borderSubtle shrink-0 mx-1.5" aria-hidden />
          </>
        )}
        {/* Spread, the TradingView grammar: timeframes pinned left, every
            other control pushed to the right edge. */}
        <div className="flex-1 min-w-0">
          <ChartToolbar
            minimal
            candles
            /* Every menu opens UPWARD off the bottom strip — downward would
               put it past the bottom of a window that does not scroll. */
            menuSide={soleChart ? 'top' : 'bottom'}
            compact={soleChart}
            /* `spread` shoves the right cluster to the far edge — meaningless
               on a strip narrower than its own contents, where it only opens
               a gap nobody can reach past. */
            spread={!soleChart}
            timeframe={timeframe}
            onTimeframe={setTimeframe}
            overlays={overlays}
            onOverlays={setOverlays}
            /* The quartet rides ONLY in fullscreen (Noah, 2026-08-23:
               "remove those sections completely unless... full screen");
               the settings themselves persist across modes. */
            replay={replay}
            onToggleReplay={full ? () => setReplay(r => !r) : undefined}
            chartStyle={chartStyle}
            onChartStyle={full || soleChart ? setChartStyle : undefined}
            indicators={indicators}
            onIndicators={full || soleChart ? setIndicators : undefined}
            paneId="pulse:main"
            /* The Alerts door rides where Indicators does — fullscreen, or the
               sole chart (the alerts rule, 2026-09-11: set in place — a windowed
               Pulse with the chart alone had no way to set a price alert) */
            alertTicker={full || soleChart ? ctx.ticker : undefined}
            alertSpot={ctx.gex.levels.spot}
            /* the door's own focus would hold the resting taskbar up (focus-within) — let it go as the tape takes the screen */
            onTotalFullscreen={full ? () => { setSuperFull(true); (document.activeElement as HTMLElement | null)?.blur(); } : undefined}
            /* The 4-way board is four charts, which is the one thing the
               phone's Pulse exists to NOT be — and it opens as a takeover
               with no way back that fits a 390px screen. */
            fullscreen={full}
            /* Docked, the tile head carries the one fullscreen button; up, the
               toolbar's button is the way back (beside Esc) */
            onToggleFullscreen={full ? closeFull : undefined}
          />
        </div>
        {/* The FOCUS line's chip — a strike sent here from Ranked Targets /
            Exposure Profile. Says what the dashed line on the tape IS, and
            is the only way to take it down by hand (it also clears when the
            desk changes name). Lime = the selection voice: what you clicked. */}
        {ctx.focusPrice != null && (
          <span
            className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded border font-mono text-[9px] uppercase tracking-widest animate-soft-in"
            style={{ color: FOCUS, borderColor: alpha(FOCUS, 0.4), background: alpha(FOCUS, 0.06) }}
          >
            Focus
            <span className="text-[11px] font-bold tnum normal-case tracking-normal">{fmtFocus(ctx.focusPrice)}</span>
            {/* The strike's standing right now — it wears the supreme's magenta
                on the tape while it holds the crown, and this says why */}
            {Math.abs(ctx.gex.levels.supreme - ctx.focusPrice) < 1e-9 && (
              <span className="font-bold" style={{ color: SUPREME }}>
                Supreme
              </span>
            )}
            {/* The level read — the three things that decide whether a ranked
                level is about to matter: distance, tests today, gamma trend.
                Neutral ink: none of these is a market direction. */}
            {levelRead && (
              <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-[10px] text-textSecondary tnum">
                <span aria-hidden="true" className="text-textMuted">·</span>
                <span className="text-textPrimary">
                  {levelRead.distPct > 0 ? '+' : ''}
                  {levelRead.distPct.toFixed(2)}%
                </span>
                <span aria-hidden="true" className="text-textMuted">·</span>
                <span title="Times price has tested this level this session">
                  {levelRead.touches === 0
                    ? 'untested today'
                    : `tested ${levelRead.touches}× · last ${levelRead.lastTouch}`}
                </span>
                <span aria-hidden="true" className="text-textMuted">·</span>
                <span title="Gamma at this strike, now against the session open">
                  {levelRead.trend === 'NEW'
                    ? 'gamma new since open'
                    : `gamma ${levelRead.trend.toLowerCase()} ${levelRead.changePct! > 0 ? '+' : ''}${levelRead.changePct!.toFixed(0)}%`}
                </span>
              </span>
            )}
            {ctx.clearFocus && (
              <button
                onClick={ctx.clearFocus}
                aria-label="Clear focus line"
                title="Clear the focus line"
                className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-ink/[0.08] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        )}
      </div>
      )}
      {/* THE WAY BACK FROM MODE 3, always on screen at rest-dim — never a
          screen with nothing on it */}
      {superFull && (
        <button
          onClick={() => setSuperFull(false)}
          title="Back to fullscreen — the toolbar returns (Esc); or reach the top edge for it"
          className="absolute top-2 right-2 z-20 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-ink/[0.08] bg-canvas/40 backdrop-blur-[3px] font-mono text-[9px] uppercase tracking-widest text-textSecondary opacity-40 hover:opacity-100 hover:text-textPrimary transition-opacity"
          data-total-esc
        >
          Esc · the toolbar
        </button>
      )}
      {/* The tape owns the WHOLE window and runs under the translucent bar,
          edge to edge — no padding, no inner frame.

          Except in `soleChart`, where it is a flex ROW of the body's column
          and takes whatever the strip below it leaves. `absolute inset-0`
          there would lay the tape over the strip as well as under it, and the
          strip's own controls would still be tappable — so it would look
          right and the chart would simply be 60px taller than the space it
          was given, with its time axis behind the buttons. */}
      {/*
        A COLUMN, so the docked band can take a row of its own beneath the tape.

        It was a plain box with the chart filling it. The band is a STRIKE-axis
        panel — see StrikeExposureBand for why that can never be a pane inside
        the price chart — so it needs real space rather than an overlay, and an
        absolutely-positioned strip at the bottom would have covered the time
        axis it sits under. The floating taskbar is unaffected: it is absolute
        against the OUTER box, not this one.
      */}
      <div className={`flex flex-col ${soleChart ? 'relative flex-1 min-h-0' : 'absolute inset-0'}`}>
        {/* The chart legend (Noah, 2026-08-23, TradingView's grammar): name ·
            timeframe · the live tick, floating on the tape's top-left just
            under the taskbar (which the tape now runs beneath). Facts only —
            no buy/sell, we are not a broker. pointer-events-none: the tape
            pans straight through it. */}
        <div
          className={`absolute left-2 z-10 pointer-events-none select-none flex flex-col gap-1 font-mono ${
            superFull ? 'top-2' : full ? 'top-12' : 'top-10'
          }`}
          data-chart-chrome
        >
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-semibold text-textPrimary">{ctx.ticker}</span>
            <span className="text-[10px] text-textMuted" aria-hidden>·</span>
            <span className="text-[10px] text-textMuted">{timeframe}</span>
            <span className="text-[10px] text-textMuted" aria-hidden>·</span>
            <SpotPrice
              value={Simulator.TICKERS[ctx.ticker]?.currentPrice ?? ctx.gex.levels.spot}
              className="text-[11px] font-semibold tnum text-textPrimary"
            />
          </div>
          {/* One quiet row per comparison — its line ink, its name, and the
              only hand-removal outside the + menu */}
          {compares.map(c => (
            <div key={`${c.ticker}:${c.mode}`} className="flex items-center gap-1.5">
              <span className="w-2 h-[3px] rounded-full" style={{ background: c.ink }} aria-hidden />
              <span className="text-[10px] font-semibold" style={{ color: c.ink }}>
                {c.ticker}
              </span>
              {Simulator.TICKERS[c.ticker] && (
                <SpotPrice
                  value={Simulator.TICKERS[c.ticker].currentPrice}
                  className="text-[10px] tnum text-textSecondary"
                />
              )}
              <button
                onClick={() => removeCompare(c.ticker, c.mode)}
                aria-label={`Remove ${c.ticker} comparison`}
                title="Remove comparison"
                className="pointer-events-auto inline-flex items-center justify-center w-4 h-4 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.08] transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
        {/* Ticker-keyed slow fade (the Weigher's browse grammar): a name
            change breathes in instead of hard-swapping the tape. */}
        <div key={ctx.ticker} className="min-h-0 flex-1 animate-soft-in-slow">
          <StrikeChart
            ticker={ctx.ticker}
            paneId="pulse:main"
            revision={ctx.revision}
            flowPrints={flowTape}
            levels={ctx.gex.levels}
            timeframe={timeframe}
            overlays={overlays}
            prints={prints}
            compares={compares}
            chartStyle={chartStyle}
            indicators={indicators}
            replay={replay}
            onExitReplay={() => setReplay(false)}
            focusPrice={ctx.focusPrice ?? null}
            drawing={drawing}
            onExitDraw={() => setDrawing(false)}
            /* THE RAIL ONLY IN FULLSCREEN (Noah, 2026-09-12: "the live chart on
               pulse shouldnt even show the toolbar until user decides to enter
               the full screen size") — no way in while docked, so no rail;
               leaving fullscreen puts the pencil down too */
            onEnterDraw={full ? () => setDrawing(true) : undefined}
            railTopOk={full}
            height={full ? 460 : 180}
            /* The axis labels and strike chips at phone size — they are fixed
               sizes tuned on a ~550px chart, and the 54px price gutter they
               produce is 4% of a desktop chart but 14% of a 390px screen. */
            compact={soleChart}
            frameless
          />
        </div>
        {/* Docked BELOW the tape rather than inside it, and toggled from the
            same Overlays menu as the panes so the reader learns one control. */}
        {bandData && (
          <StrikeExposureBand
            data={bandData}
            metric={bandMetric}
            onMetric={setBandMetric}
            /*
              THE BAND IS SIZED TO WHAT IS LEFT, not to a constant.

              76px of plot is a fifth of a docked panel and a quarter of a
              handset in LANDSCAPE, where a 390px window is already paying for
              the nav and the touch strip: measured there, the tape dropped to
              117px with the band open — still the biggest thing on screen by a
              hair, and not a chart anyone can trade off. A shorter band gives
              most of that back and still reads: a diverging histogram needs
              enough height to tell a tall bar from a short one, and it has
              that at 48px.
            */
            plotHeight={full ? 120 : soleChart ? 48 : 76}
            onClose={() => setOverlays(o => ({ ...o, dexStrike: false }))}
          />
        )}
      </div>
    </div>
  );

  // Portal, not a plain fixed div: react-grid-layout positions panels with CSS
  // transforms, and a transformed ancestor becomes the containing block for
  // position:fixed — an in-place overlay would size itself to the widget.
  if (full) {
    return createPortal(
      /* Edge to edge — no padding, no panel frame, no rounded corners: the
         chart IS the screen (Noah, 2026-08-23: "i want it to cover the
         ENTIRE screen"). The body paints the surface. */
      <div
        className={`fixed inset-0 z-[80] flex flex-col animate-soft-in transition-opacity duration-200 ease-out ${
          fullClosing ? 'opacity-0' : ''
        }`}
        /* the script editor's dock takes the right edge while it is open (data/editorDock.ts) */
        style={{ background: surface, ...DOCK_ROOM }}
        data-theme="dark"
      >
        <div className="flex-1 min-h-0">{body}</div>
      </div>,
      document.body
    );
  }

  return (
    <>
      {body}
    </>
  );
};

export default LiveChartWidget;
