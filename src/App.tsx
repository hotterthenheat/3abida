import { lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigationType, useParams } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { MarketDataProvider } from './context/MarketDataContext';
import { TrackerProvider } from './context/TrackerContext';
import { WatchProvider } from './context/WatchContext';
import { loadShell } from './components/layout/shell';
/* THE LANDING IS THE ONE PAGE IN THE FIRST SCRIPT (2026-10-03): it is the first page a visitor meets, and as a chunk of
   its own (below, every other page is) it was asked for only once this script had run, and then in a chain of small
   requests — half a second on a phone's connection before the hero could be drawn. The terminal's shell went the other
   way (components/layout/shell.ts). */
import Landing from './pages/landing/Landing';
import { LaunchProvider, isTerminalPath } from './components/layout/LaunchTransition';
import { FocusProvider } from './context/FocusContext';
import EmbedBridge from './components/layout/EmbedBridge';
import PageMeta from './components/layout/PageMeta';
import { EMBEDDED } from './embed';
import { FaviconFollowsMark } from './brand/favicon';
import AlertsDoor from './components/alerts/AlertsDoor';

/* THE PAGES OUTSIDE THE TERMINAL STAND ON THE VISITOR'S GROUND FROM THE FIRST PAINT (2026-10-09, the audit's OU-T1), as
   the landing does: index.html sets it before the stylesheet, and the theme's own first word stamps the root with it
   (theme/theme.ts firstGround) — the page's frame (pages/outside/OutsideFrame.tsx) holds it once its code has come, and
   hands the root back on the way into the terminal */

/*
  EVERY PAGE IS ITS OWN CHUNK (2026-09-06, the perf sweep). The app used to
  import all thirty pages at the top, so the first task evaluated every
  chart, table and engine the terminal owns before it could paint anything —
  half a second in one frame. Now a page's code arrives when its route does;
  the shell shows the page's skeleton while it travels (AppShell's Suspense),
  and a page opens on its next frame with its boxes already in place.
*/
/* THE SHELL TOO (2026-10-03): the landing no longer waits for the terminal's rail, palette, alerts and runners —
   components/layout/shell.ts, which the landing and a launch fetch ahead */
const AppShell = lazy(loadShell);
/* the wrong address's pages, likewise only when an address is wrong */
const NotFoundInside = lazy(() => import('./pages/notFound/NotFound').then(m => ({ default: m.NotFoundInside })));
const NotFoundPrompt = lazy(() => import('./pages/notFound/NotFound').then(m => ({ default: m.NotFoundPrompt })));
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

/* THE OLD SECTIONS' ADDRESSES KEEP THEIR PAGE (2026-10-09, the audit's LG-1 and LG-2): /pinpoint-gex/targets went to the
   Map by way of /pinpoint, and /flow-desk/net-flow to the Live Tape — in one hop now, to the page of the same name where
   it lives on, the rest to the section's own front page */
const PINPOINT_PAGES = ['map', 'ahead', 'building', 'wall', 'targets', 'board', 'compare'];
const PINPOINT_ALIASES: Record<string, string> = { 'ranked-targets': 'targets' };
const TRACE_ALIASES: Record<string, string> = { 'flow-alerts': 'watchers', intervals: 'windows', 'dark-feed': 'dark-pool', scanner: 'screener' };
const OldSection = ({ to }: { to: (page: string) => string }) => {
  const params = useParams();
  const { search } = useLocation();
  const page = (params['*'] ?? '').split('/')[0].toLowerCase();
  return <Navigate to={`${to(page)}${search}`} replace />;
};
const oldPinpoint = (page: string) => `/pinpoint/${PINPOINT_ALIASES[page] ?? (PINPOINT_PAGES.includes(page) ? page : 'map')}`;
/* a page Trace never had is still forwarded under /trace, where the in-terminal page says there is nothing there */
const oldTrace = (page: string) => `/trace/${TRACE_ALIASES[page] ?? (page || 'live-tape')}`;

/* A SECTION OR A DOCUMENT THAT DOES NOT EXIST says so (the audit's LG-5): /settings/nope opened Account and /legal/nope
   the Terms, silently — every other wrong address shows "Nothing at this address" */
const SETTINGS_SECTIONS = ['account', 'billing', 'data', 'appearance', 'desk', 'sounds', 'invite', 'mail', 'keyboard', 'about'];
const SettingsAt = () => {
  const { section } = useParams();
  return !section || SETTINGS_SECTIONS.includes(section.toLowerCase()) ? <Settings /> : <NotFoundInside />;
};
const LEGAL_DOCS = ['terms', 'privacy', 'risk', 'refunds', 'data'];
const LegalAt = () => {
  const { doc } = useParams();
  return doc && LEGAL_DOCS.includes(doc.toLowerCase()) ? <Legal /> : <NotFoundPrompt />;
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
const Auth = lazy(() => import('./pages/auth/Auth'));
const Status = lazy(() => import('./pages/outside/Status'));
const About = lazy(() => import('./pages/outside/About'));
const Legal = lazy(() => import('./pages/outside/Legal'));
const Maintenance = lazy(() => import('./pages/outside/Maintenance'));
const Invite = lazy(() => import('./pages/outside/Invite').then(m => ({ default: m.Invite })));
const Welcome = lazy(() => import('./pages/outside/Invite').then(m => ({ default: m.Welcome })));

/* WHERE A PAGE OUTSIDE THE TERMINAL OPENS (2026-10-09, the audit's L-3 and OU-B2): a page reached by a link opens at its
   top — the landing's "Choose Compass", after a Back from the sign-up form, opened /signup scrolled to its foot, the
   heading and the plan above the screen — and one reached by Back or Forward opens where the reader left it, once it has
   laid itself out (the browser put /status back before its words had come, 400 px off). The landing keeps its own way
   with the history (its jumps along the page), and the terminal its own. */
const placeOf = new Map<string, number>();
const outside = (path: string) => path !== '/' && !isTerminalPath(path);
const ScrollPlace = () => {
  const { pathname, hash, key } = useLocation();
  const how = useNavigationType();
  /* where the reader is on each entry of the history, kept as they scroll */
  useEffect(() => {
    let raf = 0;
    const keep = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        placeOf.set(key, window.scrollY);
      });
    };
    window.addEventListener('scroll', keep, { passive: true });
    return () => {
      window.removeEventListener('scroll', keep);
      cancelAnimationFrame(raf);
    };
  }, [key]);
  useLayoutEffect(() => {
    if (!outside(pathname)) return;
    if (how !== 'POP') {
      if (!hash) window.scrollTo(0, 0);
      return;
    }
    const to = placeOf.get(key);
    if (to == null) return;
    /* the page's words may still be on their way (each page is its own chunk): put the reader back once it is tall enough */
    let tries = 0;
    let t = 0;
    const put = () => {
      if (document.documentElement.scrollHeight - window.innerHeight >= to - 1 || ++tries > 40) window.scrollTo(0, to);
      else t = window.setTimeout(put, 25);
    };
    put();
    return () => window.clearTimeout(t);
  }, [pathname, key, how, hash]);
  return null;
};

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
        <ScrollPlace />
        {/* the tab's icon is the mark in its state — still, loading, alert, closed (brand/favicon.ts); not inside the
            landing's window, whose tab is the landing's */}
        {!EMBEDDED && <FaviconFollowsMark />}
        {/* The landing sits outside the shell, so it needs its own boundary —
            a dark screen, never a flash of white, while its chunk travels */}
        <Suspense fallback={<div className="min-h-screen bg-canvas" aria-busy="true" />}>
        <Routes>
          {/* Public landing — full-bleed, outside the app shell. First thing a
              visitor sees; "Launch terminal" plays the gate into /pulse. */}
          {/* …and the landing never loads itself inside its own window */}
          <Route path="/" element={EMBEDDED ? <Navigate to="/pulse" replace /> : <Landing />} />
          {/* THE PAGES OUTSIDE THE TERMINAL (Slayer Logo System, Web and App, 2026-10-01): the account forms, an invite and its
              welcome, status and the changelog, about, the legal pages, maintenance — each on its own frame, no rail */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/i/:code" element={<Invite />} />
          {/* each form is told which it is (the audit's OU-A1: read off the address, /signin/ and /SIGNUP matched no form
              and fell through to "You're in.") */}
          <Route path="/signup" element={<Auth screen="signup" />} />
          <Route path="/signin" element={<Auth screen="signin" />} />
          <Route path="/reset" element={<Auth screen="reset" />} />
          <Route path="/verified" element={<Auth screen="verified" />} />
          <Route path="/expired" element={<Auth screen="expired" />} />
          <Route path="/status" element={<Status />} />
          <Route path="/about" element={<About />} />
          <Route path="/legal" element={<Navigate to="/legal/terms" replace />} />
          <Route path="/legal/:doc" element={<LegalAt />} />
          <Route path="/maintenance" element={<Maintenance />} />
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
            {/* an old stock page keeps its name (the audit's LG-4: it was "Page not found") */}
            <Route path="/stocks/:ticker" element={<Moved to={(p, s) => `/dossier/stocks/${p.ticker}${s}`} />} />
            <Route path="/news" element={<Navigate to="/dossier/news" replace />} />
            <Route path="/newsroom" element={<Navigate to="/dossier/news" replace />} />
            <Route path="/earnings" element={<Navigate to="/dossier/earnings" replace />} />
            <Route path="/earnings/:ticker" element={<EarningsRedirect />} />
            {/* the Watchlist's page (one night, 2026-09-13) lives on the Weigher's desk now */}
            <Route path="/watchlist" element={<Navigate to="/weigher" replace />} />
            <Route path="/tracker" element={<Navigate to="/compass/tracker" replace />} />
            {/* each settings section is its own page (2026-09-12); /settings alone lands on Account (2026-09-14) */}
            <Route path="/settings/:section?" element={<SettingsAt />} />
            <Route path="/pinpoint" element={<PinpointLayout />}>
              {/* THE MAP IS PINPOINT'S FRONT PAGE: /pinpoint opens on it, and so does every retired page's address — the
                  three-tab cut's, the old command desk and flow map (their ledger is the Map's Matrix; they went to Pulse
                  until 2026-10-09, the audit's LG-3 and LG-7) and the pages listed below. Ranked targets is Targets. */}
              <Route index element={<Navigate to="/pinpoint/map" replace />} />
              <Route path="command" element={<Navigate to="/pinpoint/map" replace />} />
              <Route path="flow-map" element={<Navigate to="/pinpoint/map" replace />} />
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
            <Route path="/liquidity" element={<Navigate to="/trace/live-tape" replace />} />
            {/* Legacy section paths from before the rebrand, page for page */}
            <Route path="/flow-desk/*" element={<OldSection to={oldTrace} />} />
            <Route path="/pinpoint-gex/*" element={<OldSection to={oldPinpoint} />} />
            <Route path="/community" element={<Room />} />
            {/* Alerts are a drawer, not a page: their address opens it over Pulse (components/alerts/AlertsDoor.tsx) */}
            <Route path="/alerts" element={<AlertsDoor />} />
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
