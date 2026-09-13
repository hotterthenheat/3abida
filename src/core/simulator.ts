/*
==================================================
  SLAYER TERMINAL - SIMULATION ENGINE (simulator.ts)
  Options Physics, Greeks Math, & Live Ticker Feed
==================================================
*/

import type {
  Candle,
  GexSnapshot,
  Greeks,
  Indicators,
  MarketSnapshot,
  StrikeNode,
  TapeOrder,
  TickerConfig,
  TickerSymbol,
  TradePlan,
} from '../types/market';
import { blackScholesGreeks } from './greeks';
import { dayKey } from './rng';
import type { UniverseQuote } from '../types/compass';

const Simulator = (() => {
  // Math Helpers
  // Greeks math lives in core/greeks.ts now — shared with the scoring
  // engine so replay prices with byte-identical code.
  const calculateGreeks = blackScholesGreeks;

  // Configured Tick States — core tickers with hand-set params
  const TICKERS: Record<string, TickerConfig> = {
    SPY: { basePrice: 500, currentPrice: 500, iv: 0.15, step: 1 },
    QQQ: { basePrice: 440, currentPrice: 440, iv: 0.18, step: 1 },
    AAPL: { basePrice: 190, currentPrice: 190, iv: 0.20, step: 0.5 },
    NVDA: { basePrice: 120, currentPrice: 120, iv: 0.35, step: 0.5 }
  };

  /** Core watchlist that always populates the opportunity feed. */
  const WATCHLIST = ['SPY', 'QQQ', 'AAPL', 'NVDA'];

  /* The scan roster: famous optionable names the Compass board sweeps WITHOUT
     seeding them into the tick loop (registration costs ~0.6s of forward-simmed
     candles per name — twenty at once is a frozen terminal). Base prices are
     hand-set sim reference values, same idea as TICKERS above; a name promotes
     to a full TICKERS entry the first time the user actually opens it. */
  const SCAN_ROSTER: { ticker: string; px: number; iv: number }[] = [
    { ticker: 'TSLA', px: 248, iv: 0.48 },
    { ticker: 'META', px: 512, iv: 0.3 },
    { ticker: 'MSFT', px: 428, iv: 0.22 },
    { ticker: 'AMZN', px: 186, iv: 0.28 },
    { ticker: 'GOOGL', px: 172, iv: 0.26 },
    { ticker: 'AMD', px: 162, iv: 0.42 },
    { ticker: 'NFLX', px: 640, iv: 0.32 },
    { ticker: 'AVGO', px: 168, iv: 0.34 },
    { ticker: 'COIN', px: 245, iv: 0.55 },
    { ticker: 'PLTR', px: 28, iv: 0.5 },
    { ticker: 'JPM', px: 205, iv: 0.2 },
    { ticker: 'ORCL', px: 142, iv: 0.27 },
    { ticker: 'CRM', px: 262, iv: 0.29 },
    { ticker: 'UBER', px: 72, iv: 0.36 },
    { ticker: 'MU', px: 118, iv: 0.44 },
    { ticker: 'BA', px: 178, iv: 0.33 },
    { ticker: 'DIS', px: 92, iv: 0.25 },
    { ticker: 'INTC', px: 31, iv: 0.4 },
  ];

  /** Strike grid increment by price magnitude — the sim's convention. */
  function stepFor(price: number): number {
    if (price < 50) return 0.5;
    if (price < 150) return 1;
    if (price < 400) return 2.5;
    return 5;
  }

  /** Day-stable lightweight quote for an unregistered roster name. Reads the
      engine clock through dayKey, so a pinned replay re-derives it exactly. */
  function scanQuote(base: { ticker: string; px: number; iv: number }): UniverseQuote {
    const h = symbolHash(`${base.ticker}-${dayKey()}-uq`);
    const jitter = 1 + (((h % 1000) / 1000 - 0.5) * 0.06); // ±3%, day-stable
    const price = Number((base.px * jitter).toFixed(2));
    return { ticker: base.ticker, price, iv: base.iv, step: stepFor(price) };
  }

  let activeTicker = 'SPY';
  const priceHistory: Record<string, number[]> = {};
  const historyLimit = 100;

  // OHLC candle state — one rolling multi-session series per ticker
  const candleHistory: Record<string, Candle[]> = {};
  const candleTickCount: Record<string, number> = {};
  const BAR_SECONDS = 60; // 1-minute base bars
  const TICKS_PER_BAR = 4; // each simulated bar aggregates 4 ticks
  const SESSION_BARS = 390; // ~6.5h session at 1-min bars
  const SESSIONS = 22; // ~1 month of sessions seeded up front
  const CANDLE_LIMIT = SESSIONS * SESSION_BARS + 600;

  // Net-GEX-per-strike snapshots, kept as deep as the candle buffer so the
  // chart's exposure trails cover the full visible history.
  const gexHistory: Record<string, GexSnapshot[]> = {};
  /** Sessions whose book is recorded every bar while seeding — today and the
      one before it, which is everything the live reads and replay touch. */
  const DENSE_SESSIONS = 2;
  /** One book every this many bars in the sessions before those. */
  const SPARSE_EVERY = 4;
  const RECENT_GEX_BARS = SESSIONS * SESSION_BARS;
  const GEX_LIMIT = RECENT_GEX_BARS + 600;

  function symbolHash(sym: string): number {
    let h = 2166136261;
    for (let i = 0; i < sym.length; i++) {
      h ^= sym.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /*
    Persistent OI book — the market's memory. Real open interest lives at a
    strike for days; it doesn't teleport to wherever price wanders. Each
    ticker keeps a per-strike OI ledger that drifts slowly toward the "fresh"
    ATM-centered profile (positioning migrates), breathes with order-flow
    noise, and decays once price leaves a strike far behind. Everything that
    reads a chain (matrix, trails, walls) reads THIS book, so walls persist,
    get tested, and fade for real instead of shadowing price.
  */
  interface BookEntry {
    callOI: number;
    putOI: number;
  }
  const oiBook: Record<string, Map<number, BookEntry>> = {};
  const BOOK_RANGE = 30; // strikes maintained each side of spot
  const BOOK_BLEND = 0.012; // per-bar migration toward the fresh profile (~1h half-life)

  /** Two decimals, fast — the hot loops call this a million times a seed;
      toFixed built a string for every one of them. Strikes are multiples of
      the step, so the rounding is exact. */
  const r2 = (x: number) => Math.round(x * 100) / 100;

  // The profile OI drifts toward: ATM-concentrated, round-number magnets.
  // Memoised on signed distance (1/2000 of spot) and roundness: the profile
  // depends on nothing else, and the seed asks for it 500,000 times a name.
  const freshCache = new Map<number, BookEntry>();
  function freshOI(strike: number, spot: number, step: number): BookEntry {
    const signed = (strike - spot) / spot;
    const round = Math.round(strike / (step * 5)) * step * 5 === strike;
    const key = Math.round(signed * 2000) * 2 + (round ? 1 : 0);
    const hit = freshCache.get(key);
    if (hit) return hit;
    const distance = Math.abs(signed);
    const baseOI = Math.max(100, Math.round(20000 * Math.exp(-Math.pow(distance * 15, 2))));
    let callOI = Math.round(baseOI * (strike > spot ? 1.4 : 0.8));
    let putOI = Math.round(baseOI * (strike < spot ? 1.6 : 0.7));
    if (round) {
      callOI = Math.round(callOI * 2.2);
      putOI = Math.round(putOI * 2.5);
    }
    const entry = { callOI, putOI };
    freshCache.set(key, entry);
    return entry;
  }

  /*
    THE SEED'S ALLOCATIONS (2026-09-13, the load sweep).

    evolveBook runs once per bar and walks 61 strikes inside, so the seed for
    one name goes round this loop ~520,000 times. Three things in it were
    allocating on every single pass and none of them had to:

      the breather   declared as a closure INSIDE the loop body, so half a
                     million functions were built and collected to multiply
                     two numbers. It is the same function every time — it is
                     out here now.
      the alive Set  a fresh Set every bar plus 61 adds, to answer a question
                     that is two numeric comparisons (see below).
      the magnets    gexAwareStep built a pair of {strike, s} objects, then an
                     array, then filtered and sorted it, once a bar, to pick
                     the nearer of two candidates.

    None of this changes a number the simulator produces — the same values in
    the same order, including every Math.random() call — it just stops the
    garbage collector doing laps during the one second the gate is up.
  */
  const breathe = () => 1 + (Math.random() - 0.5) * 0.05; // order-flow breathing

  function evolveBook(sym: string, spot: number, blend = BOOK_BLEND): void {
    const cfg = TICKERS[sym];
    const step = cfg.step;
    let book = oiBook[sym];
    if (!book) {
      book = oiBook[sym] = new Map();
      blend = 1; // first call seeds the book outright
    }
    const base = Math.round(spot / step) * step;
    /* The live window is a contiguous run on the step grid, so "is this strike
       still alive?" is two comparisons rather than a Set built fresh every bar
       (see THE SEED'S ALLOCATIONS below). Every key in the book was created by
       this same loop off a base that is always a multiple of step, so nothing
       inside the range can be off-grid and miss the rebuild. */
    const lo = r2(base - BOOK_RANGE * step);
    const hi = r2(base + BOOK_RANGE * step);
    for (let i = -BOOK_RANGE; i <= BOOK_RANGE; i++) {
      const strike = r2(base + i * step);
      const want = freshOI(strike, spot, step);
      const cur = book.get(strike);
      if (!cur) {
        // a strike entering the tradable window starts small — OI builds, it doesn't teleport
        const scale = blend >= 1 ? 1 : 0.2;
        book.set(strike, {
          callOI: Math.round(want.callOI * scale),
          putOI: Math.round(want.putOI * scale),
        });
      } else {
        cur.callOI = Math.max(50, Math.round((cur.callOI + (want.callOI - cur.callOI) * blend) * breathe()));
        cur.putOI = Math.max(50, Math.round((cur.putOI + (want.putOI - cur.putOI) * blend) * breathe()));
      }
    }
    // strikes price left behind: positions unwind gradually, then fall away
    for (const [k, e] of book) {
      if (k >= lo && k <= hi) continue;
      e.callOI = Math.round(e.callOI * 0.985);
      e.putOI = Math.round(e.putOI * 0.985);
      if (e.callOI < 120 && e.putOI < 120) book.delete(k);
    }
  }

  /*
    GEX-aware price step — the feedback loop. The book shapes the walk:
      · heavy shelves are BARRIERS: a move that would punch through gets most
        of its overshoot absorbed (tests and bounces), with a rare clean
        break that runs;
      · the nearest strong shelf exerts a gentle PIN when price is close
        (grind-along-the-wall days);
      · between shelves ("no man's land") volatility runs freer.
    Gamma is approximated with a single Gaussian per strike so seeding stays
    fast; the display path keeps exact Black-Scholes.
  */
  function gexAwareStep(sym: string, price: number, scale = 1): number {
    const cfg = TICKERS[sym];
    const book = oiBook[sym];
    const step = cfg.step;
    if (!book) return (Math.random() - 0.5) * cfg.basePrice * cfg.iv * 0.0035;

    const sqT = Math.sqrt(0.003); // 0DTE horizon, matching the display chain
    const denom = Math.max(1e-6, price * cfg.iv * sqT);
    // reference wall: what a fully-loaded ATM round-number shelf computes to
    const refWall = (20000 * 2.4 * 100 * price * price * 0.01 * 0.54) / (2.5066 * denom);

    const base = Math.round(price / step) * step;
    let aboveStrike = 0, aboveS = 0, hasAbove = false;
    let belowStrike = 0, belowS = 0, hasBelow = false;
    let localNet = 0;
    for (let i = -8; i <= 8; i++) {
      const strike = r2(base + i * step);
      const e = book.get(strike);
      if (!e) continue;
      const z = (strike - price) / denom;
      const gamma = Math.exp(-z * z / 2) / (2.5066 * denom);
      const v =
        e.callOI * 100 * gamma * price * price * 0.01 * -0.55 +
        e.putOI * 100 * gamma * price * price * 0.01 * 0.53;
      localNet += v;
      const s = Math.min(1, Math.abs(v) / refWall);
      if (s < 0.22) continue; // not a real shelf
      if (strike > price && (!hasAbove || strike < aboveStrike)) { aboveStrike = strike; aboveS = s; hasAbove = true; }
      if (strike < price && (!hasBelow || strike > belowStrike)) { belowStrike = strike; belowS = s; hasBelow = true; }
    }

    // base random step; quiet zones (no shelf either side) run ~35% hotter
    const inNoMansLand = !hasAbove && !hasBelow;
    const range = cfg.basePrice * cfg.iv * 0.0035 * (0.4 + Math.random()) * (inNoMansLand ? 1.35 : 1);
    let move = (Math.random() - 0.5) * 2 * range * scale;

    // pin: the nearest strong shelf pulls when price is within ~2.5 strikes.
    // The old sort put `above` first, so a tie still resolves to `above`.
    let magnetStrike = 0, magnetS = 0, hasMagnet = false;
    if (hasAbove && hasBelow) {
      const useAbove = Math.abs(aboveStrike - price) <= Math.abs(belowStrike - price);
      magnetStrike = useAbove ? aboveStrike : belowStrike;
      magnetS = useAbove ? aboveS : belowS;
      hasMagnet = true;
    } else if (hasAbove) { magnetStrike = aboveStrike; magnetS = aboveS; hasMagnet = true; }
    else if (hasBelow) { magnetStrike = belowStrike; magnetS = belowS; hasMagnet = true; }
    if (hasMagnet && Math.abs(magnetStrike - price) < step * 2.5) {
      move += (magnetStrike - price) * 0.05 * magnetS;
    }

    // barrier: absorb most of any overshoot through a strong shelf; rare clean break
    const next = price + move;
    const hasWall = move > 0 ? hasAbove : hasBelow;
    const wallStrike = move > 0 ? aboveStrike : belowStrike;
    const wallS = move > 0 ? aboveS : belowS;
    if (hasWall && ((move > 0 && next > wallStrike) || (move < 0 && next < wallStrike))) {
      const breakout = Math.random() > 0.975;
      if (!breakout) {
        const through = next - wallStrike;
        move = wallStrike - price + through * (1 - 0.85 * wallS);
      } else {
        move *= 1.6; // wall breaks: the move runs
      }
    }

    return move;
  }

  // Seed a historical price buffer + candles + GEX history for one symbol.
  function seedHistory(sym: string): void {
    seedCandles(sym);
  }

  /*
    THE SEED IS RESUMABLE (2026-09-06, the perf sweep). A name's history is
    8,580 bars of walking through its evolving book, and it used to be one
    synchronous call — 0.6s of frozen frame per name, and the scan board
    seeds a name every quarter second. Now the walk is a JOB that can be
    advanced a few milliseconds at a time from idle callbacks (seedAsync),
    and finished synchronously by whoever cannot wait (ensureTicker, the
    same result either way). A name mid-seed is not in candleHistory yet, so
    tick() skips it and peekCandles says null, exactly as before it began.
  */
  interface SeedJob {
    sym: string;
    bars: Candle[];
    snaps: GexSnapshot[];
    close: number;
    t: number;
    s: number;
    i: number;
    overnightGap: number;
    homeK: number;
  }
  const seedJobs: Record<string, SeedJob> = {};

  function beginSeed(sym: string): SeedJob {
    const cfg = TICKERS[sym];
    /* Late-seeded names join the CLOCK ALREADY RUNNING, not the wall clock:
       bar time advances ~15× wall speed (one 60s bar per 4 real ticks), so a
       name ensured mid-session and anchored to Date.now() would land its
       whole history deep in the veterans' past — its compare line ends a
       fifth of the way into the chart and never catches up (Noah,
       2026-08-23: "the iwm one looks far behind"). Anchor to the newest bar
       of any ticker already seeded; wall clock only for the very first. */
    const ref = Object.values(candleHistory).find(b => b && b.length > 0);
    const nowSec = ref ? ref[ref.length - 1].time : Math.floor(Date.now() / 1000);
    const alignedNow = nowSec - (nowSec % BAR_SECONDS);
    const overnightGap = 86400 - (SESSION_BARS - 1) * BAR_SECONDS;
    const totalSpanSec = SESSIONS * (SESSION_BARS - 1) * BAR_SECONDS + SESSIONS * overnightGap;
    /* Roster names must LAND on their scan quote: the board priced their
       cards off it, and a first click that seeds them 15% away opens the
       monitor on floor-priced garbage. A gentle homeward pull (0.15% of the
       remaining gap per bar) steers the walk to end ≈ basePrice while the
       book evolves ON the corrected path — wall physics stay coherent, and
       the watchlist keeps its unpulled drift (a feature: it reads live). */
    const homeK = SCAN_ROSTER.some(r => r.ticker === sym) ? 0.0015 : 0;
    evolveBook(sym, cfg.basePrice, 1); // seed the book at the journey's start
    return { sym, bars: [], snaps: [], close: cfg.basePrice, t: alignedNow - totalSpanSec + overnightGap, s: 0, i: 0, overnightGap, homeK };
  }

  /** Walk the job forward until the budget is spent or the history is whole. Returns true when done. */
  function stepSeed(job: SeedJob, budgetMs: number): boolean {
    const cfg = TICKERS[job.sym];
    const sym = job.sym;
    const until = Number.isFinite(budgetMs) ? performance.now() + budgetMs : Infinity;
    let checks = 0;
    while (job.s < SESSIONS) {
      while (job.i < SESSION_BARS) {
        const open = job.close;
        const move = gexAwareStep(sym, job.close);
        const pull = job.homeK > 0 ? (cfg.basePrice - job.close) * job.homeK : 0;
        const close = r2(job.close + move + pull);
        job.close = close;
        const wig = cfg.basePrice * cfg.iv * 0.0012 * Math.random();
        job.bars.push({
          time: job.t,
          open: r2(open),
          high: r2(Math.max(open, close) + wig),
          low: r2(Math.min(open, close) - wig),
          close,
          volume: Math.round(2000 + Math.random() * 18000),
        });
        evolveBook(sym, close);
        /* THE BOOK IS SAMPLED, NOT PHOTOGRAPHED EVERY MINUTE (2026-09-13, the
           launch sweep). A snapshot is 61 strikes of Black-Scholes and the
           seed took one per bar for all 22 sessions — 8,580 of them, and the
           two most expensive things in a cold boot were computing them
           (534ms) and folding them into timeframes (432ms), measured on
           /terrain. Nothing reads month-old exposure at one-minute
           resolution: the strips take the tail, the trails aggregate, and
           replay carries the last book forward (see data/replay.ts). So the
           recent sessions stay per-bar and the older ones are sampled —
           8,580 snapshots become 2,740 for the same history. The LIVE path
           below is untouched: from here on it is one a bar, always. */
        if (job.s >= SESSIONS - DENSE_SESSIONS || job.i % SPARSE_EVERY === 0) job.snaps.push(computeGexSnapshot(sym, close, job.t));
        job.t += BAR_SECONDS;
        job.i++;
        if (until !== Infinity && ++checks % 16 === 0 && performance.now() >= until) return false;
      }
      // overnight: gap the price, roll positions harder than intraday drift
      job.t += job.overnightGap - BAR_SECONDS;
      job.close = r2(job.close + (Math.random() - 0.5) * cfg.basePrice * cfg.iv * 0.02);
      evolveBook(sym, job.close, 0.18);
      job.s++;
      job.i = 0;
    }
    finishSeed(job);
    return true;
  }

  function finishSeed(job: SeedJob): void {
    const { sym, bars, snaps } = job;
    const cfg = TICKERS[sym];
    let close = job.close;
    /* Final-session taper (roster names only): the homeward pull gets the
       walk NEAR the quote; this closes the residual exactly, spread across
       the last session so no single bar jumps. The book evolved on the
       unadjusted path, so its strain is bounded by that residual (≈2%) over
       one session — versus 15% everywhere without it. First click now
       prices the SAME market the card did. */
    if (job.homeK > 0 && bars.length > 0) {
      const gap = r2(cfg.basePrice - close);
      if (Math.abs(gap) > 0.005) {
        const K = Math.min(SESSION_BARS, bars.length);
        for (let j = 0; j < K; j++) {
          const b = bars[bars.length - K + j];
          const adjC = gap * ((j + 1) / K);
          const adjO = gap * (j / K);
          b.open = r2(b.open + adjO);
          b.close = r2(b.close + adjC);
          b.high = r2(b.high + Math.max(adjO, adjC));
          b.low = r2(b.low + Math.min(adjO, adjC));
        }
        close = cfg.basePrice;
      }
    }
    cfg.currentPrice = close;
    candleHistory[sym] = bars;
    candleTickCount[sym] = 0;
    gexHistory[sym] = snaps.slice(-GEX_LIMIT);
    priceHistory[sym] = bars.map(b => b.close).slice(-historyLimit);
    delete seedJobs[sym];
  }

  // Forward-simulate a multi-session OHLC buffer from basePrice: price walks
  // THROUGH the evolving OI book (pins, tests, breaks), and every bar's GEX
  // snapshot is taken from the book as it stood at that moment. Sessions are
  // one calendar day apart so daily/weekly aggregation produces sensible bars.
  // Synchronous: resumes a job in flight and runs it to the end.
  function seedCandles(sym: string): void {
    const job = seedJobs[sym] ?? beginSeed(sym);
    seedJobs[sym] = job;
    stepSeed(job, Infinity);
  }

  /** Advance a name's seed by one slice of idle time. 'done' once its history is whole. */
  function seedAsync(symbolRaw: string, budgetMs = 6): 'done' | 'pending' {
    const sym = symbolRaw.toUpperCase();
    if (candleHistory[sym]) return 'done';
    if (!TICKERS[sym]) registerTicker(sym);
    const job = seedJobs[sym] ?? (seedJobs[sym] = beginSeed(sym));
    return stepSeed(job, budgetMs) ? 'done' : 'pending';
  }

  /*
    HOW FAR THROUGH A NAME'S WALK WE ARE, 0..1 (2026-09-13).

    The launch gate used to hold for a flat 1,350ms and fill a bar on a CSS
    animation of exactly that length — a progress bar that was not measuring
    anything, over a wait that was not waiting for anything. The seed job
    already knows precisely where it is (session s, bar i, of SESSIONS ×
    SESSION_BARS), so the gate can show the real number and leave the moment
    the walk is whole instead of on a timer.
  */
  function seedProgress(symbolRaw: string): number {
    const sym = symbolRaw.toUpperCase();
    if (candleHistory[sym]) return 1;
    const job = seedJobs[sym];
    if (!job) return 0;
    /* never quite 1 until candleHistory has it — 1 means "you can read it" */
    return Math.min(0.999, (job.s * SESSION_BARS + job.i) / (SESSIONS * SESSION_BARS));
  }

  /*
    THE SEED'S HOT PATH (2026-09-06, the perf sweep — Noah: "opening the pulse
    page… opening the weigher… stutters"). Seeding one name walks 22 sessions ×
    390 bars and takes a GEX snapshot at every bar: 8,580 chains × 61 strikes ×
    two Black-Scholes evaluations ≈ a million exp/log calls ≈ 0.6s of frozen
    frame per name — and the scan board seeds a name every 250ms. The snapshot
    needs ONE greek, gamma, and Black-Scholes gamma is homogeneous of degree
    −1 in (S, K): Γ(S, K) = Γ(1, K/S) / S. So gamma is memoised on the
    log-moneyness ln(S/K), quantised to 1/4000 (0.025%), per iv — the exact
    formula at the bucket's centre, from the same greeks module the display
    chain uses. The seed drops to a few tens of milliseconds a name.
  */
  const GAMMA_T = 0.003; // 0DTE, the same horizon generateOptionsChain prices
  const GAMMA_Q = 4000;
  /* THE THREE GREEKS, ONE MEMO (2026-09-06: the trails follow the head's
     Greek, so the history carries delta and vega beside gamma). All three
     are scale-free in (spot, strike) at a fixed horizon and vol: gamma and
     vega scale with spot, delta not at all — so one Black-Scholes evaluation
     per log-moneyness bucket serves every bar of the walk. */
  interface UnitGreeks {
    gamma: number;
    deltaCall: number;
    deltaPut: number;
    vega: number;
    /* Vanna and charm ride the same memo (2026-09-13): both are functions
       of d1/d2 alone at a fixed horizon and vol, so they are scale-free in
       (spot, strike) exactly as delta is — one evaluation per bucket. */
    vanna: number;
    charmCall: number;
    charmPut: number;
  }
  const unitGreeks: Map<number, Map<number, UnitGreeks>> = new Map();
  function unitAt(spot: number, strike: number, iv: number): UnitGreeks {
    let byZ = unitGreeks.get(iv);
    if (!byZ) {
      byZ = new Map();
      unitGreeks.set(iv, byZ);
    }
    const z = Math.round(Math.log(spot / strike) * GAMMA_Q);
    let u = byZ.get(z);
    if (u === undefined) {
      const g = calculateGreeks(1, Math.exp(-z / GAMMA_Q), GAMMA_T, iv);
      u = { gamma: g.gamma, deltaCall: g.deltaCall, deltaPut: g.deltaPut, vega: g.vega, vanna: g.vanna, charmCall: g.charmCall, charmPut: g.charmPut };
      byZ.set(z, u);
    }
    return u;
  }
  function gammaAt(spot: number, strike: number, iv: number): number {
    return unitAt(spot, strike, iv).gamma / spot;
  }

  // Net GEX, DEX, VEX, vanna and charm (all-expiry proxy) per strike at a given price, captured as one snapshot
  function computeGexSnapshot(sym: string, spot: number, time: number): GexSnapshot {
    const config = TICKERS[sym];
    const step = config.step;
    const iv = config.iv;
    if (!oiBook[sym]) evolveBook(sym, spot);
    const book = oiBook[sym];
    const baseStrike = Math.round(spot / step) * step;
    /* OI rides along with the gamma it explains (his P-8) — same instant,
       same book, so a ΔOI reading can never be timestamped away from the
       level it accounts for. The weights are generateOptionsChain's: dealers
       net short calls (−0.55) and net short puts (−0.53). */
    const scale = 100 * spot * spot * 0.01;
    const levels: GexSnapshot['levels'] = [];
    for (let i = -30; i <= 30; i++) {
      const strike = r2(baseStrike + i * step);
      const entry = book.get(strike) ?? freshOI(strike, spot, step);
      const u = unitAt(spot, strike, iv);
      const gamma = u.gamma / spot;
      const callGex = entry.callOI * gamma * scale * -0.55;
      const putGex = entry.putOI * gamma * scale * 0.53;
      const dex = entry.callOI * 100 * u.deltaCall * spot * -0.55 + entry.putOI * 100 * u.deltaPut * spot * -0.53;
      const vex = (entry.callOI * -0.55 + entry.putOI * -0.53) * 100 * u.vega * spot;
      /* the StrikeNode's own footing: vanna per one point of vol, charm per session */
      const vanna = (entry.callOI * -0.55 + entry.putOI * -0.53) * 100 * u.vanna * 0.01 * spot;
      const charm = ((entry.callOI * -0.55 * u.charmCall + entry.putOI * -0.53 * u.charmPut) * 100 * spot) / 252;
      levels.push({ strike, value: callGex + putGex, dex, vex, vanna, charm, callOI: entry.callOI, putOI: entry.putOI });
    }
    return { time, levels };
  }

  /*
    THE SECONDS TAPE (T-14, ported 2026-08-27).

    One tick is one 15-second bar. It is LIVE-ONLY by construction: the ring
    starts empty and fills as the app runs, exactly as a per-second feed is
    empty before it connects. Nothing here resamples the 1-minute history —
    a sub-minute label over resampled minutes would be a different
    instrument wearing the same name.
  */
  const secondsHistory: Record<string, Candle[]> = {};
  /** Two sessions of quarters — 4 per minute × 390 × 2. */
  const SECONDS_LIMIT = 3120;

  function pushSecondsBar(sym: string, time: number, open: number, close: number, volume: number): void {
    const ring = (secondsHistory[sym] ??= []);
    ring.push({ time, open, high: Math.max(open, close), low: Math.min(open, close), close, volume });
    if (ring.length > SECONDS_LIMIT) ring.shift();
  }

  // Fold the latest tick into the current bar; roll a new bar every TICKS_PER_BAR ticks
  function updateCandles(sym: string): void {
    const bars = candleHistory[sym];
    if (!bars || bars.length === 0) return;
    const price = TICKERS[sym].currentPrice;
    const count = (candleTickCount[sym] = (candleTickCount[sym] ?? 0) + 1);
    const last = bars[bars.length - 1];
    const gh = gexHistory[sym];

    if (count % TICKS_PER_BAR === 0) {
      const time = last.time + BAR_SECONDS;
      const rollVolume = Math.round(1500 + Math.random() * 9000);
      bars.push({
        time,
        open: last.close,
        high: Math.max(last.close, price),
        low: Math.min(last.close, price),
        close: price,
        volume: rollVolume,
      });
      if (bars.length > CANDLE_LIMIT) bars.shift();
      pushSecondsBar(sym, time, last.close, price, rollVolume);

      evolveBook(sym, price); // the book keeps living as new bars roll

      if (gh) {
        gh.push(computeGexSnapshot(sym, price, time));
        if (gh.length > GEX_LIMIT) gh.shift();
      }
    } else {
      const prevClose = last.close;
      const foldVolume = Math.round(500 + Math.random() * 4000);
      last.close = price;
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      last.volume += foldVolume;
      /* The fold's quarter: offsets 15/30/45 into the forming minute. */
      pushSecondsBar(sym, last.time + (count % TICKS_PER_BAR) * 15, prevClose, price, foldVolume);

      // Keep the forming bar's node snapshot live — only for the visible (active) ticker
      if (gh && gh.length && sym === activeTicker) {
        gh[gh.length - 1] = computeGexSnapshot(sym, price, gh[gh.length - 1].time);
      }
    }
  }

  /** The config for a symbol never seen: its roster quote, or a hash price. */
  function registerTicker(sym: string): void {
    /* A roster name seeds FROM its roster quote — the scan board priced its
       cards off that quote, and a click that re-rolled the name to a hash
       price would grade a different market than the card the user clicked
       (the exact board-vs-panel schism documented in the partner's build). */
    const roster = SCAN_ROSTER.find(r => r.ticker === sym);
    if (roster) {
      const q = scanQuote(roster);
      TICKERS[sym] = { basePrice: q.price, currentPrice: q.price, iv: q.iv, step: q.step };
    } else {
      const h = symbolHash(sym);
      const basePrice = Number((15 + (h % 58500) / 100).toFixed(2)); // ~15..600
      const iv = 0.15 + ((h >>> 5) % 45) / 100; // ~0.15..0.60
      const step = basePrice >= 100 ? 1 : 0.5;
      TICKERS[sym] = { basePrice, currentPrice: basePrice, iv, step };
    }
  }

  /** Register a config for any symbol on demand (synthesized for non-core tickers). */
  function ensureTicker(symbolRaw: string): string {
    const sym = symbolRaw.toUpperCase();
    if (!TICKERS[sym]) registerTicker(sym);
    if (!candleHistory[sym]) seedHistory(sym);
    return sym;
  }

  /* THE FIRST PAINT SEEDS ONE NAME (2026-09-06, the perf sweep): the module
     used to forward-sim the whole watchlist before anything could render —
     four histories, the better part of a second, inside the app's first
     task. Now the active name seeds here and the rest follow in idle time,
     a slice at a time; anyone who reaches for one earlier finishes it
     synchronously through ensureTicker, the same history either way. */
  {
    /* ROUND TWO (the same day): the active name's own walk was still a 195ms
       task inside the app's first script — a hitch in the launch's own
       animation. It walks in slices too, eight milliseconds every sixteen
       (the overlay keeps its frames), the rest of the watchlist after it at
       five every 24. The tick emits nothing until the active name is whole
       (the feed context polls for that moment), and anyone who cannot wait
       finishes it synchronously through ensureTicker, the same history.
       A short timer, not an idle callback: a desk of charts keeps a frame
       loop running, so the browser never sees a quiet moment and idle
       callbacks only fire on their timeout — three names took minutes. */
    const order = [activeTicker, ...WATCHLIST.filter(t => t !== activeTicker)];
    const pump = () => {
      const next = order.find(t => !candleHistory[t]);
      if (!next) return;
      const urgent = next === activeTicker;
      seedAsync(next, urgent ? 8 : 5);
      setTimeout(pump, urgent ? 16 : 24);
    };
    if (typeof window !== 'undefined') setTimeout(pump, 0);
    else order.forEach(seedHistory);
  }

  // Calculate Indicators
  function getIndicators(prices: number[]): Indicators {
    const len = prices.length;
    if (len < 50) return { rsi: 50, ema9: prices[len - 1], ema21: prices[len - 1], ema50: prices[len - 1], squeeze: false };

    // EMA
    const calcEMA = (period: number, prevEMA: number, curPrice: number): number => {
      const k = 2 / (period + 1);
      return curPrice * k + prevEMA * (1 - k);
    };

    let ema9 = prices[0];
    let ema21 = prices[0];
    let ema50 = prices[0];

    for (let i = 1; i < len; i++) {
      ema9 = calcEMA(9, ema9, prices[i]);
      ema21 = calcEMA(21, ema21, prices[i]);
      ema50 = calcEMA(50, ema50, prices[i]);
    }

    // RSI (14)
    let gains = 0;
    let losses = 0;
    for (let i = len - 14; i < len; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    let rsi = 50;
    if (losses === 0) rsi = 100;
    else if (gains !== 0) {
      const rs = (gains / 14) / (losses / 14);
      rsi = 100 - (100 / (1 + rs));
    }

    // TTM Squeeze Approximation: Bollinger Bands inside Keltner Channel
    const slice = prices.slice(-20);
    const sma20 = slice.reduce((a, b) => a + b, 0) / 20;
    const variance = slice.reduce((a, b) => a + Math.pow(b - sma20, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    const atrProxy = stdDev * 0.9; // Simplified range proxy

    const bbUpper = sma20 + 2 * stdDev;
    const bbLower = sma20 - 2 * stdDev;
    const kUpper = sma20 + 1.5 * atrProxy;
    const kLower = sma20 - 1.5 * atrProxy;

    const squeeze = (bbUpper < kUpper) && (bbLower > kLower);

    return { rsi, ema9, ema21, ema50, squeeze };
  }

  // Generate Strike-by-Strike Chain
  function generateOptionsChain(tickerKey: TickerSymbol, spotOverride?: number): StrikeNode[] {
    const config = TICKERS[tickerKey];
    const spot = spotOverride ?? config.currentPrice;
    const step = config.step;
    const iv = config.iv;

    const strikes: StrikeNode[] = [];
    const baseStrike = Math.round(spot / step) * step;
    // 30 each side — the whole maintained book (BOOK_RANGE), so a ±30 window
    // on the ladder shows real rows, not a repeat of ±15 (Noah, 2026-08-22:
    // far strikes are where the tail hedges sit). The real feed carries the
    // full chain; this only costs the sim's seeding ~2× per name.
    const strikeRange = 30;
    if (!oiBook[tickerKey]) evolveBook(tickerKey, spot); // lazy seed for stray callers
    const book = oiBook[tickerKey];

    for (let i = -strikeRange; i <= strikeRange; i++) {
      const strike = Number((baseStrike + i * step).toFixed(2));

      // OI comes from the persistent book — walls have memory. Fallback for
      // strikes outside the maintained window (spot far from book center).
      const entry = book.get(strike) ?? freshOI(strike, spot, step);
      const callOI = entry.callOI;
      const putOI = entry.putOI;

      const t = 0.003; // 0DTE
      const greeks = calculateGreeks(spot, strike, t, iv);

      // Weights chosen so net GEX comes out two-sided with comparable
      // magnitudes: call-dominated shelves above spot ≈ −0.4·base, put
      // shelves below ≈ +0.4·base. The old −0.4/−0.6 split let the put side
      // outweigh calls ~4.5× everywhere, so negative walls never registered
      // anywhere in the terminal (heatmap, trails, positioning).
      const dealerCallDirection = -0.55; // Net short calls
      const dealerPutDirection = -0.53;  // Net short puts

      const callGex = callOI * 100 * greeks.gamma * spot * spot * 0.01 * dealerCallDirection;
      const putGex = putOI * 100 * greeks.gamma * spot * spot * 0.01 * dealerPutDirection * -1;

      const netGex = callGex + putGex;

      const callDex = callOI * 100 * greeks.deltaCall * spot * dealerCallDirection;
      const putDex = putOI * 100 * greeks.deltaPut * spot * dealerPutDirection;
      const netDex = callDex + putDex;

      const callVex = callOI * 100 * greeks.vega * dealerCallDirection;
      const putVex = putOI * 100 * greeks.vega * dealerPutDirection;
      const netVex = callVex + putVex;

      /* VANNA and CHARM as exposures, on delta's own footing (2026-09-09):
         vanna is ∂Δ/∂σ with σ a fraction, so ×0.01 states it per ONE POINT
         of vol; charm is the delta the clock takes per YEAR, so ÷252 states
         it per session. Both × OI × 100 × spot × the dealer's direction, the
         way DEX is. */
      const callVanna = callOI * 100 * greeks.vanna * 0.01 * spot * dealerCallDirection;
      const putVanna = putOI * 100 * greeks.vanna * 0.01 * spot * dealerPutDirection;
      const netVanna = callVanna + putVanna;
      const callCharm = (callOI * 100 * greeks.charmCall * spot * dealerCallDirection) / 252;
      const putCharm = (putOI * 100 * greeks.charmPut * spot * dealerPutDirection) / 252;
      const netCharm = callCharm + putCharm;

      strikes.push({
        strike,
        callOI,
        putOI,
        gamma: greeks.gamma,
        callGex,
        putGex,
        netGex,
        callDex,
        putDex,
        netDex,
        callVex,
        putVex,
        netVex,
        vanna: greeks.vanna,
        charm: (greeks.charmCall + greeks.charmPut) / 2,
        callVanna,
        putVanna,
        netVanna,
        callCharm,
        putCharm,
        netCharm,
      });
    }

    return strikes;
  }

  // Generate Compass plan
  function generateTradePlan(tickerKey: TickerSymbol, spot: number, chain: StrikeNode[], indicators: Indicators): TradePlan {
    const config = TICKERS[tickerKey];

    let supportWall = spot - config.step * 4;
    let resistanceWall = spot + config.step * 4;
    let maxPutGex = 0;
    let maxCallGex = 0;

    chain.forEach(node => {
      if (node.strike < spot && Math.abs(node.netGex) > maxPutGex) {
        maxPutGex = Math.abs(node.netGex);
        supportWall = node.strike;
      }
      if (node.strike > spot && Math.abs(node.netGex) > maxCallGex) {
        maxCallGex = Math.abs(node.netGex);
        resistanceWall = node.strike;
      }
    });

    // The crossing NEAREST SPOT, not the first one walking up the chain: a
    // noisy book can carry a jitter crossing deep in a tail, and breaking on
    // the first hit labeled THAT as the regime border while the structural
    // flip sat at spot. Matches data/gex.ts buildLevelsFor (Noah, 2026-08-18).
    let flipStrike = spot;
    let flipDist = Infinity;
    for (let i = 1; i < chain.length; i++) {
      if (Math.sign(chain[i - 1].netGex) !== Math.sign(chain[i].netGex)) {
        const mid = (chain[i - 1].strike + chain[i].strike) / 2;
        const d = Math.abs(mid - spot);
        if (d < flipDist) {
          flipDist = d;
          flipStrike = mid;
        }
      }
    }

    let score = 50;
    const isEmaAligned = (indicators.ema9 > indicators.ema21) && (indicators.ema21 > indicators.ema50);
    const isEmaBearish = (indicators.ema9 < indicators.ema21) && (indicators.ema21 < indicators.ema50);

    if (isEmaAligned) score += 20;
    if (isEmaBearish) score -= 20;

    if (indicators.rsi > 60) score += 15;
    if (indicators.rsi < 40) score -= 15;

    const inPositiveGex = spot > flipStrike;
    if (inPositiveGex) score += 15;
    else score -= 15;

    if (indicators.squeeze) score += 10;

    score = Math.max(10, Math.min(90, score));

    const direction = score >= 50 ? 'BULLISH' : 'BEARISH';
    const confidence = Math.abs(score - 50) * 2 + 50;

    const entry = spot;
    let stopLoss = direction === 'BULLISH' ? supportWall - config.step * 0.5 : resistanceWall + config.step * 0.5;
    const target1 = direction === 'BULLISH' ? resistanceWall : supportWall;
    const target2 = direction === 'BULLISH' ? resistanceWall + config.step * 3 : supportWall - config.step * 3;

    const minDistance = spot * 0.005;
    if (Math.abs(entry - stopLoss) < minDistance) {
      stopLoss = direction === 'BULLISH' ? entry - minDistance : entry + minDistance;
    }

    return {
      ticker: tickerKey,
      direction,
      score,
      confidence: Math.round(confidence),
      entry: Number(entry.toFixed(2)),
      stopLoss: Number(stopLoss.toFixed(2)),
      target1: Number(target1.toFixed(2)),
      target2: Number(target2.toFixed(2)),
      flipZone: Number(flipStrike.toFixed(2)),
      supportWall: Number(supportWall.toFixed(2)),
      resistanceWall: Number(resistanceWall.toFixed(2))
    };
  }

  // Simulate one tick
  function tick(callback?: (data: MarketSnapshot) => void): void {
    Object.keys(TICKERS).forEach(ticker => {
      const config = TICKERS[ticker];
      const history = priceHistory[ticker];
      if (!history || !candleHistory[ticker]) return; // registered, still seeding in idle time

      // Live ticks walk through the SAME wall physics as seeded history
      // (scale 0.5: four ticks compose one bar-sized move in quadrature).
      const shock = Math.random() > 0.98 ? 2.2 : 1;
      let deltaPrice = gexAwareStep(ticker, config.currentPrice, 0.5) * shock;
      deltaPrice = Math.max(-config.step * 2, Math.min(config.step * 2, deltaPrice));

      config.currentPrice = Number((config.currentPrice + deltaPrice).toFixed(2));

      history.push(config.currentPrice);
      if (history.length > historyLimit) {
        history.shift();
      }

      updateCandles(ticker);
    });

    /* No feed until the active name's history is whole (it seeds in slices
       at boot — see the pump at the end of the module) */
    if (!candleHistory[activeTicker] || !priceHistory[activeTicker]) return;
    const activeConfig = TICKERS[activeTicker];
    const chain = generateOptionsChain(activeTicker);
    const indicators = getIndicators(priceHistory[activeTicker]);
    const plan = generateTradePlan(activeTicker, activeConfig.currentPrice, chain, indicators);

    // Multi-ticker tape — the whole watchlist prints; the active symbol prints a touch more
    const tape: TapeOrder[] = [];
    const tapeTickers = Array.from(new Set([activeTicker, ...WATCHLIST]));
    for (const sym of tapeTickers) {
      const cfg = TICKERS[sym];
      const count =
        sym === activeTicker
          ? Math.floor(Math.random() * 2) + 1
          : Math.random() > 0.45
            ? Math.floor(Math.random() * 2) + 1
            : 0;
      for (let i = 0; i < count; i++) {
        const offset = (Math.floor(Math.random() * 7) - 3) * cfg.step;
        const strike = Math.round(cfg.currentPrice / cfg.step) * cfg.step + offset;
        tape.push({
          time: new Date().toLocaleTimeString(),
          ticker: sym,
          strike: strike.toFixed(2),
          type: Math.random() > 0.5 ? 'C' : 'P',
          size: Math.floor(Math.random() * 250) + 10,
          orderType: Math.random() > 0.65 ? 'SWEEP' : 'BLOCK',
          side: Math.random() > 0.48 ? 'ASK' : 'BID'
        });
      }
    }

    if (callback) {
      callback({
        ticker: activeTicker,
        spot: activeConfig.currentPrice,
        changePercent: ((activeConfig.currentPrice - activeConfig.basePrice) / activeConfig.basePrice) * 100,
        priceHistory: priceHistory[activeTicker],
        chain,
        indicators,
        plan,
        tape
      });
    }
  }

  /**
   * A snapshot for ANY ticker, read from current state without advancing the
   * simulation. `tick` only ever emits the active symbol, so surfaces that show
   * several names at once (a workspace of panels, a multi-chart board) need
   * this to derive per-ticker views. Pure read — safe to call during render.
   */
  function snapshotFor(symbolRaw: string): MarketSnapshot {
    const sym = ensureTicker(symbolRaw);
    const cfg = TICKERS[sym];
    const chain = generateOptionsChain(sym);
    const indicators = getIndicators(priceHistory[sym]);
    return {
      ticker: sym,
      spot: cfg.currentPrice,
      changePercent: ((cfg.currentPrice - cfg.basePrice) / cfg.basePrice) * 100,
      priceHistory: priceHistory[sym],
      chain,
      indicators,
      plan: generateTradePlan(sym, cfg.currentPrice, chain, indicators),
      // The tape is a session-wide stream, not a per-ticker derivation; callers
      // that need prints read them from the live snapshot instead.
      tape: [],
    };
  }

  return {
    TICKERS,
    WATCHLIST,
    snapshotFor,
    ensureTicker,
    /** The config alone — a roster quote or a hash price — without walking the history */
    register: (sym: string): void => {
      const s = sym.toUpperCase();
      if (!TICKERS[s]) registerTicker(s);
    },
    seedAsync,
    seedProgress,
    /** True once a name's history exists — no seeding side effect */
    isSeeded: (sym: string): boolean => !!candleHistory[sym.toUpperCase()],
    setActiveTicker: (t: string): string => {
      activeTicker = ensureTicker(t);
      return activeTicker;
    },
    getActiveTicker: (): string => activeTicker,
    /** Live intraday OHLC bars (mutated in place each tick — treat as read-only). */
    /** T-14's live-only 15-second bars — empty until the app has ticked,
        exactly as a per-second feed is empty before it connects. */
    getSecondsBars: (sym: string): Candle[] => {
      ensureTicker(sym);
      return (secondsHistory[sym] ??= []);
    },
    getCandles: (sym: string): Candle[] => {
      const key = ensureTicker(sym);
      return candleHistory[key];
    },
    /** Bars WITHOUT the seeding side effect — null for names never simmed.
        For render-time reads over many symbols (the board's session sparks):
        getCandles would synchronously forward-sim every unseeded name. */
    peekCandles: (sym: string): Candle[] | null => candleHistory[sym.toUpperCase()] ?? null,
    /** Net-GEX-per-strike snapshots parallel to the candle series (read-only). */
    getGexHistory: (sym: string): GexSnapshot[] => {
      const key = ensureTicker(sym);
      return gexHistory[key];
    },
    tick,
    getGreeks: calculateGreeks,
    /** The live harness's answer to "what is the market right now" for the
        scan universe. Engine modules (Compass) take this as an ARGUMENT
        instead of reading the simulator themselves — a replay harness passes
        historical quotes through the same parameter.

        The roster reaches past the seeded watchlist WITHOUT registering
        names: ensureTicker forward-seeds a full candle history (~0.6s per
        name — 20 of them would freeze the terminal for the exact reason the
        partner's build grew a separate scan engine). Unseeded names get a
        lightweight day-stable quote instead; the first CLICK on one of their
        cards is what seeds them, one name at a time, the Dark Pool Leaders
        precedent. */
    universeQuotes: (active: string): UniverseQuote[] => {
      const names = Array.from(new Set([active, ...WATCHLIST, ...SCAN_ROSTER.map(r => r.ticker)]));
      return names.map(t => {
        if (TICKERS[t]) {
          const cfg = TICKERS[t];
          return { ticker: t, price: cfg.currentPrice, iv: cfg.iv, step: cfg.step };
        }
        const base = SCAN_ROSTER.find(r => r.ticker === t);
        if (base) return scanQuote(base);
        // Unknown free-entry name — seed it for real (single name, user-chosen).
        const key = ensureTicker(t);
        const cfg = TICKERS[key];
        return { ticker: key, price: cfg.currentPrice, iv: cfg.iv, step: cfg.step };
      });
    },
  };
})();

/* A handle for the perf meters (scripts/*-proof.mjs) — dev builds only */
if (typeof window !== 'undefined' && import.meta.env?.DEV) (window as unknown as { __sim: typeof Simulator }).__sim = Simulator;

export default Simulator;
