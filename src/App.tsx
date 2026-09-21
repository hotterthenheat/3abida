import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { MarketDataProvider } from './context/MarketDataContext';
import AppBoundary from './components/layout/AppBoundary';
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
/* THE PAPER DESK (2026-09-19): the chart as the order ticket, on paper — its own tab under the Weigher */
const Paper = lazy(() => import('./pages/paper/Paper'));
const PaperJournal = lazy(() => import('./pages/paper/Journal'));
const PaperRisk = lazy(() => import('./pages/paper/Risk'));
const Watchlist = lazy(() => import('./pages/watchlist/Watchlist'));
const Alerts = lazy(() => import('./pages/alerts/Alerts'));
const NotFound = lazy(() => import('./pages/NotFound'));
/* Stocks walked into the Record (2026-09-10): the screens beside the name's news and filings */
const Stocks = lazy(() => import('./pages/record/Stocks'));
/* A name's own page under Stocks (2026-09-13): the whole read, not a jump to the Map */
const StockOverview = lazy(() => import('./pages/record/StockOverview'));
/* The News Room is gone (2026-09-09, archived in docs/news-page-reference.md) — the page starts again under the Record */
const News = lazy(() => import('./pages/record/News'));
/* Earnings walked under the Record (2026-09-09): the calendar and a name's page */
const Earnings = lazy(() => import('./pages/record/Earnings'));
const Catalysts = lazy(() => import('./pages/record/Catalysts'));
const EarningsName = lazy(() => import('./pages/record/EarningsName'));
const RecordLayout = lazy(() => import('./pages/record/RecordLayout'));
const Insiders = lazy(() => import('./pages/record/Insiders'));
const Congress = lazy(() => import('./pages/record/Congress'));

/* A REDIRECT THAT DROPS THE QUERY BREAKS EVERY LINK INTO THE PAGE. React
   Router's <Navigate to="/path"> keeps the path and throws the search and
   the hash away — harmless while a page's state lived in localStorage, and
   silently destructive the moment a cut, a screen or a filter lives in the
   address. /trace/tape?order=premium&kind=sweep landed on /trace/live-tape
   with a bare URL and the reader's own default tape, and nothing said so.
   Every hop below goes through Keep, which carries them. */
const Keep = ({ to }: { to: string }) => {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
};

/** An old dossier link keeps its name on the way to the Record */
const EarningsRedirect = () => {
  const { ticker } = useParams();
  return <Keep to={ticker ? `/record/earnings/${ticker}` : '/record/earnings'} />;
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
        {/* THE LANDING SITS OUTSIDE THE SHELL, so it needs its own boundary —
            and for a long time this comment said that above a <Suspense>,
            which catches a slow chunk and not a fault. AppBoundary is the
            error net; the Suspense below is still the dark screen that holds
            while the chunk travels. */}
        <AppBoundary>
        <Suspense fallback={<div className="min-h-screen bg-canvas" aria-busy="true" />}>
        <Routes>
          {/* Public landing — full-bleed, outside the app shell. First thing a
              visitor sees; "Launch terminal" plays the gate into /pulse. */}
          <Route path="/" element={<Landing />} />
          <Route path="/welcome" element={<Keep to="/" />} />
          <Route element={<AppShell />}>
            <Route path="/home" element={<Keep to="/pulse" />} />
            <Route path="/pulse" element={<Pulse />} />
            <Route path="/pulse/board" element={<PulseBoard />} />
            <Route path="/terrain" element={<Terrain />} />
            <Route path="/live-terminal" element={<Keep to="/pulse" />} />
            {/* Workspace merged INTO Pulse (2026-08-17) — old links land there */}
            <Route path="/workspace" element={<Keep to="/pulse" />} />
            <Route path="/compass" element={<CompassLayout />}>
              <Route index element={<CompassBoard />} />
              {/* THE OPTIONS TRACKER sits under Compass the way Trace's tracker sits under Trace (Noah, 2026-09-13) */}
              <Route path="tracker" element={<Tracker embedded />} />
              {/* A setup's address: TICKER-strike-R-kind-tenor (data/compass.ts setupIdOf) */}
              <Route path=":id" element={<CompassSetup />} />
            </Route>
            <Route path="/weigher" element={<Weigher />} />
            {/* WATCHLISTS (2026-09-21): the names a reader carries. The terminal
                had a four-name constant in the simulator and no way to edit it. */}
            <Route path="/watchlist" element={<Watchlist />} />
            {/* THE ALERTS DESK (2026-09-21): the bell is for glancing, this is
                for managing — set, alerted, and the record of both */}
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/watchlists" element={<Keep to="/watchlist" />} />
            <Route path="/paper" element={<Paper />} />
            <Route path="/paper/journal" element={<PaperJournal />} />
            {/* THE RISK DESK (2026-09-21): what the open book is exposed to — the
                question the desk and the journal both leave unanswered */}
            <Route path="/paper/risk" element={<PaperRisk />} />
            <Route path="/skys-vision" element={<Keep to="/compass" />} />
            {/* THE RECORD (2026-09-09): what is on the record about a name — News
                and Earnings moved under it, Insiders and Congress new, Stocks
                joined 2026-09-10. The old top-level paths follow. */}
            <Route path="/record" element={<RecordLayout />}>
              <Route index element={<Keep to="/record/news" />} />
              <Route path="news" element={<News />} />
              <Route path="earnings" element={<Earnings />} />
              <Route path="earnings/:ticker" element={<EarningsName />} />
              <Route path="insiders" element={<Insiders />} />
              <Route path="congress" element={<Congress />} />
              <Route path="stocks" element={<Stocks />} />
              <Route path="stocks/:ticker" element={<StockOverview />} />
              <Route path="calendar" element={<Catalysts />} />
              <Route path="*" element={<Keep to="/record/news" />} />
            </Route>
            <Route path="/stocks" element={<Keep to="/record/stocks" />} />
            <Route path="/news" element={<Keep to="/record/news" />} />
            <Route path="/newsroom" element={<Keep to="/record/news" />} />
            <Route path="/earnings" element={<Keep to="/record/earnings" />} />
            <Route path="/earnings/:ticker" element={<EarningsRedirect />} />
            <Route path="/prove-it" element={<ProveIt />} />
            <Route path="/tracker" element={<Keep to="/compass/tracker" />} />
            {/* each settings section is its own page (2026-09-12); /settings alone lands on Appearance */}
            <Route path="/settings/:section?" element={<Settings />} />
            <Route path="/pinpoint" element={<PinpointLayout />}>
              {/* THE BLANK CANVAS (Noah, 2026-09-05): Pinpoint restarts from
                  scratch. Targets is the one page that survived his review;
                  every other path — the three-tab cut's included — lands on it
                  until the new desk exists. The Strike Pressure Ladder and the
                  Exposure Ledger live on as Pulse widgets meanwhile. */}
              <Route index element={<Keep to="/pinpoint/map" />} />
              <Route path="command" element={<Keep to="/pulse" />} />
              <Route path="flow-map" element={<Keep to="/pulse" />} />
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
              <Route path="ranked-targets" element={<Keep to="/pinpoint/targets" />} />
              <Route path="*" element={<Keep to="/pinpoint/map" />} />
              {['exposure-profile', 'session', 'history', 'oi-heat', 'strike-profile', 'vanna-charm', 'expiry-ladder', 'greek-surfaces', 'pain-map', 'model-error', 'vol-lab'].map(p => (
                <Route key={p} path={p} element={<Keep to="/pinpoint/map" />} />
              ))}
            </Route>
            <Route path="/trace" element={<TraceLayout />}>
              <Route index element={<Keep to="/trace/live-tape" />} />
              <Route path="live-tape" element={<LiveTape />} />
              <Route path="screener" element={<OptionsScreener />} />
              <Route path="net-flow" element={<NetFlow />} />
              <Route path="footprints" element={<Footprints />} />
              <Route path="watchers" element={<Watchers />} />
              {/* "Flow Alerts" until 2026-09-11 — the bell is the reader's alerts; these are the desk's watchers */}
              <Route path="flow-alerts" element={<Keep to="/trace/watchers" />} />
              <Route path="windows" element={<TradeWindows />} />
              <Route path="odte" element={<Odte />} />
              <Route path="multi-leg" element={<MultiLeg />} />
              {/* Its own page since 2026-09-12 — the old feed path follows it */}
              <Route path="dark-pool" element={<DarkPool />} />
              <Route path="dark-feed" element={<Keep to="/trace/dark-pool" />} />
              {/* The old scanner scaffold's slot — its promise became the screener */}
              <Route path="scanner" element={<Keep to="/trace/screener" />} />
              {/* Two names on everything Trace knows (2026-09-12) */}
              <Route path="compare" element={<TraceCompare />} />
              <Route path="tracker" element={<FlowTracker />} />
              <Route path="*" element={<Keep to="/trace/live-tape" />} />
            </Route>
            <Route path="/liquidity" element={<Keep to="/trace" />} />
            {/* Legacy section paths from before the rebrand */}
            <Route path="/flow-desk/*" element={<Keep to="/trace" />} />
            <Route path="/pinpoint-gex/*" element={<Keep to="/pinpoint" />} />
            <Route path="/community" element={<CommunityLayout />}>
              <Route index element={<Room />} />
              <Route path="me" element={<Profile />} />
              <Route path="u/:handle" element={<Profile />} />
              <Route path="t/:ticker" element={<TickerRoom />} />
              {/* the old subpages: the room, or the feedback page */}
              <Route path="ideas" element={<Keep to="/community" />} />
              <Route path="requests" element={<Keep to="/feedback" />} />
              <Route path="feedback" element={<Keep to="/feedback" />} />
              <Route path="*" element={<Keep to="/community" />} />
            </Route>
            {/* FEEDBACK AND BUGS, its own page (2026-09-13) */}
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/auditor-log" element={<Keep to="/tracker" />} />
            {/* NOTHING MATCHED (2026-09-13). Without this React Router renders
                an empty element tree — not a 404 page, not the shell, a blank
                screen with no way back but the URL bar. Found on /typo, and on
                a bad child of every section that is a leaf route (/pulse/x).
                Each section above catches its own so a near-miss lands on the
                desk you were aiming at; this is the last resort. */}
            {/* A PATH THAT DOES NOT EXIST SAYS SO. This used to be a
                `Keep to="/pulse"`, which turned every typo into a different
                page: `/paper/jurnal` showed the market dashboard as though
                that were what had been asked for, and rewrote the address
                bar so the reader could not even see what they had typed.
                The redirects that MEAN something — a bare /record opening
                the news, the thirty-odd old addresses above — are answers;
                "I do not know what that is" is also an answer. */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </Suspense>
        </AppBoundary>
        </LaunchProvider>
        </WatchProvider>
        </TrackerProvider>
        </FocusProvider>
      </MarketDataProvider>
    </MotionConfig>
  );
};

export default App;
