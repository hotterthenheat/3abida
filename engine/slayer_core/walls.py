"""
NAMING THE WALLS, THE FLIP, THE HEAVIEST STRIKE AND THE AIR POCKETS
(ported from src/core/walls.ts and src/data/airPockets.ts, 2026-09-17).

One rule each, in one place. The TypeScript file exists because the wall rule
was written twice and the copies disagreed, and the flip rule four times. The
port keeps that discipline: nothing else in the engine picks a wall or a flip.

THE SIGN IS THE OPTION SIDE. Net exposure is the call leg plus the put leg
with the dealers' prior on each (exposure.DEALER_CALL, exposure.DEALER_PUT;
the put leg of GEX flipped), so NEGATIVE is call-dominant and POSITIVE is
put-dominant. A call wall is the heaviest NEGATIVE strike above spot; a put
wall the heaviest POSITIVE strike below it. Side of spot alone is a proxy that
fails on a sticky book (SPY 505 carried -$436.8M, call-dominant, and was
named the put wall).

"NO WALL" AND "NO FLIP" ARE REAL STATES OF A BOOK. They come back as None and
the caller decides what to do (the profile falls back to spot, the way the
TypeScript profile does). The spec's section 5.6 says the same of the flip: no
sign change means "nearest to zero", never an invented flip.

Ties and order: every pick is the FIRST strictly-heavier candidate in the
order given, exactly as the TypeScript loops resolve them.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# ---- the air pocket's thresholds, argued rather than tuned (airPockets.ts) ----
QUIET_SHARE = 0.12  # a strike under this share of the window's heaviest is quiet
SHELF_SHARE = 0.35  # a strike over this share bounds a pocket
MIN_STRIKES = 3  # fewer contiguous quiet strikes than this is texture, not a pocket


def pick_walls(strikes, values, spot: float) -> tuple[float | None, float | None]:
    """
    (call_wall, put_wall): the heaviest call-dominant (negative) strike above
    spot and the heaviest put-dominant (positive) strike below it; None where
    nothing on that side qualifies.
    """
    s = np.asarray(strikes, dtype=float)
    v = np.asarray(values, dtype=float)
    a = np.abs(v)
    call_wall: float | None = None
    put_wall: float | None = None
    above = np.flatnonzero((s > spot) & (v < 0))
    if above.size:
        call_wall = float(s[above[int(np.argmax(a[above]))]])
    below = np.flatnonzero((s < spot) & (v > 0))
    if below.size:
        put_wall = float(s[below[int(np.argmax(a[below]))]])
    return call_wall, put_wall


def pick_flip(strikes, values, spot: float) -> float | None:
    """
    The gamma flip: the midpoint of the sign change NEAREST SPOT, over the
    strikes sorted ascending. None when the field never changes sign. A zero
    counts as a sign of its own, so a strike at exactly zero flips against
    both neighbours, as Math.sign has it.
    """
    s = np.asarray(strikes, dtype=float)
    v = np.asarray(values, dtype=float)
    if s.size < 2:
        return None
    order = np.argsort(s, kind="stable")
    ss = s[order]
    sg = np.sign(v[order])
    change = np.flatnonzero(sg[1:] != sg[:-1])
    if change.size == 0:
        return None
    mids = (ss[change] + ss[change + 1]) / 2
    return float(mids[int(np.argmin(np.abs(mids - spot)))])


def heaviest(values) -> int | None:
    """
    Index of the first strictly-largest |value|, or None when nothing is heavier
    than zero (an empty or all-zero field has no heaviest). The supreme, the
    pin and the king all reduce to this.
    """
    a = np.abs(np.asarray(values, dtype=float))
    if a.size == 0:
        return None
    a = np.where(np.isnan(a), 0.0, a)
    i = int(np.argmax(a))
    return i if a[i] > 0 else None


@dataclass(frozen=True)
class AirPocket:
    from_: float  # upper strike of the empty run (inclusive)
    to: float  # lower strike of the empty run (inclusive)
    width: int  # strikes in the run
    ceiling: float  # the shelves that bound it, above and below
    floor: float
    peak_share: float  # largest |net gamma| inside the run, against the window's heaviest


def find_air_pockets(strikes_desc, net_gex_desc) -> list[AirPocket]:
    """
    Where price does NOT stop: a run of at least MIN_STRIKES strikes carrying
    under QUIET_SHARE of the window's heaviest net gamma, bounded on BOTH sides
    by a strike carrying at least SHELF_SHARE of it. A quiet run at the edge of
    the window is the edge of the book, not a pocket. Rows run DESCENDING, the
    profile's own order.
    """
    s = [float(x) for x in strikes_desc]
    mag = [abs(float(x)) for x in net_gex_desc]
    n = len(s)
    if n < MIN_STRIKES + 2:
        return []
    heaviest_abs = max(mag)
    if heaviest_abs <= 0:
        return []
    quiet = [m / heaviest_abs < QUIET_SHARE for m in mag]
    shelf = [m / heaviest_abs >= SHELF_SHARE for m in mag]
    out: list[AirPocket] = []
    i = 0
    while i < n:
        if not quiet[i]:
            i += 1
            continue
        j = i
        while j + 1 < n and quiet[j + 1]:
            j += 1
        width = j - i + 1
        above = i - 1
        below = j + 1
        if width >= MIN_STRIKES and above >= 0 and below < n and shelf[above] and shelf[below]:
            out.append(AirPocket(s[i], s[j], width, s[above], s[below], max(mag[i : j + 1]) / heaviest_abs))
        i = j + 1
    return out
