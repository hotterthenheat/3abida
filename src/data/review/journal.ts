/*
==================================================
  SLAYER TERMINAL - REVIEW · THE JOURNAL'S DATA
  (data/review/journal.ts)

  What the journal keeps that the engines do not: the
  reader's words and tags on a closed trade, a note on
  a replayed day, and the lists of tags the reader
  owns. A journal exists for what the numbers cannot
  say (Noah, 2026-09-20: "a bit lacking in
  functionality") — so everything here is the
  reader's, and every figure made from it (a tag's
  trades, what it won, what it made) is a count of
  THEIR trades, never a score of ours.

    an entry     on a trade, kept WITH ITS SESSION
                 (`session.journal`): a setup, the
                 mistakes, whether the plan was
                 followed, and three answers — why I
                 took it · what I saw while in it ·
                 what I would do again. The one note
                 the first journal kept (`notes`) is
                 read as the first answer until it is
                 written again.
    a day's note on a session's replayed day
                 (`session.days`): the plan before,
                 the review after.
    the tags     two lists the reader owns, kept on
                 this machine (`slayer_review_tags_v1`)
                 — a tag taken off a list stays on the
                 trades that carry it.

  What a journal needs of a trade (when, what, which
  way, how it ended, what it made) is asked through
  the helpers below, never by reaching into a row's
  fields.

  A SECOND JOURNAL, THE SAME PAGES (2026-09-22, Noah:
  "there should be 2 different journals, 1 for the
  backtesting and 1 for the paper trading"). A row can
  be a PAPER trade (`paper: true`, data/paper/engine.ts):
  its moments are real instants (`at`), not a replayed
  day's minute, and its account keeps its words under
  its own key (data/paper/store.ts). The helpers answer
  for it the way they answer for a backtest trade, so the
  journal's pages serve both journals — each reading
  only its own rows (`paperRowsOf`, `rowsOf`).
==================================================
*/

import { useSyncExternalStore } from 'react';
import { accountOf, type Session, type Trade } from './engine';
import { contractWords } from './quotes';
import { barTime, clockWords, dayWords } from './tape';
import { optBookOf as paperOptBookOf, type OptTrade as PaperOptTrade, type PaperAccount, type PaperMoment } from '../paper/engine';
import { nyMomentWords } from '../paper/clock';

export interface JournalEntry {
  /** One of the reader's setups */
  setup?: string;
  mistakes?: string[];
  /** Was the plan followed */
  plan?: 'yes' | 'no';
  /** How the reader felt going in — one word of MOODS (the ideas of 2026-10-09: a mood tag, counted like the others) */
  mood?: string;
  why?: string;
  saw?: string;
  again?: string;
  /** When the words were last kept, the machine's clock (the page says "Kept" off this) */
  keptAt?: number;
}
export interface DayNote {
  /** Before: what I am looking for */
  plan?: string;
  /** After: how the day went */
  review?: string;
  /** The recap's one question, answered: did I trade my plan? */
  followed?: 'yes' | 'partly' | 'no';
}

export type JournalRow = { key: string; s: Session; t: Trade; paper?: undefined } | { key: string; s: PaperAccount; t: PaperOptTrade; paper: true };
type Moment = Trade['closed'] | PaperMoment;

/** Every closed trade of every session, newest first */
export const rowsOf = (sessions: Session[]): JournalRow[] =>
  sessions
    .flatMap<JournalRow>(s => accountOf(s).trades.map(t => ({ key: `${s.id}:${t.id}`, s, t })))
    .sort((a, b) => instantOf(b, b.t.closed) - instantOf(a, a.t.closed));

/** Every closed trade of every PAPER account, newest first — with the words kept under the journal's own key put back on
    each account (`journal`, `days`), where the helpers read them */
export const paperRowsOf = (accounts: PaperAccount[], words: { entries: Record<string, Record<string, JournalEntry>>; days: Record<string, Record<string, DayNote>> }): JournalRow[] =>
  accounts
    .flatMap<JournalRow>(a0 => {
      /* the words kept under the journal's key, over any the account carries of its own (the sample accounts do) */
      const a = { ...a0, journal: { ...a0.journal, ...words.entries[a0.id] }, days: { ...a0.days, ...words.days[a0.id] } };
      return paperOptBookOf(a).trades.map(t => ({ key: `${a.id}:${t.id}`, s: a, t, paper: true as const }));
    })
    .sort((a, b) => instantOf(b, b.t.closed) - instantOf(a, a.t.closed));

/* WHEN, as a real New York instant ("newest first" compares instants, not a replayed day's minutes).
   THE MOMENT IS THE END OF ITS MINUTE, as the desk's clock says it ("in at 09:31" is the bar that began at 09:30): a bar's
   stamp is when it BEGAN, so a minute is added — and a figure drawn from these reads the same clock as the facts beside it.
   A PAPER moment is the instant itself — no minute to add. */
export const instantOf = (r: JournalRow, m: Moment): number => {
  if (r.paper) return Math.floor((m as PaperMoment).at / 1000);
  const x = m as Trade['closed'];
  return barTime(x.day, x.minute) + 60;
};
export const whenWords = (r: JournalRow, m: Moment): string => {
  if (r.paper) return nyMomentWords((m as PaperMoment).at);
  const x = m as Trade['closed'];
  return `${dayWords(x.day)} · ${clockWords(x.minute)}`;
};
/** The minutes in a trading day of the row's kind — what "held" is counted against: an option's 390, a paper trade's real day */
export const dayMinOf = (r: JournalRow): number => (r.paper ? 1440 : 390);
/** The name it was a trade IN */
export const nameOf = (r: JournalRow): string => r.t.contract.ticker;
/** What it is called in a sentence: "SPY 518C Jul 2" */
export const titleOf = (r: JournalRow): string => contractWords(r.t.contract);
/** The way it needed the name to go: a call up, a put down */
export const directionOf = (r: JournalRow): 'up' | 'down' => (r.t.contract.right === 'C' ? 'up' : 'down');
export const ENDED: Record<Trade['how'] | PaperOptTrade['how'], string> = { sold: 'Sold by you', target: 'Target hit', stopped: 'Stopped out', expired: 'Held to the bell', scaled: 'Scaled out', rule: 'Closed by the rules', page: 'Closed as the page shut' };
/** A piece a trade left in, in a word */
export const OUT_WORD: Record<'target' | 'stop' | 'hand' | 'bell' | 'rule' | 'page', string> = { target: 'target', stop: 'stop', hand: 'by hand', bell: 'the bell', rule: 'the rules', page: 'the page closing' };
/** "Scaled out · target, target, stop" — how each piece left, in order */
export const piecesWords = (r: JournalRow): string => r.t.legs.filter(l => l.out).map(l => OUT_WORD[l.out!]).join(', ');
/** How it ended, in the three ways a reader sorts by: their own hand, the target, the stop — the bell and the rules are the market's */
export type EndedCut = 'hand' | 'target' | 'stop' | 'market' | 'pieces';
export const endedCutOf = (r: JournalRow): EndedCut => (r.t.how === 'scaled' ? 'pieces' : r.t.how === 'target' ? 'target' : r.t.how === 'stopped' ? 'stop' : r.t.how === 'expired' || r.t.how === 'rule' || r.t.how === 'page' ? 'market' : 'hand');

/** A trade's entry — the first journal's one note is the first answer until that answer is written */
export const entryOf = (r: JournalRow): JournalEntry => {
  const e = r.s.journal?.[r.t.id] ?? {};
  return e.why === undefined && r.s.notes[r.t.id] ? { ...e, why: r.s.notes[r.t.id] } : e;
};
/** Every word the reader wrote on it, as one line — the list's column, and what the search reads */
export const wordsOf = (e: JournalEntry): string => [e.why, e.saw, e.again].map(w => (w ?? '').trim()).filter(Boolean).join(' · ');
export const hasWords = (e: JournalEntry): boolean => wordsOf(e).length > 0;

/* ---- the cut: what the page's cards ask of a row ---- */
export interface JournalCut {
  session: string;
  name: string;
  way: 'all' | 'up' | 'down';
  result: 'all' | 'won' | 'lost';
  ended: 'all' | EndedCut;
  /** Any of these: "setup:…", "mistake:…", "plan:yes", "plan:no", "none" (no tag at all) */
  tags: string[];
  notes: 'all' | 'written' | 'needed';
  /** Words to find in the reader's own */
  find: string;
}
export const CUT_AT_REST: JournalCut = { session: 'all', name: 'all', way: 'all', result: 'all', ended: 'all', tags: [], notes: 'all', find: '' };
export const tagKeysOf = (e: JournalEntry): string[] => [...(e.setup ? [`setup:${e.setup}`] : []), ...(e.mistakes ?? []).map(m => `mistake:${m}`), ...(e.plan ? [`plan:${e.plan}`] : []), ...(e.mood ? [`mood:${e.mood}`] : [])];
/** The moods a trade can be tagged with — how it felt going in, never a judgement of the trade */
export const MOODS = ['Calm', 'Focused', 'Rushed', 'Tired', 'Frustrated', 'Overconfident', 'Bored'] as const;
export function inCut(r: JournalRow, c: JournalCut): boolean {
  if (c.session !== 'all' && r.s.id !== c.session) return false;
  if (c.name !== 'all' && nameOf(r) !== c.name) return false;
  if (c.way !== 'all' && directionOf(r) !== c.way) return false;
  if (c.result !== 'all' && (c.result === 'won' ? r.t.pnl <= 0 : r.t.pnl > 0)) return false;
  if (c.ended !== 'all' && endedCutOf(r) !== c.ended) return false;
  const e = entryOf(r);
  if (c.notes !== 'all' && (c.notes === 'written') !== hasWords(e)) return false;
  if (c.tags.length) {
    const mine = tagKeysOf(e);
    if (!c.tags.some(t => (t === 'none' ? mine.length === 0 : mine.includes(t)))) return false;
  }
  const find = c.find.trim().toLowerCase();
  if (find && !`${wordsOf(e)} ${titleOf(r)} ${r.s.name}`.toLowerCase().includes(find)) return false;
  return true;
}
/** The cut as an address's query — so a trade's page walks the same list the journal showed, and Back restores it */
export function cutToQuery(c: JournalCut): string {
  const q = new URLSearchParams();
  (Object.keys(CUT_AT_REST) as (keyof JournalCut)[]).forEach(k => {
    const v = c[k];
    if (k === 'tags') (v as string[]).forEach(t => q.append('tag', t));
    else if (v !== CUT_AT_REST[k] && v !== '') q.set(k, v as string);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}
export function cutFromQuery(search: string): JournalCut {
  const q = new URLSearchParams(search);
  const one = <T extends string>(k: string, allowed: readonly T[], rest: T): T => (allowed.includes(q.get(k) as T) ? (q.get(k) as T) : rest);
  return {
    session: q.get('session') ?? 'all',
    name: q.get('name') ?? 'all',
    way: one('way', ['all', 'up', 'down'] as const, 'all'),
    result: one('result', ['all', 'won', 'lost'] as const, 'all'),
    ended: one('ended', ['all', 'hand', 'target', 'stop', 'market', 'pieces'] as const, 'all'),
    tags: q.getAll('tag'),
    notes: one('notes', ['all', 'written', 'needed'] as const, 'all'),
    find: q.get('find') ?? '',
  };
}

/* ---- the reader's tags ---- */
export interface TagLists {
  setups: string[];
  mistakes: string[];
}
const TAGS_KEY = 'slayer_review_tags_v1';
/* the lists a reader starts with — the house's own words for what a level-reader trades, and the mistakes every journal
   ends up counting. Theirs to change. */
const TAGS_AT_REST: TagLists = {
  setups: ['Bounce off a wall', 'Break through a wall', 'Flip reclaimed', 'Flip lost', 'Opening range break', 'Pullback in a trend', 'Fade of a stretched move', 'News'],
  mistakes: ['Chased it', 'No plan', 'Too big', 'Moved my stop', 'Cut it early', 'Held too long', 'Revenge trade', 'Broke my own rule'],
};
const cleanList = (v: unknown, rest: string[]): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean))].slice(0, 40) : rest);
function loadTags(): TagLists {
  try {
    const raw = JSON.parse(localStorage.getItem(TAGS_KEY) ?? 'null') as Partial<TagLists> | null;
    return raw ? { setups: cleanList(raw.setups, TAGS_AT_REST.setups), mistakes: cleanList(raw.mistakes, TAGS_AT_REST.mistakes) } : TAGS_AT_REST;
  } catch {
    return TAGS_AT_REST;
  }
}
let tags: TagLists = typeof localStorage === 'undefined' ? TAGS_AT_REST : loadTags();
const tagListeners = new Set<() => void>();
const setTags = (next: TagLists) => {
  tags = next;
  try {
    localStorage.setItem(TAGS_KEY, JSON.stringify(next));
  } catch {
    /* storage off — the lists last as long as the page */
  }
  tagListeners.forEach(fn => fn());
};
export const useTags = (): TagLists =>
  useSyncExternalStore(
    fn => {
      tagListeners.add(fn);
      return () => tagListeners.delete(fn);
    },
    () => tags,
    () => TAGS_AT_REST
  );
export const addTag = (list: keyof TagLists, word: string) => {
  const w = word.trim().slice(0, 40);
  if (!w || tags[list].some(t => t.toLowerCase() === w.toLowerCase())) return;
  setTags({ ...tags, [list]: [...tags[list], w] });
};
export const removeTag = (list: keyof TagLists, word: string) => setTags({ ...tags, [list]: tags[list].filter(t => t !== word) });

/* ---- the cut, as a file ---- */
const cell = (v: string | number | null | undefined): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** The rows as CSV — what a spreadsheet opens. `extra` carries what only the page has computed (the best and the worst). */
export function csvOf(rows: JournalRow[], extra: (r: JournalRow) => { best: number | null; worst: number | null }): string {
  const head = ['Closed (New York)', 'Opened (New York)', 'Session', 'Name', 'Contract', 'Way', 'Size', 'In', 'Out', 'Ended', 'P&L', 'R', 'Held (minutes)', 'Best while held', 'Worst while held', 'Setup', 'Mistakes', 'Followed the plan', 'Mood', 'Why I took it', 'What I saw', 'What I would do again'];
  const lines = rows.map(r => {
    const e = entryOf(r);
    const x = extra(r);
    return [whenWords(r, r.t.closed), whenWords(r, r.t.opened), r.s.name, nameOf(r), titleOf(r), directionOf(r) === 'up' ? 'Up' : 'Down', r.t.qty, r.t.avgIn.toFixed(2), r.t.avgOut.toFixed(2), ENDED[r.t.how], r.t.pnl.toFixed(2), r.t.r != null ? r.t.r.toFixed(2) : '', r.t.heldMin, x.best != null ? x.best.toFixed(2) : '', x.worst != null ? x.worst.toFixed(2) : '', e.setup ?? '', (e.mistakes ?? []).join('; '), e.plan ?? '', e.mood ?? '', e.why ?? '', e.saw ?? '', e.again ?? '']
      .map(cell)
      .join(',');
  });
  return [head.map(cell).join(','), ...lines].join('\r\n');
}
