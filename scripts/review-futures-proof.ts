/*
  REVIEW · THE FUTURES ENGINE'S PROOF — `npx tsx scripts/review-futures-proof.ts` (run with `npm run review:proof`)
  The rules page (docs/review-futures-rules.md), checked against the engine, off the browser. Exits 1 on a miss.
*/
import { futAccountOf, futAdvance, futAmend, futAttach, futBankedOf, futBookOf, futCutsOf, futDayStateOf, futLadderRoom, futPlace, futRefusal, futSetBreakeven, futSetTrail, newFutSession, type FutSession } from '../src/data/review/futuresEngine';
import { FUT_DAY_MIN, FUT_LAST_MIN, FUT_RTH_OPEN_MIN, frontContract, futBarAt, futBarTime, futClockWords, futDayBars, futPriceAt, futProduct, onTick } from '../src/data/review/futuresTape';
import { nextDay, tapeDays } from '../src/data/review/tape';
import { statsOf } from '../src/data/review/engine';

let misses = 0;
const ok = (what: string, pass: boolean, detail = '') => {
  if (!pass) misses++;
  console.log(`${pass ? 'ok  ' : 'MISS'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number, eps = 0.011) => Math.abs(a - b) <= eps;
const ny = (t: number) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t * 1000));

/* ---- the tape ---- */
const days = tapeDays();
const day = days[days.length - 40];
const es = futProduct('ES');
const bars = futDayBars('ES', day);
ok('a trading day is 1,380 minutes', bars.length === FUT_DAY_MIN);
ok('it opens at 18:00 New York the evening before and ends at 17:00', ny(bars[0].time).endsWith('18:00') && ny(bars[FUT_LAST_MIN].time).endsWith('16:59') && futClockWords(FUT_LAST_MIN) === '17:00', `${ny(bars[0].time)} → ${ny(bars[FUT_LAST_MIN].time)}`);
ok('18:00 on both sides of a clock change', days.every(d => ny(futBarTime(d, 0)).endsWith('18:00')));
ok('09:30 is where the rules page says it is', ny(futBarTime(day, FUT_RTH_OPEN_MIN)).endsWith('09:30'));
ok('the same day twice is the same day', futDayBars('ES', day).every((b, i) => b.close === bars[i].close));
ok('every price is on the tick', bars.every(b => [b.open, b.high, b.low, b.close].every(v => near((v / es.tick) % 1, 0, 1e-6) || near((v / es.tick) % 1, 1, 1e-6))));
ok('the night is quieter than the day session', (() => { const range = (a: number, b: number) => bars.slice(a, b).reduce((x, y) => x + (y.high - y.low), 0) / (b - a); return range(0, 480) < range(930, 1320); })());
ok('a micro is its big brother\'s price', futDayBars('MES', day).every((b, i) => b.close === bars[i].close));
ok('the tape ends on today\'s quote', near(futDayBars('ES', days[days.length - 1])[FUT_LAST_MIN].close, es.px, es.tick));
ok('the front month has a name, and it changes on a roll', /^ES[HMUZ]\d$/.test(frontContract('ES', day)) && new Set(days.map(d => frontContract('ES', d))).size >= 3, frontContract('ES', day));

/* ---- a way in, long: a market order, a tick against you ---- */
const M = FUT_RTH_OPEN_MIN + 10;
const open = (rules?: FutSession['rules'], tickers = ['ES']) => futAdvance(newFutSession({ id: 'f', name: 'proof', tickers, rules, startCash: 25000, startDay: day, now: 0 }), { day, minute: M }, 0);
let s = open();
const last = futPriceAt('ES', day, M);
s = futPlace(s, { symbol: 'ES', side: 'buy', qty: 2, kind: 'market' }, 0);
ok('a market buy fills on the minute, one tick over the close', s.fills.length === 1 && s.fills[0].price === last + es.tick && s.fills[0].at.minute === M);
const a0 = futAccountOf(s);
ok('margin is set aside, not the contract\'s worth', a0.marginHeld === es.margin * 2 && near(a0.free, a0.equity - es.margin * 2));
ok('it starts behind by the tick and the fee', near(a0.openPnl, -es.tick * es.pointValue * 2 - es.fee * 2), a0.openPnl.toFixed(2));
ok('a sell bigger than the position is a REVERSAL, not a refusal (its own checks below)', futRefusal(s, { symbol: 'ES', side: 'sell', qty: 3, kind: 'market' }) === null);
ok('an order the free money cannot margin is refused, in words', (futRefusal(s, { symbol: 'ES', side: 'buy', qty: 40, kind: 'market' }) ?? '').startsWith('Not enough free money to margin this'));
ok('a product the session does not trade is refused', futRefusal(s, { symbol: 'NQ', side: 'buy', qty: 1, kind: 'market' }) === 'This session trades ES');
s = futPlace(s, { symbol: 'ES', side: 'sell', qty: 2, kind: 'market' }, 0);
const t0 = futBookOf(s).trades[0];
ok('out at the market, a tick under: the round trip costs two ticks and two fees', futBookOf(s).positions.length === 0 && near(t0.pnl, -2 * es.tick * es.pointValue * 2 - es.fee * 4), t0.pnl.toFixed(2));
ok('a trade with no stop has no R', t0.risk === null && t0.r === null);
ok('cash is the start, what was made or lost, less the fees', near(futAccountOf(s).cash, 25000 + t0.pnl));

/* ---- short, with a target and a stop riding it ---- */
let sh = open();
const ref = futPriceAt('ES', day, M);
ok('a short\'s stop has to be above where it gets in', futRefusal(sh, { symbol: 'ES', side: 'sell', qty: 1, kind: 'market', bracket: { stop: ref - 5 } }) === 'The stop has to be above where you get in');
sh = futPlace(sh, { symbol: 'ES', side: 'sell', qty: 1, kind: 'market', bracket: { target: ref - 8, stop: ref + 6 } }, 0);
const pair = sh.orders.filter(o => o.status === 'working');
ok('sell to open: a short, with its pair working on the BUY side as ways out', futBookOf(sh).positions[0]?.long === false && pair.length === 2 && pair.every(o => o.side === 'buy' && o.exit && o.oco === pair[0].oco));
ok('its planned risk is entry to stop', near(futAccountOf(sh).positions[0].plannedStop ?? 0, ref + 6));
let d: string | null = day;
for (let i = 0; i < 6 && d && futBookOf(sh).positions.length; i++) {
  sh = futAdvance(sh, { day: d, minute: FUT_LAST_MIN }, 0);
  d = nextDay(d);
}
const st = futBookOf(sh).trades[0];
if (st) {
  const f = sh.fills[sh.fills.length - 1];
  ok('one of the pair took it out, and the other is gone', (st.how === 'target' || st.how === 'stopped' || st.how === 'rolled') && sh.orders.every(o => o.status !== 'working'), st.how);
  ok('a stop fills a tick worse than its price (or the open, on a gap); a target at its price', st.how === 'stopped' ? f.price >= ref + 6 + es.tick - 1e-9 : st.how === 'target' ? f.price === ref - 8 : true, `${st.how} at ${f.price}`);
  ok('a short makes money when it falls: P&L is (in − out) × the point, less the fees', near(st.pnl, (st.avgIn - st.avgOut) * es.pointValue - es.fee * 2, 0.02), st.pnl.toFixed(2));
  ok('1R is the planned risk: R = pnl / (entry to stop)', st.r != null && near(st.r, st.pnl / ((ref + 6 - st.avgIn) * es.pointValue), 1e-6), `${st.r?.toFixed(2)}R`);
} else ok('(the pair was still working after six days)', futBookOf(sh).positions.length === 1);

/* ---- a bar cannot say which came first: the stop is taken ---- */
const wideAt = futDayBars('ES', day).findIndex((b, i) => i > M + 5 && b.high - b.low >= 4 * es.tick);
let both = futAdvance(newFutSession({ id: 'b', name: 'same minute', tickers: ['ES'], startCash: 25000, startDay: day, now: 0 }), { day, minute: wideAt - 1 }, 0);
const wb = futBarAt('ES', day, wideAt)!;
const inAt = futPriceAt('ES', day, wideAt - 1);
both = futPlace(both, { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' }, 0);
both = futAttach(both, 'ES', 'target', Math.max(inAt + es.tick * 2, wb.high - es.tick), 0);
both = futAttach(both, 'ES', 'stop', Math.min(inAt - es.tick, wb.low + es.tick), 0);
const armed = both.orders.filter(o => o.status === 'working').length;
both = futAdvance(both, { day, minute: wideAt }, 0);
ok('a target and a stop inside one minute: the stop is the one taken', armed < 2 || futBookOf(both).trades[0]?.how === 'stopped', armed < 2 ? 'the pair could not both be set on this bar' : futBookOf(both).trades[0]?.how);

/* ---- a limit fills only when traded THROUGH ---- */
let lim = open();
const lowAhead = Math.min(...futDayBars('ES', day).slice(M + 1, M + 120).map(b => b.low));
lim = futPlace(lim, { symbol: 'ES', side: 'buy', qty: 1, kind: 'limit', price: lowAhead }, 0);
lim = futAdvance(lim, { day, minute: M + 119 }, 0);
ok('a limit the market only TOUCHED does not fill', lim.fills.length === 0 && lim.orders[0].status === 'working');
let lim2 = open();
lim2 = futPlace(lim2, { symbol: 'ES', side: 'buy', qty: 1, kind: 'limit', price: lowAhead + es.tick }, 0);
lim2 = futAdvance(lim2, { day, minute: M + 119 }, 0);
ok('a tick higher, it was traded through: filled at its price', lim2.fills.length === 1 && lim2.fills[0].price === lowAhead + es.tick && lim2.fills[0].how === 'limit');
ok('a stop is a way in too: a buy stop above the price is taken (2026-09-21; its own checks below)', futRefusal(open(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'stop', price: last + 10 }) === null);

/* ---- the shut market, the day, the roll ---- */
const shut = futAdvance(open(), { day, minute: FUT_LAST_MIN }, 0);
ok('at 17:00 a market order is refused; one that waits is taken', (futRefusal(shut, { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('The market is shut until 18:00') && futRefusal(shut, { symbol: 'ES', side: 'buy', qty: 1, kind: 'limit', price: last - 50 }) === null);
const rollDay = days.find((dd, i) => i > 0 && i < days.length - 1 && frontContract('ES', days[i + 1]) !== frontContract('ES', dd))!;
let rl = futAdvance(newFutSession({ id: 'r', name: 'the roll', tickers: ['ES'], startCash: 25000, startDay: rollDay, now: 0 }), { day: rollDay, minute: M }, 0);
rl = futPlace(rl, { symbol: 'ES', side: 'buy', qty: 1, kind: 'market', bracket: { stop: futPriceAt('ES', rollDay, M) - 400 } }, 0);
rl = futAdvance(rl, { day: nextDay(rollDay)!, minute: 5 }, 0);
const rt = futBookOf(rl).trades[0];
ok('a position is not carried through its contract\'s roll: closed in the old month\'s last minute, and it says so', !!rt && rt.how === 'rolled' && rt.closed.day === rollDay && rt.closed.minute === FUT_LAST_MIN && rl.orders.every(o => o.status !== 'working'), `${frontContract('ES', rollDay)} → ${frontContract('ES', nextDay(rollDay)!)}`);

/* ---- the reader's own rules ---- */
let ru = open({ maxOpen: 1, maxRiskPct: 0.01, dailyLossPct: 0.02 }, ['ES', 'NQ']);
ok('the risk rule needs a stop on the order', (futRefusal(ru, { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' }) ?? '').includes('that needs a stop on the order'));
ok('…and refuses more at risk than the reader\'s share', (futRefusal(ru, { symbol: 'ES', side: 'buy', qty: 1, kind: 'market', bracket: { stop: last - 20 } }) ?? '').startsWith('Your session’s rule: no more than 1% of the account at risk'));
ru = futPlace(ru, { symbol: 'ES', side: 'buy', qty: 1, kind: 'market', bracket: { stop: last - 4 } }, 0);
ok('inside it, the order is taken', futBookOf(ru).positions.length === 1);
ok('a second position is refused by the reader\'s own rule — and a way out never is', futRefusal(ru, { symbol: 'NQ', side: 'buy', qty: 1, kind: 'market', bracket: { stop: futPriceAt('NQ', day, M) - 10 } }) === 'Your session’s rule: no more than 1 position open at once' && futRefusal(ru, { symbol: 'ES', side: 'sell', qty: 1, kind: 'market' }) === null);
let ds = open({ dailyLossPct: 0.0001 });
ds = futPlace(ds, { symbol: 'ES', side: 'buy', qty: 3, kind: 'market' }, 0);
ok('down past the day\'s stop: no new position, and still a way out', futDayStateOf(ds).stopped && (futRefusal(ds, { symbol: 'ES', side: 'buy', qty: 1, kind: 'market' }) ?? '').startsWith('Your session’s rule: down') && futRefusal(ds, { symbol: 'ES', side: 'sell', qty: 3, kind: 'market' }) === null);

/* ---- the report ---- */
const all = [...futBookOf(s).trades, ...futBookOf(sh).trades, ...futBookOf(rl).trades];
const stats = statsOf(all);
ok('the report adds up, and R is taken over the trades that have one', stats.n === all.length && near(stats.net, all.reduce((x, t) => x + t.pnl, 0), 0.02), `net ${stats.net.toFixed(2)} · ${all.filter(t => t.r != null).length} of ${all.length} with an R`);
ok('the cuts are the futures\' own: long against short, when it was entered, how it ended', futCutsOf(all).some(c => c.title === 'Long against short') && futCutsOf(all).some(c => c.title === 'How it ended'));

/* ==== A LADDER OF WAYS OUT (docs/review-futures-rules.md) ==== */
{
  const base = () => futAdvance(newFutSession({ id: 'L', name: 'ladder', tickers: ['ES'], startCash: 100000, startDay: day, now: 0 }), { day, minute: M }, 0);
  const at = futPriceAt('ES', day, M);
  /* the first minute after M whose high trades through +2 points, with nothing under −30 before it */
  let hit = -1;
  for (let m = M + 1; m <= FUT_LAST_MIN; m++) {
    const b = futBarAt('ES', day, m)!;
    if (b.low <= at - 30) break;
    if (b.high >= at + es.tick + 2 + es.tick) {
      hit = m;
      break;
    }
  }
  ok('the tape trades two points up before thirty down (the ladder’s stage)', hit > 0, `minute ${hit}`);
  let L = base();
  ok('three stops are one too many, in words', futRefusal(L, { symbol: 'ES', side: 'buy', qty: 3, kind: 'market', bracket: { stops: [at - 5, at - 10, at - 15].map(price => ({ price, qty: 1 })) } }) === 'No more than two stops');
  ok('every stop has to be on the right side of the way in', futRefusal(L, { symbol: 'ES', side: 'buy', qty: 2, kind: 'market', bracket: { stops: [{ price: at - 5, qty: 1 }, { price: at + 5, qty: 1 }] } }) === 'Every stop has to be below where you get in');
  L = futPlace(L, { symbol: 'ES', side: 'buy', qty: 4, kind: 'market', bracket: { targets: [{ price: at + 2 + es.tick, qty: 2 }, { price: at + 400, qty: 2 }], stops: [{ price: at - 30, qty: 4 }], breakeven: true } }, 0);
  const exits = () => L.orders.filter(o => o.status === 'working' && o.exit);
  const entry = futBookOf(L).positions[0].avg;
  ok('two targets and a stop ride the entry, as one group, on the SELL side', exits().length === 3 && new Set(exits().map(o => o.oco)).size === 1 && exits().every(o => o.side === 'sell'));
  ok('its planned risk is the stop’s, for all four', near(futAccountOf(L).positions[0].plannedStop ?? 0, at - 30));
  ok('a way out that waits finds the contracts spoken for; one at the market never does', futRefusal(L, { symbol: 'ES', side: 'sell', qty: 1, kind: 'limit', price: at + 50 }) === 'Those contracts are already spoken for by a working order' && futRefusal(L, { symbol: 'ES', side: 'sell', qty: 1, kind: 'market' }) === null);
  L = futAdvance(L, { day, minute: hit }, 0);
  const stop = exits().find(o => o.kind === 'stop')!;
  ok('the first target fills two; the stop gives up those two', futBookOf(L).positions[0]?.qty === 2 && stop.qty === 2 && exits().filter(o => o.kind === 'limit').length === 1);
  ok('BREAKEVEN: the stop moved to the average entry, once', stop.price === entry && stop.moved?.minute === hit && !stop.breakeven, `${at - 30} → ${stop.price}`);
  ok('RP&L: the two taken off are banked on the clock’s day, the two left are open — and the two add up to the account', futBankedOf(L, 'ES') > 0 && futBankedOf(L, 'ES', day) === 0 && near(futBankedOf(L, 'ES') + futAccountOf(L).openPnl, futAccountOf(L).equity - 100000, 0.02), `banked ${futBankedOf(L, 'ES')}`);
  L = futPlace(L, { symbol: 'ES', side: 'sell', qty: 1, kind: 'market' }, 0);
  ok('one taken out by hand: the ladder gives way', exits().every(o => o.qty === 1) && exits().length === 2);
  L = futPlace(L, { symbol: 'ES', side: 'sell', qty: 1, kind: 'market' }, 0);
  const lt = futBookOf(L).trades[0];
  ok('flat: everything goes — and it ended SCALED OUT, each piece kept', exits().length === 0 && lt?.how === 'scaled' && lt.legs.filter(l => l.exit).map(l => `${l.qty}${l.out}`).join() === '2target,1hand,1hand');
  ok('the pieces add up to what the trade made', near(lt.legs.reduce((a, l) => a + (l.exit ? 1 : -1) * l.price * es.pointValue * l.qty * (lt.long ? 1 : -1) - l.fee, 0), lt.pnl, 0.02), lt.pnl.toFixed(2));
  ok('closed, RP&L is the whole trade', near(futBankedOf(L, 'ES'), lt.pnl, 0.011), `${futBankedOf(L, 'ES')} · ${lt.pnl}`);

  /* the risk rule reads EVERY stop, and needs them to cover every contract */
  const ruled = futAdvance(newFutSession({ id: 'r', name: 'rule', tickers: ['ES'], rules: { maxRiskPct: 0.02 }, startCash: 100000, startDay: day, now: 0 }), { day, minute: M }, 0);
  ok('stops that leave a contract uncovered do not satisfy the risk rule', (futRefusal(ruled, { symbol: 'ES', side: 'buy', qty: 2, kind: 'market', bracket: { stops: [{ price: at - 5, qty: 1 }] } }) ?? '').includes('the stops to cover every contract'));
  ok('…two stops that cover it do, and their risks are added', futRefusal(ruled, { symbol: 'ES', side: 'buy', qty: 2, kind: 'market', bracket: { stops: [{ price: at - 5, qty: 1 }, { price: at - 10, qty: 1 }] } }) === null && (futRefusal(ruled, { symbol: 'ES', side: 'buy', qty: 2, kind: 'market', bracket: { stops: [{ price: at - 5, qty: 1 }, { price: at - 60, qty: 1 }] } }) ?? '').includes('at risk on one trade'));

  /* a TRAILING stop on a short: it follows the LOWS down, never back up, and is checked before it is moved */
  let T = futPlace(base(), { symbol: 'ES', side: 'sell', qty: 1, kind: 'market', bracket: { stop: at + 12, trail: true } }, 0);
  const armed = T.orders.find(o => o.kind === 'stop')!;
  const fillIn = futBookOf(T).positions[0].avg;
  ok('armed to trail: the points it stands from the way in', near(armed.trail ?? 0, armed.price! - fillIn) && armed.side === 'buy');
  let before = armed.price!;
  let never = true;
  let low = armed.peak!;
  let checkedFirst = true;
  for (let m = M + 1; m <= FUT_LAST_MIN && futBookOf(T).positions.length; m++) {
    T = futAdvance(T, { day, minute: m }, 0);
    const o = T.orders.find(x => x.id === armed.id)!;
    const b = futBarAt('ES', day, m)!;
    if (o.status === 'filled') {
      checkedFirst = b.high >= before - 1e-9;
      break;
    }
    if (o.price! > before + 1e-9) never = false;
    low = Math.min(low, b.low);
    before = o.price!;
  }
  ok('it followed the lows down at its distance, and never moved back', never && near(before, Math.min(armed.price!, low + armed.trail!), es.tick), `${armed.price} → ${before}`);
  ok('when it was taken, it was where it stood before that bar moved it', checkedFirst);
  const swBase = futPlace(base(), { symbol: 'ES', side: 'buy', qty: 4, kind: 'market' }, 0);
  let A = futAttach(swBase, 'ES', 'target', at + 20, 0);
  A = futAttach(A, 'ES', 'target', at + 40, 0);
  A = futAttach(A, 'ES', 'target', at + 60, 0);
  const sizes = A.orders.filter(o => o.status === 'working' && o.kind === 'limit').sort((x, y) => x.price! - y.price!).map(o => o.qty).join();
  ok('on the chart: three pulls, three targets — 2 · 1 · 1 — and a fourth is not taken', sizes === '2,1,1' && futAttach(A, 'ES', 'target', at + 80, 0) === A && futLadderRoom(A, 'ES').target === null && futLadderRoom(A, 'ES').stop === 'first');
  const st1 = futAttach(A, 'ES', 'stop', at - 20, 0);
  const sid = st1.orders.find(o => o.kind === 'stop')!.id;
  ok('the switches on a working stop', futSetTrail(st1, sid, true, 0).orders.find(o => o.id === sid)!.trail! > 0 && futSetBreakeven(st1, sid, true, 0).orders.find(o => o.id === sid)!.breakeven === true);
}

/* ==== STOP ENTRIES · REVERSALS · A TYPED TRAILING DISTANCE (docs/review-futures-rules.md, 2026-09-21) ==== */
{
  const at = futPriceAt('ES', day, M);
  const fresh = () => futAdvance(newFutSession({ id: 'x', name: 'ways in', tickers: ['ES'], startCash: 100000, startDay: day, now: 0 }), { day, minute: M }, 0);
  /* a stop as a way in */
  ok('a buy stop under the price is refused, in words', futRefusal(fresh(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'stop', price: at - 4 }) === 'A buy stop waits above the price — it buys the break');
  ok('a sell stop over the price is refused, in words', futRefusal(fresh(), { symbol: 'ES', side: 'sell', qty: 1, kind: 'stop', price: at + 4 }) === 'A sell stop waits under the price — it sells the breakdown');
  let B = futPlace(fresh(), { symbol: 'ES', side: 'buy', qty: 2, kind: 'stop', price: at + 2, bracket: { stop: at - 10, target: at + 30 } }, 0);
  ok('a buy stop above the price waits, as a way in, with its ways out folded', B.orders[0].status === 'working' && !B.orders[0].exit && B.fills.length === 0);
  let hitAt = -1;
  for (let m = M + 1; m <= FUT_LAST_MIN; m++) {
    const b = futBarAt('ES', day, m)!;
    if (b.high >= at + 2) {
      hitAt = m;
      break;
    }
  }
  if (hitAt > 0) {
    B = futAdvance(B, { day, minute: hitAt }, 0);
    const bar = futBarAt('ES', day, hitAt)!;
    const f = B.fills[0];
    ok('it buys the break on the minute the bar touches it — a tick worse, or the open on a gap', !!f && f.at.minute === hitAt && !f.exit && near(f.price, Math.max(at + 2, bar.open) + es.tick, es.tick / 2), f ? `${f.price} on a bar opening ${bar.open}` : 'no fill');
    ok('…and its target and stop ride the long it opened', futBookOf(B).positions[0]?.long === true && B.orders.filter(o => o.status === 'working' && o.exit).length === 2);
  } else ok('the tape trades two points up after the way in (the stage)', false);

  /* a reversal */
  let R = futPlace(fresh(), { symbol: 'ES', side: 'buy', qty: 2, kind: 'market' }, 0);
  ok('past flat is no longer refused: it is a reversal', futRefusal(R, { symbol: 'ES', side: 'sell', qty: 5, kind: 'market' }) === null);
  ok('a reversal the free money cannot margin is refused, with the old side’s margin counted back', (futRefusal(R, { symbol: 'ES', side: 'sell', qty: 2 + 80, kind: 'market' }) ?? '').includes('once the other side is closed'));
  R = futPlace(R, { symbol: 'ES', side: 'sell', qty: 5, kind: 'market', bracket: { stop: at + 8, target: at - 12 } }, 0);
  const book = futBookOf(R);
  const two = R.orders.filter(o => o.kind === 'market').slice(-2);
  ok('two orders: the close (2), then the rest the other way (3) — both filled now', two.map(o => `${o.qty}${o.exit ? 'out' : 'in'}`).join() === '2out,3in' && two.every(o => o.status === 'filled'));
  ok('the long closed as a trade; a short of three stands', book.trades.length === 1 && book.trades[0].how === 'closed' && book.positions[0]?.long === false && book.positions[0]?.qty === 3);
  ok('the ways out typed with it ride the NEW short, on the buy side', R.orders.filter(o => o.status === 'working' && o.exit).every(o => o.side === 'buy' && o.qty === 3) && R.orders.filter(o => o.status === 'working' && o.exit).length === 2);
  ok('a reversal that waits needs every contract free', (futRefusal(R, { symbol: 'ES', side: 'buy', qty: 5, kind: 'limit', price: at - 20 }) ?? '').includes('a reversal that waits needs every one of them free'));
  ok('…a reversal at the market never is', futRefusal(R, { symbol: 'ES', side: 'buy', qty: 5, kind: 'market' }) === null);
  const ruledR = futAdvance(newFutSession({ id: 'rr', name: 'ruled', tickers: ['ES'], rules: { maxOpen: 1, maxRiskPct: 0.02 }, startCash: 100000, startDay: day, now: 0 }), { day, minute: M }, 0);
  const heldR = futPlace(ruledR, { symbol: 'ES', side: 'buy', qty: 1, kind: 'market', bracket: { stop: at - 4 } }, 0);
  ok('the rules read the new side: one open at once still allows a reversal, the risk rule wants its stop', futRefusal(heldR, { symbol: 'ES', side: 'sell', qty: 2, kind: 'market', bracket: { stop: at + 4 } }) === null && (futRefusal(heldR, { symbol: 'ES', side: 'sell', qty: 2, kind: 'market' }) ?? '').includes('that needs a stop on the order'));

  /* a typed trailing distance */
  let T = futPlace(fresh(), { symbol: 'ES', side: 'buy', qty: 1, kind: 'market', bracket: { stop: at - 10, trail: true, trailBy: 6 } }, 0);
  const tr = T.orders.find(o => o.kind === 'stop')!;
  ok('the stop trails by the points TYPED, from the way in', tr.trail === 6 && near(tr.peak ?? 0, at + es.tick, es.tick) && tr.price === onTick(es, at - 10), `${tr.trail} pts, peak ${tr.peak}`);
  const dragged = futAmend(T, tr.id, at - 3, 0).orders.find(o => o.id === tr.id)!;
  ok('a trailing stop dragged keeps its new distance', near(dragged.trail ?? 0, Math.abs(futPriceAt('ES', day, M) - (at - 3)), es.tick), `${dragged.trail}`);
  const typed = futSetTrail(T, tr.id, true, 0, 2.5).orders.find(o => o.id === tr.id)!;
  ok('the switch takes a typed distance too, and a distance of nothing is not taken', typed.trail === 2.5 && futSetTrail(T, tr.id, true, 0, 0) === T);
}

console.log(misses ? `\n${misses} MISSED` : '\nall rules hold');
process.exit(misses ? 1 : 0);
