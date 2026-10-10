/*
==================================================
  SLAYER TERMINAL - COMPASS'S SHELL (pages/compass/CompassLayout.tsx)

  One head over the board and a setup's page (the
  walk, 2026-09-11): the page's icon and name over
  its one line — the house shell head, the way
  Trace's and the Record's read. A setup has a
  route of its own now (/compass/<id>) so the
  Tracker's door and the browser's Back work; only
  the body below the head cross-fades.
==================================================
*/

import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CompassRouteSkeleton } from '../compassSkeleton';
import ScrollHome from '../../components/layout/ScrollHome';
import MarkLoad from '../../brand/MarkLoad';
import ProductGlyph from '../../brand/ProductGlyph';

/* "graded and ranked" until 2026-09-19: we do not say we grade, anywhere a reader can see (Noah: "reword graded"; memory: no-public-grades) */
export const COMPASS_LINE = 'The setups found this sweep, the strongest first — Active while the structure holds, Watch while it proves itself';
/** The Tracker's line under the same head (its second page since 2026-09-13) */
export const TRACKER_LINE = 'The setups you keep, live — every figure moving with the tape, and a door back into each one';

const CompassLayout = () => {
  const location = useLocation();
  const outlet = useOutlet();
  const line = location.pathname.startsWith('/compass/tracker') ? TRACKER_LINE : COMPASS_LINE;
  return (
    <>
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-compass-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <ProductGlyph name="compass" size={18} bare className="shrink-0" />
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Compass</h1>
          </div>
          {/* two lines before a cut on a narrow screen, and the whole line on hover (the audit's X10) */}
          <p className="mt-0.5 text-[11px] text-textMuted line-clamp-2 md:line-clamp-1" title={line}>
            {line}
          </p>
        </div>
      </header>
      {/* A cross-fade, no travel (the Trace shell's verdict): opacity is the only thing that moves */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} transition={{ duration: 0.14 }} className="flex flex-col gap-4">
          {/* A page opens at its head, not where the last one's scroll was (2026-09-11) */}
          <ScrollHome />
          <Suspense fallback={<><MarkLoad /><CompassRouteSkeleton pathname={location.pathname} /></>}>{outlet}</Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default CompassLayout;
