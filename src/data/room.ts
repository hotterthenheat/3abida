/*
==================================================
  SLAYER TERMINAL - THE ROOM
  (data/room.ts)

  The community as one room (Noah, 2026-09-13):
  "Twitter/X + a trading terminal + an actual
  trader track record system, all connected
  together, instead of just being another
  chatroom". This is its store —

    MEMBERS      @handle, name, bio, links, the
                 verified badge, followers
    POSTS        a quick thought, or a TRADE SETUP
                 (bullish/bearish, entry, target,
                 stop, timeframe) that its author
                 UPDATES in place — trimmed, stop
                 moved, invalidated, target hit —
                 and FINISHES as target hit,
                 stopped out, scratched or closed,
                 so the track record is real and
                 the losers cannot be deleted away
    LIKES · COMMENTS · REPOSTS · FOLLOWS · SAVES
    NOTIFICATIONS  likes, comments, follows, a post
                 from someone you follow, a trade
                 update, a mention
    TRENDING     which $names the room is talking
                 about right now
    THE GATE     account age and activity before
                 posting, rate limits, reports,
                 blocks, a hold for review, the
                 verified badge

  Seeded members and posts so the room is alive on
  first open; what you do lives in this browser
  until accounts launch. One store, read with
  useSyncExternalStore.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { h01 } from '../core/rng';
import { accountAgeDays, getAccount } from './account';
import { UNIVERSE } from './universe';
import Simulator from '../core/simulator';

/* ---- the shapes ------------------------------------------------------------------- */

export interface Member {
  handle: string;
  name: string;
  bio: string;
  links: string[];
  verified: boolean;
  joinedAt: string;
  followers: number;
  following: number;
  /** The avatar's hue on the wheel */
  hue: number;
}
export type Bias = 'bullish' | 'bearish';
export type UpdateKind = 'trim' | 'stop' | 'invalidated' | 'target' | 'note' | 'closed';
export type Outcome = 'open' | 'target hit' | 'stopped out' | 'scratched' | 'closed';
export interface SetupUpdate {
  at: string;
  kind: UpdateKind;
  text: string;
}
export interface Setup {
  ticker: string;
  bias: Bias;
  entry: number;
  target: number;
  stop: number;
  timeframe: string;
  outcome: Outcome;
  updates: SetupUpdate[];
}
export interface Comment {
  id: string;
  author: string;
  at: string;
  text: string;
}
export interface Post {
  id: string;
  author: string;
  at: string;
  text: string;
  images: string[];
  setup?: Setup;
  likes: number;
  reposts: number;
  comments: Comment[];
}
export type NoteKind = 'like' | 'comment' | 'follow' | 'post' | 'update' | 'mention';
export interface Note {
  id: string;
  at: string;
  kind: NoteKind;
  from: string;
  postId?: string;
  text: string;
  read: boolean;
}
export interface Trend {
  ticker: string;
  posts: number;
  heat: number;
  bias: Bias | 'mixed';
}

/* ---- the seed ---------------------------------------------------------------------- */

const SEED_MEMBERS: Member[] = [
  { handle: 'gamma_gwen', name: 'Gwen Tao', bio: 'Dealer gamma, every session. Walls before words.', links: ['x.com/gamma_gwen'], verified: true, joinedAt: '2025-11-02', followers: 12400, following: 180, hue: 280 },
  { handle: 'zero_dte_zed', name: 'Zed Marlow', bio: '0DTE only. The close is the trade.', links: [], verified: true, joinedAt: '2025-12-14', followers: 8900, following: 92, hue: 20 },
  { handle: 'blocks_only', name: 'Priya Natarajan', bio: 'Dark pool prints and what they defend.', links: ['blocksonly.substack.com'], verified: true, joinedAt: '2026-01-20', followers: 6100, following: 210, hue: 200 },
  { handle: 'quant_iv', name: 'Marcus Feld', bio: 'Vol surfaces, vanna, charm. Numbers over feelings.', links: ['github.com/quantiv'], verified: false, joinedAt: '2026-02-08', followers: 3400, following: 320, hue: 140 },
  { handle: 'terrain_ok', name: 'Lena Okafor', bio: 'Four charts, one screen. Levels first.', links: [], verified: false, joinedAt: '2026-03-01', followers: 2100, following: 150, hue: 330 },
  { handle: 'swing_sam', name: 'Sam Reyes', bio: 'Swing setups on the big names. 3–10 sessions.', links: ['x.com/swing_sam'], verified: false, joinedAt: '2026-03-15', followers: 1900, following: 400, hue: 60 },
  { handle: 'macro_mae', name: 'Mae Lindqvist', bio: 'The prints, the Fed, and what SPY does after.', links: [], verified: true, joinedAt: '2025-10-05', followers: 15200, following: 60, hue: 240 },
  { handle: 'earnings_eli', name: 'Eli Brandt', bio: 'Implied move vs realized, every print.', links: [], verified: false, joinedAt: '2026-04-11', followers: 980, following: 230, hue: 100 },
  { handle: 'flow_fern', name: 'Fern Adeyemi', bio: 'Sweeps, blocks, the tape. Rich prints only.', links: [], verified: false, joinedAt: '2026-05-02', followers: 760, following: 310, hue: 170 },
  { handle: 'wall_watch', name: 'Diego Ruiz', bio: 'Call walls, put walls, and the flip between.', links: [], verified: false, joinedAt: '2026-06-20', followers: 420, following: 120, hue: 300 },
];

const TF = ['intraday', '0DTE', '2 sessions', '3–5 sessions', '2 weeks', 'into earnings'];
const THOUGHTS = [
  '$SPY sitting on the put wall at {pw} again. Third test today — the fourth usually breaks.',
  'Dealers flipped to short gamma on $QQQ under {flip}. Moves run from here, size down.',
  'The dark pool printed {dp} at {price} on $NVDA — that shelf has held twice this week.',
  'Charm into the close is the only story today. $SPY grinds to the pin at {pin}.',
  '$TSLA call wall at {cw} is thin — $12M of gamma. Not a wall, a suggestion.',
  'IV crush after the print took 34% of the straddle on $AAPL. Sellers ate.',
  'Vanna says a vol drop makes them buy $SPY here. Watch VIX at 3:30.',
  '$AMD sweeps on the 5DTE calls, $4.2M in ten minutes. Someone knows something or wants us to think so.',
  'Every 0DTE trader should read the flip before the open. $SPY flip at {flip}, spot {price}. That is the whole plan.',
  'Supreme on $QQQ moved up a strike overnight. The magnet moved; the plan moves with it.',
  '$META put wall drained $180M since the open. If it goes, {pw2} is the next shelf.',
  'RVOL 2.1× on $NFLX with the call side building. Watching the 3-day high.',
  'Quiet tape. $IWM ranging between the walls all day — sell the edges, nothing else.',
  '$MSFT gamma flip crossed 30 times today. Either side of it means nothing. Skip it.',
  'The CPI print landed inside the band; $SPY expected move was ±0.9%, we got 0.4%. Vol sellers paid again.',
  'Nobody talks about the pin until 3:45. By then it is priced. $SPY {pin} is the pin, and it has been all day.',
  'Read the greek board before the open: $QQQ is put-dominant on vanna and call-dominant on gamma. Those two disagree, and vanna wins into a crush.',
  '$AMZN dark pool posture flipped to distributing this week. The shelves under it are thinner than the tape suggests.',
  'The 0DTE crowd is short the {cw} calls on $SPY. If we get through, the hedging is the move, not the buyers.',
  'Reminder: a wall that drained 40% since the open is a wall on paper only. Check what built, not what sits.',
  '$GOOGL has not crossed its flip in three sessions. Quietest book on the board — and the cheapest vol.',
  'Every wall on $IWM is inside one expected move today. That is not structure, that is noise. Trade the index instead.',
  'The charm window opens at 2:00 and the desk has $553M to sell before the bell. Rallies into that are borrowed.',
  '$MSFT put wall built $46M overnight at {pw}. Somebody wants a floor there before the print.',
  'Two sessions of higher lows on $TSLA with the call wall migrating up a strike each day. That is the cleanest tape on the board.',
];
const UPDATE_TEXT: Record<UpdateKind, string[]> = {
  trim: ['Trimmed a third at the first target.', 'Took half off into the wall.'],
  stop: ['Stop moved to breakeven.', 'Stop raised under the last higher low.'],
  invalidated: ['Invalidated — closed below the put wall on a full bar.', 'Thesis broken: the wall drained.'],
  target: ['Target hit. Flat.', 'Second target hit, last third off.'],
  note: ['Holding through the print.', 'Still working, no change.'],
  closed: ['Closed flat, no edge left.', 'Closed ahead of the print.'],
};

const pick = <T,>(arr: T[], seed: string) => arr[Math.floor(h01(seed) * arr.length) % arr.length];
const round = (v: number, step: number) => Math.round(v / step) * step;

function priceOf(ticker: string): number {
  const cfg = Simulator.TICKERS[ticker];
  if (cfg) return cfg.currentPrice;
  return UNIVERSE.find(u => u.ticker === ticker)?.px ?? 100;
}
const stepFor = (px: number) => (px > 400 ? 5 : px > 120 ? 2.5 : px > 40 ? 1 : 0.5);

function fillText(t: string, seed: string): string {
  const spy = priceOf('SPY');
  const step = stepFor(spy);
  const fill: Record<string, string> = {
    pw: round(spy * 0.99, step).toFixed(0),
    pw2: round(spy * 0.98, step).toFixed(0),
    flip: round(spy * 1.001, step / 2).toFixed(2),
    cw: round(spy * 1.012, step).toFixed(0),
    pin: round(spy, step).toFixed(0),
    price: spy.toFixed(2),
    dp: `${(4 + Math.round(h01(seed + '-dp') * 30)) / 10}M shares`,
  };
  return t.replace(/\{(\w+)\}/g, (_, k) => fill[k] ?? '');
}

function seedPosts(): Post[] {
  const out: Post[] = [];
  const now = Date.now();
  const names = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'AMD', 'META', 'MSFT', 'AMZN', 'IWM', 'NFLX', 'GOOGL'];
  /* NO TWO POSTS ALIKE: the thoughts are dealt from a shuffled deck and the
     setups walk the names, so a seeded room never prints the same sentence
     twice (measured on the first cut — three repeats in fourteen rows) */
  const deck = THOUGHTS.map((t, k) => ({ t, k: h01(`room-deck-${k}`) })).sort((a, b) => a.k - b.k).map(x => x.t);
  let thoughtAt = 0;
  let nameAt = 0;
  for (let i = 0; i < 34; i++) {
    const seed = `room-post-${i}`;
    let authorIdx = Math.floor(h01(seed + '-a') * SEED_MEMBERS.length) % SEED_MEMBERS.length;
    if (out.length && SEED_MEMBERS[authorIdx].handle === out[out.length - 1].author) authorIdx = (authorIdx + 1) % SEED_MEMBERS.length;
    const author = SEED_MEMBERS[authorIdx].handle;
    const minutesAgo = Math.round(h01(seed + '-t') * 60 * 40);
    const at = new Date(now - minutesAgo * 60_000).toISOString();
    const isSetup = h01(seed + '-k') < 0.4;
    let setup: Setup | undefined;
    let text: string;
    if (isSetup) {
      const ticker = names[nameAt++ % names.length];
      const px = priceOf(ticker);
      const step = stepFor(px);
      const bias: Bias = h01(seed + '-b') > 0.45 ? 'bullish' : 'bearish';
      const dir = bias === 'bullish' ? 1 : -1;
      const entry = round(px * (1 - dir * 0.004), step / 2);
      const target = round(entry * (1 + dir * (0.012 + h01(seed + '-tg') * 0.03)), step);
      const stop = round(entry * (1 - dir * (0.006 + h01(seed + '-st') * 0.012)), step);
      const age = minutesAgo;
      const outcome: Outcome = age < 240 ? 'open' : (['target hit', 'stopped out', 'scratched', 'closed', 'open', 'target hit'] as Outcome[])[Math.floor(h01(seed + '-o') * 6)];
      const updates: SetupUpdate[] = [];
      if (age > 90) updates.push({ at: new Date(now - (age - 60) * 60_000).toISOString(), kind: h01(seed + '-u1') > 0.5 ? 'trim' : 'stop', text: pick(UPDATE_TEXT[h01(seed + '-u1') > 0.5 ? 'trim' : 'stop'], seed + '-u1t') });
      if (outcome !== 'open') {
        const kind: UpdateKind = outcome === 'target hit' ? 'target' : outcome === 'stopped out' ? 'invalidated' : 'closed';
        updates.push({ at: new Date(now - Math.max(5, age - 200) * 60_000).toISOString(), kind, text: pick(UPDATE_TEXT[kind], seed + '-u2t') });
      }
      setup = { ticker, bias, entry, target, stop, timeframe: pick(TF, seed + '-tf'), outcome, updates };
      text = `$${ticker} ${bias} ${setup.timeframe}. ${bias === 'bullish' ? `Buying the put wall hold at ${entry}, target the call wall ${target}, out under ${stop}.` : `Fading the call wall at ${entry}, target the put wall ${target}, out over ${stop}.`}`;
    } else {
      text = fillText(deck[thoughtAt++ % deck.length], seed);
    }
    out.push({
      id: `seed-${i}`,
      author,
      at,
      text,
      images: [],
      setup,
      likes: Math.round(h01(seed + '-l') * 240),
      reposts: Math.round(h01(seed + '-r') * 40),
      comments: Array.from({ length: Math.floor(h01(seed + '-c') * 4) }, (_, k) => ({
        id: `seed-${i}-c${k}`,
        author: SEED_MEMBERS[Math.floor(h01(`${seed}-c${k}-a`) * SEED_MEMBERS.length)].handle,
        at: new Date(now - Math.max(1, minutesAgo - 10 - k * 7) * 60_000).toISOString(),
        text: pick(['Agreed — same read on the ladder.', 'The wall drained since you posted, careful.', 'What timeframe is the stop on?', 'This is the trade.', 'Vanna says otherwise into 3:30.', 'Nice. Trimmed mine too.'], `${seed}-c${k}-t`),
      })),
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

function seedNotes(follows: string[]): Note[] {
  const now = Date.now();
  const at = (m: number) => new Date(now - m * 60_000).toISOString();
  return [
    { id: 'n-1', at: at(4), kind: 'like', from: 'gamma_gwen', text: 'liked your post', read: false },
    { id: 'n-2', at: at(19), kind: 'comment', from: 'quant_iv', text: 'commented: "vanna disagrees into the close"', read: false },
    { id: 'n-3', at: at(46), kind: 'follow', from: 'flow_fern', text: 'started following you', read: false },
    { id: 'n-4', at: at(75), kind: 'post', from: follows[0] ?? 'macro_mae', text: 'posted a new setup', read: true },
    { id: 'n-5', at: at(130), kind: 'update', from: 'zero_dte_zed', text: 'updated a setup you follow: target hit', read: true },
    { id: 'n-6', at: at(210), kind: 'mention', from: 'wall_watch', text: 'mentioned you: "@you your put wall read was right"', read: true },
  ];
}

/* ---- the state ---------------------------------------------------------------------- */

interface Mine {
  posts: Post[];
  likes: string[];
  saves: string[];
  reposts: string[];
  /** post id → the replies you added, merged onto the post's own on read */
  comments: Record<string, Comment[]>;
  follows: string[];
  blocks: string[];
  reports: Record<string, number>;
  readNotes: string[];
  extraNotes: Note[];
  /** epoch ms of your posts and comments, for the rate limits */
  postTimes: number[];
  commentTimes: number[];
  /** likes and comments given — the activity gate */
  activity: number;
}
const KEY = 'slayer_room';
const DEFAULT_MINE: Mine = { posts: [], likes: [], saves: [], reposts: [], comments: {}, follows: ['gamma_gwen', 'macro_mae', 'blocks_only'], blocks: [], reports: {}, readNotes: [], extraNotes: [], postTimes: [], commentTimes: [], activity: 0 };

const loadMine = (): Mine => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Mine>;
      return { ...DEFAULT_MINE, ...v, comments: v.comments ?? {} };
    }
  } catch {
    /* none */
  }
  return { ...DEFAULT_MINE };
};

let mine: Mine = loadMine();
const seeded = seedPosts();
const SEED_IDS = new Set(seeded.map(p => p.id));
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
  } catch {
    /* storage may be off */
  }
};
const getVersion = () => version;
/** Subscribe to the room — re-renders on every change */
export const useRoom = (): number => useSyncExternalStore(subscribe, getVersion, getVersion);

/* ---- reads ------------------------------------------------------------------------- */

export const ME = 'me';
export const me = (): Member => {
  const a = getAccount();
  return { handle: a.handle, name: a.name, bio: a.bio, links: a.links, verified: accountAgeDays(a) >= 30, joinedAt: a.createdAt, followers: 128 + mine.posts.length * 3, following: mine.follows.length, hue: 45 };
};
export const memberOf = (handle: string): Member | null => (handle === ME || handle === getAccount().handle ? me() : (SEED_MEMBERS.find(m => m.handle === handle) ?? null));
export const members = (): Member[] => SEED_MEMBERS;
export const isMe = (handle: string) => handle === ME || handle === getAccount().handle;

/* A POST AS THE SCREEN SHOWS IT (the fix, 2026-09-13 — a like, a repost or a
   reply on a SEEDED post used to live in a module-level map, so it survived
   until the next reload and then vanished while the heart stayed lit; a
   repost of one moved no count at all). The stored post carries what OTHERS
   did; your like, your repost and your replies are kept as your own and
   merged here, so a reload prints what the screen printed before it. */
const withMine = (base: Post): Post => {
  const liked = mine.likes.includes(base.id);
  const reposted = mine.reposts.includes(base.id);
  const added = mine.comments[base.id] ?? [];
  if (!liked && !reposted && added.length === 0) return base;
  return { ...base, likes: base.likes + (liked ? 1 : 0), reposts: base.reposts + (reposted ? 1 : 0), comments: added.length ? [...base.comments, ...added] : base.comments };
};

/** Every post in the room, newest first, minus the people you blocked. A post
    YOU reported stays in the list — the card draws it as a reported strip with
    a way back — because a row that silently vanishes on one click is not
    moderation, it is a disappearing act (2026-09-13). */
export function allPosts(): Post[] {
  const blocked = new Set(mine.blocks);
  return [...mine.posts, ...seeded]
    .filter(p => !blocked.has(p.author))
    .map(withMine)
    .sort((a, b) => b.at.localeCompare(a.at));
}
export const postById = (id: string): Post | null => allPosts().find(p => p.id === id) ?? null;
export const followingPosts = (): Post[] => {
  const f = new Set(mine.follows);
  return allPosts().filter(p => f.has(p.author) || isMe(p.author));
};
export const postsBy = (handle: string): Post[] => allPosts().filter(p => (isMe(handle) ? isMe(p.author) : p.author === handle));
export const postsOn = (ticker: string): Post[] => {
  const re = new RegExp(`\\$${ticker}\\b`, 'i');
  return allPosts().filter(p => re.test(p.text) || p.setup?.ticker === ticker);
};
export const liked = (id: string) => mine.likes.includes(id);
export const saved = (id: string) => mine.saves.includes(id);
export const reposted = (id: string) => mine.reposts.includes(id);
export const follows = (handle: string) => mine.follows.includes(handle);
export const blocked = (handle: string) => mine.blocks.includes(handle);
export const reported = (id: string) => (mine.reports[id] ?? 0) > 0;
export const followList = () => mine.follows;
export const blockList = () => mine.blocks;
export const savedPosts = (): Post[] => allPosts().filter(p => mine.saves.includes(p.id));

/** The track record — every finished setup, and the record it adds up to */
export interface TrackRecord {
  finished: { post: Post; setup: Setup }[];
  open: number;
  wins: number;
  losses: number;
  scratched: number;
  closed: number;
  winRate: number | null;
}
export function trackRecord(handle: string): TrackRecord {
  const setups = postsBy(handle).filter(p => p.setup).map(p => ({ post: p, setup: p.setup! }));
  const finished = setups.filter(s => s.setup.outcome !== 'open');
  const wins = finished.filter(s => s.setup.outcome === 'target hit').length;
  const losses = finished.filter(s => s.setup.outcome === 'stopped out').length;
  const scratched = finished.filter(s => s.setup.outcome === 'scratched').length;
  const closed = finished.filter(s => s.setup.outcome === 'closed').length;
  const decided = wins + losses;
  return { finished, open: setups.length - finished.length, wins, losses, scratched, closed, winRate: decided ? Math.round((wins / decided) * 100) : null };
}

/** What the room is talking about — $names in the last six hours, weighted by likes */
export function trending(): Trend[] {
  const since = Date.now() - 6 * 3600_000;
  const heat = new Map<string, { posts: number; heat: number; bull: number; bear: number }>();
  for (const p of allPosts()) {
    if (new Date(p.at).getTime() < since) continue;
    const names = new Set<string>();
    for (const m of p.text.matchAll(/\$([A-Z][A-Z0-9.]{0,5})\b/g)) names.add(m[1]);
    if (p.setup) names.add(p.setup.ticker);
    for (const n of names) {
      const cur = heat.get(n) ?? { posts: 0, heat: 0, bull: 0, bear: 0 };
      cur.posts++;
      cur.heat += 1 + p.likes / 40 + p.comments.length / 2;
      if (p.setup?.ticker === n) {
        if (p.setup.bias === 'bullish') cur.bull++;
        else cur.bear++;
      }
      heat.set(n, cur);
    }
  }
  return [...heat.entries()]
    .map(([ticker, v]) => ({ ticker, posts: v.posts, heat: v.heat, bias: (v.bull > v.bear ? 'bullish' : v.bear > v.bull ? 'bearish' : 'mixed') as Trend['bias'] }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 8);
}

/** Who to follow — the members you do not yet, the most followed first */
export const suggestions = (): Member[] => SEED_MEMBERS.filter(m => !mine.follows.includes(m.handle) && !mine.blocks.includes(m.handle)).sort((a, b) => b.followers - a.followers).slice(0, 5);

export function notes(): Note[] {
  const read = new Set(mine.readNotes);
  return [...mine.extraNotes, ...seedNotes(mine.follows)].map(n => ({ ...n, read: n.read || read.has(n.id) })).sort((a, b) => b.at.localeCompare(a.at));
}
export const unreadNotes = () => notes().filter(n => !n.read).length;

/* ---- the gate ------------------------------------------------------------------------ */

/** Why you cannot post right now — null when you can */
export function postGate(): string | null {
  const age = accountAgeDays();
  const now = Date.now();
  const lastHour = mine.postTimes.filter(t => now - t < 3600_000).length;
  const last10 = mine.postTimes.filter(t => now - t < 600_000).length;
  if (getAccount().deactivated) return 'Your account is deactivated — reactivate it in Settings to post.';
  if (age < 1 && mine.activity < 3) return 'New accounts read first: like or comment on three posts, or come back tomorrow, before posting.';
  if (last10 >= 5) return 'Slow down — five posts in ten minutes is the limit.';
  if (lastHour >= 20) return 'Twenty posts in an hour is the limit — back in a while.';
  return null;
}
export function commentGate(): string | null {
  const now = Date.now();
  if (getAccount().deactivated) return 'Your account is deactivated.';
  if (mine.commentTimes.filter(t => now - t < 60_000).length >= 3) return 'Three comments a minute is the limit.';
  return null;
}

/* ---- writes ------------------------------------------------------------------------- */

const stamp = () => new Date().toISOString();
const bump = (patch: Partial<Mine>) => {
  mine = { ...mine, ...patch };
  persist();
  emit();
};

export function post(text: string, images: string[], setup?: Omit<Setup, 'outcome' | 'updates'>): Post | string {
  const gate = postGate();
  if (gate) return gate;
  const body = text.trim();
  if (body.length < 2 && !setup && images.length === 0) return 'Say something first.';
  const p: Post = { id: `me-${Date.now()}`, author: getAccount().handle, at: stamp(), text: body, images, setup: setup ? { ...setup, outcome: 'open', updates: [] } : undefined, likes: 0, reposts: 0, comments: [] };
  bump({ posts: [p, ...mine.posts], postTimes: [...mine.postTimes.slice(-40), Date.now()] });
  return p;
}
export function addUpdate(postId: string, kind: UpdateKind, text: string): void {
  const posts = mine.posts.map(p => {
    if (p.id !== postId || !p.setup) return p;
    const outcome: Outcome = kind === 'target' ? 'target hit' : kind === 'invalidated' ? 'stopped out' : kind === 'closed' ? 'closed' : p.setup.outcome;
    return { ...p, setup: { ...p.setup, outcome, updates: [...p.setup.updates, { at: stamp(), kind, text: text.trim() || UPDATE_TEXT[kind][0] }] } };
  });
  bump({ posts });
}
export function finishSetup(postId: string, outcome: Exclude<Outcome, 'open'>, text = ''): void {
  const kind: UpdateKind = outcome === 'target hit' ? 'target' : outcome === 'stopped out' ? 'invalidated' : 'closed';
  const posts = mine.posts.map(p => (p.id === postId && p.setup ? { ...p, setup: { ...p.setup, outcome, updates: [...p.setup.updates, { at: stamp(), kind, text: text.trim() || `${outcome.charAt(0).toUpperCase()}${outcome.slice(1)}.` }] } } : p));
  bump({ posts });
}
export function toggleLike(id: string): void {
  const has = mine.likes.includes(id);
  bump({ likes: has ? mine.likes.filter(x => x !== id) : [...mine.likes, id], activity: mine.activity + (has ? 0 : 1) });
}
export function toggleSave(id: string): void {
  bump({ saves: mine.saves.includes(id) ? mine.saves.filter(x => x !== id) : [...mine.saves, id] });
}
export function toggleRepost(id: string): void {
  const has = mine.reposts.includes(id);
  bump({ reposts: has ? mine.reposts.filter(x => x !== id) : [...mine.reposts, id] });
}
export function comment(id: string, text: string): string | null {
  const gate = commentGate();
  if (gate) return gate;
  const body = text.trim();
  if (!body) return 'Say something first.';
  const c: Comment = { id: `c-${Date.now()}`, author: getAccount().handle, at: stamp(), text: body };
  bump({ comments: { ...mine.comments, [id]: [...(mine.comments[id] ?? []), c] }, commentTimes: [...mine.commentTimes.slice(-20), Date.now()], activity: mine.activity + 1 });
  return null;
}
export function toggleFollow(handle: string): void {
  if (isMe(handle)) return;
  bump({ follows: mine.follows.includes(handle) ? mine.follows.filter(x => x !== handle) : [...mine.follows, handle] });
}
export function toggleBlock(handle: string): void {
  if (isMe(handle)) return;
  const has = mine.blocks.includes(handle);
  bump({ blocks: has ? mine.blocks.filter(x => x !== handle) : [...mine.blocks, handle], follows: has ? mine.follows : mine.follows.filter(x => x !== handle) });
}
/** YOUR report: it goes to the moderators and hides the post from your own
    feed. It counts once, and it is undoable — what the rest of the room
    reported is theirs, not something this client may invent. */
export function report(id: string): void {
  if (mine.reports[id]) return;
  bump({ reports: { ...mine.reports, [id]: 1 } });
}
export function unreport(id: string): void {
  if (!mine.reports[id]) return;
  const reports = { ...mine.reports };
  delete reports[id];
  bump({ reports });
}
export function markNotesRead(): void {
  bump({ readNotes: notes().map(n => n.id) });
}
export function notify(n: Omit<Note, 'id' | 'at' | 'read'>): void {
  bump({ extraNotes: [{ ...n, id: `n-${Date.now()}`, at: stamp(), read: false }, ...mine.extraNotes] });
}

export const timeAgo = (iso: string): string => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

/** Reset the seed's live counters — the tests' door */
export function resetRoomForTests(): void {
  mine = { ...DEFAULT_MINE };
  emit();
}
