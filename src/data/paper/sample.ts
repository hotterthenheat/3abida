/*
==================================================
  SLAYER TERMINAL - PAPER · THE SAMPLE ACCOUNTS
  (data/paper/sample.ts)

  A September of paper trades for the journal to show
  (Noah, 2026-09-26: "add a whole bunch of fake data in
  for the september calendar as static data so when i
  present it to my partner he doesnt see a whole bunch of
  blank stuff"). Two accounts — a practice account and
  a 50K evaluation — trading OPTIONS, the only thing
  Paper trades (2026-09-30), MADE BY THE ENGINE ITSELF on a
  made-up September market: minute candles walked from a
  seed, orders placed and closed the way the desk places
  them (afterHand round every hand action, as the store
  does), the account ticked every minute a trade was on.
  So every sample trade has what a real one has: its
  candles for the trade page, its ticks for "while you
  held it", its day, its fills — nothing is typed in by
  hand but a few journal words. The walk leans a little
  toward the side taken on most trades, the way a trader
  with some edge sees the tape — so the month reads as a
  month of trading, not a coin. Built ONCE, the same
  every time (a seeded walk), only when the journal asks
  for it; never on the Live Chart, never in the store:
  the sample is the journal's alone.

  SAMPLE_JOURNAL IS THE SWITCH. It is on for the
  presentation and comes out before launch (nobody's
  journal ships with trades they did not make); the head
  of the journal offers "Hide the sample" meanwhile, kept
  on this machine.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { EVAL_PLANS, afterHand, newAccount, optBookOf, optClose, optPlace, tick, type PaperAccount, type PaperMarket } from './engine';
import { addDays, nyInstant, yearsToExpiry } from './clock';
import { expiriesAt, priceWith, type ContractId } from '../review/quotes';
import type { DayNote, JournalEntry } from '../review/journal';
import type { Candle } from '../../types/market';

/** THE SWITCH — off before launch */
export const SAMPLE_JOURNAL = true;
export const SAMPLE_IDS = ['sampleP', 'sampleE'] as const;

/* ---- shown or hidden, kept on this machine ---- */
const SHOWN_KEY = 'slayer_paper_sample';
const readShown = (): boolean => {
  try {
    return localStorage.getItem(SHOWN_KEY) !== '0';
  } catch {
    return true;
  }
};
let shown = readShown();
const listeners = new Set<() => void>();
export const setSampleShown = (on: boolean) => {
  shown = on;
  try {
    localStorage.setItem(SHOWN_KEY, on ? '1' : '0');
  } catch {
    /* a private window: it holds for the page */
  }
  listeners.forEach(fn => fn());
};
export const useSampleShown = (): boolean =>
  useSyncExternalStore(
    fn => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => shown,
    () => shown
  );

/* ---- the made-up September ---- */
const FIRST = '2026-09-01';
const LAST = '2026-09-25';
const HOLIDAY = '2026-09-07';
const OPEN_MIN = 9 * 60;
const CLOSE_MIN = 16 * 60;
const FUNDS = ['SPY', 'QQQ'] as const;
/** A seeded 0..1 — the same September every time */
const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

let built: PaperAccount[] | null = null;
/** The two sample accounts — built once, from the seed */
export function sampleAccounts(): PaperAccount[] {
  if (built) return built;
  const r = rng(20260901);
  const px: Record<string, number> = { SPY: 496.4, QQQ: 438.1, IWM: 221.7 };
  /* a minute's noise per fund, and the lean of the tape while a trade is on (a sign, or nothing) */
  const NOISE: Record<string, number> = { SPY: 0.055, QQQ: 0.06 };
  let lean: Record<string, number> = { SPY: 0, QQQ: 0 };
  let day = FIRST;
  let minute = OPEN_MIN;
  let now = nyInstant(day, minute);
  /* the day's candles by name, walked a minute at a time */
  let bars: Record<string, Candle[]> = {};
  /** One more minute of tape: a candle a fund; the names move to its close */
  const walk = () => {
    const time = Math.floor(now / 1000);
    for (const f of FUNDS) {
      const step = NOISE[f];
      const o = px[f];
      const a = o + (r() - 0.5) * step;
      const b = a + (r() - 0.5) * step + lean[f] * step * 0.45;
      const c = b + (r() - 0.5) * step;
      const candle: Candle = { time, open: +o.toFixed(2), high: +(Math.max(o, a, b, c) + r() * step * 0.3).toFixed(2), low: +(Math.min(o, a, b, c) - r() * step * 0.3).toFixed(2), close: +c.toFixed(2), volume: Math.round(2000 + r() * 6000) };
      (bars[f] ??= []).push(candle);
      px[f] = candle.close;
    }
    minute += 1;
    now = nyInstant(day, minute);
  };
  const market = (): PaperMarket => ({
    now,
    life: 'SAMPLE',
    optQuote: (c: ContractId) => priceWith(c, px[c.ticker], yearsToExpiry(c.expiry, now), 0.15),
    optQuoteAt: (c: ContractId, spot: number) => priceWith(c, spot, yearsToExpiry(c.expiry, now), 0.15),
    bar: () => Math.floor(now / 1000),
    candles: (t: string) => bars[t] ?? [],
    open: () => true,
    /* the day's book round its open — the stamp a fill carries (WHERE THE TRADE STOOD), steady through the day */
    levels: (t: string) => dayLevels[t] ?? null,
  });
  let dayLevels: Record<string, { flip: number; callWall: number; putWall: number }> = {};
  /** A day's flip and walls for a fund, from the day and the fund alone (never the walk's own draws, so the tape is unchanged) */
  const levelsFor = (f: string, open: number) => {
    const u = (k: string) => {
      let h = 2166136261;
      for (const ch of `${day}|${f}|${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      return ((h >>> 0) % 10_000) / 10_000;
    };
    return { flip: +(open * (1 + (u('f') - 0.5) * 0.008)).toFixed(2), callWall: +(open * (1.003 + u('c') * 0.006)).toFixed(2), putWall: +(open * (0.997 - u('p') * 0.006)).toFixed(2) };
  };
  /** A hand's action on the account, as the store makes one: the fill, then what the engine keeps of it */
  const hand = (a: PaperAccount, fn: (a: PaperAccount, m: PaperMarket) => PaperAccount) => afterHand(a, fn(a, market()), market());

  let practice = newAccount({ id: SAMPLE_IDS[0], kind: 'practice', name: 'Starter · practice', startCash: 25_000, now });
  let evaluation = newAccount({ id: SAMPLE_IDS[1], kind: 'evaluation', name: 'Starter · 50K evaluation', startCash: 50_000, plan: EVAL_PLANS[0], now: nyInstant('2026-09-08', OPEN_MIN) });

  while (day <= LAST) {
    const wd = new Date(`${day}T12:00:00`).getDay();
    if (wd >= 1 && wd <= 5 && day !== HOLIDAY) {
      /* the day opens with a small gap, and its tape starts an hour before the first trade could */
      for (const f of FUNDS) px[f] = +(px[f] * (1 + (r() - 0.5) * 0.006)).toFixed(2);
      dayLevels = Object.fromEntries(FUNDS.map(f => [f, levelsFor(f, px[f])]));
      bars = {};
      lean = { SPY: 0, QQQ: 0 };
      minute = OPEN_MIN;
      now = nyInstant(day, minute);
      /* one to four trades a day, the morning mostly; the evaluation trades from Sep 8 */
      const n = 1 + Math.floor(r() * 3.6);
      let at = OPEN_MIN + 50 + Math.floor(r() * 30);
      for (let i = 0; i < n && at < CLOSE_MIN - 45; i++) {
        while (minute < at) walk();
        const onEval = day >= '2026-09-08' && r() < 0.4;
        let a = onEval ? evaluation : practice;
        a = tick(a, market()).account;
        const hold = 6 + Math.floor(r() * 30);
        /* the tape leans with the trade on most of them, against it on the rest — an edge, not a certainty */
        const edge = r() < 0.56 ? 0.9 : -0.85;
        /* THE CONTRACT: SPY most days, QQQ on the rest; a call or a put at the money — or, now and then on the practice
           account, a vertical bought for a debit (the strike sold two out). The practice account holds a week or two; the
           evaluation trades the near expiries, inside its plan's contracts. */
        const fund = r() < 0.65 ? 'SPY' : 'QQQ';
        const up = r() < 0.55;
        const list = expiriesAt(fund, day);
        const exp = (onEval ? (list.find(e => e.dte >= 1) ?? list[0]) : (list.find(e => e.dte >= 5) ?? list[0])).iso;
        const strike = Math.round(px[fund]);
        const spread = !onEval && r() < 0.2;
        const c: ContractId = { ticker: fund, strike, right: up ? 'C' : 'P', expiry: exp, ...(spread ? { short: up ? strike + 2 : strike - 2 } : {}) };
        const qty = onEval ? 1 + Math.floor(r() * 3) : 1 + Math.floor(r() * (spread ? 4 : 3));
        a = hand(a, (x, m) => optPlace(x, m, { contract: c, side: 'buy', qty, kind: 'market' }));
        lean[fund] = (up ? 1 : -1) * edge;
        for (let k = 0; k < hold; k++) {
          walk();
          a = tick(a, market()).account;
        }
        lean[fund] = 0;
        a = hand(a, (x, m) => optClose(x, m, c, qty));
        if (onEval) evaluation = a;
        else practice = a;
        at = minute + 10 + Math.floor(r() * 50);
      }
      /* the rest of the day's tape, so a late trade's chart has its afternoon */
      while (minute < CLOSE_MIN) walk();
    }
    day = addDays(day, 1);
  }
  /* the accounts brought up to the sample's last day */
  day = LAST;
  minute = CLOSE_MIN + 30;
  now = nyInstant(day, minute);
  practice = tick(practice, market()).account;
  evaluation = tick(evaluation, market()).account;

  /* A FEW WORDS, so the journal's pages are not bare — on the practice account's first trades and days */
  const words: Record<string, JournalEntry> = {};
  const ids = tradeIdsOf(practice);
  const say = (i: number, e: JournalEntry) => {
    if (ids[i]) words[ids[i]] = { ...e, keptAt: nyInstant(LAST, 17 * 60) };
  };
  say(0, { setup: 'Opening range break', plan: 'yes', why: 'First push through the opening range with the tape going one way.', saw: 'It ran, stalled at the wall, and I got out on the stall.', again: 'Take it. Leave sooner if the second push is smaller than the first.' });
  say(1, { setup: 'Pullback in a trend', plan: 'no', mistakes: ['Chased it'], why: 'Missed the pullback and bought the next push instead.', saw: 'Bought the top of the move. It went nowhere for ten minutes.', again: 'Wait for the pullback or let it go.' });
  say(3, { setup: 'Fade of a stretched move', plan: 'yes', why: 'Three wide bars up into the wall, nothing behind them.', saw: 'Turned within two minutes.', again: 'Same trade, same place.' });
  say(5, { setup: 'Bounce off a wall', plan: 'no', mistakes: ['Held too long'], why: 'It had held twice already.', saw: 'It held a third time and I stayed for a fourth.', again: 'Take the second touch and go.' });
  say(8, { setup: 'Opening range break', plan: 'yes', why: 'Same as the 2nd — a clean break with size behind it.', saw: 'Slow, but it got there.', again: 'Yes.' });
  /* the rest carry tags without words — a setup, the plan, a mood, now and then a mistake — so the journal's cuts have
     something to count; drawn from the trade's place in the list, never the walk's draws */
  const SETUPS = ['Opening range break', 'Pullback in a trend', 'Bounce off a wall', 'Break through a wall', 'Flip reclaimed', 'Fade of a stretched move'];
  const MISTAKES = ['Chased it', 'Held too long', 'Cut it early', 'Too big', 'Moved my stop'];
  const FEELS = ['Calm', 'Focused', 'Rushed', 'Tired', 'Frustrated', 'Calm', 'Focused'];
  for (let i = 0; i < ids.length; i++) {
    if (words[ids[i]] || i % 5 === 4) continue;
    const slip = (i * 7) % 10 < 3;
    words[ids[i]] = { setup: SETUPS[(i * 5) % SETUPS.length], plan: slip ? 'no' : 'yes', mood: FEELS[(i * 3) % FEELS.length], ...(slip ? { mistakes: [MISTAKES[(i * 3) % MISTAKES.length]] } : {}), keptAt: nyInstant(LAST, 17 * 60) };
  }
  const days: Record<string, DayNote> = {
    '2026-09-02': { plan: 'Two trades at most. Nothing after 11:30.', review: 'Kept to it. The second was the better one.' },
    '2026-09-15': { plan: 'Only the first pullback in the trend.', review: 'Took a late one anyway. It cost the morning.' },
    '2026-09-22': { plan: 'Flat into the afternoon. Size down after a loss.', review: 'Sized down, stayed flat after 13:00 — a quiet day is a good day.' },
  };
  practice = { ...practice, journal: words, days };
  built = [practice, evaluation];
  return built;
}
/** An account's closed trades' ids, oldest first */
const tradeIdsOf = (a: PaperAccount): string[] => [...optBookOf(a).trades].sort((x, y) => x.opened.at - y.opened.at).map(t => t.id);
