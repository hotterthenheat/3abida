import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { MarketDataProvider } from './context/MarketDataContext';
import { TrackerProvider } from './context/TrackerContext';
import { WatchProvider } from './context/WatchContext';
import AppShell from './components/layout/AppShell';
import { LaunchProvider } from './components/layout/LaunchTransition';
import { FocusProvider } from './context/FocusContext';
import EmbedBridge from './components/layout/EmbedBridge';
import PageMeta from './components/layout/PageMeta';
import { NotFoundInside, NotFoundPrompt } from './pages/notFound/NotFound';
import { EMBEDDED } from './embed';

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
/* The News Room is gone (2026-09-09, archived in docs/news-page-reference.md) — the page starts again under the Record */
const News = lazy(() => import('./pages/record/News'));
/* Earnings walked under the Record (2026-09-09): the calendar and a name's page */
const Earnings = lazy(() => import('./pages/record/Earnings'));
const EarningsName = lazy(() => import('./pages/record/EarningsName'));
const StockName = lazy(() => import('./pages/record/StockName'));
const RecordLayout = lazy(() => import('./pages/record/RecordLayout'));
/* PRACTICE (2026-09-26): ONE section for trading with pretend money — Paper (today's prices: pages/paper), Backtest (a
   replayed market: pages/review) and ONE Journal for both (docs/paper-rules.md, docs/review-backtest-rules.md) */
const PracticeLayout = lazy(() => import('./pages/practice/PracticeLayout'));
const PaperDesk = lazy(() => import('./pages/paper/Desk'));
const ReviewSessions = lazy(() => import('./pages/review/Sessions'));
const ReviewDesk = lazy(() => import('./pages/review/Desk'));
const ReviewReport = lazy(() => import('./pages/review/Report'));
const PracticeJournal = lazy(() => import('./pages/practice/Journal'));
const PracticeJournalTrade = lazy(() => import('./pages/practice/JournalTrade'));

/** An address that moved: its parts and its search carried to the new one (the old Paper and Review addresses, 2026-09-26) */
const Moved = ({ to }: { to: (params: Record<string, string | undefined>, search: string) => string }) => {
  const params = useParams();
  const { search } = useLocation();
  return <Navigate to={to(params, search)} replace />;
};
/** A Review journal address opens the backtest's book */
const withBook = (search: string): string => {
  const q = new URLSearchParams(search);
  q.set('book', 'backtest');
  return `?${q.toString()}`;
};
const Insiders = lazy(() => import('./pages/record/Insiders'));
const Congress = lazy(() => import('./pages/record/Congress'));

/** An old earnings link keeps its name on the way to the Dossier */
const EarningsRedirect = () => {
  const { ticker } = useParams();
  return <Navigate to={ticker ? `/dossier/earnings/${ticker}` : '/dossier/earnings'} replace />;
};
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
/* Two names side by side on the Trace (2026-09-13) */
const TraceCompare = lazy(() => import('./pages/trace/Compare'));
/* The dark pool, back as its own page (2026-09-13) */
const DarkPool = lazy(() => import('./pages/trace/DarkPool'));
const Footprints = lazy(() => import('./pages/trace/Footprints'));
const Watchers = lazy(() => import('./pages/trace/Watchers'));
const TradeWindows = lazy(() => import('./pages/trace/Windows'));
const Odte = lazy(() => import('./pages/trace/Odte'));
const MultiLeg = lazy(() => import('./pages/trace/MultiLeg'));
const FlowTracker = lazy(() => import('./pages/trace/FlowTracker'));
/* THE ROOM (2026-09-13): Community is one room now — the ideas, requests and feedback
   pages are gone; it opens after launch, behind the glass */
const Room = lazy(() => import('./pages/community/Room'));

const App = () => {
  return (
    <MotionConfig reducedMotion="user">
      <MarketDataProvider>
        <FocusProvider>
        <TrackerProvider>
        <WatchProvider>
        <LaunchProvider>
        {/* the terminal in the landing's window takes its orders here (embed.ts); nothing outside one */}
        <EmbedBridge />
        {/* every page's own tab title and description (2026-09-19) */}
        <PageMeta />
        {/* The landing sits outside the shell, so it needs its own boundary —
            a dark screen, never a flash of white, while its chunk travels */}
        <Suspense fallback={<div className="min-h-screen bg-canvas" aria-busy="true" />}>
        <Routes>
          {/* Public landing — full-bleed, outside the app shell. First thing a
              visitor sees; "Launch terminal" plays the gate into /pulse. */}
          {/* …and the landing never loads itself inside its own window */}
          <Route path="/" element={EMBEDDED ? <Navigate to="/pulse" replace /> : <Landing />} />
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
              {/* THE TRACKER rides under Compass as its second page, the way the partner laid it out (Noah, 2026-09-13) */}
              <Route path="tracker" element={<Tracker embedded />} />
              {/* A setup's address: TICKER-strike-R-kind-tenor (data/compass.ts setupIdOf) */}
              <Route path=":id" element={<CompassSetup />} />
            </Route>
            <Route path="/weigher" element={<Weigher />} />
            <Route path="/skys-vision" element={<Navigate to="/compass" replace />} />
            {/* THE RECORD (2026-09-09): what is on the record about a name — News
                and Earnings moved under it, Insiders and Congress new, Stocks
                joined 2026-09-10. The old top-level paths follow. */}
            {/* REVIEW (2026-09-20): a backtest's sessions, a session's desk and its report, and the journal */}
            {/* PRACTICE (2026-09-26): Paper · Backtest · Journal under one head — pages/practice/PracticeLayout.tsx */}
            <Route path="/practice" element={<PracticeLayout />}>
              <Route index element={<Navigate to="/practice/paper" replace />} />
              <Route path="paper" element={<PaperDesk />} />
              <Route path="backtest" element={<ReviewSessions />} />
              <Route path="backtest/:id" element={<ReviewDesk />} />
              <Route path="backtest/:id/report" element={<ReviewReport />} />
              {/* ONE JOURNAL, TWO BOOKS: ?book=backtest reads the backtest's; a closed trade's own page under it — ← and → walk
                  the journal's cut, which rides the address */}
              <Route path="journal" element={<PracticeJournal />} />
              <Route path="journal/:sessionId/:tradeId" element={<PracticeJournalTrade />} />
            </Route>
            {/* THE OLD ADDRESSES — Paper's and Review's, until 2026-09-26 — land where their pages went */}
            <Route path="/paper" element={<Navigate to="/practice/paper" replace />} />
            <Route path="/paper/live-chart" element={<Navigate to="/practice/paper" replace />} />
            <Route path="/paper/desk" element={<Navigate to="/practice/paper" replace />} />
            <Route path="/paper/evaluation" element={<Navigate to="/practice/paper" replace />} />
            <Route path="/paper/journal" element={<Moved to={(_, s) => `/practice/journal${s}`} />} />
            <Route path="/paper/journal/:sessionId/:tradeId" element={<Moved to={(p, s) => `/practice/journal/${p.sessionId}/${p.tradeId}${s}`} />} />
            <Route path="/review" element={<Navigate to="/practice/backtest" replace />} />
            <Route path="/review/backtest" element={<Navigate to="/practice/backtest" replace />} />
            <Route path="/review/futures" element={<Navigate to="/practice/backtest" replace />} />
            <Route path="/review/backtest/:id" element={<Moved to={p => `/practice/backtest/${p.id}`} />} />
            <Route path="/review/backtest/:id/report" element={<Moved to={p => `/practice/backtest/${p.id}/report`} />} />
            <Route path="/review/journal" element={<Moved to={(_, s) => `/practice/journal${withBook(s)}`} />} />
            <Route path="/review/journal/:sessionId/:tradeId" element={<Moved to={(p, s) => `/practice/journal/${p.sessionId}/${p.tradeId}${withBook(s)}`} />} />
            {/* THE DOSSIER (2026-09-28, Noah: "dossier it is, rename it" — the Record's new name; the folders keep the old
                one): the old address walks to the new, page for page */}
            <Route path="/record" element={<Navigate to="/dossier/news" replace />} />
            <Route path="/record/*" element={<Moved to={(p, s) => `/dossier/${p['*'] ?? ''}${s}`} />} />
            <Route path="/dossier" element={<RecordLayout />}>
              <Route index element={<Navigate to="/dossier/news" replace />} />
              <Route path="news" element={<News />} />
              <Route path="earnings" element={<Earnings />} />
              <Route path="earnings/:ticker" element={<EarningsName />} />
              <Route path="insiders" element={<Insiders />} />
              <Route path="congress" element={<Congress />} />
              <Route path="stocks" element={<Stocks />} />
              <Route path="stocks/:ticker" element={<StockName />} />
            </Route>
            <Route path="/stocks" element={<Navigate to="/dossier/stocks" replace />} />
            <Route path="/news" element={<Navigate to="/dossier/news" replace />} />
            <Route path="/newsroom" element={<Navigate to="/dossier/news" replace />} />
            <Route path="/earnings" element={<Navigate to="/dossier/earnings" replace />} />
            <Route path="/earnings/:ticker" element={<EarningsRedirect />} />
            {/* the Watchlist's page (one night, 2026-09-13) lives on the Weigher's desk now */}
            <Route path="/watchlist" element={<Navigate to="/weigher" replace />} />
            <Route path="/tracker" element={<Navigate to="/compass/tracker" replace />} />
            {/* each settings section is its own page (2026-09-12); /settings alone lands on Account (2026-09-14) */}
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
              {/* "Windows" again since 2026-09-30, when the earlier line's Trace was brought back whole ("take my entire trace
                  from the repo i prefer mines more"); it was "Intervals" from 2026-09-19, and that address follows it */}
              <Route path="windows" element={<TradeWindows />} />
              <Route path="intervals" element={<Navigate to="/trace/windows" replace />} />
              <Route path="odte" element={<Odte />} />
              <Route path="multi-leg" element={<MultiLeg />} />
              <Route path="compare" element={<TraceCompare />} />
              {/* The dark pool is a page again (2026-09-13) — the tape's rail keeps the crosses too */}
              <Route path="dark-pool" element={<DarkPool />} />
              <Route path="dark-feed" element={<Navigate to="/trace/dark-pool" replace />} />
              {/* The old scanner scaffold's slot — its promise became the screener */}
              <Route path="scanner" element={<Navigate to="/trace/screener" replace />} />
              <Route path="tracker" element={<FlowTracker />} />
            </Route>
            <Route path="/liquidity" element={<Navigate to="/trace" replace />} />
            {/* Legacy section paths from before the rebrand */}
            <Route path="/flow-desk/*" element={<Navigate to="/trace" replace />} />
            <Route path="/pinpoint-gex/*" element={<Navigate to="/pinpoint" replace />} />
            <Route path="/community" element={<Room />} />
            {/* The old tabs' paths land on the room */}
            <Route path="/community/*" element={<Navigate to="/community" replace />} />
            <Route path="/auditor-log" element={<Navigate to="/compass/tracker" replace />} />
            {/* NOTHING AT THIS ADDRESS, INSIDE THE TERMINAL (2026-09-19): a wrong address UNDER a product keeps the rail and the
                footer — the reader is a click from where they meant to be. A real page always outranks a splat, so these
                catch only what nothing else did. (/compass/<one part> is a setup's own address and answers for itself;
                /community/* already lands on the room.) */}
            {['/pulse/*', '/terrain/*', '/weigher/*', '/compass/*', '/pinpoint/*', '/trace/*', '/dossier/*', '/practice/*', '/settings/*'].map(p => (
              <Route key={p} path={p} element={<NotFoundInside />} />
            ))}
          </Route>
          {/* …and under nothing we have (/pricing, /login — typed by hand from a post): the house's prompt, full screen */}
          <Route path="*" element={<NotFoundPrompt />} />
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
