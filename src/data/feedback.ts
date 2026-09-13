/*
==================================================
  SLAYER TERMINAL - FEEDBACK AND BUGS
  (data/feedback.ts)

  Suggestions and bug reports, the way the mockup
  reads them (Noah, 2026-09-13): every entry a
  title, a kind (a suggestion or a bug), a
  category, a description, a priority, a name if
  it is about one, an attachment or two, a status
  the team sets, and the votes. Seeded with the
  entries the board carried at launch; what you
  submit and how you vote lives in this browser
  until accounts launch. One store, read with
  useSyncExternalStore.
==================================================
*/

import { useSyncExternalStore } from 'react';

export type FeedbackKind = 'suggestion' | 'bug';
export type FeedbackStatus = 'new' | 'under review' | 'planned' | 'building' | 'shipped' | 'declined';
export type FeedbackPriority = 'nice to have' | 'important' | 'critical';
export const CATEGORIES = ['new feature', 'performance', 'ui/ux', 'chart', 'trading data', 'alerts', 'login/account', 'billing', 'other'] as const;
export type FeedbackCategory = (typeof CATEGORIES)[number];

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
  comments: number;
  author: string;
  createdAt: string;
  /** Bugs: where it happened */
  where?: string;
}

const KEY = 'slayer_feedback';
const VOTES_KEY = 'slayer_feedback_votes';

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const SEED: FeedbackItem[] = [
  { id: 'fb-1', kind: 'suggestion', title: 'Multi-timeframe strike ladder', category: 'chart', description: 'Show the strike ladder on 5m and 1h at once so a wall that holds on both reads stronger.', priority: 'important', status: 'planned', votes: 42, comments: 9, author: 'terrain_ok', createdAt: daysAgo(3), ticker: 'SPY' },
  { id: 'fb-2', kind: 'bug', title: 'Login error on Safari', category: 'login/account', description: 'Signing in on Safari 17 loops back to the sign-in page after the code.', priority: 'critical', status: 'under review', votes: 32, comments: 4, author: 'mac_desk', createdAt: daysAgo(3), where: 'login/account' },
  { id: 'fb-3', kind: 'bug', title: 'Alerts drawer opens twice on Ctrl+K', category: 'alerts', description: 'Pressing Ctrl+K while the drawer is open stacks a second drawer.', priority: 'important', status: 'under review', votes: 18, comments: 2, author: 'noah', createdAt: daysAgo(1), where: 'alerts' },
  { id: 'fb-4', kind: 'suggestion', title: 'Export the greek board as CSV with the sparkline points', category: 'trading data', description: 'The CSV carries the nets; add the last 40 points per strike so the history travels with it.', priority: 'nice to have', status: 'new', votes: 12, comments: 1, author: 'quant_iv', createdAt: daysAgo(2) },
  { id: 'fb-5', kind: 'suggestion', title: 'Dark pool shelves on the Terrain chart', category: 'chart', description: 'Draw the dark pool support and resistance shelves as overlays on the Terrain panes.', priority: 'important', status: 'building', votes: 33, comments: 6, author: 'blocks_only', createdAt: daysAgo(4), ticker: 'NVDA' },
  { id: 'fb-6', kind: 'suggestion', title: 'Keyboard shortcut for the next pane', category: 'ui/ux', description: 'Tab through the Terrain panes with a key so a four-chart desk never needs the mouse.', priority: 'nice to have', status: 'shipped', votes: 16, comments: 3, author: 'four_panes', createdAt: daysAgo(9) },
  { id: 'fb-7', kind: 'bug', title: 'Replay strip keeps playing after leaving the page', category: 'performance', description: 'Start a replay on the Map, go to Ahead, come back: the transport is still running and the chart jumps.', priority: 'important', status: 'new', votes: 9, comments: 0, author: 'rewind', createdAt: daysAgo(1), where: 'pinpoint/map' },
  { id: 'fb-8', kind: 'suggestion', title: 'Trending tickers on the news map', category: 'new feature', description: 'Show which names the wire is loudest on as chips over the map.', priority: 'nice to have', status: 'new', votes: 7, comments: 2, author: 'wire_reader', createdAt: daysAgo(5) },
  { id: 'fb-9', kind: 'bug', title: 'Light theme: the candle wicks vanish on the Weigher chart', category: 'chart', description: 'On the light theme the wicks are the same grey as the ground.', priority: 'nice to have', status: 'planned', votes: 11, comments: 1, author: 'lightmode', createdAt: daysAgo(6), where: 'weigher' },
  { id: 'fb-10', kind: 'suggestion', title: 'Position sizing from the expected move', category: 'trading data', description: 'Given a stop at the put wall, print the size that risks 1% of the account.', priority: 'important', status: 'declined', votes: 5, comments: 4, author: 'risk_first', createdAt: daysAgo(12) },
];

const load = (): FeedbackItem[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const mine = JSON.parse(raw) as FeedbackItem[];
      if (Array.isArray(mine)) return [...mine, ...SEED];
    }
  } catch {
    /* no storage — the seed alone */
  }
  return [...SEED];
};
const loadVotes = (): Record<string, 1 | -1> => {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, 1 | -1>;
  } catch {
    /* none */
  }
  return {};
};

let items: FeedbackItem[] = load();
let votes: Record<string, 1 | -1> = loadVotes();
const listeners = new Set<() => void>();
const emit = () => {
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
    localStorage.setItem(KEY, JSON.stringify(items.filter(i => i.author === 'you')));
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  } catch {
    /* storage may be off */
  }
};

export const getFeedback = (): FeedbackItem[] => items;
export const useFeedback = (): FeedbackItem[] => useSyncExternalStore(subscribe, getFeedback, getFeedback);
export const getVotes = (): Record<string, 1 | -1> => votes;
export const useVotes = (): Record<string, 1 | -1> => useSyncExternalStore(subscribe, getVotes, getVotes);

export function submitFeedback(entry: Omit<FeedbackItem, 'id' | 'status' | 'votes' | 'comments' | 'author' | 'createdAt'>): FeedbackItem {
  const item: FeedbackItem = { ...entry, id: `you-${Date.now()}`, status: 'new', votes: 1, comments: 0, author: 'you', createdAt: new Date().toISOString() };
  items = [item, ...items];
  votes = { ...votes, [item.id]: 1 };
  persist();
  emit();
  return item;
}

/** Vote up or down; the same vote again takes it back */
export function voteFeedback(id: string, dir: 1 | -1): void {
  const had = votes[id] ?? 0;
  const next = had === dir ? 0 : dir;
  items = items.map(i => (i.id === id ? { ...i, votes: i.votes - had + next } : i));
  votes = { ...votes };
  if (next === 0) delete votes[id];
  else votes[id] = next;
  persist();
  emit();
}

export const timeAgo = (iso: string): string => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};
