/*
==================================================
  SLAYER TERMINAL - REVIEW · A CONTRACT'S QUOTE
  (data/review/quotes.ts)

  The other half of the seam (see tape.ts): what a
  contract was bid and asked at a minute of a past
  day, which expiries and strikes were listed that
  day, and the greeks worked out from the price.

  TODAY it is a stand-in: Black-Scholes on the seeded
  tape, off the day's base vol with a smile and a put
  skew, inside a spread that widens away from the
  money. WITH THE REAL TAPE the bid and the ask are
  READ (the vendor's one-minute quote), and the vol
  and the greeks are still worked out here, by the
  same math the live terminal uses (core/greeks) — so
  DECAY IS NEVER A CHARGE: it is whatever the next
  quote is lower by (docs/review-backtest-rules.md).

  A VERTICAL SPREAD IS A CONTRACT WITH A SECOND STRIKE
  (2026-09-20): `short` is the strike SOLD against
  `strike`, same right, same expiry. It is quoted at
  its natural prices — to buy it, the bought leg's ask
  less the sold leg's bid; to sell it, the bought leg's
  bid less the sold leg's ask — and never outside
  nothing and its width. Everything above the seam
  (orders, the bell, targets and stops, the chart's
  lines) treats it as one thing with one price, which
  it is to the trader who bought it.
==================================================
*/

import { isTradingDay, isoDate, sessionsBetween } from '../../core/calendar';
import { blackScholesGreeks, blackScholesPrice } from '../../core/greeks';
import { DAY_MIN, LAST_MIN, baseIvAt, dateOf, dayWords, prevDay, reviewName, spotAt } from './tape';

export type Right = 'C' | 'P';
export interface ContractId {
  ticker: string;
  strike: number;
  right: Right;
  /** YYYY-MM-DD */
  expiry: string;
  /** A VERTICAL SPREAD: the strike SOLD against `strike` — same right, same expiry (see the head note) */
  short?: number;
}
/** What a spread is worth at the most: the distance between its strikes */
export const spreadWidth = (c: ContractId): number => (c.short != null ? Math.abs(c.short - c.strike) : 0);
/** The bought leg on its own — what the chain's row and its drop-down are */
export const longLeg = (c: ContractId): ContractId => ({ ticker: c.ticker, strike: c.strike, right: c.right, expiry: c.expiry });
/** Legs a contract's fee is charged on */
export const legsOf = (c: ContractId): number => (c.short != null ? 2 : 1);
export interface Quote {
  bid: number;
  ask: number;
  mark: number;
  iv: number;
  delta: number;
  gamma: number;
  /** Dollars a share the contract loses over one session, all else equal (negative) */
  theta: number;
  vega: number;
  rho: number;
  intrinsic: number;
  /** Not a market: a zero bid, or a spread wider than 60% of the mark — orders wait (the rules page) */
  dead: boolean;
  /** Where the name stood */
  spot: number;
}

const fmtK = (k: number) => (k % 1 === 0 ? k.toFixed(0) : k.toFixed(2).replace(/0$/, ''));
export const contractKey = (c: ContractId) => `${c.ticker}|${c.expiry}|${c.strike}|${c.right}${c.short != null ? `|${c.short}` : ''}`;
/** "NVDA 121C" — the pill's words; a spread is "NVDA 121/125C", bought strike first */
export const contractWords = (c: ContractId) => `${c.ticker} ${fmtK(c.strike)}${c.short != null ? `/${fmtK(c.short)}` : ''}${c.right}`;
export const strikeWords = fmtK;

/* ---- time left, in years of trading time ---- */
const sessionsMemo = new Map<string, number>();
/** Whole sessions AFTER `iso`, up to and including the expiry */
export function sessionsLeft(iso: string, expiry: string): number {
  if (expiry <= iso) return 0;
  const key = `${iso}|${expiry}`;
  let n = sessionsMemo.get(key);
  if (n === undefined) {
    n = sessionsBetween(dateOf(iso), dateOf(expiry));
    if (sessionsMemo.size > 4000) sessionsMemo.clear();
    sessionsMemo.set(key, n);
  }
  return n;
}
/** A cursor on minute m stands at the END of bar m. At the bell of the expiry day nothing is left. */
export function yearsLeft(iso: string, minute: number, expiry: string): number {
  if (expiry < iso) return 0;
  const today = (LAST_MIN - Math.min(LAST_MIN, Math.max(0, minute))) / DAY_MIN;
  return (sessionsLeft(iso, expiry) + today) / 252;
}
/** Calendar days to the expiry — the "DTE" a trader says */
export const dteAt = (iso: string, expiry: string): number => Math.max(0, Math.round((dateOf(expiry).getTime() - dateOf(iso).getTime()) / 86400000));

/* ---- the vol a contract trades on: the day's base, a smile, and the skew puts pay ---- */
function contractIv(base: number, spot: number, strike: number, t: number): number {
  const width = base * Math.sqrt(Math.max(t, 1 / 252 / 8));
  const x = Math.max(-3, Math.min(3, Math.log(strike / spot) / width));
  return base * (1 + 0.045 * x * x + (x < 0 ? 0.06 * -x : 0));
}

const cents = (v: number) => Math.round(v * 100) / 100;
/** The quote at a minute, as the tape had the name */
export const quoteAt = (c: ContractId, iso: string, minute: number): Quote => quoteWith(c, iso, minute, spotAt(c.ticker, iso, minute));

/** The same quote with the name SOMEWHERE ELSE at that minute — "where would the stock have to be, right now, for this
    contract to be worth X": what the chart's target and stop lines are drawn from. Time and the day's vol stay as they are. */
export function quoteWith(c: ContractId, iso: string, minute: number, spot: number): Quote {
  return priceWith(c, spot, yearsLeft(iso, minute, c.expiry), baseIvAt(c.ticker, iso));
}

/** THE PRICER ITSELF (2026-09-22): a contract with the name at `spot`, `t` years of trading time left and the name's base
    vol `base`. The backtest reads it through quoteWith (the seeded tape's minute and day); the paper desk through its live
    feed (data/paper/feed.ts: the real clock, the simulator's vol) — one price, whichever clock is asking. */
export function priceWith(c: ContractId, spot: number, t: number, base: number): Quote {
  if (c.short != null) return spreadQuote(c, spot, t, base);
  const intrinsic = Math.max(0, c.right === 'C' ? spot - c.strike : c.strike - spot);
  if (t <= 0) {
    const v = cents(intrinsic);
    return { bid: v, ask: v, mark: v, iv: 0, delta: intrinsic > 0 ? (c.right === 'C' ? 1 : -1) : 0, gamma: 0, theta: 0, vega: 0, rho: 0, intrinsic: v, dead: false, spot };
  }
  const iv = contractIv(base, spot, c.strike, t);
  const mark = Math.max(intrinsic, blackScholesPrice(spot, c.strike, t, iv, c.right));
  const g = blackScholesGreeks(spot, c.strike, t, iv);
  const dayOn = Math.max(0, t - 1 / 252);
  const theta = (dayOn > 0 ? Math.max(intrinsic, blackScholesPrice(spot, c.strike, dayOn, iv, c.right)) : intrinsic) - mark;
  /* the spread: a cent at the least, wider for a cheap far contract than for one at the money */
  const far = Math.min(1, Math.abs(Math.log(c.strike / spot)) / Math.max(0.02, iv * Math.sqrt(t) * 2));
  const half = Math.max(0.01, mark * (0.008 + 0.05 * far));
  const bid = cents(Math.max(0, mark - half));
  const ask = cents(Math.max(bid + 0.01, mark + half));
  const mid = cents((bid + ask) / 2);
  return {
    bid,
    ask,
    mark: mid,
    iv,
    delta: c.right === 'C' ? g.deltaCall : g.deltaPut,
    gamma: g.gamma,
    theta,
    vega: g.vega,
    rho: c.right === 'C' ? g.rhoCall : g.rhoPut,
    intrinsic: cents(intrinsic),
    dead: bid <= 0 || (ask - bid) / Math.max(0.01, mid) > 0.6,
    spot,
  };
}

/** A vertical spread at its natural prices (see the head note), kept inside nothing and its width */
function spreadQuote(c: ContractId, spot: number, t: number, base: number): Quote {
  const bought = priceWith(longLeg(c), spot, t, base);
  const sold = priceWith({ ...longLeg(c), strike: c.short! }, spot, t, base);
  const width = spreadWidth(c);
  const inside = (v: number) => Math.max(0, Math.min(width, v));
  const intrinsic = cents(inside(bought.intrinsic - sold.intrinsic));
  if (t <= 0) return { ...bought, bid: intrinsic, ask: intrinsic, mark: intrinsic, intrinsic, delta: 0, dead: false };
  const bid = cents(inside(bought.bid - sold.ask));
  const ask = cents(Math.max(bid + 0.01, inside(bought.ask - sold.bid)));
  const mark = cents((bid + ask) / 2);
  return {
    bid,
    ask,
    mark,
    iv: bought.iv,
    delta: bought.delta - sold.delta,
    gamma: bought.gamma - sold.gamma,
    theta: bought.theta - sold.theta,
    vega: bought.vega - sold.vega,
    rho: bought.rho - sold.rho,
    intrinsic,
    dead: bought.dead || bid <= 0 || (ask - bid) / Math.max(0.01, mark) > 0.6,
    spot,
  };
}

/* ---- what was listed on a day ---- */
export interface ListedExpiry {
  iso: string;
  /** "Mar 14" */
  label: string;
  dte: number;
  kind: 'daily' | 'weekly' | 'monthly';
}
/* the funds list a contract every session — and so do the paper account's indexes (SPX, NDX, RUT: data/paper/products.ts),
   which the backtest does not trade */
const DAILY = new Set(['SPY', 'QQQ', 'IWM', 'SPX', 'NDX', 'RUT']);
/** Back to a session when the date is a holiday (a Friday off makes it a Thursday expiry) */
const backToSession = (d: Date): Date => {
  const out = new Date(d);
  for (let i = 0; i < 7 && !isTradingDay(out); i++) out.setDate(out.getDate() - 1);
  return out;
};
const listedMemo = new Map<string, ListedExpiry[]>();
/** The expiries a name listed on a day: the funds' dailies, six weeklies, three monthlies — nearest first */
export function expiriesAt(ticker: string, iso: string): ListedExpiry[] {
  const key = `${ticker}|${iso}`;
  const hit = listedMemo.get(key);
  if (hit) return hit;
  const from = dateOf(iso);
  const seen = new Map<string, ListedExpiry['kind']>();
  if (DAILY.has(ticker.toUpperCase())) {
    const d = new Date(from);
    for (let n = 0; n < 5; d.setDate(d.getDate() + 1)) {
      if (!isTradingDay(d)) continue;
      seen.set(isoDate(d), 'daily');
      n++;
    }
  }
  const fri = new Date(from);
  fri.setDate(fri.getDate() + ((5 - fri.getDay() + 7) % 7));
  for (let w = 0; w < 6; w++) {
    const e = isoDate(backToSession(fri));
    if (e >= iso && !seen.has(e)) seen.set(e, 'weekly');
    fri.setDate(fri.getDate() + 7);
  }
  for (let m = 0, got = 0; got < 3 && m < 6; m++) {
    const first = new Date(from.getFullYear(), from.getMonth() + m, 1, 12);
    const third = new Date(first);
    third.setDate(1 + ((5 - first.getDay() + 7) % 7) + 14);
    const e = isoDate(backToSession(third));
    if (e < iso) continue;
    seen.set(e, 'monthly');
    got++;
  }
  const out = [...seen.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([e, kind]) => ({ iso: e, label: dayWords(e), dte: dteAt(iso, e), kind }));
  if (listedMemo.size > 600) listedMemo.clear();
  listedMemo.set(key, out);
  return out;
}

export interface ChainRow {
  strike: number;
  call: Quote;
  put: Quote;
}
/** The strikes round the money, `each` a side, highest first — the way a chain is read. `centre` holds the ladder on a
    price that stays put (the day's open) so the rows do not slide under the reader every time the name crosses a strike. */
export function chainAt(ticker: string, iso: string, minute: number, expiry: string, each = 10, centre?: number): { spot: number; rows: ChainRow[] } {
  const step = reviewName(ticker).step;
  const spot = spotAt(ticker, iso, minute);
  const mid = Math.round((centre ?? spot) / step) * step;
  const rows: ChainRow[] = [];
  for (let i = each; i >= -each; i--) {
    const strike = Math.round((mid + i * step) * 100) / 100;
    if (strike <= 0) continue;
    rows.push({ strike, call: quoteAt({ ticker, strike, right: 'C', expiry }, iso, minute), put: quoteAt({ ticker, strike, right: 'P', expiry }, iso, minute) });
  }
  return { spot, rows };
}

/** Where the name would have to stand, at this minute, for the contract's BID to be `bid` — THE NEAREST SUCH PLACE TO WHERE
    IT STANDS NOW. Walked outward from the name's price (up for a bid a call does not have yet, down for one it has
    passed; a put the other way) to the first crossing, then closed in on by bisection. Walked, not bisected end to end,
    because a SPREAD's bid is not one-way: it rises with the name and then falls away deep in the money, where the legs'
    own spreads swallow it — end to end, the far end read "nothing" and a level in plain sight was called out of reach.
    Null when no price in reach gets there (a target past what the time left, or a spread's width, allows). */
export const spotForBid = (c: ContractId, iso: string, minute: number, bid: number): number | null => spotForQuote(c, iso, minute, bid, 'bid');
/** …and for its ASK to be `ask` — where a resting buy limit is drawn on the chart: it fills when the ask comes down to it */
export const spotForAsk = (c: ContractId, iso: string, minute: number, ask: number): number | null => spotForQuote(c, iso, minute, ask, 'ask');
function spotForQuote(c: ContractId, iso: string, minute: number, bid: number, which: 'bid' | 'ask'): number | null {
  const here = spotAt(c.ticker, iso, minute);
  const at = (s: number) => quoteWith(c, iso, minute, s)[which];
  const now = at(here);
  if (Math.abs(now - bid) < 0.005) return Math.round(here * 100) / 100;
  /* more than it bids now lies on the contract's good side of the name: a call's above, a put's below */
  const up = (bid > now) === (c.right === 'C');
  const end = up ? here * 1.8 : here * 0.4;
  const STEPS = 90;
  let a = here;
  let fa = now - bid;
  for (let i = 1; i <= STEPS; i++) {
    /* finer near the name, where a way out almost always is */
    const b = here + (end - here) * Math.pow(i / STEPS, 2);
    const fb = at(b) - bid;
    if (fa === 0 || fa * fb <= 0) {
      let lo = a;
      let hi = b;
      let flo = fa;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        const fm = at(mid) - bid;
        if (flo * fm <= 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      return Math.round(((lo + hi) / 2) * 100) / 100;
    }
    a = b;
    fa = fb;
  }
  return null;
}

/* ---- a contract's day so far: what a chain's row opens onto ---- */
export interface ContractDay {
  high: number;
  low: number;
  prevClose: number;
  last: number;
  volume: number;
  oi: number;
  /** The name's price at which the contract pays for itself at the bell */
  breakeven: number;
  /** How far the name has to move to get there, signed percent */
  toBreakevenPct: number;
}
const u01 = (key: string): number => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};
const ranges = new Map<string, { upTo: number; high: number; low: number }>();
/** THE STAND-IN'S SHARE OF THE SEAM: the high and low are read off the day's quotes so far (true of the real tape too);
    the volume, the open interest and the last trade are seeded figures of the right size and shape — with the real tape
    they are the vendor's trades and its daily open-interest file. */
export function contractDay(c: ContractId, iso: string, minute: number): ContractDay {
  const key = `${contractKey(c)}|${iso}`;
  let r = ranges.get(key);
  if (!r || r.upTo > minute) r = { upTo: -1, high: -Infinity, low: Infinity };
  for (let m = r.upTo + 1; m <= minute; m++) {
    const v = quoteAt(c, iso, m).mark;
    if (v > r.high) r.high = v;
    if (v < r.low) r.low = v;
  }
  r.upTo = minute;
  if (ranges.size > 400) ranges.clear();
  ranges.set(key, r);
  const q = quoteAt(c, iso, minute);
  const yesterday = prevDay(iso);
  const name = reviewName(c.ticker);
  /* busiest at the money and near the bell of a near expiry; the day's volume arrives on a U */
  const x = Math.log(c.strike / q.spot) / Math.max(0.01, (q.iv || 0.2) * Math.sqrt(Math.max(yearsLeft(iso, minute, c.expiry), 1 / 252)));
  const size = (DAILY.has(c.ticker) ? 9000 : 1400 + 40000 / Math.max(20, name.px)) * Math.exp(-(x * x) / 1.6) * (1 / (1 + dteAt(iso, c.expiry) / 9));
  const done = (minute + 1) / DAY_MIN;
  const arrived = 0.5 * (1 - Math.cos(Math.PI * done)) * 0.7 + done * 0.3;
  const even = c.right === 'C' ? c.strike + q.ask : c.strike - q.ask;
  return {
    high: r.high,
    low: r.low,
    prevClose: yesterday ? quoteAt(c, yesterday, LAST_MIN).mark : q.mark,
    last: quoteAt(c, iso, Math.max(0, minute - Math.floor(u01(`${key}|${minute}|l`) * 3))).mark,
    volume: Math.round(size * (0.6 + 0.8 * u01(`${key}|v`)) * arrived),
    oi: Math.round(size * (2.2 + 4 * u01(`${contractKey(c)}|oi`))),
    breakeven: Math.round(even * 100) / 100,
    toBreakevenPct: ((even - q.spot) / q.spot) * 100,
  };
}
