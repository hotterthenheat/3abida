"""
PARITY WITH THE TYPESCRIPT ENGINE. scripts/greeks-ref.ts runs src/core/greeks.ts
over a grid and writes tests/fixtures/greeks_ref.json; this test holds every
Python output to it. 1e-12 relative is the bar: the two are the same
arithmetic in the same order with the same polynomial, so anything looser
would be hiding a real difference.

Also holds the vectorised forms to the scalar forms, so the whole-chain path
the loop uses is the same math as the reference.
"""

import json
import math
from pathlib import Path

import numpy as np
import pytest

from slayer_core import black_scholes_greeks, black_scholes_price, implied_vol_from_price, reset_carry
from slayer_core.greeks import black_scholes_greeks_v, black_scholes_price_v

REF = Path(__file__).parent / "fixtures" / "greeks_ref.json"

FIELDS = {
    "deltaCall": "delta_call",
    "deltaPut": "delta_put",
    "gamma": "gamma",
    "vega": "vega",
    "vanna": "vanna",
    "charmCall": "charm_call",
    "charmPut": "charm_put",
    "rhoCall": "rho_call",
    "rhoPut": "rho_put",
}


def close(a: float, b: float, rel: float = 1e-12, abs_: float = 1e-15) -> bool:
    return math.isclose(a, b, rel_tol=rel, abs_tol=abs_)


@pytest.fixture(scope="module")
def ref():
    if not REF.exists():
        pytest.skip("run `npx tsx scripts/greeks-ref.ts` first to write the reference")
    data = json.loads(REF.read_text())
    reset_carry()
    from slayer_core import get_carry

    c = get_carry()
    assert (c.r, c.q) == (data["carry"]["r"], data["carry"]["q"]), "the carry defaults drifted from the TypeScript seam"
    return data


def test_greeks_match_typescript(ref):
    for case in ref["cases"]:
        g = black_scholes_greeks(case["S"], case["K"], case["t"], case["v"])
        for ts_name, py_name in FIELDS.items():
            want = case["greeks"][ts_name]
            got = getattr(g, py_name)
            assert close(got, want), f"{py_name} S={case['S']} K={case['K']} t={case['t']} v={case['v']}: {got} vs {want}"


def test_prices_match_typescript(ref):
    for case in ref["cases"]:
        call = black_scholes_price(case["S"], case["K"], case["t"], case["v"], "C")
        put = black_scholes_price(case["S"], case["K"], case["t"], case["v"], "P")
        assert close(call, case["call"]), f"call S={case['S']} K={case['K']} t={case['t']} v={case['v']}"
        assert close(put, case["put"]), f"put S={case['S']} K={case['K']} t={case['t']} v={case['v']}"


def test_implied_vol_matches_typescript(ref):
    for case in ref["cases"]:
        for right, key, price_key in (("C", "ivFromCall", "call"), ("P", "ivFromPut", "put")):
            want = case[key]
            got = implied_vol_from_price(case[price_key], case["S"], case["K"], case["t"], right)
            if want is None:
                assert got is None, f"{key} S={case['S']} K={case['K']} t={case['t']} v={case['v']}: expected None"
            else:
                assert got is not None and close(got, want, rel=1e-9, abs_=1e-9), f"{key} S={case['S']} K={case['K']} t={case['t']} v={case['v']}: {got} vs {want}"


def test_vectorised_matches_scalar(ref):
    cases = [c for c in ref["cases"] if c["t"] > 0 and c["v"] > 0]
    S = np.array([c["S"] for c in cases])
    K = np.array([c["K"] for c in cases])
    t = np.array([c["t"] for c in cases])
    v = np.array([c["v"] for c in cases])
    gv = black_scholes_greeks_v(S, K, t, v)
    calls = black_scholes_price_v(S, K, t, v, np.ones(len(cases), dtype=bool))
    puts = black_scholes_price_v(S, K, t, v, np.zeros(len(cases), dtype=bool))
    for i, c in enumerate(cases):
        g = black_scholes_greeks(c["S"], c["K"], c["t"], c["v"])
        for _, py_name in FIELDS.items():
            assert close(float(gv[py_name][i]), getattr(g, py_name)), f"vectorised {py_name} case {i}"
        assert close(float(calls[i]), black_scholes_price(c["S"], c["K"], c["t"], c["v"], "C"))
        assert close(float(puts[i]), black_scholes_price(c["S"], c["K"], c["t"], c["v"], "P"))


def test_vectorised_floors_match_scalar():
    # t and v at or below zero take the engine's floors, elementwise
    gv = black_scholes_greeks_v(np.array([100.0, 100.0]), np.array([100.0, 100.0]), np.array([0.0, 0.1]), np.array([0.2, 0.0]))
    g0 = black_scholes_greeks(100, 100, 0, 0.2)
    g1 = black_scholes_greeks(100, 100, 0.1, 0)
    assert close(float(gv["gamma"][0]), g0.gamma)
    assert close(float(gv["gamma"][1]), g1.gamma)
