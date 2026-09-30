"""
THE MARKET CALENDAR (ported from src/core/calendar.ts, 2026-09-17).

One source of truth for "is the market open on this date", and for turning
a horizon in days into a REAL expiry. Options expire on trading days;
anything that names an expiry comes through here.

Dates are naive `date` objects (a calendar key carries no time). "Today" is
what the ENGINE thinks it is - the wall clock live, the pinned instant in a
replay - which is what stops a backtest from resolving 2024's expiries
against 2026's calendar.

The holiday table is the cash market's, 2016-2027, the same list as the
TypeScript calendar, held to it by scripts/calendar-ref.ts. Early closes
are not here: the tape shows when trading stopped, the harness reads it there.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from .clock import now

MARKET_HOLIDAYS: frozenset[str] = frozenset(
    {
        # 2016
        "2016-01-01", "2016-01-18", "2016-02-15", "2016-03-25", "2016-05-30",
        "2016-07-04", "2016-09-05", "2016-11-24", "2016-12-26",
        # 2017
        "2017-01-02", "2017-01-16", "2017-02-20", "2017-04-14", "2017-05-29",
        "2017-07-04", "2017-09-04", "2017-11-23", "2017-12-25",
        # 2018 (12-05: the Bush day of mourning)
        "2018-01-01", "2018-01-15", "2018-02-19", "2018-03-30", "2018-05-28",
        "2018-07-04", "2018-09-03", "2018-11-22", "2018-12-05", "2018-12-25",
        # 2019
        "2019-01-01", "2019-01-21", "2019-02-18", "2019-04-19", "2019-05-27",
        "2019-07-04", "2019-09-02", "2019-11-28", "2019-12-25",
        # 2020
        "2020-01-01", "2020-01-20", "2020-02-17", "2020-04-10", "2020-05-25",
        "2020-07-03", "2020-09-07", "2020-11-26", "2020-12-25",
        # 2021
        "2021-01-01", "2021-01-18", "2021-02-15", "2021-04-02", "2021-05-31",
        "2021-07-05", "2021-09-06", "2021-11-25", "2021-12-24",
        # 2022 (Juneteenth observed from here)
        "2022-01-17", "2022-02-21", "2022-04-15", "2022-05-30", "2022-06-20",
        "2022-07-04", "2022-09-05", "2022-11-24", "2022-12-26",
        # 2023
        "2023-01-02", "2023-01-16", "2023-02-20", "2023-04-07", "2023-05-29",
        "2023-06-19", "2023-07-04", "2023-09-04", "2023-11-23", "2023-12-25",
        # 2024
        "2024-01-01", "2024-01-15", "2024-02-19", "2024-03-29", "2024-05-27",
        "2024-06-19", "2024-07-04", "2024-09-02", "2024-11-28", "2024-12-25",
        # 2025 (01-09: the Carter day of mourning)
        "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18",
        "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27",
        "2025-12-25",
        # 2026
        "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
        "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
        # 2027
        "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
        "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
    }
)

WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]  # Python's weekday(): Monday = 0

RTH_HOURS = 6.5
RTH_MINUTES = RTH_HOURS * 60

_ET = ZoneInfo("America/New_York")


def iso_date(d: date | datetime) -> str:
    """YYYY-MM-DD of the local calendar day."""
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def _at_midnight(d: date | datetime) -> date:
    return d.date() if isinstance(d, datetime) else d


def is_trading_day(d: date | datetime) -> bool:
    dd = _at_midnight(d)
    if dd.weekday() >= 5:
        return False
    return iso_date(dd) not in MARKET_HOLIDAYS


def today() -> date:
    """"Today" as the ENGINE sees it - wall clock live, pinned date in a replay."""
    return _at_midnight(now())


def _walk_to_session(start: date, step: int) -> date:
    """Walk in `step` days until a session is found (bounded - never spins)."""
    d = start
    for _ in range(10):
        if is_trading_day(d):
            break
        d = d + timedelta(days=step)
    return d


def next_session(from_: date | datetime | None = None) -> date:
    """The next date the market is open, today included if it is a session."""
    base = _at_midnight(from_) if from_ is not None else today()
    return _walk_to_session(base, 1)


def sessions_between(from_: date | datetime, to: date | datetime) -> int:
    """Trading days between two dates (exclusive of `from_`, inclusive of `to`)."""
    a = _at_midnight(from_)
    b = _at_midnight(to)
    if b <= a:
        return 0
    n = 0
    cur = a
    while cur < b:
        cur = cur + timedelta(days=1)
        if is_trading_day(cur):
            n += 1
    return n


@dataclass(frozen=True)
class Expiry:
    date: date  # the real expiry date - always a trading day
    label: str  # MM/DD/YY
    weekday: str  # "Fri" - the tell that makes a bad date obvious
    dte: int  # CALENDAR days from today to that date (what pricing uses)
    sessions: int  # TRADING sessions left - the number that actually decays the contract


def fmt_expiry(d: date) -> str:
    return f"{d.month:02d}/{d.day:02d}/{d.year % 100:02d}"


def expiry_for(dte: float, from_: date | datetime | None = None) -> Expiry:
    """
    Resolve a requested horizon (in calendar days) to a REAL expiry. Walk BACK off a
    weekend (a "7 day" weekly is that Friday); if the backward walk reaches today or
    earlier, go FORWARD from the target instead. dte 0 means today when the market is
    open, and the next session when it is not.
    """
    base = _at_midnight(from_) if from_ is not None else today()
    want = max(0, _round_half_away(dte))
    target = base + timedelta(days=want)
    if want == 0:
        d = next_session(base)
    else:
        d = _walk_to_session(target, -1)
        if d <= base:
            d = _walk_to_session(target, 1)
    return Expiry(d, fmt_expiry(d), WEEKDAY[d.weekday()], (d - base).days, sessions_between(base, d))


def _round_half_away(x: float) -> int:
    """JavaScript's Math.round: halves go UP (toward +inf), unlike Python's banker's rounding."""
    import math

    return int(math.floor(x + 0.5))


# ---- the futures clock (T-16) ----------------------------------------------------

FuturesPhase = Literal["GLOBEX_ASIA", "GLOBEX_EUROPE", "RTH", "GLOBEX_POST", "MAINTENANCE", "CLOSED"]


def futures_phase_at(at: datetime) -> FuturesPhase:
    """
    Where a wall-clock instant sits in the Globex week, in New York time. A naive
    `at` is taken as UTC (the same convention as an epoch instant); an aware one is
    converted. Sunday 18:00 the week opens; Mon-Thu 17:00-18:00 maintenance;
    Friday 17:00 the week closes. Holidays read CLOSED (an approximation, as in
    the TypeScript).
    """
    if at.tzinfo is None:
        at = at.replace(tzinfo=ZoneInfo("UTC"))
    et = at.astimezone(_ET)
    mins = et.hour * 60 + et.minute
    wd = et.weekday()  # Mon = 0 ... Sun = 6
    if iso_date(et) in MARKET_HOLIDAYS:
        return "CLOSED"
    if wd == 5:
        return "CLOSED"
    if wd == 6:
        return "GLOBEX_ASIA" if mins >= 18 * 60 else "CLOSED"
    if wd == 4 and mins >= 17 * 60:
        return "CLOSED"
    if mins >= 18 * 60:
        return "GLOBEX_ASIA"
    if mins >= 17 * 60:
        return "MAINTENANCE"
    if mins >= 16 * 60:
        return "GLOBEX_POST"
    if mins >= 9 * 60 + 30:
        return "RTH"
    if mins >= 3 * 60:
        return "GLOBEX_EUROPE"
    return "GLOBEX_ASIA"
