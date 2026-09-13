import { Component, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import SideNav from './SideNav';
import CommandPalette from './CommandPalette';
import SiteFooter from './SiteFooter';
import RouteSkeleton from '../ui/RouteSkeleton';
import EditorDock from '../scripts/EditorDock';
import AlertsDrawer from '../alerts/AlertsDrawer';
import AlertWatcher from '../alerts/AlertWatcher';
import AlertToasts from '../alerts/AlertToasts';
import ScrollHome from './ScrollHome';
import WayBack from './WayBack';

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
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="border border-bear/30 bg-bear/[0.04] rounded-lg p-8 flex flex-col items-start gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-bear">Page fault</span>
        <p className="text-[13px] text-textSecondary leading-relaxed max-w-lg">
          This page hit an error and stopped rendering. The rest of the terminal is fine — reload the
          page, or head back to Pulse. If it keeps happening, tell us in Community → Feedback.
        </p>
        <code className="font-mono text-[11px] text-textMuted break-all">{this.state.error.message}</code>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-borderMuted font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:bg-ink/[0.03] transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reload
          </button>
          <Link
            to="/pulse"
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center px-3 py-1.5 rounded-md font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0a0a0a] bg-[#D2FF00]"
          >
            Back to Pulse
          </Link>
        </div>
      </div>
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
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /* Only the CHART pages stay framed to the viewport. The table pages scroll
     with the page like the Live Tape (Noah, 2026-08-30) — they left this set. */
  const bleedPage = /^\/trace\/(net-flow|odte)/.test(
    location.pathname
  );
  /* The Weigher desk is VIEWPORT-FITTED but the page still scrolls (Noah,
     2026-08-30: "the footer should still be visible at the bottom which means
     a slight scroll down"). The trick is calc-free: main's height is definite,
     so a child's h-full resolves to exactly the viewport remainder — the desk
     fills the first screenful, and the footer sits just past the fold. */
  const weigherFrame = location.pathname.startsWith('/weigher');
  /* Terrain is a charting desk: it fits the screen exactly and carries no
     footer (Noah, 2026-09-12) — the frame with no gutters at all. */
  const terrainFrame = location.pathname.startsWith('/terrain');
  const framePage = bleedPage || weigherFrame || terrainFrame;

  return (
    /* THE FRAME (Noah, 2026-09-05, direction B): the terminal's ONE subject
       and its navigation live in a sidebar on the left; the page owns the
       rest of the width. The top bar is gone. */
    <div className="h-screen flex flex-row bg-canvas text-textPrimary overflow-hidden">
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
        className={`flex-1 min-w-0 min-h-0 h-full ${bleedPage || terrainFrame ? 'overflow-hidden' : 'overflow-y-auto'} ${
          location.pathname.startsWith('/trace') ? '[scrollbar-gutter:stable]' : ''
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
            className={`w-full flex flex-col ${framePage ? 'h-full' : 'min-h-full'}`}
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
              className={`${
                terrainFrame
                  ? 'p-0 gap-0 h-full min-h-0 overflow-hidden'
                  : bleedPage
                  ? 'px-4 lg:px-6 2xl:px-8 pt-5 pb-0 gap-4 h-full min-h-0 overflow-hidden'
                  : weigherFrame
                    ? 'px-4 lg:px-6 2xl:px-8 pt-2 pb-3 gap-2.5 h-full min-h-0 overflow-hidden shrink-0'
                    : 'px-4 lg:px-6 2xl:px-8 pt-5 pb-16 gap-4'
              } flex flex-col flex-grow`}
            >
              <RouteBoundary resetKey={location.pathname}>
                {/* A page's code travels on its first visit (App's lazy routes);
                    its skeleton holds the shape meanwhile */}
                <Suspense fallback={<RouteSkeleton pathname={location.pathname} />}>
                  <Outlet />
                </Suspense>
              </RouteBoundary>
            </div>
            {/* The landing's footer ends every main page (Noah, 2026-08-23) —
                except Trace (Noah, 2026-08-30: "the trace page shouldnt have
                a footer at all"): the tape runs to the floor. */}
            {/* Trace runs to the floor with no footer; the Weigher keeps its
                footer one slight scroll past the fold (Noah, 2026-08-30). */}
            {!location.pathname.startsWith('/trace') && !terrainFrame && <SiteFooter />}
          </motion.div>
        </AnimatePresence>
      </main>
      {/* THE SCRIPT EDITOR (2026-09-10): docked at the right of a full-screen
          chart, the takeover narrowed to leave it room — see data/editorDock.ts */}
      <EditorDock />
      {/* EVERY ALERT IN ONE PLACE (2026-09-10): the sidebar's bell opens it
          at the right, over any page — see data/alertsDrawer.ts */}
      <AlertsDrawer />
      {/* HEAR IT EVERYWHERE (2026-09-10): every name's alerts watched on every
          page, and a firing shown wherever the reader is */}
      <AlertWatcher />
      <AlertToasts />
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
};

export default AppShell;
