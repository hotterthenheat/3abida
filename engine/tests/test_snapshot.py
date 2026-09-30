"""
THE PHOTOGRAPH. The indicators are held to the simulator's getIndicators through
scripts/indicators-ref.ts; the vectorised implied vol to the scalar bisection;
the rest (the constant-maturity vol, the IV rank, the builder over a frame drawn
from Black-Scholes prices at a known vol) is checked against what those rules
must produce by construction.
"""

import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pyarrow as pa
import pytest

from slayer_core.calendar import next_session, sessions_between
from slayer_core.greeks import black_scholes_price_v, implied_vol_from_price, implied_vol_v
from slayer_core.indicators import indicators
from slayer_core.snapshot import (
    BASE_IV_SESSIONS,
    IV_RANK_MIN_HISTORY,
    build_photograph,
    constant_maturity_iv,
    feature_market,
    iv_rank,
    years_of,
)
from slayer_core.tape import BARS, OPEN_INTEREST, QUOTES, TapeFrame

FIX = Path(__file__).parent / "fixtures"


def close(a: float, b: float, rel: float = 1e-12, abs_: float = 1e-12) -> bool:
    return math.isclose(a, b, rel_tol=rel, abs_tol=abs_)


# ---- the indicators, held to the simulator --------------------------------------------------

@pytest.fixture(scope="module")
def ind_ref():
    path = FIX / "indicators_ref.json"
    if not path.exists():
        pytest.skip("run `npx tsx scripts/indicators-ref.ts` first to write the reference")
    return json.loads(path.read_text())


def test_indicators_match_typescript(ind_ref):
    for case in ind_ref["cases"]:
        got = indicators(case["prices"])
        want = case["out"]
        for k in ("rsi", "ema9", "ema21", "ema50"):
            assert close(getattr(got, k), want[k]), f"{case['name']}: {k} {getattr(got, k)} vs {want[k]}"
        assert got.squeeze == want["squeeze"], case["name"]


def test_indicators_refuse_an_empty_series():
    with pytest.raises(ValueError):
        indicators([])


# ---- the vectorised inversion, held to the scalar ---------------------------------------------

@pytest.fixture(scope="module")
def greeks_ref():
    path = FIX / "greeks_ref.json"
    if not path.exists():
        pytest.skip("run `npx tsx scripts/greeks-ref.ts` first")
    return json.loads(path.read_text())


def test_implied_vol_v_matches_scalar(greeks_ref):
    cases = [c for c in greeks_ref["cases"] if c["t"] > 0 and c["v"] > 0]
    S = np.array([c["S"] for c in cases])
    K = np.array([c["K"] for c in cases])
    t = np.array([c["t"] for c in cases])
    calls = np.array([c["call"] for c in cases])
    puts = np.array([c["put"] for c in cases])
    iv_c = implied_vol_v(calls, S, K, t, np.ones(len(cases), dtype=bool))
    iv_p = implied_vol_v(puts, S, K, t, np.zeros(len(cases), dtype=bool))
    for i, c in enumerate(cases):
        for got, price, right in ((iv_c[i], c["call"], "C"), (iv_p[i], c["put"], "P")):
            want = implied_vol_from_price(price, c["S"], c["K"], c["t"], right)
            if want is None:
                assert np.isnan(got), c
            else:
                assert close(float(got), want, rel=1e-9, abs_=1e-9), f"{c} {right}: {got} vs {want}"


def test_implied_vol_v_outside_the_model_is_nan():
    iv = implied_vol_v([0.0, 150.0, 5.0], 100.0, 100.0, 0.1, [True, True, True])
    assert np.isnan(iv[0]) and np.isnan(iv[1]) and np.isfinite(iv[2])


# ---- the base vol and the rank -----------------------------------------------------------------

def test_constant_maturity_iv():
    assert close(constant_maturity_iv([5 / 252, 30 / 252, 90 / 252], [0.2, 0.2, 0.2], 21 / 252), 0.2)
    t1, v1, t2, v2, tt = 10 / 252, 0.2, 40 / 252, 0.3, 21 / 252
    w1 = (t2 - tt) / (t2 - t1)
    w2 = (tt - t1) / (t2 - t1)
    want = math.sqrt((v1 * v1 * t1 * w1 + v2 * v2 * t2 * w2) / tt)
    assert close(constant_maturity_iv([t1, t2], [v1, v2], tt), want)
    assert close(constant_maturity_iv([2 / 252, 5 / 252], [0.4, 0.3], tt), 0.3)  # nothing above: the nearest
    assert close(constant_maturity_iv([40 / 252, 90 / 252], [0.4, 0.3], tt), 0.4)  # nothing below: the nearest
    assert close(constant_maturity_iv([21 / 252, 90 / 252], [0.4, 0.3], 21 / 252), 0.4)  # an exact tenor
    assert math.isnan(constant_maturity_iv([], [], tt))
    assert close(constant_maturity_iv([float("nan"), 30 / 252], [0.5, 0.25], tt), 0.25)


def test_iv_rank():
    assert iv_rank(15.0, [10.0, 20.0]) is None  # too short a history
    hist = np.linspace(10.0, 20.0, IV_RANK_MIN_HISTORY + 1)
    assert close(iv_rank(15.0, hist), 50.0)
    assert close(iv_rank(25.0, hist), 100.0)  # clamped
    assert close(iv_rank(5.0, hist), 0.0)
    assert iv_rank(15.0, np.full(IV_RANK_MIN_HISTORY, 12.0)) is None  # a flat history ranks nothing
    assert iv_rank(float("nan"), hist) is None


def test_years_of():
    assert close(years_of(0), 0.5 / 252)
    assert close(years_of(5), 5 / 252)


# ---- the builder over a frame drawn from Black-Scholes at a known vol --------------------------

SESSION = date(2026, 9, 17)  # a Thursday
AT = datetime(2026, 9, 17, 15, 30, tzinfo=timezone.utc)


def drawn_frame(spot: float = 100.0, front_iv: float = 0.25, back_iv: float = 0.22, unquoted=(), dead_back: bool = False) -> TapeFrame:
    front = next_session(SESSION + timedelta(days=4))  # the Monday
    back = next_session(SESSION + timedelta(days=32))
    strikes = np.arange(90.0, 111.0)
    rows = {k: [] for k in QUOTES.names}
    oi = {k: [] for k in OPEN_INTEREST.names}
    for exp, iv in ((front, front_iv), (back, back_iv)):
        t = years_of(sessions_between(SESSION, exp))
        for is_call in (False, True):
            prices = black_scholes_price_v(spot, strikes, t, iv, np.full(strikes.size, is_call))
            for k, p in zip(strikes, prices):
                bid = max(0.0, float(p) - 0.005)
                ask = float(p) + 0.005
                if dead_back and exp == back:
                    bid, ask = 0.0, 0.0
                if (exp, k, is_call) in unquoted:
                    continue
                rows["timestamp"].append(AT)
                rows["expiration"].append(exp)
                rows["strike"].append(float(k))
                rows["right"].append("C" if is_call else "P")
                rows["bid"].append(bid)
                rows["ask"].append(ask)
                rows["bid_size"].append(10)
                rows["ask_size"].append(12)
                oi["expiration"].append(exp)
                oi["strike"].append(float(k))
                oi["right"].append("C" if is_call else "P")
                oi["open_interest"].append(int(1000 + 50 * (110 - k) if is_call else 800 + 40 * (k - 90)))
    return TapeFrame("TEST", AT, AT, SESSION, spot, AT - timedelta(minutes=1), pa.table(rows, schema=QUOTES), pa.table(oi, schema=OPEN_INTEREST))


def test_photograph_recovers_the_vol_it_was_drawn_from():
    photo = build_photograph(drawn_frame(), closes=np.linspace(99, 101, 80), tape_version="v1")
    assert photo.quality.expiries == 2 and photo.quality.dropped_expiries == 0 and photo.quality.filled == 0
    assert close(photo.expiries[0].atm_iv, 0.25, rel=1e-6, abs_=1e-6)
    assert close(photo.expiries[1].atm_iv, 0.22, rel=1e-6, abs_=1e-6)
    # the base vol sits between the two, nearer the back (21 sessions is nearer the back expiry than the front)
    assert 22.0 < photo.base_iv_pct < 25.0
    assert photo.iv_rank is None  # no history offered
    assert photo.front.levels.spot == 100.0 and len(photo.front.strikes) == 21
    assert [e.sessions for e in photo.surface.expiries] == [p.desk.sessions for p in photo.expiries]
    assert photo.data_version == "tape@v1|photo@0.1.0"
    market = feature_market(photo)
    assert market["ticker"] == "TEST" and market["decided_at"] == "2026-09-17T15:30:00Z"
    assert set(market) == {"ticker", "decided_at", "spot", "iv_rank", "base_iv_pct", "rsi", "gex", "data_version"}
    assert market["gex"].call_wall == photo.front.levels.call_wall


def test_photograph_fills_an_unquoted_contract_and_counts_it():
    front = next_session(SESSION + timedelta(days=4))
    photo = build_photograph(drawn_frame(unquoted={(front, 104.0, True)}))
    assert photo.quality.filled == 1
    i = int(np.flatnonzero(photo.expiries[0].desk.strikes == 104.0)[0])
    assert close(photo.expiries[0].desk.call.iv[i], photo.expiries[0].atm_iv)


def test_photograph_drops_a_dead_expiry_and_refuses_a_dead_frame():
    photo = build_photograph(drawn_frame(dead_back=True))
    assert photo.quality.expiries == 1 and photo.quality.dropped_expiries == 1
    dead = drawn_frame(dead_back=True)
    front_only = dead.quotes.filter(pa.compute.equal(dead.quotes["ask"], 0.0))
    with pytest.raises(ValueError):
        build_photograph(TapeFrame("TEST", AT, AT, SESSION, 100.0, None, front_only, dead.open_interest))


def test_photograph_ranks_against_the_history_it_is_given():
    hist = np.linspace(10.0, 40.0, IV_RANK_MIN_HISTORY + 5)
    photo = build_photograph(drawn_frame(), iv_history=hist)
    assert photo.iv_rank is not None and 0 <= photo.iv_rank <= 100
    assert close(photo.iv_rank, 100 * (photo.base_iv_pct - 10) / 30)


def test_base_iv_tenor_is_twenty_one_sessions():
    assert BASE_IV_SESSIONS == 21
