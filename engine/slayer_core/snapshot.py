"""
THE PHOTOGRAPH (2026-09-17): a tape frame into what the engine can legally know
at one instant. The same function runs live and in the replay; only the frame's
origin differs, and the journal's FeatureSnapshot.provenance says which.

What it does, in order:
  1. per expiry, an implied vol per contract from the mid by the engine's own
     bisection (ThetaData's greeks are not used: the exposure math wants ONE
     model, ours, over purchasable quotes and open interest - the spec's [D]
     over [P]); the time to expiry is the desk's rule, sessions floored at half
     a session; a contract without a usable quote takes the expiry's ATM vol
     and is counted; an expiry with no usable quote at all is dropped and counted
  2. the exposure book per expiry (chain_exposures), the FRONT being the nearest
     expiry, then the profile and the strike x expiry surface off it
  3. the base IV: the 30-calendar-day (21-session) constant-maturity ATM vol,
     interpolated in total variance between the two bracketing expiries (the
     VIX's own construction; the nearest expiry alone when nothing brackets)
  4. IV rank against the daily base-IV series the caller supplies (the tape's
     derived series), None until that series is long enough to mean anything
  5. the indicators over the closes the caller supplies (live: the session's
     one-minute closes to the instant), neutral under 50 points

The builder answers the MARKET half of FeatureSnapshot (spot, base IV, IV
rank, RSI, the levels). The dark-pool read, the news lean and the factor board
are the top layer's and wait for the partner's math. `BUILDER_VERSION` is part
of every snapshot's dataVersion: a change to any rule above bumps it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

import numpy as np

from .exposure import DEALER_CALL, DEALER_PUT, DeskExpiry, ExposureProfile, ExposureSurface, LegFacts, build_exposure_profile, build_exposure_surface, chain_exposures
from .greeks import black_scholes_greeks_v, implied_vol_v
from .indicators import Indicators, indicators
from .journal import GexLevels, gex_levels_from_profile
from .tape import ExpiryQuotes, TapeFrame

BUILDER_VERSION = "photo@0.1.0"

# the base IV's tenor: 30 calendar days, 21 sessions, in the same years pricing uses
BASE_IV_SESSIONS = 21
# IV rank needs at least this many sessions of history before it says anything
IV_RANK_MIN_HISTORY = 60


@dataclass(frozen=True)
class PricedExpiry:
    """One expiry priced: the desk facts the surface reads and the exposure book the profile reads."""

    desk: DeskExpiry
    chain: dict[str, np.ndarray]
    years: float
    atm_iv: float
    quoted: int  # contracts with a usable quote
    filled: int  # contracts that took the ATM vol


@dataclass(frozen=True)
class DataQuality:
    contracts: int
    quoted: int
    filled: int
    expiries: int
    dropped_expiries: int
    spot_from_bar: bool


@dataclass(frozen=True)
class Photograph:
    symbol: str
    at: datetime
    session: date
    spot: float
    front: ExposureProfile
    surface: ExposureSurface
    expiries: list[PricedExpiry]
    base_iv_pct: float
    iv_rank: float | None
    indicators: Indicators
    quality: DataQuality
    data_version: str

    @property
    def gex(self) -> GexLevels:
        return gex_levels_from_profile(self.front)


def years_of(sessions: int) -> float:
    """The desk's rule: sessions to expiry floored at half a session, over 252."""
    return max(0.5, sessions) / 252


def usable(bid: np.ndarray, ask: np.ndarray) -> np.ndarray:
    """A quote we will price off: an offer above zero, a bid that is not above it, both present."""
    return np.isfinite(bid) & np.isfinite(ask) & (ask > 0) & (bid >= 0) & (ask >= bid)


def price_expiry(x: ExpiryQuotes, spot: float) -> PricedExpiry | None:
    t = years_of(x.sessions)
    n = x.strikes.size
    quoted = 0
    ivs = []
    for bid, ask, is_call in ((x.put_bid, x.put_ask, False), (x.call_bid, x.call_ask, True)):
        ok = usable(bid, ask)
        mid = np.where(ok, (bid + ask) / 2, np.nan)
        iv = implied_vol_v(np.where(ok, mid, 1.0), spot, x.strikes, t, np.full(n, is_call))
        iv = np.where(ok, iv, np.nan)
        quoted += int(np.isfinite(iv).sum())
        ivs.append(iv)
    put_iv, call_iv = ivs
    both = np.isfinite(put_iv) & np.isfinite(call_iv)
    if both.any():
        a = int(np.flatnonzero(both)[np.argmin(np.abs(x.strikes[both] - spot))])
        atm = (put_iv[a] + call_iv[a]) / 2
    else:
        either = np.isfinite(put_iv) | np.isfinite(call_iv)
        if not either.any():
            return None
        a = int(np.flatnonzero(either)[np.argmin(np.abs(x.strikes[either] - spot))])
        atm = put_iv[a] if np.isfinite(put_iv[a]) else call_iv[a]
    filled = int((~np.isfinite(put_iv)).sum() + (~np.isfinite(call_iv)).sum())
    put_iv = np.where(np.isfinite(put_iv), put_iv, atm)
    call_iv = np.where(np.isfinite(call_iv), call_iv, atm)
    gp = black_scholes_greeks_v(spot, x.strikes, t, put_iv)
    gc = black_scholes_greeks_v(spot, x.strikes, t, call_iv)
    desk = DeskExpiry(
        dte=x.dte,
        sessions=x.sessions,
        date=x.expiration,
        strikes=x.strikes,
        put=LegFacts(x.put_oi, put_iv, gp["gamma"], gp["delta_put"], gp["vega"]),
        call=LegFacts(x.call_oi, call_iv, gc["gamma"], gc["delta_call"], gc["vega"]),
    )
    chain = chain_exposures(spot, x.strikes, x.call_oi, x.put_oi, t, call_iv, put_iv)
    return PricedExpiry(desk, chain, t, float(atm), quoted, filled)


def constant_maturity_iv(years: np.ndarray, ivs: np.ndarray, target_years: float) -> float:
    """
    The ATM vol at one tenor from the expiries' ATM vols, interpolated in TOTAL
    VARIANCE between the two bracketing expiries (the VIX's construction). With
    nothing on one side, the nearest expiry's vol. Empty input is NaN.
    """
    years = np.asarray(years, dtype=float)
    ivs = np.asarray(ivs, dtype=float)
    keep = np.isfinite(years) & np.isfinite(ivs) & (years > 0)
    years, ivs = years[keep], ivs[keep]
    if years.size == 0:
        return float("nan")
    order = np.argsort(years, kind="stable")
    years, ivs = years[order], ivs[order]
    exact = np.flatnonzero(years == target_years)
    if exact.size:
        return float(ivs[exact[0]])
    below = np.flatnonzero(years < target_years)
    above = np.flatnonzero(years > target_years)
    if below.size == 0:
        return float(ivs[above[0]])
    if above.size == 0:
        return float(ivs[below[-1]])
    t1, v1 = years[below[-1]], ivs[below[-1]]
    t2, v2 = years[above[0]], ivs[above[0]]
    w1 = (t2 - target_years) / (t2 - t1)
    w2 = (target_years - t1) / (t2 - t1)
    var = (v1 * v1 * t1 * w1 + v2 * v2 * t2 * w2) / target_years
    return float(np.sqrt(var))


def iv_rank(current: float, history) -> float | None:
    """Where the current base IV sits in its own history, 0 to 100; None until the history means something."""
    h = np.asarray(history, dtype=float)
    h = h[np.isfinite(h)]
    if h.size < IV_RANK_MIN_HISTORY or not np.isfinite(current):
        return None
    lo, hi = float(h.min()), float(h.max())
    if hi <= lo:
        return None
    return float(min(100.0, max(0.0, 100.0 * (current - lo) / (hi - lo))))


def build_photograph(
    frame: TapeFrame,
    *,
    iv_history=None,
    closes=None,
    half: int = 30,
    tape_version: str = "",
    dealer_call: float = DEALER_CALL,
    dealer_put: float = DEALER_PUT,
) -> Photograph:
    """
    The frame into the photograph. `iv_history` is the daily base-IV series the
    caller may know at this instant (strictly earlier sessions); `closes` the
    series the indicators read. `half` is the profile's window each side of spot.
    """
    if not np.isfinite(frame.spot) or frame.spot <= 0:
        raise ValueError(f"{frame.symbol} at {frame.at.isoformat()}: no underlying price on the frame")
    priced: list[PricedExpiry] = []
    dropped = 0
    contracts = 0
    for x in frame.expiries():
        contracts += int((np.isfinite(x.put_bid) | np.isfinite(x.put_ask)).sum() + (np.isfinite(x.call_bid) | np.isfinite(x.call_ask)).sum())
        p = price_expiry(x, frame.spot)
        if p is None:
            dropped += 1
            continue
        priced.append(p)
    if not priced:
        raise ValueError(f"{frame.symbol} at {frame.at.isoformat()}: no expiry carries a usable quote")

    front_chain = priced[0].chain
    front = build_exposure_profile(front_chain, frame.spot, half, ticker=frame.symbol)
    surface = build_exposure_surface(front, frame.spot, [p.desk for p in priced], ticker=frame.symbol, dealer_call=dealer_call, dealer_put=dealer_put)

    base_iv = constant_maturity_iv([p.years for p in priced], [p.atm_iv for p in priced], BASE_IV_SESSIONS / 252)
    base_iv_pct = base_iv * 100
    rank = iv_rank(base_iv_pct, iv_history if iv_history is not None else [])
    ind = indicators(closes) if closes is not None and len(closes) else Indicators(50.0, frame.spot, frame.spot, frame.spot, False)

    quality = DataQuality(
        contracts=contracts,
        quoted=sum(p.quoted for p in priced),
        filled=sum(p.filled for p in priced),
        expiries=len(priced),
        dropped_expiries=dropped,
        spot_from_bar=frame.bar_stamp is not None,
    )
    version = f"tape@{tape_version}|{BUILDER_VERSION}" if tape_version else BUILDER_VERSION
    return Photograph(frame.symbol, frame.at, frame.session, frame.spot, front, surface, priced, base_iv_pct, rank, ind, quality, version)


def feature_market(photo: Photograph) -> dict:
    """The market half of FeatureSnapshot, keyed as the seam names them (the top layer adds the rest)."""
    return {
        "ticker": photo.symbol,
        "decided_at": photo.at.isoformat().replace("+00:00", "Z"),
        "spot": photo.spot,
        "iv_rank": photo.iv_rank,
        "base_iv_pct": photo.base_iv_pct,
        "rsi": photo.indicators.rsi,
        "gex": photo.gex,
        "data_version": photo.data_version,
    }
