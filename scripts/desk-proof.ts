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
  cancelAll,
  flattenAll,
} from '../src/core/paper/engine';
import { stockInstrument, optionInstrument } from '../src/core/paper/instruments';
import { statsOf } from '../src/core/paper/analytics';
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

console.log(`\n${pass} passed, ${fails.length} FAILED`);
for (const f of fails) console.log('  ✗ ' + f);
if (fails.length) process.exitCode = 1;
process.exit(fails.length ? 1 : 0);
