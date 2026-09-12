/*
==================================================
  SLAYER TERMINAL - COMMUNITY STORE (community.ts)
  Seeded content + localStorage persistence. Runs
  locally until accounts land; the shapes here are
  the future API contract.
==================================================
*/

import type {
  CommunityIdea,
  FeatureRequest,
  FeedbackEntry,
} from '../types/community';

const STORAGE_KEY = 'slayer_community_v1';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

// ---- seeds ------------------------------------------------------------------
export const SEED_IDEAS: CommunityIdea[] = [
  {
    id: 'seed-i1',
    author: 'gammahunter',
    ticker: 'SPY',
    direction: 'BULLISH',
    thesis: 'Holding above the flip with the 500 put wall directly below — dips into 500 should get bought by dealers. Looking for a grind toward the 505 call wall.',
    votes: 24,
    createdAt: hoursAgo(3),
  },
  {
    id: 'seed-i2',
    author: 'thetadecay',
    ticker: 'NVDA',
    direction: 'BEARISH',
    thesis: 'Rejected the call wall twice this week and 0DTE flow flipped to put buying after lunch. Fading rips while it stays below 122.',
    votes: 18,
    createdAt: hoursAgo(6),
  },
  {
    id: 'seed-i3',
    author: 'pinrisk',
    ticker: 'QQQ',
    direction: 'BULLISH',
    thesis: 'Pin sitting right at 440 into Friday — expecting price to get dragged back to it on any morning flush. Long the dip, exit at the pin.',
    votes: 11,
    createdAt: hoursAgo(9),
  },
  {
    id: 'seed-i4',
    author: 'wallwatcher',
    ticker: 'TSLA',
    direction: 'BEARISH',
    thesis: 'Dark pool prints stacking below spot and the biggest strike by volume is a put. Not fighting that combination.',
    votes: 7,
    createdAt: hoursAgo(26),
  },
];

export const SEED_REQUESTS: FeatureRequest[] = [
  {
    id: 'seed-r1',
    author: 'scalpking',
    title: 'Price alerts when a wall breaks',
    detail: 'Push/browser alert the moment spot trades through the call or put wall with force — the exact moment the map says momentum.',
    kind: 'FEATURE',
    status: 'PLANNED',
    votes: 42,
    createdAt: hoursAgo(72),
  },
  {
    id: 'seed-r2',
    author: 'mobileandy',
    title: 'Mobile companion app',
    detail: 'Read-only levels + alerts on the phone. I do not need the full terminal, just the walls, flip and my tracked setups.',
    kind: 'PRODUCT',
    status: 'UNDER REVIEW',
    votes: 35,
    createdAt: hoursAgo(120),
  },
  {
    id: 'seed-r3',
    author: 'deskbuilder',
    title: 'Named desk layouts',
    detail: 'Save more than one Pulse layout — one desk for the open, one for lunch chop, one for the close.',
    kind: 'IMPROVEMENT',
    status: 'BUILDING',
    votes: 28,
    createdAt: hoursAgo(48),
  },
  {
    id: 'seed-r4',
    author: 'sectorsam',
    title: 'Dark pool sector filters',
    detail: 'Filter the dark pool feed by sector so I can watch just tech or just financials.',
    kind: 'FEATURE',
    status: 'PLANNED',
    votes: 19,
    createdAt: hoursAgo(90),
  },
  {
    id: 'seed-r5',
    author: 'spreadtrader',
    title: 'Multi-leg strategy builder',
    detail: 'Build spreads against the exposure map — show me how my structure sits against the walls.',
    kind: 'PRODUCT',
    status: 'UNDER REVIEW',
    votes: 16,
    createdAt: hoursAgo(200),
  },
  {
    id: 'seed-r6',
    author: 'deskbuilder',
    title: 'Custom desk layouts',
    detail: 'Let me arrange my own panels instead of fixed pages.',
    kind: 'FEATURE',
    status: 'SHIPPED',
    votes: 51,
    createdAt: hoursAgo(400),
  },
];

/** Real changes that came from user input — the feedback loop, closed. */
export const SHIPPED_FROM_FEEDBACK: { title: string; note: string }[] = [
  { title: 'Custom desk layouts', note: 'Build your own desk from any panels — that is Pulse now.' },
  { title: 'Readability pass', note: 'Brighter text, bigger numbers — labels whisper, data does not.' },
  { title: 'Plain-English copy', note: 'Buzzwords removed across the terminal.' },
  { title: 'Live tape filters', note: 'Flow type, sentiment and minimum premium filters on the tape.' },
];

// ---- persistence ---------------------------------------------------------------
export interface CommunityState {
  ideas: CommunityIdea[];
  requests: FeatureRequest[];
  feedback: FeedbackEntry[];
  /** ids the local user has voted for (ideas + requests) */
  voted: string[];
}

export function loadCommunity(): CommunityState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ideas: SEED_IDEAS, requests: SEED_REQUESTS, feedback: [], voted: [] };
    const parsed = JSON.parse(raw) as CommunityState;
    return {
      ideas: Array.isArray(parsed.ideas) && parsed.ideas.length ? parsed.ideas : SEED_IDEAS,
      requests: Array.isArray(parsed.requests) && parsed.requests.length ? parsed.requests : SEED_REQUESTS,
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
      voted: Array.isArray(parsed.voted) ? parsed.voted : [],
    };
  } catch {
    return { ideas: SEED_IDEAS, requests: SEED_REQUESTS, feedback: [], voted: [] };
  }
}

export function saveCommunity(state: CommunityState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** "3h ago" style relative time. */
export function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
