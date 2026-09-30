"""
PARITY WITH THE TYPESCRIPT CALENDAR. scripts/calendar-ref.ts writes
tests/fixtures/calendar_ref.json: every day 2016-2027 as a session or not,
session counts over spans, expiries resolved from four telling weeks, and the
futures clock over one week of half hours plus a holiday. Every answer here
must match exactly - a calendar is not a place for tolerance.
"""

import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from slayer_core.calendar import expiry_for, futures_phase_at, is_trading_day, sessions_between
from slayer_core.clock import engine_clock

REF = Path(__file__).parent / "fixtures" / "calendar_ref.json"


def d(iso: str) -> date:
    return date.fromisoformat(iso)


@pytest.fixture(scope="module")
def ref():
    if not REF.exists():
        pytest.skip("run `npx tsx scripts/calendar-ref.ts` first to write the reference")
    return json.loads(REF.read_text())


def test_every_day_2016_to_2027(ref):
    wrong = [row["date"] for row in ref["days"] if is_trading_day(d(row["date"])) != row["trading"]]
    assert not wrong, f"session/holiday disagreements: {wrong[:10]}"
    assert len(ref["days"]) == 4383  # 12 years, three leap years


def test_sessions_between(ref):
    for row in ref["between"]:
        assert sessions_between(d(row["from"]), d(row["to"])) == row["sessions"], row


def test_expiries(ref):
    for row in ref["expiries"]:
        e = expiry_for(row["dte"], d(row["from"]))
        got = (e.date.isoformat(), e.label, e.weekday, e.dte, e.sessions)
        want = (row["date"], row["label"], row["weekday"], row["dteOut"], row["sessions"])
        assert got == want, f"from {row['from']} dte {row['dte']}: {got} vs {want}"


def test_expiry_reads_the_engine_clock(ref):
    # with no `from_`, the calendar asks the engine what today is - a pinned clock wins
    row = ref["expiries"][0]
    with engine_clock(datetime.fromisoformat(row["from"] + "T10:00:00")):
        e = expiry_for(row["dte"])
    assert e.date.isoformat() == row["date"]


def test_futures_phase(ref):
    for row in ref["phases"]:
        at = datetime.fromtimestamp(row["epochMs"] / 1000, tz=timezone.utc)
        assert futures_phase_at(at) == row["phase"], f"{at.isoformat()}: {futures_phase_at(at)} vs {row['phase']}"
