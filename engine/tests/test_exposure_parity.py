"""
PARITY WITH THE TYPESCRIPT EXPOSURE ENGINES. scripts/exposure-ref.ts runs the
simulator's chain builder, buildExposureProfile, buildExposureSurface, the
walls and the air pockets over five seeded books and writes
tests/fixtures/exposure_ref.json; every Python output here is held to it.

The texture the simulator adds (the leg jitter, the volume hash, the desk's
chains per expiry) is read from the fixture as INPUT, the way the live loop
will read a real chain. 1e-12 relative on dollars; exact on strikes, indices,
dates, kinds and words.
"""

import json
import math
from datetime import date
from pathlib import Path

import numpy as np
import pytest

from slayer_core.exposure import (
    CHAIN_FIELDS,
    DEALER_CALL,
    FRONT_T,
    GREEKS,
    LegFacts,
    DeskExpiry,
    build_exposure_profile,
    build_exposure_surface,
    chain_exposures,
    chain_from_rows,
    desk_expiry_from_rows,
)
from slayer_core.greeks import black_scholes_greeks_v
from slayer_core.walls import find_air_pockets, pick_flip, pick_walls

REF = Path(__file__).parent / "fixtures" / "exposure_ref.json"

# the simulator's StrikeNode, field for field
NODE = {
    "strike": "strike", "callOI": "call_oi", "putOI": "put_oi", "gamma": "gamma",
    "callGex": "call_gex", "putGex": "put_gex", "netGex": "net_gex",
    "callDex": "call_dex", "putDex": "put_dex", "netDex": "net_dex",
    "callVex": "call_vex", "putVex": "put_vex", "netVex": "net_vex",
    "vanna": "vanna", "charm": "charm",
    "callVanna": "call_vanna", "putVanna": "put_vanna", "netVanna": "net_vanna",
    "callCharm": "call_charm", "putCharm": "put_charm", "netCharm": "net_charm",
}
assert set(NODE.values()) == set(CHAIN_FIELDS)


def close(a: float, b: float, rel: float = 1e-12, abs_: float = 1e-9) -> bool:
    return math.isclose(a, b, rel_tol=rel, abs_tol=abs_)


def chain_of(book) -> dict:
    return chain_from_rows({NODE[k]: v for k, v in n.items()} for n in book["chain"])


def profile_of(book, case):
    return build_exposure_profile(chain_of(book), book["spot"], case["half"], ticker=book["ticker"], expiry=case["expiry"], jitter=case["jitter"], volume=book["volume"])


def expiries_of(case) -> list[DeskExpiry]:
    return [desk_expiry_from_rows(d["dte"], d["sessions"], date.fromisoformat(d["date"]), d["rows"]) for d in case["surface"]["desk"]]


@pytest.fixture(scope="module")
def ref():
    if not REF.exists():
        pytest.skip("run `npx tsx scripts/exposure-ref.ts` first to write the reference")
    return json.loads(REF.read_text())


# ---- the chain ---------------------------------------------------------------------------

def test_chain_exposures_match_the_simulator(ref):
    for book in ref["books"]:
        nodes = book["chain"]
        c = chain_exposures(book["spot"], [n["strike"] for n in nodes], [n["callOI"] for n in nodes], [n["putOI"] for n in nodes], FRONT_T, book["iv"])
        for i, n in enumerate(nodes):
            for ts_name, py_name in NODE.items():
                assert close(float(c[py_name][i]), n[ts_name]), f"{book['ticker']} strike {n['strike']} {py_name}: {c[py_name][i]} vs {n[ts_name]}"


def test_the_prior_is_a_parameter(ref):
    book = ref["books"][0]
    nodes = book["chain"]
    args = (book["spot"], [n["strike"] for n in nodes], [n["callOI"] for n in nodes], [n["putOI"] for n in nodes], FRONT_T, book["iv"])
    base = chain_exposures(*args)
    off = chain_exposures(*args, dealer_call=0.0)
    for f in ("call_gex", "call_dex", "call_vex", "call_vanna", "call_charm"):
        assert not np.any(off[f])
    for f in ("put_gex", "put_dex", "put_vex", "put_vanna", "put_charm"):
        assert np.array_equal(off[f], base[f])


# ---- the profile -----------------------------------------------------------------------------

def test_profile_matches_typescript(ref):
    for book in ref["books"]:
        for case in book["cases"]:
            want = case["profile"]
            got = profile_of(book, case)
            tag = f"{book['ticker']} half {case['half']} {case['expiry']}"
            assert len(got.strikes) == len(want["strikes"]), tag
            for row, w in zip(got.strikes, want["strikes"]):
                assert row.strike == w["strike"], tag
                assert row.pin == bool(w.get("pin")), f"{tag} pin at {row.strike}"
                for g in GREEKS:
                    split = getattr(row, g)
                    for side in ("put", "call", "net"):
                        assert close(getattr(split, side), w[g][side]), f"{tag} {g}.{side} at {row.strike}: {getattr(split, side)} vs {w[g][side]}"
                assert row.oi == w["oi"] and row.volume == w["volume"], tag
            for g in GREEKS:
                assert close(got.max_abs[g], want["maxAbs"][g]), f"{tag} maxAbs {g}"
            assert close(got.net_gex, want["netGex"]) and close(got.net_dex, want["netDex"]) and close(got.net_vex, want["netVex"]), tag
            lv, wl = got.levels, want["levels"]
            assert (lv.spot, lv.call_wall, lv.put_wall, lv.pin, lv.flip, lv.supreme) == (wl["spot"], wl["callWall"], wl["putWall"], wl["pin"], wl["flip"], wl["supreme"]), tag
            assert [(z.from_, z.to, z.kind) for z in got.zones] == [(z["from"], z["to"], z["kind"]) for z in want["zones"]], tag
            assert got.bias == want["bias"], tag


def test_no_jitter_shifts_nothing(ref):
    book = ref["books"][0]
    case = book["cases"][0]
    chain = chain_of(book)
    textured = profile_of(book, case)
    plain = build_exposure_profile(chain, book["spot"], case["half"], expiry=case["expiry"])
    # the same window, the same levels, the same nets: the jitter only moves weight between the legs
    assert plain.levels == textured.levels
    assert np.array_equal(plain.window["strike"], textured.window["strike"])
    for g in GREEKS:
        assert np.allclose(plain.window[f"{g}_net"], textured.window[f"{g}_net"], rtol=1e-12, atol=0)
    # and without it, the legs are the raw legs
    by = {float(s): i for i, s in enumerate(chain["strike"])}
    for i, s in enumerate(plain.window["strike"]):
        assert plain.window["gex_put"][i] == chain["put_gex"][by[float(s)]]
        assert plain.window["gex_call"][i] == chain["call_gex"][by[float(s)]]


# ---- the surface -----------------------------------------------------------------------------

def test_surface_matches_typescript(ref):
    for book in ref["books"]:
        for case in book["cases"]:
            if not case["surface"]:
                continue
            want = case["surface"]["out"]
            front = profile_of(book, case)
            got = build_exposure_surface(front, book["spot"], expiries_of(case), ticker=book["ticker"], change_pct=book["changePct"])
            tag = f"{book['ticker']} half {case['half']} dtes {case['surface']['dtes']}"
            assert got.ticker == want["ticker"] and got.spot == want["spot"] and close(got.change_pct, want["changePct"]), tag
            assert list(got.strikes) == want["strikes"], tag
            assert len(got.expiries) == len(want["expiries"]), tag
            for e, w in zip(got.expiries, want["expiries"]):
                assert (e.dte, e.short, e.date, e.sessions) == (w["dte"], w["short"], w["date"], w["sessions"]), f"{tag} expiry {w}"
                assert close(e.iv, w["iv"]), f"{tag} expiry iv {e.iv} vs {w['iv']}"
            E, S = len(want["expiries"]), len(want["strikes"])
            for g in GREEKS:
                for grid, name in ((got.put, "put"), (got.call, "call"), (got.net, "net")):
                    assert grid[g].shape == (E, S), tag
                    for e in range(E):
                        for s in range(S):
                            assert close(float(grid[g][e, s]), want[name][g][e][s]), f"{tag} {name}.{g}[{e}][{s}]: {grid[g][e, s]} vs {want[name][g][e][s]}"
                assert close(got.max_abs[g], want["maxAbs"][g]), f"{tag} maxAbs {g}"
                k, wk = got.king[g], want["king"][g]
                assert (k.strike, k.e) == (wk["strike"], wk["e"]) and close(k.value, wk["value"]), f"{tag} king {g}: {k} vs {wk}"
                sp, ws = got.supreme[g], want["supreme"][g]
                assert (sp.strike, sp.e) == (ws["strike"], ws["e"]) and close(sp.value, ws["value"]) and close(sp.total, ws["total"]), f"{tag} supreme {g}: {sp} vs {ws}"
            assert got.oi.shape == (E, S) and got.oi.tolist() == want["oi"], tag
            lv, wl = got.levels, want["levels"]
            assert (lv.spot, lv.call_wall, lv.put_wall, lv.pin, lv.flip, lv.supreme) == (wl["spot"], wl["callWall"], wl["putWall"], wl["pin"], wl["flip"], wl["supreme"]), tag


def test_one_source_anchor_reduces_to_the_prior(ref):
    """
    With the front and the calendar priced off ONE chain (the live book), the
    anchor is the dealer prior: a second expiry with the same contracts draws
    the same signed legs as the front row, and no ratio is invented.
    """
    book = ref["books"][0]
    nodes = book["chain"]
    spot, iv = book["spot"], book["iv"]
    strikes = np.array([n["strike"] for n in nodes], dtype=float)
    call_oi = np.array([n["callOI"] for n in nodes], dtype=float)
    put_oi = np.array([n["putOI"] for n in nodes], dtype=float)
    chain = chain_exposures(spot, strikes, call_oi, put_oi, FRONT_T, iv)
    front = build_exposure_profile(chain, spot, 10)
    g = black_scholes_greeks_v(spot, strikes, FRONT_T, iv)
    put = LegFacts(put_oi, np.full(strikes.size, iv), g["gamma"], g["delta_put"], g["vega"])
    call = LegFacts(call_oi, np.full(strikes.size, iv), g["gamma"], g["delta_call"], g["vega"])
    expiries = [DeskExpiry(0, 0, date(2026, 9, 17), strikes, put, call), DeskExpiry(1, 1, date(2026, 9, 18), strikes, put, call)]
    surf = build_exposure_surface(front, spot, expiries)
    for grid in (surf.put["gex"], surf.call["gex"], surf.net["gex"]):
        assert np.allclose(grid[1], grid[0], rtol=1e-12, atol=0)
    # the ratio the anchor found IS the prior
    d0 = call_oi * 100 * g["gamma"] * spot * spot * 0.01
    sel = np.isin(strikes, surf.strikes)
    k = np.abs(surf.call["gex"][0]) / d0[sel][np.argsort(strikes[sel])]
    assert np.allclose(k, abs(DEALER_CALL), rtol=1e-12, atol=0)


# ---- the rules on their edges ----------------------------------------------------------------

def test_walls_and_flip_edge_cases(ref):
    for b in ref["walls"]:
        cw, pw = pick_walls(b["strikes"], b["values"], b["spot"])
        assert (cw, pw) == (b["callWall"], b["putWall"]), f"{b['name']}: walls {(cw, pw)} vs {(b['callWall'], b['putWall'])}"
        assert pick_flip(b["strikes"], b["values"], b["spot"]) == b["flip"], f"{b['name']}: flip"


def test_air_pockets(ref):
    for b in ref["pockets"]:
        got = [(p.from_, p.to, p.width, p.ceiling, p.floor, p.peak_share) for p in find_air_pockets(b["strikes"], b["net"])]
        want = [(p["from"], p["to"], p["width"], p["ceiling"], p["floor"], p["peakShare"]) for p in b["out"]]
        assert len(got) == len(want), f"{b['name']}: {got} vs {want}"
        for g, w in zip(got, want):
            assert g[:5] == w[:5] and close(g[5], w[5]), f"{b['name']}: {g} vs {w}"
