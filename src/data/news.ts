/*
==================================================
  SLAYER TERMINAL - NEWS + OUTCOME MODEL (news.ts)
  Two jobs: a stock-news feed, and a predictive read
  of each headline — direction odds, expected move
  and the historical analog behind the number.
  Deterministic per session day; the real wire and
  model API fill the same contract later.
==================================================
*/

import { dayKey, h01, hPick, hRange } from '../core/rng';
import { now } from '../core/clock';
import { UNIVERSE, lookup, type UniverseName } from './universe';

export type NewsCategory = 'Earnings' | 'Guidance' | 'Analyst' | 'Macro' | 'M&A' | 'Product' | 'Regulatory';

export interface NewsPrediction {
  /** Model P(ticker closes up next session), 0–100 */
  probUpPct: number;
  /** Signed expected move, next session, % */
  expMove1dPct: number;
  /** Signed expected move, five sessions, % */
  expMove5dPct: number;
  /** Model confidence in the read, 0–100 */
  confidencePct: number;
  /** The historical base rate behind the number */
  analog: string;
  /** What to do with it */
  playbook: string;
}

export interface NewsItem {
  id: string;
  time: string;
  minutesAgo: number;
  /** Release timestamp, epoch ms — the drip's clock and the alert's ref. */
  atMs: number;
  source: string;
  /** null = macro / index-level */
  ticker: string | null;
  headline: string;
  category: NewsCategory;
  /** −1…+1 */
  sentiment: number;
  /** 0…1 — how market-moving the item is */
  magnitude: number;
  prediction: NewsPrediction;
}

const SOURCES = ['Bloomberg', 'Reuters', 'WSJ', 'CNBC', 'Barrons', 'FT'];
const BANKS = ['Morgan Stanley', 'Goldman', 'JPMorgan', 'Citi', 'UBS', 'Barclays'];

interface Template {
  category: NewsCategory;
  sentiment: number;
  magnitude: number;
  make: (u: UniverseName, h: (tag: string) => number) => string;
}

const TICKER_TEMPLATES: Template[] = [
  {
    category: 'Analyst',
    sentiment: 0.55,
    magnitude: 0.4,
    make: (u, h) =>
      `${BANKS[Math.floor(h('bank') * BANKS.length)]} upgrades ${u.name} to Buy, lifts target to $${Math.round(u.px * (1.12 + h('pt') * 0.15))}`,
  },
  {
    category: 'Analyst',
    sentiment: -0.5,
    magnitude: 0.38,
    make: (u, h) =>
      `${BANKS[Math.floor(h('bank') * BANKS.length)]} cuts ${u.name} to Neutral on ${hPickStr(h('why'), ['valuation', 'margin pressure', 'demand risk'])}`,
  },
  {
    category: 'Guidance',
    sentiment: 0.7,
    magnitude: 0.65,
    make: u => `${u.name} raises full-year outlook, cites stronger-than-expected demand`,
  },
  {
    category: 'Guidance',
    sentiment: -0.75,
    magnitude: 0.7,
    make: u => `${u.name} trims guidance; management flags softer second half`,
  },
  {
    category: 'Product',
    sentiment: 0.45,
    magnitude: 0.35,
    make: (u, h) =>
      `${u.name} unveils next-gen ${hPickStr(h('prod'), ['AI platform', 'flagship product line', 'enterprise suite'])}; early reviews positive`,
  },
  {
    category: 'M&A',
    sentiment: 0.6,
    magnitude: 0.75,
    make: (u, h) => `${u.name} in advanced talks to acquire ${hPickStr(h('tgt'), ['a private AI startup', 'a logistics rival', 'a fintech platform'])}, sources say`,
  },
  {
    category: 'Regulatory',
    sentiment: -0.6,
    magnitude: 0.55,
    make: (u, h) =>
      `${hPickStr(h('agency'), ['FTC', 'DOJ', 'EU Commission'])} opens review into ${u.name}'s ${hPickStr(h('area'), ['market practices', 'pending acquisition', 'data handling'])}`,
  },
  {
    category: 'Earnings',
    sentiment: 0.65,
    magnitude: 0.8,
    make: (u, h) => `${u.name} beats on top and bottom line; ${hPickStr(h('kpi'), ['margins', 'bookings', 'unit growth'])} outpace estimates`,
  },
  {
    category: 'Earnings',
    sentiment: -0.7,
    magnitude: 0.8,
    make: (u, h) => `${u.name} misses revenue estimates; ${hPickStr(h('kpi'), ['inventory build', 'churn', 'cost inflation'])} weighs`,
  },
];

const MACRO_TEMPLATES: Array<{ sentiment: number; magnitude: number; text: string }> = [
  { sentiment: 0.5, magnitude: 0.7, text: 'CPI cools to 2.4% y/y vs 2.6% est — rate-cut odds firm up' },
  { sentiment: -0.45, magnitude: 0.65, text: '10-yr yield pushes through 4.6% as supply concerns build' },
  { sentiment: 0.35, magnitude: 0.5, text: 'Jobless claims steady; soft-landing narrative intact' },
  { sentiment: -0.55, magnitude: 0.7, text: 'ISM services surprise contraction — growth scare risk returns' },
  { sentiment: 0.2, magnitude: 0.45, text: "Fed's Waller: policy 'well positioned', open to cuts if inflation cooperates" },
  { sentiment: -0.3, magnitude: 0.5, text: 'Crude jumps 3% on supply disruption; transports lag' },
];

/*
  THE THEMES (Noah, 2026-09-09: "can we get some stuff on the wire about oil,
  chinese ev, chips like amd and nvda so i can see how it looks on the map"):
  stories with a fixed name and fixed words, so the day's wire always carries
  the complexes a trader actually watches — and the map always has pins
  outside the American cluster (Riyadh, Vienna, Houston; Shenzhen, Shanghai,
  Guangzhou, Beijing; Hsinchu, Veldhoven, Taipei). A share of each day's
  slots draws from here (THEME_SHARE); the rest is the generic wire. Names
  must exist in universe.ts (for price and beta) and in newsroom.ts HQ (for
  the pin); a macro theme story finds its city in its own words.
*/
interface ThemeStory {
  ticker: string | null;
  category: NewsCategory;
  sentiment: number;
  magnitude: number;
  text: string;
}
const THEME_STORIES: ThemeStory[] = [
  /* oil */
  { ticker: null, category: 'Macro', sentiment: -0.3, magnitude: 0.6, text: 'OPEC+ extends voluntary cuts through Q1; Brent tops $84' },
  { ticker: null, category: 'Macro', sentiment: -0.2, magnitude: 0.45, text: 'EIA reports a surprise 4.2M-barrel crude draw at Cushing; WTI up 2%' },
  { ticker: null, category: 'Macro', sentiment: 0.25, magnitude: 0.5, text: 'Saudi Aramco cuts October selling prices to Asia; Brent slips below $80' },
  { ticker: null, category: 'Macro', sentiment: -0.5, magnitude: 0.75, text: 'Tanker traffic through Hormuz slows as Gulf tensions rise; Brent +4%' },
  { ticker: 'XOM', category: 'Guidance', sentiment: 0.5, magnitude: 0.55, text: 'Exxon lifts Permian output target to 1.3M barrels a day by 2027' },
  { ticker: 'OXY', category: 'Analyst', sentiment: 0.45, magnitude: 0.4, text: 'Berkshire adds to its Occidental stake for a third week; shares bid' },
  { ticker: 'COP', category: 'Earnings', sentiment: 0.6, magnitude: 0.7, text: 'ConocoPhillips beats on Lower 48 volumes; buyback raised to $20B' },
  /* chinese ev */
  { ticker: 'BYDDY', category: 'Product', sentiment: 0.55, magnitude: 0.55, text: 'BYD August deliveries hit a record 373k; overseas sales double' },
  { ticker: 'NIO', category: 'Guidance', sentiment: -0.6, magnitude: 0.65, text: 'NIO trims Q3 delivery guidance as the price war bites; margins under pressure' },
  { ticker: 'XPEV', category: 'Earnings', sentiment: 0.6, magnitude: 0.7, text: 'XPeng narrows its loss as the Mona line sells out; guides deliveries higher' },
  { ticker: 'LI', category: 'Analyst', sentiment: -0.45, magnitude: 0.4, text: 'Goldman cuts Li Auto to Neutral on the cost of its BEV ramp' },
  { ticker: null, category: 'Macro', sentiment: -0.35, magnitude: 0.6, text: 'EU confirms tariffs of up to 38% on China-built EVs; Beijing vows a response' },
  { ticker: null, category: 'Macro', sentiment: 0.3, magnitude: 0.45, text: 'China unveils trade-in subsidies for EVs; Shanghai showroom traffic jumps' },
  /* chips */
  { ticker: 'NVDA', category: 'Earnings', sentiment: 0.7, magnitude: 0.85, text: "NVIDIA beats; data-center revenue +94% y/y, Blackwell 'sold out into next year'" },
  { ticker: 'NVDA', category: 'Regulatory', sentiment: -0.55, magnitude: 0.65, text: 'Commerce Dept weighs new export controls on AI chips to China; NVIDIA, AMD slip' },
  { ticker: 'AMD', category: 'Product', sentiment: 0.5, magnitude: 0.5, text: 'AMD unveils MI350 accelerators; claims parity with Blackwell on inference' },
  { ticker: 'AMD', category: 'Analyst', sentiment: 0.45, magnitude: 0.4, text: 'Morgan Stanley lifts AMD target to $200 on server share gains' },
  { ticker: 'TSM', category: 'Guidance', sentiment: 0.6, magnitude: 0.65, text: 'TSMC raises 2025 capex to $40B on AI demand; 3nm fully booked' },
  { ticker: 'ASML', category: 'Earnings', sentiment: -0.65, magnitude: 0.75, text: 'ASML bookings miss as China orders fade; guides 2025 to the low end' },
  { ticker: null, category: 'Macro', sentiment: -0.45, magnitude: 0.6, text: 'Taiwan Strait drills prompt foundry insurance repricing; SOX -2%' },
];
/** The share of a day's slots that draw a theme story */
const THEME_SHARE = 0.4;

function hPickStr(v: number, arr: string[]): string {
  return arr[Math.floor(v * arr.length) % arr.length];
}

// ---- outcome model ------------------------------------------------------------
// Expected move scales with |sentiment| × magnitude × beta; direction odds are a
// squashed version of the same score so headline strength and odds stay coherent.
const CATEGORY_KICK: Record<NewsCategory, number> = {
  Earnings: 3.2,
  Guidance: 2.8,
  'M&A': 2.6,
  Regulatory: 1.9,
  Analyst: 1.4,
  Product: 1.2,
  Macro: 1.0,
};

const CATEGORY_BASE: Record<NewsCategory, { median: string; hit: number; n: number }> = {
  Earnings: { median: '3.1%', hit: 71, n: 96 },
  Guidance: { median: '2.6%', hit: 68, n: 74 },
  'M&A': { median: '2.2%', hit: 66, n: 38 },
  Regulatory: { median: '1.6%', hit: 62, n: 45 },
  Analyst: { median: '1.1%', hit: 60, n: 132 },
  Product: { median: '0.9%', hit: 57, n: 88 },
  Macro: { median: '0.8%', hit: 58, n: 210 },
};

function predict(category: NewsCategory, sentiment: number, magnitude: number, beta: number, seed: string): NewsPrediction {
  const kick = CATEGORY_KICK[category];
  const signal = sentiment * magnitude;
  const expMove1dPct = signal * kick * beta * (0.85 + h01(`${seed}-em`) * 0.3);
  const expMove5dPct = expMove1dPct * (1.35 + h01(`${seed}-em5`) * 0.5);
  const probUpPct = Math.round(50 + 40 * Math.tanh(signal * 2.1));
  const confidencePct = Math.round(42 + magnitude * 40 + h01(`${seed}-cf`) * 12);
  const base = CATEGORY_BASE[category];
  const dir = sentiment >= 0 ? 'higher' : 'lower';
  const analog = `${base.n} similar ${category.toLowerCase()} headlines on large caps: median ${base.median} move, ${base.hit}% closed ${dir} next session.`;

  let playbook: string;
  const abs1d = Math.abs(expMove1dPct);
  if (confidencePct < 55 || abs1d < 0.6) {
    playbook = 'Low-edge headline — no trade on its own. Stack it with flow and positioning before acting.';
  } else if (sentiment > 0 && magnitude > 0.6) {
    playbook = 'Strength tends to hold — buy the first pullback rather than the open print; invalid if day-one gains fully fade.';
  } else if (sentiment > 0) {
    playbook = 'Modest positive drift expected — sell into the pop if it overshoots the expected move.';
  } else if (magnitude > 0.6) {
    playbook = 'Downside repricing usually runs multiple sessions — fade bounces while the 5-day expected move stays negative.';
  } else {
    playbook = 'Knee-jerk dip likely absorbed — wait for stabilization; reassess if a second headline lands.';
  }

  return {
    probUpPct,
    expMove1dPct,
    expMove5dPct,
    confidencePct,
    analog,
    playbook,
  };
}

// ---- the deep read ----------------------------------------------------------------
/*
  The outcome tab answers "what does this headline do to price". The deep read
  answers the harder question underneath it: how much of that is ALREADY in the
  price, how long the catalyst keeps working, and whether the options book is
  backing the story or leaning against it. Same contract, different depth.
*/

export interface NewsDeepRead {
  /** % of the expected move the tape has already discounted */
  pricedInPct: number;
  /** Sessions until the catalyst's pull halves */
  halfLifeSessions: number;
  /** The options market's implied move for the event, ± % */
  eventVolPct: number;
  /** −1…+1 — does the book agree with the wire? */
  bookAlignment: number;
  bookLabel: 'CONFIRMS' | 'NEUTRAL' | 'FADES';
  /** Which force is actually doing the moving */
  driver: 'INFORMATIONAL' | 'MECHANICAL';
  /** How far the book leans on its own, −1…+1 */
  bookLean: number;
  read: string;
  invalidation: string;
}

/*
  How long each kind of catalyst keeps working, in sessions. An analyst note is
  spent within a day; a deal reprices the name for a week. Scaled by how big the
  item is — a large-magnitude headline of any kind outlives a small one.
*/
const HALF_LIFE_SESSIONS: Record<NewsCategory, number> = {
  Earnings: 4.2,
  Guidance: 3.4,
  'M&A': 5.6,
  Analyst: 0.9,
  Macro: 2.3,
  Product: 1.8,
  Regulatory: 3.0,
};

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The positioning read behind a headline — deterministic per item + session day. */
export function buildNewsDeepRead(item: NewsItem): NewsDeepRead {
  const day = dayKey();
  const s = (tag: string) => `${item.id}-${day}-deep-${tag}`;
  const { sentiment, magnitude, category, minutesAgo, prediction } = item;

  // Catalyst decay — bigger headlines keep working longer
  const halfLifeSessions = Number((HALF_LIFE_SESSIONS[category] * (0.7 + magnitude * 0.7)).toFixed(1));

  // Where the options book sits on its own, independent of the wire
  const bookLean = Number(hRange(s('book'), -0.85, 0.85).toFixed(2));
  // Agreement is signed: same direction = confirms, opposite = fades. A book (or
  // a wire) sitting near flat lands neutral no matter what the other one does.
  const agree = Math.sign(sentiment) === Math.sign(bookLean) ? 1 : -1;
  const bookAlignment = Number(
    clampN(agree * Math.min(Math.abs(sentiment), Math.abs(bookLean)) * 2.2, -1, 1).toFixed(2)
  );
  const bookLabel: NewsDeepRead['bookLabel'] =
    bookAlignment > 0.2 ? 'CONFIRMS' : bookAlignment < -0.2 ? 'FADES' : 'NEUTRAL';

  // Priced in. A headline that has already printed is never at zero — the tape
  // reacts on the first print — so the read starts at a base and climbs from
  // there: with the clock (how much of the half-life has burned) and with
  // positioning that was already leaning this way before the story landed. A
  // book leaning AGAINST it pulls the number down: that move is still to come.
  const elapsedSessions = minutesAgo / 390; // 390 min in a US session
  const burned = 1 - Math.pow(0.5, elapsedSessions / Math.max(halfLifeSessions, 0.1));
  const alignedShare = (bookAlignment + 1) / 2; // 0 = fully against, 1 = fully with
  const pricedInPct = Math.round(
    clampN(0.3 + 0.48 * burned + 0.2 * (alignedShare - 0.5) * 2, 0.05, 0.98) * 100
  );

  // What the options market charges for the event — always at least a little
  // wider than the model's point estimate, because it pays for both tails.
  const eventVolPct = Number(
    (Math.abs(prediction.expMove1dPct) * hRange(s('vol'), 1.05, 1.9) + 0.15).toFixed(1)
  );

  // If the book leans harder than the story does, the move is positioning
  // unwinding rather than the news being digested.
  const driver: NewsDeepRead['driver'] =
    Math.abs(bookLean) > Math.abs(sentiment) ? 'MECHANICAL' : 'INFORMATIONAL';

  const name = item.ticker ?? 'the index';
  const dirWord = sentiment >= 0 ? 'higher' : 'lower';
  const read =
    pricedInPct >= 70
      ? `Most of this is already in ${name} — about ${pricedInPct}% of the move has been discounted, and the catalyst is ${halfLifeSessions} sessions from losing half its pull. ${
          bookLabel === 'FADES'
            ? 'The options book is leaning the other way, which is the more interesting side of the trade.'
            : 'Chasing it here pays for information the tape already has.'
        }`
      : bookLabel === 'FADES'
        ? `The wire reads ${dirWord} but the book is positioned against it — only ${pricedInPct}% is discounted, so either the story is wrong or positioning is offside. ${
            driver === 'MECHANICAL' ? 'Positioning is the bigger force here.' : 'The story is the bigger force here.'
          }`
        : bookLabel === 'CONFIRMS'
          ? `Wire and book agree on ${name} — the story reads ${dirWord} and positioning is already tilted that way, with ${pricedInPct}% discounted and ${halfLifeSessions} sessions of pull left. Options are pricing ±${eventVolPct}% for the event.`
          : `The book is not taking a side on ${name} yet — ${pricedInPct}% discounted with ${halfLifeSessions} sessions of catalyst left, and options pricing ±${eventVolPct}%. ${
              driver === 'MECHANICAL' ? 'What moves it is positioning, not the headline.' : 'This one still trades on the story.'
            }`;

  const invalidation =
    sentiment >= 0
      ? `The read dies if ${name} gives back the initial pop and the book flips negative before the catalyst decays.`
      : `The read dies if ${name} reclaims the pre-headline level and the book stops leaning short.`;

  return {
    pricedInPct,
    halfLifeSessions,
    eventVolPct,
    bookAlignment,
    bookLabel,
    driver,
    bookLean,
    read,
    invalidation,
  };
}

// ---- feed ------------------------------------------------------------------------
/*
  THE DRIP (Noah, 2026-08-29, choosing option b): stories are SCHEDULED
  through the day, not stamped with frozen ages. Each gets a deterministic
  release minute; the feed returns only what has already landed, and ages
  grow for real — so freshness transitions live, the planet ripples when a
  story actually arrives, and a news alert has something true to fire on.
  The engine clock (core/clock now()) keeps replay honest. Memoized per
  minute: every surface reads this, and the schedule only changes when the
  clock's minute does.
*/
const FEED_SIZE = 24;
let feedCache: { key: string; items: NewsItem[] } | null = null;

export function buildNewsFeed(): NewsItem[] {
  const day = dayKey();
  const t0 = now();
  const nowMin = t0.getHours() * 60 + t0.getMinutes();
  const cacheKey = `${day}-${nowMin}`;
  if (feedCache?.key === cacheKey) return feedCache.items;
  const dayStartMs = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()).getTime();
  const items: NewsItem[] = [];

  for (let i = 0; i < FEED_SIZE; i++) {
    const seed = `news-${day}-${i}`;
    const h = (tag: string) => h01(`${seed}-${tag}`);
    const isMacro = h('macro') < 0.28;
    const releaseMin = 15 + Math.floor(h('t') * 1380);
    if (releaseMin > nowMin) continue; // not landed yet — the drip
    const minutesAgo = nowMin - releaseMin;
    const atMs = dayStartMs + releaseMin * 60000;
    const time = `${String(Math.floor(releaseMin / 60)).padStart(2, '0')}:${String(releaseMin % 60).padStart(2, '0')}`;
    const source = hPick(`${seed}-src`, SOURCES);

    if (h('theme') < THEME_SHARE) {
      /* A theme story: the day's roll picks where the list starts, the slot
         walks it — so no theme repeats within a day */
      const roll = Math.floor(h01(`${day}-theme-roll`) * THEME_STORIES.length);
      const t = THEME_STORIES[(roll + i) % THEME_STORIES.length];
      const u = t.ticker ? lookup(t.ticker) : undefined;
      const sentiment = t.sentiment * (0.85 + h('sj') * 0.3);
      const magnitude = t.magnitude * (0.85 + h('mj') * 0.3);
      items.push({
        id: seed,
        time,
        minutesAgo,
        atMs,
        source,
        ticker: t.ticker,
        headline: t.text,
        category: t.category,
        sentiment,
        magnitude,
        prediction: predict(t.category, sentiment, magnitude, u?.beta ?? 1, seed),
      });
    } else if (isMacro) {
      const t = MACRO_TEMPLATES[Math.floor(h('mt') * MACRO_TEMPLATES.length)];
      const sentiment = t.sentiment * (0.85 + h('sj') * 0.3);
      const magnitude = t.magnitude * (0.85 + h('mj') * 0.3);
      items.push({
        id: seed,
        time,
        minutesAgo,
        atMs,
        source,
        ticker: null,
        headline: t.text,
        category: 'Macro',
        sentiment,
        magnitude,
        prediction: predict('Macro', sentiment, magnitude, 1, seed),
      });
    } else {
      const u = UNIVERSE[Math.floor(h('tk') * UNIVERSE.length)];
      const t = TICKER_TEMPLATES[Math.floor(h('tpl') * TICKER_TEMPLATES.length)];
      const sentiment = t.sentiment * (0.8 + h('sj') * 0.4);
      const magnitude = t.magnitude * (0.8 + h('mj') * 0.4);
      items.push({
        id: seed,
        time,
        minutesAgo,
        atMs,
        source,
        ticker: u.ticker,
        headline: t.make(u, h),
        category: t.category,
        sentiment,
        magnitude,
        prediction: predict(t.category, sentiment, magnitude, u.beta, seed),
      });
    }
  }

  const sorted = items.sort((a, b) => a.minutesAgo - b.minutesAgo);
  feedCache = { key: cacheKey, items: sorted };
  return sorted;
}

/** The name's graded headlines as timestamps — what a news alert watches.
    Narrowed here so AlertContext carries data, not the whole wire. */
export function newsPulse(ticker: string): readonly { atMs: number; graded: boolean }[] {
  return buildNewsFeed()
    .filter(n => n.ticker === ticker)
    .map(n => ({ atMs: n.atMs, graded: Math.abs(n.sentiment) > 0.12 }));
}

/** Aggregate news lean for one name, −1…+1 — consumed by Compass and Stocks. */
export function tickerSentiment(ticker: string): number {
  const feed = buildNewsFeed();
  const mine = feed.filter(n => n.ticker === ticker);
  if (mine.length === 0) {
    // No headline today — drift with a mild deterministic sector mood instead.
    const u = lookup(ticker);
    return u ? hRange(`${dayKey()}-mood-${u.sector}`, -0.25, 0.35) : 0;
  }
  const w = mine.reduce((a, n) => a + Math.abs(n.magnitude), 0) || 1;
  return mine.reduce((a, n) => a + n.sentiment * Math.abs(n.magnitude), 0) / w;
}

/** Overall tape mood from the feed — the gauge at the top of the News page. */
export function marketMood(): { score: number; label: string; note: string } {
  const feed = buildNewsFeed();
  const w = feed.reduce((a, n) => a + n.magnitude, 0) || 1;
  const score = feed.reduce((a, n) => a + n.sentiment * n.magnitude, 0) / w;
  const label = score > 0.15 ? 'LEANS BULLISH' : score < -0.15 ? 'LEANS BEARISH' : 'MIXED';
  const note =
    label === 'LEANS BULLISH'
      ? 'Positive catalysts outweigh — good news is getting bought while the market digests it.'
      : label === 'LEANS BEARISH'
        ? 'Negative catalysts dominate — rallies look suspect until the headline pressure clears.'
        : 'Cross-currents today — single-name stories matter more than overall market direction.';
  return { score, label, note };
}
