/*
==================================================
  SLAYER TERMINAL - THE DESK PROOF
  (scripts/desk-proof.ts)

  The paper engine, driven rather than read.
==================================================

  THE DESK'S ARITHMETIC IS THE ONE A READER SPENDS MONEY ON. An average
  entry that drifts by a cent on a scale-in, a realised figure that counts
  fees twice, a reversal that keeps the old side's cost basis — none of
  them look wrong on screen. They look like numbers.

  So this drives the ENGINE, not its parts: orders go in through the same
  door the ticket uses, quotes arrive the way the clock delivers them, and
  the assertions are on what the account and the blotter say afterwards.
  The fill model is pinned so every price here is chosen rather than
  sampled, which is the only way a P&L assertion can be exact.

  Run with `npm run proof:desk`.
*/

import './lib/browser-shim';
import {
  submitOrder,
  onQuotes,
  resetAccount,
  getPaperState,
  readAccount,
  markPosition,
  positionFor,
  closePosition,
  reversePosition,
  addToPosition,
  setFillModel,
  isLive,
  setStop,
  setTarget,
  cancelAll,
  flattenAll,
} from '../src/core/paper/engine';
import { stockInstrument, optionInstrument, roundToTick } from '../src/core/paper/instruments';
import { readPlan, readLevel, ticksBetween, isStopSide, isTargetSide } from '../src/core/paper/brackets';
import { statsOf } from '../src/core/paper/analytics';
import { bookRisk } from '../src/core/paper/risk';
import type { Quote } from '../src/core/paper/market';

let pass = 0;
const fails: string[] = [];
let group = '(none)';
const section = (n: string) => {
  group = n;
};
const ok = (cond: boolean, what: string, detail?: unknown): void => {
  if (cond) pass++;
  else fails.push(`${group} · ${what}${detail !== undefined ? `   ${JSON.stringify(detail)}` : ''}`);
};
const near = (a: number, b: number, tol: number, what: string): void =>
  ok(Number.isFinite(a) && Math.abs(a - b) <= tol, what, { got: a, want: b });

/* A fill model with no slippage and no walk: every market order fills at the
   touch, so every number below is a number this file chose. */
setFillModel({
  touch: (side, q) => (side === 'buy' ? q.ask : q.bid),
  maxWalk: () => 0,
  fee: () => 0,
});

const SPY = stockInstrument('SPY');
const q = (price: number, id = SPY.id): Quote => ({
  id,
  bid: price,
  ask: price,
  last: price,
  mark: price,
  bidSize: 100_000,
  askSize: 100_000,
  time: Date.now(),
  provenance: { kind: 'simulated', state: 'ok', source: 'proof', asOf: Date.now() } as Quote['provenance'],
  note: 'the proof chose this',
  underlyingSpot: price,
});

const fresh = (cash = 100_000) => {
  flattenAll('engine', 'proof reset');
  cancelAll();
  resetAccount(cash);
};

/* ============================ ONE LONG ROUND TRIP =========================== */

section('a long, scaled in and out');
{
  fresh();
  onQuotes([q(100)]);
  submitOrder({ instrument: SPY, side: 'buy', qty: 10, type: 'market', source: 'ticket' });
  let p = positionFor(SPY.id)!;
  ok(p != null, 'the buy opened a position');
  near(p.qty, 10, 0, 'ten long');
  near(p.avgPrice, 100, 1e-9, 'entered at the ask');
  near(getPaperState().account.cash, 100_000 - 1000, 0.01, 'cash paid for the shares');
  near(readAccount().equity, 100_000, 0.01, 'equity is unchanged by a fill at the mark');

  // Scale in higher: the average must be the SIZE-weighted one, not the mean.
  onQuotes([q(110)]);
  addToPosition(SPY.id, 30);
  p = positionFor(SPY.id)!;
  near(p.qty, 40, 0, 'forty long after the add');
  near(p.avgPrice, (100 * 10 + 110 * 30) / 40, 1e-6, 'the average is weighted by size, not by fill count');
  near(readAccount().equity, 100_000 + 10 * 10, 0.01, 'the first ten are up ten points');

  // Scale out a quarter: realised is on the CLOSED size only.
  onQuotes([q(120)]);
  closePosition(SPY.id, 0.25);
  p = positionFor(SPY.id)!;
  near(p.qty, 30, 0, 'thirty left after a quarter out');
  near(p.avgPrice, 107.5, 1e-6, 'the average entry does not move when size leaves');
  near(getPaperState().account.realizedTotal, (120 - 107.5) * 10, 0.01, 'realised is the closed size times the move');
  const openTrade = getPaperState().trades.at(-1)!;
  near(openTrade.qty, 10, 0, 'the blotter row carries the size that closed');
  near(openTrade.entryAvg, 107.5, 1e-6, 'the blotter row carries the average entry');
  near(openTrade.exitAvg, 120, 1e-9, 'the blotter row carries the exit');
  ok(openTrade.side === 'long', 'the blotter row knows which way it was', openTrade.side);

  // And the rest.
  closePosition(SPY.id, 1);
  ok(positionFor(SPY.id) === null, 'the position is gone');
  near(getPaperState().account.realizedTotal, (120 - 107.5) * 40, 0.01, 'realised totals the whole round trip');
  near(readAccount().equity, 100_000 + (120 - 107.5) * 40, 0.01, 'equity is the cash and nothing else');
  near(readAccount().unrealized, 0, 1e-9, 'nothing is open, so nothing is unrealised');
}

/* ============================= ONE SHORT ROUND TRIP ========================= */

section('a short, which is the mirror');
{
  fresh();
  onQuotes([q(100)]);
  submitOrder({ instrument: SPY, side: 'sell', qty: 10, type: 'market', source: 'ticket' });
  let p = positionFor(SPY.id)!;
  near(p.qty, -10, 0, 'ten short');
  near(p.avgPrice, 100, 1e-9, 'sold at the bid');
  near(getPaperState().account.cash, 100_000 + 1000, 0.01, 'a short sale credits cash');
  near(readAccount().equity, 100_000, 0.01, 'equity is unchanged at the mark');

  onQuotes([q(90)]);
  near(markPosition(p, getPaperState().quotes[SPY.id]).unrealized, 100, 0.01, 'a short is up when the price falls');
  near(readAccount().equity, 100_100, 0.01, 'and the account knows it');

  onQuotes([q(120)]);
  p = positionFor(SPY.id)!;
  near(markPosition(p, getPaperState().quotes[SPY.id]).unrealized, -200, 0.01, 'and down when it rises');

  onQuotes([q(90)]);
  closePosition(SPY.id, 1);
  ok(positionFor(SPY.id) === null, 'the short is covered');
  near(getPaperState().account.realizedTotal, 100, 0.01, 'a short realises the fall');
  near(readAccount().equity, 100_100, 0.01, 'equity carries it');
}

/* ================================ THE REVERSAL ============================== */

section('the reversal');
{
  fresh();
  onQuotes([q(100)]);
  submitOrder({ instrument: SPY, side: 'buy', qty: 10, type: 'market', source: 'ticket' });
  onQuotes([q(120)]);
  reversePosition(SPY.id);
  const p = positionFor(SPY.id)!;
  ok(p != null, 'the reverse left a position');
  near(p.qty, -10, 0, 'ten short on the other side');
  /* THE COST BASIS IS THE NEW ONE. A reversal closes the old lot and opens a
     fresh one at the price it opened at — carrying the long's 100 into a
     short entered at 120 prints a position that is instantly 20 points
     wrong and never recovers. */
  near(p.avgPrice, 120, 1e-6, 'the new side is entered at the price it was entered at');
  near(getPaperState().account.realizedTotal, 200, 0.01, 'the old side realised its gain');
  near(markPosition(p, getPaperState().quotes[SPY.id]).unrealized, 0, 0.01, 'the new side is flat the moment it opens');
  near(readAccount().equity, 100_200, 0.01, 'equity is the realised gain and nothing else');

  onQuotes([q(110)]);
  near(markPosition(positionFor(SPY.id)!, getPaperState().quotes[SPY.id]).unrealized, 100, 0.01, 'the short makes money as it falls');
  closePosition(SPY.id, 1);
  near(getPaperState().account.realizedTotal, 300, 0.01, 'both sides are in the realised figure');
  near(readAccount().equity, 100_300, 0.01, 'and in the equity');

  // The same, entered short and reversed long.
  fresh();
  onQuotes([q(100)]);
  submitOrder({ instrument: SPY, side: 'sell', qty: 4, type: 'market', source: 'ticket' });
  onQuotes([q(80)]);
  reversePosition(SPY.id);
  const p2 = positionFor(SPY.id)!;
  near(p2.qty, 4, 0, 'four long on the other side');
  near(p2.avgPrice, 80, 1e-6, 'entered at eighty');
  near(getPaperState().account.realizedTotal, 80, 0.01, 'the short realised its fall');
  near(markPosition(p2, getPaperState().quotes[SPY.id]).unrealized, 0, 0.01, 'the new long is flat at its entry');
}

/* ============================== FEES AND THE JOURNAL ======================== */

section('fees, and what realised means');
{
  setFillModel({ touch: (side, qq) => (side === 'buy' ? qq.ask : qq.bid), maxWalk: () => 0, fee: (_i, n) => n * 1 });
  fresh();
  onQuotes([q(100)]);
  submitOrder({ instrument: SPY, side: 'buy', qty: 10, type: 'market', source: 'ticket' });
  onQuotes([q(110)]);
  closePosition(SPY.id, 1);
  const t = getPaperState().trades.at(-1)!;
  near(t.fees, 20, 0.01, 'both sides of the round trip are charged');
  near(t.realized, 100 - 20, 0.01, 'the blotter row is net of fees');
  /* Equity is the honest total: the cash already paid the fees. */
  near(readAccount().equity, 100_000 + 100 - 20, 0.01, 'equity carries the fees');
  near(getPaperState().account.feesTotal, 20, 0.01, 'the account counts them separately');
  near(statsOf(getPaperState().trades).net, 80, 0.01, 'the journal agrees with the account');
  /* THE TWO WORDS FOR ONE NUMBER. `realizedTotal` on the account and `net`
     in the journal are both shown as what the desk has made, so they must
     not differ by the fees — a reader comparing the two panels would be
     looking at a ledger that does not tie. */
  near(getPaperState().account.realizedTotal, statsOf(getPaperState().trades).net, 0.01, 'the account and the journal agree on realised');
  setFillModel({ touch: (side, qq) => (side === 'buy' ? qq.ask : qq.bid), maxWalk: () => 0, fee: () => 0 });
}

/* ============================== THE BUYING POWER ============================ */

section('what the desk refuses');
{
  fresh(1000);
  onQuotes([q(100)]);
  const tooBig = submitOrder({ instrument: SPY, side: 'buy', qty: 10_000, type: 'market', source: 'ticket' });
  ok(tooBig.status === 'rejected', 'an order past the buying power is refused', tooBig.status);
  ok(!!tooBig.rejectReason && /buying power/i.test(tooBig.rejectReason), 'and it says why', tooBig.rejectReason);
  ok(positionFor(SPY.id) === null, 'and nothing opened');

  const zero = submitOrder({ instrument: SPY, side: 'buy', qty: 0, type: 'market', source: 'ticket' });
  ok(zero.status === 'rejected', 'a zero-size order is refused', zero.status);
  const neg = submitOrder({ instrument: SPY, side: 'buy', qty: -5, type: 'market', source: 'ticket' });
  ok(neg.status === 'rejected', 'a negative order is refused', neg.status);
  ok(positionFor(SPY.id) === null, 'and neither opened anything');

  fresh();
  onQuotes([q(100)]);
  submitOrder({ instrument: SPY, side: 'buy', qty: 5, type: 'market', source: 'ticket' });
  // A reduce-only order cannot grow the position, and cannot flip it either.
  const over = submitOrder({ instrument: SPY, side: 'sell', qty: 50, type: 'market', role: 'exit', reduceOnly: true, source: 'panel' });
  ok(over.status !== 'rejected', 'a reduce-only order past the size is trimmed, not refused', over.status);
  ok(positionFor(SPY.id) === null, 'it closed the position');
  ok(getPaperState().positions.every(p => p.qty !== 0), 'no zero-size position is left behind');
}

/* ================================= OPTIONS ================================== */

section('an option, which is a hundred of everything');
{
  fresh();
  const call = optionInstrument('SPY', 500, 'C', '2026-12-18');
  onQuotes([q(5, call.id)]);
  submitOrder({ instrument: call, side: 'buy', qty: 2, type: 'market', source: 'chain' });
  const p = positionFor(call.id)!;
  near(p.qty, 2, 0, 'two contracts');
  near(getPaperState().account.cash, 100_000 - 5 * 2 * 100, 0.01, 'the premium is a hundred times the price');
  onQuotes([q(7, call.id)]);
  near(markPosition(p, getPaperState().quotes[call.id]).unrealized, 2 * 100 * 2, 0.01, 'and so is the P&L');
  closePosition(call.id, 1);
  near(getPaperState().account.realizedTotal, 400, 0.01, 'realised on a hundred multiplier');
  near(readAccount().equity, 100_400, 0.01, 'equity carries it');
}

/* ================================= NO NaN =================================== */

section('nothing is NaN');
{
  fresh();
  onQuotes([q(100)]);
  submitOrder({ instrument: SPY, side: 'buy', qty: 3, type: 'market', source: 'ticket' });
  const a = readAccount();
  for (const [k, v] of Object.entries(a)) ok(Number.isFinite(v), `account.${k} is a number`, v);
  const m = markPosition(positionFor(SPY.id)!, getPaperState().quotes[SPY.id]);
  for (const [k, v] of Object.entries(m)) ok(Number.isFinite(v), `mark.${k} is a number`, v);
  // A position with no quote at all falls back to its own entry rather than NaN.
  const m2 = markPosition(positionFor(SPY.id)!, undefined);
  for (const [k, v] of Object.entries(m2)) ok(Number.isFinite(v), `unquoted mark.${k} is a number`, v);
  near(m2.unrealized, 0, 1e-9, 'an unquoted position is flat, not NaN');
  fresh();
}

/* ============================ PROTECTION ==================================== */

section('the stop and the target');
{
  fresh();
  onQuotes([q(100)]);
  submitOrder({ instrument: SPY, side: 'buy', qty: 10, type: 'market', source: 'ticket' });
  setStop(SPY.id, 95);
  setTarget(SPY.id, 110);
  let live = getPaperState().orders.filter(o => isLive(o) && o.instrumentId === SPY.id);
  ok(live.length === 2, 'a stop and a target are working', live.map(o => o.role));
  ok(live.every(o => o.side === 'sell'), 'both protect a long by selling', live.map(o => o.side));
  ok(live.every(o => o.reduceOnly), 'and neither can open anything');
  ok(new Set(live.map(o => o.ocoGroup)).size === 1, 'they are one OCO pair', live.map(o => o.ocoGroup));
  ok(live.every(o => o.qty === 10), 'both cover the whole position', live.map(o => o.qty));

  /* SCALE OUT AND THE PROTECTION FOLLOWS. A full-size stop left working
     against half a position is an order that will flip the reader short the
     moment it triggers. */
  closePosition(SPY.id, 0.5);
  live = getPaperState().orders.filter(o => isLive(o) && o.instrumentId === SPY.id);
  ok(live.length === 2, 'both legs survive a scale-out', live.length);
  ok(live.every(o => o.qty - o.filledQty === 5), 'and both are cut to the size left', live.map(o => o.qty));

  /* ONE FILLS, THE OTHER GOES. */
  onQuotes([q(112)]);
  live = getPaperState().orders.filter(o => isLive(o) && o.instrumentId === SPY.id);
  ok(live.length === 0, 'the target filled and took the stop with it', live.map(o => `${o.role} ${o.status}`));
  ok(positionFor(SPY.id) === null, 'and the position is closed');
  const killed = getPaperState().orders.filter(o => o.instrumentId === SPY.id && o.role === 'stop');
  ok(killed.every(o => o.status === 'canceled' || o.status === 'filled'), 'no orphan leg is left working', killed.map(o => o.status));

  /* THE SHORT IS THE MIRROR: the stop is ABOVE and the target BELOW. */
  fresh();
  onQuotes([q(100)]);
  submitOrder({ instrument: SPY, side: 'sell', qty: 4, type: 'market', source: 'ticket' });
  setStop(SPY.id, 105);
  setTarget(SPY.id, 90);
  const sh = getPaperState().orders.filter(o => isLive(o) && o.instrumentId === SPY.id);
  ok(sh.every(o => o.side === 'buy'), 'a short is protected by buying', sh.map(o => o.side));
  ok(sh.find(o => o.role === 'stop')!.stopPrice! > 100, "the short's stop is above it");
  ok(sh.find(o => o.role === 'target')!.limitPrice! < 100, "the short's target is below it");
  onQuotes([q(89)]);
  ok(positionFor(SPY.id) === null, 'the target covered the short');
  ok(getPaperState().orders.filter(o => isLive(o) && o.instrumentId === SPY.id).length === 0, 'and took the stop with it');

  /* A POSITION THAT CLOSES BY HAND TAKES ITS CHILDREN. */
  fresh();
  onQuotes([q(100)]);
  submitOrder({ instrument: SPY, side: 'buy', qty: 4, type: 'market', source: 'ticket' });
  setStop(SPY.id, 95);
  setTarget(SPY.id, 110);
  closePosition(SPY.id, 1);
  ok(getPaperState().orders.filter(o => isLive(o) && o.instrumentId === SPY.id).length === 0, 'closing by hand leaves nothing working');
  fresh();
}

section('the plan the HUD prints');
{
  // A long: target above, stop below, and two-to-one is 2.00 R.
  const long = readPlan(SPY, 100, 110, 95, 10, 'buy');
  near(long.reward.pnl, 100, 1e-9, 'a long makes ten points on ten shares');
  near(long.risk.pnl, -50, 1e-9, 'and risks five');
  near(long.rr, 2, 1e-9, 'which is two R');
  ok(long.rrWords === '2.00 R', 'printed as R', long.rrWords);
  // A short is the mirror: target BELOW, stop ABOVE.
  const short = readPlan(SPY, 100, 90, 105, 10, 'sell');
  near(short.reward.pnl, 100, 1e-9, 'a short makes ten points falling');
  near(short.risk.pnl, -50, 1e-9, 'and risks five rising');
  near(short.rr, 2, 1e-9, 'same two R');
  // A stop on the entry is not a ratio.
  const flat = readPlan(SPY, 100, 110, 100, 10, 'buy');
  ok(!Number.isFinite(flat.rr) && flat.rrWords === '—', 'a stop on the entry has no R', flat.rrWords);

  near(ticksBetween(SPY, 100, 100.05), 5, 0, 'ticks are counted, not guessed');
  near(ticksBetween(SPY, 100.05, 100), 5, 0, 'and are always positive');
  ok(isStopSide(10, 100, 95) && !isStopSide(10, 100, 105), "a long's stop is under it");
  ok(isStopSide(-10, 100, 105) && !isStopSide(-10, 100, 95), "a short's stop is over it");
  ok(isTargetSide(10, 100, 105) && isTargetSide(-10, 100, 95), 'and the targets are the mirror');

  const lvl = readLevel(SPY, { avgPrice: 100, qty: -10 }, 95);
  near(lvl.pnl, 50, 1e-9, 'a level read off a SHORT position signs itself');
  near(roundToTick(SPY, 100.017), 100.02, 1e-9, 'a price is rounded to the tick');
  near(roundToTick(SPY, 100.014), 100.01, 1e-9, 'down as well as up');
}

/* ============================== THE RISK DESK =============================== */

section('the book');
{
  fresh();
  const QQQ = stockInstrument('QQQ');
  onQuotes([q(100), q(400, QQQ.id)]);
  submitOrder({ instrument: SPY, side: 'buy', qty: 10, type: 'market', source: 'ticket' });
  submitOrder({ instrument: QQQ, side: 'sell', qty: 2, type: 'market', source: 'ticket' });

  const r = bookRisk(getPaperState());
  ok(r.legs.length === 2, 'both positions are legs of the book', r.legs.length);
  ok(r.byUnderlying.length === 2, 'and two names', r.byUnderlying.map(u => u.underlying));
  /* A SHARE IS A SHARE OF SOMETHING. If the denominator is not the same
     gross the rows are measured against, the concentration panel reads as a
     set of percentages that do not add up. */
  const shares = r.byUnderlying.reduce((a, u) => a + u.share, 0);
  near(shares, 1, 1e-9, 'the shares add to one');
  ok(r.byUnderlying.every(u => u.share >= 0 && u.share <= 1), 'and none is outside it', r.byUnderlying.map(u => u.share));
  ok(
    r.byUnderlying.every((u, i) => i === 0 || Math.abs(u.deltaDollars) <= Math.abs(r.byUnderlying[i - 1].deltaDollars)),
    'the names are ranked by weight'
  );
  near(r.concentration.topShare, r.byUnderlying[0].share, 1e-9, 'the top share is the top row');
  ok(r.concentration.top === r.byUnderlying[0].underlying, 'and names it', r.concentration.top);
  ok(r.concentration.names === 2, 'two names in the book', r.concentration.names);
  /* THE HERFINDAHL IS BOUNDED. One name is 1; n equal names is 1/n. Two
     unequal names must sit between a half and one, and a figure outside
     that is an index measured against the wrong base. */
  ok(r.concentration.herfindahl > 0.499 && r.concentration.herfindahl <= 1.0001, 'the Herfindahl is inside its own range', r.concentration.herfindahl);

  near(r.totals.grossExposure, r.byUnderlying.reduce((a, u) => a + Math.abs(u.deltaDollars), 0), 1e-6, 'gross exposure is the rows summed');
  near(r.totals.netDeltaDollars, r.legs.reduce((a, l) => a + l.deltaDollars, 0), 1e-6, 'net delta is the legs summed');
  near(r.totals.unrealized, readAccount().unrealized, 0.01, 'the book and the account agree on unrealised');
  near(r.totals.realized, getPaperState().account.realizedTotal, 0.01, 'and on realised');
  // Shares long, so the delta is the share count and the dollars are the notional.
  const spyLeg = r.legs.find(l => l.symbol === 'SPY')!;
  near(spyLeg.delta, 10, 1e-9, 'ten shares is ten deltas');
  near(spyLeg.deltaDollars, 1000, 1e-6, 'and a thousand dollars of it');
  near(spyLeg.gammaDollars, 0, 1e-9, 'a share has no gamma');
  const qqqLeg = r.legs.find(l => l.symbol === 'QQQ')!;
  near(qqqLeg.delta, -2, 1e-9, 'a short is negative delta');

  /* THE SCENARIO GRID. The flat cell is flat by construction, and a book
     that is net long must lose on a down move and make on an up one. */
  ok(r.grid.length === r.vols.length && r.grid.every(row => row.length === r.moves.length), 'the grid is vols by moves');
  const flatIdx = r.moves.indexOf(0);
  const flatVol = r.vols.indexOf(0);
  near(r.grid[flatVol][flatIdx].pnl, 0, 0.01, 'no move and no vol shock is no P&L');
  const row = r.grid[flatVol];
  ok(row.every(c => Number.isFinite(c.pnl) && Number.isFinite(c.value)), 'every cell is a number', row.map(c => c.pnl));
  ok(
    row.every((c, i) => i === 0 || (r.totals.netDeltaDollars >= 0 ? c.pnl >= row[i - 1].pnl - 0.01 : c.pnl <= row[i - 1].pnl + 0.01)),
    'the row runs the way the book is leaning',
    row.map(c => Math.round(c.pnl))
  );

  // An empty book is an empty book, not a division.
  fresh();
  const none = bookRisk(getPaperState());
  ok(none.legs.length === 0 && none.byUnderlying.length === 0, 'an empty book has no legs');
  near(none.totals.grossExposure, 0, 1e-9, 'and no exposure');
  near(none.concentration.herfindahl, 0, 1e-9, 'and no concentration');
  ok(none.concentration.top === null, 'and nothing to name');
  ok(none.grid.every(rr => rr.every(c => Number.isFinite(c.pnl))), 'and a grid of zeroes, not NaN');
  fresh();
}

console.log(`\n${pass} passed, ${fails.length} FAILED`);
for (const f of fails) console.log('  ✗ ' + f);
if (fails.length) process.exitCode = 1;
process.exit(fails.length ? 1 : 0);
