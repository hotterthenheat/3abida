/*
  Recomputes the partner spec's worked numerical fixtures (10-of-10 standard,
  §46) with our own arithmetic before any engine code depends on the
  conventions. The spec itself corrected these numbers between versions
  (GEX −1,977 → −1,764; EV $74.25 → $74.00, §60) and mandates that published
  arithmetic be verified by code — this is that verification, on our side.

  Run: npx tsx scripts/fixture-proof.ts
*/

type Row = { oi: number; sign: number; delta: number; gamma: number };

// §46 inventory table: S0 = 100, multiplier M = 100.
const S0 = 100;
const M = 100;
const BOOK: Row[] = [
  { oi: 1000, sign: -0.6, delta: 0.52, gamma: 0.025 }, // Call 100
  { oi: 800, sign: -0.35, delta: 0.31, gamma: 0.021 }, // Call 105
  { oi: 900, sign: 0.2, delta: -0.22, gamma: 0.018 }, // Put 95
];

let pass = 0,
  fail = 0;
const check = (name: string, got: number, want: number, tol = 1e-9) => {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — got ${got}, spec says ${want}`);
  ok ? pass++ : fail++;
};

// Dealer delta inventory in share-equivalents: Σ s·δ·OI·M  (spec §46 eq. 331)
const dealerDexShares = BOOK.reduce((a, r) => a + r.sign * r.delta * r.oi * M, 0);
check('DealerDEX shares', dealerDexShares, -43840);
check('Required hedge = −inventory', -dealerDexShares, 43840);

// GEX per 1% spot move: Σ s·γ·OI·M·(0.01·S0)  (spec §46 eq. 334)
const gexShares1pct = BOOK.reduce((a, r) => a + r.sign * r.gamma * r.oi * M * 0.01 * S0, 0);
check('GEX shares per 1% move', gexShares1pct, -1764);
check('+1% move hedge change = −GEX', -gexShares1pct, 1764);

// Scenario EV fixture (spec §46 eq. 336): entry 2.60, exit cost 0.08, M = 100.
const SCENARIOS = [
  { p: 0.25, value: 1.05 },
  { p: 0.45, value: 2.55 },
  { p: 0.3, value: 6.7 },
];
const ENTRY = 2.6;
const EXIT_COST = 0.08;
const pnl = (v: number) => v - ENTRY - EXIT_COST;
const ev = M * SCENARIOS.reduce((a, s) => a + s.p * pnl(s.value), 0);
check('Scenario EV dollars', ev, 74, 1e-6);

// POP = probability-weighted count of profitable scenarios — only "up" wins.
const pop = SCENARIOS.reduce((a, s) => a + (pnl(s.value) > 0 ? s.p : 0), 0);
check('POP (separate from EV)', pop, 0.3);

// Partner answer #4 (2026-08-02): v1 utility = EV − 1.0·ES95, both in dollars.
// ES here over the loss tail of the fixture: losing scenarios are down & flat.
const losses = SCENARIOS.filter(s => pnl(s.value) < 0);
const es = (-M * losses.reduce((a, s) => a + s.p * pnl(s.value), 0)) / losses.reduce((a, s) => a + s.p, 0);
const utility = ev - 1.0 * es;
console.log(`INFO  loss-tail ES ≈ $${es.toFixed(2)}, v1 Utility = EV − ES ≈ $${utility.toFixed(2)} (sign check: tail-aware utility can reject a +EV trade)`);
check('Tail-aware utility below raw EV', utility < ev ? 1 : 0, 1);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
