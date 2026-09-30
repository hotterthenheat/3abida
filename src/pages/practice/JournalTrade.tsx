/* PRACTICE › JOURNAL › A TRADE — the journal's trade page (pages/review/JournalTrade.tsx) on a trade of either book. The
   address says the book (`?book=backtest`); an old address without it is looked up in the paper book first, then the
   backtest's, so a link kept from before the two journals became one still opens. */
import { useLocation, useParams } from 'react-router-dom';
import { JournalTradePage } from '../review/JournalTrade';
import { useJournalSource, type JournalKind } from '../../data/review/journalSource';

const PracticeJournalTrade = () => {
  const { sessionId, tradeId } = useParams();
  const { search } = useLocation();
  const said = new URLSearchParams(search).get('book');
  /* both books are read (a hook each, always); the one the address names wins, else the one that holds the trade */
  const paper = useJournalSource('paper');
  const backtest = useJournalSource('backtest');
  const has = (rows: { s: { id: string }; t: { id: string } }[]) => rows.some(r => r.s.id === sessionId && r.t.id === tradeId);
  const kind: JournalKind = said === 'backtest' || said === 'paper' ? said : has(paper.rows) ? 'paper' : has(backtest.rows) ? 'backtest' : 'paper';
  return <JournalTradePage kind={kind} />;
};

export default PracticeJournalTrade;
