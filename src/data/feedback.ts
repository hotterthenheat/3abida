/*
==================================================
  SLAYER TERMINAL - FEEDBACK AND BUGS
  (data/feedback.ts)

  Suggestions and bug reports, the way the mockup
  reads them (Noah, 2026-09-13): every entry a
  title, a kind (a suggestion or a bug), a
  category, a description, a priority, a name if it
  is about one, an attachment or two, a status the
  team sets, the votes, and a thread of comments.

  WHAT IS KEPT AND HOW (the logic fix, 2026-09-13 —
  the first cut wrote back only your own entries,
  so a vote or a comment on a SEEDED entry lived
  until the next reload and then vanished while the
  arrow stayed lit). Three things are stored, each
  on its own key:

    your entries      the ones you wrote, whole
    your votes        id → +1 / −1, and the seeded
                      entry's count is the seed's
                      plus your vote, worked out on
                      every read — never a number
                      saved twice
    your comments     id → the replies you added,
                      merged onto the seed's own

  So a reload prints exactly what the screen printed
  before it: the count includes your vote once, and
  your comment is still on the thread.
==================================================
*/

import { useSyncExternalStore } from 'react';

export type FeedbackKind = 'suggestion' | 'bug';
export type FeedbackStatus = 'new' | 'under review' | 'planned' | 'building' | 'shipped' | 'declined';
export type FeedbackPriority = 'nice to have' | 'important' | 'critical';
export const CATEGORIES = ['new feature', 'performance', 'ui/ux', 'chart', 'trading data', 'alerts', 'login/account', 'billing', 'other'] as const;
export type FeedbackCategory = (typeof CATEGORIES)[number];

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
  priority: FeedbackPriority;
  ticker?: string;
  attachments?: string[];
  status: FeedbackStatus;
  votes: number;
  comments: FeedbackComment[];
  author: string;
  createdAt: string;
  /** Bugs: where it happened */
  where?: string;
  /** The team's note on the status — why planned, why declined */
  statusNote?: string;
}

const KEY = 'slayer_feedback';
const VOTES_KEY = 'slayer_feedback_votes';
const COMMENTS_KEY = 'slayer_feedback_comments';

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const reply = (id: string, author: string, d: number, text: string, team = false): FeedbackComment => ({ id, author, at: daysAgo(d), text, team });

/* ---- the board at launch ------------------------------------------------------------ */

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
    title: 'Login error on Safari',
    category: 'login/account',
    description: 'Signing in on Safari 17 loops back to the sign-in page after the code. Chrome is fine on the same machine.',
    priority: 'critical',
    status: 'under review',
    votes: 32,
    author: 'mac_desk',
    createdAt: daysAgo(3),
    where: 'login/account',
    comments: [reply('fb-2-c1', 'flow_fern', 2, 'Same here, Safari 17.4. Private window works.'), reply('fb-2-c2', 'the team', 2, 'Reproduced — the session cookie is dropped under ITP. Fix in review.', true)],
  },
  {
    id: 'fb-3',
    kind: 'bug',
    title: 'Alerts drawer opens twice on Ctrl+K',
    category: 'alerts',
    description: 'Pressing Ctrl+K while the drawer is open stacks a second drawer over the first. Esc closes one at a time.',
    priority: 'important',
    status: 'under review',
    votes: 18,
    author: 'noah',
    createdAt: daysAgo(1),
    where: 'alerts',
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
    title: 'Replay strip keeps playing after leaving the page',
    category: 'performance',
    description: 'Start a replay on the Map, go to Ahead, come back: the transport is still running and the chart jumps to where it got to.',
    priority: 'important',
    status: 'new',
    votes: 9,
    author: 'rewind',
    createdAt: daysAgo(1),
    where: 'pinpoint/map',
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
    title: 'Light theme: the candle wicks vanish on the Weigher chart',
    category: 'chart',
    description: 'On the light theme the wicks are the same grey as the ground, so a doji reads as a gap.',
    priority: 'nice to have',
    status: 'planned',
    votes: 11,
    author: 'lightmode',
    createdAt: daysAgo(6),
    where: 'weigher',
    statusNote: 'Planned with the light-theme pass.',
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
];
const SEED_BY_ID = new Map(SEED.map(i => [i.id, i]));

/* ---- what is kept ------------------------------------------------------------------- */

type Votes = Record<string, 1 | -1>;
type Threads = Record<string, FeedbackComment[]>;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* no storage, or a bad entry — the fallback */
  }
  return fallback;
};

let mine: FeedbackItem[] = (() => {
  const v = readJson<FeedbackItem[]>(KEY, []);
  return Array.isArray(v) ? v.map(i => ({ ...i, comments: Array.isArray(i.comments) ? i.comments : [] })) : [];
})();
let votes: Votes = readJson<Votes>(VOTES_KEY, {});
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
const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(mine));
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(threads));
  } catch {
    /* storage may be off — the board still lives for the session */
  }
};

/** An entry as the screen shows it: the base, plus your vote once and your replies */
const withMine = (base: FeedbackItem): FeedbackItem => {
  const vote = votes[base.id] ?? 0;
  const added = threads[base.id] ?? [];
  if (!vote && added.length === 0) return base;
  return { ...base, votes: base.votes + vote, comments: added.length ? [...base.comments, ...added] : base.comments };
};

/* ---- reads ---------------------------------------------------------------------------- */

/** Every entry on the board, yours first, each carrying your vote and your replies */
export const getFeedback = (): FeedbackItem[] => [...mine, ...SEED].map(withMine);
const getVersion = () => version;
/** Re-renders on every change — the board is read through getFeedback */
export const useFeedbackVersion = (): number => useSyncExternalStore(subscribe, getVersion, getVersion);
export const useFeedback = (): FeedbackItem[] => {
  useFeedbackVersion();
  return getFeedback();
};
export const getVotes = (): Votes => votes;
export const useVotes = (): Votes => {
  useFeedbackVersion();
  return votes;
};
export const feedbackById = (id: string): FeedbackItem | null => getFeedback().find(i => i.id === id) ?? null;

/* ---- writes --------------------------------------------------------------------------- */

export function submitFeedback(entry: Omit<FeedbackItem, 'id' | 'status' | 'votes' | 'comments' | 'author' | 'createdAt'>): FeedbackItem {
  const item: FeedbackItem = { ...entry, id: `you-${Date.now()}`, status: 'new', votes: 1, comments: [], author: 'you', createdAt: new Date().toISOString() };
  mine = [item, ...mine];
  /* your own entry carries your vote in its count already — no second +1 */
  persist();
  emit();
  return item;
}

/** Vote up or down; the same arrow again takes the vote back */
export function voteFeedback(id: string, dir: 1 | -1): void {
  /* your own entry: the count is yours to move, and there is no seed under it */
  const own = mine.find(i => i.id === id);
  const had = votes[id] ?? 0;
  const next: 1 | -1 | 0 = had === dir ? 0 : dir;
  if (own) {
    mine = mine.map(i => (i.id === id ? { ...i, votes: Math.max(0, i.votes - had + next) } : i));
  } else if (!SEED_BY_ID.has(id)) {
    return;
  }
  votes = { ...votes };
  if (next === 0) delete votes[id];
  else votes[id] = next;
  persist();
  emit();
}

/** Add a reply — on your entry or a seeded one; kept either way */
export function commentOnFeedback(id: string, text: string, author = 'you'): string | null {
  const body = text.trim();
  if (body.length < 2) return 'Say something first.';
  if (!SEED_BY_ID.has(id) && !mine.some(i => i.id === id)) return 'That entry is gone.';
  const c: FeedbackComment = { id: `c-${Date.now()}`, author, at: new Date().toISOString(), text: body };
  threads = { ...threads, [id]: [...(threads[id] ?? []), c] };
  persist();
  emit();
  return null;
}

/** The board's own counts — the head prints them */
export interface FeedbackTally {
  all: number;
  suggestions: number;
  bugs: number;
  planned: number;
  building: number;
  shipped: number;
}
export const tally = (items: FeedbackItem[]): FeedbackTally => ({
  all: items.length,
  suggestions: items.filter(i => i.kind === 'suggestion').length,
  bugs: items.filter(i => i.kind === 'bug').length,
  planned: items.filter(i => i.status === 'planned').length,
  building: items.filter(i => i.status === 'building').length,
  shipped: items.filter(i => i.status === 'shipped').length,
});
