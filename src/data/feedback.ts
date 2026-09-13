/*
==================================================
  SLAYER TERMINAL - FEEDBACK AND BUGS
  (data/feedback.ts)

  Suggestions and bug reports. One board, but not
  one KIND of thing — and the first cut treated them
  as one, which is what most of this rewrite is
  about (2026-09-13).

  A SUGGESTION AND A BUG NEED DIFFERENT WORDS.
  A suggestion lives new -> under review -> planned
  -> building -> shipped, or declined. A bug lives
  new -> confirmed -> fixing -> fixed, or cannot
  reproduce, or not a bug — "planned" and "shipped"
  read wrong over something broken. A vote on a
  suggestion is support; on a bug it is "I have this
  too", and there is no voting a bug down. The
  reporter of a bug knows its SEVERITY (does it
  block me, is there a way round it, is it just
  ugly); the reporter of a suggestion does not know
  its priority and should not be asked — everyone
  picks critical, and the votes are the priority.

  A BUG REPORT ALSO NEEDS WHAT THE REPORTER SHOULD
  NEVER HAVE TO TYPE: where it happened, picked off
  the terminal's own page registry rather than typed
  as "pinpoint/map", and the browser, the screen and
  the build, read off the machine.

  WHAT IS KEPT AND HOW. Four things, each on its own
  key, because the board itself is seeded and only
  YOUR part of it is yours to store:

    your entries      the ones you wrote, whole
    your votes        the ids you support; a seeded
                      entry's count is the seed's
                      plus one, worked out on every
                      read — never a number saved
                      twice
    your comments     id -> the replies you added,
                      merged onto the seed's own
    your screenshots  kept apart (data/pictures.ts),
                      because a vote should not
                      rewrite every picture you ever
                      attached

  So a reload prints exactly what the screen printed
  before it.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { getAccount } from './account';
import { readJson, writeKey } from './kept';
import { pictureStore } from './pictures';
import { NAV_ITEMS } from '../components/layout/nav';
import { GEX_SUBPAGES } from '../pages/pinpoint/subnav';
import { TRACE_SUBPAGES } from '../pages/trace/subnav';
import { RECORD_SUBPAGES } from '../pages/record/subnav';
import { COMMUNITY_SUBPAGES } from '../pages/community/subnav';

/* ---- the shapes ---------------------------------------------------------------------- */

export type FeedbackKind = 'suggestion' | 'bug';

/** A suggestion's life */
export const SUGGESTION_STATUSES = ['new', 'under review', 'planned', 'building', 'shipped', 'declined'] as const;
/** A bug's life, which is a different life and needs different words */
export const BUG_STATUSES = ['new', 'confirmed', 'fixing', 'fixed', 'cannot reproduce', 'not a bug'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];
export type BugStatus = (typeof BUG_STATUSES)[number];
export type FeedbackStatus = SuggestionStatus | BugStatus;
/** The statuses that mean the team has not finished with it */
export const OPEN_STATUSES: FeedbackStatus[] = ['new', 'under review', 'planned', 'building', 'confirmed', 'fixing'];

/** The team's word on a suggestion — never asked of the person suggesting it */
export type FeedbackPriority = 'nice to have' | 'important' | 'critical';
/** The reporter's word on a bug, which is the one thing they DO know */
export const SEVERITIES = ['blocks me', 'has a workaround', 'cosmetic'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORIES = ['new feature', 'performance', 'ui/ux', 'chart', 'trading data', 'alerts', 'login/account', 'billing', 'other'] as const;
export type FeedbackCategory = (typeof CATEGORIES)[number];
/* WHAT A KIND STARTS ON. "New feature" is the right guess for a suggestion and
   a nonsense one for a bug — and it was what bugs were filed under, because
   the bug form had no category control at all and inherited the other form's
   state. Both forms ask now, and each starts somewhere it could be true. */
export const DEFAULT_CATEGORY: Record<FeedbackKind, FeedbackCategory> = { suggestion: 'new feature', bug: 'ui/ux' };

/** The machine a bug happened on, read rather than asked for */
export interface Environment {
  browser: string;
  os: string;
  screen: string;
  theme: string;
  build: string;
}

export interface FeedbackComment {
  id: string;
  author: string;
  at: string;
  text: string;
  /** The team's own reply, marked as such */
  team?: boolean;
}
export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  title: string;
  category: FeedbackCategory;
  description: string;
  /** Suggestions: the team's reading of how much it matters */
  priority?: FeedbackPriority;
  /** Bugs: the reporter's reading of how much it hurts */
  severity?: Severity;
  ticker?: string;
  /** Picture ids — the pictures live on their own key, see data/pictures.ts */
  attachments?: string[];
  status: FeedbackStatus;
  votes: number;
  comments: FeedbackComment[];
  author: string;
  createdAt: string;
  /** Bugs: the route it happened on, picked from the terminal's own registry */
  where?: string;
  /** Bugs: the machine it happened on */
  environment?: Environment;
  /** The team's note on the status — why planned, why declined, why not a bug */
  statusNote?: string;
}

/* ---- where it happened ---------------------------------------------------------------- */

/*
  THE PAGES OF THE TERMINAL, from the terminal's own registries.

  Nobody reporting a bug should be typing "pinpoint/map" into a free-text box
  and hoping it is the string the team greps for. This is the same list the
  command palette walks, so a page added to the nav is a page you can report a
  bug on, with no second list to remember to update.
*/
export interface FeedbackPage {
  path: string;
  label: string;
}
const sub = (head: string, pages: readonly { path: string; label: string }[]): FeedbackPage[] => pages.map(p => ({ path: p.path, label: `${head} → ${p.label}` }));
/* ONE ENTRY PER ROUTE. A section's own path appears in both lists — Community
   is a nav item and the first of the community subpages — and two options on
   one value is a picker that cannot say which one you chose. The nav's plain
   name wins, because it is the one a reader would look for. */
/* TWO SURFACES THAT ARE NOT ROUTES. The alerts drawer and the command palette
   open over whatever page you happen to be on, and both are things people
   report bugs about — a picker that cannot name them sends the report to
   whichever page the reporter was looking at, which is not where it lives.
   They carry ids rather than paths because there is nowhere to navigate to. */
const OVERLAYS: FeedbackPage[] = [
  { path: 'overlay:alerts', label: 'The alerts drawer' },
  { path: 'overlay:palette', label: 'The command palette' },
];
export const PAGES: FeedbackPage[] = (() => {
  const seen = new Set<string>();
  const out: FeedbackPage[] = [];
  for (const page of [...NAV_ITEMS.map(n => ({ path: n.path, label: n.label })), ...sub('Pinpoint', GEX_SUBPAGES), ...sub('Trace', TRACE_SUBPAGES), ...sub('Record', RECORD_SUBPAGES), ...sub('Community', COMMUNITY_SUBPAGES), ...OVERLAYS]) {
    if (seen.has(page.path)) continue;
    seen.add(page.path);
    out.push(page);
  }
  return out;
})();
/** A route as the board should print it — its page's name, or the path itself */
export const pageLabel = (path: string): string => PAGES.find(p => p.path === path)?.label ?? path;

/** The machine, read off the browser. Shown to the reporter, and clearable. */
export function readEnvironment(): Environment {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const browser =
    /Edg\/(\d+)/.exec(ua)?.slice(0, 2).join(' ').replace('Edg/', 'Edge ') ??
    (/Firefox\/(\d+)/.test(ua) ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}` : null) ??
    (/Chrome\/(\d+)/.test(ua) ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}` : null) ??
    (/Version\/(\d+).*Safari/.test(ua) ? `Safari ${/Version\/(\d+)/.exec(ua)![1]}` : null) ??
    'an unknown browser';
  const os = /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /(iPhone|iPad)/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'an unknown system';
  const screen = typeof window === 'undefined' ? '—' : `${window.innerWidth}×${window.innerHeight}`;
  const theme = typeof document === 'undefined' ? 'dark' : (document.documentElement.dataset.theme ?? 'dark');
  return { browser, os, screen, theme, build: import.meta.env.DEV ? 'dev build' : 'release' };
}
/** The environment on one line, the way the board prints it */
export const environmentLine = (e: Environment): string => `${e.browser} · ${e.os} · ${e.screen} · ${e.theme} theme · ${e.build}`;

/* ---- the board at launch --------------------------------------------------------------- */

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const reply = (id: string, author: string, d: number, text: string, team = false): FeedbackComment => ({ id, author, at: daysAgo(d), text, team });

const SEED: FeedbackItem[] = [
  {
    id: 'fb-1',
    kind: 'suggestion',
    title: 'Multi-timeframe strike ladder',
    category: 'chart',
    description: 'Show the strike ladder on 5m and 1h at once so a wall that holds on both reads stronger. Today I flip the timeframe and lose the read I had.',
    priority: 'important',
    status: 'planned',
    votes: 42,
    author: 'terrain_ok',
    createdAt: daysAgo(3),
    ticker: 'SPY',
    statusNote: 'Planned for the pane rework — the ladder already draws per pane, so the second timeframe is a second read of the same book.',
    comments: [reply('fb-1-c1', 'gamma_gwen', 2, 'Yes — a wall that holds on 5m and 1h is the only one I trade.'), reply('fb-1-c2', 'the team', 1, 'Planned. It rides the panel rework rather than a new surface.', true)],
  },
  {
    id: 'fb-2',
    kind: 'bug',
    title: 'Login loops back to the sign-in page on Safari',
    category: 'login/account',
    description: 'What I did: signed in on Safari 17 and entered the emailed code.\nWhat I expected: the terminal.\nWhat happened: back to the sign-in page, every time.\nHow often: always, except in a private window.',
    severity: 'blocks me',
    status: 'confirmed',
    votes: 32,
    author: 'mac_desk',
    createdAt: daysAgo(3),
    where: '/settings',
    environment: { browser: 'Safari 17', os: 'macOS', screen: '1512×944', theme: 'dark', build: 'release' },
    statusNote: 'Confirmed — the session cookie is dropped under ITP. The fix is in review.',
    comments: [reply('fb-2-c1', 'flow_fern', 2, 'Same here, Safari 17.4. Private window works.'), reply('fb-2-c2', 'the team', 2, 'Reproduced on 17.4 and 17.5.', true)],
  },
  {
    id: 'fb-3',
    kind: 'bug',
    title: 'Alerts drawer opens twice on Ctrl+K',
    category: 'alerts',
    description: 'What I did: pressed Ctrl+K while the drawer was already open.\nWhat I expected: nothing, or the drawer closing.\nWhat happened: a second drawer stacked over the first. Esc closes one at a time.',
    severity: 'has a workaround',
    status: 'fixing',
    votes: 18,
    author: 'noah',
    createdAt: daysAgo(1),
    where: 'overlay:alerts',
    environment: { browser: 'Chrome 141', os: 'Windows', screen: '1920×1080', theme: 'dark', build: 'release' },
    statusNote: 'In the fix — the shortcut toggles rather than opens.',
    comments: [],
  },
  {
    id: 'fb-4',
    kind: 'suggestion',
    title: 'Export the greek board as CSV with the sparkline points',
    category: 'trading data',
    description: 'The CSV carries the nets; add the last 40 points per strike so the history travels with it into a sheet.',
    priority: 'nice to have',
    status: 'new',
    votes: 12,
    author: 'quant_iv',
    createdAt: daysAgo(2),
    comments: [reply('fb-4-c1', 'blocks_only', 1, 'Would take this over another chart.')],
  },
  {
    id: 'fb-5',
    kind: 'suggestion',
    title: 'Dark pool shelves on the Terrain chart',
    category: 'chart',
    description: 'Draw the dark pool support and resistance shelves as overlays on the Terrain panes, the way the walls already draw.',
    priority: 'important',
    status: 'building',
    votes: 33,
    author: 'blocks_only',
    createdAt: daysAgo(4),
    ticker: 'NVDA',
    statusNote: 'Building — the shelves come off the same engine the Dark Pool page reads.',
    comments: [reply('fb-5-c1', 'the team', 1, 'In build. They draw as dashed rules so they never read as a gamma wall.', true)],
  },
  {
    id: 'fb-6',
    kind: 'suggestion',
    title: 'Keyboard shortcut for the next pane',
    category: 'ui/ux',
    description: 'Tab through the Terrain panes with a key so a four-chart desk never needs the mouse.',
    priority: 'nice to have',
    status: 'shipped',
    votes: 16,
    author: 'four_panes',
    createdAt: daysAgo(9),
    statusNote: 'Shipped — Tab moves to the next pane, Shift+Tab back.',
    comments: [reply('fb-6-c1', 'the team', 6, 'Shipped in the pane rework.', true)],
  },
  {
    id: 'fb-7',
    kind: 'bug',
    title: 'Replay keeps playing after leaving the page',
    category: 'performance',
    description: 'What I did: started a replay on the Map, went to Ahead, came back.\nWhat I expected: the transport where I left it.\nWhat happened: it had kept running, and the chart jumped to wherever it had got to.',
    severity: 'has a workaround',
    status: 'new',
    votes: 9,
    author: 'rewind',
    createdAt: daysAgo(1),
    where: '/pinpoint/map',
    environment: { browser: 'Chrome 141', os: 'macOS', screen: '1728×1117', theme: 'dark', build: 'release' },
    comments: [],
  },
  {
    id: 'fb-8',
    kind: 'suggestion',
    title: 'Trending tickers on the news map',
    category: 'new feature',
    description: 'Show which names the wire is loudest on as chips over the map, so the map says who as well as where.',
    priority: 'nice to have',
    status: 'new',
    votes: 7,
    author: 'wire_reader',
    createdAt: daysAgo(5),
    comments: [reply('fb-8-c1', 'macro_mae', 4, 'The community room does this already — same idea, different feed.')],
  },
  {
    id: 'fb-9',
    kind: 'bug',
    title: 'Candle wicks vanish on the light theme',
    category: 'chart',
    description: 'What I did: switched to the light theme on the Weigher chart.\nWhat I expected: to see the wicks.\nWhat happened: they are the same grey as the ground, so a doji reads as a gap.',
    severity: 'cosmetic',
    status: 'confirmed',
    votes: 11,
    author: 'lightmode',
    createdAt: daysAgo(6),
    where: '/weigher',
    environment: { browser: 'Firefox 132', os: 'Linux', screen: '2560×1440', theme: 'light', build: 'release' },
    statusNote: 'Confirmed, and it rides the light-theme pass rather than a one-off colour.',
    comments: [],
  },
  {
    id: 'fb-10',
    kind: 'suggestion',
    title: 'Position sizing from the expected move',
    category: 'trading data',
    description: 'Given a stop at the put wall, print the size that risks 1% of the account.',
    priority: 'important',
    status: 'declined',
    votes: 5,
    author: 'risk_first',
    createdAt: daysAgo(12),
    statusNote: 'Declined — sizing against an account balance is advice, and this terminal states facts. The distance to the wall is already printed; the size is yours.',
    comments: [reply('fb-10-c1', 'the team', 10, 'Declined, and the reason is in the note — not a no to the maths, a no to telling you what to risk.', true)],
  },
  {
    id: 'fb-11',
    kind: 'bug',
    title: 'Congress table sorts the dates as text',
    category: 'trading data',
    description: 'What I did: sorted the Congress table by when.\nWhat I expected: newest first.\nWhat happened: it sorted alphabetically, so April came before January.',
    severity: 'has a workaround',
    status: 'fixed',
    votes: 6,
    author: 'stockact',
    createdAt: daysAgo(11),
    where: '/record/congress',
    environment: { browser: 'Chrome 140', os: 'Windows', screen: '1680×1050', theme: 'dark', build: 'release' },
    statusNote: 'Fixed — the column sorts on the parsed date, and the header says so.',
    comments: [reply('fb-11-c1', 'the team', 8, 'Fixed. The WHEN column carries the real date now, not the printed one.', true)],
  },
  {
    id: 'fb-12',
    kind: 'bug',
    title: 'The terminal is slow with eight panes open',
    category: 'performance',
    description: 'What I did: opened eight Terrain panes.\nWhat I expected: it to keep up.\nWhat happened: everything crawls.',
    severity: 'cosmetic',
    status: 'not a bug',
    votes: 3,
    author: 'eight_panes',
    createdAt: daysAgo(14),
    where: '/terrain',
    statusNote: 'Not a bug — four panes is the designed maximum and the eighth was a second window. Worth saying plainly rather than leaving it open: we are not going to make eight fast.',
    comments: [],
  },
];
const SEED_BY_ID = new Map(SEED.map(i => [i.id, i]));

/* ---- what is kept ---------------------------------------------------------------------- */

const KEY = 'slayer_feedback';
const VOTES_KEY = 'slayer_feedback_votes';
const COMMENTS_KEY = 'slayer_feedback_comments';
const pics = pictureStore('slayer_feedback_images');

type Threads = Record<string, FeedbackComment[]>;

/*
  YOUR VOTES ARE A LIST OF IDS, not a map of directions.

  There is no voting down any more: on a suggestion the arrow was support and
  the counter-arrow was nothing anybody could act on, and on a bug "12 have
  this too" cannot go negative at all. An older browser may still hold the map
  this replaced, so it is read either way and the downvotes in it are dropped.
*/
function loadVotes(): string[] {
  const raw = readJson<unknown>(VOTES_KEY, []);
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (raw && typeof raw === 'object') return Object.entries(raw as Record<string, number>).filter(([, v]) => v === 1).map(([k]) => k);
  return [];
}

let mine: FeedbackItem[] = (() => {
  const v = readJson<FeedbackItem[]>(KEY, []);
  return Array.isArray(v) ? v.map(i => ({ ...i, comments: Array.isArray(i.comments) ? i.comments : [] })) : [];
})();
let votes: string[] = loadVotes();
let threads: Threads = readJson<Threads>(COMMENTS_KEY, {});
let version = 0;

const listeners = new Set<() => void>();
const emit = () => {
  version++;
  for (const l of listeners) l();
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
/** True when everything reached storage — `submitFeedback` says so when not */
const persist = (): boolean => {
  const a = writeKey(KEY, mine);
  const b = writeKey(VOTES_KEY, votes);
  const c = writeKey(COMMENTS_KEY, threads);
  const d = pics.write();
  return a && b && c && d;
};

/** An entry as the screen shows it: the base, plus your vote once, your
    replies, and the screenshots behind their ids */
const withMine = (base: FeedbackItem): FeedbackItem => {
  const mineVote = votes.includes(base.id) ? 1 : 0;
  const added = threads[base.id] ?? [];
  const shots = base.attachments?.length ? pics.show(base.attachments) : undefined;
  if (!mineVote && added.length === 0 && !shots) return base;
  return {
    ...base,
    votes: base.votes + mineVote,
    comments: added.length ? [...base.comments, ...added] : base.comments,
    attachments: shots ?? base.attachments,
  };
};

/* ---- reads ------------------------------------------------------------------------------ */

/** Every entry on the board, yours first, each carrying your vote and replies */
export const getFeedback = (): FeedbackItem[] => [...mine, ...SEED].map(withMine);
const getVersion = () => version;
export const useFeedbackVersion = (): number => useSyncExternalStore(subscribe, getVersion, getVersion);
export const useFeedback = (): FeedbackItem[] => {
  useFeedbackVersion();
  return getFeedback();
};
export const getVotes = (): string[] => votes;
export const useVotes = (): string[] => {
  useFeedbackVersion();
  return votes;
};
export const voted = (id: string): boolean => votes.includes(id);
export const feedbackById = (id: string): FeedbackItem | null => getFeedback().find(i => i.id === id) ?? null;

/* ---- saying the same thing twice -------------------------------------------------------- */

/*
  THE BIGGEST HOLE THIS BOARD HAD: nothing stopped the same ask arriving five
  times. At ten entries that is invisible; at two hundred it is the difference
  between one ask at 40 votes — which gets built — and five at 8, which look
  like nobody cares. So the board is searchable, and while a title is being
  typed the nearest things already on it are offered with a way to support one
  instead of filing another.

  The measure is word overlap: how much of the shorter title's vocabulary the
  longer one shares, with the small words that carry no meaning dropped, plus
  a lift when one title contains the other outright.
*/
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'when', 'from', 'into', 'onto', 'are', 'was', 'not', 'but', 'you', 'your', 'its', 'have', 'has', 'can', 'add', 'should', 'would', 'please']);
const wordsOf = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));

/** 0..1 — how much two titles say the same thing */
export function similarity(a: string, b: string): number {
  const A = new Set(wordsOf(a));
  const B = new Set(wordsOf(b));
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  const overlap = shared / Math.min(A.size, B.size);
  const inside = a.trim().length > 3 && b.toLowerCase().includes(a.trim().toLowerCase()) ? 0.35 : 0;
  return Math.min(1, overlap + inside);
}

/** What is already on the board that this title might be a second copy of */
export function nearest(title: string, kind: FeedbackKind, limit = 3): { item: FeedbackItem; score: number }[] {
  if (wordsOf(title).length === 0) return [];
  return getFeedback()
    .filter(i => i.kind === kind && i.author !== 'you')
    .map(item => ({ item, score: similarity(title, item.title) }))
    .filter(x => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** The board, searched — the title, the description and the name on it */
export function search(items: FeedbackItem[], query: string): FeedbackItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const terms = q.split(/\s+/);
  return items.filter(i => {
    const hay = `${i.title} ${i.description} ${i.category} ${i.ticker ?? ''} ${i.where ? pageLabel(i.where) : ''} ${i.status}`.toLowerCase();
    return terms.every(t => hay.includes(t));
  });
}

/* ---- writes ------------------------------------------------------------------------------ */

export interface Draft {
  kind: FeedbackKind;
  title: string;
  category: FeedbackCategory;
  description: string;
  severity?: Severity;
  ticker?: string;
  where?: string;
  environment?: Environment;
  /** Data URLs, already shrunk — they are kept apart and become ids */
  screenshots?: string[];
}

export function submitFeedback(draft: Draft): FeedbackItem | string {
  const title = draft.title.trim();
  const description = draft.description.trim();
  if (title.length < 4) return 'Give it a title of at least four characters.';
  if (description.length < 10) return 'Say a little more — ten characters at least.';
  const wasMine = mine;
  const wasVotes = votes;
  const wasPics = pics.snapshot();
  const item: FeedbackItem = {
    id: `you-${Date.now()}`,
    kind: draft.kind,
    title,
    category: draft.category,
    description,
    severity: draft.kind === 'bug' ? (draft.severity ?? 'has a workaround') : undefined,
    ticker: draft.ticker?.trim() ? draft.ticker.trim().toUpperCase() : undefined,
    where: draft.kind === 'bug' ? draft.where : undefined,
    environment: draft.kind === 'bug' ? draft.environment : undefined,
    attachments: draft.screenshots?.length ? pics.keep(draft.screenshots, 'fb') : undefined,
    status: 'new',
    votes: 1,
    comments: [],
    author: getAccount().handle,
    createdAt: new Date().toISOString(),
  };
  mine = [item, ...mine];
  /* Your own entry carries your vote in its count already — no second +1 */
  if (!persist()) {
    mine = wasMine;
    votes = wasVotes;
    pics.restore(wasPics);
    persist();
    emit();
    return draft.screenshots?.length ? 'This browser has no room left for those screenshots — try it with fewer.' : 'This browser has no room left to keep that.';
  }
  emit();
  return withMine(item);
}

/** Support it, or take your support back. There is no voting anything down. */
export function voteFeedback(id: string): void {
  const own = mine.find(i => i.id === id);
  const had = votes.includes(id);
  if (own) {
    /* your own entry has no seed under it — the count is the thing itself */
    mine = mine.map(i => (i.id === id ? { ...i, votes: Math.max(0, i.votes + (had ? -1 : 1)) } : i));
  } else if (!SEED_BY_ID.has(id)) {
    return;
  }
  votes = had ? votes.filter(v => v !== id) : [...votes, id];
  persist();
  emit();
}

/** Add a reply — on your entry or a seeded one; kept either way */
export function commentOnFeedback(id: string, text: string): string | null {
  const body = text.trim();
  if (body.length < 2) return 'Say something first.';
  if (!SEED_BY_ID.has(id) && !mine.some(i => i.id === id)) return 'That entry is gone.';
  const c: FeedbackComment = { id: `c-${Date.now()}`, author: getAccount().handle, at: new Date().toISOString(), text: body };
  threads = { ...threads, [id]: [...(threads[id] ?? []), c] };
  persist();
  emit();
  return null;
}

/* ---- the counts the head prints --------------------------------------------------------- */

export interface FeedbackTally {
  all: number;
  suggestions: number;
  bugs: number;
  /** Every status on the board with at least one entry, in the order it is lived */
  byStatus: { status: FeedbackStatus; count: number }[];
}
export function tally(items: FeedbackItem[]): FeedbackTally {
  const order: FeedbackStatus[] = ['new', 'under review', 'confirmed', 'planned', 'fixing', 'building', 'shipped', 'fixed', 'declined', 'cannot reproduce', 'not a bug'];
  const counts = new Map<FeedbackStatus, number>();
  for (const i of items) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
  return {
    all: items.length,
    suggestions: items.filter(i => i.kind === 'suggestion').length,
    bugs: items.filter(i => i.kind === 'bug').length,
    byStatus: order.filter(s => counts.has(s)).map(s => ({ status: s, count: counts.get(s)! })),
  };
}
