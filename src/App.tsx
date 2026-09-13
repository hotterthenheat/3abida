import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { MarketDataProvider } from './context/MarketDataContext';
import { TrackerProvider } from './context/TrackerContext';
import { WatchProvider } from './context/WatchContext';
import AppShell from './components/layout/AppShell';
import { LaunchProvider } from './components/layout/LaunchTransition';
import { FocusProvider } from './context/FocusContext';

/*
  EVERY PAGE IS ITS OWN CHUNK (2026-09-06, the perf sweep). The app used to
  import all thirty pages at the top, so the first task evaluated every
  chart, table and engine the terminal owns before it could paint anything —
  half a second in one frame. Now a page's code arrives when its route does;
  the shell shows the page's skeleton while it travels (AppShell's Suspense),
  and a page opens on its next frame with its boxes already in place.
*/
const Landing = lazy(() => import('./pages/landing/Landing'));
const Pulse = lazy(() => import('./pages/workspace/Pulse'));
const PulseBoard = lazy(() => import('./pages/PulseBoard'));
const Terrain = lazy(() => import('./pages/terrain/Terrain'));
/* Compass walked (2026-09-11): one shell over the board and a setup's own page */
const CompassLayout = lazy(() => import('./pages/compass/CompassLayout'));
const CompassBoard = lazy(() => import('./pages/compass/Board'));
const CompassSetup = lazy(() => import('./pages/compass/SetupPage'));
const Weigher = lazy(() => import('./pages/Weigher'));
/* Stocks walked into the Record (2026-09-10): the screens beside the name's news and filings */
const Stocks = lazy(() => import('./pages/record/Stocks'));
/* A name's own page under Stocks (2026-09-13): the whole read, not a jump to the Map */
const StockOverview = lazy(() => import('./pages/record/StockOverview'));
/* The News Room is gone (2026-09-09, archived in docs/news-page-reference.md) — the page starts again under the Record */
const News = lazy(() => import('./pages/record/News'));
/* Earnings walked under the Record (2026-09-09): the calendar and a name's page */
const Earnings = lazy(() => import('./pages/record/Earnings'));
const EarningsName = lazy(() => import('./pages/record/EarningsName'));
const RecordLayout = lazy(() => import('./pages/record/RecordLayout'));
const Insiders = lazy(() => import('./pages/record/Insiders'));
const Congress = lazy(() => import('./pages/record/Congress'));

/** An old dossier link keeps its name on the way to the Record */
const EarningsRedirect = () => {
  const { ticker } = useParams();
  return <Navigate to={ticker ? `/record/earnings/${ticker}` : '/record/earnings'} replace />;
};
const ProveIt = lazy(() => import('./pages/proveit/ProveIt'));
const Tracker = lazy(() => import('./pages/Tracker'));
/* THE SETTINGS (2026-09-12): the theme first, the rest of the desk's preferences behind it */
const Settings = lazy(() => import('./pages/settings/Settings'));
const PinpointLayout = lazy(() => import('./pages/pinpoint/PinpointLayout'));
const MapDesk = lazy(() => import('./pages/pinpoint/MapDesk'));
const Ahead = lazy(() => import('./pages/pinpoint/Ahead'));
const Building = lazy(() => import('./pages/pinpoint/Building'));
const AtTheWall = lazy(() => import('./pages/pinpoint/AtTheWall'));
const RankedTargets = lazy(() => import('./pages/pinpoint/RankedTargets'));
const Board = lazy(() => import('./pages/pinpoint/Board'));
const Compare = lazy(() => import('./pages/pinpoint/Compare'));
const TraceLayout = lazy(() => import('./pages/trace/TraceLayout'));
const LiveTape = lazy(() => import('./pages/trace/LiveTape'));
const OptionsScreener = lazy(() => import('./pages/trace/OptionsScreener'));
const NetFlow = lazy(() => import('./pages/trace/NetFlow'));
const Footprints = lazy(() => import('./pages/trace/Footprints'));
const Watchers = lazy(() => import('./pages/trace/Watchers'));
const TradeWindows = lazy(() => import('./pages/trace/Windows'));
const Odte = lazy(() => import('./pages/trace/Odte'));
const MultiLeg = lazy(() => import('./pages/trace/MultiLeg'));
const FlowTracker = lazy(() => import('./pages/trace/FlowTracker'));
const DarkPool = lazy(() => import('./pages/trace/DarkPool'));
const TraceCompare = lazy(() => import('./pages/trace/Compare'));
/* THE COMMUNITY IS ONE ROOM (2026-09-13): the room, a profile, a name's page;
   the requests and the feedback moved to their own page at /feedback */
const CommunityLayout = lazy(() => import('./pages/community/CommunityLayout'));
const Room = lazy(() => import('./pages/community/Room'));
const Profile = lazy(() => import('./pages/community/Profile'));
const TickerRoom = lazy(() => import('./pages/community/TickerRoom'));
const Feedback = lazy(() => import('./pages/Feedback'));

const App = () => {
  return (
    <MotionConfig reducedMotion="user">
      <MarketDataProvider>
        <FocusProvider>
        <TrackerProvider>
        <WatchProvider>
        <LaunchProvider>
        {/* The landing sits outside the shell, so it needs its own boundary —
            a dark screen, never a flash of white, while its chunk travels */}
        <Suspense fallback={<div className="min-h-screen bg-canvas" aria-busy="true" />}>
        <Routes>
          {/* Public landing — full-bleed, outside the app shell. First thing a
              visitor sees; "Launch terminal" plays the gate into /pulse. */}
          <Route path="/" element={<Landing />} />
          <Route path="/welcome" element={<Navigate to="/" replace />} />
          <Route element={<AppShell />}>
            <Route path="/home" element={<Navigate to="/pulse" replace />} />
            <Route path="/pulse" element={<Pulse />} />
            <Route path="/pulse/board" element={<PulseBoard />} />
            <Route path="/terrain" element={<Terrain />} />
            <Route path="/live-terminal" element={<Navigate to="/pulse" replace />} />
            {/* Workspace merged INTO Pulse (2026-08-17) — old links land there */}
            <Route path="/workspace" element={<Navigate to="/pulse" replace />} />
            <Route path="/compass" element={<CompassLayout />}>
              <Route index element={<CompassBoard />} />
              {/* THE OPTIONS TRACKER sits under Compass the way Trace's tracker sits under Trace (Noah, 2026-09-13) */}
              <Route path="tracker" element={<Tracker embedded />} />
              {/* A setup's address: TICKER-strike-R-kind-tenor (data/compass.ts setupIdOf) */}
              <Route path=":id" element={<CompassSetup />} />
            </Route>
            <Route path="/weigher" element={<Weigher />} />
            <Route path="/skys-vision" element={<Navigate to="/compass" replace />} />
            {/* THE RECORD (2026-09-09): what is on the record about a name — News
                and Earnings moved under it, Insiders and Congress new, Stocks
                joined 2026-09-10. The old top-level paths follow. */}
            <Route path="/record" element={<RecordLayout />}>
              <Route index element={<Navigate to="/record/news" replace />} />
              <Route path="news" element={<News />} />
              <Route path="earnings" element={<Earnings />} />
              <Route path="earnings/:ticker" element={<EarningsName />} />
              <Route path="insiders" element={<Insiders />} />
              <Route path="congress" element={<Congress />} />
              <Route path="stocks" element={<Stocks />} />
              <Route path="stocks/:ticker" element={<StockOverview />} />
              <Route path="*" element={<Navigate to="/record/news" replace />} />
            </Route>
            <Route path="/stocks" element={<Navigate to="/record/stocks" replace />} />
            <Route path="/news" element={<Navigate to="/record/news" replace />} />
            <Route path="/newsroom" element={<Navigate to="/record/news" replace />} />
            <Route path="/earnings" element={<Navigate to="/record/earnings" replace />} />
            <Route path="/earnings/:ticker" element={<EarningsRedirect />} />
            <Route path="/prove-it" element={<ProveIt />} />
            <Route path="/tracker" element={<Navigate to="/compass/tracker" replace />} />
            {/* each settings section is its own page (2026-09-12); /settings alone lands on Appearance */}
            <Route path="/settings/:section?" element={<Settings />} />
            <Route path="/pinpoint" element={<PinpointLayout />}>
              {/* THE BLANK CANVAS (Noah, 2026-09-05): Pinpoint restarts from
                  scratch. Targets is the one page that survived his review;
                  every other path — the three-tab cut's included — lands on it
                  until the new desk exists. The Strike Pressure Ladder and the
                  Exposure Ledger live on as Pulse widgets meanwhile. */}
              <Route index element={<Navigate to="/pinpoint/map" replace />} />
              <Route path="command" element={<Navigate to="/pulse" replace />} />
              <Route path="flow-map" element={<Navigate to="/pulse" replace />} />
              {/* THE MAP — band 2 of the roadmap, the first thing built on the canvas */}
              <Route path="map" element={<MapDesk />} />
              {/* AHEAD — from now to the bell (2026-09-06) */}
              <Route path="ahead" element={<Ahead />} />
              {/* BUILDING — what today added, strike by strike (2026-09-07) */}
              <Route path="building" element={<Building />} />
              {/* AT THE WALL — does it hold or break, and what happens either way (2026-09-08) */}
              <Route path="wall" element={<AtTheWall />} />
              <Route path="targets" element={<RankedTargets />} />
              <Route path="board" element={<Board />} />
              {/* COMPARE — two names side by side (2026-09-08) */}
              <Route path="compare" element={<Compare />} />
              <Route path="ranked-targets" element={<Navigate to="/pinpoint/targets" replace />} />
              <Route path="*" element={<Navigate to="/pinpoint/map" replace />} />
              {['exposure-profile', 'session', 'history', 'oi-heat', 'strike-profile', 'vanna-charm', 'expiry-ladder', 'greek-surfaces', 'pain-map', 'model-error', 'vol-lab'].map(p => (
                <Route key={p} path={p} element={<Navigate to="/pinpoint/map" replace />} />
              ))}
            </Route>
            <Route path="/trace" element={<TraceLayout />}>
              <Route index element={<Navigate to="/trace/live-tape" replace />} />
              <Route path="live-tape" element={<LiveTape />} />
              <Route path="screener" element={<OptionsScreener />} />
              <Route path="net-flow" element={<NetFlow />} />
              <Route path="footprints" element={<Footprints />} />
              <Route path="watchers" element={<Watchers />} />
              {/* "Flow Alerts" until 2026-09-11 — the bell is the reader's alerts; these are the desk's watchers */}
              <Route path="flow-alerts" element={<Navigate to="/trace/watchers" replace />} />
              <Route path="windows" element={<TradeWindows />} />
              <Route path="odte" element={<Odte />} />
              <Route path="multi-leg" element={<MultiLeg />} />
              {/* Its own page since 2026-09-12 — the old feed path follows it */}
              <Route path="dark-pool" element={<DarkPool />} />
              <Route path="dark-feed" element={<Navigate to="/trace/dark-pool" replace />} />
              {/* The old scanner scaffold's slot — its promise became the screener */}
              <Route path="scanner" element={<Navigate to="/trace/screener" replace />} />
              {/* Two names on everything Trace knows (2026-09-12) */}
              <Route path="compare" element={<TraceCompare />} />
              <Route path="tracker" element={<FlowTracker />} />
              <Route path="*" element={<Navigate to="/trace/live-tape" replace />} />
            </Route>
            <Route path="/liquidity" element={<Navigate to="/trace" replace />} />
            {/* Legacy section paths from before the rebrand */}
            <Route path="/flow-desk/*" element={<Navigate to="/trace" replace />} />
            <Route path="/pinpoint-gex/*" element={<Navigate to="/pinpoint" replace />} />
            <Route path="/community" element={<CommunityLayout />}>
              <Route index element={<Room />} />
              <Route path="me" element={<Profile />} />
              <Route path="u/:handle" element={<Profile />} />
              <Route path="t/:ticker" element={<TickerRoom />} />
              {/* the old subpages: the room, or the feedback page */}
              <Route path="ideas" element={<Navigate to="/community" replace />} />
              <Route path="requests" element={<Navigate to="/feedback" replace />} />
              <Route path="feedback" element={<Navigate to="/feedback" replace />} />
              <Route path="*" element={<Navigate to="/community" replace />} />
            </Route>
            {/* FEEDBACK AND BUGS, its own page (2026-09-13) */}
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/auditor-log" element={<Navigate to="/tracker" replace />} />
            {/* NOTHING MATCHED (2026-09-13). Without this React Router renders
                an empty element tree — not a 404 page, not the shell, a blank
                screen with no way back but the URL bar. Found on /typo, and on
                a bad child of every section that is a leaf route (/pulse/x).
                Each section above catches its own so a near-miss lands on the
                desk you were aiming at; this is the last resort. */}
            <Route path="*" element={<Navigate to="/pulse" replace />} />
          </Route>
        </Routes>
        </Suspense>
        </LaunchProvider>
        </WatchProvider>
        </TrackerProvider>
        </FocusProvider>
      </MarketDataProvider>
    </MotionConfig>
  );
};

export default App;
