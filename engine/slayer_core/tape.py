"""
THE TAPE (2026-09-17): what the market was, written once and never edited.

Parquet on object storage (Cloudflare R2, the `tape/` bucket; a directory on
disk in the tests and on the box), one directory per symbol per session day:

    tape/<version>/manifest.json                       what this version asked ThetaData for
    tape/<version>/<SYMBOL>/<YYYY>/<YYYY-MM-DD>/quotes.parquet          option NBBO, one row per contract per interval
    tape/<version>/<SYMBOL>/<YYYY>/<YYYY-MM-DD>/open_interest.parquet   one row per contract, as of the prior close
    tape/<version>/<SYMBOL>/<YYYY>/<YYYY-MM-DD>/underlying.parquet      the underlying's bars
    tape/<version>/<SYMBOL>/derived/daily.parquet      one row per session, the builder's base IV (append-only)

THE RULES.
  IMMUTABLE. A day file is written once; writing it again is an error. A bad
  pull is a new version, never a rewrite (the replay must be able to name the
  exact bytes it read). The one append-only file is `derived/daily.parquet`,
  and it refuses a session it already holds.
  ONE WRITER. The historical pull and the live poller write through
  `write_day`, in Python, whatever serves users. Two writers in two languages
  is how a layout drifts.
  A FRAME IS A FILTER. The reader answers "what was the market at this
  instant" by taking the rows at the last interval timestamp at or before the
  instant, the open interest of that session, and the last bar at or before
  the instant. It never interpolates.
  THE LIVE POLLER WRITES THE SAME SHAPE. A snapshot from the terminal is one
  more interval row; the loop reads it through the same `TapeFrame`.

Times on the tape are UTC instants (timestamp[ms, UTC]); session days are New
York calendar days from the calendar module.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from .calendar import sessions_between

NEW_YORK = ZoneInfo("America/New_York")

QUOTES = pa.schema(
    [
        ("timestamp", pa.timestamp("ms", tz="UTC")),
        ("expiration", pa.date32()),
        ("strike", pa.float64()),
        ("right", pa.string()),  # 'C' | 'P'
        ("bid", pa.float64()),
        ("ask", pa.float64()),
        ("bid_size", pa.int32()),
        ("ask_size", pa.int32()),
    ]
)
OPEN_INTEREST = pa.schema([("expiration", pa.date32()), ("strike", pa.float64()), ("right", pa.string()), ("open_interest", pa.int32())])
BARS = pa.schema(
    [
        ("timestamp", pa.timestamp("ms", tz="UTC")),
        ("open", pa.float64()),
        ("high", pa.float64()),
        ("low", pa.float64()),
        ("close", pa.float64()),
        ("volume", pa.int64()),
        ("count", pa.int32()),  # trades in the bar
        ("vwap", pa.float64()),  # the bar's own VWAP, as ThetaData states it (the rebound math reads VWAP)
    ]
)
DAILY = pa.schema([("session", pa.date32()), ("base_iv_pct", pa.float64()), ("close", pa.float64())])


class TapeError(RuntimeError):
    pass


# ---- the layout ------------------------------------------------------------------------------

def version_dir(root, version: str) -> Path:
    return Path(root) / "tape" / version


def day_dir(root, version: str, symbol: str, day: date) -> Path:
    return version_dir(root, version) / symbol.upper() / f"{day.year:04d}" / day.isoformat()


def daily_path(root, version: str, symbol: str) -> Path:
    return version_dir(root, version) / symbol.upper() / "derived" / "daily.parquet"


@dataclass(frozen=True)
class DayPaths:
    quotes: Path
    open_interest: Path
    underlying: Path


def day_paths(root, version: str, symbol: str, day: date) -> DayPaths:
    d = day_dir(root, version, symbol, day)
    return DayPaths(d / "quotes.parquet", d / "open_interest.parquet", d / "underlying.parquet")


def session_of(at: datetime) -> date:
    """The New York calendar day an instant falls on."""
    if at.tzinfo is None:
        raise TapeError("an instant on the tape carries a zone")
    return at.astimezone(NEW_YORK).date()


# ---- the manifest ----------------------------------------------------------------------------

@dataclass(frozen=True)
class Manifest:
    version: str
    generated_at: str  # ISO instant
    source: str  # "thetadata v3", the terminal's build if known
    interval: str
    max_dte: int | None
    strike_range: int | None
    bar_interval: str
    symbols: list[str]
    note: str = ""
    columns: dict[str, list[str]] = field(default_factory=lambda: {"quotes": QUOTES.names, "open_interest": OPEN_INTEREST.names, "underlying": BARS.names})


def write_manifest(root, manifest: Manifest) -> Path:
    path = version_dir(root, manifest.version) / "manifest.json"
    if path.exists():
        raise TapeError(f"{path} exists: a tape version is written once")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(manifest), indent=2))
    return path


def read_manifest(root, version: str) -> Manifest:
    data = json.loads((version_dir(root, version) / "manifest.json").read_text())
    return Manifest(**data)


# ---- writing --------------------------------------------------------------------------------------

def _write_once(path: Path, table: pa.Table, schema: pa.Schema) -> Path:
    if path.exists():
        raise TapeError(f"{path} exists: the tape is immutable, a re-pull is a new version")
    if table.schema != schema:
        table = table.cast(schema)
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, path, compression="zstd")
    return path


def write_day(root, version: str, symbol: str, day: date, quotes: pa.Table, open_interest: pa.Table, underlying: pa.Table) -> DayPaths:
    """One session day for one symbol, all three tables, or nothing (the first existing file refuses)."""
    paths = day_paths(root, version, symbol, day)
    for p in (paths.quotes, paths.open_interest, paths.underlying):
        if p.exists():
            raise TapeError(f"{p} exists: the tape is immutable, a re-pull is a new version")
    _write_once(paths.quotes, quotes, QUOTES)
    _write_once(paths.open_interest, open_interest, OPEN_INTEREST)
    _write_once(paths.underlying, underlying, BARS)
    return paths


def append_daily(root, version: str, symbol: str, session: date, base_iv_pct: float, close: float) -> Path:
    """The derived daily series: append one session; a session already held is refused."""
    path = daily_path(root, version, symbol)
    row = pa.table({"session": [session], "base_iv_pct": [float(base_iv_pct)], "close": [float(close)]}, schema=DAILY)
    if path.exists():
        have = pq.read_table(path)
        if pc.any(pc.equal(have["session"], pa.scalar(session, pa.date32()))).as_py():
            raise TapeError(f"{symbol} {session} is already on the daily series")
        row = pa.concat_tables([have, row]).sort_by("session")
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(row, path, compression="zstd")
    return path


def read_daily(root, version: str, symbol: str, before: date | None = None) -> pa.Table:
    """The daily series, optionally only the sessions strictly before a day (what a replay may know)."""
    path = daily_path(root, version, symbol)
    if not path.exists():
        return DAILY.empty_table()
    t = pq.read_table(path)
    if before is not None:
        t = t.filter(pc.less(t["session"], pa.scalar(before, pa.date32())))
    return t


# ---- reading: a frame is a filter ------------------------------------------------------------------

def frame_times(root, version: str, symbol: str, day: date) -> list[datetime]:
    """The interval instants the day holds, ascending."""
    paths = day_paths(root, version, symbol, day)
    if not paths.quotes.exists():
        return []
    stamps = pq.read_table(paths.quotes, columns=["timestamp"])["timestamp"]
    return sorted({s.as_py() for s in pc.unique(stamps)})


@dataclass(frozen=True)
class ExpiryQuotes:
    """One expiry of a frame: strikes ascending, the two sides aligned; NaN where a side is not quoted, 0 open interest where none is reported."""

    expiration: date
    dte: int  # calendar days from the session day
    sessions: int  # trading sessions from the session day (0 on the day)
    strikes: np.ndarray
    put_bid: np.ndarray
    put_ask: np.ndarray
    call_bid: np.ndarray
    call_ask: np.ndarray
    put_oi: np.ndarray
    call_oi: np.ndarray


@dataclass(frozen=True)
class TapeFrame:
    """What the market was at one instant: the underlying's price and every quoted contract with its open interest."""

    symbol: str
    at: datetime  # the instant asked for
    stamp: datetime  # the interval instant the quotes carry (at or before `at`)
    session: date
    spot: float
    bar_stamp: datetime | None
    quotes: pa.Table
    open_interest: pa.Table

    def expiries(self) -> list[ExpiryQuotes]:
        """The frame grouped by expiration, nearest first."""
        q = self.quotes.to_pydict()
        oi = self.open_interest.to_pydict()
        oi_by = {(e, s, r): v for e, s, r, v in zip(oi["expiration"], oi["strike"], oi["right"], oi["open_interest"])}
        by_exp: dict[date, dict[tuple[float, str], tuple[float, float]]] = {}
        for e, s, r, b, a in zip(q["expiration"], q["strike"], q["right"], q["bid"], q["ask"]):
            by_exp.setdefault(e, {})[(s, r)] = (b, a)
        out: list[ExpiryQuotes] = []
        for e in sorted(by_exp):
            rows = by_exp[e]
            strikes = np.array(sorted({s for s, _ in rows}), dtype=float)
            n = strikes.size
            pb, pa_, cb, ca = (np.full(n, np.nan) for _ in range(4))
            poi, coi = np.zeros(n), np.zeros(n)
            for i, s in enumerate(strikes):
                if (s, "P") in rows:
                    pb[i], pa_[i] = rows[(s, "P")]
                if (s, "C") in rows:
                    cb[i], ca[i] = rows[(s, "C")]
                poi[i] = oi_by.get((e, s, "P"), 0)
                coi[i] = oi_by.get((e, s, "C"), 0)
            out.append(ExpiryQuotes(e, (e - self.session).days, sessions_between(self.session, e), strikes, pb, pa_, cb, ca, poi, coi))
        return out


def read_frame(root, version: str, symbol: str, at: datetime) -> TapeFrame:
    session = session_of(at)
    paths = day_paths(root, version, symbol, session)
    if not paths.quotes.exists():
        raise TapeError(f"no tape for {symbol} on {session} in {version}")
    at_utc = at.astimezone(timezone.utc)
    quotes = pq.read_table(paths.quotes, filters=[("timestamp", "<=", at_utc)])
    if quotes.num_rows == 0:
        raise TapeError(f"no quotes for {symbol} at or before {at_utc.isoformat()} on {session}")
    stamp = pc.max(quotes["timestamp"]).as_py()
    quotes = quotes.filter(pc.equal(quotes["timestamp"], pa.scalar(stamp, QUOTES.field("timestamp").type)))
    oi = pq.read_table(paths.open_interest) if paths.open_interest.exists() else OPEN_INTEREST.empty_table()
    spot = float("nan")
    bar_stamp = None
    if paths.underlying.exists():
        bars = pq.read_table(paths.underlying, filters=[("timestamp", "<=", at_utc)])
        if bars.num_rows:
            last = pc.max(bars["timestamp"]).as_py()
            row = bars.filter(pc.equal(bars["timestamp"], pa.scalar(last, BARS.field("timestamp").type)))
            spot = float(row["close"][0].as_py())
            bar_stamp = last
    return TapeFrame(symbol.upper(), at_utc, stamp, session, spot, bar_stamp, quotes, oi)


def bars_until(root, version: str, symbol: str, at: datetime) -> np.ndarray:
    """The session's closes at or before the instant, ascending: the indicator series."""
    paths = day_paths(root, version, symbol, session_of(at))
    if not paths.underlying.exists():
        return np.zeros(0)
    t = pq.read_table(paths.underlying, filters=[("timestamp", "<=", at.astimezone(timezone.utc))]).sort_by("timestamp")
    return np.array(t["close"].to_pylist(), dtype=float)
