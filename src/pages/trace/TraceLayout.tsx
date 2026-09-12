/*
==================================================
  SLAYER TERMINAL - TRACE'S SHELL (pages/trace/TraceLayout.tsx)

  One head over nine pages, the way Pinpoint's and
  the Record's read (2026-09-09; Noah: "should we
  have the different subtabs on the sub-bar or stay
  on the top section of the header" — the sidebar
  tree, like the other two sections). The page's
  icon and name over its one line, the ticker
  picker at the right where a page keeps one. The
  fused strip of tabs and its hover cards are gone;
  the sidebar carries the nine as a tree and the
  head only says where you are. Only the subpage
  body cross-fades.
==================================================
*/

import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TracePageSkeleton } from './traceSkeletons';
import { useMarketData } from '../../context/MarketDataContext';
import TickerSearch from '../../components/ui/TickerSearch';
import BackToTop from '../../components/ui/BackToTop';
import ScrollHome from '../../components/layout/ScrollHome';
import { useGlideHold } from '../../components/ui/useGlideHold';
import { TRACE_SUBPAGES } from './subnav';

/* The Live Tape carries its own ticker/contract search, the flow-book pages
   sweep the whole universe, and the Tracker lists the reader's marks across
   every name with its own names-only search — a single-ticker picker would
   mislead on all of them. */
const NO_PICKER = /^\/trace\/(live-tape|screener|net-flow|footprints|watchers|windows|odte|multi-leg|tracker)/;

const TraceLayout = () => {
  const { activeTicker, changeTicker } = useMarketData();
  const location = useLocation();
  const outlet = useOutlet();
  const active = TRACE_SUBPAGES.find(page => location.pathname.startsWith(page.path)) ?? TRACE_SUBPAGES[0];
  const PageIcon = active.icon;
  /* The viewport-fitted pages (Net Flow, 0DTE): the outlet wrapper absorbs the remaining height for them */
  const bleed = /^\/trace\/(net-flow|odte)/.test(location.pathname);
  const picker = !NO_PICKER.test(location.pathname);
  /* The pages' grids grow with their rows now (2026-09-11), so the column
     holds its width for the sidebar's glide — one layout at the end, not one
     per frame over every rendered row (the Weigher's rule) */
  const holdRef = useGlideHold<HTMLDivElement>();

  return (
    <>
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-trace-shell={active.label}>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true">
              <PageIcon className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">{active.label}</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{active.subtitle}</p>
        </div>
        {picker && (
          <div className="flex items-center gap-2 shrink-0" data-trace-picker>
            <TickerSearch value={activeTicker} onChange={changeTicker} />
          </div>
        )}
      </header>
      {/* A CROSS-FADE, NO TRAVEL (Noah, 2026-08-30: "on open... things get
          out of place like the tables shrink then go back to normal spacing
          for a very brief moment"). Opacity is the only thing that moves;
          the exit is short so the wait between pages is a blink, not a blank. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          ref={holdRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{ duration: 0.14 }}
          className={`flex flex-col gap-2.5 ${bleed ? 'flex-1 min-h-0' : ''}`}
        >
          {/* A subpage opens at its head, not where the last one's scroll was (2026-09-11) */}
          <ScrollHome />
          {/* A page's code travels on its first visit; it stands in as ITS OWN
              shape under a head that stays put (traceSkeletons.tsx) */}
          <Suspense fallback={<TracePageSkeleton pathname={location.pathname} />}>{outlet}</Suspense>
        </motion.div>
      </AnimatePresence>
      {/* The page's door home once a grid runs past a screen (the Compass board's, 2026-09-11) */}
      <BackToTop testId="trace" />
    </>
  );
};

export default TraceLayout;
