/*
==================================================
  SLAYER TERMINAL - THE RECORD'S SHELL (RecordLayout)

  One head over four pages (2026-09-09): what is on
  the record about a name — News, Earnings,
  Insiders, Congress. The page's icon and name over
  its one line, the way Pinpoint's shell reads,
  with the SOURCE named on the right so the kind of
  record is never in doubt: a wire, a calendar, an
  SEC form, a STOCK Act report. The sidebar carries
  the four pages as a tree; the head only says
  where you are.
==================================================
*/

import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { RECORD_SUBPAGES } from './subnav';
import { RecordPageSkeleton } from './recordSkeletons';
import BackToTop from '../../components/ui/BackToTop';
import ScrollHome from '../../components/layout/ScrollHome';
import { useGlideHold } from '../../components/ui/useGlideHold';

const RecordLayout = () => {
  const location = useLocation();
  const outlet = useOutlet();
  const page = RECORD_SUBPAGES.find(p => location.pathname.startsWith(p.path)) ?? RECORD_SUBPAGES[0];
  const PageIcon = page.icon;
  /* The pages' grids grow with their rows now (2026-09-11), so the column
     holds its width for the sidebar's glide — one layout at the end, not one
     per frame over every rendered row (the Weigher's rule) */
  const holdRef = useGlideHold<HTMLDivElement>();

  return (
    <>
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-record-shell={page.label}>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true">
              <PageIcon className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">{page.label}</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{page.subtitle}</p>
        </div>
        <dl className="flex flex-wrap items-start gap-x-6 gap-y-1" data-shell-facts>
          <div className="min-w-0">
            <dt className="text-[10px] text-textMuted whitespace-nowrap">Source</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-record-source>
              {page.source}
            </dd>
          </div>
        </dl>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          ref={holdRef}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          /* The same first screen Pinpoint keeps: the top bar, this head and the page's padding */
          className="flex flex-col gap-4 flex-grow min-h-[calc(100vh-174px)]"
        >
          {/* A subpage opens at its head, not where the last one's scroll was (2026-09-11) */}
          <ScrollHome />
          <Suspense fallback={<RecordPageSkeleton pathname={location.pathname} />}>{outlet}</Suspense>
        </motion.div>
      </AnimatePresence>
      {/* The page's door home once a grid runs past a screen (the Compass board's, 2026-09-11) */}
      <BackToTop testId="record" />
    </>
  );
};

export default RecordLayout;
