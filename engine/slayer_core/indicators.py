"""
THE INDICATORS (ported from getIndicators in src/core/simulator.ts, 2026-09-17).

The four numbers every snapshot carries beside the book: RSI(14), the 9/21/50
EMAs and the TTM-squeeze approximation. Ported term for term and held to the
TypeScript by tests/test_snapshot.py through scripts/indicators-ref.ts.

The series is the caller's: the simulator hands it a tick history, the live
builder hands it the session's one-minute closes up to the instant. Under 50
points the read is neutral (RSI 50, the EMAs at the last price, no squeeze),
exactly as the TypeScript answers.

Two things kept as the TypeScript has them, because parity is the point: the
EMAs seed at the first price and run over the whole series (no warm-up cut),
and an RSI window with no gains at all reads 50, not 0 (losses with no gains
falls through the `gains !== 0` branch). Both move only in both copies at once.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Indicators:
    rsi: float
    ema9: float
    ema21: float
    ema50: float
    squeeze: bool


def indicators(prices) -> Indicators:
    p = [float(x) for x in prices]
    n = len(p)
    if n == 0:
        raise ValueError("no prices")
    if n < 50:
        return Indicators(50.0, p[-1], p[-1], p[-1], False)

    def ema(period: int, prev: float, cur: float) -> float:
        k = 2 / (period + 1)
        return cur * k + prev * (1 - k)

    ema9 = ema21 = ema50 = p[0]
    for i in range(1, n):
        ema9 = ema(9, ema9, p[i])
        ema21 = ema(21, ema21, p[i])
        ema50 = ema(50, ema50, p[i])

    gains = 0.0
    losses = 0.0
    for i in range(n - 14, n):
        diff = p[i] - p[i - 1]
        if diff > 0:
            gains += diff
        else:
            losses -= diff
    rsi = 50.0
    if losses == 0:
        rsi = 100.0
    elif gains != 0:
        rs = (gains / 14) / (losses / 14)
        rsi = 100 - (100 / (1 + rs))

    window = p[-20:]
    sma20 = 0.0
    for x in window:
        sma20 += x
    sma20 /= 20
    variance = 0.0
    for x in window:
        variance += (x - sma20) ** 2
    variance /= 20
    std = math.sqrt(variance)
    atr_proxy = std * 0.9
    bb_upper = sma20 + 2 * std
    bb_lower = sma20 - 2 * std
    k_upper = sma20 + 1.5 * atr_proxy
    k_lower = sma20 - 1.5 * atr_proxy
    squeeze = (bb_upper < k_upper) and (bb_lower > k_lower)
    return Indicators(rsi, ema9, ema21, ema50, squeeze)
