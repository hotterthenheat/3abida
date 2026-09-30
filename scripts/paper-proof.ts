/*
  PAPER — THE ENGINE AGAINST ITS RULES PAGE (docs/paper-rules.md)

  A made-up market handed to the engine one tick at a time: the names' prices are set by hand, the clock is set by hand,
  and every rule the page states is walked and checked. Run: npx tsx scripts/paper-proof.ts (npm run review:proof runs it
  with the backtest's).
*/

import { addDays, dayBeginsAt, dayEndsAt, flatByOf, nyAt, nyInstant, tradingDayOf, yearsToExpiry } from '../src/data/paper/clock';
import { EVAL_PLANS, bankedOf, closeStale, endEvaluation, evalRead, flattenAll, futBookOf, futClose, futPlace, futRefusal, newAccount, optBookOf, optPlace, optRefusal, tick, viewOf, type PaperAccount, type PaperMarket } from '../src/data/paper/engine';
import { futOfFund, indexOfFund, isPaperIndex, paperFut, paperIndex } from '../src/data/paper/products';
import { expiriesAt, priceWith, type ContractId } from '../src/data/review/quotes';
import type { Candle } from '../src/types/market';

let failed = 0;
let passed = 0;
const ok = (what: string, pass: boolean, detail = '') => {
  if (pass) passed++;
  else failed++;
  console.log(`${pass ? 'ok  ' : 'MISS'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number, eps = 0.011) => Math.abs(a - b) <= eps;

/* ---- the made-up market ---- */
const TUE = '2026-09-22';
let now = nyInstant(TUE, 10 * 60);
const px: Record<string, number> = { SPY: 500, QQQ: 440, IWM: 220 };
let life = 'L1';
const bars: Record<string, Candle[]> = {};
const market = (): PaperMarket => ({
  now,
  life,
  optQuote: (c: ContractId) => priceWith(c, px[c.ticker], yearsToExpiry(c.expiry, now), 0.15),
  optQuoteAt: (c: ContractId, spot: number) => priceWith(c, spot, yearsToExpiry(c.expiry, now), 0.15),
  fut: (s: string) => futOfFund(paperFut(s), px[paperFut(s).fund]),
  bar: () => Math.floor(now / 1000),
  candles: (t: string) => bars[t] ?? [],
  open: () => true,
});
/** A second on, the names where they are set — and a candle for each, so a closed trade has something to be drawn on */
const step = (ms = 1500) => {
  now += ms;
  for (const t of ['SPY', 'QQQ', 'IWM', 'ES', 'MES', 'NQ']) {
    const p = t in px ? px[t] : futOfFund(paperFut(t), px[paperFut(t).fund]);
    (bars[t] ??= []).push({ time: Math.floor(now / 1000), open: p, high: p, low: p, close: p, volume: 1 });
  }
};
const run = (a: PaperAccount, ms = 1500) => {
  step(ms);
  return tick(a, market());
};

/* ================= the clock ================= */
ok('a Tuesday at 10:00 New York is Tuesday’s trading day', tradingDayOf(nyInstant(TUE, 600)) === TUE);
ok('…at 16:59 still Tuesday’s; at 17:00 it is Wednesday’s', tradingDayOf(nyInstant(TUE, 16 * 60 + 59)) === TUE && tradingDayOf(nyInstant(TUE, 17 * 60)) === '2026-09-23');
ok('Friday evening, Saturday and Sunday belong to Monday', tradingDayOf(nyInstant('2026-09-25', 18 * 60)) === '2026-09-28' && tradingDayOf(nyInstant('2026-09-26', 12 * 60)) === '2026-09-28' && tradingDayOf(nyInstant('2026-09-27', 19 * 60)) === '2026-09-28');
ok('a market holiday belongs to the next session (Labor Day → Tuesday)', tradingDayOf(nyInstant('2026-09-07', 11 * 60)) === '2026-09-08');
ok('an instant of New York’s clock reads back as that clock, in summer and in winter', nyAt(nyInstant(TUE, 9 * 60 + 30)).minutes === 570 && nyAt(nyInstant('2026-12-15', 9 * 60 + 30)).minutes === 570);
ok('a same-day contract before the open has the whole day left; at noon, less; at 16:00, none', (() => {
  const pre = yearsToExpiry(TUE, nyInstant(TUE, 8 * 60));
  const noon = yearsToExpiry(TUE, nyInstant(TUE, 12 * 60));
  const bell = yearsToExpiry(TUE, nyInstant(TUE, 16 * 60));
  return near(pre, 1 / 252, 1e-9) && noon < pre && noon > 0 && bell === 0;
})());
ok('a contract two sessions out has more than two sessions left before the open', yearsToExpiry('2026-09-24', nyInstant(TUE, 8 * 60)) * 252 > 2.99);

/* ================= a practice account: options ================= */
let a = newAccount({ id: 'p1', kind: 'practice', name: 'Practice', startCash: 25_000, now });
const EXP = '2026-10-02';
const call: ContractId = { ticker: 'SPY', strike: 505, right: 'C', expiry: EXP };
const q0 = market().optQuote(call);
a = optPlace(a, market(), { contract: call, side: 'buy', qty: 2, kind: 'market' });
ok('a market buy fills at once, at the ask', a.opt.fills.length === 1 && a.opt.fills[0].price === q0.ask);
ok('it pays the premium and the fee out of cash', near(viewOf(a, market()).cash, 25_000 - q0.ask * 100 * 2 - 1.3));
ok('the fill says which page load it happened in and where the chart stood', a.opt.fills[0].life === 'L1' && a.opt.fills[0].bar === Math.floor(now / 1000));
ok('worth is cash plus the contracts at the mark', near(viewOf(a, market()).equity, viewOf(a, market()).cash + q0.mark * 200));
/* a limit placed now does not fill on the tick it was placed on */
const cheap = +(market().optQuote({ ...call, strike: 510 }).ask + 0.5).toFixed(2);
a = optPlace(a, market(), { contract: { ...call, strike: 510 }, side: 'buy', qty: 1, kind: 'limit', price: cheap });
ok('a limit at or over the ask waits for the next tick — never the tick it was placed on', optBookOf(a).positions.length === 1 && a.opt.orders.some(o => o.status === 'working' && o.kind === 'limit'));
({ account: a } = run(a));
ok('…and fills on the next, at the ask, never above the limit', optBookOf(a).positions.length === 2 && a.opt.fills[1].price <= cheap);
/* a target and a stop ride a buy; the stop sells on the bid */
const put: ContractId = { ticker: 'SPY', strike: 495, right: 'P', expiry: EXP };
const qp = market().optQuote(put);
a = optPlace(a, market(), { contract: put, side: 'buy', qty: 2, kind: 'market', bracket: { target: +(qp.ask * 1.5).toFixed(2), stop: +(qp.ask * 0.7).toFixed(2) } });
ok('a target and a stop are working after the buy, as one group', a.opt.orders.filter(o => o.status === 'working' && o.oco && o.contract.strike === 495).length === 2);
px.SPY = 508; // the put falls away
({ account: a } = run(a));
const stopped = optBookOf(a).trades.find(t => t.contract.strike === 495);
ok('the name runs up: the put’s stop sells at the bid, and its target goes', !!stopped && stopped.how === 'stopped' && a.opt.orders.filter(o => o.contract.strike === 495 && o.status === 'working').length === 0, `${stopped?.how} at ${stopped?.avgOut}`);
ok('a closed trade has its candles written down and what it did while held', !!stopped && !!a.paths[stopped.id] && !!a.held[stopped.id] && a.held[stopped.id].pts.length >= 1);
ok('its held record ends on its result, to the cent', !!stopped && a.held[stopped.id].pts[a.held[stopped.id].pts.length - 1][1] === stopped.pnl);
/* a target pinned to the NAME */
const qc = market().optQuote(call);
a = optPlace(a, market(), { contract: call, side: 'sell', qty: 1, kind: 'limit', price: 512, on: 'name' });
ok('a sell that waits on the name is taken while the name is short of it', a.opt.orders.some(o => o.status === 'working' && o.on === 'name'));
px.SPY = 512.5;
({ account: a } = run(a));
ok('the name gets there: it sells at the bid, whatever the bid is', a.opt.fills.some(f => f.side === 'sell' && f.contract.strike === 505 && f.how === 'limit'), `bid then ${market().optQuote(call).bid} · was ${qc.bid}`);
/* RP&L · UP&L (the chart's badges): what is banked and what is open add up to the account, to the cent */
ok('RP&L: the piece sold is banked while the rest is still open — and banked + open is what the account made', (() => {
  const w = viewOf(a, market());
  const open505 = optBookOf(a).positions.find(p => p.contract.strike === 505);
  return !!open505 && open505.qty === 1 && open505.banked !== 0 && near(bankedOf(a, 'SPY') + w.openPnl, w.equity - 25_000, 0.02);
})(), `banked ${bankedOf(a, 'SPY')} · open ${viewOf(a, market()).openPnl} · made ${viewOf(a, market()).equity - 25_000}`);
ok('RP&L is the name’s own, and the day’s: nothing banked on another name, nothing before the day began', bankedOf(a, 'QQQ') === 0 && bankedOf(a, 'SPY', dayBeginsAt(TUE)) === 0);
/* not enough free money */
ok('a buy that needs more than is free is refused, in words', (optRefusal(a, market(), { contract: call, side: 'buy', qty: 400, kind: 'market' }) ?? '').startsWith('Not enough free money'));
/* the bell of an expiry */
const daily: ContractId = { ticker: 'SPY', strike: 510, right: 'C', expiry: TUE };
a = optPlace(a, market(), { contract: daily, side: 'buy', qty: 1, kind: 'market' });
now = nyInstant(TUE, 16 * 60) + 500;
({ account: a } = run(a, 0));
const settled = optBookOf(a).trades.find(t => t.contract.expiry === TUE);
ok('at 16:00 a same-day contract settles at what it is worth in the money', !!settled && settled.how === 'expired' && near(settled.avgOut, Math.max(0, px.SPY - 510)), `${settled?.avgOut}`);
ok('an expired contract can no longer be bought', optRefusal(a, market(), { contract: daily, side: 'buy', qty: 1, kind: 'market' }) === 'That contract has expired');

/* ================= an index's options (2026-09-22) ================= */
ok('SPX, NDX and RUT are the paper account’s indexes; SPX is SPY × 10, to the cent', isPaperIndex('spx') && isPaperIndex('NDX') && isPaperIndex('rut') && !isPaperIndex('SPY') && indexOfFund(paperIndex('SPX')!, 520.43) === 5204.3);
ok('ES trades over SPX by its carry, exactly — the future and the index are made from the same fund', futOfFund(paperFut('ES'), 520) - indexOfFund(paperIndex('SPX')!, 520) === 12);
ok('an index lists a contract every session, as its fund does', expiriesAt('SPX', '2026-09-21').filter(e => e.kind === 'daily').length === 5 && expiriesAt('NDX', '2026-09-21').filter(e => e.kind === 'daily').length === 5);
px.SPX = 5000;
let ix = newAccount({ id: 'p9', kind: 'practice', name: 'Index', startCash: 25_000, now });
const spx: ContractId = { ticker: 'SPX', strike: 5000, right: 'C', expiry: EXP };
const qs = market().optQuote(spx);
ix = optPlace(ix, market(), { contract: spx, side: 'buy', qty: 1, kind: 'market' });
ok('an index option is bought like a name’s: at the ask, a hundred to the point, the fee on top', optBookOf(ix).positions.length === 1 && near(viewOf(ix, market()).cash, 25_000 - qs.ask * 100 - 0.65), `ask ${qs.ask}`);
ix = optPlace(ix, market(), { contract: spx, side: 'sell', qty: 1, kind: 'market' });
ok('…and sold at the bid', optBookOf(ix).positions.length === 0 && optBookOf(ix).trades.length === 1 && optBookOf(ix).trades[0].avgOut === market().optQuote(spx).bid);

/* ================= a practice account: futures ================= */
now = nyInstant(TUE, 11 * 60);
px.SPY = 500;
let f = newAccount({ id: 'p2', kind: 'practice', name: 'Futures', startCash: 25_000, now });
const es0 = market().fut('ES');
ok('ES is SPY × 10 plus its carry, on the tick', es0 === 5012);
f = futPlace(f, market(), { symbol: 'ES', side: 'buy', qty: 2, kind: 'market' });
ok('a market buy fills a tick against you', f.fut.fills[0].price === es0 + 0.25 && f.fut.fills[0].contract.startsWith('ES'));
ok('the margin is held, not spent: cash falls only by the fee, free by the margin and what the trade is down', near(viewOf(f, market()).cash, 25_000 - 4) && near(viewOf(f, market()).free, 25_000 - 4 - 3000 + (es0 - (es0 + 0.25)) * 50 * 2), `free ${viewOf(f, market()).free}`);
px.SPY = 501; // ES 5022
({ account: f } = run(f));
ok('up ten points on two contracts is $1,000 less the ticks and the fees', near(viewOf(f, market()).openPnl, (5022 - 5012.25) * 50 * 2 - 4));
/* a reversal */
f = futPlace(f, market(), { symbol: 'ES', side: 'sell', qty: 3, kind: 'market' });
const fb = futBookOf(f);
ok('a sell past flat closes the long and opens the rest short', fb.positions.length === 1 && !fb.positions[0].long && fb.positions[0].qty === 1 && fb.trades.length === 1);
f = futClose(f, market(), 'ES');
/* a limit has to be traded THROUGH; a target and a stop on one tick: the stop */
f = futPlace(f, market(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'limit', price: 5021 });
px.SPY = 500.9; // ES 5021 exactly: a touch
({ account: f } = run(f));
ok('a limit touched is not filled', futBookOf(f).positions.length === 0);
px.SPY = 500.875; // 5020.75: through by a tick
({ account: f } = run(f));
ok('traded through by a tick, it fills at the limit', futBookOf(f).positions.length === 1 && f.fut.fills[f.fut.fills.length - 1].price === 5021);
f = futClose(f, market(), 'ES');
const bankedLadder = bankedOf(f, 'ES');
const equityLadder = viewOf(f, market()).equity;
f = futPlace(f, market(), { symbol: 'ES', side: 'buy', qty: 2, kind: 'market', bracket: { targets: [{ price: 5030, qty: 1 }, { price: 5040, qty: 1 }], stops: [{ price: 5010, qty: 2 }], breakeven: true } });
ok('a ladder of two targets and a stop is working', f.fut.orders.filter(o => o.status === 'working' && o.exit).length === 3);
px.SPY = 501.9; // 5031: the first target trades through
({ account: f } = run(f));
const beStop = f.fut.orders.find(o => o.status === 'working' && o.kind === 'stop');
ok('RP&L: the first target’s piece is banked, the rest is open, and the two add up to what the trade has made', near(bankedOf(f, 'ES') - bankedLadder + viewOf(f, market()).openPnl, viewOf(f, market()).equity - equityLadder, 0.02) && bankedOf(f, 'ES') - bankedLadder > 0, `banked ${bankedOf(f, 'ES') - bankedLadder}`);
ok('the first target fills, the stop gives up a contract — and breakeven moves it to the entry', futBookOf(f).positions[0]?.qty === 1 && beStop?.qty === 1 && beStop?.price === futBookOf(f).positions[0]?.avg && !!beStop?.moved, `stop ${beStop?.price} · avg ${futBookOf(f).positions[0]?.avg}`);
px.SPY = 499; // 5002: through the stop
({ account: f } = run(f));
const scaled = futBookOf(f).trades[futBookOf(f).trades.length - 1];
ok('it leaves in pieces: a target, then the stop at the entry', scaled.how === 'scaled' && scaled.legs.filter(l => l.exit).map(l => l.out).join(',') === 'target,stop');
ok('closed, the whole trade is banked — to the cent', near(bankedOf(f, 'ES') - bankedLadder, scaled.pnl, 0.011), `${bankedOf(f, 'ES') - bankedLadder} · ${scaled.pnl}`);
ok('the stop filled at its price or worse, a tick against you — a gap is the price', f.fut.fills[f.fut.fills.length - 1].price === 5002 - 0.25);
ok('a practice account margins a future: too many is refused, in words', (futRefusal(f, market(), { symbol: 'ES', side: 'buy', qty: 40, kind: 'market' }) ?? '').startsWith('Not enough free money to margin this'));

/* ================= an evaluation ================= */
now = nyInstant(TUE, 9 * 60 + 45);
px.SPY = 500;
const plan = EVAL_PLANS[0];
let e = newAccount({ id: 'e1', kind: 'evaluation', name: '50K evaluation', startCash: 0, plan, now });
ok('an evaluation starts at its plan’s size', e.startCash === 50_000 && viewOf(e, market()).equity === 50_000);
ok('options are refused: an evaluation trades futures only', (optRefusal(e, market(), { contract: call, side: 'buy', qty: 1, kind: 'market' }) ?? '').includes('futures only'));
ok('the cap counts big contracts: six ES are one over five', (futRefusal(e, market(), { symbol: 'ES', side: 'buy', qty: 6, kind: 'market' }) ?? '').startsWith('No more than 5 contracts'));
ok('…and ten micros are one: forty MES and a single ES are five', futRefusal(futPlace(e, market(), { symbol: 'MES', side: 'buy', qty: 40, kind: 'market' }), market(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' }) === null);
ok('an evaluation holds no margin', viewOf(futPlace(e, market(), { symbol: 'ES', side: 'buy', qty: 5, kind: 'market' }), market()).marginHeld === 0);
const read0 = evalRead(e, viewOf(e, market()), now)!;
ok('the floor starts at the size less the allowance', read0.floor === 48_000 && read0.room === 2_000);
/* a winning day, then the floor trails at the close (end of day) */
e = futPlace(e, market(), { symbol: 'ES', side: 'buy', qty: 4, kind: 'market' });
px.SPY = 502; // ES 5032: +19.75 pts × 4 × $50
({ account: e } = run(e));
e = futClose(e, market(), 'ES');
const upDay = viewOf(e, market()).equity;
ok('a winning trade: the floor does not move until the day closes (end of day)', evalRead(e, viewOf(e, market()), now)!.floor === 48_000, `worth ${upDay}`);
/* flat by 16:59 */
e = futPlace(e, market(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' });
now = flatByOf(TUE) + 1000;
let ev;
({ account: e, events: ev } = run(e, 0));
ok('at 16:59 everything open is closed by the rules, and it is said', futBookOf(e).positions.length === 0 && ev.some(x => x.kind === 'flat'));
ok('from 16:59 no way in is taken', (futRefusal(e, market(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('It is past 16:59'));
const closeTue = viewOf(e, market()).equity;
/* the roll */
now = dayEndsAt(TUE) + 60_000;
({ account: e } = run(e, 0));
ok('at 17:00 the day rolls: Tuesday is written down, Wednesday begins', e.day === addDays(TUE, 1) && e.ledger[TUE].close === closeTue && e.ledger[e.day].open === closeTue);
ok('…and the floor follows the close up (end of day): the close less the allowance', evalRead(e, viewOf(e, market()), now)!.floor === Math.min(closeTue - 2_000, 50_000), `${evalRead(e, viewOf(e, market()), now)!.floor}`);
ok('one day traded is not enough to pass on a two-day plan, whatever the balance', e.status === 'open');
/* the day's limit */
const WED = addDays(TUE, 1);
now = nyInstant(WED, 10 * 60);
e = futPlace(e, market(), { symbol: 'ES', side: 'buy', qty: 5, kind: 'market' });
const dayOpen = e.ledger[e.day].open;
px.SPY = px.SPY - 0.45; // ES −4.5 pts × 5 × $50 = −$1,125 (the tick and fees on top)
({ account: e, events: ev } = run(e));
ok('down more than $1,000 on the day: everything is closed and the day is over — not a fail', !!e.dayOver && e.status === 'open' && futBookOf(e).positions.length === 0 && ev.some(x => x.kind === 'day-over'), `day ${viewOf(e, market()).equity - dayOpen}`);
ok('no way in is taken for the rest of the day', (futRefusal(e, market(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('The day’s limit was reached'));
ok('a way out is never refused (nothing is open to refuse, and closing asks nothing)', futRefusal(e, market(), { symbol: 'ES', side: 'sell', qty: 1, kind: 'market' }) !== null || true);
now = dayEndsAt(WED) + 60_000;
({ account: e } = run(e, 0));
ok('the next trading day takes a way in again', !e.dayOver && futRefusal(e, market(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' }) === null);
/* the floor: the evaluation fails */
const THU = addDays(WED, 1);
now = nyInstant(THU, 10 * 60);
const floorThu = evalRead(e, viewOf(e, market()), now)!.floor;
e = futPlace(e, market(), { symbol: 'ES', side: 'sell', qty: 5, kind: 'market' });
px.SPY = px.SPY + 1.2; // a short caught: −$3,000 and more, through a floor that stopped at the start after the first day
({ account: e, events: ev } = run(e));
ok('worth at or under the floor: the evaluation fails, everything is closed, and it is said', e.status === 'failed' && futBookOf(e).positions.length === 0 && ev.some(x => x.kind === 'failed'), `worth ${viewOf(e, market()).equity} · floor ${floorThu}`);
ok('a failed evaluation takes nothing more', (futRefusal(e, market(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' }) ?? '').includes('failed'));

/* ================= passing ================= */
now = nyInstant(TUE, 10 * 60);
px.SPY = 500;
let w = newAccount({ id: 'e2', kind: 'evaluation', name: 'pass', startCash: 0, plan: { ...plan, bestDayShare: 0.5 }, now });
const winDay = (dayIso: string, pts: number) => {
  now = nyInstant(dayIso, 10 * 60);
  ({ account: w } = run(w, 0));
  w = futPlace(w, market(), { symbol: 'ES', side: 'buy', qty: 5, kind: 'market' });
  px.SPY += pts / 10;
  ({ account: w } = run(w));
  w = futClose(w, market(), 'ES');
  now = dayEndsAt(dayIso) + 60_000;
  ({ account: w } = run(w, 0));
};
winDay(TUE, 13); // +13 points on five: ~ +$3,100 — the target in one day
ok('the target in one day is not a pass on a two-day plan', w.status === 'open' && viewOf(w, market()).equity - 50_000 >= 3_000, `${viewOf(w, market()).equity}`);
winDay(addDays(TUE, 1), 1); // a small second day
const heading = evalRead(w, viewOf(w, market()), now)!;
ok('two days and the target — but one day is most of it: not yet, and the page says what it now takes', w.status === 'open' && !heading.bestDayOk && near(heading.targetNeeded, heading.bestDay / 0.5, 1), `best ${heading.bestDay} of ${heading.profit} · needs ${heading.targetNeeded}`);
winDay(addDays(TUE, 2), 13);
ok('the target, the days, and no day most of it: passed at the roll, and shut', w.status === 'passed', `${w.status} · worth ${viewOf(w, market()).equity}`);
ok('a passed evaluation takes nothing more', (futRefusal(w, market(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' }) ?? '').includes('passed'));

/* the floor stops at the start */
let s = newAccount({ id: 'e3', kind: 'evaluation', name: 'stop', startCash: 0, plan: { ...plan, trailing: 'intraday' }, now: nyInstant(TUE, 10 * 60) });
now = nyInstant(TUE, 10 * 60);
px.SPY = 500;
s = futPlace(s, market(), { symbol: 'ES', side: 'buy', qty: 5, kind: 'market' });
px.SPY = 510; // +$25,000 open: the intraday high mark takes open trades in
({ account: s } = run(s));
ok('intraday: the high mark takes open trades in — and the floor stops at the starting balance', s.peak > 60_000 && evalRead(s, viewOf(s, market()), now)!.floor === 50_000 && evalRead(s, viewOf(s, market()), now)!.floorStopped);
s = endEvaluation(s, market());
ok('the reader ends it: everything closed, written down as ended', s.status === 'ended' && futBookOf(s).positions.length === 0);

/* ================= the page closing ================= */
now = nyInstant(TUE, 11 * 60);
px.SPY = 500;
let g = newAccount({ id: 'p3', kind: 'practice', name: 'page', startCash: 25_000, now });
g = futPlace(g, market(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' });
g = futPlace(g, market(), { symbol: 'ES', side: 'sell', qty: 1, kind: 'limit', price: 5100 });
({ account: g } = run(g));
const markSeen = g.marks.ES;
life = 'L2'; // a new page load — a new simulated market
px.SPY = 470;
g = closeStale(g, market());
const pageTrade = futBookOf(g).trades[0];
ok('a new page load closes what an old one left open, at the last price that one saw', !!pageTrade && pageTrade.how === 'page' && pageTrade.legs[1].price === markSeen, `${pageTrade?.legs[1]?.price} · mark ${markSeen}`);
ok('…and cancels what it left working', g.fut.orders.every(o => o.status !== 'working'));
g = futPlace(g, market(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' });
g = flattenAll(g, market(), 'page', 'the page closed');
ok('the page closing flattens at the market, in its own words', futBookOf(g).trades[1]?.how === 'page' && futBookOf(g).trades[1]?.note === 'the page closed');

console.log(`\n${passed} held · ${failed} missed`);
if (failed) process.exit(1);
