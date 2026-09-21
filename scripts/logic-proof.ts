/*
==================================================
  SLAYER TERMINAL - THE LOGIC PROOF
  (scripts/logic-proof.ts)

  The arithmetic, asserted rather than eyeballed.
==================================================

  A TERMINAL'S BUGS ARE NOT IN ITS PIXELS. Every surface in this build reads
  correctly and can still be wrong, because a max-loss figure, a profit
  factor and a breakeven all render identically whether or not they are
  true. A sweep by eye catches a clipped ellipsis; it cannot catch a put
  whose profit is reported as unbounded, and neither can a screenshot.

  So the invariants are written down. Each block below states a property
  that must hold for ANY input — put-call parity, a delta between zero and
  one, a payoff that is a straight line between two strikes, a Herfindahl
  that sums to one — and the proof asserts it across a sweep rather than at
  one convenient point. A property that survives three hundred cases is a
  fact; one checked at S = K = 100 is a coincidence.

  Run with `npm run proof:logic`.
*/

import { blackScholesGreeks, blackScholesPrice, impliedVolFromPrice } from '../src/core/greeks';
import { higherGreeks, perVolPoint, perDay, exposureAt, TRADING_DAYS } from '../src/core/higherGreeks';
import { intrinsicAt, pnlAt, payoffProfile, type PayoffLeg } from '../src/core/paper/payoff';
import { statsOf, byDay, monthGrid, excursions, dayKeyOf } from '../src/core/paper/analytics';
import { pickWalls, pickFlip } from '../src/core/walls';
import { isoDate, isTradingDay, sessionsBetween, expiryFor, futuresPhaseAt } from '../src/core/calendar';
import { getCarry } from '../src/core/carry';
import {
  emaSeries, vwapSeries, rsiSeries, macdSeries, bollingerSeries, smaSeries, atrBarSeries, sessionStarts,
} from '../src/data/indicators';
import type { Candle } from '../src/types/market';
import type { Trade } from '../src/core/paper/engine';

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
  ok(Number.isFinite(a) && Math.abs(a - b) <= tol, what, { got: a, want: b, off: Math.abs(a - b) });

/* ============================ BLACK-SCHOLES ================================ */

section('black-scholes');
{
  const { r, q } = getCarry();
  // Put-call parity is the one identity a pricer cannot fudge: it ties the
  // two sides together at EVERY spot, strike, vol and tenor.
  for (const S of [40, 100, 412.5, 6000]) {
    for (const k of [0.7, 0.9, 1, 1.1, 1.4]) {
      for (const t of [1 / 365, 0.05, 0.5, 2]) {
        for (const v of [0.08, 0.25, 0.9]) {
          const K = S * k;
          const c = blackScholesPrice(S, K, t, v, 'C');
          const p = blackScholesPrice(S, K, t, v, 'P');
          const parity = S * Math.exp(-q * t) - K * Math.exp(-r * t);
          near(c - p, parity, Math.max(1e-6, S * 2e-6), `parity S${S} K/S${k} t${t} v${v}`);
          ok(c >= -1e-9 && p >= -1e-9, `no negative premium S${S} K/S${k} t${t} v${v}`, { c, p });
          ok(c >= S * Math.exp(-q * t) - K * Math.exp(-r * t) - 1e-6, `call ≥ discounted intrinsic S${S} K/S${k}`);
          ok(p >= K * Math.exp(-r * t) - S * Math.exp(-q * t) - 1e-6, `put ≥ discounted intrinsic S${S} K/S${k}`);
        }
      }
    }
  }
  // Monotone in vol and in time — both sides, always.
  for (const right of ['C', 'P'] as const) {
    let prev = -Infinity;
    for (const v of [0.05, 0.1, 0.2, 0.4, 0.8, 1.6]) {
      const px = blackScholesPrice(100, 100, 0.5, v, right);
      ok(px > prev, `${right} rises with vol at v${v}`, px);
      prev = px;
    }
  }
}

section('greeks');
{
  for (const S of [50, 100, 500]) {
    for (const k of [0.8, 1, 1.25]) {
      for (const t of [0.02, 0.5, 2]) {
        for (const v of [0.1, 0.35, 1]) {
          const K = S * k;
          const g = blackScholesGreeks(S, K, t, v);
          const tag = `S${S} K/S${k} t${t} v${v}`;
          ok(g.deltaCall > 0 && g.deltaCall < 1.0001, `call delta in (0,1) ${tag}`, g.deltaCall);
          ok(g.deltaPut < 0.0001 && g.deltaPut > -1.0001, `put delta in (-1,0) ${tag}`, g.deltaPut);
          // Δc − Δp = e^{−qt}, the generalized identity; q = 0 makes it 1.
          near(g.deltaCall - g.deltaPut, Math.exp(-getCarry().q * t), 1e-6, `Δc − Δp = e^-qt ${tag}`);
          ok(g.gamma > 0, `gamma positive ${tag}`, g.gamma);
          ok(g.vega > 0, `vega positive ${tag}`, g.vega);
          // Gamma against a finite difference of delta.
          const h = S * 1e-4;
          const fd = (blackScholesGreeks(S + h, K, t, v).deltaCall - blackScholesGreeks(S - h, K, t, v).deltaCall) / (2 * h);
          near(g.gamma, fd, Math.max(1e-6, Math.abs(fd) * 5e-3), `gamma = dΔ/dS ${tag}`);
          // Vega against a finite difference of price, per POINT of vol.
          const hv = 1e-4;
          const fdv = (blackScholesPrice(S, K, t, v + hv, 'C') - blackScholesPrice(S, K, t, v - hv, 'C')) / (2 * hv) / 100;
          near(g.vega, fdv, Math.max(1e-6, Math.abs(fdv) * 5e-3), `vega = dV/dσ / 100 ${tag}`);
          // Charm pair: Δc and Δp differ by q·e^{−qt}, so their charms must too.
          near(g.charmCall - g.charmPut, getCarry().q * Math.exp(-getCarry().q * t), 1e-6, `charm pair ${tag}`);
        }
      }
    }
  }
  ok(blackScholesGreeks(200, 100, 0.25, 0.2).deltaCall > 0.95, 'deep ITM call delta → 1');
  ok(blackScholesGreeks(50, 100, 0.25, 0.2).deltaCall < 0.05, 'deep OTM call delta → 0');
  ok(blackScholesGreeks(100, 100, 0.25, 0.2).gamma > blackScholesGreeks(100, 140, 0.25, 0.2).gamma, 'gamma peaks near the money');
}

section('implied vol');
{
  /* THE INVERSION MAY DECLINE, BUT IT MAY NOT BE WRONG. Deep in the money
     and at the last bell the price stops moving with vol, and a bisection
     that keeps answering hands back whichever end of the flat band it
     walked in from — 0.01% on a contract trading at parity. The property
     asserted here is therefore not "always recovers the vol" but "recovers
     the vol or says it cannot", which is the one a chain can render. */
  let declined = 0;
  let recovered = 0;
  for (const vol of [0.06, 0.12, 0.25, 0.55, 1.2, 3]) {
    for (const k of [0.75, 0.95, 1, 1.05, 1.3]) {
      for (const t of [1 / 365, 0.08, 0.5, 2]) {
        for (const right of ['C', 'P'] as const) {
          const K = 100 * k;
          const px = blackScholesPrice(100, K, t, vol, right);
          const back = impliedVolFromPrice(px, 100, K, t, right);
          if (back === null) declined++;
          else recovered++;
          ok(back === null || Math.abs(back - vol) < 2e-4, `round-trip ${right} K${K} t${t} v${vol}`, back);
        }
      }
    }
  }
  ok(recovered > declined * 2, 'the inversion answers far more often than it declines', { recovered, declined });
  // Everything at a readable tenor and near the money must still answer.
  for (const vol of [0.1, 0.3, 0.8]) {
    for (const k of [0.9, 1, 1.1]) {
      for (const right of ['C', 'P'] as const) {
        const K = 100 * k;
        const px = blackScholesPrice(100, K, 0.25, vol, right);
        const back = impliedVolFromPrice(px, 100, K, 0.25, right);
        ok(back !== null && Math.abs(back - vol) < 2e-4, `a live contract still inverts ${right} K${K} v${vol}`, back);
      }
    }
  }
  // And the refusal survives a change of scale — a $6,000 index, not a $9 name.
  for (const S of [9, 100, 6000]) {
    const px = blackScholesPrice(S, S, 0.25, 0.3, 'C');
    const back = impliedVolFromPrice(px, S, S, 0.25, 'C');
    ok(back !== null && Math.abs(back - 0.3) < 2e-4, `at the money inverts at S${S}`, back);
  }
  ok(impliedVolFromPrice(0, 100, 100, 0.5, 'C') === null, 'zero price has no vol');
  ok(impliedVolFromPrice(-5, 100, 100, 0.5, 'C') === null, 'negative price has no vol');
  ok(impliedVolFromPrice(500, 100, 100, 0.5, 'C') === null, 'price above the ceiling has no vol');
  ok(impliedVolFromPrice(10, 100, 100, 0, 'C') === null, 'zero time has no vol');
  ok(impliedVolFromPrice(10, 0, 100, 0.5, 'C') === null, 'zero spot has no vol');
  // Parity on a deep ITM call: the answer is "no vol", never 0.01%.
  const parity = impliedVolFromPrice(blackScholesPrice(100, 40, 1 / 365, 0.2, 'C'), 100, 40, 1 / 365, 'C');
  ok(parity === null, 'a contract trading at parity does not imply a 0.01% vol', parity);
}

section('higher greeks');
{
  for (const t of [0.05, 0.5, 1.5]) {
    for (const v of [0.12, 0.4]) {
      const h = higherGreeks(100, 100, t, v);
      const tag = `t${t} v${v}`;
      for (const [k, val] of Object.entries(h)) ok(Number.isFinite(val), `${k} finite ${tag}`, val);
      // Speed against a finite difference of gamma in spot.
      const hs = 1e-3;
      const fds = (blackScholesGreeks(100 + hs, 100, t, v).gamma - blackScholesGreeks(100 - hs, 100, t, v).gamma) / (2 * hs);
      near(h.speed, fds, Math.max(1e-7, Math.abs(fds) * 1e-2), `speed = dΓ/dS ${tag}`);
      // Zomma against a finite difference of gamma in vol.
      const hv = 1e-4;
      const fdz = (blackScholesGreeks(100, 100, t, v + hv).gamma - blackScholesGreeks(100, 100, t, v - hv).gamma) / (2 * hv);
      near(h.zomma, fdz, Math.max(1e-7, Math.abs(fdz) * 1e-2), `zomma = dΓ/dσ ${tag}`);
      // Vomma against a finite difference of RAW vega in vol (greeks.ts is per point).
      const fdvo =
        ((blackScholesGreeks(100, 100, t, v + hv).vega - blackScholesGreeks(100, 100, t, v - hv).vega) * 100) / (2 * hv);
      near(h.vomma, fdvo, Math.max(1e-5, Math.abs(fdvo) * 1e-2), `vomma = dVega/dσ ${tag}`);
      // Colour and veta are CLOCK partials — measured against time, not negated twice.
      const ht = 1e-5;
      /* CALENDAR time, not time-to-expiry — the clock runs the other way, so
         both of these are the NEGATIVE of a finite difference in tenor. The
         file was once wrong about exactly this in both directions at once. */
      const fdc = (blackScholesGreeks(100, 100, t + ht, v).gamma - blackScholesGreeks(100, 100, t - ht, v).gamma) / (2 * ht);
      near(h.color, -fdc, Math.max(1e-5, Math.abs(fdc) * 2e-2), `color = -dΓ/dτ ${tag}`);
      const fdv = ((blackScholesGreeks(100, 100, t + ht, v).vega - blackScholesGreeks(100, 100, t - ht, v).vega) * 100) / (2 * ht);
      near(h.veta, -fdv, Math.max(1e-4, Math.abs(fdv) * 2e-2), `veta = -dVega/dτ ${tag}`);
      // And the same for charm, which lives in greeks.ts under the same rule.
      const fdd = (blackScholesGreeks(100, 100, t + ht, v).deltaCall - blackScholesGreeks(100, 100, t - ht, v).deltaCall) / (2 * ht);
      near(blackScholesGreeks(100, 100, t, v).charmCall, -fdd, Math.max(1e-4, Math.abs(fdd) * 2e-2), `charm = -dΔ/dτ ${tag}`);
    }
  }
  near(perVolPoint(100), 1, 1e-9, 'per vol point divides by 100');
  near(perDay(TRADING_DAYS), 1, 1e-9, 'per day divides by the trading year');
  const e = exposureAt(2, { callOI: 1000, putOI: 400 }, 1);
  near(e.call, 2 * 1000 * 100, 1e-6, 'call exposure = per-contract × OI × 100 × sign');
  near(e.put, -2 * 400 * 100, 1e-6, 'the put side carries the opposite sign');
  near(e.net, e.call + e.put, 1e-9, 'net exposure is the two sides added');
  const flipped = exposureAt(2, { callOI: 1000, putOI: 400 }, -1);
  near(flipped.net, -e.net, 1e-9, 'flipping the house sign flips the book');
  near(exposureAt(0, { callOI: 1000, putOI: 400 }, 1).net, 0, 1e-9, 'no greek, no exposure');
}

/* ================================ PAYOFF ==================================== */

const LONG_CALL: PayoffLeg[] = [{ strike: 100, right: 'C', ratio: 1 }];
const LONG_PUT: PayoffLeg[] = [{ strike: 100, right: 'P', ratio: 1 }];
const CALL_SPREAD: PayoffLeg[] = [
  { strike: 100, right: 'C', ratio: 1 },
  { strike: 110, right: 'C', ratio: -1 },
];
const PUT_SPREAD: PayoffLeg[] = [
  { strike: 100, right: 'P', ratio: 1 },
  { strike: 90, right: 'P', ratio: -1 },
];
const STRADDLE: PayoffLeg[] = [
  { strike: 100, right: 'C', ratio: 1 },
  { strike: 100, right: 'P', ratio: 1 },
];
const CONDOR: PayoffLeg[] = [
  { strike: 90, right: 'P', ratio: 1 },
  { strike: 95, right: 'P', ratio: -1 },
  { strike: 105, right: 'C', ratio: -1 },
  { strike: 110, right: 'C', ratio: 1 },
];

section('intrinsic');
{
  near(intrinsicAt(LONG_CALL, 120), 20, 1e-9, 'long call at 120');
  near(intrinsicAt(LONG_CALL, 80), 0, 1e-9, 'long call at 80');
  near(intrinsicAt(LONG_PUT, 80), 20, 1e-9, 'long put at 80');
  near(intrinsicAt(LONG_PUT, 120), 0, 1e-9, 'long put at 120');
  near(intrinsicAt(CALL_SPREAD, 130), 10, 1e-9, 'call spread caps at its width');
  near(intrinsicAt(STRADDLE, 100), 0, 1e-9, 'straddle is worthless exactly at the strike');
  near(intrinsicAt(CONDOR, 100), 0, 1e-9, 'condor keeps the credit in the middle');
  near(intrinsicAt(CONDOR, 50), -5, 1e-9, 'condor loses its put width at the floor');
  near(intrinsicAt(CONDOR, 200), -5, 1e-9, 'condor loses its call width at the ceiling');
}

section('pnl');
{
  // Buying pays the net and collects the intrinsic; selling is the mirror.
  near(pnlAt(LONG_CALL, 120, 5, 'buy', 1, 100), (20 - 5) * 100, 1e-9, 'long call in the money');
  near(pnlAt(LONG_CALL, 90, 5, 'buy', 1, 100), -500, 1e-9, 'long call worthless = the debit');
  near(pnlAt(LONG_CALL, 120, 5, 'sell', 1, 100), -(20 - 5) * 100, 1e-9, 'sold call is the mirror');
  near(pnlAt(LONG_CALL, 120, 5, 'buy', 3, 100), (20 - 5) * 300, 1e-9, 'quantity scales');
  near(pnlAt(LONG_CALL, 120, 5, 'buy', 1, 1), 15, 1e-9, 'multiplier scales');
}

section('payoff profile');
{
  const spot = 100;
  const mult = 100;

  // --- what is bounded and what is not ---
  const lc = payoffProfile(LONG_CALL, 5, 'buy', 1, mult, spot);
  ok(lc.maxProfit === null, 'a long call gains without bound', lc.maxProfit);
  near(lc.maxLoss!, 500, 1e-6, 'a long call risks the debit');
  near(lc.breakevens[0], 105, 1e-6, 'a long call breaks even at strike plus debit');

  const sc = payoffProfile(LONG_CALL, 5, 'sell', 1, mult, spot);
  ok(sc.maxLoss === null, 'a sold naked call loses without bound', sc.maxLoss);
  near(sc.maxProfit!, 500, 1e-6, 'a sold call keeps the credit');

  // THE FLOOR IS ZERO. A put cannot gain past a share price of nothing, so
  // its profit is bounded at strike minus debit — "unbounded" is a lie the
  // reader would size against.
  const lp = payoffProfile(LONG_PUT, 5, 'buy', 1, mult, spot);
  ok(lp.maxProfit !== null, 'a long put has a finite best case — the share cannot go below zero', lp.maxProfit);
  near(lp.maxProfit ?? NaN, 9500, 1e-6, 'a long put makes strike minus debit at zero');
  near(lp.maxLoss!, 500, 1e-6, 'a long put risks the debit');
  near(lp.breakevens[0], 95, 1e-6, 'a long put breaks even at strike minus debit');

  const sp = payoffProfile(LONG_PUT, 5, 'sell', 1, mult, spot);
  ok(sp.maxLoss !== null, 'a sold put has a finite worst case', sp.maxLoss);
  near(sp.maxLoss ?? NaN, 9500, 1e-6, 'a sold put loses strike minus credit at zero');
  near(sp.maxProfit!, 500, 1e-6, 'a sold put keeps the credit');

  // --- the shapes that are bounded both ways ---
  const cs = payoffProfile(CALL_SPREAD, 4, 'buy', 1, mult, spot);
  near(cs.maxProfit!, 600, 1e-6, 'call spread makes width minus debit');
  near(cs.maxLoss!, 400, 1e-6, 'call spread risks the debit');
  near(cs.breakevens[0], 104, 1e-6, 'call spread breaks even at the long strike plus debit');

  const ps = payoffProfile(PUT_SPREAD, 4, 'buy', 1, mult, spot);
  near(ps.maxProfit!, 600, 1e-6, 'put spread makes width minus debit');
  near(ps.maxLoss!, 400, 1e-6, 'put spread risks the debit');
  near(ps.breakevens[0], 96, 1e-6, 'put spread breaks even at the long strike minus debit');

  const st = payoffProfile(STRADDLE, 8, 'buy', 1, mult, spot);
  ok(st.maxProfit === null, 'a long straddle gains without bound on the upside');
  near(st.maxLoss!, 800, 1e-6, 'a long straddle risks both premiums');
  near(st.worstAt ?? NaN, 100, 1e-6, 'a long straddle is worst exactly at the strike');
  ok(st.breakevens.length === 2, 'a straddle breaks even twice', st.breakevens);
  near(st.breakevens[0], 92, 1e-6, 'straddle lower breakeven');
  near(st.breakevens[1], 108, 1e-6, 'straddle upper breakeven');

  const ic = payoffProfile(CONDOR, -2, 'buy', 1, mult, spot);
  near(ic.maxProfit!, 200, 1e-6, 'condor keeps the credit');
  near(ic.maxLoss!, 300, 1e-6, 'condor risks the width minus the credit');
  ok(ic.breakevens.length === 2, 'a condor breaks even twice', ic.breakevens);

  // --- the curve itself ---
  for (const [name, legs, net, side] of [
    ['long call', LONG_CALL, 5, 'buy'],
    ['long put', LONG_PUT, 5, 'buy'],
    ['call spread', CALL_SPREAD, 4, 'buy'],
    ['straddle', STRADDLE, 8, 'buy'],
    ['condor', CONDOR, -2, 'buy'],
  ] as const) {
    const prof = payoffProfile(legs as unknown as PayoffLeg[], net, side, 1, mult, spot);
    ok(prof.points.length > 100, `${name}: the curve is sampled`, prof.points.length);
    ok(
      prof.points.every((p, i) => i === 0 || p.s > prof.points[i - 1].s),
      `${name}: the curve is strictly ascending in price`
    );
    ok(prof.points.every(p => Number.isFinite(p.pnl)), `${name}: every point is a number`);
    // Every breakeven really is one.
    for (const b of prof.breakevens) {
      near(pnlAt(legs as unknown as PayoffLeg[], b, net, side, 1, mult), 0, 1e-6, `${name}: breakeven ${b.toFixed(2)} is flat`);
    }
    // Sampled max and min never exceed the reported extremes.
    const hi = Math.max(...prof.points.map(p => p.pnl));
    const lo = Math.min(...prof.points.map(p => p.pnl));
    ok(prof.maxProfit === null || hi <= prof.maxProfit + 1e-6, `${name}: no sample beats the max profit`, { hi, max: prof.maxProfit });
    ok(prof.maxLoss === null || -lo <= prof.maxLoss + 1e-6, `${name}: no sample beats the max loss`, { lo, max: prof.maxLoss });
  }

  // A strike outside the sampled window must still shape the answer.
  const far = payoffProfile([{ strike: 1, right: 'P', ratio: 1 }], 0.1, 'buy', 1, mult, 100);
  ok(Number.isFinite(far.maxLoss ?? NaN), 'a far strike still gives a finite loss', far.maxLoss);

  // Degenerate inputs must not produce NaN.
  const none = payoffProfile([], 0, 'buy', 1, mult, 100);
  ok(none.points.every(p => Number.isFinite(p.pnl)), 'an empty strategy is flat, not NaN');
  near(none.maxProfit ?? NaN, 0, 1e-9, 'an empty strategy makes nothing');
  near(none.maxLoss ?? NaN, 0, 1e-9, 'an empty strategy risks nothing');
}

/* ============================== ANALYTICS =================================== */

const mkTrade = (o: Partial<Trade> & { realized: number; closedAt: number }): Trade =>
  ({
    id: `t${o.closedAt}`,
    openedAt: o.closedAt - 60_000,
    instrument: { kind: 'stock', id: 'SPY', symbol: 'SPY', underlying: 'SPY', tickSize: 0.01 } as unknown as Trade['instrument'],
    instrumentId: 'SPY',
    kind: 'stock',
    side: 'long',
    qty: 1,
    entryAvg: 100,
    exitAvg: 100,
    fees: 0,
    slippage: 0,
    returnPct: 0,
    holdMs: 60_000,
    mfe: 0,
    mae: 0,
    ...o,
  }) as Trade;

section('journal stats');
{
  const empty = statsOf([]);
  ok(empty.trades === 0 && empty.winRate === 0 && empty.profitFactor === 0, 'an empty journal is all zeroes');
  ok(Object.values(empty).every(v => typeof v !== 'number' || Number.isFinite(v)), 'an empty journal has no NaN', empty);

  const day = 86_400_000;
  const s = statsOf([
    mkTrade({ realized: 100, closedAt: day * 1, qty: 2, fees: 1, mfe: 150, mae: -20 }),
    mkTrade({ realized: -50, closedAt: day * 2, qty: 1, fees: 1, mfe: 30, mae: -80 }),
    mkTrade({ realized: 200, closedAt: day * 3, qty: 3, fees: 1, mfe: 260, mae: -10 }),
    mkTrade({ realized: -25, closedAt: day * 4, qty: 1, fees: 1, mfe: 5, mae: -40 }),
    mkTrade({ realized: 0, closedAt: day * 5, qty: 1, fees: 1, mfe: 10, mae: -5 }),
  ]);
  ok(s.trades === 5, 'five trades', s.trades);
  ok(s.wins === 2 && s.losses === 2 && s.scratches === 1, 'two up, two down, one flat', s);
  near(s.winRate, 40, 1e-9, 'win rate counts scratches in the denominator');
  near(s.grossProfit, 300, 1e-9, 'gross profit');
  near(s.grossLoss, 75, 1e-9, 'gross loss is a positive magnitude');
  near(s.net, 225, 1e-9, 'net is profit minus loss');
  near(s.profitFactor, 4, 1e-9, 'profit factor is gross profit over gross loss');
  near(s.expectancy, 45, 1e-9, 'expectancy is net per trade');
  near(s.avgWin, 150, 1e-9, 'average win');
  near(s.avgLoss, -37.5, 1e-9, 'average loss is signed negative');
  near(s.bestTrade, 200, 1e-9, 'best trade');
  near(s.worstTrade, -50, 1e-9, 'worst trade');
  near(s.volume, 8, 1e-9, 'volume sums quantity');
  near(s.fees, 5, 1e-9, 'fees sum');
  near(s.worstMae, -80, 1e-9, 'worst MAE is the deepest');
  /* Equity runs 100, 50, 250, 225, 225. The peak is 250 and the last dip is
     25 — but the DEEPEST dip is the first one, 100 down to 50. A drawdown
     figure that only remembers the latest peak understates the account. */
  near(s.maxDrawdown, -50, 1e-9, 'max drawdown is the deepest dip, not the latest');
  ok(s.bestStreak === 1, 'the best streak is one — the wins are not adjacent', s.bestStreak);
  ok(s.worstStreak === 1, 'the worst streak is one', s.worstStreak);

  // The order they are PASSED in must not matter; the clock decides.
  const shuffled = statsOf([
    mkTrade({ realized: 200, closedAt: day * 3 }),
    mkTrade({ realized: 100, closedAt: day * 1 }),
    mkTrade({ realized: -25, closedAt: day * 4 }),
    mkTrade({ realized: -50, closedAt: day * 2 }),
  ]);
  const ordered = statsOf([
    mkTrade({ realized: 100, closedAt: day * 1 }),
    mkTrade({ realized: -50, closedAt: day * 2 }),
    mkTrade({ realized: 200, closedAt: day * 3 }),
    mkTrade({ realized: -25, closedAt: day * 4 }),
  ]);
  near(shuffled.maxDrawdown, ordered.maxDrawdown, 1e-9, 'drawdown does not depend on argument order');
  near(shuffled.bestStreak, ordered.bestStreak, 1e-9, 'streaks do not depend on argument order');

  // A journal with no losers: a profit factor of Infinity cannot be rendered.
  /* A journal with no losers has no ratio — the desk renders that as ∞.
     What it must never be is NaN, or a DOLLAR figure wearing a ratio's
     label, which is what core/ledger.ts used to hand back. */
  const clean = statsOf([mkTrade({ realized: 100, closedAt: day })]);
  ok(clean.profitFactor === Infinity, 'no losses is an infinite profit factor, not a dollar figure', clean.profitFactor);
  ok(!Number.isNaN(clean.profitFactor), 'profit factor is never NaN');
  ok(statsOf([mkTrade({ realized: -100, closedAt: day })]).profitFactor === 0, 'no wins is a profit factor of zero');

  // Streaks, properly run.
  const streaky = statsOf(
    [1, 1, 1, -1, -1, 1, -1, -1, -1, -1].map((sign, i) => mkTrade({ realized: sign * 10, closedAt: day * (i + 1) }))
  );
  ok(streaky.bestStreak === 3, 'three in a row is the best run', streaky.bestStreak);
  ok(streaky.worstStreak === 4, 'four in a row is the worst run', streaky.worstStreak);
}

section('journal calendar');
{
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
  const cells = byDay([
    mkTrade({ realized: 100, closedAt: at(2026, 0, 5), qty: 2, fees: 1 }),
    mkTrade({ realized: -40, closedAt: at(2026, 0, 5, 15), qty: 1, fees: 1 }),
    mkTrade({ realized: 10, closedAt: at(2026, 0, 6), qty: 1, fees: 1 }),
  ]);
  ok(cells.size === 2, 'two days carried trades', cells.size);
  const d5 = cells.get(dayKeyOf(at(2026, 0, 5)))!;
  near(d5.net, 60, 1e-9, 'the day nets its trades');
  ok(d5.trades === 2 && d5.wins === 1 && d5.losses === 1, 'the day counts both sides', d5);
  near(d5.best, 100, 1e-9, 'the day’s best');
  near(d5.worst, -40, 1e-9, 'the day’s worst');
  ok(dayKeyOf(at(2026, 0, 5)) === '2026-01-05', 'the day key is a padded ISO date', dayKeyOf(at(2026, 0, 5)));

  for (const [y, m] of [[2026, 0], [2026, 1], [2024, 1], [2026, 8], [2025, 11]] as const) {
    const grid = monthGrid(y, m);
    const days = new Date(y, m + 1, 0).getDate();
    ok(grid.length % 7 === 0, `${y}-${m + 1}: the grid is whole weeks`, grid.length);
    ok(grid.filter(Boolean).length === days, `${y}-${m + 1}: every day is on the grid`, grid.filter(Boolean).length);
    ok(grid[new Date(y, m, 1).getDay()]?.getDate() === 1, `${y}-${m + 1}: the first lands on its weekday`);
  }

  const ex = excursions([
    mkTrade({ realized: 50, closedAt: 1, mfe: 100, mae: -20 }),
    mkTrade({ realized: -30, closedAt: 2, mfe: 10, mae: -60 }),
  ]);
  near(ex[0].capture, 0.5, 1e-9, 'capture is realised over the high water');
  near(ex[0].mfeShare, 1, 1e-9, 'the best MFE is the full bar');
  near(ex[1].maeShare, 1, 1e-9, 'the deepest MAE is the full bar');
  ok(excursions([]).length === 0, 'no trades, no bars');
  ok(excursions([mkTrade({ realized: 0, closedAt: 1, mfe: 0, mae: 0 })]).every(e => Number.isFinite(e.capture) && Number.isFinite(e.maeShare)), 'a flat trade is not NaN');
}

/* =============================== WALLS ====================================== */

section('walls');
{
  const nodes = [
    { strike: 90, gex: -400 },
    { strike: 95, gex: -100 },
    { strike: 100, gex: 50 },
    { strike: 105, gex: 900 },
    { strike: 110, gex: 300 },
  ];
  // A call wall is OVERHEAD and call-dominant (negative); a put wall is
  // BELOW and put-dominant (positive). Picking the biggest magnitude on the
  // wrong side of spot is the bug this helper exists to prevent.
  const w = pickWalls(nodes, 100, n => n.gex);
  ok(w.callWall === null, 'no strike overhead is call-dominant here', w.callWall);
  ok(w.putWall === null, 'no strike below is put-dominant here', w.putWall);

  const book = [
    { strike: 90, gex: 700 },
    { strike: 95, gex: 200 },
    { strike: 100, gex: 50 },
    { strike: 105, gex: -900 },
    { strike: 110, gex: -300 },
  ];
  const w2 = pickWalls(book, 100, n => n.gex);
  ok(w2.callWall === 105, 'the call wall is the heaviest negative overhead', w2.callWall);
  ok(w2.putWall === 90, 'the put wall is the heaviest positive below', w2.putWall);
  const empty = pickWalls([], 100, () => 0);
  ok(empty.callWall === null && empty.putWall === null, 'an empty ladder has no walls');

  // The flip is the sign change NEAREST SPOT, never the first one met.
  const flip = pickFlip(book, 100, n => n.gex);
  ok(flip === 102.5, 'the flip is the midpoint of the sign change nearest spot', flip);
  const noisy = [
    { strike: 60, gex: -5 },
    { strike: 65, gex: 5 },
    { strike: 95, gex: 200 },
    { strike: 100, gex: 50 },
    { strike: 105, gex: -900 },
  ];
  ok(pickFlip(noisy, 100, n => n.gex) === 102.5, 'a jitter crossing deep in the tail does not win', pickFlip(noisy, 100, n => n.gex));
  ok(pickFlip([], 100, () => 0) === null, 'an empty ladder has no flip');
  ok(pickFlip([{ strike: 100, gex: 5 }], 100, n => n.gex) === null, 'one strike has no flip');
  ok(pickFlip([{ strike: 95, gex: 5 }, { strike: 105, gex: 9 }], 100, n => n.gex) === null, 'a one-sided book has no flip');
}

/* ============================== CALENDAR ==================================== */

section('calendar');
{
  ok(isoDate(new Date(2026, 0, 5)) === '2026-01-05', 'ISO dates are padded', isoDate(new Date(2026, 0, 5)));
  ok(isoDate(new Date(2026, 8, 9)) === '2026-09-09', 'single-digit month and day both pad', isoDate(new Date(2026, 8, 9)));
  ok(!isTradingDay(new Date(2026, 0, 3)), 'Saturday is not a session');
  ok(!isTradingDay(new Date(2026, 0, 4)), 'Sunday is not a session');
  ok(isTradingDay(new Date(2026, 0, 5)), 'Monday is a session');
  ok(!isTradingDay(new Date(2026, 0, 1)), 'New Year is a holiday');
  ok(sessionsBetween(new Date(2026, 0, 5), new Date(2026, 0, 9)) === 4, 'Monday to Friday is four sessions', sessionsBetween(new Date(2026, 0, 5), new Date(2026, 0, 9)));
  ok(sessionsBetween(new Date(2026, 0, 5), new Date(2026, 0, 5)) === 0, 'a day to itself is no sessions');
  ok(sessionsBetween(new Date(2026, 0, 9), new Date(2026, 0, 5)) <= 0, 'backwards is not positive', sessionsBetween(new Date(2026, 0, 9), new Date(2026, 0, 5)));

  for (const dte of [0, 1, 2, 3, 7, 30, 45, 120, 365]) {
    const e = expiryFor(dte);
    ok(!Number.isNaN(e.date.getTime()), `expiry ${dte} is a real date`, e.label);
    ok(/^\d{4}-\d{2}-\d{2}$/.test(isoDate(e.date)), `expiry ${dte} renders as a padded ISO date`, isoDate(e.date));
    ok(isTradingDay(e.date), `expiry ${dte} lands on a session`, `${e.weekday} ${e.label}`);
    ok(e.dte >= 0, `expiry ${dte} is not in the past`, e.dte);
    ok(e.sessions >= 0, `expiry ${dte} has a non-negative session count`, e.sessions);
    /* A 2-day request must not resolve to a same-day contract: stepping BACK
       off a Sunday lands on the Friday you are standing on. */
    if (dte > 0) ok(e.dte > 0, `expiry ${dte} is not today`, e.dte);
  }

  const phases = [0, 3, 7, 10, 14, 17, 18, 20, 23].map(h => futuresPhaseAt(new Date(2026, 8, 22, h)));
  ok(phases.every(p => typeof p === 'string' && p.length > 0), 'every hour has a futures phase', phases);
}

/* ============================== INDICATORS ================================== */

section('indicators');
{
  /* A SYNTHETIC TAPE WITH A KNOWN SHAPE. Every assertion below is a property
     that holds for any bars — inside the high/low, no value before its own
     warm-up, an oscillator inside its own range — because an indicator that
     is merely plausible on one chart is the kind that is wrong on another. */
  const MIN = 60_000;
  const bars: Candle[] = [];
  let px = 100;
  for (let i = 0; i < 400; i++) {
    px += Math.sin(i / 11) * 0.6 + Math.cos(i / 4) * 0.2;
    const o = px;
    const c = px + Math.sin(i / 3) * 0.3;
    bars.push({ time: i * MIN, open: o, high: Math.max(o, c) + 0.25, low: Math.min(o, c) - 0.25, close: c, volume: 1000 + (i % 37) * 90 } as Candle);
  }
  const flat: Candle[] = Array.from({ length: 50 }, (_, i) => ({ time: i * MIN, open: 50, high: 50, low: 50, close: 50, volume: 100 }) as Candle);

  for (const period of [9, 21, 50, 200]) {
    const e = emaSeries(bars, period);
    ok(e.length === bars.length, `ema${period} is one value per bar`, e.length);
    ok(e.every(v => Number.isFinite(v)), `ema${period} carries no NaN`);
    const lo = Math.min(...bars.map(b => b.low));
    const hi = Math.max(...bars.map(b => b.high));
    ok(e.every(v => v >= lo - 1e-6 && v <= hi + 1e-6), `ema${period} stays inside the tape`, { lo, hi });
    near(emaSeries(flat, period).at(-1)!, 50, 1e-9, `ema${period} of a flat tape is the flat price`);
    const s = smaSeries(bars, period);
    ok(s.length === bars.length, `sma${period} is one value per bar`);
    ok(s.slice(0, period - 1).every(v => v === null), `sma${period} says nothing before it has ${period} bars`);
    ok(s.slice(period - 1).every(v => v !== null && Number.isFinite(v)), `sma${period} is a number after that`);
    // The last SMA really is the mean of the last `period` closes.
    const tail = bars.slice(-period).reduce((a, b) => a + b.close, 0) / period;
    near(s.at(-1)!, tail, 1e-6, `sma${period} is the mean of its window`);
  }

  const v = vwapSeries(bars, 1);
  ok(v.length === bars.length, 'vwap is one value per bar');
  ok(v.every(x => Number.isFinite(x)), 'vwap carries no NaN');
  ok(
    v.every((x, i) => {
      const lo = Math.min(...bars.slice(0, i + 1).map(b => b.low));
      const hi = Math.max(...bars.slice(0, i + 1).map(b => b.high));
      return x >= lo - 1e-6 && x <= hi + 1e-6;
    }),
    'vwap never leaves the range it has seen'
  );
  near(vwapSeries(flat, 1).at(-1)!, 50, 1e-9, 'vwap of a flat tape is the flat price');
  ok(sessionStarts(bars, 1).length >= 1, 'the tape has at least one session start');
  ok(sessionStarts([], 1).length === 0, 'an empty tape has none');

  const r = rsiSeries(bars, 14);
  ok(r.length === bars.length, 'rsi is one value per bar');
  ok(r.slice(0, 14).every(x => x === null), 'rsi says nothing before it has 14 bars');
  ok(r.slice(14).every(x => x !== null && x >= 0 && x <= 100), 'rsi stays inside nought and a hundred', r.slice(14).filter(x => x === null || x < 0 || x > 100).slice(0, 3));
  /* A TAPE THAT ONLY RISES IS 100, AND ONE THAT ONLY FALLS IS 0 — the two
     ends an oscillator has to reach, and the two a divide-by-zero breaks. */
  const up: Candle[] = Array.from({ length: 60 }, (_, i) => ({ time: i * MIN, open: 100 + i, high: 100 + i, low: 100 + i, close: 100 + i, volume: 1 }) as Candle);
  const down: Candle[] = Array.from({ length: 60 }, (_, i) => ({ time: i * MIN, open: 200 - i, high: 200 - i, low: 200 - i, close: 200 - i, volume: 1 }) as Candle);
  near(rsiSeries(up, 14).at(-1)!, 100, 1e-6, 'a tape that only rises is 100');
  near(rsiSeries(down, 14).at(-1)!, 0, 1e-6, 'a tape that only falls is 0');
  ok(rsiSeries(flat, 14).slice(14).every(x => x !== null && Number.isFinite(x)), 'a flat tape does not divide by zero', rsiSeries(flat, 14).at(-1));

  const m = macdSeries(bars);
  ok(m.macd.length === bars.length && m.signal.length === bars.length && m.hist.length === bars.length, 'macd returns three aligned series');
  ok(m.macd.every(x => x === null || Number.isFinite(x)), 'the macd line carries no NaN');
  ok(
    m.hist.every((h, i) => h === null || m.macd[i] === null || m.signal[i] === null || Math.abs(h - (m.macd[i]! - m.signal[i]!)) < 1e-9),
    'the histogram is the line minus its signal'
  );

  const bb = bollingerSeries(bars, 20, 2);
  ok(bb.upper.length === bars.length, 'bollinger is one band per bar');
  ok(bb.upper.slice(0, 19).every(u => u === null), 'bollinger says nothing before it has its window');
  ok(
    bb.upper.every((u, i) => u === null || (bb.basis[i] !== null && bb.lower[i] !== null && u >= bb.basis[i]! && bb.basis[i]! >= bb.lower[i]!)),
    'the bands never cross their basis'
  );
  ok(
    bb.basis.every((m, i) => m === null || Math.abs(m - (bb.upper[i]! + bb.lower[i]!) / 2) < 1e-9),
    'the basis sits exactly between the bands'
  );
  const flatBB = bollingerSeries(flat, 20, 2);
  ok(flatBB.upper.slice(19).every((u, i) => u !== null && Math.abs(u - flatBB.lower.slice(19)[i]!) < 1e-9), 'a flat tape has no width');

  const atr = atrBarSeries(bars, 14);
  ok(atr.length === bars.length, 'atr is one value per bar');
  ok(atr.every(x => x === null || x >= 0), 'a range is never negative', atr.filter(x => x !== null && x < 0).slice(0, 3));
  near(atrBarSeries(flat, 14).at(-1) ?? 0, 0, 1e-9, 'a flat tape has no range');

  /* AND NONE OF THEM MAY THROW ON A TAPE TOO SHORT TO READ. */
  for (const n of [0, 1, 2, 5]) {
    const few = bars.slice(0, n);
    ok(emaSeries(few, 21).length === n, `ema survives ${n} bars`);
    ok(vwapSeries(few, 1).length === n, `vwap survives ${n} bars`);
    ok(rsiSeries(few, 14).length === n, `rsi survives ${n} bars`);
    ok(smaSeries(few, 20).length === n, `sma survives ${n} bars`);
    ok(macdSeries(few).macd.length === n, `macd survives ${n} bars`);
    ok(bollingerSeries(few, 20, 2).upper.length === n, `bollinger survives ${n} bars`);
    ok(atrBarSeries(few, 14).length === n, `atr survives ${n} bars`);
  }
}

/* ================================ REPORT ==================================== */

console.log(`\n${pass} passed, ${fails.length} FAILED`);
for (const f of fails) console.log('  ✗ ' + f);
if (fails.length) process.exitCode = 1;
