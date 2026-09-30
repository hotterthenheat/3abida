"""
BLACK-SCHOLES GREEKS (ported from src/core/greeks.ts, 2026-09-17).

Pure math, no state, no clock. The generalised (continuous-yield)
Black-Scholes, so q = 0 reproduces the plain arithmetic exactly.

TWO THINGS THE PORT KEEPS ON PURPOSE, because parity is the point:

  THE NORMAL CDF is the same polynomial the TypeScript engine uses
  (Abramowitz & Stegun 26.2.17, accurate to about 7.5e-8), not math.erf or
  scipy. Swapping in an exact CDF would be more accurate and would break
  parity with every number the site has ever shown; when the TypeScript copy
  is retired, both can move to the exact form together, in one commit, with
  the parity fixture regenerated.

  THE VEGA SCALING: vega and rho are PER ONE POINT of their input (per 1% of
  vol, per 1% of rate). The raw partials are per 1.00, divided by 100 here.
  A feed that quotes per-1.00 vega is divided by 100 once, on ingest, never
  again here.

Two shapes of every function: the scalar one, which is the reference and the
one the parity test holds to the TypeScript output; and the vectorised one
over NumPy arrays, which the loop and the replay call on whole chains at
once. The vectorised form is the same arithmetic, written once, and its own
test holds it to the scalar form.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np

from .carry import get_carry

Right = Literal["C", "P"]

# the engine's floors, as in the TypeScript: t and v at or below zero take these
_T_FLOOR_GREEKS = 0.0001
_V_FLOOR_GREEKS = 0.01
_T_FLOOR_PRICE = 0.0001
_V_FLOOR_PRICE = 0.0001

_INV_SQRT_2PI = 0.3989422804


def normal_cdf(x: float) -> float:
    """Abramowitz-Stegun 26.2.17 - byte-for-byte the TypeScript engine's normalCDF."""
    t = 1.0 / (1.0 + 0.2316419 * abs(x))
    d = _INV_SQRT_2PI * math.exp((-x * x) / 2.0)
    p = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
    return 1.0 - d * p if x >= 0 else d * p


def normal_pdf(x: float) -> float:
    return math.exp((-x * x) / 2.0) / math.sqrt(2.0 * math.pi)


def normal_cdf_v(x: np.ndarray) -> np.ndarray:
    """The same polynomial over an array."""
    t = 1.0 / (1.0 + 0.2316419 * np.abs(x))
    d = _INV_SQRT_2PI * np.exp((-x * x) / 2.0)
    p = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
    return np.where(x >= 0, 1.0 - d * p, d * p)


def normal_pdf_v(x: np.ndarray) -> np.ndarray:
    return np.exp((-x * x) / 2.0) / math.sqrt(2.0 * math.pi)


@dataclass(frozen=True)
class Greeks:
    delta_call: float
    delta_put: float
    gamma: float
    vega: float  # per 1 point of vol
    vanna: float
    charm_call: float
    charm_put: float
    rho_call: float  # per 1 point of rate
    rho_put: float


def black_scholes_greeks(S: float, K: float, t: float, v: float, r: float | None = None, q: float | None = None) -> Greeks:
    """
    Black-Scholes greeks with a continuous dividend yield.
    S spot · K strike · t years to expiry · v IV · r, q default to the carry seam.
    """
    carry = get_carry()
    rate = carry.r if r is None else r
    yld = carry.q if q is None else q
    if t <= 0:
        t = _T_FLOOR_GREEKS
    if v <= 0:
        v = _V_FLOOR_GREEKS

    sq_t = math.sqrt(t)
    df_q = math.exp(-yld * t)
    df_r = math.exp(-rate * t)
    d1 = (math.log(S / K) + (rate - yld + (v * v) / 2.0) * t) / (v * sq_t)
    d2 = d1 - v * sq_t

    n_d1 = normal_cdf(d1)
    n_d2 = normal_cdf(d2)
    np_d1 = normal_pdf(d1)

    delta_call = df_q * n_d1
    delta_put = df_q * (n_d1 - 1.0)
    gamma = (df_q * np_d1) / (S * v * sq_t)
    vega = (S * df_q * sq_t * np_d1) / 100.0
    rho_call = (K * t * df_r * n_d2) / 100.0
    rho_put = (-K * t * df_r * normal_cdf(-d2)) / 100.0
    vanna = (-df_q * np_d1 * d2) / v

    # charm = -dDelta/dtau; the q-terms keep the pair consistent with the deltas above
    shared = (df_q * np_d1 * (2.0 * (rate - yld) * t - d2 * v * sq_t)) / (2.0 * t * v * sq_t)
    charm_call = yld * df_q * n_d1 - shared
    charm_put = -yld * df_q * normal_cdf(-d1) - shared

    return Greeks(delta_call, delta_put, gamma, vega, vanna, charm_call, charm_put, rho_call, rho_put)


def black_scholes_price(S: float, K: float, t: float, v: float, right: Right, r: float | None = None, q: float | None = None) -> float:
    """Black-Scholes price, the inversion below solves against."""
    carry = get_carry()
    rate = carry.r if r is None else r
    yld = carry.q if q is None else q
    if t <= 0:
        t = _T_FLOOR_PRICE
    if v <= 0:
        v = _V_FLOOR_PRICE
    sq_t = math.sqrt(t)
    d1 = (math.log(S / K) + (rate - yld + (v * v) / 2.0) * t) / (v * sq_t)
    d2 = d1 - v * sq_t
    df_q = math.exp(-yld * t)
    df_r = math.exp(-rate * t)
    if right == "C":
        return S * df_q * normal_cdf(d1) - K * df_r * normal_cdf(d2)
    return K * df_r * normal_cdf(-d2) - S * df_q * normal_cdf(-d1)


def implied_vol_from_price(price: float, S: float, K: float, t: float, right: Right, r: float | None = None, q: float | None = None) -> float | None:
    """
    Implied vol by BISECTION, not Newton: vega collapses toward zero in the wings
    and near expiry, and Newton divides by it. Bisection cannot diverge. None when
    the price is outside what the model can produce at any vol.
    """
    if not (price > 0 and S > 0 and K > 0 and t > 0):
        return None
    lo, hi = 0.0001, 5.0

    def at(vol: float) -> float:
        return black_scholes_price(S, K, t, vol, right, r, q)

    if price < at(lo) - 1e-9 or price > at(hi) + 1e-9:
        return None
    for _ in range(100):
        mid = (lo + hi) / 2.0
        if at(mid) < price:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1e-8:
            break
    return (lo + hi) / 2.0


# ---- the vectorised forms: whole chains at once ------------------------------------

def black_scholes_greeks_v(S, K, t, v, r: float | None = None, q: float | None = None) -> dict[str, np.ndarray]:
    """
    The same greeks over arrays (broadcast like NumPy does). Returns a dict of
    arrays keyed like the Greeks fields. Floors applied elementwise as the scalar
    form applies them.
    """
    carry = get_carry()
    rate = carry.r if r is None else r
    yld = carry.q if q is None else q
    S = np.asarray(S, dtype=float)
    K = np.asarray(K, dtype=float)
    t = np.where(np.asarray(t, dtype=float) <= 0, _T_FLOOR_GREEKS, np.asarray(t, dtype=float))
    v = np.where(np.asarray(v, dtype=float) <= 0, _V_FLOOR_GREEKS, np.asarray(v, dtype=float))

    sq_t = np.sqrt(t)
    df_q = np.exp(-yld * t)
    df_r = np.exp(-rate * t)
    d1 = (np.log(S / K) + (rate - yld + (v * v) / 2.0) * t) / (v * sq_t)
    d2 = d1 - v * sq_t
    n_d1 = normal_cdf_v(d1)
    n_d2 = normal_cdf_v(d2)
    np_d1 = normal_pdf_v(d1)

    shared = (df_q * np_d1 * (2.0 * (rate - yld) * t - d2 * v * sq_t)) / (2.0 * t * v * sq_t)
    return {
        "delta_call": df_q * n_d1,
        "delta_put": df_q * (n_d1 - 1.0),
        "gamma": (df_q * np_d1) / (S * v * sq_t),
        "vega": (S * df_q * sq_t * np_d1) / 100.0,
        "vanna": (-df_q * np_d1 * d2) / v,
        "charm_call": yld * df_q * n_d1 - shared,
        "charm_put": -yld * df_q * normal_cdf_v(-d1) - shared,
        "rho_call": (K * t * df_r * n_d2) / 100.0,
        "rho_put": (-K * t * df_r * normal_cdf_v(-d2)) / 100.0,
    }


def implied_vol_v(price, S, K, t, is_call, r: float | None = None, q: float | None = None) -> np.ndarray:
    """
    The same bisection over arrays: whole chains at once. NaN where the scalar
    form answers None (inputs not positive, or a price outside the model at any
    vol). Every element halves the same bracket the same number of times, so the
    answers are the scalar answers, elementwise.
    """
    price = np.asarray(price, dtype=float)
    S = np.asarray(S, dtype=float)
    K = np.asarray(K, dtype=float)
    t = np.asarray(t, dtype=float)
    is_call = np.asarray(is_call, dtype=bool)
    shape = np.broadcast(price, S, K, t, is_call).shape
    price, S, K, t = (np.broadcast_to(a, shape).astype(float) for a in (price, S, K, t))
    is_call = np.broadcast_to(is_call, shape)
    ok = (price > 0) & (S > 0) & (K > 0) & (t > 0)
    # harmless stand-ins where the inputs are bad, so no warning fires and the answer is masked below
    S_ = np.where(ok, S, 1.0)
    K_ = np.where(ok, K, 1.0)
    t_ = np.where(ok, t, 1.0)
    lo = np.full(shape, 0.0001)
    hi = np.full(shape, 5.0)
    ok &= ~((price < black_scholes_price_v(S_, K_, t_, lo, is_call, r, q) - 1e-9) | (price > black_scholes_price_v(S_, K_, t_, hi, is_call, r, q) + 1e-9))
    for _ in range(100):
        mid = (lo + hi) / 2.0
        below = black_scholes_price_v(S_, K_, t_, mid, is_call, r, q) < price
        lo = np.where(below, mid, lo)
        hi = np.where(below, hi, mid)
        if np.all(hi - lo < 1e-8):
            break
    return np.where(ok, (lo + hi) / 2.0, np.nan)


def black_scholes_price_v(S, K, t, v, is_call, r: float | None = None, q: float | None = None) -> np.ndarray:
    """Prices over arrays; `is_call` is a boolean array (or scalar) broadcast with the rest."""
    carry = get_carry()
    rate = carry.r if r is None else r
    yld = carry.q if q is None else q
    S = np.asarray(S, dtype=float)
    K = np.asarray(K, dtype=float)
    t = np.where(np.asarray(t, dtype=float) <= 0, _T_FLOOR_PRICE, np.asarray(t, dtype=float))
    v = np.where(np.asarray(v, dtype=float) <= 0, _V_FLOOR_PRICE, np.asarray(v, dtype=float))
    sq_t = np.sqrt(t)
    d1 = (np.log(S / K) + (rate - yld + (v * v) / 2.0) * t) / (v * sq_t)
    d2 = d1 - v * sq_t
    df_q = np.exp(-yld * t)
    df_r = np.exp(-rate * t)
    call = S * df_q * normal_cdf_v(d1) - K * df_r * normal_cdf_v(d2)
    put = K * df_r * normal_cdf_v(-d2) - S * df_q * normal_cdf_v(-d1)
    return np.where(np.asarray(is_call), call, put)
