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
                 UPDATES in place — trimmed, a note,
                 the stop moved tighter — and that
                 THE MARKET SETTLES: the price
                 reaching the stop or the target, or
                 the timeframe running out, is what
                 writes the outcome. The author can
                 close it early at a price, and
                 nothing else. See "THE MARKET
                 GRADES THE TRADE" below.
    THE RECORD   every finished setup in win rate
                 AND in R, because a win rate alone
                 can be bought with a near target
                 and a far stop
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
import { readJson, writeKey } from './kept';
import { pictureStore } from './pictures';
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
/** Why a setup ended — the market reaching a level, the clock, or the author */
export type SettleWhy = 'target' | 'stop' | 'timeframe' | 'closed';
export interface Settlement {
  outcome: Exclude<Outcome, 'open'>;
  at: string;
  /** The price it ended at: the target, the stop, or where it was closed */
  price: number;
  why: SettleWhy;
}
/** What ended it, in words — one wording, wherever a settlement is shown */
export const SETTLE_WORD: Record<SettleWhy, string> = {
  target: 'the target printed',
  stop: 'the stop printed',
  timeframe: 'the timeframe ran out',
  closed: 'closed by the author',
};
export interface Setup {
  ticker: string;
  bias: Bias;
  entry: number;
  target: number;
  stop: number;
  timeframe: string;
  outcome: Outcome;
  updates: SetupUpdate[];
  /** How it ended, written once, by the grader — never by the author */
  settled?: Settlement;
}

/*
  THE TIMEFRAMES, and how long each one gives a trade.

  A setup that never reaches either level is not open forever. "Intraday" that
  is still open two days later is not a trade being managed, it is a loser
  being left out so it never has to be counted — which is the single easiest
  way to fake a track record, and the reason the timeframe is a field at all.
  Past its span with neither level touched, a setup is scratched where it
  stands.

  One list, exported, because the composer offers these strings and this map
  reads them: two copies would drift the first time a timeframe was added and
  a whole class of setup would quietly stop expiring.
*/
export const TIMEFRAMES = ['intraday', '0DTE', '2 sessions', '3–5 sessions', '2 weeks', 'into earnings'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];
const TIMEFRAME_HOURS: Record<string, number> = {
  intraday: 8,
  '0DTE': 8,
  '2 sessions': 48,
  '3–5 sessions': 120,
  '2 weeks': 336,
  'into earnings': 504,
};
/** How long a setup on this timeframe has before the clock scratches it */
export const lifetimeHours = (timeframe: string): number => TIMEFRAME_HOURS[timeframe] ?? 120;
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
/** A reaction the room owes one of your posts, and when it is due */
export interface Pending {
  /** epoch ms it lands */
  at: number;
  kind: 'like' | 'comment' | 'follow';
  from: string;
  postId: string;
  /** a comment's words, decided when the reaction was planned */
  text?: string;
}
export interface Trend {
  ticker: string;
  posts: number;
  /** How many of those posts are setups — the lean is only read off these */
  setups: number;
  heat: number;
  /** null when nobody has taken a side on it: the name is being talked about,
      not traded, and a chip saying "MIXED" over that would be an invention */
  bias: Bias | 'mixed' | null;
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

const pick = <T,>(arr: readonly T[], seed: string) => arr[Math.floor(h01(seed) * arr.length) % arr.length];
const round = (v: number, step: number) => Math.round(v / step) * step;

function priceOf(ticker: string): number {
  const cfg = Simulator.TICKERS[ticker];
  if (cfg) return cfg.currentPrice;
  return UNIVERSE.find(u => u.ticker === ticker)?.px ?? 100;
}

/*
  A SEEDED SETUP IS ONLY EVER WRITTEN ON A NAME THE SIMULATOR IS RUNNING.

  Measured (2026-09-13, wiring up the grader): at the moment this module loads,
  Simulator.TICKERS holds four names — its watchlist. For every other name
  `priceOf` fell back to the static universe price, which is nowhere near what
  the simulator settles on once it seeds that name: NVDA 138.60 against 120.00,
  AAPL 232.40 against 190.00. Setups built on those numbers were 15% away from
  the market before anybody read them, and the grader — correctly — settled
  thirteen of fourteen in the first sweep. The room opened with one open trade.

  Asking for the rest is not the answer either: ensureTicker forward-seeds a
  full candle history, and eight names measured 3.3 SECONDS of blocking.

  So the setups are dealt on whatever the simulator already holds. It is the
  watchlist on a cold open, and more when the reader has been somewhere else
  first — either way the entry is a real price and the grade means something.
  The quick thoughts still name anything: they are talk, not trades.
*/
function tradableNames(): string[] {
  const live = Object.keys(Simulator.TICKERS).filter(t => Number.isFinite(Simulator.TICKERS[t]?.currentPrice));
  return live.length ? live : ['SPY'];
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

/*
  WHO SAID WHAT IS DEALT AFTER THE SORT (2026-09-13).

  The first cut picked an author per post and nudged it when it matched the
  one before — but that ran in BUILD order, and the list was then sorted by
  time, which undid every nudge it had made. Measured on the rendered feed:
  the top five rows read Sam, Sam, Sam, Marcus, Sam — one member appearing to
  hold the whole room.

  So the posts are built and sorted first, and only then dealt their authors,
  off a deck weighted by following (the most-followed speak most) with any
  voice that comes up twice running skipped past. A deck of ten always has
  another, so the walk terminates.
*/
function dealAuthors(count: number): string[] {
  const deck: string[] = [];
  for (const m of SEED_MEMBERS) {
    /* one turn per ~2,500 followers, never fewer than two: the room has
       voices of different sizes rather than a perfect rotation */
    const share = Math.max(2, Math.round(m.followers / 2500));
    for (let k = 0; k < share; k++) deck.push(m.handle);
  }
  const shuffled = deck
    .map((h, k) => ({ h, k: h01(`room-author-${k}-${h}`) }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.h);
  const out: string[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    for (let skips = 0; shuffled[at % shuffled.length] === out[out.length - 1] && skips < shuffled.length; skips++) at++;
    out.push(shuffled[at % shuffled.length]);
    at++;
  }
  return out;
}

function seedPosts(): Post[] {
  const out: Post[] = [];
  const now = Date.now();
  const names = tradableNames();
  /* NO TWO POSTS ALIKE: the thoughts are dealt from a shuffled deck and the
     setups walk the names, so a seeded room never prints the same sentence
     twice (measured on the first cut — three repeats in fourteen rows) */
  const deck = THOUGHTS.map((t, k) => ({ t, k: h01(`room-deck-${k}`) })).sort((a, b) => a.k - b.k).map(x => x.t);
  let thoughtAt = 0;
  let nameAt = 0;
  for (let i = 0; i < 34; i++) {
    const seed = `room-post-${i}`;
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
      /* AN OPEN SETUP IS ALWAYS YOUNGER THAN ITS OWN TIMEFRAME. The seed used
         to deal "open" to a sixth of the setups regardless of age, which put
         forty-hour-old intraday trades in the room — and the grader scratched
         every one of them on the first sweep, exactly as it should. */
      const timeframe = pick(TIMEFRAMES, seed + '-tf');
      const finished = (['target hit', 'stopped out', 'scratched', 'closed', 'target hit', 'stopped out'] as Outcome[])[Math.floor(h01(seed + '-o') * 6)];
      const outcome: Outcome = age >= lifetimeHours(timeframe) * 60 ? finished : h01(seed + '-open') < 0.55 ? 'open' : finished;
      const updates: SetupUpdate[] = [];
      if (age > 90) updates.push({ at: new Date(now - (age - 60) * 60_000).toISOString(), kind: h01(seed + '-u1') > 0.5 ? 'trim' : 'stop', text: pick(UPDATE_TEXT[h01(seed + '-u1') > 0.5 ? 'trim' : 'stop'], seed + '-u1t') });
      /* A FINISHED SEEDED SETUP CARRIES ITS SETTLEMENT, so the record it feeds
         is arithmetic on prices rather than a tally of labels: target hit
         settles at the target, stopped out at the stop, and the two soft
         outcomes somewhere between entry and whichever level they leant on. */
      let settled: Settlement | undefined;
      if (outcome !== 'open') {
        const kind: UpdateKind = outcome === 'target hit' ? 'target' : outcome === 'stopped out' ? 'invalidated' : 'closed';
        const at = new Date(now - Math.max(5, age - 200) * 60_000).toISOString();
        const part = 0.15 + h01(seed + '-x') * 0.5;
        const price =
          outcome === 'target hit' ? target : outcome === 'stopped out' ? stop : outcome === 'scratched' ? round(entry + (stop - entry) * part * 0.4, 0.01) : round(entry + (target - entry) * part, 0.01);
        settled = { outcome, at, price, why: outcome === 'target hit' ? 'target' : outcome === 'stopped out' ? 'stop' : outcome === 'scratched' ? 'timeframe' : 'closed' };
        updates.push({ at, kind, text: pick(UPDATE_TEXT[kind], seed + '-u2t') });
      }
      setup = { ticker, bias, entry, target, stop, timeframe, outcome, updates, settled };
      text = `$${ticker} ${bias} ${setup.timeframe}. ${bias === 'bullish' ? `Buying the put wall hold at ${entry}, target the call wall ${target}, out under ${stop}.` : `Fading the call wall at ${entry}, target the put wall ${target}, out over ${stop}.`}`;
    } else {
      text = fillText(deck[thoughtAt++ % deck.length], seed);
    }
    out.push({
      id: `seed-${i}`,
      author: '',
      at,
      text,
      images: [],
      setup,
      likes: Math.round(h01(seed + '-l') * 240),
      reposts: Math.round(h01(seed + '-r') * 40),
      comments: [],
    });
  }
  out.sort((a, b) => b.at.localeCompare(a.at));
  /* The authors, then the replies — a reply needs to know whose post it is
     under so nobody is seen agreeing with themselves */
  const authors = dealAuthors(out.length);
  return out.map((p, i) => {
    const author = authors[i];
    const others = SEED_MEMBERS.filter(m => m.handle !== author);
    const minutesAgo = Math.round((now - new Date(p.at).getTime()) / 60_000);
    return {
      ...p,
      author,
      comments: Array.from({ length: Math.floor(h01(`${p.id}-c`) * 4) }, (_, k) => ({
        id: `${p.id}-c${k}`,
        author: others[Math.floor(h01(`${p.id}-c${k}-a`) * others.length) % others.length].handle,
        at: new Date(now - Math.max(1, minutesAgo - 10 - k * 7) * 60_000).toISOString(),
        text: pick(['Agreed — same read on the ladder.', 'The wall drained since you posted, careful.', 'What timeframe is the stop on?', 'This is the trade.', 'Vanna says otherwise into 3:30.', 'Nice. Trimmed mine too.'], `${p.id}-c${k}-t`),
      })),
    };
  });
}

/*
  THE BELL ONLY SAYS WHAT HAPPENED (2026-09-13).

  It used to open on "Gwen Tao liked your post" and "Marcus Feld commented"
  over an account with NO POSTS, and on "mentioned you" in a room where
  nobody had. Three of the six were about content that did not exist.

  What is seeded now is only what is true of a reader who has not posted yet:
  the people you already follow posted and updated — each note pointing at the
  post it is about, so it can be opened and read. Nothing about YOU is seeded
  at all, because until you post there is nothing to say; from then on the
  bell is written by the reactions as they land (see "THE ROOM ANSWERS").
*/
function seedNotes(follows: string[], posts: readonly Post[]): Note[] {
  const out: Note[] = [];
  const followed = posts.filter(p => follows.includes(p.author));
  const newest = followed[0];
  if (newest) out.push({ id: 'n-post', at: newest.at, kind: 'post', from: newest.author, postId: newest.id, text: newest.setup ? `posted a ${newest.setup.bias} setup on $${newest.setup.ticker}` : 'posted', read: false });
  const updated = followed.find(p => p.setup && p.setup.updates.length > 0);
  if (updated) {
    const last = updated.setup!.updates[updated.setup!.updates.length - 1];
    out.push({ id: 'n-update', at: last.at, kind: 'update', from: updated.author, postId: updated.id, text: `updated $${updated.setup!.ticker}: ${last.text}`, read: true });
  }
  return out;
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
  /** Who has followed you since this browser started — the count reads it */
  followers: string[];
  /** Reactions to your posts that have been scheduled and not yet landed */
  pending: Pending[];
  /** A seeded setup's settlement, keyed by its fingerprint — see `setupKey` */
  settled: Record<string, Settlement>;
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
/* A post holds picture IDS; the pictures live on their own key — see
   data/pictures.ts for what that is worth and what it was measured against */
const pics = pictureStore('slayer_room_images');
const DEFAULT_MINE: Mine = { posts: [], likes: [], saves: [], reposts: [], comments: {}, follows: ['gamma_gwen', 'macro_mae', 'blocks_only'], blocks: [], followers: [], pending: [], settled: {}, reports: {}, readNotes: [], extraNotes: [], postTimes: [], commentTimes: [], activity: 0 };
/** The bell keeps this many raised notes — a session's worth, not a lifetime's */
const NOTE_CAP = 60;

const loadMine = (): Mine => {
  const v = readJson<Partial<Mine>>(KEY, {});
  return { ...DEFAULT_MINE, ...v, comments: v.comments ?? {}, settled: v.settled ?? {}, pending: v.pending ?? [], followers: v.followers ?? [] };
};

let mine: Mine = loadMine();
const seeded = seedPosts();
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  for (const l of listeners) l();
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  startGrading();
  return () => {
    listeners.delete(fn);
    stopGrading();
  };
};
/** True when everything reached storage. A false here means a reload will not
    show what the screen is showing, which `post` turns into a message rather
    than letting the reader find out later. */
const persist = (): boolean => {
  const kept = writeKey(KEY, mine);
  const pictures = pics.write();
  return kept && pictures;
};
const getVersion = () => version;
/** Subscribe to the room — re-renders on every change */
export const useRoom = (): number => useSyncExternalStore(subscribe, getVersion, getVersion);

/* ---- reads ------------------------------------------------------------------------- */

export const ME = 'me';
export const me = (): Member => {
  const a = getAccount();
  /* FOLLOWERS IS A REAL COUNT: the 128 you arrived with, plus everyone the
     bell has actually shown following you. It used to be `posts * 3`, which
     moved when you posted and had nothing to do with anybody following. */
  return { handle: a.handle, name: a.name, bio: a.bio, links: a.links, verified: accountAgeDays(a) >= 30, joinedAt: a.createdAt, followers: 128 + mine.followers.length, following: mine.follows.length, hue: 45 };
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
/** The picture ids a post stores, swapped back for the pictures themselves */
const hydrate = (p: Post): Post => (p.images.length === 0 ? p : { ...p, images: pics.show(p.images) });

/* =========================================================================
   THE MARKET GRADES THE TRADE (2026-09-13)

   "an actual trader track record system". It was not one. The author pressed
   "target hit" and the record said so — nothing looked at the price. A
   bullish $SPY setup entered at 500 for 505 could be marked target hit with
   SPY at 498, and the profile would print 1W · 100%. Every number on it was
   the author's opinion of their own trade.

   So the outcome is taken out of the author's hands. An OPEN setup is read
   against the simulator's price on a five-second sweep, and the first of
   three things to happen settles it, once, with the price and the time:

     the stop        price trades at or through it   -> stopped out at the stop
     the target      price trades at or through it   -> target hit at the target
     the timeframe   its span passes, neither hit    -> scratched where it stands

   BOTH LEVELS INSIDE ONE TICK READS AS THE STOP. We cannot see which came
   first between two samples, and crediting the win would be the generous
   reading of our own record — which is the whole thing this replaces.

   The settlement price is the LEVEL, not the sample that tripped it: the
   order rests at the level and fills there. That makes a target worth exactly
   the R it was written for, and a stop exactly -1R.

   WHAT THE AUTHOR STILL DOES: trims, notes, moves the stop (in the safe
   direction only), and closes early — which records the price it closed at,
   and counts. There is no button that says "I won".
   ========================================================================= */

/** A seeded setup's fingerprint. The seeded room is re-dealt against live
    prices on every load, so a settlement recorded against one deal must not
    be worn by a different one that happens to land on the same id. */
const setupKey = (p: Post, s: Setup): string => `${p.id}|${s.ticker}|${s.entry}|${s.target}|${s.stop}`;

/** The line a settlement writes into the setup's own history */
const settlementUpdate = (s: Settlement): SetupUpdate => ({
  at: s.at,
  kind: s.why === 'target' ? 'target' : s.why === 'stop' ? 'invalidated' : 'closed',
  text:
    s.why === 'target'
      ? `Target hit at ${s.price} — graded on the tape.`
      : s.why === 'stop'
        ? `Stopped out at ${s.price} — graded on the tape.`
        : s.why === 'timeframe'
          ? `The timeframe ran out with neither level touched — scratched at ${s.price}.`
          : `Closed by the author at ${s.price}.`,
});

/** A setup wearing its settlement — the outcome and the closing line */
const settle = (s: Setup, by: Settlement): Setup => ({ ...s, outcome: by.outcome, settled: by, updates: [...s.updates, settlementUpdate(by)] });

/** What the market has done to an open setup, or null while it is still open */
function gradeSetup(s: Setup, postedAt: string): Settlement | null {
  const now = Date.now();
  const at = new Date(now).toISOString();
  const price = Simulator.TICKERS[s.ticker]?.currentPrice;
  if (price != null && Number.isFinite(price)) {
    const hitStop = s.bias === 'bullish' ? price <= s.stop : price >= s.stop;
    if (hitStop) return { outcome: 'stopped out', at, price: s.stop, why: 'stop' };
    const hitTarget = s.bias === 'bullish' ? price >= s.target : price <= s.target;
    if (hitTarget) return { outcome: 'target hit', at, price: s.target, why: 'target' };
  }
  const hours = (now - new Date(postedAt).getTime()) / 3_600_000;
  if (hours >= lifetimeHours(s.timeframe)) return { outcome: 'scratched', at, price: Number((price ?? s.entry).toFixed(2)), why: 'timeframe' };
  return null;
}

/** A seeded post with whatever the grader has already written about it */
const graded = (base: Post): Post => {
  if (!base.setup || base.setup.outcome !== 'open') return base;
  const found = mine.settled[setupKey(base, base.setup)];
  return found ? { ...base, setup: settle(base.setup, found) } : base;
};

/** Read every open setup against the price and record whatever has ended.
    Returns true when something settled, so the caller knows to tell the room. */
function sweepGrades(): boolean {
  let moved = false;
  const posts = mine.posts.map(p => {
    if (!p.setup || p.setup.outcome !== 'open') return p;
    const ended = gradeSetup(p.setup, p.at);
    if (!ended) return p;
    moved = true;
    return { ...p, setup: settle(p.setup, ended) };
  });
  const settled = { ...mine.settled };
  for (const p of seeded) {
    if (!p.setup || p.setup.outcome !== 'open') continue;
    const key = setupKey(p, p.setup);
    if (settled[key]) continue;
    const ended = gradeSetup(p.setup, p.at);
    if (!ended) continue;
    settled[key] = ended;
    moved = true;
  }
  if (!moved) return false;
  mine = { ...mine, posts, settled };
  persist();
  return true;
}

/* =========================================================================
   THE ROOM ANSWERS (2026-09-13)

   You posted into a room that never replied. The post sat at 0 likes, 0
   comments, forever — while the bell, seeded separately, claimed people were
   liking and commenting on posts that did not exist. Two halves of the same
   missing thing: nothing in here ever raised an EVENT.

   So a post now schedules what the room does about it — a like or three over
   the next few minutes, usually a reply that has read the post, sometimes a
   follow — and the sweep applies each one when it comes due, raising the
   bell note from that same event. The count and the notification cannot
   disagree, because they are written by one line of code.

   The reactions are PERSISTED while they are pending, so closing the tab and
   coming back an hour later lands them all at their scheduled times rather
   than losing them: the room carried on while you were away.

   WHAT THE READER ASKED FOR IS HONOURED: Settings has switches for likes,
   comments and follows, and they had no effect on anything. A switch that is
   off now suppresses the note — the like still lands, because that happened,
   but the bell stays quiet about it.
   ========================================================================= */

const REPLY_TO_SETUP = [
  'What is the plan if it loses {stop}?',
  '{target} is the call wall on my board. Good level to aim at.',
  'Size on this? {timeframe} is a long time to hold through a print.',
  'Watching it. The flip sits right under {entry}.',
  'In around {entry} as well. The stop is the part I would tighten.',
  'Against the grain but I like it. {target} or nothing.',
];
const REPLY_TO_NAME = [
  'Same read on ${T}. The flip is the whole story today.',
  '${T} has been the cleanest tape on the board this week.',
  'Careful — the ${T} wall has drained since the open.',
  'Agreed. ${T} dealers are long gamma above the flip.',
  'Not sure on ${T} here, the ladder is thin above spot.',
];
const REPLY_PLAIN = ['This is the read.', 'Been thinking the same since the open.', 'Say more? The ladder does not agree with this yet.', 'Noted. Watching it.', 'Second this.'];

/** A reply that has read the post — its levels if it is a setup, its name if it
    has one, and only failing both something that could be said about anything */
function replyTo(p: Post, seed: string): string {
  if (p.setup) {
    const s = p.setup;
    return pick(REPLY_TO_SETUP, seed)
      .replace('{stop}', String(s.stop))
      .replace('{target}', String(s.target))
      .replace('{entry}', String(s.entry))
      .replace('{timeframe}', s.timeframe);
  }
  const named = p.text.match(/\$([A-Z][A-Z0-9.]{0,5})\b/);
  if (named) return pick(REPLY_TO_NAME, seed).replace('${T}', `$${named[1]}`);
  return pick(REPLY_PLAIN, seed);
}

/** Who is around to react, the people you follow first, nobody you blocked */
function audience(seed: string): string[] {
  return SEED_MEMBERS.filter(m => !mine.blocks.includes(m.handle))
    .map((m, k) => ({ h: m.handle, at: h01(`${seed}-aud-${k}`) - (mine.follows.includes(m.handle) ? 0.45 : 0) }))
    .sort((a, b) => a.at - b.at)
    .map(x => x.h);
}

/** What the room will do about a post, and when */
function planReactions(p: Post): Pending[] {
  const now = Date.now();
  const room = audience(p.id);
  if (room.length === 0) return [];
  const out: Pending[] = [];
  const at = (k: string, lo: number, hi: number) => now + Math.round((lo + h01(`${p.id}-${k}`) * (hi - lo)) * 1000);
  let next = 0;
  const someone = () => room[next++ % room.length];
  const likes = 1 + Math.floor(h01(`${p.id}-likes`) * 3);
  for (let i = 0; i < likes; i++) out.push({ at: at(`lt${i}`, 20, 240), kind: 'like', from: someone(), postId: p.id });
  if (h01(`${p.id}-reply`) < 0.7) {
    const from = someone();
    out.push({ at: at('rt', 45, 320), kind: 'comment', from, postId: p.id, text: replyTo(p, `${p.id}-${from}`) });
  }
  if (h01(`${p.id}-follow`) < 0.35) out.push({ at: at('ft', 90, 400), kind: 'follow', from: someone(), postId: p.id });
  return out.sort((a, b) => a.at - b.at);
}

/** Apply everything the room owes you that has come due */
function sweepReactions(): boolean {
  const now = Date.now();
  if (!mine.pending.some(r => r.at <= now)) return false;
  const wants = getAccount().notifications;
  const blocked = new Set(mine.blocks);
  let posts = mine.posts;
  let followers = mine.followers;
  const raised: Note[] = [];
  const waiting: Pending[] = [];
  for (const r of mine.pending) {
    if (r.at > now) {
      waiting.push(r);
      continue;
    }
    /* Somebody blocked between the plan and the landing simply does not */
    if (blocked.has(r.from)) continue;
    const target = posts.find(p => p.id === r.postId);
    if (!target) continue;
    const when = new Date(r.at).toISOString();
    /* WHO IS PART OF THE ID. Without it, two likes landing in the same
       millisecond — which is exactly what happens when a tab is reopened and
       a backlog lands at once — produce one id twice, and React draws one of
       the two notes. */
    const id = `n-${r.kind}-${r.from}-${r.postId}-${r.at}`;
    if (r.kind === 'like') {
      posts = posts.map(p => (p.id === r.postId ? { ...p, likes: p.likes + 1 } : p));
      if (wants.likes) raised.push({ id, at: when, kind: 'like', from: r.from, postId: r.postId, text: 'liked your post', read: false });
    } else if (r.kind === 'comment') {
      const said = r.text ?? REPLY_PLAIN[0];
      posts = posts.map(p => (p.id === r.postId ? { ...p, comments: [...p.comments, { id: `c-${r.from}-${r.at}`, author: r.from, at: when, text: said }] } : p));
      if (wants.comments) raised.push({ id, at: when, kind: 'comment', from: r.from, postId: r.postId, text: `replied: "${said}"`, read: false });
    } else {
      if (followers.includes(r.from)) continue;
      followers = [...followers, r.from];
      if (wants.follows) raised.push({ id, at: when, kind: 'follow', from: r.from, postId: r.postId, text: 'started following you', read: false });
    }
  }
  mine = { ...mine, posts, followers, pending: waiting, extraNotes: [...raised, ...mine.extraNotes].slice(0, NOTE_CAP) };
  persist();
  return true;
}

/*
  THE SWEEP RUNS ONLY WHILE SOMEONE IS WATCHING. It is wired to the listener
  set rather than started at import: a reader on the Weigher has no community
  page mounted and should not be paying for a timer over thirty-four setups.
  The first subscriber starts it and runs one immediately, so a page opened
  after an hour away shows what happened while it was closed; the last one to
  leave stops it.

  IT NEVER WRITES DURING A RENDER. Grading on read was the obvious shape and
  it is a loop: a read that settles a trade writes and emits, which re-renders,
  which reads again. A timer outside React is the only safe place for it.
*/
const SWEEP_MS = 5_000;
let sweeper: number | null = null;
/* Two sweeps, one tick, one emit — bitwise-or rather than || so the second
   always runs: short-circuiting it would leave reactions waiting behind a
   tick in which something happened to settle. */
const sweepAll = () => (sweepGrades() ? 1 : 0) | (sweepReactions() ? 1 : 0);
const startGrading = () => {
  if (sweeper != null || typeof window === 'undefined') return;
  if (sweepAll()) emit();
  sweeper = window.setInterval(() => {
    if (sweepAll()) emit();
  }, SWEEP_MS);
};
const stopGrading = () => {
  if (sweeper == null || listeners.size > 0) return;
  window.clearInterval(sweeper);
  sweeper = null;
};

/* A settlement recorded against a deal this session's seed no longer holds is
   dropped on the way in — see `setupKey`. Keeps the store from growing a
   record of rooms that no longer exist. */
{
  const live = new Set(seeded.filter(p => p.setup).map(p => setupKey(p, p.setup!)));
  const stale = Object.keys(mine.settled).filter(k => !live.has(k));
  if (stale.length) {
    const kept: Record<string, Settlement> = {};
    for (const [k, v] of Object.entries(mine.settled)) if (live.has(k)) kept[k] = v;
    mine = { ...mine, settled: kept };
    persist();
  }
}

const withMine = (base: Post): Post => {
  const shown = graded(hydrate(base));
  const liked = mine.likes.includes(base.id);
  const reposted = mine.reposts.includes(base.id);
  const added = mine.comments[base.id] ?? [];
  if (!liked && !reposted && added.length === 0) return shown;
  return { ...shown, likes: shown.likes + (liked ? 1 : 0), reposts: shown.reposts + (reposted ? 1 : 0), comments: added.length ? [...shown.comments, ...added] : shown.comments };
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

/* ---- what a setup is worth ------------------------------------------------------------ */

/** What the setup was risking, in price — the distance from entry to stop */
export const riskOf = (s: Setup): number => Math.abs(s.entry - s.stop);
/** The reward-to-risk the author wrote it for: 2 means the target is twice the stop away */
export const plannedR = (s: Setup): number | null => {
  const risk = riskOf(s);
  return risk > 0 ? Math.abs(s.target - s.entry) / risk : null;
};
/*
  WHAT A FINISHED TRADE MADE, IN R.

  One formula covers every outcome because the settlement carries the price it
  ended at: a target settles at the target and comes out at exactly the R it
  was written for, a stop settles at the stop and comes out at exactly -1, and
  a scratch or an early close comes out at whatever it actually was.

  A win rate on its own can be bought: aim at a target a tenth of the stop
  away and win nine times in ten while losing money. The average R is the
  number that cannot be gamed that way, which is why the record prints both.
*/
export const realisedR = (s: Setup): number | null => {
  if (!s.settled) return null;
  const risk = riskOf(s);
  if (risk <= 0) return null;
  const move = s.bias === 'bullish' ? s.settled.price - s.entry : s.entry - s.settled.price;
  return move / risk;
};

/** An open setup read against the price right now */
export interface SetupLive {
  price: number;
  /** How far it has come from entry towards target: 1 is there, negative is the wrong way */
  progress: number;
  /** Where the price sits on the stop-to-target rail, 0..1, for drawing */
  railAt: number;
  /** Where the entry sits on that same rail */
  entryAt: number;
  /** What it is worth right now, in R — before it settles at a level */
  liveR: number;
  /** Move from entry, in per cent */
  changePct: number;
}
export function liveSetup(s: Setup): SetupLive | null {
  if (s.outcome !== 'open') return null;
  const price = Simulator.TICKERS[s.ticker]?.currentPrice;
  if (price == null || !Number.isFinite(price)) return null;
  const risk = riskOf(s);
  const reward = Math.abs(s.target - s.entry);
  const move = s.bias === 'bullish' ? price - s.entry : s.entry - price;
  const lo = Math.min(s.stop, s.target);
  const hi = Math.max(s.stop, s.target);
  const span = hi - lo;
  const place = (v: number) => (span > 0 ? Math.min(1, Math.max(0, (v - lo) / span)) : 0.5);
  return {
    price,
    progress: reward > 0 ? move / reward : 0,
    railAt: place(price),
    entryAt: place(s.entry),
    liveR: risk > 0 ? move / risk : 0,
    changePct: s.entry > 0 ? ((price - s.entry) / s.entry) * 100 : 0,
  };
}

/** The track record — every finished setup, and the record it adds up to */
export interface TrackRecord {
  finished: { post: Post; setup: Setup }[];
  open: number;
  wins: number;
  losses: number;
  scratched: number;
  closed: number;
  winRate: number | null;
  /** Average R across every finished trade, the scratches included */
  avgR: number | null;
  /** What they add up to, in R */
  totalR: number | null;
}
export function trackRecord(handle: string): TrackRecord {
  const setups = postsBy(handle).filter(p => p.setup).map(p => ({ post: p, setup: p.setup! }));
  const finished = setups.filter(s => s.setup.outcome !== 'open');
  const wins = finished.filter(s => s.setup.outcome === 'target hit').length;
  const losses = finished.filter(s => s.setup.outcome === 'stopped out').length;
  const scratched = finished.filter(s => s.setup.outcome === 'scratched').length;
  const closed = finished.filter(s => s.setup.outcome === 'closed').length;
  const decided = wins + losses;
  const rs = finished.map(s => realisedR(s.setup)).filter((r): r is number => r != null);
  const totalR = rs.length ? rs.reduce((a, r) => a + r, 0) : null;
  return {
    finished,
    open: setups.length - finished.length,
    wins,
    losses,
    scratched,
    closed,
    winRate: decided ? Math.round((wins / decided) * 100) : null,
    avgR: totalR != null ? totalR / rs.length : null,
    totalR,
  };
}

/*
  WHAT THE ROOM IS TALKING ABOUT — $names over the last day, weighted by the
  likes and replies they drew.

  THE WINDOW IS A DAY, not the six hours it was (2026-09-13). The room's own
  posts are spread over forty, so a six-hour window caught six names at one
  post each: a "trending" list where nothing out-ranked anything, and every
  row read "1 posts · MIXED". A day is the span this room actually fills.
*/
export const TRENDING_HOURS = 24;
export function trending(): Trend[] {
  const since = Date.now() - TRENDING_HOURS * 3600_000;
  const heat = new Map<string, { posts: number; setups: number; heat: number; bull: number; bear: number }>();
  for (const p of allPosts()) {
    if (new Date(p.at).getTime() < since) continue;
    const names = new Set<string>();
    for (const m of p.text.matchAll(/\$([A-Z][A-Z0-9.]{0,5})\b/g)) names.add(m[1]);
    if (p.setup) names.add(p.setup.ticker);
    for (const n of names) {
      const cur = heat.get(n) ?? { posts: 0, setups: 0, heat: 0, bull: 0, bear: 0 };
      cur.posts++;
      cur.heat += 1 + p.likes / 40 + p.comments.length / 2;
      if (p.setup?.ticker === n) {
        cur.setups++;
        if (p.setup.bias === 'bullish') cur.bull++;
        else cur.bear++;
      }
      heat.set(n, cur);
    }
  }
  return [...heat.entries()]
    .map(([ticker, v]) => ({
      ticker,
      posts: v.posts,
      setups: v.setups,
      heat: v.heat,
      /* A LEAN IS ONLY READ OFF SETUPS. A name mentioned in three thoughts and
         traded by nobody has no side, and the list used to call that "MIXED"
         — which reads as "the room disagrees" when the truth is that nobody
         has said. Mixed now means what it says: they took both sides, evenly. */
      bias: (v.bull === 0 && v.bear === 0 ? null : v.bull > v.bear ? 'bullish' : v.bear > v.bull ? 'bearish' : 'mixed') as Trend['bias'],
    }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 8);
}

/** Who to follow — the members you do not yet, the most followed first */
export const suggestions = (): Member[] => SEED_MEMBERS.filter(m => !mine.follows.includes(m.handle) && !mine.blocks.includes(m.handle)).sort((a, b) => b.followers - a.followers).slice(0, 5);

export function notes(): Note[] {
  const read = new Set(mine.readNotes);
  return [...mine.extraNotes, ...seedNotes(mine.follows, seeded)].map(n => ({ ...n, read: n.read || read.has(n.id) })).sort((a, b) => b.at.localeCompare(a.at));
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

/** The most a post may say — the composer's counter reads this, and so does
    the store, so the limit is enforced and not merely displayed */
export const MAX_POST = 1000;

/*
  WHAT IS WRONG WITH A SETUP, or null.

  A setup whose target is the wrong side of its entry is not a trade, it is a
  typo — and it used to be accepted (2026-09-13): the composer checked only
  that the three prices were numbers, so a BULLISH setup with the target UNDER
  the entry posted happily and then graded as an instant win the moment price
  did anything. The rule lives here rather than in the composer because the
  grading engine downstream reads these three numbers as a direction.
*/
export function checkSetup(s: Omit<Setup, 'outcome' | 'updates'> | undefined): string | null {
  if (!s) return null;
  if (!s.ticker.trim()) return 'A setup needs a name.';
  for (const [label, v] of [['entry', s.entry], ['target', s.target], ['stop', s.stop]] as const) {
    if (!Number.isFinite(v) || v <= 0) return `A setup needs an ${label === 'entry' ? 'entry' : label} above zero.`;
  }
  if (s.bias === 'bullish') {
    if (s.target <= s.entry) return `A bullish setup takes profit ABOVE the entry — ${s.target} is not over ${s.entry}.`;
    if (s.stop >= s.entry) return `A bullish setup stops out BELOW the entry — ${s.stop} is not under ${s.entry}.`;
  } else {
    if (s.target >= s.entry) return `A bearish setup takes profit BELOW the entry — ${s.target} is not under ${s.entry}.`;
    if (s.stop <= s.entry) return `A bearish setup stops out ABOVE the entry — ${s.stop} is not over ${s.entry}.`;
  }
  return null;
}

export function post(text: string, images: string[], setup?: Omit<Setup, 'outcome' | 'updates'>): Post | string {
  const gate = postGate();
  if (gate) return gate;
  const wrong = checkSetup(setup);
  if (wrong) return wrong;
  const body = text.trim().slice(0, MAX_POST);
  if (body.length < 2 && !setup && images.length === 0) return 'Say something first.';
  const stamped = Date.now();
  const wasPics = pics.snapshot();
  const kept = pics.keep(images, 'img');
  const p: Post = {
    id: `me-${stamped}`,
    author: getAccount().handle,
    at: stamp(),
    text: body,
    images: kept,
    setup: setup ? { ...setup, ticker: setup.ticker.trim().toUpperCase(), outcome: 'open', updates: [] } : undefined,
    likes: 0,
    reposts: 0,
    comments: [],
  };
  /* A POST THAT DID NOT REACH STORAGE IS NOT A POST. Staged, written, and put
     back if the write failed — with a message, rather than a row that sits
     there looking posted until the next reload takes it away. */
  const wasMine = mine;
  /* AND WHAT THE ROOM WILL DO ABOUT IT — scheduled now, landed by the sweep */
  mine = { ...mine, posts: [p, ...mine.posts], postTimes: [...mine.postTimes.slice(-40), stamped], pending: [...mine.pending, ...planReactions(p)] };
  if (!persist()) {
    mine = wasMine;
    pics.restore(wasPics);
    persist();
    emit();
    return kept.length ? 'This browser has no room left for those pictures — post it with fewer screenshots.' : 'This browser has no room left to keep that post.';
  }
  emit();
  return hydrate(p);
}
/*
  WHAT THE AUTHOR OF A SETUP MAY STILL DO.

  Not much, and that is the point. The four finish buttons that used to live
  here — target hit, stopped out, scratched, closed — wrote the outcome
  straight onto the trade, which made the whole track record a self-report.
  They are gone. What is left either says something about the trade without
  deciding it, or closes it at a price the market has to agree with.
*/
/** The kinds of update an author may write. 'target', 'invalidated' and
    'closed' are the grader's words and no longer take an author's. */
export type AuthorUpdate = 'trim' | 'note';

const myOpenSetup = (postId: string): Setup | string => {
  const found = mine.posts.find(p => p.id === postId);
  if (!found?.setup) return 'That setup is not yours, or it is gone.';
  if (found.setup.outcome !== 'open') return 'That setup has already settled — its record is written.';
  return found.setup;
};
const rewriteSetup = (postId: string, next: Setup) => bump({ posts: mine.posts.map(p => (p.id === postId ? { ...p, setup: next } : p)) });

export function addUpdate(postId: string, kind: AuthorUpdate, text: string): string | null {
  const s = myOpenSetup(postId);
  if (typeof s === 'string') return s;
  rewriteSetup(postId, { ...s, updates: [...s.updates, { at: stamp(), kind, text: text.trim() || UPDATE_TEXT[kind][0] }] });
  return null;
}

/** Move the stop — tighter only. A stop that moves away from the entry is a
    losing trade being given more room, and it is never allowed here. */
export function moveStop(postId: string, to: number): string | null {
  const s = myOpenSetup(postId);
  if (typeof s === 'string') return s;
  if (!Number.isFinite(to) || to <= 0) return 'A stop is a price above zero.';
  const price = Simulator.TICKERS[s.ticker]?.currentPrice;
  if (s.bias === 'bullish') {
    if (to <= s.stop) return `A bullish stop only moves up — ${to} is not above ${s.stop}.`;
    if (to >= s.target) return `${to} is at or past the target. That is a take-profit, not a stop.`;
    if (price != null && to >= price) return `${to} is at or above the price (${price.toFixed(2)}) — that closes the trade. Close it here instead.`;
  } else {
    if (to >= s.stop) return `A bearish stop only moves down — ${to} is not below ${s.stop}.`;
    if (to <= s.target) return `${to} is at or past the target. That is a take-profit, not a stop.`;
    if (price != null && to <= price) return `${to} is at or below the price (${price.toFixed(2)}) — that closes the trade. Close it here instead.`;
  }
  const word = to === s.entry ? ' — breakeven' : '';
  rewriteSetup(postId, { ...s, stop: to, updates: [...s.updates, { at: stamp(), kind: 'stop', text: `Stop ${s.stop} → ${to}${word}.` }] });
  return null;
}

/** Close it where it stands. The price is recorded and the trade counts —
    there is no outcome here to choose, only a price to be held to. */
export function closeHere(postId: string, text = ''): string | null {
  const s = myOpenSetup(postId);
  if (typeof s === 'string') return s;
  const price = Simulator.TICKERS[s.ticker]?.currentPrice;
  if (price == null || !Number.isFinite(price)) return `No price for $${s.ticker} right now — it cannot be closed honestly.`;
  const at = stamp();
  const said = text.trim() ? { ...s, updates: [...s.updates, { at, kind: 'note' as UpdateKind, text: text.trim() }] } : s;
  rewriteSetup(postId, settle(said, { outcome: 'closed', at, price: Number(price.toFixed(2)), why: 'closed' }));
  return null;
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
/** One note read — opening it from the bell clears that one, not the lot */
export function markNoteRead(id: string): void {
  if (mine.readNotes.includes(id)) return;
  bump({ readNotes: [...mine.readNotes, id] });
}
export function notify(n: Omit<Note, 'id' | 'at' | 'read'>): void {
  bump({ extraNotes: [{ ...n, id: `n-${Date.now()}`, at: stamp(), read: false }, ...mine.extraNotes] });
}

/** Reset the seed's live counters — the tests' door */
export function resetRoomForTests(): void {
  mine = { ...DEFAULT_MINE };
  pics.restore({});
  emit();
}
