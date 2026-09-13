/*
==================================================
  SLAYER TERMINAL - WORKSPACE WIDGET REGISTRY
  Every widget wraps an existing panel component and
  receives the shared data context built by the page.

  BROUGHT BACK TO LIFE (Noah, 2026-09-08: "the cards
  of the pulse page … outdated mainly in their header
  formatting … some of the widgets are outdated and
  new ones are missing"): every panel now carries a
  plain-English title and a one-line `sub` for the
  tile head, a skeleton in its own shape for the
  frame it takes to mount, and the Pinpoint pages'
  surfaces are panels too — The range, Where it
  closes, Targets (the agenda, replacing the old
  five-factor Ranked Targets under its key), At the
  wall, Where the walls are heading (replacing Wall
  Drift under its key).

  THE AUDIT (Noah, 2026-09-12: "some things we have
  on the + add widget page don't make sense so take
  control and you use logic to understand which
  fits and does not"). The rule a panel has to pass:
  it is a LIVE READING of one name or the market —
  one question, answered on the desk's clock, in a
  tile — and it is a copy of a page a reader can
  open. What failed it: the Weigher, a whole
  workstation (a chain to pick from, a contract to
  weigh) crammed into a tile, which the page does
  properly — gone. What the desk lacked and fits:
  the name's Net flow, its Dark pool shelves and
  its Tape, the Trace pages' own readings, so the
  desk sees the flow beside the levels. Order flow
  keeps its place and loses a door it never had a
  page for.
==================================================
*/

import { type ReactNode } from 'react';
import LiveChartWidget from './LiveChartWidget';
import StrikeLadderWidget from './StrikeLadderWidget';
import CompassSetupsWidget from './CompassSetupsWidget';
import TargetsWidget from './TargetsWidget';
import EarningsWidget from './EarningsWidget';
import NewsWidget from './NewsWidget';
import NetFlowWidget from './NetFlowWidget';
import DarkPoolWidget from './DarkPoolWidget';
import TapeWidget from './TapeWidget';
import { CloseWidget, RangeWidget } from './AheadWidgets';
import AtTheWallWidget from './AtTheWallWidget';
import WallsHeadingWidget from './WallsHeadingWidget';
import ExposureField from '../../components/gex/ExposureField';
import OrderFlowPanel from '../../components/gex/OrderFlowPanel';
import { ChartSkeleton } from '../../components/ui/Skeleton';
import { CloseInner, CorridorInner } from '../pinpoint/pinpointSkeletons';
import { AtTheWallInner } from '../../components/gex/wallSkeletons';
import { WallHeadingSkeleton } from '../../components/gex/buildingSkeletons';
import { TargetsWidgetSkeleton } from './pulseSkeletons';
import type { PulseView, ExposureProfileData, GexMatrixData, GexView, VannaCharmView } from '../../types/gex';
import type { MarketSnapshot } from '../../types/market';
import type { CompassView } from '../../types/compass';

export interface WorkspaceCtx {
  ticker: string;
  /** Pin THIS panel to a name — the desk binds it per instance (the chart's
      fullscreen ticker picker rides on it; the header picker is the other
      door to the same state). */
  pickTicker?: (ticker: string) => void;
  /** The snapshot this context was built from — widgets that derive their own
      views (their own metric, their own expiry) rebuild from it. */
  snapshot: MarketSnapshot;
  revision: number;
  /** The 1s heat tick — widgets that rebuild their own matrix re-pulse with it */
  pulseTick: number;
  /** A strike another page sent here to be seen on the chart (Targets, the
      Exposure Ledger) — the live chart draws it as the FOCUS line until
      cleared or until the desk changes name. */
  focusPrice?: number | null;
  clearFocus?: () => void;
  /** A one-shot arrival token (changes per deep link): the chart that carries
      it lifts itself fullscreen so the strike is unmistakably on screen. The
      desk hands it to ONE chart. */
  focusOpen?: number;
  /** THE WAY BACK (Noah, 2026-09-09: "a user doesnt want to go back to the
      toolbar and find the page -> subpage again"): when the arrival came from
      another page, the chart calls this as it leaves the fullscreen the
      arrival opened, and the desk sends the reader back to that page. Once. */
  focusReturn?: () => void;
  /** A one-shot token from the tile head's fullscreen button (2026-09-12): a
      panel that owns its fullscreen (`WidgetDef.ownFull`) lifts it on this
      instead of the desk opening the tile takeover — one button, one road. */
  fullOpen?: number;
  /** Focus a strike on THIS desk's chart — the in-desk door (a route push to
      /pulse from inside Pulse never re-runs the deep link). */
  focusStrike?: (price: number) => void;
  gex: GexView;
  /** Strike × expiry matrix with the 1s live pulse applied */
  matrix: GexMatrixData;
  exposure: ExposureProfileData;
  pulse: PulseView;
  vanna: VannaCharmView;
  setups: CompassView;
}

export interface WidgetDef {
  key: string;
  title: string;
  /** One line under the title on the tile head — what the panel answers */
  sub: string;
  description: string;
  w: number;
  h: number;
  minW: number;
  minH: number;
  /** The tallest this panel is allowed to be, in grid rows (100px each):
      past it the content has nothing more to show and the panel is just
      empty surface (Noah, 2026-08-22: the Weigher "just keeps going"). A
      cap per panel, not per page — each one knows its own content. */
  maxH: number;
  render: (ctx: WorkspaceCtx) => ReactNode;
  /** The panel standing in its own shape for the frame it takes to mount */
  skeleton: () => ReactNode;
  /** The panel has a fullscreen of its own (the live chart: the quartet, the
      editor dock, total fullscreen) — the tile head's button hands it
      `ctx.fullOpen` and the chart lifts it */
  ownFull?: boolean;
  /** THE PAGE THIS PANEL IS A COPY OF (Noah, 2026-09-12: "it should take the
      user to the actual page... with a button allowing them to go back to the
      pulse page from there") — the tile head's button opens it, on the tile's
      name, with the way back to Pulse; never a takeover that copes on its own.
      `prepare` sets the page up to show what the tile showed (a view pick). */
  page?: { path: string; label: string; prepare?: () => void };
}

const MAP_VIEW = (view: 'calendar' | 'ladder') => () => {
  try {
    localStorage.setItem('slayer_ledger_view', view);
  } catch {
    /* private mode — the page opens on its last view */
  }
};

const chartSkeleton = () => <ChartSkeleton className="h-full" />;

export const WIDGETS: WidgetDef[] = [
  {
    key: 'live-chart',
    title: 'Live chart',
    sub: 'Price with the walls, the flip and the supreme on it',
    description: 'Candles with walls, flip, supreme & the exposure trails — own timeframe & overlays',
    w: 8,
    h: 5,
    minW: 4,
    minH: 4,
    maxH: 10, // a tape earns height — about a full viewport
    // Its own component so each copy on the desk keeps its own timeframe
    render: ctx => <LiveChartWidget ctx={ctx} />,
    skeleton: chartSkeleton,
    ownFull: true,
  },
  {
    // Key kept from the matrix so saved desks upgrade in place — the grid of
    // pills became the Exposure Ledger — the capsules, full, under a head
    // (2026-09-03 → 09-05).
    key: 'exposure-matrix',
    title: 'Exposure Ledger',
    sub: 'Every strike and expiry as a capsule — the book across the calendar',
    description: 'The book across the calendar as capsules — every strike and expiry a cell with its figure inside; blue where hedging pushes back, warm where it pushes along; one greek or all five; hover to read, click to pin',
    w: 7,
    h: 5,
    minW: 5,
    minH: 4,
    maxH: 8,
    render: ctx => <ExposureField snapshot={ctx.snapshot} fullOpen={ctx.fullOpen} headFull />,
    skeleton: chartSkeleton,
    page: { path: '/pinpoint/map', label: 'the Map', prepare: MAP_VIEW('calendar') },
  },
  {
    // Key kept from the heatmap so saved desks upgrade in place — the strike ×
    // expiry grid became the Strike Pressure Ladder (Mo, 2026-08-19).
    key: 'gex-heatmap',
    title: 'Strike Pressure Ladder',
    sub: 'Put and call hedging at every strike, and the levels it names',
    description: 'Every strike a row — put & call hedging as bars, net, distance, open interest — with a Levels view: walls, pin, flip & supreme at a glance',
    w: 6,
    h: 5,
    minW: 4,
    minH: 4,
    maxH: 9,
    render: ctx => <StrikeLadderWidget ctx={ctx} />,
    skeleton: chartSkeleton,
    page: { path: '/pinpoint/map', label: 'the Map', prepare: MAP_VIEW('ladder') },
  },
  {
    key: 'the-range',
    title: 'The range',
    sub: 'Where price is likely to hold to the close, bent by the walls',
    description: 'From now to the close — the expected move around the pulled centre, a wall inside reach becoming its edge, and what dealers must buy or sell each half hour',
    w: 7,
    h: 5,
    minW: 5,
    minH: 4,
    maxH: 7,
    render: ctx => <RangeWidget ctx={ctx} />,
    skeleton: () => <CorridorInner />,
    page: { path: '/pinpoint/ahead', label: 'Ahead' },
  },
  {
    key: 'where-it-closes',
    title: 'Where it closes',
    sub: 'Where on the price axis the 4:00 print lands',
    description: 'The odds of the close as one silhouette on the price axis, the bands it most often lands inside, the walls and the flip on the same ruler — tightening as the clock runs',
    w: 5,
    h: 4,
    minW: 4,
    minH: 4,
    maxH: 8,
    render: ctx => <CloseWidget ctx={ctx} />,
    skeleton: () => <CloseInner />,
    page: { path: '/pinpoint/ahead', label: 'Ahead' },
  },
  {
    // Key kept from the old Ranked Targets so saved desks upgrade in place —
    // the five-factor composite became the agenda (2026-09-08).
    key: 'ranked-targets',
    title: 'Targets',
    sub: 'Every strike in the order it matters today',
    description: 'The agenda — how likely price gets there × how much happens if it does; named levels, shelves and trapdoors; click a strike to see it on the chart',
    w: 5,
    h: 5,
    minW: 4,
    minH: 3,
    maxH: 9,
    render: ctx => <TargetsWidget ctx={ctx} />,
    skeleton: () => <TargetsWidgetSkeleton />,
    page: { path: '/pinpoint/targets', label: 'Targets' },
  },
  {
    key: 'at-the-wall',
    title: 'At the wall',
    sub: 'Does the wall hold when price gets there, and what follows either way',
    description: 'Model odds for the focus wall (else the nearest): reached by the close, holds if reached, six reasons with their pushes, the two paths on the strike axis',
    w: 7,
    h: 6,
    minW: 5,
    minH: 5,
    maxH: 8,
    render: ctx => <AtTheWallWidget ctx={ctx} />,
    skeleton: () => <AtTheWallInner />,
    page: { path: '/pinpoint/wall', label: 'At the wall' },
  },
  {
    // Key kept from Wall Drift so saved desks upgrade in place — the session
    // timeline became Building's drawing (2026-09-08).
    key: 'wall-drift',
    title: 'Where the walls are heading',
    sub: 'The four levels at the open, now, and by the close at today’s pace',
    description: 'One row per level on the strike axis — where it opened, where it is, where today’s pace sends it by the close, and the strike challenging it',
    w: 6,
    h: 4,
    minW: 4,
    minH: 3,
    maxH: 6,
    render: ctx => <WallsHeadingWidget ctx={ctx} />,
    skeleton: () => <WallHeadingSkeleton headless fill />,
    page: { path: '/pinpoint/building', label: 'Building' },
  },
  {
    key: 'order-flow',
    title: 'Order flow',
    sub: 'Cumulative delta, and delta by price',
    description: 'Cumulative delta & delta by price',
    w: 4,
    h: 5,
    minW: 3,
    minH: 4,
    maxH: 8,
    render: ctx => (
      <div className="h-full min-h-0 p-3">
        <OrderFlowPanel data={ctx.pulse.orderFlow} />
      </div>
    ),
    skeleton: chartSkeleton,
  },
  {
    // Key kept from the old mini-feed so saved desks upgrade in place —
    // the hand-drawn row list became the ACTUAL Compass cards (Noah,
    // 2026-08-17: "actual one of compass not a render").
    key: 'top-setups',
    title: 'Compass setups',
    sub: 'The scan cards, ranked — click one for the full analysis',
    description: 'The actual scan cards, ranked — click any card for the full analysis',
    w: 6,
    h: 5,
    minW: 4,
    minH: 3,
    maxH: 9, // the cards scroll inside
    render: ctx => <CompassSetupsWidget ctx={ctx} />,
    skeleton: chartSkeleton,
    page: { path: '/compass', label: 'Compass' },
  },
  {
    key: 'earnings',
    title: 'Earnings calendar',
    sub: 'The next two weeks of reports and the move the market is charging',
    description: 'The next two weeks of reports with the move the market is charging — click a name for its dossier',
    w: 5,
    h: 4,
    minW: 4,
    minH: 3,
    maxH: 8,
    render: () => <EarningsWidget />,
    skeleton: chartSkeleton,
    page: { path: '/record/earnings', label: 'Earnings' },
  },
  {
    key: 'news',
    title: 'News',
    sub: 'The wire by beat, each headline with the model’s next-session read',
    description: "The wire by beat, each headline with the model's next-session read — click one to open it",
    w: 4,
    h: 5,
    minW: 3,
    minH: 3,
    maxH: 9,
    render: () => <NewsWidget />,
    skeleton: chartSkeleton,
    page: { path: '/record/news', label: 'News' },
  },
  {
    key: 'net-flow',
    title: 'Net flow',
    sub: "Which way the name's money leans, through the session",
    description: "The Net Flow pane on the tile's name — its own candles as the spot line, net call and net put premium as the lines, cut by money and by clock",
    w: 6,
    h: 5,
    minW: 4,
    minH: 4,
    maxH: 8,
    render: ctx => <NetFlowWidget ctx={ctx} />,
    skeleton: chartSkeleton,
    page: { path: '/trace/net-flow', label: 'Net Flow' },
  },
  {
    key: 'dark-pool',
    title: 'Dark pool',
    sub: 'The shelves the off-exchange dollars left, and the posture behind them',
    description: "The name's dark-pool posture, the share of the session that printed off-exchange, the largest cross, and the liquidity shelves — support, resistance, a pivot — with how often price has bounced off each",
    w: 5,
    h: 4,
    minW: 4,
    minH: 3,
    maxH: 7,
    render: ctx => <DarkPoolWidget ctx={ctx} />,
    skeleton: chartSkeleton,
    page: { path: '/trace/dark-pool', label: 'the Dark Pool' },
  },
  {
    key: 'the-tape',
    title: 'The tape',
    sub: "The name's rich prints as they land",
    description: "The Live Tape cut to the tile's name — each print's contract, size at the fill, dollars, the side of the spread it hit, sweeps marked",
    w: 5,
    h: 5,
    minW: 4,
    minH: 3,
    maxH: 9,
    render: ctx => <TapeWidget ctx={ctx} />,
    skeleton: chartSkeleton,
    page: { path: '/trace/live-tape', label: 'the Live Tape' },
  },
];

export const widgetByKey = (key: string): WidgetDef | undefined => WIDGETS.find(w => w.key === key);
