/* PRACTICE › JOURNAL — one page, two books (2026-09-26): the paper accounts' trades, or the backtest sessions', never
   mixed; which book rides the address (`?book=backtest`, paper by rest). The page is pages/review/JournalHome.tsx,
   handed the book's source (data/review/journalSource.ts). */
import { useLocation } from 'react-router-dom';
import { JournalHome } from '../review/JournalHome';
import type { JournalKind } from '../../data/review/journalSource';

/** The book an address names — paper unless it says backtest */
export const bookOf = (search: string): JournalKind => (new URLSearchParams(search).get('book') === 'backtest' ? 'backtest' : 'paper');

const PracticeJournal = () => {
  const location = useLocation();
  return <JournalHome kind={bookOf(location.search)} books />;
};

export default PracticeJournal;
