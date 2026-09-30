/*
==================================================
  SLAYER TERMINAL - THE TWO JOURNALS' ONE SEAM
  (data/review/journalSource.ts)

  Noah, 2026-09-22: "there should be 2 different
  journals, 1 for the backtesting and 1 for the paper
  trading". The journal's pages are one set (the list,
  a trade's own page, the calendar, the tags); what
  differs is WHERE THEIR TRADES COME FROM and WHERE
  THEIR WORDS ARE KEPT — this file says it, for each:

    backtest   every backtest session's closed trades
               (data/review/store.ts), words kept with
               the session
    paper      every paper account's (data/paper/
               store.ts), words kept under the journal's
               own key — never another journal's rows

  The reader's two lists of tags (setups, mistakes) are
  shared: they are the reader's words, not a journal's.
==================================================
*/

import { useMemo } from 'react';
import { paperRowsOf, rowsOf, type DayNote, type JournalEntry, type JournalRow } from './journal';
import { setDayNote as setReviewDayNote, setEntry as setReviewEntry, useSessions } from './store';
import { setPaperDayNote, setPaperEntry, usePaper, usePaperJournal } from '../paper/store';
import { nyAt } from '../paper/clock';
import { SAMPLE_JOURNAL, sampleAccounts, setSampleShown, useSampleShown } from '../paper/sample';
import { calendarDayOf } from './journalFigures';

export type JournalKind = 'backtest' | 'paper';
export interface JournalSource {
  kind: JournalKind;
  /** The journal's own address */
  base: string;
  /** Every closed trade it holds, newest first */
  rows: JournalRow[];
  /** What its trades are grouped under — a session, an account — for the cut's card */
  containers: { id: string; name: string }[];
  /** "session" · "account" */
  containerWord: string;
  /** Where one of them is opened */
  containerPath: (id: string) => string;
  setEntry: (containerId: string, tradeId: string, patch: Partial<JournalEntry>) => void;
  setDayNote: (containerId: string, day: string, patch: Partial<DayNote>) => void;
  /** A container's day notes, by trading day — a day with words and no trade has them too */
  notesOf: (containerId: string) => Record<string, DayNote>;
  /** The calendar day it is in New York — the paper journal's today; the backtest's newest closed day */
  today: string;
  /** The container in hand (the paper desk's account) — whose note a day with no trades on it takes */
  current: string | null;
  /** The sample accounts (data/paper/sample.ts), while the switch is on: shown or hidden, and the door */
  sample?: { shown: boolean; set: (on: boolean) => void };
  /** The line under a trade's page */
  foot: string;
}

/** A journal's source — both stores are read (a hook each, always), only the asked one's rows are made */
export function useJournalSource(kind: JournalKind): JournalSource {
  const sessions = useSessions();
  const paper = usePaper();
  const words = usePaperJournal();
  const sampleShown = useSampleShown();
  return useMemo<JournalSource>(() => {
    if (kind === 'paper') {
      const accounts = SAMPLE_JOURNAL && sampleShown ? [...paper.accounts, ...sampleAccounts()] : paper.accounts;
      return {
            kind,
            base: '/practice/journal',
            rows: paperRowsOf(accounts, words),
            containers: accounts.map(a => ({ id: a.id, name: a.name })),
            containerWord: 'account',
            containerPath: () => '/practice/paper',
            setEntry: setPaperEntry,
            setDayNote: setPaperDayNote,
            notesOf: id => ({ ...accounts.find(a => a.id === id)?.days, ...words.days[id] }),
            today: nyAt(Date.now()).date,
            current: paper.inHand,
            sample: SAMPLE_JOURNAL ? { shown: sampleShown, set: setSampleShown } : undefined,
            foot: 'Simulated live prices — practice, not advice. Every time on this page is New York’s; the chart is the simulator’s own clock, as the desk drew it.',
      };
    }
    const rows = rowsOf(sessions);
    return {
              kind,
              base: '/practice/journal',
              rows,
              containers: sessions.map(s => ({ id: s.id, name: s.name })),
              containerWord: 'session',
              containerPath: id => `/practice/backtest/${id}`,
              setEntry: setReviewEntry,
              setDayNote: setReviewDayNote,
              notesOf: id => sessions.find(s => s.id === id)?.days ?? {},
              /* a replayed journal has no today of its own: its newest day stands in */
              today: rows[0] ? calendarDayOf(rows[0]) : new Date().toISOString().slice(0, 10),
              current: null,
              foot: 'Simulated prices on a seeded tape — practice, not advice. Every time on this page is New York’s.',
    };
  }, [kind, kind === 'paper' ? paper.accounts : sessions, words, paper.inHand, sampleShown]); // eslint-disable-line react-hooks/exhaustive-deps
}
