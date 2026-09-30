/*
  REVIEW · THE ENGINE'S PROOF — `npx tsx scripts/review-engine-proof.ts`
  The rules page (docs/review-backtest-rules.md), checked against the engine, off the browser. Exits 1 on a miss.
*/
import { accountOf, advance, amend, attach, bankedOf, bookOf, cancel, cashOf, cutsOf, dayStateOf, equityAtOpen, floorOf, ladderRoom, namesOf, newSession, place, rebase, refusal, setBreakeven, setTrail, statsOf, MULT } from '../src/data/review/engine';
import { splitQty } from '../src/data/review/ladder';
import { chainAt, contractKey, contractWords, expiriesAt, quoteAt, quoteWith, spotForBid, yearsLeft } from '../src/data/review/quotes';
import { DAY_MIN, LAST_MIN, barTime, dayBars, nextDay, spotAt, tapeDays } from '../src/data/review/tape';

let misses = 0;
const ok = (what: string, pass: boolean, detail = '') => {
  if (!pass) misses++;
  console.log(`${pass ? 'ok  ' : 'MISS'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number, eps = 0.011) => Math.abs(a - b) <= eps;

/* ---- the tape stays put ---- */
const days = tapeDays();
const day = days[days.length - 40];
const a = dayBars('NVDA', day);
const b = dayBars('NVDA', day);
ok('a day is 390 bars', a.length === DAY_MIN);
ok('the same day twice is the same day', a.every((x, i) => x.close === b[i].close));
/* real instants: what New York's clock reads at a bar's stamp is the market's minute — in winter and in summer time */
const nyClock = (t: number) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(new Date(t * 1000));
ok('bars are a minute apart, from 09:30 in New York', a[1].time - a[0].time === 60 && nyClock(a[0].time) === '09:30' && nyClock(a[LAST_MIN].time) === '15:59');
ok('09:30 on both sides of a clock change', days.every(d => nyClock(barTime(d, 0)) === '09:30'));
const tomorrow = nextDay(day)!;
ok('the next day opens near this close (a gap, not a cliff)', Math.abs(dayBars('NVDA', tomorrow)[0].open / a[LAST_MIN].close - 1) < 0.05);
ok('the tape ends on the name\'s quote today', near(dayBars('SPY', days[days.length - 1])[LAST_MIN].close, 520.4, 0.02));

/* ---- a quote ---- */
const exps = expiriesAt('NVDA', day);
ok('a name lists weeklies and monthlies', exps.length >= 6 && exps[0].iso >= day, exps.map(e => e.label).slice(0, 4).join(' · '));
ok('the funds list dailies', expiriesAt('SPY', day).filter(e => e.kind === 'daily').length >= 3);
const exp = exps.find(e => e.dte >= 7)!.iso;
const { spot, rows } = chainAt('NVDA', day, 30, exp, 6);
const atm = rows.reduce((best, r) => (Math.abs(r.strike - spot) < Math.abs(best.strike - spot) ? r : best), rows[0]);
const call = { ticker: 'NVDA', strike: atm.strike, right: 'C' as const, expiry: exp };
const q0 = quoteAt(call, day, 30);
ok('bid under ask, the mark between', q0.bid < q0.ask && q0.mark >= q0.bid && q0.mark <= q0.ask, `${q0.bid} / ${q0.ask}`);
ok('an at-the-money call is about half a delta', q0.delta > 0.4 && q0.delta < 0.65, q0.delta.toFixed(2));
ok('theta is a loss', q0.theta < 0, q0.theta.toFixed(3));
ok('time runs out: less is left later in the day', yearsLeft(day, 300, exp) < yearsLeft(day, 30, exp));
ok('at the bell of its expiry a contract is its intrinsic', (() => { const q = quoteAt(call, exp, LAST_MIN); const s = spotAt('NVDA', exp, LAST_MIN); return near(q.mark, Math.max(0, s - call.strike)) && q.bid === q.ask; })());

/* ---- orders and fills ---- */
let s = newSession({ id: 't', name: 'proof', ticker: 'NVDA', startCash: 10000, startDay: day, now: 0 });
s = advance(s, { day, minute: 30 }, 0);
s = place(s, { contract: call, side: 'buy', qty: 2, kind: 'market' }, 0);
ok('a market buy fills at the ask, on the minute', s.fills.length === 1 && s.fills[0].price === q0.ask && s.fills[0].at.minute === 30);
ok('cash pays the premium and the fee', near(cashOf(s), 10000 - q0.ask * MULT * 2 - 1.3), cashOf(s).toFixed(2));
ok('the position is marked, and starts behind by the spread and the fee', accountOf(s).positions[0].pnl < 0);
ok('a buy the cash cannot pay for is refused, in words', (refusal(s, { contract: call, side: 'buy', qty: 500, kind: 'market' }) ?? '').startsWith('Not enough cash'));
ok('selling what is not held is refused', refusal(s, { contract: { ...call, right: 'P' }, side: 'sell', qty: 1, kind: 'market' }) === 'You do not hold that contract');
ok('the clock cannot be pulled back past the last fill', (() => { const back = advance(s, { day, minute: 5 }, 0); return back.cursor.minute === floorOf(s).minute && back.fills.length === 1; })());

/* a limit sell far above never fills today and, as a day order, goes at the bell */
s = place(s, { contract: call, side: 'sell', qty: 1, kind: 'limit', price: q0.ask * 5, tif: 'day' }, 0);
s = advance(s, { day, minute: LAST_MIN }, 0);
ok('a day order that did not fill is cancelled at 16:00', s.orders.find(o => o.kind === 'limit')?.status === 'cancelled' && s.orders.find(o => o.kind === 'limit')?.why === 'the day ended');

/* a stop under the market that a bad day would reach: walk forward until it goes, or the bell rings */
const entry = s.fills[0].price;
s = place(s, { contract: call, side: 'sell', qty: 2, kind: 'stop', price: Math.max(0.05, +(entry * 0.5).toFixed(2)) }, 0);
let d: string | null = day;
while (d && d <= exp && bookOf(s).positions.length) {
  d = nextDay(d);
  if (d) s = advance(s, { day: d, minute: LAST_MIN }, 0);
}
const { trades, positions } = bookOf(s);
ok('the trade ended: by its stop, or at the bell of its expiry', positions.length === 0 && trades.length === 1 && (trades[0].how === 'stopped' || trades[0].how === 'expired'), trades[0]?.how);
ok('a stopped trade filled at the bid that touched the stop; an expired one at intrinsic, with no fee', (() => { const f = s.fills[s.fills.length - 1]; return f.how === 'expired' ? f.fee === 0 : f.how === 'stop' && f.price <= s.orders.find(o => o.kind === 'stop')!.price!; })());
ok('1R is what was paid: R = pnl / cost', near(trades[0].r, trades[0].pnl / trades[0].cost, 1e-9), `${trades[0].pnl.toFixed(2)} on ${trades[0].cost.toFixed(2)} = ${trades[0].r.toFixed(2)}R`);
ok('cash and the record agree', near(cashOf(s), 10000 + trades[0].pnl, 0.02));
ok('nothing is left working on an expired contract', s.orders.every(o => o.status !== 'working' || o.contract.expiry > s.cursor.day));

/* ---- a target and a stop ride a buy; one fills, the other goes ---- */
let t = newSession({ id: 'u', name: 'bracket', ticker: 'SPY', startCash: 25000, startDay: day, now: 0 });
t = advance(t, { day, minute: 10 }, 0);
const se = expiriesAt('SPY', day).find(e => e.dte >= 5)!.iso;
const sc = chainAt('SPY', day, 10, se, 3);
const spyCall = { ticker: 'SPY', strike: sc.rows[3].strike, right: 'C' as const, expiry: se };
const sq = quoteAt(spyCall, day, 10);
t = place(t, { contract: spyCall, side: 'buy', qty: 3, kind: 'market', bracket: { target: +(sq.ask * 1.15).toFixed(2), stop: +(sq.ask * 0.85).toFixed(2) } }, 0);
ok('the pair is working after the buy', t.orders.filter(o => o.status === 'working' && o.oco).length === 2);
ok('the held contracts are spoken for by the pair — for a sell that WAITS; a market sell by hand never is', refusal(t, { contract: spyCall, side: 'sell', qty: 1, kind: 'limit', price: +(sq.ask * 2).toFixed(2) }) === 'Those contracts are already spoken for by a working order' && refusal(t, { contract: spyCall, side: 'sell', qty: 1, kind: 'market' }) === null);
let e: string | null = day;
while (e && e <= se && bookOf(t).positions.length) {
  t = advance(t, { day: e, minute: LAST_MIN }, 0);
  e = nextDay(e);
}
const bt = bookOf(t).trades[0];
ok('one of the pair (or the bell) closed it, and the other is not working', !!bt && t.orders.filter(o => o.oco && o.status === 'working').length === 0, bt?.how);
t = cancel(t, 'nope', 0);

/* ---- a target and a stop put on a position that is already open ---- */
let v = newSession({ id: 'v', name: 'attach', ticker: 'SPY', startCash: 25000, startDay: day, now: 0 });
v = advance(v, { day, minute: 20 }, 0);
v = place(v, { contract: spyCall, side: 'buy', qty: 2, kind: 'market' }, 0);
const vb = quoteAt(spyCall, day, 20).bid;
v = attach(v, spyCall, 'target', +(vb * 1.3).toFixed(2), 0);
v = attach(v, spyCall, 'stop', +(vb * 0.7).toFixed(2), 0);
const pair = v.orders.filter(o => o.status === 'working');
ok('dragged off the position: a target and a stop, one pair, for all that is held', pair.length === 2 && pair[0].oco === pair[1].oco && pair.every(o => o.qty === 2));
v = attach(v, spyCall, 'target', +(vb * 1.5).toFixed(2), 0);
ok('a second pull ADDS a target, with half the contracts (the ladder — its own checks are below)', v.orders.filter(o => o.status === 'working' && o.kind === 'limit').map(o => o.qty).join() === '1,1' && v.orders.filter(o => o.status === 'working').every(o => o.oco === pair[0].oco));
ok('a stop over the bid is not taken', attach(v, spyCall, 'stop', +(vb * 1.2).toFixed(2), 0) === v);

/* ---- a way out that waits on THE NAME'S price, not the contract's ---- */
/* a same-day call on a day the name later closes a minute 30 cents under where it stood at the buy */
const M0 = 30;
const dipDay = days.slice(-80).find(d => {
  const s0 = spotAt('SPY', d, M0);
  return expiriesAt('SPY', d).some(e => e.dte === 0) && dayBars('SPY', d).some((b, i) => i > M0 && b.close <= s0 - 0.3);
})!;
const s0 = spotAt('SPY', dipDay, M0);
const zero = { ticker: 'SPY', strike: Math.round(s0), right: 'C' as const, expiry: dipDay };
const level = +(s0 - 0.3).toFixed(2);
const hitAt = dayBars('SPY', dipDay).findIndex((b, i) => i > M0 && b.close <= level);
let w = newSession({ id: 'w', name: 'on the name', ticker: 'SPY', startCash: 25000, startDay: dipDay, now: 0 });
w = advance(w, { day: dipDay, minute: M0 }, 0);
ok('a stop on the name above where it stands is refused, in words', (refusal(w, { contract: zero, side: 'buy', qty: 1, kind: 'market', bracket: { stop: +(s0 + 1).toFixed(2), on: 'name' } }) ?? '').startsWith('The stop has to be below where SPY stands'));
w = place(w, { contract: zero, side: 'buy', qty: 1, kind: 'market', bracket: { stop: level, on: 'name' } }, 0);
const ns = w.orders.find(o => o.on === 'name')!;
ok('the stop that rides the buy waits on the name', !!ns && ns.kind === 'stop' && ns.price === level && ns.status === 'working');
ok('its planned risk is kept as a price of the contract', near(w.fills[0].plannedStop ?? -1, quoteWith(zero, dipDay, M0, level).bid));
w = advance(w, { day: dipDay, minute: hitAt - 1 }, 0);
ok('the clock alone does not set it off: it waits while the name is over its level', bookOf(w).positions.length === 1);
w = advance(w, { day: dipDay, minute: LAST_MIN }, 0);
const wf = w.fills[w.fills.length - 1];
ok('it sells the first minute the name closes at or under its level, at that minute\'s bid', wf.how === 'stop' && wf.at.minute === hitAt && wf.price === quoteAt(zero, dipDay, hitAt).bid, `minute ${hitAt} · ${wf.price}`);
ok('the record calls it stopped', bookOf(w).trades[0]?.how === 'stopped');

/* the same way out, turned from one into the other without moving its line */
let x = newSession({ id: 'x', name: 'rebase', ticker: 'SPY', startCash: 25000, startDay: day, now: 0 });
x = advance(x, { day, minute: 20 }, 0);
x = place(x, { contract: spyCall, side: 'buy', qty: 1, kind: 'market' }, 0);
const xt = +(vb * 1.3).toFixed(2);
x = attach(x, spyCall, 'target', xt, 0);
const xid = x.orders.find(o => o.status === 'working')!.id;
const xLevel = spotForBid(spyCall, day, 20, xt)!;
x = rebase(x, xid, 'name', 0);
ok('to the name: the level that gives its price this minute', x.orders.find(o => o.id === xid)!.on === 'name' && x.orders.find(o => o.id === xid)!.price === xLevel, `${xt} → SPY ${xLevel}`);
x = advance(x, { day, minute: 200 }, 0);
const still = x.orders.find(o => o.id === xid)!;
if (still.status === 'working') {
  ok('hours on, the level has not moved — what it would make has', still.price === xLevel && quoteWith(spyCall, day, 200, xLevel).bid < xt, `${xt} → ${quoteWith(spyCall, day, 200, xLevel).bid.toFixed(2)}`);
  x = rebase(x, xid, 'contract', 0);
  ok('and back: what the contract would bid there this minute', x.orders.find(o => o.id === xid)!.on === undefined && near(x.orders.find(o => o.id === xid)!.price!, quoteWith(spyCall, day, 200, xLevel).bid));
} else ok('(the name reached the level before the check — it sold at the bid)', still.status === 'filled' && x.fills[x.fills.length - 1].how === 'limit');
ok('a target on the name under where a call\'s name stands is not taken', attach(x, spyCall, 'target', +(spotAt('SPY', day, x.cursor.minute) - 2).toFixed(2), 0, 'name') === x || bookOf(x).positions.length === 0);

/* ---- a vertical spread, bought for a debit: one position, one price ---- */
/* THE SPREAD IS PICKED WHERE ITS MARKET IS ALIVE (2026-09-29): the tape's day is `days[-40]`, so it moves with the calendar,
   and on one day's tape the name slid two dollars between minute 10 and minute 25 — the 10-minute chain's ATM pair sat out
   of the money by 25 and its market was wider than the engine's rule allows (a 60% spread of the mark is no market), so the
   order was refused and the proof crashed on the missing position. The rule is right; the proof now takes the chain AT
   minute 25 and the first pair of neighbours whose market is alive. */
const sc25 = chainAt('SPY', day, 25, se, 3);
const spread = [3, 4, 2, 5, 1].map(i => ({ ...spyCall, strike: sc25.rows[i].strike, short: sc25.rows[i - 1].strike })).find(c => !quoteAt(c, day, 25).dead) ?? { ...spyCall, strike: sc25.rows[3].strike, short: sc25.rows[2].strike };
/** The spread's bought leg on its own */
const long = { ...spyCall, strike: spread.strike };
const width = spread.short - spread.strike;
const legA = quoteAt(long, day, 25);
const legB = quoteAt({ ...long, strike: spread.short }, day, 25);
const sqd = quoteAt(spread, day, 25);
ok('a spread is quoted at its natural prices: ask = bought ask − sold bid, bid = bought bid − sold ask', near(sqd.ask, legA.ask - legB.bid) && near(sqd.bid, legA.bid - legB.ask) && sqd.bid < sqd.ask, `${sqd.bid} / ${sqd.ask}`);
ok('it is never worth more than its width, wherever the name goes', quoteWith(spread, day, 25, 9999).ask <= width + 1e-9 && quoteWith(spread, day, 25, 1).bid === 0);
/* a spread's bid rises with the name and then falls away deep in the money: the level for a price is the NEAREST crossing */
const wide = { ...spyCall, short: sc.rows[0].strike };
const wantBid = +(quoteAt(wide, day, 25).bid + 0.2).toFixed(2);
const lvl = spotForBid(wide, day, 25, wantBid);
ok('where the name must stand for a spread to bid a little more: found, just above where it stands, and true', lvl != null && lvl > spotAt('SPY', day, 25) && lvl < spotAt('SPY', day, 25) * 1.02 && near(quoteWith(wide, day, 25, lvl).bid, wantBid, 0.02), `${contractWords(wide)} ${wantBid} → SPY ${lvl}`);
ok('a price past its width is out of reach', spotForBid(spread, day, 25, width + 0.5) === null);
let sp = newSession({ id: 'sp', name: 'spread', ticker: 'SPY', startCash: 25000, startDay: day, now: 0 });
sp = advance(sp, { day, minute: 25 }, 0);
ok('a spread sold for a credit is refused, in words', (refusal(sp, { contract: { ...spyCall, short: sc.rows[4].strike }, side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('A spread here is bought for a debit'));
sp = place(sp, { contract: spread, side: 'buy', qty: 2, kind: 'market' }, 0);
ok('it fills at its ask, as one position, with the fee on both legs', sp.fills.length === 1 && sp.fills[0].price === sqd.ask && near(sp.fills[0].fee, 0.65 * 2 * 2) && bookOf(sp).positions.length === 1);
ok('it is not the single contract: its own key, its own words', bookOf(sp).positions.length === 1 && bookOf(sp).positions[0].key !== contractKey(long) && contractWords(spread) === `SPY ${long.strike}/${spread.short}C`);
sp = advance(sp, { day: se, minute: LAST_MIN }, 0);
const spt = bookOf(sp).trades[0];
ok('held to the bell it settles at what it is worth in the money — between nothing and its width — and the most it lost is what it cost', !!spt && spt.how === 'expired' && spt.avgOut >= 0 && spt.avgOut <= width + 1e-9 && spt.pnl >= -spt.cost - 1e-6, `${spt?.avgOut} of ${width} · ${spt?.pnl.toFixed(2)}`);

/* ---- 16:00 has rung: the market is shut ---- */
let y = newSession({ id: 'y', name: 'the bell', ticker: 'SPY', startCash: 25000, startDay: day, now: 0 });
y = advance(y, { day, minute: LAST_MIN }, 0);
ok('a market order at the bell is refused, in words', (refusal(y, { contract: spyCall, side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('The market is shut'));
ok('a limit left at the bell is taken, and waits for the next open', refusal(y, { contract: spyCall, side: 'buy', qty: 1, kind: 'limit', price: 0.05 }) === null);

/* ---- two names, one clock, one account — and the reader's own rules, as hard blocks ---- */
let z = newSession({ id: 'z', name: 'two names', ticker: 'SPY', tickers: ['SPY', 'QQQ', 'IWM'], rules: { maxOpen: 2, maxRiskPct: 0.05, dailyLossPct: 0.02 }, startCash: 25000, startDay: day, now: 0 });
ok('a session holds two names at most', namesOf(z).join('+') === 'SPY+QQQ');
z = advance(z, { day, minute: 15 }, 0);
const qe = expiriesAt('QQQ', day).find(e => e.dte >= 5)!.iso;
const qRows = chainAt('QQQ', day, 15, qe, 3).rows;
const qqqCall = { ticker: 'QQQ', strike: qRows[3].strike, right: 'C' as const, expiry: qe };
const qqqCall2 = { ticker: 'QQQ', strike: qRows[2].strike, right: 'C' as const, expiry: qe };
ok('a contract of a name the session does not trade is refused', refusal(z, { contract: { ...spyCall, ticker: 'IWM' }, side: 'buy', qty: 1, kind: 'market' }) === 'This session trades SPY and QQQ');
const cash0 = cashOf(z);
z = place(z, { contract: spyCall, side: 'buy', qty: 1, kind: 'market' }, 0);
z = place(z, { contract: qqqCall, side: 'buy', qty: 1, kind: 'market' }, 0);
ok('both names trade on the one cash, at the one minute', bookOf(z).positions.length === 2 && z.fills.every(f => f.at.minute === 15) && near(cashOf(z), cash0 - (z.fills[0].price + z.fills[1].price) * MULT - 1.3));
ok('a third position is refused by the reader’s own rule, in words', refusal(z, { contract: qqqCall2, side: 'buy', qty: 1, kind: 'market' }) === 'Your session’s rule: no more than 2 positions open at once');
/* what the cap says, never what the other rules may: the risk rule can refuse the add on a day the contract is dear (the tape
   rolls a day every day, and forty sessions back is a different price each time) */
ok('adding to a contract already held is not a new position', !(refusal(z, { contract: spyCall, side: 'buy', qty: 1, kind: 'market' }) ?? '').includes('open at once'));
ok('a rule never stops a way out', refusal(z, { contract: qqqCall, side: 'sell', qty: 1, kind: 'market' }) === null);
z = place(z, { contract: qqqCall, side: 'sell', qty: 1, kind: 'market' }, 0);
z = place(z, { contract: qqqCall2, side: 'buy', qty: 1, kind: 'limit', price: 0.05 }, 0);
ok('a resting buy counts as the position it would open', refusal(z, { contract: qqqCall, side: 'buy', qty: 1, kind: 'market' }) === 'Your session’s rule: no more than 2 positions open at once');
const big = Math.ceil((accountOf(z).equity * 0.05) / (quoteAt(spyCall, day, 15).ask * MULT)) + 1;
ok('a trade that would cost more than the reader’s share of the account is refused', (refusal(z, { contract: spyCall, side: 'buy', qty: big, kind: 'market' }) ?? '').startsWith('Your session’s rule: no more than 5% of the account on one trade'));
/* the day's stop: a session whose one position has lost more than its limit since the open */
let dz = newSession({ id: 'dz', name: 'the day’s stop', ticker: 'SPY', rules: { dailyLossPct: 0.0001 }, startCash: 25000, startDay: day, now: 0 });
dz = advance(dz, { day, minute: 15 }, 0);
dz = place(dz, { contract: spyCall, side: 'buy', qty: 5, kind: 'market' }, 0);
ok('down past the day’s stop (the spread and the fee alone do it here): the day is over', dayStateOf(dz).stopped && dayStateOf(dz).pct < 0, `${(dayStateOf(dz).pct * 100).toFixed(3)}%`);
ok('…no new position, in words — and still a way out', (refusal(dz, { contract: qqqCall, side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('This session trades SPY') && (refusal(dz, { contract: { ...spyCall, strike: spyCall.strike + 1 }, side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('Your session’s rule: down') && refusal(dz, { contract: spyCall, side: 'sell', qty: 5, kind: 'market' }) === null);
dz = place(dz, { contract: spyCall, side: 'sell', qty: 5, kind: 'market' }, 0);
dz = advance(dz, { day: nextDay(day)!, minute: 5 }, 0);
ok('the stop lifts at the next open: the day is measured from what the account was worth then', !dayStateOf(dz).stopped && near(equityAtOpen(dz), cashOf(dz)));
ok('a report of two names cuts by name', cutsOf(bookOf(z).trades.concat(bookOf(dz).trades)).some(c => c.title === 'By name' && c.rows.length === 2));

/* ==== A LADDER OF WAYS OUT (docs/review-backtest-rules.md) ==== */
ok('contracts are shared out with the nearer level taking the odd one', splitQty(5, 2).join() === '3,2' && splitQty(4, 3).join() === '2,1,1' && splitQty(1, 3).join() === '1' && splitQty(6, 3).join() === '2,2,2');
{
  /* a day and a minute where the contract's bid LATER stands 4% over what is paid — so a first target set under that is hit */
  let pick: { d: string; hit: number; ask: number } | null = null;
  for (const d of days.slice(-60)) {
    const ex = expiriesAt('SPY', d).find(x => x.dte >= 5);
    if (!ex) continue;
    const c = { ticker: 'SPY', strike: chainAt('SPY', d, 10, ex.iso, 3).rows[3].strike, right: 'C' as const, expiry: ex.iso };
    const ask = quoteAt(c, d, 10).ask;
    let hit = -1;
    let low = Infinity;
    for (let m = 11; m <= LAST_MIN; m++) {
      const b = quoteAt(c, d, m).bid;
      low = Math.min(low, b);
      if (b >= ask * 1.04) {
        hit = m;
        break;
      }
    }
    if (hit > 0 && low > ask * 0.75) {
      pick = { d, hit, ask };
      break;
    }
  }
  ok('the tape has a morning that runs 4% (the ladder’s stage)', !!pick, pick ? `${pick.d} minute ${pick.hit}` : '');
  if (pick) {
    const ex = expiriesAt('SPY', pick.d).find(x => x.dte >= 5)!.iso;
    const c = { ticker: 'SPY', strike: chainAt('SPY', pick.d, 10, ex, 3).rows[3].strike, right: 'C' as const, expiry: ex };
    const T1 = +(pick.ask * 1.03).toFixed(2);
    const T2 = +(pick.ask * 3).toFixed(2);
    const S = +(pick.ask * 0.6).toFixed(2);
    let L = advance(newSession({ id: 'L', name: 'ladder', ticker: 'SPY', startCash: 50000, startDay: pick.d, now: 0 }), { day: pick.d, minute: 10 }, 0);
    ok('four targets are one too many, in words', refusal(L, { contract: c, side: 'buy', qty: 4, kind: 'market', bracket: { targets: [1.1, 1.2, 1.3, 1.4].map(k => ({ price: +(pick!.ask * k).toFixed(2), qty: 1 })) } }) === 'No more than three targets');
    ok('the targets cannot speak for more contracts than the order buys', refusal(L, { contract: c, side: 'buy', qty: 2, kind: 'market', bracket: { targets: [{ price: T1, qty: 2 }, { price: T2, qty: 1 }] } }) === 'The targets speak for more contracts than the order has');
    ok('every target has to be above what is paid', refusal(L, { contract: c, side: 'buy', qty: 2, kind: 'market', bracket: { targets: [{ price: T1, qty: 1 }, { price: S, qty: 1 }] } }) === 'Every target has to be above what you pay');
    ok('breakeven needs a target and a stop', refusal(L, { contract: c, side: 'buy', qty: 2, kind: 'market', bracket: { stop: S, breakeven: true } }) === 'Breakeven moves the stop when the first target fills — it needs both');
    L = place(L, { contract: c, side: 'buy', qty: 4, kind: 'market', bracket: { targets: [{ price: T1, qty: 2 }, { price: T2, qty: 2 }], stops: [{ price: S, qty: 4 }], breakeven: true } }, 0);
    const rungs = () => L.orders.filter(o => o.status === 'working' && o.side === 'sell');
    ok('two targets and a stop ride the buy, as ONE group', rungs().length === 3 && new Set(rungs().map(o => o.oco)).size === 1 && rungs().filter(o => o.kind === 'limit').map(o => o.qty).join() === '2,2' && rungs().find(o => o.kind === 'stop')!.qty === 4);
    ok('a sell that WAITS finds every contract spoken for — once, not twice', refusal(L, { contract: c, side: 'sell', qty: 1, kind: 'limit', price: T2 }) === 'Those contracts are already spoken for by a working order');
    ok('a market sell by hand is never spoken for', refusal(L, { contract: c, side: 'sell', qty: 1, kind: 'market' }) === null && refusal(L, { contract: c, side: 'sell', qty: 5, kind: 'market' }) === 'You hold 4');
    const paid = bookOf(L).positions[0].avg;
    L = advance(L, { day: pick.d, minute: pick.hit }, 0);
    const stop = rungs().find(o => o.kind === 'stop')!;
    ok('the first target fills: two are sold, and the stop gives up those two', bookOf(L).positions[0]?.qty === 2 && stop.qty === 2 && rungs().filter(o => o.kind === 'limit').length === 1);
    ok('BREAKEVEN: the stop moved to what was paid, once, and says when', stop.price === paid && stop.moved?.minute === pick.hit && !stop.breakeven, `${S} → ${stop.price}`);
    ok('RP&L: the two sold are banked on the clock’s day, the two left are open — and the two add up to the account', bankedOf(L, 'SPY') > 0 && bankedOf(L, 'SPY', pick.d) === 0 && near(bankedOf(L, 'SPY') + accountOf(L).openPnl, accountOf(L).equity - 50000, 0.02), `banked ${bankedOf(L, 'SPY')}`);
    L = place(L, { contract: c, side: 'sell', qty: 1, kind: 'market' }, 0);
    ok('one sold by hand: the ladder gives way — the far target and the stop give up one each', rungs().every(o => o.qty === 1) && rungs().length === 2);
    L = place(L, { contract: c, side: 'sell', qty: 1, kind: 'market' }, 0);
    const lt = bookOf(L).trades[0];
    ok('flat: everything that was working on it goes', rungs().length === 0 && L.orders.filter(o => o.why === 'the position was closed').length === 2);
    ok('it ended SCALED OUT, and the record keeps each piece', lt?.how === 'scaled' && lt.legs.filter(l => l.side === 'sell').map(l => `${l.qty}${l.out}`).join() === '2target,1hand,1hand');
    ok('the pieces add up to what the trade made', near(lt.legs.reduce((a, l) => a + (l.side === 'sell' ? 1 : -1) * l.price * MULT * l.qty - l.fee, 0), lt.pnl, 0.02), lt.pnl.toFixed(2));
    ok('closed, RP&L is the whole trade', near(bankedOf(L, 'SPY'), lt.pnl, 0.011), `${bankedOf(L, 'SPY')} · ${lt.pnl}`);

    /* two stops: a target's fill takes its contracts from the FURTHEST stop first */
    let W = advance(newSession({ id: 'W', name: 'two stops', ticker: 'SPY', startCash: 50000, startDay: pick.d, now: 0 }), { day: pick.d, minute: 10 }, 0);
    W = place(W, { contract: c, side: 'buy', qty: 4, kind: 'market', bracket: { targets: [{ price: T1, qty: 2 }], stops: [{ price: +(pick.ask * 0.7).toFixed(2), qty: 2 }, { price: S, qty: 2 }] } }, 0);
    W = advance(W, { day: pick.d, minute: pick.hit }, 0);
    const left = W.orders.filter(o => o.status === 'working' && o.kind === 'stop');
    ok('…the far stop is the one that goes; the near one keeps its two', left.length === 1 && left[0].price === +(pick.ask * 0.7).toFixed(2) && left[0].qty === 2 && W.orders.some(o => o.price === S && o.why === 'its pair filled'));

    /* a TRAILING stop: checked first, then moved; never back */
    let R = advance(newSession({ id: 'R', name: 'trail', ticker: 'SPY', startCash: 50000, startDay: pick.d, now: 0 }), { day: pick.d, minute: 10 }, 0);
    R = place(R, { contract: c, side: 'buy', qty: 2, kind: 'market', bracket: { stop: +(pick.ask * 0.9).toFixed(2), trail: true } }, 0);
    const armed = R.orders.find(o => o.kind === 'stop')!;
    ok('armed to trail: it keeps the distance it was set at from the bid', near(armed.trail ?? 0, quoteAt(c, pick.d, 10).bid - armed.price!, 0.011) && armed.peak === quoteAt(c, pick.d, 10).bid);
    let before = armed.price!;
    let never = true;
    let best = armed.peak!;
    let checkedFirst = true;
    for (let m = 11; m <= LAST_MIN && bookOf(R).positions.length; m++) {
      R = advance(R, { day: pick.d, minute: m }, 0);
      const o = R.orders.find(x => x.id === armed.id)!;
      if (o.status === 'filled') {
        /* it sold where it stood BEFORE this minute's price could move it */
        checkedFirst = quoteAt(c, pick.d, m).bid <= before + 1e-9;
        break;
      }
      if (o.price! < before - 1e-9) never = false;
      best = Math.max(best, quoteAt(c, pick.d, m).bid);
      before = o.price!;
    }
    ok('it followed the best bid up at its distance, and never moved back', never && near(before, Math.max(armed.price!, +(best - armed.trail!).toFixed(2)), 0.011), `${armed.price} → ${before} · best bid ${best.toFixed(2)}`);
    ok('when it sold, it sold where it stood before that minute moved it', checkedFirst);
    let sw = attach(advance(place(advance(newSession({ id: 'sw', name: 'switch', ticker: 'SPY', startCash: 50000, startDay: pick.d, now: 0 }), { day: pick.d, minute: 10 }, 0), { contract: c, side: 'buy', qty: 1, kind: 'market' }, 0), { day: pick.d, minute: 11 }, 0), c, 'stop', S, 0);
    const swId = sw.orders.find(o => o.kind === 'stop')!.id;
    sw = setTrail(sw, swId, true, 0);
    ok('the switch on a working stop: trailing on, then off', sw.orders.find(o => o.id === swId)!.trail! > 0 && setTrail(sw, swId, false, 0).orders.find(o => o.id === swId)!.trail === undefined);
    ok('breakeven is the ladder’s: armed on every stop of the group', setBreakeven(sw, swId, true, 0).orders.filter(o => o.kind === 'stop' && o.status === 'working').every(o => o.breakeven));

    /* ---- TYPED COUNTS (2026-09-21): a target for two of four, the rest run ---- */
    let Q = advance(newSession({ id: 'Q', name: 'counts', ticker: 'SPY', startCash: 50000, startDay: pick.d, now: 0 }), { day: pick.d, minute: 10 }, 0);
    ok('a count of nothing is refused in words', refusal(Q, { contract: c, side: 'buy', qty: 4, kind: 'market', bracket: { targets: [{ price: T1, qty: 0 }] } }) === 'Every target needs a whole number of contracts');
    Q = place(Q, { contract: c, side: 'buy', qty: 4, kind: 'market', bracket: { targets: [{ price: T1, qty: 2 }], stops: [{ price: S, qty: 4 }] } }, 0);
    ok('a target for two of four rides the buy; the stop for all four', Q.orders.filter(o => o.status === 'working' && o.kind === 'limit').map(o => o.qty).join() === '2' && Q.orders.find(o => o.status === 'working' && o.kind === 'stop')!.qty === 4);
    Q = advance(Q, { day: pick.d, minute: pick.hit }, 0);
    ok('it fills two; two run on, and the stop now speaks for those two', bookOf(Q).positions[0]?.qty === 2 && Q.orders.find(o => o.status === 'working' && o.kind === 'stop')!.qty === 2 && Q.orders.filter(o => o.status === 'working' && o.kind === 'limit').length === 0);

    /* ---- A TYPED TRAILING DISTANCE (2026-09-21) ---- */
    let Y = advance(newSession({ id: 'Y', name: 'trail by', ticker: 'SPY', startCash: 50000, startDay: pick.d, now: 0 }), { day: pick.d, minute: 10 }, 0);
    ok('a trailing distance of nothing is refused', refusal(Y, { contract: c, side: 'buy', qty: 1, kind: 'market', bracket: { stop: S, trail: true, trailBy: 0 } }) === 'Trail by a distance above nothing');
    Y = place(Y, { contract: c, side: 'buy', qty: 2, kind: 'market', bracket: { stop: S, trail: true, trailBy: 0.3 } }, 0);
    const ty = Y.orders.find(o => o.kind === 'stop')!;
    ok('the stop trails by the distance TYPED, not the distance it stands at', near(ty.trail ?? 0, 0.3) && ty.price === S && ty.peak === quoteAt(c, pick.d, 10).bid, `${ty.trail} from ${ty.price}`);
    Y = advance(Y, { day: pick.d, minute: 12 }, 0);
    const ty2 = Y.orders.find(o => o.id === ty.id)!;
    ok('…and is drawn in to that distance on the next minutes, never below where it was', ty2.status !== 'working' || (ty2.price! >= S && near(ty2.price!, Math.max(S, +(ty2.peak! - 0.3).toFixed(2)))), `${S} → ${ty2.price} · peak ${ty2.peak}`);
    if (ty2.status === 'working') {
      const dragged = amend(Y, ty.id, +(quoteAt(c, pick.d, 12).bid * 0.9).toFixed(2), 0).orders.find(o => o.id === ty.id)!;
      ok('a trailing stop DRAGGED keeps its new distance', near(dragged.trail ?? 0, quoteAt(c, pick.d, 12).bid - dragged.price!, 0.011), `${dragged.trail}`);
      const typed = setTrail(Y, ty.id, true, 0, 0.5).orders.find(o => o.id === ty.id)!;
      ok('the switch takes a typed distance too', near(typed.trail ?? 0, 0.5) && typed.price === ty2.price);
    }
  }
}
{
  /* on the chart: a further pull adds a level */
  let A = advance(newSession({ id: 'A', name: 'pulls', ticker: 'SPY', startCash: 50000, startDay: day, now: 0 }), { day, minute: 20 }, 0);
  A = place(A, { contract: spyCall, side: 'buy', qty: 4, kind: 'market' }, 0);
  const b = quoteAt(spyCall, day, 20).bid;
  const px = (k: number) => +(b * k).toFixed(2);
  const sizes = (kind: 'limit' | 'stop') => A.orders.filter(o => o.status === 'working' && o.kind === kind).sort((x, y) => x.price! - y.price!).map(o => o.qty).join();
  ok('nothing on it yet: a pull of either kind would be the first', ladderRoom(A, spyCall).target === 'first' && ladderRoom(A, spyCall).stop === 'first');
  A = attach(A, spyCall, 'target', px(1.3), 0);
  ok('the first target speaks for all four', sizes('limit') === '4' && ladderRoom(A, spyCall).target === 'more');
  A = attach(A, spyCall, 'target', px(1.5), 0);
  ok('a second pull ADDS a target: half of the first one’s contracts', sizes('limit') === '2,2');
  A = attach(A, spyCall, 'target', px(1.7), 0);
  ok('a third takes half of the biggest — the furthest, where they tie', sizes('limit') === '2,1,1' && ladderRoom(A, spyCall).target === null);
  ok('a fourth is not taken: three targets is the ladder', attach(A, spyCall, 'target', px(1.9), 0) === A);
  A = attach(A, spyCall, 'stop', px(0.7), 0);
  A = attach(A, spyCall, 'stop', px(0.5), 0);
  ok('two stops, half each — and a third is not taken', sizes('stop') === '2,2' && attach(A, spyCall, 'stop', px(0.4), 0) === A && new Set(A.orders.filter(o => o.status === 'working').map(o => o.oco)).size === 1);
  A = cancel(A, A.orders.find(o => o.status === 'working' && o.kind === 'limit' && o.price === px(1.5))!.id, 0);
  A = attach(A, spyCall, 'target', px(1.4), 0);
  ok('a level taken off leaves its contracts uncovered; the next pull takes THOSE', sizes('limit') === '2,1,1' && A.orders.some(o => o.status === 'working' && o.price === px(1.4)));
  let one = advance(newSession({ id: 'one', name: 'one', ticker: 'SPY', startCash: 50000, startDay: day, now: 0 }), { day, minute: 20 }, 0);
  one = attach(place(one, { contract: spyCall, side: 'buy', qty: 1, kind: 'market' }, 0), spyCall, 'target', px(1.3), 0);
  ok('one contract: there is nothing to split', ladderRoom(one, spyCall).target === null && attach(one, spyCall, 'target', px(1.5), 0) === one);
}

const st = statsOf([...trades, bt]);
ok('the report adds up', st.n === 2 && near(st.net, trades[0].pnl + bt.pnl, 0.02) && st.winRate >= 0 && st.winRate <= 1, `net ${st.net.toFixed(2)} · win ${Math.round(st.winRate * 100)}% · drawdown ${st.maxDrawdown.toFixed(2)}`);

console.log(misses ? `\n${misses} MISSED` : '\nall rules hold');
process.exit(misses ? 1 : 0);
