"""
THE PARTNER SPEC'S WORKED NUMBERS (10-of-10 standard, §46), recomputed here
before any engine code depends on the conventions - the Python twin of
scripts/fixture-proof.ts. The spec corrected these between versions
(GEX -1,977 -> -1,764; EV $74.25 -> $74.00, §60) and mandates that published
arithmetic be verified by code. Every ported function gets this judge before
it exists.
"""

S0 = 100.0
M = 100.0
# §46 inventory table: (oi, dealer sign, delta, gamma)
BOOK = [
    (1000, -0.6, 0.52, 0.025),  # Call 100
    (800, -0.35, 0.31, 0.021),  # Call 105
    (900, 0.2, -0.22, 0.018),  # Put 95
]


def test_dealer_dex_shares():
    # dealer delta inventory in share-equivalents: sum s·delta·OI·M (eq. 331)
    dex = sum(sign * delta * oi * M for oi, sign, delta, _ in BOOK)
    assert abs(dex - (-43840)) <= 1e-9
    assert abs(-dex - 43840) <= 1e-9  # the required hedge is minus the inventory


def test_gex_shares_per_1pct():
    # GEX per 1% spot move: sum s·gamma·OI·M·(0.01·S0) (eq. 334)
    gex = sum(sign * gamma * oi * M * 0.01 * S0 for oi, sign, _, gamma in BOOK)
    assert abs(gex - (-1764)) <= 1e-9
    assert abs(-gex - 1764) <= 1e-9


# Scenario EV fixture (eq. 336): entry 2.60, exit cost 0.08, M = 100
SCENARIOS = [(0.25, 1.05), (0.45, 2.55), (0.3, 6.7)]
ENTRY = 2.6
EXIT_COST = 0.08


def pnl(value: float) -> float:
    return value - ENTRY - EXIT_COST


def test_scenario_ev_dollars():
    ev = M * sum(p * pnl(v) for p, v in SCENARIOS)
    assert abs(ev - 74.0) <= 1e-6


def test_pop_is_separate_from_ev():
    pop = sum(p for p, v in SCENARIOS if pnl(v) > 0)
    assert abs(pop - 0.3) <= 1e-9


def test_tail_aware_utility_below_raw_ev():
    # partner answer #4 (2026-08-02): v1 utility = EV - 1.0·ES95, both in dollars
    ev = M * sum(p * pnl(v) for p, v in SCENARIOS)
    losses = [(p, v) for p, v in SCENARIOS if pnl(v) < 0]
    es = (-M * sum(p * pnl(v) for p, v in losses)) / sum(p for p, _ in losses)
    utility = ev - 1.0 * es
    assert utility < ev
    assert abs(utility - 7.43) < 0.01  # the fixture trade grades +$7.43 under v1 utility, not +$74
