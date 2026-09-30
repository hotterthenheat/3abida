"""
THE EXPOSURE BOOK (ported from the chain builder in src/core/simulator.ts,
src/data/exposure.ts and src/data/exposureSurface.ts, 2026-09-17).

Three layers, each held to the TypeScript by tests/test_exposure_parity.py:

  chain_exposures          one expiry's contracts -> the five exposures per
                           leg (GEX, DEX, VEX, vanna, charm) with the dealers'
                           prior on them: the StrikeNode every surface reads
  build_exposure_profile   the book through one lens: a window of strikes
                           around spot, the walls, the flip, the pin, the
                           supreme, the zones, the bias
  build_exposure_surface   strike x expiry x greek: the front row is the
                           profile's own numbers, the calendar behind it is
                           each expiry's legs anchored to the front

WHAT IS PORTED AND WHAT IS NOT. The TypeScript builds these off a simulator:
its open interest is a seeded book, the profile's legs carry a per-strike
jitter (texture; net-preserving), the volume is a hash of open interest, and
the farther expiries come from the desk's modelled chain. None of that texture
is math the live loop should own, so the port takes it as INPUTS. `jitter`
and `volume` are optional arrays (the parity fixture supplies the simulator's;
the live book passes none, and no jitter shifts nothing), and each expiry
arrives as its own contracts (`DeskExpiry`: from the simulator's desk in the
fixture, from ThetaData in the loop). The RULES are what is ported, exactly.

THE DEALER PRIOR: -0.55 on calls, -0.53 on puts (the simulator's chain builder;
the spec's section 48.3 sanctions a fixed prior with sensitivity bands until
the latent-inventory filter exists). It is a parameter here so the bands are
the same functions called at prior +/- band.

SIGNS. Net is call + put. GEX flips the put leg's prior (x -1), so a
call-dominant strike is NEGATIVE and a put-dominant one POSITIVE: the
convention the walls, the flip and every heat ramp read. DEX, VEX, vanna and
charm carry the prior unflipped, on delta's footing. Vanna is stated per ONE
POINT of vol (x 0.01), charm per SESSION (/ 252).

ORDER OF OPERATIONS is kept as the TypeScript writes it, term by term, so the
doubles agree to the last bit wherever a sum does not cancel.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date as _date

import numpy as np

from .greeks import black_scholes_greeks_v
from .walls import find_air_pockets, heaviest, pick_flip, pick_walls

DEALER_CALL = -0.55  # net short calls
DEALER_PUT = -0.53  # net short puts

GREEKS = ("gex", "dex", "vex", "vanna", "charm")
CORE_GREEKS = ("gex", "dex", "vex")
GREEK_UNIT = {"gex": "1% move", "dex": "1σ move", "vex": "1% vol", "vanna": "1 vol pt", "charm": "1 day"}

# the two greeks whose legs come signed and ready per expiry, never anchored to the front
DIRECT = frozenset({"vanna", "charm"})

# the horizons the desk and the ledger ask for, resolved to real sessions and deduped
DESK_DTES = (0, 2, 4, 7, 14, 21, 30, 45)
CALENDAR_DTES = (0, 1, 2, 3, 4, 7, 14, 21, 28, 35, 42, 49, 63, 77, 91)

# the profile's expiry lens: one factor over the whole book (a simulator proxy; the
# live book prices each expiry's own chain and passes factor 1)
EXPIRY_DECAY = {"0DTE": 1.0, "1D": 0.52, "2D": 0.38, "5D": 0.22, "7D": 0.16, "OPEX": 0.85, "ALL": 3.13}

# the simulator prices its 0DTE chain at this many years; the parity fixture is built on it
FRONT_T = 0.003

EPS = 1e-6
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

CHAIN_FIELDS = (
    "strike", "call_oi", "put_oi", "gamma",
    "call_gex", "put_gex", "net_gex",
    "call_dex", "put_dex", "net_dex",
    "call_vex", "put_vex", "net_vex",
    "vanna", "charm",
    "call_vanna", "put_vanna", "net_vanna",
    "call_charm", "put_charm", "net_charm",
)

Chain = dict[str, np.ndarray]


# ---- the chain: contracts into exposures ----------------------------------------------

def chain_exposures(
    spot: float,
    strikes,
    call_oi,
    put_oi,
    t: float,
    call_iv,
    put_iv=None,
    *,
    dealer_call: float = DEALER_CALL,
    dealer_put: float = DEALER_PUT,
) -> Chain:
    """
    One expiry's strikes into the exposure book (the simulator's StrikeNode, as
    arrays keyed by CHAIN_FIELDS). `t` in years, ivs as fractions. One iv for
    both legs reproduces the simulator; a put iv of its own is the live chain.
    The unit fields `gamma` and `vanna` are the call leg's; `charm` is the two
    legs' mean, as the simulator states it.
    """
    strikes = np.asarray(strikes, dtype=float)
    call_oi = np.asarray(call_oi, dtype=float)
    put_oi = np.asarray(put_oi, dtype=float)
    call_iv = np.broadcast_to(np.asarray(call_iv, dtype=float), strikes.shape)
    gc = black_scholes_greeks_v(spot, strikes, t, call_iv)
    gp = gc if put_iv is None else black_scholes_greeks_v(spot, strikes, t, np.broadcast_to(np.asarray(put_iv, dtype=float), strikes.shape))

    call_gex = call_oi * 100 * gc["gamma"] * spot * spot * 0.01 * dealer_call
    put_gex = put_oi * 100 * gp["gamma"] * spot * spot * 0.01 * dealer_put * -1
    call_dex = call_oi * 100 * gc["delta_call"] * spot * dealer_call
    put_dex = put_oi * 100 * gp["delta_put"] * spot * dealer_put
    call_vex = call_oi * 100 * gc["vega"] * dealer_call
    put_vex = put_oi * 100 * gp["vega"] * dealer_put
    call_vanna = call_oi * 100 * gc["vanna"] * 0.01 * spot * dealer_call
    put_vanna = put_oi * 100 * gp["vanna"] * 0.01 * spot * dealer_put
    call_charm = (call_oi * 100 * gc["charm_call"] * spot * dealer_call) / 252
    put_charm = (put_oi * 100 * gp["charm_put"] * spot * dealer_put) / 252

    return {
        "strike": strikes,
        "call_oi": call_oi,
        "put_oi": put_oi,
        "gamma": gc["gamma"],
        "call_gex": call_gex,
        "put_gex": put_gex,
        "net_gex": call_gex + put_gex,
        "call_dex": call_dex,
        "put_dex": put_dex,
        "net_dex": call_dex + put_dex,
        "call_vex": call_vex,
        "put_vex": put_vex,
        "net_vex": call_vex + put_vex,
        "vanna": gc["vanna"],
        "charm": (gc["charm_call"] + gp["charm_put"]) / 2,
        "call_vanna": call_vanna,
        "put_vanna": put_vanna,
        "net_vanna": call_vanna + put_vanna,
        "call_charm": call_charm,
        "put_charm": put_charm,
        "net_charm": call_charm + put_charm,
    }


def chain_from_rows(rows) -> Chain:
    """A chain from row mappings keyed by CHAIN_FIELDS (a fixture, a tape frame)."""
    rows = list(rows)
    return {f: np.array([float(r[f]) for r in rows], dtype=float) for f in CHAIN_FIELDS}


# ---- the profile: one lens on the book -----------------------------------------------

@dataclass(frozen=True)
class Split:
    put: float
    call: float
    net: float


@dataclass(frozen=True)
class StrikeExposure:
    strike: float
    pin: bool
    gex: Split
    dex: Split
    vex: Split
    vanna: Split
    charm: Split
    oi: float
    volume: float


@dataclass(frozen=True)
class Levels:
    spot: float
    call_wall: float
    put_wall: float
    pin: float
    flip: float
    supreme: float  # the heaviest |net gamma| strike of the FULL book, which may sit outside the window


@dataclass(frozen=True)
class Zone:
    from_: float  # strikes descending: from >= to
    to: float
    kind: str  # 'call-wall' | 'put-wall' | 'friction' | 'air-pocket'


@dataclass(frozen=True)
class ExposureProfile:
    ticker: str
    expiry: str
    strikes: list[StrikeExposure]  # DESCENDING, the window around spot
    max_abs: dict[str, float]  # per greek, the largest |leg or net| in the window, floored at 1
    net_gex: float
    net_dex: float
    net_vex: float
    levels: Levels
    zones: list[Zone]
    bias: str  # 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    # the window as arrays, descending: strike, oi, volume, and <greek>_put / _call / _net
    window: dict[str, np.ndarray] = field(repr=False, compare=False)


def scale_split(put, call, factor: float, jitter):
    """
    The expiry lens on a pair of legs, NET-PRESERVING: the sum is exactly
    (put + call) * factor; the jitter only moves weight between the legs, bounded
    by the smaller of the two, so it can neither move a level nor flip a leg's
    sign. A jitter of 0.5 shifts nothing.
    """
    P = put * factor
    C = call * factor
    shift = (jitter - 0.5) * 0.36 * np.minimum(np.abs(P), np.abs(C))
    return P + shift, C - shift, P + C


_LEGS = {
    "gex": ("put_gex", "call_gex", 1.0),
    "dex": ("put_dex", "call_dex", 1.0),
    "vex": ("put_vex", "call_vex", 40.0),  # dollar-comparable
    "vanna": ("put_vanna", "call_vanna", 1.0),
    "charm": ("put_charm", "call_charm", 1.0),
}


def _seq_sum(x: np.ndarray) -> float:
    """Left-to-right accumulation, the order a reduce runs in (a pairwise sum can differ where terms cancel)."""
    return float(np.cumsum(x)[-1]) if x.size else 0.0


def build_exposure_profile(
    chain: Chain,
    spot: float,
    half: int,
    *,
    ticker: str = "",
    expiry: str = "0DTE",
    factor: float | None = None,
    jitter=None,
    volume=None,
) -> ExposureProfile:
    """
    The book through one lens. `half` strikes each side of spot are the window;
    the walls, the flip and the supreme read the FULL chain (a window is a drawing
    choice, never an answer). `jitter` and `volume`, when given, are arrays
    aligned with the chain.
    """
    f = EXPIRY_DECAY[expiry] if factor is None else factor
    strikes = chain["strike"]
    if strikes.size == 0:
        raise ValueError("an empty chain has no profile")

    # the window: strikes descending, centred on the first strike at or under spot
    order = np.argsort(-strikes, kind="stable")
    desc = strikes[order]
    hit = np.flatnonzero(desc <= spot)
    spot_idx = int(hit[0]) if hit.size else 0
    start = max(0, spot_idx - half)
    idx = order[start : start + half * 2 + 1]

    w_strike = strikes[idx]
    w_oi = chain["call_oi"][idx] + chain["put_oi"][idx]
    p = heaviest(w_oi)
    pin = float(w_strike[p]) if p is not None else float(w_strike[0])
    j = np.full(idx.size, 0.5) if jitter is None else np.asarray(jitter, dtype=float)[idx]
    vol = np.zeros(idx.size) if volume is None else np.asarray(volume, dtype=float)[idx]

    window: dict[str, np.ndarray] = {"strike": w_strike, "oi": w_oi, "volume": vol}
    max_abs: dict[str, float] = {}
    for greek, (pk, ck, mult) in _LEGS.items():
        put, call, net = scale_split(chain[pk][idx] * mult, chain[ck][idx] * mult, f, j)
        window[f"{greek}_put"] = put
        window[f"{greek}_call"] = call
        window[f"{greek}_net"] = net
        max_abs[greek] = max(1.0, float(np.abs(put).max()), float(np.abs(call).max()), float(np.abs(net).max()))

    net_gex = _seq_sum(window["gex_net"])
    net_dex = _seq_sum(window["dex_net"])
    net_vex = _seq_sum(window["vex_net"])

    # the levels, off the FULL chain; "nothing on that side" falls back to spot here
    cw, pw = pick_walls(strikes, chain["net_gex"], spot)
    call_wall = spot if cw is None else cw
    put_wall = spot if pw is None else pw
    fl = pick_flip(strikes, chain["net_gex"], spot)
    flip = spot if fl is None else fl
    k = heaviest(chain["put_gex"] + chain["call_gex"])
    supreme = float(strikes[k]) if k is not None else spot
    levels = Levels(spot, call_wall, put_wall, pin, flip, supreme)

    # the bands: one row of breathing room per wall, friction between, then the pockets
    step = abs(float(w_strike[0]) - float(w_strike[1])) if idx.size > 1 else 1.0
    zones = [Zone(call_wall + step, call_wall - step, "call-wall"), Zone(put_wall + step, put_wall - step, "put-wall")]
    if call_wall - put_wall > 3 * step:
        zones.append(Zone(call_wall - step * 2, put_wall + step * 2, "friction"))
    zones.extend(Zone(a.from_, a.to, "air-pocket") for a in find_air_pockets(w_strike, window["gex_net"]))

    # the bias: a NEGATIVE aggregate is call-dominant, dealers long gamma, absorbing
    threshold = max_abs["gex"] * 0.6
    bias = "BEARISH" if net_gex > threshold else "BULLISH" if net_gex < -threshold else "NEUTRAL"

    rows = [
        StrikeExposure(
            strike=float(w_strike[i]),
            pin=bool(w_strike[i] == pin),
            gex=Split(float(window["gex_put"][i]), float(window["gex_call"][i]), float(window["gex_net"][i])),
            dex=Split(float(window["dex_put"][i]), float(window["dex_call"][i]), float(window["dex_net"][i])),
            vex=Split(float(window["vex_put"][i]), float(window["vex_call"][i]), float(window["vex_net"][i])),
            vanna=Split(float(window["vanna_put"][i]), float(window["vanna_call"][i]), float(window["vanna_net"][i])),
            charm=Split(float(window["charm_put"][i]), float(window["charm_call"][i]), float(window["charm_net"][i])),
            oi=float(w_oi[i]),
            volume=float(vol[i]),
        )
        for i in range(idx.size)
    ]
    return ExposureProfile(ticker, expiry, rows, max_abs, net_gex, net_dex, net_vex, levels, zones, bias, window)


# ---- the surface: strike x expiry x greek ---------------------------------------------

@dataclass(frozen=True)
class LegFacts:
    """One side of one expiry's chain, arrays aligned with DeskExpiry.strikes. iv as a FRACTION."""

    oi: np.ndarray
    iv: np.ndarray
    gamma: np.ndarray
    delta: np.ndarray
    vega: np.ndarray


@dataclass(frozen=True)
class DeskExpiry:
    """One expiry's contracts, as the loop reads them off the tape (or the fixture off the desk)."""

    dte: int
    sessions: int
    date: _date
    strikes: np.ndarray
    put: LegFacts
    call: LegFacts


@dataclass(frozen=True)
class SurfaceExpiry:
    dte: int
    short: str  # "0DTE", "2d", "45d"
    date: str  # "Sep 18"
    iv: float  # at-the-money implied vol for this expiry, as a fraction
    sessions: int


@dataclass(frozen=True)
class KingNode:
    """The heaviest single cell on the calendar: the star, never the supreme."""

    strike: float
    e: int
    value: float


@dataclass(frozen=True)
class SupremeNode:
    """The heaviest STRIKE of the whole book, with the date carrying most of it."""

    strike: float
    e: int
    value: float
    total: float


@dataclass(frozen=True)
class ExposureSurface:
    ticker: str
    spot: float
    change_pct: float
    strikes: np.ndarray  # ascending
    expiries: list[SurfaceExpiry]  # nearest first
    put: dict[str, np.ndarray]  # [greek] -> (expiry, strike), signed dollars
    call: dict[str, np.ndarray]
    net: dict[str, np.ndarray]
    oi: np.ndarray  # (expiry, strike)
    max_abs: dict[str, float]  # per greek, the largest |net| anywhere on the surface, floored at 1
    king: dict[str, KingNode]
    supreme: dict[str, SupremeNode]
    levels: Levels
    front: ExposureProfile


def _legs_from_rows(rows, side: str) -> LegFacts:
    """A LegFacts from row mappings with a `put`/`call` mapping each (oi, iv, gamma, delta, vega)."""
    rows = list(rows)
    col = lambda k: np.array([float(r[side][k]) for r in rows], dtype=float)  # noqa: E731
    return LegFacts(col("oi"), col("iv"), col("gamma"), col("delta"), col("vega"))


def desk_expiry_from_rows(dte: int, sessions: int, date: _date, rows) -> DeskExpiry:
    rows = list(rows)
    return DeskExpiry(dte, sessions, date, np.array([float(r["strike"]) for r in rows], dtype=float), _legs_from_rows(rows, "put"), _legs_from_rows(rows, "call"))


def _desk_legs(spot: float, strikes: np.ndarray, x: DeskExpiry, dealer_call: float, dealer_put: float):
    """
    One expiry's legs at the FRONT's strikes: GEX, DEX and VEX as MAGNITUDES (the
    sign is the front's, applied by the anchor), vanna and charm SIGNED from the
    expiry's own time and vol (the chain carries neither). Strikes the expiry
    does not list are zero.
    """
    n = strikes.size
    pos = {float(s): i for i, s in enumerate(x.strikes)}
    sel = np.array([pos.get(float(s), -1) for s in strikes], dtype=int)
    has = sel >= 0

    def take(arr: np.ndarray) -> np.ndarray:
        out = np.zeros(n)
        out[has] = arr[sel[has]]
        return out

    poi, coi = take(x.put.oi), take(x.call.oi)
    piv, civ = take(x.put.iv), take(x.call.iv)
    pg, cg = take(x.put.gamma), take(x.call.gamma)
    pd, cd = take(x.put.delta), take(x.call.delta)
    pv, cv = take(x.put.vega), take(x.call.vega)

    sigma1 = math.sqrt(1 / 252)
    years = max(0.5, x.sessions) / 252
    hp = black_scholes_greeks_v(spot, strikes, years, np.maximum(0.01, piv))
    hc = black_scholes_greeks_v(spot, strikes, years, np.maximum(0.01, civ))

    zero = lambda a: np.where(has, a, 0.0)  # noqa: E731
    legs = {
        "gex": (zero(pg * poi * 100 * spot * spot * 0.01), zero(cg * coi * 100 * spot * spot * 0.01)),
        "dex": (zero(np.abs(pd) * poi * 100 * spot * (piv * sigma1)), zero(np.abs(cd) * coi * 100 * spot * (civ * sigma1))),
        "vex": (zero(pv * poi * 100), zero(cv * coi * 100)),
        "vanna": (zero(hp["vanna"] * 0.01 * poi * 100 * spot * dealer_put), zero(hc["vanna"] * 0.01 * coi * 100 * spot * dealer_call)),
        "charm": (zero((hp["charm_put"] * poi * 100 * spot * dealer_put) / 252), zero((hc["charm_call"] * coi * 100 * spot * dealer_call) / 252)),
    }
    oi_row = zero(poi + coi)

    # the expiry's own vol: the nearest-to-spot row's two legs averaged, on its own smile
    if x.strikes.size:
        a = int(np.argmin(np.abs(x.strikes - spot)))
        iv = (float(x.put.iv[a]) + float(x.call.iv[a])) / 2
    else:
        iv = 0.2
    short = "0DTE" if x.dte == 0 else f"{x.dte}d"
    label = f"{MONTHS[x.date.month - 1]} {x.date.day}"
    return legs, oi_row, SurfaceExpiry(x.dte, short, label, iv, x.sessions)


def build_exposure_surface(
    front: ExposureProfile,
    spot: float,
    expiries: list[DeskExpiry],
    *,
    ticker: str = "",
    change_pct: float = 0.0,
    dealer_call: float = DEALER_CALL,
    dealer_put: float = DEALER_PUT,
) -> ExposureSurface:
    """
    The calendar behind the front. The FRONT row is the profile's own numbers,
    exactly; each farther expiry is that expiry's leg at the strike, carried in
    the front leg's sign and scaled by the front leg's ratio to its own twin in
    `expiries[0]` (a twin near zero falls back to the greek's whole-book ratio).
    Vanna and charm are taken signed and direct from every expiry, the front
    included: today's contracts carry almost no vanna, so a ratio off them is
    noise scaled into the far dates. Two expiries on one date are one column.

    With one source for the front and the calendar (the live book), the anchor
    reduces to the dealer prior on each leg.
    """
    strikes = front.window["strike"][::-1]  # the profile is descending; the surface is ascending
    n = strikes.size
    front_legs = {g: (front.window[f"{g}_put"][::-1], front.window[f"{g}_call"][::-1]) for g in GREEKS}
    front_net = {g: front.window[f"{g}_net"][::-1] for g in GREEKS}

    desk: list[dict[str, tuple[np.ndarray, np.ndarray]]] = []
    oi_rows: list[np.ndarray] = []
    out_expiries: list[SurfaceExpiry] = []
    seen: set[str] = set()
    for x in expiries:
        key = x.date.isoformat()
        if key in seen:
            continue
        seen.add(key)
        legs, oi_row, ex = _desk_legs(spot, strikes, x, dealer_call, dealer_put)
        desk.append(legs)
        oi_rows.append(oi_row)
        out_expiries.append(ex)
    E = len(desk)

    put: dict[str, np.ndarray] = {}
    call: dict[str, np.ndarray] = {}
    net: dict[str, np.ndarray] = {}
    max_abs: dict[str, float] = {}
    king: dict[str, KingNode] = {}
    for g in GREEKS:
        f_put, f_call = front_legs[g]
        d0_put, d0_call = desk[0][g] if E else (np.zeros(n), np.zeros(n))
        sum_f = _seq_sum(np.abs(f_put) + np.abs(f_call))
        sum_d = _seq_sum(d0_put + d0_call)
        global_k = sum_f / sum_d if sum_d > EPS else 1.0
        k_put = np.where(d0_put > EPS, np.abs(f_put) / np.where(d0_put > EPS, d0_put, 1.0), global_k)
        k_call = np.where(d0_call > EPS, np.abs(f_call) / np.where(d0_call > EPS, d0_call, 1.0), global_k)
        sign_put = np.where(f_put == 0, 1.0, np.sign(f_put))
        sign_call = np.where(f_call == 0, -1.0, np.sign(f_call))

        P = np.zeros((E, n))
        C = np.zeros((E, n))
        best = KingNode(float(strikes[0]), 0, 0.0)
        m = 1.0
        for e in range(E):
            if g in DIRECT:
                pv, cv = desk[e][g]
            elif e == 0:
                pv, cv = f_put, f_call
            else:
                pv = sign_put * k_put * desk[e][g][0]
                cv = sign_call * k_call * desk[e][g][1]
            P[e] = pv
            C[e] = cv
            a = np.abs(pv + cv)
            if a.size:
                i = int(np.argmax(a))
                m = max(m, float(a.max()))
                if a[i] > abs(best.value):
                    best = KingNode(float(strikes[i]), e, float(pv[i] + cv[i]))
        put[g] = P
        call[g] = C
        net[g] = P + C
        max_abs[g] = m
        king[g] = best

    # the supreme per greek: gamma's is the profile's own pick (the full chain); the
    # others the heaviest strike of the front book; then the date carrying most of it
    supreme: dict[str, SupremeNode] = {}
    for g in GREEKS:
        strike = front.levels.supreme
        if g != "gex":
            i = heaviest(front_net[g])
            if i is not None:
                strike = float(strikes[i])
        where = np.flatnonzero(strikes == strike)
        si = int(where[0]) if where.size else -1
        e, value = 0, 0.0
        if si >= 0 and E:
            col = net[g][:, si]
            x = int(np.argmax(np.abs(col)))
            if abs(col[x]) > 0:
                e, value = x, float(col[x])
        supreme[g] = SupremeNode(strike, e, value, float(front_net[g][si]) if si >= 0 else 0.0)

    return ExposureSurface(
        ticker=ticker,
        spot=spot,
        change_pct=change_pct,
        strikes=strikes,
        expiries=out_expiries,
        put=put,
        call=call,
        net=net,
        oi=np.array(oi_rows) if E else np.zeros((0, n)),
        max_abs=max_abs,
        king=king,
        supreme=supreme,
        levels=front.levels,
        front=front,
    )
