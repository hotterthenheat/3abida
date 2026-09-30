/*
==================================================
  SLAYER TERMINAL - THE ROOM (data/room.ts)
  The community's one room (2026-09-13; Noah, with
  his partner's page: "basically a community
  chatroom… when users @ specific tickers it pops
  up on a box of trending things"): the people,
  the seeded posts, the reader's own posts and
  marks in this browser, and the room's small
  engines — what a post mentions, what is trending
  in the last day, what a setup settled for and
  the record a person builds. Plain data out; the
  page draws the doors.
==================================================
*/

import type { Lean, Notice, Person, Post, RoomState, Setup } from '../types/room';

/** The reader's own posts carry this handle; the page draws the profile for it */
export const ME = 'me';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => minutesAgo(h * 60);

// ---- the people ----------------------------------------------------------------

export const PEOPLE: Person[] = [
  { handle: 'gamma_gwen', name: 'Gwen Tao', verified: true, followers: 12400, line: 'Same-day money, the flip first' },
  { handle: 'zero_dte_zed', name: 'Zed Marlow', verified: true, followers: 8900, line: 'The index, nothing else' },
  { handle: 'pin_risk', name: 'Priya Nair', verified: true, followers: 5200, line: 'Pins and the close' },
  { handle: 'quant_iv', name: 'Marcus Feld', verified: false, followers: 3400, line: 'Vol surfaces, no opinions' },
  { handle: 'terrain_ok', name: 'Lena Okafor', verified: false, followers: 2100, line: 'Dark pool shelves' },
  { handle: 'swing_sam', name: 'Sam Reyes', verified: false, followers: 1900, line: 'Swings off the walls' },
  { handle: 'earnings_eli', name: 'Eli Brandt', verified: false, followers: 1000, line: 'The report, not the rumour' },
];

const byHandle = new Map(PEOPLE.map(p => [p.handle, p]));
/** Null for the reader — the page draws the profile instead */
export const personOf = (handle: string): Person | null => byHandle.get(handle) ?? null;

export const fmtFollowers = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

// ---- the seeded room -----------------------------------------------------------

const setup = (s: Setup): Setup => s;

export const SEED_POSTS: Post[] = [
  {
    id: 's1',
    handle: 'terrain_ok',
    at: minutesAgo(58),
    body: 'The dark pool printed 3M shares at 488.01 on $NVDA — that shelf has held twice this week.',
    likes: 33,
    replies: [],
  },
  {
    id: 's2',
    handle: 'zero_dte_zed',
    at: minutesAgo(64),
    body: 'Every wall on $IWM is inside one expected move today. That is not structure, that is noise. Trade the index instead.',
    likes: 33,
    replies: [{ id: 's2r1', handle: 'quant_iv', at: minutesAgo(40), body: 'Same read. The book is thin under 215 — nothing to lean on.' }],
  },
  {
    id: 's3',
    handle: 'gamma_gwen',
    at: minutesAgo(71),
    body: 'Every same-day trader should read the flip before the open. $SPY flip at 487.50, spot 488.01. That is the whole plan.',
    likes: 35,
    replies: [{ id: 's3r1', handle: 'swing_sam', at: minutesAgo(50), body: 'And the put wall at 485 under it. Two lines, one plan.' }],
  },
  {
    id: 's4',
    handle: 'swing_sam',
    at: hoursAgo(3),
    body: '$META put wall drained $180M since the open. If it goes, 480 is the next shelf.',
    lean: 'BEARISH',
    likes: 127,
    replies: [
      { id: 's4r1', handle: 'terrain_ok', at: hoursAgo(2.6), body: 'Dark prints under 486 all morning agree with you.' },
      { id: 's4r2', handle: 'pin_risk', at: hoursAgo(2.1), body: 'Watch 485 into the close — the pin has not moved.' },
      { id: 's4r3', handle: 'zero_dte_zed', at: hoursAgo(1.8), body: 'Same-day puts three to one on 485. The desk is leaning on it.' },
    ],
  },
  {
    id: 's5',
    handle: 'gamma_gwen',
    at: hoursAgo(3.2),
    body: '$AVGO bullish two weeks. Buying the put wall hold at 173.75, target the call wall 180, out under 172.5.',
    lean: 'BULLISH',
    setup: setup({
      ticker: 'AVGO',
      lean: 'BULLISH',
      entry: 173.75,
      target: 180,
      stop: 172.5,
      timeframe: '2 weeks',
      state: 'TARGET HIT',
      settledAt: 180,
      events: [
        { at: hoursAgo(2), kind: 'STOP MOVED', note: 'Stop moved to breakeven.' },
        { at: minutesAgo(17), kind: 'TARGET HIT', note: 'Target hit. Flat.' },
      ],
    }),
    likes: 88,
    replies: [
      { id: 's5r1', handle: 'earnings_eli', at: hoursAgo(1), body: 'Clean. The call wall never moved once it printed.' },
      { id: 's5r2', handle: 'quant_iv', at: minutesAgo(30), body: 'Five R on a two-week hold. That is the record talking.' },
    ],
  },
  {
    id: 's6',
    handle: 'pin_risk',
    at: hoursAgo(4),
    body: '$AAPL pinned to 230 three Fridays running. The 232.5 call wall is where the pin lives this week.',
    lean: 'BULLISH',
    likes: 41,
    replies: [],
  },
  {
    id: 's7',
    handle: 'quant_iv',
    at: hoursAgo(5),
    body: '$QQQ skew steepened into the close — puts bid, calls offered. Someone paid up for the downside.',
    lean: 'BEARISH',
    likes: 29,
    replies: [],
  },
  {
    id: 's8',
    handle: 'earnings_eli',
    at: hoursAgo(6),
    body: '$MSFT reports Thursday after the bell. The implied move is 4.1%; the last eight averaged 3.2%. Rich.',
    likes: 18,
    replies: [],
  },
  {
    id: 's9',
    handle: 'swing_sam',
    at: hoursAgo(7),
    body: '$NVDA long off the 118 put wall, target the 124 call wall, stop 116. Two weeks.',
    lean: 'BULLISH',
    setup: setup({ ticker: 'NVDA', lean: 'BULLISH', entry: 118, target: 124, stop: 116, timeframe: '2 weeks', state: 'OPEN', events: [] }),
    likes: 54,
    replies: [{ id: 's9r1', handle: 'terrain_ok', at: hoursAgo(6), body: 'The 118 shelf has the dark dollars behind it. Agree.' }],
  },
  {
    id: 's10',
    handle: 'zero_dte_zed',
    at: hoursAgo(9),
    body: '$COIN same-day puts running three to one over calls at the 210 strike. The desk is leaning on it.',
    lean: 'BEARISH',
    likes: 22,
    replies: [],
  },
  {
    id: 's11',
    handle: 'terrain_ok',
    at: hoursAgo(11),
    body: '$TSLA dark prints stacking under spot all morning. An accumulation shelf at 241.',
    lean: 'BULLISH',
    likes: 37,
    replies: [],
  },
  {
    id: 's12',
    handle: 'pin_risk',
    at: hoursAgo(14),
    body: '$META short from 495 into the 480 shelf, stop 499. One week.',
    lean: 'BEARISH',
    setup: setup({
      ticker: 'META',
      lean: 'BEARISH',
      entry: 495,
      target: 480,
      stop: 499,
      timeframe: '1 week',
      state: 'STOPPED',
      settledAt: 499,
      events: [{ at: hoursAgo(13), kind: 'STOPPED', note: 'Stopped at 499. The wall moved up.' }],
    }),
    likes: 19,
    replies: [],
  },
  {
    id: 's13',
    handle: 'gamma_gwen',
    at: hoursAgo(18),
    body: '$GOOGL charm into the bell — dealers sell the last hour. Every day this week.',
    lean: 'BEARISH',
    likes: 44,
    replies: [],
  },
  {
    id: 's14',
    handle: 'earnings_eli',
    at: hoursAgo(22),
    body: '$TSLA deliveries next week. The straddle already prices 7%.',
    likes: 15,
    replies: [],
  },
];

export const SEED_NOTICES: Notice[] = [
  { id: 'n1', handle: 'gamma_gwen', what: 'updated $AVGO: Target hit. Flat.', at: minutesAgo(17) },
  { id: 'n2', handle: 'gamma_gwen', what: 'posted', at: minutesAgo(71) },
  { id: 'n3', handle: 'swing_sam', what: 'followed you', at: hoursAgo(5) },
];

// ---- this browser's store ------------------------------------------------------

const KEY = 'slayer_room_v1';
const EMPTY: RoomState = { posts: [], liked: [], saved: [], following: [] };

export function loadRoom(): RoomState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<RoomState>;
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return { posts: Array.isArray(p.posts) ? (p.posts as Post[]) : [], liked: strings(p.liked), saved: strings(p.saved), following: strings(p.following) };
  } catch {
    return EMPTY;
  }
}

export function saveRoom(state: RoomState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or off — the room lives for the session */
  }
}

// ---- the small engines ----------------------------------------------------------

/** "17m", "3h", "2d" */
export function timeAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

const NAME_RE = /\$([A-Z]{1,5})\b/g;
const HANDLE_RE = /@([a-z0-9_]{2,24})/gi;

export type Token = { kind: 'text'; text: string } | { kind: 'name'; text: string } | { kind: 'handle'; text: string };

/** The body cut into text, $names and @handles — the page draws the doors */
export function tokenize(body: string): Token[] {
  const out: Token[] = [];
  const re = /\$([A-Z]{1,5})\b|@([a-z0-9_]{2,24})/gi;
  let last = 0;
  for (const m of body.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: 'text', text: body.slice(last, i) });
    if (m[1]) out.push({ kind: 'name', text: m[1].toUpperCase() });
    else out.push({ kind: 'handle', text: m[2]!.toLowerCase() });
    last = i + m[0].length;
  }
  if (last < body.length) out.push({ kind: 'text', text: body.slice(last) });
  return out;
}

/** The names a post mentions, first first, once each */
export function mentionsOf(body: string): string[] {
  const seen = new Set<string>();
  for (const m of body.matchAll(NAME_RE)) seen.add(m[1]!.toUpperCase());
  return [...seen];
}

export function handlesOf(body: string): string[] {
  const seen = new Set<string>();
  for (const m of body.matchAll(HANDLE_RE)) seen.add(m[1]!.toLowerCase());
  return [...seen];
}

export interface Trend {
  name: string;
  posts: number;
  bullish: number;
  bearish: number;
  /** The room's lean on the name — null when split or unsaid */
  lean: Lean | null;
}

/** What the room is naming — every $name mentioned in the last `hours`, the most mentioned first */
export function trendingOf(posts: Post[], hours = 24): Trend[] {
  const since = Date.now() - hours * 3600_000;
  const m = new Map<string, Trend>();
  for (const p of posts) {
    if (new Date(p.at).getTime() < since) continue;
    for (const name of mentionsOf(p.body)) {
      const t = m.get(name) ?? { name, posts: 0, bullish: 0, bearish: 0, lean: null };
      t.posts += 1;
      if (p.lean === 'BULLISH') t.bullish += 1;
      if (p.lean === 'BEARISH') t.bearish += 1;
      m.set(name, t);
    }
  }
  return [...m.values()]
    .map((t): Trend => ({ ...t, lean: t.bullish > t.bearish ? 'BULLISH' : t.bearish > t.bullish ? 'BEARISH' : null }))
    .sort((a, b) => b.posts - a.posts || a.name.localeCompare(b.name));
}

/** What a settled setup made, in R — the move against the risk taken; null while open */
export function rMultiple(s: Setup): number | null {
  if (s.settledAt == null) return null;
  const risk = Math.abs(s.entry - s.stop);
  if (risk === 0) return null;
  const move = s.lean === 'BULLISH' ? s.settledAt - s.entry : s.entry - s.settledAt;
  return move / risk;
}

export const fmtR = (r: number) => `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}R`;

export interface Record {
  settled: number;
  hit: number;
  /** The sum of every settled setup's R */
  r: number;
}

/** The record a person builds — every setup of theirs that settled */
export function recordOf(handle: string, posts: Post[]): Record {
  const out: Record = { settled: 0, hit: 0, r: 0 };
  for (const p of posts) {
    if (p.handle !== handle || !p.setup || p.setup.state === 'OPEN') continue;
    out.settled += 1;
    if (p.setup.state === 'TARGET HIT') out.hit += 1;
    out.r += rMultiple(p.setup) ?? 0;
  }
  return out;
}
