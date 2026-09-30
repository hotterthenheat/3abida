/*
  PAPER — THE ENGINE AGAINST ITS RULES PAGE (docs/paper-rules.md)

  A made-up market handed to the engine one tick at a time: the names' prices are set by hand, the clock is set by hand,
  and every rule the page states is walked and checked. Paper trades OPTIONS, AND ONLY OPTIONS, since 2026-09-30.
  Run: npx tsx scripts/paper-proof.ts (npm run review:proof runs it with the backtest's).
*/

import { addDays, bellOf, dayBeginsAt, dayEndsAt, flatByOf, nyAt, nyInstant, tradingDayOf, yearsToExpiry } from '../src/data/paper/clock';
import { EVAL_PLANS, bankedOf, closeStale, endEvaluation, evalRead, flattenAll, newAccount, optBookOf, optClose, optPlace, optRefusal, tick, viewOf, type PaperAccount, type PaperMarket } from '../src/data/paper/engine';
import { indexOfFund, isPaperIndex, paperIndex } from '../src/data/paper/products';
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
  bar: () => Math.floor(now / 1000),
  candles: (t: string) => bars[t] ?? [],
  open: () => true,
});
/** A second on, the names where they are set — and a candle for each, so a closed trade has something to be drawn on */
const step = (ms = 1500) => {
  now += ms;
  for (const t of Object.keys(px)) (bars[t] ??= []).push({ time: Math.floor(now / 1000), open: px[t], high: px[t], low: px[t], close: px[t], volume: 1 });
};
const run = (a: PaperAccount, ms = 1500) => {
  step(ms);
  return tick(a, market());
};
/** Where the name has to stand for `qty` of a contract, bought now at the ask and sold at the bid, to make `want`, fees in —
    found by halving, so the walk below asks for a result and not for a price that happens to give it */
const spotFor = (c: ContractId, qty: number, want: number, fee = 0.65): number => {
  const paid = market().optQuote(c).ask;
  const made = (s: number) => (market().optQuoteAt(c, s).bid - paid) * 100 * qty - 2 * fee * qty;
  const rising = c.right === 'C';
  let lo = px[c.ticker] * 0.7;
  let hi = px[c.ticker] * 1.3;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if ((made(mid) < want) === rising) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
};
/** The contract at the money now, on an expiry that is still an option at the end of the walk */
const LATER = '2026-10-16';
const atTheMoney = (right: 'C' | 'P' = 'C'): ContractId => ({ ticker: 'SPY', strike: Math.round(px.SPY / 5) * 5, right, expiry: LATER });

/* ================= the clock: the day is the options day ================= */
ok('a Tuesday at 10:00 New York is Tuesday’s trading day', tradingDayOf(nyInstant(TUE, 600)) === TUE);
ok('…at 15:59 still Tuesday’s; at the 16:00 bell it is Wednesday’s', tradingDayOf(nyInstant(TUE, 15 * 60 + 59)) === TUE && tradingDayOf(nyInstant(TUE, 16 * 60)) === '2026-09-23');
ok('the day ends at the bell, and the next begins there', dayEndsAt(TUE) === bellOf(TUE) && dayBeginsAt('2026-09-23') === bellOf(TUE));
ok('an evaluation is flat by 15:59, a minute before it', flatByOf(TUE) === nyInstant(TUE, 15 * 60 + 59));
ok('Friday after the bell, Saturday and Sunday belong to Monday', tradingDayOf(nyInstant('2026-09-25', 16 * 60 + 30)) === '2026-09-28' && tradingDayOf(nyInstant('2026-09-26', 12 * 60)) === '2026-09-28' && tradingDayOf(nyInstant('2026-09-27', 19 * 60)) === '2026-09-28');
ok('Monday begins at Friday’s bell', dayBeginsAt('2026-09-28') === bellOf('2026-09-25'));
ok('a market holiday belongs to the next session (Labor Day → Tuesday)', tradingDayOf(nyInstant('2026-09-07', 11 * 60)) === '2026-09-08');
ok('an instant of New York’s clock reads back as that clock, in summer and in winter', nyAt(nyInstant(TUE, 9 * 60 + 30)).minutes === 570 && nyAt(nyInstant('2026-12-15', 9 * 60 + 30)).minutes === 570);
ok('a same-day contract before the open has the whole day left; at noon, less; at 16:00, none', (() => {
  const pre = yearsToExpiry(TUE, nyInstant(TUE, 8 * 60));
  const noon = yearsToExpiry(TUE, nyInstant(TUE, 12 * 60));
  const bell = yearsToExpiry(TUE, nyInstant(TUE, 16 * 60));
  return near(pre, 1 / 252, 1e-9) && noon < pre && noon > 0 && bell === 0;
})());
ok('a contract two sessions out has more than two sessions left before the open', yearsToExpiry('2026-09-24', nyInstant(TUE, 8 * 60)) * 252 > 2.99);

/* ================= a practice account ================= */
let a = newAccount({ id: 'p1', kind: 'practice', name: 'Practice', startCash: 25_000, now });
const EXP = '2026-10-02';
const call: ContractId = { ticker: 'SPY', strike: 505, right: 'C', expiry: EXP };
const q0 = market().optQuote(call);
a = optPlace(a, market(), { contract: call, side: 'buy', qty: 2, kind: 'market' });
ok('a market buy fills at once, at the ask', a.opt.fills.length === 1 && a.opt.fills[0].price === q0.ask);
ok('it pays the premium and the fee out of cash', near(viewOf(a, market()).cash, 25_000 - q0.ask * 100 * 2 - 1.3));
ok('nothing is margined: what is free is the cash', viewOf(a, market()).free === viewOf(a, market()).cash);
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
/* a debit spread: bought as one, for its net */
const vertical: ContractId = { ticker: 'SPY', strike: 515, short: 520, right: 'C', expiry: EXP };
const qv = market().optQuote(vertical);
a = optPlace(a, market(), { contract: vertical, side: 'buy', qty: 1, kind: 'market' });
ok('a debit spread is bought as one position, for its net, the fee a leg', optBookOf(a).positions.some(p => p.contract.short === 520 && p.qty === 1) && a.opt.fills[a.opt.fills.length - 1].price === qv.ask && a.opt.fills[a.opt.fills.length - 1].fee === 1.3);
ok('a spread sold for a credit is not taken — only bought', (optRefusal(a, market(), { contract: { ...vertical, strike: 520, short: 515 }, side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('A spread here is bought for a debit'));
a = optClose(a, market(), vertical, 1);
/* not enough free money */
ok('a buy that needs more than is free is refused, in words', (optRefusal(a, market(), { contract: call, side: 'buy', qty: 400, kind: 'market' }) ?? '').startsWith('Not enough free money'));

/* ================= the bell: what expires settles ON ITS DAY, then the day rolls ================= */
const daily: ContractId = { ticker: 'SPY', strike: 510, right: 'C', expiry: TUE };
const dailyPut: ContractId = { ticker: 'SPY', strike: 510, right: 'P', expiry: TUE };
a = optPlace(a, market(), { contract: daily, side: 'buy', qty: 1, kind: 'market' });
a = optPlace(a, market(), { contract: dailyPut, side: 'buy', qty: 1, kind: 'market' });
ok('(two same-day contracts are held into the bell)', optBookOf(a).positions.filter(p => p.contract.expiry === TUE).length === 2);
now = bellOf(TUE) + 500;
({ account: a } = run(a, 0));
const settled = optBookOf(a).trades.find(t => t.contract.expiry === TUE && t.contract.right === 'C');
const lapsed = optBookOf(a).trades.find(t => t.contract.expiry === TUE && t.contract.right === 'P');
ok('at 16:00 a same-day contract settles at what it is worth in the money', !!settled && settled.how === 'expired' && near(settled.avgOut, Math.max(0, px.SPY - 510)), `${settled?.avgOut}`);
ok('…and one out of the money expires worthless', !!lapsed && lapsed.how === 'expired' && lapsed.avgOut === 0);
ok('it settles on its own day, at the bell — not in the day the bell begins', !!settled && settled.closed.day === TUE && settled.closed.at === bellOf(TUE) - 1 && a.day === addDays(TUE, 1));
ok('the day that was closes with the settlement in it, and the new day begins from that close', a.ledger[TUE].close === a.ledger[a.day].open && a.ledger[TUE].close === viewOf(a, market()).equity && viewOf(a, market()).today === 0);
ok('an expired contract can no longer be bought', optRefusal(a, market(), { contract: daily, side: 'buy', qty: 1, kind: 'market' }) === 'That contract has expired');
/* a Friday contract seen again on Monday */
const FRI = '2026-09-25';
const MON = '2026-09-28';
now = nyInstant(FRI, 11 * 60);
let wk = newAccount({ id: 'p4', kind: 'practice', name: 'Weekend', startCash: 10_000, now });
wk = optPlace(wk, market(), { contract: { ticker: 'SPY', strike: 515, right: 'C', expiry: FRI }, side: 'buy', qty: 1, kind: 'market' });
now = nyInstant(MON, 10 * 60);
({ account: wk } = run(wk, 0));
const friday = optBookOf(wk).trades[0];
ok('a Friday contract next seen on Monday settles at Friday’s bell, in Friday’s close — Monday starts clean', !!friday && friday.how === 'expired' && friday.closed.day === FRI && wk.day === MON && wk.ledger[FRI].close === wk.ledger[MON].open && viewOf(wk, market()).today === 0, `${friday?.closed.day} · day ${wk.day}`);

/* ================= an index's options (2026-09-22) ================= */
now = nyInstant(TUE, 11 * 60);
ok('SPX, NDX and RUT are the paper account’s indexes; SPX is SPY × 10, to the cent', isPaperIndex('spx') && isPaperIndex('NDX') && isPaperIndex('rut') && !isPaperIndex('SPY') && indexOfFund(paperIndex('SPX')!, 520.43) === 5204.3);
ok('an index lists a contract every session, as its fund does', expiriesAt('SPX', '2026-09-21').filter(e => e.kind === 'daily').length === 5 && expiriesAt('NDX', '2026-09-21').filter(e => e.kind === 'daily').length === 5);
px.SPX = 5000;
let ix = newAccount({ id: 'p9', kind: 'practice', name: 'Index', startCash: 25_000, now });
const spx: ContractId = { ticker: 'SPX', strike: 5000, right: 'C', expiry: EXP };
const qs = market().optQuote(spx);
ix = optPlace(ix, market(), { contract: spx, side: 'buy', qty: 1, kind: 'market' });
ok('an index option is bought like a name’s: at the ask, a hundred to the point, the fee on top', optBookOf(ix).positions.length === 1 && near(viewOf(ix, market()).cash, 25_000 - qs.ask * 100 - 0.65), `ask ${qs.ask}`);
ix = optPlace(ix, market(), { contract: spx, side: 'sell', qty: 1, kind: 'market' });
ok('…and sold at the bid', optBookOf(ix).positions.length === 0 && optBookOf(ix).trades.length === 1 && optBookOf(ix).trades[0].avgOut === market().optQuote(spx).bid);

/* ================= an evaluation: options, and only options ================= */
now = nyInstant(TUE, 9 * 60 + 45);
px.SPY = 500;
const plan = EVAL_PLANS[0];
const atm = atTheMoney();
let e = newAccount({ id: 'e1', kind: 'evaluation', name: '50K evaluation', startCash: 0, plan, now });
ok('an evaluation starts at its plan’s size', e.startCash === 50_000 && viewOf(e, market()).equity === 50_000);
ok('it trades options: a call off the chain is taken', optRefusal(e, market(), { contract: atm, side: 'buy', qty: 1, kind: 'market' }) === null);
ok('the cap counts option contracts: six calls are one over five', (optRefusal(e, market(), { contract: atm, side: 'buy', qty: 6, kind: 'market' }) ?? '').startsWith('No more than 5 contracts'));
ok('a spread counts once, as it is bought: five debit spreads are five, not ten', optRefusal(e, market(), { contract: { ...atm, short: atm.strike + 5 }, side: 'buy', qty: 5, kind: 'market' }) === null);
const three = optPlace(e, market(), { contract: atm, side: 'buy', qty: 3, kind: 'market' });
const other: ContractId = { ...atm, strike: atm.strike + 5 };
ok('…and what is already open counts: three held and three more is six', (optRefusal(three, market(), { contract: other, side: 'buy', qty: 3, kind: 'market' }) ?? '').includes('this would be 6') && optRefusal(three, market(), { contract: other, side: 'buy', qty: 2, kind: 'market' }) === null);
ok('the page reads the contracts open off the options held', evalRead(three, viewOf(three, market()), now)!.contractsOpen === 3);
const read0 = evalRead(e, viewOf(e, market()), now)!;
ok('the floor starts at the size less the allowance', read0.floor === 48_000 && read0.room === 2_000);
/* a winning day — the floor waits for the close (end of day) */
const upTo = spotFor(atm, 4, 700);
e = optPlace(e, market(), { contract: atm, side: 'buy', qty: 4, kind: 'market' });
px.SPY = upTo;
({ account: e } = run(e));
e = optClose(e, market(), atm, 4);
const upDay = viewOf(e, market()).equity;
ok('a winning trade: the floor does not move until the day closes (end of day)', upDay > 50_600 && evalRead(e, viewOf(e, market()), now)!.floor === 48_000, `worth ${upDay}`);
/* flat a minute before the bell */
e = optPlace(e, market(), { contract: atm, side: 'buy', qty: 1, kind: 'market' });
now = flatByOf(TUE) + 500;
ok('in the last minute a way out is still taken — only a way in is refused', optRefusal(e, market(), { contract: atm, side: 'sell', qty: 1, kind: 'market' }) === null && (optRefusal(e, market(), { contract: atm, side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('It is past 15:59'));
let ev;
({ account: e, events: ev } = run(e, 0));
ok('at 15:59 everything open is closed by the rules, and it is said', optBookOf(e).positions.length === 0 && ev.some(x => x.kind === 'flat' && x.words.startsWith('15:59')));
ok('from 15:59 no way in is taken, and the page says when the next day begins', (optRefusal(e, market(), { contract: atm, side: 'buy', qty: 1, kind: 'market' }) ?? '').includes('the next trading day begins at 16:00'));
const closeTue = viewOf(e, market()).equity;
/* the roll, at the bell */
now = dayEndsAt(TUE) + 60_000;
({ account: e } = run(e, 0));
ok('at 16:00 the day rolls: Tuesday is written down, Wednesday begins', e.day === addDays(TUE, 1) && e.ledger[TUE].close === closeTue && e.ledger[e.day].open === closeTue);
ok('…and the floor follows the close up (end of day): the close less the allowance', evalRead(e, viewOf(e, market()), now)!.floor === Math.min(closeTue - 2_000, 50_000), `${evalRead(e, viewOf(e, market()), now)!.floor}`);
ok('one day traded is not enough to pass on a two-day plan, whatever the balance', e.status === 'open');
/* the day's limit */
const WED = addDays(TUE, 1);
now = nyInstant(WED, 10 * 60);
const dayOpen = e.ledger[e.day].open;
const wed = atTheMoney();
const downTo = spotFor(wed, 5, -1_150);
e = optPlace(e, market(), { contract: wed, side: 'buy', qty: 5, kind: 'market' });
px.SPY = downTo;
({ account: e, events: ev } = run(e));
ok('down more than $1,000 on the day: everything is closed and the day is over — not a fail', !!e.dayOver && e.status === 'open' && optBookOf(e).positions.length === 0 && ev.some(x => x.kind === 'day-over' && x.words.includes('16:00 bell')), `day ${viewOf(e, market()).equity - dayOpen}`);
ok('no way in is taken for the rest of the day, and the page says until when', (optRefusal(e, market(), { contract: wed, side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('The day’s limit was reached') && (optRefusal(e, market(), { contract: wed, side: 'buy', qty: 1, kind: 'market' }) ?? '').includes('16:00 bell'));
now = dayEndsAt(WED) + 60_000;
({ account: e } = run(e, 0));
ok('the next trading day takes a way in again', !e.dayOver && optRefusal(e, market(), { contract: wed, side: 'buy', qty: 1, kind: 'market' }) === null);
/* the floor: the evaluation fails */
const THU = addDays(WED, 1);
now = nyInstant(THU, 10 * 60);
const floorThu = evalRead(e, viewOf(e, market()), now)!.floor;
const thu = atTheMoney();
const crashTo = spotFor(thu, 5, -(viewOf(e, market()).equity - floorThu) - 300);
e = optPlace(e, market(), { contract: thu, side: 'buy', qty: 5, kind: 'market' });
px.SPY = crashTo;
({ account: e, events: ev } = run(e));
ok('worth at or under the floor: the evaluation fails, everything is closed, and it is said', e.status === 'failed' && optBookOf(e).positions.length === 0 && ev.some(x => x.kind === 'failed'), `worth ${viewOf(e, market()).equity} · floor ${floorThu}`);
ok('a failed evaluation takes nothing more', (optRefusal(e, market(), { contract: thu, side: 'buy', qty: 1, kind: 'market' }) ?? '').includes('failed'));

/* ================= passing ================= */
now = nyInstant(TUE, 10 * 60);
px.SPY = 500;
let w = newAccount({ id: 'e2', kind: 'evaluation', name: 'pass', startCash: 0, plan: { ...plan, bestDayShare: 0.5 }, now });
const winDay = (dayIso: string, want: number) => {
  now = nyInstant(dayIso, 10 * 60);
  ({ account: w } = run(w, 0));
  const c = atTheMoney();
  const to = spotFor(c, 5, want);
  w = optPlace(w, market(), { contract: c, side: 'buy', qty: 5, kind: 'market' });
  px.SPY = to;
  ({ account: w } = run(w));
  w = optClose(w, market(), c, 5);
  now = dayEndsAt(dayIso) + 60_000;
  ({ account: w } = run(w, 0));
};
winDay(TUE, 3_100); // the target in one day
ok('the target in one day is not a pass on a two-day plan', w.status === 'open' && viewOf(w, market()).equity - 50_000 >= 3_000, `${viewOf(w, market()).equity}`);
winDay(addDays(TUE, 1), 400); // a small second day
const heading = evalRead(w, viewOf(w, market()), now)!;
ok('two days and the target — but one day is most of it: not yet, and the page says what it now takes', w.status === 'open' && !heading.bestDayOk && near(heading.targetNeeded, heading.bestDay / 0.5, 1), `best ${heading.bestDay} of ${heading.profit} · needs ${heading.targetNeeded}`);
winDay(addDays(TUE, 2), 3_100);
ok('the target, the days, and no day most of it: passed at the roll, and shut', w.status === 'passed', `${w.status} · worth ${viewOf(w, market()).equity}`);
ok('a passed evaluation takes nothing more', (optRefusal(w, market(), { contract: atTheMoney(), side: 'buy', qty: 1, kind: 'market' }) ?? '').includes('passed'));

/* the floor stops at the start */
now = nyInstant(TUE, 10 * 60);
px.SPY = 500;
let s = newAccount({ id: 'e3', kind: 'evaluation', name: 'stop', startCash: 0, plan: { ...plan, trailing: 'intraday' }, now });
const sc = atTheMoney();
const runTo = spotFor(sc, 5, 4_000);
s = optPlace(s, market(), { contract: sc, side: 'buy', qty: 5, kind: 'market' });
px.SPY = runTo;
({ account: s } = run(s));
ok('intraday: the high mark takes open trades in — and the floor stops at the starting balance', s.peak > 53_000 && evalRead(s, viewOf(s, market()), now)!.floor === 50_000 && evalRead(s, viewOf(s, market()), now)!.floorStopped, `high ${s.peak}`);
s = endEvaluation(s, market());
ok('the reader ends it: everything closed, written down as ended', s.status === 'ended' && optBookOf(s).positions.length === 0);

/* ================= the page closing ================= */
now = nyInstant(TUE, 11 * 60);
px.SPY = 500;
let g = newAccount({ id: 'p3', kind: 'practice', name: 'page', startCash: 25_000, now });
const gc = atTheMoney();
g = optPlace(g, market(), { contract: gc, side: 'buy', qty: 1, kind: 'market' });
g = optPlace(g, market(), { contract: gc, side: 'sell', qty: 1, kind: 'limit', price: 99 });
({ account: g } = run(g));
const key = optBookOf(g).positions[0].key;
const markSeen = g.marks[key];
life = 'L2'; // a new page load — a new simulated market
px.SPY = 470;
g = closeStale(g, market());
const pageTrade = optBookOf(g).trades[0];
ok('a new page load closes what an old one left open, at the last price that one saw', !!pageTrade && pageTrade.how === 'page' && pageTrade.avgOut === markSeen, `${pageTrade?.avgOut} · mark ${markSeen}`);
ok('…and cancels what it left working', g.opt.orders.every(o => o.status !== 'working'));
g = optPlace(g, market(), { contract: gc, side: 'buy', qty: 1, kind: 'market' });
g = flattenAll(g, market(), 'page', 'the page closed');
ok('the page closing flattens at the market, in its own words', optBookOf(g).trades[1]?.how === 'page' && optBookOf(g).trades[1]?.note === 'the page closed');

console.log(`\n${passed} held · ${failed} missed`);
if (failed) process.exit(1);
