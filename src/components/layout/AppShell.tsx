import { Component, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import SideNav from './SideNav';
import CommandPalette from './CommandPalette';
import SiteFooter from './SiteFooter';
import RouteSkeleton from '../ui/RouteSkeleton';
import EditorDockGate from '../scripts/EditorDockGate';
import AlertsDrawer from '../alerts/AlertsDrawer';
import AlertWatcher from '../alerts/AlertWatcher';
import AlertToasts from '../alerts/AlertToasts';
import PaperRunner from '../paper/PaperRunner';
import ScrollHome from './ScrollHome';
import WayBack from './WayBack';
import { OPEN_PALETTE_EVENT } from './paletteDoor';
import { FaultView, isLoadFault, reloadOnceForStaleBuild } from '../ui/Fault';
import MarkLoad from '../../brand/MarkLoad';
import MarketBell from './MarketBell';
import InstallPrompt from './InstallPrompt';
import SkipLink, { CONTENT_ID } from '../ui/SkipLink';

/** A page crash must never black-screen the terminal — it renders a readable
    fault panel instead. Recovers via the resetKey prop (NOT a React key: a key
    would remount the whole section on every subtab change and kill the smooth
    subnav transitions). */
class RouteBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prevProps: { resetKey: string }) {
    // Navigating anywhere clears a shown fault so the next page gets a clean try
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }
  componentDidCatch(error: Error) {
    /* a page's code asked for by a name the server no longer has (a deploy under an open tab): nothing is wrong, so it
       reloads itself — once (ui/Fault.tsx) */
    if (isLoadFault(error) && navigator.onLine !== false) reloadOnceForStaleBuild();
  }
  render() {
    if (!this.state.error) return this.props.children;
    /* WHAT THE READER IS TOLD is ui/Fault.tsx (2026-09-19): it used to say "tell us in Community → Feedback", a page that
       was removed on 2026-09-13, under a lime button — an accent is not a button's (and since 2026-10-02 there is no lime) */
    return (
      <FaultView
        error={this.state.error}
        scope="page"
        retry={() => this.setState({ error: null })}
        back={
          <Link to="/pulse" onClick={() => this.setState({ error: null })} className="inline-flex items-center h-10 px-5 rounded-full border border-borderMuted text-[13.5px] font-medium text-textPrimary hover:bg-ink/[0.05]">
            Back to Pulse
          </Link>
        }
      />
    );
  }
}

/** Full-page detours that live under a section prefix but share none of its
    layout — they get their own transition key so the changeover animates
    instead of snapping (subtabs inside section layouts stay key-stable). */
const FULL_PAGE_DETOURS = ['/pulse/board'];

/* THE PLANET IS NO LONGER WARMED ON EVERY PAGE (Noah, 2026-08-30: "i was in
   the middle of a drag and it practically ignored me"). A PlanetWarmer used
   to fire 4s after the shell mounted, on every load of every page: a
   dynamic import of the News Room's globe (three.js + react-globe.gl —
   fetched, compiled and evaluated, geometry built at module scope, a GC
   pause behind it), an 8K night texture, a day texture and three JSON
   files. A CPU profile of a chart drag on the Weigher found sphere
   geometry and polar math in the samples with no globe on screen. The
   News section is paused and the room carries its own "spinning up the
   planet" fallback; warming belongs behind intent (a hover on the News
   nav), never behind a timer. */

const AppShell = () => {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const transitionKey = FULL_PAGE_DETOURS.includes(location.pathname)
    ? location.pathname
    : `/${location.pathname.split('/')[1] ?? ''}`;

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    /* a page may offer the palette as a button (paletteDoor.ts) — the not-found page's search */
    window.addEventListener(OPEN_PALETTE_EVENT, openPalette);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, openPalette);
    };
  }, [openPalette]);

  /* Only the CHART pages stay framed to the viewport. The table pages scroll
     with the page like the Live Tape (Noah, 2026-08-30) — they left this set.
     FROM md UP (2026-10-01): on a phone the frame cut Net Flow under its board —
     the pane past the fold, and no scroll to reach it — so there the page
     scrolls like any other. */
  const bleedPage = /^\/trace\/(net-flow|odte)/.test(
    location.pathname
  );
  /* The Weigher desk is VIEWPORT-FITTED but the page still scrolls (Noah,
     2026-08-30: "the footer should still be visible at the bottom which means
     a slight scroll down"). The trick is calc-free: main's height is definite,
     so a child's h-full resolves to exactly the viewport remainder — the desk
     fills the first screenful, and the footer sits just past the fold. */
  /* …and NOT below `lg` (the phone pass, 2026-09-13): a phone's screenful
     cannot hold four cards, and a tablet's column beside the sidebar is 532px
     — so the desk stacks into a column there and the page scrolls like any
     other. */
  /* …and since 2026-09-14 NOT AT ALL: the Weigher is a page like the others — its top row
     (the chart and the chain) is a window whose height the sash sets, its bottom row (the
     watchlist and the position) grows with its rows, and the page scrolls (Noah: the fixed
     frame could not hold the position card). */
  const framePage = bleedPage;

  return (
    /* THE FRAME (Noah, 2026-09-05, direction B): the terminal's ONE subject
       and its navigation live in a sidebar on the left; the page owns the
       rest of the width. The top bar is gone. */
    /* h-dvh over h-screen: on a phone 100vh is the height with the address bar AWAY, and this frame never lets the document
       scroll, so the bar never leaves — the last ~80px of every page sat under it (index.css, "a touch screen's two traps") */
    <div className="h-screen h-dvh flex flex-row bg-canvas text-textPrimary overflow-hidden">
      {/* the first stop for the keys: past the rail, straight to the page (the audit's X4.5) */}
      <SkipLink />
      <SideNav onOpenPalette={openPalette} />
      {/* The Trace flow pages are a FIXED FRAME, not a scroll: main stops
          scrolling, every layer fills its parent exactly, and the page's own
          flex-1 table absorbs the remainder — the tape ends ON the viewport
          floor on ANY screen height, no calc calibration to drift (Noah,
          2026-08-30: the leftover band read as a phantom footer). */}
      {/* ONE FRAME ACROSS TRACE (Noah, 2026-09-03, switching Live Tape →
          Net Flow: "the height of it expands into a bigger view leaving the
          user startled"). Measured per frame in Chrome: the instant the
          route changed, the tape — still fading out — jumped 18px up and
          32px wider, because this wrapper swapped to the chart pages'
          tighter, gutterless padding under it; then Net Flow landed with
          its head 73px higher than the tape's. So the chart pages now wear
          the SAME gutters, top padding and gap as the table pages (only the
          floor differs: they are viewport-fitted, the tables scroll), and
          main reserves its scrollbar gutter on every Trace page so a page
          without a scrollbar is not 15px wider than one with. */}
      <main
        id={CONTENT_ID}
        tabIndex={-1}
        /* max-md:pt-12 — the phone strip (SideNav, fixed, h-12) used to sit on
           the first 48px of every page; the page head began under it (the
           phone pass, 2026-09-13). Pulse's and Terrain's phone layouts
           subtract the same 3rem from the viewport. */
        /* EVERY PAGE SCROLLS TO ITS FOOTER (2026-10-03 — the owner: "make sure the art footer is on every page"): a framed
           page (Net Flow, 0DTE) keeps its frame exactly one screen tall and the footer waits below the fold; main scrolls
           on every page (it stopped scrolling on the framed ones, which had no footer to reach) */
        className={`flex-1 min-w-0 min-h-0 h-full max-md:pt-12 overflow-y-auto outline-none ${location.pathname.startsWith('/trace') ? '[scrollbar-gutter:stable]' : ''} ${
          /* …and where Terrain's desk owns the window (a phone, and from lg up) the scroll is there but its bar is not: a bar
             would take its 6px from the charts, which run edge to edge and to the floor exactly as they did */
          location.pathname.startsWith('/terrain')
            ? 'max-md:[scrollbar-width:none] lg:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden lg:[&::-webkit-scrollbar]:hidden'
            : ''
        }`}
      >
        {/* Keyed by top-level section only — subpage changes animate inside
            their section layout so the header/tabs never remount */}
        {/* NO EXIT WAIT (2026-09-06, the perf sweep — Noah: "it just pops right
            over"): with mode="wait" the old page faded out for 80ms, the
            column sat BLACK, then the new page faded in from nothing — the
            skeletons it carries never got their moment. Now the old page
            leaves at once and the new one lands on the next frame with its
            head and its skeleton boxes already in place, the boxes filling
            one per frame (Deferred); a 100ms fade keeps it from being a
            hard cut. */}
        <AnimatePresence initial={false}>
          <motion.div
            key={transitionKey}
            /* Cross-fade, no travel — the same verdict as the Trace subpage
               switch (Noah, 2026-08-30, the open-time hop): a section arriving
               6px low and sliding home re-rasterises every row on the way. */
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="w-full flex flex-col min-h-full"
          >
            {/* A section opens at its head, not where the last page's scroll was (2026-09-11) */}
            <ScrollHome />
            {/* A page opened from the Pulse desk carries its way back (2026-09-12) */}
            <WayBack />
            {/* pb-16: pages breathe at the bottom (Noah, 2026-08-17 —
                "everything ends very close to the bottom"); flex-grow keeps
                short pages' footer at the viewport floor, not mid-screen.
                EXCEPTION (Noah, 2026-08-30): the Trace flow pages are
                FULL-BLEED — no side gutters, no bottom pad, tight top. */}
            <div
              /* The Weigher tier: exactly one screenful (h-full off main's
                 definite height), shrink-0 so the footer below cannot squeeze
                 it — the overflow IS the slight scroll. Tight top like Trace
                 (Noah, 2026-08-30: "way too much space up top"). */
              /* a framed page is one screen tall from md up — main's own height (100dvh: no phone strip there) — so the
                 footer that follows it stands below the fold and the frame's floor is the window's */
              className={`${framePage ? 'px-4 lg:px-6 2xl:px-8 pt-5 pb-16 md:pb-0 gap-4 md:h-[100dvh] md:min-h-0 md:overflow-hidden md:shrink-0' : 'px-4 lg:px-6 2xl:px-8 pt-5 pb-16 gap-4'} flex flex-col flex-grow`}
            >
              <RouteBoundary resetKey={location.pathname}>
                {/* A page's code travels on its first visit (App's lazy routes);
                    its skeleton holds the shape meanwhile */}
                <Suspense
                  fallback={
                    <>
                      <MarkLoad />
                      <RouteSkeleton pathname={location.pathname} />
                    </>
                  }
                >
                  <Outlet />
                </Suspense>
              </RouteBoundary>
            </div>
            {/* The landing's footer ends every main page (Noah, 2026-08-23). Trace (2026-08-30) and Terrain (2026-09-13) went
                without one so their tape and their chart ran to the floor; since 2026-10-03 (the owner: "make sure the art
                footer is on every page") they have it too — the tape and the chart still run to the floor of the first
                screen, and the footer, the page's own picture (footer/scenes.ts), is one scroll past it. */}
            <SiteFooter />
          </motion.div>
        </AnimatePresence>
      </main>
      {/* THE SCRIPT EDITOR (2026-09-10): docked at the right of a full-screen
          chart, the takeover narrowed to leave it room — see data/editorDock.ts */}
      <EditorDockGate />
      {/* EVERY ALERT IN ONE PLACE (2026-09-10): the sidebar's bell opens it
          at the right, over any page — see data/alertsDrawer.ts */}
      <AlertsDrawer />
      {/* HEAR IT EVERYWHERE (2026-09-10): every name's alerts watched on every
          page, and a firing shown wherever the reader is */}
      <AlertWatcher />
      {/* A PAPER ACCOUNT'S ORDERS, WATCHED ON EVERY PAGE (2026-09-22) — a stop fills while the reader is elsewhere, and the
          chip above says so (data/paper/store.ts) */}
      <PaperRunner />
      <AlertToasts />
      {/* the open's tone up and the close's down, when switched on (Settings › Sounds) */}
      <MarketBell />
      {/* the browser's offer to put the terminal on the home screen, in the house's words */}
      <InstallPrompt />
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
};

export default AppShell;
