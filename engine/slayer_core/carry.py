"""
THE CARRY SEAM (ported from src/core/carry.ts, 2026-09-17).

The risk-free rate and the dividend yield every greek is priced against.
Neither is live today: they arrive as NAMED ASSUMPTIONS with their basis
written down, and every consumer can ask `carry_source()` what it is
standing on. When a rates feed lands, `set_carry` takes the live figures and
nothing downstream changes.

DEFAULT_R is the neighbourhood of the front-end Treasury yield; DEFAULT_Q is
roughly the S&P 500's trailing yield - right for the index ETFs, a deliberate
overstatement for a zero-yield name.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Carry:
    r: float  # continuously-compounded risk-free rate, annualised (0.042 = 4.2%)
    q: float  # continuous dividend yield, annualised (0.012 = 1.2%)


@dataclass(frozen=True)
class CarrySource:
    kind: str  # 'assumed' until a feed sets it
    note: str  # one line a surface can show a reader without lying


DEFAULT_R = 0.042
DEFAULT_Q = 0.012

_ASSUMED_NOTE = (
    f"assumed r {DEFAULT_R * 100:.1f}% · q {DEFAULT_Q * 100:.1f}% — "
    "no rates or corporate-actions feed on this account"
)

_current = Carry(DEFAULT_R, DEFAULT_Q)
_source = CarrySource("assumed", _ASSUMED_NOTE)


def get_carry() -> Carry:
    """The rate and yield every greek is priced against."""
    return _current


def carry_source() -> CarrySource:
    """What the figures above are standing on - for surfaces that caveat."""
    return _source


def _ok(v: float | None) -> bool:
    # a feed hiccup that hands back NaN must leave the last good carry standing,
    # and a "rate" of 40% is a units error, not a market
    return v is None or (math.isfinite(v) and -0.05 < v < 0.25)


def set_carry(r: float | None = None, q: float | None = None, note: str | None = None) -> bool:
    """Point the seam at real figures. Rejects non-finite or absurd input."""
    global _current, _source
    if not _ok(r) or not _ok(q):
        return False
    _current = Carry(r if r is not None else _current.r, q if q is not None else _current.q)
    _source = CarrySource("feed", note or f"feed r {_current.r * 100:.2f}% · q {_current.q * 100:.2f}%")
    return True


def reset_carry() -> None:
    """Back to the documented assumptions - for tests and for a feed dropping."""
    global _current, _source
    _current = Carry(DEFAULT_R, DEFAULT_Q)
    _source = CarrySource("assumed", _ASSUMED_NOTE)
