/*
==================================================
  SLAYER TERMINAL - PRACTICE (pages/practice/PracticeLayout.tsx)

  ONE SECTION for trading with pretend money (Noah,
  2026-09-26: "should paper trading and backtesting be in
  the same section and should they also carry the same
  journal" — yes; "the live chart should be called paper
  and the overhead can be called practice"). It holds
  what were Paper (2026-09-22) and Review (2026-09-20):

    Paper      today's prices, on the live feed
    Backtest   a past market, replayed a minute at a time
    Journal    every trade of either, on its day — one
               page, two books, never mixed

  The shell is the Record's: the page's own head over the
  body, the child pages in the sidebar tree. WHAT THE HEAD
  SAYS ABOUT THE DATA, per page: while the feed is the
  simulator the Paper page says "Simulated feed" and the
  Backtest page "Simulated tape" — never a figure on this
  section without that in sight.
==================================================
*/

import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PRACTICE_SUBPAGES } from './subnav';
import { PracticePageSkeleton } from './practiceSkeletons';
import BackToTop from '../../components/ui/BackToTop';
import ScrollHome from '../../components/layout/ScrollHome';
import { useGlideHold } from '../../components/ui/useGlideHold';
import { SIM_FEED } from '../../data/paper/feed';
import { TAPE_DAYS } from '../../data/review/tape';
import { NAV_ITEMS } from '../../components/layout/nav';
import ProductGlyph from '../../brand/ProductGlyph';
import MarkLoad from '../../brand/MarkLoad';

const Fact = ({ label, children, testId, title }: { label: string; children: React.ReactNode; testId?: string; title?: string }) => (
  <div className="min-w-0">
    <dt className="text-[10px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-practice-fact={testId} title={title}>
      {children}
    </dd>
  </div>
);

const PracticeLayout = () => {
  const location = useLocation();
  const outlet = useOutlet();
  const page = PRACTICE_SUBPAGES.find(p => location.pathname.startsWith(p.path)) ?? PRACTICE_SUBPAGES[0];
  const PageIcon = page.icon;
  /* Paper, Backtest and the Journal are products of their own: each wears its glyph, read from the rail's own list */
  const glyph = NAV_ITEMS.find(i => i.path === page.path)?.glyph;
  const holdRef = useGlideHold<HTMLDivElement>();
  /* a session's desk and its report are one page each: the body does not fade when only the clock's address would; a walk
     from one trade of the journal to the next is one page too (JournalTrade fades its own body) */
  const fadeKey = /^\/practice\/journal\/[^/]+\/[^/]+/.test(location.pathname) ? '/practice/journal/trade' : location.pathname.split('/').slice(0, 5).join('/');
  const which = page.path.endsWith('/paper') ? 'paper' : page.path.endsWith('/backtest') ? 'backtest' : 'journal';

  return (
    <>
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-practice-shell={page.label}>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            {glyph ? (
              <ProductGlyph name={glyph} size={24} className="shrink-0 rounded-md" />
            ) : (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true">
                <PageIcon className="w-3.5 h-3.5" />
              </span>
            )}
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">{page.label}</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{page.subtitle}</p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2" data-shell-facts>
          {which === 'paper' && (
            <>
              <Fact label="Prices" testId="source" title={SIM_FEED ? 'It trades round the clock and starts fresh every time the page loads — so what is open is closed when the page closes' : undefined}>
                {SIM_FEED ? 'Streaming' : 'Live feed'}
              </Fact>
              <Fact label="Clock">Today · New York</Fact>
            </>
          )}
          {which === 'backtest' && (
            <>
              <Fact label="Prices" testId="source">Replayed tape</Fact>
              <Fact label="History">{TAPE_DAYS} sessions · a minute a bar</Fact>
            </>
          )}
          {which === 'journal' && (
            <>
              <Fact label="Prices" testId="source">{SIM_FEED ? 'Streaming · replayed tape' : 'Live feed · replayed tape'}</Fact>
              <Fact label="Clock">New York</Fact>
            </>
          )}
          <Fact label="Money">Paper — nothing reaches a broker</Fact>
        </dl>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={fadeKey} ref={holdRef} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col gap-4 flex-grow min-h-[calc(100vh-174px)]">
          <ScrollHome />
          <Suspense fallback={<><MarkLoad /><PracticePageSkeleton pathname={location.pathname} /></>}>{outlet}</Suspense>
        </motion.div>
      </AnimatePresence>
      <BackToTop testId="practice" />
    </>
  );
};

export default PracticeLayout;
