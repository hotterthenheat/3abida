/* PRACTICE › JOURNAL — one page, two books (2026-09-26): the paper accounts' trades, or the backtest sessions', never
   mixed; which book rides the address (`?book=backtest`, paper by rest). The page is pages/review/JournalHome.tsx,
   handed the book's source (data/review/journalSource.ts).

   THREE VIEWS OF THE PAPER BOOK (the ideas of 2026-10-09 — read, plan, review), on the address too (`?view=`): the
   calendar (at rest), TODAY — before the open and how it went (TodayBrief) — and THE WEEK, reviewed (WeekReview). The
   backtest's book has the calendar only: its days are replayed ones, with no morning to brief. */
import { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FilterTabs from '../../components/ui/FilterTabs';
import { JournalHome } from '../review/JournalHome';
import type { JournalKind } from '../../data/review/journalSource';

const TodayBrief = lazy(() => import('./TodayBrief'));
const WeekReview = lazy(() => import('./WeekReview'));

/** The book an address names — paper unless it says backtest */
export const bookOf = (search: string): JournalKind => (new URLSearchParams(search).get('book') === 'backtest' ? 'backtest' : 'paper');

type View = 'calendar' | 'today' | 'week';
const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'The week' },
];

const PracticeJournal = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const q = new URLSearchParams(location.search);
  const book = bookOf(location.search);
  const raw = q.get('view');
  const view: View = book === 'paper' && (raw === 'today' || raw === 'week') ? raw : 'calendar';
  const setView = (v: View) => {
    const next = new URLSearchParams();
    if (v !== 'calendar') next.set('view', v);
    navigate({ search: next.toString() ? `?${next}` : '' });
  };
  return (
    <div className="flex flex-col gap-3">
      {book === 'paper' && (
        <div className="flex items-center gap-3 flex-wrap" data-journal-views={view}>
          <FilterTabs options={VIEWS} value={view} onChange={setView} ariaLabel="Which view of the journal" />
          <span className="text-[11px] text-textMuted">{view === 'today' ? 'Before the open, and how it went — the plan and the review kept on the day' : view === 'week' ? 'The week, a row a trading day' : 'Every trade on its day'}</span>
        </div>
      )}
      {view === 'calendar' ? (
        <JournalHome kind={book} books />
      ) : (
        <Suspense fallback={<div className="h-[320px]" />}>{view === 'today' ? <TodayBrief /> : <WeekReview account={q.get('session')} />}</Suspense>
      )}
    </div>
  );
};

export default PracticeJournal;
