"""
THE ENGINE CLOCK (ported from src/core/clock.ts, 2026-09-17).

The one place the engine learns what time it is. Live, nothing sets it and
`now()` is the wall clock. In a replay, the harness pins it to the historical
moment before calling the engine, and everything downstream (expiry
resolution, session counts, the photograph's timestamp) follows.

A backtest that reads the wall clock is quietly scoring 2024's chain against
2026's calendar. Every engine-path use of datetime.now() routes through
here; a bare datetime.now() in scoring code is a replay bug.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from typing import Callable, Iterator

_injected: Callable[[], datetime] | None = None


def now() -> datetime:
    """What time the ENGINE thinks it is - wall clock unless a harness pinned it."""
    return _injected() if _injected else datetime.now()


def set_engine_clock(fn: Callable[[], datetime] | None) -> None:
    """Pin the engine clock (replay harness only - never from a surface)."""
    global _injected
    _injected = fn


@contextmanager
def engine_clock(at: datetime) -> Iterator[None]:
    """Run a block with the clock pinned to `at`, restoring afterwards even on error."""
    global _injected
    prev = _injected
    _injected = lambda: at  # noqa: E731
    try:
        yield
    finally:
        _injected = prev
